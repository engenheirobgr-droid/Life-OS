import { auth, signOut, LOCAL_USER_SCOPE } from './firebase.js';

export function attachOnboarding(app) {
    Object.assign(app, {
getStarterJourneyState: function() {
        const state = window.sistemaVidaState;
        const today = this.getLocalDateKey();
        const weekKey = this._getWeekKey();
        const weekPlan = (state.weekPlans || {})[weekKey];
        const activeMicros = (state.entities?.micros || []).filter(m => m && m.id && m.status !== 'done' && m.status !== 'abandoned' && !m.completed);
        const activeHabits = (state.habits || []).filter(h => h && h.id && h.archived !== true && h.status !== 'archived');
        const dayIndex = String(new Date(today + 'T12:00:00').getDay());
        const habitsForToday = activeHabits.filter(h => h.frequency !== 'specific' || !Array.isArray(h.specificDays) || !h.specificDays.length || h.specificDays.map(String).includes(dayIndex));
        const pendingHabit = habitsForToday.find(h => !this.isHabitDoneOnDate(h, today));
        const weeklyPlanned = !!(weekPlan && Array.isArray(weekPlan.selectedMicros) && weekPlan.selectedMicros.length > 0);
        const next = this.getNextBestAction({ scope: 'today' });
        const nextRitual = this.getNextRitualSuggestion?.();
        const hasMicroParent = (state.entities?.macros || []).some(item => item && item.status !== 'done' && item.status !== 'abandoned');

        const queue = [];
        const push = (item) => {
            if (queue.length < 3 && item && !queue.some(existing => existing.id === item.id || (existing.action && existing.action === item.action))) queue.push(item);
        };

        if (nextRitual) {
            push({
                id: `ritual-${nextRitual.key || nextRitual.label || 'next'}`,
                label: 'Proximo ritual',
                description: nextRitual.label || 'Abra o ritual mais importante agora.',
                icon: nextRitual.icon || 'event_repeat',
                action: 'ritual',
                route: nextRitual.route
            });
        }

        if (!activeHabits.length) {
            push({
                id: 'create-habit',
                label: 'Criar habito ancora',
                description: 'Inclua um comportamento pequeno para sustentar a rotina.',
                icon: 'repeat',
                action: 'create-habit'
            });
        } else if (pendingHabit) {
            push({
                id: 'do-habit',
                label: 'Registrar habito',
                description: pendingHabit.title || 'Marque o habito previsto para hoje.',
                icon: 'check_circle',
                action: 'do-habit',
                habitId: pendingHabit.id
            });
        }

        if (!activeMicros.length) {
            push(hasMicroParent
                ? {
                    id: 'create-micro',
                    label: 'Criar micro acao',
                    description: 'Transforme sua trilha em uma proxima acao executavel.',
                    icon: 'bolt',
                    action: 'create-micro'
                }
                : {
                    id: 'create-trail',
                    label: 'Criar trilha guiada',
                    description: 'Monte a cadeia meta, OKR, macro e micro inicial.',
                    icon: 'account_tree',
                    action: 'create-trail'
                });
        } else if (!weeklyPlanned && nextRitual?.key !== 'weeklyPlan') {
            push({
                id: 'weekly',
                label: 'Planejar semana',
                description: 'Escolha quais micros entram no plano desta semana.',
                icon: 'calendar_view_week',
                action: 'weekly'
            });
        }

        if (weeklyPlanned && next?.micro) {
            push({
                id: 'next-best',
                label: 'Ir para proxima melhor acao',
                description: next.micro.title ? `Pra hoje recomenda: ${next.micro.title}` : 'Use a recomendacao existente em Pra hoje.',
                icon: 'task_alt',
                action: 'next-best',
                microId: next.micro.id
            });
        }

        const doneSignals = [
            !nextRitual,
            activeHabits.length > 0,
            activeHabits.length > 0 && (!habitsForToday.length || !pendingHabit),
            activeMicros.length > 0,
            weeklyPlanned,
            !!(weeklyPlanned && next?.micro)
        ].filter(Boolean).length;
        const totalSignals = 6;

        return {
            items: queue,
            doneCount: doneSignals,
            total: totalSignals,
            pct: Math.min(100, Math.round((doneSignals / totalSignals) * 100))
        };
    },

renderStarterJourneyCard: function() {
        const container = document.getElementById('starter-journey-container');
        if (!container) return;
        const journey = this.getStarterJourneyState();
        if (!journey.items.length) {
            container.innerHTML = `
                <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <span class="material-symbols-outlined notranslate text-[18px]">check_circle</span>
                        <p class="text-xs font-bold uppercase tracking-widest">Jornada de hoje concluida</p>
                    </div>
                </div>`;
            return;
        }
        const list = journey.items.map((item) => `
            <div class="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 bg-surface-container-low border border-outline-variant/15">
                <div class="flex items-start gap-2.5 min-w-0">
                    <span class="material-symbols-outlined notranslate text-[18px] mt-0.5 shrink-0 text-primary/60">${item.icon || 'radio_button_unchecked'}</span>
                    <div class="min-w-0">
                        <p class="text-xs font-semibold text-on-surface">${this.escapeHtml(item.label)}</p>
                        <p class="text-[11px] text-outline mt-0.5 leading-snug">${this.escapeHtml(item.description || '')}</p>
                    </div>
                </div>
                <button type="button" onclick="window.app.onStarterJourneyAction('${item.id}')" class="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors mt-0.5">Ir</button>
            </div>
        `).join('');
        container.innerHTML = `
            <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm p-4 md:p-5 space-y-3">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Jornada guiada</p>
                        <p class="text-xs text-outline mt-1">${journey.items.length} proximos movimentos sugeridos</p>
                    </div>
                    <span class="text-xs font-bold text-primary">${journey.pct}%</span>
                </div>
                <div class="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div class="h-full rounded-full bg-primary transition-all duration-500" style="width:${journey.pct}%"></div>
                </div>
                <div class="space-y-2">${list}</div>
                <p class="text-[11px] text-outline">A fila se atualiza conforme voce conclui cada movimento.</p>
            </div>`;
    },

onStarterJourneyAction: function(itemId) {
        const item = this.getStarterJourneyState().items.find(entry => entry.id === itemId);
        const action = item?.action || itemId;

        const actions = {
            ritual: () => item?.route ? this.flowNavigate(item.route.view || '', item.route.sectionId || '', item.route.tabId || '') : this.openFlowModal?.(),
            checkin: () => this.flowNavigate('hoje', 'daily-checkin-panel'),
            weekly:  () => this.flowNavigate('planos', 'tab-semanal', 'semanal'),
            'create-trail': () => this.openMetaTrailWizard(),
            'create-micro': () => {
                this.flowNavigate('planos', 'tab-semanal', 'semanal');
                setTimeout(() => this.openWeeklyPlanModal({ addMicro: true }), 360);
            },
            'create-habit': () => {
                this.flowNavigate('hoje', 'hoje-habits-section');
                setTimeout(() => this.openCreateModal('habits'), 360);
            },
            'do-habit': () => item?.habitId ? this.openHabitToday(item.habitId) : this.flowNavigate('hoje', 'hoje-habits-section'),
            'next-best': () => this.flowNavigate('hoje', 'next-best-action-container'),
            diary: () => this.flowNavigate('hoje', 'hoje-diario-section'),
            trail: () => this.openMetaTrailWizard(),
            habit: () => this.flowNavigate('hoje', 'hoje-habits-section')
        };
        if (actions[action]) actions[action]();
    },

scrollOnboardingToTop: function() {
        const appContent = document.getElementById(this.config.containerId);
        const scrollContainer = appContent?.closest('section') || document.scrollingElement || document.documentElement;
        try { scrollContainer.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { scrollContainer.scrollTop = 0; }
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {}
    },

onboardingGoTo: function(step) {
        const steps = document.querySelectorAll('.onboarding-step');
        if (steps.length === 0) return;

        steps.forEach((s, idx) => {
            s.classList.remove('step-active');
            if (idx < step) s.classList.add('step-hidden-left');
            else if (idx > step) s.classList.add('step-hidden-right');
            else {
                s.classList.remove('step-hidden-left', 'step-hidden-right');
                s.classList.add('step-active');
            }
        });
        this.onboardingStep = step;
        
        // Atualiza barra de progresso
        const progress = ((step) / (steps.length - 1)) * 100;
        const bar = document.getElementById('onboarding-progress-bar');
        if (bar) bar.style.width = `${progress}%`;
        
        const indicator = document.getElementById('onboarding-step-indicator');
        if (indicator) indicator.textContent = `${step + 1}/${steps.length}`;

        // Renderiza exemplos de proposito ao entrar no step-4
        const step4Index = Array.from(steps).findIndex(s => s.id === 'step-4');
        if (step === step4Index) {
            const propostoTA = document.getElementById('onboarding-proposito');
            if (propostoTA && !propostoTA.value.trim()) {
                this._renderStep4Examples();
            }
        }

        // Renderização especial do resumo
        if (step === steps.length - 1) {
            const state = window.sistemaVidaState;
            const nameEl = document.getElementById('conclusao-nome');
            const valuesEl = document.getElementById('conclusao-valores');
            const trailEl = document.getElementById('onboarding-summary-trail');
            const habitEl = document.getElementById('onboarding-summary-habit');
            const starter = this.onboardingGetStarterDraft();
            if (nameEl) nameEl.textContent = state.profile.name || 'Viajante';
            if (valuesEl) valuesEl.textContent = (state.profile.values || []).join(', ') || 'seus valores';
            if (trailEl) {
                const dim = starter.dimension || 'Carreira';
                const goal = starter.goalTitle || 'Meta inicial';
                trailEl.textContent = `${dim}: ${goal} (com OKR, Macro e Micro criadas automaticamente).`;
            }
            if (habitEl) {
                const habit = starter.habitTitle || 'Habito ancora';
                const at = starter.habitTime ? ` as ${starter.habitTime}` : '';
                habitEl.textContent = `${habit}${at}.`;
            }
        }

        this.scrollOnboardingToTop();
    },

onboardingGetFieldValue: function(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return String(el.value || '').trim();
    },

onboardingGetStarterDraft: function() {
        const profile = window.sistemaVidaState?.profile || {};
        if (!profile.onboardingStarter || typeof profile.onboardingStarter !== 'object') {
            profile.onboardingStarter = {
                dimension: 'Carreira',
                goalTitle: '',
                habitTitle: '',
                habitTime: '',
                strength: '',
                shadow: ''
            };
            window.sistemaVidaState.profile = profile;
        }
        return profile.onboardingStarter;
    },

onboardingSaveStarterDraft: function() {
        const draft = this.onboardingGetStarterDraft();
        const read = (id, fallback = '') => String(document.getElementById(id)?.value || fallback).trim();
        draft.dimension = read('onboarding-starter-dimension', draft.dimension || 'Carreira') || 'Carreira';
        draft.goalTitle = read('onboarding-starter-goal', draft.goalTitle || '');
        draft.habitTitle = read('onboarding-starter-habit', draft.habitTitle || '');
        draft.habitTime = read('onboarding-starter-time', draft.habitTime || '');
        draft.strength = read('onboarding-strength', draft.strength || '');
        draft.shadow = read('onboarding-shadow', draft.shadow || '');
        window.sistemaVidaState.profile.onboardingStarter = draft;
        return draft;
    },

populateOnboardingIdentityCatalogs: function() {
        const strengthList = document.getElementById('onboarding-strength-catalog');
        const shadowList = document.getElementById('onboarding-shadow-catalog');
        if (strengthList) {
            strengthList.innerHTML = this.getIdentityCatalog('strengths')
                .map((title) => `<option value="${this.escapeHtml(title)}"></option>`)
                .join('');
        }
        if (shadowList) {
            shadowList.innerHTML = this.getIdentityCatalog('shadows')
                .map((title) => `<option value="${this.escapeHtml(title)}"></option>`)
                .join('');
        }
    },

resolveIdentityCatalogTitle: function(type, rawTitle) {
        const clean = String(rawTitle || '').trim();
        if (!clean) return '';
        const normalized = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const catalog = this.getIdentityCatalog(type);
        const exact = catalog.find((item) =>
            item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
        );
        return exact || clean;
    },

onboardingHydrateFields: function() {
        const state = window.sistemaVidaState;
        this.ensureSettingsState();

        const profile = state.profile || {};
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        setValue('onboarding-nome', profile.name || '');
        setValue('onboarding-ikigai-missao', ikigai.missao || '');
        setValue('onboarding-ikigai-vocacao', ikigai.vocacao || '');
        setValue('onboarding-ikigai-love', ikigai.love || '');
        setValue('onboarding-ikigai-good', ikigai.good || '');
        setValue('onboarding-ikigai-need', ikigai.need || '');
        setValue('onboarding-ikigai-paid', ikigai.paid || '');
        setValue('onboarding-legacy-familia', legacyObj.familia || '');
        setValue('onboarding-legacy-profissao', legacyObj.profissao || '');
        setValue('onboarding-legacy-mundo', legacyObj.mundo || '');

        const fallbackPurpose = ikigai.sintese || legacyObj.mundo || profile.legacy || profile.purpose || '';
        setValue('onboarding-proposito', fallbackPurpose);
        const starter = this.onboardingGetStarterDraft();
        setValue('onboarding-starter-goal', starter.goalTitle || '');
        setValue('onboarding-starter-habit', starter.habitTitle || '');
        setValue('onboarding-starter-time', starter.habitTime || '');
        setValue('onboarding-strength', starter.strength || '');
        setValue('onboarding-shadow', starter.shadow || '');
        const starterDimension = document.getElementById('onboarding-starter-dimension');
        if (starterDimension && starter.dimension) starterDimension.value = starter.dimension;

        const dimensions = [
            { key: 'Saúde', sliderId: 'onboarding-slider-saude' },
            { key: 'Mente', sliderId: 'onboarding-slider-mente' },
            { key: 'Carreira', sliderId: 'onboarding-slider-carreira' },
            { key: 'Finanças', sliderId: 'onboarding-slider-financas' },
            { key: 'Relacionamentos', sliderId: 'onboarding-slider-relacionamentos' },
            { key: 'Família', sliderId: 'onboarding-slider-familia' },
            { key: 'Lazer', sliderId: 'onboarding-slider-lazer' },
            { key: 'Propósito', sliderId: 'onboarding-slider-proposito' }
        ];
        dimensions.forEach(({ key, sliderId }) => {
            const slider = document.getElementById(sliderId);
            const currentVal = Number(state.dimensions?.[key]?.score);
            const safeVal = Number.isFinite(currentVal) ? Math.max(0, Math.min(100, Math.round(currentVal))) : 50;
            if (slider) slider.value = String(safeVal);
            const valEl = document.getElementById(`slider-val-${key}`);
            if (valEl) valEl.textContent = String(safeVal);
        });

        const selectedValues = new Set((profile.values || []).slice(0, 5));
        document.querySelectorAll('#values-container [data-valor]').forEach((btn) => {
            const v = btn.getAttribute('data-valor');
            btn.classList.toggle('selected', selectedValues.has(v));
        });
        const previewEl = document.getElementById('onboarding-valores-preview');
        if (previewEl) {
            previewEl.textContent = selectedValues.size > 0
                ? Array.from(selectedValues).join(' • ')
                : 'Selecione seus valores...';
        }
        this.populateOnboardingIdentityCatalogs();

        // Adapta o Step 1 caso o usuario ja esteja logado em uma conta real:
        // esconde inputs de email/senha, troca botoes para refletir o estado.
        this.applyOnboardingAccountState();
    },

applyOnboardingAccountState: function() {
        const step1 = document.getElementById('step-1');
        if (!step1) return;
        const emailInput = step1.querySelector('#account-email-input');
        const passwordInput = step1.querySelector('#account-password-input');
        const createBtn = step1.querySelector('[onclick*="onboardingCreateAccount"]');
        const signInBtn = step1.querySelector('[onclick*="onboardingSignInAccount"]');
        const continueBtn = step1.querySelector('[onclick*="onboardingContinueLocal"]');
        const noteEl = emailInput?.closest('.rounded-2xl')?.querySelector('p');

        const isAccount = this.isRealAccount();
        const email = auth.currentUser?.email || '';

        if (isAccount) {
            // Conta ja autenticada: esconder inputs e adaptar botoes
            if (emailInput) emailInput.style.display = 'none';
            if (passwordInput) passwordInput.style.display = 'none';
            if (createBtn) createBtn.style.display = 'none';
            if (signInBtn) {
                signInBtn.textContent = 'Continuar';
                signInBtn.classList.add('flex-[2]');
                signInBtn.classList.remove('flex-1');
            }
            if (continueBtn) {
                continueBtn.textContent = 'Trocar de conta';
                continueBtn.setAttribute('onclick', 'app.onboardingSwitchAccount()');
            }
            if (noteEl) {
                noteEl.textContent = `Voce esta logado como ${email}. Continue para configurar suas dimensoes ou troque de conta se preferir.`;
            }
        } else {
            // Modo visitante / sem conta: garantir UI padrao
            if (emailInput) emailInput.style.display = '';
            if (passwordInput) passwordInput.style.display = '';
            if (createBtn) createBtn.style.display = '';
            if (signInBtn) {
                signInBtn.textContent = 'Entrar';
                signInBtn.classList.remove('flex-[2]');
                signInBtn.classList.add('flex-1');
            }
            if (continueBtn) {
                continueBtn.textContent = 'Continuar local';
                continueBtn.setAttribute('onclick', 'app.onboardingContinueLocal()');
            }
            if (noteEl) {
                noteEl.textContent = 'Quer testar primeiro? Continue localmente. Seus dados ficam apenas neste aparelho até você criar uma conta em Perfil.';
            }
        }
    },

onboardingSwitchAccount: async function() {
        this.onboardingSaveCurrentStep(false);
        try {
            this.teardownRealtimeSync();
            this.setSignedOutIntentionally(true);
            if (auth.currentUser) await signOut(auth);
            this.resetInitialAuthState(null);
            this.persistLocalMirror(LOCAL_USER_SCOPE);
            this.showToast('Sessao encerrada. Use os campos para entrar com outra conta.', 'success');
            // Re-renderiza onboarding sem auth para mostrar form de email/senha de novo
            this.applyOnboardingAccountState();
        } catch (error) {
            console.warn('[AUTH] Falha ao trocar de conta no onboarding:', error);
            this.showToast('Nao foi possivel sair da conta agora. Tente novamente.', 'error');
        }
    },

onboardingSaveCurrentStep: function(persist = true) {
        const state = window.sistemaVidaState;
        this.ensureSettingsState();
        if (this.onboardingStep === 1) {
            const nameInput = document.getElementById('onboarding-nome');
            if (nameInput) state.profile.name = nameInput.value.trim() || "Viajante";
        } else if (this.onboardingStep === 2) {
            // Valores da Roda já são atualizados em tempo real via onboardingUpdateSlider
        } else if (this.onboardingStep === 3) {
            // Valores já salvos em tempo real via onboardingToggleValor
        } else if (this.onboardingStep === 4) {
            const ikigai = state.profile.ikigai || {};
            const legacyObj = state.profile.legacyObj || {};

            ikigai.missao = this.onboardingGetFieldValue('onboarding-ikigai-missao');
            ikigai.vocacao = this.onboardingGetFieldValue('onboarding-ikigai-vocacao');
            ikigai.love = this.onboardingGetFieldValue('onboarding-ikigai-love');
            ikigai.good = this.onboardingGetFieldValue('onboarding-ikigai-good');
            ikigai.need = this.onboardingGetFieldValue('onboarding-ikigai-need');
            ikigai.paid = this.onboardingGetFieldValue('onboarding-ikigai-paid');

            const purposeText = this.onboardingGetFieldValue('onboarding-proposito');
            if (purposeText) ikigai.sintese = purposeText;

            legacyObj.familia = this.onboardingGetFieldValue('onboarding-legacy-familia');
            legacyObj.profissao = this.onboardingGetFieldValue('onboarding-legacy-profissao');
            legacyObj.mundo = this.onboardingGetFieldValue('onboarding-legacy-mundo');
            if (!legacyObj.mundo && purposeText) legacyObj.mundo = purposeText;

            state.profile.ikigai = ikigai;
            state.profile.legacyObj = legacyObj;
            state.profile.legacy = ikigai.sintese || legacyObj.mundo || state.profile.legacy || '';
            // Campo legado mantido por compatibilidade, agora espelhando a sintese.
            state.profile.purpose = ikigai.sintese || state.profile.legacy || '';
        } else if (this.onboardingStep === 5) {
            this.onboardingSaveStarterDraft();
        }
        if (persist) this.saveState();
    },

validateOnboardingStarterDraft: function(options = {}) {
        const showError = options.showError !== false;
        const draft = this.onboardingSaveStarterDraft();
        if (!draft.goalTitle) {
            if (showError) this.showToast('Defina uma meta inicial para montar sua trilha.', 'error');
            return false;
        }
        if (!draft.habitTitle) {
            if (showError) this.showToast('Defina ao menos um habito ancora para continuar.', 'error');
            return false;
        }
        return true;
    },

ensureOnboardingStarterSetup: function() {
        const state = window.sistemaVidaState;
        this.ensureIdentityState();
        if (!state.entities) state.entities = { metas: [], okrs: [], macros: [], micros: [] };
        ['metas', 'okrs', 'macros', 'micros'].forEach((type) => {
            if (!Array.isArray(state.entities[type])) state.entities[type] = [];
        });
        if (!Array.isArray(state.habits)) state.habits = [];
        if (!state.weekPlans || typeof state.weekPlans !== 'object') state.weekPlans = {};

        const draft = this.onboardingSaveStarterDraft();
        const dim = state.dimensions?.[draft.dimension] ? draft.dimension : 'Carreira';
        const goalTitle = draft.goalTitle || `Evoluir ${dim.toLowerCase()} com consistencia`;
        const habitTitle = draft.habitTitle || 'Habito ancora diario';
        const todayKey = this.getLocalDateKey();
        const nowIso = new Date().toISOString();
        const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const datePlus = (days) => {
            const d = new Date(todayKey + 'T00:00:00');
            d.setDate(d.getDate() + days);
            return this.getLocalDateKey(d);
        };

        const identity = state.profile.identity || { strengths: [], shadows: [] };
        const ensureIdentityItem = (type, rawTitle) => {
            const resolvedTitle = this.resolveIdentityCatalogTitle(type, rawTitle);
            if (!resolvedTitle) return null;
            const list = identity[type];
            const found = (list || []).find((item) => String(item.title || '').toLowerCase() === resolvedTitle.toLowerCase());
            if (found) return found;
            const isStrength = type === 'strengths';
            const item = {
                id: `${isStrength ? 'strength' : 'shadow'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: resolvedTitle,
                dimension: dim,
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
                createdAt: todayKey,
                updatedAt: todayKey
            };
            list.push(item);
            return item;
        };

        const strengthItem = ensureIdentityItem('strengths', draft.strength);
        const shadowItem = ensureIdentityItem('shadows', draft.shadow);
        state.profile.identity = identity;

        const hasAnyTrail =
            (state.entities.metas || []).length > 0 ||
            (state.entities.okrs || []).length > 0 ||
            (state.entities.macros || []).length > 0 ||
            (state.entities.micros || []).length > 0;

        let createdMicroId = '';
        if (!hasAnyTrail) {
            const metaId = makeId('meta');
            const okrId = makeId('okr');
            const macroId = makeId('macro');
            const microId = makeId('micro');
            createdMicroId = microId;

            state.entities.metas.push({
                id: metaId,
                title: goalTitle,
                dimension: dim,
                prazo: datePlus(365),
                createdAt: todayKey,
                purpose: (state.profile.ikigai?.sintese || state.profile.legacy || '').trim(),
                horizonYears: 1,
                successCriteria: 'Meta inicial definida no onboarding',
                challengeLevel: 3,
                commitmentLevel: 3,
                status: 'pending',
                progress: 0,
                completed: false
            });
            state.entities.okrs.push({
                id: okrId,
                metaId,
                title: `OKR inicial - ${goalTitle}`,
                dimension: dim,
                inicioDate: todayKey,
                prazo: datePlus(84),
                createdAt: todayKey,
                purpose: `Resultado das proximas 12 semanas para ${goalTitle}`,
                successCriteria: `Resultado das proximas 12 semanas para ${goalTitle}`,
                challengeLevel: 3,
                commitmentLevel: 3,
                keyResults: [],
                status: 'pending',
                progress: 0,
                completed: false
            });
            state.entities.macros.push({
                id: macroId,
                metaId,
                okrId,
                title: `Macro inicial - ${goalTitle}`,
                dimension: dim,
                inicioDate: todayKey,
                prazo: datePlus(30),
                createdAt: todayKey,
                description: 'Macro criada automaticamente no onboarding',
                purpose: goalTitle,
                status: 'pending',
                progress: 0,
                completed: false
            });
            state.entities.micros.push({
                id: microId,
                metaId,
                okrId,
                macroId,
                title: `Micro inicial - primeiro passo de ${goalTitle}`,
                dimension: dim,
                inicioDate: todayKey,
                prazo: datePlus(7),
                createdAt: todayKey,
                indicator: 'Primeiro passo da trilha',
                purpose: goalTitle,
                effort: 'medio',
                status: 'pending',
                progress: 0,
                completed: false
            });

            this.markCadence('lifeGoals', todayKey);
            const weekKey = this._getWeekKey();
            if (!state.weekPlans[weekKey]) {
                state.weekPlans[weekKey] = {
                    weekKey,
                    intention: `Avancar: ${goalTitle}`,
                    selectedMicros: [microId],
                    completedMicros: [],
                    savedAt: nowIso
                };
                this.markCadence('weeklyPlan', todayKey);
            }
        }

        const hasHabit = (state.habits || []).some((habit) => String(habit.title || '').trim().toLowerCase() === habitTitle.trim().toLowerCase());
        if (!hasHabit) {
            const sourceType = strengthItem ? 'strength' : (shadowItem ? 'shadow' : '');
            const sourceId = strengthItem?.id || shadowItem?.id || '';
            const habit = {
                id: makeId('habit'),
                title: habitTitle,
                dimension: dim,
                context: '',
                completed: false,
                trigger: draft.habitTime ? `Quando der ${draft.habitTime}` : 'Ao iniciar o dia',
                routine: habitTitle,
                reward: 'Marcar o habito concluido no Life OS',
                steps: [],
                trackMode: 'boolean',
                targetValue: 1,
                frequency: 'daily',
                startTime: draft.habitTime || '',
                reminderEnabled: !!draft.habitTime,
                reminderTime: draft.habitTime || '',
                specificDays: [],
                logs: {},
                stepLogs: {},
                maturity: 'forming',
                maturityMeta: {},
                linkedMetaId: null,
                sourceType,
                sourceId,
                habitMode: sourceType === 'shadow' ? 'replace' : (sourceType === 'strength' ? 'build' : ''),
                obstacle: shadowItem ? `Sombra alvo: ${shadowItem.title}` : '',
                ifThen: shadowItem ? `Se perceber ${shadowItem.title.toLowerCase()}, entao inicio este habito por 5 minutos.` : '',
                createdAt: todayKey
            };
            state.habits.push(habit);
        }

        this.normalizeEntitiesState();
        if (createdMicroId) this.updateCascadeProgress(createdMicroId, 'micros');
        this.syncIdentityLinkedHabits();
        this.scheduleHabitReminders();
    },

// ── Fase 3: Propósito — char counter ──────────────────────────────────────────
onboardingPropostoInput: function(textarea) {
        const max = 160;
        const len = (textarea.value || '').length;
        const counter = document.getElementById('step4-char-count');
        if (counter) counter.textContent = `${len} / ${max}`;
    },

// Preenche o textarea de propósito com o texto do botão de inspiração clicado
onboardingSetProposta: function(btn) {
        const ta = document.getElementById('onboarding-proposito');
        if (!ta) return;
        // Remove aspas tipográficas ou normais ao redor do texto
        const text = btn.textContent.trim().replace(/^["“„]|["”‟]$/g, '');
        ta.value = text;
        this.onboardingPropostoInput(ta);
        ta.focus();
    },

// _renderStep4Examples: substituído por exemplos estáticos no HTML (step-4)
_renderStep4Examples: function() { /* no-op — exemplos agora são HTML estático */ },

// ── Fase 2: Sub-paineis do passo 1 (Nome → Conta) ─────────────────────────────
onboardingStep1GoB: function() {
        // Salva o nome antes de ir para o sub-painel B
        const nameInput = document.getElementById('onboarding-nome');
        if (nameInput) {
            const raw = nameInput.value.trim();
            window.sistemaVidaState.profile.name = raw || 'Viajante';
        }
        const panelA = document.getElementById('step-1-panel-a');
        const panelB = document.getElementById('step-1-panel-b');
        if (panelA && panelB) {
            panelA.classList.add('hidden');
            panelA.classList.remove('flex');
            panelB.classList.remove('hidden');
            panelB.classList.add('flex');
        }
        this.applyOnboardingAccountState();
        this.scrollOnboardingToTop();
    },

onboardingStep1GoA: function() {
        const panelA = document.getElementById('step-1-panel-a');
        const panelB = document.getElementById('step-1-panel-b');
        if (panelA && panelB) {
            panelB.classList.add('hidden');
            panelB.classList.remove('flex');
            panelA.classList.remove('hidden');
            panelA.classList.add('flex');
        }
        this.scrollOnboardingToTop();
    },

onboardingNext: function() {
        this.onboardingSaveCurrentStep();
        if (this.onboardingStep === 5 && !this.validateOnboardingStarterDraft({ showError: true })) {
            return;
        }
        const total = document.querySelectorAll('.onboarding-step').length;
        if (this.onboardingStep < total - 1) {
            // Ao sair do passo 1, garantir que panel-a esteja visível para retorno
            if (this.onboardingStep === 1) {
                const panelA = document.getElementById('step-1-panel-a');
                const panelB = document.getElementById('step-1-panel-b');
                if (panelA && panelB) {
                    panelA.classList.remove('hidden');
                    panelA.classList.add('flex');
                    panelB.classList.add('hidden');
                    panelB.classList.remove('flex');
                }
            }
            this.onboardingGoTo(this.onboardingStep + 1);
        }
    },

onboardingBack: function() {
        if (this.onboardingStep > 0) {
            this.onboardingGoTo(this.onboardingStep - 1);
        }
    },

onboardingCreateAccount: async function() {
        this.onboardingSaveCurrentStep(false);
        const ok = await this.createAccountFromProfile();
        if (ok) this.onboardingNext();
    },

onboardingSignInAccount: async function() {
        this.onboardingSaveCurrentStep(false);
        // Se ja tem conta real autenticada, nao precisa logar novamente -
        // apenas avanca para o proximo step (evita loop de reload no onboarding).
        if (this.isRealAccount()) {
            this.showToast(`Voce ja esta logado como ${auth.currentUser?.email || 'usuario'}.`, 'success');
            this.onboardingNext();
            return;
        }
        await this.signInFromProfile();
    },

onboardingContinueLocal: async function() {
        this.onboardingSaveCurrentStep(false);
        try {
            this.teardownRealtimeSync();
            this.setSignedOutIntentionally(true);
            if (auth.currentUser) await signOut(auth);
            this.resetInitialAuthState(null);
            this.persistLocalMirror(LOCAL_USER_SCOPE);
        } catch (error) {
            console.warn('[AUTH] Falha ao alternar onboarding para modo local:', error);
            try { this.persistLocalMirror(LOCAL_USER_SCOPE); } catch (_) {}
        }
        this.updateSyncBadge('offline');
        this.showToast('Modo local ativado. Voce pode criar uma conta depois em Perfil.', 'success');
        this.onboardingNext();
    },

onboardingComplete: function() {
        this.onboardingSaveCurrentStep(false);
        this.ensureOnboardingStarterSetup();
        window.sistemaVidaState.onboardingComplete = true;
        this.setForceOnboardingAfterReset?.(false);
        this.saveState();
        this.navigate('hoje');
        setTimeout(() => {
            this.showToast('Onboarding concluido. Manual e Flow ficam sempre no cabecalho/perfil.', 'success');
        }, 400);
    },

onboardingUpdateSlider: function(dim, val) {
        const aliases = {
            Saude: 'Saúde',
            Financas: 'Finanças',
            Familia: 'Família',
            Proposito: 'Propósito'
        };
        const canonicalDim = aliases[dim] || dim;
        if (window.sistemaVidaState.dimensions[canonicalDim]) {
            window.sistemaVidaState.dimensions[canonicalDim].score = parseInt(val);
            const valEl = document.getElementById(`slider-val-${dim}`) || document.getElementById(`slider-val-${canonicalDim}`);
            if (valEl) valEl.textContent = val;
        }
    },

onboardingToggleValor: function(btn) {
        const valor = btn.getAttribute('data-valor');
        const state = window.sistemaVidaState.profile;
        if (!state.values) state.values = [];
        
        const idx = state.values.indexOf(valor);
        if (idx > -1) {
            state.values.splice(idx, 1);
            btn.classList.remove('selected');
        } else {
            if (state.values.length < 5) {
                state.values.push(valor);
                btn.classList.add('selected');
            } else {
                this.showNotification("Selecione até 5 valores principais.");
            }
        }
        
        // Atualiza preview interativo no UI
        const previewEl = document.getElementById('onboarding-valores-preview');
        if (previewEl) {
            previewEl.textContent = state.values.length > 0 ? state.values.join(' • ') : "Selecione seus valores...";
        }
    },
    });
}
