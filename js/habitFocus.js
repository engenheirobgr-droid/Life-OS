function normalizeFocusNoteToken(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function buildFocusClosureBody({ habit, protocol, micro, focusSec, delivery, evidence, gaps, nextStep, noteSubject = '' }) {
    const lines = [];
    const subjectKey = normalizeFocusNoteToken(noteSubject);
    const habitKey = normalizeFocusNoteToken(habit?.title);
    const microKey = normalizeFocusNoteToken(micro?.title);
    const deliveryKey = normalizeFocusNoteToken(delivery);
    if (habit?.title && habitKey && habitKey !== subjectKey) lines.push(`Origem: hábito ${habit.title}`);
    if (protocol?.title) lines.push(`Protocolo: ${protocol.title}`);
    if (micro?.title && microKey && microKey !== subjectKey && microKey !== deliveryKey) lines.push(`Ação do plano: ${micro.title}`);
    if (focusSec > 0) lines.push(`Tempo de foco: ${Math.max(1, Math.round(focusSec / 60))} min`);
    if (delivery && deliveryKey !== subjectKey && deliveryKey !== microKey) lines.push('', 'Entrega concreta', delivery);
    if (evidence) lines.push('', 'Evidência', evidence);
    if (gaps) lines.push('', 'Dúvidas e lacunas', gaps);
    if (nextStep) lines.push('', 'Próximo passo', nextStep);
    return lines.join('\n');
}

export function attachHabitFocusModule(app) {
    Object.assign(app, {
        canStartFocusFromHabit: function(habit) {
            return !!habit?.id;
        },

        getHabitFocusEligibleMacros: function(habit) {
            if (!habit?.linkedMetaId) return [];
            const state = window.sistemaVidaState || {};
            const macros = (state.entities?.macros || []).filter(item => item?.id && item.status !== 'abandoned');
            const okrs = state.entities?.okrs || [];
            const habitDim = String(habit.dimension || '').trim().toLowerCase();
            const resolveMetaId = (macro) => {
                if (!macro) return '';
                if (macro.metaId) return String(macro.metaId);
                const okr = okrs.find(item => item.id === macro.okrId);
                return String(okr?.metaId || '');
            };
            return macros.filter(item => {
                if (resolveMetaId(item) !== String(habit.linkedMetaId)) return false;
                const macroDim = String(item.dimension || '').trim().toLowerCase();
                if (!habitDim || !macroDim || habitDim === 'geral' || macroDim === 'geral') return true;
                return macroDim === habitDim;
            });
        },

        buildHabitFocusMacroLabel: function(macro) {
            const state = window.sistemaVidaState;
            const okr = (state.entities?.okrs || []).find(item => item.id === macro.okrId);
            const meta = (state.entities?.metas || []).find(item => item.id === (macro.metaId || okr?.metaId));
            return [macro?.title, okr?.title, meta?.title].filter(Boolean).join(' - ');
        },

        selectDeepWorkHabit: function(habitId, options = {}) {
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState;
            const dw = state.deepWork;
            if (dw.isRunning && String(dw.habitId || '') !== String(habitId || '')) {
                this.showToast('Finalize ou pause o bloco atual antes de trocar de hábito.', 'error');
                if (this.currentView !== 'foco') this.navigate?.('foco');
                return;
            }
            const habit = (state.habits || []).find(item => item.id === habitId);
            if (!habit) {
                dw.habitId = '';
                if (!dw.isRunning) dw.intention = dw.microId ? (dw.intention || '') : '';
                if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
                return;
            }
            if (!this.canStartFocusFromHabit(habit)) {
                this.showToast('Esse hábito ainda não está pronto para abrir uma sessão de foco.', 'error');
                return;
            }
            dw.habitId = habit.id;
            if (!dw.isRunning) {
                dw.microId = '';
                dw.intention = habit.title || '';
                const suggestedMinutes = this.getSuggestedHabitFocusPresetMinutes?.(habit)
                    || Math.max(5, Number(this.getHabitEstimatedMinutes?.(habit)) || 25);
                this.applyDeepWorkPresetConfig(suggestedMinutes);
                if (options.autoStart) {
                    this.pendingFocusMicroId = '';
                    this.pendingFocusHabitId = habit.id;
                    this.pendingFocusAutoStart = true;
                    this.pendingFocusMinutes = suggestedMinutes;
                    this.saveState(false);
                    if (options.navigate !== false) this.navigate?.('foco');
                    return;
                }
            }
            this.syncDeepWorkContextSelectorFromState?.();
            if (options.autoStart && !dw.isRunning) {
                const contextSelect = document.getElementById('deep-work-context');
                if (contextSelect) contextSelect.value = `habit:${habit.id}`;
                this.startDeepWorkSession();
                return;
            }
            this.saveState(false);
            if (options.navigate !== false) this.navigate?.('foco');
            if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
        },

        clearDeepWorkHabitSelection: function() {
            this.normalizeDeepWorkState();
            const dw = window.sistemaVidaState.deepWork;
            if (dw.isRunning) return;
            dw.habitId = '';
            if (!dw.microId) dw.intention = '';
            this.syncDeepWorkContextSelectorFromState?.();
            if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
            this.saveState(false);
        },

        openHabitFocusModal: function(habitId) {
            this.normalizeDeepWorkState();
            if (window.sistemaVidaState.deepWork?.pendingClosure?.microId || window.sistemaVidaState.deepWork?.pendingClosure?.habitId) {
                this.showToast('Existe uma sessão anterior aguardando fechamento.', 'error');
                this.openHabitFocusClosureModal?.();
                return;
            }
            if (this.enforceDeepWorkInteractionLock?.('A sessão de foco está ativa. Finalize, pause ou reinicie antes de abrir outro fluxo.')) return;
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) {
                this.showToast('Hábito não encontrado.', 'error');
                return;
            }
            this.selectDeepWorkHabit(habit.id, { navigate: true });
            this.showToast(`Hábito "${habit.title}" selecionado no Foco para configuração.`, 'success');
        },

        startFocusFromHabitDirect: function(habitId) {
            this.normalizeDeepWorkState();
            const dw = window.sistemaVidaState?.deepWork || {};
            if (dw.pendingClosure?.microId || dw.pendingClosure?.habitId) {
                this.showToast('Existe uma sessão anterior aguardando fechamento.', 'error');
                this.openHabitFocusClosureModal?.();
                return;
            }
            if (this.enforceDeepWorkInteractionLock?.('A sessão de foco está ativa. Finalize, pause ou reinicie antes de iniciar outro bloco.')) return;
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) {
                this.showToast('Hábito não encontrado.', 'error');
                return;
            }
            this.selectDeepWorkHabit(habit.id, { navigate: true, autoStart: true });
        },

        closeHabitFocusModal: function() {
            const modal = document.getElementById('habit-focus-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        startHabitFocusSession: function() {
            this.startDeepWorkSession();
        },

        refreshHabitFocusClosureHabitState: function(habitId = '', dateKey = '') {
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal || modal.classList.contains('hidden')) return;
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState || {};
            const closure = state.deepWork?.pendingClosure;
            if (!closure?.microId && !closure?.habitId) return;
            const micro = closure.microId ? (state.entities?.micros || []).find(item => item.id === closure.microId) : null;
            const resolvedHabitId = String(habitId || closure.habitId || micro?.sourceHabitId || '').trim();
            const habit = resolvedHabitId ? (state.habits || []).find(item => item.id === resolvedHabitId) : null;
            const resolvedDateKey = String(dateKey || '').trim()
                || (closure.sessionEndedAtTs ? this.getLocalDateKey(new Date(closure.sessionEndedAtTs)) : this.getLocalDateKey());
            const habitSteps = this.getHabitResolvedSteps?.(habit) || [];
            const habitProgress = habit ? this.getHabitTodayProgressSnapshot?.(habit, resolvedDateKey) : null;
            const mode = this.normalizeHabitTrackMode?.(habit?.trackMode) || 'boolean';
            const isTimerHabit = habit && mode === 'timer';
            const isBooleanHabit = habit && mode === 'boolean' && !habitSteps.length;
            const habitSummaryEl = document.getElementById('habit-focus-closure-habit-summary');
            const checklistEl = document.getElementById('habit-focus-closure-habit-checklist');
            const habitCompleteWrapEl = document.getElementById('habit-focus-closure-habit-complete-wrap');
            const habitCompleteEl = document.getElementById('habit-focus-closure-habit-complete');
            if (habitSummaryEl) {
                if (habit && habitProgress) {
                    const summaryBits = [`Progresso hoje: ${habitProgress.label}`];
                    if (isTimerHabit) summaryBits.push(`Meta diária: ${Math.max(1, Math.round(Number(habit.targetValue) || 0))} min`);
                    if (habitProgress.done) summaryBits.push('Concluído hoje');
                    habitSummaryEl.textContent = summaryBits.join(' | ');
                    habitSummaryEl.classList.remove('hidden');
                } else {
                    habitSummaryEl.textContent = '';
                    habitSummaryEl.classList.add('hidden');
                }
            }
            if (checklistEl) {
                const checklistHtml = habitSteps.length ? this.renderHabitFocusClosureChecklistHTML(habit, resolvedDateKey) : '';
                checklistEl.innerHTML = checklistHtml;
                checklistEl.classList.toggle('hidden', !checklistHtml);
            }
            if (habitCompleteWrapEl && habitCompleteEl) {
                if (isBooleanHabit) {
                    habitCompleteWrapEl.classList.remove('hidden');
                    habitCompleteEl.checked = !!habitProgress?.done;
                    const label = document.getElementById('habit-focus-closure-habit-complete-label');
                    if (label) label.textContent = 'Concluir hábito hoje';
                } else {
                    habitCompleteWrapEl.classList.add('hidden');
                    habitCompleteEl.checked = false;
                }
            }
        },

        createFocusMicroFromHabit: function({ habit, macroId, title, focusSec = 0, sessionPresetMinutes = 0, dateKey = '', markDone = false }) {
            const state = window.sistemaVidaState;
            const macro = (state.entities?.macros || []).find(item => item.id === macroId);
            if (!habit || !macro) return null;
            const okr = (state.entities?.okrs || []).find(item => item.id === macro.okrId);
            const resolvedDimension = String(
                this.getResolvedPlanDimension?.(macro, 'macros')
                || macro.dimension
                || ''
            ).trim();
            if (!resolvedDimension) return null;
            const now = new Date();
            const safeDate = dateKey || this.getLocalDateKey(now);
            const frozenSchedule = this.getHabitScheduleContext?.(habit) || { startTime: '' };
            const frozenSessionMinutes = Math.max(0, Math.round(Number(sessionPresetMinutes) || 0));
            const micro = {
                id: `micro_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                title: String(title || '').trim(),
                dimension: resolvedDimension,
                context: `Ação derivada do hábito ${habit.title}.`,
                indicator: `Gerada a partir de sessão de foco do hábito ${habit.title}.`,
                effort: 'medio',
                obstacle: '',
                ifThen: '',
                inicioDate: safeDate,
                prazo: safeDate,
                startTime: String(frozenSchedule.startTime || '').trim(),
                macroId: macro.id,
                okrId: macro.okrId || '',
                metaId: macro.metaId || okr?.metaId || '',
                status: markDone ? 'done' : 'in_progress',
                completed: !!markDone,
                progress: markDone ? 100 : 0,
                estimatedMinutes: frozenSessionMinutes,
                focusBlockMinutes: frozenSessionMinutes,
                focusSec: Math.max(0, Number(focusSec) || 0),
                focusSessions: focusSec > 0 ? 1 : 0,
                lastFocusDate: safeDate,
                steps: [],
                stepLogs: {},
                protocolId: '',
                sourceHabitId: habit.id,
                sourceProtocolId: String(habit.protocolId || ''),
                sourceType: 'habit_focus_session',
                createdAt: now.toISOString()
            };
            if (markDone) micro.completedDate = safeDate;
            state.entities.micros.unshift(micro);
            return micro;
        },

        patchLatestHabitFocusSession: function({ sessionEndedAtTs = '', habitId = '', micro = null }) {
            if (!sessionEndedAtTs || !micro?.id) return;
            const sessions = window.sistemaVidaState?.deepWork?.sessions || [];
            const target = sessions.find((session) =>
                String(session?.endedAtTs || '') === String(sessionEndedAtTs)
                && String(session?.habitId || '') === String(habitId || '')
                && !String(session?.microId || '').trim()
            ) || sessions.find((session) =>
                String(session?.endedAtTs || '') === String(sessionEndedAtTs)
                && !String(session?.microId || '').trim()
            );
            if (!target) return;
            target.microId = micro.id;
            target.microTitle = micro.title || '';
        },

        recordHabitFocusExecution: function(habitId, focusSec = 0, dateKey = null) {
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) return;
            const targetDate = dateKey || this.getLocalDateKey();
            const normalizedMode = this.normalizeHabitTrackMode?.(habit.trackMode) || String(habit.trackMode || 'boolean').toLowerCase();
            const minutes = Math.max(0, Math.round((Number(focusSec || 0) / 60) * 10) / 10);
            const currentValue = Math.max(0, Number(habit.logs?.[targetDate]) || 0);
            if (normalizedMode === 'timer') {
                if (minutes <= 0) return;
                this.updateHabitLog(habitId, targetDate, currentValue + minutes);
            }
        },

        renderHabitFocusClosureChecklistHTML: function(habit, dateKey) {
            const steps = this.getHabitResolvedSteps?.(habit) || [];
            if (!habit || !steps.length) return '';
            const stepMap = (habit.stepLogs && habit.stepLogs[dateKey]) || {};
            const doneCount = steps.reduce((acc, _, idx) => acc + (stepMap[idx] || stepMap[String(idx)] ? 1 : 0), 0);
            const allDone = doneCount === steps.length;
            const completion = this.getHabitCompletionState?.(habit, dateKey);
            const helperCopy = completion?.requiresTime
                ? 'Passos e tempo registrados definem se o hábito fecha hoje.'
                : 'Passos concluídos definem se o hábito fecha hoje.';
            return `
                <div class="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4 space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[10px] uppercase tracking-widest font-bold text-outline">Checklist do hábito</p>
                            <p class="mt-1 text-xs text-on-surface-variant">${this.escapeHtml(helperCopy)}</p>
                        </div>
                        <button type="button" onclick="window.app.toggleHabitAllSteps('${this.escapeHtml(habit.id)}','${dateKey}',${allDone ? 'true' : 'false'})" class="shrink-0 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-surface-container-high transition-colors">
                            ${allDone ? 'Reabrir passos' : 'Concluir passos'}
                        </button>
                    </div>
                    <div class="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-2.5 space-y-1.5">
                        ${steps.map((step, idx) => {
                            const done = !!(stepMap[idx] || stepMap[String(idx)]);
                            return `
                                <button type="button" onclick="window.app.toggleHabitStepLog('${this.escapeHtml(habit.id)}','${dateKey}',${idx})" class="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${done ? 'bg-primary/8 text-primary' : 'hover:bg-surface-container-high text-on-surface'}">
                                    <span class="w-4 h-4 rounded-full border-2 ${done ? 'bg-primary border-primary' : 'border-outline-variant'} flex items-center justify-center shrink-0">
                                        ${done ? '<span class="material-symbols-outlined notranslate text-white text-[10px]">check</span>' : ''}
                                    </span>
                                    <span class="text-xs leading-relaxed ${done ? 'line-through text-outline' : 'text-on-surface-variant'}">${this.escapeHtml(step)}</span>
                                </button>`;
                        }).join('')}
                    </div>
                    <p class="text-[10px] text-outline">${doneCount}/${steps.length} passos concluídos hoje.</p>
                </div>`;
        },

        toggleHabitFocusClosureDetails: function() {
            const panel = document.getElementById('habit-focus-closure-details-panel');
            const icon = document.getElementById('habit-focus-closure-details-icon');
            if (!panel) return;
            const opening = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !opening);
            if (icon) icon.textContent = opening ? 'expand_less' : 'expand_more';
        },

        toggleHabitFocusClosurePlan: function() {
            const check = document.getElementById('habit-focus-closure-plan-toggle');
            const panel = document.getElementById('habit-focus-closure-plan-panel');
            if (!check || !panel) return;
            panel.classList.toggle('hidden', !check.checked);
        },

        openHabitFocusClosureModal: function() {
            this.normalizeDeepWorkState();
            const closure = window.sistemaVidaState.deepWork?.pendingClosure;
            if (!closure?.microId && !closure?.habitId) return;
            const state = window.sistemaVidaState;
            const micro = closure.microId ? (state.entities?.micros || []).find(item => item.id === closure.microId) : null;
            const habit = closure.habitId
                ? (state.habits || []).find(item => item.id === closure.habitId)
                : (micro?.sourceHabitId ? (state.habits || []).find(item => item.id === micro.sourceHabitId) : null);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal) return;

            const dateKey = closure.sessionEndedAtTs
                ? this.getLocalDateKey(new Date(closure.sessionEndedAtTs))
                : this.getLocalDateKey();
            const habitSteps = this.getHabitResolvedSteps?.(habit) || [];
            const habitProgress = habit ? this.getHabitTodayProgressSnapshot?.(habit, dateKey) : null;
            const eligibleMacros = habit ? this.getHabitFocusEligibleMacros(habit) : [];
            const preferredMacroId = String(habit?.preferredFocusMacroId || '').trim();
            const resolvedPreferredMacro = eligibleMacros.find(item => item.id === preferredMacroId)?.id || eligibleMacros[0]?.id || '';
            const isTimerHabit = habit && (this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean') === 'timer';
            const isBooleanHabit = habit && (this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean') === 'boolean' && !habitSteps.length;

            document.getElementById('habit-focus-closure-title').textContent = micro?.title || habit?.title || 'Fechar sessão';
            document.getElementById('habit-focus-closure-subtitle').textContent = micro
                ? 'A sessão foi registrada. Agora decida apenas o que fechar.'
                : 'A sessão foi registrada. Agora finalize o que realmente aconteceu.';
            document.getElementById('habit-focus-closure-context').textContent = [
                habit?.title ? `Hábito: ${habit.title}` : '',
                protocol?.title ? `Protocolo: ${protocol.title}` : '',
                closure.focusSec ? `Tempo: ${Math.max(1, Math.round(Number(closure.focusSec || 0) / 60))} min` : ''
            ].filter(Boolean).join(' | ');

            const evidenceEl = document.getElementById('habit-focus-closure-evidence');
            const gapsEl = document.getElementById('habit-focus-closure-gaps');
            const nextStepEl = document.getElementById('habit-focus-closure-next-step');
            const planToggleEl = document.getElementById('habit-focus-closure-plan-toggle');
            const planPanelEl = document.getElementById('habit-focus-closure-plan-panel');
            const planHelperEl = document.getElementById('habit-focus-closure-plan-helper');
            const planMacroEl = document.getElementById('habit-focus-closure-plan-macro');
            const planTitleEl = document.getElementById('habit-focus-closure-plan-title');
            const planCompleteEl = document.getElementById('habit-focus-closure-plan-complete');
            const planWrapEl = document.getElementById('habit-focus-closure-plan-wrap');
            const existingCompleteWrapEl = document.getElementById('habit-focus-closure-existing-complete-wrap');
            const existingCompleteEl = document.getElementById('habit-focus-closure-existing-complete');
            const habitCompleteWrapEl = document.getElementById('habit-focus-closure-habit-complete-wrap');
            const habitCompleteEl = document.getElementById('habit-focus-closure-habit-complete');
            const habitSummaryEl = document.getElementById('habit-focus-closure-habit-summary');
            const checklistEl = document.getElementById('habit-focus-closure-habit-checklist');
            const detailsPanelEl = document.getElementById('habit-focus-closure-details-panel');
            const detailsIconEl = document.getElementById('habit-focus-closure-details-icon');

            if (evidenceEl) evidenceEl.value = '';
            if (gapsEl) gapsEl.value = '';
            if (nextStepEl) nextStepEl.value = '';
            if (planTitleEl) planTitleEl.value = '';
            if (planCompleteEl) planCompleteEl.checked = false;
            if (existingCompleteEl) existingCompleteEl.checked = false;
            if (habitCompleteEl) habitCompleteEl.checked = false;
            if (planToggleEl) planToggleEl.checked = false;
            if (planPanelEl) planPanelEl.classList.add('hidden');
            if (detailsPanelEl) detailsPanelEl.classList.add('hidden');
            if (detailsIconEl) detailsIconEl.textContent = 'expand_more';

            if (habitSummaryEl) {
                if (habit && habitProgress) {
                    const summaryBits = [`Progresso hoje: ${habitProgress.label}`];
                    if (isTimerHabit) summaryBits.push(`Meta diaria: ${Math.max(1, Math.round(Number(habit.targetValue) || 0))} min`);
                    if (habitProgress.done) summaryBits.push('Concluído hoje');
                    habitSummaryEl.textContent = summaryBits.join(' | ');
                    habitSummaryEl.classList.remove('hidden');
                } else {
                    habitSummaryEl.textContent = '';
                    habitSummaryEl.classList.add('hidden');
                }
            }

            if (checklistEl) {
                const checklistHtml = habitSteps.length ? this.renderHabitFocusClosureChecklistHTML(habit, dateKey) : '';
                checklistEl.innerHTML = checklistHtml;
                checklistEl.classList.toggle('hidden', !checklistHtml);
            }

            if (habitCompleteWrapEl && habitCompleteEl) {
                if (isBooleanHabit) {
                    habitCompleteWrapEl.classList.remove('hidden');
                    habitCompleteEl.checked = !!habitProgress?.done;
                    const label = document.getElementById('habit-focus-closure-habit-complete-label');
                    if (label) label.textContent = 'Concluir hábito hoje';
                } else {
                    habitCompleteWrapEl.classList.add('hidden');
                    habitCompleteEl.checked = false;
                }
            }

            if (existingCompleteWrapEl && existingCompleteEl) {
                existingCompleteWrapEl.classList.toggle('hidden', !micro);
                existingCompleteEl.checked = false;
            }

            if (planWrapEl) {
                planWrapEl.classList.toggle('hidden', !!micro);
            }

            if (planToggleEl && planPanelEl && planMacroEl && planHelperEl) {
                const canCreatePlanAction = !micro && !!habit?.linkedMetaId && eligibleMacros.length > 0;
                planToggleEl.disabled = !canCreatePlanAction;
                planToggleEl.checked = false;
                planPanelEl.classList.add('hidden');
                if (!canCreatePlanAction) {
                    if (micro) {
                        planHelperEl.textContent = 'Esta sessão já está vinculada a uma ação do plano. Use "Concluir ação atual agora" se quiser fechar a ação existente.';
                    } else if (!habit?.linkedMetaId) {
                        planHelperEl.textContent = 'Este hábito não está vinculado a uma meta. A sessão será salva como histórico e nota.';
                    } else if (!eligibleMacros.length) {
                        planHelperEl.textContent = 'Não há entregas compatíveis nessa meta para criar uma ação agora.';
                    } else {
                        planHelperEl.textContent = 'A ação do plano já existe nesta sessão.';
                    }
                } else {
                    planHelperEl.textContent = 'Abra esta parte só se a sessão realmente gerou uma entrega concreta do plano.';
                }
                planMacroEl.innerHTML = eligibleMacros.length
                    ? eligibleMacros.map((macro) =>
                        `<option value="${this.escapeHtml(macro.id)}" ${macro.id === resolvedPreferredMacro ? 'selected' : ''}>${this.escapeHtml(this.buildHabitFocusMacroLabel(macro))}</option>`
                    ).join('')
                    : '<option value="">Nenhuma entrega compatível</option>';
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                const planToggle = document.getElementById('habit-focus-closure-plan-toggle');
                if (planToggle && !planToggle.disabled) {
                    planToggle.focus();
                    return;
                }
                document.getElementById('habit-focus-closure-details-toggle')?.focus();
            }, 30);
        },

        closeHabitFocusClosureModal: function() {
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        saveHabitFocusClosure: function() {
            this.ensureNotesState();
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState;
            const dw = state.deepWork || {};
            const closure = state.deepWork?.pendingClosure;
            if (!closure?.microId && !closure?.habitId) {
                this.closeHabitFocusClosureModal();
                return;
            }

            const micro = closure.microId ? (state.entities?.micros || []).find(item => item.id === closure.microId) : null;
            const habit = closure.habitId
                ? (state.habits || []).find(item => item.id === closure.habitId)
                : (micro?.sourceHabitId ? (state.habits || []).find(item => item.id === micro.sourceHabitId) : null);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const dateKey = closure.sessionEndedAtTs
                ? this.getLocalDateKey(new Date(closure.sessionEndedAtTs))
                : this.getLocalDateKey();
            const focusMinutes = Math.max(1, Math.round(Number(closure.focusSec || 0) / 60));
            const evidence = String(document.getElementById('habit-focus-closure-evidence')?.value || '').trim();
            const gaps = String(document.getElementById('habit-focus-closure-gaps')?.value || '').trim();
            const nextStep = String(document.getElementById('habit-focus-closure-next-step')?.value || '').trim();
            const shouldCreatePlanAction = !!document.getElementById('habit-focus-closure-plan-toggle')?.checked;
            const planMacroId = String(document.getElementById('habit-focus-closure-plan-macro')?.value || '').trim();
            const planTitle = String(document.getElementById('habit-focus-closure-plan-title')?.value || '').trim();
            const shouldCompleteCreatedMicro = !!document.getElementById('habit-focus-closure-plan-complete')?.checked;
            const shouldCompleteExistingMicro = !!document.getElementById('habit-focus-closure-existing-complete')?.checked;
            const shouldCompleteBooleanHabit = !!document.getElementById('habit-focus-closure-habit-complete')?.checked;
            const habitSteps = this.getHabitResolvedSteps?.(habit) || [];
            let createdMicro = null;

            if (habit) {
                const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
                if (!habitSteps.length) {
                    if (mode === 'boolean' && shouldCompleteBooleanHabit) {
                        this.updateHabitLog(habit.id, dateKey, 1);
                    } else if (mode === 'numeric' && shouldCompleteBooleanHabit) {
                        const currentValue = Math.max(0, Number(habit.logs?.[dateKey]) || 0);
                        this.updateHabitLog(habit.id, dateKey, currentValue + 1);
                    }
                }
            }

            if (shouldCreatePlanAction) {
                if (!habit?.linkedMetaId) {
                    this.showToast('Vincule o hábito a uma meta antes de criar uma ação do plano.', 'error');
                    return;
                }
                if (!planMacroId) {
                    this.showToast('Escolha a entrega que vai receber esta ação.', 'error');
                    return;
                }
                if (!planTitle) {
                    this.showToast('Descreva a ação concreta gerada por esta sessão.', 'error');
                    return;
                }
                createdMicro = this.createFocusMicroFromHabit({
                    habit,
                    macroId: planMacroId,
                    title: planTitle,
                    focusSec: Number(closure.focusSec || 0),
                    sessionPresetMinutes: focusMinutes,
                    dateKey,
                    markDone: false
                });
                if (!createdMicro) {
                    this.showToast('Não foi possível criar a ação: a entrega selecionada está sem área válida.', 'error');
                    return;
                }
                habit.preferredFocusMacroId = planMacroId;
                this.patchLatestHabitFocusSession({
                    sessionEndedAtTs: closure.sessionEndedAtTs,
                    habitId: habit.id,
                    micro: createdMicro
                });
            }

            const shouldCreateClosureNote = !!(createdMicro || evidence || gaps || nextStep);
            if (shouldCreateClosureNote) {
                const noteSubject = (createdMicro || micro || habit)?.title || 'Registro';
                const linkedEntity = createdMicro
                    ? { entityType: 'micros', entityId: createdMicro.id }
                    : (micro
                        ? { entityType: 'micros', entityId: micro.id }
                        : (habit ? { entityType: 'habits', entityId: habit.id } : null));
                const noteBody = buildFocusClosureBody({
                    habit,
                    protocol,
                    micro: createdMicro || micro,
                    focusSec: Number(closure.focusSec || 0),
                    delivery: createdMicro?.title || '',
                    evidence,
                    gaps,
                    nextStep,
                    noteSubject
                });

                state.profile.notes.unshift({
                    id: `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                    title: `Foco: ${noteSubject}`,
                    body: noteBody,
                    url: '',
                    tags: ['foco', habit ? 'habito' : 'micro', protocol?.title ? protocol.title.toLowerCase() : ''].filter(Boolean),
                    linkedTo: linkedEntity,
                    sourceType: 'habit_focus_session',
                    sourceHabitId: habit?.id || '',
                    sourceMicroId: (createdMicro?.id || micro?.id || ''),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            state.deepWork.pendingClosure = null;
            this.closeHabitFocusClosureModal();

            if (shouldCompleteExistingMicro && micro && micro.status !== 'done') {
                this.completeMicroAction(micro.id);
            }
            if (createdMicro && shouldCompleteCreatedMicro) {
                this.completeMicroAction(createdMicro.id);
            }

            this.saveState(true);
            if (dw.isRunning && dw.mode === 'break') {
                this.renderDeepWorkImmersiveOverlay?.();
            } else {
                if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
                if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
                if (this.currentView === 'habitos' && this.render?.habitos) this.render.habitos();
                if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
            }
            this.showToast('Fechamento da sessão registrado.', 'success');
        },

        remindHabitFocusClosureLater: function() {
            this.normalizeDeepWorkState();
            const dw = window.sistemaVidaState?.deepWork || {};
            this.closeHabitFocusClosureModal();
            this.saveState(true);
            this.showToast('Tudo bem. O fechamento ficou pendente para voce retomar depois.', 'success');
            if (dw.isRunning && dw.mode === 'break') this.renderDeepWorkImmersiveOverlay?.();
            else if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
            else this.renderDeepWorkImmersiveOverlay?.();
        }
    });
}
