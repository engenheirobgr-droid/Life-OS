export function attachRenderModule(app) {
    Object.assign(app, {
renderFlowModal: function() {
        const el = document.getElementById('flow-modal-content');
        if (!el) return;
        const s = this._getFlowState();

        const row = (icon, title, subtitle, xpLabel, done, view, sectionId = '', tabId = '', cadenceKey = '', showCadenceMeta = false) => {
            // Get rich cadence status when available
            const cadStatus = cadenceKey ? this.getCadenceStatus(cadenceKey) : null;
            const bg = done
                ? 'bg-emerald-500/[0.06] border border-emerald-500/20'
                : 'bg-surface-container-low border border-outline-variant/15';
            const checkIcon = done ? 'check_circle' : 'radio_button_unchecked';
            const checkColor = done ? 'text-emerald-500' : 'text-outline-variant/60';
            const checkFill = done ? "font-variation-settings:'FILL' 1;" : '';

            // Cadence state chip — shows overdue/soon context with days
            let cadenceChip = '';
            if (cadStatus && !done) {
                if (cadStatus.state === 'overdue') {
                    const daysLabel = cadStatus.daysSince === null
                        ? 'Nunca feito'
                        : `Atrasado há ${cadStatus.daysSince} dia${cadStatus.daysSince === 1 ? '' : 's'}`;
                    cadenceChip = `<span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-error bg-error/10 border border-error/20 px-1.5 py-0.5 rounded-md leading-none">${this.escapeHtml(daysLabel)}</span>`;
                } else if (cadStatus.state === 'soon') {
                    cadenceChip = `<span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md leading-none">Em breve</span>`;
                }
            }

            const cadenceConfig = cadenceKey ? this.getCadenceConfig()[cadenceKey] : null;
            const cadenceMeta = cadenceConfig && (showCadenceMeta || !!cadenceKey)
                ? `<p class="text-[10px] text-outline mt-1 leading-snug">Revisitar: ${this.escapeHtml(this.getCadenceFrequencyLabel(cadenceConfig.expectedDays).toLowerCase())}</p>`
                : '';
            const xpEl = xpLabel
                ? `<span class="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md leading-none">${xpLabel}</span>`
                : `<span class="shrink-0 text-[9px] font-bold uppercase tracking-wider text-outline bg-surface-container-highest border border-outline-variant/20 px-1.5 py-0.5 rounded-md leading-none">ritual</span>`;
            return `
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl ${bg}">
                <span class="material-symbols-outlined notranslate text-xl shrink-0 ${checkColor}" style="${checkFill}">${checkIcon}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="material-symbols-outlined notranslate text-[15px] text-outline shrink-0">${icon}</span>
                        <p class="text-sm font-semibold text-on-surface leading-snug">${title}</p>
                        ${cadenceChip || xpEl}
                    </div>
                    <p class="text-[11px] text-outline mt-0.5 leading-snug">${subtitle}</p>
                    ${cadenceMeta}
                </div>
                <button onclick="window.app.flowNavigate('${view}','${sectionId}','${tabId}');"
                    class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest text-outline hover:text-primary transition-colors">
                    <span class="material-symbols-outlined notranslate text-[18px]">arrow_forward</span>
                </button>
            </div>`;
        };

        const sub = (label, icon) => `
        <div class="flex items-center gap-2 mt-4 mb-2">
            <span class="material-symbols-outlined notranslate text-[13px] text-outline">${icon}</span>
            <span class="text-[9px] font-bold uppercase tracking-[0.16em] text-outline">${label}</span>
            <span class="h-px flex-1 bg-outline-variant/20"></span>
        </div>`;

        const section = (title, icon, body) => `
        <div class="mb-1">
            <div class="flex items-center gap-2 mb-3 mt-5 first:mt-0">
                <span class="material-symbols-outlined notranslate text-base text-primary">${icon}</span>
                <h3 class="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">${title}</h3>
            </div>
            <div class="space-y-2">${body}</div>
        </div>`;

        // "Próximo ritual" card — surfaces the most urgent overdue/soon item
        const nextRitual = this.getNextRitualSuggestion();
        const nextRitualCard = nextRitual ? (() => {
            const isOverdue = nextRitual.state === 'overdue';
            const daysLabel = nextRitual.daysSince === null
                ? 'Nunca feito'
                : isOverdue
                    ? `Atrasado há ${nextRitual.daysSince} dia${nextRitual.daysSince === 1 ? '' : 's'}`
                    : `Há ${nextRitual.daysSince} dia${nextRitual.daysSince === 1 ? '' : 's'}`;
            const colorBg = isOverdue ? 'bg-error/[0.06] border-error/20' : 'bg-amber-500/[0.06] border-amber-500/20';
            const colorText = isOverdue ? 'text-error' : 'text-amber-600 dark:text-amber-400';
            const colorIcon = isOverdue ? 'text-error' : 'text-amber-500';
            return `
            <div class="mb-5 rounded-2xl border ${colorBg} p-4 flex items-center gap-3">
                <span class="material-symbols-outlined notranslate ${colorIcon} text-2xl shrink-0">${nextRitual.icon || 'priority_high'}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-bold uppercase tracking-widest ${colorText} mb-0.5">Próximo ritual</p>
                    <p class="text-sm font-semibold text-on-surface leading-snug">${this.escapeHtml(nextRitual.label || '')}</p>
                    <p class="text-[11px] text-outline mt-0.5">${this.escapeHtml(daysLabel)}</p>
                </div>
                <button onclick="window.app.flowNavigate('${this.escapeHtml(nextRitual.route?.view || '')}','${this.escapeHtml(nextRitual.route?.sectionId || '')}','${this.escapeHtml(nextRitual.route?.tabId || '')}');"
                    class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest ${isOverdue ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'} active:scale-95 transition-all">
                    Ir agora
                </button>
            </div>`;
        })() : '';

        el.innerHTML = nextRitualCard +
            section('Rotina Diária', 'today',
                sub('Manhã', 'wb_sunny') +
                row('monitor_heart', 'Check-in diário', 'Sono, energia, humor, estresse e emoção do dia', '+10 XP', s.checkinDone, 'hoje', 'daily-checkin-panel', '', 'checkin') +
                row('my_location', 'Intenção do dia', 'Definir o foco e a bússola — o que norteia as escolhas', '+5 XP', s.intentionDone, 'hoje', 'daily-checkin-panel') +
                sub('Ao longo do dia', 'light_mode') +
                row('task_alt', 'Executar micros', 'Avançar ao menos uma micro ação do plano semanal', '+12–22 XP', s.microsDoneToday, 'hoje', 'hoje-checklist-section') +
                row('repeat', 'Registrar hábitos', 'Marcar os hábitos concluídos no dia', '+6–10 XP', s.habitsDoneToday, 'hoje', 'hoje-habits-section') +
                row('timer', 'Sessão de foco', 'Bloco de deep work com Pomodoro (90/20)', '+10–40 XP', s.focusToday, 'foco', 'deep-work-panel') +
                sub('Noite', 'nightlight') +
                row('auto_stories', 'Diário & Gratidão', 'Reflexão do dia e três coisas pelas quais é grato', '+8 XP', s.diaryDone, 'hoje', 'hoje-diario-section', '', 'diary') +
                row('power_settings_new', 'Shutdown ritual', 'Fechar o dia com intenção e limpar a mente', '+8 XP', s.shutdownDone, 'hoje', 'hoje-diario-section', '', 'shutdown')
            ) +
            section('Ritmo Semanal', 'date_range',
                row('edit_calendar', 'Planejamento semanal', 'Selecionar micros e definir a intenção da semana', '+15 XP', s.weekPlanDone, 'planos', 'tab-semanal', 'semanal', 'weeklyPlan') +
                row('rate_review', 'Revisão semanal', 'Avaliar execução, padrões e ajustar o rumo', '+25–30 XP', s.weekReviewDone, 'planos', 'weekly-plan-primary-action', 'semanal', 'weeklyReview')
            ) +
            section('Ritmo Mensal', 'calendar_month',
                row('donut_large', 'Roda da Vida', 'Pontuar as 8 dimensões e ver onde está desequilibrado', '', s.wheelThisMonth, 'proposito', 'proposito-roda-section', '', 'wheel') +
                row('sentiment_satisfied', 'SWLS', 'Escala de Satisfação com a Vida — avaliação de bem-estar profundo', '', s.swlsThisQuarter, 'proposito', 'swls-section', '', 'swls') +
                row('account_tree', 'Revisar Macros', 'Avaliar iniciativas mensais em andamento e criar novas', '', s.macrosThisMonth, 'planos', '', 'macro')
            ) +
            section('Ritmo Trimestral', 'event_repeat',
                row('track_changes', 'OKRs', 'Definir ou revisar Objetivos e Resultados-Chave do trimestre', '', s.okrsExist, 'planos', '', 'okrs') +
                row('fact_check', 'Revisão de ciclo', 'Fechar o ciclo de 12 semanas e decidir o destino dos OKRs ativos', '', s.cycleReviewDone, 'planos', 'tab-ciclo', 'ciclo', 'cycleReview') +
                row('psychology', 'PERMA', 'Medir florescimento: emoções, engajamento, relações, sentido e realização', '', s.permaThisMonth, 'proposito', 'perma-section', '', 'perma')
            ) +
            section('Horizonte Vital', 'auto_awesome',
                row('flag', 'Metas de vida', 'Metas de 1 a 5 anos alinhadas ao propósito de vida', '', s.lifeGoalsFilled, 'planos', '', 'metas', 'lifeGoals', true) +
                row('explore', 'Odyssey Plan', 'Opcional: descreva 1 a 3 futuros possíveis para os próximos 5 anos', '', s.odysseyFilled, 'proposito', 'odyssey-section', '', 'odyssey', true) +
                row('star', 'Ikigai', 'Mapa completo de amor, talento, necessidade, sustento e síntese', '', s.ikigaiFilled, 'proposito', 'proposito-ikigai-section', '', 'ikigai', true) +
                row('auto_stories', 'Legado', 'Impacto desejado em família, profissão e mundo', '', s.legacyFilled, 'proposito', 'proposito-legado-section', '', 'legacy', true) +
                row('visibility', 'Visão de Vida', 'Vida concreta escolhida em saúde, carreira, intelecto e frase-guia', '', s.visionFilled, 'proposito', 'proposito-visao-section', '', 'vision', true)
            );
    },

renderTimelineHistory: function() {
        const container = document.getElementById('timeline-history-container');
        if (!container) return;
        const allDates = this.getAllActiveDates();

        if (!allDates.length) {
            container.innerHTML = '<p class="text-sm text-outline italic p-4 text-center">Nenhum registro ainda. Use o app por alguns dias para construir sua linha do tempo.</p>';
            return;
        }

        const emotionEmojis = { calmo:'😌', ansioso:'😰', animado:'🥳', focado:'🎯', cansado:'😴', sobrecarregado:'🤯', esperancoso:'🌟', irritado:'😤', grato:'🙏', motivado:'🚀', triste:'😔', confiante:'💪' };
        const energyEmojis = ['', '🪫', '😩', '😐', '⚡', '🔥'];
        const dimIcons = { 'Saúde':'💪','Mente':'🧠','Carreira':'💼','Finanças':'💰','Relacionamentos':'🤝','Família':'🏠','Lazer':'🎨','Propósito':'✨' };
        const habitIconMap = { 'Saúde':'fitness_center','Mente':'psychology','Carreira':'work','Finanças':'payments','Relacionamentos':'groups','Família':'family_restroom','Lazer':'sports_esports','Propósito':'auto_awesome' };
        const macros = (window.sistemaVidaState.entities?.macros) || [];
        const todayKey = this.getLocalDateKey();
        const currentMonth = todayKey.slice(0, 7);
        const dots = (n, col) => Array.from({length:5}, (_,i) =>
            `<span class="inline-block w-2 h-2 rounded-full ${i < n ? col : 'bg-surface-container-high'}"></span>`
        ).join('');

        // Group dates by YYYY-MM (already sorted descending)
        const byMonth = {};
        allDates.forEach(dateKey => {
            const ym = dateKey.slice(0, 7);
            if (!byMonth[ym]) byMonth[ym] = [];
            byMonth[ym].push(dateKey);
        });
        const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

        const renderCard = (dateKey) => {
            const d = this.getAggregatedDayData(dateKey);
            const dateObj = new Date(dateKey + 'T12:00:00');
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
            const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const isToday = dateKey === todayKey;
            const emotionEmoji = d.checkin?.emotion ? (emotionEmojis[d.checkin.emotion] || '') : '';
            const energyEmoji = d.checkin?.energy ? (energyEmojis[d.checkin.energy] || '') : '';

            // Resumo rápido para o card colapsado
            const stats = [];
            if (d.microsDone.length) stats.push(`${d.microsDone.length} micro${d.microsDone.length > 1 ? 's' : ''}`);
            if (d.habitsDone.length) stats.push(`${d.habitsDone.length} hábito${d.habitsDone.length > 1 ? 's' : ''}`);
            if (d.dwMinutes) stats.push(`${d.dwMinutes}min foco`);
            if (d.notes.length) stats.push(`${d.notes.length} nota${d.notes.length > 1 ? 's' : ''}`);
            if (d.cadenceEvents.length) stats.push(`${d.cadenceEvents.length} revisão${d.cadenceEvents.length > 1 ? 'ões' : ''}`);
            if (d.xpEarned) stats.push(`+${d.xpEarned} XP`);

            // ── Seções expandidas ──
            let checkinHtml = '';
            if (d.checkin) {
                const c = d.checkin;
                checkinHtml = `<div class="space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Como estava</p>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        ${c.sleepHours ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Sono</span><span class="font-semibold text-on-surface">${c.sleepHours}h</span></div>` : ''}
                        ${c.sleepQuality ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Qualidade</span><div class="flex gap-1">${dots(c.sleepQuality,'bg-tertiary')}</div></div>` : ''}
                        ${c.energy ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Energia</span><div class="flex gap-1">${dots(c.energy,'bg-primary')}</div></div>` : ''}
                        ${c.mood ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Humor</span><div class="flex gap-1">${dots(c.mood,'bg-secondary')}</div></div>` : ''}
                        ${c.stress ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Estresse</span><div class="flex gap-1">${dots(c.stress,'bg-error')}</div></div>` : ''}
                        ${c.emotion ? `<div class="flex items-center gap-2 text-xs col-span-2"><span class="text-outline w-20 shrink-0">Emoção</span><span class="font-medium">${emotionEmoji} ${this.escapeHtml(c.emotion)}</span></div>` : ''}
                    </div>
                </div>`;
            }

            let diaryHtml = '';
            if (d.log) {
                const parts = [];
                if (d.log.focus) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Intenção</p><p class="text-xs italic text-on-surface">"${this.escapeHtml(d.log.focus)}"</p></div>`);
                if (d.log.gratidao) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Gratidão</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(d.log.gratidao)}</p></div>`);
                if (d.log.funcionou) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">O que funcionou</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(d.log.funcionou)}</p></div>`);
                const dimEntries = Object.entries(d.log.dimensionNotes || {}).filter(([,v]) => v?.trim());
                if (dimEntries.length) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Shutdown</p><div class="space-y-2">${dimEntries.map(([dim, text]) => `<div><p class="text-xs font-bold text-on-surface">${dimIcons[dim] || '⭐'} ${this.escapeHtml(dim)}</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(text)}</p></div>`).join('')}</div></div>`);
                if (parts.length) diaryHtml = `<div class="space-y-3">${parts.join('')}</div>`;
            }

            let habitsHtml = '';
            if (d.habitsDone.length) {
                habitsHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Hábitos concluídos</p><ul class="space-y-1">${
                    d.habitsDone.map(h => `<li class="flex items-center gap-2 text-xs text-on-surface-variant"><span class="material-symbols-outlined notranslate text-primary text-[14px]">${habitIconMap[h.dimension] || 'stars'}</span>${this.escapeHtml(h.title)}</li>`).join('')
                }</ul></div>`;
            }

            let microsHtml = '';
            if (d.microsDone.length) {
                microsHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Micro-ações concluídas</p><ul class="space-y-1">${
                    d.microsDone.map(m => {
                        const macro = macros.find(mc => mc.id === m.macroId);
                        return `<li class="flex items-start gap-2 text-xs"><span class="material-symbols-outlined notranslate text-secondary text-[14px] mt-0.5 shrink-0">check_circle</span><span class="text-on-surface-variant">${this.escapeHtml(m.title)}${macro ? `<span class="ml-1 text-outline">· ${this.escapeHtml(macro.title)}</span>` : ''}</span></li>`;
                    }).join('')
                }</ul></div>`;
            }

            let dwHtml = '';
            if (d.dwSessions.length) {
                dwHtml = `<div class="flex items-center gap-3"><span class="material-symbols-outlined notranslate text-tertiary text-[18px]">timer</span><div><p class="text-[10px] font-bold uppercase tracking-widest text-outline">Foco profundo</p><p class="text-xs text-on-surface-variant">${d.dwSessions.length} sessão${d.dwSessions.length > 1 ? 'ões' : ''} - ${d.dwMinutes} min</p></div></div>`;
            }

            let notesHtml = '';
            if (d.notes.length) {
                notesHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Anotações</p><ul class="space-y-1.5">${
                    d.notes.map(n => {
                        const linkLabel = this.getNoteLinkLabel(n.linkedTo);
                        return `<li class="text-xs flex flex-wrap items-baseline gap-1.5"><span class="font-medium text-on-surface">${this.escapeHtml(n.title)}</span>${linkLabel ? `<span class="inline-flex rounded-full bg-secondary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">${this.escapeHtml(linkLabel)}</span>` : ''}${n.body ? `<span class="text-on-surface-variant"> — ${this.escapeHtml(n.body.slice(0, 100))}${n.body.length > 100 ? '…' : ''}</span>` : ''}</li>`;
                    }).join('')
                }</ul></div>`;
            }

            let cadenceHtml = '';
            if (d.cadenceEvents.length) {
                cadenceHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Ritmos e revisões</p><div class="flex flex-wrap gap-2">${
                    d.cadenceEvents.map(event => `<span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><span class="material-symbols-outlined notranslate text-[13px]">${this.escapeHtml(event.icon || 'history')}</span>${this.escapeHtml(event.label)}</span>`).join('')
                }</div></div>`;
            }

            let xpHtml = '';
            if (d.xpEarned || d.achievements.length) {
                xpHtml = `<div class="flex flex-wrap gap-2">
                    ${d.xpEarned ? `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">+${d.xpEarned} XP</span>` : ''}
                    ${d.achievements.map(a => `<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600"><span class="material-symbols-outlined notranslate text-[12px]">${this.escapeHtml(a.icon || 'military_tech')}</span>${this.escapeHtml(a.title)}</span>`).join('')}
                </div>`;
            }

            const sections = [checkinHtml, diaryHtml, habitsHtml, microsHtml, dwHtml, notesHtml, cadenceHtml, xpHtml].filter(Boolean);
            const safeKey = dateKey.replace(/-/g, '');

            return `<div class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm overflow-hidden">
                <button type="button" onclick="window.app.toggleTimelineCard('${safeKey}')"
                    class="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container-low transition-colors">
                    <div class="text-center shrink-0 w-9">
                        <span class="block text-[9px] uppercase font-bold text-outline leading-tight">${weekday}</span>
                        <span class="block text-xl font-bold text-primary leading-tight">${dayNum}</span>
                    </div>
                    <div class="w-px h-10 bg-outline-variant/20 shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${isToday ? '<span class="text-[10px] font-bold text-primary">Hoje</span>' : ''}
                            ${emotionEmoji ? `<span>${emotionEmoji}</span>` : ''}
                            ${energyEmoji ? `<span>${energyEmoji}</span>` : ''}
                            ${d.log?.focus ? `<span class="text-xs text-on-surface-variant italic truncate">${this.escapeHtml(d.log.focus.slice(0, 60))}${d.log.focus.length > 60 ? '…' : ''}</span>` : ''}
                        </div>
                        ${stats.length ? `<p class="mt-0.5 text-[10px] text-outline">${stats.join(' - ')}</p>` : ''}
                    </div>
                    ${sections.length ? `<span class="material-symbols-outlined notranslate text-outline text-[18px] shrink-0 tl-chev-${safeKey}">expand_more</span>` : ''}
                </button>
                ${sections.length ? `<div id="tl-expand-${safeKey}" class="hidden px-4 pb-5 pt-4 border-t border-outline-variant/10 space-y-4">${sections.join('<div class="h-px bg-outline-variant/10"></div>')}</div>` : ''}
            </div>`;
        };

        // Render grouped by month, current month expanded by default
        const monthHtml = sortedMonths.map(ym => {
            const [year, month] = ym.split('-');
            const monthLabel = new Date(ym + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const isCurrentMonth = ym === currentMonth;
            const safeYm = ym.replace('-', '');
            const cards = byMonth[ym].map(dk => renderCard(dk)).join('');
            return `<div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden">
                <button type="button" onclick="window.app.toggleTimelineMonth('${safeYm}')"
                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container-high transition-colors text-left">
                    <span class="text-sm font-bold text-on-surface capitalize">${monthLabel}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-outline">${byMonth[ym].length} dia${byMonth[ym].length > 1 ? 's' : ''}</span>
                        <span class="material-symbols-outlined notranslate text-outline text-[18px] tl-month-chev-${safeYm} transition-transform ${isCurrentMonth ? 'rotate-180' : ''}">expand_more</span>
                    </div>
                </button>
                <div id="tl-month-${safeYm}" class="${isCurrentMonth ? '' : 'hidden'} px-2 pb-2 space-y-2">${cards}</div>
            </div>`;
        }).join('');

        container.innerHTML = monthHtml;
    },

renderWeeklyPlans: function() {
        const state = window.sistemaVidaState;
        const weekPlans = state.weekPlans || {};
        const weekKey = this._getWeekKey();
        const hasWeeklyReview = !!((state.reviews || {})[weekKey]);

        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const labelEl = document.getElementById('semanal-week-label');
        if (labelEl) labelEl.textContent = this._formatWeekRange(weekKey).toUpperCase();

        // Card da semana atual
        const currentCard = document.getElementById('semanal-current-card');
        const currentPlan = weekPlans[weekKey];
        const primaryLabel = document.getElementById('weekly-plan-primary-label');
        const primaryIcon = document.getElementById('weekly-plan-primary-icon');
        if (primaryLabel) primaryLabel.textContent = currentPlan ? 'Editar Plano' : 'Criar Plano da Semana';
        if (primaryIcon) primaryIcon.textContent = currentPlan ? 'edit_calendar' : 'event_available';
        if (currentCard) {
            currentCard.className = 'mb-10';
            currentCard.innerHTML = this._renderWeeklyPlanShell({
                weekKey,
                plan: currentPlan,
                label: 'Semana Atual',
                actionLabel: currentPlan ? '' : 'Criar Plano',
                actionIcon: currentPlan ? '' : 'event_available',
                actionOptions: '',
                isCurrent: true,
                emptyText: 'Nenhum plano para esta semana ainda. Clique em "Criar Plano" para começar.'
            });
        }

        const nextCard = document.getElementById('semanal-next-card');
        if (nextCard) {
            const nextWeekKey = this._getNextWeekKey();
            const nextPlan = weekPlans[nextWeekKey];
            const suggestions = this.getNextWeekCarryoverSuggestions(weekKey);
            if (nextPlan) {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: nextPlan,
                    label: 'Próxima Semana',
                    actionLabel: 'Editar Plano',
                    actionIcon: 'edit_calendar',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true`,
                    isCurrent: false,
                    emptyText: ''
                });
            } else if (!hasWeeklyReview) {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: null,
                    label: 'Próxima Semana',
                    actionLabel: '',
                    actionIcon: '',
                    actionOptions: '',
                    isCurrent: false,
                    emptyText: 'A opção de planejar a próxima semana é habilitada junto com a revisão da semana atual.'
                });
            } else if (suggestions.length > 0) {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: null,
                    label: 'Próxima Semana',
                    actionLabel: 'Planejar Próxima',
                    actionIcon: 'auto_awesome',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true, suggestCarryover: true`,
                    isCurrent: false,
                    emptyText: `<span class="font-bold text-primary">Há ${suggestions.length} micro${suggestions.length > 1 ? 's' : ''} pendente${suggestions.length > 1 ? 's' : ''} para considerar.</span> Priorizei o que ficou planejado e não concluído, está atrasado ou já estava em andamento.`
                });
            } else {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: null,
                    label: 'Próxima Semana',
                    actionLabel: 'Planejar Próxima',
                    actionIcon: 'event_upcoming',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true`,
                    isCurrent: false,
                    emptyText: 'Quando fechar esta semana, prepare o próximo plano aqui.'
                });
            }
        }

        // Histórico (semanas passadas, ordenadas da mais recente para mais antiga)
        const historyContainer = document.getElementById('semanal-history-container');
        const historyCount = document.getElementById('semanal-history-count');
        const pastKeys = Object.keys(weekPlans)
            .filter(k => k < weekKey)
            .sort((a, b) => b.localeCompare(a));

        if (historyCount) historyCount.textContent = pastKeys.length > 0 ? `${pastKeys.length} semana${pastKeys.length > 1 ? 's' : ''} anteriores` : '';

        if (historyContainer) {
            if (pastKeys.length === 0) {
                historyContainer.innerHTML = '<p class="text-sm text-outline italic">Nenhum histórico ainda.</p>';
            } else {
                historyContainer.innerHTML = pastKeys.map(key => {
                    const plan = weekPlans[key];
                    const review = (state.reviews || {})[key];
                    const start = new Date(key + 'T00:00:00');
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    const reviewBadge = review
                        ? `<span class="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full"><span class="material-symbols-outlined notranslate text-[12px]">check_circle</span>Revisado</span>`
                        : `<span class="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-outline bg-surface-container-high px-2 py-0.5 rounded-full">Sem revisão</span>`;
                    const reviewSection = review ? this._renderWeeklyReviewSummary(review) : '';
                    return `<details class="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden group">
                        <summary class="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-container transition-colors list-none">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined notranslate text-outline text-lg">calendar_month</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface flex items-center flex-wrap gap-1">${fmt(start)} — ${fmt(end)}${reviewBadge}</p>
                                    ${plan.intention ? `<p class="text-xs text-outline mt-0.5 truncate max-w-[240px]">${plan.intention}</p>` : ''}
                                </div>
                            </div>
                            <span class="material-symbols-outlined notranslate text-outline text-sm transition-transform group-open:rotate-180">expand_more</span>
                        </summary>
                        <div class="px-5 pb-5 border-t border-outline-variant/10">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline mt-4 mb-2 flex items-center gap-1">
                                <span class="material-symbols-outlined notranslate text-[14px]">edit_calendar</span>
                                Plano da Semana
                            </p>
                            ${this._renderWeekPlanCard(plan, state, false)}
                            ${reviewSection}
                        </div>
                    </details>`;
                }).join('');
            }
        }
    },

