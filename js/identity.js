export function attachIdentity(app) {
    Object.assign(app, {
ensureIdentityState: function() {
        const profile = window.sistemaVidaState.profile || {};
        if (!profile.identity || typeof profile.identity !== 'object') {
            profile.identity = { strengths: [], shadows: [] };
        }
        const normalizeList = (list, type) => {
            if (!Array.isArray(list)) return [];
            return list.map((item) => {
                const title = String(item?.title || item?.name || item || '').trim();
                if (!title) return null;
                return {
                    id: String(item?.id || `${type}-${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`),
                    title,
                    dimension: String(item?.dimension || ''),
                    description: String(item?.description || ''),
                    evidence: String(item?.evidence || ''),
                    excessRisk: String(item?.excessRisk || ''),
                    practice: String(item?.practice || item?.suggestedPractice || ''),
                    obstacle: String(item?.obstacle || ''),
                    ifThen: String(item?.ifThen || ''),
                    trigger: String(item?.trigger || ''),
                    impact: String(item?.impact || ''),
                    desiredResponse: String(item?.desiredResponse || ''),
                    linkedHabitIds: Array.isArray(item?.linkedHabitIds) ? item.linkedHabitIds.map(String) : [],
                    weeklyLogs: item?.weeklyLogs && typeof item.weeklyLogs === 'object' && !Array.isArray(item.weeklyLogs) ? item.weeklyLogs : {},
                    createdAt: String(item?.createdAt || this.getLocalDateKey()),
                    updatedAt: String(item?.updatedAt || '')
                };
            }).filter(Boolean);
        };
        profile.identity.strengths = normalizeList(profile.identity.strengths, 'strength');
        profile.identity.shadows = normalizeList(profile.identity.shadows, 'shadow');
        window.sistemaVidaState.profile = profile;
    },

getIdentityCatalog: function(type) {
        const strengths = [
            'Pensamento analítico', 'Aprendizado rápido', 'Coragem', 'Resiliência',
            'Resolução de problemas', 'Determinação', 'Visão de longo prazo', 'Escuta',
            'Empatia', 'Liderança', 'Objetividade', 'Autonomia', 'Curiosidade',
            'Disciplina', 'Clareza', 'Comunicação', 'Responsabilidade', 'Criatividade',
            'Organização', 'Foco'
        ];
        const shadows = [
            'Hipervigilância', 'Necessidade de controle', 'Autoimagem por desempenho',
            'Apego ansioso', 'Procrastinação existencial', 'Procrastinação',
            'Dopamina barata', 'Perfeccionismo', 'Autocrítica excessiva', 'Rigidez',
            'Teimosia', 'Persistência destrutiva', 'Dificuldade de vulnerabilidade',
            'Reatividade', 'Evitação de conflito', 'Ansiedade de controle',
            'Paralisia por análise', 'Sobrecarga', 'Dispersão'
        ];
        return type === 'strengths' ? strengths : shadows;
    },

getIdentityTypeLabel: function(type) {
        return type === 'strengths' ? 'Força' : 'Sombra';
    },

getIdentityItemById: function(type, id) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity?.[type] || [];
        return list.find(item => item.id === id) || null;
    },

getIdentityTitleById: function(type, id) {
        const item = this.getIdentityItemById(type, id);
        return item ? item.title : '';
    },

addIdentityItem: function(type, title) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity[type];
        if (!Array.isArray(list)) return;
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle) return;
        if (list.some(item => item.title.toLowerCase() === cleanTitle.toLowerCase())) {
            this.showToast('Esse item já está na sua identidade.', 'success');
            return;
        }
        const prefix = type === 'strengths' ? 'strength' : 'shadow';
        list.push({
            id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: cleanTitle,
            dimension: '',
            description: '',
            evidence: '',
            excessRisk: '',
            practice: '',
            obstacle: '',
            ifThen: '',
            trigger: '',
            impact: '',
            desiredResponse: '',
            linkedHabitIds: [],
            weeklyLogs: {},
            createdAt: this.getLocalDateKey(),
            updatedAt: this.getLocalDateKey()
        });
        this.evaluateIdentityAchievements();
        this.saveState(true);
        this.renderIdentityBase();
        this.showToast(type === 'strengths' ? 'Força adicionada.' : 'Sombra adicionada.', 'success');
    },

addCustomIdentityItem: function(type) {
        this.openIdentityItemModal(type, null);
    },

openIdentityItemModal: function(type, id) {
        const modal = document.getElementById('identity-item-modal');
        if (!modal) return;
        const isStrength = type === 'strengths';
        const isEdit = !!id;
        document.getElementById('identity-modal-type').value = type;
        document.getElementById('identity-modal-id').value = id || '';
        document.getElementById('identity-modal-title').textContent = isEdit
            ? (isStrength ? 'Editar Força' : 'Editar Sombra')
            : (isStrength ? 'Nova Força' : 'Nova Sombra');

        const sFields = document.getElementById('identity-modal-strengths-fields');
        const shFields = document.getElementById('identity-modal-shadows-fields');
        if (sFields)  sFields.classList.toggle('hidden', !isStrength);
        if (shFields) shFields.classList.toggle('hidden', isStrength);

        // Pre-fill if editing
        const item = id ? this.getIdentityItemById(type, id) : null;
        const val = (key) => (item && item[key]) ? item[key] : '';
        document.getElementById('identity-modal-name').value      = val('title');
        document.getElementById('identity-modal-dimension').value = val('dimension');
        if (isStrength) {
            document.getElementById('identity-modal-evidence').value   = val('evidence');
            document.getElementById('identity-modal-excessRisk').value = val('excessRisk');
            document.getElementById('identity-modal-practice').value   = val('practice') || val('suggestedPractice');
        } else {
            document.getElementById('identity-modal-trigger').value         = val('trigger');
            document.getElementById('identity-modal-impact').value          = val('impact');
            document.getElementById('identity-modal-desiredResponse').value = val('desiredResponse');
            document.getElementById('identity-modal-obstacle').value        = val('obstacle');
            document.getElementById('identity-modal-ifThen').value          = val('ifThen');
        }
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('identity-modal-name')?.focus(), 80);
    },

