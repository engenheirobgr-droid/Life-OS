export function attachPlanningModule(app) {
    Object.assign(app, {
positionCrudEstimatedGroup: function(type = '') {
        const estimatedGroup = document.getElementById('crud-estimated-group');
        if (!estimatedGroup) return;
        const normalized = String(type || '').toLowerCase();
        if (normalized === 'habits') {
            const anchor = document.getElementById('crud-habit-identity');
            if (anchor?.parentElement && estimatedGroup.parentElement === anchor.parentElement) {
                anchor.insertAdjacentElement('afterend', estimatedGroup);
            }
            return;
        }
        if (normalized === 'micros') {
            const anchor = document.getElementById('crud-effort-group') || document.getElementById('crud-parent-group');
            if (anchor?.parentElement && estimatedGroup.parentElement === anchor.parentElement) {
                anchor.insertAdjacentElement('afterend', estimatedGroup);
            }
        }
    },
onTypeChange: function(type) {
        const parentGroup = document.getElementById('crud-parent-group');
        const triggerGroup = document.getElementById('crud-trigger-container');
        const habitIdentityGroup = document.getElementById('crud-habit-identity');
        const habitStepsChecklistWrap = document.getElementById('habit-steps-checklist-wrap');
        const dimensionGroup = document.getElementById('crud-dimension-group');
        const contextGroup = document.getElementById('crud-context-group');
        const contextLabel = document.getElementById('crud-context-label');
        const contextInput = document.getElementById('crud-context');
        const triggerInput = document.getElementById('crud-trigger');
        const routineInput = document.getElementById('habit-routine');
        const rewardInput = document.getElementById('habit-reward');
        const habitControls = document.getElementById('crud-habit-controls');
        const microExecutionGroup = document.getElementById('crud-micro-execution-group');
        const habitContinuousRow = document.getElementById('habit-continuous-row');
        const habitReminderAdvanced = document.getElementById('habit-reminder-advanced');
        const woopGroup = document.getElementById('crud-woop-group');
        const metaHorizonGroup = document.getElementById('crud-meta-horizon-group');
        const successCriteriaGroup = document.getElementById('crud-success-criteria-group');
        const goalRigorGroup = document.getElementById('crud-goal-rigor-group');
        const keyResultsGroup = document.getElementById('crud-key-results-group');
        const effortGroup = document.getElementById('crud-effort-group');
        const estimatedGroup = document.getElementById('crud-estimated-group');
        const successCriteriaLabel = document.querySelector('label[for="crud-success-criteria"]');
        const setGroupVisible = (el, visible, displayMode = 'flex') => {
            if (!el) return;
            el.classList.toggle('hidden', !visible);
            el.classList.toggle('flex', visible && displayMode === 'flex');
            el.style.display = visible ? displayMode : 'none';
        };
        
        // Esconde tudo por padrão para resetar estado visual
        if (parentGroup) parentGroup.classList.add('hidden');
        setGroupVisible(triggerGroup, false);
        setGroupVisible(habitControls, false);
        setGroupVisible(microExecutionGroup, false);
        setGroupVisible(habitContinuousRow, false, 'block');
        setGroupVisible(habitReminderAdvanced, false);
        setGroupVisible(woopGroup, false);
        setGroupVisible(habitIdentityGroup, false);
        setGroupVisible(habitStepsChecklistWrap, false);
        setGroupVisible(successCriteriaGroup, false);
        setGroupVisible(goalRigorGroup, false);
        setGroupVisible(keyResultsGroup, false);
        setGroupVisible(effortGroup, false);
        setGroupVisible(estimatedGroup, false);
        if (metaHorizonGroup) metaHorizonGroup.classList.add('hidden');
        if (dimensionGroup) dimensionGroup.classList.remove('hidden'); // Dimensão visível quase sempre
        if (contextGroup) contextGroup.classList.remove('hidden');
        if (contextInput) contextInput.required = true;
        if (triggerInput) triggerInput.required = false;
        if (routineInput) routineInput.required = false;
        if (rewardInput) rewardInput.required = false;

        // Configura baseado no tipo
        if (type === 'habits') {
            this.positionCrudEstimatedGroup?.('habits');
            setGroupVisible(habitContinuousRow, true, 'block');
            setGroupVisible(triggerGroup, true);
            setGroupVisible(habitIdentityGroup, true);
            setGroupVisible(habitControls, true);
            setGroupVisible(estimatedGroup, true);
            setGroupVisible(habitReminderAdvanced, true);
            setGroupVisible(habitStepsChecklistWrap, !!this.editingEntity && this.editingEntity.type === 'habits');
            if (habitControls) {
                // Força atualização da visibilidade dos sub-campos baseando nos valores dos selects
                const modeInput = document.getElementById('habit-track-mode');
                if (modeInput) this.onHabitModeChange(modeInput.value);
                const freqInput = document.getElementById('habit-frequency');
                if (freqInput) this.onHabitFreqChange(freqInput.value);
                const reminderIntervalToggle = document.getElementById('habit-reminder-interval-enabled');
                if (reminderIntervalToggle) this.onHabitReminderIntervalToggle(!!reminderIntervalToggle.checked);
                if (typeof this.updateHabitReminderPreview === 'function') this.updateHabitReminderPreview();
            }
            this.populateHabitLinkedMeta();
            if (typeof this.populateHabitProtocolSelect === 'function') this.populateHabitProtocolSelect();
            this.syncHabitProtocolAuthorityUI?.(document.getElementById('habit-protocol')?.value || '');
            this.populateHabitIdentitySource();
            this.refreshCrudEstimatedFieldState?.('habits');
            if (contextGroup) contextGroup.classList.add('hidden');
            if (contextInput) contextInput.required = false;
            if (triggerInput) triggerInput.required = true;
            if (routineInput) routineInput.required = true;
            if (rewardInput) rewardInput.required = true;
            if (!this.editingEntity || this.editingEntity.type !== 'habits') {
                const checklist = document.getElementById('habit-steps-checklist');
                if (checklist) checklist.innerHTML = '<p class="text-[10px] text-outline px-1">Salve o hábito para usar checklist diário.</p>';
            }
        } else if (type === 'metas') {
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (metaHorizonGroup) metaHorizonGroup.classList.remove('hidden');
            setGroupVisible(successCriteriaGroup, true);
            setGroupVisible(goalRigorGroup, true, 'grid');
            if (successCriteriaLabel) successCriteriaLabel.textContent = 'Critério de Sucesso';
            if (contextLabel) contextLabel.textContent = 'Por que esta meta? (Propósito)';
            this.updateParentList(type);
        } else if (type === 'okrs') {
            if (parentGroup) parentGroup.classList.remove('hidden');
            setGroupVisible(successCriteriaGroup, true);
            setGroupVisible(goalRigorGroup, true, 'grid');
            setGroupVisible(keyResultsGroup, true);
            if (successCriteriaLabel) successCriteriaLabel.textContent = 'Critério / Meta do Projeto';
            if (contextGroup) contextGroup.classList.add('hidden');
            if (contextInput) contextInput.required = false;
            this.updateParentList(type);
        } else {
            // Entregas, Micros
            if (type === 'micros') this.positionCrudEstimatedGroup?.('micros');
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (successCriteriaLabel) successCriteriaLabel.textContent = 'Critério de Sucesso';
            if (contextLabel) contextLabel.textContent = 'Detalhes / Critério de Aceitação';
            if (type === 'micros') setGroupVisible(effortGroup, true);
            if (type === 'micros') setGroupVisible(estimatedGroup, true);
            if (type === 'micros') {
                setGroupVisible(microExecutionGroup, true);
                if (typeof this.populateMicroProtocolSelect === 'function') this.populateMicroProtocolSelect();
            }
            if (['macros', 'micros'].includes(type)) {
                if (woopGroup) {
                    woopGroup.classList.remove('hidden');
                    woopGroup.style.cssText = 'display: block;';
                }
                this.toggleCrudWoop(type === 'micros');
            }
            this.updateParentList(type);
            if (type === 'micros') this.refreshCrudEstimatedFieldState?.('micros');
        }

        // Seletor de propósito: apenas para metas
        const purposeSelectorGroup = document.getElementById('crud-purpose-selector-group');
        if (type === 'metas') {
            this.buildPurposeOptions();
        } else if (purposeSelectorGroup) {
            purposeSelectorGroup.classList.add('hidden');
            purposeSelectorGroup.style.display = 'none';
        }

        // Atualiza painel de propósito conforme o tipo selecionado
        const currentDimension = document.getElementById('crud-dimension')?.value || '';
        this.updatePurposePanel(currentDimension, type);

        // Alterna campo de prazo padrão vs. janela real (Projeto/macro/micro)
        const deadlineGroup = document.getElementById('prazo-deadline-group');
        const agendamentoGroup = document.getElementById('prazo-agendamento-group');
        const usaAgendamento = ['okrs', 'macros', 'micros'].includes(type);

        if (deadlineGroup) deadlineGroup.classList.toggle('hidden', usaAgendamento);
        if (agendamentoGroup) agendamentoGroup.classList.toggle('hidden', !usaAgendamento);

        // Para hábitos, a checkbox "contínuo" pode esconder o prazo novamente
        if (type === 'habits') {
            const continuousCheck = document.getElementById('habit-continuous');
            if (continuousCheck) this.onHabitContinuousChange(continuousCheck.checked);
        }

        // Defaults para datas reais no modal (Projeto/macro/micro)
        if (usaAgendamento) {
            const hoje = this.getLocalDateKey();
            const inicioInput = document.getElementById('crud-inicio-date');
            const prazoInput = document.getElementById('crud-prazo-date');
            if (inicioInput && !inicioInput.value) inicioInput.value = hoje;
            this.applyDefaultDeadlineByType(type, false);
        } else if (type === 'metas') {
            this.applyDefaultDeadlineByType(type, false);
        }

        // Toggle "Adicionar ao Plano da Semana" — apenas para micros com plano ativo
        let toggleWrap = document.getElementById('week-plan-toggle-wrap');
        if (type === 'micros') {
            const weekKey = this._getWeekKey();
            const hasActivePlan = !!(window.sistemaVidaState.weekPlans || {})[weekKey];
            if (hasActivePlan) {
                if (!toggleWrap) {
                    toggleWrap = document.createElement('div');
                    toggleWrap.id = 'week-plan-toggle-wrap';
                    toggleWrap.className = 'mt-3';
                    toggleWrap.innerHTML = `<label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <input type="checkbox" id="add-to-week-plan" class="accent-primary">
                        <div>
                            <p class="text-xs font-bold text-on-surface">Adicionar ao plano desta semana</p>
                            <p class="text-[10px] text-outline">Aparecerá nas ações comprometidas da semana</p>
                        </div>
                    </label>`;
                    if (agendamentoGroup && agendamentoGroup.parentNode) {
                        agendamentoGroup.parentNode.insertBefore(toggleWrap, agendamentoGroup.nextSibling);
                    }
                } else {
                    toggleWrap.classList.remove('hidden');
                }
                const editingMicroId = (this.editingEntity && this.editingEntity.type === 'micros') ? this.editingEntity.id : '';
                this.syncMicroWeekPlanToggle(editingMicroId);
            } else {
                if (toggleWrap) toggleWrap.classList.add('hidden');
            }
        } else {
            if (toggleWrap) toggleWrap.classList.add('hidden');
        }
    },

applyDefaultDeadlineByType: function(type, forceRecalc = false) {
        if (this.editingEntity) return;
        const today = this.getLocalDateKey();
        const addDays = (dateKey, days) => {
            const base = new Date(String(dateKey || today) + 'T00:00:00');
            base.setDate(base.getDate() + Number(days || 0));
            return this.getLocalDateKey(base);
        };
        const addYears = (dateKey, years) => {
            const base = new Date(String(dateKey || today) + 'T00:00:00');
            base.setFullYear(base.getFullYear() + Number(years || 0));
            return this.getLocalDateKey(base);
        };
        const setIfAllowed = (input, value) => {
            if (!input) return;
            if (forceRecalc || !input.value) input.value = value;
        };

        if (type === 'metas') {
            const horizonYears = Number(document.getElementById('crud-meta-horizon')?.value || 1);
            const years = Number.isFinite(horizonYears) && horizonYears > 0 ? horizonYears : 1;
            const deadlineInput = document.getElementById('create-prazo');
            setIfAllowed(deadlineInput, addYears(today, years));
            return;
        }

        if (!['okrs', 'macros', 'micros'].includes(type)) return;
        const inicioInput = document.getElementById('crud-inicio-date');
        const prazoInput = document.getElementById('crud-prazo-date');
        const startDate = String(inicioInput?.value || today);
        const offsets = { okrs: 90, macros: 30, micros: 7 };
        const offsetDays = offsets[type] || 0;
        setIfAllowed(prazoInput, addDays(startDate, offsetDays));
    },

finishMetaTrailWizard: function() {
        for (let step = 1; step <= 4; step++) {
            if (!this._validateMetaTrailStep(step)) {
                this.setMetaTrailStep(step);
                return;
            }
        }

        const meta = this._readTrailMeta();
        const okrs = this._readTrailOkrs().items;
        const macros = this._readTrailMacros().items;
        const micros = this._readTrailMicros().items;

        const state = window.sistemaVidaState;
        if (!state.entities) state.entities = { metas: [], okrs: [], macros: [], micros: [] };
        ['metas', 'okrs', 'macros', 'micros'].forEach(type => {
            if (!Array.isArray(state.entities[type])) state.entities[type] = [];
        });

        const makeId = () => `ent_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
        const todayKey = this.getLocalDateKey();

        const metaId = makeId();
        state.entities.metas.push({
            id: metaId,
            title: meta.title,
            dimension: meta.dimension,
            prazo: meta.prazo,
            createdAt: todayKey,
            purpose: meta.why,
            horizonYears: Number(meta.horizonYears || 1),
            successCriteria: meta.successCriteria || '',
            challengeLevel: Math.max(1, Math.min(5, Number(meta.challengeLevel || 3))),
            commitmentLevel: Math.max(1, Math.min(5, Number(meta.commitmentLevel || 3))),
            status: 'pending',
            progress: 0,
            completed: false
        });
        this.markCadence('lifeGoals', todayKey);

        const okrMap = {};
        okrs.forEach(okr => {
            const okrId = makeId();
            okrMap[okr.rowId] = okrId;
            const normalizedKrs = Array.isArray(okr.keyResults) ? this.normalizeKeyResultsList(okr.keyResults) : [];
            const krProgress = this.computeKeyResultsProgress(normalizedKrs);
            state.entities.okrs.push({
                id: okrId,
                metaId,
                title: okr.title,
                dimension: meta.dimension,
                inicioDate: okr.inicioDate || '',
                prazo: okr.prazo,
                createdAt: todayKey,
                purpose: okr.metric,
                successCriteria: okr.metric,
                challengeLevel: Math.max(1, Math.min(5, Number(okr.challengeLevel || 3))),
                commitmentLevel: Math.max(1, Math.min(5, Number(okr.commitmentLevel || 3))),
                keyResults: normalizedKrs,
                status: 'pending',
                progress: krProgress === null ? 0 : krProgress,
                completed: false
            });
        });

        const macroMap = {};
        macros.forEach(macro => {
            const macroId = makeId();
            macroMap[macro.rowId] = macroId;
            const okrId = okrMap[macro.okrRowId] || '';
            state.entities.macros.push({
                id: macroId,
                metaId,
                okrId,
                title: macro.title,
                dimension: meta.dimension,
                inicioDate: macro.inicioDate,
                prazo: macro.prazo,
                createdAt: todayKey,
                description: macro.description || '',
                purpose: meta.why || '',
                status: 'pending',
                progress: 0,
                completed: false
            });
        });

        const createdMicroIds = [];
        micros.forEach(micro => {
            const microId = makeId();
            const macroId = macroMap[micro.macroRowId] || '';
            const macro = state.entities.macros.find(m => m.id === macroId);
            state.entities.micros.push({
                id: microId,
                metaId,
                okrId: macro?.okrId || '',
                macroId,
                title: micro.title,
                dimension: meta.dimension,
                inicioDate: micro.inicioDate,
                prazo: micro.prazo,
                createdAt: todayKey,
                indicator: 'Primeiro passo da trilha',
                purpose: meta.why || '',
                status: 'pending',
                progress: 0,
                completed: false
            });
            createdMicroIds.push(microId);
        });

        this.normalizeEntitiesState();
        createdMicroIds.forEach(id => this.updateCascadeProgress(id, 'micros'));
        this._wizardPlanSuggestion = {
            microIds: createdMicroIds,
            intention: `Avançar meta: ${meta.title}`
        };

        this.closeMetaTrailWizard();
        this.saveState(false);
        this.showToast(`Trilha criada: 1 meta, ${okrs.length} projeto(s), ${macros.length} entrega(s) e ${micros.length} ${micros.length === 1 ? 'ação' : 'ações'}.`, 'success');

        if (this.currentView === 'planos' && this.render.planos) {
            this.render.planos();
            this.switchPlanosTab(this.planosActiveTab || 'metas');
        }
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();

        const openPlannerWhenReady = (attempt = 0) => {
            const hasWeeklyModal = !!document.getElementById('weekly-plan-modal');
            if (hasWeeklyModal) {
                this.switchPlanosTab('semanal');
                this.openWeeklyPlanModal();
                return;
            }
            if (attempt < 10) setTimeout(() => openPlannerWhenReady(attempt + 1), 150);
        };

        if (this.currentView !== 'planos') this.switchView('planos');
        setTimeout(() => openPlannerWhenReady(), this.currentView === 'planos' ? 80 : 450);
    },

_validateMetaTrailStep: function(step) {
        const s = Number(step || this.metaTrailStep || 1);
        if (s === 1) {
            const meta = this._readTrailMeta();
            if (!meta.title || !meta.dimension || !meta.prazo || !meta.why) {
                this.showToast('Preencha título, dimensão, prazo e motivação da meta.', 'error');
                return false;
            }
            const horizonAlign = this.alignMetaHorizonSelection({
                prazo: meta.prazo,
                selectedHorizonYears: meta.horizonYears,
                selectElementId: 'trail-meta-horizon'
            });
            if (!horizonAlign.ok) {
                this.showToast(horizonAlign.message || 'Ajuste o horizonte da meta para continuar.', 'error');
                return false;
            }
            const validation = this.validateEntityTimeWindow('metas', { prazo: meta.prazo, metaHorizonYears: horizonAlign.horizonYears });
            if (!validation.ok) {
                this.showToast(validation.message, 'error');
                return false;
            }
            return true;
        }
        if (s === 2) {
            const okrs = this._readTrailOkrs();
            if (okrs.hasPartial) {
                this.showToast('Complete os campos de cada Projeto preenchido (resultado, métrica e prazo).', 'error');
                return false;
            }
            if (okrs.items.length < 1 || okrs.items.length > 3) {
                this.showToast('Defina de 1 a 3 Projetos para continuar.', 'error');
                return false;
            }
            const invalidOkr = okrs.items.find((okr, idx) => {
                const validation = this.validateEntityTimeWindow('okrs', {
                    inicioDate: okr.inicioDate,
                    prazo: okr.prazo
                });
                if (validation.ok) return false;
                this.showToast(`Projeto ${idx + 1}: ${validation.message}`, 'error');
                return true;
            });
            if (invalidOkr) return false;
            return true;
        }
        if (s === 3) {
            const macros = this._readTrailMacros();
            if (macros.hasPartial) {
                this.showToast('Cada Entrega precisa de título, Projeto vinculado, início e prazo.', 'error');
                return false;
            }
            if (macros.items.length < 2 || macros.items.length > 5) {
                this.showToast('Defina de 2 a 5 Entregas para continuar.', 'error');
                return false;
            }
            const invalidEntrega = macros.items.find((macro, idx) => {
                const validation = this.validateEntityTimeWindow('macros', {
                    inicioDate: macro.inicioDate,
                    prazo: macro.prazo
                });
                if (validation.ok) return false;
                this.showToast(`Entrega ${idx + 1}: ${validation.message}`, 'error');
                return true;
            });
            if (invalidEntrega) return false;
            return true;
        }
        if (s === 4) {
            const micros = this._readTrailMicros();
            if (micros.hasPartial) {
                this.showToast('Cada Ação precisa de título, Entrega vinculada, início e prazo.', 'error');
                return false;
            }
            if (micros.items.length < 1) {
                this.showToast('Defina ao menos 1 Ação para começar a semana.', 'error');
                return false;
            }
            const invalidMicro = micros.items.find((micro, idx) => {
                const validation = this.validateEntityTimeWindow('micros', {
                    inicioDate: micro.inicioDate,
                    prazo: micro.prazo
                });
                if (validation.ok) return false;
                this.showToast(`Acao ${idx + 1}: ${validation.message}`, 'error');
                return true;
            });
            if (invalidMicro) return false;
            const todayKey = this.getLocalDateKey();
            const today = new Date(todayKey + 'T00:00:00');
            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 14);
            const invalidDate = micros.items.find(item => {
                try {
                    const d = new Date(item.prazo + 'T00:00:00');
                    return d < today || d > maxDate;
                } catch (_) {
                    return true;
                }
            });
            if (invalidDate) {
                this.showToast('Os prazos das Ações devem ficar dentro das próximas 2 semanas.', 'error');
                return false;
            }
            return true;
        }
        return true;
    },

refreshTrailSummary: function() {
        const summary = document.getElementById('trail-summary');
        if (!summary) return;
        const meta = this._readTrailMeta();
        const okrs = this._readTrailOkrs().items;
        const macros = this._readTrailMacros().items;
        const micros = this._readTrailMicros().items;
        const okrByRow = {};
        okrs.forEach(okr => { okrByRow[okr.rowId] = okr; });
        const macroByRow = {};
        macros.forEach(macro => { macroByRow[macro.rowId] = macro; });

        const metaCard = `
            <div class="bg-surface-container-low rounded-xl border border-outline-variant/20 p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Meta</p>
                <p class="text-sm font-bold text-on-surface">${this.escapeHtml(meta.title || '—')}</p>
                <p class="text-xs text-outline mt-1">${this.escapeHtml(meta.dimension || 'Sem dimensão')} • ${this._formatTrailDate(meta.prazo)}</p>
                <p class="text-[11px] text-outline mt-1">Horizonte: ${this.escapeHtml(String(meta.horizonYears || 1))} ano(s) • Desafio ${meta.challengeLevel || 3}/5 • Comprometimento ${meta.commitmentLevel || 3}/5</p>
                <p class="text-xs text-outline mt-2">${this.escapeHtml(meta.successCriteria || 'Sem critério de sucesso definido.')}</p>
                <p class="text-xs text-on-surface mt-2 leading-relaxed">${this.escapeHtml(meta.why || 'Sem motivação definida.')}</p>
            </div>`;

        const okrCards = okrs.length > 0
            ? okrs.map((okr, idx) => `
                <div class="bg-surface-container rounded-lg border border-outline-variant/15 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Projeto ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(okr.title)}</p>
                    <p class="text-xs text-outline mt-1">${this.escapeHtml(okr.metric)}</p>
                    <p class="text-[11px] text-outline mt-1">Desafio ${okr.challengeLevel || 3}/5 • Comprometimento ${okr.commitmentLevel || 3}/5</p>
                    <p class="text-[11px] text-outline mt-1">${Array.isArray(okr.keyResults) && okr.keyResults.length > 0 ? `${okr.keyResults.length} key result(s)` : 'Sem key results'}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${okr.inicioDate ? `${this._formatTrailDate(okr.inicioDate)} → ` : ''}${this._formatTrailDate(okr.prazo)}</p>
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem Projetos completos.</p>';

        const macroCards = macros.length > 0
            ? macros.map((macro, idx) => `
                <div class="bg-surface-container rounded-lg border border-outline-variant/15 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Entrega ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(macro.title)}</p>
                    <p class="text-xs text-outline mt-1">Vinculada a: ${this.escapeHtml(okrByRow[macro.okrRowId]?.title || 'Projeto não definido')}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${this._formatTrailDate(macro.inicioDate)} → ${this._formatTrailDate(macro.prazo)}</p>
                    ${macro.description ? `<p class="text-xs text-on-surface mt-2">${this.escapeHtml(macro.description)}</p>` : ''}
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem Entregas completas.</p>';

        const microCards = micros.length > 0
            ? micros.map((micro, idx) => `
                <div class="bg-surface-container rounded-lg border border-outline-variant/15 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Acao ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(micro.title)}</p>
                    <p class="text-xs text-outline mt-1">Entrega: ${this.escapeHtml(macroByRow[micro.macroRowId]?.title || 'Entrega não definida')}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${this._formatTrailDate(micro.inicioDate)} → ${this._formatTrailDate(micro.prazo)}</p>
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem Ações completas.</p>';

        summary.innerHTML = `
            ${metaCard}
            <div class="grid md:grid-cols-3 gap-3">
                <div class="space-y-2">${okrCards}</div>
                <div class="space-y-2">${macroCards}</div>
                <div class="space-y-2">${microCards}</div>
            </div>
        `;
    },

updatePurposePanel: function(dimension, type) {
        const panel = document.getElementById('crud-purpose-panel');
        if (!panel) return;

        // Só mostra para tipos com propósito (não hábitos)
        const showForType = ['metas', 'okrs', 'macros', 'micros'].includes(type);
        if (!showForType) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            return;
        }

        const profile = window.sistemaVidaState?.profile || {};
        const values = profile.values || [];

        // Verifica se há algum dado para mostrar
        const hasValues = values.length > 0;
        const hasIkigai = !!window.app.getIkigaiPreferredText(profile);
        const legacyKey = this._dimensionLegacyMap[dimension];
        const legacyText = legacyKey ? window.app.getLegacyPreferredText(legacyKey, profile) : '';
        const hasLegacy = !!legacyText;

        if (!hasValues && !hasIkigai && !hasLegacy) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            return;
        }

        // Popula os campos
        const valuesSection = document.getElementById('crud-purpose-values');
        const valuesText = document.getElementById('crud-purpose-values-text');
        const ikigaiSection = document.getElementById('crud-purpose-ikigai');
        const ikigaiText = document.getElementById('crud-purpose-ikigai-text');
        const legacySection = document.getElementById('crud-purpose-legacy');
        const legacyTextEl = document.getElementById('crud-purpose-legacy-text');

        if (hasValues && valuesSection && valuesText) {
            valuesText.textContent = values.slice(0, 3).join(' · ');
            valuesSection.classList.remove('hidden');
            valuesSection.style.display = 'flex';
        } else if (valuesSection) {
            valuesSection.classList.add('hidden');
        }

        if (hasIkigai && ikigaiSection && ikigaiText) {
            ikigaiText.textContent = window.app.getIkigaiPreferredText(profile);
            ikigaiSection.classList.remove('hidden');
            ikigaiSection.style.display = 'flex';
        } else if (ikigaiSection) {
            ikigaiSection.classList.add('hidden');
        }

        if (hasLegacy && legacySection && legacyTextEl) {
            legacyTextEl.textContent = legacyText;
            legacySection.classList.remove('hidden');
            legacySection.style.display = 'flex';
        } else if (legacySection) {
            legacySection.classList.add('hidden');
        }

        // Mostra painel (começa fechado para não poluir o modal)
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
        // Garante que o body começa collapsed
        const body = document.getElementById('crud-purpose-body');
        const chevron = document.getElementById('crud-purpose-chevron');
        if (body) { body.classList.add('hidden'); body.style.display = 'none'; }
        if (chevron) chevron.style.transform = '';
    },

openWeeklyPlanModal: function(options = {}) {
        const state = window.sistemaVidaState;
        const weekKey = options.weekKey || this._getWeekKey();
        this._weeklyPlanTargetKey = weekKey;
        const isNextWeek = weekKey > this._getWeekKey();

        // Formata o rótulo da semana
        const title = document.getElementById('weekly-plan-modal-title');
        const label = document.getElementById('weekly-plan-week-label');
        if (title) title.textContent = isNextWeek ? 'Planejar Próxima Semana' : 'Planejamento Semanal';
        if (label) label.textContent = this._formatWeekRange(weekKey);

        const noCurrentPlanWarning = document.getElementById('wp-no-current-plan-warning');
        if (noCurrentPlanWarning) {
            const currentWeekPlan = (state.weekPlans || {})[this._getWeekKey()];
            const currentWeekHasPlan = currentWeekPlan && (currentWeekPlan.selectedMicros?.length > 0 || currentWeekPlan.intention?.trim());
            noCurrentPlanWarning.classList.toggle('hidden', !isNextWeek || !!currentWeekHasPlan);
        }

        // Pré-preenche com plano existente para esta semana (se houver)
        const existing = (state.weekPlans || {})[weekKey] || {};
        const trailSuggestion = this._wizardPlanSuggestion || null;
        const carryover = options.suggestCarryover ? this.getNextWeekCarryoverSuggestions(this._getWeekKey()) : [];
        const suggestedMicros = Array.isArray(trailSuggestion?.microIds)
            ? trailSuggestion.microIds
            : carryover.map(m => m.id);
        const intentionEl = document.getElementById('wp-intention');
        const energyEl = document.getElementById('wp-energy');
        if (intentionEl) intentionEl.value = existing.intention || trailSuggestion?.intention || (options.suggestCarryover ? 'Fechar pendências importantes e manter o plano executável.' : '');
        if (energyEl) energyEl.value = existing.energyForecast || 3;

        // Monta lista de micros ativos
        const microsContainer = document.getElementById('wp-micros-list');
        if (microsContainer) {
            const activeMicros = (state.entities?.micros || []).filter(m => m.status !== 'done' && !m.completed);
            if (activeMicros.length === 0) {
                microsContainer.innerHTML = '<p class="text-xs text-outline italic">Nenhuma ação ativa disponível.</p>';
            } else {
                const suggestionSet = new Set(suggestedMicros);
                const suggestionNotice = carryover.length ? `
                    <div class="mb-2 rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-on-surface-variant leading-relaxed">
                        <span class="font-bold text-primary">${carryover.length} pendência${carryover.length > 1 ? 's' : ''} pré-selecionada${carryover.length > 1 ? 's' : ''}.</span>
                        Revise a carga antes de salvar a próxima semana.
                    </div>` : '';
                microsContainer.innerHTML = suggestionNotice + activeMicros.map(m => {
                    const checked = ((existing.selectedMicros || []).includes(m.id) || suggestedMicros.includes(m.id)) ? 'checked' : '';
                    const macroTitle = state.entities.macros?.find(ma => ma.id === m.macroId)?.title || '';
                    const details = [
                        m.dimension || '',
                        macroTitle,
                        m.prazo ? `prazo ${this._formatTrailDate ? this._formatTrailDate(m.prazo) : m.prazo}` : ''
                    ].filter(Boolean).join(' · ');
                    const carryBadge = suggestionSet.has(m.id) ? '<span class="ml-1 text-[9px] font-bold uppercase tracking-wider text-primary">sugerida</span>' : '';
                    const sub = details ? `<span class="text-[10px] text-outline block">${this.escapeHtml(details)}${carryBadge}</span>` : '';
                    return `<label class="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-primary/5 transition-colors">
                        <input type="checkbox" class="wp-micro-check mt-0.5 accent-primary" value="${m.id}" ${checked}>
                        <span class="text-sm text-on-surface leading-snug">${this.escapeHtml(m.title)}${sub}</span>
                    </label>`;
                }).join('');
            }
        }

        document.getElementById('weekly-plan-modal').classList.remove('hidden');
        this._wizardPlanSuggestion = null;

        // Medidor de carga: inicializa e escuta mudanças
        this._updateWeeklyPlanLoadMeter();
        const listEl = document.getElementById('wp-micros-list');
        if (listEl && !listEl._loadMeterBound) {
            listEl.addEventListener('change', (e) => {
                if (e.target && e.target.classList && e.target.classList.contains('wp-micro-check')) {
                    this._updateWeeklyPlanLoadMeter();
                }
            });
            listEl._loadMeterBound = true;
        }

        if (options && options.addMicro) {
            const inlineForm = document.getElementById('wp-inline-new-micro');
            if (inlineForm?.classList.contains('hidden')) this.toggleInlineNewMicro();
        }
    },

getDailyCompassQuotes: function() {
        return [
            // Saúde
            { theme: 'Saúde', quote: 'O corpo precisa de constância antes de intensidade.', author: 'Life OS', reflection: 'Proteja energia suficiente para cumprir o essencial.' },
            { theme: 'Saúde', quote: 'Cuide do corpo — é o único lugar onde você tem de viver.', author: 'Jim Rohn', reflection: 'Um gesto de cuidado físico hoje é um presente para amanhã.' },
            { theme: 'Saúde', quote: 'A saúde não é tudo, mas sem ela tudo é nada.', author: 'Arthur Schopenhauer', reflection: 'Priorize o básico: sono, movimento, hidratação.' },
            { theme: 'Saúde', quote: 'Movimento é o remédio mais antigo do mundo.', author: 'Life OS', reflection: 'Dez minutos em movimento valem mais do que zero.' },
            { theme: 'Saúde', quote: 'O esforço de hoje é a energia de amanhã.', author: 'Life OS', reflection: 'Invista no corpo agora para colher capacidade depois.' },
            { theme: 'Saúde', quote: 'Hábitos saudáveis são promessas silenciosas a si mesmo.', author: 'Life OS', reflection: 'Cumpra ao menos uma promessa de saúde hoje.' },
            { theme: 'Saúde', quote: 'Descanse com intenção; treine com presença.', author: 'Life OS', reflection: 'Qualidade importa mais do que duração, em treino e em descanso.' },
            { theme: 'Saúde', quote: 'Seu corpo guarda a conta de tudo que você ignora.', author: 'Life OS', reflection: 'Não espere um sinal de alerta para ouvir o corpo.' },
            // Mente
            { theme: 'Mente', quote: 'A mente se fortalece quando volta ao que controla.', author: 'Epicteto', reflection: 'Escolha uma ação que dependa apenas de você.' },
            { theme: 'Mente', quote: 'Não é o que acontece com você, mas como você responde que importa.', author: 'Epicteto', reflection: 'Pause antes de reagir; responda com intenção.' },
            { theme: 'Mente', quote: 'O foco é a arte de dizer não a quase tudo.', author: 'Steve Jobs', reflection: 'Elimine uma distração hoje para ganhar clareza.' },
            { theme: 'Mente', quote: 'Clareza antes de velocidade.', author: 'Life OS', reflection: 'Entenda o que precisa ser feito antes de começar a correr.' },
            { theme: 'Mente', quote: 'Aprender é mudar de ideia com evidência.', author: 'Life OS', reflection: 'Questione uma crença antiga com curiosidade, não com defesa.' },
            { theme: 'Mente', quote: 'A mente que se abre jamais voltará ao tamanho original.', author: 'Oliver Wendell Holmes', reflection: 'Leia algo que expanda sua perspectiva hoje.' },
            { theme: 'Mente', quote: 'Pensar bem é uma habilidade treinável, não um dom.', author: 'Life OS', reflection: 'Dedique tempo a refletir, não apenas a agir.' },
            { theme: 'Mente', quote: 'A leitura de bons livros é conversa com os melhores espíritos do passado.', author: 'Descartes', reflection: 'Invista ao menos 15 minutos num livro que vale a pena.' },
            // Carreira
            { theme: 'Carreira', quote: 'O trabalho visível nasce de blocos invisíveis de foco.', author: 'Life OS', reflection: 'Faça progresso pequeno, mensurável e entregável.' },
            { theme: 'Carreira', quote: 'Excelência não é um ato isolado — é um hábito.', author: 'Aristóteles', reflection: 'Faça bem a próxima tarefa, independente do tamanho.' },
            { theme: 'Carreira', quote: 'Trabalho profundo é o superpoder do século XXI.', author: 'Cal Newport', reflection: 'Bloqueie tempo para pensar sem interrupção hoje.' },
            { theme: 'Carreira', quote: 'Concentre-se no processo; o resultado virá.', author: 'Life OS', reflection: 'Avalie o esforço, não só o resultado imediato.' },
            { theme: 'Carreira', quote: 'A melhor hora foi há 20 anos. A segunda melhor é agora.', author: 'Provérbio chinês', reflection: 'Comece o projeto que você adiou. Hoje.' },
            { theme: 'Carreira', quote: 'Reputação é construída em anos e destruída em minutos.', author: 'Life OS', reflection: 'Entregue com qualidade o que prometeu.' },
            { theme: 'Carreira', quote: 'Faça o difícil enquanto ele ainda é fácil.', author: 'Lao-Tsé', reflection: 'Resolva o problema antes que ele cresça.' },
            { theme: 'Carreira', quote: 'Seu trabalho é como você deixa sua marca no mundo.', author: 'Life OS', reflection: 'Pergunte: o que faço hoje reflete quem quero ser profissionalmente?' },
            // Finanças
            { theme: 'Finanças', quote: 'Quem sabe o bastante sabe também o que basta.', author: 'Estoicismo', reflection: 'Decida com clareza, não por impulso.' },
            { theme: 'Finanças', quote: 'Não é quanto você ganha, mas quanto você guarda.', author: 'Robert Kiyosaki', reflection: 'Revise uma despesa desnecessária hoje.' },
            { theme: 'Finanças', quote: 'Patrimônio é construído em anos de decisões consistentes.', author: 'Life OS', reflection: 'Uma decisão pequena e certa vale mais que um grande atalho.' },
            { theme: 'Finanças', quote: 'Pague a si mesmo primeiro.', author: 'David Bach', reflection: 'Separe antes de gastar — mesmo que seja pouco.' },
            { theme: 'Finanças', quote: 'Riqueza é quando o tempo começa a trabalhar por você.', author: 'Life OS', reflection: 'Cada investimento é uma hora de trabalho futuro comprada hoje.' },
            { theme: 'Finanças', quote: 'Evite dívidas que financiam consumo — só as que constroem.', author: 'Life OS', reflection: 'Pergunte: isso me aproxima ou me afasta da liberdade financeira?' },
            { theme: 'Finanças', quote: 'A regra mais importante: nunca perca dinheiro.', author: 'Warren Buffett', reflection: 'Segurança primeiro; ganhos depois.' },
            { theme: 'Finanças', quote: 'Orçamento não é restrição — é direção.', author: 'Life OS', reflection: 'Saber onde o dinheiro vai é mais poderoso do que ganhar mais.' },
            // Relacionamentos
            { theme: 'Relacionamentos', quote: 'A atenção é uma forma rara de generosidade.', author: 'Simone Weil', reflection: 'Dê presença real a uma pessoa importante hoje.' },
            { theme: 'Relacionamentos', quote: 'Você é a média das pessoas com quem passa mais tempo.', author: 'Jim Rohn', reflection: 'Com quem você escolhe se desenvolver?' },
            { theme: 'Relacionamentos', quote: 'Escute para entender, não para responder.', author: 'Life OS', reflection: 'Na próxima conversa, fale menos e ouça mais.' },
            { theme: 'Relacionamentos', quote: 'Confiança é construída em gotas e perdida em baldes.', author: 'Life OS', reflection: 'Uma promessa cumprida vale mais do que cem palavras.' },
            { theme: 'Relacionamentos', quote: 'Conexão genuína começa com vulnerabilidade.', author: 'Brené Brown', reflection: 'Seja honesto com alguém sobre o que você está vivendo.' },
            { theme: 'Relacionamentos', quote: 'Seja o tipo de pessoa com quem você gostaria de contar.', author: 'Life OS', reflection: 'Que gesto de presença você pode fazer hoje?' },
            { theme: 'Relacionamentos', quote: 'Relações profundas exigem tempo intencional, não apenas casual.', author: 'Life OS', reflection: 'Agende uma conversa real com alguém que importa.' },
            { theme: 'Relacionamentos', quote: 'Pessoas se lembram de como você as fez sentir.', author: 'Maya Angelou', reflection: 'Deixe alguém mais leve depois de falar com você.' },
            // Família
            { theme: 'Família', quote: 'O que é importante precisa aparecer no calendário.', author: 'Life OS', reflection: 'Transforme cuidado em gesto concreto e agendado.' },
            { theme: 'Família', quote: 'Presença física não é o mesmo que presença real.', author: 'Life OS', reflection: 'Esteja inteiro quando estiver com quem ama.' },
            { theme: 'Família', quote: 'A família que você nutre será seu maior legado.', author: 'Life OS', reflection: 'O que você planta em casa, colhe por gerações.' },
            { theme: 'Família', quote: 'Mostre amor com ação, não só com intenção.', author: 'Life OS', reflection: 'Intenção não abraça. Faça o gesto.' },
            { theme: 'Família', quote: 'Os filhos crescem vendo o que você faz, não o que você diz.', author: 'Life OS', reflection: 'Qual valor você quer modelar hoje?' },
            { theme: 'Família', quote: 'Criar memórias boas é o melhor investimento sem prazo.', author: 'Life OS', reflection: 'Proponha um momento especial, simples que seja.' },
            { theme: 'Família', quote: 'O lar é onde você decide estar, não apenas onde você está.', author: 'Life OS', reflection: 'Escolha estar presente — não apenas por perto.' },
            { theme: 'Família', quote: 'Família não é uma obrigação — é uma escolha que se renova todo dia.', author: 'Life OS', reflection: 'Renove essa escolha com um gesto hoje.' },
            // Lazer
            { theme: 'Lazer', quote: 'Descanso também é parte do sistema.', author: 'Life OS', reflection: 'Recupere energia sem culpa e sem fuga.' },
            { theme: 'Lazer', quote: 'Quem não descansa não sustenta o ritmo.', author: 'Life OS', reflection: 'Descanso planejado é performance futura garantida.' },
            { theme: 'Lazer', quote: 'A recuperação deliberada é tão importante quanto o treino.', author: 'Life OS', reflection: 'Restaure, não apenas pause.' },
            { theme: 'Lazer', quote: 'Prazer sem culpa é parte de uma vida bem vivida.', author: 'Life OS', reflection: 'Permita-se curtir algo hoje completamente.' },
            { theme: 'Lazer', quote: 'O tempo de ócio produtivo é o berço da criatividade.', author: 'Life OS', reflection: 'Deixe a mente vagar sem agenda — boas ideias vêm daí.' },
            { theme: 'Lazer', quote: 'Brincar é a forma mais pura de presença.', author: 'Life OS', reflection: 'Faça algo hoje só porque você gosta.' },
            { theme: 'Lazer', quote: 'O descanso que você evita vai cobrar juros em forma de exaustão.', author: 'Life OS', reflection: 'Previna o burnout antes que ele te force a parar.' },
            { theme: 'Lazer', quote: 'Alegria não é recompensa pelo trabalho — é combustível para ele.', author: 'Life OS', reflection: 'Inclua prazer na agenda com a mesma seriedade do trabalho.' },
            // Propósito
            { theme: 'Propósito', quote: 'Quem tem um porquê suporta quase qualquer como.', author: 'Viktor Frankl', reflection: 'Relembre o motivo antes de escolher a tarefa.' },
            { theme: 'Propósito', quote: 'O propósito não é encontrado — é construído, ação por ação.', author: 'Life OS', reflection: 'O que você faz hoje está alinhado com quem quer ser?' },
            { theme: 'Propósito', quote: 'O que você faz com seus dias é o que faz com sua vida.', author: 'Annie Dillard', reflection: 'Cada dia conta — não apenas os grandes marcos.' },
            { theme: 'Propósito', quote: 'Missão sem ação é ilusão.', author: 'Life OS', reflection: 'Transforme intenção em um passo concreto agora.' },
            { theme: 'Propósito', quote: 'Construa algo que valha mais do que sua presença.', author: 'Life OS', reflection: 'O que você está criando que sobrevive a você?' },
            { theme: 'Propósito', quote: 'O legado não é o que você deixa para as pessoas — é o que você deixa nelas.', author: 'Life OS', reflection: 'Como você quer ser lembrado por quem te ama?' },
            { theme: 'Propósito', quote: 'Viva de forma que sua história valha ser contada.', author: 'Life OS', reflection: 'Que capítulo você está escrevendo hoje?' },
            { theme: 'Propósito', quote: 'A clareza de propósito transforma tarefas em vocação.', author: 'Life OS', reflection: 'Conecte o que você vai fazer hoje com por que você existe.' },
            // Geral
            { theme: 'Geral', quote: 'Nós somos aquilo que repetidamente fazemos.', author: 'Aristóteles', reflection: 'Uma repetição pequena hoje reforça a identidade certa.' },
            { theme: 'Geral', quote: 'Comece fazendo o necessário; depois, o possível.', author: 'Francisco de Assis', reflection: 'Não precisa vencer o dia inteiro. Vença o próximo passo.' },
            { theme: 'Geral', quote: 'Disciplina é o caminho mais curto para a liberdade.', author: 'Jocko Willink', reflection: 'O que você faz quando não está com vontade define quem você é.' },
            { theme: 'Geral', quote: 'Feito é melhor que perfeito.', author: 'Sheryl Sandberg', reflection: 'Lance, aprenda, ajuste. Não espere condições ideais.' },
            { theme: 'Geral', quote: 'Um ser humano pode alterar sua vida ao alterar suas atitudes.', author: 'William James', reflection: 'Escolha uma atitude melhor ainda hoje.' },
            { theme: 'Geral', quote: 'Simplicidade é o máximo da sofisticação.', author: 'Leonardo da Vinci', reflection: 'Simplifique uma decisão ou processo complicado hoje.' },
            { theme: 'Geral', quote: 'Cada dia é uma página em branco — você escolhe o que escrever.', author: 'Life OS', reflection: 'O que vale registrar nesta página ao final do dia?' },
            { theme: 'Geral', quote: 'Pequenas vitórias acumuladas vencem grandes guerras.', author: 'Life OS', reflection: 'Qual pequena vitória você vai garantir hoje?' }
        ];
    },

_renderNextActionCard: function(next, variant = 'today') {
        if (next?.sourceType && next.sourceType !== 'micro') {
            const title = next.title || 'Próxima melhor ação';
            const reason = next.reason || (Array.isArray(next.reasons) ? next.reasons[0] : '') || '';
            const sourceType = next.sourceType;
            const sourceId = String(next.sourceId || '');
            const icon = ({
                focus: 'timer',
                habit: 'repeat',
                routine: 'event_repeat',
                checkin: 'self_improvement',
                rest: 'hotel'
            })[sourceType] || 'task_alt';
            let actionsHtml = '';
            if (sourceType === 'habit' || sourceType === 'routine') {
                const cta = sourceType === 'routine' ? 'Abrir rotina' : 'Abrir habito';
                actionsHtml = `
                    <button type="button" onclick="window.app.openHabitToday('${this.escapeHtml(sourceId)}')"
                        class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">${cta}</button>
                    <button type="button" onclick="window.app.switchHojeScreen('habitos')"
                        class="flex-1 md:flex-none px-4 py-2 rounded-xl border border-outline-variant/30 text-outline text-xs font-bold uppercase tracking-widest hover:bg-surface-container-high active:scale-95 transition-all">Ver todos</button>`;
            } else if (sourceType === 'focus') {
                actionsHtml = `<button type="button" onclick="window.app.switchView('foco')"
                    class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">Abrir foco</button>`;
            } else if (sourceType === 'checkin') {
                actionsHtml = `<button type="button" onclick="window.app.flowNavigate('hoje','daily-checkin-panel')"
                    class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">Fazer check-in</button>`;
            } else if (sourceType === 'rest') {
                actionsHtml = `<button type="button" onclick="window.app.flowNavigate('hoje','daily-checkin-panel')"
                    class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest active:scale-95 transition-all">Ajustar o dia</button>`;
            }
            const wrapper = variant === 'panel'
                ? 'bg-primary/5 border-primary/20'
                : 'bg-surface-container-lowest border-primary/20 shadow-sm';
            return `
                <div class="${wrapper} border rounded-2xl p-5 md:p-6">
                    <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div class="min-w-0">
                            <p class="ui-section-label mb-2 text-primary">Próxima melhor ação</p>
                            <h4 class="font-headline text-xl md:text-2xl font-bold text-on-background leading-tight flex items-center gap-2">
                                <span class="material-symbols-outlined notranslate text-primary text-[20px]">${icon}</span>
                                <span class="min-w-0 truncate">${this.escapeHtml(title)}</span>
                            </h4>
                            ${reason ? `<p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(reason)}</p>` : ''}
                        </div>
                        <div class="flex flex-wrap md:flex-col gap-2 md:min-w-[140px]">${actionsHtml}</div>
                    </div>
                </div>`;
        }
        if (!next?.sourceType && next?.micro?.id) {
            next.sourceType = 'micro';
            next.sourceId = next.micro.id;
            if (!next.title) next.title = next.micro.title || 'Ação';
            if (!next.reason && Array.isArray(next.reasons) && next.reasons.length) next.reason = next.reasons[0];
        }
        if (!next?.micro) {
            // Gap in hierarchy — guide user to complete the chain
            if (next?.gapType) {
                const entityLabel = ({ okrs: 'Projeto', macros: 'entrega', micros: 'ação' })[next.entityType] || next.entityType;
                const icon = ({ okrs: 'flag', macros: 'checklist', micros: 'bolt' })[next.entityType] || 'warning';
                const parentIdSafe = this.escapeHtml(next.parentId || '');
                const entityTypeSafe = this.escapeHtml(next.entityType || '');
                return `
                    <div class="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-5 shadow-sm">
                        <div class="flex items-start gap-3">
                            <span class="material-symbols-outlined notranslate text-amber-500 shrink-0 mt-0.5">${icon}</span>
                            <div class="min-w-0 flex-1">
                                <p class="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Trilha incompleta</p>
                                <p class="text-sm font-bold text-on-surface">${this.escapeHtml(next.title)}</p>
                                <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">${this.escapeHtml(next.description)}</p>
                                <button type="button"
                                    onclick="window.app.openCreateModal('${entityTypeSafe}', '${parentIdSafe}')"
                                    class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold uppercase tracking-widest hover:bg-amber-500/20 active:scale-95 transition-all">
                                    <span class="material-symbols-outlined notranslate text-[14px]">add</span>
                                    Criar ${this.escapeHtml(entityLabel)}
                                </button>
                            </div>
                        </div>
                    </div>`;
            }

            const title = variant === 'panel' ? 'Nenhuma decisão urgente' : 'Nada urgente agora';
            const text = variant === 'panel'
                ? 'O plano não mostra uma ação crítica neste momento. Continue executando o que já foi planejado.'
                : 'Seu dia não tem uma ação crítica pendente. Execute o plano com calma ou capture uma próxima ação.';
            return `
                <div class="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined notranslate text-primary shrink-0">check_circle</span>
                        <div>
                            <p class="text-sm font-bold text-on-surface">${title}</p>
                            <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">${text}</p>
                        </div>
                    </div>
                </div>`;
        }

        const micro = next.micro;
        const metaText = next.meta?.title ? `Meta: ${this.escapeHtml(next.meta.title)}` : 'Sem meta vinculada';
        const effortLabel = this.getMicroEffortLabel(next.effort || micro.effort);
        const reasons = [
            `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Esforço ${effortLabel}</span>`,
            ...(next.reasons || []).map(r => `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">${this.escapeHtml(r)}</span>`)
        ].join('');
        const scheduleAction = this.getMicroScheduleAdjustmentAction?.(micro) || {
            title: 'Adiar para amanha',
            label: 'Adiar'
        };
        const wrapper = variant === 'panel'
            ? 'bg-primary/5 border-primary/20'
            : 'bg-surface-container-lowest border-primary/20 shadow-sm';

        return `
            <div class="${wrapper} border rounded-2xl p-5 md:p-6">
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-3">
                        <p class="ui-section-label text-primary">Pr&oacute;xima melhor a&ccedil;&atilde;o</p>
                        <div class="flex shrink-0 gap-1.5">
                        <button type="button" onclick="window.app.completeMicroAction('${micro.id}')"
                            class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all"
                            title="Concluir a&ccedil;&atilde;o" aria-label="Concluir a&ccedil;&atilde;o">
                            <span class="material-symbols-outlined notranslate text-[16px]">check</span>
                        </button>
                        <button type="button" onclick="window.app.adjustMicroScheduleContextually('${micro.id}')"
                            class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-95 transition-all"
                            title="${this.escapeHtml(scheduleAction.title || scheduleAction.label)}" aria-label="${this.escapeHtml(scheduleAction.title || scheduleAction.label)}">
                            <span class="material-symbols-outlined notranslate text-[16px]">${this.escapeHtml(scheduleAction.icon || 'event_upcoming')}</span>
                        </button>
                        <button type="button" onclick="window.app.openEntityReview('${micro.id}', 'micros')"
                            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 text-outline hover:bg-surface-container-high active:scale-95 transition-all"
                            title="Ver detalhes" aria-label="Ver detalhes">
                            <span class="material-symbols-outlined notranslate text-[16px]">visibility</span>
                        </button>
                    </div>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <h4 class="min-w-0 flex-1 font-headline text-xl md:text-2xl font-bold text-on-background leading-tight">${this.escapeHtml(micro.title)}</h4>
                    </div>
                    <div class="flex flex-wrap gap-2">${reasons}</div>
                    <p class="text-xs text-on-surface-variant leading-relaxed">${metaText}</p>
                </div>
            </div>`;
    },

getSuggestedMicroEstimatedMinutes: function(input = {}) {
        const effort = this.getMicroEffort ? this.getMicroEffort(input) : String(input?.effort || 'medio').trim().toLowerCase();
        if (effort === 'leve') return 25;
        if (effort === 'denso') return 90;
        return 50;
    },

getProtocolEstimatedMinutesById: function(protocolId = '', options = {}) {
        const safeId = String(protocolId || '').trim();
        if (!safeId || typeof this.getProtocolById !== 'function' || typeof this.getProtocolEstimatedMinutes !== 'function') return 0;
        const protocol = this.getProtocolById(safeId);
        if (!protocol) return 0;
        return Math.max(0, Math.round(Number(this.getProtocolEstimatedMinutes(protocol, { includeOptional: false, ...options })) || 0));
    },

getProtocolSuggestedStartTime: function(protocolId = '') {
        const safeId = String(protocolId || '').trim();
        if (!safeId || typeof this.getProtocolById !== 'function') return '';
        const protocol = this.getProtocolById(safeId);
        return String(protocol?.suggestedHabit?.startTime || '').trim();
    },

getMicroEstimatedMinutesSource: function(micro) {
        if (!micro) return 'suggested';
        if (String(micro.sourceType || '') === 'habit_focus_session' && micro.sourceHabitId) {
            const habit = (window.sistemaVidaState?.habits || []).find(item => String(item?.id || '') === String(micro.sourceHabitId || ''));
            const mode = this.normalizeHabitTrackMode?.(habit?.trackMode) || String(habit?.trackMode || '').trim().toLowerCase();
            if (habit?.protocolId && (this.getProtocolEstimatedMinutesById?.(habit.protocolId) || 0) > 0) return 'protocol';
            if (mode === 'timer') return 'target';
            if (Math.round(Number(habit?.estimatedMinutes) || 0) > 0) return 'manual';
            if ((this.getHabitResolvedSteps?.(habit) || []).length > 0) return 'steps';
        }
        const manual = Math.round(Number(micro.estimatedMinutes) || 0);
        if (manual > 0) return 'manual';
        const protocolId = String(micro.protocolId || micro.sourceProtocolId || '').trim();
        if ((this.getProtocolEstimatedMinutesById?.(protocolId) || 0) > 0) return 'protocol';
        return 'suggested';
    },

getScheduleSourceLabel: function(source = '') {
        const key = String(source || '').trim().toLowerCase();
        if (key === 'micro' || key === 'habit') return 'Definido manualmente';
        if (key === 'inherited_habit') return 'Herdado do habito';
        if (key === 'protocol') return 'Sugerido pelo protocolo';
        if (key === 'suggested') return 'Sugerido pelo app';
        return '';
    },

getEstimateSourceLabel: function(source = '') {
        const key = String(source || '').trim().toLowerCase();
        if (key === 'manual') return 'Ajustado manualmente';
        if (key === 'protocol') return 'Baseado no protocolo';
        if (key === 'target') return 'Baseado na meta do habito';
        if (key === 'steps') return 'Baseado nos passos';
        if (key === 'suggested') return 'Sugerido automaticamente';
        return '';
    },

getMicroEstimatedMinutes: function(micro) {
        if (!micro) return 0;
        if (String(micro.sourceType || '') === 'habit_focus_session' && micro.sourceHabitId) {
            const habit = (window.sistemaVidaState?.habits || []).find(item => String(item?.id || '') === String(micro.sourceHabitId || ''));
            const habitMinutes = Math.max(0, Number(this.getHabitEstimatedMinutes?.(habit)) || 0);
            if (habitMinutes > 0) return habitMinutes;
        }
        const manual = Math.round(Number(micro.estimatedMinutes) || 0);
        if (manual > 0) return manual;
        const protocolId = String(micro.protocolId || micro.sourceProtocolId || '').trim();
        const protocolMinutes = this.getProtocolEstimatedMinutesById?.(protocolId) || 0;
        if (protocolMinutes > 0) return protocolMinutes;
        return this.getSuggestedMicroEstimatedMinutes?.(micro) || 50;
    },

getCapacityAdjustmentFromCheckin: function(dateKey = this.getLocalDateKey()) {
        const entries = window.sistemaVidaState?.profile?.dailyCheckins || [];
        const entry = entries.find((item) => String(item?.date || '') === String(dateKey || this.getLocalDateKey())) || null;
        if (!entry) {
            return { factor: 1, extraBufferMinutes: 0, reasons: [], label: 'Sem ajuste do check-in' };
        }
        const sleepHours = Number(entry.sleepHours || 0);
        const sleepQuality = Number(entry.sleepQuality || 3);
        const energy = Number(entry.energy || 3);
        const mood = Number(entry.mood || 3);
        const stress = Number(entry.stress || 3);
        let factor = 1;
        let extraBufferMinutes = 0;
        const reasons = [];
        if (sleepHours < 5) { factor -= 0.28; extraBufferMinutes += 30; reasons.push('sono muito baixo'); }
        else if (sleepHours < 6) { factor -= 0.18; extraBufferMinutes += 20; reasons.push('sono reduzido'); }
        else if (sleepHours < 7) { factor -= 0.08; extraBufferMinutes += 10; reasons.push('sono abaixo da base'); }
        if (sleepQuality <= 2) { factor -= 0.1; extraBufferMinutes += 15; reasons.push('qualidade de sono baixa'); }
        else if (sleepQuality >= 4) factor += 0.04;
        if (energy <= 1) { factor -= 0.22; extraBufferMinutes += 20; reasons.push('energia muito baixa'); }
        else if (energy <= 2) { factor -= 0.12; extraBufferMinutes += 10; reasons.push('energia baixa'); }
        else if (energy >= 4) factor += 0.05;
        if (stress >= 5) { factor -= 0.2; extraBufferMinutes += 25; reasons.push('estresse crítico'); }
        else if (stress >= 4) { factor -= 0.12; extraBufferMinutes += 15; reasons.push('estresse alto'); }
        if (mood <= 2) { factor -= 0.05; reasons.push('humor baixo'); }
        else if (mood >= 4) factor += 0.03;
        const safeFactor = Math.max(0.45, Math.min(1.15, factor));
        const roundedBuffer = Math.max(0, Math.round(extraBufferMinutes / 5) * 5);
        return {
            factor: safeFactor,
            extraBufferMinutes: roundedBuffer,
            reasons,
            label: reasons.length ? `Ajustado pelo check-in: ${reasons.join(', ')}.` : 'Check-in estável, sem redução adicional.'
        };
    },

getSuggestedExecutionSchedule: function(input = {}) {
        const estimatedMinutes = Math.max(1, Math.round(Number(input.estimatedMinutes) || 0));
        const effort = String(input.effort || '').trim().toLowerCase();
        const dueDays = Number.isFinite(Number(input.dueDays)) ? Number(input.dueDays) : null;
        const sourceType = String(input.sourceType || '').trim().toLowerCase();
        const dimension = String(input.dimension || '').trim().toLowerCase();
        const checkin = this.getCapacityAdjustmentFromCheckin?.(this.getLocalDateKey()) || { factor: 1 };
        const lowEnergy = checkin.factor < 0.78;
        let dayPart = 'tarde';
        if (dueDays !== null && dueDays < 0) dayPart = 'manha';
        else if (dueDays === 0 && effort === 'denso') dayPart = 'manha';
        else if (sourceType === 'habit' || sourceType === 'routine') dayPart = dimension === 'saúde' || dimension === 'saude' ? 'manha' : 'tarde';
        else if (dimension === 'saúde' || dimension === 'saude') dayPart = 'manha';
        else if (effort === 'denso' || estimatedMinutes >= 50) dayPart = lowEnergy ? 'tarde' : 'manha';
        else if (effort === 'leve' || estimatedMinutes <= 20) dayPart = dueDays !== null && dueDays <= 0 ? 'tarde' : 'noite';
        const startTimeMap = {
            manha: lowEnergy ? '10:00' : '09:00',
            tarde: '14:00',
            noite: estimatedMinutes >= 45 ? '19:00' : '20:00'
        };
        return {
            dayPart,
            startTime: startTimeMap[dayPart] || '14:00',
            source: 'suggested'
        };
    },

getHabitScheduleContext: function(habit) {
        if (!habit) return { startTime: '', startMinutes: null, dayPart: 'sem_horario', source: '' };
        const explicit = String(habit.startTime || '').trim();
        if (explicit) {
            const startMinutes = this.toClockMinutes(explicit);
            return { startTime: explicit, startMinutes, dayPart: this.getDayPartByClockMinutes(startMinutes), source: 'habit' };
        }
        const protocolStartTime = this.getProtocolSuggestedStartTime?.(habit.protocolId || '') || '';
        if (protocolStartTime) {
            const startMinutes = this.toClockMinutes(protocolStartTime);
            return { startTime: protocolStartTime, startMinutes, dayPart: this.getDayPartByClockMinutes(startMinutes), source: 'protocol' };
        }
        const estimatedMinutes = Math.max(1, Number(this.getHabitEstimatedMinutes?.(habit)) || 0);
        const suggested = this.getSuggestedExecutionSchedule?.({
            sourceType: this.isHabitRoutine?.(habit) ? 'routine' : 'habit',
            dimension: habit.dimension || 'Geral',
            estimatedMinutes
        }) || { dayPart: 'sem_horario', startTime: '' };
        const startMinutes = this.toClockMinutes(suggested.startTime || '');
        return {
            startTime: suggested.startTime || '',
            startMinutes,
            dayPart: suggested.dayPart || this.getDayPartByClockMinutes(startMinutes),
            source: suggested.source || ''
        };
    },

toClockMinutes: function(hhmm = '') {
        const raw = String(hhmm || '').trim();
        const match = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const h = Number(match[1]);
        const m = Number(match[2]);
        if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
        return (h * 60) + m;
    },

getDayPartByClockMinutes: function(totalMinutes = null) {
        if (!Number.isFinite(totalMinutes)) return 'sem_horario';
        if (totalMinutes < 720) return 'manha';
        if (totalMinutes < 1080) return 'tarde';
        return 'noite';
    },

getMicroScheduleContext: function(micro) {
        if (!micro) return { startTime: '', startMinutes: null, dayPart: 'sem_horario', source: '' };
        const state = window.sistemaVidaState || {};
        let startTime = String(micro.startTime || '').trim();
        let source = startTime ? 'micro' : '';
        if (!startTime && micro.sourceHabitId) {
            const linkedHabit = (state.habits || []).find((habit) => String(habit?.id || '') === String(micro.sourceHabitId || ''));
            const inheritedTime = String(linkedHabit?.startTime || '').trim();
            if (inheritedTime) {
                startTime = inheritedTime;
                source = 'inherited_habit';
            }
        }
        if (!startTime) {
            const protocolStartTime = this.getProtocolSuggestedStartTime?.(micro.protocolId || micro.sourceProtocolId || '') || '';
            if (protocolStartTime) {
                startTime = protocolStartTime;
                source = 'protocol';
            }
        }
        if (!startTime) {
            const today = this.getLocalDateKey();
            const dueDays = micro.prazo
                ? Math.floor((new Date(`${micro.prazo}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
                : null;
            const suggested = this.getSuggestedExecutionSchedule?.({
                sourceType: 'micro',
                dimension: micro.dimension || 'Geral',
                estimatedMinutes: this.getMicroEstimatedMinutes?.(micro) || 0,
                effort: this.getMicroEffort?.(micro) || '',
                dueDays
            }) || null;
            if (suggested?.startTime) {
                startTime = suggested.startTime;
                source = suggested.source || 'suggested';
            }
        }
        const startMinutes = this.toClockMinutes(startTime);
        return {
            startTime,
            startMinutes,
            dayPart: this.getDayPartByClockMinutes(startMinutes),
            source
        };
    },

onCrudEstimatedMinutesInput: function() {
        const estimatedInput = document.getElementById('crud-estimated-minutes');
        if (!estimatedInput || estimatedInput.disabled) return;
        estimatedInput.dataset.manualOverride = 'true';
        estimatedInput.dataset.estimateSource = Math.round(Number(estimatedInput.value) || 0) > 0 ? 'manual' : '';
        this.refreshCrudEstimatedFieldState?.();
    },

onMicroEffortChange: function() {
        this.refreshCrudEstimatedFieldState?.('micros');
    },

refreshCrudEstimatedFieldState: function(type = '') {
        const currentType = String(type || document.getElementById('crud-type')?.value || '').trim();
        const estimatedGroup = document.getElementById('crud-estimated-group');
        const estimatedInput = document.getElementById('crud-estimated-minutes');
        const noteEl = document.getElementById('crud-estimated-note');
        const sourceEl = document.getElementById('crud-estimated-source');
        const labelEl = document.getElementById('crud-estimated-label');
        if (!estimatedInput || !noteEl) return;

        const currentValue = Math.round(Number(estimatedInput.value) || 0);
        const manualOverride = estimatedInput.dataset.manualOverride === 'true';
        const setValueIfAuto = (minutes, source) => {
            const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
            const previousSource = estimatedInput.dataset.estimateSource || '';
            const canReplace = !manualOverride || currentValue <= 0 || ['protocol', 'suggested', 'target', 'steps'].includes(previousSource);
            if (safeMinutes > 0 && canReplace) {
                estimatedInput.value = String(safeMinutes);
                estimatedInput.dataset.manualOverride = 'false';
                estimatedInput.dataset.estimateSource = source;
            } else if (safeMinutes <= 0 && currentValue <= 0) {
                estimatedInput.value = '';
                estimatedInput.dataset.estimateSource = '';
            }
        };
        const setVisualState = ({ disabled = false, source = '', note = '', placeholder = '' }) => {
            estimatedInput.disabled = disabled;
            estimatedInput.classList.toggle('opacity-60', disabled);
            estimatedInput.classList.toggle('cursor-not-allowed', disabled);
            if (placeholder) estimatedInput.placeholder = placeholder;
            if (sourceEl) {
                const sourceLabel = this.getEstimateSourceLabel?.(source) || '';
                sourceEl.textContent = sourceLabel;
                sourceEl.classList.toggle('hidden', !sourceLabel);
            }
            noteEl.textContent = note;
            if (labelEl) labelEl.textContent = currentType === 'micros' ? 'Carga total estimada (min)' : 'Tempo total estimado (min)';
        };

        if (currentType === 'micros') {
            const protocolId = String(document.getElementById('micro-protocol')?.value || '').trim();
            if (protocolId) {
                const protocolMinutes = this.getProtocolEstimatedMinutesById?.(protocolId) || 0;
                setValueIfAuto(protocolMinutes, 'protocol');
                setVisualState({
                    disabled: false,
                    source: estimatedInput.dataset.estimateSource || 'protocol',
                    note: 'O protocolo sugere a carga total inicial da micro. VocÃª pode ajustar se esta entrega pedir mais ou menos tempo.',
                    placeholder: 'Ex.: 50'
                });
                return;
            }
            const effort = document.getElementById('crud-effort')?.value || 'medio';
            const suggested = this.getSuggestedMicroEstimatedMinutes?.({ effort }) || 50;
            setValueIfAuto(suggested, 'suggested');
            setVisualState({
                disabled: false,
                source: estimatedInput.dataset.estimateSource || 'suggested',
                note: 'O app sugere a carga total pela combinaÃ§Ã£o de esforÃ§o e janela curta da micro. Ajuste sÃ³ quando souber melhor o tamanho real.',
                placeholder: 'Ex.: 50'
            });
            return;
        }

        if (currentType === 'habits') {
            const protocolId = String(document.getElementById('habit-protocol')?.value || '').trim();
            const mode = this.normalizeHabitTrackMode?.(document.getElementById('habit-track-mode')?.value || 'boolean') || 'boolean';
            const targetValue = Math.max(0, Math.round(Number(document.getElementById('habit-target')?.value || 0)));
            const stepsCount = String(document.getElementById('habit-steps')?.value || '')
                .split(/\r?\n/)
                .map((step) => step.trim())
                .filter(Boolean)
                .length;
            if (estimatedGroup) {
                estimatedGroup.classList.remove('hidden');
                estimatedGroup.classList.add('flex');
                estimatedGroup.style.display = 'flex';
            }

            if (protocolId) {
                const protocolMinutes = this.getProtocolEstimatedMinutesById?.(protocolId) || 0;
                estimatedInput.value = protocolMinutes > 0 ? String(protocolMinutes) : '';
                estimatedInput.dataset.manualOverride = 'false';
                estimatedInput.dataset.estimateSource = 'protocol';
                setVisualState({
                    disabled: true,
                    source: 'protocol',
                    note: 'Com protocolo vinculado, o tempo do habito vem do total do protocolo e deixa de competir com um valor manual.',
                    placeholder: 'Derivado do protocolo'
                });
                return;
            }
            if (mode === 'timer') {
                estimatedInput.value = targetValue > 0 ? String(targetValue) : '';
                estimatedInput.dataset.manualOverride = 'false';
                estimatedInput.dataset.estimateSource = 'target';
                setVisualState({
                    disabled: true,
                    source: 'target',
                    note: 'Em habitos de tempo, a duracao usada no Hoje vem da meta por execucao em minutos.',
                    placeholder: 'Derivado da meta por execucao'
                });
                return;
            }
            const fallbackMinutes = stepsCount > 0 ? Math.max(8, stepsCount * 8) : (mode === 'numeric' ? 10 : 5);
            setValueIfAuto(fallbackMinutes, stepsCount > 0 ? 'steps' : 'suggested');
            setVisualState({
                disabled: false,
                source: estimatedInput.dataset.estimateSource || (stepsCount > 0 ? 'steps' : 'suggested'),
                note: stepsCount > 0
                    ? 'Sem protocolo, o app usa os passos da rotina como base e vocÃª pode refinar o tempo total.'
                    : 'Sem protocolo nem meta de tempo, o app sugere um total simples para ajudar a encaixar o habito na capacidade do dia.',
                placeholder: 'Ex.: 15'
            });
        }
    },

getTodayActionItems: function(dateKey = this.getLocalDateKey()) {
        const state = window.sistemaVidaState;
        const today = String(dateKey || this.getLocalDateKey());
        const now = new Date(`${today}T00:00:00`);
        const items = [];

        const habits = (state.habits || []).filter((habit) =>
            habit && habit.id && habit.archived !== true && habit.status !== 'archived'
        );
        habits.forEach((habit) => {
            const isScheduled = typeof this.isHabitScheduledForDate === 'function'
                ? this.isHabitScheduledForDate(habit, today)
                : true;
            if (!isScheduled) return;
            const isRoutine = typeof this.isHabitRoutine === 'function' ? this.isHabitRoutine(habit) : false;
            const progress = this.getHabitTodayProgressSnapshot?.(habit, today) || { done: false, label: '0/1' };
            const schedule = this.getHabitScheduleContext ? this.getHabitScheduleContext(habit) : {
                startTime: String(habit.startTime || ''),
                startMinutes: this.toClockMinutes(habit.startTime || ''),
                dayPart: this.getDayPartByClockMinutes(this.toClockMinutes(habit.startTime || ''))
            };
            const estimatedMinutes = Math.max(1, Number(this.getHabitEstimatedMinutes?.(habit)) || 0);
            items.push({
                id: `habit:${habit.id}`,
                sourceType: isRoutine ? 'routine' : 'habit',
                sourceId: habit.id,
                title: habit.title || (isRoutine ? 'Rotina' : 'Hábito'),
                dimension: habit.dimension || 'Geral',
                estimatedMinutes,
                startTime: schedule.startTime || '',
                startMinutes: schedule.startMinutes,
                dayPart: schedule.dayPart || 'sem_horario',
                done: !!progress.done,
                progressLabel: progress.label || '',
                urgency: progress.done ? 0 : 55
            });
        });

        const micros = (state.entities?.micros || []).filter((micro) =>
            micro && micro.id && micro.status !== 'abandoned'
        );
        const isMicroInWindow = (micro) => {
            const timing = this.classifyMicroForDate ? this.classifyMicroForDate(micro, today) : null;
            return timing ? (timing.status === 'active_today' || timing.status === 'future') : false;
        };

        micros.filter(isMicroInWindow).forEach((micro) => {
            const done = micro.status === 'done' || !!micro.completed;
            const estimatedMinutes = Math.max(1, Number(this.getMicroEstimatedMinutes(micro)) || 0);
            const dueDays = micro.prazo
                ? Math.floor((new Date(`${micro.prazo}T00:00:00`) - now) / 86400000)
                : null;
            const schedule = this.getMicroScheduleContext ? this.getMicroScheduleContext(micro) : {
                startTime: '',
                startMinutes: null,
                dayPart: 'sem_horario'
            };
            let urgency = done ? 0 : 45;
            if (!done && dueDays !== null && dueDays < 0) urgency = 95;
            else if (!done && dueDays === 0) urgency = 85;
            else if (!done && micro.status === 'in_progress') urgency = 80;
            items.push({
                id: `micro:${micro.id}`,
                sourceType: 'micro',
                sourceId: micro.id,
                title: micro.title || 'Ação',
                dimension: micro.dimension || 'Geral',
                estimatedMinutes,
                startTime: schedule.startTime || '',
                startMinutes: schedule.startMinutes,
                dayPart: schedule.dayPart || 'sem_horario',
                done,
                progressLabel: done ? 'Concluida' : (micro.status === 'in_progress' ? 'Em andamento' : 'Pendente'),
                urgency
            });
        });

        return items.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            if (b.urgency !== a.urgency) return b.urgency - a.urgency;
            if ((a.startMinutes ?? 9999) !== (b.startMinutes ?? 9999)) return (a.startMinutes ?? 9999) - (b.startMinutes ?? 9999);
            return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
        });
    },

getTodayChecklistItems: function(dateKey = this.getLocalDateKey()) {
        const state = window.sistemaVidaState || {};
        const sourceItems = this.getTodayActionItems ? this.getTodayActionItems(dateKey) : [];
        const microById = new Map(
            (state.entities?.micros || [])
                .filter((micro) => micro && micro.id)
                .map((micro) => [String(micro.id), micro])
        );
        return sourceItems
            .filter((item) => item.sourceType === 'micro' && microById.has(String(item.sourceId || '')))
            .map((item) => ({
                ...item,
                micro: microById.get(String(item.sourceId || ''))
            }));
    },

getTodayChecklistMicros: function(dateKey = this.getLocalDateKey()) {
        return (this.getTodayChecklistItems ? this.getTodayChecklistItems(dateKey) : [])
            .map((item) => item.micro)
            .filter(Boolean);
    },

getTodayCapacityState: function(dateKey = this.getLocalDateKey()) {
        const settings = window.sistemaVidaState?.settings || {};
        const rawProfile = settings.dayCapacityProfile || {};
        const defaults = {
            sleepHours: Math.max(4, Math.min(12, Number(rawProfile.sleepHours) || 8)),
            fixedCommitmentsMinutes: Math.max(0, Math.min(16 * 60, Number(rawProfile.fixedCommitmentsMinutes) || (8 * 60))),
            dailyBasicsMinutes: Math.max(30, Math.min(8 * 60, Number(rawProfile.dailyBasicsMinutes) || (2 * 60))),
            bufferMinutes: Math.max(0, Math.min(4 * 60, Number(rawProfile.bufferMinutes) || 60))
        };
        defaults.awakeMinutes = Math.max(8 * 60, (24 * 60) - Math.round(defaults.sleepHours * 60));
        const labels = {
            all: 'Dia inteiro',
            manha: 'Manha',
            tarde: 'Tarde',
            noite: 'Noite'
        };
        const totalWindowMinutes = {
            manha: 6 * 60,
            tarde: 6 * 60,
            noite: 4 * 60
        };
        const checkinAdjustment = this.getCapacityAdjustmentFromCheckin ? this.getCapacityAdjustmentFromCheckin(dateKey) : { factor: 1, extraBufferMinutes: 0, reasons: [], label: '' };
        const baseCapacityMinutes = Math.max(60, defaults.awakeMinutes - defaults.fixedCommitmentsMinutes - defaults.dailyBasicsMinutes - defaults.bufferMinutes);
        const capacityMinutes = Math.max(45, Math.round((baseCapacityMinutes * checkinAdjustment.factor) - checkinAdjustment.extraBufferMinutes));
        const items = this.getActiveTodayActionItems
            ? this.getActiveTodayActionItems(dateKey)
            : (this.getTodayActionItems
                ? this.getTodayActionItems(dateKey)
                : (this.getTodayChecklistItems ? this.getTodayChecklistItems(dateKey) : []));
        const pendingItems = items.filter((item) => !item.done);
        const activeDayPart = (this.getTodayChecklistMode?.() === 'horario')
            ? this.getTodayChecklistDayPart?.() || 'all'
            : 'all';

        const morningCapacity = Math.round(capacityMinutes * (totalWindowMinutes.manha / defaults.awakeMinutes));
        const afternoonCapacity = Math.round(capacityMinutes * (totalWindowMinutes.tarde / defaults.awakeMinutes));
        const nightCapacity = Math.max(0, capacityMinutes - morningCapacity - afternoonCapacity);

        const computeStatus = (planned, capacity) => {
            const usage = capacity > 0 ? (planned / capacity) : 0;
            let status = 'ok';
            if (usage > 1.05) status = 'sobrecarregado';
            else if (usage > 0.85) status = 'cheio';
            return {
                status,
                usagePct: Math.round(Math.max(0, usage) * 100)
            };
        };

        const segmentCapacities = {
            manha: morningCapacity,
            tarde: afternoonCapacity,
            noite: nightCapacity
        };
        const segments = {
            all: null,
            manha: null,
            tarde: null,
            noite: null,
            sem_horario: null
        };

        ['manha', 'tarde', 'noite'].forEach((dayPart) => {
            const planned = pendingItems
                .filter((item) => item.dayPart === dayPart)
                .reduce((sum, item) => sum + Math.max(0, Number(item.estimatedMinutes) || 0), 0);
            const capacity = segmentCapacities[dayPart];
            const statusMeta = computeStatus(planned, capacity);
            segments[dayPart] = {
                key: dayPart,
                label: labels[dayPart],
                capacityMinutes: capacity,
                plannedMinutes: planned,
                remainingMinutes: capacity - planned,
                status: statusMeta.status,
                usagePct: statusMeta.usagePct,
                items: pendingItems.filter((item) => item.dayPart === dayPart)
            };
        });

        const unscheduledPlanned = pendingItems
            .filter((item) => item.dayPart === 'sem_horario')
            .reduce((sum, item) => sum + Math.max(0, Number(item.estimatedMinutes) || 0), 0);
        segments.sem_horario = {
            key: 'sem_horario',
            label: 'Sem horario',
            capacityMinutes: null,
            plannedMinutes: unscheduledPlanned,
            remainingMinutes: null,
            status: unscheduledPlanned > 0 ? 'a_definir' : 'ok',
            usagePct: 0,
            items: pendingItems.filter((item) => item.dayPart === 'sem_horario')
        };

        const plannedMinutes = pendingItems.reduce((sum, item) => sum + Math.max(0, Number(item.estimatedMinutes) || 0), 0);
        const remainingMinutes = capacityMinutes - plannedMinutes;
        const totalStatus = computeStatus(plannedMinutes, capacityMinutes);
        segments.all = {
            key: 'all',
            label: labels.all,
            capacityMinutes,
            plannedMinutes,
            remainingMinutes,
            status: totalStatus.status,
            usagePct: totalStatus.usagePct,
            items: pendingItems
        };

        const focusKey = ['manha', 'tarde', 'noite'].includes(activeDayPart) ? activeDayPart : 'all';
        const activeSegment = segments[focusKey] || segments.all;
        const suggestions = [];
        if ((activeSegment?.status || 'ok') !== 'ok') {
            suggestions.push('Reduza ou mova ações de baixa prioridade.');
            suggestions.push('Proteja ao menos um bloco real de descanso.');
        }
        if (segments.sem_horario.plannedMinutes > 0) {
            suggestions.push('Itens sem horário ainda precisam ser distribuídos nos turnos.');
        }
        if (checkinAdjustment.label && checkinAdjustment.factor !== 1) {
            suggestions.push(checkinAdjustment.label);
        }

        return {
            dateKey: dateKey || this.getLocalDateKey(),
            defaults,
            baseCapacityMinutes,
            capacityMinutes: activeSegment.capacityMinutes,
            plannedMinutes: activeSegment.plannedMinutes,
            remainingMinutes: activeSegment.remainingMinutes,
            status: activeSegment.status,
            usagePct: activeSegment.usagePct,
            activeDayPart: focusKey,
            activeLabel: activeSegment.label,
            totalCapacityMinutes: capacityMinutes,
            totalPlannedMinutes: plannedMinutes,
            totalRemainingMinutes: remainingMinutes,
            totalStatus: totalStatus.status,
            totalUsagePct: totalStatus.usagePct,
            checkinAdjustment,
            items: pendingItems,
            segments,
            suggestions
        };
    },

getNextBestAction: function(options = {}) {
        const state = window.sistemaVidaState;
        const todayStr = this.getLocalDateKey();
        const today = new Date(todayStr + 'T00:00:00');
        const scope = options.scope || 'today';
        const hourNow = new Date().getHours();
        const deepWork = state.deepWork || {};
        if (deepWork.isRunning && deepWork.microId) {
            const runningMicro = (state.entities?.micros || []).find(item => item.id === deepWork.microId) || null;
            return {
                sourceType: 'focus',
                sourceId: String(deepWork.microId || ''),
                title: runningMicro?.title ? `Foco em andamento: ${runningMicro.title}` : 'Foco em andamento',
                reason: 'Existe um bloco de foco ativo.',
                reasons: ['foco em andamento'],
                action: 'open_focus',
                micro: runningMicro
            };
        }
        const micros = (state.entities?.micros || []).filter(m =>
            m && m.id && m.status !== 'done' && m.status !== 'abandoned' && !m.completed
        );

        const candidates = micros.map(micro => {
            const timing = this.classifyMicroForDate ? this.classifyMicroForDate(micro, todayStr) : null;
            if (!timing || timing.status === 'invalid') return null;
            if (scope === 'today' && timing.status === 'future') return null;
            const reasons = [];
            let score = 0;
            const { macro, okr, meta } = this._getMicroContext(micro);
            const prazo = micro.prazo ? new Date(micro.prazo + 'T00:00:00') : null;
            const daysToDue = prazo && !Number.isNaN(prazo.getTime())
                ? Math.floor((prazo - today) / (1000 * 60 * 60 * 24))
                : null;
            const hasStarted = timing.status === 'active_today' || timing.status === 'overdue';
            const plannedThisWeek = this._isPlannedThisWeek(micro.id);
            const dimScoreRaw = Number(state.dimensions?.[micro.dimension]?.score);
            const dimScore = Number.isFinite(dimScoreRaw) ? dimScoreRaw : null;
            const energy = Math.max(0, Math.min(5, Number(state.energy || 0)));
            const effort = this.getMicroEffort(micro);

            if (daysToDue !== null && daysToDue < 0) {
                score += 12 + Math.min(6, Math.abs(daysToDue));
                reasons.push(`${Math.abs(daysToDue)} dia${Math.abs(daysToDue) === 1 ? '' : 's'} em atraso`);
            } else if (daysToDue === 0) {
                score += 9;
                reasons.push('vence hoje');
            } else if (daysToDue !== null && daysToDue <= 2) {
                score += 6;
                reasons.push(`vence em ${daysToDue} dia${daysToDue === 1 ? '' : 's'}`);
            } else if (daysToDue !== null && daysToDue <= 7) {
                score += 3;
                reasons.push('está na janela da semana');
            }

            if (plannedThisWeek) {
                score += 5;
                reasons.push('está no plano da semana');
            }

            if (micro.status === 'in_progress') {
                score += 4;
                reasons.push('já está em andamento');
            } else if (hasStarted) {
                score += 2;
                reasons.push('já pode ser executada');
            } else if (scope === 'today') {
                score -= 4;
            }

            if (macro?.status === 'in_progress') {
                score += 2;
                reasons.push(`destrava a macro "${macro.title}"`);
            } else if (macro?.title) {
                score += 1;
                reasons.push(`conecta com "${macro.title}"`);
            }

            if (meta?.status && meta.status !== 'done' && meta.status !== 'abandoned') {
                score += 1;
            }

            if (dimScore !== null && dimScore > 0 && dimScore <= 40) {
                score += 3;
                reasons.push(`${micro.dimension} está com score baixo na Roda`);
            }

            if (scope === 'today' && energy > 0) {
                if (energy <= 2) {
                    if (effort === 'leve') {
                        score += 4;
                        reasons.push('cabe na energia de hoje');
                    } else if (effort === 'medio') {
                        score -= 2;
                    } else if (effort === 'denso' && !(daysToDue !== null && daysToDue <= 0) && micro.status !== 'in_progress') {
                        score -= 8;
                    }
                } else if (energy >= 4 && effort === 'denso') {
                    score += 2;
                    reasons.push('aproveita energia alta');
                }
            }

            if (scope === 'today' && !hasStarted && !plannedThisWeek && !(daysToDue !== null && daysToDue <= 2)) {
                score -= 3;
            }

            return { micro, macro, okr, meta, score, reasons: reasons.slice(0, 3), daysToDue, plannedThisWeek, effort };
        }).filter(item => item && item.score > 0);

        const energy = Math.max(0, Math.min(5, Number(state.energy || 0)));
        const energyMatched = !options.skipEnergyFilter && energy > 0 && energy <= 2
            ? candidates.filter(item => item.effort !== 'denso' || item.daysToDue !== null && item.daysToDue <= 0 || item.micro.status === 'in_progress')
            : candidates;
        const ranked = energyMatched.length ? energyMatched : candidates;

        ranked.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aDue = a.daysToDue === null ? 9999 : a.daysToDue;
            const bDue = b.daysToDue === null ? 9999 : b.daysToDue;
            return aDue - bDue;
        });

        const criticalMicro = ranked.find(item => item.daysToDue !== null && item.daysToDue <= 0) || null;
        if (criticalMicro) {
            if (criticalMicro.reasons.length === 0) criticalMicro.reasons.push('ação crítica para hoje');
            return {
                ...criticalMicro,
                sourceType: 'micro',
                sourceId: criticalMicro.micro.id,
                title: criticalMicro.micro.title || 'Ação',
                reason: criticalMicro.reasons[0] || 'Ação crítica para hoje.',
                action: 'open_micro'
            };
        }

        const habits = (state.habits || []).filter(habit =>
            habit && habit.id && habit.archived !== true && habit.status !== 'archived' &&
            (typeof this.isHabitScheduledForDate === 'function' ? this.isHabitScheduledForDate(habit, todayStr) : true) &&
            !this.isHabitDoneOnDate(habit, todayStr)
        );
        if (habits.length > 0) {
            const nowMinutes = (new Date().getHours() * 60) + new Date().getMinutes();
            habits.sort((a, b) => {
                const aStart = this.toClockMinutes ? this.toClockMinutes(a.startTime || '') : null;
                const bStart = this.toClockMinutes ? this.toClockMinutes(b.startTime || '') : null;
                const aDist = Number.isFinite(aStart) ? Math.abs(aStart - nowMinutes) : 9999;
                const bDist = Number.isFinite(bStart) ? Math.abs(bStart - nowMinutes) : 9999;
                return aDist - bDist;
            });
            const picked = habits[0];
            const isRoutine = typeof this.isHabitRoutine === 'function' ? this.isHabitRoutine(picked) : false;
            return {
                sourceType: isRoutine ? 'routine' : 'habit',
                sourceId: picked.id,
                title: picked.title || (isRoutine ? 'Rotina' : 'Hábito'),
                dimension: picked.dimension || 'Geral',
                reason: picked.startTime ? `Horário sugerido ${picked.startTime}.` : 'Hábito previsto para hoje.',
                reasons: ['hábito previsto para hoje'],
                action: 'open_habit'
            };
        }

        const todayCheckin = this.getTodayDailyCheckin?.();
        if (!todayCheckin && hourNow < 14) {
            return {
                sourceType: 'checkin',
                sourceId: todayStr,
                title: 'Check-in do dia',
                reason: 'Check-in pendente para calibrar seu dia.',
                reasons: ['check-in pendente'],
                action: 'open_checkin'
            };
        }

        const top = ranked[0] || null;
        if (top) {
            if (top.reasons.length === 0) top.reasons.push('melhor próxima ação ativa');
            return {
                ...top,
                sourceType: 'micro',
                sourceId: top.micro.id,
                title: top.micro.title || 'Ação',
                reason: top.reasons[0] || 'Melhor ação para agora.',
                action: 'open_micro'
            };
        }

        const stress = Number(todayCheckin?.stress || 0);
        const energyNow = Math.max(0, Math.min(5, Number(state.energy || 0)));
        if (scope === 'today' && (energyNow <= 2 || stress >= 4)) {
            return {
                sourceType: 'rest',
                sourceId: todayStr,
                title: 'Ajustar ritmo antes de acelerar',
                reason: 'Energia baixa ou carga alta pedem ajuste de ritmo.',
                reasons: ['recuperacao estrategica'],
                action: 'open_checkin'
            };
        }

        return this._detectHierarchyGap(state) || null;
    },

saveNewEntity: function() {
        const titleInput = document.getElementById('crud-title');
        const title = titleInput ? titleInput.value.trim() : '';

        if (!title) {
            if (this.showBlockingMessage) this.showBlockingMessage('Por favor, insira um título antes de salvar.');
            else if (this.showToast) this.showToast('Por favor, insira um título.', 'error');
            else alert('Por favor, insira um título.');
            return;
        }
        this.clearBlockingMessage();

        const type = document.getElementById('crud-type').value;
        const dimension = document.getElementById('crud-dimension').value;
        const context = document.getElementById('crud-context').value;
        const trigger = (type === 'habits' && document.getElementById('crud-trigger')) ? document.getElementById('crud-trigger').value.trim() : '';
        if (type === 'habits') {
            const routineVal = document.getElementById('habit-routine') ? document.getElementById('habit-routine').value.trim() : '';
            const rewardVal = document.getElementById('habit-reward') ? document.getElementById('habit-reward').value.trim() : '';
            if (!trigger || !routineVal || !rewardVal) {
                this.showBlockingMessage('Para hábitos, preencha gatilho, rotina e recompensa do dia.');
                return;
            }
        }

        const usaAgendamento = ['okrs', 'macros', 'micros'].includes(type);
        let prazo = '';
        let inicioDate = '';
        if (usaAgendamento) {
            inicioDate = document.getElementById('crud-inicio-date')?.value || '';
            prazo = document.getElementById('crud-prazo-date')?.value || '';
            if (type === 'micros' && this.normalizeMicroScheduleContract) {
                const normalizedSchedule = this.normalizeMicroScheduleContract({ inicioDate, prazo });
                inicioDate = normalizedSchedule.inicioDate || '';
                prazo = normalizedSchedule.prazo || '';
            } else {
                if (type === 'micros' && !inicioDate && prazo && this.getDateKeyOffset) inicioDate = this.getDateKeyOffset(prazo, -7);
                else if (type === 'macros' && !inicioDate && prazo) inicioDate = prazo;
                if (!prazo && inicioDate) prazo = inicioDate; // consistência mínima
            }
        } else {
            prazo = document.getElementById('create-prazo')?.value || '';
        }

        const parentId = document.getElementById('create-parent') ? document.getElementById('create-parent').value : '';
        let metaHorizonYears = Number(document.getElementById('crud-meta-horizon')?.value || 1);
        const successCriteria = (document.getElementById('crud-success-criteria')?.value || '').trim();
        const challengeLevel = Number(document.getElementById('crud-challenge-level')?.value || 3);
        const commitmentLevel = Number(document.getElementById('crud-commitment-level')?.value || 3);
        const keyResults = this.readKrRows();
        const effort = this.getMicroEffort({ effort: document.getElementById('crud-effort')?.value || 'medio' });
        const estimatedMinutes = Math.max(0, Math.round(Number(document.getElementById('crud-estimated-minutes')?.value || 0)));
        const obstacle = (document.getElementById('crud-obstacle')?.value || '').trim();
        const ifThen = (document.getElementById('crud-ifthen')?.value || '').trim();

        const isEditing = !!this.editingEntity;
        const id = isEditing ? this.editingEntity.id : 'ent_' + Date.now() + Math.random().toString(36).substr(2, 5);
        if (type === 'metas') {
            const horizonAlign = this.alignMetaHorizonSelection({
                prazo,
                selectedHorizonYears: metaHorizonYears,
                selectElementId: 'crud-meta-horizon'
            });
            if (!horizonAlign.ok) {
                app.showBlockingMessage(horizonAlign.message || 'Ajuste o horizonte da meta antes de salvar.');
                return;
            }
            metaHorizonYears = horizonAlign.horizonYears;
        }
        const windowValidation = this.validateEntityTimeWindow(type, { prazo, inicioDate, metaHorizonYears });
        if (!windowValidation.ok) {
            app.showBlockingMessage(windowValidation.message);
            return;
        }

        const obj = { id: id || '', title: title || '', dimension: dimension || '', prazo: prazo || '' };
        if (usaAgendamento && inicioDate) obj.inicioDate = inicioDate;

        const getOldItem = (eid, etype) => {
            const state = window.sistemaVidaState;
            const list = etype === 'habits' ? state.habits : state.entities[etype];
            return (list || []).find(e => e.id === eid) || {};
        };
        const getResolvedDimension = (entity, type) => {
            if (!entity) return '';
            if (entity.dimension) return String(entity.dimension);
            const state = window.sistemaVidaState;
            if (type === 'okrs') {
                const meta = (state.entities?.metas || []).find(item => item.id === entity.metaId);
                return String(meta?.dimension || '');
            }
            if (type === 'macros') {
                const okr = (state.entities?.okrs || []).find(item => item.id === entity.okrId);
                if (okr?.dimension) return String(okr.dimension);
                const meta = (state.entities?.metas || []).find(item => item.id === (okr?.metaId || entity.metaId));
                return String(meta?.dimension || '');
            }
            if (type === 'micros') {
                const macro = (state.entities?.macros || []).find(item => item.id === entity.macroId);
                const macroDimension = getResolvedDimension(macro, 'macros');
                if (macroDimension) return macroDimension;
                const okr = (state.entities?.okrs || []).find(item => item.id === entity.okrId);
                if (okr?.dimension) return String(okr.dimension);
                const meta = (state.entities?.metas || []).find(item => item.id === (okr?.metaId || entity.metaId));
                return String(meta?.dimension || '');
            }
            return '';
        };
        const oldEntity = isEditing ? getOldItem(id, type) : {};
        const parentSelectEl = document.getElementById('create-parent');
        const hasInvalidCurrentParent = !!(parentSelectEl?.dataset.invalidCurrentParentId) && !parentId;
        if (['metas', 'okrs', 'macros', 'micros', 'habits'].includes(type)) {
            obj.createdAt = oldEntity.createdAt || this.getLocalDateKey();
            const normalizedDimension = this.normalizeDimensionKey(obj.dimension);
            if (!normalizedDimension) {
                app.showBlockingMessage('Selecione uma área válida antes de salvar.');
                return;
            }
            obj.dimension = normalizedDimension;
        }
        const planParentValidation = ['okrs', 'macros', 'micros'].includes(type)
            ? this.validatePlanParentAssignment(type, parentId, { childDimension: obj.dimension, entity: oldEntity, requireStrictDimension: true })
            : null;

        if (type === 'metas' || type === 'okrs') {
            obj.purpose = context || '';
            obj.successCriteria = successCriteria;
            obj.challengeLevel = Math.max(1, Math.min(5, Math.round(challengeLevel || 3)));
            obj.commitmentLevel = Math.max(1, Math.min(5, Math.round(commitmentLevel || 3)));
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (type === 'metas') {
                obj.horizonYears = metaHorizonYears;
                if (parentId) {
                    const parentMeta = window.sistemaVidaState.entities.metas.find(m => m.id === parentId);
                    if (!parentMeta) {
                        app.showToast('Meta pai selecionada não encontrada.', 'error');
                        return;
                    }
                    const parentChain = this.getMetaParentChain(parentMeta.id);
                    if (isEditing && parentChain.includes(id)) {
                        app.showToast('Não é possível criar ciclo entre metas pai e filhas.', 'error');
                        return;
                    }
                    const parentHorizon = this.getMetaHorizonYears(parentMeta);
                    if (parentHorizon <= metaHorizonYears) {
                        app.showToast('A meta pai precisa ter horizonte maior do que a meta filha.', 'error');
                        return;
                    }
                    obj.parentMetaId = parentId;
                    obj.dimension = parentMeta.dimension || obj.dimension;
                }
            } else if (type === 'okrs') {
                if (hasInvalidCurrentParent) {
                    app.showBlockingMessage('Este Projeto estÃ¡ com a Meta atual fora da Ã¡rea selecionada. Escolha uma Meta compatÃ­vel antes de salvar.');
                    return;
                }
                if (!planParentValidation?.ok) {
                    app.showBlockingMessage(planParentValidation?.message || 'Projeto precisa estar vinculado a uma Meta.');
                    return;
                }
                this.syncPlanEntityLineage(obj, type, planParentValidation.parent);
                if (parentId) {
                    const parentMeta = window.sistemaVidaState.entities.metas.find(m => m.id === parentId);
                    if (!parentMeta) {
                        app.showBlockingMessage('Meta pai não encontrada. Atualize o vínculo antes de salvar este Projeto.');
                        return;
                    }
                    if (parentMeta && parentMeta.dimension && obj.dimension && parentMeta.dimension !== 'Geral' && obj.dimension !== 'Geral' && parentMeta.dimension !== obj.dimension) {
                        app.showBlockingMessage(`Área incompatível: A Meta pai pertence à área [${parentMeta.dimension}], mas este Projeto está configurado como [${obj.dimension}].`);
                        return;
                    }
                    obj.metaId = parentId || '';
                }
                const okrCriterion = successCriteria || context || '';
                if (!okrCriterion.trim()) {
                    app.showBlockingMessage('Defina o Critério / Meta do Projeto para salvar.');
                    return;
                }
                obj.successCriteria = okrCriterion;
                obj.purpose = okrCriterion;
                obj.keyResults = keyResults;
                const oldItem = getOldItem(id, 'okrs');
                obj.rewarded70 = !!oldItem.rewarded70;
                obj.status = isEditing ? (oldItem.status || 'pending') : 'pending';
                const krProgress = this.computeKeyResultsProgress(obj.keyResults);
                if (krProgress !== null) obj.progress = krProgress;
            }
        } else if (type === 'macros') {
            obj.description = context || '';
            obj.obstacle = obstacle;
            obj.ifThen = ifThen;
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (hasInvalidCurrentParent) {
                app.showBlockingMessage('Esta Entrega estÃ¡ com o Projeto atual fora da Ã¡rea selecionada. Escolha um Projeto compatÃ­vel antes de salvar.');
                return;
            }
            if (!planParentValidation?.ok) {
                app.showBlockingMessage(planParentValidation?.message || 'Entrega precisa estar vinculada a um Projeto.');
                return;
            }
            this.syncPlanEntityLineage(obj, type, planParentValidation.parent);
            if (parentId) {
                const okr = window.sistemaVidaState.entities.okrs.find(o => o.id === parentId);
                if (!okr) {
                    app.showBlockingMessage('Projeto pai não encontrado. Atualize o vínculo antes de salvar esta Entrega.');
                    return;
                }
                const okrDimension = getResolvedDimension(okr, 'okrs');
                if (okrDimension && obj.dimension && okrDimension !== 'Geral' && obj.dimension !== 'Geral' && okrDimension !== obj.dimension) {
                    app.showBlockingMessage(`Área incompatível: O Projeto pai pertence à área [${okrDimension}], mas esta Entrega está configurada como [${obj.dimension}].`);
                    return;
                }
                obj.okrId = parentId;
                obj.metaId = okr.metaId || '';
            }
        } else if (type === 'micros') {
            if (obj.inicioDate && obj.prazo) {
                const start = new Date(obj.inicioDate + 'T00:00:00');
                const end = new Date(obj.prazo + 'T00:00:00');
                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
                    app.showBlockingMessage('Datas inválidas para Ação. Verifique início e prazo.');
                    return;
                }
                const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                if (diffDays > 7) {
                    app.showBlockingMessage('Uma Ação não pode durar mais de 7 dias. Divida-a em partes menores ou classifique como Entrega.');
                    return;
                }
            }
            obj.indicator = context || '';
            obj.effort = effort;
            obj.estimatedMinutes = estimatedMinutes > 0 ? estimatedMinutes : 0;
            obj.startTime = String(document.getElementById('micro-start-time')?.value || '').trim();
            obj.obstacle = obstacle;
            obj.ifThen = ifThen;
            const oldItem = getOldItem(id, 'micros');
            obj.status = isEditing ? (oldItem.status || 'pending') : 'pending';
            obj.completed = obj.status === 'done';
            obj.progress = obj.completed ? 100 : 0;
            const microStepsRaw = String(document.getElementById('micro-steps')?.value || '');
            obj.steps = microStepsRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            const microProtocolSel = document.getElementById('micro-protocol');
            obj.protocolId = microProtocolSel && microProtocolSel.value ? microProtocolSel.value : '';
            if (!obj.protocolId && typeof this.inferMicroProtocolIdFromSteps === 'function') {
                obj.protocolId = this.inferMicroProtocolIdFromSteps(obj.steps || []);
            }
            obj.stepLogs = isEditing ? (oldItem.stepLogs || {}) : {};
            obj.sourceHabitId = isEditing ? String(oldItem.sourceHabitId || '') : '';
            obj.sourceProtocolId = isEditing ? String(oldItem.sourceProtocolId || '') : '';
            obj.sourceType = isEditing ? String(oldItem.sourceType || '') : '';
            obj.focusBlockMinutes = isEditing ? Math.max(0, Number(oldItem.focusBlockMinutes) || 0) : 0;
            if (!obj.steps.length) obj.stepLogs = {};
            else {
                Object.keys(obj.stepLogs || {}).forEach(dateKey => {
                    const dayMap = obj.stepLogs[dateKey] || {};
                    const cleaned = {};
                    obj.steps.forEach((_, idx) => {
                        if (dayMap[idx] || dayMap[String(idx)]) cleaned[idx] = true;
                    });
                    obj.stepLogs[dateKey] = cleaned;
                });
            }
             
            if (hasInvalidCurrentParent) {
                app.showBlockingMessage('Esta Ação está com a Entrega atual fora da área selecionada. Escolha uma Entrega compatível antes de salvar.');
                return;
            }
            if (!planParentValidation?.ok) {
                app.showBlockingMessage(planParentValidation?.message || 'Ação precisa estar vinculada a uma Entrega.');
                return;
            }
            this.syncPlanEntityLineage(obj, type, planParentValidation.parent);
            if (parentId) {
                const macro = window.sistemaVidaState.entities.macros.find(m => m.id === parentId);
                if (!macro) {
                    app.showBlockingMessage('Entrega pai não encontrada. Atualize o vínculo antes de salvar esta Ação.');
                    return;
                }
                const macroDimension = getResolvedDimension(macro, 'macros');
                if (macroDimension && obj.dimension && macroDimension !== 'Geral' && obj.dimension !== 'Geral' && macroDimension !== obj.dimension) {
                    app.showBlockingMessage(`Área incompatível: A Entrega pai pertence à área [${macroDimension}], mas esta Ação está configurada como [${obj.dimension}].`);
                    return;
                }
                const linkedOkr = window.sistemaVidaState.entities.okrs.find(o => o.id === macro.okrId);
                obj.macroId = macro.id || '';
                obj.okrId = macro.okrId || '';
                obj.metaId = macro.metaId || linkedOkr?.metaId || '';
            }
        } else if (type === 'habits') {
            const isContinuous = !!(document.getElementById('habit-continuous')?.checked);
            obj.continuous = isContinuous;
            if (isContinuous) obj.prazo = '';
            obj.context = '';
            obj.completed = isEditing ? (getOldItem(id, 'habits').completed || false) : false;
            obj.trigger = trigger || '';
            obj.routine = (document.getElementById('habit-routine') ? document.getElementById('habit-routine').value.trim() : '') || title;
            obj.reward = document.getElementById('habit-reward') ? document.getElementById('habit-reward').value.trim() : '';
            const stepsRaw = document.getElementById('habit-steps') ? document.getElementById('habit-steps').value : '';
            obj.steps = stepsRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            obj.trackMode = this.normalizeHabitTrackMode?.(document.getElementById('habit-track-mode') ? document.getElementById('habit-track-mode').value : 'boolean') || 'boolean';
            obj.targetValue = document.getElementById('habit-target') ? parseFloat(document.getElementById('habit-target').value) : 1;
            const protocolSel = document.getElementById('habit-protocol');
            const selectedProtocolId = protocolSel && protocolSel.value ? protocolSel.value : '';
            const currentTrackMode = this.normalizeHabitTrackMode?.(document.getElementById('habit-track-mode') ? document.getElementById('habit-track-mode').value : 'boolean') || 'boolean';
            obj.estimatedMinutes = (selectedProtocolId || currentTrackMode === 'timer')
                ? 0
                : (estimatedMinutes > 0 ? estimatedMinutes : 0);
            obj.frequency = document.getElementById('habit-frequency') ? document.getElementById('habit-frequency').value : 'daily';
            obj.intervalDays = Math.max(0, Math.round(Number(document.getElementById('habit-interval-days')?.value || 0)));
            obj.dayOfMonth = Math.max(0, Math.round(Number(document.getElementById('habit-day-of-month')?.value || 0)));
            obj.scheduleStartDate = String(document.getElementById('habit-schedule-start-date')?.value || '').trim();
            obj.startTime = document.getElementById('habit-start-time') ? document.getElementById('habit-start-time').value : '';
            obj.reminderEnabled = !!(document.getElementById('habit-reminder-enabled') && document.getElementById('habit-reminder-enabled').checked);
            obj.reminderTime = (document.getElementById('habit-reminder-time')?.value || '').trim();
            obj.reminderIntervalEnabled = !!document.getElementById('habit-reminder-interval-enabled')?.checked;
            obj.reminderWindowStart = String(document.getElementById('habit-reminder-window-start')?.value || '').trim();
            obj.reminderWindowEnd = String(document.getElementById('habit-reminder-window-end')?.value || '').trim();
            obj.reminderIntervalMin = Math.max(5, Number(document.getElementById('habit-reminder-interval-min')?.value || 60));
            if (!obj.reminderIntervalEnabled) {
                obj.reminderWindowStart = '';
                obj.reminderWindowEnd = '';
                obj.reminderIntervalMin = 0;
            }
            if (obj.reminderEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
            }
            const daysSelect = document.getElementById('habit-days');
            if (daysSelect && obj.frequency === 'specific') {
                obj.specificDays = Array.from(daysSelect.selectedOptions).map(o => o.value);
            } else {
                obj.specificDays = [];
            }
            if (obj.frequency !== 'every_x_days') {
                obj.intervalDays = 0;
                obj.scheduleStartDate = '';
            }
            if (obj.frequency !== 'monthly') {
                obj.dayOfMonth = 0;
            }
            obj.logs = isEditing ? (getOldItem(id, 'habits').logs || {}) : {};
            obj.stepLogs = isEditing ? (getOldItem(id, 'habits').stepLogs || {}) : {};
            obj.maturity = isEditing ? (getOldItem(id, 'habits').maturity || 'forming') : 'forming';
            obj.maturityMeta = isEditing ? (getOldItem(id, 'habits').maturityMeta || {}) : {};
            const keyEl = document.getElementById('habit-key');
            const manualKey = keyEl ? !!keyEl.checked : !!getOldItem(id, 'habits').isKey;
            obj.isKey = manualKey;
            obj.keyAutoSuggested = isEditing ? (!!getOldItem(id, 'habits').keyAutoSuggested) : false;
            obj.keyAutoReason = isEditing ? (getOldItem(id, 'habits').keyAutoReason || '') : '';
            const oldDismissed = isEditing ? getOldItem(id, 'habits').keyDismissedAt : undefined;
            if (oldDismissed) obj.keyDismissedAt = oldDismissed;
            const linkedSel = document.getElementById('habit-linked-meta');
            obj.linkedMetaId = linkedSel && linkedSel.value ? linkedSel.value : null;
            if (obj.linkedMetaId) {
                const linkedMeta = (window.sistemaVidaState?.entities?.metas || []).find(item => item.id === obj.linkedMetaId);
                if (!linkedMeta) {
                    app.showBlockingMessage('A Meta vinculada ao habito nao foi encontrada. Atualize o vinculo antes de salvar.');
                    return;
                }
                const habitDimension = this.normalizeDimensionKey(obj.dimension);
                const metaDimension = this.normalizeDimensionKey(linkedMeta.dimension);
                if (habitDimension && metaDimension && habitDimension !== metaDimension) {
                    app.showBlockingMessage(`Area incompativel: a Meta vinculada pertence a area [${metaDimension}], mas este habito esta configurado como [${habitDimension}].`);
                    return;
                }
            }
            obj.protocolId = selectedProtocolId;
            if (!obj.protocolId && typeof this.inferHabitProtocolIdFromSteps === 'function') {
                obj.protocolId = this.inferHabitProtocolIdFromSteps(obj.steps || []);
            }
            obj.sourceStrengthId = document.getElementById('habit-strength-source')?.value || '';
            obj.sourceShadowId = document.getElementById('habit-shadow-source')?.value || '';
            const shadowModeEl = document.getElementById('habit-shadow-mode');
            obj.shadowMode = obj.sourceShadowId ? (shadowModeEl?.value || 'replace') : '';
            // Legacy compat fields (for gamification events recorded earlier)
            obj.sourceType = obj.sourceStrengthId ? 'strength' : obj.sourceShadowId ? 'shadow' : '';
            obj.sourceId = obj.sourceStrengthId || obj.sourceShadowId || '';
            obj.habitMode = obj.sourceType === 'strength' ? 'build' : (obj.shadowMode || '');
            if (!obj.steps.length) obj.stepLogs = {};
            else {
                Object.keys(obj.stepLogs || {}).forEach(dateKey => {
                    const dayMap = obj.stepLogs[dateKey] || {};
                    const cleaned = {};
                    obj.steps.forEach((_, idx) => {
                        if (dayMap[idx] || dayMap[String(idx)]) cleaned[idx] = true;
                    });
                    obj.stepLogs[dateKey] = cleaned;
                });
            }
        }

        if (isEditing) {
            const list = type === 'habits' ? window.sistemaVidaState.habits : window.sistemaVidaState.entities[type];
            const idx = list.findIndex(e => e.id === id);
            if (idx !== -1) list[idx] = obj;
            if (['micros', 'macros', 'okrs', 'metas'].includes(type)) this.updateCascadeProgress(id, type);
        } else {
            if (type === 'habits') {
                if (!window.sistemaVidaState.habits) window.sistemaVidaState.habits = [];
                window.sistemaVidaState.habits.push(obj);
            } else {
                if (!window.sistemaVidaState.entities[type]) window.sistemaVidaState.entities[type] = [];
                window.sistemaVidaState.entities[type].push(obj);
                if (['micros', 'macros', 'okrs', 'metas'].includes(type)) this.updateCascadeProgress(obj.id, type);
            }
        }
        if (type === 'metas') {
            this.markCadence('lifeGoals');
        }

        // Sincroniza seleção do micro no plano da semana (novo e edição).
        if (type === 'micros') {
            const toggleEl = document.getElementById('add-to-week-plan');
            const weekKey = this._getWeekKey();
            const plan = (window.sistemaVidaState.weekPlans || {})[weekKey];
            if (toggleEl && plan) {
                if (!Array.isArray(plan.selectedMicros)) plan.selectedMicros = [];
                const alreadySelected = plan.selectedMicros.includes(obj.id);
                if (toggleEl.checked && !alreadySelected) {
                    plan.selectedMicros.push(obj.id);
                } else if (!toggleEl.checked && alreadySelected) {
                    plan.selectedMicros = plan.selectedMicros.filter(mid => mid !== obj.id);
                }
            }
            const pendingNotePrefill = this._pendingMicroNotePrefill;
            if (pendingNotePrefill?.noteId) {
                const notes = window.sistemaVidaState.profile?.notes || [];
                const note = notes.find((item) => item.id === pendingNotePrefill.noteId);
                if (note) {
                    note.linkedTo = { entityType: 'micros', entityId: obj.id };
                    note.updatedAt = new Date().toISOString();
                }
            }
        }

        this.editingEntity = null;
        if (type === 'micros' || this._pendingMicroNotePrefill) this._pendingMicroNotePrefill = null;
        if (type === 'habits') {
            this.syncIdentityLinkedHabits();
            this.evaluateIdentityAchievements();
            this.scheduleHabitReminders();
        }
        this.closeModal();
        this.saveState(false); // Feedback ativo para criação/edição manual

        if (this.currentView === 'planos') {
            const typeMapping = { metas: 'metas', okrs: 'okrs', macros: 'macro', micros: 'micro' };
            this.switchPlanosTab(typeMapping[type]);
            this.render.planos();
        } else if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
    },

openEntityReview: function(id, type) {
        const state = window.sistemaVidaState;
        const list = type === 'habits' ? state.habits : state.entities[type];
        const entity = (list || []).find(e => e.id === id);
        
        if (!entity) return;

        this.currentReviewEntity = entity;
        this.currentReviewType = type;

        const modal = document.getElementById('review-entity-modal');
        const title = document.getElementById('review-entity-title');
        const promoteSection = document.getElementById('promote-section');
        const promoteLabel = document.getElementById('promote-label');
        const reassignSection = document.getElementById('reassign-section');
        const parentSelect = document.getElementById('reassign-parent-select');
        const parentLabel = document.getElementById('reassign-parent-label');

        // Configuração de Título
        const typeLabels = { metas: 'Meta', okrs: 'Projeto', macros: 'Entrega', micros: 'Ação' };
        title.textContent = `Gerir ${typeLabels[type] || 'Entidade'}: ${entity.title}`;

        // Configuração de Promoção
        if (type === 'metas') {
            promoteSection.classList.add('hidden');
        } else {
            promoteSection.classList.remove('hidden');
            const nextLevel = { okrs: 'Meta', macros: 'Projeto', micros: 'Entrega' };
            promoteLabel.textContent = `Promover para ${nextLevel[type]}`;
        }

        // Configuração de Reatribuição (Mesma Hierarquia)
        if (type === 'metas') {
            reassignSection.classList.add('hidden');
        } else {
            reassignSection.classList.remove('hidden');
            let potentialParents = [];
            let currentParentId = '';
            let parentTypeLabel = '';

            if (type === 'okrs') {
                potentialParents = state.entities.metas;
                currentParentId = entity.metaId;
                parentTypeLabel = 'Selecionar Nova Meta';
            } else if (type === 'macros') {
                potentialParents = state.entities.okrs;
                currentParentId = entity.okrId;
                parentTypeLabel = 'Selecionar Novo Projeto';
            } else if (type === 'micros') {
                potentialParents = state.entities.macros;
                currentParentId = entity.macroId;
                parentTypeLabel = 'Selecionar Nova Entrega';
            }

            parentLabel.textContent = parentTypeLabel;
            const entityDimension = this.getResolvedPlanDimension(entity, type) || String(entity.dimension || '').trim();
            potentialParents = potentialParents.filter((parent) => {
                const parentValidation = this.validatePlanParentAssignment(type, parent.id, { childDimension: entityDimension, entity });
                if (!parentValidation.ok) return false;
                const parentDimension = this.getResolvedPlanDimension(parent, type === 'okrs' ? 'metas' : type === 'macros' ? 'okrs' : 'macros');
                return this.arePlanDimensionsCompatible(entityDimension, parentDimension);
            });
            parentSelect.innerHTML = potentialParents.map(p =>
                `<option value="${p.id}" ${p.id === currentParentId ? 'selected' : ''}>[${this.escapeHtml(this.getResolvedPlanDimension(p, type === 'okrs' ? 'metas' : type === 'macros' ? 'okrs' : 'macros') || 'Sem dimensão')}] ${this.escapeHtml(p.title)}</option>`
            ).join('');
            
            if (potentialParents.length === 0) {
                parentSelect.innerHTML = '<option value="">Nenhum pai disponível</option>';
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

processQuarterlyReview: async function() {
        const state = window.sistemaVidaState;
        const saveBtn = document.getElementById('quarterly-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Processando...';
            saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
        }
        try {
            // Motor de revisão: busca todos os cartões de Projeto no modal
            const items = document.querySelectorAll('#quarterly-okrs-list div[data-okr-id]');
            if (items.length === 0) {
                state.cycleStartDate = this.getLocalDateKey();
                this.markCadence('cycleReview', state.cycleStartDate);
                await this.saveState(true);
                this.closeQuarterlyModal();
                this.showToast('Novo ciclo iniciado. Nenhum Projeto ativo para revisar.', 'success');
                if (this.currentView === 'painel') this.render.painel();
                return;
            }

            let processed = 0;
            let concluded = 0;
            let archived = 0;
            let carried = 0;
            let migrated = 0;
            const todayStr = this.getLocalDateKey();

            items.forEach(item => {
                const id = item.getAttribute('data-okr-id');
                const selectedAction = item.querySelector(`input[name="action_${id}"]:checked`);
                const action = selectedAction ? selectedAction.value : 'continuar';
                const migrateChecked = !!item.querySelector(`#migrate_${id}`)?.checked;
                const okr = state.entities.okrs.find(o => o.id === id);
                if (!okr) return;

                if (action === 'concluir') {
                    okr.status = 'done';
                    okr.progress = 100;
                    concluded++;
                    const macros = state.entities.macros.filter(m => m.okrId === id);
                    macros.forEach(m => {
                        m.status = 'done';
                        m.progress = 100;
                        const micros = state.entities.micros.filter(mic => mic.macroId === m.id);
                        micros.forEach(mic => {
                            mic.status = 'done';
                            mic.completed = true;
                            mic.progress = 100;
                        });
                    });
                } else if (action === 'arquivar') {
                    okr.status = 'abandoned';
                    archived++;
                    const macros = state.entities.macros.filter(m => m.okrId === id);
                    macros.forEach(m => {
                        m.status = 'abandoned';
                        const micros = state.entities.micros.filter(mic => mic.macroId === m.id);
                        micros.forEach(mic => { if (mic.status !== 'done') mic.status = 'abandoned'; });
                    });
                } else {
                    carried++;
                    if (migrateChecked) {
                        const macrosIds = state.entities.macros.filter(m => m.okrId === id).map(m => m.id);
                        const idsToMigrate = state.entities.micros
                            .filter((micro) => macrosIds.includes(micro.macroId) && micro.status !== 'done')
                            .map((micro) => String(micro.id || ''))
                            .filter(Boolean);
                        if (idsToMigrate.length && typeof this.rebaseSpecificMicrosToDate === 'function') {
                            migrated += this.rebaseSpecificMicrosToDate(idsToMigrate, todayStr);
                        }
                    }
                }
                processed++;
            });

            // Reset do ciclo para a data atual
            state.cycleStartDate = this.getLocalDateKey();
            this.markCadence('cycleReview', state.cycleStartDate);
            await this.saveState(true);
            this.closeQuarterlyModal();

            const summary = `${processed} Projetos: ${concluded} concluídos, ${archived} arquivados, ${carried} continuados` + (migrated ? `, ${migrated} micros migradas` : '');
            this.showToast(`Novo ciclo iniciado com sucesso. ${summary}.`, 'success');
            if (this.currentView === 'painel') this.render.painel();
            if (this.currentView === 'planos') this.render.planos();
            if (this.currentView === 'hoje') this.render.hoje();
        } catch (error) {
            console.error('Erro ao processar revisão de ciclo:', error);
            this.showToast('Falha ao processar a revisão de ciclo. Tente novamente.', 'error');
        } finally {
            const modalOpen = !!document.getElementById('quarterly-modal') && !document.getElementById('quarterly-modal').classList.contains('hidden');
            if (saveBtn && modalOpen) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Novo Ciclo';
                saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
            }
        }
    },

editEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const list = type === 'habits' ? state.habits : state.entities[type];
        const item = list.find(e => e.id === id);
        if (!item) return;

        this.editingEntity = { id, type };
        
        // Configura o modal para edição
        document.getElementById('crud-modal').classList.remove('hidden');
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Item';
        
        // Preenche campos
        document.getElementById('crud-title').value = item.title || '';
        document.getElementById('crud-type').value = type;
        document.getElementById('crud-dimension').value = item.dimension || 'Geral';
        document.getElementById('create-prazo').value = item.prazo || '';
        const horizonSelect = document.getElementById('crud-meta-horizon');
        if (horizonSelect) {
            const horizon = Number(item.horizonYears || this.getMetaHorizonYears(item) || 1);
            horizonSelect.value = String(horizon);
        }
        const inicioInput = document.getElementById('crud-inicio-date');
        const prazoInput = document.getElementById('crud-prazo-date');
        if (inicioInput) inicioInput.value = item.inicioDate || item.agendamento?.inicioDate || (type === 'micros' ? (this.resolveMicroEffectiveStartDate?.(item) || '') : (type === 'okrs' ? '' : (item.prazo || '')));
        if (prazoInput) prazoInput.value = item.prazo || '';
        document.getElementById('crud-context').value = item.purpose || item.description || item.indicator || '';
        const successCriteriaInput = document.getElementById('crud-success-criteria');
        if (successCriteriaInput) successCriteriaInput.value = item.successCriteria || item.purpose || '';
        const challengeInput = document.getElementById('crud-challenge-level');
        if (challengeInput) challengeInput.value = String(item.challengeLevel || 3);
        const commitmentInput = document.getElementById('crud-commitment-level');
        if (commitmentInput) commitmentInput.value = String(item.commitmentLevel || 3);
        const effortInput = document.getElementById('crud-effort');
        const estimatedInput = document.getElementById('crud-estimated-minutes');
        if (effortInput) effortInput.value = this.getMicroEffort(item);
        if (estimatedInput) {
            estimatedInput.value = Number(item.estimatedMinutes || 0) > 0 ? String(Math.round(Number(item.estimatedMinutes))) : '';
            estimatedInput.dataset.manualOverride = Number(item.estimatedMinutes || 0) > 0 ? 'true' : 'false';
            estimatedInput.dataset.estimateSource = Number(item.estimatedMinutes || 0) > 0 ? 'manual' : '';
        }
        const obstacleInput = document.getElementById('crud-obstacle');
        if (obstacleInput) obstacleInput.value = item.obstacle || '';
        const ifThenInput = document.getElementById('crud-ifthen');
        if (ifThenInput) ifThenInput.value = item.ifThen || '';
        const microStartTimeInput = document.getElementById('micro-start-time');
        if (microStartTimeInput) microStartTimeInput.value = item.startTime || '';
        this.populateKrRows(item.keyResults);
        
        // Compatibilidade retrô: agendamento antigo migra visualmente para datas reais
        
        if (type === 'habits') {
            const continuousCheck = document.getElementById('habit-continuous');
            if (continuousCheck) {
                continuousCheck.checked = !!item.continuous;
                this.onHabitContinuousChange(!!item.continuous);
            }
            const keyCheck = document.getElementById('habit-key');
            if (keyCheck) keyCheck.checked = !!item.isKey;
            document.getElementById('crud-trigger').value = item.trigger || '';
            const routineInput = document.getElementById('habit-routine');
            if (routineInput) routineInput.value = item.routine || item.context || item.title || '';
            const rewardInput = document.getElementById('habit-reward');
            if (rewardInput) rewardInput.value = item.reward || '';
            const stepsInput = document.getElementById('habit-steps');
            if (stepsInput) stepsInput.value = Array.isArray(item.steps) ? item.steps.join('\n') : '';
            if (document.getElementById('habit-track-mode')) document.getElementById('habit-track-mode').value = this.normalizeHabitTrackMode?.(item.trackMode || 'boolean') || 'boolean';
            if (document.getElementById('habit-target')) document.getElementById('habit-target').value = item.targetValue || 1;
            if (document.getElementById('habit-frequency')) document.getElementById('habit-frequency').value = item.frequency || 'daily';
            if (document.getElementById('habit-interval-days')) document.getElementById('habit-interval-days').value = Number(item.intervalDays || 0) || '';
            if (document.getElementById('habit-day-of-month')) document.getElementById('habit-day-of-month').value = Number(item.dayOfMonth || 0) || '';
            if (document.getElementById('habit-schedule-start-date')) document.getElementById('habit-schedule-start-date').value = item.scheduleStartDate || '';
            if (document.getElementById('habit-start-time')) document.getElementById('habit-start-time').value = item.startTime || '';
            if (document.getElementById('habit-reminder-time')) document.getElementById('habit-reminder-time').value = item.reminderTime || '';
            if (document.getElementById('habit-reminder-enabled')) document.getElementById('habit-reminder-enabled').checked = !!item.reminderEnabled;
            if (document.getElementById('habit-reminder-interval-enabled')) document.getElementById('habit-reminder-interval-enabled').checked = !!item.reminderIntervalEnabled;
            if (document.getElementById('habit-reminder-window-start')) document.getElementById('habit-reminder-window-start').value = item.reminderWindowStart || '';
            if (document.getElementById('habit-reminder-window-end')) document.getElementById('habit-reminder-window-end').value = item.reminderWindowEnd || '';
            if (document.getElementById('habit-reminder-interval-min')) document.getElementById('habit-reminder-interval-min').value = Number(item.reminderIntervalMin || 60);
            this.onHabitReminderIntervalToggle(!!item.reminderIntervalEnabled);
            if (document.getElementById('habit-days') && item.specificDays) {
                Array.from(document.getElementById('habit-days').options).forEach(opt => {
                    opt.selected = item.specificDays.includes(opt.value);
                });
            }
            this.onHabitFreqChange(item.frequency || 'daily');
        } else if (type === 'micros') {
            const microStepsInput = document.getElementById('micro-steps');
            if (microStepsInput) microStepsInput.value = Array.isArray(item.steps) ? item.steps.join('\n') : '';
            const microProtocolSelect = document.getElementById('micro-protocol');
            const inferredMicroProtocolId = item.protocolId || (typeof this.inferMicroProtocolIdFromSteps === 'function'
                ? this.inferMicroProtocolIdFromSteps(item.steps || [])
                : '');
            if (typeof this.populateMicroProtocolSelect === 'function') this.populateMicroProtocolSelect(inferredMicroProtocolId || '');
            if (microProtocolSelect && inferredMicroProtocolId && microProtocolSelect.querySelector(`option[value="${inferredMicroProtocolId}"]`)) {
                microProtocolSelect.value = inferredMicroProtocolId;
            }
        }

        this.onTypeChange(type);
        if ((item.obstacle || item.ifThen) && ['macros', 'micros'].includes(type)) this.toggleCrudWoop(true);
        if (type === 'habits') {
            this.renderHabitStepsChecklist(id);
            // Restaura vínculo com Meta (populateHabitLinkedMeta já rodou dentro de onTypeChange)
            const linkedSel = document.getElementById('habit-linked-meta');
            if (linkedSel && item.linkedMetaId) {
                if (linkedSel.querySelector(`option[value="${item.linkedMetaId}"]`)) {
                    linkedSel.value = item.linkedMetaId;
                }
            }
            const protocolSel = document.getElementById('habit-protocol');
            const inferredProtocolId = item.protocolId || (typeof this.inferHabitProtocolIdFromSteps === 'function'
                ? this.inferHabitProtocolIdFromSteps(item.steps || [])
                : '');
            if (typeof this.populateHabitProtocolSelect === 'function') this.populateHabitProtocolSelect(inferredProtocolId || '');
            if (protocolSel && inferredProtocolId && protocolSel.querySelector(`option[value="${inferredProtocolId}"]`)) {
                protocolSel.value = inferredProtocolId;
            }
            this.syncHabitProtocolAuthorityUI?.(protocolSel?.value || '');
            this.refreshCrudEstimatedFieldState?.('habits');
            const strengthSel = document.getElementById('habit-strength-source');
            const shadowSel = document.getElementById('habit-shadow-source');
            const shadowModeEl = document.getElementById('habit-shadow-mode');
            const strengthId = this._getHabitSourceStrengthId(item);
            const shadowId = this._getHabitSourceShadowId(item);
            if (strengthSel && strengthId && strengthSel.querySelector(`option[value="${strengthId}"]`)) strengthSel.value = strengthId;
            if (shadowSel && shadowId && shadowSel.querySelector(`option[value="${shadowId}"]`)) {
                shadowSel.value = shadowId;
                this.onHabitShadowSourceChange(shadowId);
            }
            if (shadowModeEl && item.shadowMode) shadowModeEl.value = item.shadowMode;
            else if (shadowModeEl && item.habitMode && item.sourceType === 'shadow') shadowModeEl.value = item.habitMode;
        } else if (type === 'micros') {
            const microProtocolSelect = document.getElementById('micro-protocol');
            const inferredMicroProtocolId = item.protocolId || (typeof this.inferMicroProtocolIdFromSteps === 'function'
                ? this.inferMicroProtocolIdFromSteps(item.steps || [])
                : '');
            if (typeof this.populateMicroProtocolSelect === 'function') this.populateMicroProtocolSelect(inferredMicroProtocolId || '');
            if (microProtocolSelect && inferredMicroProtocolId && microProtocolSelect.querySelector(`option[value="${inferredMicroProtocolId}"]`)) {
                microProtocolSelect.value = inferredMicroProtocolId;
            }
            const microStepsInput = document.getElementById('micro-steps');
            if (microStepsInput) microStepsInput.value = Array.isArray(item.steps) ? item.steps.join('\n') : '';
            this.refreshCrudEstimatedFieldState?.('micros');
        }
        
        // Seta o pai após popular a lista
        const parentSelect = document.getElementById('create-parent');
        if (parentSelect) {
            let parentId = '';
            let parentTypeLabel = '';
            if (type === 'metas') parentId = item.parentMetaId || '';
            if (type === 'okrs') {
                parentId = item.metaId || '';
                parentTypeLabel = 'Meta';
            }
            if (type === 'macros') {
                parentId = item.okrId || '';
                parentTypeLabel = 'Projeto';
            }
            if (type === 'micros') {
                parentId = item.macroId || '';
                parentTypeLabel = 'Entrega';
            }
            const hasOption = Array.from(parentSelect.options || []).some(opt => opt.value === parentId);
            if (parentId && !hasOption && type !== 'metas') {
                parentSelect.dataset.invalidCurrentParentId = parentId;
                parentSelect.dataset.invalidCurrentParentType = parentTypeLabel;
                parentSelect.dataset.invalidCurrentParentTitle = item.title || '';
                const placeholder = document.createElement('option');
                const ghost = placeholder;
                placeholder.value = '';
                ghost.textContent = 'Vínculo atual (fora do filtro de dimensão)';
                ghost.dataset.ghostLineage = 'true';
                parentSelect.insertBefore(ghost, parentSelect.firstChild);
            }
            parentSelect.value = parentSelect.dataset.invalidCurrentParentId ? '' : parentId;
        }
        if (type === 'micros') this.syncMicroWeekPlanToggle(id);

        // Botão de notas no header do modal
        const notesBtn = document.getElementById('crud-notes-btn');
        const notesBtnCount = document.getElementById('crud-notes-btn-count');
        if (notesBtn) {
            const count = this.getLinkedNotes(type, id).length;
            notesBtn.classList.remove('hidden');
            notesBtn.classList.add('flex');
            if (notesBtnCount) notesBtnCount.textContent = count > 0 ? `${count} nota${count > 1 ? 's' : ''}` : 'Notas';
            notesBtn.dataset.entityType = type;
            notesBtn.dataset.entityId = id;
            notesBtn.dataset.entityTitle = item.title || '';
        }
    },