_renderWeekPlanCard: function(plan, state, isCurrent) {
        const micros = state.entities?.micros || [];
        const energyLabels = { 1: '1 — Semana leve', 2: '2 — Abaixo do normal', 3: '3 — Normal', 4: '4 — Energia alta', 5: '5 — Semana de pico' };

        const selectedMicros = (plan.selectedMicros || []).map(id => micros.find(m => m.id === id)).filter(Boolean);
        const doneMicros = selectedMicros.filter(m => m.status === 'done' || m.completed);
        const pendingMicros = selectedMicros.filter(m => m.status !== 'done' && !m.completed);

        const completionPct = selectedMicros.length > 0 ? Math.round((doneMicros.length / selectedMicros.length) * 100) : 0;

        return `<div class="space-y-4 mt-4">
            ${plan.intention ? `
            <div class="flex flex-col gap-1">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Intenção</p>
                <p class="text-sm text-on-surface leading-relaxed">${plan.intention}</p>
            </div>` : ''}

            <div class="flex gap-6">
                <div class="flex flex-col gap-0.5">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Energia</p>
                    <p class="text-sm text-on-surface">${energyLabels[plan.energyForecast] || plan.energyForecast}</p>
                </div>
                ${selectedMicros.length > 0 ? `
                <div class="flex flex-col gap-0.5">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Execução</p>
                    <p class="text-sm text-on-surface font-bold text-primary">${doneMicros.length}/${selectedMicros.length} <span class="text-outline font-normal">(${completionPct}%)</span></p>
                </div>` : ''}
            </div>

            ${selectedMicros.length > 0 ? `
            <div class="flex flex-col gap-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Micros Planejados</p>
                <div class="space-y-1.5">
                    ${selectedMicros.map(m => {
                        const done = m.status === 'done' || m.completed;
                        return `<div class="flex items-center gap-2">
                            <span class="material-symbols-outlined notranslate text-[16px] ${done ? 'text-primary' : 'text-outline'}">${done ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span class="text-xs ${done ? 'line-through text-outline' : 'text-on-surface'}">${m.title}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '<p class="text-xs text-outline italic">Nenhum micro selecionado.</p>'}

            ${isCurrent && selectedMicros.length > 0 ? `
            <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-700" style="width: ${completionPct}%"></div>
            </div>` : ''}

            ${isCurrent ? `
            <button onclick="window.app.openWeeklyPlanModal({ addMicro: true })"
                class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-outline-variant/40 text-outline text-xs font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all">
                <span class="material-symbols-outlined notranslate text-[16px]">add_task</span>
                Nova micro para esta semana
            </button>` : ''}

            ${(() => {
                if (!isCurrent) return '';
                const review = (state.reviews || {})[plan.weekKey || app._getWeekKey()];
                return review ? app._renderWeeklyReviewSummary(review) : '';
            })()}

            ${(() => {
                if (!isCurrent) return '';
                const todayDow = new Date().getDay();
                if (![5, 6, 0].includes(todayDow)) return '';
                const wk = app._getWeekKey();
                const hasReview = !!(state.reviews || {})[wk];
                if (hasReview) return `
                <div class="flex items-center gap-2 mt-2 text-primary text-xs font-bold uppercase tracking-wider">
                    <span class="material-symbols-outlined notranslate text-[16px]">check_circle</span>
                    Revisão da semana já realizada
                </div>`;
                return `
                <button onclick="window.app.startWeeklyReview()"
                    class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary text-sm font-bold rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all">
                    <span class="material-symbols-outlined notranslate text-[18px]">rate_review</span>
                    Fazer Revisão da Semana
                </button>`;
            })()}
        </div>`;
    },

renderNotesPanel: function(showAll) {
        const container = document.getElementById('notes-list');
        if (!container) return;
        this.ensureNotesState();
        this.populateNoteLinkedSelect();
        const query = String(document.getElementById('notes-search')?.value || '').trim().toLowerCase();
        const allNotes = (window.sistemaVidaState.profile.notes || []).filter(note => {
            if (!query) return true;
            const haystack = [note.title, note.body, note.url, ...(note.tags || []), this.getNoteLinkLabel(note.linkedTo)]
                .join(' ').toLowerCase();
            return haystack.includes(query);
        });
        if (!allNotes.length) {
            container.innerHTML = '<p class="col-span-full text-sm text-outline italic rounded-xl bg-surface-container-low p-4">Nenhuma nota encontrada.</p>';
            return;
        }

        const renderCard = (note) => {
            const linkLabel = this.getNoteLinkLabel(note.linkedTo);
            const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
            const tags = (note.tags || []).map(tag =>
                `<span class="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">${this.escapeHtml(tag)}</span>`
            ).join('');
            const url = note.url
                ? `<a href="${this.escapeHtml(note.url)}" target="_blank" rel="noopener" class="text-[10px] text-primary hover:underline truncate">${this.escapeHtml(note.url)}</a>`
                : '';
            return `<article class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 flex flex-col gap-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-baseline gap-1.5">
                            <h4 class="text-xs font-bold text-on-surface leading-snug">${this.escapeHtml(note.title)}</h4>
                            ${linkLabel ? `<span class="inline-flex rounded-full bg-secondary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">${this.escapeHtml(linkLabel)}</span>` : ''}
                        </div>
                        ${dateStr ? `<p class="mt-0.5 text-[10px] text-outline">${dateStr}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-0.5 shrink-0">
                        <button type="button" onclick="window.app.editProfileNote('${this.escapeHtml(note.id)}')" class="material-symbols-outlined notranslate text-outline text-[15px] hover:text-primary p-0.5" title="Editar">edit</button>
                        <button type="button" onclick="window.app.deleteProfileNote('${this.escapeHtml(note.id)}')" class="material-symbols-outlined notranslate text-outline text-[15px] hover:text-error p-0.5" title="Excluir">delete</button>
                    </div>
                </div>
                ${note.body ? `<p class="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line line-clamp-2">${this.escapeHtml(note.body)}</p>` : ''}
                ${url}
                ${tags ? `<div class="flex flex-wrap gap-1">${tags}</div>` : ''}
            </article>`;
        };

        // When searching: flat grid. Otherwise: month groups.
        if (query) {
            container.innerHTML = `<div class="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">${allNotes.map(renderCard).join('')}</div>`;
            return;
        }

        // Group by YYYY-MM (sorted descending by createdAt)
        const sorted = [...allNotes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const byMonth = {};
        sorted.forEach(note => {
            const ym = note.createdAt ? note.createdAt.slice(0, 7) : 'sem-data';
            if (!byMonth[ym]) byMonth[ym] = [];
            byMonth[ym].push(note);
        });
        const currentYm = new Date().toISOString().slice(0, 7);
        const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

        const monthSections = monthKeys.map(ym => {
            const isCurrentMonth = ym === currentYm;
            const safeYm = ym.replace('-', '');
            const label = ym === 'sem-data' ? 'Sem data' : new Date(ym + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const cards = byMonth[ym].map(renderCard).join('');
            return `<div class="col-span-full rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden">
                <button type="button" onclick="window.app.toggleNotesMonth('${safeYm}')"
                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container-high transition-colors text-left">
                    <span class="text-sm font-bold text-on-surface capitalize">${label}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-outline">${byMonth[ym].length} nota${byMonth[ym].length > 1 ? 's' : ''}</span>
                        <span class="material-symbols-outlined notranslate text-outline text-[18px] notes-month-chev-${safeYm} transition-transform ${isCurrentMonth ? 'rotate-180' : ''}">expand_more</span>
                    </div>
                </button>
                <div id="notes-month-${safeYm}" class="${isCurrentMonth ? '' : 'hidden'} px-3 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">${cards}</div>
            </div>`;
        }).join('');

        container.innerHTML = monthSections;
    },

renderDailyCheckinPanel: function() {
        const root = document.getElementById('daily-checkin-panel');
        if (!root) return;
        this.ensureDailyCheckinState();
        const todayEntry = this.getTodayCheckin();
        const defaults = todayEntry || { sleepHours: '', sleepQuality: 3, energy: window.sistemaVidaState.energy || 3, mood: 3, stress: 3, emotion: '' };
        const sleepEl = document.getElementById('daily-checkin-sleep-hours');
        if (sleepEl) sleepEl.value = defaults.sleepHours || '';
        const sleepRangeEl = document.getElementById('daily-checkin-sleep-quality');
        if (sleepRangeEl) {
            sleepRangeEl.value = String(Number(defaults.sleepQuality || 3));
            if (!sleepRangeEl.dataset.guidanceBound) {
                sleepRangeEl.addEventListener('input', () => this.renderDailyCheckinGuidance());
                sleepRangeEl.dataset.guidanceBound = '1';
            }
        }
        ['daily-checkin-sleep-quality', 'daily-checkin-energy', 'daily-checkin-mood', 'daily-checkin-stress'].forEach(id => {
            const key = id.replace('daily-checkin-', '').replace('-', '');
            const fieldMap = { 'sleepquality': 'sleepQuality', 'energy': 'energy', 'mood': 'mood', 'stress': 'stress' };
            const field = fieldMap[key] || key;
            const val = Number(defaults[field] || 3);
            this.setCheckinVal(id, val, null);
        });
        const emotionVal = defaults.emotion || '';
        const emotionHidden = document.getElementById('daily-checkin-emotion');
        if (emotionHidden) emotionHidden.value = emotionVal;
        const todayLog = (window.sistemaVidaState.dailyLogs || {})[this.getLocalDateKey()] || {};
        const focoInput = document.getElementById('diario-foco');
        if (focoInput) focoInput.value = (todayLog.focus || defaults.intention || '').trim();

        const expanded = this.isDailyCheckinExpanded(todayEntry);
        const formContent = document.getElementById('daily-checkin-form-content');
        const summaryWrap = document.getElementById('daily-checkin-summary');
        const summaryText = document.getElementById('daily-checkin-summary-text');
        const emotionSection = document.getElementById('daily-checkin-emotion-section');
        const historySection = document.getElementById('daily-checkin-history-section');
        const intentionSection = document.getElementById('daily-checkin-intention-section');
        const saveBtn = document.getElementById('daily-checkin-save-btn');
        if (formContent) formContent.classList.toggle('hidden', !!todayEntry && !expanded);
        if (summaryWrap) summaryWrap.classList.toggle('hidden', !todayEntry || expanded);
        if (summaryText) summaryText.innerHTML = this.renderDailyCheckinSummaryCard(todayEntry);
        if (emotionSection) emotionSection.classList.toggle('hidden', !!todayEntry && !expanded);
        if (historySection) historySection.classList.toggle('hidden', !!todayEntry && !expanded);
        if (intentionSection) intentionSection.classList.toggle('hidden', !!todayEntry && !expanded);
        const recommendationWrap = document.getElementById('daily-checkin-recommendation');
        const recommendationText = document.getElementById('daily-checkin-recommendation-text');
        const recommendation = this.getDailyCheckinRecommendation(todayEntry);
        let recDismissed = false;
        try { recDismissed = this.localGet(this.getDailyCheckinRecommendationDismissKey()) === '1'; } catch (_) {}
        if (recommendationWrap) recommendationWrap.classList.toggle('hidden', !todayEntry || expanded || !recommendation || recDismissed);
        if (recommendationText) recommendationText.textContent = recommendation;
        if (saveBtn) {
            saveBtn.classList.toggle('hidden', !!todayEntry && !expanded);
            saveBtn.innerHTML = `<span class="material-symbols-outlined notranslate text-[15px]">check_circle</span> ${todayEntry ? 'Atualizar' : 'Salvar'}`;
        }
        document.querySelectorAll('.emotion-chip').forEach(chip => {
            const active = chip.getAttribute('data-emotion') === emotionVal;
            chip.classList.toggle('bg-primary/20', active);
            chip.classList.toggle('bg-surface-container-low', !active);
            chip.classList.toggle('border-primary', active);
            chip.classList.toggle('border-outline-variant/30', !active);
            chip.classList.toggle('text-primary', active);
            chip.classList.toggle('font-bold', active);
        });
        this._updateEmotionPreview(emotionVal);

        const empty = document.getElementById('daily-checkin-empty');
        if (empty) empty.classList.toggle('hidden', !!todayEntry);
        const history = document.getElementById('daily-checkin-history');
        if (history) {
            const rows = (window.sistemaVidaState.profile.dailyCheckins || []).slice(0, 7);
            history.innerHTML = rows.length ? rows.map(item => `
                <div class="grid grid-cols-5 gap-2 text-[10px] text-center rounded-lg bg-surface-container-low px-2 py-2">
                    <span class="text-left text-outline">${this.escapeHtml(item.date.slice(5))}</span>
                    <span title="Sono">${this.escapeHtml(String(item.sleepHours || '--'))}h</span>
                    <span title="Energia">E${this.escapeHtml(String(item.energy))}</span>
                    <span title="Humor">H${this.escapeHtml(String(item.mood))}</span>
                    <span title="Estresse">S${this.escapeHtml(String(item.stress))}</span>
                </div>
            `).join('') : '<p class="text-xs text-outline italic">Sem histórico ainda. O primeiro check-in já cria a linha base.</p>';
        }
        this.renderDailyCheckinGuidance();
    },

renderPatternsPanel: function() {
        const container = document.getElementById('patterns-panel');
        if (!container) return;
        const gate = this.hasEnoughData('checkin', 14);
        if (!gate.ok) {
            const pct = Math.min(100, Math.round((gate.count / gate.minDays) * 100));
            const remaining = gate.minDays - gate.count;
            container.innerHTML = `
                <div class="lg:col-span-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 space-y-5">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined notranslate text-primary text-2xl">query_stats</span>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Padroes desbloqueavel</p>
                            <h4 class="mt-1 font-headline text-xl font-bold text-on-surface">Correlacoes de bem-estar</h4>
                            <p class="mt-1.5 text-sm text-on-surface-variant leading-relaxed max-w-2xl">Quando houver ${gate.minDays} check-ins, o Painel vai cruzar sono, humor, estresse, micros e habitos — mostrando o que realmente impacta seu desempenho.</p>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-on-surface">${gate.count} de ${gate.minDays} check-ins registrados</span>
                            <span class="text-xs font-bold text-primary">${pct}%</span>
                        </div>
                        <div class="h-2.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                            <div class="h-full rounded-full bg-primary transition-all duration-500" style="width:${pct}%"></div>
                        </div>
                        <p class="text-[11px] text-outline">${remaining > 0 ? `Faltam ${remaining} dia${remaining === 1 ? '' : 's'} de check-in para desbloquear.` : 'Quase la!'}</p>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        ${[
                            { icon: 'bedtime', label: 'Sono vs Micros', desc: 'Noites bem dormidas aumentam execucao?' },
                            { icon: 'mood', label: 'Humor vs Habitos', desc: 'Dias mais alegres manteem habitos?' },
                            { icon: 'stress_management', label: 'Estresse vs Entregas', desc: 'Pressao alta reduz performance?' }
                        ].map(c => `
                        <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 opacity-50 select-none">
                            <span class="material-symbols-outlined notranslate text-outline text-xl">${c.icon}</span>
                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline mt-1.5">${c.label}</p>
                            <p class="text-[11px] text-outline/70 mt-1 leading-snug italic">${c.desc}</p>
                        </div>`).join('')}
                    </div>
                    <div class="pt-2 border-t border-outline-variant/10">
                        <button type="button" onclick="window.app.flowNavigate('hoje','daily-checkin-panel')" class="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all">
                            <span class="material-symbols-outlined notranslate text-[15px]">self_improvement</span>
                            Fazer check-in agora
                        </button>
                    </div>
                </div>`;
            return;
        }
        const rows = this.getCheckinJoinedRows(28);
        const sleepGood = this.splitAverage(rows, r => Number(r.sleepQuality) >= 4 || Number(r.sleepHours) >= 7, r => r.microRate);
        const sleepLow = this.splitAverage(rows, r => Number(r.sleepQuality) <= 2 || Number(r.sleepHours) < 6, r => r.microRate);
        const moodGood = this.splitAverage(rows, r => Number(r.mood) >= 4, r => r.habitRate);
        const moodLow = this.splitAverage(rows, r => Number(r.mood) <= 2, r => r.habitRate);
        const stressHigh = this.splitAverage(rows, r => Number(r.stress) >= 4, r => r.microRate);
        const stressLow = this.splitAverage(rows, r => Number(r.stress) <= 2, r => r.microRate);
        const fmtPct = (n) => Number.isFinite(Number(n)) ? `${Math.round(Number(n) * 100)}%` : '--';
        const deltaText = (a, b, labelA, labelB) => {
            if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return 'Ainda faltam dias em um dos grupos.';
            const delta = Math.round((Number(a) - Number(b)) * 100);
            if (Math.abs(delta) < 5) return `${labelA} e ${labelB} estao parecidos.`;
            return `${labelA} esta ${delta > 0 ? '+' : ''}${delta} pts vs ${labelB}.`;
        };
        const cards = [
            {
                icon: 'bedtime',
                title: 'Sono vs micros',
                value: `${fmtPct(sleepGood)} / ${fmtPct(sleepLow)}`,
                body: deltaText(sleepGood, sleepLow, 'Sono melhor', 'sono baixo'),
                trend: rows.map(r => r.microRate)
            },
            {
                icon: 'mood',
                title: 'Humor vs habitos',
                value: `${fmtPct(moodGood)} / ${fmtPct(moodLow)}`,
                body: deltaText(moodGood, moodLow, 'Humor alto', 'humor baixo'),
                trend: rows.map(r => r.habitRate)
            },
            {
                icon: 'stress_management',
                title: 'Estresse vs execucao',
                value: `${fmtPct(stressLow)} / ${fmtPct(stressHigh)}`,
                body: deltaText(stressLow, stressHigh, 'Estresse baixo', 'estresse alto'),
                trend: rows.map(r => Math.max(0, 1 - (Number(r.stress || 1) - 1) / 4)),
                tone: 'warn'
            }
        ];
        container.innerHTML = cards.map(card => `
            <article class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(card.title)}</p>
                        <p class="mt-2 font-headline text-2xl font-bold text-on-surface">${this.escapeHtml(card.value)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-primary">${this.escapeHtml(card.icon)}</span>
                </div>
                <div class="mt-4">${this.renderMiniTrend(card.trend, card.tone || 'primary')}</div>
                <p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(card.body)} Correlação não é causalidade.</p>
            </article>
        `).join('');
    },

renderGamificationProfile: function() {
        const panel = document.getElementById('gamification-profile-panel');
        if (!panel) return;
        const state = window.sistemaVidaState;
        const gamification = this.ensureGamificationState();
        const totalProgress = this.getOverallLevelProgress(gamification);

        const totalLevelEl = document.getElementById('gamification-total-level');
        const totalXpEl = document.getElementById('gamification-total-xp');
        const totalBarEl = document.getElementById('gamification-total-bar');
        const totalTrailEl = document.getElementById('gamification-overall-trail');
        const totalIdentity = this.getOverallLevelIdentity(totalProgress.level);
        if (totalLevelEl) totalLevelEl.textContent = `Nivel ${totalProgress.level} - ${totalIdentity.name}`;
        if (totalXpEl) totalXpEl.textContent = `${totalProgress.current}/${totalProgress.next} XP para o proximo nivel - ${gamification.totalXp} XP total`;
        if (totalBarEl) totalBarEl.style.width = `${totalProgress.pct}%`;

        if (totalTrailEl) {
            const overallEvolution = this.getOverallLevelEvolution(totalProgress.level);
            const expanded = !!this._gamificationExpandedOverallTrail;
            const nextStage = overallEvolution.currentIndex < overallEvolution.stages.length - 1
                ? overallEvolution.stages[overallEvolution.currentIndex + 1][1]
                : null;
            const stageNodes = overallEvolution.stages.map(([icon, label], idx) => `
                <div class="gamification-level-row ${idx < overallEvolution.currentIndex ? 'done' : ''} ${idx === overallEvolution.currentIndex ? 'current' : ''}">
                    <span class="gamification-level-badge">${idx + 1}</span>
                    <span class="material-symbols-outlined notranslate">${this.escapeHtml(icon)}</span>
                    <div class="gamification-level-copy">
                        <strong>${this.escapeHtml(label)}</strong>
                        <small>Nivel ${idx + 1}</small>
                    </div>
                    ${idx === overallEvolution.currentIndex ? '<span class="gamification-level-state">Atual</span>' : ''}
                </div>
            `).join('');
            totalTrailEl.innerHTML = `
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Trilha geral</p>
                            <p class="mt-1 text-sm font-bold text-on-surface">${this.escapeHtml(totalIdentity.name)}</p>
                            <p class="text-[10px] text-outline mt-0.5">${nextStage ? `Proxima etapa: ${this.escapeHtml(nextStage)}` : 'Voce esta no topo da trilha geral'}</p>
                        </div>
                        <span class="material-symbols-outlined notranslate text-primary text-xl">military_tech</span>
                    </div>
                    <button type="button"
                        onclick="window.app.toggleGamificationOverallTrail()"
                        class="mt-3 w-full flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-left hover:bg-surface-container-high transition-colors">
                        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-outline">Ver trilha geral</span>
                        <span class="material-symbols-outlined notranslate text-outline transition-transform ${expanded ? 'rotate-180' : ''}">expand_more</span>
                    </button>
                    <div class="gamification-level-list mt-3 ${expanded ? '' : 'hidden'}">${stageNodes}</div>
                </div>
            `;
        }

        const dimensionsEl = document.getElementById('gamification-dimensions');
        if (dimensionsEl) {
            const dimKeys = Object.keys(state.dimensions || {});
            dimensionsEl.innerHTML = dimKeys.map((dim) => {
                const xp = Math.max(0, Number(gamification.dimensionXp[dim]) || 0);
                const progress = this.getLevelProgress(xp);
                const identity = this.getDimensionIdentity(dim, progress.level);
                const evolution = this.getDimensionEvolution(dim, progress.level);
                const expanded = !!(this._gamificationExpandedTrails && this._gamificationExpandedTrails[dim]);
                const stageNodes = evolution.stages.map(([stageIcon, label], idx) => `
                    <div class="gamification-level-row ${idx < evolution.currentIndex ? 'done' : ''} ${idx === evolution.currentIndex ? 'current' : ''}">
                        <span class="gamification-level-badge">${idx + 1}</span>
                        <span class="material-symbols-outlined notranslate">${this.escapeHtml(stageIcon)}</span>
                        <div class="gamification-level-copy">
                            <strong>${this.escapeHtml(label)}</strong>
                            <small>Nivel ${idx + 1} - ${this.escapeHtml(String(this.getXpThresholdForLevel(idx + 1)))} XP acumulados</small>
                        </div>
                        ${idx === evolution.currentIndex ? '<span class="gamification-level-state">Atual</span>' : ''}
                    </div>
                `).join('');
                const nextCopy = identity.nextTitle
                    ? `Próximo: ${this.escapeHtml(identity.nextTitle)}`
                    : 'Você está no topo desta trilha';
                return `
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 min-w-0 gamification-dim-card" style="--evo-tone:${evolution.tone};">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-outline truncate">${this.escapeHtml(dim)}</p>
                            <p class="mt-1 text-sm font-bold text-on-surface truncate">${this.escapeHtml(identity.title)}</p>
                            <p class="text-[10px] text-outline mt-0.5">Nivel ${progress.level} - Etapa ${Math.min(identity.stageCount, Math.max(1, progress.level))} de ${identity.stageCount}</p>
                        </div>
                        <span class="material-symbols-outlined notranslate text-primary text-xl">${identity.icon}</span>
                    </div>
                    <div class="mt-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2">
                        <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">Jornada</p>
                        <p class="mt-1 text-xs text-on-surface">${nextCopy}</p>
                    </div>
                    <div class="mt-3 flex items-center justify-between text-[11px] text-outline">
                        <span>Próximo nível</span>
                        <span>${progress.current}/${progress.next} XP</span>
                    </div>
                    <div class="mt-2 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                        <div class="h-full rounded-full bg-primary" style="width:${progress.pct}%"></div>
                    </div>
                    <button type="button"
                        onclick="window.app.toggleGamificationDimensionTrail('${dim}')"
                        class="mt-3 w-full flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-left hover:bg-surface-container-high transition-colors">
                        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-outline">Ver trilha completa</span>
                        <span class="material-symbols-outlined notranslate text-outline transition-transform ${expanded ? 'rotate-180' : ''}">expand_more</span>
                    </button>
                    <div class="gamification-level-list mt-3 ${expanded ? '' : 'hidden'}">${stageNodes}</div>
                </div>`;
            }).join('');
        }

        const achievementsEl = document.getElementById('gamification-achievements');
        if (achievementsEl) {
            const achievements = (gamification.achievements || []).slice(0, 4);
            achievementsEl.innerHTML = achievements.length
                ? achievements.map((achievement) => `
                    <div class="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
                        <span class="material-symbols-outlined notranslate text-primary text-lg">${this.escapeHtml(achievement.icon || 'military_tech')}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-on-surface truncate">${this.escapeHtml(achievement.title)}</p>
                            <p class="text-[10px] text-outline">${achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString('pt-BR') : ''}</p>
                        </div>
                    </div>
                `).join('')
                : `<div class="rounded-xl bg-surface-container-low p-4 text-sm text-outline">Conclua uma micro, um hábito, um foco ou uma revisão para desbloquear conquistas.</div>`;
        }

        const rulesEl = document.getElementById('gamification-rules');
        if (rulesEl) {
            const rules = [
                { icon: 'monitor_heart', label: 'Check-in diário', xp: '+10 XP', note: 'conta uma vez por dia' },
                { icon: 'my_location', label: 'Intenção do dia', xp: '+5 XP', note: 'conta uma vez por dia' },
                { icon: 'auto_stories', label: 'Diário / gratidão', xp: '+8 XP', note: 'conta uma vez por dia' },
                { icon: 'power_settings_new', label: 'Shutdown', xp: '+8 XP', note: 'conta uma vez por dia' },
                { icon: 'edit_calendar', label: 'Planejamento semanal', xp: '+15 XP', note: 'conta uma vez por semana' },
                { icon: 'task_alt', label: 'Micro concluída', xp: '+12 XP', note: '+6 se está no plano da semana' },
                { icon: 'repeat', label: 'Hábito concluído', xp: '+2 a +8 XP', note: '2 base, 4 se for chave, com bônus por força, sombra e se-então; automáticos recebem 50%' },
                { icon: 'timer', label: 'Foco profundo', xp: '+10 a +40 XP', note: 'varia pela duração do bloco' },
                { icon: 'rate_review', label: 'Revisão semanal', xp: '+25 XP', note: 'conta uma vez por semana' }
            ];
            rulesEl.innerHTML = rules.map(rule => `
                <div class="rounded-lg bg-surface-container-lowest border border-outline-variant/10 p-3">
                    <div class="flex items-center gap-2 text-primary">
                        <span class="material-symbols-outlined notranslate text-base">${rule.icon}</span>
                        <span class="text-xs font-bold">${rule.xp}</span>
                    </div>
                    <p class="mt-2 text-xs font-bold text-on-surface">${rule.label}</p>
                    <p class="mt-1 text-[10px] text-outline leading-snug">${rule.note}</p>
                </div>
            `).join('');
        }
    },

renderTimeline: function() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        const state = window.sistemaVidaState;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ── Janela: mês anterior até dez/ano corrente (mínimo 5 meses à frente) ───
        const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const minEnd    = new Date(today.getFullYear(), today.getMonth() + 5, 0);
        const yearEnd   = new Date(today.getFullYear(), 11, 31);
        const endDate   = yearEnd > minEnd ? yearEnd : minEnd;
        const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

        // ── Cabeçalho de meses ─────────────────────────────────────
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun',
                       'Jul','Ago','Set','Out','Nov','Dez'];
        let headerHTML = '<div class="flex border-b border-outline-variant/20 bg-surface-container">';
        headerHTML += '<div class="w-48 shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline border-r border-outline-variant/20">Entidade</div>';
        headerHTML += '<div class="flex-1 relative flex">';

        // Gera célula por mês na janela
        let cursor = new Date(startDate);
        while (cursor <= endDate) {
          const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
          const widthPct = (daysInMonth / totalDays) * 100;
          headerHTML += `
            <div class="text-center text-xs font-bold uppercase tracking-widest
                        text-outline py-2 border-r border-outline-variant/10"
                 style="width:${widthPct.toFixed(2)}%">
              ${meses[cursor.getMonth()]}
            </div>`;
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
        headerHTML += '</div></div>';

        // ── Linha de "hoje" ────────────────────────────────────────
        const todayPct = Math.min(100, Math.max(0, ((today - startDate) / (endDate - startDate)) * 100));
        const todayLine = `
          <div class="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
               style="left: calc(192px + (100% - 192px) * ${(todayPct / 100).toFixed(4)}); box-shadow: 0 0 10px var(--md-sys-color-primary);"
               title="Hoje">
               <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full"></div>
          </div>`;

        // ── Filtros Globais da Aba Planos ──────────────────────────
        const currentFilter = window.app.planosFilter || 'Todas';
        const statFilterRaw = window.app.planosStatusFilter || 'all';
        const statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
        const hType = window.app.planosHierarchyType || '';
        const hId = window.app.planosHierarchyId || '';

        const filterStatus = (item) => {
            if (item.status === 'abandoned') return false;
            if (statFilter === 'active' && item.status === 'done') return false; // legado
            if (statFilter === 'pending' && (item.status === 'done' || item.status === 'in_progress')) return false;
            if (statFilter === 'in_progress' && item.status !== 'in_progress') return false;
            if (statFilter === 'done' && item.status !== 'done') return false;
            return true;
        };

        const dimColorMap = {
            'Saúde': 'border-rose-400', 'Mente': 'border-purple-400', 'Carreira': 'border-blue-400',
            'Finanças': 'border-emerald-400', 'Relacionamentos': 'border-pink-400', 'Família': 'border-orange-400',
            'Lazer': 'border-sky-400', 'Propósito': 'border-amber-400', 'Geral': 'border-stone-400'
        };

        // ── Entidades (Render) ─────────────────────────────────────
        let rowsHTML = '';
        const renderedIds = { metas: new Set(), okrs: new Set(), macros: new Set(), micros: new Set() };

        const renderRow = (entity, tipo, marginClass, parentDim) => {
            if (!entity.title || entity.title.trim() === '') return;
            if (!entity.id) return;
            if (renderedIds[tipo] && renderedIds[tipo].has(entity.id)) return;
            let fallbackDays = 7;
            if (tipo === 'okrs') fallbackDays = 92;
            else if (tipo === 'macros') fallbackDays = 31;
            else if (tipo === 'micros') fallbackDays = 7;
            else if (tipo === 'metas') fallbackDays = Math.max(180, Math.round(this.getMetaHorizonYears(entity) * 365));
            const hasPrazo = entity.prazo && entity.prazo.trim() !== '';
            const hasInicio = entity.inicioDate && entity.inicioDate.trim() !== '';
            const hasCreatedAt = entity.createdAt !== undefined && entity.createdAt !== null && String(entity.createdAt).trim() !== '';
            let createdAtDate = null;
            if (hasCreatedAt) {
                if (typeof entity.createdAt === 'number') {
                    createdAtDate = new Date(entity.createdAt);
                } else {
                    const createdRaw = String(entity.createdAt).trim();
                    createdAtDate = createdRaw.includes('T')
                        ? new Date(createdRaw)
                        : new Date(createdRaw + 'T00:00:00');
                }
            }
            const hasValidCreatedAt = !!(createdAtDate && !Number.isNaN(createdAtDate.getTime()));

            let taskStart = hasInicio ? new Date(entity.inicioDate + 'T00:00:00') : null;
            let taskEnd = hasPrazo ? new Date(entity.prazo + 'T00:00:00') : null;

            if (!taskStart && taskEnd) {
                if (hasValidCreatedAt) {
                    taskStart = new Date(createdAtDate.getTime());
                } else {
                    taskStart = new Date(taskEnd.getTime());
                    taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
                }
            } else if (taskStart && !taskEnd) {
                taskEnd = new Date(taskStart.getTime());
                taskEnd.setDate(taskEnd.getDate() + (fallbackDays - 1));
            } else if (!taskStart && !taskEnd) {
                if (hasValidCreatedAt) {
                    taskStart = new Date(createdAtDate.getTime());
                    taskEnd = new Date(createdAtDate.getTime());
                    taskEnd.setDate(taskEnd.getDate() + (fallbackDays - 1));
                } else {
                    taskEnd = new Date(today);
                    taskStart = new Date(today);
                    taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
                }
            }

            if (isNaN(taskStart.getTime())) taskStart = new Date(today);
            if (isNaN(taskEnd.getTime())) taskEnd = new Date(today);
            if (taskEnd < taskStart) {
                const swap = taskStart;
                taskStart = taskEnd;
                taskEnd = swap;
            }

            const isOutsideWindow = taskEnd < startDate || taskStart > endDate;
            if (isOutsideWindow) {
                // Metas ainda devem aparecer como contexto da hierarquia,
                // mesmo quando o prazo está fora da janela de 6 meses.
                if (tipo !== 'metas') return;
                if (taskStart > endDate) {
                    taskStart = new Date(endDate);
                    taskEnd = new Date(endDate);
                } else if (taskEnd < startDate) {
                    taskStart = new Date(startDate);
                    taskEnd = new Date(startDate);
                }
            }
            
            // Clamping para a janela de visualização
            const visualStart = new Date(Math.max(taskStart, startDate));
            const visualEnd = new Date(Math.min(taskEnd, endDate));

            const totalWindowTime = endDate - startDate;
            const leftPct = ((visualStart - startDate) / totalWindowTime) * 100;
            const oneDayMs = 1000 * 60 * 60 * 24;
            const widthPct = (((visualEnd - visualStart) + oneDayMs) / totalWindowTime) * 100;

            const labelMap = { metas: 'Meta', okrs: 'OKR', macros: 'Macro', micros: 'Micro' };

            const progress = entity.progress || (entity.status === 'done' ? 100 : 0);
            const isOverdue = taskEnd < today && entity.status !== 'done';
            const isMicro = tipo === 'micros';

            let barBg;
            if (entity.status === 'done') {
                barBg = 'bg-emerald-500';
            } else if (isOverdue) {
                barBg = 'bg-error/80';
            } else if (entity.status === 'in_progress') {
                barBg = 'bg-amber-500';
            } else {
                barBg = isMicro ? 'bg-outline/30' : 'bg-outline/40';
            }
            const barStyles = barBg;
            const txtColor = (entity.status === 'done' || entity.status === 'in_progress' || isOverdue)
                ? 'text-white'
                : 'text-on-surface-variant';

            const dimValue = entity.dimension || entity.dimensionName || parentDim || 'Geral';
            const borderColor = dimColorMap[dimValue] || 'border-outline-variant/40';

            const barHeight = isMicro ? 'h-4' : 'h-6';
            const minWidthPctByType = { metas: 6, okrs: 5, macros: 4, micros: 3 };
            const visualWidth = Math.min(100, Math.max(widthPct, minWidthPctByType[tipo] || 3));
            const maxLeftForWidth = Math.max(0, 100 - visualWidth);
            const visualLeft = Math.min(Math.max(0, leftPct), maxLeftForWidth);
            const showInlineTitle = visualWidth >= 8;
            if (renderedIds[tipo]) renderedIds[tipo].add(entity.id);
            
            rowsHTML += `
              <div class="flex items-center border-b border-outline-variant/10 hover:bg-surface-container-high transition-colors group even:bg-surface-container-low/30">
                <div class="w-48 shrink-0 px-4 py-3 border-r border-outline-variant/20 flex flex-col justify-center overflow-hidden">
                  <div class="${marginClass} ${borderColor} flex items-center gap-1 group-hover:opacity-100 opacity-90 transition-opacity">
                      <span class="text-[9px] font-bold uppercase tracking-widest text-outline shrink-0 group-hover:text-primary transition-colors">${labelMap[tipo]}</span>
                      <button onclick="event.stopPropagation(); window.app.openTimelineEntity('${entity.id}', '${tipo}')" class="text-xs text-on-surface leading-tight truncate font-medium group-hover:text-primary transition-colors text-left hover:underline" title="Abrir em Planos">${entity.title}</button>
                  </div>
                </div>
                <!-- Área do Gráfico de Gantt -->
                <div class="flex-1 relative h-12 py-3 flex items-center cursor-default group/bar">
                  <div class="absolute ${barHeight} rounded-lg overflow-hidden shadow-sm transition-all group-hover:shadow-md ${barStyles} ${txtColor}"
                       style="left:${visualLeft.toFixed(2)}%; width:${visualWidth.toFixed(2)}%" title="${entity.title} | Progresso: ${progress}%">
                    <!-- Fundo de progresso Real -->
                    <div class="absolute top-0 bottom-0 left-0 bg-black/20 dark:bg-white/10" style="width: ${progress}%"></div>
                    <div class="absolute inset-0 flex items-center px-2">
                        <span class="text-[10px] font-bold truncate leading-none z-10 drop-shadow-sm whitespace-nowrap block ${showInlineTitle ? 'w-full text-center' : 'w-0 h-0 overflow-hidden'}">${showInlineTitle ? entity.title : ''}</span>
                    </div>
                  </div>
                </div>
              </div>`;
        };

        const processMicros = (macroId, dim) => {
            const micros = (state.entities.micros || []).filter(m => m.macroId === macroId && filterStatus(m));
            micros.forEach(micro => renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim));
        };
        const processMacros = (okrId, dim) => {
            const macros = (state.entities.macros || []).filter(m => m.okrId === okrId && filterStatus(m));
            macros.forEach(macro => {
                renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                processMicros(macro.id, dim);
            });
        };
        const processOkrs = (metaId, dim) => {
            const okrs = (state.entities.okrs || []).filter(o => o.metaId === metaId && filterStatus(o));
            okrs.forEach(okr => {
                renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                processMacros(okr.id, dim);
            });
        };

        const processMetaBranch = (meta, ignoreDimFilter = false) => {
            if (!meta || !filterStatus(meta)) return;
            const dim = meta.dimensionName || meta.dimension || 'Geral';
            if (!ignoreDimFilter && currentFilter !== 'Todas' && dim !== currentFilter) return;

            renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
            processOkrs(meta.id, dim);

            const macrosWithoutOkr = (state.entities.macros || []).filter(m => {
                if (!filterStatus(m)) return false;
                if (renderedIds.macros.has(m.id)) return false;
                if (m.metaId !== meta.id) return false;
                if (!m.okrId) return true;
                return !(state.entities.okrs || []).some(o => o.id === m.okrId);
            });
            macrosWithoutOkr.forEach(macro => {
                renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                processMicros(macro.id, dim);
            });

            const microsWithoutMacro = (state.entities.micros || []).filter(micro => {
                if (!filterStatus(micro)) return false;
                if (renderedIds.micros.has(micro.id)) return false;
                if (micro.metaId !== meta.id) return false;
                if (!micro.macroId) return true;
                return !(state.entities.macros || []).some(m => m.id === micro.macroId);
            });
            microsWithoutMacro.forEach(micro => {
                renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim);
            });
        };

        const processMetas = () => {
             const metas = (state.entities.metas || []).filter(m => filterStatus(m));
             metas.forEach(meta => processMetaBranch(meta));
        };

        // Lógica de Processamento de Árvore (Hierárquica vs. Global)
        if (hType && hId) {
            if (hType === 'metas') {
                const meta = state.entities.metas.find(m => m.id === hId);
                if (meta && filterStatus(meta)) processMetaBranch(meta, true);
            } else if (hType === 'okrs') {
                const okr = state.entities.okrs.find(o => o.id === hId);
                if (okr && filterStatus(okr)) {
                    const meta = state.entities.metas.find(m => m.id === okr.metaId);
                    const dim = okr.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    processMacros(okr.id, dim);
                }
            } else if (hType === 'macros') {
                const macro = state.entities.macros.find(m => m.id === hId);
                if (macro && filterStatus(macro)) {
                    const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                    const meta = okr ? state.entities.metas.find(m => m.id === okr.metaId) : state.entities.metas.find(m => m.id === macro.metaId);
                    const dim = macro.dimension || okr?.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    if (okr && filterStatus(okr)) renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                    processMicros(macro.id, dim);
                }
            } else if (hType === 'micros') {
                const micro = state.entities.micros.find(m => m.id === hId);
                if (micro && filterStatus(micro)) {
                    const macro = state.entities.macros.find(m => m.id === micro.macroId);
                    const okr = macro ? state.entities.okrs.find(o => o.id === macro.okrId) : state.entities.okrs.find(o => o.id === micro.okrId);
                    const meta = okr ? state.entities.metas.find(m => m.id === okr.metaId) : state.entities.metas.find(m => m.id === micro.metaId);
                    const dim = micro.dimension || macro?.dimension || okr?.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    if (okr && filterStatus(okr)) renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    if (macro && filterStatus(macro)) renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                    renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim);
                }
            }
        } else {
             processMetas();
        }

        // ── Estado vazio ───────────────────────────────────────────
        if (!rowsHTML) {
          rowsHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-outline">
              <span class="material-symbols-outlined notranslate text-4xl mb-3">
                calendar_today
              </span>
              <p class="text-sm italic">
                Nenhuma entidade correspondente ao seu filtro atual foi encontrada nesta janela de visualização.
              </p>
            </div>`;
        }

        const legendHTML = `
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 px-2 opacity-60">
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>Concluído
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>Em andamento
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-outline/40 flex-shrink-0"></span>Pendente
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-error/80 flex-shrink-0"></span>Atrasado
            </span>
          </div>`;

        container.innerHTML = `
          <div class="relative min-w-[600px]">
            ${headerHTML}
            <div class="relative pb-6">
              ${todayLine}
              ${rowsHTML}
            </div>
            ${legendHTML}
          </div>`;
    },

renderDeepWorkClockVisual: function(options = {}) {
        const {
            style = 'classic',
            timeText = '90:00',
            phaseText = 'Bloco',
            mode = 'focus',
            isRunning = false,
            isPaused = false,
            progress = 0,
            hasSelectedMicro = false,
            canCompleteSelectedMicro = false
        } = options;
        const pct = Math.max(0, Math.min(1, Number(progress) || 0));
        const pctLabel = `${Math.round(pct * 100)}%`;
        const phaseLabel = mode === 'focus' ? 'Bloco' : 'Pausa';
        const escapedTime = this.escapeHtml(timeText);
        const escapedPhase = this.escapeHtml(phaseText || phaseLabel);
        const activeMotion = isRunning && !isPaused;
        const timerHtml = `<p id="deep-work-timer" class="mt-2 text-5xl md:text-6xl lg:text-7xl leading-none font-headline italic text-primary tabular-nums">${escapedTime}</p>`;
        const phaseHtml = `<p id="deep-work-phase" class="mt-2 text-xs uppercase tracking-[0.12em] text-on-surface-variant">${escapedPhase}</p>`;

        if (style === 'ring') {
            const dash = 339;
            const offset = Math.round(dash * (1 - pct));
            const dotAngle = -90 + (pct * 360);
            const dotX = 60 + (54 * Math.cos(dotAngle * Math.PI / 180));
            const dotY = 60 + (54 * Math.sin(dotAngle * Math.PI / 180));
            const pulseClass = activeMotion ? 'deep-work-ring-pulse' : '';
            return `
                <div class="deep-work-clock-shell rounded-xl border border-primary/20 bg-surface-container-lowest px-4 py-6 md:py-7 text-center shadow-inner overflow-hidden h-full flex items-center justify-center">
                    <div class="relative mx-auto h-60 w-60 md:h-64 md:w-64 max-w-full">
                        <svg viewBox="0 0 120 120" class="h-full w-full text-primary" role="img" aria-label="Progresso do bloco ${pctLabel}">
                            <defs>
                                <linearGradient id="deep-work-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="currentColor" stop-opacity="1"></stop>
                                    <stop offset="100%" stop-color="currentColor" stop-opacity="0.62"></stop>
                                </linearGradient>
                                <radialGradient id="deep-work-ring-core" cx="50%" cy="38%" r="62%">
                                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.14"></stop>
                                    <stop offset="72%" stop-color="currentColor" stop-opacity="0.035"></stop>
                                    <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
                                </linearGradient>
                            </defs>
                            <circle cx="60" cy="60" r="57" fill="url(#deep-work-ring-core)"></circle>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--md-sys-color-surface-container-highest)" stroke-width="5" opacity="0.82"></circle>
                            <circle cx="60" cy="60" r="43" fill="none" stroke="var(--md-sys-color-outline-variant)" stroke-width="1" opacity="0.18"></circle>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="url(#deep-work-ring-gradient)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${offset}" transform="rotate(-90 60 60)" class="${pulseClass}"></circle>
                            <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="3.3" fill="currentColor" stroke="var(--md-sys-color-surface-container-lowest)" stroke-width="2"></circle>
                            <path d="M60 22 C75 38 94 46 94 66 C94 84 79 98 60 98 C41 98 26 84 26 66 C26 46 45 38 60 22Z" fill="currentColor" opacity="0.045"></path>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <p class="text-xs uppercase tracking-[0.14em] font-bold text-outline">${mode === 'break' ? 'Pausa' : 'Tempo restante'}</p>
                            ${timerHtml}
                            ${phaseHtml}
                        </div>
                    </div>
                </div>`;
        }


        return `
            <div class="deep-work-clock-shell rounded-xl border border-primary/20 bg-primary/5 px-4 py-6 md:py-7 text-center shadow-inner h-full flex flex-col justify-center">
                <p class="text-xs uppercase tracking-[0.14em] font-bold text-outline">Tempo restante</p>
                ${timerHtml}
                ${phaseHtml}
            </div>`;
    },

renderDeepWorkExecutionChecklistHTML: function(micro, options = {}) {
        const {
            containerClass = 'rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3',
            itemClassDone = 'bg-primary/8 text-primary',
            itemClassPending = 'hover:bg-surface-container-high text-on-surface',
            noteClass = 'text-[10px] text-outline',
            listClass = 'rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-2.5 space-y-1.5',
            pendingTextClass = 'text-on-surface-variant',
            doneTextClass = 'line-through text-outline'
        } = options;
        if (!micro || !Array.isArray(micro.steps) || !micro.steps.length) return '';
        const state = window.sistemaVidaState || {};
        const todayKey = this.getLocalDateKey();
        const steps = micro.steps.map(step => String(step || '').trim()).filter(Boolean);
        if (!steps.length) return '';
        const stepMap = (micro.stepLogs || {})[todayKey] || {};
        const doneCount = steps.reduce((acc, _, idx) => acc + (stepMap[idx] || stepMap[String(idx)] ? 1 : 0), 0);
        const allDone = steps.length > 0 && doneCount === steps.length;
        const linkedHabit = micro.sourceHabitId
            ? (state.habits || []).find(h => h.id === micro.sourceHabitId)
            : null;

        return `
            <div class="${containerClass}">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-[10px] uppercase tracking-widest font-bold text-outline">Checklist de execucao</p>
                        <p class="text-xs text-on-surface-variant mt-1">${linkedHabit ? `Sincronizado com o habito ${this.escapeHtml(linkedHabit.title || '')}.` : 'Use este roteiro durante a sessao de foco.'}</p>
                    </div>
                    <button type="button" onclick="window.app.toggleMicroExecutionAllSteps('${this.escapeHtml(micro.id)}','${todayKey}',${allDone ? 'true' : 'false'})" class="shrink-0 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-surface-container-high transition-colors">
                        ${allDone ? 'Reabrir passos' : 'Concluir passos'}
                    </button>
                </div>
                <div class="${listClass}">
                    ${steps.map((step, idx) => {
                        const done = !!(stepMap[idx] || stepMap[String(idx)]);
                        return `
                        <button type="button" onclick="window.app.toggleMicroExecutionStep('${this.escapeHtml(micro.id)}','${todayKey}',${idx})" class="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${done ? itemClassDone : itemClassPending}">
                            <span class="w-4 h-4 rounded-full border-2 ${done ? 'bg-primary border-primary' : 'border-outline-variant'} flex items-center justify-center shrink-0">
                                ${done ? '<span class="material-symbols-outlined notranslate text-white text-[10px]">check</span>' : ''}
                            </span>
                            <span class="text-xs leading-relaxed ${done ? doneTextClass : pendingTextClass}">${this.escapeHtml(step)}</span>
                        </button>`;
                    }).join('')}
                </div>
                <p class="${noteClass}">${doneCount}/${steps.length} passos concluidos hoje.</p>
            </div>`;
    },

renderDeepWorkImmersiveOverlay: function() {
        this.normalizeDeepWorkState();
        const overlay = document.getElementById('deep-work-immersive-overlay');
        const content = document.getElementById('deep-work-immersive-content');
        if (!overlay || !content) return;
        if (!content.dataset.dwActionsBound) {
            content.addEventListener('click', (event) => {
                const btn = event.target?.closest?.('[data-deep-work-action]');
                if (!btn) return;
                const action = String(btn.getAttribute('data-deep-work-action') || '').trim();
                if (!action) return;
                event.preventDefault();
                event.stopPropagation();
                if (action === 'pause') return window.app.toggleDeepWorkPause();
                if (action === 'reset') return window.app.resetDeepWorkSession();
                if (action === 'finish') {
                    const modeNow = String(window.sistemaVidaState?.deepWork?.mode || 'focus');
                    if (modeNow === 'break') return window.app.skipBreak();
                    return window.app.finishDeepWorkNow();
                }
            }, true);
            content.dataset.dwActionsBound = '1';
        }

        const state = window.sistemaVidaState || {};
        const dw = state.deepWork || {};
        if (!dw.isRunning) {
            overlay.classList.add('hidden');
            content.innerHTML = '';
            document.body.style.overflow = '';
            return;
        }

        const selectedMicro = dw.microId ? (state.entities?.micros || []).find(m => m.id === dw.microId) : null;
        const linkedHabit = selectedMicro?.sourceHabitId
            ? (state.habits || []).find(h => h.id === selectedMicro.sourceHabitId)
            : null;
        const clockStyle = ['classic', 'ring'].includes(state.settings?.deepWorkClockStyle)
            ? state.settings.deepWorkClockStyle
            : 'ring';
        const progressTotal = Math.max(1, dw.mode === 'focus' ? Number(dw.targetSec || 5400) : Number(dw.breakSec || 1200));
        const progress = Math.max(0, Math.min(1, 1 - (Number(dw.remainingSec || 0) / progressTotal)));
        const helperText = dw.mode === 'break'
            ? 'Pausa ativa para recuperar energia antes do proximo bloco.'
            : `Base ${Math.round(Number(state.baseCapacityMinutes) || 0)} min · Sem ajuste adicional do check-in.`;
        const checklistHtml = dw.mode === 'focus' && selectedMicro
            ? this.renderDeepWorkExecutionChecklistHTML(selectedMicro, {
                containerClass: 'rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)]',
                itemClassDone: 'bg-primary/12 text-teal-50',
                itemClassPending: 'hover:bg-white/8 text-white',
                noteClass: 'text-[10px] text-white/55',
                listClass: 'rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-1.5',
                pendingTextClass: 'text-white/80',
                doneTextClass: 'line-through text-white/45'
            })
            : '';

        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        content.innerHTML = `
            <div class="min-h-screen px-4 py-6 md:px-8 md:py-8 text-white">
                <div class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <h2 class="text-2xl md:text-4xl font-headline italic font-bold text-white">${dw.mode === 'break' ? 'Pausa em andamento' : 'Foco em andamento'}</h2>
                            ${helperText ? `<p class="mt-2 max-w-2xl text-sm md:text-base text-white/68">${this.escapeHtml(helperText)}</p>` : ''}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(360px,0.78fr)]">
                        <section class="rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.045)] p-5 md:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm">
                            <div class="grid h-full grid-cols-1 gap-5 lg:grid-cols-[minmax(360px,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
                                <div class="min-w-0">
                                    ${this.renderDeepWorkClockVisual({
                                        style: clockStyle,
                                        timeText: this.formatClock(dw.remainingSec),
                                        phaseText: dw.mode === 'break' ? (dw.isPaused ? 'Pausa em espera' : 'Pausa ativa') : (dw.isPaused ? 'Foco pausado' : 'Foco profundo'),
                                        mode: dw.mode,
                                        isRunning: dw.isRunning,
                                        isPaused: dw.isPaused,
                                        progress,
                                        hasSelectedMicro: !!selectedMicro,
                                        canCompleteSelectedMicro: !!(selectedMicro && selectedMicro.status !== 'done')
                                    })}
                                </div>
                                <div class="min-w-0 h-full flex flex-col justify-between gap-4">
                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-white/60">Micro ativa</p>
                                            <p class="mt-1 text-base font-semibold text-white">${this.escapeHtml(selectedMicro?.title || 'Sem micro ativa')}</p>
                                        </div>
                                        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-white/60">Habito origem</p>
                                            <p class="mt-1 text-base font-semibold text-white">${this.escapeHtml(linkedHabit?.title || 'Sessao livre')}</p>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-white/60">Meta do bloco</p>
                                            <p class="mt-1 text-base font-semibold text-white">${Math.max(5, Math.round(Number(dw.targetSec || 5400) / 60))} min</p>
                                        </div>
                                        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-white/60">Modo atual</p>
                                            <p class="mt-1 text-base font-semibold text-white">${dw.mode === 'break' ? 'Pausa' : 'Foco'}</p>
                                        </div>
                                    </div>
                                    <div class="rounded-xl border border-white/10 bg-white/5 p-1">
                                        <div class="grid grid-cols-3 gap-1.5">
                                        <button type="button" data-deep-work-action="pause" class="rounded-lg border border-white/12 bg-white/10 px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/14 transition-colors">
                                            ${dw.isPaused ? 'Retomar' : 'Pausar'}
                                        </button>
                                        <button type="button" data-deep-work-action="reset" class="rounded-lg border border-white/12 bg-white/5 px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/90 hover:bg-white/10 transition-colors">
                                            Reiniciar
                                        </button>
                                        <button type="button" data-deep-work-action="finish" class="rounded-lg bg-primary px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-on-primary shadow-lg shadow-primary/25 hover:opacity-95 transition-all">
                                            ${dw.mode === 'break' ? 'Encerrar pausa' : 'Finalizar sessao'}
                                        </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside class="space-y-4">
                            ${checklistHtml || `<div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">${dw.mode === 'break' ? 'A pausa fica em tela cheia ate o encerramento para manter a recuperacao no mesmo fluxo.' : 'Selecione uma micro com passos para acompanhar o roteiro completo aqui.'}</div>`}
                        </aside>
                    </div>
                </div>
            </div>`;

    },

renderDeepWorkPanel: function() {
        this.normalizeDeepWorkState();
        this.ensureSettingsState();
        this.stopDeepWorkClockPreview?.();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;

        const statusEl = document.getElementById('deep-work-status');
        const stepEl = document.getElementById('deep-work-step');
        const timerEl = document.getElementById('deep-work-timer');
        const phaseEl = document.getElementById('deep-work-phase');
        const clockVisualEl = document.getElementById('deep-work-clock-visual');
        const summaryEl = document.getElementById('deep-work-week-summary');
        const historyEl = document.getElementById('deep-work-history');
        const presetEl = document.getElementById('deep-work-preset');
        const microEl = document.getElementById('deep-work-micro');
        const intentionEl = document.getElementById('deep-work-intention');
        const startBtn = document.getElementById('deep-work-start-btn');
        const pauseBtn = document.getElementById('deep-work-pause-btn');
        const resetBtn = document.getElementById('deep-work-reset-btn');
        const finishBtn = document.getElementById('deep-work-finish-btn');
        const contextActionsEl = document.getElementById('deep-work-context-actions');
        const executionChecklistEl = document.getElementById('deep-work-execution-checklist');

        if (presetEl && !dw.isRunning) {
            const presetConfig = this.getDeepWorkPresetConfig
                ? this.getDeepWorkPresetConfig(Math.round((dw.targetSec || 1500) / 60))
                : { minutes: Math.max(5, Math.round((dw.targetSec || 1500) / 60)) };
            presetEl.value = String(presetConfig.minutes);
        }
        if (presetEl) {
            const activePreset = String(presetEl.value || '25');
            document.querySelectorAll('.deep-work-preset-chip').forEach((chip) => {
                const isActive = chip.getAttribute('data-deep-work-preset') === activePreset;
                chip.classList.toggle('bg-primary', isActive);
                chip.classList.toggle('text-on-primary', isActive);
                chip.classList.toggle('border-primary/60', isActive);
                chip.classList.toggle('shadow-sm', isActive);
                chip.classList.toggle('bg-surface-container-lowest', !isActive);
                chip.classList.toggle('text-on-surface', !isActive);
                chip.classList.toggle('border-outline-variant/25', !isActive);
            });
        }
        if (microEl) {
            const micros = this.getPlanMicros({ includeDone: false });
            let selected = dw.microId || '';
            if (selected && !micros.some(m => m.id === selected)) {
                dw.microId = '';
                selected = '';
            }
            const plannedMicros = micros.filter(m => this._isPlannedThisWeek(m.id));
            const otherMicros = micros.filter(m => !this._isPlannedThisWeek(m.id));
            const makeOption = m => {
                const ctx = this.getMicroPlanContext(m);
                const label = `${m.title} - ${ctx.parentLabel}`;
                return `<option value="${this.escapeHtml(m.id)}" ${m.id === selected ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
            };
            let dwOptionsHtml = '<option value="">Selecione uma micro</option>';
            if (plannedMicros.length > 0) {
                dwOptionsHtml += `<optgroup label="📅 Plano da Semana">${plannedMicros.map(makeOption).join('')}</optgroup>`;
            }
            if (otherMicros.length > 0) {
                dwOptionsHtml += `<optgroup label="Outros">${otherMicros.map(makeOption).join('')}</optgroup>`;
            }
            microEl.innerHTML = dwOptionsHtml;
        }
        if (intentionEl && !intentionEl.value && dw.intention) intentionEl.value = dw.intention;

        const hasSelectedMicro = !!(dw.microId || microEl?.value);
        const selectedMicro = dw.microId ? (state.entities.micros || []).find(m => m.id === dw.microId) : null;
        const canCompleteSelectedMicro = !!(selectedMicro && selectedMicro.status !== 'done');
        const hasPendingClosure = !!(dw.pendingClosure?.microId && selectedMicro && dw.pendingClosure.microId === selectedMicro.id);
        if (statusEl) {
            if (!dw.isRunning && !hasSelectedMicro) statusEl.textContent = 'Selecione uma micro acao';
            else if (hasPendingClosure) statusEl.textContent = 'Fechamento da sessao pendente';
            else if (!dw.isRunning) statusEl.textContent = 'Pronto para iniciar';
            else if (dw.isPaused) statusEl.textContent = 'Sessao pausada';
            else statusEl.textContent = dw.mode === 'focus' ? 'Bloco em andamento' : (canCompleteSelectedMicro ? 'Sessao concluida: confirme a micro' : 'Pausa de recuperacao');
        }
        if (stepEl) {
            if (!dw.isRunning && !hasSelectedMicro) stepEl.textContent = 'Passo 1: escolha a micro';
            else if (hasPendingClosure) stepEl.textContent = 'Registre a entrega e as notas da sessao';
            else if (!dw.isRunning) stepEl.textContent = 'Passo 2: inicie o bloco';
            else if (dw.isPaused) stepEl.textContent = 'Pausado: retome ou finalize';
            else stepEl.textContent = dw.mode === 'focus' ? 'Passo 3: foco em execucao' : (canCompleteSelectedMicro ? 'Passo final: conclua ou reabra a micro' : 'Pausa estruturada');
        }
        const timeText = this.formatClock(dw.remainingSec);
        const phaseText = dw.mode === 'focus' ? 'Bloco' : 'Pausa';
        const progressTotal = Math.max(1, dw.mode === 'focus' ? Number(dw.targetSec || 5400) : Number(dw.breakSec || 1200));
        const progress = Math.max(0, Math.min(1, 1 - (Number(dw.remainingSec || 0) / progressTotal)));
        const clockStyle = ['classic', 'ring'].includes(state.settings?.deepWorkClockStyle)
            ? state.settings.deepWorkClockStyle
            : 'classic';
        if (clockVisualEl) {
            clockVisualEl.outerHTML = `<div id="deep-work-clock-visual">${this.renderDeepWorkClockVisual({
                style: clockStyle,
                timeText,
                phaseText,
                mode: dw.mode,
                isRunning: dw.isRunning,
                isPaused: dw.isPaused,
                progress,
                hasSelectedMicro,
                canCompleteSelectedMicro
            })}</div>`;
        } else {
            if (timerEl) timerEl.textContent = timeText;
            if (phaseEl) phaseEl.textContent = phaseText;
        }
        document.querySelectorAll('.deep-work-clock-style-chip').forEach((chip) => {
            const isActive = chip.getAttribute('data-deep-work-clock-style') === clockStyle;
            chip.classList.toggle('bg-primary', isActive);
            chip.classList.toggle('text-on-primary', isActive);
            chip.classList.toggle('shadow-sm', isActive);
            chip.classList.toggle('text-outline', !isActive);
            chip.classList.toggle('bg-surface-container-high', !isActive);
        });

        const baseBtn = 'px-3 md:px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50';
        const primaryBtn = `${baseBtn} bg-primary text-on-primary shadow-sm`;
        const neutralBtn = `${baseBtn} bg-surface-container-high border border-outline-variant/20 text-on-surface`;
        const activeBtn = `${baseBtn} bg-primary/10 border border-primary/30 text-primary ring-2 ring-primary/20`;
        const finishBtnClass = `${baseBtn} bg-secondary-container text-on-secondary-container`;
        if (startBtn) {
            startBtn.textContent = dw.isRunning ? (dw.isPaused ? 'Em pausa' : 'Em foco') : 'Iniciar';
            startBtn.className = dw.isRunning && dw.mode === 'focus' ? activeBtn : primaryBtn;
            startBtn.disabled = dw.isRunning;
        }
        if (pauseBtn) {
            pauseBtn.textContent = dw.isPaused ? 'Retomar' : 'Pausar';
            pauseBtn.className = dw.isPaused ? activeBtn : neutralBtn;
            pauseBtn.disabled = !dw.isRunning;
        }
        if (resetBtn) {
            resetBtn.className = neutralBtn;
            resetBtn.disabled = !dw.isRunning && !hasSelectedMicro;
        }
        if (finishBtn) {
            if (dw.isRunning && dw.mode === 'focus') {
                finishBtn.textContent = 'Finalizar sessão';
                finishBtn.className = activeBtn;
                finishBtn.disabled = false;
                finishBtn.onclick = () => window.app.finishDeepWorkNow();
            } else if (dw.isRunning && dw.mode === 'break') {
                finishBtn.textContent = 'Pular descanso';
                finishBtn.className = neutralBtn;
                finishBtn.disabled = false;
                finishBtn.onclick = () => window.app.skipBreak();
            } else {
                finishBtn.textContent = 'Finalizar';
                finishBtn.className = finishBtnClass;
                finishBtn.disabled = true;
                finishBtn.onclick = () => window.app.finishDeepWorkNow();
            }
        }

        if (contextActionsEl) {
            const shouldShowQuickComplete = !!(hasSelectedMicro && canCompleteSelectedMicro && (dw.mode === 'break' || !dw.isRunning));
            const shouldShowClosure = !!(hasPendingClosure && typeof window.app.openHabitFocusClosureModal === 'function');
            contextActionsEl.classList.toggle('hidden', !(shouldShowQuickComplete || shouldShowClosure));
            if (shouldShowClosure && selectedMicro) {
                contextActionsEl.innerHTML = `
                    <div class="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3">
                        <p class="text-[11px] text-on-surface-variant leading-snug">A sessao de <span class="font-bold text-on-surface">${this.escapeHtml(selectedMicro.title)}</span> terminou. Registre a entrega antes de seguir.</p>
                        <button onclick="window.app.openHabitFocusClosureModal()" class="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-90">
                            Fechar sessao
                        </button>
                    </div>`;
            } else if (shouldShowQuickComplete && selectedMicro) {
                contextActionsEl.innerHTML = `
                    <div class="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3">
                        <p class="text-[11px] text-on-surface-variant leading-snug">Sessao finalizada para <span class="font-bold text-on-surface">${this.escapeHtml(selectedMicro.title)}</span>. Concluir agora?</p>
                        <button onclick="window.app.completeMicroAction('${selectedMicro.id}')" class="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-90">
                            Concluir
                        </button>
                    </div>`;
            } else {
                contextActionsEl.innerHTML = '';
            }
        }

        if (executionChecklistEl) {
            const checklistMicro = selectedMicro && Array.isArray(selectedMicro.steps) && selectedMicro.steps.length ? selectedMicro : null;
            if (!checklistMicro) {
                executionChecklistEl.classList.add('hidden');
                executionChecklistEl.innerHTML = '';
            } else {
                executionChecklistEl.classList.remove('hidden');
                executionChecklistEl.innerHTML = this.renderDeepWorkExecutionChecklistHTML(checklistMicro);
            }
        }

        if (summaryEl) {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(today.getDate() - today.getDay());
            const sessions = (dw.sessions || []).filter(s => {
                const dt = new Date(`${s.endedAt || ''}T00:00:00`);
                return !Number.isNaN(dt.getTime()) && dt >= weekStart;
            });
            const totalSec = sessions.reduce((sum, s) => sum + (Number(s.focusSec) || 0), 0);
            const hours = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            summaryEl.textContent = `${sessions.length} sessões, ${hours}h${String(mins).padStart(2, '0')} de foco profundo.`;
        }

        if (historyEl) {
            const rows = (dw.sessions || []).slice(0, 5);
            if (rows.length === 0) {
                historyEl.innerHTML = '<p class="text-xs text-outline italic">Nenhuma sessão registrada.</p>';
            } else {
                historyEl.innerHTML = rows.map((s) => {
                    const mins = Math.max(1, Math.round((Number(s.focusSec) || 0) / 60));
                    const micro = (state.entities.micros || []).find(m => m.id === s.microId);
                    const microLabel = micro?.title || 'Sem vínculo';
                    const ctx = micro ? this.getMicroPlanContext(micro) : null;
                    const dateLabel = this.formatDateTimeLocal(s.endedAtTs) || s.endedAt || '';
                    return `<div class="flex items-center justify-between text-xs border border-outline-variant/10 rounded-lg px-3 py-2">
                        <div class="min-w-0">
                            <p class="font-medium text-on-surface truncate">${this.escapeHtml(microLabel)}</p>
                            <p class="text-outline truncate">${this.escapeHtml(ctx ? ctx.path : dateLabel)}</p>
                            <p class="text-outline/80 truncate">${this.escapeHtml(dateLabel)}</p>
                        </div>
                        <span class="font-bold text-primary shrink-0">${mins} min</span>
                    </div>`;
                }).join('');
            }
        }

        this.ensureDeepWorkTicking();
        this.renderDeepWorkImmersiveOverlay();
    },

getTodayChecklistMode: function() {
        if (this.todayChecklistMode !== 'horario' && this.todayChecklistMode !== 'dimensao') this.todayChecklistMode = 'dimensao';
        return this.todayChecklistMode;
    },

getTodayChecklistDayPart: function() {
        const allowed = new Set(['all', 'manha', 'tarde', 'noite', 'sem_horario']);
        if (!allowed.has(this.todayChecklistDayPart)) this.todayChecklistDayPart = 'all';
        return this.todayChecklistDayPart;
    },

setTodayChecklistMode: function(mode = 'dimensao') {
        const nextMode = mode === 'horario' ? 'horario' : 'dimensao';
        this.todayChecklistMode = nextMode;
        if (nextMode !== 'horario') this.todayChecklistDayPart = 'all';
        if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
    },

setTodayChecklistDayPart: function(dayPart = 'all') {
        const allowed = new Set(['all', 'manha', 'tarde', 'noite', 'sem_horario']);
        this.todayChecklistMode = 'horario';
        this.todayChecklistDayPart = allowed.has(dayPart) ? dayPart : 'all';
        if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
    },

openDayCapacityProfileSettings: async function() {
        this.hojeScreen = 'checklist';
        await this.switchView('perfil', { preserveScroll: true });
        const reveal = () => {
            const section = document.getElementById('day-capacity-profile-section');
            if (section) {
                try { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
                section.classList.add('ring-2', 'ring-primary/20');
                setTimeout(() => section.classList.remove('ring-2', 'ring-primary/20'), 1800);
            }
        };
        setTimeout(reveal, 180);
    },

assignMicroPreferredDayPart: function(microId, dayPart = 'manha') {
        const defaults = {
            manha: '09:00',
            tarde: '14:00',
            noite: '19:00'
        };
        const nextTime = defaults[dayPart];
        if (!nextTime) return;
        const micros = window.sistemaVidaState?.entities?.micros || [];
        const micro = micros.find((item) => String(item?.id || '') === String(microId || ''));
        if (!micro) return;
        micro.startTime = nextTime;
        this.saveState(false);
        if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
        if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
        this.showToast(`Horario sugerido definido para ${nextTime}.`, 'success');
    },

renderNextBestAction: function() {
        const container = document.getElementById('next-best-action-container');
        if (!container) return;
        container.innerHTML = this._renderNextActionCard(this.getNextBestAction({ scope: 'today' }), 'today');
    },

renderTodayCapacityMap: function() {
        const container = document.getElementById('today-capacity-map');
        if (!container) return;
        const state = this.getTodayCapacityState ? this.getTodayCapacityState(this.getLocalDateKey()) : null;
        if (!state) {
            container.innerHTML = '';
            return;
        }
        const mode = this.getTodayChecklistMode ? this.getTodayChecklistMode() : 'dimensao';
        const checklistDayPart = this.getTodayChecklistDayPart ? this.getTodayChecklistDayPart() : 'all';
        const todayItems = this.getTodayActionItems ? this.getTodayActionItems(this.getLocalDateKey()) : [];
        const pendingItems = todayItems.filter((item) => !item.done);
        const checklistGroups = { manha: [], tarde: [], noite: [], sem_horario: [] };
        pendingItems.forEach((item) => {
            const key = checklistGroups[item.dayPart] ? item.dayPart : 'sem_horario';
            checklistGroups[key].push(item);
        });
        const checklistLabels = { all: 'Tudo', manha: 'Manha', tarde: 'Tarde', noite: 'Noite', sem_horario: 'Sem horario' };
        const checklistDayPartButtons = ['all', 'manha', 'tarde', 'noite', 'sem_horario'].map((key) => {
            const bucket = key === 'all' ? pendingItems : checklistGroups[key];
            const minutes = bucket.reduce((sum, item) => sum + Math.max(0, Number(item.estimatedMinutes) || 0), 0);
            const isActive = checklistDayPart === key;
            return `<button type="button" onclick="window.app.setTodayChecklistDayPart('${key}')" class="rounded-xl border px-3 py-2 text-left transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'}">
                <span class="block text-[10px] font-bold uppercase tracking-widest">${this.escapeHtml(checklistLabels[key])}</span>
                <span class="mt-1 block text-[11px] text-outline">${bucket.length} itens · ${Math.round(minutes)} min</span>
            </button>`;
        }).join('');
        const statusMap = {
            ok: { label: 'Executável', tone: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-500/10 border-emerald-500/25' },
            cheio: { label: 'No limite', tone: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-500/10 border-amber-500/25' },
            sobrecarregado: { label: 'Sobrecarregado', tone: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-500/10 border-rose-500/25' },
            a_definir: { label: 'A definir', tone: 'text-sky-700 dark:text-sky-300', badge: 'bg-sky-500/10 border-sky-500/25' }
        };
        const cfg = statusMap[state.status] || statusMap.ok;
        const usageWidth = Math.max(0, Math.min(100, Number(state.usagePct || 0)));
        const suggestions = (state.suggestions || []).slice(0, 2).map((item) =>
            `<li class="text-[11px] text-on-surface-variant">${this.escapeHtml(item)}</li>`
        ).join('');
        const activeDayPart = state.activeDayPart || 'all';
        const segmentButtons = ['all', 'manha', 'tarde', 'noite'].map((key) => {
            const segment = state.segments?.[key];
            if (!segment) return '';
            const label = key === 'all' ? 'Dia' : segment.label;
            const isActive = activeDayPart === key;
            const clickHandler = key === 'all'
                ? "window.app.setTodayChecklistMode('dimensao')"
                : `window.app.setTodayChecklistDayPart('${key}')`;
            return `<button type="button" onclick="${clickHandler}" class="rounded-xl border px-3 py-2 text-left transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'}">
                <span class="block text-[10px] font-bold uppercase tracking-widest">${this.escapeHtml(label)}</span>
                <span class="mt-1 block text-[11px] text-outline">${Math.round(Number(segment.plannedMinutes) || 0)} / ${Math.round(Number(segment.capacityMinutes) || 0)} min</span>
            </button>`;
        }).join('');
        const capacityValue = Number.isFinite(state.capacityMinutes) ? `${Math.round(state.capacityMinutes)} min` : 'A definir';
        const remainingValue = Number.isFinite(state.remainingMinutes) ? `${Math.round(state.remainingMinutes)} min` : '--';
        const adjustmentLabel = state.checkinAdjustment?.factor !== 1
            ? `Base ${Math.round(Number(state.baseCapacityMinutes) || 0)} min · ${this.escapeHtml(state.checkinAdjustment?.label || '')}`
            : '';
        container.innerHTML = `
            <div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">Mapa do dia</p>
                        <p class="mt-1 text-xs text-on-surface-variant">${this.escapeHtml(state.activeLabel || 'Dia inteiro')}</p>
                        ${adjustmentLabel ? `<p class="mt-1 text-[11px] text-outline">${adjustmentLabel}</p>` : ''}
                    </div>
                    <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.badge} ${cfg.tone}">${cfg.label}</span>
                </div>
                <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                    <p class="text-[11px] text-outline leading-snug">Nao esta batendo com seu dia real? Ajuste a base de capacidade no Perfil.</p>
                    <button type="button" onclick="window.app.openDayCapacityProfileSettings()" class="shrink-0 rounded-lg border border-primary/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors">
                        Ajustar base
                    </button>
                </div>
                <div class="mt-3 space-y-2">
                    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">Organizacao da lista</p>
                        <div class="inline-flex rounded-xl border border-outline-variant/15 bg-surface-container-low p-1">
                            <button type="button" onclick="window.app.setTodayChecklistMode('dimensao')" class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${mode === 'dimensao' ? 'bg-primary text-on-primary' : 'text-outline hover:text-primary'}">Dimensao</button>
                            <button type="button" onclick="window.app.setTodayChecklistMode('horario')" class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${mode === 'horario' ? 'bg-primary text-on-primary' : 'text-outline hover:text-primary'}">Horario</button>
                        </div>
                    </div>
                    ${mode === 'horario' ? `<div class="grid grid-cols-2 gap-2 md:grid-cols-5">${checklistDayPartButtons}</div>` : ''}
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    ${segmentButtons}
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-lg bg-surface-container-low border border-outline-variant/10 px-2.5 py-2">
                        <p class="text-[10px] uppercase tracking-widest text-outline">Capacidade</p>
                        <p class="text-sm font-bold text-on-surface">${capacityValue}</p>
                    </div>
                    <div class="rounded-lg bg-surface-container-low border border-outline-variant/10 px-2.5 py-2">
                        <p class="text-[10px] uppercase tracking-widest text-outline">Planejado</p>
                        <p class="text-sm font-bold text-on-surface">${Math.round(state.plannedMinutes)} min</p>
                    </div>
                    <div class="rounded-lg bg-surface-container-low border border-outline-variant/10 px-2.5 py-2">
                        <p class="text-[10px] uppercase tracking-widest text-outline">Saldo</p>
                        <p class="text-sm font-bold ${Number.isFinite(state.remainingMinutes) && state.remainingMinutes < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}">${remainingValue}</p>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div class="h-full rounded-full ${state.status === 'sobrecarregado' ? 'bg-rose-500' : state.status === 'cheio' ? 'bg-amber-500' : 'bg-emerald-500'}" style="width:${usageWidth}%"></div>
                    </div>
                </div>
                ${suggestions ? `<ul class="mt-3 space-y-1">${suggestions}</ul>` : ''}
            </div>`;
    },

renderTodayActionList: function() {
        const container = document.getElementById('today-action-list');
        if (!container) return;
        const items = this.getTodayActionItems ? this.getTodayActionItems(this.getLocalDateKey()) : [];
        const mode = this.getTodayChecklistMode();
        const activeDayPart = this.getTodayChecklistDayPart();
        const labels = {
            manha: 'Manha',
            tarde: 'Tarde',
            noite: 'Noite',
            sem_horario: 'Sem horário'
        };
        const pendingItems = items.filter((item) => !item.done);
        const scheduledHabits = pendingItems.filter((item) => item.sourceType === 'habit' || item.sourceType === 'routine');
        const groups = { manha: [], tarde: [], noite: [], sem_horario: [] };
        pendingItems.forEach((item) => {
            const key = groups[item.dayPart] ? item.dayPart : 'sem_horario';
            groups[key].push(item);
        });

        const partButtons = ['all', 'manha', 'tarde', 'noite', 'sem_horario'].map((key) => {
            const bucket = key === 'all' ? pendingItems : groups[key];
            const minutes = bucket.reduce((sum, item) => sum + Math.max(0, Number(item.estimatedMinutes) || 0), 0);
            const label = key === 'all' ? 'Tudo' : labels[key];
            const isActive = activeDayPart === key;
            return `<button type="button" onclick="window.app.setTodayChecklistDayPart('${key}')" class="rounded-xl border px-3 py-2 text-left transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'}">
                <span class="block text-[10px] font-bold uppercase tracking-widest">${this.escapeHtml(label)}</span>
                <span class="mt-1 block text-[11px] text-outline">${bucket.length} itens · ${Math.round(minutes)} min</span>
            </button>`;
        }).join('');

        const organizerHtml = '';

        const unscheduledMicros = groups.sem_horario.filter((item) => item.sourceType === 'micro');
        const unscheduledHtml = mode === 'horario' && unscheduledMicros.length
            ? `
                <div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm space-y-3">
                    <div>
                        <p class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">Micros sem horario</p>
                        <p class="mt-1 text-xs text-on-surface-variant">Ajuste rapido para tirar itens do bucket sem perder o card principal.</p>
                    </div>
                    <div class="space-y-2">
                        ${unscheduledMicros.map((item) => `
                            <div class="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-2.5">
                                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div class="min-w-0">
                                        <p class="text-sm font-semibold text-on-surface truncate">${this.escapeHtml(item.title)}</p>
                                        <p class="text-[11px] text-outline mt-0.5">${this.escapeHtml(item.dimension || 'Geral')} · ${Math.round(Number(item.estimatedMinutes) || 0)} min</p>
                                    </div>
                                    <div class="flex flex-wrap gap-1.5">
                                        <button type="button" onclick="window.app.assignMicroPreferredDayPart('${this.escapeHtml(item.sourceId)}','manha')" class="px-2.5 py-1 rounded-lg border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-primary hover:bg-surface-container-high transition-colors">Manha</button>
                                        <button type="button" onclick="window.app.assignMicroPreferredDayPart('${this.escapeHtml(item.sourceId)}','tarde')" class="px-2.5 py-1 rounded-lg border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-primary hover:bg-surface-container-high transition-colors">Tarde</button>
                                        <button type="button" onclick="window.app.assignMicroPreferredDayPart('${this.escapeHtml(item.sourceId)}','noite')" class="px-2.5 py-1 rounded-lg border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-primary hover:bg-surface-container-high transition-colors">Noite</button>
                                    </div>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>`
            : '';

        const habitsHtml = scheduledHabits.length
            ? `
                <div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm space-y-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">Habitos de hoje</p>
                            <p class="mt-1 text-xs text-on-surface-variant">${scheduledHabits.length} previstos para execucao no dia.</p>
                        </div>
                        <button type="button" onclick="window.app.switchHojeScreen('habitos')" class="rounded-lg border border-outline-variant/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-primary hover:bg-surface-container-low transition-colors">Ver todos</button>
                    </div>
                    <div class="space-y-2">
                        ${scheduledHabits.map((item) => {
                            const habitObj = (window.sistemaVidaState?.habits || []).find((habit) => habit.id === item.sourceId);
                            const focusBtn = (habitObj && this.canStartFocusFromHabit?.(habitObj))
                                ? `<button type="button" onclick="window.app.openHabitFocusModal('${this.escapeHtml(item.sourceId)}')" class="px-2.5 py-1 rounded-lg border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors">Foco</button>`
                                : '';
                            const typeLabel = item.sourceType === 'routine' ? 'Rotina' : 'Habito';
                            return `
                                <div class="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-2.5">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <p class="text-[10px] uppercase tracking-widest text-outline">${typeLabel}${item.startTime ? ` · ${this.escapeHtml(item.startTime)}` : ''}</p>
                                            <p class="text-sm font-semibold text-on-surface truncate">${this.escapeHtml(item.title)}</p>
                                            <p class="text-[11px] text-outline mt-0.5">${this.escapeHtml(item.dimension || 'Geral')} · ${Math.round(Number(item.estimatedMinutes) || 0)} min ${item.progressLabel ? `· ${this.escapeHtml(item.progressLabel)}` : ''}</p>
                                        </div>
                                        <div class="flex flex-wrap justify-end gap-1.5 shrink-0">
                                            <button type="button" onclick="window.app.openHabitToday('${this.escapeHtml(item.sourceId)}')" class="px-2.5 py-1 rounded-lg border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors">Registrar</button>
                                            ${focusBtn}
                                        </div>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`
            : (!items.length
                ? '<div class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 text-xs text-outline italic">Sem acoes previstas para hoje.</div>'
                : '');

        container.innerHTML = `${organizerHtml}${unscheduledHtml}${habitsHtml}`;
    },

render: {
        onboarding: function() {
            app.onboardingHydrateFields();
            // Se já tem conta autenticada (login persistido), pular Step 0 (boas-vindas)
            // e Step 1 (criar/entrar conta) — evita loop em quem já fez login mas
            // ainda não completou as etapas de Roda da Vida / Valores / Propósito.
            const isAccount = app.isRealAccount();
            const startStep = app.isForceOnboardingAfterReset?.() ? 0 : (isAccount ? 2 : 0);
            app.onboardingGoTo(startStep);
        },
        painel: function() {
            const state = window.sistemaVidaState;
            app.syncDeepWorkMicroStatus();
            const filter = app.painelFilter || 'semana';

            // ---------------------------------------------------------
            // CÁLCULO DE FOCO E EXECUÇÃO
            // ---------------------------------------------------------
            let micros = state.entities.micros || [];
            let macros = state.entities.macros || [];
            
            // Filtro Temporal
            if (filter === 'semana') {
                const weekKey = app._getWeekKey();
                const weekPlan = (state.weekPlans || {})[weekKey];
                const plannedIds = (weekPlan && weekPlan.selectedMicros) || [];
                if (plannedIds.length > 0) {
                    micros = micros.filter(m => plannedIds.includes(m.id));
                    const macroIds = new Set(micros.map(m => m.macroId).filter(Boolean));
                    macros = macros.filter(m => macroIds.has(m.id));
                } else {
                    micros = micros.filter(m => app.isDateInCurrentWeek(m.prazo));
                    macros = macros.filter(m => app.isDateInCurrentWeek(m.prazo));
                }
            } else if (filter === 'mes') {
                micros = micros.filter(m => app.isDateInCurrentMonth(m.prazo));
                macros = macros.filter(m => app.isDateInCurrentMonth(m.prazo));
            }
            
            // Execução: % de Micro Ações Concluídas
            const totalMicros = micros.length;
            const doneMicros = micros.filter(m => m.status === 'done').length;
            const execScore = totalMicros === 0 ? 0 : Math.round((doneMicros / totalMicros) * 100);
            
            // Foco: % de Macro Ações Concluídas (Visão Tática)
            const totalMacros = macros.length;
            const doneMacros = macros.filter(m => m.status === 'done').length;
            const focoScore = totalMacros === 0 ? 0 : Math.round((doneMacros / totalMacros) * 100);

            // Atualiza a UI do Painel
            const focoVal = document.getElementById('painel-foco-val');
            const focoBar = document.getElementById('painel-foco-bar');
            const execVal = document.getElementById('painel-exec-val');
            const execBar = document.getElementById('painel-exec-bar');
            const concluidasVal = document.getElementById('painel-concluidas-val');
            const atrasadasVal = document.getElementById('painel-atrasadas-val');

            if (focoVal) focoVal.textContent = focoScore + '%';
            if (focoBar) focoBar.style.width = focoScore + '%';
            if (execVal) execVal.textContent = execScore + '%';
            if (execBar) execBar.style.width = execScore + '%';
            if (concluidasVal) concluidasVal.textContent = doneMicros;
            
            if (atrasadasVal) {
                const todayStr = new Date().toISOString().split('T')[0];
                const delayedMicros = micros.filter(m => m.status !== 'done' && m.prazo && m.prazo < todayStr).length;
                atrasadasVal.textContent = delayedMicros;
            }
            app.renderWeeklyHealthScore({ execScore, plannedCount: totalMicros, doneCount: doneMicros });
            // ---------------------------------------------------------
            
            // Fix Filter Buttons Highlight
            document.querySelectorAll('[data-painel-filter]').forEach(btn => {
                const btnType = btn.getAttribute('data-painel-filter');
                const isSelected = btnType === filter;
                btn.className = isSelected ?
                    'px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider transition-all shadow-sm' :
                    'px-4 py-2 rounded-lg text-outline text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all';
            });

            // Cycle Progress Logic
            const cycleStart = new Date((state.cycleStartDate || app.getLocalDateKey()) + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const elapsedCycleDays = Math.max(0, Math.min(84, Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)) + 1));
            const diffWeeks = Math.max(1, Math.min(12, Math.ceil(elapsedCycleDays / 7) || 1));
            const cyclePercent = Math.min(100, Math.round((elapsedCycleDays / 84) * 100)); // 12 weeks = 84 days

            const cycleBar = document.getElementById('cycle-progress-bar');
            const cycleVal = document.getElementById('cycle-percent-val');
            const cycleWeekText = document.getElementById('cycle-week-text');

            if (cycleBar) cycleBar.style.width = cyclePercent + '%';
            if (cycleVal) cycleVal.textContent = cyclePercent + '%';
            if (cycleWeekText) cycleWeekText.textContent = `Semana ${diffWeeks} de 12 - ${elapsedCycleDays}/84 dias`;

            // Dynamic OKR Rendering
            const okrList = document.getElementById('painel-okr-list');
            if (okrList) {
                const activeOkrs = (state.entities.okrs || []).filter(o => o.status !== 'done' && o.status !== 'abandoned').slice(0, 3);
                if (activeOkrs.length === 0) {
                    okrList.innerHTML = '<p class="text-xs text-outline italic">Nenhum objetivo ativo. Defina um novo OKR para começar.</p>';
                } else {
                    okrList.innerHTML = activeOkrs.map(okr => `
                        <div class="flex items-start gap-3">
                            <div class="mt-1 w-2 h-2 rounded-full bg-primary shrink-0"></div>
                            <div class="text-sm text-on-surface leading-relaxed">${okr.title}</div>
                        </div>
                    `).join('');
                }
            }

            // Dimension Scores Rendering
            document.querySelectorAll('[data-dimension]').forEach(card => {
                const dim = card.getAttribute('data-dimension');
                const score = state.dimensions[dim]?.score || 0;
                const text = card.querySelector('.dim-score-text');
                const ring = card.querySelector('.dim-score-ring');
                
                if (text) text.textContent = score + '%';
                if (ring) {
                    const offset = 88 - (88 * (score / 100));
                    ring.style.strokeDashoffset = offset;
                }
            });

            // 1. Ativa o Gráfico de Execução (Heatmap)
            this.renderAnnualHeatmap();

            // 2. Calcula e Renderiza a Distribuição de Foco
            this.renderFocusDistribution('focus-distribution');

            app.renderPainelDiagnostics();
            app.renderPainelDecision();
            app.renderPersonalEvolutionPanel();
            app.renderHabitMaturityPanel();
            app.renderWellbeingTrendsPanel();
            app.renderCadenceHistoryPanel();
            app.renderLoadRecoveryPanel();
            app.renderPatternsPanel();
            app.renderTimelineHistory();
        },
        renderFocusDistribution: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const state = window.sistemaVidaState;
            const dimKeys = ['Saude', 'Mente', 'Carreira', 'Financas', 'Relacionamentos', 'Familia', 'Lazer', 'Proposito'];
            const dimLabels = {
                Saude: 'Saude',
                Mente: 'Mente',
                Carreira: 'Carreira',
                Financas: 'Financas',
                Relacionamentos: 'Relacionamentos',
                Familia: 'Familia',
                Lazer: 'Lazer',
                Proposito: 'Proposito'
            };
            const typeMap = { Macro: 'Macros', Micro: 'Micros' };
            const typeFilter = typeMap[app.focusTypeFilter] || app.focusTypeFilter || 'Tudo';
            app.focusStatusFilter = 'Tudo';
            const statusFilter = 'Tudo';

            const normalizeText = (value) => String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const normalizeDim = (dimRaw) => {
                const low = normalizeText(dimRaw || 'Geral');
                if (low.includes('sa')) return 'Saude';
                if (low.includes('ment')) return 'Mente';
                if (low.includes('carr')) return 'Carreira';
                if (low.includes('fin')) return 'Financas';
                if (low.includes('relac')) return 'Relacionamentos';
                if (low.includes('fam')) return 'Familia';
                if (low.includes('laz')) return 'Lazer';
                if (low.includes('prop')) return 'Proposito';
                return 'Geral';
            };

            const statusFilterNorm = normalizeText(statusFilter);
            const matchesStatusFilter = (item) => {
                const isDone = item.status === 'done' || item.completed === true;
                const isInProgress = item.status === 'in_progress';
                if (statusFilterNorm === 'pendentes') return !isDone && !isInProgress;
                if (statusFilterNorm === 'em andamento' || statusFilterNorm === 'em_andamento') return isInProgress;
                if (statusFilterNorm.includes('conclu')) return isDone;
                return true;
            };

            const stats = {};
            dimKeys.forEach(d => {
                stats[d] = { focusEffort: 0, focusItems: 0, total: 0, done: 0, inProgress: 0, pending: 0 };
            });

            document.querySelectorAll('[data-focus-type]').forEach(btn => {
                const raw = btn.getAttribute('data-focus-type');
                const t = typeMap[raw] || raw;
                btn.className = t === typeFilter
                    ? "px-2 py-2 rounded-lg bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    : "px-2 py-2 rounded-lg text-outline text-[9px] font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all";
            });

            document.querySelectorAll('[data-focus-status]').forEach(btn => {
                const s = btn.getAttribute('data-focus-status');
                btn.className = s === statusFilter
                    ? "px-2 py-2 rounded-lg bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    : "px-2 py-2 rounded-lg text-outline text-[9px] font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all";
            });

            const lists = [
                { typeName: 'Metas', list: state.entities.metas, weight: 6 },
                { typeName: 'OKRs', list: state.entities.okrs, weight: 4 },
                { typeName: 'Macros', list: state.entities.macros, weight: 2 },
                { typeName: 'Micros', list: state.entities.micros, weight: 1 }
            ];

            lists.forEach(({ typeName, list, weight }) => {
                if (typeFilter !== 'Tudo' && typeFilter !== typeName) return;
                (list || []).forEach(item => {
                    if (!matchesStatusFilter(item)) return;
                    const dim = normalizeDim(item.dimension || 'Geral');
                    if (!stats[dim]) return;
                    const isDone = item.status === 'done' || item.completed === true;
                    const isInProgress = item.status === 'in_progress';
                    stats[dim].total += 1;
                    if (isDone) stats[dim].done += 1;
                    else if (isInProgress) stats[dim].inProgress += 1;
                    else stats[dim].pending += 1;
                    stats[dim].focusEffort += weight;
                    stats[dim].focusItems += 1;
                });
            });

            const totalFocusEffort = dimKeys.reduce((sum, d) => sum + stats[d].focusEffort, 0);

            const renderOneLine = (dim) => {
                const s = stats[dim];
                const focusPct = totalFocusEffort > 0 ? Math.round((s.focusEffort / totalFocusEffort) * 100) : 0;
                const donePct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                const inProgressPct = s.total > 0 ? Math.round((s.inProgress / s.total) * 100) : 0;
                const pendingPct = s.total > 0 ? Math.max(0, 100 - donePct - inProgressPct) : 0;
                return `
                <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3 min-w-0">
                    <div class="grid grid-cols-1 sm:grid-cols-[128px_minmax(0,1fr)] gap-2 mb-2 min-w-0">
                        <span class="text-[10px] uppercase tracking-widest font-bold text-outline leading-tight break-words">${dimLabels[dim]}</span>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1 min-w-0">
                            <span class="rounded-md bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary whitespace-nowrap">Foco ${focusPct}% (${s.focusItems})</span>
                            <span class="rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap">C ${donePct}%</span>
                            <span class="rounded-md bg-amber-500/10 px-2 py-1 text-[9px] text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap">A ${inProgressPct}%</span>
                            <span class="rounded-md bg-surface-container-high px-2 py-1 text-[9px] text-outline font-semibold whitespace-nowrap">P ${pendingPct}%</span>
                        </div>
                    </div>
                    <div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full transition-all duration-700 flex" style="width:${focusPct}%">
                            <div class="h-full bg-emerald-500" style="width:${donePct}%"></div>
                            <div class="h-full bg-amber-500" style="width:${inProgressPct}%"></div>
                            <div class="h-full bg-slate-300 dark:bg-slate-600" style="width:${pendingPct}%"></div>
                        </div>
                    </div>
                </div>`;
            };

            container.innerHTML = dimKeys.map(dim => renderOneLine(dim)).join('');
        },

        foco: function() {
            const state = window.sistemaVidaState;
            app.normalizeDeepWorkState();
            app.syncDeepWorkMicroStatus();
            app.renderSidebarValues();

            app.renderDeepWorkPanel();

            // Micros Management List
            const listContainer = document.getElementById('micros-management-list');
            if (listContainer) {
                app.syncFocoPlannedFilterOption();
                const dimFilter = document.getElementById('todo-dimension-filter')?.value || 'Tudo';
                const statusFilter = document.getElementById('todo-status-filter')?.value || 'all';

                let filtered = app.getPlanMicros({ includeDone: true }).filter(m => {
                    const matchDim = dimFilter === 'Tudo' || m.dimension === dimFilter;
                    const matchStatus = statusFilter === 'all' ||
                                       (statusFilter === 'active' && m.status !== 'done') || // legado
                                       (statusFilter === 'pending' && m.status !== 'done' && m.status !== 'in_progress') ||
                                       (statusFilter === 'in_progress' && m.status === 'in_progress') ||
                                       (statusFilter === 'done' && m.status === 'done') ||
                                       (statusFilter === 'planned' && app._isPlannedThisWeek(m.id));
                    return matchDim && matchStatus;
                });

                // Ordenar por prazo
                filtered.sort((a,b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));

                listContainer.innerHTML = filtered.map((m, idx) => {
                    const ctx = app.getMicroPlanContext(m);
                    const focusText = app.formatDurationHuman(m.focusSec || 0);
                    const sessionCount = Number(m.focusSessions || 0);
                    const statusText = m.status === 'done' ? 'Concluída' : (m.status === 'in_progress' ? 'Em andamento' : 'Pendente');
                    const isDone = m.status === 'done' || m.completed;
                    const isInProgress = m.status === 'in_progress';
                    const cardStateClass = isDone
                        ? 'border-emerald-500/35 bg-emerald-500/[0.035] shadow-sm shadow-emerald-500/10'
                        : (isInProgress
                            ? 'border-amber-500/40 bg-amber-500/[0.035] shadow-sm shadow-amber-500/10'
                            : 'border-outline-variant/10 bg-surface-container-lowest shadow-sm');
                    const accentClass = isDone ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary/30');
                    const statusBadge = isDone
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                        : (isInProgress
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                            : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/20');
                    const isTimerMicro = state.deepWork?.isRunning && state.deepWork?.microId === m.id;
                    const actionLabel = (m.status === 'in_progress' || isTimerMicro) ? 'Gerenciar' : 'Iniciar';
                    const actionHandler = (m.status === 'in_progress' || isTimerMicro)
                        ? `window.app.openMicroInFocus('${m.id}', false)`
                        : `window.app.startDeepWorkForMicro('${m.id}')`;
                    const isFocoPlanned = app._isPlannedThisWeek(m.id);
                    const focoPlannedBadge = isFocoPlanned
                        ? '<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest"><span class="material-symbols-outlined notranslate text-[10px]">event</span>Semana</span>'
                        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[9px] font-bold uppercase tracking-widest">Captura</span>';
                    const trailId = `foco-trail-${idx}`;
                    const toggleTrail = `const p=document.getElementById('${trailId}'); if(!p) return; p.classList.toggle('hidden');`;
                    return `
                    <div class="relative overflow-hidden p-5 rounded-2xl border ${cardStateClass} hover:shadow-md transition-all group min-w-0">
                        <div class="absolute left-0 top-0 bottom-0 w-1 ${accentClass}"></div>
                        ${isDone ? '<div class="absolute right-3 bottom-3 pointer-events-none opacity-[0.07]"><span class="material-symbols-outlined notranslate text-6xl text-emerald-500">verified</span></div>' : ''}
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full">
                                ${app.escapeHtml(m.dimension || 'Geral')}
                            </span>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.app.editEntity('${m.id}', 'micros')" class="p-1 hover:text-primary"><span class="material-symbols-outlined notranslate text-sm">edit</span></button>
                                <button onclick="window.app.deleteEntity('${m.id}', 'micros')" class="p-1 hover:text-error"><span class="material-symbols-outlined notranslate text-sm">delete</span></button>
                            </div>
                        </div>
                        <h3 class="font-bold text-on-surface mb-1 line-clamp-2">${app.escapeHtml(m.title)}</h3>
                        <div class="mb-2">${focoPlannedBadge}</div>
                        <p class="text-xs text-outline mb-3 line-clamp-1">${app.escapeHtml(ctx.parentLabel || 'Sem vínculo em Planos')}</p>
                        <div class="grid grid-cols-2 gap-2 mb-4 text-[10px]">
                            <div class="rounded-lg bg-surface-container-low px-3 py-2">
                                <span class="block uppercase tracking-widest text-outline font-bold">Foco</span>
                                <span class="font-bold text-primary">${focusText}</span>
                            </div>
                            <div class="rounded-lg bg-surface-container-low px-3 py-2">
                                <span class="block uppercase tracking-widest text-outline font-bold">Sessões</span>
                                <span class="font-bold text-on-surface">${sessionCount}</span>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-outline-variant/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div class="flex items-center gap-2 text-outline">
                                <span class="material-symbols-outlined notranslate text-xs">event</span>
                                <span class="text-[10px] font-bold uppercase">${m.prazo ? m.prazo.split('-').reverse().slice(0,2).join('/') : 'S/P'}</span>
                                <span class="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${statusBadge}">${statusText}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <button type="button" onclick="${toggleTrail}" class="px-3 py-1.5 rounded-lg border border-outline-variant/20 text-outline text-[10px] font-bold uppercase tracking-widest hover:text-on-surface hover:bg-surface-container-high transition-colors">Trilha</button>
                                ${m.status !== 'done' ? `<button onclick="${actionHandler}" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20">${actionLabel}</button>` : ''}
                                ${m.status === 'done' ?
                                    `<button onclick="window.app.completeMicroAction('${m.id}')" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20">Reabrir</button>` :
                                    `<button onclick="window.app.completeMicroAction('${m.id}')" class="text-[10px] font-bold uppercase text-primary hover:underline">Concluir</button>`
                                }
                            </div>
                        </div>
                        <div id="${trailId}" class="hidden mt-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-3 space-y-2">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Trilha</p>
                            <div class="text-xs text-on-surface-variant space-y-1">
                                <p><span class="font-semibold text-on-surface">Meta:</span> ${app.escapeHtml(ctx.meta?.title || '-')}</p>
                                <p><span class="font-semibold text-on-surface">OKR:</span> ${app.escapeHtml(ctx.okr?.title || '-')}</p>
                                <p><span class="font-semibold text-on-surface">Macro:</span> ${app.escapeHtml(ctx.macro?.title || '-')}</p>
                            </div>
                        </div>
                    </div>
                `;
                }).join('');

                if (filtered.length === 0) {
                    listContainer.innerHTML = `<div class="col-span-full rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center">
                        <span class="material-symbols-outlined notranslate text-3xl text-outline mb-2">checklist</span>
                        <p class="font-bold text-on-surface">Nenhuma micro ação encontrada.</p>
                        <p class="text-sm text-on-surface-variant mt-1">Crie uma micro em Planos ou ajuste os filtros para montar sua fila de execução.</p>
                    </div>`;
                }
            }

            if (app.pendingFocusMicroId) {
                const pendingId = app.pendingFocusMicroId;
                const autoStart = !!app.pendingFocusAutoStart;
                const pendingMinutes = Math.max(0, Math.round(Number(app.pendingFocusMinutes) || 0));
                app.pendingFocusMicroId = '';
                app.pendingFocusAutoStart = false;
                app.pendingFocusMinutes = 0;
                const micro = app.getPlanMicros({ includeDone: false }).find(m => m.id === pendingId);
                if (micro) {
                    state.deepWork.microId = micro.id;
                    state.deepWork.intention = micro.title || '';
                    const microEl = document.getElementById('deep-work-micro');
                    const intentionEl = document.getElementById('deep-work-intention');
                    const presetEl = document.getElementById('deep-work-preset');
                    if (microEl) microEl.value = micro.id;
                    if (intentionEl) intentionEl.value = micro.title || '';
                    if (pendingMinutes > 0) {
                        app.applyDeepWorkPresetConfig?.(pendingMinutes);
                    } else if (app.getSuggestedFocusPresetMinutes) {
                        app.applyDeepWorkPresetConfig?.(app.getSuggestedFocusPresetMinutes(micro));
                    }
                    if (presetEl && state.deepWork?.targetSec) presetEl.value = String(Math.round(Number(state.deepWork.targetSec) / 60));
                    if (autoStart && !state.deepWork.isRunning) app.startDeepWorkSession();
                    else app.renderDeepWorkPanel();
                    const panel = document.getElementById('deep-work-panel');
                    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        },

        renderAnnualHeatmap: function() {
            const heatmap = document.getElementById('annual-heatmap');
            if (!heatmap) return;

            const state = window.sistemaVidaState;
            const cycleStart = new Date((state.cycleStartDate || app.getLocalDateKey()) + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const elapsedDays = Math.max(0, Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)));
            const daysLabel = document.getElementById('painel-exec-days');
            if (daysLabel) daysLabel.textContent = `dia ${elapsedDays + 1} de 84`;

            // Count active days in this cycle
            let cycleActiveDays = 0;
            for (let i = 0; i <= elapsedDays; i++) {
                const d = new Date(cycleStart);
                d.setDate(cycleStart.getDate() + i);
                if (app.hasDayActivity(app.getLocalDateKey(d))) cycleActiveDays++;
            }

            // Active days this calendar week (Sunday → today)
            let weekActiveDays = 0;
            const weekSun = new Date(today);
            weekSun.setDate(today.getDate() - today.getDay());
            for (let i = 0; i <= today.getDay(); i++) {
                const d = new Date(weekSun);
                d.setDate(weekSun.getDate() + i);
                if (app.hasDayActivity(app.getLocalDateKey(d))) weekActiveDays++;
            }

            // Current streak (from streak counter logic already elsewhere)
            let streak = 0;
            const check = new Date(today);
            check.setDate(check.getDate() - 1);
            while (streak < 365) {
                if (app.hasDayActivity(app.getLocalDateKey(check))) {
                    streak++;
                    check.setDate(check.getDate() - 1);
                } else break;
            }

            const cycleTotal = elapsedDays + 1;
            const cyclePct = cycleTotal > 0 ? Math.round((cycleActiveDays / cycleTotal) * 100) : 0;

            heatmap.innerHTML = `
                <div class="grid grid-cols-3 gap-4">
                    <div class="text-center space-y-1">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Esta semana</p>
                        <p class="font-headline text-3xl italic text-primary">${weekActiveDays}<span class="text-base text-outline">/${today.getDay() + 1}</span></p>
                        <p class="text-[10px] text-on-surface-variant">dias com atividade</p>
                    </div>
                    <div class="text-center space-y-1">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">No ciclo</p>
                        <p class="font-headline text-3xl italic text-secondary">${cycleActiveDays}<span class="text-base text-outline">/${cycleTotal}</span></p>
                        <p class="text-[10px] text-on-surface-variant">${cyclePct}% de consistência</p>
                    </div>
                    <div class="text-center space-y-1">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Sequência</p>
                        <p class="font-headline text-3xl italic text-tertiary">${streak}</p>
                        <p class="text-[10px] text-on-surface-variant">dias consecutivos</p>
                    </div>
                </div>`;
        },

        hoje: function() {
            const state = window.sistemaVidaState;
            app.syncDeepWorkMicroStatus();

            const dateEl = document.getElementById('data-hoje');
            if (dateEl) {
                // Força data atual local para evitar cache de data de ontem
                const now = new Date();
                const opts = { weekday: 'long', day: 'numeric', month: 'long' };
                let dateStr = now.toLocaleDateString('pt-BR', opts);
                // Capitaliza primeira letra (ex: Quinta-feira -> Quinta)
                dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
                dateEl.textContent = dateStr;
                console.log("Data 'Hoje' atualizada:", dateStr);
            }

            // Renderizar saudação com foto e nome
            const welcomeAvatar = document.getElementById('welcome-avatar');
            const welcomeMessage = document.getElementById('welcome-message');
            const welcomeGreeting = document.getElementById('welcome-greeting');
            if (welcomeAvatar && welcomeMessage && welcomeGreeting) {
                const profile = state.profile || {};
                const rawName = String(profile.name || '').trim();
                const avatarUrl = profile.avatarUrl || '';

                // Configurar avatar
                if (avatarUrl) {
                    welcomeAvatar.src = avatarUrl;
                    welcomeAvatar.style.display = 'block';
                } else {
                    welcomeAvatar.src = '';
                    welcomeAvatar.style.display = 'none';
                }

                // Configurar nome — quando sem nome, mensagem de boas-vindas neutra
                welcomeMessage.textContent = rawName ? `Olá, ${rawName}!` : 'Bem-vindo!';

                // Configurar saudação baseada no horário
                const hour = new Date().getHours();
                const suffix = rawName ? 'Bem-vindo de volta.' : 'Pronto para começar?';
                let greeting = '';
                if (hour >= 5 && hour < 12) {
                    greeting = `Bom dia! ${suffix}`;
                } else if (hour >= 12 && hour < 18) {
                    greeting = `Boa tarde! ${suffix}`;
                } else {
                    greeting = `Boa noite! ${suffix}`;
                }
                welcomeGreeting.textContent = greeting;
            }

            const streakEl = document.getElementById('streak-count');
            if (streakEl) {
                let streak = 0;
                const check = new Date();
                check.setHours(0, 0, 0, 0);
                // Sequência consecutiva: inclui hoje se já tiver atividade, senão começa de ontem
                if (!app.hasDayActivity(app.getLocalDateKey(check))) {
                    check.setDate(check.getDate() - 1);
                }
                while (true) {
                    const key = app.getLocalDateKey(check);
                    if (app.hasDayActivity(key)) {
                        streak++;
                        check.setDate(check.getDate() - 1);
                    } else {
                        break;
                    }
                }
                streakEl.textContent = `${streak} ${streak === 1 ? 'Dia' : 'Dias'} de sequência pessoal`;

                // Badge no header: mesma métrica principal exibida no card do dia
                const headerStreak = document.getElementById('header-streak');
                if (headerStreak) {
                    headerStreak.textContent = `${streak} ${streak === 1 ? 'dia' : 'dias'} de sequência pessoal`;
                }
            }

            // Progresso semanal — usa plano selecionado; fallback por datas se não houver plano
            const _weekKey = app._getWeekKey();
            const _weekPlan = (state.weekPlans || {})[_weekKey];
            const _selectedIds = (_weekPlan && _weekPlan.selectedMicros) || [];
            const weekMicros = _selectedIds.length > 0
              ? state.entities.micros.filter(m => _selectedIds.includes(m.id))
              : state.entities.micros.filter(m =>
                  app.isDateInCurrentWeek(m.inicioDate || m.prazo) || app.isDateInCurrentWeek(m.prazo)
                );
            const weekDone = weekMicros.filter(m => m.status === 'done').length;
            const weekProgress = weekMicros.length > 0
              ? Math.round((weekDone / weekMicros.length) * 100)
              : 0;

            const weekBar = document.getElementById('week-progress-bar');
            const weekVal = document.getElementById('week-progress-val');
            if (weekBar) weekBar.style.width = weekProgress + '%';
            if (weekVal) weekVal.textContent = weekProgress + '%';

            const heatmapEl = document.getElementById('week-days-container');
            if (heatmapEl) {
                const days = ['D','S','T','Q','Q','S','S'];
                const today = new Date();
                today.setHours(0,0,0,0);
                const dayOfWeek = today.getDay(); // 0=Dom
                let html = '';
                for (let i = 0; i < 7; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - dayOfWeek + i);
                    const key = app.getLocalDateKey(d);
                    const isToday = i === dayOfWeek;
                    const hasDone = app.hasDayActivity(key);
                    const isFuture = d > today;
                    let circleClass = '';
                    let inner = '';
                    if (isFuture) {
                        circleClass = 'w-7 h-7 rounded-full bg-surface-container border border-outline-variant/20';
                    } else if (hasDone) {
                        circleClass = 'w-7 h-7 rounded-full bg-[#01696f] flex items-center justify-center';
                        inner = `<span class="material-symbols-outlined notranslate text-white text-[12px]" style="font-variation-settings: 'wght' 700;">check</span>`;
                    } else if (isToday) {
                        circleClass = 'w-7 h-7 rounded-full bg-[#01696f]/15 border-2 border-[#01696f] ring-2 ring-[#01696f]/30';
                    } else {
                        circleClass = 'w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/30';
                    }
                    html += `
                    <div class="flex flex-col items-center gap-2">
                        <div class="${circleClass}">${inner}</div>
                        <span class="text-[10px] text-outline font-medium">${days[i]}</span>
                    </div>`;
                }
                heatmapEl.innerHTML = html;
            }
            
            // Alertas de Risco de Início
            const riskContainer = document.getElementById('risk-alerts-container');
            if (riskContainer) {
              const alerts = window.app.getRiskAlerts();
              if (alerts.length === 0) {
                riskContainer.classList.add('hidden');
                riskContainer.innerHTML = '';
              } else {
                riskContainer.classList.remove('hidden');
                const alertConfig = {
                  overdue: { icon: 'warning', color: 'bg-error/10 border-error/30 text-error', label: 'Atrasada' },
                  hoje:    { icon: 'schedule', color: 'bg-warning/10 border-warning/30 text-warning', label: 'Vence hoje' },
                  risco:   { icon: 'timelapse', color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Em risco' },
                  urgente: { icon: 'priority_high', color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Urgente' },
                };
                riskContainer.innerHTML = alerts.map(a => {
                  const cfg = alertConfig[a.tipo] || alertConfig.risco;
                  const diasLabel = a.tipo === 'overdue'
                    ? `${a.dias} dia${a.dias !== 1 ? 's' : ''} em atraso`
                    : a.tipo === 'hoje'
                    ? 'Vence hoje'
                    : `${a.dias} dia${a.dias !== 1 ? 's' : ''} restante${a.dias !== 1 ? 's' : ''}`;
                  return `
                    <div class="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${cfg.color} text-sm">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="material-symbols-outlined notranslate text-base shrink-0"
                              style="font-variation-settings:'FILL' 1">${cfg.icon}</span>
                        <span class="font-medium truncate">${a.title}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">${diasLabel}</span>
                        <button onclick="window.app.completeMicroAction('${a.id}')"
                                class="text-[10px] font-bold uppercase tracking-wider underline opacity-70 hover:opacity-100 transition-opacity">
                          Concluir
                        </button>
                      </div>
                    </div>`;
                }).join('');
              }
            }

            // Restore Diário
            const today = app.getLocalDateKey();
            if (state.dailyLogs && state.dailyLogs[today]) {
                const log = state.dailyLogs[today];
                const focoInput = document.getElementById('diario-foco');
                if (focoInput && log.focus) focoInput.value = log.focus;
                const g = document.getElementById('diario-gratidao'); if (g) g.value = log.gratidao || '';
                const f = document.getElementById('diario-funcionou'); if (f) f.value = log.funcionou || '';
                const s1 = document.getElementById('diario-shutdown-1');
                const shutdown = Array.isArray(log.shutdown) ? (log.shutdown[0] || '') : (log.shutdown || '');
                if (s1) s1.value = shutdown;
                const dimNotes = log.dimensionNotes || {};
                Object.entries(dimNotes).forEach(([dim, text]) => {
                    if (!text || !text.trim()) return;
                    app.toggleDiaryDimensionArea(dim);
                    const safeId = 'dim-note-' + dim.replace(/[^a-zA-Z0-9]/g, '-');
                    const ta = document.querySelector(`#${safeId} textarea`);
                    if (ta) ta.value = text;
                });
            }


            // Render Habits — grouped by intent (sustenta meta / pratica força / protege sombra / solto)
            const habitsContainer = document.getElementById('habits-container');
            if (habitsContainer && state.habits) {
                const habitIconMap = {
                    'Saúde': 'fitness_center', 'Mente': 'psychology', 'Carreira': 'work',
                    'Finanças': 'payments', 'Relacionamentos': 'groups', 'Família': 'family_restroom',
                    'Lazer': 'sports_esports', 'Propósito': 'auto_awesome'
                };

                const todayStr = app.getLocalDateKey();

                // Build card HTML for one habit.
                // In the Hábitos tab we show all active habits; those scheduled for today come first.
                const buildHabitCard = (habit) => {
                    const visibleToday = habit.frequency === 'manual'
                        ? true
                        : (typeof app.isHabitScheduledForDate === 'function' ? app.isHabitScheduledForDate(habit, todayStr) : true);

                    const icon = habitIconMap[habit.dimension] || 'stars';
                    const target = habit.targetValue || 1;
                    const mode = habit.trackMode || 'boolean';
                    const logs = habit.logs || {};
                    let currentVal = logs[todayStr] || 0;
                    const steps = Array.isArray(habit.steps) ? habit.steps.filter(Boolean) : [];
                    const hasSteps = steps.length > 0;
                    const hasProtocolLinked = !!String(habit.protocolId || '').trim();
                    const effectiveMode = (hasProtocolLinked && hasSteps) ? 'boolean' : mode;
                    const stepLogs = habit.stepLogs || {};
                    const todayStepMap = stepLogs[todayStr] || {};
                    const todayStepsDone = hasSteps ? steps.reduce((acc, _, idx) => acc + (todayStepMap[idx] || todayStepMap[String(idx)] ? 1 : 0), 0) : 0;
                    const allStepsDone = hasSteps && todayStepsDone === steps.length;

                    let isDone = false;
                    if (effectiveMode === 'boolean') isDone = currentVal > 0;
                    else isDone = currentVal >= target;
                    if (hasSteps && effectiveMode === 'boolean') isDone = allStepsDone;

                    // UI for mode
                    let controlHtml = '';
                    if (effectiveMode === 'boolean') {
                        const actionClick = hasSteps
                            ? `window.app.toggleHabitAllSteps('${habit.id}', '${todayStr}', ${allStepsDone ? 'true' : 'false'})`
                            : `window.app.updateHabitLog('${habit.id}', '${todayStr}', ${isDone ? 0 : 1})`;
                        controlHtml = `
                        <div class="w-7 h-7 rounded-full ${isDone ? 'bg-primary' : 'border-2 border-outline-variant hover:border-primary'} ${visibleToday ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} flex items-center justify-center shrink-0 transition-colors" ${visibleToday ? `onclick="event.stopPropagation(); ${actionClick}"` : `title="Esse hábito não está previsto para hoje."`}>
                            ${isDone ? '<span class="material-symbols-outlined notranslate text-white text-[16px]" style="font-variation-settings: \\\'wght\\\' 700;">check</span>' : ''}
                        </div>`;
                    } else if (effectiveMode === 'numeric' || effectiveMode === 'timer') {
                        controlHtml = visibleToday ? `
                        <div class="flex items-center gap-1 bg-surface-container rounded-lg p-1 shrink-0" onclick="event.stopPropagation()">
                            <button class="w-6 h-6 flex justify-center items-center rounded-md hover:bg-outline-variant/20 text-on-surface" onclick="window.app.updateHabitLog('${habit.id}', '${todayStr}', Math.max(0, ${currentVal} - 1))">-</button>
                            <span class="text-xs font-semibold text-primary w-6 text-center">${currentVal}</span>
                            <button class="w-6 h-6 flex justify-center items-center rounded-md hover:bg-outline-variant/20 text-on-surface" onclick="window.app.updateHabitLog('${habit.id}', '${todayStr}', ${currentVal} + 1)">+</button>
                        </div>` : `
                        <div class="flex items-center gap-1 rounded-lg border border-outline-variant/15 bg-surface-container-low px-2 py-1 shrink-0 opacity-60" title="Esse hábito não está previsto para hoje.">
                            <span class="text-xs font-semibold text-outline">${currentVal}</span>
                        </div>`;
                    }

                    // Week progress strip (semana fixa: domingo -> sábado)
                    const nowForWeek = new Date();
                    const weekStart = new Date(nowForWeek);
                    weekStart.setHours(0, 0, 0, 0);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    let weekHtml = '<div class="flex gap-1 mt-3">';
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(weekStart);
                        d.setDate(weekStart.getDate() + i);
                        const ds = app.getLocalDateKey(d);
                        const val = logs[ds] || 0;
                        const dayStepMap = stepLogs[ds] || {};
                        let dDone = false;
                        if (hasSteps && effectiveMode === 'boolean') {
                            const dCount = steps.reduce((acc, _, idx) => acc + (dayStepMap[idx] || dayStepMap[String(idx)] ? 1 : 0), 0);
                            dDone = dCount === steps.length;
                        } else if (mode === 'boolean') dDone = val > 0;
                        else dDone = val >= target;
                        const isTodayBar = ds === todayStr;
                        const isFutureBar = d > nowForWeek;
                        let barClass = 'bg-surface-container-high';
                        if (dDone) barClass = 'bg-primary';
                        else if (isFutureBar) barClass = 'bg-surface-container-low';
                        weekHtml += `<div class="flex-1 h-1.5 rounded-full ${barClass} ${isTodayBar ? 'ring-1 ring-primary/40' : ''}" title="${ds}"></div>`;
                    }
                    weekHtml += '</div>';

                    // Track progress text
                    let progressText = '';
                    if (effectiveMode === 'numeric') progressText = `${currentVal}/${target}`;
                    if (effectiveMode === 'timer') progressText = `${currentVal}m/${target}m`;

                    // Expandable steps
                    let stepsHtml = '';
                    if (hasSteps) {
                        const stepsListItems = steps.map((step, idx) => {
                            const done = !!(todayStepMap[idx] || todayStepMap[String(idx)]);
                            return `<label class="flex items-center gap-2 py-1 ${visibleToday ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}" ${visibleToday ? `onclick="event.stopPropagation(); window.app.toggleHabitStepLog('${habit.id}', '${todayStr}', ${idx})"` : `title="Esse hábito não está previsto para hoje."`}>
                                <div class="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${done ? 'bg-primary border-primary' : 'border-outline-variant'}">
                                    ${done ? '<span class="material-symbols-outlined notranslate text-white text-[10px]" style="font-variation-settings: \\\'wght\\\' 700;">check</span>' : ''}
                                </div>
                                <span class="text-xs ${done ? 'line-through text-outline' : 'text-on-surface-variant'}">${app.escapeHtml(step)}</span>
                            </label>`;
                        }).join('');
                        stepsHtml = `
                        <div class="mt-2 pt-2 border-t border-outline-variant/10" onclick="event.stopPropagation()">
                            <button class="flex items-center gap-1 w-full text-left"
                                onclick="event.stopPropagation(); var list=this.nextElementSibling; list.classList.toggle('hidden'); this.querySelector('.chev').textContent=list.classList.contains('hidden')?'expand_more':'expand_less';">
                                <span class="text-[10px] font-bold uppercase tracking-widest text-primary">${todayStepsDone}/${steps.length} passos</span>
                                <span class="material-symbols-outlined notranslate text-primary text-[14px] chev ml-auto">expand_more</span>
                            </button>
                            <div class="hidden mt-1 space-y-0.5">${stepsListItems}</div>
                        </div>`;
                    }

                    // Linked meta chip
                    let linkedMetaHtml = '';
                    if (habit.linkedMetaId) {
                        const linkedMeta = (state.entities?.metas || []).find(m => m.id === habit.linkedMetaId);
                        if (linkedMeta) {
                            const linkTitle = (linkedMeta.title || '').replace(/</g, '&lt;');
                            linkedMetaHtml = `<p class="mt-1 text-[10px] text-primary/90 leading-tight truncate flex items-center gap-1"><span class="material-symbols-outlined notranslate text-[11px]">flag</span>${linkTitle}</p>`;
                        }
                    }
                    const maturityChip = app.renderHabitMaturityChip(habit);
                    const continuousChip = habit.continuous
                        ? `<span class="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined notranslate text-[11px]">all_inclusive</span>Contínuo</span>`
                        : '';
                    const keyChip = habit.isKey
                        ? `<span class="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined notranslate text-[11px]" style="font-variation-settings:'FILL' 1">key</span>Chave</span>`
                        : '';
                    const focusCta = app.canStartFocusFromHabit?.(habit)
                        ? `<button type="button" onclick="event.stopPropagation(); window.app.openHabitFocusModal('${habit.id}')" class="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/15 transition-colors">
                                <span class="material-symbols-outlined notranslate text-[12px]">timer</span>
                                Foco
                           </button>`
                        : '';
                    const hasFocusSessionInProgress = (state.entities?.micros || []).some((m) =>
                        m?.sourceHabitId === habit.id && m.status === 'in_progress'
                    );
                    const scheduleChip = visibleToday
                        ? `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined notranslate text-[11px]">today</span>Hoje</span>`
                        : `<span class="inline-flex items-center gap-1 rounded-full bg-surface-container-high text-outline px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined notranslate text-[11px]">event</span>Não é para hoje</span>`;
                    const focusInProgressChip = hasFocusSessionInProgress
                        ? `<span class="inline-flex items-center gap-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"><span class="material-symbols-outlined notranslate text-[11px]">hourglass_top</span>Em foco</span>`
                        : '';
                    const linkedProtocol = habit.protocolId && typeof app.getProtocolById === 'function'
                        ? app.getProtocolById(habit.protocolId)
                        : null;
                    const protocolMinutes = Math.max(0, Number(app.getHabitEstimatedMinutes?.(habit)) || 0);
                    const protocolSummary = linkedProtocol
                        ? `Protocolo: ${linkedProtocol.title || 'Vinculado'} · ${Math.round(protocolMinutes)} min`
                        : '';
                    const statusChipsCompact = [maturityChip, continuousChip, keyChip, scheduleChip, focusInProgressChip].filter(Boolean).join('');
                    const maturityClass = habit.isKey
                        ? 'border-amber-500/25 bg-amber-500/[0.04]'
                        : hasFocusSessionInProgress
                            ? 'border-sky-500/25 bg-sky-500/[0.06]'
                        : habit.maturity === 'graduated'
                            ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                            : 'border-transparent bg-surface-container-low';

                    return `
                    <div id="habit-card-${habit.id}" onclick="window.app.editEntity('${habit.id}', 'habits')" class="min-w-[240px] max-w-[280px] p-4 rounded-xl border ${maturityClass} flex flex-col justify-between transition-all hover:shadow-md relative group ${isDone ? 'opacity-70' : ''} cursor-pointer scroll-mt-24">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-start gap-2 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-2xl shrink-0">${icon}</span>
                                <div class="min-w-0">
                                    <p class="font-medium text-on-surface text-sm ${isDone ? 'line-through' : ''} truncate">${habit.title}</p>
                                    <div class="mt-1 flex flex-wrap gap-1">${statusChipsCompact}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined notranslate text-[18px] opacity-0 group-hover:opacity-100 transition-all p-1 cursor-pointer ${habit.isKey ? 'text-amber-500' : 'text-outline hover:text-amber-500'}" onclick="event.stopPropagation(); window.app.toggleManualKeyHabit('${habit.id}')" title="${habit.isKey ? 'Remover Hábito-Chave' : 'Marcar como Hábito-Chave'}" style="font-variation-settings:'FILL' ${habit.isKey ? 1 : 0}">key</span>
                                <span class="material-symbols-outlined notranslate text-outline text-[18px] opacity-0 group-hover:opacity-100 hover:text-primary transition-all p-1 cursor-pointer" onclick="event.stopPropagation(); window.app.editEntity('${habit.id}', 'habits')">edit</span>
                                <span class="material-symbols-outlined notranslate text-outline text-[18px] opacity-0 group-hover:opacity-100 hover:text-error transition-all p-1 cursor-pointer" onclick="event.stopPropagation(); window.app.deleteEntity('${habit.id}', 'habits')">delete</span>
                                ${controlHtml}
                            </div>
                        </div>
                        <div class="mt-auto">
                            <div class="flex justify-between items-end">
                                <div class="overflow-hidden pr-2">
                                    ${linkedMetaHtml}
                                    ${app.renderHabitIdentityChip(habit)}
                                    ${habit.trigger ? `<p class="mt-1 text-[10px] text-outline italic leading-tight truncate">Gatilho: ${habit.trigger}</p>` : ''}
                                    ${habit.routine ? `<p class="mt-1 text-[10px] text-outline leading-tight truncate">Rotina: ${habit.routine}</p>` : ''}
                                    ${protocolSummary ? `<p class="mt-1 text-[10px] text-primary/90 leading-tight truncate">${app.escapeHtml(protocolSummary)}</p>` : ''}
                                    ${habit.startTime ? `<p class="mt-1 text-[10px] text-outline leading-tight truncate">Horário: ${habit.startTime}${habit.reminderEnabled ? ' - Lembrete ativo' : ''}</p>` : ''}
                                    ${habit.reward ? `<p class="mt-1 text-[10px] text-primary/80 leading-tight truncate">Recompensa: ${habit.reward}</p>` : ''}
                                    ${focusCta}
                                </div>
                                ${progressText ? `<span class="text-xs font-bold text-primary shrink-0">${progressText}</span>` : ''}
                            </div>
                            ${weekHtml}
                            ${stepsHtml}
                        </div>
                    </div>`;
                };

                // Group habits by intent
                const intentOrder = ['meta', 'strength', 'shadow', 'loose'];
                const intentConfig = {
                    meta:     { label: 'Sustenta meta',   icon: 'flag',                    color: 'text-primary' },
                    strength: { label: 'Pratica força',   icon: 'workspace_premium',       color: 'text-primary' },
                    shadow:   { label: 'Protege sombra',  icon: 'change_circle',           color: 'text-secondary' },
                    loose:    { label: 'Sem vínculo',     icon: 'radio_button_unchecked',  color: 'text-outline' }
                };
                const grouped = { meta: [], strength: [], shadow: [], loose: [] };
                state.habits.forEach(habit => {
                    const intent = app._getHabitIntent(habit, state);
                    grouped[intent.key].push(habit);
                });

                let habitsHtml = '';
                let totalRendered = 0;
                intentOrder.forEach(key => {
                    const cards = (grouped[key] || [])
                        .slice()
                        .sort((a, b) => {
                            const aToday = a.frequency === 'manual' ? true : (typeof app.isHabitScheduledForDate === 'function' ? app.isHabitScheduledForDate(a, todayStr) : true);
                            const bToday = b.frequency === 'manual' ? true : (typeof app.isHabitScheduledForDate === 'function' ? app.isHabitScheduledForDate(b, todayStr) : true);
                            if (aToday !== bToday) return aToday ? -1 : 1;
                            return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
                        })
                        .map(buildHabitCard)
                        .filter(Boolean);
                    if (!cards.length) return;
                    totalRendered += cards.length;
                    const cfg = intentConfig[key];
                    habitsHtml += `
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined notranslate ${cfg.color} text-[14px]" style="font-variation-settings:'FILL' 1">${cfg.icon}</span>
                            <span class="text-[10px] font-bold uppercase tracking-widest ${cfg.color}">${cfg.label}</span>
                            <span class="text-[10px] text-outline">${cards.length}</span>
                        </div>
                        <div class="flex gap-4 overflow-x-auto pb-2 hide-scrollbar -mx-6 px-6">${cards.join('')}</div>
                    </div>`;
                });

                if (totalRendered === 0) {
                    habitsHtml = `
                    <div class="flex flex-col items-center py-6 text-center gap-3">
                        <span class="material-symbols-outlined notranslate text-outline text-4xl">self_improvement</span>
                        <p class="text-sm text-outline">${state.habits.length === 0 ? 'Nenhum hábito criado ainda.' : 'Nenhum hábito ativo para mostrar.'}</p>
                        ${state.habits.length === 0 ? `<button type="button" onclick="window.app.openCreateModal('habits')" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"><span class="material-symbols-outlined notranslate text-[16px]">add</span>Criar hábito</button>` : ''}
                    </div>`;
                }

                habitsContainer.innerHTML = habitsHtml;
                app.renderKeyHabitSuggestionBanner();
            }


            app.renderDailyCheckinPanel();
            app.renderDailyCompass();
            app.renderStarterJourneyCard();
            app.renderNextBestAction();
            app.renderTodayCapacityMap();
            app.renderTodayActionList();

            const container = document.getElementById('checklist-container');
            if (!container) return;
            
            const iconMap = {
                'Saúde': 'fitness_center', 'Mente': 'psychology', 'Carreira': 'work',
                'Finanças': 'payments', 'Relacionamentos': 'groups', 'Família': 'family_restroom',
                'Lazer': 'sports_esports', 'Propósito': 'auto_awesome'
            };

            let html = '';
            let pendentes = 0;
            const now = new Date();
            const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            
            const isInTodayWindow = (m) => {
                // Normalização para meia-noite local para comparação precisa
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const inicioStr = m.inicioDate || m.prazo;
                const prazoStr = m.prazo;
                if (!prazoStr) return false; // Sem prazo, sem janela
                const start = new Date(inicioStr + 'T00:00:00');
                const end = new Date(prazoStr + 'T00:00:00');
                return start <= today && end >= today;
            };
            const allTodayMicros = (state.entities.micros || []).filter(isInTodayWindow);
            const dayDone = allTodayMicros.filter(m => m.status === 'done' || m.completed).length;
            const dayTotal = allTodayMicros.length;
            const dayProgress = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;
            const dayProgressCard = document.getElementById('day-progress-card');
            const dayProgressLabel = document.getElementById('day-progress-label');
            const dayProgressBar = document.getElementById('day-progress-bar');
            if (dayProgressCard) dayProgressCard.classList.toggle('hidden', dayTotal === 0);
            if (dayProgressLabel) dayProgressLabel.textContent = `${dayDone} de ${dayTotal} feitas`;
            if (dayProgressBar) dayProgressBar.style.width = dayProgress + '%';

            // Filtro "Para Hoje": pendentes/in_progress dentro da janela, mantendo a recém-concluída por um pulso visual.
            const todayMode = app.getTodayChecklistMode ? app.getTodayChecklistMode() : 'dimensao';
            const todayDayPart = app.getTodayChecklistDayPart ? app.getTodayChecklistDayPart() : 'all';
            const todayMicros = allTodayMicros
                .filter(m => {
                    const completedToday = (m.status === 'done' || m.completed) && (m.completedDate === todayStr || m.doneDate === todayStr);
                    return m.status !== 'done' || completedToday || m.id === app.recentCompletedMicroId;
                })
                .filter((micro) => {
                    if (todayMode !== 'horario' || todayDayPart === 'all') return true;
                    const schedule = app.getMicroScheduleContext ? app.getMicroScheduleContext(micro) : { dayPart: 'sem_horario' };
                    return (schedule.dayPart || 'sem_horario') === todayDayPart;
                })
                .sort((a, b) => {
                    const aSchedule = app.getMicroScheduleContext ? app.getMicroScheduleContext(a) : { startMinutes: null, dayPart: 'sem_horario' };
                    const bSchedule = app.getMicroScheduleContext ? app.getMicroScheduleContext(b) : { startMinutes: null, dayPart: 'sem_horario' };
                    if (todayMode !== 'horario') {
                        const aDone = a.status === 'done' || a.completed ? 1 : 0;
                        const bDone = b.status === 'done' || b.completed ? 1 : 0;
                        if (aDone !== bDone) return aDone - bDone;
                        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                        const dim = String(a.dimension || '').localeCompare(String(b.dimension || ''), 'pt-BR');
                        if (dim !== 0) return dim;
                        const due = String(a.prazo || '9999-12-31').localeCompare(String(b.prazo || '9999-12-31'));
                        if (due !== 0) return due;
                        return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
                    }
                    if (todayMode === 'horario') {
                        const order = { manha: 0, tarde: 1, noite: 2, sem_horario: 3 };
                        const aPart = order[aSchedule.dayPart] ?? 9;
                        const bPart = order[bSchedule.dayPart] ?? 9;
                        if (aPart !== bPart) return aPart - bPart;
                    }
                    const getUrgencyRank = (micro) => {
                        if (micro.status === 'in_progress') return 0;
                        if (micro.status === 'done' || micro.completed) return 4;
                        if (micro.prazo && micro.prazo < todayStr) return 1;
                        const startDate = micro.inicioDate || micro.prazo || '';
                        if (startDate && startDate <= todayStr && micro.status === 'pending') return 2;
                        return 3;
                    };
                    const aRank = getUrgencyRank(a);
                    const bRank = getUrgencyRank(b);
                    if (aRank !== bRank) return aRank - bRank;
                    if ((aSchedule.startMinutes ?? 9999) !== (bSchedule.startMinutes ?? 9999)) return (aSchedule.startMinutes ?? 9999) - (bSchedule.startMinutes ?? 9999);
                    const dim = String(a.dimension || '').localeCompare(String(b.dimension || ''), 'pt-BR');
                    if (dim !== 0) return dim;
                    const due = String(a.prazo || '9999-12-31').localeCompare(String(b.prazo || '9999-12-31'));
                    if (due !== 0) return due;
                    return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
                });

            let lastGroup = '';
            todayMicros.forEach((micro, idx) => {
                const schedule = app.getMicroScheduleContext ? app.getMicroScheduleContext(micro) : { startTime: '', dayPart: 'sem_horario' };
                const groupLabel = todayMode === 'horario'
                    ? ({ manha: 'Manha', tarde: 'Tarde', noite: 'Noite', sem_horario: 'Sem horario' })[schedule.dayPart || 'sem_horario']
                    : (micro.dimension || 'Geral');
                if (groupLabel !== lastGroup) {
                    lastGroup = groupLabel;
                    html += `
                    <div class="pt-2 first:pt-0">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">${app.escapeHtml(groupLabel)}</span>
                            <span class="h-px flex-1 bg-outline-variant/20"></span>
                        </div>
                    </div>`;
                }
                const dimensionLabel = micro.dimension || 'Geral';
                if (micro.status === 'done' || micro.completed) {
                    const notesCount = app.getLinkedNotes('micros', micro.id).length;
                    const notesBadge = notesCount ? `<button type="button" data-type="micros" data-id="${micro.id}" data-title="${app.escapeHtml(micro.title)}" onclick="event.stopPropagation(); window.app.openEntityNotesModal(this.dataset.type, this.dataset.id, this.dataset.title)" class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest rounded-full px-2 py-1 transition-colors">` +
                        `<span class="material-symbols-outlined notranslate text-[14px]">sticky_note_2</span>${notesCount}</button>` : '';
                    const isRecentCompletion = micro.id === app.recentCompletedMicroId;
                    html += `
                    <div class="relative overflow-hidden bg-emerald-500/[0.04] border border-emerald-500/25 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm shadow-emerald-500/5 ${isRecentCompletion ? 'micro-complete-feedback' : ''}">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                        <div class="absolute right-3 bottom-2 pointer-events-none opacity-[0.05]">
                            <span class="material-symbols-outlined notranslate text-4xl text-emerald-500">verified</span>
                        </div>
                        <div class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ${isRecentCompletion ? 'micro-complete-check' : ''}">
                            <span class="material-symbols-outlined notranslate text-white leading-none" style="font-size:13px; font-variation-settings: 'wght' 700;">check</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="text-sm text-on-surface font-semibold leading-snug line-through truncate">${micro.title}</p>
                                ${notesBadge}
                            </div>
                            <span class="inline-flex items-center mt-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wide rounded-md leading-none area-tag">${dimensionLabel}</span>
                        </div>
                    </div>`;
                } else {
                    pendentes++;
                    const macro = state.entities.macros.find(m => m.id === micro.macroId) || {};
                    const okr = state.entities.okrs.find(o => o.id === macro.okrId) || {};
                    const meta = state.entities.metas.find(m => m.id === okr.metaId) || {};
                    const dimIcon = iconMap[micro.dimension] || 'stars';
                    const notesCount = app.getLinkedNotes('micros', micro.id).length;
                    const notesBadge = notesCount ? `<button type="button" data-type="micros" data-id="${micro.id}" data-title="${app.escapeHtml(micro.title)}" onclick="event.stopPropagation(); window.app.openEntityNotesModal(this.dataset.type, this.dataset.id, this.dataset.title)" class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest rounded-full px-2 py-1 transition-colors">` +
                        `<span class="material-symbols-outlined notranslate text-[14px]">sticky_note_2</span>${notesCount}</button>` : '';

                    const startDate = micro.inicioDate || micro.prazo || '';
                    const shouldStart = !!startDate && startDate <= todayStr && micro.status === 'pending';
                    const isOverdue = micro.prazo && micro.prazo < todayStr;
                    const isPlanned = app._isPlannedThisWeek(micro.id);
                    const estimatedMinutes = Math.max(1, Number(app.getMicroEstimatedMinutes?.(micro)) || 0);
                    const estimateSource = app.getMicroEstimatedMinutesSource?.(micro) || 'suggested';
                    const estimateSourceLabel = app.getEstimateSourceLabel?.(estimateSource) || '';
                    const scheduleSourceLabel = app.getScheduleSourceLabel?.(schedule.source || '') || '';
                    const badge = (icon, label, color, bg) => `<span class="inline-flex items-center gap-0.5 ${color} ${bg} border border-outline-variant/20 rounded-md px-1 py-0.5 shrink-0 leading-none"><span class="material-symbols-outlined notranslate leading-none" style="font-size:11px">${icon}</span><span>${label}</span></span>`;
                    const dimensionBadge = badge(dimIcon, micro.dimension || 'Geral', 'text-primary', 'bg-primary/5');
                    const statusBadge = micro.status === 'in_progress' ? badge('radio_button_checked', 'Andamento', 'text-amber-600 dark:text-amber-400', 'bg-amber-500/10') : '';
                    const overdueBadge = isOverdue ? badge('alarm', 'Atrasada', 'text-red-600 dark:text-red-400', 'bg-red-500/10') : '';
                    const timeBadge = badge('timer', `${Math.round(estimatedMinutes)} min`, 'text-on-surface-variant', 'bg-surface-container-high');
                    const planBadge = isPlanned ? badge('event', 'Semana', 'text-primary', 'bg-primary/5') : badge('inbox', 'Captura', 'text-on-surface-variant', 'bg-surface-container-high');
                    const startBtn = shouldStart
                        ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', true);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">Iniciar</button>`
                        : (micro.status === 'in_progress'
                            ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', false);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors">Gerenciar</button>`
                            : '');

                    html += `
                    <div class="space-y-2">
                        <div class="relative overflow-hidden ${micro.status === 'in_progress' ? 'bg-amber-500/[0.04] border border-amber-500/35 shadow-sm shadow-amber-500/10' : 'bg-surface-container-lowest border border-outline-variant/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]'} px-4 py-3 rounded-xl group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${micro.status === 'in_progress' ? 'bg-amber-500' : 'bg-primary/30'}"></div>
                            <div class="flex items-center gap-3">
                                <div class="w-5 h-5 rounded-full border-2 ${micro.status === 'in_progress' ? 'border-amber-500 bg-amber-500/10' : 'border-outline-variant'} flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check shrink-0" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                                <div class="flex-1 min-w-0 space-y-1.5">
                                    <div class="flex items-center gap-3">
                                        <p class="text-sm font-semibold text-on-surface leading-snug flex-1 min-w-0 truncate">${micro.title}</p>
                                        ${notesBadge}
                                        <div class="flex items-center gap-1 shrink-0">
                                            ${startBtn}
                                            <button type="button" title="Adiar para amanhã" onclick="event.stopPropagation(); app.postponeMicroOneDay('${micro.id}');" class="w-7 h-7 flex items-center justify-center rounded-md text-outline hover:bg-surface-container-high hover:text-on-surface transition-colors active:scale-90">
                                                <span class="material-symbols-outlined notranslate text-[18px]">event_upcoming</span>
                                            </button>
                                            <span class="material-symbols-outlined notranslate text-outline-variant text-sm transition-transform group-[.open]:rotate-180">keyboard_arrow_down</span>
                                        </div>
                                    </div>
                                    <div class="flex flex-nowrap items-center gap-1 overflow-hidden text-[9px] font-bold uppercase tracking-wide leading-none">
                                        ${dimensionBadge}
                                        ${statusBadge}
                                        ${overdueBadge}
                                        ${timeBadge}
                                        ${planBadge}
                                    </div>
                                </div>
                            </div>
                            ${(micro.obstacle || micro.ifThen) ? `
                            <div class="mt-2 pt-2 border-t border-amber-500/15 text-xs text-on-surface-variant leading-relaxed">
                                <p class="text-[9px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1"><span class="material-symbols-outlined notranslate text-[13px]">psychology</span> WOOP / Se-então</p>
                                ${micro.obstacle ? `<p><span class="font-semibold text-on-surface">Obstáculo:</span> ${app.escapeHtml(micro.obstacle)}</p>` : ''}
                                ${micro.ifThen ? `<p class="mt-0.5"><span class="font-semibold text-on-surface">Plano:</span> ${app.escapeHtml(micro.ifThen)}</p>` : ''}
                            </div>` : ''}
                        </div>

                        <div class="hidden bg-surface-container-low rounded-lg p-4 space-y-3 relative trail-line text-on-surface-variant overflow-hidden" id="trail-${idx}">
                            <div class="absolute left-[12px] top-3 bottom-3 w-px bg-primary/10"></div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full">check_circle</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Micro Ação</span>
                                    <span class="text-sm font-medium truncate">${micro.title}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">account_tree</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Macro Ação</span>
                                    <span class="text-xs truncate">${macro.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">track_changes</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">OKR</span>
                                    <span class="text-xs truncate">${okr.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">flag</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Meta</span>
                                    <span class="text-xs text-on-surface-variant font-medium truncate">${meta.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full">${dimIcon}</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Área</span>
                                    <span class="text-xs truncate">${micro.dimension}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">timer</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Carga total estimada</span>
                                    <span class="text-xs truncate">${Math.round(estimatedMinutes)} min${estimateSourceLabel ? ` · ${estimateSourceLabel}` : ''}</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">schedule</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Execucao no dia</span>
                                    <span class="text-xs truncate">${schedule.startTime ? `${schedule.startTime} · ${scheduleSourceLabel || 'Definido'}` : 'Sem horario definido'}</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold text-primary">Propósito (Nível 0)</span>
                                    <span class="text-base font-headline italic truncate">${meta.purpose || '-'}</span>
                                </div>
                            </div>

                            <div class="pt-3 border-t border-outline-variant/10 flex justify-end">
                                <button onclick="event.stopPropagation(); app.openEntityReview('${micro.id}', 'micros')" class="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all shadow-sm">
                                    <span class="material-symbols-outlined notranslate text-[18px]">settings_accessibility</span> Gerir Micro Ação
                                </button>
                            </div>
                        </div>
                    </div>`;
                }
            });

            // Se houver tarefas atrasadas, adiciona um banner/botão de resolução rápida
            const nowOverdue = new Date();
            const localTodayStr = new Date(nowOverdue.getTime() - (nowOverdue.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const overdueList = (state.entities.micros || []).filter(m => m.status !== 'done' && m.prazo && m.prazo < localTodayStr);
            const atrasadasCount = overdueList.length;

            if (atrasadasCount > 0) {
                const migrationBtnHtml = `
                <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl mb-4 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined notranslate text-amber-600 dark:text-amber-400">warning</span>
                        <div>
                            <p class="text-sm font-bold text-amber-900 dark:text-amber-100">${atrasadasCount} tarefas em atraso</p>
                            <p class="text-xs text-amber-700/70 dark:text-amber-400/70">Deseja migrá-las para o planejamento de hoje?</p>
                        </div>
                    </div>
                    <button onclick="app.migrateOverdueTasks()" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap">
                        Migrar Tudo
                    </button>
                </div>`;
                html = migrationBtnHtml + html;
            }

            if (!html.trim()) {
                const emptyLabel = todayMode === 'horario' && todayDayPart !== 'all'
                    ? `Nenhuma micro neste filtro de ${todayDayPart.replace('_', ' ')}.`
                    : 'Nenhuma micro prevista para hoje.';
                html = `<div class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 text-xs text-outline italic">${app.escapeHtml(emptyLabel)}</div>`;
            }

            container.innerHTML = html;
            if (app.recentCompletedMicroId) {
                const completedId = app.recentCompletedMicroId;
                setTimeout(() => {
                    if (app.recentCompletedMicroId !== completedId) return;
                    app.recentCompletedMicroId = '';
                    if (app.currentView === 'hoje' && app.render.hoje) app.render.hoje();
                }, 850);
            }

            const pendingBadge = document.getElementById('macros-pendentes-badge');
            if (pendingBadge) {
                pendingBadge.textContent = `${pendentes} Pendentes`;
            }

            // Distribuição de Foco na aba Hoje
            this.renderFocusDistribution('focus-distribution');
        },

        planos: function() {
            const state = window.sistemaVidaState;
            const filter = app.planosFilter || 'Todas';

            // Sync filter buttons UI
            const filterContainer = document.getElementById('planos-dimension-filters') || document.querySelector('.overflow-x-auto.no-scrollbar.mb-12');
            if (filterContainer) {
                const btns = filterContainer.querySelectorAll('button');
                btns.forEach(btn => {
                    const txt = btn.textContent.trim();
                    const isMatched = (txt === filter || (filter === 'Relacionamentos' && txt === 'Relac.'));

                    if (isMatched) {
                        btn.className = "px-4 py-2 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-sm";
                    } else {
                        btn.className = "px-4 py-2 rounded-lg text-outline text-[10px] font-bold uppercase tracking-wider whitespace-nowrap hover:bg-surface-container-high transition-all";
                    }
                    
                    btn.onclick = () => {
                        app.setPlanosFilter(txt === 'Relac.' ? 'Relacionamentos' : txt);
                    };
                });
            }

            // Configure buttons and selects in already existing HTML
            const filterAreaId = 'planos-advanced-filters';
            const filterArea = document.getElementById(filterAreaId);
            if (!filterArea) return; // Wait for view to be ready
            
            if (document.getElementById('hier-type')) {
                document.getElementById('hier-type').value = app.planosHierarchyType || '';
                const hierIdSelect = document.getElementById('hier-id');
                if (app.planosHierarchyType) {
                    hierIdSelect.classList.remove('hidden');
                    const list = state.entities[app.planosHierarchyType] || [];
                    hierIdSelect.innerHTML = '<option value="">Selecione a referência...</option>' + list.map(e => `<option value="${e.id}" ${app.planosHierarchyId === e.id ? 'selected' : ''}>${e.title}</option>`).join('');
                } else {
                    hierIdSelect.classList.add('hidden');
                }

                const activeTabFromDom = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'metas';
                app.planosActiveTab = activeTabFromDom;
                const showPlannedFilter = app.planosActiveTab === 'micro';
                if (!showPlannedFilter && app.planosStatusFilter === 'planned') {
                    app.planosStatusFilter = 'all';
                }
                const statFilterRaw = app.planosStatusFilter || 'all';
                let statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
                const base = 'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap';
                const on = 'bg-primary text-on-primary shadow-sm';
                const off = 'text-outline hover:bg-surface-container-high';
                const btnPending = document.getElementById('btn-stat-pending');
                const btnInProgress = document.getElementById('btn-stat-in-progress');
                const btnDone = document.getElementById('btn-stat-done');
                const btnPlanned = document.getElementById('btn-stat-planned');
                const btnAll = document.getElementById('btn-stat-all');
                const btnActive = document.getElementById('btn-stat-active'); // legado
                if (btnPending) btnPending.className = `${base} ${statFilter === 'pending' ? on : off}`;
                if (btnInProgress) btnInProgress.className = `${base} ${statFilter === 'in_progress' ? on : off}`;
                if (btnDone) btnDone.className = `${base} ${statFilter === 'done' ? on : off}`;
                if (btnPlanned) btnPlanned.className = `${showPlannedFilter ? '' : 'hidden '} ${base} ${statFilter === 'planned' ? on : off}`.trim();
                if (btnAll) btnAll.className = `${base} ${statFilter === 'all' ? on : off}`;
                if (btnActive) btnActive.className = `${base} ${statFilter === 'active' ? on : off}`;
            }

            const buildCards = (items, entityType) => {
                // Determine implicit dimension hierarchically
                const resolveDim = (item) => {
                    if (item.dimension) return item.dimension;
                    if (item.dimensionName) return item.dimensionName;
                    if (entityType === 'okrs') {
                         const m = state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    if (entityType === 'macros') {
                         const o = state.entities.okrs.find(x => x.id === item.okrId);
                         const m = o ? state.entities.metas.find(x => x.id === o.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    if (entityType === 'micros') {
                         const macro = state.entities.macros.find(x => x.id === item.macroId);
                         const okr = macro ? state.entities.okrs.find(x => x.id === macro.okrId) : state.entities.okrs.find(x => x.id === item.okrId);
                         const m = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    return 'Geral';
                };

                const resolveLineage = (item, type) => {
                    let metaId = type === 'metas' ? item.id : null;
                    let okrId = type === 'okrs' ? item.id : null;
                    let macroId = type === 'macros' ? item.id : null;
                    if (type === 'micros') {
                        macroId = item.macroId;
                        const m = state.entities.macros.find(x => x.id === macroId);
                        if (m) {
                            okrId = m.okrId;
                            const o = state.entities.okrs.find(x => x.id === okrId);
                            if (o) metaId = o.metaId;
                            else metaId = m.metaId || item.metaId || null;
                        } else {
                            okrId = item.okrId || null;
                            const o = state.entities.okrs.find(x => x.id === okrId);
                            if (o) metaId = o.metaId;
                            else metaId = item.metaId || null;
                        }
                    } else if (type === 'macros') {
                        okrId = item.okrId;
                        const o = state.entities.okrs.find(x => x.id === okrId);
                        if (o) metaId = o.metaId;
                        else metaId = item.metaId || null;
                    } else if (type === 'okrs') {
                        metaId = item.metaId;
                    }
                    const metaChain = metaId ? app.getMetaParentChain(metaId) : [];
                    return { metaId, okrId, macroId, metaChain };
                };

                const filteredByDim = filter === 'Todas' ? items : items.filter(i => resolveDim(i) === filter);
                const filtered = filteredByDim.filter(i => {
                    // Filtro 1: Status
                    // Micros usam regra binária; macro/okr/meta exigem decisão explícita do usuário.
                    const isDone = entityType === 'micros'
                        ? (i.status === 'done' || i.completed || (Number(i.progress) || 0) >= 100)
                        : (i.status === 'done');
                    const statFilterRaw = app.planosStatusFilter || 'all';
                    const statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
                    let passStatus = false;
                    if (statFilter === 'active') passStatus = !isDone && i.status !== 'abandoned'; // legado
                    else if (statFilter === 'pending') passStatus = !isDone && i.status !== 'abandoned' && i.status !== 'in_progress';
                    else if (statFilter === 'in_progress') passStatus = i.status === 'in_progress';
                    else if (statFilter === 'done') passStatus = isDone;
                    else if (statFilter === 'planned') passStatus = entityType === 'micros' ? app._isPlannedThisWeek(i.id) : true;
                    else passStatus = i.status !== 'abandoned';
                    if (!passStatus) return false;

                    // Filtro 2: Raio-X Relacional (Lineage Omnidirecional)
                    if (app.planosHierarchyType && app.planosHierarchyId) {
                        const lineage = resolveLineage(i, entityType);
                        if (app.planosHierarchyType === 'metas' && !lineage.metaChain.includes(app.planosHierarchyId)) return false;
                        if (app.planosHierarchyType === 'okrs' && lineage.okrId !== app.planosHierarchyId) return false;
                        if (app.planosHierarchyType === 'macros' && lineage.macroId !== app.planosHierarchyId) return false;
                    }
                    return true;
                });
                
                const grouped = {};
                filtered.forEach(item => {
                    const dim = resolveDim(item) || 'Geral';
                    if (!grouped[dim]) grouped[dim] = [];
                    grouped[dim].push(item);
                });

                if (Object.keys(grouped).length === 0) {
                    const emptyIcon = (entityType === 'metas' || entityType === 'okrs') ? 'flag' : 'task_alt';
                    const emptyTypeLabel = ({ metas: 'meta', okrs: 'OKR', macros: 'macro', micros: 'micro ação' })[entityType] || 'plano';
                    const filterCopy = filter === 'Todas' ? 'nesta categoria' : `em ${filter}`;
                    // Show guided trail CTA when viewing metas with no active filter
                    const showTrailCta = entityType === 'metas' && filter === 'Todas';
                    return `
                    <div class="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 border-dashed text-center flex flex-col items-center justify-center">
                        <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                            <span class="material-symbols-outlined notranslate text-outline text-3xl">${emptyIcon}</span>
                        </div>
                        <h4 class="font-headline text-lg font-bold text-on-background">Nenhum ${emptyTypeLabel} encontrado</h4>
                        <p class="text-sm text-outline mt-2 max-w-sm">${showTrailCta ? 'Comece criando sua primeira meta. A trilha guiada cria meta, OKRs, macros e micros de uma vez.' : `Não há itens ${filterCopy} com os filtros atuais.`}</p>
                        <div class="mt-5 flex flex-wrap justify-center gap-2">
                            ${showTrailCta ? `
                            <button type="button" onclick="window.app.openMetaTrailWizard()"
                                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                                <span class="material-symbols-outlined notranslate text-[16px]">auto_awesome</span>
                                Trilha guiada
                            </button>
                            ` : ''}
                            <button type="button" onclick="window.app.openCreateModal('${entityType}')"
                                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl ${showTrailCta ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-on-primary'} text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                                <span class="material-symbols-outlined notranslate text-[16px]">add</span>
                                Criar ${emptyTypeLabel}
                            </button>
                            <button type="button" onclick="window.app.clearPlanosFilters()"
                                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest active:scale-95 transition-all">
                                <span class="material-symbols-outlined notranslate text-[16px]">filter_alt_off</span>
                                Limpar filtros
                            </button>
                        </div>
                    </div>`;
                }

                let html = '';
                for (const [dim, entities] of Object.entries(grouped)) {
                    html += `
                    <div>
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xs font-label uppercase tracking-[0.2em] text-outline">${dim}</h3>
                            <div class="h-px flex-1 bg-surface-container-high mx-4"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;
                        
                    entities.forEach((item, idx) => {
                        const prog = item.progress || (item.completed ? 100 : 0);
                        let visualProg = prog;
                        const hasKrs = entityType === 'okrs' && Array.isArray(item.keyResults) && item.keyResults.length > 0;
                        const subMetaText = entityType === 'okrs'
                            ? (hasKrs ? `${item.keyResults.length} KRs • ${item.challengeLevel || 3}/5 desafio` : `Sem KRs • ${item.challengeLevel || 3}/5 desafio`)
                            : (entityType === 'metas'
                                ? `Comprometimento ${item.commitmentLevel || 3}/5`
                                : '');
                        
                        // Count children for hierarchy display
                        let countLine = '';
                        if (entityType === 'metas' || entityType === 'okrs' || entityType === 'macros') {
                            const counts = app._getEntityCounts(entityType, item.id, state);
                            const parts = [];
                            if (counts.okrs > 0) parts.push(`${counts.okrs} OKR${counts.okrs > 1 ? 's' : ''}`);
                            if (counts.macros > 0) parts.push(`${counts.macros} Macro${counts.macros > 1 ? 's' : ''}`);
                            if (counts.micros > 0) parts.push(`${counts.micros} Micro${counts.micros > 1 ? 's' : ''}`);
                            countLine = parts.join(' - ');
                        }

                        // Build Hierarchy Trail Nodes
                        let trailNodes = [];
                        if (entityType === 'micros') {
                            trailNodes.push({ label: 'Micro Ação', title: item.title });
                            const macro = state.entities.macros.find(x => x.id === item.macroId);
                            trailNodes.push({ label: 'Macro Ação', title: macro ? macro.title : '-' });
                            const okr = macro ? state.entities.okrs.find(x => x.id === macro.okrId) : state.entities.okrs.find(x => x.id === item.okrId);
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'macros') {
                            trailNodes.push({ label: 'Macro Ação', title: item.title });
                            const okr = state.entities.okrs.find(x => x.id === item.okrId);
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'okrs') {
                            trailNodes.push({ label: 'OKR', title: item.title });
                            const meta = state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Critério de Sucesso', title: item.successCriteria || '-' });
                            trailNodes.push({ label: 'Desafio', title: `${item.challengeLevel || 3}/5` });
                            trailNodes.push({ label: 'Comprometimento', title: `${item.commitmentLevel || 3}/5` });
                            if (Array.isArray(item.keyResults) && item.keyResults.length > 0) {
                                trailNodes.push({ label: 'Key Results', title: `${item.keyResults.length} indicadores` });
                            }
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'metas') {
                            trailNodes.push({ label: 'Meta', title: item.title });
                            if (item.parentMetaId) {
                                const parentMeta = state.entities.metas.find(x => x.id === item.parentMetaId);
                                trailNodes.push({ label: 'Meta Pai', title: parentMeta ? parentMeta.title : '-' });
                            }
                            trailNodes.push({ label: 'Horizonte', title: `${app.getMetaHorizonYears(item)} anos` });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Critério de Sucesso', title: item.successCriteria || '-' });
                            trailNodes.push({ label: 'Desafio', title: `${item.challengeLevel || 3}/5` });
                            trailNodes.push({ label: 'Comprometimento', title: `${item.commitmentLevel || 3}/5` });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: item.purpose || '-' });
                        }

                        let trailHtml = `<div class="bg-surface-container-low rounded-lg p-3 space-y-2 relative trail-line text-on-surface-variant mt-0 overflow-hidden">
                            <div class="absolute left-[20px] top-4 bottom-4 w-px bg-primary/15"></div>`;

                        trailNodes.forEach((node) => {
                            let icon = 'trip_origin'; let colorClass = 'text-outline'; let titleClass = 'text-xs text-on-surface-variant font-medium';
                            let nodeShell = '';
                            if (node.label === 'Propósito (Nível 0)') { icon = 'auto_awesome'; colorClass = 'text-primary'; titleClass = 'text-sm font-headline italic text-on-surface'; nodeShell = 'mt-1 rounded-xl bg-primary/5 border border-primary/10 p-3'; }
                            else if (node.label === 'Área') { icon = 'stars'; colorClass = 'text-primary'; }
                            else if (node.label === 'Meta') { icon = 'flag'; colorClass = 'text-outline'; }
                            else if (node.label === 'Meta Pai') { icon = 'outbound'; colorClass = 'text-outline'; }
                            else if (node.label === 'Horizonte') { icon = 'schedule'; colorClass = 'text-primary'; }
                            else if (node.label === 'OKR') { icon = 'track_changes'; colorClass = 'text-outline'; }
                            else if (node.label === 'Macro Ação') { icon = 'account_tree'; colorClass = 'text-outline'; }
                            else if (node.label === 'Micro Ação') { icon = 'check_circle'; colorClass = 'text-primary'; }
                            else if (node.label === 'Critério de Sucesso') { icon = 'rule'; colorClass = 'text-primary'; }
                            else if (node.label === 'Desafio') { icon = 'military_tech'; colorClass = 'text-primary'; }
                            else if (node.label === 'Comprometimento') { icon = 'verified'; colorClass = 'text-primary'; }
                            else if (node.label === 'Key Results') { icon = 'query_stats'; colorClass = 'text-primary'; }

                            trailHtml += `
                            <div class="${nodeShell} flex items-start gap-3 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate ${colorClass} text-base bg-surface-container-lowest p-1 rounded-full shrink-0 mt-0.5 ring-1 ring-outline-variant/10" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                                <div class="flex flex-col min-w-0 flex-1">
                                    <span class="text-[9px] uppercase tracking-wider opacity-60 font-bold ${colorClass}">${node.label}</span>
                                    <span class="${titleClass} ${node.label === 'Propósito (Nível 0)' ? 'line-clamp-2' : 'break-words'}">${node.title}</span>
                                </div>
                            </div>`;
                        });
                        trailHtml += `</div>`;
                        

                        const userValues = state.profile.values || [];
                        const isAligned = userValues.includes(item.dimension);
                        const microPlanChip = entityType === 'micros'
                            ? (app._isPlannedThisWeek(item.id)
                                ? '<span title="Micro selecionada no planejamento semanal" class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold uppercase tracking-wider">Semana</span>'
                                : '<span title="Micro capturada fora do plano semanal" class="shrink-0 bg-surface-container-high text-on-surface-variant text-[9px] px-2 py-0.5 rounded-full border border-outline-variant/20 font-bold uppercase tracking-wider">Captura</span>')
                            : '';
                        const woopCardHtml = (item.obstacle || item.ifThen) ? `
                            <div class="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-on-surface-variant leading-relaxed">
                                <p class="text-[9px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1"><span class="material-symbols-outlined notranslate text-[13px]">psychology</span> WOOP / Se-então</p>
                                ${item.obstacle ? `<p><span class="font-semibold text-on-surface">Obstáculo:</span> ${app.escapeHtml(item.obstacle)}</p>` : ''}
                                ${item.ifThen ? `<p class="mt-1"><span class="font-semibold text-on-surface">Plano:</span> ${app.escapeHtml(item.ifThen)}</p>` : ''}
                            </div>` : '';

                        const isInProgress = item.status === 'in_progress';
                        // Para micros (atômicas): completed/progress 100 implicam done.
                        // Para macros/okrs/metas: done EXIGE decisão explícita (status === 'done').
                        const isDone = entityType === 'micros'
                            ? (item.status === 'done' || item.completed || prog >= 100)
                            : (item.status === 'done');
                        const isPending = item.status === 'pending';
                        const isReadyToClose = !isDone && entityType !== 'micros' && prog >= 100;
                        const highlightClass = isReadyToClose
                            ? 'ring-2 ring-emerald-500/40 border-emerald-500/50 shadow-md shadow-emerald-500/10 bg-emerald-500/[0.03]'
                            : (isInProgress
                                ? 'ring-2 ring-amber-500/30 border-amber-500/50 shadow-md shadow-amber-500/10 bg-amber-500/[0.03]'
                                : (isDone ? 'border-emerald-500/40 shadow-md shadow-emerald-500/10 bg-emerald-500/[0.035]' : 'border-outline-variant/20 shadow-sm'));
                        const accentClass = isDone ? 'bg-emerald-500' : (isReadyToClose ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary/30'));
                        const progressColor = isDone ? 'bg-emerald-500' : (isReadyToClose ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary'));
                        const statusChip = isDone
                            ? '<span class="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Concluído</span>'
                            : (isReadyToClose
                                ? '<span class="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pronto p/ fechar</span>'
                                : (isInProgress
                                    ? '<span class="shrink-0 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Andamento</span>'
                                    : '<span class="shrink-0 bg-surface-container-high text-on-surface-variant px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Pendente</span>'));
                        const actionButton = entityType === 'micros' && !isDone
                            ? `
                                <button onclick="event.stopPropagation(); app.openMicroInFocus('${item.id}', ${isPending ? 'true' : 'false'})"
                                    class="p-2.5 border ${isPending ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary'} rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">${isPending ? 'play_arrow' : 'timer'}</span> ${isPending ? 'Iniciar' : 'Gerenciar'}
                                </button>
                            `
                            : (isDone
                                ? `
                                ${entityType === 'micros'
                                    ? `<button onclick="event.stopPropagation(); app.completeMicroAction('${item.id}')"
                                        class="p-2.5 border border-primary/30 bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-primary transition-colors">
                                        <span class="material-symbols-outlined notranslate text-base">undo</span> Reabrir
                                    </button>`
                                    : `<button onclick="event.stopPropagation(); app.deleteEntity('${item.id}', '${entityType}')"
                                        class="p-2.5 border border-outline-variant/30 hover:bg-error-container/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-error transition-colors">
                                        <span class="material-symbols-outlined notranslate text-base">delete</span> Excluir
                                    </button>`
                                }
                                `
                                : (isPending
                                    ? `
                                <div class="p-2.5 border border-outline-variant/20 bg-surface-container-low rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline" title="Inicia automaticamente quando uma micro filha entra em execução">
                                    <span class="material-symbols-outlined notranslate text-base">account_tree</span> Inicia via cascata
                                </div>
                                `
                                    : `
                                <button onclick="event.stopPropagation(); app.forceCompleteEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border ${isReadyToClose ? 'border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 ring-2 ring-emerald-500/20' : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'} rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">check_circle</span> ${isReadyToClose ? 'Fechar agora' : 'Concluir'}
                                </button>
                                `));

                        html += `
                        <div data-entity-id="${item.id}" data-entity-type="${entityType}" class="bg-surface-container-lowest p-4 md:p-5 rounded-2xl border ${highlightClass} hover:shadow-lg transition-all group cursor-pointer overflow-hidden relative" onclick="app.toggleTrail(this)">
                            <div class="absolute left-0 top-0 bottom-0 w-1 ${accentClass}"></div>
                            ${isDone ? '<div class="absolute right-4 bottom-4 pointer-events-none opacity-[0.07]"><span class="material-symbols-outlined notranslate text-7xl text-emerald-500">verified</span></div>' : ''}
                            <div class="flex items-start justify-between gap-3 mb-3">
                                <div class="space-y-1.5 flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="shrink-0 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-label font-bold uppercase tracking-wider">${item.dimension || 'Geral'}</span>
                                        ${microPlanChip}
                                        ${isAligned ? '<span class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold">ALINHADO</span>' : ''}
                                        ${entityType === 'micros' ? (() => {
                                            const notesCount = app.getLinkedNotes('micros', item.id).length;
                                            return notesCount ? `<button type="button" data-type="micros" data-id="${item.id}" data-title="${app.escapeHtml(item.title)}" onclick="event.stopPropagation(); window.app.openEntityNotesModal(this.dataset.type, this.dataset.id, this.dataset.title)" class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest rounded-full px-2 py-1 transition-colors">` +
                                                `<span class="material-symbols-outlined notranslate text-[14px]">sticky_note_2</span>${notesCount}</button>` : '';
                                        })() : ''}
                                    </div>
                                    <h4 class="font-headline text-lg md:text-xl font-semibold leading-tight line-clamp-2">${item.title}</h4>
                                    ${subMetaText ? `<p class="text-[11px] text-outline">${subMetaText}</p>` : ''}
                                </div>
                                <div class="flex flex-col items-end gap-2 shrink-0">
                                    ${statusChip}
                                    <span class="material-symbols-outlined notranslate text-outline text-lg transition-transform group-hover:translate-x-0.5">chevron_right</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 mb-3 text-[11px] text-outline whitespace-nowrap overflow-x-auto no-scrollbar border-t border-outline-variant/10 pt-3">
                                <span class="inline-flex items-center gap-1 shrink-0">
                                    <span class="material-symbols-outlined notranslate text-sm">event</span>
                                    ${app.formatPrazoDisplay(item)}
                                </span>
                                ${countLine ? `<span class="text-outline/40 shrink-0">·</span><span class="font-label uppercase tracking-wider shrink-0">${countLine}</span>` : ''}
                            </div>

                            <div class="space-y-1.5 mb-4">
                                <div class="flex justify-between items-center text-[10px] font-label uppercase tracking-wider text-outline">
                                    <span>Progresso</span>
                                    <span>${prog.toFixed(0)}%</span>
                                </div>
                                <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div class="h-full ${progressColor} rounded-full transition-all" style="width: ${visualProg}%"></div>
                                </div>
                            </div>

                            ${woopCardHtml}
                            <div class="grid grid-cols-3 gap-2">
                                <button onclick="event.stopPropagation(); app.openEntityReview('${item.id}', '${entityType}')"
                                    class="col-span-3 p-2.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all">
                                    <span class="material-symbols-outlined notranslate text-base">settings_accessibility</span> Gerir Estrategia
                                </button>
                                <button onclick="event.stopPropagation(); app.editEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-outline-variant/30 hover:bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-on-surface transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">edit</span> Editar
                                </button>
                                <button onclick="event.stopPropagation(); app.duplicateEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-outline-variant/30 hover:bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-on-surface transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">content_copy</span> Duplicar
                                </button>
                                ${actionButton}
                            </div>

                            <div class="trail-panel hidden overflow-hidden transition-all duration-300 max-h-0 mt-3 border-t border-outline-variant/10 pt-3">
                                ${trailHtml}
                            </div>
                        </div>`;
                    });

                    html += `</div></div>`;
                }
                return html;
            };

            const metasC = document.getElementById('metas-container');
            if (metasC) metasC.innerHTML = buildCards(state.entities.metas, 'metas');
            
            const okrsC = document.getElementById('okrs-container');
            if (okrsC) okrsC.innerHTML = buildCards(state.entities.okrs, 'okrs');

            const macroC = document.getElementById('macro-container');
            if (macroC) macroC.innerHTML = buildCards(state.entities.macros, 'macros');

            const microC = document.getElementById('micro-container');
            if (microC) microC.innerHTML = buildCards(state.entities.micros, 'micros');
            if (typeof app.renderProtocolsPanel === 'function' && app.planosActiveTab === 'protocolos') app.renderProtocolsPanel();
            if (app.planosActiveTab === 'ciclo') app.renderCycleReviewPanel();
        },

        perfil: function() {
            const state = window.sistemaVidaState;
            const nomeDisplay = document.getElementById('perfil-nome-display');
            if (nomeDisplay && state.profile) {
                nomeDisplay.textContent = state.profile.name || "Seu Nome";
            }
            const levelBadge = document.getElementById('perfil-level-badge');
            if (levelBadge) {
                const gamification = app.ensureGamificationState();
                const overall = app.getOverallLevelProgress(gamification);
                const overallIdentity = app.getOverallLevelIdentity(overall.level);
                levelBadge.textContent = `NIVEL ${overall.level} - ${String(overallIdentity.name || 'Despertar').toUpperCase()}`;
            }
            app.ensureSettingsState();
            if (state.settings?.notificationsEnabled && !app._pushRevalidateInFlight) {
                const now = Date.now();
                if (!app._lastProfileNotificationRecheckAt || now - app._lastProfileNotificationRecheckAt > 30000) {
                    app._lastProfileNotificationRecheckAt = now;
                    setTimeout(() => app.revalidateNotificationState({ register: true, rerender: true }).catch(() => {}), 0);
                }
            }

            const profileImg = document.getElementById('profile-avatar-image');
            if (profileImg) {
                profileImg.src = state.profile.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDE4p8AoYVsz6pEXUcgS6BkD6ZMnpFej1qRvtAnjsOWWGCk7xJhzaMTg6eRpIrmf1nkexNBtrYL3KbuHY6ZwSPi-Kdj4ivoosw4MlhSqGkDRZeaWiu0ULKlO9WJofnhhFK3dg6DTg4IQBS1fYuInfMqPQH2xU1CoJ_kNGEuGwa-nEMQzBHm4jSNxfxVSNi8W5QYdVVAzvIMm62lcyjTcDnQkk9xlvlKrssjp1lApdoTVkjnhRL8luZ5XJaaZ8Tgexi6luLt5O1w6g';
            }
            app.renderProfileChrome();

            const notifKnob = document.getElementById('notif-toggle-knob');
            const notifTrack = document.getElementById('notif-toggle-track');
            if (notifTrack && notifKnob) {
                const on = !!state.settings.notificationsEnabled;
                notifTrack.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${on ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                notifKnob.className = `w-3 h-3 rounded-full absolute transition-all ${on ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }
            const pushStatus = document.getElementById('push-status-text');
            if (pushStatus) {
                const on = !!state.settings.notificationsEnabled;
                const permission = app.getNotificationPermission();
                if (permission === 'granted' && app.lastPushRegistrationOk === false && app.isPushPermissionError(app.lastPushRegistrationError)) {
                    app.lastPushRegistrationOk = null;
                    app.lastPushRegistrationError = '';
                }
                if (!on) {
                    if (permission === 'default') {
                        pushStatus.textContent = 'Desativadas. Ao ativar, o app vai pedir permissao.';
                        pushStatus.className = 'text-[10px] text-outline mt-1 leading-snug';
                    } else if (permission === 'denied') {
                        pushStatus.textContent = 'Desativadas. Permissao bloqueada no Android/Chrome.';
                        pushStatus.className = 'text-[10px] text-error mt-1 leading-snug';
                    } else {
                        pushStatus.textContent = 'Desativadas.';
                        pushStatus.className = 'text-[10px] text-outline mt-1 leading-snug';
                    }
                } else if (app.lastPushRegistrationOk === false) {
                    pushStatus.textContent = 'Ativas no app. Push em segundo plano pendente: ' + (app.lastPushRegistrationError || 'verifique permissoes do Android/Chrome.');
                    pushStatus.className = 'text-[10px] text-amber-500 mt-1 leading-snug';
                } else if (app.lastPushRegistrationOk === true) {
                    pushStatus.textContent = 'Ativas, incluindo push em segundo plano.';
                    pushStatus.className = 'text-[10px] text-emerald-500 mt-1 leading-snug';
                } else {
                    pushStatus.textContent = permission === 'granted' ? 'Ativas no app. Registrando push em segundo plano...' : 'Ativas no app; permissao ainda pendente.';
                    pushStatus.className = 'text-[10px] text-outline mt-1 leading-snug';
                }
            }

            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) themeSelect.value = state.settings.theme || 'auto';
            app.updateDayCapacityProfileControls();
            app.updateSplashSettingsControls();
            const soundTrack = document.getElementById('sound-toggle-track');
            const soundKnob = document.getElementById('sound-toggle-knob');
            if (soundTrack && soundKnob) {
                const soundOn = !!state.settings.soundEnabled;
                soundTrack.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${soundOn ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                soundKnob.className = `w-3 h-3 rounded-full absolute transition-all ${soundOn ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }
            app.renderGamificationProfile();
            app.renderAccountPanel();
            app.renderNotesPanel();
            app.renderManualGuide();
            if (app.renderSocialAccessPanel) app.renderSocialAccessPanel();
            app.updateProfileAppVersion();
        },

        social: function() {
            app.renderProfileChrome();
            if (app.renderSocialPrivacyPanel) app.renderSocialPrivacyPanel();
            if (app.renderSocialConnectionsPanel) app.renderSocialConnectionsPanel();
        },

        proposito: function() {
            const state = window.sistemaVidaState;
            app.renderPurposeJourney();

            // Limpa o banner de valores para evitar duplicidade visual
            const valuesBannerTop = document.getElementById('top-values-banner');
            if (valuesBannerTop) valuesBannerTop.innerHTML = '';

            // 1. Renderiza as barras PERMA exclusivamente aqui
            setTimeout(() => {
                try {
                    const container = document.getElementById('perma-charts-container');
                    if (!container) return;
                    container.innerHTML = '';

                    const permaData = [
                        { label: 'Emoções Positivas (P)', val: state.perma?.P || 0, color: 'bg-rose-500' },
                        { label: 'Engajamento (E)', val: state.perma?.E || 0, color: 'bg-orange-500' },
                        { label: 'Relacionamentos (R)', val: state.perma?.R || 0, color: 'bg-emerald-500' },
                        { label: 'Significado (M)', val: state.perma?.M || 0, color: 'bg-sky-500' },
                        { label: 'Realização (A)', val: state.perma?.A || 0, color: 'bg-violet-500' }
                    ];

                    permaData.forEach(item => {
                        const normalizedVal = app.normalizePermaScore(item.val);
                        const percentage = normalizedVal * 10;
                        const row = document.createElement('div');
                        row.className = 'space-y-2';
                        row.innerHTML = `
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-on-surface-variant">${item.label}</span>
                                <span class="text-xs font-bold text-primary">${normalizedVal.toFixed(1)}/10</span>
                            </div>
                            <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                <div class="h-full ${item.color} transition-all duration-1000" style="width: ${percentage}%"></div>
                            </div>
                        `;
                        container.appendChild(row);
                    });
                } catch(e) {
                    console.error('Erro ao renderizar barras PERMA em Propósito:', e);
                }
            }, 150);

            // 2. Renderização SWLS (score + histórico)
            setTimeout(() => {
                try {
                    app.normalizeSwlsState();
                    const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
                    const scoreEl = document.getElementById('swls-score');
                    const bandEl = document.getElementById('swls-band');
                    const dateEl = document.getElementById('swls-last-date');
                    const historyEl = document.getElementById('swls-history-list');
                    const insightEl = document.getElementById('swls-perma-insight');
                    const score = Number(swls.lastScore) || 0;
                    const permaVals = ['P', 'E', 'R', 'M', 'A'].map((k) => app.normalizePermaScore(state.perma?.[k]));
                    const permaAvg = permaVals.reduce((sum, n) => sum + n, 0) / permaVals.length;
                    const swlsEq10 = Math.round((score / 35) * 100) / 10;
                    const delta = Math.abs(permaAvg - swlsEq10);

                    if (scoreEl) scoreEl.textContent = `${score}/35`;
                    if (bandEl) bandEl.textContent = app.getSwlsBand(score);
                    if (dateEl) dateEl.textContent = swls.lastDate ? `Última avaliação: ${swls.lastDate}` : '';
                    if (insightEl) {
                        let insight = `PERMA médio ${permaAvg.toFixed(1)}/10 e SWLS equivalente ${swlsEq10.toFixed(1)}/10: leitura coerente.`;
                        if (delta >= 2) {
                            if (swlsEq10 > permaAvg) insight = `SWLS (${swlsEq10.toFixed(1)}/10) está acima do PERMA médio (${permaAvg.toFixed(1)}/10): investigue dimensões específicas do PERMA com notas baixas.`;
                            else insight = `PERMA médio (${permaAvg.toFixed(1)}/10) está acima do SWLS (${swlsEq10.toFixed(1)}/10): vale revisar satisfação global e expectativas de vida.`;
                        }
                        insightEl.textContent = insight;
                    }

                    if (historyEl) {
                        const entries = Object.entries(swls.history || {})
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 5);
                        if (entries.length === 0) {
                            historyEl.innerHTML = '<p class="text-xs text-outline italic">Sem histórico disponível.</p>';
                        } else {
                            historyEl.innerHTML = entries.map(([date, item]) => {
                                const val = Number(item?.score) || 0;
                                return `<div class="flex items-center justify-between text-xs border border-outline-variant/10 rounded-lg px-3 py-2">
                                    <span class="text-outline">${date}</span>
                                    <span class="font-bold text-primary">${val}/35</span>
                                </div>`;
                            }).join('');
                        }
                    }
                } catch (e) {
                    console.error('Erro ao renderizar SWLS em Propósito:', e);
                }
            }, 170);

            // Atualiza visibilidade de imagens e botões de Odyssey (sincronamente, sem delay)
            const prof = window.sistemaVidaState.profile || {};
            const odysseyImages = prof.odysseyImages || {};
            ['cenarioA', 'cenarioB', 'cenarioC'].forEach(key => {
                const img = document.getElementById(`odyssey-image-${key}`);
                const btn = document.getElementById(`odyssey-image-button-${key}`);
                if (!img) return;
                const src = odysseyImages[key] || '';
                const hasImage = Boolean(src && src.length > 10);
                if (hasImage) {
                    img.src = src;
                    img.classList.remove('hidden');
                } else {
                    img.src = '';
                    img.classList.add('hidden');
                }
                if (btn) {
                    btn.innerHTML = `
                        <span class="material-symbols-outlined notranslate text-[14px]">photo_camera</span>
                        <span class="hidden sm:inline">${hasImage ? 'Editar' : 'Inserir'}</span>
                    `;
                    btn.classList.remove('hidden');
                    // Garante que o botão seja sempre visível e destacado quando não há imagem
                    if (!hasImage) {
                        btn.classList.add('bg-primary', 'text-on-primary');
                        btn.classList.remove('bg-surface-container-high', 'text-on-surface');
                    } else {
                        btn.classList.remove('bg-primary', 'text-on-primary');
                        btn.classList.add('bg-surface-container-high', 'text-on-surface');
                    }
                }
            });

            // 3. Renderização de Textos do Propósito (Ikigai, Valores, Visão, Legado)
            setTimeout(() => {
                try {
                    const state = window.sistemaVidaState;
                    const profile = state.profile || {};
                    
                    // Controle de visibilidade da ferramenta de valores
                    const valuesTool = document.getElementById('values-selection-tool');
                    if (valuesTool) {
                        valuesTool.classList.add('hidden');
                    }

                    // Identidade Base (valores, forças e sombras)
                    window.app.renderIdentityBase();

                    // 3. Preenchimento de Textos do Perfil (Padrao de Exibicao)
                        // Helper para Placeholders (Standard Sênior)
                        const renderField = (id, val, placeholder) => {
                            const el = document.getElementById(id);
                            if (!el) return;
                            if (!val || val.trim() === "" || val === "Clique para definir") {
                                el.textContent = placeholder;
                                el.classList.remove('text-on-surface-variant');
                                el.classList.add('text-outline', 'opacity-40');
                            } else {
                                el.textContent = val;
                                el.classList.add('text-on-surface-variant');
                                el.classList.remove('text-outline', 'opacity-40');
                            }
                        };
                        
                        const prof = state.profile || {};
                        
                        // Ikigai (display-id)
                        renderField('display-ikigai-love', prof.ikigai.love, "O que você ama fazer?");
                        renderField('display-ikigai-good', prof.ikigai.good, "No que você é excelente?");
                        renderField('display-ikigai-need', prof.ikigai.need, "Do que o mundo precisa?");
                        renderField('display-ikigai-paid', prof.ikigai.paid, "Pelo que você pode ser pago?");
                        renderField('display-ikigai-paixao', prof.ikigai.paixao, "Onde amor e talento se encontram.");
                        renderField('display-ikigai-profissao', prof.ikigai.profissao, "Onde talento e sustento se encontram.");
                        renderField('display-ikigai-vocacao', prof.ikigai.vocacao, "Onde sustento e contribuição se encontram.");
                        renderField('display-ikigai-missao', prof.ikigai.missao, "Onde amor e necessidade do mundo se encontram.");
                        renderField('display-ikigai-sintese', prof.ikigai.sintese, "Sua síntese de vida em uma frase.");

                        // Visao (display-id)
                        renderField('display-vision-saude', prof.vision.saude, "Sua visão para o corpo e energia...");
                        renderField('display-vision-carreira', prof.vision.carreira, "Sua visão para trabalho e sustento...");
                        renderField('display-vision-intelecto', prof.vision.intelecto, "Sua visão para a mente e o espírito...");
                        renderField('display-vision-quote', prof.vision.quote, "Uma frase que te define...");

                        // Legado (display-id)
                        renderField('display-legacy-familia', prof.legacyObj.familia, "Como você quer ser lembrado pelos seus?");
                        renderField('display-legacy-profissao', prof.legacyObj.profissao, "Qual obra você quer deixar no mercado?");
                        renderField('display-legacy-mundo', prof.legacyObj.mundo, "Como sua passagem muda a sociedade?");

                        // Odyssey Plan (Novas Chaves Consolidadas)
                        renderField('display-cenarioA', prof.odyssey.cenarioA, "Cenário A: Descreva aqui sua visão de 5 anos (Vida Atual)...");
                        renderField('display-cenarioB', prof.odyssey.cenarioB, "Cenário B: Descreva aqui sua visão de 5 anos (Plano B)...");
                        renderField('display-cenarioC', prof.odyssey.cenarioC, "Cenário C: Descreva aqui sua visão de 5 anos (Vida Radical)...");
                        const odysseyTitles = prof.odysseyTitles || {};
                        const setOdysseyTitle = (id, value, fallback) => {
                            const titleEl = document.getElementById(id);
                            if (!titleEl) return;
                            titleEl.textContent = value && value.trim() ? value : fallback;
                        };
                        setOdysseyTitle('odyssey-title-cenarioA', odysseyTitles.cenarioA, 'Cenário A');
                        setOdysseyTitle('odyssey-title-cenarioB', odysseyTitles.cenarioB, 'Cenário B');
                        setOdysseyTitle('odyssey-title-cenarioC', odysseyTitles.cenarioC, 'Cenário C');
                } catch(e) {
                    console.error("Erro ao renderizar textos do Propósito:", e);
                }
            }, 150);

            // Render SVG Roda da Vida
            try {
                app.normalizeDimensionsState();
                app.updateWheelPolygon();
            } catch (e) {
                console.error("Erro na renderização das barras PERMA ou Roda da Vida:", e);
            }

            const topValuesContainer = document.getElementById('top-values-banner');

            // Render Sliders UI
            const slidersContainer = document.getElementById('roda-sliders');
            if (slidersContainer) {
                let html = '';
                for (const dim of app.getWheelAxes()) {
                    const data = state.dimensions[dim] || { score: 1 };
                    html += `
                    <div class="flex flex-col gap-1 w-full">
                        <div class="flex justify-between items-center text-[10px] font-label uppercase tracking-widest">
                            <span class="text-outline font-bold">${dim}</span>
                            <span class="text-primary font-bold">${data.score}</span>
                        </div>
                        <input type="range" min="1" max="100" value="${data.score}" class="w-full accent-primary h-1 bg-surface-container-high rounded-full appearance-none cursor-pointer" oninput="app.updateDimensionVisual('${dim}', this.value); this.previousElementSibling.lastElementChild.textContent=this.value" onchange="app.saveState()">
                    </div>`;
                }
                slidersContainer.innerHTML = html;
            }


        },
    },
    });
}
