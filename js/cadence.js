export function attachCadence(app) {
    Object.assign(app, {
getLatestWellbeingHistoryDate: function(kind) {
        const history = kind === 'swls'
            ? window.sistemaVidaState?.swls?.history
            : window.sistemaVidaState?.wellbeingHistory?.[kind];
        if (!history || typeof history !== 'object') return '';
        return Object.keys(history)
            .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')))
            .sort((a, b) => String(b).localeCompare(String(a)))[0] || '';
    },

hasMeaningfulWheelContent: function() {
        const dimensions = window.sistemaVidaState?.dimensions || {};
        const axes = this.getWheelAxes ? this.getWheelAxes() : ['Saude', 'Mente', 'Carreira', 'Financas', 'Relacionamentos', 'Familia', 'Lazer', 'Proposito'];
        const scores = axes
            .map((axis) => Number(dimensions?.[axis]?.score))
            .filter((score) => Number.isFinite(score));
        return scores.length === axes.length && scores.some((score) => score !== 1);
    },

hasCompletePermaContent: function() {
        const perma = window.sistemaVidaState?.perma || {};
        return ['P', 'E', 'R', 'M', 'A']
            .every((key) => Number(perma?.[key]) > 0);
    },

hasMeaningfulSwlsContent: function() {
        const swls = window.sistemaVidaState?.swls || {};
        if (String(swls.lastDate || '').trim()) return true;
        return Object.keys(swls.history || {}).some((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')));
    },

ensureDerivedCadenceEntry: function(toolKey, dateKey, options = {}) {
        if (!toolKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return;
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        if (!window.sistemaVidaState.profile.cadence || typeof window.sistemaVidaState.profile.cadence !== 'object') {
            window.sistemaVidaState.profile.cadence = {};
        }
        const previous = window.sistemaVidaState.profile.cadence[toolKey] || {};
        if (String(previous.lastAt || '').trim()) return;
        const markerKey = options.markerKey || 'migratedFromContent';
        const history = Array.isArray(previous.history) ? [...previous.history] : [];
        const at = String(options.updatedAt || `${dateKey}T12:00:00.000Z`);
        if (!history.some((entry) => String(entry?.date || '') === dateKey)) {
            history.unshift({ date: dateKey, at });
        }
        window.sistemaVidaState.profile.cadence[toolKey] = {
            ...previous,
            lastAt: dateKey,
            updatedAt: at,
            history: history
                .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || '')))
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.at || '').localeCompare(String(a.at || '')))
                .slice(0, 24),
            [markerKey]: true
        };
        this._cadenceNeedsMigrationSave = true;
    },

ensureCadenceState: function() {
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        const profile = window.sistemaVidaState.profile;
        if (!profile.cadence || typeof profile.cadence !== 'object' || Array.isArray(profile.cadence)) profile.cadence = {};
        if (!profile.cadence.shutdown || typeof profile.cadence.shutdown !== 'object') profile.cadence.shutdown = {};
        if (!profile.cadence.cycleReview || typeof profile.cadence.cycleReview !== 'object') profile.cadence.cycleReview = {};
        if (!profile.cadence.shutdown.lastAt && profile.cadence.diary?.lastAt) {
            profile.cadence.shutdown = {
                ...profile.cadence.shutdown,
                lastAt: String(profile.cadence.diary.lastAt),
                updatedAt: profile.cadence.diary.updatedAt || new Date().toISOString(),
                migratedFromDiary: true
            };
            this._cadenceNeedsMigrationSave = true;
        }
        Object.keys(profile.cadence).forEach((key) => {
            const item = profile.cadence[key];
            if (!item || typeof item !== 'object') profile.cadence[key] = {};
            if (profile.cadence[key].lastAt && typeof profile.cadence[key].lastAt !== 'string') {
                profile.cadence[key].lastAt = String(profile.cadence[key].lastAt);
            }
            if (!Array.isArray(profile.cadence[key].history)) profile.cadence[key].history = [];
            profile.cadence[key].history = profile.cadence[key].history
                .map(entry => {
                    const date = String(entry?.date || entry?.lastAt || '').slice(0, 10);
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
                    return {
                        date,
                        at: String(entry?.at || entry?.updatedAt || `${date}T00:00:00.000Z`)
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
                .slice(0, 24);
        });
        if (!profile.cadence.lifeGoals?.lastAt && this.hasLifeGoalsContent()) {
            profile.cadence.lifeGoals = {
                ...(profile.cadence.lifeGoals || {}),
                lastAt: this.getLocalDateKey(),
                updatedAt: new Date().toISOString(),
                migratedFromContent: true
            };
            this._cadenceNeedsMigrationSave = true;
        }
        const legacyPurposeCadence = profile.cadence.purpose || {};
        [
            ['ikigai', this.hasCompleteIkigaiContent?.()],
            ['legacy', this.hasCompleteLegacyContent?.()],
            ['vision', this.hasCompleteVisionContent?.()]
        ].forEach(([key, hasContent]) => {
            if (!hasContent) return;
            this.ensureDerivedCadenceEntry?.(
                key,
                legacyPurposeCadence.lastAt || this.getLocalDateKey(),
                {
                    markerKey: 'migratedFromContent',
                    updatedAt: legacyPurposeCadence.updatedAt || new Date().toISOString()
                }
            );
        });
        [
            {
                key: 'wheel',
                dateKey: this.getLatestWellbeingHistoryDate?.('wheel') || (this.hasMeaningfulWheelContent?.() ? this.getLocalDateKey() : ''),
                markerKey: this.getLatestWellbeingHistoryDate?.('wheel') ? 'migratedFromHistory' : 'migratedFromContent'
            },
            {
                key: 'perma',
                dateKey: this.getLatestWellbeingHistoryDate?.('perma') || (this.hasCompletePermaContent?.() ? this.getLocalDateKey() : ''),
                markerKey: this.getLatestWellbeingHistoryDate?.('perma') ? 'migratedFromHistory' : 'migratedFromContent'
            },
            {
                key: 'swls',
                dateKey: String(profile.swls?.lastDate || window.sistemaVidaState?.swls?.lastDate || '').trim() || this.getLatestWellbeingHistoryDate?.('swls'),
                markerKey: String(profile.swls?.lastDate || window.sistemaVidaState?.swls?.lastDate || '').trim() ? 'migratedFromContent' : 'migratedFromHistory'
            },
            {
                key: 'odyssey',
                dateKey: this.getLatestWellbeingHistoryDate?.('odyssey') || (this.hasCompleteOdysseyContent?.() ? this.getLocalDateKey() : ''),
                markerKey: this.getLatestWellbeingHistoryDate?.('odyssey') ? 'migratedFromHistory' : 'migratedFromContent'
            }
        ].forEach((entry) => {
            if (!entry.dateKey) return;
            this.ensureDerivedCadenceEntry?.(entry.key, entry.dateKey, { markerKey: entry.markerKey });
        });
    },

hasLifeGoalsContent: function() {
        return Array.isArray(window.sistemaVidaState.entities?.metas) && window.sistemaVidaState.entities.metas.length > 0;
    },

hasPurposeContent: function() {
        const profile = window.sistemaVidaState.profile || {};
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};
        const vision = profile.vision || {};
        const fields = [
            ikigai.missao,
            ikigai.vocacao,
            ikigai.paixao,
            ikigai.profissao,
            ikigai.love,
            ikigai.good,
            ikigai.need,
            ikigai.paid,
            ikigai.sintese,
            legacyObj.familia,
            legacyObj.profissao,
            legacyObj.mundo,
            vision.saude,
            vision.carreira,
            vision.intelecto,
            vision.quote
        ];
        return fields.some((value) => typeof value === 'string' ? value.trim() !== '' : Boolean(value));
    },

hasCompleteIkigaiContent: function() {
        const ikigai = window.sistemaVidaState.profile?.ikigai || {};
        return ['love', 'good', 'need', 'paid', 'paixao', 'profissao', 'vocacao', 'missao', 'sintese']
            .every((key) => String(ikigai[key] || '').trim());
    },

hasCompleteLegacyContent: function() {
        const legacyObj = window.sistemaVidaState.profile?.legacyObj || {};
        return ['familia', 'profissao', 'mundo']
            .every((key) => String(legacyObj[key] || '').trim());
    },

hasCompleteVisionContent: function() {
        const vision = window.sistemaVidaState.profile?.vision || {};
        return ['saude', 'carreira', 'intelecto', 'quote']
            .every((key) => String(vision[key] || '').trim());
    },

hasCompleteOdysseyContent: function() {
        const odyssey = window.sistemaVidaState.profile?.odyssey || {};
        return ['cenarioA', 'cenarioB', 'cenarioC']
            .some((key) => String(odyssey[key] || '').trim());
    },

hasMinimumPurposeContent: function() {
        return this.hasPurposeContent();
    },

getCadenceFrequencyLabel: function(expectedDays) {
        const safeDays = Math.max(0, Number(expectedDays) || 0);
        if (safeDays <= 1) return 'Diário';
        if (safeDays === 7) return 'Semanal';
        if (safeDays === 30) return 'Mensal';
        if (safeDays === 45) return 'A cada 45 dias';
        if (safeDays === 90) return 'Trimestral';
        if (safeDays === 180) return 'Semestral';
        return `${safeDays} dias`;
    },

getCadenceConfig: function() {
        return {
            checkin: { label: 'Check-in diário', expectedDays: 1, icon: 'monitor_heart', why: 'Sono, energia, humor e estresse.' },
            diary: { label: 'Diário / Gratidão', expectedDays: 1, icon: 'edit_note', why: 'Reflexão e registro do dia.' },
            shutdown: { label: 'Shutdown ritual', expectedDays: 1, icon: 'power_settings_new', why: 'Encerramento consciente do dia.' },
            weeklyPlan: { label: 'Planejamento semanal', expectedDays: 7, icon: 'edit_calendar', why: 'Escolher a carga da semana.' },
            weeklyReview: { label: 'Revisão semanal', expectedDays: 7, icon: 'rate_review', why: 'Transformar experiência em aprendizado.' },
            cycleReview: { label: 'Revisão de ciclo', expectedDays: 84, icon: 'fact_check', why: 'Fechar o ciclo de 12 semanas e decidir o destino dos Projetos.' },
            wheel: { label: 'Roda da Vida', expectedDays: 45, icon: 'pie_chart', why: 'Mapa de equilíbrio entre as áreas da vida.' },
            perma: { label: 'PERMA', expectedDays: 90, icon: 'psychology', why: 'Diagnóstico profundo de florescimento.' },
            swls: { label: 'SWLS', expectedDays: 30, icon: 'monitoring', why: 'Termômetro rápido de satisfação global.' },
            lifeGoals: { label: 'Metas de vida', expectedDays: 180, icon: 'flag', why: 'Revisão semestral das metas de 1 a 5 anos e do rumo de longo prazo.' },
            odyssey: { label: 'Odyssey Plan', expectedDays: 180, icon: 'explore', why: 'Revisão semestral dos cenários de vida.' },
            ikigai: { label: 'Ikigai', expectedDays: 180, icon: 'star', why: 'Revisão semestral do mapa completo de amor, talento, necessidade e sustento.' },
            legacy: { label: 'Legado', expectedDays: 180, icon: 'auto_stories', why: 'Revisão semestral do impacto desejado em família, profissão e mundo.' },
            vision: { label: 'Visão de Vida', expectedDays: 180, icon: 'visibility', why: 'Revisão semestral da vida concreta que você escolhe construir.' }
        };
    },

markCadence: function(toolKey, dateKey = this.getLocalDateKey()) {
        this.ensureCadenceState();
        const config = this.getCadenceConfig();
        if (!config[toolKey]) return;
        const previous = window.sistemaVidaState.profile.cadence[toolKey] || {};
        const history = Array.isArray(previous.history) ? [...previous.history] : [];
        const now = new Date().toISOString();
        const existingIdx = history.findIndex(entry => String(entry?.date || '') === dateKey);
        if (existingIdx >= 0) {
            history[existingIdx] = { ...history[existingIdx], date: dateKey, at: now };
        } else {
            history.unshift({ date: dateKey, at: now });
        }
        window.sistemaVidaState.profile.cadence[toolKey] = {
            ...previous,
            lastAt: dateKey,
            updatedAt: now,
            history: history
                .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || '')))
                .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at || '').localeCompare(String(a.at || '')))
                .slice(0, 24)
        };
    },

