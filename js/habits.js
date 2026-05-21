export function attachHabits(app) {
    Object.assign(app, {
normalizeHabitTrackMode: function(mode) {
        const normalized = String(mode || 'boolean').trim().toLowerCase();
        if (['timer', 'time', 'tempo', 'minutes', 'minutos'].includes(normalized)) return 'timer';
        if (normalized === 'numeric') return 'numeric';
        return 'boolean';
    },

getHabitResolvedSteps: function(habit) {
        if (!habit) return [];
        const ownSteps = Array.isArray(habit.steps)
            ? habit.steps.map(step => String(step || '').trim()).filter(Boolean)
            : [];
        if (ownSteps.length) return ownSteps;
        const protocolId = String(habit.protocolId || '').trim();
        if (!protocolId || typeof this.getProtocolById !== 'function') return [];
        const protocol = this.getProtocolById(protocolId);
        return Array.isArray(protocol?.steps)
            ? protocol.steps.map(step => String(step?.title || step || '').trim()).filter(Boolean)
            : [];
    },

isHabitDoneOnDate: function(habit, dateStr) {
        if (!habit || !dateStr) return false;
        const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
        const target = Number(habit.targetValue) || 1;
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        const hasProtocol = !!String(habit.protocolId || '').trim();
        if ((hasProtocol || mode === 'boolean') && steps.length) {
            const map = habit.stepLogs?.[dateStr] || {};
            return steps.every((_, idx) => !!(map[idx] || map[String(idx)]));
        }
        const value = Number(habit.logs?.[dateStr]) || 0;
        return mode === 'boolean' ? value > 0 : value >= target;
    },

isHabitRoutine: function(habit) {
        if (!habit) return false;
        const hasProtocol = !!String(habit.protocolId || '').trim();
        const hasSteps = (this.getHabitResolvedSteps?.(habit) || []).length > 0;
        return hasProtocol || hasSteps;
    },

    getHabitEstimatedMinutes: function(habit) {
        if (!habit) return 0;
        if (habit.protocolId && typeof this.getProtocolById === 'function' && typeof this.getProtocolEstimatedMinutes === 'function') {
            const protocol = this.getProtocolById(habit.protocolId);
            const protocolMinutes = Math.max(0, Math.round(Number(this.getProtocolEstimatedMinutes(protocol, { includeOptional: false })) || 0));
            if (protocolMinutes > 0) return protocolMinutes;
        }

        const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
        if (mode === 'timer') {
            return Math.max(1, Math.round(Number(habit.targetValue) || 0));
        }

        const manual = Math.round(Number(habit.estimatedMinutes) || 0);
        if (manual > 0) return manual;

        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (steps.length > 0) return Math.max(8, steps.length * 8);

        if (mode === 'numeric') return 10;
        return 5;
    },

getHabitTodayProgressSnapshot: function(habit, dateStr = this.getLocalDateKey()) {
        if (!habit) {
            return { done: false, current: 0, target: 1, percent: 0, label: '0/1' };
        }
        const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
        const target = Math.max(1, Number(habit.targetValue) || 1);
        const logs = habit.logs || {};
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        const stepMap = habit.stepLogs?.[dateStr] || {};
        const hasProtocol = !!String(habit.protocolId || '').trim();
        if ((hasProtocol || mode === 'boolean') && steps.length) {
            const current = steps.reduce((acc, _, idx) => acc + (stepMap[idx] || stepMap[String(idx)] ? 1 : 0), 0);
            const done = current >= steps.length;
            const percent = Math.round((current / Math.max(1, steps.length)) * 100);
            return { done, current, target: steps.length, percent, label: `${current}/${steps.length}` };
        }
        const current = Math.max(0, Number(logs[dateStr]) || 0);
        const done = mode === 'boolean' ? current > 0 : current >= target;
        const denom = mode === 'boolean' ? 1 : target;
        const shownCurrent = mode === 'boolean' ? (done ? 1 : 0) : current;
        const percent = Math.max(0, Math.min(100, Math.round((shownCurrent / Math.max(1, denom)) * 100)));
        return { done, current: shownCurrent, target: denom, percent, label: `${shownCurrent}/${denom}` };
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
            if (!Number.isFinite(Number(habit.intervalDays))) habit.intervalDays = 0;
            if (!Number.isFinite(Number(habit.dayOfMonth))) habit.dayOfMonth = 0;
            if (typeof habit.scheduleStartDate !== 'string') habit.scheduleStartDate = '';
        });
    },

getHabitScheduleAnchorDate: function(habit) {
        const raw = String(habit?.scheduleStartDate || habit?.createdAt || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
        return this.getLocalDateKey();
    },

getHabitScheduleDayOfMonth: function(habit) {
        const parsed = Math.round(Number(habit?.dayOfMonth) || 0);
        if (parsed >= 1 && parsed <= 31) return parsed;
        const anchor = this.getHabitScheduleAnchorDate(habit);
        const anchorDate = new Date(`${anchor}T00:00:00`);
        return Math.max(1, Math.min(31, Number.isNaN(anchorDate.getTime()) ? 1 : anchorDate.getDate()));
    },

isHabitScheduledForDate: function(habit, dateKey = this.getLocalDateKey()) {
        if (!habit || !dateKey) return false;
        const date = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(date.getTime())) return false;
        const freq = String(habit.frequency || 'daily');
        const specific = Array.isArray(habit.specificDays) ? habit.specificDays.map(String) : [];

        if (freq === 'specific') {
            if (!specific.length) return true;
            return specific.includes(String(date.getDay()));
        }

        if (freq === 'every_x_days') {
            const interval = Math.max(2, Math.round(Number(habit.intervalDays) || 0));
            if (!interval) return true;
            const anchorDate = new Date(`${this.getHabitScheduleAnchorDate(habit)}T00:00:00`);
            if (Number.isNaN(anchorDate.getTime())) return true;
            const diffDays = Math.floor((date.getTime() - anchorDate.getTime()) / 86400000);
            return diffDays >= 0 && diffDays % interval === 0;
        }

        if (freq === 'monthly') {
            const targetDay = this.getHabitScheduleDayOfMonth(habit);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            return date.getDate() === Math.min(targetDay, lastDay);
        }

        if (freq === 'manual') return false;
        return true;
    },

getHabitExpectedDatesForWeek: function(habit, weekKey = this._getWeekKey()) {
        const dates = this.getWeekDateKeys(weekKey);
        return dates.filter(dateKey => this.isHabitScheduledForDate(habit, dateKey));
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
        for (let i = 0; i < 365; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (!this.isHabitScheduledForDate(habit, dk)) continue;
            if (this.isHabitDoneOnDate(habit, dk)) {
                streak++;
                continue;
            }
            if (i === 0) continue; // allow today not yet done
            break;
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
        const cls = graduated
            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border border-outline-variant/20 bg-surface-container-high text-on-surface-variant';
        return `<span class="inline-flex items-center whitespace-nowrap gap-1 rounded-full px-2 py-0.5 text-[9px] leading-none font-semibold ${cls}">
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
        const protocolId = String(document.getElementById('habit-protocol')?.value || '').trim();
        const normalizedMode = this.normalizeHabitTrackMode?.(mode) || mode;
        if (!targetContainer) return;
        if (protocolId) {
            targetContainer.classList.add('hidden');
            targetContainer.classList.remove('flex');
            targetContainer.style.display = 'none';
            this.refreshCrudEstimatedFieldState?.('habits');
            return;
        }
        if (normalizedMode === 'numeric' || normalizedMode === 'timer') {
            targetContainer.classList.remove('hidden');
            targetContainer.classList.add('flex');
            targetContainer.style.display = 'flex';
        } else {
            targetContainer.classList.add('hidden');
            targetContainer.classList.remove('flex');
            targetContainer.style.display = 'none';
        }
        this.refreshCrudEstimatedFieldState?.('habits');
    },

syncHabitProtocolAuthorityUI: function(protocolId = '') {
        const hasProtocol = !!String(protocolId || '').trim();
        const modeRow = document.getElementById('habit-mode-target-row');
        const modeInput = document.getElementById('habit-track-mode');
        const targetContainer = document.getElementById('habit-target-container');
        const targetInput = document.getElementById('habit-target');
        const authorityNote = document.getElementById('habit-protocol-authority-note');

        if (modeRow) {
            modeRow.classList.toggle('opacity-60', hasProtocol);
            modeRow.classList.toggle('pointer-events-none', hasProtocol);
        }
        if (modeInput) {
            if (hasProtocol) modeInput.value = 'boolean';
            modeInput.disabled = hasProtocol;
        }
        if (targetInput) {
            if (hasProtocol) targetInput.value = '1';
            targetInput.disabled = hasProtocol;
        }
        if (targetContainer) {
            if (hasProtocol) {
                targetContainer.classList.add('hidden');
                targetContainer.classList.remove('flex');
                targetContainer.style.display = 'none';
            } else {
                this.onHabitModeChange(modeInput?.value || 'boolean');
            }
        }
        if (authorityNote) authorityNote.classList.toggle('hidden', !hasProtocol);
        this.refreshCrudEstimatedFieldState?.('habits');
    },

onHabitTargetChange: function() {
        this.refreshCrudEstimatedFieldState?.('habits');
    },

    onHabitFreqChange: function(freq) {
        const daysContainer = document.getElementById('habit-days-container');
        const intervalContainer = document.getElementById('habit-interval-container');
        const monthlyContainer = document.getElementById('habit-monthly-container');
        const startContainer = document.getElementById('habit-schedule-start-container');
        const setVisible = (el, show) => {
            if (!el) return;
            el.classList.toggle('hidden', !show);
            el.classList.toggle('flex', show);
            el.style.display = show ? 'flex' : 'none';
        };
        setVisible(daysContainer, freq === 'specific');
        setVisible(intervalContainer, freq === 'every_x_days');
        setVisible(startContainer, freq === 'every_x_days');
        setVisible(monthlyContainer, freq === 'monthly');
        this.refreshCrudEstimatedFieldState?.('habits');
     },

onHabitReminderIntervalToggle: function(enabled) {
        const fields = document.getElementById('habit-reminder-interval-fields');
        const singleReminderField = document.getElementById('habit-single-reminder-field');
        if (!fields) return;
        if (enabled) {
            fields.classList.remove('hidden');
            fields.classList.add('grid');
            if (singleReminderField) {
                singleReminderField.classList.add('hidden');
            }
        } else {
            fields.classList.add('hidden');
            fields.classList.remove('grid');
            if (singleReminderField) {
                singleReminderField.classList.remove('hidden');
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
            const reminderTimeVal = document.getElementById('habit-reminder-time')?.value || '';
            const single = toMins(reminderTimeVal);
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
        const selectedDim = String(document.getElementById('crud-dimension')?.value || '').trim();
        const editingHabitId = this.editingEntity?.type === 'habits' ? this.editingEntity.id : '';
        const editingHabit = editingHabitId
            ? (state.habits || []).find(h => h.id === editingHabitId)
            : null;
        const hiddenLinkedMetaId = String(editingHabit?.linkedMetaId || '').trim();

        const metas = (state.entities?.metas || []).filter(m =>
            m.status !== 'done' && m.status !== 'abandoned'
        ).filter(m => {
            if (!selectedDim || selectedDim === 'Geral') return true;
            const metaDim = String(m.dimension || 'Geral').trim();
            return metaDim === selectedDim || metaDim === 'Geral';
        });
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
        if (hiddenLinkedMetaId && !select.querySelector(`option[value="${hiddenLinkedMetaId}"]`)) {
            const currentMeta = (state.entities?.metas || []).find(m => m.id === hiddenLinkedMetaId);
            const ghost = document.createElement('option');
            ghost.value = hiddenLinkedMetaId;
            ghost.textContent = currentMeta?.title
                ? `${currentMeta.title} (vinculo atual fora da area selecionada)`
                : 'Vinculo atual fora da area selecionada';
            ghost.dataset.hiddenLinkedMeta = 'true';
            select.appendChild(ghost);
        }

        // Restaura seleção anterior se ainda existir
        if (prev && select.querySelector(`option[value="${prev}"]`)) {
            select.value = prev;
        } else if (hiddenLinkedMetaId && select.querySelector(`option[value="${hiddenLinkedMetaId}"]`)) {
            select.value = hiddenLinkedMetaId;
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
            const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
            const resolvedSteps = this.getHabitResolvedSteps?.(habit) || [];
            const wasDone = mode === 'boolean' ? previousValue > 0 : previousValue >= target;
            habit.logs[dateStr] = value;
            if (mode === 'boolean' && resolvedSteps.length > 0) {
                if (!habit.stepLogs) habit.stepLogs = {};
                const markAll = value > 0;
                const map = {};
                if (markAll) resolvedSteps.forEach((_, idx) => { map[idx] = true; });
                habit.stepLogs[dateStr] = map;
                resolvedSteps.forEach((_, idx) => {
                    this.syncHabitStepStateToLinkedMicro(habit, dateStr, idx, markAll);
                });
            }

            // Toast feedback based on new value
            const isDone = mode === 'boolean' ? value > 0 : value >= target;
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
            if (this.currentView === 'foco' && this.render.foco) this.render.foco();
            if (this.currentView === 'habitos' && this.render.habitos) this.render.habitos();
        }
    },

getActiveLinkedMicroForHabit: function(habitId, dateStr = this.getLocalDateKey()) {
        const state = window.sistemaVidaState || {};
        const micros = state.entities?.micros || [];
        const dw = state.deepWork || {};
        const safeHabitId = String(habitId || '').trim();
        if (!safeHabitId) return null;

        const isSameSessionDate = (micro) => {
            if (!micro) return false;
            const stepLogs = micro.stepLogs && typeof micro.stepLogs === 'object' ? micro.stepLogs : {};
            if (stepLogs[dateStr]) return true;
            const createdAt = String(micro.createdAt || '').trim();
            if (!createdAt) return false;
            const dt = new Date(createdAt);
            if (Number.isNaN(dt.getTime())) return false;
            return this.getLocalDateKey(dt) === dateStr;
        };

        const isCandidate = (micro) => {
            if (!micro) return false;
            if (String(micro.sourceHabitId || '') !== safeHabitId) return false;
            if (String(micro.status || '') === 'done') return false;
            if (!Array.isArray(micro.steps) || micro.steps.length === 0) return false;
            return isSameSessionDate(micro);
        };

        const preferredIds = [String(dw.microId || ''), String(dw.pendingClosure?.microId || '')].filter(Boolean);
        for (const preferredId of preferredIds) {
            const preferred = micros.find(m => String(m.id || '') === preferredId);
            if (isCandidate(preferred)) return preferred;
        }

        const candidates = micros.filter(isCandidate);
        if (!candidates.length) return null;
        candidates.sort((a, b) => {
            const aInProgress = a.status === 'in_progress' ? 1 : 0;
            const bInProgress = b.status === 'in_progress' ? 1 : 0;
            if (aInProgress !== bInProgress) return bInProgress - aInProgress;
            const aTs = new Date(a.createdAt || 0).getTime() || 0;
            const bTs = new Date(b.createdAt || 0).getTime() || 0;
            return bTs - aTs;
        });
        return candidates[0];
    },

_setHabitStepState: function(habit, dateStr, stepIndex, isDone) {
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || !steps.length) return null;
        const idx = Math.max(0, Math.floor(Number(stepIndex) || 0));
        if (idx >= steps.length) return null;
        if (!habit.stepLogs || typeof habit.stepLogs !== 'object') habit.stepLogs = {};
        if (!habit.stepLogs[dateStr] || typeof habit.stepLogs[dateStr] !== 'object') habit.stepLogs[dateStr] = {};
        const map = habit.stepLogs[dateStr];
        if (isDone) map[idx] = true;
        else {
            delete map[idx];
            delete map[String(idx)];
        }
        const doneCount = steps.reduce((acc, _, i) => acc + (map[i] || map[String(i)] ? 1 : 0), 0);
        const allDone = doneCount === steps.length;
        if (!habit.logs || typeof habit.logs !== 'object') habit.logs = {};
        if ((this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean') === 'boolean') {
            habit.logs[dateStr] = allDone ? 1 : 0;
        }
        return { doneCount, total: steps.length, allDone };
    },

_setMicroStepState: function(micro, dateStr, stepIndex, isDone) {
        if (!micro || !Array.isArray(micro.steps) || !micro.steps.length) return null;
        const idx = Math.max(0, Math.floor(Number(stepIndex) || 0));
        if (idx >= micro.steps.length) return null;
        if (!micro.stepLogs || typeof micro.stepLogs !== 'object') micro.stepLogs = {};
        if (!micro.stepLogs[dateStr] || typeof micro.stepLogs[dateStr] !== 'object') micro.stepLogs[dateStr] = {};
        const map = micro.stepLogs[dateStr];
        if (isDone) map[idx] = true;
        else {
            delete map[idx];
            delete map[String(idx)];
        }
        const doneCount = micro.steps.reduce((acc, _, i) => acc + (map[i] || map[String(i)] ? 1 : 0), 0);
        const allDone = doneCount === micro.steps.length;
        micro.progress = Math.round((doneCount / micro.steps.length) * 100);
        if (micro.status === 'pending' && doneCount > 0) micro.status = 'in_progress';
        if (micro.status !== 'done') micro.completed = false;
        return { doneCount, total: micro.steps.length, allDone };
    },

syncHabitStepStateToLinkedMicro: function(habitOrId, dateStr, stepIndex, isDone) {
        const state = window.sistemaVidaState || {};
        const habit = typeof habitOrId === 'string'
            ? (state.habits || []).find(h => h.id === habitOrId)
            : habitOrId;
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || !steps.length) return null;
        const activeMicro = this.getActiveLinkedMicroForHabit(habit.id, dateStr);
        if (!activeMicro) return null;
        if (!Array.isArray(activeMicro.steps) || stepIndex >= activeMicro.steps.length) return null;
        return this._setMicroStepState(activeMicro, dateStr, stepIndex, !!isDone);
    },

syncMicroStepStateToLinkedHabit: function(microOrId, dateStr, stepIndex, isDone) {
        const state = window.sistemaVidaState || {};
        const micro = typeof microOrId === 'string'
            ? (state.entities?.micros || []).find(m => m.id === microOrId)
            : microOrId;
        if (!micro) return null;
        const habitId = String(micro.sourceHabitId || '').trim();
        if (!habitId) return null;
        const habit = (state.habits || []).find(h => h.id === habitId);
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || !steps.length) return null;
        if (stepIndex >= steps.length) return null;
        return this._setHabitStepState(habit, dateStr, stepIndex, !!isDone);
    },

    triggerHabitCompletionEffects: function(habit, dateStr, wasDone, allDone) {
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
    },

toggleMicroExecutionStep: function(microId, dateStr, stepIndex) {
        const state = window.sistemaVidaState || {};
        const micro = (state.entities?.micros || []).find(m => m.id === microId);
        if (!micro || !Array.isArray(micro.steps) || !micro.steps.length) return;
        const day = String(dateStr || this.getLocalDateKey());
        if (!micro.stepLogs || typeof micro.stepLogs !== 'object') micro.stepLogs = {};
        if (!micro.stepLogs[day] || typeof micro.stepLogs[day] !== 'object') micro.stepLogs[day] = {};
        const current = !!(micro.stepLogs[day][stepIndex] || micro.stepLogs[day][String(stepIndex)]);
        const next = !current;
        this._setMicroStepState(micro, day, stepIndex, next);
        const habitId = String(micro.sourceHabitId || '').trim();
        const habit = habitId ? (state.habits || []).find(h => h.id === habitId) : null;
        let wasDone = false;
        if (habit) {
            const target = habit.targetValue || 1;
            const previousValue = Number(habit.logs?.[day]) || 0;
            wasDone = (this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean') === 'boolean' ? previousValue > 0 : previousValue >= target;
        }
        const syncRes = this.syncMicroStepStateToLinkedHabit(micro, day, stepIndex, next);
        if (habit && syncRes) {
            this.triggerHabitCompletionEffects(habit, day, wasDone, syncRes.allDone);
        }
        this.saveState(true);
        if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
        if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
        if (this.currentView === 'habitos' && this.render?.habitos) this.render.habitos();
        if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
    },

toggleMicroExecutionAllSteps: function(microId, dateStr, currentlyDone) {
        const state = window.sistemaVidaState || {};
        const micro = (state.entities?.micros || []).find(m => m.id === microId);
        if (!micro || !Array.isArray(micro.steps) || !micro.steps.length) return;
        const day = String(dateStr || this.getLocalDateKey());
        const markAll = !currentlyDone;
        const habitId = String(micro.sourceHabitId || '').trim();
        const habit = habitId ? (state.habits || []).find(h => h.id === habitId) : null;
        let wasDone = false;
        if (habit) {
            const target = habit.targetValue || 1;
            const previousValue = Number(habit.logs?.[day]) || 0;
            wasDone = (this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean') === 'boolean' ? previousValue > 0 : previousValue >= target;
        }
        let lastSyncRes = null;
        micro.steps.forEach((_, idx) => {
            this._setMicroStepState(micro, day, idx, markAll);
            lastSyncRes = this.syncMicroStepStateToLinkedHabit(micro, day, idx, markAll);
        });
        if (habit && lastSyncRes) {
            this.triggerHabitCompletionEffects(habit, day, wasDone, lastSyncRes.allDone);
        }
        this.saveState(true);
        if (this.currentView === 'foco' && this.render?.foco) this.render.foco();
        if (this.currentView === 'hoje' && this.render?.hoje) this.render.hoje();
        if (this.currentView === 'habitos' && this.render?.habitos) this.render.habitos();
        if (this.currentView === 'planos' && this.render?.planos) this.render.planos();
    },

toggleHabitStepLog: function(habitId, dateStr, stepIndex) {
        const state = window.sistemaVidaState;
        const habit = (state.habits || []).find(h => h.id === habitId);
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || !steps.length) return;
        if (!habit.stepLogs) habit.stepLogs = {};
        if (!habit.stepLogs[dateStr]) habit.stepLogs[dateStr] = {};
        const target = habit.targetValue || 1;
        const previousValue = Number(habit.logs?.[dateStr]) || 0;
        const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
        const wasDone = mode === 'boolean' ? previousValue > 0 : previousValue >= target;
        const current = !!(habit.stepLogs[dateStr][stepIndex] || habit.stepLogs[dateStr][String(stepIndex)]);
        habit.stepLogs[dateStr][stepIndex] = !current;
        this.syncHabitStepStateToLinkedMicro(habit, dateStr, stepIndex, !current);
        const doneCount = steps.reduce((acc, _, idx) => acc + (habit.stepLogs[dateStr][idx] ? 1 : 0), 0);
        const allDone = doneCount === steps.length;
        if (!habit.logs) habit.logs = {};
        if (mode === 'boolean') {
            habit.logs[dateStr] = allDone ? 1 : 0;
        }
        this.triggerHabitCompletionEffects(habit, dateStr, wasDone, allDone);
        this.saveState(true);
        this.renderHabitStepsChecklist(habitId);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
        if (this.currentView === 'habitos' && this.render.habitos) this.render.habitos();
    },

toggleHabitAllSteps: function(habitId, dateStr, currentlyDone) {
        const state = window.sistemaVidaState;
        const habit = (state.habits || []).find(h => h.id === habitId);
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || !steps.length) return;
        if (!habit.stepLogs) habit.stepLogs = {};
        if (!habit.logs) habit.logs = {};
        const target = habit.targetValue || 1;
        const previousValue = Number(habit.logs?.[dateStr]) || 0;
        const mode = this.normalizeHabitTrackMode?.(habit.trackMode) || 'boolean';
        const wasDone = mode === 'boolean' ? previousValue > 0 : previousValue >= target;
        if (currentlyDone) {
            habit.stepLogs[dateStr] = {};
            if (mode === 'boolean') habit.logs[dateStr] = 0;
            steps.forEach((_, idx) => {
                this.syncHabitStepStateToLinkedMicro(habit, dateStr, idx, false);
            });
            this.triggerHabitCompletionEffects(habit, dateStr, wasDone, false);
        } else {
            const all = {};
            steps.forEach((_, idx) => { all[idx] = true; });
            habit.stepLogs[dateStr] = all;
            if (mode === 'boolean') habit.logs[dateStr] = 1;
            steps.forEach((_, idx) => {
                this.syncHabitStepStateToLinkedMicro(habit, dateStr, idx, true);
            });
            this.triggerHabitCompletionEffects(habit, dateStr, wasDone, true);
        }
        this.saveState(true);
        this.renderHabitStepsChecklist(habitId);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
        if (this.currentView === 'habitos' && this.render.habitos) this.render.habitos();
    },

renderHabitStepsChecklist: function(habitId) {
        const wrap = document.getElementById('habit-steps-checklist-wrap');
        const container = document.getElementById('habit-steps-checklist');
        if (!wrap || !container) return;
        const habit = (window.sistemaVidaState.habits || []).find(h => h.id === habitId);
        const steps = this.getHabitResolvedSteps?.(habit) || [];
        if (!habit || steps.length === 0) {
            wrap.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        wrap.classList.remove('hidden');
        wrap.classList.add('flex');
        const today = this.getLocalDateKey();
        const map = (habit.stepLogs || {})[today] || {};
        const esc = (txt) => String(txt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        container.innerHTML = steps.map((step, idx) => {
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
