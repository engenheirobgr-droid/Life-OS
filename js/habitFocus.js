function buildFocusClosureBody({ habit, protocol, micro, focusSec, delivery, evidence, gaps, nextStep }) {
    const lines = [];
    if (habit?.title) lines.push(`Origem: hábito ${habit.title}`);
    if (protocol?.title) lines.push(`Protocolo: ${protocol.title}`);
    if (micro?.title) lines.push(`Entrega planejada: ${micro.title}`);
    if (focusSec > 0) lines.push(`Tempo de foco: ${Math.max(1, Math.round(focusSec / 60))} min`);
    if (delivery) lines.push('', 'Entrega', delivery);
    if (evidence) lines.push('', 'Evidência', evidence);
    if (gaps) lines.push('', 'Dúvidas e lacunas', gaps);
    if (nextStep) lines.push('', 'Próximo passo', nextStep);
    return lines.join('\n');
}

export function attachHabitFocusModule(app) {
    Object.assign(app, {
        canStartFocusFromHabit: function(habit) {
            if (!habit?.id) return false;
            const hasMetaLink = !!habit.linkedMetaId;
            const hasProtocol = !!habit.protocolId;
            const hasChecklist = Array.isArray(habit.steps) && habit.steps.length > 0;
            const isTimed = String(habit.trackMode || '') === 'timer';
            const estimatedMinutes = Math.max(0, Number(this.getHabitEstimatedMinutes?.(habit)) || 0);
            const hasEstimatedLoad = estimatedMinutes > 0;
            return hasMetaLink && (isTimed || hasProtocol || hasChecklist || hasEstimatedLoad);
        },

        getHabitFocusEligibleMacros: function(habit) {
            const macros = (window.sistemaVidaState?.entities?.macros || []).filter(item => item?.id && item.status !== 'abandoned');
            if (!habit?.linkedMetaId) return macros;
            const linked = macros.filter(item => item.metaId === habit.linkedMetaId);
            return linked.length ? linked : macros;
        },

        buildHabitFocusMacroLabel: function(macro) {
            const state = window.sistemaVidaState;
            const okr = (state.entities?.okrs || []).find(item => item.id === macro.okrId);
            const meta = (state.entities?.metas || []).find(item => item.id === (macro.metaId || okr?.metaId));
            const trail = [macro.title, okr?.title, meta?.title].filter(Boolean);
            return trail.join(' - ');
        },

        openHabitFocusModal: function(habitId) {
            this.normalizeDeepWorkState();
            if (window.sistemaVidaState.deepWork?.pendingClosure?.microId) {
                this.showToast('Existe uma sessao anterior esperando fechamento.', 'error');
                this.openHabitFocusClosureModal?.();
                return;
            }
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) {
                this.showToast('Hábito não encontrado.', 'error');
                return;
            }
            if (!this.canStartFocusFromHabit(habit)) {
                this.showToast('Esse hábito ainda não está pronto para abrir uma sessão de foco.', 'error');
                return;
            }
            const macros = this.getHabitFocusEligibleMacros(habit);
            if (!macros.length) {
                this.showToast('Crie ao menos uma macro vinculada à meta desse hábito antes de iniciar foco.', 'error');
                return;
            }

            const modal = document.getElementById('habit-focus-modal');
            const macroSelect = document.getElementById('habit-focus-macro');
            if (!modal || !macroSelect) return;
            const linkedMeta = habit.linkedMetaId
                ? (window.sistemaVidaState?.entities?.metas || []).find(item => item.id === habit.linkedMetaId)
                : null;
            const protocol = habit.protocolId ? this.getProtocolById?.(habit.protocolId) : null;

            document.getElementById('habit-focus-habit-id').value = habit.id;
            document.getElementById('habit-focus-title').textContent = habit.title || 'Sessão de foco';
            document.getElementById('habit-focus-delivery').value = '';
            const suggestedMinutes = Number(this.getHabitEstimatedMinutes?.(habit)) || 25;
            const presetConfig = this.getDeepWorkPresetConfig?.(suggestedMinutes) || { minutes: 25 };
            document.getElementById('habit-focus-minutes').value = String(presetConfig.minutes);
            document.getElementById('habit-focus-helper').textContent = habit.protocolId
                ? 'Defina a entrega desta sessao. O protocolo ja organiza os passos do habito.'
                : 'Defina a entrega desta sessao e vincule-a a uma macro para o plano avancar.';
            const contextEl = document.getElementById('habit-focus-context');
            if (contextEl) {
                contextEl.textContent = [
                    linkedMeta?.title ? `Meta: ${linkedMeta.title}` : '',
                    protocol?.title ? `Protocolo: ${protocol.title}` : '',
                    habit.targetValue && String(habit.trackMode || '') === 'timer' ? `Meta por execucao: ${Math.round(Number(habit.targetValue) || 0)} min` : ''
                ].filter(Boolean).join(' | ');
            }

            macroSelect.innerHTML = macros.map((macro) =>
                `<option value="${this.escapeHtml(macro.id)}">${this.escapeHtml(this.buildHabitFocusMacroLabel(macro))}</option>`
            ).join('');

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => document.getElementById('habit-focus-delivery')?.focus(), 30);
        },

        closeHabitFocusModal: function() {
            const modal = document.getElementById('habit-focus-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        createFocusMicroFromHabit: function({ habit, macroId, title, estimatedMinutes = 0 }) {
            const state = window.sistemaVidaState;
            const macro = (state.entities?.macros || []).find(item => item.id === macroId);
            if (!habit || !macro) return null;
            const now = new Date();
            const today = this.getLocalDateKey(now);
            const protocol = habit.protocolId ? this.getProtocolById?.(habit.protocolId) : null;
            const habitSteps = Array.isArray(habit.steps) ? habit.steps.map(step => String(step || '').trim()).filter(Boolean) : [];
            const protocolSteps = Array.isArray(protocol?.steps) ? protocol.steps.map(step => String(step?.title || '').trim()).filter(Boolean) : [];
            const inheritedSteps = habitSteps.length ? habitSteps : protocolSteps;
            const micro = {
                id: `micro_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                title: String(title || '').trim(),
                dimension: habit.dimension || macro.dimension || 'Carreira',
                context: `Entrega gerada a partir do hábito ${habit.title}.`,
                indicator: `Sessão de foco vinculada ao hábito ${habit.title}.`,
                effort: 'medio',
                obstacle: '',
                ifThen: '',
                inicioDate: today,
                prazo: today,
                startTime: String(habit.startTime || '').trim(),
                macroId: macro.id,
                okrId: macro.okrId || '',
                metaId: macro.metaId || '',
                status: 'in_progress',
                completed: false,
                progress: 0,
                estimatedMinutes: Math.max(0, Math.round(Number(estimatedMinutes) || 0)),
                focusSec: 0,
                focusSessions: 0,
                steps: inheritedSteps,
                stepLogs: {},
                protocolId: String(habit.protocolId || ''),
                sourceHabitId: habit.id,
                sourceProtocolId: habit.protocolId || '',
                sourceType: 'habit_focus_session',
                createdAt: now.toISOString()
            };
            if (inheritedSteps.length) micro.stepLogs[today] = {};
            state.entities.micros.unshift(micro);
            return micro;
        },

        recordHabitFocusExecution: function(habitId, focusSec = 0) {
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) return;
            const today = this.getLocalDateKey();
            const mode = String(habit.trackMode || 'boolean');
            const normalizedMode = mode.toLowerCase();
            const isTimerMode = ['timer', 'time', 'tempo', 'minutes', 'minutos'].includes(normalizedMode);
            const minutes = Math.max(0, Math.round((Number(focusSec || 0) / 60) * 10) / 10);
            const currentValue = Math.max(0, Number(habit.logs?.[today]) || 0);
            if (isTimerMode) {
                if (minutes <= 0) return;
                this.updateHabitLog(habitId, today, currentValue + minutes);
                return;
            }
            // For non-timer habits, focus sessions do not auto-complete progress.
            // They still generate micro output and notes in the focus flow.
            return;
        },

        startHabitFocusSession: function() {
            const habitId = String(document.getElementById('habit-focus-habit-id')?.value || '').trim();
            const macroId = String(document.getElementById('habit-focus-macro')?.value || '').trim();
            const rawTitle = String(document.getElementById('habit-focus-delivery')?.value || '').trim();
            const rawMinutes = Math.round(Number(document.getElementById('habit-focus-minutes')?.value || 25));
            const minutes = this.getDeepWorkPresetConfig?.(rawMinutes)?.minutes || 25;
            const habit = (window.sistemaVidaState?.habits || []).find(item => item.id === habitId);
            if (!habit) {
                this.showToast('Hábito não encontrado para iniciar o foco.', 'error');
                return;
            }
            if (!macroId) {
                this.showToast('Escolha a macro que receberá a entrega desta sessão.', 'error');
                return;
            }
            if (!rawTitle) {
                this.showToast('Descreva o que você pretende entregar nesta sessão.', 'error');
                return;
            }
            const micro = this.createFocusMicroFromHabit({ habit, macroId, title: rawTitle, estimatedMinutes: minutes });
            if (!micro) {
                this.showToast('Não foi possível criar a micro da sessão.', 'error');
                return;
            }

            const dw = window.sistemaVidaState.deepWork;
            this.normalizeDeepWorkState();
            dw.targetSec = minutes * 60;
            dw.remainingSec = dw.targetSec;
            dw.mode = 'focus';
            dw.pendingClosure = null;
            this.pendingFocusMinutes = minutes;

            this.closeHabitFocusModal();
            this.saveState(true);
            this.openMicroInFocus(micro.id, true, { presetMinutes: minutes });
        },

        openHabitFocusClosureModal: function() {
            this.normalizeDeepWorkState();
            const closure = window.sistemaVidaState.deepWork?.pendingClosure;
            if (!closure?.microId) return;
            const state = window.sistemaVidaState;
            const micro = (state.entities?.micros || []).find(item => item.id === closure.microId);
            if (!micro) return;
            const habit = (state.habits || []).find(item => item.id === closure.habitId);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal) return;

            document.getElementById('habit-focus-closure-title').textContent = micro.title || 'Fechar sessão';
            document.getElementById('habit-focus-closure-subtitle').textContent = habit?.title
                ? `Sessão encerrada a partir do hábito ${habit.title}.`
                : 'Sessão encerrada. Registre a entrega antes de seguir.';
            document.getElementById('habit-focus-closure-delivery').value = micro.title || '';
            document.getElementById('habit-focus-closure-evidence').value = '';
            document.getElementById('habit-focus-closure-gaps').value = '';
            document.getElementById('habit-focus-closure-next-step').value = '';
            const todayKey = this.getLocalDateKey();
            const microSteps = Array.isArray(micro.steps) ? micro.steps.filter(Boolean) : [];
            const microStepMap = (micro.stepLogs && typeof micro.stepLogs === 'object') ? (micro.stepLogs[todayKey] || {}) : {};
            const doneSteps = microSteps.reduce((acc, _, idx) => acc + (microStepMap[idx] || microStepMap[String(idx)] ? 1 : 0), 0);
            const closureContextEl = document.getElementById('habit-focus-closure-context');
            if (closureContextEl) {
                closureContextEl.textContent = [
                    protocol?.title ? `Protocolo: ${protocol.title}` : '',
                    closure.focusSec ? `Tempo: ${Math.max(1, Math.round(Number(closure.focusSec || 0) / 60))} min` : '',
                    microSteps.length ? `Passos: ${doneSteps}/${microSteps.length}` : ''
                ].filter(Boolean).join(' | ');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => document.getElementById('habit-focus-closure-delivery')?.focus(), 30);
        },

        closeHabitFocusClosureModal: function() {
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        saveHabitFocusClosure: function(options = {}) {
            this.ensureNotesState();
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState;
            const closure = state.deepWork?.pendingClosure;
            if (!closure?.microId) {
                this.closeHabitFocusClosureModal();
                return;
            }

            const micro = (state.entities?.micros || []).find(item => item.id === closure.microId);
            if (!micro) {
                state.deepWork.pendingClosure = null;
                this.closeHabitFocusClosureModal();
                this.saveState(true);
                return;
            }

            const habit = (state.habits || []).find(item => item.id === closure.habitId);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const delivery = String(document.getElementById('habit-focus-closure-delivery')?.value || '').trim();
            const evidence = String(document.getElementById('habit-focus-closure-evidence')?.value || '').trim();
            const gaps = String(document.getElementById('habit-focus-closure-gaps')?.value || '').trim();
            const nextStep = String(document.getElementById('habit-focus-closure-next-step')?.value || '').trim();
            const shouldComplete = options.forceComplete === true;

            const noteBody = buildFocusClosureBody({
                habit,
                protocol,
                micro,
                focusSec: Number(closure.focusSec || 0),
                delivery,
                evidence,
                gaps,
                nextStep
            });

            const note = {
                id: `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                title: `Sessão de foco - ${micro.title}`,
                body: noteBody,
                url: '',
                tags: ['foco', 'habito', protocol?.title ? protocol.title.toLowerCase() : 'protocolo'].filter(Boolean),
                linkedTo: { entityType: 'micros', entityId: micro.id },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            state.profile.notes.unshift(note);
            this.ensureNotesState();
            state.deepWork.pendingClosure = null;
            this.closeHabitFocusClosureModal();

            if (shouldComplete && micro.status !== 'done') {
                this.completeMicroAction(micro.id);
            } else {
                this.saveState(true);
                if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
                if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
            }
            this.showToast('Fechamento da sessão registrado.', 'success');
        },

        remindHabitFocusClosureLater: function() {
            this.closeHabitFocusClosureModal();
            this.showToast('Tudo bem. O fechamento ficou pendente para você retomar depois.', 'success');
            if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
        }
    });
}