getCadenceStatus: function(toolKey) {
        this.ensureCadenceState();
        const cfg = this.getCadenceConfig()[toolKey];
        if (!cfg) return { state: 'overdue', daysSince: null, expectedFreq: 0, label: toolKey };
        const lastAt = window.sistemaVidaState.profile.cadence?.[toolKey]?.lastAt || '';
        if (!lastAt) return { ...cfg, state: 'overdue', daysSince: null, expectedFreq: cfg.expectedDays, lastAt: '' };
        const today = new Date(this.getLocalDateKey() + 'T00:00:00');
        const last = new Date(lastAt + 'T00:00:00');
        const daysSince = Number.isFinite(last.getTime()) ? Math.max(0, Math.floor((today - last) / 86400000)) : null;
        let state = 'overdue';
        if (daysSince === null) state = 'overdue';
        else if (cfg.expectedDays <= 1) state = daysSince === 0 ? 'ok' : daysSince === 1 ? 'soon' : 'overdue';
        else if (daysSince <= Math.floor(cfg.expectedDays * 0.75)) state = 'ok';
        else if (daysSince <= cfg.expectedDays) state = 'soon';
        return { ...cfg, state, daysSince, expectedFreq: cfg.expectedDays, lastAt };
    },

renderCadenceBadge: function(toolKey) {
        const status = this.getCadenceStatus(toolKey);
        const isNeverDone = status.state === 'overdue' && status.daysSince === null;
        const cfg = isNeverDone
            ? { text: 'Nunca feito', cls: 'bg-surface-container-high text-outline border-outline-variant/30' }
            : {
                ok: { text: 'Em dia', cls: 'bg-primary/10 text-primary border-primary/20' },
                soon: { text: 'Próximo', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
                overdue: { text: 'Atrasado', cls: 'bg-error/10 text-error border-error/20' }
            }[status.state] || {};
        return `<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.cls}">
            ${cfg.text}
        </span>`;
    },

renderCadenceMeta: function(toolKey) {
        const status = this.getCadenceStatus(toolKey);
        const freq = this.getCadenceFrequencyLabel(status.expectedFreq);
        const lastLabel = status.daysSince === null
            ? 'Nunca feito'
            : status.daysSince === 0
                ? 'Feito hoje'
                : `Última vez há ${status.daysSince} dia${status.daysSince === 1 ? '' : 's'}`;
        return `<div class="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-outline">
            <span class="inline-flex items-center rounded-full bg-surface-container-high px-2 py-1">${this.escapeHtml(freq)}</span>
            <span class="inline-flex items-center rounded-full bg-surface-container-high px-2 py-1">${this.escapeHtml(lastLabel)}</span>
        </div>`;
    },

getCadenceHistoryEvents: function(options = {}) {
        this.ensureCadenceState();
        const config = this.getCadenceConfig();
        const events = [];
        Object.entries(config).forEach(([key, cfg]) => {
            const item = window.sistemaVidaState.profile?.cadence?.[key] || {};
            const seen = new Set();
            const entries = Array.isArray(item.history) && item.history.length
                ? item.history
                : item.lastAt ? [{ date: item.lastAt, at: item.updatedAt || `${item.lastAt}T00:00:00.000Z` }] : [];
            entries.forEach(entry => {
                const date = String(entry?.date || '').slice(0, 10);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) return;
                seen.add(date);
                events.push({
                    key,
                    date,
                    at: String(entry?.at || `${date}T00:00:00.000Z`),
                    label: cfg.label,
                    icon: cfg.icon,
                    expectedDays: cfg.expectedDays
                });
            });
        });
        return events
            .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
            .slice(0, Math.max(1, Number(options.limit) || 60));
    },

