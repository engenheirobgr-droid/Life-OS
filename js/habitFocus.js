function buildFocusClosureBody({ habit, protocol, micro, focusSec, delivery, evidence, gaps, nextStep }) {
    const lines = [];
    if (habit?.title) lines.push(`Origem: habito ${habit.title}`);
    if (protocol?.title) lines.push(`Protocolo: ${protocol.title}`);
    if (micro?.title) lines.push(`Acao do plano: ${micro.title}`);
    if (focusSec > 0) lines.push(`Tempo de foco: ${Math.max(1, Math.round(focusSec / 60))} min`);
    if (delivery) lines.push('', 'Entrega', delivery);
    if (evidence) lines.push('', 'Evidencia', evidence);
    if (gaps) lines.push('', 'Duvidas e lacunas', gaps);
    if (nextStep) lines.push('', 'Proximo passo', nextStep);
    return lines.join('\n');
}

export function attachHabitFocusModule(app) {
    Object.assign(app, {
        canStartFocusFromHabit: function(habit) {
            return !!habit?.id;
        },

        getHabitFocusEligibleMacros: function(habit) {
            const state = window.sistemaVidaState || {};
            const macros = (state.entities?.macros || []).filter((item) => item?.id && item.status !== 'abandoned');
            if (!habit) return macros;
            const okrs = state.entities?.okrs || [];
            const habitDim = String(habit.dimension || '').trim().toLowerCase();
            const resolveMetaId = (macro) => {
                if (!macro) return '';
                if (macro.metaId) return String(macro.metaId);
                const okr = okrs.find((item) => item.id === macro.okrId);
                return String(okr?.metaId || '');
            };

            if (habit.linkedMetaId) {
                return macros.filter((item) => {
                    if (resolveMetaId(item) !== String(habit.linkedMetaId)) return false;
                    const macroDim = String(item.dimension || '').trim().toLowerCase();
                    if (habitDim && macroDim && macroDim !== habitDim) return false;
                    return true;
                });
            }

            if (habitDim) {
                return macros.filter((item) => String(item.dimension || '').trim().toLowerCase() === habitDim);
            }

            return [];
        },

        buildHabitFocusMacroLabel: function(macro) {
            const state = window.sistemaVidaState || {};
            const okr = (state.entities?.okrs || []).find((item) => item.id === macro.okrId);
            const meta = (state.entities?.metas || []).find((item) => item.id === (macro.metaId || okr?.metaId));
            return [macro.title, okr?.title, meta?.title].filter(Boolean).join(' - ');
        },

        openHabitFocusModal: function(habitId) {
            this.normalizeDeepWorkState();
            if (window.sistemaVidaState.deepWork?.pendingClosure?.microId || window.sistemaVidaState.deepWork?.pendingClosure?.habitId) {
                this.showToast('Existe uma sessao anterior esperando fechamento.', 'error');
                this.openHabitFocusClosureModal?.();
                return;
            }
            const habit = (window.sistemaVidaState?.habits || []).find((item) => item.id === habitId);
            if (!habit) {
                this.showToast('Habito nao encontrado.', 'error');
                return;
            }
            if (!this.canStartFocusFromHabit(habit)) {
                this.showToast('Esse habito ainda nao esta pronto para abrir uma sessao de foco.', 'error');
                return;
            }

            const modal = document.getElementById('habit-focus-modal');
            const macroSelect = document.getElementById('habit-focus-macro');
            if (!modal || !macroSelect) return;

            const macros = this.getHabitFocusEligibleMacros(habit);
            const linkedMeta = habit.linkedMetaId
                ? (window.sistemaVidaState?.entities?.metas || []).find((item) => item.id === habit.linkedMetaId)
                : null;
            const protocol = habit.protocolId ? this.getProtocolById?.(habit.protocolId) : null;
            const suggestedMinutes = Math.max(15, Number(this.getHabitEstimatedMinutes?.(habit)) || 25);
            const presetConfig = this.getDeepWorkPresetConfig?.(suggestedMinutes) || { minutes: 25 };

            document.getElementById('habit-focus-habit-id').value = habit.id;
            document.getElementById('habit-focus-title').textContent = habit.title || 'Sessao de foco';
            document.getElementById('habit-focus-delivery').value = '';
            document.getElementById('habit-focus-minutes').value = String(presetConfig.minutes);
            document.getElementById('habit-focus-helper').textContent = macros.length
                ? 'Voce pode iniciar uma sessao simples agora. Se houver entrega concreta no final, transforme em acao do plano no fechamento.'
                : 'Voce pode iniciar uma sessao simples agora. Se ainda nao houver Macro compativel, a sessao sera registrada sem criar acao.';

            const contextEl = document.getElementById('habit-focus-context');
            if (contextEl) {
                const normalizedMode = this.normalizeHabitTrackMode?.(habit.trackMode) || String(habit.trackMode || '').trim().toLowerCase();
                contextEl.textContent = [
                    habit.dimension ? `Area: ${habit.dimension}` : '',
                    linkedMeta?.title ? `Meta: ${linkedMeta.title}` : '',
                    protocol?.title ? `Protocolo: ${protocol.title}` : '',
                    habit.targetValue && normalizedMode === 'timer' ? `Meta por execucao: ${Math.round(Number(habit.targetValue) || 0)} min` : ''
                ].filter(Boolean).join(' | ');
            }

            macroSelect.innerHTML = [
                '<option value="">Sessao simples (sem acao do plano)</option>',
                ...macros.map((macro) => `<option value="${this.escapeHtml(macro.id)}">${this.escapeHtml(this.buildHabitFocusMacroLabel(macro))}</option>`)
            ].join('');

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

        createFocusMicroFromHabit: function({ habit, macroId, title, estimatedMinutes = 0, focusBlockMinutes = 0 }) {
            const state = window.sistemaVidaState;
            const macro = (state.entities?.macros || []).find((item) => item.id === macroId);
            if (!habit || !macro) return null;
            const okr = (state.entities?.okrs || []).find((item) => item.id === macro.okrId);
            const now = new Date();
            const today = this.getLocalDateKey(now);
            const inheritedSteps = this.getHabitResolvedSteps?.(habit) || [];
            const totalEstimatedMinutes = Math.max(0, Math.round(Number(estimatedMinutes) || 0));
            const sessionPresetMinutes = Math.max(0, Math.round(Number(focusBlockMinutes) || 0));
            const micro = {
                id: `micro_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                title: String(title || '').trim(),
                dimension: macro.dimension || habit.dimension || '',
                context: `Entrega registrada a partir do habito ${habit.title}.`,
                indicator: `Sessao de foco vinculada ao habito ${habit.title}.`,
                effort: 'medio',
                obstacle: '',
                ifThen: '',
                inicioDate: today,
                prazo: today,
                startTime: String(habit.startTime || '').trim(),
                macroId: macro.id,
                okrId: macro.okrId || '',
                metaId: macro.metaId || okr?.metaId || '',
                status: 'in_progress',
                completed: false,
                progress: 0,
                estimatedMinutes: totalEstimatedMinutes,
                focusBlockMinutes: sessionPresetMinutes,
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

        recordHabitFocusExecution: function(habitId, focusSec = 0, dateKey = null) {
            const habit = (window.sistemaVidaState?.habits || []).find((item) => item.id === habitId);
            if (!habit) return;
            const targetDate = dateKey || this.getLocalDateKey();
            const normalizedMode = this.normalizeHabitTrackMode?.(habit.trackMode) || String(habit.trackMode || 'boolean').toLowerCase();
            const isTimerMode = normalizedMode === 'timer';
            const hasChecklist = (this.getHabitResolvedSteps?.(habit) || []).length > 0;
            const minutes = Math.max(0, Math.round((Number(focusSec || 0) / 60) * 10) / 10);
            const currentValue = Math.max(0, Number(habit.logs?.[targetDate]) || 0);
            if (isTimerMode) {
                if (minutes <= 0) return;
                this.updateHabitLog(habitId, targetDate, currentValue + minutes);
                return;
            }
            if (hasChecklist) return;
            if (normalizedMode === 'numeric') {
                this.updateHabitLog(habitId, targetDate, currentValue + 1);
                return;
            }
            this.updateHabitLog(habitId, targetDate, 1);
        },

        startHabitFocusSession: function() {
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState;
            const dw = state.deepWork;
            if (dw.pendingClosure?.microId || dw.pendingClosure?.habitId) {
                this.showToast('Feche a sessao anterior antes de iniciar um novo bloco.', 'error');
                this.openHabitFocusClosureModal?.();
                return;
            }

            const habitId = String(document.getElementById('habit-focus-habit-id')?.value || '').trim();
            const macroId = String(document.getElementById('habit-focus-macro')?.value || '').trim();
            const rawDelivery = String(document.getElementById('habit-focus-delivery')?.value || '').trim();
            const rawMinutes = Math.round(Number(document.getElementById('habit-focus-minutes')?.value || 25));
            const preset = this.getDeepWorkPresetConfig?.(rawMinutes) || { minutes: 25, targetSec: 1500, breakSec: 300 };
            const habit = (state.habits || []).find((item) => item.id === habitId);
            if (!habit) {
                this.showToast('Habito nao encontrado para iniciar o foco.', 'error');
                return;
            }

            dw.targetSec = Number(preset.targetSec || (preset.minutes || 25) * 60);
            dw.remainingSec = dw.targetSec;
            dw.breakSec = Number(preset.breakSec || 300);
            dw.mode = 'focus';
            dw.microId = '';
            dw.habitId = habit.id;
            dw.habitFocusMacroId = macroId;
            dw.habitFocusDelivery = rawDelivery;
            dw.intention = rawDelivery || habit.title || '';
            dw.isRunning = true;
            dw.isPaused = false;
            dw.lastTickAt = Date.now();
            dw.deadlineAtMs = dw.lastTickAt + (dw.remainingSec * 1000);
            dw.pendingClosure = null;

            this.closeHabitFocusModal();
            this.ensureDeepWorkTicking();
            this.saveState(true);
            this.navigate?.('foco');
            if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
            else this.renderDeepWorkImmersiveOverlay?.();
        },

        openHabitFocusClosureModal: function() {
            this.normalizeDeepWorkState();
            const closure = window.sistemaVidaState.deepWork?.pendingClosure;
            if (!closure?.microId && !closure?.habitId) return;
            const state = window.sistemaVidaState;
            const micro = closure.microId ? (state.entities?.micros || []).find((item) => item.id === closure.microId) : null;
            const habit = closure.habitId
                ? (state.habits || []).find((item) => item.id === closure.habitId)
                : (micro?.sourceHabitId ? (state.habits || []).find((item) => item.id === micro.sourceHabitId) : null);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const modal = document.getElementById('habit-focus-closure-modal');
            if (!modal) return;

            const macroGroup = document.getElementById('habit-focus-closure-macro-group');
            const macroSelect = document.getElementById('habit-focus-closure-macro');
            const secondaryBtn = document.getElementById('habit-focus-closure-secondary-btn');
            const primaryBtn = document.getElementById('habit-focus-closure-primary-btn');
            const hasLinkedMicro = !!micro;
            const macroOptions = habit ? this.getHabitFocusEligibleMacros(habit) : [];

            document.getElementById('habit-focus-closure-title').textContent = micro?.title || habit?.title || 'Fechar sessao';
            document.getElementById('habit-focus-closure-subtitle').textContent = hasLinkedMicro
                ? (habit?.title ? `Sessao encerrada a partir do habito ${habit.title}.` : 'Sessao encerrada. Registre a entrega antes de seguir.')
                : 'Sessao encerrada. Voce pode salvar como sessao simples ou transformar a entrega em acao do plano.';
            document.getElementById('habit-focus-closure-delivery').value = micro?.title || closure.deliveryTitle || '';
            document.getElementById('habit-focus-closure-evidence').value = '';
            document.getElementById('habit-focus-closure-gaps').value = '';
            document.getElementById('habit-focus-closure-next-step').value = '';

            const closureContextEl = document.getElementById('habit-focus-closure-context');
            if (closureContextEl) {
                closureContextEl.textContent = [
                    protocol?.title ? `Protocolo: ${protocol.title}` : '',
                    closure.focusSec ? `Tempo: ${Math.max(1, Math.round(Number(closure.focusSec || 0) / 60))} min` : '',
                    hasLinkedMicro ? 'Fechamento com acao ja criada.' : 'Fechamento sem acao criada.'
                ].filter(Boolean).join(' | ');
            }

            if (macroGroup && macroSelect) {
                if (hasLinkedMicro || !habit) {
                    macroGroup.classList.add('hidden');
                    macroSelect.innerHTML = '<option value="">Sem macro</option>';
                } else {
                    macroGroup.classList.remove('hidden');
                    macroSelect.innerHTML = [
                        '<option value="">Escolha a Macro para transformar em ação</option>',
                        ...macroOptions.map((macro) => `<option value="${this.escapeHtml(macro.id)}">${this.escapeHtml(this.buildHabitFocusMacroLabel(macro))}</option>`)
                    ].join('');
                    if (closure.macroId && macroSelect.querySelector(`option[value="${closure.macroId}"]`)) {
                        macroSelect.value = closure.macroId;
                    }
                }
            }

            if (secondaryBtn) {
                secondaryBtn.textContent = hasLinkedMicro ? 'Salvar apenas nota' : 'Salvar sessao';
                secondaryBtn.onclick = () => this.saveHabitFocusClosure({ mode: 'session' });
            }
            if (primaryBtn) {
                primaryBtn.textContent = hasLinkedMicro ? 'Salvar e concluir' : 'Transformar em acao';
                primaryBtn.onclick = () => this.saveHabitFocusClosure({ mode: hasLinkedMicro ? 'complete_existing' : 'create_action' });
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

        resolveHabitFocusClosureMacroId: function() {
            const selectValue = String(document.getElementById('habit-focus-closure-macro')?.value || '').trim();
            if (selectValue) return selectValue;
            const closure = window.sistemaVidaState.deepWork?.pendingClosure;
            return String(closure?.macroId || '').trim();
        },

        saveHabitFocusClosure: function(options = {}) {
            this.ensureNotesState();
            this.normalizeDeepWorkState();
            const state = window.sistemaVidaState;
            const closure = state.deepWork?.pendingClosure;
            if (!closure?.microId && !closure?.habitId) {
                this.closeHabitFocusClosureModal();
                return;
            }

            const mode = String(options.mode || 'session').trim();
            const existingMicro = closure.microId ? (state.entities?.micros || []).find((item) => item.id === closure.microId) : null;
            const habit = closure.habitId
                ? (state.habits || []).find((item) => item.id === closure.habitId)
                : (existingMicro?.sourceHabitId ? (state.habits || []).find((item) => item.id === existingMicro.sourceHabitId) : null);
            const protocol = closure.protocolId ? this.getProtocolById?.(closure.protocolId) : null;
            const delivery = String(document.getElementById('habit-focus-closure-delivery')?.value || '').trim();
            const evidence = String(document.getElementById('habit-focus-closure-evidence')?.value || '').trim();
            const gaps = String(document.getElementById('habit-focus-closure-gaps')?.value || '').trim();
            const nextStep = String(document.getElementById('habit-focus-closure-next-step')?.value || '').trim();

            let linkedMicro = existingMicro || null;
            if (mode === 'create_action') {
                if (!habit) {
                    this.showToast('Nao foi possivel identificar o habito de origem desta sessao.', 'error');
                    return;
                }
                const macroId = this.resolveHabitFocusClosureMacroId();
                if (!macroId) {
                    this.showToast('Escolha a Macro que deve receber esta entrega.', 'error');
                    return;
                }
                const microTitle = delivery || closure.deliveryTitle || habit.title || '';
                if (!microTitle) {
                    this.showToast('Descreva a entrega concreta antes de transformar em acao.', 'error');
                    return;
                }
                const estimatedMinutes = Math.max(0, Number(this.getHabitEstimatedMinutes?.(habit)) || 0);
                const focusBlockMinutes = Math.max(1, Math.round(Number(closure.focusSec || 0) / 60));
                linkedMicro = this.createFocusMicroFromHabit({
                    habit,
                    macroId,
                    title: microTitle,
                    estimatedMinutes,
                    focusBlockMinutes
                });
                if (!linkedMicro) {
                    this.showToast('Nao foi possivel criar a acao do plano para esta sessao.', 'error');
                    return;
                }
                linkedMicro.focusSec = Math.max(0, Number(linkedMicro.focusSec) || 0) + Math.max(0, Number(closure.focusSec) || 0);
                linkedMicro.focusSessions = Math.max(0, Number(linkedMicro.focusSessions) || 0) + 1;
                linkedMicro.lastFocusDate = this.getLocalDateKey(new Date(String(closure.sessionEndedAtTs || new Date().toISOString())));
                const todayKey = this.getLocalDateKey();
                if (Array.isArray(linkedMicro.steps) && linkedMicro.steps.length) {
                    if (!linkedMicro.stepLogs || typeof linkedMicro.stepLogs !== 'object') linkedMicro.stepLogs = {};
                    if (!linkedMicro.stepLogs[todayKey] || typeof linkedMicro.stepLogs[todayKey] !== 'object') linkedMicro.stepLogs[todayKey] = {};
                    linkedMicro.steps.forEach((_, idx) => {
                        linkedMicro.stepLogs[todayKey][idx] = true;
                    });
                }
            }

            const noteBody = buildFocusClosureBody({
                habit,
                protocol,
                micro: linkedMicro,
                focusSec: Number(closure.focusSec || 0),
                delivery,
                evidence,
                gaps,
                nextStep
            });

            const nowIso = new Date().toISOString();
            const noteLinkType = linkedMicro ? 'micros' : (habit ? 'habits' : '');
            const noteLinkId = linkedMicro?.id || habit?.id || '';
            state.profile.notes.unshift({
                id: `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                title: `Sessao de foco - ${linkedMicro?.title || habit?.title || 'registro'}`,
                body: noteBody,
                url: '',
                tags: ['foco', 'habito', linkedMicro ? 'acao' : 'sessao'].filter(Boolean),
                linkedTo: noteLinkType && noteLinkId ? { entityType: noteLinkType, entityId: noteLinkId } : null,
                createdAt: nowIso,
                updatedAt: nowIso
            });

            state.deepWork.pendingClosure = null;
            state.deepWork.habitFocusMacroId = '';
            state.deepWork.habitFocusDelivery = '';
            state.deepWork.habitId = '';
            this.closeHabitFocusClosureModal();

            if (mode === 'complete_existing' && linkedMicro && linkedMicro.status !== 'done') {
                this.completeMicroAction(linkedMicro.id);
            } else if (mode === 'create_action' && linkedMicro) {
                this.completeMicroAction(linkedMicro.id);
            } else {
                this.saveState(true);
                if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
                if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
                if (this.currentView === 'painel' && this.render?.painel) this.render.painel();
            }

            const successMessage = mode === 'create_action'
                ? 'Sessao registrada e transformada em acao do plano.'
                : (mode === 'complete_existing' ? 'Fechamento da sessao registrado e acao concluida.' : 'Fechamento da sessao registrado.');
            this.showToast(successMessage, 'success');
        },

        remindHabitFocusClosureLater: function() {
            this.closeHabitFocusClosureModal();
            this.showToast('Tudo bem. O fechamento ficou pendente para voce retomar depois.', 'success');
            if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
        }
    });
}
