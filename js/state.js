import { auth, db, getDoc, setDoc, deleteDoc, getDocs, collection } from './firebase.js';

export function attachStateModule(app) {
    Object.assign(app, {
normalizeEntitiesState: function() {
        const state = window.sistemaVidaState;
        if (!state.entities || typeof state.entities !== 'object') {
            state.entities = { metas: [], okrs: [], macros: [], micros: [] };
            return;
        }
        ['metas', 'okrs', 'macros', 'micros'].forEach((type) => {
            if (!Array.isArray(state.entities[type])) state.entities[type] = [];
        });
        const clampProgress = (raw) => {
            const n = Number(raw);
            if (!Number.isFinite(n)) return 0;
            return Math.max(0, Math.min(100, Math.round(n)));
        };
        // Para micros: progress 100 OU completed implica done (binário/atômico).
        // Para macro/okr/meta: done depende EXCLUSIVAMENTE de decisão explícita do usuário.
        // Ter 100% de progresso significa "pronto para fechar", não "fechado automaticamente".
        const normalizedStatus = (rawStatus, progress, completedRaw = false, isAtomic = false) => {
            if (rawStatus === 'done') return 'done';
            if (isAtomic && (completedRaw || progress >= 100)) return 'done';
            if (rawStatus === 'abandoned') return 'abandoned';
            if (rawStatus === 'in_progress' || rawStatus === 'active') return 'in_progress';
            return 'pending';
        };
        const clampLevel = (raw) => {
            const n = Number(raw);
            if (!Number.isFinite(n)) return 3;
            return Math.max(1, Math.min(5, Math.round(n)));
        };

        state.entities.metas = state.entities.metas.map((meta) => {
            const progress = clampProgress(meta?.progress);
            const status = normalizedStatus(meta?.status, progress, meta?.completed, false);
            return {
                ...meta,
                id: String(meta?.id || ''),
                title: String(meta?.title || '').trim(),
                dimension: String(meta?.dimension || ''),
                progress: status === 'done' ? 100 : progress,
                status,
                completed: status === 'done',
                successCriteria: String(meta?.successCriteria || ''),
                challengeLevel: clampLevel(meta?.challengeLevel),
                commitmentLevel: clampLevel(meta?.commitmentLevel)
            };
        }).filter((meta) => meta.id && meta.title);

        state.entities.okrs = state.entities.okrs.map((okr) => {
            const keyResults = this.normalizeKeyResultsList(okr?.keyResults);
            let progress = clampProgress(okr?.progress);
            if (!Number.isFinite(Number(okr?.progress)) && keyResults.length) {
                const krProgress = this.computeKeyResultsProgress(keyResults);
                progress = krProgress === null ? 0 : krProgress;
            }
            const status = normalizedStatus(okr?.status, progress, okr?.completed, false);
            return {
                ...okr,
                id: String(okr?.id || ''),
                title: String(okr?.title || '').trim(),
                dimension: String(okr?.dimension || ''),
                progress: status === 'done' ? 100 : progress,
                status,
                completed: status === 'done',
                successCriteria: String(okr?.successCriteria || ''),
                challengeLevel: clampLevel(okr?.challengeLevel),
                commitmentLevel: clampLevel(okr?.commitmentLevel),
                keyResults
            };
        }).filter((okr) => okr.id && okr.title);

        state.entities.macros = state.entities.macros.map((macro) => {
            const progress = clampProgress(macro?.progress);
            const status = normalizedStatus(macro?.status, progress, macro?.completed, false);
            return {
                ...macro,
                id: String(macro?.id || ''),
                title: String(macro?.title || '').trim(),
                dimension: String(macro?.dimension || ''),
                progress: status === 'done' ? 100 : progress,
                status,
                completed: status === 'done'
            };
        }).filter((macro) => macro.id && macro.title);

        const beforeCount = state.entities.micros.length;
        state.entities.micros = state.entities.micros.map((micro) => {
            const progress = clampProgress(micro?.progress);
            const status = normalizedStatus(micro?.status, progress, micro?.completed, true);
            return {
                ...micro,
                id: String(micro?.id || ''),
                title: String(micro?.title || micro?.nome || micro?.name || micro?.tarefa || '').trim(),
                dimension: String(micro?.dimension || micro?.dimensao || micro?.area || ''),
                protocolId: String(micro?.protocolId || ''),
                sourceHabitId: String(micro?.sourceHabitId || ''),
                sourceProtocolId: String(micro?.sourceProtocolId || ''),
                steps: Array.isArray(micro?.steps) ? micro.steps.map(step => String(step || '').trim()).filter(Boolean) : [],
                stepLogs: (micro?.stepLogs && typeof micro.stepLogs === 'object' && !Array.isArray(micro.stepLogs)) ? micro.stepLogs : {},
                progress: status === 'done' ? 100 : progress,
                status,
                completed: status === 'done',
                effort: this.getMicroEffort(micro)
            };
        }).filter((micro) => {
            const keep = micro.id && micro.title;
            if (!keep) console.warn('[normalizeEntitiesState] Micro removed - missing id or title:', micro);
            return keep;
        });
        if (beforeCount !== state.entities.micros.length) {
            console.log(`[normalizeEntitiesState] Micros filtered: ${beforeCount} → ${state.entities.micros.length}`);
        }

        // Orfanizacao: pais com status in_progress mas sem filhos ativos voltam para pending.
        // Reproduz a logica do updateCascadeProgress no momento do load para corrigir
        // estados legados (ex.: macro marcada in_progress antes do refator de cascata).
        const hasActiveChild = (children) => children.some((c) => c.status === 'in_progress' || c.status === 'done');
        state.entities.macros.forEach((macro) => {
            if (macro.status === 'done') return;
            const microsOfMacro = state.entities.micros.filter((m) => m.macroId === macro.id);
            if (microsOfMacro.length === 0 || !hasActiveChild(microsOfMacro)) {
                if (macro.status === 'in_progress') macro.status = 'pending';
                if (microsOfMacro.length === 0) {
                    macro.progress = 0;
                    macro.completed = false;
                }
            }
        });
        state.entities.okrs.forEach((okr) => {
            if (okr.status === 'done') return;
            const macrosOfOkr = state.entities.macros.filter((m) => m.okrId === okr.id);
            if (macrosOfOkr.length === 0 || !hasActiveChild(macrosOfOkr)) {
                if (okr.status === 'in_progress') okr.status = 'pending';
            }
        });
        state.entities.metas.forEach((meta) => {
            if (meta.status === 'done') return;
            const okrsOfMeta = state.entities.okrs.filter((o) => o.metaId === meta.id);
            if (okrsOfMeta.length === 0 || !hasActiveChild(okrsOfMeta)) {
                if (meta.status === 'in_progress') meta.status = 'pending';
            }
        });
    },

ensureSettingsState: function() {
        this.migrateStateSchema();
        if (!window.sistemaVidaState.settings) {
            window.sistemaVidaState.settings = { notificationsEnabled: false, theme: 'auto' };
        }
        if (!window.sistemaVidaState.settings.features || typeof window.sistemaVidaState.settings.features !== 'object') {
            window.sistemaVidaState.settings.features = {};
        }
        if (typeof window.sistemaVidaState.settings.features.social !== 'boolean') {
            window.sistemaVidaState.settings.features.social = false;
        }
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        if (typeof window.sistemaVidaState.settings.notificationsEnabled !== 'boolean') {
            window.sistemaVidaState.settings.notificationsEnabled = false;
        }
        if (!window.sistemaVidaState.settings.theme) {
            window.sistemaVidaState.settings.theme = 'auto';
        }
        if (typeof window.sistemaVidaState.settings.splashEnabled !== 'boolean') {
            window.sistemaVidaState.settings.splashEnabled = true;
        }
        if (!['daily', 'twice_daily', 'always'].includes(window.sistemaVidaState.settings.splashMode)) {
            window.sistemaVidaState.settings.splashMode = 'daily';
        }
        const splashDuration = Number(window.sistemaVidaState.settings.splashDurationSec);
        if (!Number.isFinite(splashDuration) || splashDuration < 1 || splashDuration > 20) {
            window.sistemaVidaState.settings.splashDurationSec = 3;
        } else {
            window.sistemaVidaState.settings.splashDurationSec = Math.round(splashDuration);
        }
        if (typeof window.sistemaVidaState.settings.soundEnabled !== 'boolean') {
            window.sistemaVidaState.settings.soundEnabled = false;
        }
        if (!window.sistemaVidaState.settings.dayCapacityProfile || typeof window.sistemaVidaState.settings.dayCapacityProfile !== 'object') {
            window.sistemaVidaState.settings.dayCapacityProfile = {};
        }
        const dayCapacityProfile = window.sistemaVidaState.settings.dayCapacityProfile;
        const sanitizeHours = (value, fallback, min, max, step = 0.5) => {
            const num = Number(value);
            if (!Number.isFinite(num)) return fallback;
            const clamped = Math.max(min, Math.min(max, num));
            return Math.round(clamped / step) * step;
        };
        const sanitizeMinutes = (value, fallback, min, max, step = 15) => {
            const num = Number(value);
            if (!Number.isFinite(num)) return fallback;
            const clamped = Math.max(min, Math.min(max, num));
            return Math.round(clamped / step) * step;
        };
        dayCapacityProfile.sleepHours = sanitizeHours(dayCapacityProfile.sleepHours, 8, 4, 12, 0.5);
        dayCapacityProfile.fixedCommitmentsMinutes = sanitizeMinutes(dayCapacityProfile.fixedCommitmentsMinutes, 8 * 60, 0, 16 * 60);
        dayCapacityProfile.dailyBasicsMinutes = sanitizeMinutes(dayCapacityProfile.dailyBasicsMinutes, 2 * 60, 30, 8 * 60);
        dayCapacityProfile.bufferMinutes = sanitizeMinutes(dayCapacityProfile.bufferMinutes, 60, 0, 4 * 60);
        if (!['classic', 'ring'].includes(window.sistemaVidaState.settings.deepWorkClockStyle)) {
            window.sistemaVidaState.settings.deepWorkClockStyle = 'classic';
        }
        if (typeof window.sistemaVidaState.profile.avatarUrl !== 'string') {
            window.sistemaVidaState.profile.avatarUrl = '';
        }
        if (!Array.isArray(window.sistemaVidaState.profile.values)) {
            window.sistemaVidaState.profile.values = [];
        }
        this.ensureIdentityState();
        this.ensureDailyCheckinState();
        this.ensureCadenceState();
        this.ensureNotesState();
        if (typeof this.ensureProtocolsState === 'function') this.ensureProtocolsState();
        this.ensureHabitMaturityState();
        if (this.ensureSocialState) this.ensureSocialState();
        if (!window.sistemaVidaState.profile.ikigai || typeof window.sistemaVidaState.profile.ikigai !== 'object') {
            window.sistemaVidaState.profile.ikigai = {};
        }
        const ikigaiDefaults = {
            missao: '',
            vocacao: '',
            paixao: '',
            profissao: '',
            love: '',
            good: '',
            need: '',
            paid: '',
            sintese: '',
            sinteseResumo: ''
        };
        Object.keys(ikigaiDefaults).forEach((key) => {
            if (typeof window.sistemaVidaState.profile.ikigai[key] !== 'string') {
                window.sistemaVidaState.profile.ikigai[key] = ikigaiDefaults[key];
            }
        });
        if (!window.sistemaVidaState.profile.legacyObj || typeof window.sistemaVidaState.profile.legacyObj !== 'object') {
            window.sistemaVidaState.profile.legacyObj = {};
        }
        const legacyDefaults = {
            familia: '',
            profissao: '',
            mundo: '',
            familiaResumo: '',
            profissaoResumo: '',
            mundoResumo: ''
        };
        Object.keys(legacyDefaults).forEach((key) => {
            if (typeof window.sistemaVidaState.profile.legacyObj[key] !== 'string') {
                window.sistemaVidaState.profile.legacyObj[key] = legacyDefaults[key];
            }
        });
        if (!window.sistemaVidaState.profile.odysseyImages) {
            window.sistemaVidaState.profile.odysseyImages = { cenarioA: "", cenarioB: "", cenarioC: "" };
        }
        if (!window.sistemaVidaState.profile.odysseyTitles || typeof window.sistemaVidaState.profile.odysseyTitles !== 'object') {
            window.sistemaVidaState.profile.odysseyTitles = {
                cenarioA: "Cenário A",
                cenarioB: "Cenário B",
                cenarioC: "Cenário C"
            };
        }
        if (typeof window.sistemaVidaState.settings.odysseySplashFilter !== 'string') {
            window.sistemaVidaState.settings.odysseySplashFilter = 'all';
        }
        if (!['all', 'cenarioA', 'cenarioB', 'cenarioC'].includes(window.sistemaVidaState.settings.odysseySplashFilter)) {
            window.sistemaVidaState.settings.odysseySplashFilter = 'all';
        }
        const odysseySplashDuration = Number(window.sistemaVidaState.settings.odysseySplashDurationSec);
        if (!Number.isFinite(odysseySplashDuration) || odysseySplashDuration < 1 || odysseySplashDuration > 20) {
            window.sistemaVidaState.settings.odysseySplashDurationSec = 3;
        } else {
            window.sistemaVidaState.settings.odysseySplashDurationSec = Math.round(odysseySplashDuration);
        }
        if (!window.sistemaVidaState.perma) {
            window.sistemaVidaState.perma = { P: 0, E: 0, R: 0, M: 0, A: 0 };
        }
        if (!window.sistemaVidaState.swls) {
            window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
        }
        if (!window.sistemaVidaState.wellbeingHistory || typeof window.sistemaVidaState.wellbeingHistory !== 'object') {
            window.sistemaVidaState.wellbeingHistory = { wheel: {}, perma: {}, odyssey: {} };
        }
        if (!window.sistemaVidaState.wellbeingHistory.wheel || typeof window.sistemaVidaState.wellbeingHistory.wheel !== 'object') {
            window.sistemaVidaState.wellbeingHistory.wheel = {};
        }
        if (!window.sistemaVidaState.wellbeingHistory.perma || typeof window.sistemaVidaState.wellbeingHistory.perma !== 'object') {
            window.sistemaVidaState.wellbeingHistory.perma = {};
        }
        if (!window.sistemaVidaState.wellbeingHistory.odyssey || typeof window.sistemaVidaState.wellbeingHistory.odyssey !== 'object') {
            window.sistemaVidaState.wellbeingHistory.odyssey = {};
        }
        if (!window.sistemaVidaState.deepWork) {
            window.sistemaVidaState.deepWork = {
                isRunning: false, isPaused: false, mode: 'focus',
                remainingSec: 1500, targetSec: 1500, breakSec: 300,
                microId: '', intention: '', lastTickAt: 0, deadlineAtMs: 0, sessions: []
            };
        }
        if (typeof window.sistemaVidaState.onboardingComplete !== 'boolean') {
            window.sistemaVidaState.onboardingComplete = false;
        }
        try {
            const cachedTheme = this.localGet('lifeos_theme_pref');
            if (cachedTheme && ['light', 'dark', 'auto'].includes(cachedTheme)) {
                window.sistemaVidaState.settings.theme = cachedTheme;
            }
            const cachedNotif = this.localGet('lifeos_notif_enabled');
            if (cachedNotif === '1' || cachedNotif === '0') {
                window.sistemaVidaState.settings.notificationsEnabled = cachedNotif === '1';
            }
            if (!window.sistemaVidaState.profile.avatarUrl) {
                const cached = this.localGet('lifeos_profile_avatar') || '';
                if (cached) window.sistemaVidaState.profile.avatarUrl = cached;
            }
            const cachedOdyssey = this.localGet('lifeos_odyssey_images');
            if (cachedOdyssey) {
                const parsed = JSON.parse(cachedOdyssey);
                window.sistemaVidaState.profile.odysseyImages = {
                    ...window.sistemaVidaState.profile.odysseyImages,
                    ...parsed
                };
            }
            const onboardingFlag = this.localGet('lifeos_onboarding_complete');
            if (onboardingFlag === '1') window.sistemaVidaState.onboardingComplete = true;
            if (onboardingFlag === '0' && window.sistemaVidaState.onboardingComplete !== true) {
                window.sistemaVidaState.onboardingComplete = false;
            }
        } catch (_) {}
        this.reconcileOnboardingCompletion?.();
        this.normalizePermaState();
        this.normalizeEntitiesState();
        this.normalizeSwlsState();
        this.normalizeDailyLogsState();
        this.normalizeDeepWorkState();
        this.ensureCadenceState();
        this.ensureGamificationState();
        this.syncIdentityLinkedHabits();
    },

loadState: async function() {
        let cloudData = null;
        let localData = null;
        let shouldSeedCloudAfterLoad = false;
        let cloudLoadFailed = false;
        let localOnlyLoad = false;
        let forceCloudLoad = false;
        try {
            try {
                await this.withTimeout(this.getAuthReady({ allowAnonymous: false }), 8000, 'auth_ready');
            } catch (authError) {
                const authGateCode = this.getAuthGateCode ? this.getAuthGateCode(authError) : '';
                if (authGateCode) {
                    console.log('[SYNC] Sessão sem auth de nuvem; carregando sem criar visitante.', authGateCode);
                    this.updateSyncBadge('offline');
                    localOnlyLoad = true;
                } else {
                    throw authError;
                }
            }
            const activeUserId = this.getActiveUserId();
            forceCloudLoad = !localOnlyLoad && this.isRealAccount(auth.currentUser) && this.shouldForceCloudLoadForUser(activeUserId);
            const rawLocal = this.localGet('lifeos_state_backup');
            const rawCore = this.localGet('lifeos_state_backup_core');
            if (!forceCloudLoad) {
                if (rawLocal) {
                    try { localData = JSON.parse(rawLocal); } catch (_) { localData = null; }
                } else if (rawCore) {
                    try { localData = JSON.parse(rawCore); } catch (_) { localData = null; }
                }
            } else {
                console.log('[SYNC] Login recente detectado; ignorando backup local e usando nuvem como fonte.');
            }
            if (!localOnlyLoad) {
                const stateRef = this.getStateDocRef(activeUserId);
                const docSnap = await this.withTimeout(getDoc(stateRef), 10000, 'firestore_getDoc');

                if (docSnap.exists()) {
                    console.log("Estado encontrado na Nuvem, mesclando dados...");
                    cloudData = docSnap.data();
                    if (forceCloudLoad) this.clearForceCloudLoadForUser(activeUserId);
                } else {
                    console.log("Primeiro acesso deste usuário. Documento será criado após normalização.");
                    shouldSeedCloudAfterLoad = !forceCloudLoad;
                    if (forceCloudLoad) {
                        this.showToast('Conta autenticada, mas ainda não encontrei dados salvos na nuvem. Evitei misturar dados locais.', 'error');
                    }
                }
            }
        } catch (error) {
            cloudLoadFailed = true;
            this.lastCloudSyncOk = false;
            this.lastCloudSyncErrorCode = String(error?.code || error?.message || '').trim();
            this.updateSyncBadge('error');
            console.error("Erro ao carregar o estado do Firestore:", error);
        }

        const localHasPending = !!(localData && localData._pendingLocalChanges);
        const localTs = Number(localData?._lastUpdatedAt || 0);
        const cloudTs = Number(cloudData?._lastUpdatedAt || 0);
        const forceOnboardingReset = this.isForceOnboardingAfterReset?.() === true;
        const shouldKeepLocal = !!localData && (
            !cloudData ||
            (localHasPending && localTs >= cloudTs) ||
            forceOnboardingReset
        );
        let preferred = cloudData || localData;
        if (shouldKeepLocal) preferred = localData;

        const cloudTsStr = cloudData ? new Date(Number(cloudData._lastUpdatedAt||0)).toISOString() : 'n/a';
        const localTsStr = localData ? new Date(Number(localData._lastUpdatedAt||0)).toISOString() : 'n/a';
        console.log('[SYNC] cloudTs=' + cloudTsStr + '  localTs=' + localTsStr + '  localHasPending=' + localHasPending + '  shouldKeepLocal=' + shouldKeepLocal);
        if (shouldKeepLocal && cloudData && localHasPending) console.log('[SYNC] Keeping local pending state because it is newer/equal to cloud. Will retry cloud sync.');
        else if (shouldKeepLocal && !cloudData) console.warn('[SYNC] Firestore unavailable — using local backup.');
        else if (localHasPending && cloudData) console.warn('[SYNC] Local pending state is older than cloud — applying cloud source of truth.');
        else if (localOnlyLoad) console.log('[SYNC] Using local guest state.');
        else if (!cloudData) console.warn('[SYNC] Firestore unavailable — using local backup.');
        else console.log('[SYNC] Using cloud state (source of truth).');

        if (preferred) window.sistemaVidaState = this.mergeDeep(window.sistemaVidaState, preferred);
        if (forceOnboardingReset) this.applyForcedOnboardingResetState?.();
        if (forceCloudLoad && cloudData) {
            if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
            window.sistemaVidaState.profile.avatarUrl = '';
            window.sistemaVidaState.profile.odysseyImages = this.getEmptyOdysseyImages();
        }
        if (cloudLoadFailed && !preferred && this.showToast) {
            this.showToast('Não consegui carregar seus dados da nuvem agora. Evitei sobrescrever a conta; tente recarregar em instantes.', 'error');
        }
        try {
            const dailyBackup = JSON.parse(this.localGet('lifeos_daily_checkins_backup') || 'null');
            if (Array.isArray(dailyBackup) && dailyBackup.length) {
                const today = this.getLocalDateKey();
                const todayBackupEntry = dailyBackup.find(entry => entry?.date === today);
                if (todayBackupEntry) {
                    if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                    const checkins = window.sistemaVidaState.profile.dailyCheckins || [];
                    const hasCloudToday = checkins.some(e => e.date === today);
                    // Only restore today's entry if cloud doesn't have it (prevents overwriting future syncs)
                    if (!hasCloudToday) {
                        checkins.unshift(todayBackupEntry);
                        window.sistemaVidaState.profile.dailyCheckins = checkins.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 180);
                    } else {
                        // Cloud has today but might be missing emotion — use backup if backup has more data
                        const cloudToday = checkins.find(e => e.date === today);
                        if (!cloudToday.emotion && todayBackupEntry.emotion) {
                            Object.assign(cloudToday, todayBackupEntry);
                        }
                    }
                }
            }
        } catch (_) {}
        if (!shouldKeepLocal && window.sistemaVidaState._pendingLocalChanges) {
            window.sistemaVidaState._pendingLocalChanges = false;
        }
        // Load images from dedicated Firestore document (Firestore-native image storage)
        if (!localOnlyLoad) try {
            const activeUserId = this.getActiveUserId();
            const imagesRef = this.getImagesDocRef(activeUserId);
            let imagesSnap = await this.withTimeout(getDoc(imagesRef), 8000, 'firestore_getImages');
            if (imagesSnap.exists()) {
                const imgData = imagesSnap.data();
                this.applyRemoteImagesDoc(imgData, { replace: this.isRealAccount() || forceCloudLoad });
                console.log('[Images] Imagens carregadas do Firestore.');
            } else if (this.isRealAccount()) {
                this.applyRemoteImagesDoc({}, { replace: true });
            }
        } catch (imgErr) {
            // Fallback to local cache if Firestore images doc unavailable
            if (!forceCloudLoad) try {
                const cachedAvatar = this.localGet('lifeos_profile_avatar');
                if (cachedAvatar && !window.sistemaVidaState.profile?.avatarUrl) {
                    if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                    window.sistemaVidaState.profile.avatarUrl = cachedAvatar;
                }
                const cachedOdyssey = this.localGet('lifeos_odyssey_images');
                if (cachedOdyssey) {
                    const parsed = JSON.parse(cachedOdyssey);
                    if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                    const current = window.sistemaVidaState.profile.odysseyImages || {};
                    Object.keys(parsed || {}).forEach((key) => { if (!current[key]) current[key] = parsed[key]; });
                    window.sistemaVidaState.profile.odysseyImages = current;
                }
            } catch (_) {}
            console.warn('[Images] Falha ao carregar imagens do Firestore:', imgErr);
        }
        this.persistLocalMirror();
        this.ensureSettingsState();
        this.reconcileOnboardingCompletion?.();
        this.normalizePermaState();
        this.normalizeDimensionsState();
        this.normalizeEntitiesState();
        this.normalizeSwlsState();
        this.normalizeDailyLogsState();
        this.normalizeDeepWorkState();
        this.renderSidebarValues();
        if (shouldSeedCloudAfterLoad) {
            window.sistemaVidaState._pendingLocalChanges = true;
        }
        if (window.sistemaVidaState._pendingLocalChanges || shouldSeedCloudAfterLoad) {
            this.saveState(true).catch((err) => {
                console.warn('[SYNC] Retry cloud sync after load failed:', err);
            });
        }
    },

saveState: function(silent = true) {
        const state = window.sistemaVidaState;
        state._lastUpdatedAt = this.getSafeMonotonicTs();
        state._pendingLocalChanges = true;
        state._lastLocalEditAt = Date.now();
        this.lastCloudSyncOk = null;
        this.lastCloudSyncErrorCode = '';

        // Durabilidade imediata no dispositivo para não perder progresso em refresh/reload.
        const fullSnapshot = this.getPersistableState('full');
        const coreSnapshot = this.getPersistableState('core');
        try {
            this.localSet('lifeos_state_backup', JSON.stringify(fullSnapshot));
        } catch (backupErr) {
            console.warn('Falha ao gravar backup local do estado:', backupErr);
            try {
                this.localSet('lifeos_state_backup_core', JSON.stringify(coreSnapshot));
            } catch (_) {}
        }
        this.persistLocalMirror();

        if (!this._saveChain) this._saveChain = Promise.resolve();
        const enqueueTs = Number(state._lastUpdatedAt || 0);
        const runSave = async () => {
            this._isSaving = true;
            this.updateSyncBadge('syncing');
            try {
                try {
                    await this.withTimeout(this.getAuthReady({ allowAnonymous: false }), 8000, 'auth_ready');
                } catch (authError) {
                    const authGateCode = this.getAuthGateCode ? this.getAuthGateCode(authError) : '';
                    if (authGateCode) {
                        console.log('[SYNC] Auth indisponível agora; mantendo dados apenas localmente.', authGateCode);
                        this.lastCloudSyncOk = null;
                        this.lastCloudSyncErrorCode = authGateCode;
                        this.updateSyncBadge('offline');
                        return;
                    }
                    throw authError;
                }
                try {
                    const imagesChanged = await this.withTimeout(
                        this.syncImagesToFirestoreDoc(), 15000, 'sync_images'
                    );
                    if (imagesChanged) this.persistLocalMirror();
                } catch (imageError) {
                    console.warn('Falha ao sincronizar imagens com Firestore (ignorado):', imageError);
                }
                const stateRef = this.getStateDocRef();
                const cloudSnapshot = this.getPersistableState('cloud');
                const cloudTs = Number(window.sistemaVidaState?._lastUpdatedAt || enqueueTs || this.getSafeMonotonicTs());
                cloudSnapshot._lastUpdatedAt = cloudTs;
                cloudSnapshot._pendingLocalChanges = false;
                await this.withTimeout(setDoc(stateRef, cloudSnapshot, { merge: true }), 10000, 'firestore_setDoc');
                if (this.syncSocialPublicProfileIfNeeded) {
                    try {
                        await this.syncSocialPublicProfileIfNeeded();
                    } catch (socialErr) {
                        console.warn('[SOCIAL] Falha ao atualizar perfil publico apos save:', socialErr);
                    }
                }
                console.log("Sincronização com Nuvem: Concluída.");
                this.lastCloudSyncOk = true;
                this.updateSyncBadge('ok');
                const currentTs = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
                window.sistemaVidaState._pendingLocalChanges = currentTs > cloudTs;
                this.persistLocalMirror();
                if (!silent && this.showToast) this.showToast('Progresso guardado na nuvem! ✨', 'success');
            } catch (error) {
                console.error("Erro ao salvar o estado no Firestore:", error);
                this.lastCloudSyncOk = false;
                this.lastCloudSyncErrorCode = String(error?.code || error?.message || '').trim();
                this.updateSyncBadge('error');
                // Mostra toast na primeira falha da sessão (independente de silent)
                if (!this._shownSyncError && this.showToast) {
                    this._shownSyncError = true;
                    const reason = this.lastCloudSyncErrorCode ? ' (' + this.lastCloudSyncErrorCode + ')' : '';
                    this.showToast('Sem sincronização com a nuvem' + reason + '. Dados salvos localmente.', 'error');
                } else if (!silent && this.showToast) {
                    this.showToast('Salvo localmente. Falha na sincronização com nuvem.', 'error');
                }
            } finally {
                this._isSaving = false;
            }
        };
        const op = this._saveChain.then(runSave, runSave);
        this._saveChain = op.catch(() => {});
        return op;
    },

factoryReset: async function() {
      const firstConfirm = window.confirm(
        'ATENÇÃO EXTREMA: apagar TODOS os seus dados salvos na nuvem — Metas, OKRs, Diários, Roda da Vida. Essa ação NÃO pode ser desfeita. Tem certeza absoluta?'
      );
      if (!firstConfirm) return;
    
      const secondInput = window.prompt(
        'Para confirmar a exclusão total, digite a palavra ZERAR'
      );
      if (secondInput !== 'ZERAR') {
        alert('Reset cancelado. Seus dados estão seguros.');
        return;
      }
    
      // Pergunta o modo de reinício
      const useMockup = window.confirm(
        'Como deseja reiniciar?\n\nOK → Carregar dados de exemplo (recomendado para explorar o app)\nCancelar → Começar completamente do zero (Onboarding)'
      );
      const previousSocialState = window.sistemaVidaState?.profile?.social || {};
      const previousInviteCode = String(previousSocialState?.invites?.lastCode || '').trim().toUpperCase();
    
      // ── Estado base virgem ──────────────────────────────────────────────────
      const baseState = {
        stateSchemaVersion: this.getCurrentStateSchemaVersion ? this.getCurrentStateSchemaVersion() : 2,
        profile: {
          name: '', level: 1, xp: 0, values: [],
          ikigai: { missao: '', vocacao: '', paixao: '', profissao: '', love: '', good: '', need: '', paid: '', sintese: '', sinteseResumo: '' },
          legacyObj: { familia: '', profissao: '', mundo: '', familiaResumo: '', profissaoResumo: '', mundoResumo: '' },
          vision: { saude: '', carreira: '', intelecto: '', quote: '', saudeResumo: '', carreiraResumo: '', intelectoResumo: '' },
          odyssey: { cenarioA: '', cenarioB: '', cenarioC: '' },
          odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' },
          identity: { strengths: [], shadows: [] },
          onboardingStarter: { dimension: 'Carreira', goalTitle: '', habitTitle: '', habitTime: '', strength: '', shadow: '' },
          dailyCheckins: [],
          cadence: {
            shutdown: {},
            cycleReview: {}
          },
          notes: []
        },
        energy: 5,
        dimensions: {
          'Saúde': { score: 1 }, 'Mente': { score: 1 }, 'Carreira': { score: 1 },
          'Finanças': { score: 1 }, 'Relacionamentos': { score: 1 },
          'Família': { score: 1 }, 'Lazer': { score: 1 }, 'Propósito': { score: 1 }
        },
        perma: { P: 5, E: 5, R: 5, M: 5, A: 5 },
        swls: { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} },
        wellbeingHistory: { wheel: {}, perma: {}, odyssey: {} },
        deepWork: {
          isRunning: false, isPaused: false, mode: 'focus',
          remainingSec: 1500, targetSec: 1500, breakSec: 300,
          microId: '', intention: '', lastTickAt: 0, deadlineAtMs: 0, sessions: []
        },
        entities: { metas: [], okrs: [], macros: [], micros: [] },
        dailyLogs: {},
        habits: [],
        reviews: {},
        weekPlans: {},
        gamification: {
          totalXp: 0,
          dimensionXp: {},
          achievements: [],
          events: {},
          recentEvents: []
        },
        settings: {
          notificationsEnabled: false,
          theme: 'auto',
          deepWorkClockStyle: 'classic',
          dayCapacityProfile: {
            sleepHours: 8,
            fixedCommitmentsMinutes: 8 * 60,
            dailyBasicsMinutes: 2 * 60,
            bufferMinutes: 60
          },
          features: { social: false }
        },
        onboardingComplete: false
      };
    
      // ── Dados de demonstração (injetados se useMockup = true) ───────────────
      const mockupOverrides = {
        onboardingComplete: true,
        profile: {
          name: 'Bruno',
          level: 3,
          xp: 420,
          values: ['Liberdade', 'Integridade', 'Curiosidade', 'Impacto Social', 'Família'],
          ikigai: {
            love: 'Criar sistemas que ajudam pessoas a viverem com mais intenção.',
            good: 'Desenvolvimento de software, pensamento sistêmico e design de produto.',
            need: 'Ferramentas práticas de autogestão e produtividade com propósito.',
            paid: 'Desenvolvimento de apps, consultoria de produto e software sob medida.',
            paixao: 'Criar e ensinar com profundidade, transformando ideias em algo vivo.',
            profissao: 'Construir produtos digitais e liderar decisões de produto orientadas por dados.',
            vocacao: 'Usar tecnologia para ampliar autonomia e clareza na vida das pessoas.',
            missao: 'Conectar propósito humano e execução prática para gerar transformação real.',
            sintese: 'Construir tecnologia que transforma rotinas em jornadas com sentido.'
          },
          legacyObj: {
            familia: 'Ser presença constante e inspiração de integridade para minha família.',
            profissao: 'Criar produtos que simplificam a vida de milhares de pessoas.',
            mundo: 'Contribuir para uma cultura de autoconhecimento e intencionalidade.'
          },
          vision: {
            saude: 'Energia alta e consistente. Treinar 4x por semana e dormir bem.',
            carreira: 'Liderar meu próprio produto com autonomia e impacto real.',
            intelecto: 'Aprender continuamente. Ler 1 livro por mês e criar com frequência.',
            quote: 'A disciplina é a ponte entre metas e realizações. — Jim Rohn'
          },
          identity: {
            strengths: [
              { id: 'strength-clareza', title: 'Clareza' },
              { id: 'strength-pensamento-analitico', title: 'Pensamento analítico' },
              { id: 'strength-responsabilidade', title: 'Responsabilidade' }
            ],
            shadows: [
              { id: 'shadow-sobrecarga', title: 'Sobrecarga' },
              { id: 'shadow-perfeccionismo', title: 'Perfeccionismo' }
            ]
          },
          dailyCheckins: [
            { date: '2026-04-24', sleepHours: 7, sleepQuality: 4, energy: 4, mood: 4, stress: 2, emotion: 'focado', savedAt: '2026-04-24T08:00:00.000Z' },
            { date: '2026-04-25', sleepHours: 6.5, sleepQuality: 3, energy: 3, mood: 3, stress: 3, emotion: 'neutro', savedAt: '2026-04-25T08:00:00.000Z' }
          ],
          cadence: {
            checkin: { lastAt: '2026-04-25' },
            diary: { lastAt: '2026-04-25' },
            weeklyPlan: { lastAt: '2026-04-20' },
            weeklyReview: { lastAt: '2026-04-19' },
            wheel: { lastAt: '2026-04-01' },
            perma: { lastAt: '2026-04-01' },
            swls: { lastAt: '2026-04-01' },
            odyssey: { lastAt: '2026-01-15' }
          }
        },
        dimensions: {
          'Saúde': { score: 7 }, 'Mente': { score: 8 }, 'Carreira': { score: 6 },
          'Finanças': { score: 5 }, 'Relacionamentos': { score: 8 },
          'Família': { score: 9 }, 'Lazer': { score: 4 }, 'Propósito': { score: 8 }
        },
        perma: { P: 7.2, E: 6.8, R: 8.5, M: 7.5, A: 6 },
        swls: {
          answers: [6, 5, 6, 5, 5],
          lastScore: 27,
          lastDate: '2026-04-01',
          history: {
            '2026-03-01': { score: 24, answers: [5, 4, 5, 5, 5] },
            '2026-04-01': { score: 27, answers: [6, 5, 6, 5, 5] }
          }
        },
        wellbeingHistory: {
          wheel: {
            '2026-03-01': { avg: 62 },
            '2026-04-01': { avg: 69 }
          },
          perma: {
            '2026-03-01': { avg: 6.5 },
            '2026-04-01': { avg: 7.2 }
          },
          odyssey: {}
        },
        deepWork: {
          isRunning: false, isPaused: false, mode: 'focus',
          remainingSec: 1500, targetSec: 1500, breakSec: 300,
          microId: '', intention: '', lastTickAt: 0, deadlineAtMs: 0,
          sessions: [
            { endedAt: '2026-04-06', focusSec: 3600, mode: 'focus', microId: 'mic2', intention: 'Remover hardcodes do painel' },
            { endedAt: '2026-04-08', focusSec: 5400, mode: 'focus', microId: 'mic3', intention: 'Refinar render do perfil' }
          ]
        },
        habits: [
          { id: 'h1', title: 'Meditação matinal', dimension: 'Mente', trigger: 'Após acordar e antes do café', completed: false, context: 'Clareza mental para o dia' },
          { id: 'h2', title: 'Treino físico', dimension: 'Saúde', trigger: 'Segunda, quarta e sexta às 7h', completed: false, context: 'Energia e disposição' },
          { id: 'h3', title: 'Leitura (30 min)', dimension: 'Mente', trigger: 'Antes de dormir', completed: false, context: 'Aprendizado contínuo' }
        ],
        entities: {
          metas: [
            { id: 'm1', title: 'Lançar o Sistema Vida para usuários reais', dimension: 'Carreira', purpose: 'Criar impacto real e validar o produto que estou construindo.', progress: 35, status: 'active', prazo: '2026-12-31' },
            { id: 'm2', title: 'Construir reserva de emergência de 6 meses', dimension: 'Finanças', purpose: 'Segurança financeira para tomar decisões com liberdade.', progress: 50, status: 'active', prazo: '2026-12-31' }
          ],
          okrs: [
            { id: 'o1', title: 'Ter o app funcional e testável até junho', dimension: 'Carreira', metaId: 'm1', progress: 40, status: 'active', prazo: '2026-06-30' },
            { id: 'o2', title: 'Aumentar renda mensal em 30%', dimension: 'Finanças', metaId: 'm2', progress: 20, status: 'active', prazo: '2026-06-30' }
          ],
          macros: [
            { id: 'mac1', title: 'Corrigir todos os bugs críticos do app', dimension: 'Carreira', okrId: 'o1', metaId: 'm1', description: 'App funcional sem erros bloqueantes', progress: 50, status: 'active', prazo: '2026-04-30' },
            { id: 'mac2', title: 'Implementar autenticação de usuários', dimension: 'Carreira', okrId: 'o1', metaId: 'm1', description: 'Login real com múltiplos perfis', progress: 0, status: 'active', prazo: '2026-05-31' },
            { id: 'mac3', title: 'Reduzir gastos fixos mensais', dimension: 'Finanças', okrId: 'o2', metaId: 'm2', description: 'Identificar e cortar despesas desnecessárias', progress: 30, status: 'active', prazo: '2026-04-30' }
          ],
          micros: [
            { id: 'mic1', title: 'Corrigir bug das tabs na tela Planos', dimension: 'Carreira', macroId: 'mac1', okrId: 'o1', metaId: 'm1', status: 'done', completed: true, progress: 100, prazo: '2026-04-07' },
            { id: 'mic2', title: 'Remover hardcodes do painel.html', dimension: 'Carreira', macroId: 'mac1', okrId: 'o1', metaId: 'm1', status: 'pending', completed: false, progress: 0, prazo: '2026-04-10' },
            { id: 'mic3', title: 'Implementar render.perfil com edição de nome', dimension: 'Carreira', macroId: 'mac1', okrId: 'o1', metaId: 'm1', status: 'pending', completed: false, progress: 0, prazo: '2026-04-14' },
            { id: 'mic4', title: 'Levantar todos os gastos fixos do mês', dimension: 'Finanças', macroId: 'mac3', okrId: 'o2', metaId: 'm2', status: 'pending', completed: false, progress: 0, prazo: '2026-04-15' }
          ]
        }
      };
    
      // ── Mescla estado base com mockups se escolhido ─────────────────────────
      const mergeDeep = (target, source) => {
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            mergeDeep(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
        return target;
      };
    
      window.sistemaVidaState = useMockup
        ? mergeDeep(baseState, mockupOverrides)
        : baseState;
      try { this.setForceOnboardingAfterReset?.(!useMockup); } catch (_) {}
      try { this.localSet('lifeos_onboarding_complete', useMockup ? '1' : '0'); } catch (_) {}
    
      let cloudResetOk = false;
      let cloudResetError = null;
      try {
        // ── Apaga imagens do Firestore ──────────────────────────────────────────
        try {
          const imagesRef = this.getImagesDocRef();
          await this.withTimeout(
            setDoc(imagesRef, { avatarUrl: '', odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' } }),
            8000, 'firestore_clearImages'
          );
        } catch (imgErr) {
          console.warn('[Reset] Falha ao limpar imagens do Firestore (ignorado):', imgErr);
        }
        // ── Apaga imagens do localStorage ──────────────────────────────────────
        this.localRemove('lifeos_profile_avatar');
        this.localRemove('lifeos_odyssey_images');
        // ── Apaga backups locais para evitar que estado antigo sobreponha o reset ─
        this.localRemove('lifeos_state_backup');
        this.localRemove('lifeos_state_backup_core');
        this.localRemove('lifeos_daily_checkins_backup');
        this.localRemove('lifeos_notes_backup');
        this.localRemove('lifeos_habit_reminders_sent');
        this.localRemove('lifeos_open_nudges_log');
        this.localRemove('lifeos_splash_log');
        this.localRemove('lifeos_last_splash');
        this.localRemove('lifeos_odyssey_splash_log');
        this.localRemove('lifeos_odyssey_splash_last');
        this.localRemove('lifeos_theme_pref');
        this.localRemove('lifeos_notif_enabled');
        this.localRemove('lifeos_state_version');
        // ── Se for reset total (sem mockup), força onboarding na próxima carga ─
        if (!useMockup) {
          try { this.localSet('lifeos_onboarding_complete', '0'); } catch (_) {}
        }
        // ── Desliga listeners em tempo real ──
        try { if (this._realtimeSyncUnsub) { this._realtimeSyncUnsub(); this._realtimeSyncUnsub = null; } } catch (_) {}
        try { if (this._imagesSyncUnsub) { this._imagesSyncUnsub(); this._imagesSyncUnsub = null; } } catch (_) {}
        // ── Grava o novo estado SEM merge ──
        await this.getAuthReady({ allowAnonymous: false });
        const resetUserId = this.getActiveUserId();
        try {
          window.sistemaVidaState._pendingLocalChanges = !useMockup;
          window.sistemaVidaState._lastUpdatedAt = this.getSafeMonotonicTs ? this.getSafeMonotonicTs() : Date.now();
          this.persistLocalMirror(resetUserId);
        } catch (_) {}
        const isCloudUser = !!(resetUserId && resetUserId !== 'guest' && !auth.currentUser?.isAnonymous);
        if (isCloudUser) {
          try {
            // Limpeza de documentos sociais do próprio usuário
            const cleanupRefs = [
              this.getSocialPublicProfileDocRef ? this.getSocialPublicProfileDocRef(resetUserId) : null,
              this.getSocialPrivateDocRef ? this.getSocialPrivateDocRef(resetUserId) : null,
              this.getSocialConnectionsDocRef ? this.getSocialConnectionsDocRef(resetUserId) : null,
              this.getSocialEngagementDocRef ? this.getSocialEngagementDocRef(resetUserId) : null
            ].filter(Boolean);
            await Promise.all(cleanupRefs.map(async (ref) => {
              try { await deleteDoc(ref); } catch (_) {}
            }));

            // Limpa inbox social (subcoleção)
            const inboxCol = collection(db, 'users', resetUserId, 'private', 'social', 'inbox');
            const inboxSnap = await getDocs(inboxCol);
            await Promise.all(inboxSnap.docs.map(async (docSnap) => {
              try { await deleteDoc(docSnap.ref); } catch (_) {}
            }));

            // Remove código de convite antigo, se existir
            if (previousInviteCode && this.getSocialInviteCodeDocRef) {
              try { await deleteDoc(this.getSocialInviteCodeDocRef(previousInviteCode)); } catch (_) {}
            }
          } catch (socialCleanupErr) {
            console.warn('[Reset] Falha parcial ao limpar dados sociais na nuvem:', socialCleanupErr);
          }
        }
        const stateRef = this.getStateDocRef();
        const newCloudState = JSON.parse(JSON.stringify(window.sistemaVidaState));
        delete newCloudState.profile?.avatarUrl;
        delete newCloudState.profile?.odysseyImages;
        newCloudState._lastUpdatedAt = Date.now();
        await this.withTimeout(setDoc(stateRef, newCloudState), 10000, 'firestore_reset');
        cloudResetOk = true;
        // NÃO usa localStorage.clear() — bloqueado em ambientes sandbox/iframe
      } catch (error) {
        console.error('Erro ao resetar o sistema:', error);
        cloudResetError = error;
      }

      // Finaliza reset local mesmo se a nuvem falhar, para funcionar em site/PC sem travar o fluxo.
      if (cloudResetOk) {
        this.showNotification(
          useMockup
            ? 'App carregado com dados de exemplo. Explore à vontade!'
            : 'Sistema zerado. Iniciando o Onboarding...'
        );
      } else {
        alert('Dados locais zerados. Falha ao atualizar a nuvem agora; tente sincronizar novamente depois.');
        console.warn('[Reset] Estado local resetado com falha na nuvem:', cloudResetError);
      }
      setTimeout(() => window.location.reload(), 1800);
    },

importFromExcel: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        // Helper para busca flexível de colunas
        const getValue = (row, possibleKeys) => {
            for (let key of possibleKeys) {
                if (row[key] !== undefined && row[key] !== null) return row[key];
                // Busca case-insensitive
                const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return "";
        };
        const toNumber = (value, fallback = 0) => {
            if (value === null || value === undefined || value === '') return fallback;
            const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toInt = (value, fallback = 0) => Math.round(toNumber(value, fallback));
        const toBool = (value, fallback = false) => {
            if (typeof value === 'boolean') return value;
            const raw = String(value ?? '').trim().toLowerCase();
            if (!raw) return fallback;
            if (['1', 'true', 'sim', 'yes', 'y', 'ativo', 'concluida', 'concluído', 'done'].includes(raw)) return true;
            if (['0', 'false', 'nao', 'não', 'no', 'n', 'inativo', 'pendente'].includes(raw)) return false;
            return fallback;
        };
        const parseList = (value, delimiter = ',') => {
            if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
            return String(value || '').split(delimiter).map(item => item.trim()).filter(Boolean);
        };
        const parseJson = (value, fallback) => {
            if (value === null || value === undefined || value === '') return fallback;
            if (typeof value === 'object') return value;
            try {
                return JSON.parse(String(value));
            } catch (_) {
                return fallback;
            }
        };
        const pad2 = (value) => String(value).padStart(2, '0');
        const formatIsoDate = (year, month, day) => {
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
            if (month < 1 || month > 12 || day < 1 || day > 31) return '';
            return `${year}-${pad2(month)}-${pad2(day)}`;
        };
        const excelSerialToDateKey = (value) => {
            const serial = Number(value);
            if (!Number.isFinite(serial)) return '';
            const wholeDays = Math.floor(serial);
            if (wholeDays <= 0) return '';
            const utcMs = Math.round((wholeDays - 25569) * 86400 * 1000);
            const date = new Date(utcMs);
            if (Number.isNaN(date.getTime())) return '';
            return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
        };
        const excelSerialToTime = (value) => {
            const serial = Number(value);
            if (!Number.isFinite(serial) || serial < 0) return '';
            const fraction = ((serial % 1) + 1) % 1;
            const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${pad2(hours)}:${pad2(minutes)}`;
        };
        const normalizeDateKey = (value) => {
            if (value === null || value === undefined || value === '') return '';
            if (typeof value === 'number') return excelSerialToDateKey(value);
            const raw = String(value || '').trim();
            if (!raw) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
            if (/^\d+(?:\.\d+)?$/.test(raw)) {
                const fromSerial = excelSerialToDateKey(Number(raw));
                if (fromSerial) return fromSerial;
            }
            const brDateMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+.*)?$/);
            if (brDateMatch) {
                const [, day, month, year] = brDateMatch;
                return formatIsoDate(Number(year), Number(month), Number(day));
            }
            const isoSlashMatch = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+.*)?$/);
            if (isoSlashMatch) {
                const [, year, month, day] = isoSlashMatch;
                return formatIsoDate(Number(year), Number(month), Number(day));
            }
            return raw;
        };
        const normalizeTimeValue = (value) => {
            if (value === null || value === undefined || value === '') return '';
            if (typeof value === 'number') return excelSerialToTime(value);
            const raw = String(value || '').trim();
            if (!raw) return '';
            if (/^\d+(?:\.\d+)?$/.test(raw)) {
                const fromSerial = excelSerialToTime(Number(raw));
                if (fromSerial) return fromSerial;
            }
            const hourMinuteMatch = raw.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
            if (hourMinuteMatch) {
                const [, hours, minutes] = hourMinuteMatch;
                return `${pad2(Number(hours))}:${pad2(Number(minutes))}`;
            }
            const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
            if (amPmMatch) {
                let hours = Number(amPmMatch[1]);
                const minutes = Number(amPmMatch[2]);
                const suffix = amPmMatch[3].toUpperCase();
                if (suffix === 'PM' && hours < 12) hours += 12;
                if (suffix === 'AM' && hours === 12) hours = 0;
                return `${pad2(hours)}:${pad2(minutes)}`;
            }
            return raw;
        };
        const getSheetHeaderSet = (sheet) => new Set(
            ((XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 })?.[0]) || [])
                .map((header) => String(header || '').trim())
                .filter(Boolean)
        );
        const hasAnyHeader = (headerSet, names = []) => names.some((name) => headerSet?.has?.(name));
        const normalizeLookupKey = (value) => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
        const buildNamedIndex = (items, idKey = 'id', titleKeys = ['title']) => {
            const byId = new Map();
            const byTitle = new Map();
            (items || []).forEach((item) => {
                const id = String(item?.[idKey] || '').trim();
                if (id && !byId.has(id)) byId.set(id, item);
                titleKeys.forEach((titleKey) => {
                    const title = normalizeLookupKey(item?.[titleKey]);
                    if (!title) return;
                    if (!byTitle.has(title)) byTitle.set(title, item);
                });
            });
            return { byId, byTitle };
        };
        const resolveItemId = (labelOrId, index, idKey = 'id') => {
            const raw = String(labelOrId || '').trim();
            if (!raw || !index) return '';
            if (index.byId?.has(raw)) return raw;
            const found = index.byTitle?.get(normalizeLookupKey(raw));
            return String(found?.[idKey] || '');
        };
        const normalizeEntityStatusLabel = (value, fallback = 'pending') => {
            const raw = normalizeLookupKey(value);
            if (!raw) return fallback;
            if (raw.includes('conclu') || raw === 'done') return 'done';
            if (raw.includes('aband') || raw === 'abandoned') return 'abandoned';
            if (raw.includes('andamento') || raw.includes('progress') || raw.includes('ativo') || raw === 'active' || raw === 'in_progress') return 'in_progress';
            if (raw.includes('pend')) return 'pending';
            return fallback;
        };
        const normalizeHabitStatusLabel = (value, fallback = 'active') => {
            const raw = normalizeLookupKey(value);
            if (!raw) return fallback;
            if (raw.includes('arquiv')) return 'archived';
            if (raw.includes('inativ') || raw === 'inactive') return 'inactive';
            if (raw.includes('paus')) return 'paused';
            if (raw.includes('ativo') || raw === 'active') return 'active';
            return fallback;
        };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, {type: 'array'});
            
            console.log("Iniciando processamento das abas do Excel...");
            let metaIndex = buildNamedIndex([]);
            let okrIndex = buildNamedIndex([]);
            let macroIndex = buildNamedIndex([]);
            let microIndex = buildNamedIndex([]);
            let habitIndex = buildNamedIndex([]);
            let strengthIndex = buildNamedIndex([]);
            let shadowIndex = buildNamedIndex([]);
            const importWarnings = [];

            // 1. Aba: Planos -> state.entities
            const wsPlanos = workbook.Sheets['Planos'] || workbook.Sheets['Main'] || workbook.Sheets['Tarefas'];
            if (wsPlanos) {
                const planHeaders = getSheetHeaderSet(wsPlanos);
                const planosArr = XLSX.utils.sheet_to_json(wsPlanos);
                window.sistemaVidaState.entities = { metas: [], okrs: [], macros: [], micros: [] };
                
                planosArr.forEach(row => {
                    let typeRaw = String(getValue(row, ['Tipo', 'Type', 'Categoria'])).toLowerCase();
                    let type = 'macros';
                    if (typeRaw.includes('meta')) type = 'metas';
                    else if (typeRaw.includes('okr')) type = 'okrs';
                    else if (typeRaw.includes('macro')) type = 'macros';
                    else if (typeRaw.includes('micro')) type = 'micros';
                    else if (getValue(row, ['Meta', 'metaId'])) type = 'okrs';

                    let progressRaw = getValue(row, ['Progresso', 'Progresso (G)', 'progress', '%']);
                    let progressVal = 0;
                    if (typeof progressRaw === 'string') {
                        progressVal = parseFloat(progressRaw.replace('%', '').replace(',', '.'));
                    } else {
                        progressVal = parseFloat(progressRaw) || 0;
                    }
                    let numericProgress = (progressVal <= 1 && progressVal > 0) ? progressVal * 100 : progressVal;
                    let status = (numericProgress >= 100) ? 'done' : 'active';
                    
                    let idFromSheet = getValue(row, ['ID', 'Id', 'id', 'Código', 'Codigo']);
                    const usesVisibleParent = hasAnyHeader(planHeaders, ['Plano Pai', 'Pai', 'Parent']);
                    const explicitParentLabel = usesVisibleParent
                        ? String(getValue(row, ['Plano Pai', 'Pai', 'Parent']) || '').trim()
                        : '';
                    let parentId = getValue(row, ['ID_Pai', 'ID Pai', 'Pai ID', 'metaId', 'okrId', 'macroId']);
                    if (usesVisibleParent) parentId = '';
                    
                    let obj = {
                        id: idFromSheet ? String(idFromSheet) : ('ent_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                        title: getValue(row, ['Título', 'Titulo', 'Nome', 'Tarefa', 'Title']),
                        dimension: getValue(row, ['Dimensão', 'Área', 'Dimension', 'Area']) || 'Geral',
                        status: normalizeEntityStatusLabel(getValue(row, ['Status', 'Situação', 'Situacao']), status),
                        progress: Math.min(100, Math.max(0, numericProgress)),
                        completed: toBool(getValue(row, ['Concluída', 'Concluida', 'Completed']), status === 'done')
                    };
                    const successCriteria = String(getValue(row, ['Critério de Sucesso', 'Critério_Sucesso', 'Success Criteria']) || '').trim();
                    const challengeLevel = Number(getValue(row, ['Desafio', 'Challenge', 'Challenge Level']) || 0);
                    const commitmentLevel = Number(getValue(row, ['Comprometimento', 'Commitment', 'Commitment Level']) || 0);
                    const keyResultsText = String(getValue(row, ['Resultados-chave', 'Resultados-chave (texto)', 'Key_Results', 'Key Results', 'KRs']) || '');

                    let context = getValue(row, ['Contexto', 'Contexto / Indicador', 'Contexto_Indicador', 'Notes', 'Descrição']);
                    let prazo = normalizeDateKey(getValue(row, ['Prazo', 'Prazo / Ciclo', 'Ciclo', 'Deadline', 'Data']));
                    
                    if (type === 'metas' || type === 'okrs') {
                        obj.purpose = context;
                        obj.prazo = prazo;
                        if (successCriteria) obj.successCriteria = successCriteria;
                        if (challengeLevel >= 1 && challengeLevel <= 5) obj.challengeLevel = Math.round(challengeLevel);
                        if (commitmentLevel >= 1 && commitmentLevel <= 5) obj.commitmentLevel = Math.round(commitmentLevel);
                        if (type === 'okrs') {
                            const okrCriterion = String(successCriteria || context || '').trim();
                            if (okrCriterion) {
                                obj.successCriteria = okrCriterion;
                                obj.purpose = okrCriterion;
                            }
                            obj.keyResults = this.parseKeyResultsText(keyResultsText);
                            const krProgress = this.computeKeyResultsProgress(obj.keyResults);
                            if (krProgress !== null) obj.progress = krProgress;
                        }
                    }
                    else if (type === 'macros') { obj.description = context; obj.prazo = prazo; }
                    else if (type === 'micros') {
                        obj.indicator = context;
                        obj.completed = toBool(getValue(row, ['Concluída', 'Concluida', 'Completed']), status === 'done');
                        obj.prazo = prazo;
                        obj.protocolId = String(getValue(row, ['Protocol_ID', 'Protocolo_ID']) || '').trim();
                        obj.sourceHabitId = String(getValue(row, ['Habito_Origem_ID', 'Hábito_Origem_ID']) || '').trim();
                        obj.sourceProtocolId = String(getValue(row, ['Protocolo_Origem_ID']) || '').trim();
                        obj.steps = parseJson(getValue(row, ['Steps_JSON']), parseList(getValue(row, ['Passos', 'Steps']), '||'));
                        obj.stepLogs = parseJson(getValue(row, ['Step_Logs_JSON']), {});
                        obj.effort = String(getValue(row, ['Esforço', 'Esforco']) || '').trim();
                        obj.estimatedMinutes = toInt(getValue(row, ['Minutos estimados', 'Minutos_Estimados', 'Estimated_Minutes']), 0);
                        obj.startTime = normalizeTimeValue(getValue(row, ['Hora', 'Hora_Inicio', 'Start_Time']));
                    }

                    if (explicitParentLabel) obj._parentTitle = explicitParentLabel;
                    if (parentId) {
                        if (type === 'okrs') obj.metaId = String(parentId);
                        else if (type === 'macros') obj.okrId = String(parentId);
                        else if (type === 'micros') obj.macroId = String(parentId);
                    }

                    if (window.sistemaVidaState.entities[type]) {
                        window.sistemaVidaState.entities[type].push(obj);
                    }
                });
                metaIndex = buildNamedIndex(window.sistemaVidaState.entities.metas);
                okrIndex = buildNamedIndex(window.sistemaVidaState.entities.okrs);
                macroIndex = buildNamedIndex(window.sistemaVidaState.entities.macros);
                window.sistemaVidaState.entities.okrs.forEach((okr) => {
                    if (okr._parentTitle) {
                        const resolvedParentId = resolveItemId(okr._parentTitle, metaIndex);
                        okr.metaId = resolvedParentId || '';
                        if (!resolvedParentId) importWarnings.push(`Planos: Meta pai não encontrada para OKR "${okr.title || ''}"`);
                    }
                    delete okr._parentTitle;
                });
                window.sistemaVidaState.entities.macros.forEach((macro) => {
                    if (macro._parentTitle) {
                        const resolvedParentId = resolveItemId(macro._parentTitle, okrIndex);
                        macro.okrId = resolvedParentId || '';
                        if (!resolvedParentId) importWarnings.push(`Planos: OKR pai não encontrado para Macro "${macro.title || ''}"`);
                    }
                    delete macro._parentTitle;
                });
                window.sistemaVidaState.entities.micros.forEach((micro) => {
                    if (micro._parentTitle) {
                        const resolvedParentId = resolveItemId(micro._parentTitle, macroIndex);
                        micro.macroId = resolvedParentId || '';
                        if (!resolvedParentId) importWarnings.push(`Planos: Macro pai não encontrada para Micro "${micro.title || ''}"`);
                    }
                    delete micro._parentTitle;
                });
                microIndex = buildNamedIndex(window.sistemaVidaState.entities.micros);
            }

            // 2. Aba: Propósito
            const wsProp = workbook.Sheets['Propósito'] || workbook.Sheets['Proposito'];
            if (wsProp) {
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                window.sistemaVidaState.profile.values = [];
                window.sistemaVidaState.profile.ikigai = {};
                window.sistemaVidaState.profile.legacyObj = {};
                window.sistemaVidaState.profile.vision = {};
                if ('legacy' in window.sistemaVidaState.profile) window.sistemaVidaState.profile.legacy = '';
                if ('purpose' in window.sistemaVidaState.profile) delete window.sistemaVidaState.profile.purpose;
                window.sistemaVidaState.profile.identity = { strengths: [], shadows: [] };
                window.sistemaVidaState.dimensions = { 'Saúde':{score:1}, 'Mente':{score:1}, 'Carreira':{score:1}, 'Finanças':{score:1}, 'Relacionamentos':{score:1}, 'Família':{score:1}, 'Lazer':{score:1}, 'Propósito':{score:1} };
                window.sistemaVidaState.perma = {P:0, E:0, R:0, M:0, A:0};
                window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };

                const propArr = XLSX.utils.sheet_to_json(wsProp);
                propArr.forEach(row => {
                    let cat = String(getValue(row, ['Categoria', 'Category']) || '').trim().toLowerCase();
                    let subcat = String(getValue(row, ['Tipo', 'Subcategoria', 'Tipo_Identidade']) || '').trim().toLowerCase();
                    let key = String(getValue(row, ['Título', 'Titulo', 'Chave', 'Dimensão', 'Item']) || '').trim();
                    let val = getValue(row, ['Texto', 'Texto_Preenchido', 'Texto Preenchido', 'Valor', 'Score']);
                    
                    const isIdentityRow = cat.includes('ident') || cat.includes('for') || cat.includes('som');
                    if (!key || ((val === undefined || val === '') && !isIdentityRow)) return;
                    let kLow = key.toLowerCase();

                    // Mapeamento Direcionado por Categoria
                    if (cat.includes('roda')) {
                        let dimKey = Object.keys(window.sistemaVidaState.dimensions).find(k => k.toLowerCase().replace(/[áàãâäéèêëíìîïóòõôöúùûüç]/g, '') === kLow.replace(/[áàãâäéèêëíìîïóòõôöúùûüç]/g, '')) || key;
                        if (!window.sistemaVidaState.dimensions[dimKey]) window.sistemaVidaState.dimensions[dimKey] = { score: 1 };
                        window.sistemaVidaState.dimensions[dimKey].score = parseFloat(val) || 1;
                    } 
                    else if (cat.includes('perma')) {
                        let pKey = kLow.toUpperCase();
                        if (['P','E','R','M','A'].includes(pKey)) window.sistemaVidaState.perma[pKey] = this.normalizePermaScore(val);
                    } 
                    else if (cat.includes('swls')) {
                        const score = Number(window.sistemaVidaState.swls.lastScore) || 0;
                        if (kLow === 'score') {
                            window.sistemaVidaState.swls.lastScore = Math.max(5, Math.min(35, Math.round(Number(val) || score || 20)));
                        } else if (kLow === 'data') {
                            window.sistemaVidaState.swls.lastDate = String(val || '');
                        } else if (/^q[1-5]$/.test(kLow)) {
                            const idx = Number(kLow.replace('q', '')) - 1;
                            window.sistemaVidaState.swls.answers[idx] = this.normalizeSwlsAnswer(val);
                        }
                    }
                    else if (cat.includes('ikigai')) {
                        if (kLow.includes('miss')) window.sistemaVidaState.profile.ikigai.missao = val;
                        else if (kLow.includes('voca')) window.sistemaVidaState.profile.ikigai.vocacao = val;
                        else if (kLow.includes('paix')) window.sistemaVidaState.profile.ikigai.paixao = val;
                        else if (kLow.includes('prof')) window.sistemaVidaState.profile.ikigai.profissao = val;
                        else if (kLow.includes('amo')) window.sistemaVidaState.profile.ikigai.love = val;
                        else if (kLow.includes('bom')) window.sistemaVidaState.profile.ikigai.good = val;
                        else if (kLow.includes('precisa')) window.sistemaVidaState.profile.ikigai.need = val;
                        else if (kLow.includes('pago')) window.sistemaVidaState.profile.ikigai.paid = val;
                        else if (kLow.includes('resumo')) window.sistemaVidaState.profile.ikigai.sinteseResumo = val;
                        else if (kLow.includes('sín') || kLow.includes('sin')) window.sistemaVidaState.profile.ikigai.sintese = val;
                    } 
                    else if (cat.includes('valor')) {
                        window.sistemaVidaState.profile.values = typeof val === 'string' ? val.split(/[,\n]/).map(s=>s.trim()) : [val];
                    }
                    else if (cat.includes('ident') || cat.includes('for') || cat.includes('som')) {
                        const identity = window.sistemaVidaState.profile.identity;
                        if (subcat.includes('valor') || kLow.includes('valor')) {
                            window.sistemaVidaState.profile.values = typeof val === 'string'
                                ? val.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
                                : [String(val).trim()].filter(Boolean);
                        } else {
                            const dimension = String(getValue(row, ['Dimensão', 'Dimensao', 'Dimension']) || '').trim();
                            const baseItem = {
                                id: String(getValue(row, ['ID_Item', 'Item_ID']) || `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
                                title: key,
                                dimension,
                                linkedHabitIds: parseList(getValue(row, ['Habitos_Vinculados', 'Hábitos_Vinculados']), ','),
                                weeklyLogs: parseJson(getValue(row, ['Logs_Semanais_JSON', 'Weekly_Logs_JSON']), {}),
                                createdAt: String(getValue(row, ['Criado_Em', 'Created_At']) || new Date().toISOString()),
                                updatedAt: String(getValue(row, ['Atualizado_Em', 'Updated_At']) || '')
                            };
                            if (subcat.includes('for') || cat.includes('for')) {
                                identity.strengths.push({
                                    ...baseItem,
                                    description: String(getValue(row, ['Descrição', 'Descricao']) || '').trim(),
                                    evidence: String(getValue(row, ['Evidência', 'Evidencia']) || val || '').trim(),
                                    excessRisk: String(getValue(row, ['Risco de Excesso', 'Risco_Excesso']) || '').trim(),
                                    practice: String(getValue(row, ['Prática', 'Pratica']) || '').trim()
                                });
                            } else if (subcat.includes('som') || cat.includes('som')) {
                                identity.shadows.push({
                                    ...baseItem,
                                    description: String(getValue(row, ['Descrição', 'Descricao']) || '').trim(),
                                    trigger: String(getValue(row, ['Gatilho', 'Trigger']) || '').trim(),
                                    impact: String(getValue(row, ['Impacto']) || val || '').trim(),
                                    desiredResponse: String(getValue(row, ['Resposta Desejada', 'Resposta_Desejada']) || '').trim(),
                                    obstacle: String(getValue(row, ['Obstáculo', 'Obstaculo']) || '').trim(),
                                    ifThen: String(getValue(row, ['Se-Então', 'Se_Entao', 'Se Então', 'Se_Então']) || '').trim()
                                });
                            }
                        }
                    }
                    else if (cat.includes('vis')) {
                        if ((kLow.includes('saude') || kLow.includes('saúde') || kLow.includes('sau')) && kLow.includes('resumo')) window.sistemaVidaState.profile.vision.saudeResumo = val;
                        else if (kLow.includes('carreira') && kLow.includes('resumo')) window.sistemaVidaState.profile.vision.carreiraResumo = val;
                        else if (kLow.includes('intelect') && kLow.includes('resumo')) window.sistemaVidaState.profile.vision.intelectoResumo = val;
                        else if (kLow.includes('saú') || kLow.includes('sau')) window.sistemaVidaState.profile.vision.saude = val;
                        else if (kLow.includes('carr')) window.sistemaVidaState.profile.vision.carreira = val;
                        else if (kLow.includes('intel')) window.sistemaVidaState.profile.vision.intelecto = val;
                        else if (kLow.includes('cit') || kLow.includes('quote')) window.sistemaVidaState.profile.vision.quote = val;
                    } 
                    else if (cat.includes('legado')) {
                        if (kLow.includes('fam') && kLow.includes('resumo')) window.sistemaVidaState.profile.legacyObj.familiaResumo = val;
                        else if (kLow.includes('prof') && kLow.includes('resumo')) window.sistemaVidaState.profile.legacyObj.profissaoResumo = val;
                        else if ((kLow.includes('mun') || kLow.includes('mundo')) && kLow.includes('resumo')) window.sistemaVidaState.profile.legacyObj.mundoResumo = val;
                        else if (kLow.includes('fam')) window.sistemaVidaState.profile.legacyObj.familia = val;
                        else if (kLow.includes('prof')) window.sistemaVidaState.profile.legacyObj.profissao = val;
                        else if (kLow.includes('mun')) window.sistemaVidaState.profile.legacyObj.mundo = val;
                    }
                });
                this.normalizeSwlsState();
                const swlsState = window.sistemaVidaState.swls;
                if (swlsState.lastDate) {
                    if (!swlsState.history || typeof swlsState.history !== 'object') swlsState.history = {};
                    swlsState.history[swlsState.lastDate] = { score: swlsState.lastScore, answers: [...swlsState.answers] };
                }
                strengthIndex = buildNamedIndex(window.sistemaVidaState.profile.identity?.strengths || []);
                shadowIndex = buildNamedIndex(window.sistemaVidaState.profile.identity?.shadows || []);
            }

            const wsOdy = workbook.Sheets['Odyssey'];
            if (wsOdy) {
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                window.sistemaVidaState.profile.odyssey = { cenarioA: '', cenarioB: '', cenarioC: '' };
                window.sistemaVidaState.profile.odysseyTitles = { cenarioA: 'Cenário A', cenarioB: 'Cenário B', cenarioC: 'Cenário C' };
                const odyArr = XLSX.utils.sheet_to_json(wsOdy);
                odyArr.forEach(row => {
                    const scenarioKey = String(getValue(row, ['Cenario_Key', 'Cenário_Key', 'Scenario_Key']) || '').trim().toLowerCase();
                    const scenario = String(getValue(row, ['Cenário', 'CenÃ¡rio', 'Scenario']) || '').trim().toLowerCase();
                    const title = String(getValue(row, ['Titulo', 'Título', 'Title']) || '').trim();
                    const text = String(getValue(row, ['Texto', 'Text', 'Conteudo', 'Conteúdo']) || '').trim();
                    const key = scenarioKey || (scenario.startsWith('cenário a') || scenario.startsWith('cenario a') ? 'cenarioa'
                        : scenario.startsWith('cenário b') || scenario.startsWith('cenario b') ? 'cenariob'
                        : scenario.startsWith('cenário c') || scenario.startsWith('cenario c') ? 'cenarioc' : '');
                    if (!key) return;
                    if (key.includes('cenarioa')) {
                        if (text) window.sistemaVidaState.profile.odyssey.cenarioA = text;
                        if (title) window.sistemaVidaState.profile.odysseyTitles.cenarioA = title;
                    } else if (key.includes('cenariob')) {
                        if (text) window.sistemaVidaState.profile.odyssey.cenarioB = text;
                        if (title) window.sistemaVidaState.profile.odysseyTitles.cenarioB = title;
                    } else if (key.includes('cenarioc')) {
                        if (text) window.sistemaVidaState.profile.odyssey.cenarioC = text;
                        if (title) window.sistemaVidaState.profile.odysseyTitles.cenarioC = title;
                    }
                });
            }

            // 3. Aba: Hábitos
            const wsHabits = workbook.Sheets['Hábitos'] || workbook.Sheets['Habitos'];
            if (wsHabits) {
                const habArr = XLSX.utils.sheet_to_json(wsHabits);
                window.sistemaVidaState.habits = [];
                habArr.forEach(row => {
                    const title = getValue(row, ['Título', 'Titulo', 'Hábito']);
                    if (title) {
                        window.sistemaVidaState.habits.push({
                            id: getValue(row, ['ID', 'Id']) || ('hab_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                            title: title,
                            dimension: getValue(row, ['Dimensão', 'Dimensao', 'Área']) || 'Geral',
                            description: String(getValue(row, ['Descrição', 'Descricao']) || '').trim(),
                            trigger: getValue(row, ['Gatilho', 'Contexto']) || '',
                            routine: getValue(row, ['Rotina', 'Rotina do Habito', 'Ação']) || '',
                            reward: getValue(row, ['Recompensa', 'Recompensa do Dia']) || '',
                            status: normalizeHabitStatusLabel(getValue(row, ['Status', 'Situação']), 'active'),
                            completed: toBool(getValue(row, ['Concluído', 'Concluido', 'Concluída', 'Completed']), false),
                            trackMode: String(getValue(row, ['Track_Mode', 'Modo_Rastreio']) || 'boolean').trim(),
                            targetValue: toNumber(getValue(row, ['Meta', 'Target_Value', 'Valor_Meta']), 1),
                            frequency: String(getValue(row, ['Frequência', 'Frequencia', 'Frequency']) || 'daily').trim(),
                            specificDays: parseList(getValue(row, ['Dias específicos', 'Dias_Especificos', 'Dias_Específicos', 'Specific_Days']), ','),
                            intervalDays: toInt(getValue(row, ['Intervalo em dias', 'Intervalo_Dias', 'Interval_Days']), 0),
                            dayOfMonth: toInt(getValue(row, ['Dia do mês', 'Dia_Do_Mes', 'Day_Of_Month']), 0),
                            scheduleStartDate: normalizeDateKey(getValue(row, ['Data de início', 'Data_Inicio_Agenda', 'Schedule_Start_Date'])),
                            startTime: normalizeTimeValue(getValue(row, ['Hora', 'Hora_Inicio', 'Start_Time'])),
                            estimatedMinutes: toInt(getValue(row, ['Minutos estimados', 'Minutos_Estimados', 'Estimated_Minutes']), 0),
                            continuous: toBool(getValue(row, ['Contínuo', 'Continuo', 'Continuous']), true),
                            protocolId: String(getValue(row, ['Protocol_ID', 'Protocolo_ID']) || '').trim(),
                            steps: parseList(getValue(row, ['Passos', 'Steps']), '||'),
                            logs: parseJson(getValue(row, ['Logs_JSON']), {}),
                            stepLogs: parseJson(getValue(row, ['Step_Logs_JSON']), {}),
                            sourceType: String(getValue(row, ['Source_Type', 'Tipo_Origem']) || '').trim(),
                            sourceId: String(getValue(row, ['Source_ID', 'Origem_ID']) || '').trim(),
                            sourceStrengthId: String(getValue(row, ['Source_Strength_ID', 'Forca_Origem_ID', 'Força_Origem_ID']) || '').trim(),
                            sourceShadowId: String(getValue(row, ['Source_Shadow_ID', 'Sombra_Origem_ID']) || '').trim(),
                            isKey: toBool(getValue(row, ['Hábito-chave', 'Habito-chave', 'Hábito_Chave', 'Is_Key', 'Habito_Chave']), false),
                            maturity: String(getValue(row, ['Maturity', 'Maturidade']) || 'forming').trim(),
                            maturityMeta: parseJson(getValue(row, ['Maturity_Meta_JSON']), {}),
                            reminderEnabled: toBool(getValue(row, ['Reminder_Enabled', 'Lembrete_Enabled']), false),
                            reminderTime: normalizeTimeValue(getValue(row, ['Reminder_Time', 'Horario_Lembrete', 'Horário_Lembrete'])),
                            reminderIntervalEnabled: toBool(getValue(row, ['Reminder_Interval_Enabled', 'Intervalo_Lembrete_Enabled']), false),
                            reminderWindowStart: normalizeTimeValue(getValue(row, ['Reminder_Window_Start', 'Janela_Lembrete_Inicio'])),
                            reminderWindowEnd: normalizeTimeValue(getValue(row, ['Reminder_Window_End', 'Janela_Lembrete_Fim'])),
                            reminderIntervalMin: toInt(getValue(row, ['Reminder_Interval_Min', 'Intervalo_Lembrete_Min']), 0),
                            createdAt: String(getValue(row, ['Criado_Em', 'Created_At']) || '').trim(),
                            updatedAt: String(getValue(row, ['Atualizado_Em', 'Updated_At']) || '').trim()
                        });
                    }
                });
                habitIndex = buildNamedIndex(window.sistemaVidaState.habits);
            }

            const wsHabHistory = workbook.Sheets['Hábitos_Histórico'] || workbook.Sheets['Habitos_Historico'] || workbook.Sheets['Hábitos_Historico'];
            if (wsHabHistory && wsHabits && Array.isArray(window.sistemaVidaState.habits)) {
                const historyArr = XLSX.utils.sheet_to_json(wsHabHistory);
                const byId = new Map(window.sistemaVidaState.habits.map(h => [String(h.id || ''), h]));
                historyArr.forEach(row => {
                    const id = String(getValue(row, ['ID', 'Id']) || '').trim();
                    let habit = id ? byId.get(id) : null;
                    if (!habit) {
                        const title = String(getValue(row, ['Título', 'Titulo', 'Hábito']) || '').trim();
                        const resolvedId = resolveItemId(title, habitIndex);
                        habit = resolvedId ? byId.get(resolvedId) : null;
                    }
                    if (!habit) {
                        importWarnings.push(`Hábitos histórico: hábito não encontrado para a linha "${String(getValue(row, ['Título', 'Titulo', 'Hábito']) || id || '').trim()}"`);
                        return;
                    }
                    habit.logs = parseJson(getValue(row, ['Logs_JSON']), habit.logs || {});
                    habit.stepLogs = parseJson(getValue(row, ['Step_Logs_JSON']), habit.stepLogs || {});
                    Object.keys(row).forEach((key) => {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
                        const raw = row[key];
                        if (raw === undefined || raw === null || raw === '') return;
                        if (!habit.logs || typeof habit.logs !== 'object') habit.logs = {};
                        habit.logs[key] = toNumber(raw, 0);
                    });
                });
            }

            // 4. Aba: Diário
            const wsDiario = workbook.Sheets['Diário'] || workbook.Sheets['Diario'];
            if (wsDiario) {
                const logArr = XLSX.utils.sheet_to_json(wsDiario);
                window.sistemaVidaState.profile.dailyCheckins = [];
                window.sistemaVidaState.dailyLogs = {};
                logArr.forEach(row => {
                    let dateRaw = getValue(row, ['Data', 'Date', 'Dia']);
                    let dateStr = normalizeDateKey(dateRaw);
                    
                    if (dateStr && dateStr.length >= 10) {
                        const safeDate = dateStr.substring(0,10);
                        const dimensionNotes = {};
                        ['Saúde','Mente','Carreira','Finanças','Relacionamentos','Família','Lazer','Propósito'].forEach((dim) => {
                            const value = String(getValue(row, [`Shutdown_${dim}`, `Shutdown ${dim}`, `Nota_${dim}`]) || '').trim();
                            if (value) dimensionNotes[dim] = value;
                        });
                        const legacyShutdown = [
                            getValue(row, ['Shutdown_1', 'Shutdown 1']),
                            getValue(row, ['Shutdown_2', 'Shutdown 2']),
                            getValue(row, ['Shutdown_3', 'Shutdown 3'])
                        ].map(item => String(item || '').trim()).filter(Boolean);
                        const logJson = parseJson(getValue(row, ['Log_JSON']), {});
                        window.sistemaVidaState.dailyLogs[safeDate] = {
                            ...(logJson && typeof logJson === 'object' ? logJson : {}),
                            gratidao: getValue(row, ['Gratidão', 'Gratidao']),
                            funcionou: getValue(row, ['O que funcionou', 'O_Que_Funcionou', 'O Que Funcionou', 'Funcionou']),
                            aprendi: getValue(row, ['O que aprendi', 'O_Que_Aprendi', 'O Que Aprendi', 'Aprendi']),
                            shutdown: legacyShutdown,
                            focus: String(getValue(row, ['Intenção', 'Intencao', 'Focus']) || '').trim(),
                            dimensionNotes,
                            energy: toNumber(getValue(row, ['Energia', 'Energy']), 5)
                        };
                        const hasCheckin = ['Sono_h', 'Sono (h)', 'Qualidade_Sono', 'Qualidade do Sono', 'Humor', 'Estresse', 'Emoção', 'Emocao', 'Checkin_JSON']
                            .some(key => String(getValue(row, [key]) || '').trim());
                        if (hasCheckin) {
                            const checkinJson = parseJson(getValue(row, ['Checkin_JSON']), {});
                            window.sistemaVidaState.profile.dailyCheckins.push({
                                ...(checkinJson && typeof checkinJson === 'object' ? checkinJson : {}),
                                date: safeDate,
                                sleepHours: toNumber(getValue(row, ['Sono (h)', 'Sono_h']), 0),
                                sleepQuality: toNumber(getValue(row, ['Qualidade do Sono', 'Qualidade_Sono']), 0),
                                energy: toNumber(getValue(row, ['Energia', 'Energy']), 0),
                                mood: toNumber(getValue(row, ['Humor']), 0),
                                stress: toNumber(getValue(row, ['Estresse']), 0),
                                emotion: String(getValue(row, ['Emoção', 'Emocao']) || '').trim(),
                                savedAt: String(getValue(row, ['Checkin_Saved_At', 'Checkin_Salvo_Em']) || '')
                            });
                        }
                    }
                });
            }

            // 5. Aba: Revisões
            const wsRev = workbook.Sheets['Revisões'] || workbook.Sheets['Revisoes'];
            if (wsRev) {
                const reviewHeaders = getSheetHeaderSet(wsRev);
                const revArr = XLSX.utils.sheet_to_json(wsRev);
                window.sistemaVidaState.reviews = {};
                revArr.forEach(row => {
                    let dateRaw = getValue(row, ['Data', 'Date']);
                    let dateStr = normalizeDateKey(dateRaw);
                    
                    if (dateStr && dateStr.length >= 10) {
                        const usesVisibleStrength = hasAnyHeader(reviewHeaders, ['Força', 'Forca']);
                        const usesVisibleShadow = hasAnyHeader(reviewHeaders, ['Sombra']);
                        const strengthLabel = usesVisibleStrength ? String(getValue(row, ['Força', 'Forca']) || '').trim() : '';
                        const shadowLabel = usesVisibleShadow ? String(getValue(row, ['Sombra']) || '').trim() : '';
                        window.sistemaVidaState.reviews[dateStr.substring(0,10)] = {
                            q1: getValue(row, ['O que planejei', 'O_Que_Planejei', 'O Que Planejei']),
                            q2: getValue(row, ['O que executei', 'O_Que_Executei', 'O Que Executei']),
                            q3: getValue(row, ['Aprendizado', 'Aprendi']),
                            q4: getValue(row, ['Ajuste', 'Ajustes']),
                            q5: getValue(row, ['Intenção', 'Intencao_Proxima', 'Intencao Proxima']),
                            strengthId: usesVisibleStrength
                                ? (strengthLabel ? resolveItemId(strengthLabel, strengthIndex) : '')
                                : resolveItemId(getValue(row, ['Strength_ID', 'Forca_ID', 'Força_ID']), strengthIndex),
                            shadowId: usesVisibleShadow
                                ? (shadowLabel ? resolveItemId(shadowLabel, shadowIndex) : '')
                                : resolveItemId(getValue(row, ['Shadow_ID', 'Sombra_ID']), shadowIndex),
                            responsePracticed: String(getValue(row, ['Resposta praticada', 'Resposta_Praticada', 'Response_Practiced']) || '').trim(),
                            habitAdjustment: String(getValue(row, ['Ajuste de hábito', 'Ajuste de habito', 'Ajuste_Habito', 'Ajuste_Hábito', 'Habit_Adjustment']) || '').trim(),
                            savedAt: String(getValue(row, ['Salvo_Em', 'Saved_At']) || '').trim()
                        };
                        if (usesVisibleStrength && strengthLabel && !window.sistemaVidaState.reviews[dateStr.substring(0,10)].strengthId) {
                            importWarnings.push(`Revisões: força não encontrada "${strengthLabel}" em ${dateStr.substring(0,10)}`);
                        }
                        if (usesVisibleShadow && shadowLabel && !window.sistemaVidaState.reviews[dateStr.substring(0,10)].shadowId) {
                            importWarnings.push(`Revisões: sombra não encontrada "${shadowLabel}" em ${dateStr.substring(0,10)}`);
                        }
                    }
                });
            }

            const wsWeekly = workbook.Sheets['Planos Semanais'] || workbook.Sheets['Planos_Semanais'];
            if (wsWeekly) {
                const weeklyHeaders = getSheetHeaderSet(wsWeekly);
                const weeklyArr = XLSX.utils.sheet_to_json(wsWeekly);
                window.sistemaVidaState.weekPlans = {};
                weeklyArr.forEach(row => {
                    const weekKey = String(getValue(row, ['Semana', 'Week_Key']) || '').trim();
                    if (!weekKey) return;
                    const usesVisibleMicros = hasAnyHeader(weeklyHeaders, ['Micros da semana', 'Micros selecionadas']);
                    const visibleSelectedLabels = usesVisibleMicros
                        ? parseList(getValue(row, ['Micros da semana', 'Micros selecionadas']), ',')
                        : [];
                    const hiddenSelectedIds = parseList(getValue(row, ['Micros_Selecionadas', 'Selected_Micros']), ',');
                    const selectedMicros = (usesVisibleMicros ? visibleSelectedLabels : hiddenSelectedIds)
                        .map((value) => usesVisibleMicros ? resolveItemId(value, microIndex) : resolveItemId(value, microIndex))
                        .filter(Boolean);
                    if (usesVisibleMicros) {
                        visibleSelectedLabels.forEach((label) => {
                            if (!resolveItemId(label, microIndex)) importWarnings.push(`Planos semanais: micro não encontrado "${label}" na semana ${weekKey}`);
                        });
                    }
                    window.sistemaVidaState.weekPlans[weekKey] = {
                        weekKey,
                        intention: String(getValue(row, ['Intenção', 'Intencao', 'Intention']) || '').trim(),
                        selectedMicros,
                        updatedAt: String(getValue(row, ['Feito_Em', 'Updated_At']) || '').trim(),
                        createdAt: String(getValue(row, ['Criado_Em', 'Created_At']) || '').trim(),
                        origin: String(getValue(row, ['Origem', 'Origin']) || '').trim(),
                        savedAt: toInt(getValue(row, ['Saved_At_Epoch', 'Salvo_Em_Epoch']), 0) || undefined
                    };
                });
            }

            const wsFocus = workbook.Sheets['Foco Profundo'] || workbook.Sheets['Foco_Profundo'];
            if (wsFocus) {
                const focusHeaders = getSheetHeaderSet(wsFocus);
                const focusArr = XLSX.utils.sheet_to_json(wsFocus);
                window.sistemaVidaState.deepWork = {
                    isRunning: false,
                    isPaused: false,
                    mode: 'focus',
                    remainingSec: 1500,
                    targetSec: 1500,
                    breakSec: 300,
                    microId: '',
                    intention: '',
                    lastTickAt: 0,
                    deadlineAtMs: 0,
                    sessions: [],
                    pendingClosure: null
                };
                window.sistemaVidaState.deepWork.sessions = focusArr.map(row => {
                    const focusSec = Math.max(0, Math.round(toNumber(getValue(row, ['Focus_Sec']), toNumber(getValue(row, ['Minutos de foco', 'Minutos_Foco']), 0) * 60)));
                    const usesVisibleMicro = hasAnyHeader(focusHeaders, ['Micro']);
                    const visibleMicroLabel = usesVisibleMicro ? String(getValue(row, ['Micro']) || '').trim() : '';
                    const hiddenMicroId = String(getValue(row, ['Micro_ID']) || '').trim();
                    const resolvedMicroId = usesVisibleMicro
                        ? (visibleMicroLabel ? resolveItemId(visibleMicroLabel, microIndex) : '')
                        : (hiddenMicroId ? resolveItemId(hiddenMicroId, microIndex) : '');
                    if (usesVisibleMicro && visibleMicroLabel && !resolvedMicroId) {
                        importWarnings.push(`Foco profundo: micro não encontrado "${visibleMicroLabel}"`);
                    }
                    return {
                        startedAt: normalizeDateKey(getValue(row, ['Início', 'Inicio', 'Started_At'])),
                        endedAt: normalizeDateKey(getValue(row, ['Fim', 'Ended_At'])),
                        focusSec,
                        breakSec: Math.max(0, Math.round(toNumber(getValue(row, ['Break_Sec']), toNumber(getValue(row, ['Minutos de pausa', 'Minutos_Pausa']), 0) * 60))),
                        microId: resolvedMicroId,
                        intention: String(getValue(row, ['Intenção', 'Intencao', 'Intention']) || '').trim(),
                        completed: toBool(getValue(row, ['Concluída', 'Concluida', 'Completed']), false),
                        mode: String(getValue(row, ['Mode']) || 'focus').trim() || 'focus'
                    };
                }).filter(session => session.endedAt || session.microId || session.intention);
            }

            const wsProtocols = workbook.Sheets['Protocolos'];
            if (wsProtocols) {
                const protocolArr = XLSX.utils.sheet_to_json(wsProtocols);
                window.sistemaVidaState.protocols = protocolArr.map(row => ({
                    id: String(getValue(row, ['ID']) || `protocol_${Date.now()}${Math.random().toString(36).slice(2, 6)}`),
                    slug: String(getValue(row, ['Slug']) || '').trim(),
                    title: String(getValue(row, ['Titulo', 'Título', 'Title']) || '').trim(),
                    family: String(getValue(row, ['Familia', 'Família', 'Family']) || 'geral').trim(),
                    cadence: String(getValue(row, ['Cadencia', 'Cadência', 'Cadence']) || 'sob_demanda').trim(),
                    description: String(getValue(row, ['Descricao', 'Descrição']) || '').trim(),
                    rationaleShort: String(getValue(row, ['Resumo_Base', 'Rationale_Short']) || '').trim(),
                    evidenceCard: {
                        summary: String(getValue(row, ['Resumo_Evidencia', 'Evidence_Summary']) || '').trim(),
                        principles: parseList(getValue(row, ['Principios', 'Princípios', 'Principles']), '||'),
                        references: parseJson(getValue(row, ['Referencias_JSON', 'References_JSON']), [])
                    },
                    steps: parseJson(getValue(row, ['Steps_JSON']), []).filter(step => step && step.title),
                    suggestedHabit: {
                        dimension: String(getValue(row, ['Habit_Dimension']) || '').trim(),
                        trackMode: String(getValue(row, ['Habit_Track_Mode']) || 'boolean').trim(),
                        targetValue: toNumber(getValue(row, ['Habit_Target_Value']), 1),
                        frequency: String(getValue(row, ['Habit_Frequency']) || '').trim(),
                        specificDays: parseList(getValue(row, ['Habit_Specific_Days']), ','),
                        intervalDays: toInt(getValue(row, ['Habit_Interval_Days']), 0),
                        dayOfMonth: toInt(getValue(row, ['Habit_Day_Of_Month']), 0),
                        scheduleStartDate: normalizeDateKey(getValue(row, ['Habit_Schedule_Start_Date'])),
                        startTime: normalizeTimeValue(getValue(row, ['Habit_Start_Time'])),
                        continuous: toBool(getValue(row, ['Habit_Continuous']), true),
                        trigger: String(getValue(row, ['Habit_Trigger']) || '').trim(),
                        routine: String(getValue(row, ['Habit_Routine']) || '').trim(),
                        reward: String(getValue(row, ['Habit_Reward']) || '').trim()
                    },
                    isBase: toBool(getValue(row, ['Is_Base']), false),
                    userEditable: !String(getValue(row, ['User_Editable']) || 'true').trim().toLowerCase().includes('false'),
                    createdAt: String(getValue(row, ['Criado_Em', 'Created_At']) || '').trim(),
                    updatedAt: String(getValue(row, ['Atualizado_Em', 'Updated_At']) || '').trim()
                })).filter(item => item.id && item.title);
            }

            const wsCad = workbook.Sheets['Cadencia'] || workbook.Sheets['Cadência'];
            if (wsCad) {
                const cadArr = XLSX.utils.sheet_to_json(wsCad);
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                window.sistemaVidaState.profile.cadence = {};
                cadArr.forEach(row => {
                    const key = String(getValue(row, ['Chave', 'Key']) || '').trim();
                    if (!key) return;
                    window.sistemaVidaState.profile.cadence[key] = {
                        ...(parseJson(getValue(row, ['Payload_JSON']), {}) || {}),
                        lastAt: String(getValue(row, ['Last_At', 'Ultimo_Em', 'Último_Em']) || '').trim()
                    };
                });
            }

            const wsHist = workbook.Sheets['Historico_BemEstar'] || workbook.Sheets['Histórico_BemEstar'];
            if (wsHist) {
                const histArr = XLSX.utils.sheet_to_json(wsHist);
                window.sistemaVidaState.wellbeingHistory = { wheel: {}, perma: {}, odyssey: {} };
                if (!window.sistemaVidaState.swls) {
                    window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
                } else {
                    window.sistemaVidaState.swls.history = {};
                }
                histArr.forEach(row => {
                    const kind = String(getValue(row, ['Tipo', 'Kind']) || '').trim().toLowerCase();
                    const dateKey = normalizeDateKey(getValue(row, ['Data', 'Date']));
                    const payload = parseJson(getValue(row, ['Payload_JSON']), {});
                    if (!kind || !dateKey) return;
                    if (kind === 'swls') {
                        if (!window.sistemaVidaState.swls) window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
                        window.sistemaVidaState.swls.history[dateKey] = payload;
                    } else {
                        if (!window.sistemaVidaState.wellbeingHistory[kind]) window.sistemaVidaState.wellbeingHistory[kind] = {};
                        window.sistemaVidaState.wellbeingHistory[kind][dateKey] = payload;
                    }
                });
            }

            const wsNotes = workbook.Sheets['Notas'];
            if (wsNotes) {
                const notesHeaders = getSheetHeaderSet(wsNotes);
                const notesArr = XLSX.utils.sheet_to_json(wsNotes);
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                window.sistemaVidaState.profile.notes = notesArr
                    .map(row => {
                        const title = String(getValue(row, ['Titulo', 'Título', 'Title']) || '').trim();
                        const body = String(getValue(row, ['Conteudo', 'Conteúdo', 'Corpo', 'Body']) || '').trim();
                        if (!title && !body) return null;

                        const usesVisibleLinkType = hasAnyHeader(notesHeaders, ['Vínculo Tipo']);
                        const usesVisibleLinkedTo = hasAnyHeader(notesHeaders, ['Vinculado a', 'Vínculo', 'Item vinculado']);
                        let entityType = usesVisibleLinkType
                            ? String(getValue(row, ['Vínculo Tipo']) || '').trim()
                            : String(getValue(row, ['Vinculo_Tipo', 'Vínculo_Tipo', 'Tipo_Vinculo', 'Tipo Vínculo']) || '').trim();
                        let entityId = usesVisibleLinkType
                            ? ''
                            : String(getValue(row, ['Vínculo ID', 'Vinculo_ID', 'Vínculo_ID', 'ID_Vinculo', 'ID Vínculo']) || '').trim();
                        const entityTitle = usesVisibleLinkedTo ? String(getValue(row, ['Vinculado a', 'Vínculo', 'Item vinculado']) || '').trim() : '';
                        const flatLinks = String(getValue(row, ['Vinculos', 'Vínculos']) || '').trim();
                        if (!usesVisibleLinkType && (!entityType || !entityId) && flatLinks) {
                            const [firstLink] = flatLinks.split(',').map(item => item.trim()).filter(Boolean);
                            if (firstLink && firstLink.includes(':')) {
                                const [parsedType, ...parsedIdParts] = firstLink.split(':');
                                entityType = entityType || parsedType;
                                entityId = entityId || parsedIdParts.join(':');
                            }
                        }
                        if (entityType && usesVisibleLinkedTo) {
                            const normalizedType = this.normalizeEntityType ? this.normalizeEntityType(entityType) : entityType;
                            const lookupMap = {
                                metas: metaIndex,
                                okrs: okrIndex,
                                macros: macroIndex,
                                micros: microIndex,
                                habits: habitIndex
                            };
                            entityId = resolveItemId(entityTitle, lookupMap[normalizedType]);
                            if (entityTitle && !entityId) importWarnings.push(`Notas: vínculo não encontrado "${entityTitle}" (${entityType})`);
                        }

                        return {
                            id: String(getValue(row, ['ID', 'Id', 'id']) || `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`),
                            title: title || 'Nota sem titulo',
                            body,
                            url: String(getValue(row, ['URL', 'Link']) || '').trim(),
                            tags: String(getValue(row, ['Tags', 'Etiquetas']) || '').split(',').map(tag => tag.trim()).filter(Boolean),
                            linkedTo: entityType && entityId
                                ? { entityType: this.normalizeEntityType ? this.normalizeEntityType(entityType) : entityType, entityId }
                                : null,
                            createdAt: String(getValue(row, ['Criada_Em', 'Criada Em', 'Created_At']) || new Date().toISOString()),
                            updatedAt: String(getValue(row, ['Atualizada_Em', 'Atualizada Em', 'Updated_At']) || getValue(row, ['Criada_Em', 'Criada Em', 'Created_At']) || new Date().toISOString())
                        };
                    })
                    .filter(Boolean);
            }

            // Finalização
            this.normalizeSwlsState();
            this.normalizePermaState();
            this.normalizeEntitiesState();
            this.normalizeDailyLogsState();
            this.normalizeDeepWorkState();
            this.ensureNotesState?.();
            this.ensureIdentityState?.();
            this.ensureHabitMaturityState?.();
            Object.entries(window.sistemaVidaState.reviews || {}).forEach(([weekKey, review]) => {
                this.updateIdentityWeeklyLogs?.(weekKey, review);
            });
            await window.app.saveState(false);
            if (importWarnings.length) console.warn('[Import warnings]', importWarnings);
            alert(importWarnings.length
                ? `Planilha importada com sucesso, com ${importWarnings.length} aviso(s) de vínculo ou dado incompleto.`
                : 'Planilha importada com sucesso.');
            window.app.switchView('painel');
            
        } catch (error) {
            console.error("Erro Padrão Ouro na importação:", error);
            alert(`Erro na importação: ${error.message}`);
        }
        
        event.target.value = '';
    },