completeMicroAction: function(id) {
        const todayKey = this.getLocalDateKey();
        const state = window.sistemaVidaState;
        const micro = state.entities.micros.find(m => m.id === id);
        if (!micro) {
            this.showToast('Ação não encontrada. Atualize a tela e tente novamente.', 'error');
            return;
        }

        const steps = Array.isArray(micro.steps) ? micro.steps.filter(Boolean) : [];
        const hasSteps = steps.length > 0;
        const stepMap = (micro.stepLogs && typeof micro.stepLogs === 'object') ? (micro.stepLogs[todayKey] || {}) : {};
        const doneSteps = hasSteps
            ? steps.reduce((acc, _, idx) => acc + (stepMap[idx] || stepMap[String(idx)] ? 1 : 0), 0)
            : 0;

        // Define se estamos marcando ou desmarcando a tarefa
        const isCompleting = micro.status !== 'done';
        const wasInProgress = micro.status === 'in_progress';
        if (!isCompleting) {
            const confirmed = confirm('Reabrir esta ação vai remover a conclusão e recalcular o progresso da trilha. Deseja continuar?');
            if (!confirmed) return;
        } else {
            const focusSec = Number(micro.focusSec || 0);
            const focusSessions = Number(micro.focusSessions || 0);
            const hasFocusEvidence = focusSec > 0 || focusSessions > 0;
            if (!hasFocusEvidence) {
                const confirmed = confirm('Esta ação não tem tempo de foco registrado. Concluir mesmo assim?');
                if (!confirmed) return;
            }
        }
        if (isCompleting && hasSteps && doneSteps < steps.length) {
            const missing = steps.length - doneSteps;
            const confirmedChecklist = confirm(`Ainda faltam ${missing} passo(s) no checklist. Concluir mesmo assim e marcar os passos de hoje como concluidos?`);
            if (!confirmedChecklist) return;
        }
        if (hasSteps) {
            const markDone = isCompleting;
            steps.forEach((_, idx) => {
                if (typeof this._setMicroStepState === 'function') this._setMicroStepState(micro, todayKey, idx, markDone);
                if (typeof this.syncMicroStepStateToLinkedHabit === 'function') this.syncMicroStepStateToLinkedHabit(micro, todayKey, idx, markDone);
            });
        }
        micro.status = isCompleting ? 'done' : 'pending';
        // Sincroniza com a propriedade Legada 'completed' para manter UI funcionando
        micro.completed = isCompleting;
        micro.progress = isCompleting ? 100 : 0;

        if (isCompleting) {
          micro.completedDate = this.getLocalDateKey();
          const award = this.awardGamification('micro_complete', {
              key: `micro:${micro.id}:complete:${micro.completedDate}`,
              date: micro.completedDate,
              id: micro.id,
              title: micro.title,
              dimension: micro.dimension,
              planned: this._isPlannedThisWeek ? this._isPlannedThisWeek(micro.id) : false,
              inProgress: wasInProgress
          });
          this.showGamificationToast(award);
          this.recentCompletedMicroId = micro.id;
          if (award) {
              this.flashMicroCard(micro.id);
          }
        } else {
          delete micro.completedDate;
        }

        // Dispara cascata
        this.updateCascadeProgress(micro.id, 'micros');

        if (micro.macroId) {
            const macro = state.entities.macros.find(m => m.id === micro.macroId);
            if (macro && macro.okrId) {
                const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                if (okr) {
                    if (isCompleting) {
                        // Regra de Sucesso (Locke & Latham): 70% é o alvo ideal.
                        if (okr.progress >= 70 && !okr.rewarded70) {
                            okr.rewarded70 = true;
                            if (state.perma) {
                                state.perma.A = this.normalizePermaScore((state.perma.A || 0) + 0.5);
                            }
                            if (this.showNotification) this.showNotification("🎯 Projeto atingiu 70% (Alvo Ideal). Bônus de realização aplicado!");
                        }
                    } else {
                        // Ao desmarcar: reseta flag se progresso voltou abaixo de 70%
                        if (okr.rewarded70 && okr.progress < 70) {
                            okr.rewarded70 = false;
                        }
                    }
                }
            }
        }
        
        this.saveState(false);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
    },