closeIdentityItemModal: function() {
        const modal = document.getElementById('identity-item-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    },

saveIdentityItemModal: function() {
        this.ensureIdentityState();
        const type = document.getElementById('identity-modal-type').value;
        const id   = document.getElementById('identity-modal-id').value;
        const name = (document.getElementById('identity-modal-name').value || '').trim();
        if (!name) return;
        const isStrength = type === 'strengths';

        const g = (elId) => (document.getElementById(elId)?.value || '').trim();
        const extra = isStrength
            ? { evidence: g('identity-modal-evidence'), excessRisk: g('identity-modal-excessRisk'), practice: g('identity-modal-practice') }
            : { trigger: g('identity-modal-trigger'), impact: g('identity-modal-impact'), desiredResponse: g('identity-modal-desiredResponse'), obstacle: g('identity-modal-obstacle'), ifThen: g('identity-modal-ifThen') };

        if (id) {
            // Edit existing
            const item = this.getIdentityItemById(type, id);
            if (!item) return;
            item.title     = name;
            item.dimension = g('identity-modal-dimension');
            Object.assign(item, extra);
            item.updatedAt = this.getLocalDateKey();
            this.showToast(`${isStrength ? 'Força' : 'Sombra'} atualizada.`, 'success');
        } else {
            // Create new
            const dimension = g('identity-modal-dimension');
            const list = window.sistemaVidaState.profile.identity[type];
            const newItem = { id: this.generateId(), title: name, dimension, ...extra, createdAt: this.getLocalDateKey() };
            list.push(newItem);
            this.showToast(`${isStrength ? 'Força' : 'Sombra'} adicionada.`, 'success');
        }
        this.saveState(true);
        this.renderIdentityBase();
        this.closeIdentityItemModal();
    },

removeIdentityItem: function(type, id) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity[type];
        if (!Array.isArray(list)) return;
        window.sistemaVidaState.profile.identity[type] = list.filter(item => item.id !== id);
        this.saveState(true);
        this.renderIdentityBase();
        this.showToast(type === 'strengths' ? 'Força removida.' : 'Sombra removida.', 'success');
    },

editIdentityItem: function(type, id) {
        this.openIdentityItemModal(type, id);
    },

getIdentityLinkedHabits: function(type, id) {
        if (!id || !['strengths', 'shadows'].includes(type)) return [];
        const isStrength = type === 'strengths';
        return (window.sistemaVidaState.habits || []).filter(habit => {
            if (!habit) return false;
            const linkedId = isStrength ? this._getHabitSourceStrengthId(habit) : this._getHabitSourceShadowId(habit);
            return linkedId === id;
        });
    },

openHabitToday: async function(habitId) {
        if (!habitId) return;
        await this.switchView('hoje', { preserveScroll: true });
        if (this.switchHojeScreen) this.switchHojeScreen('habitos');
        setTimeout(() => {
            const habitsSection = document.getElementById('hoje-habits-section');
            if (habitsSection) habitsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const card = document.getElementById(`habit-card-${habitId}`);
            if (!card) {
                this.showToast('Hábito ligado, mas ele não está visível no Hoje agora.', 'info');
                return;
            }
            card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            card.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
            setTimeout(() => card.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background'), 2200);
        }, 350);
    },

createHabitFromIdentity: function(type, id) {
        this.ensureIdentityState();
        const item = this.getIdentityItemById(type, id);
        if (!item) return;
        const isStrength = type === 'strengths';
        const practice = String(item.practice || item.suggestedPractice || '').trim();
        const response = String(item.desiredResponse || '').trim();
        const ifThen = String(item.ifThen || '').trim();
        const trigger = String(item.trigger || '').trim();
        const routine = isStrength
            ? (practice || `Praticar ${item.title}`)
            : (response || ifThen || `Praticar resposta alternativa a ${item.title}`);

        this.openCreateModal('habits');
        setTimeout(() => {
            const setVal = (elId, value) => {
                const el = document.getElementById(elId);
                if (el) el.value = value || '';
            };
            setVal('crud-title', isStrength ? routine : `Antídoto para ${item.title}`);
            setVal('crud-trigger', isStrength ? 'Quando iniciar minha rotina planejada' : (trigger || `Quando perceber ${item.title}`));
            setVal('habit-routine', routine);
            setVal('habit-reward', isStrength ? `Reforçar ${item.title}` : `Reduzir ${item.title}`);

            const dimension = document.getElementById('crud-dimension');
            if (dimension && item.dimension && Array.from(dimension.options).some(opt => opt.value === item.dimension)) {
                dimension.value = item.dimension;
            }

            const strengthSel = document.getElementById('habit-strength-source');
            const shadowSel = document.getElementById('habit-shadow-source');
            const shadowModeEl = document.getElementById('habit-shadow-mode');
            if (isStrength && strengthSel && Array.from(strengthSel.options || []).some(opt => opt.value === item.id)) {
                strengthSel.value = item.id;
            } else if (!isStrength && shadowSel && Array.from(shadowSel.options || []).some(opt => opt.value === item.id)) {
                shadowSel.value = item.id;
                this.onHabitShadowSourceChange(item.id);
                if (shadowModeEl) shadowModeEl.value = 'replace';
            }
            this.showToast(isStrength ? 'Hábito preparado a partir da força.' : 'Hábito antídoto preparado a partir da sombra.', 'success');
        }, 80);
    },

renderIdentityBase: function() {
        this.ensureIdentityState();
        this.renderSidebarValues();
        const identity = window.sistemaVidaState.profile.identity;
        const jsArg = (value) => this.escapeHtml(JSON.stringify(String(value)));
        const renderSelected = (type, emptyText) => {
            const container = document.getElementById(type === 'strengths' ? 'identity-strengths-list' : 'identity-shadows-list');
            if (!container) return;
            const items = identity[type] || [];
            if (!items.length) {
                container.innerHTML = `<p class="text-xs text-outline italic">${emptyText}</p>`;
                return;
            }
            container.innerHTML = items.map(item => {
                const linkedHabits = this.getIdentityLinkedHabits(type, item.id);
                const linkedPreview = linkedHabits.slice(0, 2).map(habit => `
                    <button type="button" onclick="event.stopPropagation(); window.app.openHabitToday(${jsArg(habit.id)})" class="inline-flex items-center gap-1 rounded-full bg-primary/5 border border-primary/10 px-2 py-1 text-[10px] text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors" title="Ver hábito no Hoje">
                        <span class="material-symbols-outlined notranslate text-[12px] text-primary">repeat</span>
                        ${this.escapeHtml(habit.title)}
                    </button>
                `).join('');
                const moreCount = Math.max(0, linkedHabits.length - 2);
                const actionLabel = type === 'strengths' ? 'Criar hábito' : 'Criar antídoto';
                const actionIcon = type === 'strengths' ? 'add_task' : 'change_circle';
                return `
                <div class="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest/70 p-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-on-surface">${this.escapeHtml(item.title)}</p>
                            ${item.dimension ? `<p class="mt-0.5 text-[10px] uppercase tracking-widest text-primary">${this.escapeHtml(item.dimension)}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="event.stopPropagation(); window.app.editIdentityItem(${jsArg(type)}, ${jsArg(item.id)})" class="material-symbols-outlined notranslate text-outline text-[16px] hover:text-primary" title="Editar">edit</button>
                            <button type="button" onclick="event.stopPropagation(); window.app.removeIdentityItem(${jsArg(type)}, ${jsArg(item.id)})" class="material-symbols-outlined notranslate text-outline text-[16px] hover:text-error" title="Remover">close</button>
                        </div>
                    </div>
                    <div class="mt-2 space-y-1 text-[11px] text-outline leading-relaxed">
                        ${type === 'strengths' && item.evidence ? `<p><span class="font-bold text-on-surface">Evidência:</span> ${this.escapeHtml(item.evidence)}</p>` : ''}
                        ${type === 'strengths' && item.excessRisk ? `<p><span class="font-bold text-on-surface">Excesso:</span> ${this.escapeHtml(item.excessRisk)}</p>` : ''}
                        ${type === 'strengths' && (item.practice || item.suggestedPractice) ? `<p><span class="font-bold text-on-surface">Prática:</span> ${this.escapeHtml(item.practice || item.suggestedPractice)}</p>` : ''}
                        ${type === 'shadows' && item.trigger ? `<p><span class="font-bold text-on-surface">Gatilho:</span> ${this.escapeHtml(item.trigger)}</p>` : ''}
                        ${type === 'shadows' && item.impact ? `<p><span class="font-bold text-on-surface">Impacto:</span> ${this.escapeHtml(item.impact)}</p>` : ''}
                        ${type === 'shadows' && item.desiredResponse ? `<p><span class="font-bold text-on-surface">Resposta:</span> ${this.escapeHtml(item.desiredResponse)}</p>` : ''}
                        ${type === 'shadows' && item.obstacle ? `<p><span class="font-bold text-on-surface">Obstáculo:</span> ${this.escapeHtml(item.obstacle)}</p>` : ''}
                        ${type === 'shadows' && item.ifThen ? `<p><span class="font-bold text-on-surface">Se-então:</span> ${this.escapeHtml(item.ifThen)}</p>` : ''}
                    </div>
                    <div class="mt-3 pt-3 border-t border-outline-variant/10">
                        <div class="flex flex-wrap items-center gap-2">
                            ${linkedHabits.length ? linkedPreview : `<span class="text-[10px] text-outline italic">Nenhum hábito ligado ainda.</span>`}
                            ${moreCount ? `<span class="text-[10px] text-outline">+${moreCount}</span>` : ''}
                        </div>
                        <button type="button" onclick="event.stopPropagation(); window.app.createHabitFromIdentity(${jsArg(type)}, ${jsArg(item.id)})" class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors">
                            <span class="material-symbols-outlined notranslate text-[14px]">${actionIcon}</span>
                            ${actionLabel}
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        };
        const renderOptions = (type) => {
            const container = document.getElementById(type === 'strengths' ? 'identity-strengths-options' : 'identity-shadows-options');
            if (!container) return;
            const chosen = new Set((identity[type] || []).map(item => item.title.toLowerCase()));
            container.innerHTML = this.getIdentityCatalog(type).map(title => {
                const active = chosen.has(title.toLowerCase());
                return `<button type="button" onclick="window.app.addIdentityItem(${jsArg(type)}, ${jsArg(title)})"
                    class="px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${active ? 'border-primary/30 bg-primary/10 text-primary opacity-60' : 'border-outline-variant/30 text-outline hover:border-primary/40 hover:text-primary hover:bg-primary/5'}">
                    ${this.escapeHtml(title)}
                </button>`;
            }).join('');
        };
        renderSelected('strengths', 'Escolha uma força abaixo para começar — elas amplificam seu XP nos hábitos.');
        renderSelected('shadows', 'Escolha um padrão abaixo — trabalhar sombras vale mais XP nos hábitos.');
        renderOptions('strengths');
        renderOptions('shadows');
    },

toggleIdentityOptions: function(type) {
        const optionsId = type === 'strengths' ? 'identity-strengths-options' : 'identity-shadows-options';
        const iconId    = type === 'strengths' ? 'strengths-toggle-icon'       : 'shadows-toggle-icon';
        const el   = document.getElementById(optionsId);
        const icon = document.getElementById(iconId);
        if (!el) return;
        const nowHidden = el.classList.toggle('hidden');
        if (icon) icon.style.transform = nowHidden ? '' : 'rotate(180deg)';
    },

getIdentityPracticeStats: function(weekKey = this._getWeekKey()) {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const habits = window.sistemaVidaState.habits || [];
        const weekDates = this.getWeekDateKeys(weekKey);
        const priorWeekDates = this.getWeekDateKeys(this.getRelativeWeekKey(weekKey, -1));
        const linkedHabits = habits.filter(h => this._getHabitSourceStrengthId(h) || this._getHabitSourceShadowId(h));
        const doneThisWeek = linkedHabits.filter(h => weekDates.some(date => this.isHabitDoneOnDate(h, date)));
        const doneLastWeek = linkedHabits.filter(h => priorWeekDates.some(date => this.isHabitDoneOnDate(h, date)));
        const practicedStrengthIds = new Set(doneThisWeek.map(h => this._getHabitSourceStrengthId(h)).filter(Boolean));
        const workedShadowIds = new Set(doneThisWeek.map(h => this._getHabitSourceShadowId(h)).filter(Boolean));
        const strengthIdsWithHabits = new Set(linkedHabits.map(h => this._getHabitSourceStrengthId(h)).filter(Boolean));
        const shadowIdsWithHabits = new Set(linkedHabits.map(h => this._getHabitSourceShadowId(h)).filter(Boolean));
        return {
            strengths: identity.strengths || [],
            shadows: identity.shadows || [],
            linkedHabits,
            doneThisWeek,
            doneLastWeek,
            practicedStrengthIds,
            workedShadowIds,
            strengthsWithoutPractice: (identity.strengths || []).filter(item => !practicedStrengthIds.has(item.id)),
            shadowsWithoutHabit: (identity.shadows || []).filter(item => !shadowIdsWithHabits.has(item.id)),
            strengthsWithoutHabit: (identity.strengths || []).filter(item => !strengthIdsWithHabits.has(item.id))
        };
    },

getIdentityTrendSummary: function(weekKey = this._getWeekKey(), weeks = 4) {
        const habits = window.sistemaVidaState.habits || [];
        const summary = [];
        for (let i = weeks - 1; i >= 0; i--) {
            const wk = this.getRelativeWeekKey(weekKey, -i);
            const dates = this.getWeekDateKeys(wk);
            const strengthIds = new Set();
            const shadowIds = new Set();
            let linkedCompletions = 0;
            habits.forEach(habit => {
                const sId = this._getHabitSourceStrengthId(habit);
                const shId = this._getHabitSourceShadowId(habit);
                if (!sId && !shId) return;
                const count = dates.reduce((acc, date) => acc + (this.isHabitDoneOnDate(habit, date) ? 1 : 0), 0);
                if (!count) return;
                linkedCompletions += count;
                if (sId) strengthIds.add(sId);
                if (shId) shadowIds.add(shId);
            });
            summary.push({ weekKey: wk, strengthCount: strengthIds.size, shadowCount: shadowIds.size, linkedCompletions });
        }
        return summary;
    },

renderPersonalEvolutionPanel: function() {
        const container = document.getElementById('personal-evolution-panel');
        if (!container) return;
        const stats = this.getIdentityPracticeStats();
        const card = ({ icon, title, value, copy, tone = 'primary' }) => `
            <div class="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(title)}</p>
                        <p class="mt-2 font-headline text-3xl italic text-${tone}">${this.escapeHtml(value)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-${tone}">${this.escapeHtml(icon)}</span>
                </div>
                <p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${copy}</p>
            </div>`;
        const practicedNames = stats.strengths
            .filter(item => stats.practicedStrengthIds.has(item.id))
            .map(item => item.title);
        const shadowNames = stats.shadows
            .filter(item => stats.workedShadowIds.has(item.id))
            .map(item => item.title);
        const missingShadowNames = stats.shadowsWithoutHabit.map(item => item.title).slice(0, 3);
        const trend = this.getIdentityTrendSummary();
        const trendCopy = trend.map(row => `${row.linkedCompletions}`).join(' · ');
        container.innerHTML = [
            card({
                icon: 'workspace_premium',
                title: 'Forças praticadas',
                value: String(stats.practicedStrengthIds.size),
                copy: practicedNames.length ? `Você praticou ${this.escapeHtml(practicedNames.join(', '))} nesta semana.` : 'Nenhuma força mapeada apareceu em hábitos concluídos nesta semana.'
            }),
            card({
                icon: 'change_circle',
                title: 'Sombras trabalhadas',
                value: String(stats.workedShadowIds.size),
                copy: shadowNames.length ? `Você trabalhou ${this.escapeHtml(shadowNames.join(', '))} com hábitos antídoto.` : 'Nenhuma sombra foi trabalhada por hábito vinculado nesta semana.',
                tone: 'secondary'
            }),
            card({
                icon: 'link_off',
                title: 'Sem antídoto',
                value: String(stats.shadowsWithoutHabit.length),
                copy: missingShadowNames.length ? `Sombras sem hábito: ${this.escapeHtml(missingShadowNames.join(', '))}.` : 'Todas as sombras mapeadas já têm algum hábito conectado.',
                tone: stats.shadowsWithoutHabit.length ? 'error' : 'primary'
            }),
            card({
                icon: 'timeline',
                title: 'Últimas 4 semanas',
                value: String(trend.reduce((sum, row) => sum + row.linkedCompletions, 0)),
                copy: `Conclusões ligadas à identidade por semana: ${this.escapeHtml(trendCopy || '0 · 0 · 0 · 0')}.`,
                tone: 'primary'
            })
        ].join('');
    },

populateReviewIdentityFields: function() {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const isEmpty = !(identity.strengths || []).length && !(identity.shadows || []).length;

        const cta = document.getElementById('review-identity-cta');
        const selects = document.getElementById('review-identity-selects');
        if (cta) cta.classList.toggle('hidden', !isEmpty);
        if (selects) selects.classList.toggle('hidden', isEmpty);

        if (!isEmpty) {
            const fillSelect = (id, items) => {
                const select = document.getElementById(id);
                if (!select) return;
                select.innerHTML = '<option value="">— Opcional —</option>' + (items || []).map(item =>
                    `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.title)}</option>`
                ).join('');
            };
            fillSelect('rev-strength', identity.strengths || []);
            fillSelect('rev-shadow', identity.shadows || []);
        }

        const suggestion = document.getElementById('review-identity-suggestion');
        if (!suggestion) return;
        if (isEmpty) {
            suggestion.textContent = '';
            return;
        }
        const weekKey = this._getWeekKey();
        const weekDates = this.getWeekDateKeys(weekKey);
        const practiced = (window.sistemaVidaState.habits || [])
            .filter(h => h.sourceType && h.sourceId && weekDates.some(date => this.isHabitDoneOnDate(h, date)))
            .map(h => this.getHabitIdentityItem(h)?.title)
            .filter(Boolean);
        suggestion.textContent = practiced.length
            ? `Sugestão: esta semana você praticou ${practiced.slice(0, 3).join(', ')}.`
            : 'Opcional: conecte a semana às suas forças e sombras.';
    },

showIdentityReviewContext: function(type, id) {
        const el = document.getElementById('review-identity-context');
        if (!el) return;
        if (!id) { el.classList.add('hidden'); el.innerHTML = ''; return; }
        const item = this.getIdentityItemById(type, id);
        if (!item) { el.classList.add('hidden'); el.innerHTML = ''; return; }
        const esc = (s) => this.escapeHtml(String(s || ''));
        const row = (label, val) => val ? `<p class="text-[11px] text-on-surface-variant leading-snug"><span class="font-bold text-on-surface">${label}:</span> ${esc(val)}</p>` : '';
        let html = '';
        if (type === 'strengths') {
            html = [
                row('Evidência', item.evidence),
                row('Risco de excesso', item.excessRisk),
                row('Prática', item.practice || item.suggestedPractice)
            ].filter(Boolean).join('');
        } else {
            html = [
                row('Gatilho', item.trigger),
                row('Impacto', item.impact),
                row('Resposta desejada', item.desiredResponse),
                row('Se-então', item.ifThen)
            ].filter(Boolean).join('');
        }
        if (!html) { el.classList.add('hidden'); el.innerHTML = ''; return; }
        el.innerHTML = `<div class="space-y-1">${html}</div>`;
        el.classList.remove('hidden');
    },

updateIdentityWeeklyLogs: function(weekKey, review) {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || {};
        const stamp = new Date().toISOString();
        const writeLog = (type, id, payload) => {
            if (!id) return;
            const item = (identity[type] || []).find(i => i.id === id);
            if (!item) return;
            if (!item.weeklyLogs || typeof item.weeklyLogs !== 'object') item.weeklyLogs = {};
            item.weeklyLogs[weekKey] = { ...(item.weeklyLogs[weekKey] || {}), ...payload, updatedAt: stamp };
            item.updatedAt = this.getLocalDateKey();
        };
        writeLog('strengths', review.strengthId, {
            used: true,
            note: review.responsePracticed || review.q3 || ''
        });
        writeLog('shadows', review.shadowId, {
            appeared: true,
            responsePracticed: review.responsePracticed || '',
            habitAdjustment: review.habitAdjustment || ''
        });
    },

manualGuideChapters: [
        {
            id: 'visao-geral',
            icon: 'menu_book',
            title: 'Visão Geral',
            subtitle: 'A arquitetura do Life OS em uma página',
            what: 'O Life OS funciona em quatro camadas que se alimentam: <strong>Propósito</strong> (Quem eu sou → Como estou → O que quero deixar → O que posso viver → O que me move → Quem quero me tornar) → <strong>Planos</strong> (Meta → Projeto → Entrega → Ação) → <strong>Execução</strong> (Hoje + Foco) → <strong>Reflexão</strong> (Painel + Revisão Semanal). Identidade e hábitos atravessam todas elas.',
            why: 'Sistemas de mudança duradoura precisam de coerência vertical: ações diárias devem servir objetivos de médio prazo, que servem propósito de longo prazo. Sem essa cadeia, o esforço diário não acumula em direção a algo significativo.',
            refs: ['Covey — 7 Habits (begin with the end in mind)', 'Locke & Latham — Goal-Setting Theory'],
            how: [
                'Comece pelo Propósito: defina valores, forças/sombras, diagnóstico de bem-estar, Legado, Odyssey, Ikigai e Visão antes de criar Metas.',
                'Quebre cada Meta em Projetos (até 90 dias) → Entregas curtas (até 1 mês) → Ações pequenas, feitas em poucos dias ou em uma sessão.',
                'Use o Hoje para executar Ações e o Foco para sessões de atenção profunda.',
                'Revise no Painel e na Revisão Semanal para fechar o ciclo.'
            ],
            cta: null
        },
        {
            id: 'identidade',
            icon: 'person_pin',
            title: 'Identidade & Valores',
            subtitle: 'Quem você está se tornando',
            what: 'A aba Propósito guarda <strong>Valores</strong> (princípios inegociáveis), <strong>Forças</strong> (o que quer expressar mais) e <strong>Sombras</strong> (padrões a transformar). A prática sugerida de uma força pode virar hábito. O se-então de uma sombra é uma resposta preparada para o gatilho: "se X acontecer, então farei Y".',
            why: 'Mudanças sustentáveis acontecem em nível de identidade, não de comportamento isolado. Trabalhar sombras (psicologia junguiana) e cultivar forças (VIA Character Strengths) cria uma narrativa interna coerente: cada ação vira "voto" para a pessoa que você está se tornando.',
            refs: ['James Clear — Atomic Habits (identity-based habits)', 'Peterson & Seligman — VIA Character Strengths', 'Carl Jung — Shadow integration'],
            how: [
                'Em Propósito, escolha 3-5 forças do catálogo e 1-2 sombras a observar.',
                'No card de uma força ou sombra, use "Criar hábito" para transformar prática, resposta desejada ou se-então em rotina concreta.',
                'Ao criar um hábito manualmente, conecte-o a uma força (modo "construir") ou sombra (modo "substituir").',
                'Na gamificação revisada, hábitos ganham 2 XP base, +1 XP se ligados a força, +2 XP se ligados a sombra, e 4 XP base se forem Hábito-Chave.',
                'Na Revisão Semanal, marque qual força usou e qual sombra apareceu. O painel também usa hábitos ligados para mostrar forças praticadas e sombras trabalhadas.'
            ],
            cta: { label: 'Abrir Propósito', view: 'proposito', sectionId: 'proposito-identity-section' }
        },
        {
            id: 'bem-estar',
            icon: 'monitoring',
            title: 'Bem-estar: Roda da Vida, PERMA e SWLS',
            subtitle: 'Como estou',
            what: 'As três ferramentas olham sua vida por ângulos diferentes. <strong>Roda da Vida</strong>: um retrato simples das áreas da vida; ajuda a perceber excessos e esquecimentos. <strong>PERMA</strong>: um mapa de bem-estar em cinco frentes; ajuda a entender como sua vida está nutrindo emoções, engajamento, relações, sentido e realização. <strong>SWLS</strong>: cinco perguntas clássicas sobre satisfação com a vida; gera uma nota global de 5 a 35.',
            why: 'SWLS é uma escala bem estabelecida para acompanhar satisfação com a vida. PERMA é um modelo muito usado para refletir sobre florescimento e qualidade de vida. A Roda da Vida é menos "teste" e mais ferramenta de conversa consigo mesmo: ela ajuda a transformar percepção difusa em decisão prática.',
            refs: ['Seligman — Flourish (PERMA)', 'Diener et al. — Satisfaction with Life Scale (SWLS)', 'Paul J. Meyer — Wheel of Life'],
            how: [
                'Use a Roda da Vida para decidir onde investir energia: áreas mais baixas podem virar meta, projeto ou hábito.',
                'Use o SWLS uma vez por mês como um termômetro rápido da sua satisfação geral.',
                'Use o PERMA com mais calma, em ritmo trimestral, para entender melhor a qualidade da sua experiência.',
                'Cruze os resultados: se uma área aparece mal com frequência, ela merece aparecer também nos seus planos.'
            ],
            cta: { label: 'Reavaliar bem-estar', view: 'proposito', sectionId: 'proposito-roda-section' }
        },
        {
            id: 'legado',
            icon: 'history_edu',
            title: 'Legado',
            subtitle: 'O que quero deixar',
            what: 'O <strong>Legado</strong> é a âncora de longuíssimo prazo: o impacto que você gostaria de deixar na família, no trabalho e no mundo. Pergunta guia: <strong>se alguém importante descrevesse seu impacto daqui a muitos anos, o que você gostaria que essa pessoa dissesse?</strong>',
            why: 'Começar pelo fim reduz ruído de vaidade e modismo. A lógica aparece em Covey ("begin with the end in mind") e em exercícios de sentido usados em psicologia existencial: imaginar o impacto final ajuda a filtrar decisões do presente.',
            refs: ['Stephen Covey — 7 Habits (begin with the end in mind)', 'Viktor Frankl — meaning and responsibility', 'Life review / meaning-making research'],
            how: [
                'Escreva em linguagem humana, não como slogan. Pense em pessoas reais: família, colegas, comunidade.',
                'Use o Legado antes de Odyssey e Ikigai: ele protege sua exploração de virar apenas fantasia ou pressão externa.',
                'Ao criar uma Meta de vida, pergunte: "isso aumenta a chance desse legado existir?"',
                'Revisite a cada 6-12 meses ou em transições grandes de vida.'
            ],
            cta: { label: 'Editar Legado', view: 'proposito', sectionId: 'proposito-legado-section' }
        },
        {
            id: 'odyssey',
            icon: 'explore',
            title: 'Odyssey Plans',
            subtitle: 'O que posso viver',
            what: '<strong>Odyssey Plans</strong> são três vidas distintas e plausíveis para os próximos 5 anos. Pergunta guia: <strong>quais são três caminhos reais que eu poderia viver sem fingir que existe uma única resposta certa?</strong>',
            why: 'Designing Your Life recomenda divergir antes de convergir. Ao desenhar mais de um futuro possível, você reduz apego a uma narrativa única e descobre padrões: temas que aparecem em todos os cenários costumam indicar necessidades profundas.',
            refs: ['Bill Burnett & Dave Evans — Designing Your Life', 'Stanford d.school — design thinking', 'Possible selves research'],
            how: [
                'Crie três cenários com nomes, imagens e rotina concreta: como seria uma semana real nesse caminho?',
                'Faça um cenário conservador, um ambicioso e um mais radical, todos plausíveis.',
                'Não escolha na primeira passada. Primeiro observe o que se repete entre os cenários.',
                'Depois use Ikigai e Visão para filtrar e convergir.'
            ],
            cta: { label: 'Editar Odyssey', view: 'proposito', sectionId: 'odyssey-section' }
        },
        {
            id: 'ikigai',
            icon: 'star',
            title: 'Ikigai',
            subtitle: 'O que me move',
            what: 'No Life OS, o <strong>Ikigai</strong> aparece na versão mais popular dos quatro blocos: o que você ama, o que faz bem, o que o mundo precisa e o que pode sustentar sua vida. Pergunta guia: <strong>onde prazer, talento, necessidade e sustento começam a conversar entre si?</strong>',
            why: 'Essa leitura do Ikigai ajuda a não olhar só para paixão, só para dinheiro ou só para dever. Ela funciona bem como síntese vocacional prática: primeiro você amplia a conversa, depois escreve uma direção mais clara.',
            refs: ['Mieko Kamiya — Ikigai-ni-tsuite', 'Ken Mogi — The Little Book of Ikigai', 'Marc Winn — four-circle Ikigai adaptation', 'Self-Determination Theory — Deci & Ryan'],
            how: [
                'Preencha os quatro blocos base primeiro: Amo, Sou bom, Mundo precisa e Sustento.',
                'Use as interseções como rascunho: Paixão = Amo + Sou bom; Profissão = Sou bom + Sustento; Vocação = Mundo precisa + Sustento; Missão = Amo + Mundo precisa.',
                'Só depois escreva a síntese final do Ikigai em uma frase curta.',
                'Transforme a síntese em Metas e hábitos: se o Ikigai não muda agenda, ele vira só uma frase bonita.'
            ],
            cta: { label: 'Editar Ikigai', view: 'proposito', sectionId: 'proposito-ikigai-section' }
        },
        {
            id: 'visao',
            icon: 'visibility',
            title: 'Visão de Vida',
            subtitle: 'Quem quero me tornar',
            what: 'A <strong>Visão de Vida</strong> é a convergência: a vida concreta que você escolhe construir depois de Legado, Odyssey e Ikigai. Pergunta guia: <strong>dada toda essa exploração, qual é a vida real que escolho praticar nos próximos anos?</strong>',
            why: 'Uma visão vívida aproxima o futuro do presente. Pesquisas sobre continuidade do self futuro mostram que visualizar quem você será aumenta decisões consistentes em saúde, finanças e planejamento.',
            refs: ['Hal Hershfield — Future Self Continuity', 'Locke & Latham — Goal-Setting Theory', 'Mental simulation research'],
            how: [
                'Escreva a visão em áreas concretas: saúde, carreira/finanças, intelecto/espiritualidade e uma frase guia.',
                'Use a Visão para escolher Metas de vida e Projetos trimestrais.',
                'Revise a cada 6-12 meses; ela é uma bússola viva, não contrato rígido.',
                'Se a semana atual não conversa com a Visão, ajuste as metas ou aceite conscientemente a exceção.'
            ],
            cta: { label: 'Editar Visão', view: 'proposito', sectionId: 'proposito-visao-section' }
        },
        {
            id: 'planos',
            icon: 'account_tree',
            title: 'Planos: Hierarquia Meta → Projeto → Entrega → Ação',
            subtitle: 'Transformar direção em passos concretos',
            what: 'A hierarquia transforma ambição em prática: <strong>Meta</strong> (1-5 anos) → <strong>Projeto</strong> (trimestral, com indicadores mensuráveis) → <strong>Entrega</strong> (curta, até 1 mês) → <strong>Ação</strong> (pequena, para caber em poucos dias ou em uma sessão). O <strong>Planejamento Semanal</strong> escolhe quais ações entram na semana com base no tempo e na energia disponíveis.',
            why: 'A camada de Projeto se inspira na lógica de objetivos com indicadores: separar objetivo qualitativo de medidas concretas evita metas vagas. Decomposição em Ações respeita a teoria da auto-eficácia (Bandura): vitórias pequenas alimentam crença de competência. Weekly planning aplica o "12 Week Year" — comprimir o foco em ciclos curtos aumenta execução.',
            refs: ['John Doerr — Measure What Matters', 'Brian Moran — The 12 Week Year', 'Albert Bandura — Self-Efficacy Theory'],
            how: [
                'Crie 1-3 Metas por dimensão, não mais. Foco vence quantidade.',
                'Para cada Projeto, defina 2-4 indicadores numéricos (não tarefas, mas resultados mensuráveis).',
                'Quebre Entregas em Ações executáveis em até 7 dias, para que elas possam ser distribuídas ao longo da semana sem pesar demais.',
                'No Planejamento Semanal, selecione Ações com base na energia prevista — não encha o calendário.',
                'Pais (Meta/Projeto/Entrega) só ficam "concluídos" quando você decide; o sistema não fecha automaticamente.'
            ],
            cta: { label: 'Abrir Planos', view: 'planos' }
        },
        {
            id: 'woop',
            icon: 'psychology_alt',
            title: 'WOOP e Se-então',
            subtitle: 'Antecipar obstáculos antes da execução',
            what: 'Entregas, Ações e Sombras podem guardar dois campos opcionais: <strong>obstáculo previsto</strong> e <strong>plano se-então</strong>. A ideia é transformar uma intenção vaga em uma resposta preparada para o atrito real. Nas sombras, o se-então responde à pergunta: "quando esse padrão aparecer, qual resposta eu quero treinar?".',
            why: 'WOOP (Wish, Outcome, Obstacle, Plan) combina contraste mental com implementation intentions. O ponto forte é nomear o obstáculo interno ou contextual antes que ele apareça, reduzindo improviso quando a energia já está baixa.',
            refs: ['Gabriele Oettingen — WOOP / Mental Contrasting', 'Peter Gollwitzer — Implementation Intentions'],
            how: [
                'Ao criar uma Entrega ou Ação, abra "Antecipar obstáculo" apenas quando houver risco claro.',
                'Escreva o obstáculo em linguagem concreta: "chegar cansado depois do trabalho", não "falta de disciplina".',
                'Use o formato se-então: "Se eu chegar cansado, então farei 5 minutos antes de decidir parar".',
                'Em Sombras, use o se-então para treinar uma resposta alternativa ao gatilho.',
                'Na Revisão Semanal, obstáculos e respostas aparecem como lembrete de ajuste.'
            ],
            cta: { label: 'Abrir Planos', view: 'planos' }
        },
        {
            id: 'notas',
            icon: 'note_stack',
            title: 'Notas e Memória Externa',
            subtitle: 'Contexto vinculado ao sistema',
            what: 'Notas ficam no Perfil e podem ser ligadas a Metas, Projetos, Entregas, Ações, Hábitos, Forças ou Sombras. Elas guardam contexto, links, aprendizados e referências sem transformar o app em uma área separada de documentos.',
            why: 'Guardar contexto fora da cabeça reduz desgaste mental. Quando uma nota fica ligada a um item do app, ela deixa de ser arquivo solto e passa a apoiar decisão, revisão e continuidade.',
            refs: ['David Allen — Getting Things Done', 'Tiago Forte — Building a Second Brain', 'Extended Mind / cognitive offloading'],
            how: [
                'Crie notas curtas com título, corpo, tags e URL quando houver uma referência importante.',
                'Ligue a nota ao item que ela ajuda: uma Ação, uma Meta, um Hábito ou uma Sombra.',
                'Use busca + filtros (Todas, Vinculadas, Avulsas) e o X da busca para limpar em um toque.',
                'A lista de notas é compacta e agrupada por mês; na linha ficam título, data e vínculo, e o texto completo aparece ao expandir.',
                'Prefira notas que ajudem uma decisão futura, não coleções infinitas de informação.'
            ],
            cta: { label: 'Abrir Perfil', view: 'perfil' }
        },
        {
            id: 'hoje',
            icon: 'today',
            title: 'Hoje: Bússola, Diário, Gratidão & Shutdown',
            subtitle: 'A camada de execução e reflexão diária',
            what: 'O <strong>Hoje</strong> reúne: a <strong>Bússola do Dia</strong> (frase + ação sugerida), a execução de <strong>Ações</strong> e <strong>hábitos</strong> do dia, o <strong>Diário</strong> (gratidão + o que funcionou) e o <strong>Shutdown Ritual</strong> (encerramento consciente do dia).',
            why: 'Ter uma intenção clara para o dia ajuda a começar com menos atrito. Registrar gratidão e pequenos acertos costuma ampliar percepção de progresso e presença. O Shutdown Ritual ajuda a fechar pendências mentais: quando você nomeia o que ficou e decide o próximo passo, descansar fica mais fácil.',
            refs: ['Gollwitzer — Implementation Intentions', 'Seligman — Three Good Things', 'Cal Newport — Deep Work (shutdown)', 'Zeigarnik Effect'],
            how: [
                'Abra o Hoje pela manhã; deixe a Bússola do Dia ancorar a primeira ação.',
                'À noite, registre uma gratidão real e o que funcionou no dia. Quanto mais específico, melhor.',
                'Execute o Shutdown ao terminar o trabalho: revise o que ficou, anote pendências para amanhã, declare fechamento.',
                'Não tente esvaziar todas as Ações da semana num dia só — sobrecarga mata consistência.'
            ],
            cta: { label: 'Ir para Hoje', view: 'hoje' }
        },
        {
            id: 'cadencia',
            icon: 'sync_alt',
            title: 'Cadência e Ritmo',
            subtitle: 'Frequências saudáveis sem travar o sistema',
            what: 'A <strong>Cadência</strong> mostra se ferramentas essenciais estão em dia, próximas do vencimento ou atrasadas. O <strong>Check-in diário</strong> coleta sono, qualidade do sono, energia, humor e estresse em poucos segundos para criar uma linha de base do seu estado interno.',
            why: 'Mudança pessoal melhora quando o registro do estado acontece perto do momento vivido. Esse é o princípio do EMA (Ecological Momentary Assessment), uma forma de observação mais próxima da vida real. Revisões semanais sustentam projetos; ferramentas como PERMA e SWLS pedem mais espaço entre uma aplicação e outra para evitar cansaço e ruído.',
            refs: ['Ecological Momentary Assessment (EMA)', 'Brian Moran — 12 Week Year', 'Diener — SWLS', 'Seligman — PERMA'],
            how: [
                'Faça o check-in diário na aba Hoje (topo da página): sono, qualidade do sono, energia, humor e estresse.',
                'Use os badges de cadência como sinal visual, nunca como punição.',
                'SWLS: mensal. Roda da Vida: a cada 4-6 semanas. PERMA: trimestral. Odyssey/Visão: semestral.',
                'Quando algo atrasar, retome com a menor ação possível em vez de compensar tudo de uma vez.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'foco',
            icon: 'timer',
            title: 'Foco: Blocos adaptativos e trabalho profundo',
            subtitle: 'Sessões curtas ou profundas conforme energia e esforço',
            what: 'O timer de <strong>Foco</strong> trabalha com blocos de <strong>15/3, 25/5, 45/10, 50/10 e 90/20</strong>, ligado a uma <strong>Ação</strong> ou a um <strong>Hábito</strong>. O app sugere o bloco com base no tempo estimado, no esforço e no check-in do dia. Ao finalizar, você pode registrar o que avançou, o que ficou em aberto e qual é o próximo passo.',
            why: 'Blocos curtos reduzem atrito para iniciar quando a energia está baixa; blocos médios ajudam execução sustentada; e o 90/20 continua reservado para trabalho profundo real. Essa gradação combina pomodoro clássico com ritmos ultradianos, em vez de tratar toda ação como se precisasse da mesma janela.',
            refs: ['Nathan Kleitman — BRAC (Basic Rest-Activity Cycle)', 'Cal Newport — Deep Work', 'Csikszentmihalyi — Flow'],
            how: [
                'Antes de iniciar, escolha uma ação ou um hábito no seletor. Um foco por vez ajuda o dia a não se espalhar.',
                'Durante a sessão, Play/Pause é o controle principal; Reset e Finalizar ficam como ações secundárias.',
                'Use os blocos sugeridos como padrão; troque manualmente só quando souber que aquele caso pede outra janela.',
                'O bloco sugerido não tenta engolir a tarefa inteira: ele cobre só a melhor sessão para agora, respeitando sua carga do dia e a energia do turno.',
                'Se a ação ainda estiver solta no plano, vale ajustar isso antes de transformar o foco em rotina.',
                'Reduza distrações e preserve só os avisos que ajudam seu bloco.',
                'Use a pausa correspondente ao bloco (3, 5, 10 ou 20 min) para movimento físico ou descanso real, não redes sociais.',
                'Ao concluir, registre evidências, dúvidas e próximo passo. Esse fechamento evita recomeços confusos depois.',
                'Em hábitos de tempo, os minutos entram no próprio hábito; nos demais, a sessão serve mais para registrar o avanço e clarear o próximo movimento.',
                'Faça poucas sessões profundas por dia. Qualidade costuma valer mais do que volume.'
            ],
            cta: { label: 'Iniciar Foco', view: 'foco' }
        },
        {
            id: 'protocolos-base',
            icon: 'rule_settings',
            title: 'Protocolos Base e Editáveis',
            subtitle: 'Roteiros práticos para executar sem travar',
            what: 'A aba <strong>Protocolos</strong> (em Planos) reúne protocolos base e personalizados. Hoje o app inclui base para <strong>início do dia</strong>, <strong>noite</strong>, <strong>limpeza</strong> (diário, semanal e mensal), estudo, treino e finanças. Todo protocolo é editável, pode ser convertido em hábito pré-preenchido e agora aceita <strong>tempo estimado por passo</strong>.',
            why: 'Protocolos diminuem carga de decisão e aumentam consistência em tarefas recorrentes. Começar por um modelo sólido acelera adesão; manter edição livre evita rigidez e permite personalização real.',
            refs: ['Implementation intentions', 'Checklists operacionais', 'Behavior design — reducing decision load'],
            how: [
                'Em Planos > Protocolos, abra um protocolo base e revise os passos.',
                'Se quiser guardar tempo estimado, use o formato "Passo | minutos" em cada linha.',
                'Quando um hábito usa protocolo, o tempo do hábito passa a vir do total do protocolo em vez de competir com um campo manual.',
                'Use "Criar hábito" para transformar o protocolo em rotina executável.',
                'Ajuste horário, frequência e meta antes de salvar.',
                'Hábito com protocolo ou checklist aparece como rotina na experiência de Para hoje.'
            ],
            cta: { label: 'Abrir Protocolos', view: 'planos' }
        },
        {
            id: 'habitos',
            icon: 'repeat',
            title: 'Hábitos: Gatilho, Rotina e Recompensa',
            subtitle: 'Pequenas repetições que constroem identidade',
            what: 'Cada hábito tem <strong>Gatilho</strong>, <strong>Rotina</strong> e <strong>Recompensa</strong>, e pode estar ligado a uma força, uma sombra ou ambas. Hábitos podem ser <strong>contínuos</strong> (sem data final, para rotinas de identidade) ou ter prazo. O <strong>Hábito-Chave</strong> marca a alavanca principal do momento: aquele que, se feito, ajuda os outros a andarem melhor.',
            why: 'Bons hábitos ficam mais fáceis quando você sabe onde começam, o que pedem de você e qual sensação deixam no fim. James Clear populariza bem a ideia de identidade: cada repetição reforça a pessoa que você está praticando ser. Planos do tipo "depois de X, vou fazer Y" também costumam aumentar a chance de continuidade.',
            refs: ['Charles Duhigg — The Power of Habit', 'James Clear — Atomic Habits', 'B.J. Fogg — Tiny Habits'],
            how: [
                'Ancore o hábito em uma rotina existente: "depois de escovar os dentes, eu...".',
                'Comece ridiculamente pequeno: 2 minutos, não 30. Consistência > intensidade.',
                'Conecte à identidade: "sou alguém que..." em vez de "vou fazer X".',
                'Quando o foco nasce de um hábito de tempo, os minutos entram no próprio hábito. Nos hábitos sem meta em minutos, a sessão ajuda a registrar o avanço e o próximo passo.',
                'Use hábito contínuo para rotinas sem data final; reserve o prazo para comportamentos que você quer consolidar e então revisar.',
                'Marque como Hábito-Chave o comportamento que mais amplia capacidade agora — o app sugerirá com base em streak e vínculo de identidade.',
                'Para forças, transforme a prática sugerida em rotina; para sombras, transforme o se-então em resposta alternativa antes do gatilho aparecer.',
                'Ao editar um hábito, revise com cuidado a meta ligada para não mudar esse vínculo sem querer.',
                'Use o checklist de passos para hábitos complexos; quebra em micropassos previne paralisia.'
            ],
            cta: { label: 'Criar hábito', view: 'planos' }
        },
        {
            id: 'habitos-ponte',
            icon: 'library_add',
            title: 'Biblioteca de Sugestões',
            subtitle: 'Modelos prontos para começar agora',
            what: 'A <strong>Biblioteca de Sugestões</strong> oferece modelos de hábitos agrupados por dimensão (Saúde, Carreira, Mente, Relacionamentos, Propósito). Cada modelo traz gatilho, rotina, recompensa, passos e modo de rastreamento já preenchidos — você ajusta antes de salvar.',
            why: 'A maior barreira para criar um bom hábito não é vontade, mas desenho: escolher o gatilho certo, a rotina mínima e a recompensa adequada. Modelos reduzem essa fricção sem tirar seu julgamento — você ainda personaliza tudo para o seu contexto antes de salvar.',
            refs: ['BJ Fogg — Tiny Habits', 'Nir Eyal — Hooked'],
            how: [
                'Na aba Hoje, toque em "Sugestões" para abrir a biblioteca de modelos.',
                'Escolha um modelo e toque em "Usar" — o formulário de criação abre pré-preenchido.',
                'Revise gatilho, rotina e recompensa antes de salvar: o modelo é ponto de partida, não receita.',
                'Prefira começar com 1–2 hábitos da dimensão mais carente, não com todos ao mesmo tempo.'
            ],
            cta: { label: 'Ver hoje', view: 'hoje' }
        },
        {
            id: 'maturacao-habitos',
            icon: 'verified',
            title: 'Maturação de Hábitos',
            subtitle: 'Do esforço consciente para o automático',
            what: 'Hábitos podem estar <strong>em formação</strong> ou <strong>automáticos</strong>. Quando um hábito sustenta consistência por semanas, ele gradua: continua sendo acompanhado, mas passa a render XP de manutenção em vez de XP cheio.',
            why: 'Hábitos costumam ficar mais leves com repetição em contexto estável. Recompensas ajudam no começo, mas a Teoria da Autodeterminação lembra que o ideal é, aos poucos, a motivação também vir de dentro. Essa graduação reconhece o progresso sem depender só do prêmio externo.',
            refs: ['Lally et al. — habit formation', 'James Clear — Atomic Habits', 'Deci & Ryan — Self-Determination Theory'],
            how: [
                'Um hábito gradua após 4 semanas com 80% ou mais de consistência.',
                'Hábitos automáticos aparecem com chip próprio e recebem XP reduzido de manutenção.',
                'Se a consistência cair por 2 semanas, o hábito volta para formação com aviso compassivo.',
                'No Painel, acompanhe quantos hábitos estão em formação, automáticos e próximos de graduar.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'reflexao',
            icon: 'insights',
            title: 'Painel & Revisão Semanal',
            subtitle: 'Fechamento de ciclo e aprendizado',
            what: 'O <strong>Painel</strong> mostra indicadores de Foco/Execução, ciclo de 12 semanas, Saúde da semana e um mapa visual da sua consistência. A <strong>Revisão Semanal</strong> faz 5 perguntas (planejei → executei → aprendi → ajustar → próxima intenção) e liga isso ao autoconhecimento aplicado (força usada, sombra observada).',
            why: 'Reflexão estruturada transforma experiência em aprendizado. Sem revisão, a gente tende a repetir o mesmo erro com outro nome. Revisões mais frequentes costumam sustentar melhor a execução do que revisões raras, e escrever o que aprendeu ajuda a organizar pensamento e memória.',
            refs: ['Brian Moran — 12 Week Year', 'Robert Bjork — Desirable Difficulties', 'Kolb — Experiential Learning Cycle'],
            how: [
                'Faça a Revisão Semanal todo domingo ou segunda — não pule, mesmo na semana ruim (especialmente nela).',
                'Seja específico: "aprendi que reuniões antes das 10h drenam minha energia para deep work" > "preciso focar mais".',
                'Use a aba "Autoconhecimento aplicado" para fechar o loop identidade → ação → reflexão.',
                'No Painel, observe tendências, não dias isolados — métricas voláteis enganam.',
                'A Saúde da semana resume execução, carga planejada e atrasos para mostrar se a semana está sustentável.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'padroes',
            icon: 'query_stats',
            title: 'Lendo seus Padrões',
            subtitle: 'Cruzar sinais sem confundir coincidência com causa',
            what: 'O Painel cruza check-ins diários com execução de ações e adesão a hábitos. A leitura mais completa só aparece quando há dados suficientes, para evitar conclusões apressadas.',
            why: 'Dados pessoais têm muito ruído. Um padrão útil nasce de repetição: sono, humor e estresse precisam de histórico antes de orientar decisão. Por isso o app espera um mínimo de base e lembra que coincidência não é, por si só, causa.',
            refs: ['Ecological Momentary Assessment (EMA)', 'Personal informatics', 'Behavioral self-tracking'],
            how: [
                'Faça check-in por pelo menos 14 dias para liberar os primeiros cruzamentos.',
                'Leia diferenças como hipóteses práticas, não como diagnóstico.',
                'Se sono baixo coincidir com pouca execução, ajuste a carga antes de culpar disciplina.',
                'Use a Revisão Semanal para decidir um experimento pequeno para a próxima semana.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'carga-recuperacao',
            icon: 'health_and_safety',
            title: 'Carga e Recuperação',
            subtitle: 'Melhorar sem ultrapassar o limite saudável',
            what: 'O alerta de carga observa energia, estresse, execução e volume planejado. Quando sinais ruins aparecem junto com carga alta, o app sugere reduzir o ritmo em vez de empurrar mais tarefas.',
            why: 'Produtividade sustentável depende de recuperação. Quando a carga se acumula por muito tempo, cresce o risco de fadiga, abandono e burnout. O sistema deve proteger consistência de longo prazo, não maximizar volume a qualquer custo.',
            refs: ['Allostatic load', 'Ultradian rhythms', 'Cal Newport — Deep Work'],
            how: [
                'Se o alerta aparecer, reduza ações, simplifique hábitos ou escolha uma semana de manutenção.',
                'Não trate o alerta como falha: ele é um instrumento de regulação.',
                'Combine isso com a Revisão Semanal para ajustar energia prevista e prioridades.',
                'Depois de dispensar o alerta, ele fica silencioso pelo dia.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'gamificacao',
            icon: 'emoji_events',
            title: 'Gamificação e Progressão',
            subtitle: 'XP, streaks, maturação e níveis',
            what: 'O sistema atribui <strong>XP</strong> a cada ação: hábitos executados valem <strong>2 XP base</strong> (4 XP se for o <strong>Hábito-Chave</strong>), +1 XP por ligar a uma força, +2 XP por ligar a uma sombra, +1 XP por ter plano se-então preenchido. Retomar um hábito após pausa rende <strong>+3 XP de bônus de retomada</strong> (uma vez por mês por hábito). XP acumula em <strong>nível</strong> e <strong>streak</strong>. Hábitos que mantêm ≥80% de consistência por 4 semanas <strong>graduam</strong> de "em formação" para "automático".',
            why: 'Recompensas pequenas e frequentes ajudam no começo de uma mudança, quando a consistência ainda está nascendo. A maturação de hábitos aplica a Teoria da Autodeterminação: à medida que o comportamento se automatiza, a recompensa externa diminui para não ocupar o lugar da motivação interna. Streaks também ajudam muita gente porque dão sensação de continuidade visível.',
            refs: ['Deci & Ryan — Self-Determination Theory', 'B.J. Fogg — Tiny Habits (celebration)', 'Lally et al. — habit formation curve'],
            how: [
                'Marque o <strong>Hábito-Chave</strong> para dobrar o XP base — reserve para o hábito de maior alavancagem do momento.',
                'Ligar hábitos a forças e sombras aumenta XP e fortalece o elo entre identidade e ação.',
                'Hábitos de sombra ganham +2 XP porque costumam pedir mais atenção, autocontrole e regulação emocional.',
                'Retomar um hábito após pausa rende +3 XP de bônus de retomada, uma vez por mês por hábito.',
                'Manter o Hábito-Chave por 7 ou 30 dias consecutivos desbloqueia conquistas especiais.',
                'Hábitos automáticos rendem XP reduzido — sinal de que o comportamento já está internalizado.',
                'Streaks quebrados não apagam progresso; o nível e o histórico persistem.',
                'Sessão de foco ligada a hábito de tempo soma minutos no hábito; em hábitos não-temporais, o foco registra entrega e nota, sem marcar progresso automático.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'social',
            icon: 'groups',
            title: 'Área Social',
            subtitle: 'Companheiros, convites e desafios leves',
            what: 'A <strong>Área Social</strong> fica no Perfil e é opcional. Ela permite ativar compartilhamento público, escolher exatamente quais campos podem aparecer, gerar código de convite, conectar companheiros, enviar reações leves e criar desafios semanais.',
            why: 'Apoio social pode aumentar continuidade porque cria contexto compartilhado sem transformar a rotina em competição pesada. No Life OS, o compartilhamento é reduzido e depende da sua escolha: diário, check-in emocional, valores, sombras, propósito, notas, projetos, ações e respostas de bem-estar continuam privados.',
            refs: ['Social accountability', 'Self-Determination Theory - relatedness', 'LGPD - minimizacao de dados'],
            how: [
                'No Perfil, ative Área Social e depois ligue Privacidade e Compartilhamento se quiser aparecer para companheiros.',
                'Em Campos compartilháveis, desligue qualquer dado que você não queira mostrar no perfil público.',
                'Para conectar, uma pessoa gera um código e a outra aceita. Se a conexão não aparecer para os dois, cada lado pode aceitar o código do outro.',
                'Dias em sequência é a soma das sequências atuais dos companheiros visíveis, incluindo você. Exemplo: 3 dias seus + 2 dias de um companheiro = 5 dias em sequência no grupo.',
                'Use reações e desafios como apoio leve; eles não revelam diário, emoções ou conteúdo privado.'
            ],
            cta: { label: 'Abrir Área Social', view: 'perfil', sectionId: 'social-access-section' }
        },
        {
            id: 'jornada-guiada',
            icon: 'explore_nearby',
            title: 'Jornada Guiada',
            subtitle: 'Primeiros passos e próximos movimentos',
            what: 'A <strong>Jornada Guiada</strong> (aba Perfil, seção Manual) é este guia que você está lendo. Ela marca quais capítulos você já abriu e mostra progresso. Os primeiros passos do app passam por conta, Roda da Vida, valores, propósito e identidade, em uma ordem pensada para facilitar entendimento.',
            why: 'Sistemas novos pedem energia para fazer sentido. Uma jornada guiada reduz essa barreira porque apresenta o essencial na ordem certa, sem jogar tudo de uma vez. O progresso visível também ajuda muita gente a continuar até formar o modelo mental do app.',
            refs: ['BJ Fogg — Tiny Habits (starter steps)', 'Nielsen Norman Group — Progressive disclosure'],
            how: [
                'Leia os capítulos na ordem sugerida para construir o modelo mental correto antes de usar cada seção.',
                'Você pode abrir capítulos em qualquer ordem — o marcador "Lido" só registra, não bloqueia.',
                'Use os botões "Ir para X" ao final de cada capítulo para ir diretamente à seção referenciada.',
                'Retorne ao guia quando adicionar uma função nova (hábito, Projeto, Odyssey) para revisar o capítulo relevante.'
            ],
            cta: null
        },
        {
            id: 'ritual-sugestao',
            icon: 'compass_calibration',
            title: 'Ritmo e Sugestão de Ritual',
            subtitle: 'Como o app orienta o próximo passo certo',
            what: 'A <strong>Bússola do Dia</strong> (aba Hoje) organiza o ritmo em duas camadas: cadência (check-in, shutdown, revisão e planejamento) e execução (ação, hábito, rotina ou foco). A <strong>Próxima Melhor Ação</strong> não é mais só uma ação recomendada: ela pode apontar para foco em andamento, ação urgente, hábito/rotina do horário, check-in pendente ou ajuste de ritmo.',
            why: 'Decidir "o que faço agora?" gasta energia mental, especialmente em dias mais cheios. Separar cadência de execução reduz essa fricção sem misturar ritual semanal com tarefa de curto prazo. Recomendações contextuais costumam funcionar melhor do que lembretes genéricos porque chegam com mais sentido.',
            refs: ['Gollwitzer — Implementation Intentions', 'Decision fatigue / cognitive load research', 'Ecological Momentary Assessment'],
            how: [
                'Use a Bússola para rituais de cadência (check-in, shutdown, revisão e planejamento).',
                'Use a Próxima Melhor Ação para decidir a execução imediata do dia.',
                'Quando houver foco em andamento, a recomendação prioriza terminar o bloco antes de abrir nova frente.',
                'Quando não houver urgência, a recomendação pode sugerir ajuste de ritmo em vez de empurrar volume.'
            ],
            cta: { label: 'Ir para Hoje', view: 'hoje' }
        },
        {
            id: 'mapa-capacidade',
            icon: 'schedule',
            title: 'Para Hoje e Capacidade',
            subtitle: 'Planejar o dia sem estourar energia e tempo',
            what: 'A seção <strong>Para hoje</strong> virou o centro operacional do dia. Ela reúne ações, hábitos previstos e rotinas (hábitos com protocolo ou checklist). O <strong>Mapa do Dia</strong> mostra capacidade planejável, tempo planejado e saldo em minutos por dia ou por turno. A base dessa capacidade pode ser ajustada no <strong>Perfil</strong> com intervalos reais de sono, compromissos fixos, básicos do dia e uma reserva de tempo; depois o check-in do dia pode aumentar ou reduzir a capacidade final. Hábitos de tempo usam meta em minutos, protocolos podem somar tempos por passo, e ações sem estimativa usam padrões por esforço.',
            why: 'Planejamento sem noção de capacidade cria sobrecarga silenciosa. Combinar base configurável com ajuste do check-in torna o número do dia mais honesto. Estimar tempo por padrão reduz a barreira de entrada e permite ajuste rápido antes de o dia travar.',
            refs: ['Timeboxing', 'Planning fallacy (Kahneman & Tversky)', 'Behavioral design — friction as signal'],
            how: [
                'Mapa do Dia, progresso, pendentes e lista auxiliar usam a mesma carga total do dia: ações, hábitos e rotinas.',
                'Na aba Hoje > Para hoje, leia primeiro o status de capacidade (executável, no limite ou sobrecarregado).',
                'Se a base do seu dia estiver errada, use o botão "Ajustar base" no próprio mapa (ou Perfil > Preferências > Base da Capacidade do Dia) e ajuste os intervalos antes de mexer no planejamento.',
                'Se houver check-in no dia, confira no cabeçalho do mapa quando a capacidade foi reduzida ou ampliada.',
                'Se o dia ficar no limite, adie micros de menor impacto ou simplifique rotinas.',
                'Defina estimativa manual quando souber melhor seu tempo real para aquela ação.',
                'Pense em minutos totais para planejar e em sessões de foco para executar: o app separa essas duas camadas para não transformar toda ação em um único pomodoro.',
                'Use o modo Horário para ver manhã, tarde e noite com capacidade separada; o checklist principal continua focado nas ações.',
                'Use horário de execução para organizar o dia; use horário de lembrete apenas quando quiser um aviso separado da agenda.',
                'Hábito com protocolo ou passos aparece como rotina automaticamente na experiência de hoje.',
                'A aba Hábitos continua sendo biblioteca completa; Para hoje mostra apenas o recorte do dia.'
            ],
            cta: { label: 'Abrir Para hoje', view: 'hoje' }
        },
        {
            id: 'hierarquia-diagnostico',
            icon: 'account_tree',
            title: 'Diagnóstico de Hierarquia',
            subtitle: 'Verificar alinhamento da cascata Meta → Ação',
            what: 'Em Planos, cada item mostra seu pai (ex: "Ação → Entrega → Projeto → Meta") e o número de filhos. O <strong>diagnóstico</strong> identifica metas sem projetos, projetos sem entregas ativas e entregas sem ações: elos quebrados que impedem a cascata de funcionar.',
            why: 'Objetivos desconexos criam esforço fragmentado: você executa tarefas que não servem metas maiores, ou tem metas que nunca viram ação. Quando a cadeia entre meta, projeto, entrega e ação fica clara, a execução diária ganha direção.',
            refs: ['John Doerr — Measure What Matters', 'Locke & Latham — Goal-Setting Theory', 'Andy Grove — High Output Management'],
            how: [
                'Ao criar uma Entrega, associe-a a um Projeto e Meta para fechar a hierarquia.',
                'Ao criar uma Ação, associe-a a uma Entrega para que o esforço diário apareça no Painel.',
                'Quando algo ficar desalinhado, trate o aviso como convite para revisão antes de seguir acumulando esforço solto.',
                'Metas órfãs (sem Projeto ou Entrega) aparecem com aviso no Painel de hierarquia.',
                'Revise o alinhamento na Revisão Semanal: "minhas ações desta semana servem algum projeto?"'
            ],
            cta: { label: 'Abrir Planos', view: 'planos' }
        }
    ],

normalizeManualGuideScreen: function(screenId = 'all') {
        const value = String(screenId || '').trim().toLowerCase();
        const allowed = new Set(['all', 'hoje', 'painel', 'planos', 'foco', 'proposito', 'perfil', 'social']);
        return allowed.has(value) ? value : 'all';
    },

getManualGuideScreens: function() {
        return [
            { id: 'all', label: 'Todas' },
            { id: 'hoje', label: 'Hoje' },
            { id: 'painel', label: 'Painel' },
            { id: 'planos', label: 'Planos' },
            { id: 'foco', label: 'Foco' },
            { id: 'proposito', label: 'Proposito' },
            { id: 'perfil', label: 'Perfil' },
            { id: 'social', label: 'Social' }
        ];
    },

getManualGuideScreenLabel: function(screenId = 'all') {
        const normalized = this.normalizeManualGuideScreen(screenId);
        const found = this.getManualGuideScreens().find((item) => item.id === normalized);
        return found ? found.label : 'Outros';
    },

getManualGuideScreenForChapter: function(chapter) {
        const chapterId = String(chapter?.id || '').trim();
        const screenByChapterId = {
            'visao-geral': 'proposito',
            'identidade': 'proposito',
            'bem-estar': 'proposito',
            'legado': 'proposito',
            'odyssey': 'proposito',
            'ikigai': 'proposito',
            'visao': 'proposito',
            'jornada-guiada': 'proposito',
            'planos': 'planos',
            'woop': 'planos',
            'protocolos-base': 'planos',
            'hierarquia-diagnostico': 'planos',
            'habitos': 'planos',
            'habitos-ponte': 'planos',
            'maturacao-habitos': 'planos',
            'hoje': 'hoje',
            'cadencia': 'hoje',
            'ritual-sugestao': 'hoje',
            'mapa-capacidade': 'hoje',
            'foco': 'foco',
            'reflexao': 'painel',
            'padroes': 'painel',
            'carga-recuperacao': 'painel',
            'notas': 'perfil',
            'gamificacao': 'perfil',
            'social': 'social'
        };
        if (screenByChapterId[chapterId]) return screenByChapterId[chapterId];
        const fallbackView = String(chapter?.cta?.view || '').trim().toLowerCase();
        return this.normalizeManualGuideScreen(fallbackView || 'perfil');
    },

setManualGuideScreenFilter: function(screenId = 'all') {
        this.manualGuideScreenFilter = this.normalizeManualGuideScreen(screenId);
        this.renderManualGuide();
    },

syncManualGuideScreenNav: function(activeScreen = 'all') {
        const normalized = this.normalizeManualGuideScreen(activeScreen);
        document.querySelectorAll('[data-manual-screen]').forEach((button) => {
            const screen = this.normalizeManualGuideScreen(button.getAttribute('data-manual-screen'));
            const isActive = screen === normalized;
            button.classList.toggle('text-primary', isActive);
            button.classList.toggle('border-b-2', isActive);
            button.classList.toggle('border-primary', isActive);
            button.classList.toggle('text-outline', !isActive);
            button.classList.toggle('hover:text-primary', !isActive);
        });
    },

ensureManualGuideState: function() {
        if (!window.sistemaVidaState.profile) return;
        const profile = window.sistemaVidaState.profile;
        if (!profile.manualGuide || typeof profile.manualGuide !== 'object') {
            profile.manualGuide = { read: [] };
        }
        if (!Array.isArray(profile.manualGuide.read)) profile.manualGuide.read = [];
    },

isManualChapterRead: function(id) {
        this.ensureManualGuideState();
        return (window.sistemaVidaState.profile.manualGuide.read || []).includes(id);
    },

toggleManualChapter: function(id) {
        const wrap = document.getElementById(`manual-ch-body-${id}`);
        const chevron = document.getElementById(`manual-ch-chevron-${id}`);
        if (!wrap) return;
        const willOpen = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', !willOpen);
        if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : '';
        if (willOpen && !this.isManualChapterRead(id)) {
            this.ensureManualGuideState();
            window.sistemaVidaState.profile.manualGuide.read.push(id);
            this.saveState(true);
            this.renderManualGuideProgress();
            const card = document.getElementById(`manual-ch-card-${id}`);
            if (card) card.classList.add('manual-ch-read');
            const badge = document.getElementById(`manual-ch-badge-${id}`);
            if (badge) badge.textContent = 'Lido';
        }
    },

manualGuideJumpTo: function(view, sectionId) {
        if (!view) return;
        if (sectionId) {
            this.flowNavigate(view, sectionId, '');
        } else {
            if (view === 'perfil') this.profileActiveTab = 'perfil';
            this.switchView(view).then(() => {
                if (view === 'perfil') this.setProfileTab('perfil');
            }).catch(() => {});
        }
    },

openManualChapter: function(chapterId) {
        const chapter = (this.manualGuideChapters || []).find((item) => item.id === chapterId);
        if (chapter) this.manualGuideScreenFilter = this.getManualGuideScreenForChapter(chapter);
        this.flowNavigate('perfil', 'manual-guide-section', '');
        // Expand the chapter after navigation settles
        setTimeout(() => {
            const body = document.getElementById(`manual-ch-body-${chapterId}`);
            if (body && body.classList.contains('hidden')) {
                this.toggleManualChapter(chapterId);
            }
            const card = document.getElementById(`manual-ch-card-${chapterId}`);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
    },

renderManualGuideProgress: function() {
        const total = this.manualGuideChapters.length;
        const read = (window.sistemaVidaState?.profile?.manualGuide?.read || []).filter(id =>
            this.manualGuideChapters.some(c => c.id === id)
        ).length;
        const progress = document.getElementById('manual-guide-progress');
        const bar = document.getElementById('manual-guide-progress-bar');
        if (progress) progress.textContent = `${read}/${total}`;
        if (bar) bar.style.width = total ? `${Math.round((read / total) * 100)}%` : '0%';
    },

renderManualGuide: function() {
        const list = document.getElementById('manual-guide-list');
        if (!list) return;
        this.ensureManualGuideState();
        const esc = (s) => this.escapeHtml(String(s || ''));
        const activeScreen = this.normalizeManualGuideScreen(this.manualGuideScreenFilter || 'all');
        this.manualGuideScreenFilter = activeScreen;
        this.syncManualGuideScreenNav(activeScreen);

        const chaptersWithContext = this.manualGuideChapters.map((ch, idx) => ({
            ...ch,
            _manualOrder: idx,
            _manualScreen: this.getManualGuideScreenForChapter(ch)
        }));
        const filteredChapters = activeScreen === 'all'
            ? chaptersWithContext
            : chaptersWithContext.filter((chapter) => chapter._manualScreen === activeScreen);

        const renderCard = (ch, displayIndex) => {
            const isRead = this.isManualChapterRead(ch.id);
            const refs = (ch.refs || []).map((r) => `<li>${esc(r)}</li>`).join('');
            const how = (ch.how || []).map((h) => `<li>${esc(h)}</li>`).join('');
            const screenLabel = this.getManualGuideScreenLabel(ch._manualScreen);
            const ctaSectionArg = ch.cta && ch.cta.sectionId ? `,'${esc(ch.cta.sectionId)}'` : '';
            const cta = ch.cta ? `
                <button type="button" onclick="window.app.manualGuideJumpTo('${esc(ch.cta.view)}'${ctaSectionArg})"
                    class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all">
                    <span class="material-symbols-outlined notranslate text-[16px]">arrow_forward</span>
                    ${esc(ch.cta.label)}
                </button>` : '';
            return `
            <div id="manual-ch-card-${esc(ch.id)}" class="rounded-xl border border-outline-variant/15 bg-surface-container-low overflow-hidden ${isRead ? 'manual-ch-read' : ''}">
                <button type="button" onclick="window.app.toggleManualChapter('${esc(ch.id)}')"
                    class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left hover:bg-surface-container transition-colors">
                    <span class="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                        <span class="material-symbols-outlined notranslate text-[18px]">${esc(ch.icon)}</span>
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="text-[9px] font-bold uppercase tracking-[0.18em] text-outline sm:text-[10px]">Capitulo ${displayIndex + 1} - ${esc(screenLabel)}</p>
                        <p class="mt-0.5 text-sm font-bold leading-snug text-on-surface">${esc(ch.title)}</p>
                        <p class="mt-1 text-[11px] leading-snug text-outline">${esc(ch.subtitle)}</p>
                    </div>
                    <span id="manual-ch-chevron-${esc(ch.id)}" class="material-symbols-outlined notranslate text-outline text-[18px] transition-transform shrink-0">expand_more</span>
                </button>
                <div id="manual-ch-body-${esc(ch.id)}" class="hidden px-5 pb-5 pt-1 space-y-3 text-sm text-on-surface-variant leading-relaxed">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">O que e</p>
                        <p>${ch.what}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Por que funciona</p>
                        <p>${esc(ch.why)}</p>
                        ${refs ? `<details class="mt-2"><summary class="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-outline">Referencias</summary><ul class="mt-2 list-disc list-inside text-[11px] text-outline space-y-0.5">${refs}</ul></details>` : ''}
                    </div>
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Como usar</p>
                        <ol class="list-decimal list-inside space-y-1.5">${how}</ol>
                    </div>
                    ${cta}
                </div>
            </div>`;
        };

        if (!filteredChapters.length) {
            list.innerHTML = '<p class="text-xs text-outline italic rounded-xl bg-surface-container-low p-4">Nenhum capitulo nesta sessao.</p>';
            this.renderManualGuideProgress();
            return;
        }

        if (activeScreen === 'all') {
            const screenOrder = ['proposito', 'planos', 'hoje', 'foco', 'painel', 'perfil', 'social'];
            let displayIndex = 0;
            list.innerHTML = screenOrder.map((screenId) => {
                const groupItems = filteredChapters.filter((chapter) => chapter._manualScreen === screenId);
                if (!groupItems.length) return '';
                const groupLabel = this.getManualGuideScreenLabel(screenId);
                const cards = groupItems
                    .sort((a, b) => a._manualOrder - b._manualOrder)
                    .map((chapter) => {
                        const html = renderCard(chapter, displayIndex);
                        displayIndex += 1;
                        return html;
                    })
                    .join('');
                return `
                <section class="space-y-3">
                    <div class="flex items-center justify-between gap-2 px-1">
                        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">${esc(groupLabel)}</p>
                        <span class="text-[10px] text-outline">${groupItems.length} item(ns)</span>
                    </div>
                    <div class="space-y-3">${cards}</div>
                </section>`;
            }).filter(Boolean).join('');
        } else {
            const ordered = filteredChapters.sort((a, b) => a._manualOrder - b._manualOrder);
            list.innerHTML = ordered.map((chapter, index) => renderCard(chapter, index)).join('');
        }
        this.renderManualGuideProgress();
    },
    });
}
