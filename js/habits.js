export function attachHabits(app) {
    Object.assign(app, {
isHabitDoneOnDate: function(habit, dateStr) {
        if (!habit || !dateStr) return false;
        const mode = habit.trackMode || 'boolean';
        const target = Number(habit.targetValue) || 1;
        const steps = Array.isArray(habit.steps) ? habit.steps.filter(Boolean) : [];
        if (steps.length) {
            const map = habit.stepLogs?.[dateStr] || {};
            return steps.every((_, idx) => !!(map[idx] || map[String(idx)]));
        }
        const value = Number(habit.logs?.[dateStr]) || 0;
        return mode === 'boolean' ? value > 0 : value >= target;
    },

getHabitDoneDates: function(habit) {
        const logs = habit?.logs || {};
        const stepLogs = habit?.stepLogs || {};
        const dates = new Set([...Object.keys(logs), ...Object.keys(stepLogs)]);
        return Array.from(dates).filter(date => this.isHabitDoneOnDate(habit, date)).sort();
    },

getHabitMaturityConfig: function() {
        return {
            graduationWeeks: 4,
            graduationRate: 0.8,
            regressionWeeks: 2,
            regressionRate: 0.5
        };
    },

ensureHabitMaturityState: function() {
        if (!Array.isArray(window.sistemaVidaState.habits)) window.sistemaVidaState.habits = [];
        window.sistemaVidaState.habits.forEach(habit => {
            if (!['forming', 'graduated'].includes(habit.maturity)) habit.maturity = 'forming';
            if (!habit.maturityMeta || typeof habit.maturityMeta !== 'object' || Array.isArray(habit.maturityMeta)) {
                habit.maturityMeta = {};
            }
            if (typeof habit.continuous !== 'boolean') habit.continuous = !habit.prazo;
            if (typeof habit.isKey !== 'boolean') habit.isKey = false;
            if (typeof habit.keyAutoSuggested !== 'boolean') habit.keyAutoSuggested = false;
            if (typeof habit.keyAutoReason !== 'string') habit.keyAutoReason = '';
            if (!habit.sourceStrengthId && habit.sourceType === 'strength' && habit.sourceId) habit.sourceStrengthId = habit.sourceId;
            if (!habit.sourceShadowId && habit.sourceType === 'shadow' && habit.sourceId) habit.sourceShadowId = habit.sourceId;
            if (!habit.sourceType) {
                if (habit.sourceStrengthId) habit.sourceType = 'strength';
                else if (habit.sourceShadowId) habit.sourceType = 'shadow';
            }
            if (!habit.sourceId) habit.sourceId = habit.sourceStrengthId || habit.sourceShadowId || '';
            if (typeof habit.reminderIntervalEnabled !== 'boolean') habit.reminderIntervalEnabled = false;
            if (typeof habit.reminderWindowStart !== 'string') habit.reminderWindowStart = '';
            if (typeof habit.reminderWindowEnd !== 'string') habit.reminderWindowEnd = '';
            if (!Number.isFinite(Number(habit.reminderIntervalMin))) habit.reminderIntervalMin = 0;
        });
    },

getHabitExpectedDatesForWeek: function(habit, weekKey = this._getWeekKey()) {
        const dates = this.getWeekDateKeys(weekKey);
        const specific = Array.isArray(habit?.specificDays) ? habit.specificDays.map(String) : [];
        if (habit?.frequency === 'specific' && specific.length) {
            return dates.filter(dateKey => specific.includes(String(new Date(dateKey + 'T00:00:00').getDay())));
        }
        return dates;
    },

getHabitWeekRate: function(habit, weekKey = this._getWeekKey()) {
        const expected = this.getHabitExpectedDatesForWeek(habit, weekKey);
        if (!expected.length) return 0;
        const done = expected.reduce((sum, dateKey) => sum + (this.isHabitDoneOnDate(habit, dateKey) ? 1 : 0), 0);
        return done / expected.length;
    },

getHabitConsecutiveStreak: function(habit) {
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 90; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (this.isHabitDoneOnDate(habit, dk)) { streak++; }
            else if (i === 0) { continue; } // allow today not yet done
            else { break; }
        }
        return streak;
    },

evaluateKeyHabitCandidates: function() {
        const habits = window.sistemaVidaState?.habits || [];
        const today = this.getLocalDateKey();
        const sevenDaysAgo = (() => {
            const d = new Date(); d.setDate(d.getDate() - 7);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        })();
        const thirtyDaysAgo = (() => {
            const d = new Date(); d.setDate(d.getDate() - 30);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        })();
        const fourteenDaysAgo = (() => {
            const d = new Date(); d.setDate(d.getDate() - 14);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        })();

        let best = null;
        let bestScore = 0;

        habits.forEach(habit => {
            if (!habit || habit.isKey) return; // already key
            if (habit.keyDismissedAt && habit.keyDismissedAt >= sevenDaysAgo) return; // dismissed recently

            const doneDates = this.getHabitDoneDates(habit);
            const doneLastThirty = doneDates.filter(d => d >= thirtyDaysAgo).length;
            const doneLastFourteen = doneDates.filter(d => d >= fourteenDaysAgo).length;
            const streak = this.getHabitConsecutiveStreak(habit);
            const hasIdentity = !!(this._getHabitSourceStrengthId(habit) || this._getHabitSourceShadowId(habit));
            const hasMeta = !!habit.linkedMetaId;

            let score = 0;
            let reason = '';

            if (hasIdentity && doneLastThirty >= 7) {
                score = 30 + doneLastThirty;
                const strengthId = this._getHabitSourceStrengthId(habit);
                const shadowId = this._getHabitSourceShadowId(habit);
                if (strengthId && shadowId) reason = `Praticado ${doneLastThirty}× neste mês, conectado a uma força e uma sombra da sua identidade.`;
                else if (strengthId) reason = `Praticado ${doneLastThirty}× neste mês e conectado a uma força da sua identidade.`;
                else reason = `Praticado ${doneLastThirty}× neste mês e conectado a uma sombra que você trabalha.`;
            }
            if (hasMeta && doneLastFourteen >= 5 && score < 25 + doneLastFourteen) {
                score = 25 + doneLastFourteen;
                reason = `Praticado ${doneLastFourteen}× nos últimos 14 dias e diretamente ligado a uma meta estratégica.`;
            }
            if (streak >= 14 && score < 20 + streak) {
                score = 20 + streak;
                reason = `${streak} dias consecutivos — parte consolidada da sua rotina.`;
            }

            if (score > 0 && score > bestScore) {
                bestScore = score;
                best = { habit, reason };
            }
        });

        return best;
    },

renderKeyHabitSuggestionBanner: function() {
        const banner = document.getElementById('key-habit-suggestion');
        if (!banner) return;
        const candidate = this.evaluateKeyHabitCandidates();
        if (!candidate) { banner.classList.add('hidden'); return; }

        const { habit, reason } = candidate;
        const titleEl = document.getElementById('key-habit-suggestion-title');
        const reasonEl = document.getElementById('key-habit-suggestion-reason');
        const acceptBtn = document.getElementById('key-habit-accept-btn');
        const dismissBtn = document.getElementById('key-habit-dismiss-btn');

        habit.keyAutoSuggested = true;
        habit.keyAutoReason = reason || '';
        if (titleEl) titleEl.textContent = habit.title || '';
        if (reasonEl) reasonEl.textContent = reason;
        if (acceptBtn) acceptBtn.onclick = () => this.acceptKeyHabit(habit.id);
        if (dismissBtn) dismissBtn.onclick = () => this.dismissKeyHabitSuggestion(habit.id);

        banner.classList.remove('hidden');
    },

acceptKeyHabit: function(habitId) {
        const habit = (window.sistemaVidaState?.habits || []).find(h => h.id === habitId);
        if (!habit) return;
        habit.isKey = true;
        habit.keyAutoSuggested = true;
        habit.keyAutoReason = habit.keyAutoReason || 'Sugerido pela sua consistencia e contexto atual.';
        delete habit.keyDismissedAt;
        this.saveState(true);
        this.showToast(`"${habit.title}" marcado como Hábito-Chave. ⭐`, 'success');
        if (this.render.hoje) this.render.hoje();
    },

dismissKeyHabitSuggestion: function(habitId) {
        const habit = (window.sistemaVidaState?.habits || []).find(h => h.id === habitId);
        if (!habit) return;
        habit.keyAutoSuggested = true;
        habit.keyDismissedAt = this.getLocalDateKey();
        this.saveState(true);
        const banner = document.getElementById('key-habit-suggestion');
        if (banner) banner.classList.add('hidden');
    },

toggleManualKeyHabit: function(habitId) {
        const habit = (window.sistemaVidaState?.habits || []).find(h => h.id === habitId);
        if (!habit) return;
        habit.isKey = !habit.isKey;
        habit.keyAutoSuggested = false;
        if (habit.isKey) habit.keyAutoReason = 'Marcado manualmente pelo usuario.';
        if (!habit.isKey) delete habit.keyDismissedAt;
        this.saveState(true);
        const msg = habit.isKey ? `"${habit.title}" é agora seu Hábito-Chave. ⭐` : `"${habit.title}" removido dos Hábitos-Chave.`;
        this.showToast(msg, 'success');
        if (this.render.hoje) this.render.hoje();
    },

evaluateHabitMaturity: function(habit) {
        if (!habit) return null;
        this.ensureHabitMaturityState();
        const cfg = this.getHabitMaturityConfig();
        const current = this._getWeekKey();
        const rates = [];
        for (let i = cfg.graduationWeeks - 1; i >= 0; i--) {
            rates.push(this.getHabitWeekRate(habit, this.getRelativeWeekKey(current, -i)));
        }
        const graduatedReady = rates.length === cfg.graduationWeeks && rates.every(rate => rate >= cfg.graduationRate);
        const recentRates = [];
        for (let i = cfg.regressionWeeks - 1; i >= 0; i--) {
            recentRates.push(this.getHabitWeekRate(habit, this.getRelativeWeekKey(current, -i)));
        }
        const regressionReady = recentRates.length === cfg.regressionWeeks && recentRates.every(rate => rate < cfg.regressionRate);

        if (habit.maturity !== 'graduated' && graduatedReady) {
            habit.maturity = 'graduated';
            habit.maturityMeta = {
                ...(habit.maturityMeta || {}),
                graduatedAt: this.getLocalDateKey(),
                lastEvaluationAt: new Date().toISOString()
            };
            return { changed: true, state: 'graduated', rates };
        }
        if (habit.maturity === 'graduated' && regressionReady) {
            habit.maturity = 'forming';
            habit.maturityMeta = {
                ...(habit.maturityMeta || {}),
                regressedAt: this.getLocalDateKey(),
                lastEvaluationAt: new Date().toISOString()
            };
            return { changed: true, state: 'forming', rates: recentRates };
        }
        habit.maturityMeta = {
            ...(habit.maturityMeta || {}),
            lastEvaluationAt: new Date().toISOString()
        };
        return { changed: false, state: habit.maturity, rates };
    },

evaluateAllHabitMaturity: function() {
        this.ensureHabitMaturityState();
        return (window.sistemaVidaState.habits || [])
            .map(habit => ({ habit, result: this.evaluateHabitMaturity(habit) }))
            .filter(item => item.result?.changed);
    },

handleHabitMaturityChange: function(habit, result) {
        if (!habit || !result?.changed) return;
        if (result.state === 'graduated') {
            this.unlockAchievement('first_habit_graduated');
            if (this.showToast) this.showToast(`"${habit.title}" virou um hábito automático. XP de manutenção ativado.`, 'success');
            const shouldAddStrength = !this._getHabitSourceStrengthId(habit)
                && confirm(`"${habit.title}" parece parte de quem voce esta se tornando. Registrar como forca em Proposito?`);
            if (shouldAddStrength) {
                this.ensureIdentityState();
                const strengths = window.sistemaVidaState.profile.identity.strengths || [];
                const exists = strengths.some(item => String(item.title || '').toLowerCase() === String(habit.title || '').toLowerCase());
                if (!exists) {
                    strengths.push({
                        id: `identity_${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
                        title: habit.title,
                        dimension: habit.dimension || 'Geral',
                        evidence: 'Graduou como habito automatico.',
                        excessRisk: '',
                        practice: habit.routine || habit.title,
                        linkedHabitIds: [habit.id],
                        weeklyLogs: {},
                        createdAt: this.getLocalDateKey(),
                        updatedAt: this.getLocalDateKey()
                    });
                    this.syncIdentityLinkedHabits();
                }
            }
        } else if (result.state === 'forming' && this.showToast) {
            this.showToast(`"${habit.title}" voltou para formação. Ajuste pequeno, sem drama.`, 'success');
        }
    },

renderHabitMaturityChip: function(habit) {
        const graduated = habit?.maturity === 'graduated';
        const text = graduated ? 'Automatico' : 'Em formacao';
        const icon = graduated ? 'verified' : 'construction';
        const cls = graduated ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-surface-container-high text-outline';
        return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}">
            <span class="material-symbols-outlined notranslate text-[11px]">${icon}</span>${text}
        </span>`;
    },

evaluateIdentityAchievements: function() {
        const unlocked = [];
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const habits = window.sistemaVidaState.habits || [];

        if ((identity.shadows || []).length > 0) {
            const ach = this.unlockAchievement('first_shadow_named');
            if (ach) unlocked.push(ach);
        }
        if (habits.some(h => this._getHabitSourceStrengthId(h))) {
            const ach = this.unlockAchievement('first_strength_habit');
            if (ach) unlocked.push(ach);
        }
        if (habits.some(h => this._getHabitSourceShadowId(h) && this.getHabitDoneDates(h).length >= 7)) {
            const ach = this.unlockAchievement('shadow_antidote_7');
            if (ach) unlocked.push(ach);
        }
        const weekKey = this._getWeekKey ? this._getWeekKey() : '';
        if (weekKey) {
            const weekDates = this.getWeekDateKeys(weekKey);
            const didStrength = habits.some(h => this._getHabitSourceStrengthId(h) && weekDates.some(d => this.isHabitDoneOnDate(h, d)));
            const didShadow = habits.some(h => this._getHabitSourceShadowId(h) && weekDates.some(d => this.isHabitDoneOnDate(h, d)));
            if (didStrength && didShadow) {
                const ach = this.unlockAchievement('identity_integration_week');
                if (ach) unlocked.push(ach);
            }
        }
        const linkedHabits = habits.filter(h => this._getHabitSourceStrengthId(h) || this._getHabitSourceShadowId(h));
        const hasFourWeeks = linkedHabits.some(h => {
            const done = new Set(this.getHabitDoneDates(h));
            const current = this._getWeekKey ? this._getWeekKey() : '';
            if (!current) return false;
            for (let i = 0; i < 4; i++) {
                const wk = this.getRelativeWeekKey(current, -i);
                if (!this.getWeekDateKeys(wk).some(d => done.has(d))) return false;
            }
            return true;
        });
        if (hasFourWeeks) {
            const ach = this.unlockAchievement('sustained_identity_growth');
            if (ach) unlocked.push(ach);
        }
        return unlocked;
    },

onHabitModeChange: function(mode) {
        const targetContainer = document.getElementById('habit-target-container');
        if (!targetContainer) return;
        if (mode === 'numeric' || mode === 'timer') {
            targetContainer.classList.remove('hidden');
            targetContainer.classList.add('flex');
            targetContainer.style.display = 'flex';
        } else {
            targetContainer.classList.add('hidden');
            targetContainer.classList.remove('flex');
            targetContainer.style.display = 'none';
        }
    },

onHabitFreqChange: function(freq) {
        const daysContainer = document.getElementById('habit-days-container');
        if (!daysContainer) return;
        if (freq === 'specific') {
            daysContainer.classList.remove('hidden');
            daysContainer.classList.add('flex');
            daysContainer.style.display = 'flex';
        } else {
            daysContainer.classList.add('hidden');
            daysContainer.classList.remove('flex');
            daysContainer.style.display = 'none';
        }
    },

onHabitReminderIntervalToggle: function(enabled) {
        const fields = document.getElementById('habit-reminder-interval-fields');
        const singleTimeWrap = document.getElementById('habit-single-time-wrap');
        if (!fields) return;
        if (enabled) {
            fields.classList.remove('hidden');
            fields.classList.add('grid');
            if (singleTimeWrap) {
                singleTimeWrap.classList.add('opacity-50', 'pointer-events-none');
            }
        } else {
            fields.classList.add('hidden');
            fields.classList.remove('grid');
            if (singleTimeWrap) {
                singleTimeWrap.classList.remove('opacity-50', 'pointer-events-none');
            }
        }
        this.updateHabitReminderPreview();
    },

updateHabitReminderPreview: function() {
        const preview = document.getElementById('habit-next-reminder-preview');
        if (!preview) return;
        const enabled = !!document.getElementById('habit-reminder-enabled')?.checked;
        if (!enabled) {
            preview.textContent = '';
            return;
        }
        const intervalMode = !!document.getElementById('habit-reminder-interval-enabled')?.checked;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const fmt = (mins) => {
            const safe = ((mins % 1440) + 1440) % 1440;
            const hh = String(Math.floor(safe / 60)).padStart(2, '0');
            const mm = String(safe % 60).padStart(2, '0');
            return `${hh}:${mm}`;
        };
        const toMins = (value) => {
            const parts = String(value || '').slice(0, 5).split(':');
            const hh = Number(parts[0]);
            const mm = Number(parts[1]);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
            return (hh * 60) + mm;
        };

        if (!intervalMode) {
            const single = toMins(document.getElementById('habit-start-time')?.value);
            if (single == null) {
                preview.textContent = 'Defina um horário único para o lembrete.';
                return;
            }
            preview.textContent = `Próximo lembrete às ${fmt(single)} h.`;
            return;
        }

        const start = toMins(document.getElementById('habit-reminder-window-start')?.value);
        const end = toMins(document.getElementById('habit-reminder-window-end')?.value);
        const step = Math.max(5, Number(document.getElementById('habit-reminder-interval-min')?.value || 60));
        if (start == null || end == null) {
            preview.textContent = 'Defina início e fim da janela de lembretes.';
            return;
        }
        if (end < start) {
            preview.textContent = 'Janela inválida: o fim precisa ser maior ou igual ao início.';
            return;
        }
        let next = null;
        for (let cursor = start; cursor <= end; cursor += step) {
            if (cursor >= nowMin) {
                next = cursor;
                break;
            }
        }
        if (next == null) {
            preview.textContent = `Próximo lembrete amanhã às ${fmt(start)} h.`;
            return;
        }
        preview.textContent = `Próximo lembrete às ${fmt(next)} h.`;
    },

onHabitContinuousChange: function(checked) {
        const deadlineGroup = document.getElementById('prazo-deadline-group');
        if (!deadlineGroup) return;
        if (checked) {
            deadlineGroup.classList.add('hidden');
            deadlineGroup.style.display = 'none';
            const prazoInput = document.getElementById('create-prazo');
            if (prazoInput) prazoInput.value = '';
        } else {
            deadlineGroup.classList.remove('hidden');
            deadlineGroup.style.display = 'flex';
        }
    },

populateHabitLinkedMeta: function() {
        const select = document.getElementById('habit-linked-meta');
        if (!select) return;
        const state = window.sistemaVidaState;
        const prev = select.value;

        const metas = (state.entities?.metas || []).filter(m =>
            m.status !== 'done' && m.status !== 'abandoned'
        );
        // Agrupa por dimensão
        const byDim = {};
        metas.forEach(m => {
            const dim = m.dimension || 'Geral';
            (byDim[dim] = byDim[dim] || []).push(m);
        });

        let html = '<option value="">— Sem vínculo —</option>';
        Object.keys(byDim).sort().forEach(dim => {
            html += `<optgroup label="${dim}">`;
            byDim[dim].forEach(m => {
                const title = (m.title || '').replace(/</g, '&lt;');
                html += `<option value="${m.id}">${title}</option>`;
            });
            html += '</optgroup>';
        });
        select.innerHTML = html;

        // Restaura seleção anterior se ainda existir
        if (prev && select.querySelector(`option[value="${prev}"]`)) {
            select.value = prev;
        }
    },

populateHabitIdentitySource: function() {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const strengths = identity.strengths || [];
        const shadows = identity.shadows || [];
        const isEmpty = !strengths.length && !shadows.length;

        const notice = document.getElementById('habit-identity-empty-notice');
        if (notice) notice.classList.toggle('hidden', !isEmpty);

        const strengthSel = document.getElementById('habit-strength-source');
        const shadowSel = document.getElementById('habit-shadow-source');

        if (strengthSel) {
            let html = '<option value="">— Nenhuma —</option>';
            strengths.forEach(item => { html += `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.title)}</option>`; });
            strengthSel.innerHTML = html;
            strengthSel.classList.toggle('hidden', isEmpty);
        }
        if (shadowSel) {
            let html = '<option value="">— Nenhuma —</option>';
            shadows.forEach(item => { html += `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.title)}</option>`; });
            shadowSel.innerHTML = html;
            shadowSel.classList.toggle('hidden', isEmpty);
            this.onHabitShadowSourceChange(shadowSel.value);
        }
    },

onHabitShadowSourceChange: function(value) {
        const wrap = document.getElementById('habit-shadow-mode-wrap');
        if (!wrap) return;
        const hasValue = !!value;
        wrap.classList.toggle('hidden', !hasValue);
        wrap.style.display = hasValue ? 'flex' : 'none';
    },

onHabitIdentitySourceChange: function(value) {
        this.onHabitShadowSourceChange(String(value || '').startsWith('shadows:') ? value : '');
    },

_getHabitSourceStrengthId: function(habit) {
        if (habit.sourceStrengthId) return habit.sourceStrengthId;
        if (habit.sourceType === 'strength' && habit.sourceId) return habit.sourceId;
        return null;
    },

_getHabitSourceShadowId: function(habit) {
        if (habit.sourceShadowId) return habit.sourceShadowId;
        if (habit.sourceType === 'shadow' && habit.sourceId) return habit.sourceId;
        return null;
    },

getHabitIdentityItem: function(habit) {
        const strengthId = this._getHabitSourceStrengthId(habit);
        if (strengthId) return this.getIdentityItemById('strengths', strengthId);
        const shadowId = this._getHabitSourceShadowId(habit);
        if (shadowId) return this.getIdentityItemById('shadows', shadowId);
        return null;
    },

renderHabitIdentityChip: function(habit) {
        const strengthId = this._getHabitSourceStrengthId(habit);
        const shadowId = this._getHabitSourceShadowId(habit);
        let html = '';
        if (strengthId) {
            const item = this.getIdentityItemById('strengths', strengthId);
            if (item) html += `<button type="button" onclick="event.stopPropagation(); window.app.flowNavigate('proposito','proposito-identity-section','')"
                class="mt-1 text-[10px] text-primary leading-tight truncate flex items-center gap-1 hover:underline" title="Ver em Propósito">
                <span class="material-symbols-outlined notranslate text-[11px]">workspace_premium</span>Força: ${this.escapeHtml(item.title)}
            </button>`;
        }
        if (shadowId) {
            const item = this.getIdentityItemById('shadows', shadowId);
            if (item) html += `<button type="button" onclick="event.stopPropagation(); window.app.flowNavigate('proposito','proposito-identity-section','')"
                class="mt-1 text-[10px] text-secondary leading-tight truncate flex items-center gap-1 hover:underline" title="Ver em Propósito">
                <span class="material-symbols-outlined notranslate text-[11px]">change_circle</span>Sombra: ${this.escapeHtml(item.title)}
            </button>`;
        }
        return html;
    },

_getHabitIntent: function(habit, state) {
        if (habit.linkedMetaId) {
            const meta = (state?.entities?.metas || []).find(m => m.id === habit.linkedMetaId);
            if (meta) return { key: 'meta', label: 'Sustenta meta', icon: 'flag', metaTitle: meta.title };
        }
        if (this._getHabitSourceStrengthId(habit)) return { key: 'strength', label: 'Pratica força', icon: 'workspace_premium' };
        if (this._getHabitSourceShadowId(habit))   return { key: 'shadow',   label: 'Protege sombra', icon: 'change_circle' };
        return { key: 'loose', label: 'Sem vínculo', icon: 'radio_button_unchecked' };
    },

syncIdentityLinkedHabits: function() {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || {};
        ['strengths', 'shadows'].forEach(type => {
            (identity[type] || []).forEach(item => { item.linkedHabitIds = []; });
        });
        (window.sistemaVidaState.habits || []).forEach(habit => {
            const link = (type, id) => {
                if (!id) return;
                const item = (identity[type] || []).find(i => i.id === id);
                if (!item) return;
                if (!Array.isArray(item.linkedHabitIds)) item.linkedHabitIds = [];
                if (!item.linkedHabitIds.includes(habit.id)) item.linkedHabitIds.push(habit.id);
            };
            link('strengths', this._getHabitSourceStrengthId(habit));
            link('shadows',   this._getHabitSourceShadowId(habit));
        });
    },

updateHabitLog: function(habitId, dateStr, value) {
        const state = window.sistemaVidaState;
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            if (!habit.logs) habit.logs = {};
            const target = habit.targetValue || 1;
            const previousValue = Number(habit.logs[dateStr]) || 0;
            const wasDone = (habit.trackMode || 'boolean') === 'boolean' ? previousValue > 0 : previousValue >= target;
            habit.logs[dateStr] = value;
            if (Array.isArray(habit.steps) && habit.steps.length > 0) {
                if (!habit.stepLogs) habit.stepLogs = {};
                const markAll = value > 0;
                const map = {};
                if (markAll) habit.steps.forEach((_, idx) => { map[idx] = true; });
                habit.stepLogs[dateStr] = map;
            }

            // Toast feedback based on new value
            const isDone = (habit.trackMode || 'boolean') === 'boolean' ? value > 0 : value >= target;
            let award = null;
            if (isDone && !wasDone) {
                award = this.awardGamification('habit_complete', {
                    key: `habit:${habit.id}:${dateStr}`,
                    id: habit.id,
                    title: habit.title,
                    dimension: habit.dimension,
                    date: dateStr,
                    sourceType: habit.sourceType || '',
                    sourceId: habit.sourceId || '',
                    sourceStrengthId: this._getHabitSourceStrengthId(habit) || '',
                    sourceShadowId: this._getHabitSourceShadowId(habit) || '',
                    isKey: !!habit.isKey,
                    hasIfThen: !!(habit.ifThen && String(habit.ifThen).trim()),
                    keyHabitStreak: habit.isKey ? this.getKeyHabitStreak(habit, dateStr) : 0,
                    habitMode: habit.habitMode || '',
                    maturity: habit.maturity || 'forming'
                });
                this.showGamificationToast(award);
                try {
                    const _prev = this.getPreviousHabitDoneDate(habit, dateStr);
                    if (_prev && this.getDateDiffInDays(_prev, dateStr) >= 7) {
                        this.awardGamification('habit_recovery', {
                            key: `habit_recovery:${habit.id}:${this.getMonthKey(dateStr)}`,
                            id: habit.id, title: habit.title, dimension: habit.dimension, date: dateStr
                        });
                    }
                } catch (_) {}
            }
            const maturityResult = this.evaluateHabitMaturity(habit);
            this.handleHabitMaturityChange(habit, maturityResult);
            if (isDone && !award && typeof showIdentityToast === 'function') {
                showIdentityToast(habit.title, habit.dimension);
            }
            // Legacy sync removed to avoid hybrid state contradictions
            // Derive completion dynamically from log values during render cycle.
            this.saveState(true);
            if (this.currentView === 'hoje' && this.render.hoje) {
                this.render.hoje();
            }
        }
    },

toggleHabitStepLog: function(habitId, dateStr, stepIndex) {
        const state = window.sistemaVidaState;
        const habit = (state.habits || []).find(h => h.id === habitId);
        if (!habit || !Array.isArray(habit.steps) || !habit.steps.length) return;
        if (!habit.stepLogs) habit.stepLogs = {};
        if (!habit.stepLogs[dateStr]) habit.stepLogs[dateStr] = {};
        const target = habit.targetValue || 1;
        const previousValue = Number(habit.logs?.[dateStr]) || 0;
        const wasDone = (habit.trackMode || 'boolean') === 'boolean' ? previousValue > 0 : previousValue >= target;
        const current = !!(habit.stepLogs[dateStr][stepIndex] || habit.stepLogs[dateStr][String(stepIndex)]);
        habit.stepLogs[dateStr][stepIndex] = !current;
        const doneCount = habit.steps.reduce((acc, _, idx) => acc + (habit.stepLogs[dateStr][idx] ? 1 : 0), 0);
        const allDone = doneCount === habit.steps.length;
        if (!habit.logs) habit.logs = {};
        if ((habit.trackMode || 'boolean') === 'boolean') {
            habit.logs[dateStr] = allDone ? 1 : 0;
        }
        if (allDone && !wasDone) {
            const award = this.awardGamification('habit_complete', {
                key: `habit:${habit.id}:${dateStr}`,
                id: habit.id,
                title: habit.title,
                dimension: habit.dimension,
                date: dateStr,
                sourceType: habit.sourceType || '',
                sourceId: habit.sourceId || '',
                sourceStrengthId: this._getHabitSourceStrengthId(habit) || '',
                sourceShadowId: this._getHabitSourceShadowId(habit) || '',
                isKey: !!habit.isKey,
                hasIfThen: !!(habit.ifThen && String(habit.ifThen).trim()),
                keyHabitStreak: habit.isKey ? this.getKeyHabitStreak(habit, dateStr) : 0,
                habitMode: habit.habitMode || '',
                maturity: habit.maturity || 'forming'
            });
            this.showGamificationToast(award);
            try {
                const _prev = this.getPreviousHabitDoneDate(habit, dateStr);
                if (_prev && this.getDateDiffInDays(_prev, dateStr) >= 7) {
                    this.awardGamification('habit_recovery', {
                        key: `habit_recovery:${habit.id}:${this.getMonthKey(dateStr)}`,
                        id: habit.id, title: habit.title, dimension: habit.dimension, date: dateStr
                    });
                }
            } catch (_) {}
        }
        const maturityResult = this.evaluateHabitMaturity(habit);
        this.handleHabitMaturityChange(habit, maturityResult);
        this.saveState(true);
        this.renderHabitStepsChecklist(habitId);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
    },

toggleHabitAllSteps: function(habitId, dateStr, currentlyDone) {
        const state = window.sistemaVidaState;
        const habit = (state.habits || []).find(h => h.id === habitId);
        if (!habit || !Array.isArray(habit.steps) || !habit.steps.length) return;
        if (!habit.stepLogs) habit.stepLogs = {};
        if (!habit.logs) habit.logs = {};
        const target = habit.targetValue || 1;
        const previousValue = Number(habit.logs?.[dateStr]) || 0;
        const wasDone = (habit.trackMode || 'boolean') === 'boolean' ? previousValue > 0 : previousValue >= target;
        if (currentlyDone) {
            habit.stepLogs[dateStr] = {};
            if ((habit.trackMode || 'boolean') === 'boolean') habit.logs[dateStr] = 0;
        } else {
            const all = {};
            habit.steps.forEach((_, idx) => { all[idx] = true; });
            habit.stepLogs[dateStr] = all;
            if ((habit.trackMode || 'boolean') === 'boolean') habit.logs[dateStr] = 1;
            if (!wasDone) {
                const award = this.awardGamification('habit_complete', {
                    key: `habit:${habit.id}:${dateStr}`,
                    id: habit.id,
                    title: habit.title,
                    dimension: habit.dimension,
                    date: dateStr,
                    sourceType: habit.sourceType || '',
                    sourceId: habit.sourceId || '',
                    sourceStrengthId: this._getHabitSourceStrengthId(habit) || '',
                    sourceShadowId: this._getHabitSourceShadowId(habit) || '',
                    isKey: !!habit.isKey,
                    hasIfThen: !!(habit.ifThen && String(habit.ifThen).trim()),
                    keyHabitStreak: habit.isKey ? this.getKeyHabitStreak(habit, dateStr) : 0,
                    habitMode: habit.habitMode || '',
                    maturity: habit.maturity || 'forming'
                });
                this.showGamificationToast(award);
                try {
                    const _prev = this.getPreviousHabitDoneDate(habit, dateStr);
                    if (_prev && this.getDateDiffInDays(_prev, dateStr) >= 7) {
                        this.awardGamification('habit_recovery', {
                            key: `habit_recovery:${habit.id}:${this.getMonthKey(dateStr)}`,
                            id: habit.id, title: habit.title, dimension: habit.dimension, date: dateStr
                        });
                    }
                } catch (_) {}
            }
        }
        const maturityResult = this.evaluateHabitMaturity(habit);
        this.handleHabitMaturityChange(habit, maturityResult);
        this.saveState(true);
        this.renderHabitStepsChecklist(habitId);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
    },

renderHabitStepsChecklist: function(habitId) {
        const wrap = document.getElementById('habit-steps-checklist-wrap');
        const container = document.getElementById('habit-steps-checklist');
        if (!wrap || !container) return;
        const habit = (window.sistemaVidaState.habits || []).find(h => h.id === habitId);
        if (!habit || !Array.isArray(habit.steps) || habit.steps.length === 0) {
            wrap.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        wrap.classList.remove('hidden');
        wrap.classList.add('flex');
        const today = this.getLocalDateKey();
        const map = (habit.stepLogs || {})[today] || {};
        const esc = (txt) => String(txt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        container.innerHTML = habit.steps.map((step, idx) => {
            const done = !!(map[idx] || map[String(idx)]);
            return `
            <button onclick="event.stopPropagation(); window.app.toggleHabitStepLog('${habit.id}', '${today}', ${idx})"
                class="w-full text-left flex items-center gap-2 text-[11px] rounded-md px-2 py-1 ${done ? 'text-primary bg-primary/5' : 'text-on-surface hover:bg-surface-container-high'} transition-colors">
                <span class="w-3.5 h-3.5 rounded-sm border ${done ? 'bg-primary border-primary' : 'border-outline-variant'} flex items-center justify-center shrink-0">
                    ${done ? '<span class="material-symbols-outlined notranslate text-white text-[10px]">check</span>' : ''}
                </span>
                <span class="${done ? 'line-through' : ''} truncate">${esc(step)}</span>
            </button>`;
        }).join('');
    },
    });
}