renderCadenceHistoryPanel: function() {
        const container = document.getElementById('cadence-history-panel');
        if (!container) return;
        const config = this.getCadenceConfig();
        const focusKeys = ['weeklyPlan', 'weeklyReview', 'cycleReview', 'wheel', 'perma', 'swls', 'lifeGoals', 'odyssey', 'ikigai', 'legacy', 'vision'];
        const formatDate = (dateKey) => dateKey
            ? new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Nunca feito';
        const cards = focusKeys.map(key => {
            const cfg = config[key];
            const status = this.getCadenceStatus(key);
            const item = window.sistemaVidaState.profile?.cadence?.[key] || {};
            const history = (Array.isArray(item.history) && item.history.length
                ? item.history
                : item.lastAt ? [{ date: item.lastAt }] : [])
                .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || '')))
                .slice(0, 3);
            const nextLabel = status.daysSince === null
                ? 'Sem próxima data até o primeiro registro'
                : status.state === 'overdue'
                    ? 'Revisão pendente agora'
                    : `Próxima em ${Math.max(0, status.expectedFreq - status.daysSince)} dia${Math.max(0, status.expectedFreq - status.daysSince) === 1 ? '' : 's'}`;
            return `<div class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-on-surface flex items-center gap-2">
                            <span class="material-symbols-outlined notranslate text-primary text-[18px]">${this.escapeHtml(cfg.icon)}</span>
                            ${this.escapeHtml(cfg.label)}
                        </p>
                        <p class="mt-1 text-xs text-on-surface-variant">${this.escapeHtml(nextLabel)}</p>
                    </div>
                    ${this.renderCadenceBadge(key)}
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                    ${history.length
                        ? history.map(entry => `<span class="inline-flex rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-outline">${this.escapeHtml(formatDate(entry.date))}</span>`).join('')
                        : '<span class="text-[10px] italic text-outline">Nenhum registro ainda.</span>'}
                </div>
            </div>`;
        }).join('');
        container.innerHTML = `<div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 md:p-5">
            <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h4 class="font-headline text-xl italic text-on-background">Ritmos e revisões</h4>
                    <p class="mt-1 text-xs text-on-surface-variant leading-relaxed">Quando cada ferramenta foi revisitada e quando merece atenção de novo.</p>
                </div>
                <span class="material-symbols-outlined notranslate text-primary">history</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${cards}</div>
        </div>`;
    },

