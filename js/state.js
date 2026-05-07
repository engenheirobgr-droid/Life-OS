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
        this.ensureHabitMaturityState();
        if (typeof window.sistemaVidaState.profile.legacy !== 'string') {
            window.sistemaVidaState.profile.legacy = '';
        }
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
        // Compatibilidade retroativa: onboarding antigo salvava em profile.purpose.
        const legacyPurpose = typeof window.sistemaVidaState.profile.purpose === 'string'
            ? window.sistemaVidaState.profile.purpose.trim()
            : '';
        if (legacyPurpose) {
            if (!window.sistemaVidaState.profile.ikigai.sintese) window.sistemaVidaState.profile.ikigai.sintese = legacyPurpose;
            if (!window.sistemaVidaState.profile.legacyObj.mundo) window.sistemaVidaState.profile.legacyObj.mundo = legacyPurpose;
            if (!window.sistemaVidaState.profile.legacy) window.sistemaVidaState.profile.legacy = legacyPurpose;
        } else if (window.sistemaVidaState.profile.legacy && !window.sistemaVidaState.profile.ikigai.sintese) {
            window.sistemaVidaState.profile.ikigai.sintese = window.sistemaVidaState.profile.legacy;
        }
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
                remainingSec: 5400, targetSec: 5400, breakSec: 1200,
                microId: '', intention: '', lastTickAt: 0, sessions: []
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
            if (onboardingFlag === '0') window.sistemaVidaState.onboardingComplete = false;
        } catch (_) {}
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
                await this.withTimeout(getAuthReady(), 8000, 'auth_ready');
            } catch (authError) {
                const authGateCode = getAuthGateCode(authError);
                if (authGateCode) {
                    console.log('[SYNC] Sessão sem auth de nuvem; carregando sem criar visitante.', authGateCode);
                    this.updateSyncBadge('offline');
                    localOnlyLoad = true;
                } else {
                    throw authError;
                }
            }
            const activeUserId = this.getActiveUserId();
            forceCloudLoad = !localOnlyLoad && this.isRealAccount(auth.currentUser) && shouldForceCloudLoadForUser(activeUserId);
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
                    if (forceCloudLoad) clearForceCloudLoadForUser(activeUserId);
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
        const shouldKeepLocal = !!localData && (
            !cloudData ||
            (localHasPending && localTs >= cloudTs)
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
                    await this.withTimeout(getAuthReady(), 8000, 'auth_ready');
                } catch (authError) {
                    const authGateCode = getAuthGateCode(authError);
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
    
      // ── Estado base virgem ──────────────────────────────────────────────────
      const baseState = {
        stateSchemaVersion: CURRENT_STATE_SCHEMA_VERSION,
        profile: {
          name: 'Viajante', level: 1, xp: 0, values: [], legacy: '',
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
          remainingSec: 5400, targetSec: 5400, breakSec: 1200,
          microId: '', intention: '', lastTickAt: 0, sessions: []
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
          theme: 'auto'
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
          remainingSec: 5400, targetSec: 5400, breakSec: 1200,
          microId: '', intention: '', lastTickAt: 0,
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
        await getAuthReady();
        const stateRef = this.getStateDocRef();
        const newCloudState = JSON.parse(JSON.stringify(window.sistemaVidaState));
        delete newCloudState.profile?.avatarUrl;
        delete newCloudState.profile?.odysseyImages;
        newCloudState._lastUpdatedAt = Date.now();
        await this.withTimeout(setDoc(stateRef, newCloudState), 10000, 'firestore_reset');
        // NÃO usa localStorage.clear() — bloqueado em ambientes sandbox/iframe
        this.showNotification(
          useMockup
            ? 'App carregado com dados de exemplo. Explore à vontade!'
            : 'Sistema zerado. Iniciando o Onboarding...'
        );
        setTimeout(() => window.location.reload(), 1800);
      } catch (error) {
        console.error('Erro ao resetar o sistema:', error);
        alert('Houve um erro ao tentar apagar os dados da nuvem.');
      }
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

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, {type: 'array'});
            
            console.log("Iniciando processamento das abas do Excel...");

            // 1. Aba: Planos -> state.entities
            const wsPlanos = workbook.Sheets['Planos'] || workbook.Sheets['Main'] || workbook.Sheets['Tarefas'];
            if (wsPlanos) {
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
                    let parentId = getValue(row, ['Pai', 'Parent', 'Pai ID', 'ID_Pai', 'ID Pai', 'metaId', 'okrId', 'macroId']);
                    
                    let obj = {
                        id: idFromSheet ? String(idFromSheet) : ('ent_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                        title: getValue(row, ['Título', 'Nome', 'Tarefa', 'Title']),
                        dimension: getValue(row, ['Dimensão', 'Área', 'Dimension', 'Area']) || 'Geral',
                        status: status,
                        progress: Math.min(100, Math.max(0, numericProgress))
                    };
                    const successCriteria = String(getValue(row, ['Critério_Sucesso', 'Critério de Sucesso', 'Success Criteria']) || '').trim();
                    const challengeLevel = Number(getValue(row, ['Desafio', 'Challenge', 'Challenge Level']) || 0);
                    const commitmentLevel = Number(getValue(row, ['Comprometimento', 'Commitment', 'Commitment Level']) || 0);
                    const keyResultsText = String(getValue(row, ['Key_Results', 'Key Results', 'KRs']) || '');

                    let context = getValue(row, ['Contexto / Indicador', 'Contexto', 'Notes', 'Descrição']);
                    let prazo = getValue(row, ['Prazo / Ciclo', 'Prazo', 'Ciclo', 'Deadline', 'Data']);
                    
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
                    else if (type === 'micros') { obj.indicator = context; obj.completed = (status === 'done'); obj.prazo = prazo; }

                    if (parentId) {
                        if (type === 'okrs') obj.metaId = String(parentId);
                        else if (type === 'macros') obj.okrId = String(parentId);
                        else if (type === 'micros') obj.macroId = String(parentId);
                    }

                    if (window.sistemaVidaState.entities[type]) {
                        window.sistemaVidaState.entities[type].push(obj);
                    }
                });
            }

            // 2. Aba: Propósito
            const wsProp = workbook.Sheets['Propósito'] || workbook.Sheets['Proposito'];
            if (wsProp) {
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = { values: [] };
                if (!window.sistemaVidaState.profile.ikigai) window.sistemaVidaState.profile.ikigai = {};
                if (!window.sistemaVidaState.profile.legacyObj) window.sistemaVidaState.profile.legacyObj = {};
                if (!window.sistemaVidaState.profile.vision) window.sistemaVidaState.profile.vision = {};
                if (!window.sistemaVidaState.dimensions) window.sistemaVidaState.dimensions = { 'Saúde':{score:1}, 'Mente':{score:1}, 'Carreira':{score:1}, 'Finanças':{score:1}, 'Relacionamentos':{score:1}, 'Família':{score:1}, 'Lazer':{score:1}, 'Propósito':{score:1} };
                if (!window.sistemaVidaState.perma) window.sistemaVidaState.perma = {P:0, E:0, R:0, M:0, A:0};
                if (!window.sistemaVidaState.swls) window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };

                const propArr = XLSX.utils.sheet_to_json(wsProp);
                propArr.forEach(row => {
                    let cat = String(getValue(row, ['Categoria', 'Category']) || '').trim().toLowerCase();
                    let key = String(getValue(row, ['Chave', 'Dimensão', 'Item']) || '').trim();
                    let val = getValue(row, ['Texto_Preenchido', 'Texto Preenchido', 'Valor', 'Score']);
                    
                    if (!key || val === undefined || val === '') return;
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
                        else if (kLow.includes('sín') || kLow.includes('sin')) window.sistemaVidaState.profile.ikigai.sintese = val;
                    } 
                    else if (cat.includes('valor')) {
                        window.sistemaVidaState.profile.values = typeof val === 'string' ? val.split(/[,\n]/).map(s=>s.trim()) : [val];
                    } 
                    else if (cat.includes('vis')) {
                        if (kLow.includes('saú') || kLow.includes('sau')) window.sistemaVidaState.profile.vision.saude = val;
                        else if (kLow.includes('carr')) window.sistemaVidaState.profile.vision.carreira = val;
                        else if (kLow.includes('intel')) window.sistemaVidaState.profile.vision.intelecto = val;
                        else if (kLow.includes('cit') || kLow.includes('quote')) window.sistemaVidaState.profile.vision.quote = val;
                    } 
                    else if (cat.includes('legado')) {
                        if (kLow.includes('fam')) window.sistemaVidaState.profile.legacyObj.familia = val;
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
                            trigger: getValue(row, ['Gatilho', 'Contexto']) || '',
                            routine: getValue(row, ['Rotina', 'Rotina do Habito', 'Ação']) || '',
                            reward: getValue(row, ['Recompensa', 'Recompensa do Dia']) || '',
                            status: getValue(row, ['Status', 'Situação']) || 'Ativo',
                            completed: String(getValue(row, ['Status', 'Situação']) || '').toLowerCase().includes('conclu')
                        });
                    }
                });
            }

            // 4. Aba: Diário
            const wsDiario = workbook.Sheets['Diário'] || workbook.Sheets['Diario'];
            if (wsDiario) {
                const logArr = XLSX.utils.sheet_to_json(wsDiario);
                window.sistemaVidaState.dailyLogs = window.sistemaVidaState.dailyLogs || {};
                logArr.forEach(row => {
                    let dateRaw = getValue(row, ['Data', 'Date', 'Dia']);
                    let dateStr = "";
                    if (typeof dateRaw === 'number') {
                        const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                        dateStr = d.toISOString().split('T')[0];
                    } else if (dateRaw) dateStr = String(dateRaw).trim();
                    
                    if (dateStr && dateStr.length >= 10) {
                        window.sistemaVidaState.dailyLogs[dateStr.substring(0,10)] = {
                            gratidao: getValue(row, ['Gratidão', 'Gratidao']),
                            funcionou: getValue(row, ['O_Que_Funcionou', 'O Que Funcionou', 'Funcionou']),
                            aprendi: getValue(row, ['O_Que_Aprendi', 'O Que Aprendi', 'Aprendi']),
                            shutdown: [
                                getValue(row, ['Shutdown_1', 'Shutdown 1']), 
                                getValue(row, ['Shutdown_2', 'Shutdown 2']), 
                                getValue(row, ['Shutdown_3', 'Shutdown 3'])
                            ],
                            energy: parseFloat(getValue(row, ['Energia', 'Energy'])) || 5
                        };
                    }
                });
            }

            // 5. Aba: Revisões
            const wsRev = workbook.Sheets['Revisões'] || workbook.Sheets['Revisoes'];
            if (wsRev) {
                const revArr = XLSX.utils.sheet_to_json(wsRev);
                window.sistemaVidaState.reviews = window.sistemaVidaState.reviews || {};
                revArr.forEach(row => {
                    let dateRaw = getValue(row, ['Data', 'Date']);
                    let dateStr = "";
                    if (typeof dateRaw === 'number') {
                        const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                        dateStr = d.toISOString().split('T')[0];
                    } else if (dateRaw) dateStr = String(dateRaw).trim();
                    
                    if (dateStr && dateStr.length >= 10) {
                        window.sistemaVidaState.reviews[dateStr.substring(0,10)] = {
                            q1: getValue(row, ['O_Que_Planejei', 'O Que Planejei']),
                            q2: getValue(row, ['O_Que_Executei', 'O Que Executei']),
                            q3: getValue(row, ['Aprendizado', 'Aprendi']),
                            q4: getValue(row, ['Ajuste', 'Ajustes']),
                            q5: getValue(row, ['Intencao_Proxima', 'Intencao Proxima', 'Intenção'])
                        };
                    }
                });
            }

            // Finalização
            this.normalizeSwlsState();
            this.normalizePermaState();
            this.normalizeEntitiesState();
            this.normalizeDailyLogsState();
            this.normalizeDeepWorkState();
            await window.app.saveState(false);
            alert('Sistema Vida Importado com Sucesso (Padrão Ouro)!');
            window.app.switchView('painel');
            
        } catch (error) {
            console.error("Erro Padrão Ouro na importação:", error);
            alert(`Erro na importação: ${error.message}`);
        }
        
        event.target.value = '';
    },