exportToExcelFull: function() {
        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const state = window.sistemaVidaState;
        const now = new Date();
        const exportedAt = now.toISOString();

        // 0. Aba: Resumo
        const summaryData = [
            ["Campo", "Valor"],
            ["Exportado em", exportedAt],
            ["Versao do app", String(window.app?.appBuildVersion || "")],
            ["Perfil", String(state.profile?.name || "Sem nome")],
            ["Metas", Number((state.entities?.metas || []).length)],
            ["OKRs", Number((state.entities?.okrs || []).length)],
            ["Macros", Number((state.entities?.macros || []).length)],
            ["Micros", Number((state.entities?.micros || []).length)],
            ["Habitos", Number((state.habits || []).length)],
            ["Registros diarios", Number(Object.keys(state.dailyLogs || {}).length)],
            ["Revisoes", Number(Object.keys(state.reviews || {}).length)],
            ["Sessoes de foco", Number((state.deepWork?.sessions || []).length)],
            ["Planos semanais", Number(Object.keys(state.weekPlans || {}).length)],
            ["Notas", Number((state.profile?.notes || []).length)],
            ["Protocolos", Number((state.protocols || []).length)],
            ["Cadencias", Number(Object.keys(state.profile?.cadence || {}).length)]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 26 }, { wch: 64 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

        // 1. Aba: Planos
        const planosCol = ["ID", "Tipo", "Dimensão", "Título", "Status", "Concluida", "Contexto_Indicador", "Prazo", "Progresso", "ID_Pai", "Critério_Sucesso", "Desafio", "Comprometimento", "Key_Results", "Protocol_ID", "Habito_Origem_ID", "Protocolo_Origem_ID", "Passos", "Steps_JSON", "Step_Logs_JSON", "Esforco", "Minutos_Estimados", "Hora_Inicio", "Notas"];
        const planosData = [planosCol];
        const types = ['metas', 'okrs', 'macros', 'micros'];
        types.forEach(t => {
            (state.entities[t] || []).forEach(e => {
                const context = e.purpose || e.description || e.indicator || "";
                const parentId = t === 'okrs'
                    ? (e.metaId || "")
                    : t === 'macros'
                        ? (e.okrId || "")
                        : t === 'micros'
                            ? (e.macroId || "")
                            : "";
                const keyResultsText = this.serializeKeyResultsText(e.keyResults);
                const linkedNoteTitles = this.getLinkedNotes(t, e.id)
                    .map(n => n.title || '')
                    .filter(Boolean)
                    .join('; ');
                planosData.push([
                    e.id, t.slice(0, -1), e.dimension || "Geral", e.title, e.status || "", e.completed ? 'sim' : 'nao', context, e.prazo || "", e.progress || 0, parentId,
                    e.successCriteria || "", e.challengeLevel || "", e.commitmentLevel || "", keyResultsText,
                    e.protocolId || "", e.sourceHabitId || "", e.sourceProtocolId || "",
                    Array.isArray(e.steps) ? e.steps.join(' || ') : "", JSON.stringify(Array.isArray(e.steps) ? e.steps : []), JSON.stringify(e.stepLogs || {}),
                    e.effort || "", e.estimatedMinutes || "", e.startTime || "", linkedNoteTitles
                ]);
            });
        });
        const wsPlanos = XLSX.utils.aoa_to_sheet(planosData);
        wsPlanos['!cols'] = [{wch:15}, {wch:10}, {wch:15}, {wch:40}, {wch:12}, {wch:10}, {wch:40}, {wch:15}, {wch:10}, {wch:15}, {wch:30}, {wch:12}, {wch:16}, {wch:42}, {wch:18}, {wch:18}, {wch:20}, {wch:32}, {wch:40}, {wch:24}, {wch:12}, {wch:14}, {wch:12}, {wch:30}];
        XLSX.utils.book_append_sheet(wb, wsPlanos, "Planos");

        // 2. Aba: Propósito
        const propCol = ["Categoria", "Subcategoria", "Chave", "Texto_Preenchido", "Dimensao", "Descricao", "Evidencia", "Risco_Excesso", "Pratica", "Gatilho", "Impacto", "Resposta_Desejada", "Obstaculo", "Se_Entao", "ID_Item", "Habitos_Vinculados", "Logs_Semanais_JSON", "Criado_Em", "Atualizado_Em"];
        const propData = [propCol];

        const emptyPropExtras = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
        propData.push(["Identidade", "Valores", "Valores Pessoais", (state.profile.values || []).join(", "), ...emptyPropExtras]);

        const ikigaiM = {
            love: "O que ama",
            good: "No que é bom",
            need: "O que o mundo precisa",
            paid: "Pelo que pode ser pago",
            paixao: "Paixão (Amo + Bom)",
            profissao: "Profissão (Bom + Pago)",
            vocacao: "Vocação (Pago + Mundo)",
            missao: "Missão (Amo + Mundo)",
            sintese: "Síntese Ikigai"
        };
        Object.entries(ikigaiM).forEach(([k, label]) => {
            propData.push(["Ikigai", "", label, state.profile.ikigai?.[k] || "", ...emptyPropExtras]);
        });
        propData.push(["Ikigai", "", "Síntese Ikigai Resumo", state.profile.ikigai?.sinteseResumo || "", ...emptyPropExtras]);

        const visionM = { saude: "Visão Saúde", carreira: "Visão Carreira", intelecto: "Visão Intelectual", quote: "Citação Inspiradora" };
        Object.entries(visionM).forEach(([k, label]) => {
            propData.push(["Visão", "", label, state.profile.vision?.[k] || "", ...emptyPropExtras]);
        });
        propData.push(["Visão", "", "Visão Saúde Resumo", state.profile.vision?.saudeResumo || "", ...emptyPropExtras]);
        propData.push(["Visão", "", "Visão Carreira Resumo", state.profile.vision?.carreiraResumo || "", ...emptyPropExtras]);
        propData.push(["Visão", "", "Visão Intelectual Resumo", state.profile.vision?.intelectoResumo || "", ...emptyPropExtras]);

        const legacyM = { familia: "Legado Família", profissao: "Legado Profissional", mundo: "Legado Mundo" };
        Object.entries(legacyM).forEach(([k, label]) => {
            propData.push(["Legado", "", label, state.profile.legacyObj?.[k] || "", ...emptyPropExtras]);
        });
        propData.push(["Legado", "", "Legado Família Resumo", state.profile.legacyObj?.familiaResumo || "", ...emptyPropExtras]);
        propData.push(["Legado", "", "Legado Profissional Resumo", state.profile.legacyObj?.profissaoResumo || "", ...emptyPropExtras]);
        propData.push(["Legado", "", "Legado Mundo Resumo", state.profile.legacyObj?.mundoResumo || "", ...emptyPropExtras]);

        // Forças e Sombras (Identidade)
        (state.profile.identity?.strengths || []).forEach(s => {
            propData.push(["Identidade", "Força", s.title || "", s.evidence || s.practice || s.excessRisk || "", s.dimension || "", s.description || "", s.evidence || "", s.excessRisk || "", s.practice || "", "", "", "", "", String(s.id || ""), Array.isArray(s.linkedHabitIds) ? s.linkedHabitIds.join(', ') : "", JSON.stringify(s.weeklyLogs || {}), String(s.createdAt || ""), String(s.updatedAt || "")]);
        });
        (state.profile.identity?.shadows || []).forEach(s => {
            propData.push(["Identidade", "Sombra", s.title || "", s.impact || s.desiredResponse || s.trigger || "", s.dimension || "", s.description || "", "", "", "", s.trigger || "", s.impact || "", s.desiredResponse || "", s.obstacle || "", s.ifThen || "", String(s.id || ""), Array.isArray(s.linkedHabitIds) ? s.linkedHabitIds.join(', ') : "", JSON.stringify(s.weeklyLogs || {}), String(s.createdAt || ""), String(s.updatedAt || "")]);
        });

        // Roda da Vida
        Object.entries(state.dimensions || {}).forEach(([dim, data]) => {
            propData.push(["Roda da Vida", "", dim, data.score || 0, ...emptyPropExtras]);
        });

        const permaM = { P: "Emoções Positivas (P)", E: "Engajamento (E)", R: "Relacionamentos (R)", M: "Significado (M)", A: "Realização (A)" };
        Object.entries(permaM).forEach(([k, label]) => {
            propData.push(["PERMA", "", label, state.perma?.[k] || 0, ...emptyPropExtras]);
        });

        const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
        propData.push(["SWLS", "", "Score", swls.lastScore || 0, ...emptyPropExtras]);
        propData.push(["SWLS", "", "Data", swls.lastDate || "", ...emptyPropExtras]);
        (swls.answers || []).slice(0, 5).forEach((answer, idx) => {
            propData.push(["SWLS", "", `Q${idx + 1}`, answer, ...emptyPropExtras]);
        });

        const wsProp = XLSX.utils.aoa_to_sheet(propData);
        wsProp['!cols'] = [{wch:15}, {wch:14}, {wch:30}, {wch:60}, {wch:14}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:24}, {wch:18}, {wch:22}, {wch:28}, {wch:24}, {wch:24}];
        XLSX.utils.book_append_sheet(wb, wsProp, "Propósito");

        // 2b. Aba: Odyssey
        const odyCol = ["Cenario_Key", "Cenário", "Titulo", "Texto"];
        const odyData = [odyCol];
        const ody = state.profile.odyssey || {};
        const odyTitles = state.profile.odysseyTitles || {};
        const odyLabels = { cenarioA: "Cenário A — Caminho Principal", cenarioB: "Cenário B — Plano Alternativo", cenarioC: "Cenário C — E se tudo mudasse?" };
        Object.entries(odyLabels).forEach(([k, label]) => {
            odyData.push([k, label, odyTitles[k] || "", ody[k] || ""]);
        });
        const wsOdy = XLSX.utils.aoa_to_sheet(odyData);
        wsOdy['!cols'] = [{wch:14}, {wch:40}, {wch:24}, {wch:80}];
        XLSX.utils.book_append_sheet(wb, wsOdy, "Odyssey");

        // 3. Aba: Hábitos
        const habCol = ["ID", "Dimensão", "Título", "Descricao", "Gatilho", "Rotina", "Recompensa", "Status", "Concluido", "Track_Mode", "Target_Value", "Frequencia", "Dias_Especificos", "Intervalo_Dias", "Dia_Do_Mes", "Data_Inicio_Agenda", "Hora_Inicio", "Minutos_Estimados", "Continuo", "Protocol_ID", "Steps", "Logs_JSON", "Step_Logs_JSON", "Source_Type", "Source_ID", "Source_Strength_ID", "Source_Shadow_ID", "Is_Key", "Maturity", "Maturity_Meta_JSON", "Reminder_Enabled", "Reminder_Time", "Reminder_Interval_Enabled", "Reminder_Window_Start", "Reminder_Window_End", "Reminder_Interval_Min", "Criado_Em", "Atualizado_Em"];
        const habData = [habCol];
        (state.habits || []).forEach(h => {
            habData.push([
                h.id,
                h.dimension || "Geral",
                h.title,
                h.description || "",
                h.trigger || "",
                h.routine || h.context || "",
                h.reward || "",
                h.status || "",
                h.completed ? "sim" : "nao",
                h.trackMode || "boolean",
                h.targetValue || 1,
                h.frequency || "daily",
                Array.isArray(h.specificDays) ? h.specificDays.join(', ') : "",
                h.intervalDays || 0,
                h.dayOfMonth || 0,
                h.scheduleStartDate || "",
                h.startTime || "",
                h.estimatedMinutes || "",
                h.continuous === false ? "nao" : "sim",
                h.protocolId || "",
                Array.isArray(h.steps) ? h.steps.join(' || ') : "",
                JSON.stringify(h.logs || {}),
                JSON.stringify(h.stepLogs || {}),
                h.sourceType || "",
                h.sourceId || "",
                h.sourceStrengthId || "",
                h.sourceShadowId || "",
                h.isKey ? "sim" : "nao",
                h.maturity || "forming",
                JSON.stringify(h.maturityMeta || {}),
                h.reminderEnabled ? "sim" : "nao",
                h.reminderTime || "",
                h.reminderIntervalEnabled ? "sim" : "nao",
                h.reminderWindowStart || "",
                h.reminderWindowEnd || "",
                h.reminderIntervalMin || 0,
                h.createdAt || "",
                h.updatedAt || ""
            ]);
        });
        const wsHabits = XLSX.utils.aoa_to_sheet(habData);
        wsHabits['!cols'] = [{wch:15}, {wch:15}, {wch:32}, {wch:28}, {wch:26}, {wch:32}, {wch:24}, {wch:12}, {wch:10}, {wch:12}, {wch:12}, {wch:12}, {wch:18}, {wch:12}, {wch:12}, {wch:16}, {wch:12}, {wch:16}, {wch:10}, {wch:18}, {wch:32}, {wch:22}, {wch:22}, {wch:12}, {wch:18}, {wch:18}, {wch:18}, {wch:10}, {wch:12}, {wch:24}, {wch:10}, {wch:12}, {wch:14}, {wch:16}, {wch:16}, {wch:14}, {wch:22}, {wch:22}];
        XLSX.utils.book_append_sheet(wb, wsHabits, "Hábitos");

        // 4. Aba: Diário (inclui check-in + shutdown por dimensão)
        const dims = ['Saúde','Mente','Carreira','Finanças','Relacionamentos','Família','Lazer','Propósito'];
        const logCol = ["Data", "Sono_h", "Qualidade_Sono", "Energia", "Humor", "Estresse", "Emoção", "Checkin_Saved_At", "Intenção", "Gratidão", "O_Que_Funcionou", "O_Que_Aprendi", "Shutdown_1", "Checkin_JSON", "Log_JSON",
            ...dims.map(d => `Shutdown_${d}`)];
        const logData = [logCol];
        // Merge checkins and logs by date
        const allDates = new Set([
            ...Object.keys(state.dailyLogs || {}),
            ...(state.profile.dailyCheckins || []).map(c => c.date)
        ]);
        [...allDates].sort().forEach(date => {
            const log = (state.dailyLogs || {})[date] || {};
            const checkin = (state.profile.dailyCheckins || []).find(c => c.date === date) || {};
            const dimNotes = log.dimensionNotes || {};
            logData.push([
                date,
                checkin.sleepHours || "",
                checkin.sleepQuality || "",
                checkin.energy || log.energy || "",
                checkin.mood || "",
                checkin.stress || "",
                checkin.emotion || "",
                checkin.savedAt || "",
                log.focus || "",
                log.gratidao || "",
                log.funcionou || "",
                log.aprendi || "",
                Array.isArray(log.shutdown) ? (log.shutdown[0] || "") : "",
                JSON.stringify(checkin || {}),
                JSON.stringify(log || {}),
                ...dims.map(d => dimNotes[d] || "")
            ]);
        });
        const wsDiario = XLSX.utils.aoa_to_sheet(logData);
        wsDiario['!cols'] = [{wch:12}, {wch:8}, {wch:10}, {wch:8}, {wch:8}, {wch:8}, {wch:12}, {wch:24}, {wch:40}, {wch:40}, {wch:40}, {wch:40}, {wch:26}, {wch:24}, {wch:24},
            ...dims.map(() => ({wch:30}))];
        XLSX.utils.book_append_sheet(wb, wsDiario, "Diário");

        // 4b. Aba: Hábitos — com histórico dos últimos 30 dias
        const habDays = Array.from({length:30}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            return app.getLocalDateKey(d);
        }).reverse();
        const habCol2 = ["ID", "Dimensão", "Título", "Gatilho", "Rotina", "Recompensa", "Logs_JSON", "Step_Logs_JSON", ...habDays];
        const habData2 = [habCol2];
        (state.habits || []).forEach(h => {
            habData2.push([
                h.id, h.dimension || "Geral", h.title, h.trigger || "", h.routine || h.context || "", h.reward || "", JSON.stringify(h.logs || {}), JSON.stringify(h.stepLogs || {}),
                ...habDays.map(dk => app.isHabitDoneOnDate(h, dk) ? 1 : 0)
            ]);
        });
        const wsHab2 = XLSX.utils.aoa_to_sheet(habData2);
        wsHab2['!cols'] = [{wch:15},{wch:15},{wch:32},{wch:26},{wch:32},{wch:24},{wch:22},{wch:22},...habDays.map(()=>({wch:10}))];
        XLSX.utils.book_append_sheet(wb, wsHab2, "Hábitos_Histórico");

        // 5. Aba: Revisões
        const revCol = ["Data", "O_Que_Planejei", "O_Que_Executei", "Aprendizado", "Ajuste", "Intencao_Proxima", "Strength_ID", "Shadow_ID", "Resposta_Praticada", "Ajuste_Habito", "Salvo_Em"];
        const revData = [revCol];
        Object.entries(state.reviews || {}).sort().forEach(([date, rev]) => {
            revData.push([
                date,
                rev.q1 || "",
                rev.q2 || "",
                rev.q3 || "",
                rev.q4 || "",
                rev.q5 || "",
                rev.strengthId || "",
                rev.shadowId || "",
                rev.responsePracticed || "",
                rev.habitAdjustment || "",
                rev.savedAt || ""
            ]);
        });
        const wsRevisoes = XLSX.utils.aoa_to_sheet(revData);
        wsRevisoes['!cols'] = [{wch:12}, {wch:40}, {wch:40}, {wch:40}, {wch:40}, {wch:40}, {wch:18}, {wch:18}, {wch:30}, {wch:30}, {wch:24}];
        XLSX.utils.book_append_sheet(wb, wsRevisoes, "Revisões");

        // 6. Aba: Planos Semanais
        const weeklyCol = ["Semana", "Intencao", "Micros_Selecionadas", "Feito_Em", "Criado_Em", "Origem", "Saved_At_Epoch"];
        const weeklyData = [weeklyCol];
        Object.entries(state.weekPlans || {}).sort().forEach(([weekKey, plan]) => {
            const selected = Array.isArray(plan?.selectedMicros) ? plan.selectedMicros : [];
                weeklyData.push([
                    weekKey,
                    String(plan?.intention || plan?.focus || ""),
                    selected.join(", "),
                    String(plan?.updatedAt || plan?.createdAt || ""),
                    String(plan?.createdAt || ""),
                    String(plan?.origin || ""),
                    Number(plan?.savedAt || 0)
                ]);
            });
        const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyData);
        wsWeekly['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 48 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsWeekly, "Planos_Semanais");

        // 7. Aba: Foco Profundo
        const focusCol = ["Inicio", "Fim", "Minutos_Foco", "Minutos_Pausa", "Focus_Sec", "Break_Sec", "Mode", "Micro_ID", "Intencao", "Concluida"];
        const focusData = [focusCol];
        (state.deepWork?.sessions || []).forEach((session) => {
            const focusMin = Math.max(0, Math.round((Number(session?.focusSec) || 0) / 60));
            const breakMin = Math.max(0, Math.round((Number(session?.breakSec) || 0) / 60));
            focusData.push([
                String(session?.startedAt || ""),
                String(session?.endedAt || ""),
                focusMin,
                breakMin,
                Number(session?.focusSec || 0),
                Number(session?.breakSec || 0),
                String(session?.mode || 'focus'),
                String(session?.microId || ""),
                String(session?.intention || ""),
                session?.completed ? "sim" : "nao"
            ]);
        });
        const wsFocus = XLSX.utils.aoa_to_sheet(focusData);
        wsFocus['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsFocus, "Foco_Profundo");

        // 8. Aba: Notas
        const notesCol = ["ID", "Titulo", "Conteudo", "URL", "Tags", "Criada_Em", "Atualizada_Em", "Vinculo_Tipo", "Vinculo_ID", "Vinculos"];
        const notesData = [notesCol];
        (state.profile?.notes || []).forEach((note) => {
            const linkedType = String(note?.linkedTo?.entityType || "");
            const linkedId = String(note?.linkedTo?.entityId || "");
            const flatLink = linkedType && linkedId ? `${linkedType}:${linkedId}` : "";
            notesData.push([
                String(note?.id || ""),
                String(note?.title || ""),
                String(note?.body || note?.content || ""),
                String(note?.url || ""),
                Array.isArray(note?.tags) ? note.tags.join(", ") : String(note?.tags || ""),
                String(note?.createdAt || ""),
                String(note?.updatedAt || ""),
                linkedType,
                linkedId,
                flatLink
            ]);
        });
        const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
        wsNotes['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 70 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 32 }];
        XLSX.utils.book_append_sheet(wb, wsNotes, "Notas");

        // 9. Aba: Cadencia
        const cadenceCol = ["Chave", "Last_At", "Payload_JSON"];
        const cadenceData = [cadenceCol];
        Object.entries(state.profile?.cadence || {}).forEach(([key, payload]) => {
            cadenceData.push([
                key,
                String(payload?.lastAt || ""),
                JSON.stringify(payload || {})
            ]);
        });
        const wsCadence = XLSX.utils.aoa_to_sheet(cadenceData);
        wsCadence['!cols'] = [{wch:18},{wch:18},{wch:28}];
        XLSX.utils.book_append_sheet(wb, wsCadence, "Cadencia");

        // 10. Aba: Historico de Bem-Estar
        const historyCol = ["Tipo", "Data", "Payload_JSON"];
        const historyData = [historyCol];
        Object.entries(state.wellbeingHistory?.wheel || {}).forEach(([dateKey, payload]) => historyData.push(["wheel", dateKey, JSON.stringify(payload || {})]));
        Object.entries(state.wellbeingHistory?.perma || {}).forEach(([dateKey, payload]) => historyData.push(["perma", dateKey, JSON.stringify(payload || {})]));
        Object.entries(state.wellbeingHistory?.odyssey || {}).forEach(([dateKey, payload]) => historyData.push(["odyssey", dateKey, JSON.stringify(payload || {})]));
        Object.entries(state.swls?.history || {}).forEach(([dateKey, payload]) => historyData.push(["swls", dateKey, JSON.stringify(payload || {})]));
        const wsHistory = XLSX.utils.aoa_to_sheet(historyData);
        wsHistory['!cols'] = [{wch:14},{wch:14},{wch:28}];
        XLSX.utils.book_append_sheet(wb, wsHistory, "Historico_BemEstar");

        // 11. Aba: Protocolos
        const protocolCol = ["ID", "Slug", "Titulo", "Familia", "Cadencia", "Descricao", "Resumo_Base", "Resumo_Evidencia", "Principios", "Referencias_JSON", "Steps_JSON", "Habit_Dimension", "Habit_Track_Mode", "Habit_Target_Value", "Habit_Frequency", "Habit_Specific_Days", "Habit_Interval_Days", "Habit_Day_Of_Month", "Habit_Schedule_Start_Date", "Habit_Start_Time", "Habit_Continuous", "Habit_Trigger", "Habit_Routine", "Habit_Reward", "Is_Base", "User_Editable", "Criado_Em", "Atualizado_Em"];
        const protocolData = [protocolCol];
        (state.protocols || []).forEach((protocol) => {
            const evidence = protocol?.evidenceCard || {};
            const suggestedHabit = protocol?.suggestedHabit || {};
            protocolData.push([
                String(protocol?.id || ""),
                String(protocol?.slug || ""),
                String(protocol?.title || ""),
                String(protocol?.family || ""),
                String(protocol?.cadence || ""),
                String(protocol?.description || ""),
                String(protocol?.rationaleShort || ""),
                String(evidence?.summary || ""),
                Array.isArray(evidence?.principles) ? evidence.principles.join(' || ') : "",
                JSON.stringify(Array.isArray(evidence?.references) ? evidence.references : []),
                JSON.stringify(Array.isArray(protocol?.steps) ? protocol.steps : []),
                String(suggestedHabit?.dimension || ""),
                String(suggestedHabit?.trackMode || "boolean"),
                Number(suggestedHabit?.targetValue || 1),
                String(suggestedHabit?.frequency || ""),
                Array.isArray(suggestedHabit?.specificDays) ? suggestedHabit.specificDays.join(', ') : "",
                Number(suggestedHabit?.intervalDays || 0),
                Number(suggestedHabit?.dayOfMonth || 0),
                String(suggestedHabit?.scheduleStartDate || ""),
                String(suggestedHabit?.startTime || ""),
                suggestedHabit?.continuous === false ? "nao" : "sim",
                String(suggestedHabit?.trigger || ""),
                String(suggestedHabit?.routine || ""),
                String(suggestedHabit?.reward || ""),
                protocol?.isBase ? "sim" : "nao",
                protocol?.userEditable === false ? "nao" : "sim",
                String(protocol?.createdAt || ""),
                String(protocol?.updatedAt || "")
            ]);
        });
        const wsProtocols = XLSX.utils.aoa_to_sheet(protocolData);
        wsProtocols['!cols'] = [{wch:18},{wch:18},{wch:28},{wch:14},{wch:14},{wch:40},{wch:28},{wch:32},{wch:30},{wch:26},{wch:28},{wch:16},{wch:16},{wch:14},{wch:14},{wch:18},{wch:14},{wch:14},{wch:18},{wch:14},{wch:12},{wch:24},{wch:24},{wch:24},{wch:10},{wch:12},{wch:22},{wch:22}];
        XLSX.utils.book_append_sheet(wb, wsProtocols, "Protocolos");

        XLSX.writeFile(wb, "SISTEMA_VIDA_BACKUP_COMPLETO.xls", { bookType: "biff8" });
        console.log("Exportação Excel completa (.xls) concluída.");
    },
exportToExcel: function() {
        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const state = window.sistemaVidaState;
        const exportedAt = new Date().toISOString();
        const setCols = (ws, visibleWidths, hiddenWidths = []) => {
            ws['!cols'] = [
                ...visibleWidths.map((wch) => ({ wch })),
                ...hiddenWidths.map((wch) => ({ wch, hidden: true }))
            ];
        };
        const normalizeTypeLabel = (type) => ({
            metas: 'Meta',
            okrs: 'OKR',
            macros: 'Macro',
            micros: 'Micro'
        }[type] || type);
        const entityMaps = {
            metas: new Map((state.entities?.metas || []).map((item) => [String(item.id || ''), item])),
            okrs: new Map((state.entities?.okrs || []).map((item) => [String(item.id || ''), item])),
            macros: new Map((state.entities?.macros || []).map((item) => [String(item.id || ''), item])),
            micros: new Map((state.entities?.micros || []).map((item) => [String(item.id || ''), item])),
            habits: new Map((state.habits || []).map((item) => [String(item.id || ''), item]))
        };
        const strengthMap = new Map((state.profile?.identity?.strengths || []).map((item) => [String(item.id || ''), item]));
        const shadowMap = new Map((state.profile?.identity?.shadows || []).map((item) => [String(item.id || ''), item]));
        const getEntityTitle = (entityType, entityId) => {
            if (!entityType || !entityId) return '';
            const normalizedType = this.normalizeEntityType ? this.normalizeEntityType(entityType) : entityType;
            return String(entityMaps[normalizedType]?.get(String(entityId || ''))?.title || '');
        };
        const formatEntityStatus = (status) => ({
            done: 'Concluída',
            in_progress: 'Em andamento',
            pending: 'Pendente',
            abandoned: 'Abandonada'
        }[String(status || '')] || String(status || ''));
        const formatHabitStatus = (status) => ({
            active: 'Ativo',
            inactive: 'Inativo',
            paused: 'Pausado',
            archived: 'Arquivado'
        }[String(status || '')] || String(status || ''));

        const summaryData = [
            ["Campo", "Valor"],
            ["Tipo de planilha", "Amigável para editar/importar"],
            ["Observação", "Os campos extras ocultos são auxiliares. O usuário pode editar apenas as colunas visíveis."],
            ["Exportado em", exportedAt],
            ["Versão do app", String(window.app?.appBuildVersion || "")],
            ["Perfil", String(state.profile?.name || "Sem nome")],
            ["Metas", Number((state.entities?.metas || []).length)],
            ["OKRs", Number((state.entities?.okrs || []).length)],
            ["Macros", Number((state.entities?.macros || []).length)],
            ["Micros", Number((state.entities?.micros || []).length)],
            ["Hábitos", Number((state.habits || []).length)],
            ["Registros diários", Number(Object.keys(state.dailyLogs || {}).length)],
            ["Revisões", Number(Object.keys(state.reviews || {}).length)],
            ["Sessões de foco", Number((state.deepWork?.sessions || []).length)],
            ["Planos semanais", Number(Object.keys(state.weekPlans || {}).length)],
            ["Notas", Number((state.profile?.notes || []).length)]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        setCols(wsSummary, [28, 72]);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

        const planVisibleCols = ["Tipo", "Dimensão", "Título", "Status", "Concluída", "Plano Pai", "Contexto", "Prazo", "Progresso", "Critério de Sucesso", "Desafio", "Comprometimento", "Resultados-chave", "Passos", "Esforço", "Minutos estimados", "Hora", "Notas"];
        const planHiddenCols = ["ID", "ID_Pai", "Protocol_ID", "Habito_Origem_ID", "Protocolo_Origem_ID", "Steps_JSON", "Step_Logs_JSON"];
        const planRows = [planVisibleCols.concat(planHiddenCols)];
        ['metas', 'okrs', 'macros', 'micros'].forEach((type) => {
            (state.entities?.[type] || []).forEach((item) => {
                const parentType = type === 'okrs' ? 'metas' : type === 'macros' ? 'okrs' : type === 'micros' ? 'macros' : '';
                const parentId = type === 'okrs' ? item.metaId : type === 'macros' ? item.okrId : type === 'micros' ? item.macroId : '';
                const parentTitle = parentType ? String(entityMaps[parentType]?.get(String(parentId || ''))?.title || '') : '';
                const context = item.purpose || item.description || item.indicator || "";
                const linkedNoteTitles = this.getLinkedNotes(type, item.id).map((note) => note.title || '').filter(Boolean).join('; ');
                planRows.push([
                    normalizeTypeLabel(type),
                    item.dimension || "Geral",
                    item.title || "",
                    formatEntityStatus(item.status),
                    item.completed ? "sim" : "nao",
                    parentTitle,
                    context,
                    item.prazo || "",
                    item.progress || 0,
                    item.successCriteria || "",
                    item.challengeLevel || "",
                    item.commitmentLevel || "",
                    this.serializeKeyResultsText(item.keyResults),
                    Array.isArray(item.steps) ? item.steps.join(' || ') : "",
                    item.effort || "",
                    item.estimatedMinutes || "",
                    item.startTime || "",
                    linkedNoteTitles,
                    item.id || "",
                    parentId || "",
                    item.protocolId || "",
                    item.sourceHabitId || "",
                    item.sourceProtocolId || "",
                    JSON.stringify(Array.isArray(item.steps) ? item.steps : []),
                    JSON.stringify(item.stepLogs || {})
                ]);
            });
        });
        const wsPlans = XLSX.utils.aoa_to_sheet(planRows);
        setCols(wsPlans, [12, 14, 32, 14, 12, 28, 40, 14, 10, 28, 10, 16, 40, 30, 14, 16, 12, 32], [16, 16, 18, 18, 20, 26, 24]);
        XLSX.utils.book_append_sheet(wb, wsPlans, "Planos");

        const purposeVisibleCols = ["Categoria", "Tipo", "Título", "Texto", "Dimensão", "Descrição", "Evidência", "Risco de Excesso", "Prática", "Gatilho", "Impacto", "Resposta Desejada", "Obstáculo", "Se-Então"];
        const purposeHiddenCols = ["ID_Item", "Habitos_Vinculados", "Logs_Semanais_JSON", "Criado_Em", "Atualizado_Em"];
        const purposeRows = [purposeVisibleCols.concat(purposeHiddenCols)];
        const addPurposeRow = (row) => purposeRows.push([...row.visible, ...row.hidden]);
        addPurposeRow({
            visible: ["Identidade", "Valores", "Valores Pessoais", (state.profile?.values || []).join(", "), "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        });
        const ikigaiMap = {
            love: "O que ama",
            good: "No que é bom",
            need: "O que o mundo precisa",
            paid: "Pelo que pode ser pago",
            paixao: "Paixão (Amo + Bom)",
            profissao: "Profissão (Bom + Pago)",
            vocacao: "Vocação (Pago + Mundo)",
            missao: "Missão (Amo + Mundo)",
            sintese: "Síntese Ikigai",
            sinteseResumo: "Síntese Ikigai Resumo"
        };
        Object.entries(ikigaiMap).forEach(([key, label]) => addPurposeRow({
            visible: ["Ikigai", "", label, state.profile?.ikigai?.[key] || "", "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        const visionMap = {
            saude: "Visão Saúde",
            carreira: "Visão Carreira",
            intelecto: "Visão Intelectual",
            quote: "Citação Inspiradora",
            saudeResumo: "Visão Saúde Resumo",
            carreiraResumo: "Visão Carreira Resumo",
            intelectoResumo: "Visão Intelectual Resumo"
        };
        Object.entries(visionMap).forEach(([key, label]) => addPurposeRow({
            visible: ["Visão", "", label, state.profile?.vision?.[key] || "", "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        const legacyMap = {
            familia: "Legado Família",
            profissao: "Legado Profissional",
            mundo: "Legado Mundo",
            familiaResumo: "Legado Família Resumo",
            profissaoResumo: "Legado Profissional Resumo",
            mundoResumo: "Legado Mundo Resumo"
        };
        Object.entries(legacyMap).forEach(([key, label]) => addPurposeRow({
            visible: ["Legado", "", label, state.profile?.legacyObj?.[key] || "", "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        (state.profile?.identity?.strengths || []).forEach((item) => addPurposeRow({
            visible: ["Identidade", "Força", item.title || "", item.evidence || item.practice || item.excessRisk || "", item.dimension || "", item.description || "", item.evidence || "", item.excessRisk || "", item.practice || "", "", "", "", "", ""],
            hidden: [String(item.id || ""), Array.isArray(item.linkedHabitIds) ? item.linkedHabitIds.join(', ') : "", JSON.stringify(item.weeklyLogs || {}), String(item.createdAt || ""), String(item.updatedAt || "")]
        }));
        (state.profile?.identity?.shadows || []).forEach((item) => addPurposeRow({
            visible: ["Identidade", "Sombra", item.title || "", item.impact || item.desiredResponse || item.trigger || "", item.dimension || "", item.description || "", "", "", "", item.trigger || "", item.impact || "", item.desiredResponse || "", item.obstacle || "", item.ifThen || ""],
            hidden: [String(item.id || ""), Array.isArray(item.linkedHabitIds) ? item.linkedHabitIds.join(', ') : "", JSON.stringify(item.weeklyLogs || {}), String(item.createdAt || ""), String(item.updatedAt || "")]
        }));
        Object.entries(state.dimensions || {}).forEach(([dimension, data]) => addPurposeRow({
            visible: ["Roda da Vida", "", dimension, data.score || 0, "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        const permaMap = { P: "Emoções Positivas (P)", E: "Engajamento (E)", R: "Relacionamentos (R)", M: "Significado (M)", A: "Realização (A)" };
        Object.entries(permaMap).forEach(([key, label]) => addPurposeRow({
            visible: ["PERMA", "", label, state.perma?.[key] || 0, "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "" };
        addPurposeRow({ visible: ["SWLS", "", "Score", swls.lastScore || 0, "", "", "", "", "", "", "", "", "", ""], hidden: ["", "", "", "", ""] });
        addPurposeRow({ visible: ["SWLS", "", "Data", swls.lastDate || "", "", "", "", "", "", "", "", "", "", ""], hidden: ["", "", "", "", ""] });
        (swls.answers || []).slice(0, 5).forEach((answer, index) => addPurposeRow({
            visible: ["SWLS", "", `Q${index + 1}`, answer, "", "", "", "", "", "", "", "", "", ""],
            hidden: ["", "", "", "", ""]
        }));
        const wsPurpose = XLSX.utils.aoa_to_sheet(purposeRows);
        setCols(wsPurpose, [15, 14, 30, 60, 14, 24, 24, 22, 22, 22, 22, 24, 22, 22], [18, 22, 28, 22, 22]);
        XLSX.utils.book_append_sheet(wb, wsPurpose, "Propósito");

        const odysseyVisibleCols = ["Cenário", "Título", "Texto"];
        const odysseyHiddenCols = ["Cenario_Key"];
        const odysseyRows = [odysseyVisibleCols.concat(odysseyHiddenCols)];
        const odysseyLabels = { cenarioA: "Cenário A — Caminho Principal", cenarioB: "Cenário B — Plano Alternativo", cenarioC: "Cenário C — E se tudo mudasse?" };
        Object.entries(odysseyLabels).forEach(([key, label]) => {
            odysseyRows.push([label, state.profile?.odysseyTitles?.[key] || "", state.profile?.odyssey?.[key] || "", key]);
        });
        const wsOdyssey = XLSX.utils.aoa_to_sheet(odysseyRows);
        setCols(wsOdyssey, [36, 28, 90], [14]);
        XLSX.utils.book_append_sheet(wb, wsOdyssey, "Odyssey");

        const habitVisibleCols = ["Dimensão", "Título", "Descrição", "Gatilho", "Rotina", "Recompensa", "Status", "Concluído", "Meta", "Frequência", "Dias específicos", "Intervalo em dias", "Dia do mês", "Data de início", "Hora", "Minutos estimados", "Contínuo", "Passos", "Hábito-chave"];
        const habitHiddenCols = ["ID", "Track_Mode", "Target_Value", "Protocol_ID", "Logs_JSON", "Step_Logs_JSON", "Source_Type", "Source_ID", "Source_Strength_ID", "Source_Shadow_ID", "Maturity", "Maturity_Meta_JSON", "Reminder_Enabled", "Reminder_Time", "Reminder_Interval_Enabled", "Reminder_Window_Start", "Reminder_Window_End", "Reminder_Interval_Min", "Criado_Em", "Atualizado_Em"];
        const habitRows = [habitVisibleCols.concat(habitHiddenCols)];
        (state.habits || []).forEach((habit) => {
            habitRows.push([
                habit.dimension || "Geral",
                habit.title || "",
                habit.description || "",
                habit.trigger || "",
                habit.routine || habit.context || "",
                habit.reward || "",
                formatHabitStatus(habit.status),
                habit.completed ? "sim" : "nao",
                habit.targetValue || 1,
                habit.frequency || "daily",
                Array.isArray(habit.specificDays) ? habit.specificDays.join(', ') : "",
                habit.intervalDays || 0,
                habit.dayOfMonth || 0,
                habit.scheduleStartDate || "",
                habit.startTime || "",
                habit.estimatedMinutes || "",
                habit.continuous === false ? "nao" : "sim",
                Array.isArray(habit.steps) ? habit.steps.join(' || ') : "",
                habit.isKey ? "sim" : "nao",
                habit.id || "",
                habit.trackMode || "boolean",
                habit.targetValue || 1,
                habit.protocolId || "",
                JSON.stringify(habit.logs || {}),
                JSON.stringify(habit.stepLogs || {}),
                habit.sourceType || "",
                habit.sourceId || "",
                habit.sourceStrengthId || "",
                habit.sourceShadowId || "",
                habit.maturity || "forming",
                JSON.stringify(habit.maturityMeta || {}),
                habit.reminderEnabled ? "sim" : "nao",
                habit.reminderTime || "",
                habit.reminderIntervalEnabled ? "sim" : "nao",
                habit.reminderWindowStart || "",
                habit.reminderWindowEnd || "",
                habit.reminderIntervalMin || 0,
                habit.createdAt || "",
                habit.updatedAt || ""
            ]);
        });
        const wsHabits = XLSX.utils.aoa_to_sheet(habitRows);
        setCols(wsHabits, [14, 28, 28, 24, 28, 24, 12, 10, 10, 14, 18, 14, 12, 16, 12, 16, 10, 30, 12], [18, 14, 12, 18, 24, 24, 14, 18, 18, 18, 12, 24, 10, 12, 14, 16, 16, 14, 22, 22]);
        XLSX.utils.book_append_sheet(wb, wsHabits, "Hábitos");

        const diaryVisibleCols = ["Data", "Sono (h)", "Qualidade do Sono", "Energia", "Humor", "Estresse", "Emoção", "Intenção", "Gratidão", "O que funcionou", "O que aprendi", "Shutdown 1", "Shutdown Saúde", "Shutdown Mente", "Shutdown Carreira", "Shutdown Finanças", "Shutdown Relacionamentos", "Shutdown Família", "Shutdown Lazer", "Shutdown Propósito"];
        const diaryHiddenCols = ["Checkin_Saved_At", "Checkin_JSON", "Log_JSON"];
        const diaryRows = [diaryVisibleCols.concat(diaryHiddenCols)];
        const diaryDimensions = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
        const diaryDates = new Set([
            ...Object.keys(state.dailyLogs || {}),
            ...(state.profile?.dailyCheckins || []).map((item) => item.date)
        ]);
        [...diaryDates].sort().forEach((date) => {
            const log = (state.dailyLogs || {})[date] || {};
            const checkin = (state.profile?.dailyCheckins || []).find((item) => item.date === date) || {};
            const dimensionNotes = log.dimensionNotes || {};
            diaryRows.push([
                date,
                checkin.sleepHours || "",
                checkin.sleepQuality || "",
                checkin.energy || log.energy || "",
                checkin.mood || "",
                checkin.stress || "",
                checkin.emotion || "",
                log.focus || "",
                log.gratidao || "",
                log.funcionou || "",
                log.aprendi || "",
                Array.isArray(log.shutdown) ? (log.shutdown[0] || "") : "",
                ...diaryDimensions.map((dimension) => dimensionNotes[dimension] || ""),
                checkin.savedAt || "",
                JSON.stringify(checkin || {}),
                JSON.stringify(log || {})
            ]);
        });
        const wsDiary = XLSX.utils.aoa_to_sheet(diaryRows);
        setCols(wsDiary, [12, 10, 16, 10, 10, 10, 14, 40, 40, 40, 40, 24, 24, 24, 24, 24, 28, 24, 24, 24], [24, 24, 24]);
        XLSX.utils.book_append_sheet(wb, wsDiary, "Diário");

        const reviewVisibleCols = ["Data", "O que planejei", "O que executei", "Aprendizado", "Ajuste", "Intenção", "Força", "Sombra", "Resposta praticada", "Ajuste de hábito"];
        const reviewHiddenCols = ["Strength_ID", "Shadow_ID", "Salvo_Em"];
        const reviewRows = [reviewVisibleCols.concat(reviewHiddenCols)];
        Object.entries(state.reviews || {}).sort().forEach(([date, review]) => {
            reviewRows.push([
                date,
                review.q1 || "",
                review.q2 || "",
                review.q3 || "",
                review.q4 || "",
                review.q5 || "",
                String(strengthMap.get(String(review.strengthId || ''))?.title || ""),
                String(shadowMap.get(String(review.shadowId || ''))?.title || ""),
                review.responsePracticed || "",
                review.habitAdjustment || "",
                review.strengthId || "",
                review.shadowId || "",
                review.savedAt || ""
            ]);
        });
        const wsReviews = XLSX.utils.aoa_to_sheet(reviewRows);
        setCols(wsReviews, [12, 36, 36, 36, 36, 36, 24, 24, 30, 30], [18, 18, 24]);
        XLSX.utils.book_append_sheet(wb, wsReviews, "Revisões");

        const weeklyVisibleCols = ["Semana", "Intenção", "Micros da semana"];
        const weeklyHiddenCols = ["Micros_Selecionadas", "Feito_Em", "Criado_Em", "Origem", "Saved_At_Epoch"];
        const weeklyRows = [weeklyVisibleCols.concat(weeklyHiddenCols)];
        Object.entries(state.weekPlans || {}).sort().forEach(([weekKey, plan]) => {
            const selectedIds = Array.isArray(plan?.selectedMicros) ? plan.selectedMicros : [];
            weeklyRows.push([
                weekKey,
                String(plan?.intention || plan?.focus || ""),
                selectedIds.map((id) => String(entityMaps.micros.get(String(id || ''))?.title || id || '')).filter(Boolean).join(', '),
                selectedIds.join(', '),
                String(plan?.updatedAt || plan?.createdAt || ""),
                String(plan?.createdAt || ""),
                String(plan?.origin || ""),
                Number(plan?.savedAt || 0)
            ]);
        });
        const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyRows);
        setCols(wsWeekly, [14, 40, 52], [48, 24, 24, 16, 16]);
        XLSX.utils.book_append_sheet(wb, wsWeekly, "Planos Semanais");

        const focusVisibleCols = ["Início", "Fim", "Minutos de foco", "Minutos de pausa", "Modo", "Micro", "Intenção", "Concluída"];
        const focusHiddenCols = ["Focus_Sec", "Break_Sec", "Micro_ID"];
        const focusRows = [focusVisibleCols.concat(focusHiddenCols)];
        (state.deepWork?.sessions || []).forEach((session) => {
            focusRows.push([
                String(session?.startedAt || ""),
                String(session?.endedAt || ""),
                Math.max(0, Math.round((Number(session?.focusSec) || 0) / 60)),
                Math.max(0, Math.round((Number(session?.breakSec) || 0) / 60)),
                String(session?.mode || 'focus'),
                String(entityMaps.micros.get(String(session?.microId || ''))?.title || ""),
                String(session?.intention || ""),
                session?.completed ? "sim" : "nao",
                Number(session?.focusSec || 0),
                Number(session?.breakSec || 0),
                String(session?.microId || "")
            ]);
        });
        const wsFocus = XLSX.utils.aoa_to_sheet(focusRows);
        setCols(wsFocus, [22, 22, 16, 16, 12, 28, 40, 10], [12, 12, 20]);
        XLSX.utils.book_append_sheet(wb, wsFocus, "Foco Profundo");

        const notesVisibleCols = ["Título", "Conteúdo", "URL", "Tags", "Vínculo Tipo", "Vinculado a"];
        const notesHiddenCols = ["ID", "Vinculo_Tipo", "Vinculo_ID", "Vinculos", "Criada_Em", "Atualizada_Em"];
        const notesRows = [notesVisibleCols.concat(notesHiddenCols)];
        (state.profile?.notes || []).forEach((note) => {
            const linkedType = String(note?.linkedTo?.entityType || "");
            const linkedId = String(note?.linkedTo?.entityId || "");
            const flatLink = linkedType && linkedId ? `${linkedType}:${linkedId}` : "";
            notesRows.push([
                String(note?.title || ""),
                String(note?.body || note?.content || ""),
                String(note?.url || ""),
                Array.isArray(note?.tags) ? note.tags.join(", ") : String(note?.tags || ""),
                linkedType,
                getEntityTitle(linkedType, linkedId),
                String(note?.id || ""),
                linkedType,
                linkedId,
                flatLink,
                String(note?.createdAt || ""),
                String(note?.updatedAt || "")
            ]);
        });
        const wsNotes = XLSX.utils.aoa_to_sheet(notesRows);
        setCols(wsNotes, [30, 70, 28, 24, 18, 28], [20, 18, 22, 32, 24, 24]);
        XLSX.utils.book_append_sheet(wb, wsNotes, "Notas");

        XLSX.writeFile(wb, "SISTEMA_VIDA_PLANILHA_AMIGAVEL.xls", { bookType: "biff8" });
        console.log("Exportação Excel amigável (.xls) concluída.");
    },
    });
}