getNextRitualSuggestion: function() {
        const routeMap = {
            checkin:      { view: 'hoje',    sectionId: 'daily-checkin-panel',       tabId: '' },
            diary:        { view: 'hoje',    sectionId: 'hoje-diario-section',       tabId: '' },
            shutdown:     { view: 'hoje',    sectionId: 'hoje-diario-section',       tabId: '' },
            weeklyPlan:   { view: 'planos',  sectionId: 'tab-semanal',              tabId: 'semanal' },
            weeklyReview: { view: 'planos',  sectionId: 'weekly-plan-primary-action', tabId: 'semanal' },
            cycleReview:  { view: 'planos',  sectionId: 'tab-ciclo',                tabId: 'ciclo' },
            wheel:        { view: 'proposito', sectionId: 'proposito-roda-section', tabId: '' },
            perma:        { view: 'proposito', sectionId: 'perma-section',          tabId: '' },
            swls:         { view: 'proposito', sectionId: 'swls-section',           tabId: '' },
            odyssey:      { view: 'proposito', sectionId: 'odyssey-section',        tabId: '' },
            ikigai:       { view: 'proposito', sectionId: 'proposito-ikigai-section', tabId: '' },
            legacy:       { view: 'proposito', sectionId: 'proposito-legado-section', tabId: '' },
            vision:       { view: 'proposito', sectionId: 'proposito-visao-section', tabId: '' },
            lifeGoals:    { view: 'planos',  sectionId: '',                         tabId: 'metas' }
        };
        // diary/shutdown só fazem sentido no fim do dia; weeklyReview/Plan/cycle em dias certos
        const hour = new Date().getHours();
        const checkinStatus = this.getCadenceStatus('checkin');
        const shutdownStatus = this.getCadenceStatus('shutdown');
        const isMorning = hour >= 4 && hour < 14;
        const isNight = hour >= 18 || hour < 4;
        if (isMorning && checkinStatus?.state !== 'ok') {
            return { key: 'checkin', route: routeMap.checkin, ...checkinStatus };
        }
        if (isNight && shutdownStatus?.state !== 'ok') {
            return { key: 'shutdown', route: routeMap.shutdown, ...shutdownStatus };
        }
        const dow  = new Date().getDay(); // 0=dom, 1=seg, â€¦, 5=sex, 6=sÃ¡b
        const keys = Object.keys(routeMap).filter(k => {
            if (k === 'diary' || k === 'shutdown') return hour >= 14;
            if (k === 'weeklyReview') return [5, 6, 0].includes(dow);
            if (k === 'weeklyPlan')   return [0, 1].includes(dow);
            if (k === 'cycleReview')  return [0, 1].includes(dow);
            if (['odyssey', 'ikigai', 'legacy', 'vision'].includes(k)) {
                const hasCadence = !!window.sistemaVidaState.profile?.cadence?.[k]?.lastAt;
                const hasContent = {
                    odyssey: this.hasCompleteOdysseyContent?.(),
                    ikigai: this.hasCompleteIkigaiContent?.(),
                    legacy: this.hasCompleteLegacyContent?.(),
                    vision: this.hasCompleteVisionContent?.()
                }[k];
                return hasCadence || !!hasContent;
            }
            return true;
        });
        const statuses = keys.map(key => ({ key, route: routeMap[key], ...this.getCadenceStatus(key) }));
        const overdue = statuses.filter(s => s.state === 'overdue').sort((a, b) => {
            if (a.daysSince === null && b.daysSince === null) return 0;
            if (a.daysSince === null) return -1;
            if (b.daysSince === null) return 1;
            return b.daysSince - a.daysSince;
        });
        if (overdue.length) return overdue[0];
        const soon = statuses.filter(s => s.state === 'soon').sort((a, b) => (b.daysSince || 0) - (a.daysSince || 0));
        return soon[0] || null;
    },