updateCascadeProgress: function(entityId, type) {
        const state = window.sistemaVidaState;

        const hasActiveChild = (children) => children.some(c => c.status === 'in_progress' || c.status === 'done');
        const setParentStatus = (parent, children, computedProgress) => {
            // Reverte done forçado pelo usuário se filha foi reaberta (computedProgress < 100)
            if (parent.status === 'done' && computedProgress < 100) parent.status = 'in_progress';
            // Auto-start ao detectar filha ativa
            if (parent.status === 'pending' && hasActiveChild(children)) parent.status = 'in_progress';
            // Sem filhas ativas e progress 0 → volta para pending
            if (children.length === 0 && parent.status === 'in_progress') parent.status = 'pending';
        };

        if (type === 'micros') {
            const micro = state.entities.micros.find(m => m.id === entityId);
            if (micro && micro.macroId) {
                const siblings = state.entities.micros.filter(m => m.macroId === micro.macroId && m.status !== 'abandoned');
                const doneCount = siblings.filter(s => s.status === 'done').length;
                const computed = siblings.length > 0 ? Math.round((doneCount / siblings.length) * 100) : 0;
                const macro = state.entities.macros.find(m => m.id === micro.macroId);
                if (macro) {
                    macro.progress = computed;
                    setParentStatus(macro, siblings, computed);
                    this.updateCascadeProgress(macro.id, 'macros');
                }
            }
        } else if (type === 'macros') {
            const macro = state.entities.macros.find(m => m.id === entityId);
            if (macro && macro.okrId) {
                const siblings = state.entities.macros.filter(m => m.okrId === macro.okrId && m.status !== 'abandoned');
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                if (okr) {
                    const krProgress = this.computeKeyResultsProgress(okr.keyResults);
                    const hasKrs = krProgress !== null;
                    const computed = hasKrs ? Math.round((krProgress * 0.7) + (avg * 0.3)) : Math.round(avg);
                    okr.progress = computed;
                    setParentStatus(okr, siblings, computed);
                    this.updateCascadeProgress(okr.id, 'okrs');
                }
            }
        } else if (type === 'okrs') {
            const okr = state.entities.okrs.find(o => o.id === entityId);
            if (okr && okr.metaId) {
                const siblings = state.entities.okrs.filter(o => o.metaId === okr.metaId && o.status !== 'abandoned');
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const meta = state.entities.metas.find(m => m.id === okr.metaId);
                if (meta) {
                    const computed = Math.round(avg);
                    meta.progress = computed;
                    setParentStatus(meta, siblings, computed);
                }
            }
        } else if (type === 'metas') {
            const meta = state.entities.metas.find(m => m.id === entityId);
            if (meta && meta.parentMetaId) {
                const siblings = state.entities.metas.filter(m => m.parentMetaId === meta.parentMetaId && m.status !== 'abandoned');
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const parentMeta = state.entities.metas.find(m => m.id === meta.parentMetaId);
                if (parentMeta) {
                    const computed = Math.round(avg);
                    parentMeta.progress = computed;
                    setParentStatus(parentMeta, siblings, computed);
                    this.updateCascadeProgress(parentMeta.id, 'metas');
                }
            }
        }
    },