exportToExcel: function() {
        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const state = window.sistemaVidaState;

        // 1. Aba: Planos
        const planosCol = ["ID", "Tipo", "Dimensão", "Título", "Contexto_Indicador", "Prazo", "Progresso", "ID_Pai", "Critério_Sucesso", "Desafio", "Comprometimento", "Key_Results", "Notas"];
        const planosData = [planosCol];
        const types = ['metas', 'okrs', 'macros', 'micros'];
        types.forEach(t => {
            (state.entities[t] || []).forEach(e => {
                const context = e.purpose || e.description || e.indicator || "";
                const parentId = e.metaId || e.okrId || e.macroId || "";
                const keyResultsText = this.serializeKeyResultsText(e.keyResults);
                const linkedNoteTitles = this.getLinkedNotes(t, e.id)
                    .map(n => n.title || '')
                    .filter(Boolean)
                    .join('; ');
                planosData.push([
                    e.id, t.slice(0, -1), e.dimension || "Geral", e.title, context, e.prazo || "", e.progress || 0, parentId,
                    e.successCriteria || "", e.challengeLevel || "", e.commitmentLevel || "", keyResultsText, linkedNoteTitles
                ]);
            });
        });
        const wsPlanos = XLSX.utils.aoa_to_sheet(planosData);
        wsPlanos['!cols'] = [{wch:15}, {wch:10}, {wch:15}, {wch:40}, {wch:40}, {wch:15}, {wch:10}, {wch:15}, {wch:30}, {wch:12}, {wch:16}, {wch:42}, {wch:30}];
        XLSX.utils.book_append_sheet(wb, wsPlanos, "Planos");

        // 2. Aba: Propósito
        const propCol = ["Categoria", "Chave", "Texto_Preenchido"];
        const propData = [propCol];

        propData.push(["Identidade", "Valores Pessoais", (state.profile.values || []).join(", ")]);

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
            propData.push(["Ikigai", label, state.profile.ikigai?.[k] || ""]);
        });

        const visionM = { saude: "Visão Saúde", carreira: "Visão Carreira", intelecto: "Visão Intelectual", quote: "Citação Inspiradora" };
        Object.entries(visionM).forEach(([k, label]) => {
            propData.push(["Visão", label, state.profile.vision?.[k] || ""]);
        });

        const legacyM = { familia: "Legado Família", profissao: "Legado Profissional", mundo: "Legado Mundo" };
        Object.entries(legacyM).forEach(([k, label]) => {
            propData.push(["Legado", label, state.profile.legacyObj?.[k] || ""]);
        });

        // Forças e Sombras (Identidade)
        (state.profile.identity?.strengths || []).forEach(s => {
            propData.push(["Força", s.title || "", s.description || s.quote || ""]);
        });
        (state.profile.identity?.shadows || []).forEach(s => {
            propData.push(["Sombra", s.title || "", s.description || s.desiredResponse || ""]);
        });

        // Roda da Vida
        Object.entries(state.dimensions || {}).forEach(([dim, data]) => {
            propData.push(["Roda da Vida", dim, data.score || 0]);
        });

        const permaM = { P: "Emoções Positivas (P)", E: "Engajamento (E)", R: "Relacionamentos (R)", M: "Significado (M)", A: "Realização (A)" };
        Object.entries(permaM).forEach(([k, label]) => {
            propData.push(["PERMA", label, state.perma?.[k] || 0]);
        });

        const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
        propData.push(["SWLS", "Score", swls.lastScore || 0]);
        propData.push(["SWLS", "Data", swls.lastDate || ""]);
        (swls.answers || []).slice(0, 5).forEach((answer, idx) => {
            propData.push(["SWLS", `Q${idx + 1}`, answer]);
        });

        const wsProp = XLSX.utils.aoa_to_sheet(propData);
        wsProp['!cols'] = [{wch:15}, {wch:30}, {wch:60}];
        XLSX.utils.book_append_sheet(wb, wsProp, "Propósito");

        // 2b. Aba: Odyssey
        const odyCol = ["Cenário", "Texto"];
        const odyData = [odyCol];
        const ody = state.profile.odyssey || {};
        const odyLabels = { cenarioA: "Cenário A — Caminho Principal", cenarioB: "Cenário B — Plano Alternativo", cenarioC: "Cenário C — E se tudo mudasse?" };
        Object.entries(odyLabels).forEach(([k, label]) => {
            odyData.push([label, ody[k] || ""]);
        });
        const wsOdy = XLSX.utils.aoa_to_sheet(odyData);
        wsOdy['!cols'] = [{wch:40}, {wch:80}];
        XLSX.utils.book_append_sheet(wb, wsOdy, "Odyssey");

        // 3. Aba: Hábitos
        const habCol = ["ID", "Dimensão", "Título", "Gatilho", "Rotina", "Recompensa", "Status"];
        const habData = [habCol];
        (state.habits || []).forEach(h => {
            habData.push([
                h.id,
                h.dimension || "Geral",
                h.title,
                h.trigger || "",
                h.routine || h.context || "",
                h.reward || "",
                h.completed ? "Ativo" : "Inativo"
            ]);
        });
        const wsHabits = XLSX.utils.aoa_to_sheet(habData);
        wsHabits['!cols'] = [{wch:15}, {wch:15}, {wch:32}, {wch:26}, {wch:32}, {wch:24}, {wch:10}];
        XLSX.utils.book_append_sheet(wb, wsHabits, "Hábitos");

        // 4. Aba: Diário (inclui check-in + shutdown por dimensão)
        const dims = ['Saúde','Mente','Carreira','Finanças','Relacionamentos','Família','Lazer','Propósito'];
        const logCol = ["Data", "Sono_h", "Qualidade_Sono", "Energia", "Humor", "Estresse", "Emoção", "Intenção", "Gratidão", "O_Que_Funcionou",
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
                log.focus || "",
                log.gratidao || "",
                log.funcionou || "",
                ...dims.map(d => dimNotes[d] || "")
            ]);
        });
        const wsDiario = XLSX.utils.aoa_to_sheet(logData);
        wsDiario['!cols'] = [{wch:12}, {wch:8}, {wch:10}, {wch:8}, {wch:8}, {wch:8}, {wch:12}, {wch:40}, {wch:40}, {wch:40},
            ...dims.map(() => ({wch:30}))];
        XLSX.utils.book_append_sheet(wb, wsDiario, "Diário");

        // 4b. Aba: Hábitos — com histórico dos últimos 30 dias
        const habDays = Array.from({length:30}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            return app.getLocalDateKey(d);
        }).reverse();
        const habCol2 = ["ID", "Dimensão", "Título", "Gatilho", "Rotina", "Recompensa", ...habDays];
        const habData2 = [habCol2];
        (state.habits || []).forEach(h => {
            habData2.push([
                h.id, h.dimension || "Geral", h.title, h.trigger || "", h.routine || h.context || "", h.reward || "",
                ...habDays.map(dk => app.isHabitDoneOnDate(h, dk) ? 1 : 0)
            ]);
        });
        const wsHab2 = XLSX.utils.aoa_to_sheet(habData2);
        wsHab2['!cols'] = [{wch:15},{wch:15},{wch:32},{wch:26},{wch:32},{wch:24},...habDays.map(()=>({wch:10}))];
        XLSX.utils.book_append_sheet(wb, wsHab2, "Hábitos_Histórico");

        // 5. Aba: Revisões
        const revCol = ["Data", "O_Que_Planejei", "O_Que_Executei", "Aprendizado", "Ajuste", "Intencao_Proxima"];
        const revData = [revCol];
        Object.entries(state.reviews || {}).sort().forEach(([date, rev]) => {
            revData.push([
                date,
                rev.q1 || "",
                rev.q2 || "",
                rev.q3 || "",
                rev.q4 || "",
                rev.q5 || ""
            ]);
        });
        const wsRevisoes = XLSX.utils.aoa_to_sheet(revData);
        wsRevisoes['!cols'] = [{wch:12}, {wch:40}, {wch:40}, {wch:40}, {wch:40}, {wch:40}];
        XLSX.utils.book_append_sheet(wb, wsRevisoes, "Revisões");

        XLSX.writeFile(wb, "SISTEMA_VIDA_PADRAO_OURO.xlsx");
        console.log("Exportação Excel Padrão Ouro concluída.");
    },
    });
}