renderCadencePanel: function(containerId = 'cadence-status-panel', limit = 4) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const keys = Object.keys(this.getCadenceConfig());
        const items = keys
            .map(key => ({ key, status: this.getCadenceStatus(key) }))
            .sort((a, b) => {
                const rank = { overdue: 0, soon: 1, ok: 2 };
                return (rank[a.status.state] ?? 9) - (rank[b.status.state] ?? 9);
            })
            .slice(0, limit);
        container.innerHTML = items.map(({ key, status }) => `
            <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-bold text-on-surface flex items-center gap-1">
                        <span class="material-symbols-outlined notranslate text-primary text-[16px]">${this.escapeHtml(status.icon)}</span>
                        ${this.escapeHtml(status.label)}
                    </p>
                    <p class="mt-1 text-[11px] text-outline leading-relaxed">${this.escapeHtml(status.why)}</p>
                    ${this.renderCadenceMeta(key)}
                </div>
                <div class="shrink-0">${this.renderCadenceBadge(key)}</div>
            </div>
        `).join('');
    },

renderProfileCadence: function() {
        const container = document.getElementById('profile-cadence-list');
        if (!container) return;
        const keys = Object.keys(this.getCadenceConfig());
        container.innerHTML = keys.map(key => {
            const status = this.getCadenceStatus(key);
            return `
            <div class="flex items-start justify-between gap-4 rounded-xl bg-surface-container-low p-4 border border-outline-variant/10">
                <div class="min-w-0">
                    <p class="text-sm font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined notranslate text-primary text-[18px]">${this.escapeHtml(status.icon)}</span>
                        ${this.escapeHtml(status.label)}
                    </p>
                    <p class="mt-1 text-xs text-outline leading-relaxed">${this.escapeHtml(status.why)}</p>
                    ${this.renderCadenceMeta(key)}
                </div>
                <div class="shrink-0">${this.renderCadenceBadge(key)}</div>
            </div>`;
        }).join('');
    },
    });
}