getPurposeJourneyState: function() {
        const profile = window.sistemaVidaState.profile || {};
        const values = profile.values || [];
        const identity = profile.identity || { strengths: [], shadows: [] };
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};
        const vision = profile.vision || {};
        const odyssey = profile.odyssey || {};
        const dimensions = window.sistemaVidaState.dimensions || {};
        const perma = window.sistemaVidaState.perma || {};
        const swls = window.sistemaVidaState.swls || {};

        const wheelCount = Object.values(dimensions).filter((entry) => Number(entry?.score) > 0).length;
        const permaCount = ['P', 'E', 'R', 'M', 'A'].filter((key) => Number(perma?.[key]) > 0).length;
        const hasSwls = Number(swls?.lastScore) >= 5 && !!String(swls?.lastDate || '').trim();
        const ikigaiBaseCount = [ikigai.love, ikigai.good, ikigai.need, ikigai.paid].filter((value) => String(value || '').trim()).length;
        const legacyCount = [legacyObj.familia, legacyObj.profissao, legacyObj.mundo].filter((value) => String(value || '').trim()).length;
        const visionCount = [vision.saude, vision.carreira, vision.intelecto, vision.quote].filter((value) => String(value || '').trim()).length;
        const odysseyCount = [odyssey.cenarioA, odyssey.cenarioB, odyssey.cenarioC].filter((value) => String(value || '').trim()).length;

        const items = [
            {
                id: 'identity',
                label: 'Identidade base',
                hint: 'Valores, forcas e sombras',
                done: values.length > 0 && (((identity.strengths || []).length + (identity.shadows || []).length) > 0)
            },
            {
                id: 'wheel',
                label: 'Roda da vida',
                hint: `${wheelCount}/8 dimensoes pontuadas`,
                done: wheelCount === 8
            },
            {
                id: 'wellbeing',
                label: 'PERMA e SWLS',
                hint: `PERMA ${permaCount}/5 + SWLS ${hasSwls ? 'registrado' : 'pendente'}`,
                done: permaCount === 5 && hasSwls
            },
            {
                id: 'ikigai-base',
                label: 'Base do Ikigai',
                hint: `${ikigaiBaseCount}/4 blocos preenchidos`,
                done: ikigaiBaseCount === 4
            },
            {
                id: 'ikigai-synthesis',
                label: 'Sintese do Ikigai',
                hint: 'Frase central de direcao',
                done: !!String(ikigai.sintese || '').trim()
            },
            {
                id: 'legacy',
                label: 'Legado',
                hint: `${legacyCount}/3 frentes preenchidas`,
                done: legacyCount === 3
            },
            {
                id: 'vision',
                label: 'Visao de vida',
                hint: `${visionCount}/4 blocos preenchidos`,
                done: visionCount === 4
            },
            {
                id: 'odyssey',
                label: 'Odyssey plans',
                hint: `${odysseyCount}/3 cenarios descritos`,
                done: odysseyCount === 3
            }
        ];
        const doneCount = items.filter((item) => item.done).length;
        return {
            items,
            doneCount,
            total: items.length,
            pct: Math.round((doneCount / items.length) * 100)
        };
    },
    });
}
