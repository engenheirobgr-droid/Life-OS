/**
 * Sistema Vida - Core OS
 * Vanilla JS Single Page Application Controller with Data Binding
 */

// Firebase instances and helpers — all initialized in js/firebase.js
import {
    db, auth, storage, authPersistenceReady, LOCAL_USER_SCOPE,
    doc, setDoc, getDoc, onSnapshot, deleteDoc,
    signInAnonymously, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail, updateProfile,
    EmailAuthProvider, linkWithCredential,
    storageRef, uploadString, getDownloadURL
} from './js/firebase.js';

// Phase 9 extracted modules — attached to app after object definition
import { attachSubjectiveScales } from './js/subjectiveScales.js?v=20260510-tree-grow-v167';
import { attachHabitSuggestions } from './js/habitSuggestions.js?v=20260510-tree-grow-v167';
import { attachNotifications } from './js/notifications.js?v=20260510-tree-grow-v167';
import { attachCadence } from './js/cadence.js?v=20260510-tree-grow-v167';
import { attachOnboarding } from './js/onboarding.js?v=20260510-tree-grow-v167';
import { attachIdentity } from './js/identity.js?v=20260510-tree-grow-v167';
import { attachHabits } from './js/habits.js?v=20260510-tree-grow-v167';
import { attachStateModule } from './js/state.js?v=20260510-tree-grow-v167';
import { attachRenderModule } from './js/render.js?v=20260510-tree-grow-v167';
import { attachPlanningModule } from './js/planning.js?v=20260510-tree-grow-v167';
import { attachGamificationModule } from './js/gamification.js?v=20260510-tree-grow-v167';
import { attachSocial } from './js/social.js?v=20260510-tree-grow-v167';

const AUTH_SIGNED_OUT_KEY = 'lifeos_auth_signed_out';
const AUTH_FORCE_CLOUD_UID_KEY = 'lifeos_force_cloud_uid';
const CURRENT_STATE_SCHEMA_VERSION = 2;
let initialAuthStatePromise = null;
let authInteractiveOperation = false;

function isSignedOutIntentionally() {
    try { return localStorage.getItem(AUTH_SIGNED_OUT_KEY) === '1'; } catch (_) { return false; }
}

function setSignedOutIntentionally(value) {
    try {
        if (value) localStorage.setItem(AUTH_SIGNED_OUT_KEY, '1');
        else localStorage.removeItem(AUTH_SIGNED_OUT_KEY);
    } catch (_) {}
}

function setForceCloudLoadForUser(uid) {
    try {
        if (uid) localStorage.setItem(AUTH_FORCE_CLOUD_UID_KEY, JSON.stringify({ uid, ts: Date.now() }));
    } catch (_) {}
}

function shouldForceCloudLoadForUser(uid) {
    try {
        if (!uid) return false;
        const raw = localStorage.getItem(AUTH_FORCE_CLOUD_UID_KEY) || '';
        if (!raw) return false;
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = { uid: raw, ts: Date.now() }; }
        const ageMs = Date.now() - Number(parsed.ts || 0);
        if (ageMs > 15 * 60 * 1000) {
            localStorage.removeItem(AUTH_FORCE_CLOUD_UID_KEY);
            return false;
        }
        return parsed.uid === uid;
    } catch (_) {}
    return false;
}

function clearForceCloudLoadForUser(uid) {
    try {
        if (!uid) return;
        const raw = localStorage.getItem(AUTH_FORCE_CLOUD_UID_KEY) || '';
        if (!raw) return;
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = { uid: raw }; }
        if (parsed.uid !== uid) return;
        localStorage.removeItem(AUTH_FORCE_CLOUD_UID_KEY);
    } catch (_) {}
}

function getAuthGateCode(error) {
    const msg = String(error?.message || error || '');
    if (msg.includes('auth_signed_out')) return 'modo_local_sem_conta';
    if (msg.includes('auth_operation_pending')) return 'auth_em_andamento';
    return '';
}

function waitInitialAuthState() {
    if (initialAuthStatePromise) return initialAuthStatePromise;
    initialAuthStatePromise = authPersistenceReady.then(() => new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { unsub(); } catch (_) {}
            resolve(auth.currentUser || null);
        }, 4000);
        const unsub = onAuthStateChanged(auth, (user) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            unsub();
            resolve(user || null);
        }, (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            try { unsub(); } catch (_) {}
            reject(err);
        });
    }));
    return initialAuthStatePromise;
}
// getAuthReady() cria uma Promise fresca a cada chamada.
// Isso evita que uma falha de auth transitória (ex: rede lenta na abertura do app)
// deixe uma sessão antiga/rejeitada bloquear os saves futuros.
function getAuthReady() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return waitInitialAuthState().then((user) => {
        if (user) return user;
        if (authInteractiveOperation) throw new Error('auth_operation_pending');
        if (isSignedOutIntentionally()) throw new Error('auth_signed_out');
        return signInAnonymously(auth);
    });
}
window.sistemaVidaState = {
    stateSchemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    profile: {
        name: "Bruno",
        level: 1,
        xp: 0,
        values: [],
        legacy: "",
        ikigai: { missao: "", vocacao: "", paixao: "", profissao: "", love: "", good: "", need: "", paid: "", sintese: "", sinteseResumo: "" },
        legacyObj: { familia: "", profissao: "", mundo: "", familiaResumo: "", profissaoResumo: "", mundoResumo: "" },
        vision: { saude: "", carreira: "", intelecto: "", quote: "", saudeResumo: "", carreiraResumo: "", intelectoResumo: "" },
        odyssey: { cenarioA: "", cenarioB: "", cenarioC: "" },
        odysseyImages: { cenarioA: "", cenarioB: "", cenarioC: "" },
        odysseyTitles: { cenarioA: "Cenário A", cenarioB: "Cenário B", cenarioC: "Cenário C" },
        identity: { strengths: [], shadows: [] },
        onboardingStarter: { dimension: 'Carreira', goalTitle: '', habitTitle: '', habitTime: '', strength: '', shadow: '' },
        dailyCheckins: [],
        cadence: {},
        notes: []
    },
    energy: 5,
    dimensions: {
        Saúde: { score: 0 },
        Mente: { score: 0 },
        Carreira: { score: 0 },
        Finanças: { score: 0 },
        Relacionamentos: { score: 0 },
        Família: { score: 0 },
        Lazer: { score: 0 },
        Propósito: { score: 0 }
    },
    perma: { P: 0, E: 0, R: 0, M: 0, A: 0 },
    swls: { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} },
    wellbeingHistory: { wheel: {}, perma: {}, odyssey: {} },
    deepWork: {
        isRunning: false,
        isPaused: false,
        mode: 'focus',
        remainingSec: 5400,
        targetSec: 5400,
        breakSec: 1200,
        microId: '',
        intention: '',
        lastTickAt: 0,
        sessions: []
    },
    entities: { metas: [], okrs: [], macros: [], micros: [] },
    habits: [],
    dailyLogs: {},
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
        features: { social: false }
    },
    cycleStartDate: new Date(new Date(new Date().setDate(new Date().getDate() - 21)).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
    onboardingComplete: false
};

const app = {
    config: {
        containerId: 'app-content',
        viewsPath: 'views/',
        repoFullName: 'engenheirobgr-droid/Life-OS'
    },
    webPushPublicKey: null,
    appBuildVersion: '20260510-tree-grow-v167',
    forceOnboardingResetKey: 'lifeos_force_onboarding_after_reset',
    lastAccountErrorMessage: '',
    getActiveUserId: function(user = auth.currentUser) {
        return user?.uid || LOCAL_USER_SCOPE;
    },
    getCurrentStateSchemaVersion: function() {
        return CURRENT_STATE_SCHEMA_VERSION;
    },
    isSignedOutIntentionally: function() {
        return isSignedOutIntentionally();
    },
    setSignedOutIntentionally: function(value) {
        return setSignedOutIntentionally(value);
    },
    shouldForceCloudLoadForUser: function(uid) {
        return shouldForceCloudLoadForUser(uid);
    },
    clearForceCloudLoadForUser: function(uid) {
        return clearForceCloudLoadForUser(uid);
    },
    waitInitialAuthState: function() {
        return waitInitialAuthState();
    },
    resetInitialAuthState: function(user = null) {
        initialAuthStatePromise = Promise.resolve(user);
        return initialAuthStatePromise;
    },
    getAuthReady: function() {
        return getAuthReady();
    },
    getAuthGateCode: function(error) {
        return getAuthGateCode(error);
    },
    isRealAccount: function(user = auth.currentUser) {
        return !!(user && !user.isAnonymous);
    },
    getStateDocRef: function(userId = this.getActiveUserId()) {
        return doc(db, 'users', userId);
    },
    getImagesDocRef: function(userId = this.getActiveUserId()) {
        return doc(db, 'user_images', userId);
    },
    getPushSubscriptionDocRef: function(docId, userId = this.getActiveUserId()) {
        return doc(db, 'users', userId, 'push_subscriptions', docId);
    },
    getLocalKey: function(baseKey, userId = this.getActiveUserId()) {
        const uid = userId || LOCAL_USER_SCOPE;
        return `${baseKey}:${uid || LOCAL_USER_SCOPE}`;
    },
    localGet: function(baseKey, userId = this.getActiveUserId()) {
        try {
            return localStorage.getItem(this.getLocalKey(baseKey, userId));
        } catch (_) {}
        return null;
    },
    localSet: function(baseKey, value, userId = this.getActiveUserId()) {
        try { localStorage.setItem(this.getLocalKey(baseKey, userId), value); } catch (_) {}
    },
    localRemove: function(baseKey, userId = this.getActiveUserId()) {
        try { localStorage.removeItem(this.getLocalKey(baseKey, userId)); } catch (_) {}
        try { localStorage.removeItem(baseKey); } catch (_) {}
    },
    migrateStateSchema: function() {
        const state = window.sistemaVidaState || {};
        const profile = state.profile || (state.profile = {});
        if (!profile.cadence || typeof profile.cadence !== 'object' || Array.isArray(profile.cadence)) {
            profile.cadence = {};
        }
        let version = Number(state.stateSchemaVersion || 0);
        if (!Number.isFinite(version) || version < 0) version = 0;

        if (version < 2) {
            const legacyDiary = profile.cadence.diary || {};
            if (!profile.cadence.shutdown || typeof profile.cadence.shutdown !== 'object') {
                profile.cadence.shutdown = {};
            }
            if (!profile.cadence.shutdown.lastAt && legacyDiary.lastAt) {
                profile.cadence.shutdown = {
                    ...profile.cadence.shutdown,
                    lastAt: String(legacyDiary.lastAt),
                    updatedAt: legacyDiary.updatedAt || new Date().toISOString(),
                    migratedFromDiary: true
                };
            }
            if (!profile.cadence.cycleReview || typeof profile.cadence.cycleReview !== 'object') {
                profile.cadence.cycleReview = {};
            }
            state.stateSchemaVersion = 2;
            this._stateSchemaNeedsSave = true;
        }

        if (Number(state.stateSchemaVersion || 0) !== CURRENT_STATE_SCHEMA_VERSION) {
            state.stateSchemaVersion = CURRENT_STATE_SCHEMA_VERSION;
            this._stateSchemaNeedsSave = true;
        }
    },
    getLocalDateKey: function(date = new Date()) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    },
    getSafeMonotonicTs: function() {
        const prev = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
        const now = Date.now();
        return Math.max(now, prev + 1);
    },
    persistLocalMirror: function(userId = this.getActiveUserId()) {
        try {
            this.localSet('lifeos_state_backup', JSON.stringify(this.getPersistableState('full')), userId);
        } catch (_) {}
        try {
            const completed = !!window.sistemaVidaState?.onboardingComplete;
            this.localSet('lifeos_onboarding_complete', completed ? '1' : '0', userId);
        } catch (_) {}
    },
    isForceOnboardingAfterReset: function() {
        try { return localStorage.getItem(this.forceOnboardingResetKey) === '1'; } catch (_) {}
        return false;
    },
    setForceOnboardingAfterReset: function(enabled) {
        try {
            if (enabled) localStorage.setItem(this.forceOnboardingResetKey, '1');
            else localStorage.removeItem(this.forceOnboardingResetKey);
        } catch (_) {}
    },
    applyForcedOnboardingResetState: function() {
        if (!this.isForceOnboardingAfterReset()) return false;
        if (!window.sistemaVidaState) return false;
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        window.sistemaVidaState.onboardingComplete = false;
        try { this.localSet('lifeos_onboarding_complete', '0'); } catch (_) {}
        return true;
    },
    updateSyncBadge: function(state) {
        // state: 'ok' | 'error' | 'syncing' | 'offline'
        if (state === 'ok') {
            this.lastCloudSyncOk = true;
            this.lastCloudSyncErrorCode = '';
        } else if (state === 'error') {
            this.lastCloudSyncOk = false;
            if (!this.lastCloudSyncErrorCode) this.lastCloudSyncErrorCode = 'erro_desconhecido';
        } else if (state === 'offline') {
            this.lastCloudSyncOk = null;
        }
        const labels = {
            ok:      { icon: 'cloud_done',    text: 'Sincronizado',     cls: 'text-emerald-500' },
            error:   { icon: 'cloud_off',     text: 'Falha na nuvem',   cls: 'text-red-400' },
            syncing: { icon: 'cloud_sync',    text: 'Sincronizando…',   cls: 'text-primary' },
            offline: { icon: 'cloud_off',     text: 'Modo local',       cls: 'text-amber-400' },
        };
        const d = { ...(labels[state] || labels['ok']) };
        if (state === 'ok' && auth.currentUser?.isAnonymous) {
            d.icon = 'cloud';
            d.text = 'Visitante';
            d.cls = 'text-outline';
        }
        document.querySelectorAll('.lifeos-sync-badge').forEach(el => {
            el.innerHTML = '<span class="material-symbols-outlined notranslate text-sm">' + d.icon + '</span>'
                         + '<span class="text-[10px] font-bold">' + d.text + '</span>';
            el.className = 'lifeos-sync-badge flex items-center gap-1 ' + d.cls;
        });
        if (this.currentView === 'perfil') {
            try { this.renderAccountPanel(); } catch (_) {}
        }
    },

    getAuthErrorMessage: function(error) {
        const code = String(error?.code || error?.message || '');
        if (code.includes('auth/email-already-in-use')) return 'Este e-mail já tem uma conta. Use Entrar; seus dados locais continuam guardados neste aparelho.';
        if (code.includes('auth/credential-already-in-use')) return 'Este e-mail já está vinculado a outra conta. Use Entrar; seus dados locais continuam guardados neste aparelho.';
        if (code.includes('auth/invalid-email')) return 'Confira o e-mail informado.';
        if (code.includes('auth/weak-password')) return 'Use uma senha com pelo menos 6 caracteres.';
        if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) return 'E-mail ou senha inválidos.';
        if (code.includes('auth/operation-not-allowed')) return 'O login por e-mail/senha precisa ser ativado no Firebase Authentication.';
        return 'Não foi possível concluir a operação da conta.';
    },

    renderAccountPanel: function() {
        const user = auth.currentUser;
        const isAccount = this.isRealAccount(user);
        const isSignedOutLocal = !user && isSignedOutIntentionally();
        const email = user?.email || '';
        const uid = this.getActiveUserId(user);
        const statusEl = document.getElementById('account-status-text');
        const idEl = document.getElementById('account-user-id');
        const formEl = document.getElementById('account-auth-form');
        const signedEl = document.getElementById('account-signed-actions');
        const emailEl = document.getElementById('account-current-email');
        const nameInput = document.getElementById('account-name-input');
        const syncEl = document.getElementById('account-sync-status');

        if (statusEl) {
            statusEl.textContent = isAccount
                ? 'Conta registrada. Este cofre pode ser recuperado por e-mail e usado em outros dispositivos.'
                : isSignedOutLocal
                    ? 'Sem conta ativa. Entre ou crie uma conta para sincronizar com a nuvem; nada novo sera criado ao sair.'
                    : 'Modo visitante. O app usa um acesso anonimo neste aparelho: funciona agora, mas voce pode perder acesso se limpar dados ou trocar de dispositivo.';
        }
        if (idEl) idEl.textContent = isAccount ? uid : isSignedOutLocal ? 'sem conta ativa' : `${uid} (visitante)`;
        if (emailEl) emailEl.textContent = email || (isSignedOutLocal ? 'Entre ou crie uma conta' : 'Sem e-mail vinculado');
        if (formEl) formEl.classList.toggle('hidden', isAccount);
        if (signedEl) signedEl.classList.toggle('hidden', !isAccount);
        if (nameInput && !nameInput.value) nameInput.value = window.sistemaVidaState?.profile?.name || '';
        if (syncEl) {
            if (this.lastAccountErrorMessage) {
                syncEl.textContent = this.lastAccountErrorMessage;
                syncEl.className = 'text-[10px] text-error leading-snug';
            } else if (isSignedOutLocal) {
                syncEl.textContent = 'Modo local ate entrar ou criar uma conta.';
                syncEl.className = 'text-[10px] text-amber-500 leading-snug';
            } else if (this.lastCloudSyncOk === false) {
                syncEl.textContent = 'Ultima sincronizacao falhou: ' + (this.lastCloudSyncErrorCode || 'erro desconhecido') + '.';
                syncEl.className = 'text-[10px] text-error leading-snug';
            } else if (this.lastCloudSyncOk === true) {
                syncEl.textContent = 'Ultima sincronizacao com a nuvem concluida.';
                syncEl.className = 'text-[10px] text-emerald-500 leading-snug';
            } else {
                syncEl.textContent = 'Aguardando sincronizacao com a nuvem.';
                syncEl.className = 'text-[10px] text-outline leading-snug';
            }
        }
    },

    teardownRealtimeSync: function() {
        try { if (this._realtimeSyncUnsub) this._realtimeSyncUnsub(); } catch (_) {}
        try { if (this._imagesSyncUnsub) this._imagesSyncUnsub(); } catch (_) {}
        try { if (this._periodicSyncId) clearInterval(this._periodicSyncId); } catch (_) {}
        this._realtimeSyncUnsub = null;
        this._imagesSyncUnsub = null;
        this._periodicSyncId = null;
    },

    waitForAuthUser: function(uid, timeoutMs = 5000) {
        if (auth.currentUser?.uid === uid) return Promise.resolve(auth.currentUser);
        return new Promise((resolve, reject) => {
            let done = false;
            const timeoutId = setTimeout(() => {
                if (done) return;
                done = true;
                try { unsub(); } catch (_) {}
                reject(new Error('auth_user_switch_timeout'));
            }, timeoutMs);
            const unsub = onAuthStateChanged(auth, (user) => {
                if (done || user?.uid !== uid) return;
                done = true;
                clearTimeout(timeoutId);
                unsub();
                resolve(user);
            }, (err) => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                try { unsub(); } catch (_) {}
                reject(err);
            });
        });
    },

    createAccountFromProfile: async function() {
        const name = String(document.getElementById('account-name-input')?.value || document.getElementById('onboarding-nome')?.value || '').trim();
        const email = String(document.getElementById('account-email-input')?.value || '').trim();
        const password = String(document.getElementById('account-password-input')?.value || '');
        if (!email || !password) {
            this.showToast('Informe e-mail e senha para criar a conta.', 'error');
            return false;
        }
        let wasSignedOut = isSignedOutIntentionally();
        try {
            this.updateSyncBadge('syncing');
            this.lastAccountErrorMessage = '';
            this.persistLocalMirror();
            const currentState = this.getPersistableState('full');
            authInteractiveOperation = true;
            let currentUser = auth.currentUser || null;
            if (!currentUser) {
                try { currentUser = await this.withTimeout(waitInitialAuthState(), 5000, 'auth_initial_account'); } catch (_) { currentUser = null; }
            }
            const credential = currentUser?.isAnonymous
                ? await linkWithCredential(currentUser, EmailAuthProvider.credential(email, password))
                : await createUserWithEmailAndPassword(auth, email, password);
            initialAuthStatePromise = Promise.resolve(credential.user);
            setSignedOutIntentionally(false);
            authInteractiveOperation = false;
            await this.withTimeout(this.waitForAuthUser(credential.user.uid), 6000, 'auth_user_ready_after_account');
            try { await credential.user.getIdToken(true); } catch (_) {}
            if (name) {
                try { await updateProfile(credential.user, { displayName: name }); } catch (_) {}
            }
            window.sistemaVidaState = this.mergeDeep(window.sistemaVidaState, currentState);
            if (name) {
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                window.sistemaVidaState.profile.name = name;
            }
            this.teardownRealtimeSync();
            await this.saveState(false);
            try { await this.registerPushSubscription(); } catch (_) {}
            this.setupRealtimeSync();
            this.renderAccountPanel();
            this.renderProfileChrome();
            this.showToast('Conta registrada. Seus dados continuam no mesmo cofre.', 'success');
            return true;
        } catch (error) {
            authInteractiveOperation = false;
            if (!auth.currentUser && wasSignedOut) {
                setSignedOutIntentionally(true);
            }
            console.error('[AUTH] Falha ao criar conta:', error);
            this.updateSyncBadge('error');
            this.lastAccountErrorMessage = this.getAuthErrorMessage(error);
            this.renderAccountPanel();
            this.showToast(this.lastAccountErrorMessage, 'error');
            return false;
        }
    },

    signInFromProfile: async function() {
        const email = String(document.getElementById('account-email-input')?.value || '').trim();
        const password = String(document.getElementById('account-password-input')?.value || '');
        if (!email || !password) {
            this.showToast('Informe e-mail e senha para entrar.', 'error');
            return false;
        }
        let wasSignedOut = isSignedOutIntentionally();
        try {
            this.updateSyncBadge('syncing');
            this.lastAccountErrorMessage = '';
            this.persistLocalMirror();
            authInteractiveOperation = true;
            const credential = await signInWithEmailAndPassword(auth, email, password);
            initialAuthStatePromise = Promise.resolve(credential.user);
            setSignedOutIntentionally(false);
            setForceCloudLoadForUser(credential.user.uid);
            authInteractiveOperation = false;
            await this.withTimeout(this.waitForAuthUser(credential.user.uid), 6000, 'auth_user_ready_after_login');
            try { await credential.user.getIdToken(true); } catch (_) {}
            this.teardownRealtimeSync();
            this.showToast('Conta carregada com sucesso.', 'success');
            setTimeout(() => window.location.reload(), 600);
            return true;
        } catch (error) {
            authInteractiveOperation = false;
            if (!auth.currentUser && wasSignedOut) {
                setSignedOutIntentionally(true);
            }
            console.error('[AUTH] Falha ao entrar:', error);
            this.updateSyncBadge('error');
            this.lastAccountErrorMessage = this.getAuthErrorMessage(error);
            this.renderAccountPanel();
            this.showToast(this.lastAccountErrorMessage, 'error');
            return false;
        }
    },

    sendPasswordResetFromProfile: async function() {
        const email = String(document.getElementById('account-email-input')?.value || auth.currentUser?.email || '').trim();
        if (!email) {
            this.showToast('Informe o e-mail para recuperar a senha.', 'error');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            this.showToast('E-mail de recuperação enviado.', 'success');
        } catch (error) {
            console.error('[AUTH] Falha ao enviar recuperação:', error);
            this.showToast(this.getAuthErrorMessage(error), 'error');
        }
    },

    signOutFromProfile: async function() {
        try {
            this.persistLocalMirror();
            this.teardownRealtimeSync();
            setSignedOutIntentionally(true);
            await signOut(auth);
            initialAuthStatePromise = Promise.resolve(null);
            this.showToast('Você saiu da conta.', 'success');
            setTimeout(() => window.location.reload(), 600);
        } catch (error) {
            console.error('[AUTH] Falha ao sair:', error);
            this.showToast('Não foi possível sair da conta.', 'error');
        }
    },

    withTimeout: function(promise, ms, label = 'operation') {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(label + '_timeout')), ms))
        ]);
    },
    normalizeDimensionKey: function(dimRaw) {
        const txt = String(dimRaw || '').toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const compact = txt.replace(/[^a-z]/g, '');
        if (txt.includes('saud')) return 'Saúde';
        if (txt.includes('relac')) return 'Relacionamentos';
        if (txt.includes('pessoal') || txt.includes('mental') || compact.startsWith('mente')) return 'Mente';
        if (txt.includes('carre') || txt.includes('profiss') || txt.includes('trabalh')) return 'Carreira';
        if (txt.includes('finan')) return 'Finanças';
        if (txt.includes('fam')) return 'Família';
        if (txt.includes('lazer')) return 'Lazer';
        if (txt.includes('propos') || txt.includes('contribu')) return 'Propósito';
        return '';
    },
    getWheelAxes: function() {
        return ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
    },
    normalizeDimensionsState: function() {
        const state = window.sistemaVidaState;
        const axes = this.getWheelAxes();
        const source = (state && state.dimensions && typeof state.dimensions === 'object') ? state.dimensions : {};
        const normalized = {};
        axes.forEach((dim) => {
            normalized[dim] = { score: 1 };
        });

        Object.entries(source).forEach(([rawKey, rawVal]) => {
            const canonical = this.normalizeDimensionKey(rawKey) || '';
            if (!canonical || !normalized[canonical]) return;
            const scoreRaw = Number(rawVal && typeof rawVal === 'object' ? rawVal.score : rawVal);
            const score = Number.isFinite(scoreRaw) ? Math.max(1, Math.min(100, Math.round(scoreRaw))) : 1;
            normalized[canonical].score = score;
        });

        state.dimensions = normalized;
    },
    updateWheelPolygon: function() {
        this.normalizeDimensionsState();
        const polygon = document.getElementById('roda-polygon');
        if (!polygon) return;
        const axes = this.getWheelAxes();
        const angles = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => deg * Math.PI / 180);
        const pts = axes.map((dim, i) => {
            const score = window.sistemaVidaState.dimensions[dim]?.score || 0;
            const r = 40 * (score / 100);
            const x = 50 + r * Math.sin(angles[i]);
            const y = 50 - r * Math.cos(angles[i]);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        polygon.setAttribute('points', pts.join(' '));
    },
    normalizePermaScore: function(rawValue) {
        let value = Number(rawValue);
        if (!Number.isFinite(value)) value = 0;
        if (value > 10) value = value / 10;
        value = Math.max(0, Math.min(10, value));
        return Math.round(value * 10) / 10;
    },
    normalizePermaState: function() {
        const state = window.sistemaVidaState;
        if (!state.perma) state.perma = { P: 0, E: 0, R: 0, M: 0, A: 0 };
        ['P', 'E', 'R', 'M', 'A'].forEach((key) => {
            state.perma[key] = this.normalizePermaScore(state.perma[key]);
        });
    },
    normalizeKeyResultsList: function(keyResultsRaw) {
        if (!Array.isArray(keyResultsRaw)) return [];
        return keyResultsRaw.map((kr) => {
            const title = String(kr?.title || '').trim();
            const current = Number(String(kr?.current ?? 0).replace(',', '.'));
            const target = Number(String(kr?.target ?? 0).replace(',', '.'));
            return {
                title,
                current: Number.isFinite(current) ? current : 0,
                target: Number.isFinite(target) ? target : 0
            };
        }).filter((kr) => kr.title);
    },
        // Extracted in Phase 9: state module
normalizeSwlsAnswer: function(rawValue) {
        let value = Number(rawValue);
        if (!Number.isFinite(value)) value = 4;
        value = Math.round(value);
        return Math.max(1, Math.min(7, value));
    },
    normalizeSwlsState: function() {
        const state = window.sistemaVidaState;
        if (!state.swls || typeof state.swls !== 'object') {
            state.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
        }
        if (!Array.isArray(state.swls.answers)) state.swls.answers = [4, 4, 4, 4, 4];
        const normalizedAnswers = [];
        for (let i = 0; i < 5; i++) {
            normalizedAnswers.push(this.normalizeSwlsAnswer(state.swls.answers[i]));
        }
        state.swls.answers = normalizedAnswers;
        state.swls.lastScore = Number(state.swls.lastScore);
        if (!Number.isFinite(state.swls.lastScore) || state.swls.lastScore < 5 || state.swls.lastScore > 35) {
            state.swls.lastScore = normalizedAnswers.reduce((sum, n) => sum + n, 0);
        }
        if (typeof state.swls.lastDate !== 'string') state.swls.lastDate = "";
        if (!state.swls.history || typeof state.swls.history !== 'object') state.swls.history = {};
        const normalizedHistory = {};
        Object.entries(state.swls.history).forEach(([dateKey, item]) => {
            const key = String(dateKey || '');
            if (!key) return;
            const answers = Array.isArray(item?.answers) ? item.answers.slice(0, 5).map((a) => this.normalizeSwlsAnswer(a)) : [...normalizedAnswers];
            while (answers.length < 5) answers.push(4);
            let score = Number(item?.score);
            if (!Number.isFinite(score) || score < 5 || score > 35) {
                score = answers.reduce((sum, n) => sum + n, 0);
            }
            normalizedHistory[key] = { score: Math.round(score), answers };
        });
        state.swls.history = normalizedHistory;
    },
    getSwlsBand: function(score) {
        const val = Number(score) || 0;
        if (val >= 31) return 'Extremamente satisfeito';
        if (val >= 26) return 'Satisfeito';
        if (val >= 21) return 'Levemente satisfeito';
        if (val === 20) return 'Neutro';
        if (val >= 15) return 'Levemente insatisfeito';
        if (val >= 10) return 'Insatisfeito';
        return 'Extremamente insatisfeito';
    },
    normalizeDailyLogsState: function() {
        const state = window.sistemaVidaState;
        if (!state.dailyLogs || typeof state.dailyLogs !== 'object') return;
        Object.entries(state.dailyLogs).forEach(([date, log]) => {
            if (!log || typeof log !== 'object') return;
            if (typeof log.shutdown === 'string') {
                state.dailyLogs[date] = { ...log, shutdown: [log.shutdown] };
            }
        });
    },
    normalizeDeepWorkState: function() {
        const state = window.sistemaVidaState;
        if (!state.deepWork || typeof state.deepWork !== 'object') {
            state.deepWork = {
                isRunning: false,
                isPaused: false,
                mode: 'focus',
                remainingSec: 5400,
                targetSec: 5400,
                breakSec: 1200,
                microId: '',
                intention: '',
                lastTickAt: 0,
                sessions: []
            };
        }
        const dw = state.deepWork;
        dw.isRunning = !!dw.isRunning;
        dw.isPaused = !!dw.isPaused;
        dw.mode = ['focus', 'break'].includes(dw.mode) ? dw.mode : 'focus';
        dw.targetSec = Math.max(300, Math.round(Number(dw.targetSec) || 5400));
        dw.breakSec = Math.max(60, Math.round(Number(dw.breakSec) || 1200));
        dw.remainingSec = Math.max(0, Math.round(Number(dw.remainingSec) || dw.targetSec));
        dw.microId = String(dw.microId || '');
        dw.intention = String(dw.intention || '');
        dw.lastTickAt = Math.max(0, Math.round(Number(dw.lastTickAt) || 0));
        if (!Array.isArray(dw.sessions)) dw.sessions = [];
        dw.sessions = dw.sessions.map((session) => {
            const focusSecRaw = Number(session?.focusSec);
            const focusSec = Number.isFinite(focusSecRaw) ? Math.max(60, Math.round(focusSecRaw)) : 3600;
            const endedAtTsRaw = String(session?.endedAtTs || '');
            const endedAtDate = endedAtTsRaw ? new Date(endedAtTsRaw) : null;
            const endedAtTs = endedAtDate && !Number.isNaN(endedAtDate.getTime())
                ? endedAtDate.toISOString()
                : new Date().toISOString();
            const endedAt = String(session?.endedAt || this.getLocalDateKey(new Date(endedAtTs)));
            return {
                endedAt: endedAt.split('T')[0],
                endedAtTs,
                focusSec,
                mode: 'focus',
                microId: String(session?.microId || ''),
                intention: String(session?.intention || '')
            };
        }).slice(0, 200);
    },
    syncDeepWorkMicroStatus: function() {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;
        if (!dw.isRunning || !dw.microId) return false;
        const micro = (state.entities?.micros || []).find(m => m.id === dw.microId);
        if (!micro || micro.status === 'done') return false;
        let changed = false;
        if (micro.status !== 'in_progress') {
            micro.status = 'in_progress';
            this.cascadeStartUp(micro.id);
            changed = true;
        }
        if (micro.completed) {
            micro.completed = false;
            changed = true;
        }
        return changed;
    },
    formatClock: function(totalSec) {
        const safe = Math.max(0, Math.round(Number(totalSec) || 0));
        const mm = String(Math.floor(safe / 60)).padStart(2, '0');
        const ss = String(safe % 60).padStart(2, '0');
        return `${mm}:${ss}`;
    },
    formatDurationHuman: function(totalSec) {
        const safe = Math.max(0, Math.round(Number(totalSec) || 0));
        const hours = Math.floor(safe / 3600);
        const mins = Math.floor((safe % 3600) / 60);
        if (hours > 0) return `${hours}h${String(mins).padStart(2, '0')}`;
        return `${mins} min`;
    },
    escapeHtml: function(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    getTierFromLevel: function(level) {
        const lv = Math.max(1, Number(level) || 1);
        return Math.min(4, Math.floor((lv - 1) / 2));
    },
        // Extracted in Phase 9: gamification module
getDimensionIdentity: function(dimension, level) {
        const lv = Math.max(1, Number(level) || 1);
        const tier = this.getTierFromLevel(lv);
        const catalog = this.getDimensionProgressionCatalog();
        const def = catalog[dimension] || {
            tone: '#0d9488',
            stages: [
                ['stars', 'Iniciante'],
                ['trending_up', 'Em avanço'],
                ['verified', 'Consistente'],
                ['rocket_launch', 'Destaque'],
                ['auto_awesome', 'Lendário'],
                ['stars', 'Ascendente'],
                ['stars', 'Ascendente II'],
                ['stars', 'Ascendente III'],
                ['stars', 'Ascendente IV'],
                ['stars', 'Ascendente V']
            ]
        };
        const stageIndex = Math.min(def.stages.length - 1, Math.max(0, lv - 1));
        const [icon, title] = def.stages[stageIndex];
        const isBeyondCatalog = lv > def.stages.length;
        const nextStage = stageIndex < def.stages.length - 1 ? def.stages[stageIndex + 1] : null;
        return {
            title: isBeyondCatalog ? `${title}+` : title,
            icon,
            tier,
            tierMax: 4,
            stageIndex,
            stageCount: def.stages.length,
            nextTitle: nextStage ? nextStage[1] : null
        };
    },
    getXpForLevelStep: function(level) {
        const lv = Math.max(1, Number(level) || 1);
        return 80 + ((lv - 1) * 25);
    },
    getXpThresholdForLevel: function(level) {
        const target = Math.max(1, Number(level) || 1);
        let total = 0;
        for (let lv = 1; lv < target; lv += 1) total += this.getXpForLevelStep(lv);
        return total;
    },
    getLevelFromXp: function(xp) {
        const safeXp = Math.max(0, Number(xp) || 0);
        let level = 1;
        let remaining = safeXp;
        while (level < 200) {
            const step = this.getXpForLevelStep(level);
            if (remaining < step) break;
            remaining -= step;
            level += 1;
        }
        return level;
    },
    getLevelProgress: function(xp) {
        const safeXp = Math.max(0, Number(xp) || 0);
        const level = this.getLevelFromXp(safeXp);
        const floor = this.getXpThresholdForLevel(level);
        const next = this.getXpForLevelStep(level);
        const current = Math.max(0, safeXp - floor);
        return {
            level,
            current,
            next,
            pct: Math.max(0, Math.min(100, (current / Math.max(1, next)) * 100))
        };
    },
    getGamificationDimensionKeys: function() {
        const stateKeys = Object.keys(window.sistemaVidaState?.dimensions || {});
        return stateKeys.length ? stateKeys : Object.keys(this.getDimensionProgressionCatalog?.() || {});
    },
    getOverallLevelSourceXp: function(gamification = window.sistemaVidaState?.gamification || {}) {
        const dimKeys = this.getGamificationDimensionKeys();
        if (!dimKeys.length) return 0;
        const total = dimKeys.reduce((sum, dim) => sum + Math.max(0, Number(gamification.dimensionXp?.[dim]) || 0), 0);
        return total / dimKeys.length;
    },
    getOverallLevelProgress: function(gamification = window.sistemaVidaState?.gamification || {}) {
        return this.getLevelProgress(this.getOverallLevelSourceXp(gamification));
    },
    getOverallLevelIdentity: function(level) {
        const lv = Math.max(1, Number(level) || 1);
        const names = [
            'Despertar',
            'Fundacao',
            'Tracao',
            'Consistencia',
            'Evolucao',
            'Dominio',
            'Expansao',
            'Maestria',
            'Legado',
            'Lendario'
        ];
        const idx = Math.min(names.length - 1, lv - 1);
        const base = names[idx];
        if (lv <= names.length) return { name: base, index: idx + 1 };
        return { name: `${base}+`, index: names.length };
    },
    getOverallLevelEvolution: function(level) {
        const lv = Math.max(1, Number(level) || 1);
        const stages = [
            ['wb_twilight', 'Despertar'],
            ['foundation', 'Fundacao'],
            ['trending_up', 'Tracao'],
            ['task_alt', 'Consistencia'],
            ['autorenew', 'Evolucao'],
            ['workspace_premium', 'Dominio'],
            ['open_in_full', 'Expansao'],
            ['psychology', 'Maestria'],
            ['history_edu', 'Legado'],
            ['military_tech', 'Lendario']
        ];
        return {
            stages,
            currentIndex: Math.min(stages.length - 1, Math.max(0, lv - 1)),
            totalStages: stages.length
        };
    },
    allocateGamificationXp: function(xp, primaryDimension = '') {
        const amount = Math.max(0, Number(xp) || 0);
        const dimKeys = this.getGamificationDimensionKeys();
        if (!amount || !dimKeys.length) return {};
        if (primaryDimension && dimKeys.includes(primaryDimension)) {
            return { [primaryDimension]: amount };
        }
        const base = Math.floor(amount / dimKeys.length);
        let remainder = amount % dimKeys.length;
        return dimKeys.reduce((acc, dim) => {
            acc[dim] = base + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder -= 1;
            return acc;
        }, {});
    },
    getDimensionEvolution: function(dimension, level) {
        const identity = this.getDimensionIdentity(dimension, level);
        const catalog = this.getDimensionProgressionCatalog();
        const fallback = {
            tone: '#0d9488',
            stages: [
                ['stars', 'Iniciante'],
                ['trending_up', 'Em avanço'],
                ['verified', 'Consistente'],
                ['rocket_launch', 'Destaque'],
                ['auto_awesome', 'Lendário'],
                ['stars', 'Ascendente'],
                ['stars', 'Ascendente II'],
                ['stars', 'Ascendente III'],
                ['stars', 'Ascendente IV'],
                ['stars', 'Ascendente V']
            ]
        };
        const data = catalog[dimension] || fallback;
        return {
            ...data,
            currentIndex: identity.stageIndex,
            totalStages: data.stages.length,
            identity
        };
    },
    getMicroEffort: function(micro) {
        const raw = String(micro?.effort || micro?.esforco || 'medio').toLowerCase();
        if (raw === 'leve' || raw === 'light') return 'leve';
        if (raw === 'denso' || raw === 'dense' || raw === 'alto') return 'denso';
        return 'medio';
    },
    getMicroEffortLabel: function(effort) {
        const labels = { leve: 'Leve', medio: 'Médio', denso: 'Denso' };
        return labels[this.getMicroEffort({ effort })] || labels.medio;
    },
    ensureGamificationState: function() {
        const state = window.sistemaVidaState;
        if (!state.gamification || typeof state.gamification !== 'object') state.gamification = {};
        const gamification = state.gamification;
        const dimKeys = this.getGamificationDimensionKeys();
        if (!gamification.dimensionXp || typeof gamification.dimensionXp !== 'object' || Array.isArray(gamification.dimensionXp)) {
            gamification.dimensionXp = {};
        }
        if (!gamification.events || typeof gamification.events !== 'object' || Array.isArray(gamification.events)) {
            gamification.events = {};
        }
        if (!Array.isArray(gamification.achievements)) gamification.achievements = [];
        if (!Array.isArray(gamification.recentEvents)) gamification.recentEvents = [];

        const legacyXp = Math.max(0, Number(state.profile?.xp) || 0);
        if (!Object.keys(gamification.dimensionXp).length && legacyXp > 0 && dimKeys.length) {
            const seeded = this.allocateGamificationXp(legacyXp, '');
            gamification.dimensionXp = { ...seeded };
        }
        dimKeys.forEach((dim) => {
            gamification.dimensionXp[dim] = Math.max(0, Number(gamification.dimensionXp[dim]) || 0);
        });
        Object.keys(gamification.dimensionXp).forEach((dim) => {
            if (!dimKeys.includes(dim)) delete gamification.dimensionXp[dim];
        });
        gamification.totalXp = dimKeys.reduce((sum, dim) => sum + (Number(gamification.dimensionXp[dim]) || 0), 0);
        gamification.achievements = gamification.achievements
            .filter(item => item && item.id)
            .filter((item, idx, arr) => arr.findIndex(a => a.id === item.id) === idx);
        gamification.recentEvents = gamification.recentEvents.filter(Boolean).slice(0, 20);

        if (!state.profile) state.profile = {};
        state.profile.xp = gamification.totalXp;
        state.profile.level = this.getOverallLevelProgress(gamification).level;
        return gamification;
    },
    getMonthKey: function(dateStr) {
        return (dateStr || this.getLocalDateKey()).slice(0, 7);
    },
    getDateDiffInDays: function(d1, d2) {
        return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
    },
    getPreviousHabitDoneDate: function(habit, beforeDateStr) {
        if (!habit || !habit.logs) return null;
        const dates = Object.keys(habit.logs)
            .filter(d => d < beforeDateStr && Number(habit.logs[d]) > 0)
            .sort();
        return dates.length ? dates[dates.length - 1] : null;
    },
    getKeyHabitStreak: function(habit, dateStr) {
        if (!habit || !habit.logs) return 0;
        let streak = 0;
        let cursor = dateStr || this.getLocalDateKey();
        for (let i = 0; i < 60; i++) {
            if (Number(habit.logs[cursor] || 0) <= 0) break;
            streak++;
            const d = new Date(cursor + 'T12:00:00');
            d.setDate(d.getDate() - 1);
            cursor = d.toISOString().slice(0, 10);
        }
        return streak;
    },
    getAchievementCatalog: function() {
        return {
            first_micro_done: { title: 'Primeira micro concluída', icon: 'task_alt' },
            first_planned_micro: { title: 'Plano executado', icon: 'event_available' },
            first_habit_done: { title: 'Ritual iniciado', icon: 'repeat' },
            first_focus_session: { title: 'Bloco de foco', icon: 'timer' },
            first_weekly_review: { title: 'Semana revisada', icon: 'rate_review' },
            total_level_5: { title: 'Sistema em movimento', icon: 'rocket_launch' },
            first_shadow_named: { title: 'Sombra nomeada', icon: 'change_circle' },
            first_strength_habit: { title: 'Força consciente', icon: 'workspace_premium' },
            shadow_antidote_7: { title: 'Antídoto em prática', icon: 'healing' },
            identity_integration_week: { title: 'Integração', icon: 'all_inclusive' },
            sustained_identity_growth: { title: 'Evolução sustentada', icon: 'trending_up' },
            first_habit_graduated: { title: 'Hábito automático', icon: 'verified' },
            key_habit_streak_7:  { title: '7 dias com Hábito-Chave',  icon: 'local_fire_department' },
            key_habit_streak_30: { title: '30 dias com Hábito-Chave', icon: 'military_tech' }
        };
    },
    unlockAchievement: function(id, extra = {}) {
        const gamification = this.ensureGamificationState();
        if (gamification.achievements.some(a => a.id === id)) return null;
        const catalog = this.getAchievementCatalog();
        const achievement = {
            id,
            title: extra.title || catalog[id]?.title || 'Conquista desbloqueada',
            icon: extra.icon || catalog[id]?.icon || 'military_tech',
            unlockedAt: new Date().toISOString()
        };
        gamification.achievements.unshift(achievement);
        gamification.achievements = gamification.achievements.slice(0, 50);
        return achievement;
    },
    showGamificationAwardEffects: function(result) {
        if (!result) return;
        this.showFloatingXp(result.xp);
        this.playGamificationLevelEffect(result);
    },
    playGamificationLevelEffect: function(result) {
        if (!result) return;
        if (result.tierPromotion) {
            this.playXpSound('tierup');
            setTimeout(() => this.showTierPromotionOverlay(result.dimension, result.identity?.title || '', result.identity?.icon || 'auto_awesome', result.dimensionLevel), 450);
        } else if (result.dimensionLeveledUp || result.totalLeveledUp) {
            this.playXpSound('levelup');
            if (result.dimension) {
                setTimeout(() => this.showTierPromotionOverlay(result.dimension, result.identity?.title || '', result.identity?.icon || 'trending_up', result.dimensionLevel), 450);
            }
        } else {
            this.playXpSound('xp');
        }
    },
    showGamificationBatchEffects: function(results, xpTotal = 0) {
        const awards = (Array.isArray(results) ? results : [results]).filter(Boolean);
        if (!awards.length) return;
        this.showFloatingXp(xpTotal || awards.reduce((sum, item) => sum + (Number(item.xp) || 0), 0));
        if (this.pushSocialInternalNotification) {
            awards.forEach((award) => {
                this.pushSocialInternalNotification('xp_gain', {
                    xp: award.xp,
                    title: award.sourceTitle || 'Acao registrada',
                    message: `+${award.xp} XP`
                }).catch(() => {});
                if (award.tierPromotion || award.dimensionLeveledUp || award.totalLeveledUp) {
                    this.pushSocialInternalNotification('level_up', {
                        level: award.totalLevel,
                        title: 'Subiu de nivel',
                        message: `Sistema nivel ${award.totalLevel}`
                    }).catch(() => {});
                }
                if (Array.isArray(award.achievementsUnlocked) && award.achievementsUnlocked.length) {
                    const first = award.achievementsUnlocked[0];
                    this.pushSocialInternalNotification('achievement_unlock', {
                        title: first.title || 'Conquista desbloqueada',
                        icon: first.icon || 'military_tech',
                        message: first.title || 'Conquista desbloqueada'
                    }).catch(() => {});
                }
            });
        }
        // Nota: o broadcast social é gerenciado pelo showGamificationToast() em gamification.js
        // para evitar emissão dupla e garantir que apenas o evento final processado seja enviado.
        const levelAward = awards.find(item => item.tierPromotion)
            || awards.find(item => item.dimensionLeveledUp)
            || awards.find(item => item.totalLeveledUp)
            || awards[0];
        this.playGamificationLevelEffect(levelAward);
    },
    showFloatingXp: function(xp) {
        if (!xp || xp <= 0) return;
        const el = document.createElement('div');
        el.textContent = `+${xp} XP`;
        Object.assign(el.style, {
            position: 'fixed',
            bottom: '130px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--md-sys-color-primary)',
            fontSize: '1.15rem',
            fontWeight: '800',
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            zIndex: '9999',
            animation: 'xpFloat 1.2s cubic-bezier(0.19,1,0.22,1) forwards',
            textShadow: '0 2px 12px rgba(0,0,0,0.18)'
        });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1300);
    },
    flashMicroCard: function(id) {
        const btn = document.querySelector(`[onclick*="completeMicroAction('${id}')"]`);
        if (!btn) return;
        const card = btn.closest('.rounded-2xl, .rounded-xl, .rounded-lg, li') || btn.parentElement;
        if (!card) return;
        card.classList.add('card-success-pulse');
        card.addEventListener('animationend', () => card.classList.remove('card-success-pulse'), { once: true });
    },
    showTierPromotionOverlay: function(dimension, title, icon, level = 1) {
        const evo = this.getDimensionEvolution(dimension, level || 1);
        const stages = evo.stages.map(([stageIcon, label], idx) => `
            <div class="gamification-level-row ${idx < evo.currentIndex ? 'done' : ''} ${idx === evo.currentIndex ? 'current' : ''}">
                <span class="gamification-level-badge">${idx + 1}</span>
                <span class="material-symbols-outlined notranslate">${this.escapeHtml(stageIcon)}</span>
                <div class="gamification-level-copy">
                    <strong>${this.escapeHtml(label)}</strong>
                    <small>Nível ${idx + 1} · ${this.escapeHtml(String(this.getXpThresholdForLevel(idx + 1)))} XP acumulados</small>
                </div>
            </div>
        `).join('');
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;';
        overlay.innerHTML = `
            <div class="gamification-level-overlay" style="--evo-tone:${evo.tone};">
                <span class="material-symbols-outlined notranslate level-main-icon">${icon}</span>
                <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--md-sys-color-outline);margin-top:0.75rem;">${this.escapeHtml(dimension)}</p>
                <p style="font-size:1.4rem;font-weight:800;color:var(--md-sys-color-on-surface);margin-top:0.2rem;">${this.escapeHtml(title)}</p>
                <p style="font-size:0.7rem;color:var(--md-sys-color-outline);margin-top:0.2rem;">Nível ${this.escapeHtml(String(level || 1))} desbloqueado</p>
                <div class="gamification-level-list overlay-list" style="margin-top:1rem;">${stages}</div>
            </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 2300);
    },
    formatDateTimeLocal: function(raw) {
        const dt = raw ? new Date(raw) : null;
        if (!dt || Number.isNaN(dt.getTime())) return '';
        return dt.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    getMicroPlanContext: function(micro) {
        const state = window.sistemaVidaState || {};
        const entities = state.entities || { metas: [], okrs: [], macros: [], micros: [] };
        const macro = (entities.macros || []).find(m => m.id === micro?.macroId);
        const okr = macro
            ? (entities.okrs || []).find(o => o.id === macro.okrId)
            : (entities.okrs || []).find(o => o.id === micro?.okrId);
        const meta = okr
            ? (entities.metas || []).find(m => m.id === okr.metaId)
            : (entities.metas || []).find(m => m.id === micro?.metaId);
        const parts = [meta?.title, okr?.title, macro?.title].filter(Boolean);
        return {
            meta,
            okr,
            macro,
            path: parts.length ? parts.join(' > ') : 'Sem trilha em Planos',
            parentLabel: macro?.title || okr?.title || meta?.title || 'Sem vínculo em Planos'
        };
    },
    getPlanMicros: function(options = {}) {
        const state = window.sistemaVidaState || {};
        const sources = [
            state.entities?.micros,
            state.entities?.micro,
            state.micros,
            state.microActions,
            state.microacoes,
            state.todos
        ];
        const normalizeStatus = (item) => {
            const raw = String(item?.status || '').toLowerCase();
            const progress = Number(item?.progress || 0);
            if (item?.completed === true || progress >= 100 || raw.includes('done') || raw.includes('conclu')) return 'done';
            if (raw.includes('progress') || raw.includes('andamento') || raw.includes('active')) return 'in_progress';
            return 'pending';
        };
        const byId = new Map();
        sources.forEach((source) => {
            if (!Array.isArray(source)) return;
            source.forEach((item) => {
                if (!item) return;
                const title = String(item.title || item.nome || item.name || item.tarefa || '').trim();
                if (!title) return;
                const id = String(item.id || item.uid || item.key || item._id || `${title}-${item.prazo || item.inicioDate || ''}`).trim();
                if (!id || byId.has(id)) return;
                const status = normalizeStatus(item);
                if (!item.id && state.entities && Array.isArray(state.entities.micros)) item.id = id;
                byId.set(id, {
                    ...item,
                    id,
                    title,
                    dimension: String(item.dimension || item.dimensao || item.area || 'Geral'),
                    status,
                    completed: status === 'done',
                    progress: status === 'done' ? 100 : Math.max(0, Math.min(100, Number(item.progress || 0)))
                });
            });
        });
        const micros = Array.from(byId.values());
        if (state.entities && Array.isArray(state.entities.micros)) {
            const existingIds = new Set(state.entities.micros.map(m => String(m.id || '')));
            micros.forEach((micro) => {
                if (!existingIds.has(micro.id)) state.entities.micros.push(micro);
            });
        }
        return options.includeDone ? micros : micros.filter(m => m.status !== 'done');
    },
    applyThemePreference: function() {
        this.ensureSettingsState();
        const cachedTheme = (() => {
            try {
                const v = this.localGet('lifeos_theme_pref');
                return ['light', 'dark', 'auto'].includes(v) ? v : null;
            } catch (_) {
                return null;
            }
        })();
        const pref = cachedTheme || window.sistemaVidaState.settings.theme || 'auto';
        if (window.sistemaVidaState.settings.theme !== pref) {
            window.sistemaVidaState.settings.theme = pref;
        }
        const root = document.documentElement;
        const hour = new Date().getHours();
        const isNightByHour = hour < 6 || hour >= 18;
        const useDark = pref === 'dark' || (pref === 'auto' && isNightByHour);
        root.classList.toggle('dark', useDark);
        root.classList.toggle('light', !useDark);
        root.style.colorScheme = useDark ? 'dark' : 'light';
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.setAttribute('content', useDark ? '#0b1220' : '#01696f');
        if (!this._themeAutoTickBound) {
            this._themeAutoTickBound = true;
            setInterval(() => {
                if ((window.sistemaVidaState.settings?.theme || 'auto') === 'auto') this.applyThemePreference();
            }, 5 * 60 * 1000);
        }
        if (!this._themeMediaBound && window.matchMedia) {
            this._themeMediaBound = true;
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', () => {
                if ((window.sistemaVidaState.settings?.theme || 'auto') === 'auto') this.applyThemePreference();
            });
        }
    },
    setThemePreference: function(theme) {
        this.ensureSettingsState();
        const next = ['light', 'dark', 'auto'].includes(theme) ? theme : 'auto';
        window.sistemaVidaState.settings.theme = next;
        try { this.localSet('lifeos_theme_pref', next); } catch (_) {}
        this.applyThemePreference();
        this.saveState(true);
        this.showToast(`Tema aplicado: ${next === 'auto' ? 'Automático' : (next === 'dark' ? 'Escuro' : 'Claro')}.`, 'success');
        if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
    },
        // Extracted in Phase 9: notifications module
_getAudioContext: function() {
        if (!this._audioCtx) {
            try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
        }
        return this._audioCtx || null;
    },
    playXpSound: function(type = 'xp') {
        if (!window.sistemaVidaState.settings?.soundEnabled) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;
        const sequences = {
            xp:      [{ f: 523, t: 0,    d: 0.09 }, { f: 659, t: 0.11, d: 0.13 }],
            levelup: [{ f: 523, t: 0,    d: 0.08 }, { f: 659, t: 0.10, d: 0.08 }, { f: 784, t: 0.20, d: 0.18 }],
            tierup:  [{ f: 523, t: 0,    d: 0.07 }, { f: 659, t: 0.09, d: 0.07 }, { f: 784, t: 0.18, d: 0.07 }, { f: 1047, t: 0.27, d: 0.22 }]
        };
        const seq = sequences[type] || sequences.xp;
        const now = ctx.currentTime;
        seq.forEach(({ f, t, d }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0.16, now + t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
            osc.start(now + t);
            osc.stop(now + t + d + 0.05);
        });
    },
    toggleSoundSetting: function() {
        this.ensureSettingsState();
        const on = !window.sistemaVidaState.settings.soundEnabled;
        window.sistemaVidaState.settings.soundEnabled = on;
        this.saveState(true);
        if (on) setTimeout(() => this.playXpSound('xp'), 80);
        const track = document.getElementById('sound-toggle-track');
        const knob = document.getElementById('sound-toggle-knob');
        if (track) track.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${on ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
        if (knob) knob.className = `w-3 h-3 rounded-full absolute transition-all ${on ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
        this.showToast(on ? 'Sons de gamificação ativados.' : 'Sons de gamificação desativados.', 'success');
    },
    toggleSplashSetting: function() {
        this.ensureSettingsState();
        const on = !window.sistemaVidaState.settings.splashEnabled;
        window.sistemaVidaState.settings.splashEnabled = on;
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast(on ? 'Bússola inicial ativada.' : 'Bússola inicial desativada.', 'success');
    },
    setSplashModeSetting: function(mode) {
        this.ensureSettingsState();
        window.sistemaVidaState.settings.splashMode = ['daily', 'twice_daily', 'always'].includes(mode) ? mode : 'daily';
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast('Frequência da bússola atualizada.', 'success');
    },
    setSplashDurationSetting: function(raw) {
        this.ensureSettingsState();
        const duration = Math.max(1, Math.min(20, Math.round(Number(raw) || 3)));
        window.sistemaVidaState.settings.splashDurationSec = duration;
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast('Tempo da bússola atualizado.', 'success');
    },
    setOdysseySplashFilter: function(value) {
        this.ensureSettingsState();
        window.sistemaVidaState.settings.odysseySplashFilter = ['all', 'cenarioA', 'cenarioB', 'cenarioC'].includes(value) ? value : 'all';
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast('Filtro do Splash Odyssey atualizado.', 'success');
    },
    setOdysseySplashDurationSetting: function(raw) {
        this.ensureSettingsState();
        const duration = Math.max(1, Math.min(20, Math.round(Number(raw) || 3)));
        window.sistemaVidaState.settings.odysseySplashDurationSec = duration;
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast('Tempo do Splash Odyssey atualizado.', 'success');
    },
    setOdysseySplashModeSetting: function(mode) {
        this.ensureSettingsState();
        window.sistemaVidaState.settings.odysseySplashMode = ['daily', 'twice_daily', 'always'].includes(mode) ? mode : 'daily';
        this.saveState(true);
        this.updateSplashSettingsControls();
        this.showToast('Frequência do Splash Odyssey atualizada.', 'success');
    },
    updateSplashSettingsControls: function() {
        this.ensureSettingsState();
        const settings = window.sistemaVidaState.settings;
        const on = settings.splashEnabled !== false;
        const track = document.getElementById('splash-toggle-track');
        const knob = document.getElementById('splash-toggle-knob');
        const modeSelect = document.getElementById('splash-mode-select');
        const durationInput = document.getElementById('splash-duration-input');
        if (track) track.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${on ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
        if (knob) knob.className = `w-3 h-3 rounded-full absolute transition-all ${on ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
        if (modeSelect) {
            modeSelect.value = settings.splashMode || 'daily';
            modeSelect.disabled = !on;
            modeSelect.classList.toggle('opacity-50', !on);
        }
        if (durationInput) {
            durationInput.value = settings.splashDurationSec || 3;
            durationInput.disabled = !on;
            durationInput.classList.toggle('opacity-50', !on);
        }
        const odysseyFilterSelect = document.getElementById('odyssey-splash-filter-select');
        if (odysseyFilterSelect) {
            odysseyFilterSelect.value = settings.odysseySplashFilter || 'all';
        }
        const odysseyModeSelect = document.getElementById('odyssey-splash-mode-select');
        if (odysseyModeSelect) {
            odysseyModeSelect.value = settings.odysseySplashMode || 'daily';
        }
        const odysseyDurationInput = document.getElementById('odyssey-splash-duration-input');
        if (odysseyDurationInput) {
            odysseyDurationInput.value = settings.odysseySplashDurationSec || 3;
        }
    },
    shouldShowSplashOnOpen: function() {
        this.ensureSettingsState();
        const settings = window.sistemaVidaState.settings;
        if (settings.splashEnabled === false) return false;
        if (settings.splashMode === 'always') return true;

        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        let log = {};
        try { log = JSON.parse(this.localGet('lifeos_splash_log') || '{}') || {}; } catch (_) { log = {}; }
        const todayCount = Number(log.date === todayKey ? log.count : 0) || 0;
        const maxCount = settings.splashMode === 'twice_daily' ? 2 : 1;
        return todayCount < maxCount;
    },
    registerSplashShown: function() {
        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        try {
            const raw = JSON.parse(this.localGet('lifeos_splash_log') || '{}') || {};
            const count = raw.date === todayKey ? Number(raw.count || 0) + 1 : 1;
            this.localSet('lifeos_splash_log', JSON.stringify({ date: todayKey, count }));
            this.localSet('lifeos_last_splash', todayKey);
        } catch (_) {}
    },
    showDailySplash: function() {
        this.ensureSettingsState();
        const compass = this.getDailyCompass();
        const quote = compass.quote;
        this.registerSplashShown();
        this._nextSplashAfterDismiss = this.shouldShowOdysseySplashOnOpen() ? 'odyssey' : null;
        const duration = Math.max(1, Math.min(20, Number(window.sistemaVidaState.settings.splashDurationSec || 3)));

        const el = document.createElement('div');
        el.id = 'daily-splash-screen';
        el.className = 'lifeos-splash';
        const quoteHtml = quote ? `<p class="lifeos-splash__quote">"${this.escapeHtml(quote.quote)}"</p>` : '';
        const authorHtml = quote?.author ? `<p class="lifeos-splash__author">— ${this.escapeHtml(quote.author)}</p>` : '';
        const reflectionHtml = quote?.reflection ? `<p class="lifeos-splash__reflection">${this.escapeHtml(quote.reflection)}</p>` : '';
        el.innerHTML = `
            <div class="lifeos-splash__content">
                <span class="lifeos-splash__mark">
                    <span class="material-symbols-outlined notranslate" style="font-size:2rem;">explore</span>
                </span>
                <p class="lifeos-splash__eyebrow">Bússola do Dia</p>
                <p class="lifeos-splash__theme">${this.escapeHtml(compass.theme || 'Life OS')}</p>
                ${quoteHtml}${authorHtml}${reflectionHtml}
                <button class="lifeos-splash__button" onclick="event.stopPropagation();window.app.dismissSplash()">
                    Começar o dia
                </button>
                <p id="splash-countdown" class="lifeos-splash__countdown">Continua em ${duration}s</p>
            </div>`;
        el.addEventListener('click', () => this.dismissSplash());
        document.body.appendChild(el);

        let secs = duration;
        const countdownEl = el.querySelector('#splash-countdown');
        this._splashTimer = setInterval(() => {
            secs--;
            if (countdownEl) countdownEl.textContent = secs > 0 ? `Continua em ${secs}s` : '';
            if (secs <= 0) { clearInterval(this._splashTimer); this._splashTimer = null; this.dismissSplash(); }
        }, 1000);
    },
    dismissSplash: function() {
        if (this._splashTimer) { clearInterval(this._splashTimer); this._splashTimer = null; }
        const el = document.getElementById('daily-splash-screen');
        const shouldShowOdyssey = this._nextSplashAfterDismiss === 'odyssey';
        this._nextSplashAfterDismiss = null;
        if (el) {
            el.style.transition = 'opacity 0.3s ease-out';
            el.style.opacity = '0';
            setTimeout(() => {
                el.remove();
                this.switchView('hoje');
                if (shouldShowOdyssey) this.showOdysseySplashIfEligible();
            }, 320);
        } else {
            this.switchView('hoje');
            if (shouldShowOdyssey) this.showOdysseySplashIfEligible();
        }
    },
    getOdysseySplashFilter: function() {
        this.ensureSettingsState();
        const filter = String(window.sistemaVidaState.settings.odysseySplashFilter || 'all');
        return ['all', 'cenarioA', 'cenarioB', 'cenarioC'].includes(filter) ? filter : 'all';
    },
    getOdysseySplashDurationSec: function() {
        this.ensureSettingsState();
        const duration = Number(window.sistemaVidaState.settings.odysseySplashDurationSec);
        if (!Number.isFinite(duration) || duration < 1 || duration > 20) return 3;
        return Math.round(duration);
    },
    getOdysseySplashSlides: function() {
        const images = window.sistemaVidaState.profile.odysseyImages || {};
        const titles = window.sistemaVidaState.profile.odysseyTitles || {};
        const filter = this.getOdysseySplashFilter();
        const slides = [
            { key: 'cenarioA', label: 'Cenário A', title: titles.cenarioA || 'Cenário A', src: images.cenarioA || '' },
            { key: 'cenarioB', label: 'Cenário B', title: titles.cenarioB || 'Cenário B', src: images.cenarioB || '' },
            { key: 'cenarioC', label: 'Cenário C', title: titles.cenarioC || 'Cenário C', src: images.cenarioC || '' }
        ].filter(item => item.src && item.src.length > 10);
        return filter === 'all' ? slides : slides.filter(item => item.key === filter);
    },
    shouldShowOdysseySplashOnOpen: function() {
        this.ensureSettingsState();
        if (document.getElementById('odyssey-splash-screen')) return false;
        const settings = window.sistemaVidaState.settings;
        if (settings.odysseySplashMode === 'always') return true;
        const slides = this.getOdysseySplashSlides();
        if (slides.length === 0) return false;
        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        let log = {};
        try { log = JSON.parse(this.localGet('lifeos_odyssey_splash_log') || '{}') || {}; } catch (_) { log = {}; }
        const todayCount = Number(log.date === todayKey ? log.count : 0) || 0;
        const maxCount = settings.odysseySplashMode === 'twice_daily' ? 2 : 1;
        return todayCount < maxCount;
    },
    registerOdysseySplashShown: function() {
        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        try {
            const raw = JSON.parse(this.localGet('lifeos_odyssey_splash_log') || '{}') || {};
            const count = raw.date === todayKey ? Number(raw.count || 0) + 1 : 1;
            this.localSet('lifeos_odyssey_splash_log', JSON.stringify({ date: todayKey, count }));
            this.localSet('lifeos_odyssey_splash_last', todayKey);
        } catch (_) {}
    },
    showOdysseySplashIfEligible: function() {
        if (!this.shouldShowOdysseySplashOnOpen()) return false;
        this.showOdysseySplash();
        return true;
    },
    showOdysseySplash: function() {
        const slides = this.getOdysseySplashSlides();
        if (slides.length === 0) return;
        this.registerOdysseySplashShown();
        const duration = Math.max(1, Math.min(20, this.getOdysseySplashDurationSec()));
        const el = document.createElement('div');
        el.id = 'odyssey-splash-screen';
        el.className = 'lifeos-odyssey-splash';
        el.innerHTML = `
            <div class="lifeos-odyssey-splash__frame" onclick="event.stopPropagation();">
                <div class="lifeos-odyssey-splash__slides-container">
                    ${slides.map((slide, idx) => `
                        <div class="lifeos-odyssey-slide" data-slide-index="${idx}" style="opacity: ${idx === 0 ? 1 : 0};">
                            <img class="lifeos-odyssey-slide__image" src="${this.escapeHtml(slide.src)}" alt="${this.escapeHtml(slide.label)}" />
                            <div class="lifeos-odyssey-slide__overlay"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="lifeos-odyssey-splash__footer">
                    <div class="lifeos-odyssey-slide__header">
                        <span class="lifeos-odyssey-slide__badge">${this.escapeHtml(slides[0].label)}</span>
                        <h2 class="lifeos-odyssey-slide__title">${this.escapeHtml(slides[0].title)}</h2>
                    </div>
                    <button class="lifeos-odyssey-button" onclick="event.stopPropagation();window.app.dismissOdysseySplash()">Começar o dia</button>
                </div>
            </div>
        `;
        el.addEventListener('click', () => this.dismissOdysseySplash());
        document.body.appendChild(el);

        let currentIndex = 0;
        const slideEls = Array.from(el.querySelectorAll('.lifeos-odyssey-slide'));
        const footerHeader = el.querySelector('.lifeos-odyssey-slide__header');
        
        const nextSlide = () => {
            if (slideEls.length < 2) return;
            const nextIndex = (currentIndex + 1) % slideEls.length;
            slideEls[currentIndex].style.opacity = '0';
            slideEls[nextIndex].style.opacity = '1';
            currentIndex = nextIndex;
            if (footerHeader) {
                const slide = slides[nextIndex];
                footerHeader.querySelector('.lifeos-odyssey-slide__badge').textContent = slide.label;
                footerHeader.querySelector('.lifeos-odyssey-slide__title').textContent = slide.title;
            }
        };
        
        // Timer para trocar slides
        this._odysseySplashTimer = setInterval(nextSlide, duration * 1000);
        
        // Timer para auto-dismiss: mostra todos os slides filtrados antes de encerrar.
        const totalDisplayTime = duration * Math.max(1, slides.length) * 1000;
        this._odysseySplashDismissTimer = setTimeout(() => {
            this.dismissOdysseySplash();
        }, totalDisplayTime);
    },
    dismissOdysseySplash: function() {
        if (this._odysseySplashTimer) {
            clearInterval(this._odysseySplashTimer);
            this._odysseySplashTimer = null;
        }
        if (this._odysseySplashDismissTimer) {
            clearTimeout(this._odysseySplashDismissTimer);
            this._odysseySplashDismissTimer = null;
        }
        const el = document.getElementById('odyssey-splash-screen');
        if (el) {
            el.style.transition = 'opacity 0.25s ease-out';
            el.style.opacity = '0';
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
        }
    },
    openFlowModal: function() {
        const el = document.getElementById('flow-modal');
        if (!el) return;
        this.renderFlowModal();
        el.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    closeFlowModal: function() {
        const el = document.getElementById('flow-modal');
        if (!el) return;
        el.classList.add('hidden');
        document.body.style.overflow = '';
    },

    flowNavigate: async function(view, sectionId = '', tabId = '') {
        this.closeFlowModal();
        await this.switchView(view, { preserveScroll: !!sectionId });

        if (tabId && this.currentView === 'planos') {
            this.switchPlanosTab(tabId);
            if (this.render.planos) this.render.planos();
        }

        if (sectionId) {
            // Usa requestAnimationFrame para esperar pelo próximo ciclo de renderização
            requestAnimationFrame(() => {
                const scrollToSection = () => {
                    const section = document.getElementById(sectionId);
                    if (section) {
                        // Pequeno delay adicional para garantir que o layout esteja estável
                        setTimeout(() => {
                            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            // Highlight temporário para feedback visual
                            section.classList.add('ring-2', 'ring-primary/30');
                            setTimeout(() => section.classList.remove('ring-2', 'ring-primary/30'), 2000);
                        }, 100);
                        return true;
                    }
                    return false;
                };

                // Tenta imediatamente
                if (!scrollToSection()) {
                    // Se não conseguiu, tenta novamente após um delay maior
                    setTimeout(() => {
                        if (!scrollToSection()) {
                            // Última tentativa com delay ainda maior
                            setTimeout(scrollToSection, 500);
                        }
                    }, 300);
                }
            });
        }
    },

    _getFlowState: function() {
        const state = window.sistemaVidaState;
        const today = this.getLocalDateKey();
        const monthKey = today.slice(0, 7);
        const todayLog = (state.dailyLogs || {})[today] || {};
        const events = (state.gamification?.events) || {};
        const cadenceOk = (key) => this.getCadenceStatus(key).state === 'ok';

        const microsDoneToday = (state.entities.micros || []).some(m =>
            (m.status === 'done' || m.completed) &&
            (m.completedDate === today || m.doneDate === today));

        const habitsDoneToday = (state.habits || []).some(h => events[`habit:${h.id}:${today}`]);

        const focusToday = (state.deepWork?.sessions || []).some(s =>
            (s.endedAt || s.startedAt || '').startsWith(today));

        const shutdownLines = Array.isArray(todayLog.shutdown)
            ? todayLog.shutdown.filter(value => typeof value === 'string' ? value.trim() !== '' : Boolean(value)).map(String)
            : [todayLog.shutdown].filter(value => typeof value === 'string' ? value.trim() !== '' : Boolean(value)).map(String);
        const shutdownVal = shutdownLines.find(line => line.trim()) || '';
        const shutdownNotes = Object.values(todayLog.dimensionNotes || {})
            .filter(value => typeof value === 'string' ? value.trim() !== '' : Boolean(value))
            .map(String)
            .find(note => note.trim()) || '';

        // Check both saved state and live DOM values
        const intentionDomVal = document.getElementById('diario-foco')?.value || '';

        return {
            checkinDone: cadenceOk('checkin'),
            intentionDone: !!(todayLog.focus || '').trim() || !!intentionDomVal.trim(),
            microsDoneToday,
            habitsDoneToday,
            focusToday,
            diaryDone: cadenceOk('diary'),
            shutdownDone: cadenceOk('shutdown'),
            weekPlanDone: cadenceOk('weeklyPlan'),
            weekReviewDone: cadenceOk('weeklyReview'),
            wheelThisMonth: cadenceOk('wheel'),
            permaThisMonth: cadenceOk('perma'),
            macrosThisMonth: (state.entities.macros || []).some(m => (m.updatedAt || m.createdAt || '').startsWith(monthKey)),
            swlsThisQuarter: cadenceOk('swls'),
            cycleReviewDone: cadenceOk('cycleReview'),
            okrsExist: (state.entities.okrs || []).length > 0,
            odysseyFilled: cadenceOk('odyssey'),
            purposeFilled: cadenceOk('purpose'),
            lifeGoalsFilled: this.hasLifeGoalsContent() && cadenceOk('lifeGoals'),
        };
    },

        // Extracted in Phase 9: render module
openAvatarPicker: function() {
        const input = document.getElementById('profile-photo-input');
        if (input) input.click();
    },
    fileToOptimizedDataUrl: function(file, maxSide = 1024, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const w = img.width || 1;
                    const h = img.height || 1;
                    const scale = Math.min(1, maxSide / Math.max(w, h));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(w * scale));
                    canvas.height = Math.max(1, Math.round(h * scale));
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Canvas indisponível'));
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = String(reader.result || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    isInlineImageDataUrl: function(value) {
        return typeof value === 'string' && value.startsWith('data:image/');
    },
    uploadProfileImageDataUrl: async function(dataUrl, path) {
        // Firebase Storage bypassed — images stored in Firestore directly via syncImagesToFirestoreDoc.
        return dataUrl || '';
    },
    syncImagesToFirestoreDoc: async function() {
        this.ensureSettingsState();
        const profile = window.sistemaVidaState.profile || {};
        const imagesData = {};
        let hasAny = false;
        if (profile.avatarUrl && typeof profile.avatarUrl === 'string' && profile.avatarUrl.length > 10) {
            imagesData.avatarUrl = profile.avatarUrl;
            hasAny = true;
        }
        const odysseyImages = profile.odysseyImages || {};
        for (const key of ['cenarioA', 'cenarioB', 'cenarioC']) {
            if (odysseyImages[key] && typeof odysseyImages[key] === 'string' && odysseyImages[key].length > 10) {
                if (!imagesData.odysseyImages) imagesData.odysseyImages = {};
                imagesData.odysseyImages[key] = odysseyImages[key];
                hasAny = true;
            }
        }
        if (!hasAny) return false;
        const imagesRef = this.getImagesDocRef();
        await this.withTimeout(setDoc(imagesRef, imagesData, { merge: true }), 15000, 'firestore_saveImages');
        console.log('[Images] Imagens sincronizadas com Firestore.');
        return true;
    },
    onProfilePhotoSelected: function(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            this.showToast('Selecione um arquivo de imagem válido.', 'error');
            return;
        }
        this.fileToOptimizedDataUrl(file, 400, 0.70).then(async (dataUrl) => {
            this.ensureSettingsState();
            window.sistemaVidaState.profile.avatarUrl = dataUrl;
            try { this.localSet('lifeos_profile_avatar', dataUrl); } catch (_) {}
            this.renderProfileChrome();
            // Feedback imediato
            if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
            this.showToast('Processando foto...', 'info');
            await this.saveState(true);
            if (this.lastCloudSyncOk === false) {
                const reason = this.lastCloudSyncErrorCode ? ` (${this.lastCloudSyncErrorCode})` : '';
                this.showToast(`Foto salva só neste dispositivo.${reason}`, 'error');
            } else {
                if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
                this.showToast('Foto de perfil atualizada! ✓', 'success');
            }
        }).catch(() => {
            this.showToast('Falha ao ler a imagem selecionada.', 'error');
        }).finally(() => {
            event.target.value = '';
        });
    },
    openOdysseyImagePicker: function(cenarioKey) {
        this.ensureSettingsState();
        const input = document.getElementById('odyssey-image-input');
        if (!input) return;
        input.setAttribute('data-cenario-key', cenarioKey || '');
        input.click();
    },
    onOdysseyImageSelected: function(event) {
        this.ensureSettingsState();
        const input = event?.target;
        const key = input?.getAttribute('data-cenario-key') || '';
        const file = input?.files?.[0];
        if (!key || !file) return;
        if (!file.type.startsWith('image/')) {
            this.showToast('Selecione um arquivo de imagem válido para o cenário.', 'error');
            return;
        }
        this.fileToOptimizedDataUrl(file, 600, 0.65).then(async (dataUrl) => {
            const current = window.sistemaVidaState.profile.odysseyImages || {};
            window.sistemaVidaState.profile.odysseyImages = { ...current, [key]: dataUrl };
            try {
                this.localSet('lifeos_odyssey_images', JSON.stringify(window.sistemaVidaState.profile.odysseyImages));
            } catch (_) {}
            // Feedback imediato
            if (this.render.proposito) this.render.proposito();
            this.showToast('Sincronizando imagem...', 'info');
            await this.saveState(true);
            if (this.lastCloudSyncOk === false) {
                const reason = this.lastCloudSyncErrorCode ? ` (${this.lastCloudSyncErrorCode})` : '';
                this.showToast(`Imagem salva só neste dispositivo.${reason}`, 'error');
            } else {
                if (this.render.proposito) this.render.proposito();
                this.showToast('Imagem do cenário atualizada! ✓', 'success');
            }
        }).catch(() => {
            this.showToast('Falha ao ler a imagem selecionada.', 'error');
        }).finally(() => {
            input.value = '';
        });
    },
    viewOdysseyImage: function(cenarioKey) {
        const images = window.sistemaVidaState.profile?.odysseyImages || {};
        const src = images[cenarioKey];
        if (!src) return;

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
        modal.style.zIndex = '100050';
        modal.id = 'odyssey-image-viewer';
        modal.onclick = (e) => {
            if (e.target === modal) this.closeOdysseyImageViewer();
        };
        modal.innerHTML = `
            <div class="relative max-w-4xl max-h-[90vh] flex flex-col">
                <button onclick="window.app.closeOdysseyImageViewer()" class="absolute -top-10 right-0 text-white hover:text-gray-300 transition text-2xl font-bold" aria-label="Fechar">✕</button>
                <img src="${this.escapeHtml(src)}" alt="Imagem do cenário" class="max-w-full max-h-[85vh] object-contain rounded-lg">
            </div>
        `;
        document.body.appendChild(modal);
    },
    closeOdysseyImageViewer: function() {
        const modal = document.getElementById('odyssey-image-viewer');
        if (modal) {
            modal.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
            }, 200);
        }
    },

    showToast: function(message, type = 'success') {
        let container = document.getElementById('global-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-toast-container';
            container.className = 'fixed bottom-24 right-4 z-[10000] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 pointer-events-none';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        const isSuccess = type === 'success';
        const isWarning = type === 'warning';
        const icon = isSuccess ? 'check_circle' : (isWarning ? 'info' : 'error');
        const bgColor = isSuccess ? 'bg-surface-container-highest' : (isWarning ? 'bg-surface-container-highest' : 'bg-error');
        const textColor = isSuccess ? 'text-primary' : (isWarning ? 'text-amber-600' : 'text-white');
        const ringColor = isSuccess ? 'ring-primary/20' : (isWarning ? 'ring-amber-400/20' : 'ring-error/20');
        
        toast.className = `flex max-w-sm items-center gap-3 px-5 py-3 rounded-2xl shadow-xl transform transition-all duration-500 translate-y-8 opacity-0 ${bgColor} border border-outline-variant/10 ring-4 ${ringColor}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined notranslate ${textColor} text-xl">${icon}</span>
            <p class="text-sm font-semibold ${isSuccess || isWarning ? 'text-on-surface' : 'text-white'}">${message}</p>
        `;
        
        container.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.classList.remove('translate-y-8', 'opacity-0');
        }, 10);
        
        // Remover após 3.5 segundos
        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    },
    clearBlockingMessage: function() {
        const el = document.getElementById('crud-blocking-message');
        if (!el) return;
        el.textContent = '';
        el.classList.add('hidden');
    },
    showBlockingMessage: function(message, options = {}) {
        const text = String(message || 'Não foi possível continuar. Verifique os campos destacados.').trim();
        const el = document.getElementById(options.targetId || 'crud-blocking-message');
        if (el) {
            el.textContent = text;
            el.classList.remove('hidden');
            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
        }
        this.showToast(text, 'error');
    },
    currentView: '',
    pendingFocusMicroId: '',
    pendingFocusAutoStart: false,
    painelFilter: 'ciclo',
    planosFilter: 'Todas',
    planosStatusFilter: 'all',
    planosActiveTab: 'metas',
    planosHierarchyType: '',
    planosHierarchyId: '',
    focusTypeFilter: 'Tudo',
    focusStatusFilter: 'Tudo',
    focusDistributionViewMode: 'one_line',
    currentTextGroup: null,
    currentTextKey: null,
    onboardingStep: 0,
    metaTrailStep: 1,
    _wizardPlanSuggestion: null,
    lastCloudSyncOk: null,
    lastCloudSyncErrorCode: '',

    // ------------------------------------------------------------------------
    // Cloud Persistence Engine
    // ------------------------------------------------------------------------
    getPersistableState: function(mode = 'full') {
        const raw = window.sistemaVidaState || {};
        const snapshot = JSON.parse(JSON.stringify(raw));
        if (mode === 'cloud') {
            if (snapshot.profile) {
                // Images are stored in a separate Firestore document.
                // Always strip them from the main state document to keep it slim.
                delete snapshot.profile.avatarUrl;
                delete snapshot.profile.odysseyImages;
            }
            snapshot._persistenceMode = 'cloud_slim';
        }
        if (mode === 'core') {
            if (snapshot.profile) {
                delete snapshot.profile.avatarUrl;
                delete snapshot.profile.odysseyImages;
            }
            snapshot._persistenceMode = 'core_local';
        }
        return snapshot;
    },

    hasRemoteImageUrl: function(value) {
        return typeof value === 'string' && /^https?:\/\//.test(value);
    },

    mergeDeep: function(target, source) {
        if (!source || typeof source !== 'object') return target;
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.mergeDeep(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    },
    getEmptyOdysseyImages: function() {
        return { cenarioA: '', cenarioB: '', cenarioC: '' };
    },
    applyRemoteImagesDoc: function(imgData = {}, options = {}) {
        const replace = options.replace !== false;
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        const remoteOdyssey = (imgData.odysseyImages && typeof imgData.odysseyImages === 'object') ? imgData.odysseyImages : {};
        const currentOdyssey = window.sistemaVidaState.profile.odysseyImages || this.getEmptyOdysseyImages();
        window.sistemaVidaState.profile.avatarUrl = (imgData.avatarUrl && typeof imgData.avatarUrl === 'string')
            ? imgData.avatarUrl
            : (replace ? '' : (window.sistemaVidaState.profile.avatarUrl || ''));
        window.sistemaVidaState.profile.odysseyImages = {
            cenarioA: typeof remoteOdyssey.cenarioA === 'string' ? remoteOdyssey.cenarioA : (replace ? '' : (currentOdyssey.cenarioA || '')),
            cenarioB: typeof remoteOdyssey.cenarioB === 'string' ? remoteOdyssey.cenarioB : (replace ? '' : (currentOdyssey.cenarioB || '')),
            cenarioC: typeof remoteOdyssey.cenarioC === 'string' ? remoteOdyssey.cenarioC : (replace ? '' : (currentOdyssey.cenarioC || ''))
        };
        try { this.localSet('lifeos_profile_avatar', window.sistemaVidaState.profile.avatarUrl); } catch (_) {}
        try { this.localSet('lifeos_odyssey_images', JSON.stringify(window.sistemaVidaState.profile.odysseyImages)); } catch (_) {}
    },

    setupRealtimeSync: function() {
        if (this._realtimeSyncUnsub) return; // already active
        const self = this;
        const trySetup = function() {
            self.withTimeout(getAuthReady(), 10000, 'auth_ready').then(() => {
                const stateRef = self.getStateDocRef();
                self._realtimeSyncUnsub = onSnapshot(stateRef, (docSnap) => {
                    if (!docSnap.exists()) return;
                    if (self._isSaving) return; // mid-save, skip echo
                    if (docSnap.metadata && docSnap.metadata.hasPendingWrites) return;
                const remoteData = docSnap.data();
                const remoteTs = Number(remoteData?._lastUpdatedAt || 0);
                const localTs = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
                const localPending = !!window.sistemaVidaState?._pendingLocalChanges;
                if (localPending && localTs > remoteTs) {
                    console.log('[SYNC] Ignoring stale remote snapshot while local pending state is newer.');
                    return;
                }
                console.log('[SYNC] Real-time update received from cloud');
                self.updateSyncBadge('ok');
                window.sistemaVidaState = app.mergeDeep(window.sistemaVidaState, remoteData);
                app.applyForcedOnboardingResetState();
                if (window.sistemaVidaState._pendingLocalChanges) window.sistemaVidaState._pendingLocalChanges = false;
                window.sistemaVidaState._lastUpdatedAt = Number(remoteData?._lastUpdatedAt || window.sistemaVidaState._lastUpdatedAt || Date.now());
                app.normalizeDimensionsState();
                app.normalizeEntitiesState();
                app.normalizeDailyLogsState();
                app.persistLocalMirror();
                // Re-render active view so changes appear immediately
                try {
                    const view = app.currentView;
                    if (view && app.render && app.render[view]) app.render[view]();
                } catch (_) {}
                }, function(err) {
                    console.warn('[SYNC] Real-time listener error:', err);
                    self.updateSyncBadge('error');
                    // Listener errored – tear down and retry in 30s
                    self._realtimeSyncUnsub = null;
                    setTimeout(function() { self.setupRealtimeSync(); }, 30000);
                });
                // ---- images document real-time listener ----
                if (!self._imagesSyncUnsub) {
                    const imagesRef = self.getImagesDocRef();
                    self._imagesSyncUnsub = onSnapshot(imagesRef, (imgSnap) => {
                        if (!imgSnap.exists()) return;
                        if (self._isSaving) return;
                        const imgData = imgSnap.data();
                        try {
                            app.applyRemoteImagesDoc(imgData, { replace: app.isRealAccount() });
                        } catch (_) {}
                        app.persistLocalMirror();
                        console.log('[Images] Atualização de imagens recebida em tempo real.');
                        try {
                            if (app.currentView && app.render && app.render[app.currentView]) app.render[app.currentView]();
                        } catch (_) {}
                    }, function(err) { console.warn('[Images] Listener de imagens erro:', err); });
                }
                // ---- periodic fallback pull every 60s ----
                if (!self._periodicSyncId) {
                    self._periodicSyncId = setInterval(function() {
                        if (self._isSaving || window.sistemaVidaState?._pendingLocalChanges) return;
                        self.withTimeout(getAuthReady(), 5000, 'auth_periodic').then(() => {
                            const ref = self.getStateDocRef();
                            return self.withTimeout(getDoc(ref), 8000, 'periodic_getDoc');
                        }).then((snap) => {
                            if (!snap || !snap.exists()) return;
                            const remote = snap.data();
                            const remoteTs = Number(remote?._lastUpdatedAt || 0);
                            const localTs  = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
                            if (remoteTs <= localTs) return;
                            console.log('[SYNC] Periodic pull: applying newer cloud state (remoteTs=' + remoteTs + ')');
                            window.sistemaVidaState = app.mergeDeep(window.sistemaVidaState, remote);
                            app.applyForcedOnboardingResetState();
                            window.sistemaVidaState._lastUpdatedAt = remoteTs;
                            if (window.sistemaVidaState._pendingLocalChanges) window.sistemaVidaState._pendingLocalChanges = false;
                            app.normalizeDimensionsState();
                            app.normalizeEntitiesState();
                            app.normalizeDailyLogsState();
                            app.persistLocalMirror();
                            app.updateSyncBadge('ok');
                            try { if (app.currentView && app.render && app.render[app.currentView]) app.render[app.currentView](); } catch (_) {}
                        }).catch((e) => { console.warn('[SYNC] Periodic pull error:', e); });
                    }, 60000);
                }
            }).catch(function(err) {
                console.warn('[SYNC] Real-time listener auth timeout, retrying in 15s:', err);
                self.updateSyncBadge('offline');
                // Retry after 15s
                setTimeout(trySetup, 15000);
            });
        }; // end trySetup
        trySetup();
    },


    proposito: function() {
        const state = window.sistemaVidaState;
        
        // Limpa o banner antes de renderizar para evitar duplicidade
        const valuesBanner = document.getElementById('top-values-banner');
        if (valuesBanner) valuesBanner.innerHTML = '';
        
        this.renderSidebarValues();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        if (!state.purposeStartDate) state.purposeStartDate = todayStr;
        if (!state.cycleStartDate) state.cycleStartDate = todayStr;
    },

    checkAlerts: function() {
        const state = window.sistemaVidaState;
        if (state?.settings?.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        if (!state.purposeStartDate) state.purposeStartDate = todayStr;
        if (!state.cycleStartDate) state.cycleStartDate = todayStr;
        
        if (state.lastAccess) {
            const diffDays = Math.floor((today - new Date(state.lastAccess)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 2) setTimeout(() => this.showNotification("Bom ter você de volta à sua jornada!"), 1000);
        }
        state.lastAccess = todayStr;

        this.needsReview = false;
        const dow = today.getDay(); // 0=Dom, 5=Sex, 6=Sáb
        if ([5, 6, 0].includes(dow)) { // Sex, Sáb ou Dom
            const weekKey = this._getWeekKey();
            const reviews = state.reviews || {};
            const hasPlan = !!(state.weekPlans || {})[weekKey];
            // Verifica por weekKey (novo formato) ou timestamp recente (formato antigo)
            const hasReviewThisWeek = !!reviews[weekKey] ||
                Object.keys(reviews).some(dateStr => {
                    try { return (today - new Date(dateStr)) / (1000 * 60 * 60 * 24) <= 7; }
                    catch (_) { return false; }
                });
            this.needsReview = hasPlan && !hasReviewThisWeek;
        }
        // Agenda notificações locais do SO (apenas se permissão concedida)
        setTimeout(() => this.scheduleLocalNotifications(), 5000);
        setTimeout(() => this.scheduleHabitReminders(), 5200);

        const diffDaysCycle = Math.floor((today - new Date(state.cycleStartDate)) / (1000 * 60 * 60 * 24));
        if (diffDaysCycle >= 84) setTimeout(() => this.showNotification("🔄 Ciclo concluído! Reavalie a Roda da Vida e o PERMA na aba Propósito."), 4000);

        const diffDaysPurpose = Math.floor((today - new Date(state.purposeStartDate)) / (1000 * 60 * 60 * 24));
        if (diffDaysPurpose >= 365 && diffDaysPurpose % 365 === 0) setTimeout(() => this.showNotification("🌟 1 ano de jornada! Hora da revisão profunda do seu Propósito e Ikigai."), 5500);
    },

    getRiskAlerts: function() {
      const state = window.sistemaVidaState;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts = [];

      state.entities.micros.forEach(m => {
        if (m.status === 'done') return; // ignora concluídas

        const hasPrazo = m.prazo && m.prazo.trim() !== '';
        const hasInicio = m.inicioDate && m.inicioDate.trim() !== '';

        if (!hasPrazo) return; // sem prazo, sem risco calculável

        const prazo = new Date(m.prazo + 'T00:00:00');
        const inicio = hasInicio ? new Date(m.inicioDate + 'T00:00:00') : null;

        const diasAteVencer = Math.floor((prazo - today) / (1000 * 60 * 60 * 24));

        // Risco 1: prazo já passou (atrasada)
        if (diasAteVencer < 0) {
          alerts.push({ id: m.id, title: m.title, tipo: 'overdue', dias: Math.abs(diasAteVencer) });
          return;
        }

        // Risco 2: vence hoje
        if (diasAteVencer === 0) {
          alerts.push({ id: m.id, title: m.title, tipo: 'hoje', dias: 0 });
          return;
        }

        // Risco 3: inicioDate já passou e ainda está pendente (não iniciada)
        if (inicio && inicio < today && m.status !== 'in_progress' && diasAteVencer <= 3) {
          alerts.push({ id: m.id, title: m.title, tipo: 'risco', dias: diasAteVencer });
          return;
        }

        // Risco 4: vence em até 2 dias e ainda não tem inicioDate
        if (!inicio && diasAteVencer <= 2) {
          alerts.push({ id: m.id, title: m.title, tipo: 'urgente', dias: diasAteVencer });
        }
      });

      return alerts;
    },

    renderSidebarValues: function() {
        const state = window.sistemaVidaState;
        const profile = state.profile || {};
        const essentials = profile.values || [];
        const importants = profile.importantValues || [];
        this.renderProfileChrome();

        const container = document.getElementById('sidebar-values-container');
        if (container) {
            let html = '';
            if (essentials.length > 0) {
                html += essentials.map(v => `<span class="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase italic transition-all hover:bg-primary/20 cursor-default animate-fade-in" title="Essencial"><span class="material-symbols-outlined notranslate text-[10px] align-text-bottom">star</span>${v}</span>`).join('');
            }
            if (importants.length > 0) {
                html += importants.map(v => `<span class="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-lg uppercase italic transition-all hover:bg-secondary/20 cursor-default animate-fade-in" title="Importante">${v}</span>`).join('');
            }
            container.innerHTML = html || `<span class="text-[10px] text-outline italic">Defina seus valores no Propósito</span>`;
        }

        const valuesBanner = document.getElementById('top-values-banner');
        if (valuesBanner) {
            let html = '';
            if (essentials.length > 0) {
                html += essentials.map(v => `<span class="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest animate-fade-in" title="Essencial"><span class="material-symbols-outlined notranslate text-[11px] align-text-bottom" style="font-variation-settings:'FILL' 1;">star</span>${v}</span>`).join('');
            }
            if (importants.length > 0) {
                html += importants.map(v => `<span class="px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-xs font-bold uppercase tracking-widest animate-fade-in" title="Importante">${v}</span>`).join('');
            }
            valuesBanner.innerHTML = html || '<p class="text-xs text-outline italic">Defina seus valores em Proposito para orientar este bloco.</p>';
        }
    },

        // Extracted in Phase 9: identity module
renderProfileChrome: function() {
        this.ensureSettingsState();
        const profile = window.sistemaVidaState.profile || {};
        const avatarUrl = String(profile.avatarUrl || '').trim();
        const nameEl = document.getElementById('perfil-sidebar-name');
        if (nameEl) nameEl.textContent = profile.name || 'Bruno';

        [
            { img: 'profile-nav-avatar-mobile', icon: 'profile-nav-icon-mobile' },
            { img: 'profile-sidebar-avatar', icon: 'profile-sidebar-icon' }
        ].forEach(({ img, icon }) => {
            const imgEl = document.getElementById(img);
            const iconEl = document.getElementById(icon);
            if (imgEl) {
                imgEl.classList.toggle('hidden', !avatarUrl);
                if (avatarUrl) imgEl.src = avatarUrl;
            }
            if (iconEl) iconEl.classList.toggle('hidden', !!avatarUrl);
        });
    },

    switchPlanosTab: function(tabId) {
      this.planosActiveTab = tabId || 'metas';
      // 1. Oculta todos os conteúdos removendo 'active'
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
      // 2. Exibe o conteúdo da tab clicada
      const targetContent = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.add('active');
    
      // 3. Remove estado ativo de TODOS os botões
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'text-primary');
        btn.classList.add('text-outline');
      });
    
      const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active', 'text-primary');
        activeBtn.classList.remove('text-outline');
      }

      const plannedBtn = document.getElementById('btn-stat-planned');
      const isMicroTab = tabId === 'micro';
      if (plannedBtn) plannedBtn.classList.toggle('hidden', !isMicroTab);
      if (!isMicroTab && this.planosStatusFilter === 'planned') {
        this.planosStatusFilter = 'all';
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
      }

      // Reação em cadeia: renderiza conteúdo específico da tab
      if (tabId === 'timeline') this.renderTimeline();
      if (tabId === 'semanal') this.renderWeeklyPlans();
      if (tabId === 'ciclo') this.renderCycleReviewPanel();
    },

    renderCycleReviewPanel: function() {
        const panel = document.getElementById('cycle-review-panel');
        if (!panel) return;
        const state = window.sistemaVidaState;
        const activeOkrs = (state.entities?.okrs || []).filter(o => o.status !== 'done' && o.status !== 'abandoned');
        const today = new Date();
        const cycleStart = new Date((state.cycleStartDate || this.getLocalDateKey()) + 'T00:00:00');
        const elapsedDays = Math.max(0, Math.floor((today - cycleStart) / 864e5));
        const cyclePct = Math.min(100, Math.round((elapsedDays / 84) * 100));
        const weekNumber = Math.max(1, Math.min(12, Math.ceil(Math.max(1, elapsedDays + 1) / 7)));
        const okrRows = activeOkrs.length
            ? activeOkrs.map(okr => {
                const macros = (state.entities?.macros || []).filter(m => m.okrId === okr.id);
                const macroIds = new Set(macros.map(m => m.id));
                const micros = (state.entities?.micros || []).filter(m => macroIds.has(m.macroId));
                const pendingMicros = micros.filter(m => m.status !== 'done' && !m.completed).length;
                return `<div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-on-surface">${this.escapeHtml(okr.title || 'OKR sem título')}</p>
                            <p class="text-xs text-outline mt-1">${macros.length} macro${macros.length === 1 ? '' : 's'} · ${pendingMicros} micro${pendingMicros === 1 ? '' : 's'} pendente${pendingMicros === 1 ? '' : 's'}</p>
                        </div>
                        <span class="text-xs font-bold text-primary shrink-0">${Math.round(Number(okr.progress) || 0)}%</span>
                    </div>
                </div>`;
            }).join('')
            : '<p class="text-sm text-outline italic">Nenhum OKR ativo para revisar agora.</p>';

        panel.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between text-sm font-medium">
                    <span class="text-on-surface">Ciclo atual</span>
                    <span class="text-primary">${cyclePct}%</span>
                </div>
                <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: ${cyclePct}%"></div>
                </div>
                <p class="text-[11px] text-on-surface-variant uppercase tracking-widest text-center pt-1">Semana ${weekNumber} de 12 · ${elapsedDays} dias decorridos</p>
            </div>
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                    <h4 class="text-xs font-bold uppercase tracking-[0.18em] text-outline">OKRs ativos</h4>
                    <button onclick="window.app.openQuarterlyModal()"
                        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                        <span class="material-symbols-outlined notranslate text-[16px]">rate_review</span>
                        Abrir revisão
                    </button>
                </div>
                ${okrRows}
            </div>`;
    },

    // ── Renderização da aba Semanal ─────────────────────────────────────────────
    _renderWeeklyPlanShell: function({ weekKey, plan, label, actionLabel, actionIcon, actionOptions = '', isCurrent = false, emptyText = '' } = {}) {
        const options = actionOptions ? `{ ${actionOptions} }` : '{}';
        const body = plan
            ? this._renderWeekPlanCard(plan, window.sistemaVidaState, isCurrent)
            : `<div class="mt-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant leading-relaxed">${emptyText}</div>`;
        return `
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 flex flex-col gap-4">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-primary">${this.escapeHtml(label || 'Semana')}</p>
                    <h4 class="font-headline text-xl font-bold italic mt-1 text-on-background">${this.escapeHtml(this._formatWeekRange(weekKey || this._getWeekKey()))}</h4>
                </div>
                ${actionLabel ? `
                <button onclick="window.app.openWeeklyPlanModal(${options})"
                    class="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                    <span class="material-symbols-outlined notranslate text-[16px]">${this.escapeHtml(actionIcon || 'edit_calendar')}</span>
                    ${this.escapeHtml(actionLabel)}
                </button>
                ` : ''}
            </div>
            ${body}
        </div>`;
    },

    _renderWeeklyReviewSummary: function(review) {
        if (!review) return '';
        const fields = [
            ['O que planejei', review.q1],
            ['O que executei', review.q2],
            ['O que aprendi', review.q3],
            ['O que ajustaria', review.q4],
            ['Gratidão / Destaque', review.q5],
            ['Força usada', this.getIdentityTitleById('strengths', review.strengthId)],
            ['Sombra observada', this.getIdentityTitleById('shadows', review.shadowId)],
            ['Resposta melhor', review.responsePracticed],
            ['Hábito a ajustar', review.habitAdjustment]
        ].filter(([, value]) => String(value || '').trim());

        if (!fields.length) {
            return `
            <div class="mt-4 pt-4 border-t border-outline-variant/10 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span class="material-symbols-outlined notranslate text-[16px]">check_circle</span>
                Revisão da semana salva
            </div>`;
        }

        return `
        <div class="mt-4 pt-4 border-t border-outline-variant/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3 flex items-center gap-1">
                <span class="material-symbols-outlined notranslate text-[14px]">rate_review</span>
                Revisão da Semana
            </p>
            <div class="grid md:grid-cols-2 gap-3">
                ${fields.map(([label, value], idx) => `
                    <div class="bg-surface-container p-3 rounded-xl ${idx === fields.length - 1 && fields.length % 2 === 1 ? 'md:col-span-2' : ''}">
                        <p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">${this.escapeHtml(label)}</p>
                        <p class="text-xs text-on-surface leading-relaxed">${this.escapeHtml(String(value || ''))}</p>
                    </div>
                `).join('')}
            </div>
        </div>`;
    },

    init: async function() {
        console.log("Sistema Vida OS inicializando...", this.appBuildVersion);
    // Signal dead-man's switch that the module loaded
    document.dispatchEvent(new CustomEvent('lifeos-app-ready'));
        console.log("[DIAG] localStorage keys:", Object.keys(localStorage).filter(k => k.startsWith("lifeos")));
        try {
            await this.withTimeout(this.loadState(), 12000, 'loadState');
        } catch (err) {
            console.warn('Falha/timeout no carregamento da nuvem. Iniciando com backup local.', err);
        }
        if (this._cadenceNeedsMigrationSave) {
            this._cadenceNeedsMigrationSave = false;
            try { await this.saveState(true); } catch (err) { console.warn('[Cadence] Falha ao persistir migração de propósito:', err); }
        }
        if (this._stateSchemaNeedsSave) {
            this._stateSchemaNeedsSave = false;
            try { await this.saveState(true); } catch (err) { console.warn('[Schema] Falha ao persistir migração de versão:', err); }
        }
        const recheckNotifications = () => {
            try { this.revalidateNotificationState({ register: true, rerender: true }).catch(() => {}); } catch (_) {}
        };
        if (!this._localFlushBound) {
            this._localFlushBound = true;
            const flushLocalMirror = () => {
                try { this.persistLocalMirror(); } catch (_) {}
            };
            window.addEventListener('pagehide', flushLocalMirror);
            window.addEventListener('beforeunload', flushLocalMirror);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') flushLocalMirror();
                if (document.visibilityState === 'visible') recheckNotifications();
            });
            window.addEventListener('focus', recheckNotifications);
        }
        try { this.ensureSettingsState(); } catch (_) {}
        try { this.applyThemePreference(); } catch (_) {}
        try { this.checkAlerts(); } catch (_) {}
        try { this.startHabitReminderWatcher(); } catch (_) {}
        if (window.sistemaVidaState?.settings?.notificationsEnabled) recheckNotifications();
        try { this.ensureDeepWorkTicking(); } catch (_) {}
        try { this.setupRealtimeSync(); } catch (_) {} // real-time cross-device sync

        // Auto-sincroniza imagens com Firestore logo após o carregamento
        try {
            const hasAvatar = !!(window.sistemaVidaState.profile?.avatarUrl);
            const odysseyImgs = window.sistemaVidaState.profile?.odysseyImages || {};
            const hasOdyssey = Object.values(odysseyImgs).some(v => v && typeof v === 'string' && v.length > 10);
            if (hasAvatar || hasOdyssey) {
                getAuthReady().then(() => {
                    this.syncImagesToFirestoreDoc().catch(e => console.warn('[Images] Falha ao sincronizar imagens na inicialização:', e));
                }).catch(() => {});
            }
        } catch (_) {}

        // Always navigate — even if something above threw
        this.applyForcedOnboardingResetState();
        if (!window.sistemaVidaState.onboardingComplete) {
            this.switchView('onboarding');
        } else {
            if (this.shouldShowSplashOnOpen()) {
                this.showDailySplash();
            } else {
                this.switchView('hoje');
                this.showOdysseySplashIfEligible();
            }
        }

        // Tarefa 2: Filtro Inteligente - Listener de Dimensão
        try {
            const dimSelect = document.getElementById('crud-dimension');
            if (dimSelect) {
                dimSelect.addEventListener('change', () => {
                    const typeSelect = document.getElementById('crud-type');
                    if (typeSelect) this.updateParentList(typeSelect.value);
                });
            }
        } catch (_) {}
    },

    switchView: async function(viewName, options = {}) {
        if (!viewName) return;
        this.currentView = viewName;
        this.closeFabMenu();
        this.updateNavUI(viewName);

        const container = document.getElementById(this.config.containerId);
        if (container) {
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.2s ease-in-out';
        }

        let html = null;
        try {
            // AbortController timeout so fetch never hangs forever
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const viewVersion = encodeURIComponent(this.appBuildVersion || 'dev');
            const response = await fetch(`${this.config.viewsPath}${viewName}.html?v=${viewVersion}`, { signal: ctrl.signal });
            clearTimeout(timer);
            html = response.ok ? await response.text() : null;
        } catch (error) {
            console.warn(`Erro ao carregar a view '${viewName}':`, error);
            html = null;
        }
        if (!html) html = this.getFallbackTemplate(viewName);

        return new Promise((resolve) => {
        setTimeout(() => {
            if (container) {
                container.innerHTML = html;
                container.style.opacity = '1';
                this.executeInjectedScripts(container);
            }
            if (this.render[viewName]) {
                try { this.render[viewName](); } catch (e) { console.warn('render error:', e); }
            }
            if (this.renderAppNotificationCenter) {
                try { this.renderAppNotificationCenter(); } catch (_) {}
            }
            if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
            resolve();
        }, 200);
        });
    },

    // Alias para compatibilidade com as chamadas do index.html
    navigate: function(viewName) {
        return this.switchView(viewName);
    },

    openTimelineEntity: function(entityId, entityType) {
        if (!entityId || !entityType) return;
        this.planosHierarchyType = entityType;
        this.planosHierarchyId = entityId;
        this.navigate('planos');

        setTimeout(() => {
            const tabMap = { metas: 'metas', okrs: 'okrs', macros: 'macro', micros: 'micro' };
            const targetTab = tabMap[entityType] || 'metas';
            this.switchPlanosTab(targetTab);
            if (this.render.planos) this.render.planos();

            const card = document.querySelector(`[data-entity-type="${entityType}"][data-entity-id="${entityId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const trail = card.querySelector('.trail-panel');
                if (trail && trail.classList.contains('hidden')) this.toggleTrail(card);
                card.classList.add('ring-2', 'ring-primary/40');
                setTimeout(() => card.classList.remove('ring-2', 'ring-primary/40'), 1600);
            }
        }, 350);
    },

    openFocusDetails: function() {
        this.navigate('painel');
        setTimeout(() => {
            const section = document.getElementById('painel-focus-distribution-section');
            if (!section) return;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            section.classList.add('ring-2', 'ring-primary/30');
            setTimeout(() => section.classList.remove('ring-2', 'ring-primary/30'), 1400);
        }, 420);
    },

    // ---> ADICIONE ESTE BLOCO AQUI <---
    toggleTrail: function(element) {
        const trail = element.querySelector('.trail-panel');
        if (!trail) return;
        const isExpanded = !trail.classList.contains('hidden');
        if (isExpanded) {
            trail.style.maxHeight = '0px';
            setTimeout(() => trail.classList.add('hidden'), 300);
        } else {
            trail.classList.remove('hidden');
            trail.style.maxHeight = trail.scrollHeight + 'px';
        }
        element.classList.toggle('ring-1');
        element.classList.toggle('ring-primary/20');
    },
    // ----------------------------------

    openDailyLogHistory() {
        const modal = document.getElementById('history-log-modal');
        const list = document.getElementById('history-log-list');
        if (!modal || !list) return;

        const state = window.sistemaVidaState;
        
        // Pega no objeto dailyLogs e transforma num array para podermos listar e ordenar
        const logsObj = state.dailyLogs || {};
        const logsArray = Object.keys(logsObj).map(dateKey => {
            return { date: dateKey, ...logsObj[dateKey] };
        });
        
        // Ordena pela data (mais recente primeiro)
        const sortedLogs = logsArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedLogs.length === 0) {
            list.innerHTML = '<div class="text-center py-12 text-outline italic">Nenhum registro encontrado.</div>';
        } else {
            list.innerHTML = sortedLogs.map(log => {
                // Adiciona T12:00:00 para evitar que o fuso horário mude o dia no toLocaleDateString
                const dateObj = new Date(log.date + "T12:00:00");
                const dateStr = dateObj.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                const [dia, de, mes] = dateStr.split(' ');
                
                const energyColor = log.energy >= 4 ? 'text-emerald-600 dark:text-emerald-400' : log.energy >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-error';
                const gratidaoBlock = log.gratidao ? `<p class="text-[11px] text-on-surface-variant mt-2"><span class="font-bold text-outline">Gratidão:</span> ${this.escapeHtml(log.gratidao)}</p>` : '';
                const funcionouBlock = log.funcionou ? `<p class="text-[11px] text-on-surface-variant mt-1"><span class="font-bold text-outline">Funcionou:</span> ${this.escapeHtml(log.funcionou)}</p>` : '';
                const dimIcons = { 'Saúde':'💪','Mente':'🧠','Carreira':'💼','Finanças':'💰','Relacionamentos':'🤝','Família':'🏠','Lazer':'🎨','Propósito':'✨' };
                const dimNotes = log.dimensionNotes || {};
                const dimEntries = Object.entries(dimNotes).filter(([,v]) => v && v.trim());
                const shutdownBlock = dimEntries.length ? `
                    <div class="mt-2 space-y-1.5 rounded-lg bg-primary/[0.04] border border-primary/10 px-3 py-2.5">
                        <p class="text-[9px] uppercase font-bold text-primary tracking-wider mb-1.5">Ritual de Shutdown</p>
                        ${dimEntries.map(([dim, text]) => `
                            <div>
                                <span class="text-[10px] font-bold text-on-surface">${dimIcons[dim] || '⭐'} ${this.escapeHtml(dim)}</span>
                                <p class="text-[11px] text-on-surface-variant leading-snug mt-0.5">${this.escapeHtml(text)}</p>
                            </div>`).join('')}
                    </div>` : '';
                
                // Seção Flash Reflexão
                let flashBlock = '';
                if (log.flashGratitude) {
                    const emotionMap = { 'angry': '😡', 'neutral': '😐', 'happy': '😊', 'fire': '🔥' };
                    const emotionEmoji = emotionMap[log.flashEmotion] || '✨';
                    flashBlock = `
                        <div class="mt-3 p-2.5 bg-secondary/5 rounded-lg border border-secondary/10">
                            <p class="text-[9px] uppercase font-bold text-secondary tracking-wider mb-1">Flash Reflexão ${emotionEmoji}</p>
                            <p class="text-[11px] text-on-surface-variant italic">"${log.flashGratitude}"</p>
                        </div>
                    `;
                }
                
                return `
                    <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 shadow-sm flex items-center justify-between mb-3">
                        <div class="flex items-center gap-4">
                            <div class="text-center min-w-[50px]">
                                <span class="block text-lg font-bold text-primary leading-tight">${dia}</span>
                                <span class="block text-[10px] uppercase font-bold text-outline">${mes ? mes.replace('.','') : ''}</span>
                            </div>
                            <div class="h-8 w-px bg-outline-variant/20"></div>
                            <div>
                                <p class="text-sm font-medium text-on-surface italic">"${log.focus || 'Sem intenção definida'}"</p>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[10px] uppercase font-bold text-outline">Energia:</span>
                                    <span class="text-xs font-bold ${energyColor}">${log.energy || 0}/5</span>
                                </div>
                                ${gratidaoBlock}
                                ${funcionouBlock}
                                ${shutdownBlock}
                                ${flashBlock}
                            </div>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="material-symbols-outlined notranslate text-primary/40">history_edu</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    },

    closeDailyLogHistory() {
        const modal = document.getElementById('history-log-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = '';
        }
    },

    // ── LINHA DO TEMPO ──────────────────────────────────────────────────────────

    getAllActiveDates: function() {
        const state = window.sistemaVidaState;
        const dates = new Set();
        Object.keys(state.dailyLogs || {}).forEach(d => dates.add(d));
        (state.profile?.dailyCheckins || []).forEach(c => { if (c.date) dates.add(c.date); });
        (state.entities?.micros || []).forEach(m => {
            if (m.completedDate) dates.add(m.completedDate);
            else if (m.doneDate) dates.add(m.doneDate);
        });
        (state.profile?.notes || []).forEach(n => {
            const d = (n.createdAt || '').slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.add(d);
        });
        (state.deepWork?.sessions || []).forEach(s => {
            const d = (s.endedAt || '').slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.add(d);
        });
        this.getCadenceHistoryEvents().forEach(event => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) dates.add(event.date);
        });
        return Array.from(dates)
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort((a, b) => b.localeCompare(a));
    },

    getAggregatedDayData: function(dateKey) {
        const state = window.sistemaVidaState;
        const checkin = (state.profile?.dailyCheckins || []).find(c => c.date === dateKey) || null;
        const log = (state.dailyLogs || {})[dateKey] || null;
        const habitsDone = (state.habits || []).filter(h => {
            const steps = Array.isArray(h.steps) ? h.steps.filter(Boolean) : [];
            if (steps.length) {
                const stepMap = (h.stepLogs || {})[dateKey] || {};
                const done = steps.reduce((acc, _, i) => acc + (stepMap[i] || stepMap[String(i)] ? 1 : 0), 0);
                return done === steps.length;
            }
            const val = (h.logs || {})[dateKey] || 0;
            const mode = h.trackMode || 'boolean';
            return mode === 'boolean' ? val > 0 : val >= (h.targetValue || 1);
        });
        const microsDone = (state.entities?.micros || []).filter(m =>
            m.completedDate === dateKey || m.doneDate === dateKey
        );
        const notes = (state.profile?.notes || []).filter(n =>
            (n.createdAt || '').slice(0, 10) === dateKey
        );
        const dwSessions = (state.deepWork?.sessions || []).filter(s =>
            (s.endedAt || '').slice(0, 10) === dateKey
        );
        const dwMinutes = dwSessions.reduce((acc, s) => acc + Math.round((Number(s.focusSec) || 0) / 60), 0);
        const xpEarned = Object.values((state.gamification?.events) || {})
            .filter(e => (e.at || '').slice(0, 10) === dateKey)
            .reduce((acc, e) => acc + (Number(e.xp) || 0), 0);
        const achievements = (state.gamification?.achievements || []).filter(a =>
            (a.unlockedAt || '').slice(0, 10) === dateKey
        );
        const cadenceEvents = this.getCadenceHistoryEvents().filter(event => event.date === dateKey);
        return { dateKey, checkin, log, habitsDone, microsDone, notes, dwSessions, dwMinutes, xpEarned, achievements, cadenceEvents };
    },

    toggleTimelineMonth: function(safeYm) {
        const panel = document.getElementById(`tl-month-${safeYm}`);
        if (!panel) return;
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !opening);
        const chev = document.querySelector(`.tl-month-chev-${safeYm}`);
        if (chev) chev.classList.toggle('rotate-180', opening);
    },

    toggleTimelineCard: function(safeKey) {
        const panel = document.getElementById(`tl-expand-${safeKey}`);
        if (!panel) return;
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !opening);
        const chev = document.querySelector(`.tl-chev-${safeKey}`);
        if (chev) chev.textContent = opening ? 'expand_less' : 'expand_more';
    },

    // ── FIM LINHA DO TEMPO ──────────────────────────────────────────────────────

    setPlanosFilter: function(dim) {
        this.planosFilter = dim;
        if (this.render.planos) this.render.planos();
        this.renderTimeline(); // Reação em Cadeia
    },

    setPlanosStatusFilter: function(status) {
        this.planosStatusFilter = status;
        if (this.render.planos) this.render.planos();
        this.renderTimeline(); // Reação em Cadeia
    },

    clearPlanosFilters: function() {
        this.planosFilter = 'Todas';
        this.planosStatusFilter = 'all';
        this.planosHierarchyType = '';
        this.planosHierarchyId = '';
        if (this.render.planos) this.render.planos();
        this.renderTimeline();
        this.showToast('Filtros de Planos limpos.', 'success');
    },

    setPainelFilter: function(filter) {
        this.painelFilter = filter;
        if (this.render.painel) this.render.painel();
    },

    isDateInCurrentWeek: function(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr + "T00:00:00");
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);
        return date >= startOfWeek && date <= endOfWeek;
    },

    hasDayActivity: function(dateKey) {
        const state = window.sistemaVidaState || {};
        if (!dateKey) return false;
        if ((state.dailyLogs || {})[dateKey]) return true;
        if ((state.entities?.micros || []).some(m => m.completedDate === dateKey || m.doneDate === dateKey)) return true;
        if ((state.deepWork?.sessions || []).some(s => (s.endedAt || '').slice(0, 10) === dateKey)) return true;
        return false;
    },

    isDateInCurrentMonth: function(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr + "T00:00:00");
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    },

    saveValues: function(essentialValues, importantValues) {
        window.sistemaVidaState.profile.values = essentialValues || [];
        window.sistemaVidaState.profile.importantValues = importantValues || [];
        this.renderSidebarValues();
        if (this.render.proposito) this.render.proposito();
        app.saveState(true);
    },
    updateProfileAppVersion: async function() {
        const versionEl = document.getElementById('perfil-app-version');
        if (!versionEl) return;
        const cacheKey = 'lifeos_last_main_commit';
        const cachedHash = localStorage.getItem(cacheKey);

        if (cachedHash) versionEl.textContent = `Commit ${cachedHash}`;
        else versionEl.textContent = 'Commit indisponível';

        const repo = this.config.repoFullName;
        if (!repo) return;

        try {
            const response = await fetch(`https://api.github.com/repos/${repo}/commits/main`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP_${response.status}`);
            const payload = await response.json();
            const sha = String(payload?.sha || '').slice(0, 7);
            if (!sha) return;
            versionEl.textContent = `Commit ${sha}`;
            localStorage.setItem(cacheKey, sha);
        } catch (_) {
            if (!cachedHash) versionEl.textContent = 'Commit indisponível (offline)';
        }
    },

    _trailRowId: function(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    },
    updateTrailPurposePanel: function() {
        const panel = document.getElementById('trail-purpose-panel');
        if (!panel) return;

        const dimension = (document.getElementById('trail-meta-dimension')?.value || '').trim();
        const profile = window.sistemaVidaState?.profile || {};
        const values = Array.isArray(profile.values) ? profile.values : [];
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};
        const legacyKey = this._dimensionLegacyMap ? this._dimensionLegacyMap[dimension] : null;

        const valuesText = values.length ? values.slice(0, 3).join(' · ') : '';
        const ikigaiText = (ikigai.sintese || ikigai.love || '').trim();
        const legacyText = (legacyKey ? (legacyObj[legacyKey] || '') : '').trim();
        const hasAny = !!(valuesText || ikigaiText || legacyText);

        const valuesWrap = document.getElementById('trail-purpose-values');
        const valuesOut = document.getElementById('trail-purpose-values-text');
        const ikigaiWrap = document.getElementById('trail-purpose-ikigai');
        const ikigaiOut = document.getElementById('trail-purpose-ikigai-text');
        const legacyWrap = document.getElementById('trail-purpose-legacy');
        const legacyOut = document.getElementById('trail-purpose-legacy-text');

        panel.classList.toggle('hidden', !hasAny);
        if (!hasAny) return;

        if (valuesWrap) valuesWrap.classList.toggle('hidden', !valuesText);
        if (valuesOut) valuesOut.textContent = valuesText;
        if (ikigaiWrap) ikigaiWrap.classList.toggle('hidden', !ikigaiText);
        if (ikigaiOut) ikigaiOut.textContent = ikigaiText;
        if (legacyWrap) legacyWrap.classList.toggle('hidden', !legacyText);
        if (legacyOut) legacyOut.textContent = legacyText;
    },

    toggleFabMenu: function(event) {
        if (event && event.stopPropagation) event.stopPropagation();
        const menu = document.getElementById('fab-context-menu');
        if (!menu) {
            this.openCreateModal('micros');
            return;
        }
        if (menu.classList.contains('hidden')) menu.classList.remove('hidden');
        else menu.classList.add('hidden');
    },

    closeFabMenu: function() {
        const menu = document.getElementById('fab-context-menu');
        if (menu) menu.classList.add('hidden');
    },

    openQuickCaptureFromFab: function() {
        this.closeFabMenu();
        this.openCreateModal('micros');
    },

    openMetaTrailWizard: function() {
        this.closeFabMenu();
        const modal = document.getElementById('meta-trail-modal');
        if (!modal) return;

        const today = new Date();
        const metaDeadline = new Date(today);
        metaDeadline.setDate(metaDeadline.getDate() + 84);
        const macroDeadline = new Date(today);
        macroDeadline.setDate(macroDeadline.getDate() + 30);
        const microOne = new Date(today);
        microOne.setDate(microOne.getDate() + 3);
        const microTwoStart = new Date(today);
        microTwoStart.setDate(microTwoStart.getDate() + 4);
        const microTwoDeadline = new Date(today);
        microTwoDeadline.setDate(microTwoDeadline.getDate() + 7);
        const toDate = (d) => {
            const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
            return local.toISOString().split('T')[0];
        };

        const titleEl = document.getElementById('trail-meta-title');
        const dimensionEl = document.getElementById('trail-meta-dimension');
        const prazoEl = document.getElementById('trail-meta-prazo');
        const whyEl = document.getElementById('trail-meta-why');
        const horizonEl = document.getElementById('trail-meta-horizon');
        const successEl = document.getElementById('trail-meta-success');
        const challengeEl = document.getElementById('trail-meta-challenge');
        const commitmentEl = document.getElementById('trail-meta-commitment');
        if (titleEl) titleEl.value = '';
        if (dimensionEl) dimensionEl.value = '';
        if (prazoEl) prazoEl.value = toDate(metaDeadline);
        if (whyEl) whyEl.value = '';
        if (horizonEl) horizonEl.value = '1';
        if (successEl) successEl.value = '';
        if (challengeEl) challengeEl.value = '3';
        if (commitmentEl) commitmentEl.value = '3';

        const okrList = document.getElementById('trail-okrs-list');
        const macroList = document.getElementById('trail-macros-list');
        const microList = document.getElementById('trail-micros-list');
        if (okrList) okrList.innerHTML = '';
        if (macroList) macroList.innerHTML = '';
        if (microList) microList.innerHTML = '';

        this.addTrailOkrRow({ inicioDate: toDate(today), prazo: toDate(metaDeadline) });
        this.addTrailMacroRow({ inicioDate: toDate(today), prazo: toDate(macroDeadline) });
        this.addTrailMacroRow({ inicioDate: toDate(today), prazo: toDate(macroDeadline) });
        this.addTrailMicroRow({ inicioDate: toDate(today), prazo: toDate(microOne) });
        this.addTrailMicroRow({ inicioDate: toDate(microTwoStart), prazo: toDate(microTwoDeadline) });

        this.metaTrailStep = 1;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        this.setMetaTrailStep(1);
        this.updateTrailPurposePanel();
    },

    closeMetaTrailWizard: function() {
        const modal = document.getElementById('meta-trail-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    setMetaTrailStep: function(step) {
        const target = Math.max(1, Math.min(5, Number(step) || 1));
        this.metaTrailStep = target;

        document.querySelectorAll('.meta-trail-step').forEach((section, idx) => {
            section.classList.toggle('hidden', idx + 1 !== target);
        });

        document.querySelectorAll('[data-trail-step-dot]').forEach(dot => {
            const dotStep = Number(dot.getAttribute('data-trail-step-dot'));
            if (dotStep < target) dot.className = 'h-1.5 rounded-full bg-primary/60';
            else if (dotStep === target) dot.className = 'h-1.5 rounded-full bg-primary';
            else dot.className = 'h-1.5 rounded-full bg-surface-container-high';
        });

        const stepLabel = document.getElementById('trail-step-label');
        if (stepLabel) stepLabel.textContent = `Passo ${target} de 5`;

        const prevBtn = document.getElementById('trail-prev-btn');
        const nextBtn = document.getElementById('trail-next-btn');
        const finishBtn = document.getElementById('trail-finish-btn');
        if (prevBtn) prevBtn.classList.toggle('invisible', target === 1);
        if (nextBtn) nextBtn.classList.toggle('hidden', target === 5);
        if (finishBtn) finishBtn.classList.toggle('hidden', target !== 5);

        if (target === 3) this.refreshTrailMacroParentOptions();
        if (target === 4) this.refreshTrailMicroParentOptions();
        if (target === 5) this.refreshTrailSummary();
        if (target === 1) this.updateTrailPurposePanel();
    },

    metaTrailPrevStep: function() {
        this.setMetaTrailStep((this.metaTrailStep || 1) - 1);
    },

    metaTrailNextStep: function() {
        const current = this.metaTrailStep || 1;
        if (!this._validateMetaTrailStep(current)) return;
        this.setMetaTrailStep(current + 1);
    },

    addTrailOkrRow: function(prefill = {}) {
        const list = document.getElementById('trail-okrs-list');
        if (!list) return;
        if (list.children.length >= 3) {
            this.showToast('Máximo de 3 OKRs na trilha.', 'error');
            return;
        }
        const rowId = this._trailRowId('okr');
        const row = document.createElement('div');
        row.setAttribute('data-trail-row', rowId);
        row.className = 'bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 space-y-3';
        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">OKR</p>
                <button type="button" onclick="window.app.removeTrailRow(this)" class="text-error text-xs font-bold uppercase">Remover</button>
            </div>
            <input type="text" class="trail-okr-title w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Resultado-chave (ex.: Publicar 12 artigos)" value="${this.escapeHtml(prefill.title || '')}" oninput="window.app.refreshTrailMacroParentOptions(); window.app.refreshTrailSummary()">
            <input type="text" class="trail-okr-metric w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Métrica de sucesso (ex.: 12 artigos publicados até o prazo)" value="${this.escapeHtml(prefill.metric || '')}" oninput="window.app.refreshTrailMacroParentOptions(); window.app.refreshTrailSummary()">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" class="trail-okr-inicio w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.inicioDate || '')}" onchange="window.app.refreshTrailMacroParentOptions(); window.app.refreshTrailSummary()">
                <input type="date" class="trail-okr-prazo w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.prazo || '')}" onchange="window.app.refreshTrailMacroParentOptions(); window.app.refreshTrailSummary()">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select class="trail-okr-challenge w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" onchange="window.app.refreshTrailSummary()">
                    <option value="1" ${Number(prefill.challengeLevel) === 1 ? 'selected' : ''}>1 - Muito baixo</option>
                    <option value="2" ${Number(prefill.challengeLevel) === 2 ? 'selected' : ''}>2 - Baixo</option>
                    <option value="3" ${(Number(prefill.challengeLevel || 3) === 3) ? 'selected' : ''}>3 - Moderado</option>
                    <option value="4" ${Number(prefill.challengeLevel) === 4 ? 'selected' : ''}>4 - Alto</option>
                    <option value="5" ${Number(prefill.challengeLevel) === 5 ? 'selected' : ''}>5 - Muito alto</option>
                </select>
                <select class="trail-okr-commitment w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" onchange="window.app.refreshTrailSummary()">
                    <option value="1" ${Number(prefill.commitmentLevel) === 1 ? 'selected' : ''}>1 - Muito baixo</option>
                    <option value="2" ${Number(prefill.commitmentLevel) === 2 ? 'selected' : ''}>2 - Baixo</option>
                    <option value="3" ${(Number(prefill.commitmentLevel || 3) === 3) ? 'selected' : ''}>3 - Moderado</option>
                    <option value="4" ${Number(prefill.commitmentLevel) === 4 ? 'selected' : ''}>4 - Alto</option>
                    <option value="5" ${Number(prefill.commitmentLevel) === 5 ? 'selected' : ''}>5 - Muito alto</option>
                </select>
            </div>
            <div class="trail-okr-krs-wrap space-y-2">
                <div class="grid gap-2 px-1" style="grid-template-columns: 1fr 72px 72px 32px;">
                    <span class="text-[10px] font-label uppercase tracking-widest text-outline">Resultado</span>
                    <span class="text-[10px] font-label uppercase tracking-widest text-outline text-center">Atual</span>
                    <span class="text-[10px] font-label uppercase tracking-widest text-outline text-center">Meta</span>
                    <span></span>
                </div>
                <div class="trail-kr-rows flex flex-col gap-2"></div>
                <button type="button" onclick="window.app.addTrailKrRow(this)"
                    class="flex items-center gap-1.5 text-[11px] text-primary font-bold uppercase tracking-widest py-2 px-3 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors w-fit">
                    <span class="material-symbols-outlined notranslate text-[15px]">add</span> Adicionar KR
                </button>
            </div>
        `;
        list.appendChild(row);
        const initialKrs = Array.isArray(prefill.keyResults)
            ? prefill.keyResults
            : this.parseKeyResultsText(prefill.keyResultsText || '');
        if (initialKrs.length) {
            initialKrs.forEach(kr => this.addTrailKrRow(row.querySelector('.trail-okr-krs-wrap button'), kr));
        } else {
            this.addTrailKrRow(row.querySelector('.trail-okr-krs-wrap button'));
        }
        this.refreshTrailMacroParentOptions();
    },

    addTrailKrRow: function(buttonOrRow, kr = {}) {
        const okrRow = buttonOrRow?.closest ? buttonOrRow.closest('[data-trail-row]') : buttonOrRow;
        const container = okrRow ? okrRow.querySelector('.trail-kr-rows') : null;
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'trail-kr-row grid gap-2 items-center';
        row.style.gridTemplateColumns = '1fr 72px 72px 32px';
        row.innerHTML = `
            <input type="text" class="trail-kr-title w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Resultado mensurável" value="${this.escapeHtml(kr.title || '')}" oninput="window.app.refreshTrailSummary()">
            <input type="number" class="trail-kr-current w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-2 text-sm text-on-surface text-center" placeholder="Atual" min="0" value="${Number(kr.current || 0)}" oninput="window.app.refreshTrailSummary()">
            <input type="number" class="trail-kr-target w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-2 py-2 text-sm text-on-surface text-center" placeholder="Meta" min="0" value="${Number(kr.target || 0)}" oninput="window.app.refreshTrailSummary()">
            <button type="button" onclick="this.closest('.trail-kr-row').remove(); window.app.refreshTrailSummary();" class="flex items-center justify-center w-8 h-9 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors">
                <span class="material-symbols-outlined notranslate text-[18px]">close</span>
            </button>
        `;
        container.appendChild(row);
        this.refreshTrailSummary();
    },

    addTrailMacroRow: function(prefill = {}) {
        const list = document.getElementById('trail-macros-list');
        if (!list) return;
        if (list.children.length >= 5) {
            this.showToast('Máximo de 5 Macros na trilha.', 'error');
            return;
        }
        const rowId = this._trailRowId('macro');
        const row = document.createElement('div');
        row.setAttribute('data-trail-row', rowId);
        row.className = 'bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 space-y-3';
        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Macro</p>
                <button type="button" onclick="window.app.removeTrailRow(this)" class="text-error text-xs font-bold uppercase">Remover</button>
            </div>
            <input type="text" class="trail-macro-title w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Iniciativa principal (ex.: Sistema editorial semanal)" value="${this.escapeHtml(prefill.title || '')}" oninput="window.app.refreshTrailMicroParentOptions(); window.app.refreshTrailSummary()">
            <select class="trail-macro-okr w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" onchange="window.app.refreshTrailMicroParentOptions(); window.app.refreshTrailSummary()"></select>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" class="trail-macro-inicio w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.inicioDate || '')}" onchange="window.app.refreshTrailSummary()">
                <input type="date" class="trail-macro-prazo w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.prazo || '')}" onchange="window.app.refreshTrailSummary()">
            </div>
            <input type="text" class="trail-macro-desc w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Detalhe opcional da iniciativa" value="${this.escapeHtml(prefill.description || '')}" oninput="window.app.refreshTrailSummary()">
        `;
        list.appendChild(row);
        this.refreshTrailMacroParentOptions();
        this.refreshTrailMicroParentOptions();
    },

    addTrailMicroRow: function(prefill = {}) {
        const list = document.getElementById('trail-micros-list');
        if (!list) return;
        const rowId = this._trailRowId('micro');
        const row = document.createElement('div');
        row.setAttribute('data-trail-row', rowId);
        row.className = 'bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 space-y-3';
        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Micro</p>
                <button type="button" onclick="window.app.removeTrailRow(this)" class="text-error text-xs font-bold uppercase">Remover</button>
            </div>
            <input type="text" class="trail-micro-title w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Ação concreta (ex.: Escrever outline do artigo 1)" value="${this.escapeHtml(prefill.title || '')}" oninput="window.app.refreshTrailSummary()">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select class="trail-micro-macro w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" onchange="window.app.refreshTrailSummary()"></select>
                <input type="date" class="trail-micro-inicio w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.inicioDate || '')}" onchange="window.app.refreshTrailSummary()">
                <input type="date" class="trail-micro-prazo w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" value="${this.escapeHtml(prefill.prazo || '')}" onchange="window.app.refreshTrailSummary()">
            </div>
        `;
        list.appendChild(row);
        this.refreshTrailMicroParentOptions();
    },

    removeTrailRow: function(buttonEl) {
        const row = buttonEl && buttonEl.closest ? buttonEl.closest('[data-trail-row]') : null;
        if (!row || !row.parentNode) return;
        const list = row.parentNode;
        row.remove();
        if (list.id === 'trail-okrs-list') this.refreshTrailMacroParentOptions();
        if (list.id === 'trail-macros-list') {
            this.refreshTrailMacroParentOptions();
            this.refreshTrailMicroParentOptions();
        }
        if (list.id === 'trail-micros-list') this.refreshTrailSummary();
    },

    refreshTrailMacroParentOptions: function() {
        const okrs = this._readTrailOkrs().items;
        const selects = document.querySelectorAll('.trail-macro-okr');
        selects.forEach(select => {
            const selected = select.value;
            if (okrs.length === 0) {
                select.innerHTML = '<option value="">Sem OKR disponível</option>';
                select.value = '';
                return;
            }
            const options = okrs.map((okr, idx) => `<option value="${okr.rowId}">${idx + 1}. ${this.escapeHtml(okr.title)}</option>`).join('');
            select.innerHTML = `<option value="">Selecione o OKR...</option>${options}`;
            if (selected && okrs.some(okr => okr.rowId === selected)) select.value = selected;
            else select.value = '';
        });
        this.refreshTrailMicroParentOptions();
        this.refreshTrailSummary();
    },

    refreshTrailMicroParentOptions: function() {
        const macros = this._readTrailMacroRowsForParentOptions();
        const selects = document.querySelectorAll('.trail-micro-macro');
        selects.forEach(select => {
            const selected = select.value;
            if (macros.length === 0) {
                select.innerHTML = '<option value="">Sem Macro disponível</option>';
                select.value = '';
                return;
            }
            const options = macros.map((macro, idx) => `<option value="${macro.rowId}">${idx + 1}. ${this.escapeHtml(macro.title)}</option>`).join('');
            select.innerHTML = `<option value="">Selecione a Macro...</option>${options}`;
            if (selected && macros.some(macro => macro.rowId === selected)) select.value = selected;
            else select.value = '';
        });
        this.refreshTrailSummary();
    },

    _readTrailMacroRowsForParentOptions: function() {
        const rows = Array.from(document.querySelectorAll('#trail-macros-list [data-trail-row]'));
        return rows.map((row, idx) => {
            const rowId = row.getAttribute('data-trail-row');
            const title = (row.querySelector('.trail-macro-title')?.value || '').trim();
            return { rowId, title: title || `Macro ${idx + 1}` };
        }).filter(item => item.rowId && item.title);
    },

    _readTrailMeta: function() {
        return {
            title: (document.getElementById('trail-meta-title')?.value || '').trim(),
            dimension: (document.getElementById('trail-meta-dimension')?.value || '').trim(),
            prazo: (document.getElementById('trail-meta-prazo')?.value || '').trim(),
            why: (document.getElementById('trail-meta-why')?.value || '').trim(),
            horizonYears: Number(document.getElementById('trail-meta-horizon')?.value || 1),
            successCriteria: (document.getElementById('trail-meta-success')?.value || '').trim(),
            challengeLevel: Math.max(1, Math.min(5, Number(document.getElementById('trail-meta-challenge')?.value || 3))),
            commitmentLevel: Math.max(1, Math.min(5, Number(document.getElementById('trail-meta-commitment')?.value || 3)))
        };
    },

    _readTrailOkrs: function() {
        const rows = Array.from(document.querySelectorAll('#trail-okrs-list [data-trail-row]'));
        const items = [];
        let hasPartial = false;
        rows.forEach(row => {
            const rowId = row.getAttribute('data-trail-row');
            const title = (row.querySelector('.trail-okr-title')?.value || '').trim();
            const metric = (row.querySelector('.trail-okr-metric')?.value || '').trim();
            const inicioDate = (row.querySelector('.trail-okr-inicio')?.value || '').trim();
            const prazo = (row.querySelector('.trail-okr-prazo')?.value || '').trim();
            const challengeLevel = Math.max(1, Math.min(5, Number(row.querySelector('.trail-okr-challenge')?.value || 3)));
            const commitmentLevel = Math.max(1, Math.min(5, Number(row.querySelector('.trail-okr-commitment')?.value || 3)));
            const keyResultsRaw = Array.from(row.querySelectorAll('.trail-kr-row')).map(krRow => ({
                title: krRow.querySelector('.trail-kr-title')?.value?.trim() || '',
                current: krRow.querySelector('.trail-kr-current')?.value || 0,
                target: krRow.querySelector('.trail-kr-target')?.value || 0
            }));
            const keyResults = this.normalizeKeyResultsList(keyResultsRaw);
            const hasKrInput = keyResultsRaw.some(kr => kr.title || Number(kr.current || 0) > 0 || Number(kr.target || 0) > 0);
            const hasAny = !!(title || metric || inicioDate || prazo || hasKrInput);
            const isComplete = !!(title && metric && prazo);
            if (hasAny && !isComplete) hasPartial = true;
            if (isComplete) items.push({ rowId, title, metric, inicioDate, prazo, challengeLevel, commitmentLevel, keyResults });
        });
        return { items, hasPartial };
    },

    _readTrailMacros: function() {
        const rows = Array.from(document.querySelectorAll('#trail-macros-list [data-trail-row]'));
        const items = [];
        let hasPartial = false;
        rows.forEach(row => {
            const rowId = row.getAttribute('data-trail-row');
            const title = (row.querySelector('.trail-macro-title')?.value || '').trim();
            const okrRowId = (row.querySelector('.trail-macro-okr')?.value || '').trim();
            const inicioDate = (row.querySelector('.trail-macro-inicio')?.value || '').trim();
            const prazo = (row.querySelector('.trail-macro-prazo')?.value || '').trim();
            const description = (row.querySelector('.trail-macro-desc')?.value || '').trim();
            const hasAny = !!(title || okrRowId || inicioDate || prazo || description);
            const isComplete = !!(title && okrRowId && inicioDate && prazo);
            if (hasAny && !isComplete) hasPartial = true;
            if (isComplete) items.push({ rowId, title, okrRowId, inicioDate, prazo, description });
        });
        return { items, hasPartial };
    },

    _readTrailMicros: function() {
        const rows = Array.from(document.querySelectorAll('#trail-micros-list [data-trail-row]'));
        const items = [];
        let hasPartial = false;
        rows.forEach(row => {
            const rowId = row.getAttribute('data-trail-row');
            const title = (row.querySelector('.trail-micro-title')?.value || '').trim();
            const macroRowId = (row.querySelector('.trail-micro-macro')?.value || '').trim();
            const inicioDate = (row.querySelector('.trail-micro-inicio')?.value || '').trim();
            const prazo = (row.querySelector('.trail-micro-prazo')?.value || '').trim();
            const hasAny = !!(title || macroRowId || inicioDate || prazo);
            const isComplete = !!(title && macroRowId && inicioDate && prazo);
            if (hasAny && !isComplete) hasPartial = true;
            if (isComplete) items.push({ rowId, title, macroRowId, inicioDate, prazo });
        });
        return { items, hasPartial };
    },

    _formatTrailDate: function(dateStr) {
        if (!dateStr) return 'Sem prazo';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('pt-BR');
        } catch (_) {
            return dateStr;
        }
    },

        // Extracted in Phase 9: planning module
openCreateModal: function(type = 'metas', parentId = null) {
        this.closeFabMenu();
        this.editingEntity = null; // Limpa estado de edição
        this.clearBlockingMessage();
        // Reseta chips do seletor de propósito
        document.querySelectorAll('.purpose-option-chip').forEach(c => {
            c.classList.remove('bg-primary/10', 'border-primary');
        });
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Novo Item';

        const successCriteriaInput = document.getElementById('crud-success-criteria');
        const challengeInput = document.getElementById('crud-challenge-level');
        const commitmentInput = document.getElementById('crud-commitment-level');
        const deadlineInput = document.getElementById('create-prazo');
        const inicioDateInput = document.getElementById('crud-inicio-date');
        const prazoDateInput = document.getElementById('crud-prazo-date');
        const effortInput = document.getElementById('crud-effort');
        const obstacleInput = document.getElementById('crud-obstacle');
        const ifThenInput = document.getElementById('crud-ifthen');
        if (successCriteriaInput) successCriteriaInput.value = '';
        if (challengeInput) challengeInput.value = '3';
        if (commitmentInput) commitmentInput.value = '3';
        this.clearKrRows();
        if (deadlineInput) deadlineInput.value = '';
        if (inicioDateInput) inicioDateInput.value = '';
        if (prazoDateInput) prazoDateInput.value = '';
        if (effortInput) effortInput.value = 'medio';
        if (obstacleInput) obstacleInput.value = '';
        if (ifThenInput) ifThenInput.value = '';
        this.toggleCrudWoop(false);

        const notesBtn = document.getElementById('crud-notes-btn');
        if (notesBtn) { notesBtn.classList.add('hidden'); notesBtn.classList.remove('flex'); }

        document.getElementById('crud-type').value = type;
        this.onTypeChange(type);
        // Pre-select parent when opening from a gap action or context CTA
        if (parentId) {
            const parentSelect = document.getElementById('create-parent');
            if (parentSelect) parentSelect.value = parentId;
        }
        document.getElementById('crud-modal').classList.remove('hidden');
        document.getElementById('crud-title').focus();
    },

    buildPurposeOptions: function() {
        const selectorGroup = document.getElementById('crud-purpose-selector-group');
        const optionsContainer = document.getElementById('crud-purpose-options');
        const noneMsg = document.getElementById('crud-purpose-none');
        if (!selectorGroup || !optionsContainer) return;

        const p = window.sistemaVidaState?.profile || {};
        const ikigai = p.ikigai || {};
        const legacyObj = p.legacyObj || {};
        const vision = p.vision || {};

        // Coleta todas as opções disponíveis (só onde resumo está preenchido)
        const options = [];
        if (ikigai.sinteseResumo)    options.push({ label: 'Ikigai',              text: ikigai.sinteseResumo });
        if (legacyObj.familiaResumo) options.push({ label: 'Legado Família',       text: legacyObj.familiaResumo });
        if (legacyObj.profissaoResumo) options.push({ label: 'Legado Profissão',   text: legacyObj.profissaoResumo });
        if (legacyObj.mundoResumo)   options.push({ label: 'Legado Mundo',         text: legacyObj.mundoResumo });
        if (vision.saudeResumo)      options.push({ label: 'Visão Saúde',          text: vision.saudeResumo });
        if (vision.carreiraResumo)   options.push({ label: 'Visão Carreira',       text: vision.carreiraResumo });
        if (vision.intelectoResumo)  options.push({ label: 'Visão Intelecto',      text: vision.intelectoResumo });

        if (options.length === 0) {
            optionsContainer.innerHTML = '';
            if (noneMsg) { noneMsg.classList.remove('hidden'); }
        } else {
            if (noneMsg) { noneMsg.classList.add('hidden'); }
            optionsContainer.innerHTML = options.map(opt => `
                <button type="button"
                    onclick="window.app.selectPurposeOption(this, '${opt.text.replace(/'/g, "\\'")}')"
                    class="purpose-option-chip px-3 py-1.5 rounded-full border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors text-left"
                    title="${opt.text}">
                    <span class="font-bold text-outline">${opt.label}:</span> ${opt.text.length > 45 ? opt.text.slice(0, 45) + '…' : opt.text}
                </button>
            `).join('');
        }

        selectorGroup.classList.remove('hidden');
        selectorGroup.style.display = 'flex';
    },

    selectPurposeOption: function(btn, text) {
        // Destaca o chip selecionado
        document.querySelectorAll('.purpose-option-chip').forEach(c => {
            c.classList.remove('bg-primary/10', 'border-primary', 'font-bold');
        });
        btn.classList.add('bg-primary/10', 'border-primary');

        // Preenche o campo de contexto com o texto completo
        const contextInput = document.getElementById('crud-context');
        if (contextInput) {
            contextInput.value = text;
            contextInput.focus();
        }
    },

    toggleCrudWoop: function(forceOpen = null) {
        const body = document.getElementById('crud-woop-body');
        const chevron = document.getElementById('crud-woop-chevron');
        if (!body) return;
        const willOpen = forceOpen === null ? body.classList.contains('hidden') : !!forceOpen;
        body.classList.toggle('hidden', !willOpen);
        if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : '';
    },

    // ── Painel de Propósito no modal de criação ─────────────────────────────────
    // Dimensões mapeadas ao campo de legado do perfil
    _dimensionLegacyMap: {
        'Carreira': 'profissao', 'Finanças': 'profissao',
        'Família': 'familia', 'Relacionamentos': 'familia',
        'Propósito': 'mundo', 'Saúde': null, 'Mente': null, 'Lazer': null
    },

    togglePurposePanel: function() {
        const body = document.getElementById('crud-purpose-body');
        const chevron = document.getElementById('crud-purpose-chevron');
        if (!body) return;
        const isHidden = body.classList.contains('hidden');
        body.classList.toggle('hidden', !isHidden);
        body.style.display = isHidden ? 'flex' : 'none';
        if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    },

    normalizeMetaHorizonYears: function(raw) {
        const n = Number(raw);
        if (n === 2.5) return 2.5;
        if (n === 5) return 5;
        return 1;
    },
    getMetaHorizonBands: function() {
        return {
            '1': { min: 180, max: 639, label: '1 ano' },
            '2.5': { min: 640, max: 1369, label: '2,5 anos' },
            '5': { min: 1370, max: 2555, label: '5 anos' }
        };
    },
    getMetaHorizonRule: function(metaHorizonYears = 1) {
        const bands = this.getMetaHorizonBands();
        const key = String(this.normalizeMetaHorizonYears(metaHorizonYears));
        return bands[key] || bands['1'];
    },
    inferMetaHorizonYearsByDays: function(days) {
        if (!Number.isFinite(Number(days))) return null;
        const value = Number(days);
        const bands = this.getMetaHorizonBands();
        if (value >= bands['1'].min && value <= bands['1'].max) return 1;
        if (value >= bands['2.5'].min && value <= bands['2.5'].max) return 2.5;
        if (value >= bands['5'].min && value <= bands['5'].max) return 5;
        return null;
    },
    alignMetaHorizonSelection: function({ prazo = '', selectedHorizonYears = 1, selectElementId = '' } = {}) {
        const normalized = this.normalizeMetaHorizonYears(selectedHorizonYears);
        const days = this.getDayDiffFromNow(prazo);
        const suggested = this.inferMetaHorizonYearsByDays(days);
        if (!suggested || suggested === normalized) {
            return { ok: true, horizonYears: normalized, adjusted: false };
        }

        const suggestedRule = this.getMetaHorizonRule(suggested);
        const shouldAdjust = window.confirm(
            `O prazo informado se encaixa no horizonte de ${suggestedRule.label}. Deseja ajustar automaticamente o horizonte da meta?`
        );
        if (!shouldAdjust) {
            return { ok: false, horizonYears: normalized, message: `Ajuste o horizonte da meta para ${suggestedRule.label} ou altere o prazo.` };
        }
        if (selectElementId) {
            const select = document.getElementById(selectElementId);
            if (select) select.value = String(suggested);
        }
        return { ok: true, horizonYears: suggested, adjusted: true };
    },
    getMetaHorizonYears: function(meta) {
        const explicit = Number(meta?.horizonYears);
        if (Number.isFinite(explicit) && explicit > 0) return this.normalizeMetaHorizonYears(explicit);
        if (!meta?.prazo) return 1;
        const days = this.getDayDiffFromNow(meta.prazo);
        const inferred = this.inferMetaHorizonYearsByDays(days);
        if (inferred) return inferred;
        if (Number.isFinite(Number(days))) {
            const value = Number(days);
            if (value >= 1370) return 5;
            if (value >= 640) return 2.5;
            if (value >= 180) return 1;
        }
        return 1;
    },

    getMetaParentChain: function(metaId) {
        const chain = [];
        const seen = new Set();
        let currentId = metaId;
        while (currentId && !seen.has(currentId)) {
            seen.add(currentId);
            chain.push(currentId);
            const current = (window.sistemaVidaState.entities.metas || []).find(m => m.id === currentId);
            currentId = current?.parentMetaId || '';
        }
        return chain;
    },
    getDayDiffFromNow: function(targetDateStr) {
        if (!targetDateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(String(targetDateStr) + 'T00:00:00');
        if (Number.isNaN(target.getTime())) return null;
        return Math.floor((target - today) / (1000 * 60 * 60 * 24));
    },
    getDayDiffBetween: function(startDateStr, endDateStr) {
        if (!startDateStr || !endDateStr) return null;
        const start = new Date(String(startDateStr) + 'T00:00:00');
        const end = new Date(String(endDateStr) + 'T00:00:00');
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        return Math.floor((end - start) / (1000 * 60 * 60 * 24));
    },
    validateEntityTimeWindow: function(type, { prazo = '', inicioDate = '', metaHorizonYears = 1 } = {}) {
        const normalizedType = String(type || '');
        const hasPrazo = !!String(prazo || '').trim();
        if (['metas', 'okrs', 'macros', 'micros'].includes(normalizedType) && !hasPrazo) {
            return { ok: false, message: 'Defina um prazo. Cada tipo do plano tem uma janela máxima para manter a execução realista.' };
        }

        if (normalizedType === 'metas') {
            const days = this.getDayDiffFromNow(prazo);
            if (days === null || days < 1) return { ok: false, message: 'Meta precisa de um prazo futuro válido.' };
            const rule = this.getMetaHorizonRule(metaHorizonYears);
            if (days < rule.min || days > rule.max) {
                return { ok: false, message: `Para uma meta de ${rule.label}, o prazo precisa ficar entre ${rule.min} e ${rule.max} dias. Ajuste o prazo ou escolha outro horizonte.` };
            }
            return { ok: true };
        }

        if (normalizedType === 'okrs') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'OKR precisa de início e prazo válidos. O prazo não pode vir antes do início.' };
            if (days > 92) return { ok: false, message: 'OKR deve ficar dentro de até 3 meses (máx. 92 dias). Se for maior, transforme em Meta ou divida em OKRs menores.' };
            return { ok: true };
        }

        if (normalizedType === 'macros') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'Macro Ação precisa de início e prazo válidos. O prazo não pode vir antes do início.' };
            if (days > 31) return { ok: false, message: 'Macro Ação deve caber em até 1 mês (máx. 31 dias). Se passar disso, divida em macros menores ou promova para OKR.' };
            return { ok: true };
        }

        if (normalizedType === 'micros') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'Micro Ação precisa de início e prazo válidos. O prazo não pode vir antes do início.' };
            if (days > 7) return { ok: false, message: 'Micro Ação deve caber em até 7 dias. Se passar disso, divida em micros menores ou classifique como Macro Ação.' };
            return { ok: true };
        }

        return { ok: true };
    },

    addKrRow: function(kr = {}) {
        const container = document.getElementById('kr-rows-container');
        const header = document.getElementById('kr-rows-header');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'kr-row grid gap-2 items-center';
        row.style.gridTemplateColumns = '1fr 72px 72px 32px';
        row.innerHTML = `
            <input type="text" class="kr-title w-full bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm h-10 px-3 text-on-surface placeholder-outline-variant" placeholder="Descrição do resultado" value="${this.escapeHtml(kr.title || '')}">
            <input type="number" class="kr-current w-full bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm h-10 px-2 text-on-surface text-center" placeholder="Atual" min="0" value="${Number(kr.current || 0)}">
            <input type="number" class="kr-target w-full bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm h-10 px-2 text-on-surface text-center" placeholder="Meta" min="0" value="${Number(kr.target || 0)}">
            <button type="button" onclick="this.closest('.kr-row').remove(); window.app._syncKrHeader();" class="flex items-center justify-center w-8 h-8 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors">
                <span class="material-symbols-outlined notranslate text-[18px]">close</span>
            </button>
        `;
        container.appendChild(row);
        if (header) header.classList.remove('hidden');
    },

    _syncKrHeader: function() {
        const container = document.getElementById('kr-rows-container');
        const header = document.getElementById('kr-rows-header');
        if (header && container) header.classList.toggle('hidden', container.children.length === 0);
    },

    clearKrRows: function() {
        const container = document.getElementById('kr-rows-container');
        const header = document.getElementById('kr-rows-header');
        if (container) container.innerHTML = '';
        if (header) header.classList.add('hidden');
    },

    populateKrRows: function(keyResults) {
        this.clearKrRows();
        if (!Array.isArray(keyResults) || keyResults.length === 0) return;
        keyResults.forEach(kr => this.addKrRow(kr));
    },

    readKrRows: function() {
        const rows = document.querySelectorAll('#kr-rows-container .kr-row');
        return this.normalizeKeyResultsList(Array.from(rows).map(row => ({
            title: row.querySelector('.kr-title')?.value?.trim() || '',
            current: row.querySelector('.kr-current')?.value || 0,
            target: row.querySelector('.kr-target')?.value || 0,
        })));
    },

    parseKeyResultsText: function(textRaw) {
        const lines = String(textRaw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        return this.normalizeKeyResultsList(lines.map((line) => {
            const parts = line.split('|').map(p => p.trim());
            return {
                title: parts[0] || '',
                current: parts[1] || 0,
                target: parts[2] || 0
            };
        }));
    },

    serializeKeyResultsText: function(keyResults) {
        if (!Array.isArray(keyResults) || keyResults.length === 0) return '';
        return keyResults.map((kr) => {
            const title = String(kr?.title || '').trim();
            const current = Number(kr?.current || 0);
            const target = Number(kr?.target || 0);
            return `${title} | ${current} | ${target}`;
        }).join('\n');
    },

    computeKeyResultsProgress: function(keyResults) {
        if (!Array.isArray(keyResults) || keyResults.length === 0) return null;
        const valid = keyResults.filter(kr => Number(kr?.target) > 0);
        if (valid.length === 0) return null;
        const sumPct = valid.reduce((acc, kr) => {
            const current = Number(kr.current || 0);
            const target = Number(kr.target || 0);
            const pct = Math.max(0, Math.min(100, (current / target) * 100));
            return acc + pct;
        }, 0);
        return Math.round(sumPct / valid.length);
    },

    onParentChange: function(parentId) {
        const typeSelect = document.getElementById('crud-type');
        const dimSelect = document.getElementById('crud-dimension');
        if (!typeSelect || !dimSelect || !parentId) return;

        const type = typeSelect.value;
        let parentType = '';
        if (type === 'metas') parentType = 'metas';
        if (type === 'okrs') parentType = 'metas';
        if (type === 'macros') parentType = 'okrs';
        if (type === 'micros') parentType = 'macros';

        if (parentType) {
            const parent = window.sistemaVidaState.entities[parentType].find(e => e.id === parentId);
            if (parent && parent.dimension) {
                // Sincroniza dimensão com o pai selecionado
                dimSelect.value = parent.dimension;
            }
        }
    },

    updateParentList: function(type) {
        const parentSelect = document.getElementById('create-parent');
        const dimSelect = document.getElementById('crud-dimension');
        const horizonSelect = document.getElementById('crud-meta-horizon');
        if (!parentSelect) return;
        
        const currentDim = dimSelect ? dimSelect.value : null;
        parentSelect.innerHTML = `<option value="">${type === 'metas' ? 'Sem meta pai (Meta Raiz)' : 'Sem vínculo (Mestre)'}</option>`;
        
        let parentType = '';
        if (type === 'metas') parentType = 'metas';
        if (type === 'okrs') parentType = 'metas';
        if (type === 'macros') parentType = 'okrs';
        if (type === 'micros') parentType = 'macros';
        
        if (parentType && window.sistemaVidaState.entities[parentType]) {
            const childMetaHorizon = Number(horizonSelect?.value || 1);
            const editingId = this.editingEntity?.id || '';
            const parents = window.sistemaVidaState.entities[parentType].filter(p => {
                if (editingId && p.id === editingId) return false;
                return !currentDim || currentDim === 'Geral' || p.dimension === currentDim || p.dimension === 'Geral';
            }).filter(p => {
                if (type !== 'metas') return true;
                const parentHorizon = this.getMetaHorizonYears(p);
                if (!(parentHorizon > childMetaHorizon)) return false;
                if (!editingId) return true;
                const parentChain = this.getMetaParentChain(p.id);
                return !parentChain.includes(editingId);
            });

            parents.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                if (type === 'metas') {
                    const h = this.getMetaHorizonYears(p);
                    opt.textContent = `[${h}a][${p.dimension}] ${p.title}`;
                } else {
                    opt.textContent = `[${p.dimension}] ${p.title}`;
                }
                parentSelect.appendChild(opt);
            });
        }
    },

    closeModal: function() {
        const modal = document.getElementById('crud-modal');
        const form = document.getElementById('crud-form');
        if (modal) modal.classList.add('hidden');
        this.clearBlockingMessage();
        if (form) {
            form.reset();
            // Reset de campos extras não limpos pelo reset() standard
            const parentSelect = document.getElementById('create-parent');
            if (parentSelect) parentSelect.innerHTML = '';
            
            const triggerContainer = document.getElementById('crud-trigger-container');
            if (triggerContainer) {
                triggerContainer.classList.add('hidden');
                triggerContainer.classList.remove('flex');
                triggerContainer.style.display = 'none';
            }
            const habitIdentityGroup = document.getElementById('crud-habit-identity');
            if (habitIdentityGroup) {
                habitIdentityGroup.classList.add('hidden');
                habitIdentityGroup.classList.remove('flex');
                habitIdentityGroup.style.display = 'none';
            }
            const habitControls = document.getElementById('crud-habit-controls');
            if (habitControls) {
                habitControls.classList.add('hidden');
                habitControls.classList.remove('flex');
                habitControls.style.display = 'none';
            }
        }
        this.editingEntity = null;
    },

    openTextEdit: function(title, group, key, resumoKey) {
        this.currentTextGroup = group;
        this.currentTextKey = key;
        this.currentResumoKey = resumoKey || null;
        document.getElementById('text-edit-title').textContent = title;
        document.getElementById('text-edit-input').value = window.sistemaVidaState.profile[group][key] || "";

        // Mostra/oculta campo de resumo
        const resumoGroup = document.getElementById('text-edit-resumo-group');
        const resumoInput = document.getElementById('text-edit-resumo');
        const resumoCount = document.getElementById('text-edit-resumo-count');
        if (resumoKey && resumoGroup && resumoInput) {
            const resumoVal = window.sistemaVidaState.profile[group][resumoKey] || "";
            resumoInput.value = resumoVal;
            if (resumoCount) resumoCount.textContent = resumoVal.length;
            resumoGroup.classList.remove('hidden');
            resumoGroup.style.display = 'flex';
        } else if (resumoGroup) {
            resumoGroup.classList.add('hidden');
            resumoGroup.style.display = 'none';
        }

        document.getElementById('text-edit-modal').classList.remove('hidden');
    },

    closeTextModal: function() {
        document.getElementById('text-edit-modal').classList.add('hidden');
    },

    saveTextEdit: function() {
        const val = document.getElementById('text-edit-input').value.trim();

        // Valida resumo obrigatório quando campo possui resumoKey
        if (this.currentResumoKey) {
            const resumoVal = (document.getElementById('text-edit-resumo')?.value || '').trim();
            if (!resumoVal) {
                alert('O resumo para trilha é obrigatório. Preencha uma versão curta (máx. 80 caracteres).');
                document.getElementById('text-edit-resumo')?.focus();
                return;
            }
            if (!window.sistemaVidaState.profile[this.currentTextGroup]) {
                window.sistemaVidaState.profile[this.currentTextGroup] = {};
            }
            window.sistemaVidaState.profile[this.currentTextGroup][this.currentResumoKey] = resumoVal;
        }

        if (this.currentTextGroup && this.currentTextKey) {
            if (!window.sistemaVidaState.profile[this.currentTextGroup]) {
                window.sistemaVidaState.profile[this.currentTextGroup] = {};
            }
            window.sistemaVidaState.profile[this.currentTextGroup][this.currentTextKey] = val;
            if (['ikigai', 'legacyObj', 'vision'].includes(this.currentTextGroup)) {
                this.markCadence('purpose');
            }
            this.saveState(true);
            this.closeTextModal();
            if (this.currentView === 'proposito' && this.render.proposito) {
                this.render.proposito();
            }
        }
    },

    // ── Planejamento Semanal ────────────────────────────────────────────────────
    _getWeekKey: function(date = new Date()) {
        // Retorna a segunda-feira da semana no formato YYYY-MM-DD
        const d = new Date(date);
        const day = d.getDay(); // 0=dom, 1=seg...
        const diff = (day === 0) ? -6 : 1 - day; // ajusta para segunda
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
    },

    _getNextWeekKey: function(date = new Date()) {
        const d = new Date(this._getWeekKey(date) + 'T00:00:00');
        d.setDate(d.getDate() + 7);
        return this.getLocalDateKey(d);
    },

    getRelativeWeekKey: function(weekKey, offsetWeeks = 0) {
        const d = new Date((weekKey || this._getWeekKey()) + 'T00:00:00');
        d.setDate(d.getDate() + (Number(offsetWeeks) || 0) * 7);
        return this.getLocalDateKey(d);
    },

    getWeekDateKeys: function(weekKey = this._getWeekKey()) {
        const start = new Date(weekKey + 'T00:00:00');
        return Array.from({ length: 7 }, (_, idx) => {
            const d = new Date(start);
            d.setDate(start.getDate() + idx);
            return this.getLocalDateKey(d);
        });
    },

    _formatWeekRange: function(weekKey) {
        const start = new Date(weekKey + 'T00:00:00');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `Semana de ${fmt(start)} a ${fmt(end)}`;
    },

    _getWeeklyPlanKey: function() {
        return this._weeklyPlanTargetKey || this._getWeekKey();
    },

    _isPlannedThisWeek: function(microId) {
        const state = window.sistemaVidaState;
        const weekKey = this._getWeekKey();
        const plan = (state.weekPlans || {})[weekKey];
        return !!(plan && plan.selectedMicros && plan.selectedMicros.includes(microId));
    },

    _getEntityCounts: function(entityType, entityId, state) {
        const e = state.entities;
        if (entityType === 'metas') {
            const okrs = (e.okrs || []).filter(o => o.metaId === entityId);
            const okrIds = new Set(okrs.map(o => o.id));
            const macros = (e.macros || []).filter(m => m.metaId === entityId || okrIds.has(m.okrId));
            const macroIds = new Set(macros.map(m => m.id));
            const micros = (e.micros || []).filter(m =>
                m.metaId === entityId || okrIds.has(m.okrId) || macroIds.has(m.macroId)
            );
            return { okrs: okrs.length, macros: macros.length, micros: micros.length };
        }
        if (entityType === 'okrs') {
            const macros = (e.macros || []).filter(m => m.okrId === entityId);
            const macroIds = new Set(macros.map(m => m.id));
            const micros = (e.micros || []).filter(m =>
                m.okrId === entityId || macroIds.has(m.macroId)
            );
            return { macros: macros.length, micros: micros.length };
        }
        if (entityType === 'macros') {
            const micros = (e.micros || []).filter(m => m.macroId === entityId);
            return { micros: micros.length };
        }
        return {};
    },

    syncMicroWeekPlanToggle: function(microId = '') {
        const toggle = document.getElementById('add-to-week-plan');
        const toggleWrap = document.getElementById('week-plan-toggle-wrap');
        if (!toggle || !toggleWrap) return;

        const weekKey = this._getWeekKey();
        const plan = (window.sistemaVidaState.weekPlans || {})[weekKey];
        if (!plan) {
            toggle.checked = false;
            toggle.disabled = true;
            return;
        }

        toggle.disabled = false;
        if (!microId) {
            toggle.checked = false;
            return;
        }

        const selected = Array.isArray(plan.selectedMicros) ? plan.selectedMicros : [];
        toggle.checked = selected.includes(microId);
    },

    syncFocoPlannedFilterOption: function() {
        const statusSelect = document.getElementById('todo-status-filter');
        if (!statusSelect) return;
        const weekKey = this._getWeekKey();
        const hasActivePlan = !!(window.sistemaVidaState.weekPlans || {})[weekKey];
        const plannedOption = Array.from(statusSelect.options).find(opt => opt.value === 'planned');

        if (hasActivePlan) {
            if (!plannedOption) {
                const opt = document.createElement('option');
                opt.value = 'planned';
                opt.textContent = 'Plano da Semana';
                const pendingOpt = Array.from(statusSelect.options).find(o => o.value === 'pending');
                if (pendingOpt) statusSelect.insertBefore(opt, pendingOpt);
                else statusSelect.appendChild(opt);
            }
        } else {
            if (plannedOption) plannedOption.remove();
            if (statusSelect.value === 'planned') statusSelect.value = 'all';
        }
    },

    /**
     * Gera uma lista de insights automáticos baseados nos dados já existentes.
     * Retorna um array de objetos {icon, tone, text} ordenados por prioridade.
     * Zero impacto em dados — apenas leitura.
     */
    /**
     * Popula o select #habit-linked-meta com todas as Metas ativas,
     * agrupadas por dimensão. Mantém a seleção atual se o id ainda existir.
     */
    ensureDailyCheckinState: function() {
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        const profile = window.sistemaVidaState.profile;
        if (!Array.isArray(profile.dailyCheckins)) profile.dailyCheckins = [];
        const seen = new Set();
        profile.dailyCheckins = profile.dailyCheckins
            .map((entry) => {
                const date = String(entry?.date || '').slice(0, 10);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) return null;
                seen.add(date);
                const clamp = (value, fallback = 3) => {
                    const n = Math.round(Number(value));
                    if (!Number.isFinite(n)) return fallback;
                    return Math.max(1, Math.min(5, n));
                };
                const sleepHours = Math.round(Math.max(0, Math.min(16, Number(entry?.sleepHours) || 0)) * 10) / 10;
                return {
                    date,
                    sleepHours,
                    sleepQuality: clamp(entry?.sleepQuality),
                    energy: clamp(entry?.energy),
                    mood: clamp(entry?.mood),
                    stress: clamp(entry?.stress),
                    emotion: String(entry?.emotion || '').trim().slice(0, 40),
                    intention: String(entry?.intention || '').trim().slice(0, 160),
                    savedAt: String(entry?.savedAt || new Date().toISOString())
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 180);
    },

        // Extracted in Phase 9: cadence module
ensureNotesState: function() {
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        const profile = window.sistemaVidaState.profile;
        if (!Array.isArray(profile.notes)) profile.notes = [];
        profile.notes = profile.notes
            .map((note) => {
                const title = String(note?.title || '').trim();
                const body = String(note?.body || '').trim();
                if (!title && !body) return null;
                const rawLinked = note?.linkedTo && typeof note.linkedTo === 'object' ? note.linkedTo : {};
                const entityType = this.normalizeEntityType(String(rawLinked.entityType || '').trim());
                const entityId = String(rawLinked.entityId || '').trim();
                return {
                    id: String(note?.id || `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`),
                    title: title || 'Nota sem titulo',
                    body,
                    url: String(note?.url || '').trim(),
                    tags: Array.isArray(note?.tags)
                        ? note.tags.map(tag => String(tag || '').trim()).filter(Boolean)
                        : String(note?.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
                    linkedTo: entityType && entityId ? { entityType, entityId } : null,
                    createdAt: String(note?.createdAt || new Date().toISOString()),
                    updatedAt: String(note?.updatedAt || note?.createdAt || new Date().toISOString())
                };
            })
            .filter(Boolean)
            .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    },

    getNoteLinkOptions: function() {
        const state = window.sistemaVidaState;
        this.ensureIdentityState();
        const makeOption = (entityType, entityId, label, group) => ({
            value: `${entityType}:${entityId}`,
            entityType,
            entityId,
            label: String(label || '').trim(),
            group
        });
        const options = [];
        const entities = state.entities || {};
        [
            ['metas', 'Metas'],
            ['okrs', 'OKRs'],
            ['macros', 'Macros'],
            ['micros', 'Micros']
        ].forEach(([type, group]) => {
            (entities[type] || []).forEach(item => {
                if (item?.id && item?.title) options.push(makeOption(type, item.id, item.title, group));
            });
        });
        (state.habits || []).forEach(item => {
            if (item?.id && item?.title) options.push(makeOption('habits', item.id, item.title, 'Habitos'));
        });
        const identity = state.profile?.identity || {};
        (identity.strengths || []).forEach(item => {
            if (item?.id && item?.title) options.push(makeOption('strengths', item.id, item.title, 'Forcas'));
        });
        (identity.shadows || []).forEach(item => {
            if (item?.id && item?.title) options.push(makeOption('shadows', item.id, item.title, 'Sombras'));
        });
        return options;
    },

    getNoteLinkLabel: function(linkedTo) {
        if (!linkedTo || !linkedTo.entityType || !linkedTo.entityId) return '';
        const found = this.getNoteLinkOptions().find(opt =>
            opt.entityType === linkedTo.entityType && opt.entityId === linkedTo.entityId
        );
        return found ? `${found.group}: ${found.label}` : `${linkedTo.entityType}: ${linkedTo.entityId}`;
    },

    populateNoteLinkedSelect: function() {
        const select = document.getElementById('note-linked');
        if (!select) return;
        const prev = select.value;
        const groups = {};
        this.getNoteLinkOptions().forEach(opt => {
            if (!groups[opt.group]) groups[opt.group] = [];
            groups[opt.group].push(opt);
        });
        let html = '<option value="">Sem vinculo</option>';
        Object.keys(groups).forEach(group => {
            html += `<optgroup label="${this.escapeHtml(group)}">`;
            groups[group].forEach(opt => {
                html += `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`;
            });
            html += '</optgroup>';
        });
        select.innerHTML = html;
        if (prev && Array.from(select.options || []).some(opt => opt.value === prev)) select.value = prev;
    },

    clearNoteForm: function() {
        ['note-title', 'note-url', 'note-tags', 'note-body', 'note-edit-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const linked = document.getElementById('note-linked');
        if (linked) linked.value = '';
    },

    saveProfileNote: function() {
        this.ensureNotesState();
        const title = String(document.getElementById('note-title')?.value || '').trim();
        const body = String(document.getElementById('note-body')?.value || '').trim();
        if (!title && !body) {
            if (this.showToast) this.showToast('Escreva um titulo ou conteudo para salvar a nota.', 'error');
            return;
        }
        const editId = String(document.getElementById('note-edit-id')?.value || '').trim();
        const linkedRaw = String(document.getElementById('note-linked')?.value || '');
        const [entityType, ...entityIdParts] = linkedRaw.split(':');
        const entityId = entityIdParts.join(':');
        const now = new Date().toISOString();
        const note = {
            id: editId || `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            title: title || 'Nota sem titulo',
            body,
            url: String(document.getElementById('note-url')?.value || '').trim(),
            tags: String(document.getElementById('note-tags')?.value || '').split(',').map(tag => tag.trim()).filter(Boolean),
            linkedTo: entityType && entityId ? { entityType, entityId } : null,
            createdAt: now,
            updatedAt: now
        };
        const list = window.sistemaVidaState.profile.notes || [];
        const idx = editId ? list.findIndex(item => item.id === editId) : -1;
        if (idx >= 0) {
            note.createdAt = list[idx].createdAt || now;
            list[idx] = note;
        } else {
            list.unshift(note);
        }
        window.sistemaVidaState.profile.notes = list;
        this.ensureNotesState();
        this.saveState(true);
        try { this.localSet('lifeos_notes_backup', JSON.stringify(window.sistemaVidaState.profile.notes || [])); } catch (_) {}
        this.clearNoteForm();
        this.renderNotesPanel();
        if (this.showToast) this.showToast('Nota salva.', 'success');
    },

    openQuickNoteFromFab: function() {
        this.closeFabMenu();
        const modal = document.getElementById('quick-note-modal');
        if (!modal) return;
        ['quick-note-title', 'quick-note-body', 'quick-note-url', 'quick-note-tags', 'quick-note-edit-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const linkedSel = document.getElementById('quick-note-linked');
        if (linkedSel) {
            const groups = {};
            this.getNoteLinkOptions().forEach(opt => {
                if (!groups[opt.group]) groups[opt.group] = [];
                groups[opt.group].push(opt);
            });
            let html = '<option value="">Sem vínculo (nota avulsa)</option>';
            Object.keys(groups).forEach(group => {
                html += `<optgroup label="${this.escapeHtml(group)}">`;
                groups[group].forEach(opt => {
                    html += `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`;
                });
                html += '</optgroup>';
            });
            linkedSel.innerHTML = html;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('quick-note-body')?.focus(), 50);
    },

    closeQuickNoteModal: function() {
        const modal = document.getElementById('quick-note-modal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    },

    openEntityNotesModal: function(type, id, entityTitle) {
        // Pode ser chamado pelo botão do crud-modal (sem args) ou direto com args
        if (!type || !id) {
            const btn = document.getElementById('crud-notes-btn');
            if (!btn) return;
            type = btn.dataset.entityType;
            id = btn.dataset.entityId;
            entityTitle = btn.dataset.entityTitle;
        }
        this._entityNotesContext = { type, id, entityTitle };

        let notes = this.getLinkedNotes(type, id);
        if (!notes.length) {
            notes = (window.sistemaVidaState.profile.notes || []).filter(n => n.linkedTo?.entityId === id);
        }

        const modal = document.getElementById('entity-notes-modal');
        const titleEl = document.getElementById('entity-notes-modal-title');
        const listEl = document.getElementById('entity-notes-modal-list');
        if (!modal || !listEl) return;

        if (titleEl) titleEl.textContent = entityTitle || 'Entidade';

        if (notes.length) {
            listEl.innerHTML = notes.map(note => `
                <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 space-y-1">
                    <div class="flex items-start justify-between gap-2">
                        <span class="text-sm font-semibold text-on-surface leading-snug">${this.escapeHtml(note.title || 'Nota')}</span>
                        <button type="button" onclick="window.app.openNoteForEdit('${note.id}')"
                            class="shrink-0 p-1 rounded-md hover:bg-surface-container-highest text-outline transition-colors">
                            <span class="material-symbols-outlined notranslate text-[16px]">edit</span>
                        </button>
                    </div>
                    ${note.body ? `<p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(note.body)}</p>` : ''}
                    ${note.tags?.length ? `<div class="flex flex-wrap gap-1 pt-1">${note.tags.map(t => `<span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                </div>
            `).join('');
        } else {
            listEl.innerHTML = `<p class="text-sm text-outline italic text-center py-6">Nenhuma nota vinculada a esta entidade ainda.</p>`;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeEntityNotesModal: function() {
        const modal = document.getElementById('entity-notes-modal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        this._entityNotesContext = null;
    },

    openNewNoteFromEntityModal: function() {
        const ctx = this._entityNotesContext;
        this.closeEntityNotesModal();
        const modal = document.getElementById('quick-note-modal');
        if (!modal) return;

        ['quick-note-title', 'quick-note-body', 'quick-note-url', 'quick-note-tags', 'quick-note-edit-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const linkedSel = document.getElementById('quick-note-linked');
        if (linkedSel) {
            const groups = {};
            this.getNoteLinkOptions().forEach(opt => {
                if (!groups[opt.group]) groups[opt.group] = [];
                groups[opt.group].push(opt);
            });
            let html = '<option value="">Sem vínculo (nota avulsa)</option>';
            Object.keys(groups).forEach(group => {
                html += `<optgroup label="${this.escapeHtml(group)}">`;
                groups[group].forEach(opt => {
                    html += `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`;
                });
                html += '</optgroup>';
            });
            linkedSel.innerHTML = html;
            // Pré-selecionar a entidade
            if (ctx?.type && ctx?.id) {
                const targetVal = `${ctx.type}:${ctx.id}`;
                if (linkedSel.querySelector(`option[value="${targetVal}"]`)) linkedSel.value = targetVal;
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('quick-note-body')?.focus(), 50);
    },

    openNoteForEdit: function(noteId) {
        const note = (window.sistemaVidaState.profile.notes || []).find(n => n.id === noteId);
        if (!note) return;
        this.closeEntityNotesModal();
        const modal = document.getElementById('quick-note-modal');
        if (!modal) return;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('quick-note-title', note.title || '');
        set('quick-note-body', note.body || '');
        set('quick-note-url', note.url || '');
        set('quick-note-tags', (note.tags || []).join(', '));
        set('quick-note-edit-id', note.id);

        const linkedSel = document.getElementById('quick-note-linked');
        if (linkedSel) {
            const groups = {};
            this.getNoteLinkOptions().forEach(opt => {
                if (!groups[opt.group]) groups[opt.group] = [];
                groups[opt.group].push(opt);
            });
            let html = '<option value="">Sem vínculo (nota avulsa)</option>';
            Object.keys(groups).forEach(group => {
                html += `<optgroup label="${this.escapeHtml(group)}">`;
                groups[group].forEach(opt => {
                    html += `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`;
                });
                html += '</optgroup>';
            });
            linkedSel.innerHTML = html;
            if (note.linkedTo) {
                const val = `${note.linkedTo.entityType}:${note.linkedTo.entityId}`;
                if (linkedSel.querySelector(`option[value="${val}"]`)) linkedSel.value = val;
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('quick-note-title')?.focus(), 50);
    },

    saveQuickNote: function() {
        const title = String(document.getElementById('quick-note-title')?.value || '').trim();
        const body = String(document.getElementById('quick-note-body')?.value || '').trim();
        if (!title && !body) {
            if (this.showToast) this.showToast('Escreva um título ou conteúdo para salvar a nota.', 'error');
            return;
        }
        this.ensureNotesState();
        const editId = String(document.getElementById('quick-note-edit-id')?.value || '').trim();
        const linkedRaw = String(document.getElementById('quick-note-linked')?.value || '');
        const [entityType, ...entityIdParts] = linkedRaw.split(':');
        const entityId = entityIdParts.join(':');
        const now = new Date().toISOString();
        const note = {
            id: editId || `note_${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            title: title || 'Nota sem título',
            body,
            url: String(document.getElementById('quick-note-url')?.value || '').trim(),
            tags: String(document.getElementById('quick-note-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
            linkedTo: entityType && entityId ? { entityType, entityId } : null,
            createdAt: now,
            updatedAt: now
        };
        const list = window.sistemaVidaState.profile.notes || (window.sistemaVidaState.profile.notes = []);
        const idx = editId ? list.findIndex(item => item.id === editId) : -1;
        if (idx >= 0) { note.createdAt = list[idx].createdAt || now; list[idx] = note; }
        else list.unshift(note);
        this.ensureNotesState();
        this.saveState(true);
        this.closeQuickNoteModal();
        this.renderNotesPanel();
        if (this.showToast) this.showToast('Nota salva em Perfil → Notas.', 'success');
    },

    editProfileNote: function(noteId) {
        this.ensureNotesState();
        const note = (window.sistemaVidaState.profile.notes || []).find(item => item.id === noteId);
        if (!note) return;
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };
        set('note-title', note.title);
        set('note-url', note.url);
        set('note-tags', (note.tags || []).join(', '));
        set('note-body', note.body);
        set('note-edit-id', note.id);
        this.populateNoteLinkedSelect();
        const linked = document.getElementById('note-linked');
        if (linked) linked.value = note.linkedTo ? `${note.linkedTo.entityType}:${note.linkedTo.entityId}` : '';
        const titleEl = document.getElementById('note-title');
        if (titleEl) {
            titleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            titleEl.focus();
        }
    },

    deleteProfileNote: function(noteId) {
        this.ensureNotesState();
        const note = (window.sistemaVidaState.profile.notes || []).find(item => item.id === noteId);
        if (!note || !confirm(`Excluir a nota "${note.title}"?`)) return;
        window.sistemaVidaState.profile.notes = window.sistemaVidaState.profile.notes.filter(item => item.id !== noteId);
        this.saveState(true);
        this.renderNotesPanel();
        if (this.showToast) this.showToast('Nota removida.', 'success');
    },

    toggleNotesMonth: function(safeYm) {
        const panel = document.getElementById(`notes-month-${safeYm}`);
        if (!panel) return;
        const opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !opening);
        const chev = document.querySelector(`.notes-month-chev-${safeYm}`);
        if (chev) chev.classList.toggle('rotate-180', opening);
    },

    normalizeEntityType: function(entityType) {
        if (!entityType) return '';
        const raw = String(entityType).toLowerCase().trim();
        const map = {
            meta: 'metas', metas: 'metas', okr: 'okrs', okrs: 'okrs',
            macro: 'macros', macros: 'macros', micro: 'micros', micros: 'micros',
            habit: 'habits', habits: 'habits', strength: 'strengths', strengths: 'strengths',
            shadow: 'shadows', shadows: 'shadows'
        };
        return map[raw] || raw;
    },

    getLinkedNotes: function(entityType, entityId) {
        this.ensureNotesState();
        const normalizedType = this.normalizeEntityType(entityType);
        return (window.sistemaVidaState.profile.notes || []).filter(note =>
            this.normalizeEntityType(note.linkedTo?.entityType) === normalizedType && note.linkedTo?.entityId === entityId
        );
    },

    getTodayCheckin: function() {
        this.ensureDailyCheckinState();
        const today = this.getLocalDateKey();
        return (window.sistemaVidaState.profile.dailyCheckins || []).find(entry => entry.date === today) || null;
    },

    getDailyCheckinExpandKey: function(dateKey = this.getLocalDateKey()) {
        return `lifeos_checkin_expanded_${dateKey}`;
    },

    isDailyCheckinExpanded: function(todayEntry) {
        const today = this.getLocalDateKey();
        if (!todayEntry) return true;
        if (this._dailyCheckinExpandedDate === today && typeof this._dailyCheckinExpanded === 'boolean') {
            return this._dailyCheckinExpanded;
        }
        let stored = '';
        try { stored = this.localGet(this.getDailyCheckinExpandKey(today)) || ''; } catch (_) {}
        if (stored === '1') return true;
        if (stored === '0') return false;
        return false;
    },

    expandDailyCheckinPanel: function(expanded = true) {
        const today = this.getLocalDateKey();
        this._dailyCheckinExpandedDate = today;
        this._dailyCheckinExpanded = !!expanded;
        try { this.localSet(this.getDailyCheckinExpandKey(today), expanded ? '1' : '0'); } catch (_) {}
        this.renderDailyCheckinPanel();
    },

    buildDailyCheckinSummary: function(entry) {
        if (!entry) return 'Check-in ainda não registrado hoje.';
        const moodLabel = this.getCheckinScaleText ? this.getCheckinScaleText('mood', entry.mood) : `Humor ${entry.mood}`;
        const energyLabel = this.getCheckinScaleText ? this.getCheckinScaleText('energy', entry.energy) : `Energia ${entry.energy}`;
        const stressLabel = this.getCheckinScaleText ? this.getCheckinScaleText('stress', entry.stress) : `Estresse ${entry.stress}`;
        const emotion = entry.emotion ? ` · Emoção ${entry.emotion}` : '';
        return `Check-in concluído · Sono ${entry.sleepHours || 0}h · ${energyLabel} · ${moodLabel} · ${stressLabel}${emotion}`;
    },

    getDailyCheckinSummaryState: function(entry) {
        if (!entry) return { emoji: '📝', title: 'Check-in pendente', tone: 'bg-surface-container-low text-on-surface' };
        const sleep = Number(entry.sleepHours || 0);
        const sleepQ = Number(entry.sleepQuality || 3);
        const energy = Number(entry.energy || 3);
        const mood = Number(entry.mood || 3);
        const stress = Number(entry.stress || 3);
        const emotion = String(entry.emotion || '').toLowerCase();
        if (sleep < 5 || sleepQ < 3) {
            return { emoji: '😴', title: 'Base em protecao', tone: 'bg-amber-500/15 text-amber-700' };
        }
        if (stress >= 4 && emotion.includes('ans')) {
            return { emoji: '🫶', title: 'Respire e reduza a carga', tone: 'bg-rose-500/12 text-rose-700' };
        }
        if (stress >= 4) {
            return { emoji: '🧯', title: 'Dia para simplificar', tone: 'bg-orange-500/12 text-orange-700' };
        }
        if (energy <= 2) {
            return { emoji: '🔋', title: 'Economia de energia', tone: 'bg-sky-500/12 text-sky-700' };
        }
        if (mood <= 2) {
            return { emoji: '🌱', title: 'Va no gentil e no concreto', tone: 'bg-lime-500/12 text-lime-700' };
        }
        if (energy >= 4 && mood >= 4 && stress <= 2) {
            return { emoji: '🚀', title: 'Janela boa para avancar', tone: 'bg-emerald-500/12 text-emerald-700' };
        }
        return { emoji: '🧭', title: 'Dia sob controle', tone: 'bg-primary/12 text-primary' };
    },

    renderDailyCheckinSummaryCard: function(entry) {
        if (!entry) return 'Check-in ainda nao registrado hoje.';
        const state = this.getDailyCheckinSummaryState(entry);
        const sleepMeta = this.getCheckinScaleMeta ? this.getCheckinScaleMeta('sleep', entry.sleepQuality) : { emoji: '😴', short: `Sono ${entry.sleepQuality || 3}` };
        const energyMeta = this.getCheckinScaleMeta ? this.getCheckinScaleMeta('energy', entry.energy) : { emoji: '⚡', short: `Energia ${entry.energy || 3}` };
        const moodMeta = this.getCheckinScaleMeta ? this.getCheckinScaleMeta('mood', entry.mood) : { emoji: '🙂', short: `Humor ${entry.mood || 3}` };
        const stressMeta = this.getCheckinScaleMeta ? this.getCheckinScaleMeta('stress', entry.stress) : { emoji: '😌', short: `Estresse ${entry.stress || 3}` };
        const compactValue = (kind, raw) => {
            const maps = {
                sleep: ['Ruim', 'Abaixo', 'Ok', 'Bom', 'Otimo'],
                energy: ['Min.', 'Baixa', 'Media', 'Boa', 'Alta'],
                mood: ['Baixo', 'Baixo', 'Neutro', 'Bom', 'Otimo'],
                stress: ['Leve', 'Ok', 'Mod.', 'Alta', 'Crit.']
            };
            const idx = Math.max(1, Math.min(5, Number(raw) || 3)) - 1;
            return maps[kind]?.[idx] || 'Ok';
        };
        const chips = [
            { emoji: sleepMeta.emoji, title: 'Sono', value: `${entry.sleepHours || 0}h`, detail: compactValue('sleep', entry.sleepQuality) },
            { emoji: energyMeta.emoji, title: 'Energia', value: compactValue('energy', entry.energy), detail: '' },
            { emoji: moodMeta.emoji, title: 'Humor', value: compactValue('mood', entry.mood), detail: '' },
            { emoji: stressMeta.emoji, title: 'Estresse', value: compactValue('stress', entry.stress), detail: '' }
        ];
        const emotionValue = entry.emotion ? entry.emotion : 'Nao informada';
        const intentionValue = entry.intention ? entry.intention : 'Nao definida';
        const compactText = (value, max = 48) => {
            const clean = String(value || '').trim();
            if (clean.length <= max) return clean;
            return `${clean.slice(0, max - 3)}...`;
        };
        return `
            <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${state.tone}">
                        <span class="text-sm leading-none">${state.emoji}</span>
                        ${this.escapeHtml(state.title)}
                    </span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                    ${chips.map((chip) => `
                        <div class="rounded-xl border border-outline-variant/20 bg-surface-container-high px-3 py-2 text-on-surface min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-[15px] leading-none shrink-0">${chip.emoji}</span>
                                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">${this.escapeHtml(chip.title)}</p>
                            </div>
                            <div class="mt-1.5 flex items-end justify-between gap-2 min-w-0">
                                <p class="text-[13px] font-bold text-on-surface truncate">${this.escapeHtml(chip.value)}</p>
                                ${chip.detail ? `<p class="text-[10px] text-outline shrink-0">${this.escapeHtml(chip.detail)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div class="rounded-lg border border-outline-variant/20 bg-surface-container-high px-2.5 py-2 text-on-surface min-w-0 flex items-center gap-1.5">
                        <span class="text-[14px] leading-none shrink-0">🎭</span>
                        <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-outline shrink-0">Emocao</p>
                        <p class="text-[12px] font-semibold text-on-surface truncate">${this.escapeHtml(compactText(emotionValue, 28))}</p>
                    </div>
                    <div class="rounded-lg border border-outline-variant/20 bg-surface-container-high px-2.5 py-2 text-on-surface min-w-0 flex items-center gap-1.5">
                        <span class="text-[14px] leading-none shrink-0">🧭</span>
                        <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-outline shrink-0">Intencao</p>
                        <p class="text-[12px] font-semibold text-on-surface truncate">${this.escapeHtml(compactText(intentionValue, 42))}</p>
                    </div>
                </div>
            </div>
        `;
    },

    getDailyCheckinRecommendationDismissKey: function(dateKey) {
        return `lifeos_checkin_rec_dismissed_${dateKey || this.getLocalDateKey()}`;
    },

    getDailyCheckinRecommendation: function(entry) {
        if (!entry) return '';
        const sleep = Number(entry.sleepHours || 0);
        const sleepQ = Number(entry.sleepQuality || 3);
        const energy = Number(entry.energy || 3);
        const mood = Number(entry.mood || 3);
        const stress = Number(entry.stress || 3);
        const emotion = String(entry.emotion || '').toLowerCase();
        if (sleep < 5 || sleepQ < 3) {
            return 'Sono curto ou de baixa qualidade hoje. Priorize o essencial e proteja uma desaceleração real à noite.';
        }
        if (stress >= 4 && emotion.includes('ans')) {
            return 'Ansiedade e carga alta hoje. Vale uma pausa de respiração ou caminhada antes do próximo bloco.';
        }
        if (stress >= 4) {
            return 'Carga emocional alta. Reduza o número de micros e preserve uma pausa de verdade hoje.';
        }
        if (energy <= 2) {
            return 'Energia baixa. Um bloco de foco curto e bem feito vale mais do que um longo arrastado.';
        }
        if (mood <= 2) {
            return 'Humor sensível hoje. Simplifique expectativas e busque uma pequena vitória concreta.';
        }
        return '';
    },

    dismissDailyCheckinRecommendation: function() {
        try { this.localSet(this.getDailyCheckinRecommendationDismissKey(), '1'); } catch (_) {}
        this.renderDailyCheckinPanel();
    },

    // getCheckinScaleText and renderDailyCheckinGuidance extracted to js/subjectiveScales.js (Phase 10.1)
    // Attached to app via attachSubjectiveScales(app) at module load time.

    saveDailyCheckin: function() {
        this.ensureDailyCheckinState();
        const today = this.getLocalDateKey();
        const read = (id, fallback = 3) => {
            const el = document.getElementById(id);
            const n = Number(el?.value);
            return Number.isFinite(n) ? n : fallback;
        };
        const entry = {
            date: today,
            sleepHours: Math.round(Math.max(0, Math.min(16, read('daily-checkin-sleep-hours', 0))) * 10) / 10,
            sleepQuality: Math.max(1, Math.min(5, Math.round(read('daily-checkin-sleep-quality')))),
            energy: Math.max(1, Math.min(5, Math.round(read('daily-checkin-energy')))),
            mood: Math.max(1, Math.min(5, Math.round(read('daily-checkin-mood')))),
            stress: Math.max(1, Math.min(5, Math.round(read('daily-checkin-stress')))),
            emotion: String(document.getElementById('daily-checkin-emotion')?.value || '').trim().slice(0, 40),
            intention: String(document.getElementById('diario-foco')?.value || '').trim(),
            savedAt: new Date().toISOString()
        };
        const list = window.sistemaVidaState.profile.dailyCheckins.filter(item => item.date !== today);
        list.unshift(entry);
        window.sistemaVidaState.profile.dailyCheckins = list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 180);
        window.sistemaVidaState.energy = entry.energy;
        const focoInput = document.getElementById('diario-foco');
        if (focoInput) {
            if (!window.sistemaVidaState.dailyLogs) window.sistemaVidaState.dailyLogs = {};
            window.sistemaVidaState.dailyLogs[today] = {
                ...window.sistemaVidaState.dailyLogs[today],
                focus: focoInput.value.trim()
            };
        }
        this.markCadence('checkin', today);
        const checkinAward = this.awardGamification('daily_checkin', { key: `daily_checkin:${today}`, date: today });
        const intentionAward = entry.intention
            ? this.awardGamification('daily_intention', { key: `daily_intention:${today}`, date: today })
            : null;
        this._dailyCheckinExpandedDate = today;
        this._dailyCheckinExpanded = false;
        try { this.localSet(this.getDailyCheckinExpandKey(today), '0'); } catch (_) {}
        this.saveState(true);
        try { this.localSet('lifeos_daily_checkins_backup', JSON.stringify(window.sistemaVidaState.profile.dailyCheckins || [])); } catch (_) {}
        this.renderDailyCheckinPanel();
        this.renderProfileCadence();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
        const xpEarned = (checkinAward?.xp || 0) + (intentionAward?.xp || 0);
        this.showGamificationBatchEffects([checkinAward, intentionAward], xpEarned);
        if (this.showToast) this.showToast(xpEarned ? `Check-in salvo! +${xpEarned} XP` : 'Check-in atualizado.', 'success');
    },

    setCheckinVal: function(inputId, val, btn) {
        const hidden = document.getElementById(inputId);
        if (hidden) hidden.value = val;
        if (inputId === 'daily-checkin-energy') {
            window.sistemaVidaState.energy = val;
            if (this.renderDailyCompass) this.renderDailyCompass();
        }
        const group = btn ? btn.closest('[data-checkin-group]') : document.querySelector(`[data-checkin-group="${inputId}"]`);
        if (group) {
            group.querySelectorAll('.checkin-emoji-btn').forEach(b => {
                const active = parseInt(b.dataset.val) === val;
                b.classList.toggle('ring-2', active);
                b.classList.toggle('ring-primary', active);
                b.classList.toggle('bg-primary/10', active);
            });
        }
        this.renderDailyCheckinGuidance();
    },

    toggleDiaryDimensionArea: function(dim) {
        const container = document.getElementById('dim-diary-areas');
        if (!container) return;
        const safeId = 'dim-note-' + dim.replace(/[^a-zA-Z0-9]/g, '-');
        const existing = document.getElementById(safeId);
        const btn = document.querySelector(`.dim-diary-toggle[data-dim="${CSS.escape(dim)}"]`);
        const dimIcons = { 'Saúde': '💪', 'Mente': '🧠', 'Carreira': '💼', 'Finanças': '💰', 'Relacionamentos': '🤝', 'Família': '🏠', 'Lazer': '🎨', 'Propósito': '✨' };
        if (existing) {
            existing.remove();
            if (btn) btn.classList.remove('bg-secondary/20', 'border-secondary', 'text-secondary', 'font-bold');
        } else {
            const div = document.createElement('div');
            div.id = safeId;
            div.className = 'rounded-xl border border-outline-variant/20 overflow-hidden';
            div.innerHTML = `<div class="flex items-center gap-2 bg-surface-container px-4 py-2.5">
                <span class="text-base">${dimIcons[dim] || '⭐'}</span>
                <span class="text-xs font-bold text-on-surface uppercase tracking-widest">${this.escapeHtml(dim)}</span>
            </div>
            <textarea data-dim-note="${this.escapeHtml(dim)}" class="w-full bg-transparent px-4 py-3 text-sm text-on-surface resize-none focus:outline-none focus:bg-primary/[0.02]" rows="3" placeholder="Como foi ${this.escapeHtml(dim.toLowerCase())} hoje?"></textarea>`;
            container.appendChild(div);
            if (btn) btn.classList.add('bg-secondary/20', 'border-secondary', 'text-secondary', 'font-bold');
            div.querySelector('textarea').focus();
        }
    },

    toggleDiarioDimensionChip: function(btn) {
        const dim = btn.getAttribute('data-dim');
        const hidden = document.getElementById('diario-dimension');
        const current = hidden ? (hidden.value ? hidden.value.split(',') : []) : [];
        const idx = current.indexOf(dim);
        if (idx >= 0) current.splice(idx, 1); else current.push(dim);
        if (hidden) hidden.value = current.join(',');
        document.querySelectorAll('.diario-dim-chip').forEach(chip => {
            const active = current.includes(chip.getAttribute('data-dim'));
            chip.classList.toggle('bg-primary/20', active);
            chip.classList.toggle('border-primary', active);
            chip.classList.toggle('text-primary', active);
            chip.classList.toggle('font-bold', active);
        });
    },

    toggleEmotionCollapse: function() {
        const wrapper = document.getElementById('emotion-chips-wrapper');
        const icon = document.getElementById('emotion-collapse-icon');
        if (!wrapper) return;
        const nowHidden = wrapper.classList.toggle('hidden');
        if (icon) icon.style.transform = nowHidden ? '' : 'rotate(180deg)';
    },

    _updateEmotionPreview: function(val) {
        const preview = document.getElementById('emotion-selected-preview');
        if (!preview) return;
        if (val) {
            preview.textContent = val;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
        }
    },

    toggleEmotionChip: function(btn) {
        const emotion = btn.getAttribute('data-emotion');
        const hidden = document.getElementById('daily-checkin-emotion');
        const currentVal = hidden ? hidden.value : '';
        const newVal = currentVal === emotion ? '' : emotion;
        if (hidden) hidden.value = newVal;
        document.querySelectorAll('.emotion-chip').forEach(chip => {
            const active = chip.getAttribute('data-emotion') === newVal;
            chip.classList.toggle('bg-primary/20', active);
            chip.classList.toggle('bg-surface-container-low', !active);
            chip.classList.toggle('border-primary', active);
            chip.classList.toggle('border-outline-variant/30', !active);
            chip.classList.toggle('text-primary', active);
            chip.classList.toggle('font-bold', active);
        });
        this._updateEmotionPreview(newVal);
    },

    renderHabitMaturityPanel: function() {
        const container = document.getElementById('habit-maturity-panel');
        if (!container) return;
        this.ensureHabitMaturityState();
        const habits = window.sistemaVidaState.habits || [];
        const forming = habits.filter(h => h.maturity !== 'graduated');
        const graduated = habits.filter(h => h.maturity === 'graduated');
        const cfg = this.getHabitMaturityConfig();
        const currentWeek = this._getWeekKey();
        const candidates = forming
            .map(habit => {
                const rates = [];
                for (let i = cfg.graduationWeeks - 1; i >= 0; i--) {
                    rates.push(this.getHabitWeekRate(habit, this.getRelativeWeekKey(currentWeek, -i)));
                }
                const avg = rates.length ? rates.reduce((sum, n) => sum + n, 0) / rates.length : 0;
                return { habit, avg };
            })
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 3);
        const cards = [
            {
                label: 'Em formacao',
                value: forming.length,
                icon: 'construction',
                body: `${cfg.graduationWeeks} semanas com ${Math.round(cfg.graduationRate * 100)}%+ de consistencia graduam o habito.`
            },
            {
                label: 'Automaticos',
                value: graduated.length,
                icon: 'verified',
                body: 'Habitos graduados continuam sendo acompanhados, mas recebem XP de manutencao.'
            },
            {
                label: 'Mais proximos',
                value: candidates.length ? `${Math.round(candidates[0].avg * 100)}%` : '--',
                icon: 'trending_up',
                body: candidates.length
                    ? candidates.map(item => `${this.escapeHtml(item.habit.title)} (${Math.round(item.avg * 100)}%)`).join(' · ')
                    : 'Sem historico suficiente para indicar candidatos.'
            }
        ];
        container.innerHTML = cards.map(card => `
            <div class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div class="flex items-center justify-between gap-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(card.label)}</p>
                    <span class="material-symbols-outlined notranslate text-primary text-[18px]">${this.escapeHtml(card.icon)}</span>
                </div>
                <p class="mt-2 text-2xl font-headline font-bold text-on-surface">${this.escapeHtml(String(card.value))}</p>
                <p class="mt-2 text-xs text-on-surface-variant leading-relaxed">${card.body}</p>
            </div>
        `).join('');
    },

    hasEnoughData: function(metric, minDays = 14) {
        const profile = window.sistemaVidaState.profile || {};
        if (metric === 'checkin') {
            const uniqueDates = new Set((profile.dailyCheckins || []).map(entry => entry.date).filter(Boolean));
            return { ok: uniqueDates.size >= minDays, count: uniqueDates.size, minDays };
        }
        return { ok: false, count: 0, minDays };
    },

    getDailyMicroExecutionRate: function(dateKey) {
        const micros = window.sistemaVidaState.entities?.micros || [];
        const dueOrActive = micros.filter(m => {
            const start = m.inicioDate || m.prazo || '';
            const due = m.prazo || '';
            if (!due) return false;
            return start <= dateKey && due >= dateKey;
        });
        const done = dueOrActive.filter(m =>
            m.status === 'done' && (!m.completedDate || m.completedDate <= dateKey)
        ).length;
        return dueOrActive.length ? done / dueOrActive.length : null;
    },

    getDailyHabitAdherenceRate: function(dateKey) {
        const habits = window.sistemaVidaState.habits || [];
        const day = String(new Date(dateKey + 'T00:00:00').getDay());
        const expected = habits.filter(h => {
            const days = Array.isArray(h.specificDays) ? h.specificDays.map(String) : [];
            return h.frequency !== 'specific' || !days.length || days.includes(day);
        });
        const done = expected.filter(h => this.isHabitDoneOnDate(h, dateKey)).length;
        return expected.length ? done / expected.length : null;
    },

    getCheckinJoinedRows: function(days = 28) {
        this.ensureDailyCheckinState();
        const entries = (window.sistemaVidaState.profile?.dailyCheckins || []).slice(0, days);
        return entries.map(entry => ({
            ...entry,
            microRate: this.getDailyMicroExecutionRate(entry.date),
            habitRate: this.getDailyHabitAdherenceRate(entry.date)
        })).sort((a, b) => a.date.localeCompare(b.date));
    },

    splitAverage: function(rows, predicate, accessor) {
        const group = rows.filter(predicate).map(accessor).filter(v => Number.isFinite(Number(v)));
        if (!group.length) return null;
        return group.reduce((sum, n) => sum + Number(n), 0) / group.length;
    },

    renderMiniTrend: function(values, tone = 'primary') {
        const nums = values.filter(v => Number.isFinite(Number(v))).map(Number).slice(-14);
        if (!nums.length) return '<div class="h-10 rounded-lg bg-surface-container-high"></div>';
        const bars = nums.map(v => {
            const pct = Math.max(8, Math.min(100, Math.round(v * 100)));
            const color = tone === 'error' ? 'bg-error' : tone === 'warn' ? 'bg-amber-500' : 'bg-primary';
            return `<span class="flex-1 rounded-t ${color}" style="height:${pct}%"></span>`;
        }).join('');
        return `<div class="h-12 flex items-end gap-1 rounded-lg bg-surface-container-high px-2 pt-2 overflow-hidden">${bars}</div>`;
    },

    getLoadRecoverySignal: function() {
        const gate = this.hasEnoughData('checkin', 7);
        if (!gate.ok) return { show: false, reason: 'insufficient', gate };
        const rows = this.getCheckinJoinedRows(10).slice(-7);
        const last3 = rows.slice(-3);
        const lowEnergy3 = last3.length === 3 && last3.every(r => Number(r.energy) <= 2);
        const highStress3 = last3.length === 3 && last3.every(r => Number(r.stress) >= 4);
        const recentMicro = this.splitAverage(rows.slice(-3), () => true, r => r.microRate);
        const priorMicro = this.splitAverage(rows.slice(0, 4), () => true, r => r.microRate);
        const fallingExecution = Number.isFinite(Number(recentMicro)) && Number.isFinite(Number(priorMicro)) && recentMicro + 0.15 < priorMicro;
        const weekKey = this._getWeekKey();
        const weekPlan = (window.sistemaVidaState.weekPlans || {})[weekKey];
        const plannedCount = Array.isArray(weekPlan?.selectedMicros) ? weekPlan.selectedMicros.length : 0;
        const activeHabits = (window.sistemaVidaState.habits || []).length;
        const heavyLoad = plannedCount + activeHabits >= 10;
        const show = (lowEnergy3 || highStress3 || fallingExecution) && heavyLoad;
        return { show, lowEnergy3, highStress3, fallingExecution, plannedCount, activeHabits };
    },

    dismissLoadRecoveryAlert: function() {
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        window.sistemaVidaState.profile.dismissedLoadAlertDate = this.getLocalDateKey();
        this.saveState(true);
        this.renderLoadRecoveryPanel();
    },

    renderLoadRecoveryPanel: function() {
        const container = document.getElementById('load-recovery-panel');
        if (!container) return;
        const dismissed = window.sistemaVidaState.profile?.dismissedLoadAlertDate === this.getLocalDateKey();
        const signal = this.getLoadRecoverySignal();
        if (!signal.show || dismissed) {
            container.innerHTML = '';
            return;
        }
        const reasons = [
            signal.lowEnergy3 ? 'energia baixa por 3 dias' : '',
            signal.highStress3 ? 'estresse alto por 3 dias' : '',
            signal.fallingExecution ? 'execucao de micros caindo' : ''
        ].filter(Boolean).join(', ');
        container.innerHTML = `
            <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="min-w-0">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Sinais de sobrecarga</p>
                    <h4 class="mt-1 font-headline text-xl font-bold text-on-surface">Considere reduzir o ritmo desta semana</h4>
                    <p class="mt-2 text-sm text-on-surface-variant leading-relaxed">Detectei ${this.escapeHtml(reasons || 'carga alta')} com ${signal.plannedCount} micros planejadas e ${signal.activeHabits} habitos ativos.</p>
                </div>
                <button type="button" onclick="window.app.dismissLoadRecoveryAlert()" class="shrink-0 px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container-highest">Dispensar</button>
            </div>`;
    },

    renderWellbeingTrendsPanel: function() {
        const container = document.getElementById('wellbeing-trends-panel');
        if (!container) return;
        const state = window.sistemaVidaState;
        const permaVals = ['P', 'E', 'R', 'M', 'A'].map(k => this.normalizePermaScore(state.perma?.[k]));
        const permaAvg = permaVals.length ? permaVals.reduce((sum, n) => sum + n, 0) / permaVals.length : 0;
        const wheelVals = Object.values(state.dimensions || {}).map(item => Number(item?.score) || 0);
        const wheelAvg = wheelVals.length ? Math.round(wheelVals.reduce((sum, n) => sum + n, 0) / wheelVals.length) : 0;
        const swlsScore = Number(state.swls?.lastScore) || 0;
        const history = state.wellbeingHistory || { wheel: {}, perma: {} };
        const trendLabel = (entries, current, suffix = '') => {
            const ordered = Object.entries(entries || {}).sort((a, b) => b[0].localeCompare(a[0]));
            const previous = ordered.find(([, item]) => Number.isFinite(Number(item?.avg ?? item?.score)));
            if (!previous) return 'Sem snapshot anterior.';
            const oldVal = Number(previous[1].avg ?? previous[1].score);
            const delta = Math.round((Number(current) - oldVal) * 10) / 10;
            if (Math.abs(delta) < 0.1) return `Estável desde ${previous[0]}.`;
            return `${delta > 0 ? '+' : ''}${delta}${suffix} desde ${previous[0]}.`;
        };
        const card = (label, value, copy, icon) => `
            <div class="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/10 shadow-sm flex items-start justify-between gap-3">
                <div>
                    <p class="text-[10px] uppercase tracking-widest font-bold text-outline">${this.escapeHtml(label)}</p>
                    <p class="mt-1 text-2xl font-headline italic text-primary">${this.escapeHtml(value)}</p>
                    <p class="mt-1 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(copy)}</p>
                </div>
                <span class="material-symbols-outlined notranslate text-primary">${this.escapeHtml(icon)}</span>
            </div>`;
        container.innerHTML = [
            card('Roda da Vida', `${wheelAvg}%`, trendLabel(history.wheel, wheelAvg, ' pts'), 'pie_chart'),
            card('PERMA', `${permaAvg.toFixed(1)}/10`, trendLabel(history.perma, permaAvg), 'psychology'),
            card('SWLS', swlsScore ? `${swlsScore}/35` : '--', state.swls?.lastDate ? `Última avaliação: ${state.swls.lastDate}` : 'Sem avaliação registrada.', 'monitoring')
        ].join('');
    },

    recordWellbeingSnapshot: function(kind) {
        if (!window.sistemaVidaState.wellbeingHistory) window.sistemaVidaState.wellbeingHistory = { wheel: {}, perma: {}, odyssey: {} };
        const dateKey = this.getLocalDateKey();
        if (kind === 'wheel') {
            this.normalizeDimensionsState();
            const scores = {};
            this.getWheelAxes().forEach(dim => { scores[dim] = Number(window.sistemaVidaState.dimensions?.[dim]?.score) || 1; });
            const vals = Object.values(scores);
            window.sistemaVidaState.wellbeingHistory.wheel[dateKey] = {
                avg: vals.length ? Math.round(vals.reduce((sum, n) => sum + n, 0) / vals.length) : 0,
                scores
            };
        }
        if (kind === 'perma') {
            this.normalizePermaState();
            const scores = {};
            ['P', 'E', 'R', 'M', 'A'].forEach(k => { scores[k] = this.normalizePermaScore(window.sistemaVidaState.perma?.[k]); });
            const vals = Object.values(scores);
            window.sistemaVidaState.wellbeingHistory.perma[dateKey] = {
                avg: vals.length ? Math.round((vals.reduce((sum, n) => sum + n, 0) / vals.length) * 10) / 10 : 0,
                scores
            };
        }
    },

    _computeInsights: function() {
        const state = window.sistemaVidaState;
        const insights = [];
        const todayStr = this.getLocalDateKey();
        const today = new Date(todayStr + 'T00:00:00');
        const dimensions = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];

        // 1. Dimensão com Meta ativa mas sem micro concluída nas últimas 4 semanas
        const fourWeeksAgo = new Date(today);
        fourWeeksAgo.setDate(today.getDate() - 28);
        const fourWeeksAgoStr = this.getLocalDateKey(fourWeeksAgo);

        dimensions.forEach(dim => {
            const hasActiveMeta = (state.entities?.metas || []).some(m =>
                m.dimension === dim && m.status !== 'done' && m.status !== 'abandoned'
            );
            if (!hasActiveMeta) return;
            const hasRecentActivity = (state.entities?.micros || []).some(m =>
                m.dimension === dim && m.completedDate && m.completedDate >= fourWeeksAgoStr
            );
            if (!hasRecentActivity) {
                insights.push({
                    icon: 'trending_down',
                    tone: 'warn',
                    text: `<b>${dim}</b> tem Meta ativa mas nenhuma micro concluída nas últimas 4 semanas.`
                });
            }
        });

        // 2. Hábito com sequência 3+ dias quebrada (ontem e hoje em branco)
        (state.habits || []).forEach(h => {
            const logs = h.logs || {};
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayStr = this.getLocalDateKey(yesterday);
            const doneYesterday = (logs[yesterdayStr] || 0) > 0;
            const doneToday = (logs[todayStr] || 0) > 0;
            if (doneToday || doneYesterday) return;

            let streak = 0;
            for (let i = 2; i < 30; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const ds = this.getLocalDateKey(d);
                if ((logs[ds] || 0) > 0) streak++;
                else break;
            }
            if (streak >= 3) {
                insights.push({
                    icon: 'local_fire_department',
                    tone: 'info',
                    text: `<b>${h.title}</b> tinha ${streak} dias de sequência — 2 dias em branco, vale retomar.`
                });
            }
        });

        // 3. Acúmulo de atrasadas (5+)
        const overdueCount = (state.entities?.micros || []).filter(m =>
            m.status !== 'done' && m.prazo && m.prazo < todayStr
        ).length;
        if (overdueCount >= 5) {
            insights.push({
                icon: 'warning',
                tone: 'warn',
                text: `${overdueCount} micros atrasadas acumuladas. Considere migrar ou adiar em lote.`
            });
        }

        const weekKey = this._getWeekKey();
        const weekPlan = (state.weekPlans || {})[weekKey];
        const selectedIds = Array.isArray(weekPlan?.selectedMicros) ? weekPlan.selectedMicros : [];
        const weekMicros = selectedIds.length > 0
            ? (state.entities?.micros || []).filter(m => selectedIds.includes(m.id) && m.status !== 'done' && m.status !== 'abandoned')
            : (state.entities?.micros || []).filter(m => m.status !== 'done' && m.status !== 'abandoned' && this.isDateInCurrentWeek(m.prazo));

        if (weekMicros.length >= 4) {
            const byDim = {};
            weekMicros.forEach(m => {
                const dim = m.dimension || 'Geral';
                byDim[dim] = (byDim[dim] || 0) + 1;
            });
            const dominant = Object.entries(byDim).sort((a, b) => b[1] - a[1])[0];
            if (dominant && dominant[1] / weekMicros.length >= 0.7) {
                insights.push({
                    icon: 'balance',
                    tone: 'info',
                    text: `<b>${dominant[0]}</b> concentra ${Math.round((dominant[1] / weekMicros.length) * 100)}% das micros da semana. Veja se isso é intenção ou desequilíbrio.`
                });
            }

            const unlinked = weekMicros.filter(m => {
                const ctx = this._getMicroContext(m);
                return !ctx.meta;
            }).length;
            if (unlinked / weekMicros.length >= 0.6) {
                insights.push({
                    icon: 'link_off',
                    tone: 'warn',
                    text: `${unlinked} de ${weekMicros.length} micros da semana estão sem vínculo com Meta. Pode ser operação necessária, mas revise se o plano ainda aponta para algo maior.`
                });
            }
        }

        return insights;
    },

    _getMicroContext: function(micro) {
        const state = window.sistemaVidaState;
        const macro = micro?.macroId
            ? (state.entities?.macros || []).find(m => m.id === micro.macroId)
            : null;
        const okr = macro?.okrId
            ? (state.entities?.okrs || []).find(o => o.id === macro.okrId)
            : (micro?.okrId ? (state.entities?.okrs || []).find(o => o.id === micro.okrId) : null);
        const meta = okr?.metaId
            ? (state.entities?.metas || []).find(m => m.id === okr.metaId)
            : (micro?.metaId ? (state.entities?.metas || []).find(m => m.id === micro.metaId) : null);
        return { macro, okr, meta };
    },

    // Detects the highest-priority gap in the Meta→OKR→Macro→Micro hierarchy.
    // Returns a gap descriptor object or null when no gaps exist.
    _detectHierarchyGap: function(state) {
        const entities = state?.entities || {};
        const isActive = item => item && item.id && item.status !== 'done' && item.status !== 'abandoned' && !item.completed;
        const metas   = (entities.metas  || []).filter(isActive);
        const okrs    = (entities.okrs   || []).filter(isActive);
        const macros  = (entities.macros || []).filter(isActive);
        const micros  = (entities.micros || []).filter(isActive);

        // Priority 1: active meta with no OKR at all
        for (const meta of metas) {
            if (!okrs.some(o => o.metaId === meta.id)) {
                return {
                    gapType: 'meta-sem-okr',
                    entityType: 'okrs',
                    parentId: meta.id,
                    parentTitle: meta.title,
                    title: 'Meta sem resultado-chave',
                    description: `"${meta.title}" ainda não tem um OKR. Defina um resultado mensurável para que o progresso desta meta possa ser rastreado.`
                };
            }
        }

        // Priority 2: active OKR with no macro
        for (const okr of okrs) {
            if (!macros.some(m => m.okrId === okr.id)) {
                return {
                    gapType: 'okr-sem-macro',
                    entityType: 'macros',
                    parentId: okr.id,
                    parentTitle: okr.title,
                    title: 'OKR sem projeto vinculado',
                    description: `"${okr.title}" ainda não tem uma macro. Crie um projeto para dar execução a este resultado esperado.`
                };
            }
        }

        // Priority 3: active macro with no active micro
        for (const macro of macros) {
            if (!micros.some(m => m.macroId === macro.id)) {
                return {
                    gapType: 'macro-sem-micro',
                    entityType: 'micros',
                    parentId: macro.id,
                    parentTitle: macro.title,
                    title: 'Macro sem próximo passo',
                    description: `"${macro.title}" não tem ações ativas vinculadas. Crie uma micro ação para avançar neste projeto.`
                };
            }
        }

        return null;
    },

    getDailyCompass: function() {
        const state = window.sistemaVidaState;
        const todayStr = this.getLocalDateKey();
        const next = this.getNextBestAction({ scope: 'today', skipEnergyFilter: true });
        const profile = state.profile || {};
        const values = Array.isArray(profile.values) ? profile.values.filter(Boolean) : [];
        const vision = profile.vision || {};
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};

        const dimScores = Object.entries(state.dimensions || {})
            .map(([dim, data]) => ({ dim, score: Number(data?.score) || 0 }))
            .filter(item => item.score > 0)
            .sort((a, b) => a.score - b.score);
        const theme = next?.micro?.dimension || dimScores[0]?.dim || values[0] || 'Geral';
        const quotes = this.getDailyCompassQuotes();
        const pool = quotes.filter(q => q.theme === theme);
        const fallback = quotes.filter(q => q.theme === 'Geral');
        const source = pool.length ? pool : fallback;
        const seed = Array.from(`${todayStr}:${theme}`).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const quote = source[seed % source.length];

        const purposePieces = [
            next?.meta?.purpose,
            next?.meta?.successCriteria,
            vision.quote,
            vision.saude,
            vision.carreira,
            vision.intelecto,
            ikigai.sintese,
            legacyObj.familia,
            legacyObj.profissao,
            legacyObj.mundo
        ].map(v => String(v || '').trim()).filter(Boolean);
        const personalAnchor = purposePieces[seed % Math.max(1, purposePieces.length)] || values[0] || theme;
        const valueText = values.length ? `valor ${values[0]}` : `área ${theme}`;
        const direction = next?.micro?.title
            ? `Direção: avance "${next.micro.title}" sem perder de vista ${valueText}.`
            : `Direção: escolha uma micro ação que torne ${valueText} visível hoje.`;

        return {
            theme,
            quote,
            personal: `Hoje, lembre-se de agir a partir de ${this.escapeHtml(personalAnchor)}.`,
            direction
        };
    },
    renderDailyCompass: function() {
        const container = document.getElementById('daily-compass-container');
        if (!container) return;
        const compass = this.getDailyCompass();
        const isInternalPrinciple = compass.quote?.author === 'Life OS';
        const quoteText = isInternalPrinciple
            ? this.escapeHtml(compass.quote.quote)
            : `"${this.escapeHtml(compass.quote.quote)}"`;
        const quoteSource = isInternalPrinciple
            ? 'Princípio interno do Life OS'
            : this.escapeHtml(compass.quote.author);
        container.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/5 p-5 md:p-6 shadow-sm">
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[10px] font-label uppercase tracking-widest text-primary font-bold mb-2">Bússola do Dia · ${this.escapeHtml(compass.theme)}</p>
                        <p class="text-sm text-on-surface leading-relaxed">${compass.personal}</p>
                        <blockquote class="mt-4 border-l border-primary/30 pl-4">
                            <p class="font-headline text-xl md:text-2xl italic text-on-background leading-snug">${quoteText}</p>
                            <p class="mt-2 text-[11px] font-bold uppercase tracking-widest text-outline">${quoteSource}</p>
                        </blockquote>
                        <p class="mt-4 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(compass.quote.reflection)} ${this.escapeHtml(compass.direction)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-primary text-2xl shrink-0">explore</span>
                </div>
            </div>`;
    },

    renderPurposeJourney: function() {
        const container = document.getElementById('purpose-journey-container');
        if (!container) return;
        const journey = this.getPurposeJourneyState();
        const nextPending = journey.items.find((item) => !item.done);
        const itemHtml = journey.items.map((item) => `
            <button type="button" onclick="window.app.openPurposeJourneyStep('${item.id}')"
                class="text-left rounded-xl border ${item.done ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-outline-variant/15 bg-surface-container-low'} px-3 py-3 hover:bg-surface-container-high transition-colors">
                <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined notranslate text-[16px] ${item.done ? 'text-emerald-500' : 'text-outline'}" ${item.done ? "style=\"font-variation-settings:'FILL' 1;\"" : ''}>${item.done ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <p class="text-xs font-semibold text-on-surface truncate">${this.escapeHtml(item.label)}</p>
                        </div>
                        <p class="mt-1 text-[11px] text-outline">${this.escapeHtml(item.hint)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-outline text-[18px] shrink-0">arrow_forward</span>
                </div>
            </button>
        `).join('');

        container.innerHTML = `
            <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm p-5 md:p-6">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="max-w-2xl">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Jornada de propósito</p>
                        <h3 class="mt-2 font-headline text-2xl font-bold text-on-background">Monte sua bússola em etapas.</h3>
                        <p class="mt-2 text-sm text-on-surface-variant leading-relaxed">Cada passo constrói sua clareza — de quem você é até onde quer chegar.</p>
                    </div>
                    <div class="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 min-w-[160px]">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Progresso</p>
                        <p class="mt-2 text-2xl font-headline font-bold text-on-background">${journey.doneCount}/${journey.total}</p>
                        <p class="text-xs text-outline mt-1">${journey.pct}% da bussola montada</p>
                    </div>
                </div>
                <div class="mt-4 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div class="h-full rounded-full bg-primary transition-all duration-500" style="width:${journey.pct}%"></div>
                </div>
                ${nextPending ? `<p class="mt-3 text-xs text-outline">Proximo passo recomendado: <span class="font-semibold text-on-surface">${this.escapeHtml(nextPending.label)}</span>.</p>` : ''}
                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${itemHtml}</div>
            </div>
        `;
    },

    openPurposeJourneyStep: function(stepId) {
        const map = {
            identity: 'top-values-banner',
            wheel: 'proposito-roda-section',
            'ikigai-base': 'proposito-ikigai-section',
            'ikigai-synthesis': 'display-ikigai-sintese',
            legacy: 'proposito-legado-section',
            vision: 'proposito-visao-section',
            odyssey: 'odyssey-section'
        };
        const targetId = map[stepId];
        if (!targetId) return;
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ring-2', 'ring-primary/30');
            setTimeout(() => el.classList.remove('ring-2', 'ring-primary/30'), 1800);
        }
    },

    renderPainelDiagnostics: function() {
        const container = document.getElementById('painel-diagnostics');
        if (!container) return;
        const insights = this._computeInsights().slice(0, 3);
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined notranslate text-primary shrink-0">verified</span>
                        <div>
                            <p class="text-sm font-bold text-on-surface">Sem alertas relevantes</p>
                            <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">Nenhum sinal forte passou do limite de atenção agora.</p>
                        </div>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = insights.map(ins => {
            const toneClass = ins.tone === 'warn'
                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-900 dark:text-amber-100'
                : 'bg-surface-container-lowest border-outline-variant/10 text-on-surface';
            const iconColor = ins.tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-primary';
            return `
                <div class="${toneClass} border rounded-2xl p-4 shadow-sm flex items-start gap-3">
                    <span class="material-symbols-outlined notranslate ${iconColor} shrink-0">${ins.icon}</span>
                    <p class="text-xs leading-relaxed">${ins.text}</p>
                </div>`;
        }).join('');
    },

    renderPainelDecision: function() {
        const container = document.getElementById('painel-decision');
        if (!container) return;
        const next = this.getNextBestAction({ scope: 'week' });
        const avg = this._computeWeeklyCompletionAverage(4);
        const weekKey = this._getWeekKey();
        const plan = (window.sistemaVidaState.weekPlans || {})[weekKey];
        const plannedCount = Array.isArray(plan?.selectedMicros) ? plan.selectedMicros.length : 0;
        let loadHtml = '';
        if (avg > 0 && plannedCount > 0) {
            const ratio = plannedCount / avg;
            const tone = ratio > 1.5 ? 'text-red-600 dark:text-red-400' : (ratio > 1.1 ? 'text-amber-600 dark:text-amber-400' : 'text-primary');
            const copy = ratio > 1.5
                ? 'Seu plano está muito acima do ritmo recente. Corte ou adie antes de criar novas ações.'
                : (ratio > 1.1
                    ? 'Seu plano está um pouco acima da média. Priorize as micros essenciais.'
                    : 'A carga planejada está dentro do seu ritmo recente.');
            loadHtml = `
                <div class="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-4 shadow-sm">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Execução realista</p>
                    <p class="mt-2 text-sm text-on-surface"><span class="${tone} font-bold">${plannedCount}</span> micros planejadas para média recente de <span class="font-bold">${avg}</span>.</p>
                    <p class="mt-1 text-xs text-on-surface-variant leading-relaxed">${copy}</p>
                </div>`;
        }
        container.innerHTML = this._renderNextActionCard(next, 'panel') + loadHtml;
    },

    renderWeeklyHealthScore: function({ execScore = 0, plannedCount = 0, doneCount = 0 } = {}) {
        const scoreEl = document.getElementById('weekly-health-score');
        const barEl = document.getElementById('weekly-health-bar');
        const labelEl = document.getElementById('weekly-health-label');
        const copyEl = document.getElementById('weekly-health-copy');
        if (!scoreEl && !barEl && !labelEl && !copyEl) return;

        const avg = this._computeWeeklyCompletionAverage(4);
        const loadRatio = avg > 0 && plannedCount > 0 ? plannedCount / avg : 1;
        const loadPenalty = plannedCount > 0 && avg > 0 ? Math.max(0, Math.min(30, Math.round((loadRatio - 1) * 20))) : 0;
        const overdueCount = (window.sistemaVidaState.entities?.micros || []).filter(m => m.status !== 'done' && m.prazo && m.prazo < this.getLocalDateKey()).length;
        const overduePenalty = Math.min(30, overdueCount * 10);
        const score = plannedCount === 0
            ? 0
            : Math.max(0, Math.min(100, Math.round((execScore * 0.75) + 25 - loadPenalty - overduePenalty)));

        let label = 'Semana sem plano';
        let copy = 'Planeje micros para medir se a semana está executável.';
        let color = 'bg-primary';
        if (plannedCount > 0) {
            if (score >= 75) {
                label = 'Saudável';
                copy = `${doneCount}/${plannedCount} micros concluídas. Continue executando sem inflar o plano.`;
                color = 'bg-emerald-500';
            } else if (score >= 45) {
                label = 'Pede atenção';
                copy = `${doneCount}/${plannedCount} micros concluídas. Priorize o essencial antes de adicionar novas ações.`;
                color = 'bg-amber-500';
            } else {
                label = 'Sob risco';
                copy = `${doneCount}/${plannedCount} micros concluídas. Reduza escopo, adie o que for denso e resolva atrasos.`;
                color = 'bg-error';
            }
        }

        if (scoreEl) scoreEl.textContent = plannedCount > 0 ? `${score}` : '--';
        if (labelEl) labelEl.textContent = label;
        if (copyEl) copyEl.textContent = copy;
        if (barEl) {
            barEl.className = `h-full ${color} rounded-full transition-all duration-700`;
            barEl.style.width = `${score}%`;
        }
    },

    /**
     * Retorna a média de Micros concluídos por semana nas últimas N semanas
     * (exclui a semana corrente para não contaminar com dados parciais).
     * Baseia-se em micro.completedDate (definido por completeMicroAction).
     */
    _computeWeeklyCompletionAverage: function(weeks = 4) {
        const state = window.sistemaVidaState;
        const micros = state.entities?.micros || [];
        if (!micros.length) return 0;

        const currentWeekKey = this._getWeekKey();
        const buckets = {};

        micros.forEach(m => {
            if (!m.completedDate) return;
            const d = new Date(m.completedDate + 'T00:00:00');
            if (isNaN(d.getTime())) return;
            const wk = this._getWeekKey(d);
            if (wk === currentWeekKey) return; // ignora semana em curso
            buckets[wk] = (buckets[wk] || 0) + 1;
        });

        const sortedKeys = Object.keys(buckets).sort().slice(-weeks);
        if (!sortedKeys.length) return 0;
        const total = sortedKeys.reduce((acc, k) => acc + buckets[k], 0);
        return Math.round((total / sortedKeys.length) * 10) / 10;
    },

    getNextWeekCarryoverSuggestions: function(sourceWeekKey = this._getWeekKey()) {
        const state = window.sistemaVidaState;
        const micros = (state.entities?.micros || []).filter(m => m.status !== 'done' && !m.completed && m.status !== 'abandoned');
        const currentPlan = (state.weekPlans || {})[sourceWeekKey] || {};
        const plannedIds = new Set(Array.isArray(currentPlan.selectedMicros) ? currentPlan.selectedMicros : []);
        const todayKey = this.getLocalDateKey();

        return micros
            .map((micro) => {
                let score = 0;
                if (plannedIds.has(micro.id)) score += 4;
                if (micro.status === 'in_progress') score += 3;
                if (micro.prazo && micro.prazo < todayKey) score += 3;
                if (micro.prazo && micro.prazo <= this._getNextWeekKey()) score += 1;
                return { micro, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return String(a.micro.prazo || '9999').localeCompare(String(b.micro.prazo || '9999'));
            })
            .slice(0, 8)
            .map(item => item.micro);
    },

    /** Atualiza o medidor de carga no modal de planejamento semanal. */
    _updateWeeklyPlanLoadMeter: function() {
        const countEl = document.getElementById('wp-load-count');
        const hintEl = document.getElementById('wp-load-hint');
        const avgEl = document.getElementById('wp-load-average');
        if (!countEl || !hintEl || !avgEl) return;

        const checked = document.querySelectorAll('.wp-micro-check:checked').length;
        const avg = this._computeWeeklyCompletionAverage(4);

        countEl.textContent = String(checked);
        avgEl.textContent = avg > 0 ? String(avg) : '—';

        // Cor e dica conforme overcommitment
        countEl.classList.remove('text-primary', 'text-amber-600', 'text-red-600', 'dark:text-amber-400', 'dark:text-red-400');
        if (avg <= 0) {
            countEl.classList.add('text-primary');
            hintEl.textContent = 'Sem histórico suficiente ainda.';
        } else if (checked > avg * 1.5) {
            countEl.classList.add('text-red-600', 'dark:text-red-400');
            hintEl.textContent = 'Muito acima do seu ritmo médio.';
        } else if (checked > avg * 1.1) {
            countEl.classList.add('text-amber-600', 'dark:text-amber-400');
            hintEl.textContent = 'Acima da média — priorize com cuidado.';
        } else {
            countEl.classList.add('text-primary');
            hintEl.textContent = 'Dentro do seu ritmo.';
        }
    },

    closeWeeklyPlanModal: function() {
        document.getElementById('weekly-plan-modal').classList.add('hidden');
        this.cancelInlineNewMicro();
        this._weeklyPlanTargetKey = null;
    },

    toggleInlineNewMicro: function() {
        const form = document.getElementById('wp-inline-new-micro');
        if (!form) return;
        if (form.classList.contains('hidden')) {
            const select = document.getElementById('wp-new-macro-id');
            if (select) {
                const activeMacros = (window.sistemaVidaState.entities?.macros || [])
                    .filter(m => m.status !== 'done' && m.status !== 'abandoned');
                select.innerHTML = '<option value="">Selecione um macro...</option>' +
                    activeMacros.map(m => {
                        const dim = this.escapeHtml(m.dimension || 'Sem dimensão');
                        const title = this.escapeHtml(m.title);
                        return `<option value="${m.id}">${dim} · ${title}</option>`;
                    }).join('');
                if (activeMacros.length === 0) {
                    select.innerHTML = '<option value="">Nenhum macro ativo — crie um primeiro</option>';
                }
            }
            const targetWeekKey = this._getWeeklyPlanKey();
            const todayKey = targetWeekKey > this._getWeekKey() ? targetWeekKey : this.getLocalDateKey();
            const weekEnd = new Date(targetWeekKey + 'T00:00:00');
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekEndKey = this.getLocalDateKey(weekEnd);
            const startEl = document.getElementById('wp-new-micro-start');
            const deadlineEl = document.getElementById('wp-new-micro-deadline');
            if (startEl && !startEl.value) startEl.value = todayKey;
            if (deadlineEl && !deadlineEl.value) deadlineEl.value = weekEndKey;
            this.updateInlineNewMicroDimension();
            form.classList.remove('hidden');
            setTimeout(() => document.getElementById('wp-new-micro-title')?.focus(), 50);
        } else {
            form.classList.add('hidden');
        }
    },

    updateInlineNewMicroDimension: function() {
        const macroId = document.getElementById('wp-new-macro-id')?.value || '';
        const label = document.getElementById('wp-new-micro-dimension');
        if (!label) return;
        const macro = (window.sistemaVidaState.entities?.macros || []).find(m => m.id === macroId);
        if (!macro) {
            label.textContent = 'Dimensão herdada do macro selecionado.';
            return;
        }
        label.textContent = `Dimensão: ${macro.dimension || 'Sem dimensão'}`;
    },

    cancelInlineNewMicro: function() {
        const form = document.getElementById('wp-inline-new-micro');
        if (form) form.classList.add('hidden');
        const titleEl = document.getElementById('wp-new-micro-title');
        if (titleEl) titleEl.value = '';
        const startEl = document.getElementById('wp-new-micro-start');
        const deadlineEl = document.getElementById('wp-new-micro-deadline');
        if (startEl) startEl.value = '';
        if (deadlineEl) deadlineEl.value = '';
        this.updateInlineNewMicroDimension();
    },

    saveInlineNewMicro: function() {
        const macroId = document.getElementById('wp-new-macro-id')?.value || '';
        const title = (document.getElementById('wp-new-micro-title')?.value || '').trim();
        const effort = document.getElementById('wp-new-micro-effort')?.value || 'medio';
        const inicioDate = document.getElementById('wp-new-micro-start')?.value || this._getWeeklyPlanKey();
        const prazo = document.getElementById('wp-new-micro-deadline')?.value || '';

        if (!macroId) { this.showToast('Selecione um macro pai.', 'error'); return; }
        if (!title) { this.showToast('Informe o título da micro ação.', 'error'); return; }
        if (!prazo) { this.showToast('Informe o prazo da micro ação.', 'error'); return; }

        const state = window.sistemaVidaState;
        const macro = (state.entities?.macros || []).find(m => m.id === macroId);
        if (!macro) { this.showToast('Macro não encontrado.', 'error'); return; }
        const windowValidation = this.validateEntityTimeWindow('micros', { inicioDate, prazo });
        if (!windowValidation.ok) { this.showToast(windowValidation.message, 'error'); return; }

        const newMicro = {
            id: `micro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            macroId,
            okrId: macro.okrId || '',
            metaId: macro.metaId || '',
            dimension: macro.dimension || '',
            inicioDate,
            prazo,
            status: 'pending',
            completed: false,
            progress: 0,
            effort,
            indicator: 'Criada no planejamento semanal',
            createdAt: this.getLocalDateKey()
        };

        if (!state.entities) state.entities = {};
        if (!Array.isArray(state.entities.micros)) state.entities.micros = [];
        state.entities.micros.push(newMicro);

        // Mark immediately in current week plan
        const weekKey = this._getWeeklyPlanKey();
        if (!state.weekPlans) state.weekPlans = {};
        const plan = state.weekPlans[weekKey] || {};
        const selected = Array.isArray(plan.selectedMicros) ? [...plan.selectedMicros] : [];
        if (!selected.includes(newMicro.id)) selected.push(newMicro.id);
        state.weekPlans[weekKey] = {
            ...plan,
            weekKey,
            intention: document.getElementById('wp-intention')?.value.trim() || plan.intention || '',
            energyForecast: Number(document.getElementById('wp-energy')?.value || plan.energyForecast || 3),
            selectedMicros: selected,
            savedAt: Date.now()
        };

        // Refresh list in modal
        this._refreshWpMicrosList();
        this.cancelInlineNewMicro();
        this.saveState(true);
        if (this.renderWeeklyPlans) this.renderWeeklyPlans();
        this.showToast(`"${title}" criada e adicionada ao plano.`, 'success');
    },

    _refreshWpMicrosList: function() {
        const state = window.sistemaVidaState;
        const weekKey = this._getWeeklyPlanKey();
        const plan = (state.weekPlans || {})[weekKey] || {};
        const selectedIds = Array.isArray(plan.selectedMicros) ? plan.selectedMicros : [];
        const activeMicros = (state.entities?.micros || []).filter(m => m.status !== 'done' && !m.completed);
        const container = document.getElementById('wp-micros-list');
        if (!container) return;
        if (activeMicros.length === 0) {
            container.innerHTML = '<p class="text-xs text-outline italic">Nenhum micro ativo disponível.</p>';
            this._updateWeeklyPlanLoadMeter();
            return;
        }
        container.innerHTML = activeMicros.map(m => {
            const checked = selectedIds.includes(m.id) ? 'checked' : '';
            const macroTitle = (state.entities.macros || []).find(ma => ma.id === m.macroId)?.title || '';
            const details = [
                m.dimension || '',
                macroTitle,
                m.prazo ? `prazo ${this._formatTrailDate ? this._formatTrailDate(m.prazo) : m.prazo}` : ''
            ].filter(Boolean).join(' · ');
            const sub = details ? `<span class="text-[10px] text-outline block">${this.escapeHtml(details)}</span>` : '';
            return `<label class="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-primary/5 transition-colors">
                <input type="checkbox" class="wp-micro-check mt-0.5 accent-primary" value="${m.id}" ${checked}>
                <span class="text-sm text-on-surface leading-snug">${this.escapeHtml(m.title)}${sub}</span>
            </label>`;
        }).join('');
        this._updateWeeklyPlanLoadMeter();
    },

    saveWeeklyPlan: function() {
        const weekKey = this._getWeeklyPlanKey();
        const intention = document.getElementById('wp-intention')?.value.trim() || '';
        const energyForecast = Number(document.getElementById('wp-energy')?.value || 3);
        const selectedMicros = Array.from(document.querySelectorAll('.wp-micro-check:checked')).map(cb => cb.value);

        if (!window.sistemaVidaState.weekPlans) window.sistemaVidaState.weekPlans = {};
        window.sistemaVidaState.weekPlans[weekKey] = {
            weekKey,
            intention,
            selectedMicros,
            energyForecast,
            savedAt: Date.now()
        };

        this.markCadence('weeklyPlan');
        const award = this.awardGamification('weekly_plan', { key: `weekly_plan:${weekKey}`, date: weekKey });
        this.saveState(true);
        const isNextWeek = weekKey > this._getWeekKey();
        this.closeWeeklyPlanModal();
        if (award) this.showGamificationAwardEffects(award);
        this.showNotification(award
            ? `${isNextWeek ? 'Plano da próxima semana salvo' : 'Plano semanal salvo'}! +${award.xp} XP`
            : (isNextWeek ? 'Plano da próxima semana salvo!' : 'Plano semanal salvo!'));
        if (this.renderWeeklyPlans) this.renderWeeklyPlans();
        if (this.currentView === 'planos' && this.render.planos) {
            this.render.planos();
            this.switchPlanosTab(this.planosActiveTab || 'semanal');
        }
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
    },

    startWeeklyReview: async function() {
        await this.switchView('planos', { preserveScroll: true });
        this.switchPlanosTab('semanal');
        if (this.renderWeeklyPlans) this.renderWeeklyPlans();
        const section = document.getElementById('tab-semanal');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => this.openReviewModal(), 250);
    },

    _showReviewPurposeAnchor: function() {
        document.getElementById('review-purpose-anchor')?.remove();
        const state = window.sistemaVidaState;
        const ikigai = state.profile?.ikigai || {};
        const values = Array.isArray(state.profile?.values) ? state.profile.values.filter(Boolean) : [];
        const vision = state.profile?.vision || {};
        const anchor = ikigai.sintese || vision.quote || values[0] || '';
        const el = document.createElement('div');
        el.id = 'review-purpose-anchor';
        el.innerHTML = `
            <div class="animate-fade-in fixed bottom-20 left-0 right-0 z-[90] px-4 pb-2">
                <div class="max-w-lg mx-auto rounded-2xl bg-surface-container-highest border border-primary/20 shadow-xl p-4 flex items-center gap-4">
                    <span class="material-symbols-outlined notranslate text-primary text-2xl shrink-0">auto_awesome</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-outline">Revisão Semanal</p>
                        <p class="text-xs text-on-surface-variant mt-0.5 leading-snug truncate">${anchor ? this.escapeHtml(anchor) : 'Relembre seu propósito antes de avaliar a semana.'}</p>
                    </div>
                    <button onclick="window.app._launchReviewFromAnchor()"
                        class="shrink-0 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wider whitespace-nowrap">
                        Abrir Revisão
                    </button>
                </div>
            </div>`;
        document.body.appendChild(el);
    },

    _launchReviewFromAnchor: function() {
        document.getElementById('review-purpose-anchor')?.remove();
        this.openReviewModal();
    },

    openReviewModal: function() {
        document.getElementById('review-form').reset();
        this.populateReviewIdentityFields();

        // Auto-preenche q1/q2 a partir do plano semanal
        const state = window.sistemaVidaState;
        const weekKey = this._getWeekKey();
        const plan = (state.weekPlans || {})[weekKey];

        if (plan) {
            const q1El = document.getElementById('rev-q1');
            const q2El = document.getElementById('rev-q2');
            const q4El = document.getElementById('rev-q4');

            // q1: O que planejei? → intenção + micros planejados
            if (q1El && (plan.intention || plan.selectedMicros?.length)) {
                const lines = [];
                if (plan.intention) lines.push(plan.intention);
                if (plan.selectedMicros?.length) {
                    const titles = plan.selectedMicros
                        .map(id => state.entities?.micros?.find(m => m.id === id)?.title)
                        .filter(Boolean);
                    if (titles.length) lines.push('Micros: ' + titles.join(', '));
                }
                q1El.value = lines.join('\n');
            }

            // q2: O que executei? → micros planejados que foram concluídos
            if (q2El && plan.selectedMicros?.length) {
                const doneTitles = plan.selectedMicros
                    .map(id => state.entities?.micros?.find(m => m.id === id))
                    .filter(m => m && (m.status === 'done' || m.completed))
                    .map(m => m.title);
                if (doneTitles.length) q2El.value = doneTitles.join(', ');
            }

            if (q4El && !q4El.value && plan.selectedMicros?.length) {
                const obstacles = plan.selectedMicros
                    .map(id => state.entities?.micros?.find(m => m.id === id))
                    .filter(m => m && (m.obstacle || m.ifThen))
                    .slice(0, 4)
                    .map(m => {
                        const detail = [m.obstacle, m.ifThen].filter(Boolean).join(' -> ');
                        return `${m.title}: ${detail}`;
                    });
                if (obstacles.length) q4El.value = `Obstaculos previstos na semana:\n${obstacles.join('\n')}`;
            }
        }

        document.getElementById('review-modal').classList.remove('hidden');
    },

    closeReviewModal: function() {
        document.getElementById('review-modal').classList.add('hidden');
        document.getElementById('review-purpose-anchor')?.remove();
    },

    saveReview: function() {
        const q1 = document.getElementById('rev-q1').value.trim();
        const q2 = document.getElementById('rev-q2').value.trim();
        const q3 = document.getElementById('rev-q3').value.trim();
        const q4 = document.getElementById('rev-q4').value.trim();
        const q5 = document.getElementById('rev-q5').value.trim();
        const strengthId = document.getElementById('rev-strength')?.value || '';
        const shadowId = document.getElementById('rev-shadow')?.value || '';
        const responsePracticed = document.getElementById('rev-response')?.value.trim() || '';
        const habitAdjustment = document.getElementById('rev-habit-adjust')?.value.trim() || '';

        // Salva pelo weekKey da segunda-feira (igual à chave de weekPlans)
        const weekKey = this._getWeekKey();
        if (!window.sistemaVidaState.reviews) {
            window.sistemaVidaState.reviews = {};
        }
        const hadReview = !!window.sistemaVidaState.reviews[weekKey];

        window.sistemaVidaState.reviews[weekKey] = {
            q1, q2, q3, q4, q5,
            strengthId,
            shadowId,
            responsePracticed,
            habitAdjustment,
            savedAt: new Date().toISOString()
        };
        this.updateIdentityWeeklyLogs(weekKey, window.sistemaVidaState.reviews[weekKey]);
        this.markCadence('weeklyReview');
        if (!hadReview) {
            const hasIdentityReflection = !!(strengthId || shadowId || responsePracticed || habitAdjustment);
            const award = this.awardGamification('weekly_review', { key: `review:${weekKey}`, identityReflection: hasIdentityReflection });
            this.showGamificationToast(award);
        }

        this.saveState(true);

        const btn = document.getElementById('btn-save-review');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✔ Revisão Salva!";
            setTimeout(() => {
                btn.innerHTML = originalText;
                this.closeReviewModal();
                this.goToWeeklyPlansAfterReview();
            }, 1000);
        } else {
            this.closeReviewModal();
            this.goToWeeklyPlansAfterReview();
        }
    },

    goToWeeklyPlansAfterReview: async function() {
        await this.switchView('planos');
        setTimeout(() => {
            this.switchPlanosTab('semanal');
            if (this.renderWeeklyPlans) this.renderWeeklyPlans();
            const nextWeekKey = this._getNextWeekKey();
            const nextPlan = (window.sistemaVidaState.weekPlans || {})[nextWeekKey];
            if (!nextPlan) {
                this.openWeeklyPlanModal({
                    weekKey: nextWeekKey,
                    nextWeek: true,
                    suggestCarryover: true
                });
            }
        }, 360);
    },

    openQuarterlyModal: function() {
        const state = window.sistemaVidaState;
        const listContainer = document.getElementById('quarterly-okrs-list');
        const saveBtn = document.getElementById('quarterly-save-btn');
        if (!listContainer) return;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar Novo Ciclo';
            saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
        
        const activeOkrs = (state.entities.okrs || []).filter(o => o.status !== 'done' && o.status !== 'abandoned');

        if (activeOkrs.length === 0) {
            listContainer.innerHTML = '<p class="text-sm text-outline italic text-center py-8">Nenhum OKR ativo no momento.</p>';
        } else {
            let html = '';
            activeOkrs.forEach(okr => {
                const pendingMicrosCount = (state.entities.micros || []).filter(m => {
                    const macro = state.entities.macros.find(ma => ma.id === m.macroId);
                    return m.status !== 'done' && macro && macro.okrId === okr.id;
                }).length;

                html += `
                <div class="bg-surface-container-low p-4 rounded-lg border border-outline-variant/20" data-okr-id="${okr.id}">
                    <div class="flex justify-between items-start mb-3">
                        <p class="text-sm font-medium pr-2">${okr.title}</p>
                        ${pendingMicrosCount > 0 ? `<span class="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">${pendingMicrosCount} pendentes</span>` : ''}
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="flex items-center gap-2 text-xs cursor-pointer"><input type="radio" name="action_${okr.id}" value="continuar" checked class="accent-primary" onchange="document.getElementById('migrate-container-${okr.id}').classList.toggle('hidden', !this.checked)"> Continuar no próximo ciclo</label>
                        <div id="migrate-container-${okr.id}" class="${pendingMicrosCount > 0 ? 'flex' : 'hidden'} items-center gap-2 ml-6 mb-1">
                            <input type="checkbox" id="migrate_${okr.id}" ${pendingMicrosCount > 0 ? 'checked' : ''} class="w-3.5 h-3.5 rounded accent-primary">
                            <label for="migrate_${okr.id}" class="text-[10px] text-outline font-medium">Migrar pendências para hoje</label>
                        </div>
                        <label class="flex items-center gap-2 text-xs cursor-pointer"><input type="radio" name="action_${okr.id}" value="concluir" class="accent-primary" onchange="document.getElementById('migrate-container-${okr.id}').classList.add('hidden')"> Marcar como Concluído</label>
                        <label class="flex items-center gap-2 text-xs cursor-pointer text-error"><input type="radio" name="action_${okr.id}" value="arquivar" class="accent-error" onchange="document.getElementById('migrate-container-${okr.id}').classList.add('hidden')"> Arquivar / Abandonar</label>
                    </div>
                </div>`;
            });
            listContainer.innerHTML = html;
        }
        
        document.getElementById('quarterly-modal').classList.remove('hidden');
        document.getElementById('quarterly-modal').classList.add('flex');
    },

    closeQuarterlyModal: function() {
        document.getElementById('quarterly-modal').classList.add('hidden');
        document.getElementById('quarterly-modal').classList.remove('flex');
    },

    openWheelModal: function() {
        const state = window.sistemaVidaState;
        const container = document.getElementById('wheel-sliders-container');
        if (!container) return;

        this.normalizeDimensionsState();
        const dimensions = this.getWheelAxes();
        let html = '';

        dimensions.forEach((dim, idx) => {
            const score = (state.dimensions && state.dimensions[dim]) ? state.dimensions[dim].score : 1;
            const targetId = `val-wheel-${idx}`;
            html += `
            <div class="space-y-1">
                <div class="flex justify-between text-xs font-label uppercase tracking-widest text-outline font-bold">
                    <label>${dim}</label>
                    <span id="${targetId}">${score}</span>
                </div>
                <input type="range" id="slider-wheel-${idx}" data-dim="${dim}" data-target="${targetId}" min="1" max="100" value="${score}" class="w-full accent-primary" oninput="window.app.updateDimensionVisual(this.getAttribute('data-dim'), this.value); const target=document.getElementById(this.getAttribute('data-target')); if(target) target.textContent = this.value;" style="touch-action: none; overscroll-behavior: contain;">
            </div>`;
        });

        container.innerHTML = html;
        const modal = document.getElementById('wheel-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeWheelModal: function() {
        const modal = document.getElementById('wheel-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    saveWheel: function() {
        const state = window.sistemaVidaState;
        this.normalizeDimensionsState();
        const container = document.getElementById('wheel-sliders-container');
        if (container) {
            const ranges = container.querySelectorAll('input[type="range"]');
            ranges.forEach(range => {
                const dim = this.normalizeDimensionKey(range.getAttribute('data-dim') || '');
                if (dim) {
                    if (!state.dimensions[dim]) state.dimensions[dim] = { score: 1 };
                    state.dimensions[dim].score = Math.max(1, Math.min(100, parseInt(range.value, 10) || 1));
                }
            });
        }

        this.updateWheelPolygon();
        this.recordWellbeingSnapshot('wheel');
        this.markCadence('wheel');
        this.saveState(false);
        this.closeWheelModal();
        if (this.currentView === 'proposito' && this.render.proposito) this.render.proposito();
        if (this.render.painel) this.render.painel();
    },

    migrateOverdueTasks: function() {
        const state = window.sistemaVidaState;
        const todayStr = this.getLocalDateKey();
        let count = 0;

        (state.entities.micros || []).forEach(m => {
            if (m.status !== 'done' && m.prazo && m.prazo < todayStr) {
                m.prazo = todayStr;
                count++;
            }
        });

        if (count > 0) {
            this.saveState(false);
            this.showToast(`${count} tarefas migradas para hoje!`, 'success');
            if (this.render.hoje) this.render.hoje();
        }
    },

    /**
     * Adia uma Micro Ação para o dia seguinte.
     * Move o inicioDate para amanhã (removendo do "Hoje"). Se o prazo ficar
     * anterior ao novo início, empurra o prazo junto para manter a janela válida.
     */
    postponeMicroOneDay: function(id) {
        const state = window.sistemaVidaState;
        const micro = (state.entities.micros || []).find(m => m.id === id);
        if (!micro) {
            this.showToast('Micro ação não encontrada para adiar.', 'error');
            return;
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = this.getLocalDateKey(tomorrow);

        micro.inicioDate = tomorrowStr;
        if (!micro.prazo || micro.prazo < tomorrowStr) {
            micro.prazo = tomorrowStr;
        }

        this.saveState(false);
        this.showToast('Micro adiada para amanhã', 'success');
        if (this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
    },

    setFocusTypeFilter: function(type) {
      const normalizedType = type === 'Macro' ? 'Macros' : (type === 'Micro' ? 'Micros' : type);
      this.focusTypeFilter = normalizedType;
      if (this.currentView === 'foco') this.render.foco();
      if (this.currentView === 'painel') this.render.painel();
    },

    setFocusStatusFilter: function(status) {
      this.focusStatusFilter = status;
      if (this.currentView === 'foco') this.render.foco();
      if (this.currentView === 'painel') this.render.painel();
      if (this.currentView === 'hoje') this.render.hoje();
    },

    setFocusDistributionViewMode: function(mode) {
      const next = 'one_line';
      this.focusDistributionViewMode = next;
      try { localStorage.setItem('lifeos_focus_distribution_view_mode', next); } catch (_) {}
      if (this.currentView === 'foco') this.render.foco();
      if (this.currentView === 'painel') this.render.painel();
      if (this.currentView === 'hoje') this.render.hoje();
    },

    resetWheelOfLife: function() {
        const confirmReset = confirm("Isso iniciará um novo ciclo da Roda da Vida, zerando as notas atuais para reavaliação. Deseja continuar?");
        if (confirmReset) {
            const state = window.sistemaVidaState;
            // Salva snapshot (simplificado para histórico)
            if (!state.history) state.history = {};
            state.history['roda_' + Date.now()] = JSON.parse(JSON.stringify(state.dimensions));
            
            // Zera as notas
            for (const dim in state.dimensions) {
                state.dimensions[dim].score = 1; 
            }
            
            this.saveState(false);
            this.showNotification("Roda da Vida zerada. Ajuste os sliders para o seu estado atual.");
            if (this.render.proposito) this.render.proposito();
            
            // Rola a página suavemente para os sliders
            setTimeout(() => {
                const sliders = document.getElementById('roda-sliders');
                if (sliders) sliders.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    },

    promoteEntity: function() {
        const entity = this.currentReviewEntity;
        const type = this.currentReviewType;
        if (!entity || type === 'metas') return;

        const state = window.sistemaVidaState;
        const confirmPromote = confirm(`Deseja promover "${entity.title}" para o próximo nível? Isto criará uma nova entidade superior e removerá a atual.`);
        if (!confirmPromote) return;

        let newType = '';
        let newObj = { ...entity, id: 'ent_' + Date.now() + '_promoted' };
        
        // Remove IDs de hierarquia que podem não fazer sentido no novo nível
        if (type === 'micros') {
            newType = 'macros';
            delete newObj.status;
            delete newObj.completed;
            newObj.description = entity.indicator || '';
            newObj.progress = 0;
            // Mantém metaId e okrId
        } else if (type === 'macros') {
            newType = 'okrs';
            newObj.purpose = entity.description || '';
            newObj.progress = entity.progress || 0;
            // Mantém metaId
        } else if (type === 'okrs') {
            newType = 'metas';
            newObj.purpose = entity.purpose || '';
            newObj.progress = entity.progress || 0;
            delete newObj.metaId;
        }

        // Adiciona ao novo nível
        if (!state.entities[newType]) state.entities[newType] = [];
        state.entities[newType].push(newObj);

        // Remove do nível antigo
        const oldList = state.entities[type];
        const idx = oldList.findIndex(e => e.id === entity.id);
        if (idx !== -1) oldList.splice(idx, 1);

        this.saveState(true);
        document.getElementById('review-entity-modal').classList.add('hidden');
        this.showToast(`Entidade promovida para ${newType.toUpperCase()}!`, 'success');

        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
    },

    reassignEntity: function() {
        const entity = this.currentReviewEntity;
        const type = this.currentReviewType;
        const newParentId = document.getElementById('reassign-parent-select').value;
        if (!entity || !newParentId) return;

        const state = window.sistemaVidaState;
        
        if (type === 'okrs') {
            entity.metaId = newParentId;
        } else if (type === 'macros') {
            entity.okrId = newParentId;
            const okr = state.entities.okrs.find(o => o.id === newParentId);
            if (okr) entity.metaId = okr.metaId;
        } else if (type === 'micros') {
            entity.macroId = newParentId;
            const macro = state.entities.macros.find(m => m.id === newParentId);
            if (macro) {
                entity.okrId = macro.okrId;
                entity.metaId = macro.metaId;
            }
        }

        this.saveState(true);
        document.getElementById('review-entity-modal').classList.add('hidden');
        this.showToast('Hierarquia atualizada com sucesso!', 'success');

        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
    },

    deleteEntityFromReview: function() {
        const entity = this.currentReviewEntity;
        const type = this.currentReviewType;
        if (!entity) return;

        if (confirm(`Tem certeza que deseja excluir "${entity.title}"?`)) {
            const list = type === 'habits' ? window.sistemaVidaState.habits : window.sistemaVidaState.entities[type];
            const idx = list.findIndex(e => e.id === entity.id);
            if (idx !== -1) {
                list.splice(idx, 1);
                this.saveState(true);
                document.getElementById('review-entity-modal').classList.add('hidden');
                this.showToast('Entidade excluída.', 'success');
                if (this.currentView && this.render[this.currentView]) this.render[this.currentView]();
            }
        }
    },

    saveDailyLog: function() {
        const gratidao = document.getElementById('diario-gratidao') ? document.getElementById('diario-gratidao').value : '';
        const funcionou = document.getElementById('diario-funcionou') ? document.getElementById('diario-funcionou').value : '';
        const s1 = document.getElementById('diario-shutdown-1') ? document.getElementById('diario-shutdown-1').value : '';

        // Ajuste de Fuso Horário para a data local real
        const d = new Date();
        const today = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        if (!window.sistemaVidaState.dailyLogs) window.sistemaVidaState.dailyLogs = {};
        
        window.sistemaVidaState.dailyLogs[today] = { 
            ...window.sistemaVidaState.dailyLogs[today],
            gratidao, 
            funcionou, 
            shutdown: [s1],
            energy: window.sistemaVidaState.energy || 0
        };

        const focoInput = document.getElementById('diario-foco');
        if (focoInput) window.sistemaVidaState.dailyLogs[today].focus = focoInput.value.trim();

        const dimensionNotes = {};
        document.querySelectorAll('[data-dim-note]').forEach(ta => {
            const dim = ta.getAttribute('data-dim-note');
            if (ta.value.trim()) dimensionNotes[dim] = ta.value.trim();
        });
        window.sistemaVidaState.dailyLogs[today].dimensionNotes = dimensionNotes;

        const hasDiary = !!(gratidao.trim() || funcionou.trim());
        const hasShutdown = !!(s1.trim() || Object.keys(dimensionNotes).length);
        if (hasDiary) this.markCadence('diary', today);
        if (hasShutdown) this.markCadence('shutdown', today);
        const diaryAward = hasDiary
            ? this.awardGamification('daily_diary', { key: `daily_diary:${today}`, date: today })
            : null;
        const shutdownAward = hasShutdown
            ? this.awardGamification('daily_shutdown', { key: `daily_shutdown:${today}`, date: today })
            : null;
        this.saveState(true);

        const btn = document.getElementById('btn-salvar-diario');
        if (btn) {
            const originalText = btn.innerHTML;
            const xpEarned = (diaryAward?.xp || 0) + (shutdownAward?.xp || 0);
            this.showGamificationBatchEffects([diaryAward, shutdownAward], xpEarned);
            btn.innerHTML = xpEarned ? `Salvo! +${xpEarned} XP` : "Salvo!";
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        }
    },

    // ------------------------------------------------------------------------
    // Onboarding Experience Logic
    // ------------------------------------------------------------------------
    formatPrazoDisplay: function(entity) {
        if (entity.agendamento) {
            const { ciclo, mes, semana, inicio } = entity.agendamento;
            let text = "";
            if (ciclo) text += `Ciclo ${ciclo}`;
            if (mes) text += (text ? " • " : "") + `Mês ${mes}`;
            if (semana) text += (text ? " • " : "") + `Sem. ${semana}`;
            if (inicio) text += (text ? " • " : "") + `Início: Sem. ${inicio}`;
            
            return `
                <div class="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    <span class="material-symbols-outlined notranslate text-[12px]">calendar_today</span>
                    <span>${text}</span>
                </div>
            `;
        }
        return `<span>${entity.prazo || 'Sem prazo'}</span>`;
    },

    toggleGamificationDimensionTrail: function(dimension) {
        if (!this._gamificationExpandedTrails || typeof this._gamificationExpandedTrails !== 'object') {
            this._gamificationExpandedTrails = {};
        }
        this._gamificationExpandedTrails[dimension] = !this._gamificationExpandedTrails[dimension];
        this.renderGamificationProfile();
    },
    toggleGamificationOverallTrail: function() {
        this._gamificationExpandedOverallTrail = !this._gamificationExpandedOverallTrail;
        this.renderGamificationProfile();
    },
    toggleGamificationRules: function() {
        const wrap = document.getElementById('gamification-rules-wrap');
        const chevron = document.getElementById('gamification-rules-chevron');
        if (!wrap) return;
        const willOpen = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', !willOpen);
        if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : '';
    },

    cascadeStartUp: function(microId) {
        const state = window.sistemaVidaState;
        const micro = (state.entities?.micros || []).find(m => m.id === microId);
        if (!micro) return;
        const macro = (state.entities.macros || []).find(m => m.id === micro.macroId);
        if (macro && macro.status === 'pending') macro.status = 'in_progress';
        const okr = macro ? (state.entities.okrs || []).find(o => o.id === macro.okrId) : null;
        if (okr && okr.status === 'pending') okr.status = 'in_progress';
        const meta = okr ? (state.entities.metas || []).find(m => m.id === okr.metaId) : null;
        if (meta && meta.status === 'pending') meta.status = 'in_progress';
    },

    // Inicia uma micro ação manualmente (botão Iniciar / Foco). Macro/OKR/Meta NÃO são
    // iniciados manualmente — eles cascateiam a partir das micros via cascadeStartUp.
    startEntity: function(id, type) {
        const state = window.sistemaVidaState;
        if (type !== 'micros') {
            // Caminho legado: ignora silenciosamente para macros/okrs/metas.
            // O fluxo correto é iniciar a partir da micro filha.
            console.warn(`[startEntity] type='${type}' não é mais suportado. Use cascade via micro.`);
            return;
        }
        const entity = (state.entities.micros || []).find(e => e.id === id);
        if (!entity) {
            this.showToast('Item não encontrado. Atualize a tela e tente novamente.', 'error');
            return;
        }
        if (entity.status === 'done') {
            this.showToast('Esta micro já está concluída. Reabra antes de iniciar novamente.', 'error');
            return;
        }
        entity.status = 'in_progress';
        entity.completed = false;
        // Micro tem progresso binário: 0 (não-done) ou 100 (done). Início não muda progress.
        this.cascadeStartUp(entity.id);
        this.saveState(false);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
    },

    startMicroAction: function(id) {
        this.startEntity(id, 'micros');
    },

    cascadeStatusDown: function(parentId, parentType, newStatus) {
        const state = window.sistemaVidaState;
        const updateChild = (child, type) => {
            if (child.status !== 'done') {
                child.status = newStatus;
                if (newStatus === 'done') child.progress = 100;
                if (type === 'micros') child.completed = (newStatus === 'done');
                this.cascadeStatusDown(child.id, type, newStatus);
            }
        };
        if (parentType === 'metas') (state.entities.okrs || []).filter(o => o.metaId === parentId).forEach(c => updateChild(c, 'okrs'));
        else if (parentType === 'okrs') (state.entities.macros || []).filter(m => m.okrId === parentId).forEach(c => updateChild(c, 'macros'));
        else if (parentType === 'macros') (state.entities.micros || []).filter(m => m.macroId === parentId).forEach(c => updateChild(c, 'micros'));
    },

    forceCompleteEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const item = state.entities[type].find(e => e.id === id);
        if (!item) return;
        const currentProgress = Number(item.progress) || 0;
        const isAtFullProgress = currentProgress >= 100;
        // Texto adaptado: 100% = simples confirmação; < 100% = aviso de força.
        const message = isAtFullProgress
            ? 'Todas as filhas estão concluídas. Deseja fechar este item?'
            : `Este item está em ${currentProgress}%. Concluir agora vai marcar todas as filhas pendentes como concluídas. Confirmar?`;
        if (!confirm(message)) return;
        item.progress = 100;
        item.status = 'done';
        if (type === 'micros') item.completed = true;
        this.updateCascadeProgress(id, type); // recálculo bottom-up dos pais
        // Top-down só faz sentido quando força (< 100%); a 100% as filhas já estão done.
        if (!isAtFullProgress) this.cascadeStatusDown(id, type, 'done');
        this.saveState(false);
        if (this.render.planos) this.render.planos();
        if (this.render.painel) this.render.painel();
    },

    duplicateEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const list = type === 'habits' ? (state.habits || []) : ((state.entities && state.entities[type]) || []);
        const source = list.find(e => e.id === id);
        if (!source) return;
        const clone = JSON.parse(JSON.stringify(source));
        clone.id = 'ent_' + Date.now() + Math.random().toString(36).substr(2, 5);
        clone.title = `${source.title} (cópia)`;

        if (type === 'micros') {
            clone.status = 'pending';
            clone.completed = false;
            clone.progress = 0;
            delete clone.completedDate;
        } else if (type === 'macros' || type === 'okrs' || type === 'metas') {
            if (clone.status === 'abandoned') clone.status = 'pending';
            if (!Number.isFinite(Number(clone.progress))) clone.progress = 0;
        } else if (type === 'habits') {
            clone.completed = false;
            clone.logs = {};
            clone.stepLogs = {};
            clone.maturity = 'forming';
            clone.maturityMeta = {};
        }
        if (['metas', 'okrs', 'macros', 'micros'].includes(type)) {
            clone.createdAt = this.getLocalDateKey();
        }

        list.push(clone);
        if (['metas', 'okrs', 'macros', 'micros'].includes(type)) {
            this.updateCascadeProgress(clone.id, type);
        }
        this.saveState(true);
        this.showToast('Card duplicado com sucesso.', 'success');
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
    },

    deleteEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const list = type === 'habits' ? state.habits : state.entities[type];
        const item = list.find(e => e.id === id);
        
        if (item && confirm(`Deseja realmente excluir "${item.title}"?`)) {
            // Recalcula a hierarquia antes da remoção definitiva, tratando o item como excluído.
            // Assim, os percentuais dos pais são atualizados sem depender de IDs já removidos.
            if (type !== 'habits' && ['micros', 'macros', 'okrs', 'metas'].includes(type)) {
                item.status = 'abandoned';
                item.progress = 0;
                this.updateCascadeProgress(item.id, type);
            }

            if (type === 'habits') {
                state.habits = state.habits.filter(e => e.id !== id);
            } else {
                state.entities[type] = state.entities[type].filter(e => e.id !== id);
            }

            this.saveState(true); // Silencioso (rotina administrativa)
            if (this.showToast) this.showToast('Item removido com sucesso.', 'success');
            
            this.switchView(this.currentView); // Refresh
        }
    },

    updateDimensionVisual: function(dim, score) {
        this.normalizeDimensionsState();
        const canonicalDim = this.normalizeDimensionKey(dim || '');
        if (!canonicalDim) return;
        if (!window.sistemaVidaState.dimensions[canonicalDim]) window.sistemaVidaState.dimensions[canonicalDim] = { score: 1 };
        window.sistemaVidaState.dimensions[canonicalDim].score = Math.max(1, Math.min(100, parseInt(score, 10) || 1));
        this.updateWheelPolygon();
    },

    exportStateJson: function() {
        const state = this.getPersistableState('full');
        const ts = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-os-backup-${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup JSON exportado.', 'success');
    },

    importStateJson: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed || typeof parsed !== 'object' || !parsed.entities || !parsed.profile) {
                    this.showToast('Arquivo inválido — estrutura não reconhecida.', 'error');
                    return;
                }
                if (!confirm('Isso vai substituir todos os seus dados pelo conteúdo do arquivo. Continuar?')) return;
                Object.assign(window.sistemaVidaState, parsed);
                await this.saveState(true);
                this.showToast('Dados importados com sucesso.', 'success');
                if (this.currentView) this.render[this.currentView]?.();
            } catch (err) {
                this.showToast('Erro ao ler o arquivo JSON.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    updateNavUI: function(activeView) {
        document.querySelectorAll('.nav-item-link').forEach(btn => {
            const icon = btn.querySelector('.material-symbols-outlined.notranslate');
            const iconWrap = icon ? icon.parentElement : null;
            const label = btn.querySelector('span:last-child');
            const view = btn.getAttribute('data-view') || btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            btn.setAttribute('data-active', view === activeView ? 'true' : 'false');

            if (view === activeView) {
                btn.classList.add('text-primary', 'font-bold');
                btn.classList.remove('text-on-surface-variant');
                if (iconWrap) {
                    iconWrap.classList.add('bg-primary-container/60', 'text-on-primary-container');
                    iconWrap.classList.remove('hover:bg-primary-container/30');
                }
                if (label) {
                    label.classList.add('text-primary');
                    label.classList.remove('text-outline');
                }
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                btn.classList.remove('text-primary', 'font-bold');
                btn.classList.add('text-on-surface-variant');
                if (iconWrap) {
                    iconWrap.classList.remove('bg-primary-container/60', 'text-on-primary-container');
                    iconWrap.classList.add('hover:bg-primary-container/30');
                }
                if (label) {
                    label.classList.remove('text-primary');
                    label.classList.add('text-outline');
                }
                if (icon) icon.style.fontVariationSettings = "'FILL' 0";
            }
        });
    },

    executeInjectedScripts: function(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    },

    getFallbackTemplate: function(viewName) {
        return `<div class="p-6 mt-10 text-red-500 font-bold">Erro local de CORS: view '${viewName}' não pôde ser carregada via protocolo file. Use um servidor local.</div>`;
    },

    ensureDeepWorkTicking: function() {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        if (!dw.isRunning || dw.isPaused) {
            this.stopDeepWorkTicking();
            return;
        }
        if (this._deepWorkTimerId) return;
        this._deepWorkTimerId = setInterval(() => this.tickDeepWork(), 1000);
    },

    stopDeepWorkTicking: function() {
        if (this._deepWorkTimerId) {
            clearInterval(this._deepWorkTimerId);
            this._deepWorkTimerId = null;
        }
    },

    tickDeepWork: function() {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        if (!dw.isRunning || dw.isPaused) {
            this.stopDeepWorkTicking();
            return;
        }
        const nowMs = Date.now();
        const last = Number(dw.lastTickAt) || nowMs;
        const elapsed = Math.max(1, Math.floor((nowMs - last) / 1000));
        dw.lastTickAt = nowMs;
        dw.remainingSec = Math.max(0, dw.remainingSec - elapsed);

        if (dw.remainingSec <= 0) {
            this.onDeepWorkCountdownEnd();
        } else if (this.currentView === 'foco') {
            this.renderDeepWorkPanel();
        }
    },

    onDeepWorkCountdownEnd: function() {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;
        if (dw.mode === 'focus') {
            const manualFocusSec = Number(dw.completedFocusSec);
            const focusSec = Number.isFinite(manualFocusSec) && manualFocusSec > 0 ? manualFocusSec : dw.targetSec;
            delete dw.completedFocusSec;
            const dateKey = this.getLocalDateKey();
            const linkedMicro = dw.microId ? (state.entities.micros || []).find(m => m.id === dw.microId) : null;
            if (linkedMicro && linkedMicro.status !== 'done') {
                const wasNotInProgress = linkedMicro.status !== 'in_progress';
                linkedMicro.status = 'in_progress';
                linkedMicro.completed = false;
                linkedMicro.focusSec = Math.max(0, Number(linkedMicro.focusSec) || 0) + focusSec;
                linkedMicro.focusSessions = Math.max(0, Number(linkedMicro.focusSessions) || 0) + 1;
                linkedMicro.lastFocusDate = dateKey;
                if (wasNotInProgress) this.cascadeStartUp(linkedMicro.id);
            }
            const endedAtTs = new Date().toISOString();
            dw.sessions.unshift({
                endedAt: dateKey,
                endedAtTs,
                focusSec: focusSec,
                mode: 'focus',
                microId: dw.microId || '',
                intention: dw.intention || ''
            });
            const award = this.awardGamification('deep_work', {
                key: `deep:${endedAtTs}`,
                id: endedAtTs,
                title: linkedMicro?.title || dw.intention || 'Foco profundo',
                dimension: linkedMicro?.dimension || '',
                focusSec
            });
            this.showGamificationToast(award);
            dw.sessions = dw.sessions.slice(0, 50);
            dw.mode = 'break';
            dw.remainingSec = dw.breakSec;
            dw.lastTickAt = Date.now();
            if (this.showNotification) this.showNotification('Bloco de foco concluído. Iniciando pausa de 20 minutos. Use "Concluir micro" para fechar a ação.');
            this.saveState(true);
            this.ensureDeepWorkTicking();
            if (this.currentView === 'foco' && this.render.foco) this.render.foco();
            return;
        }

        dw.isRunning = false;
        dw.isPaused = false;
        dw.mode = 'focus';
        dw.remainingSec = dw.targetSec;
        dw.lastTickAt = 0;
        this.stopDeepWorkTicking();
        this.saveState(true);
        if (this.showNotification) this.showNotification('Pausa concluída. Você está pronto para o próximo bloco.');
        if (this.currentView === 'foco') this.renderDeepWorkPanel();
    },

    startDeepWorkSession: function() {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;
        if (dw.isRunning && !dw.isPaused) return;

        const presetEl = document.getElementById('deep-work-preset');
        const microEl = document.getElementById('deep-work-micro');
        const intentionEl = document.getElementById('deep-work-intention');
        const minutes = Math.max(5, Math.round(Number(presetEl?.value || 90)));
        const chosenMicro = microEl?.value || '';
        const intention = (intentionEl?.value || '').trim();
        if (!chosenMicro) {
            this.showToast('Selecione uma micro ação de Planos para iniciar o foco.', 'error');
            return;
        }

        if (!dw.isRunning || dw.mode !== 'focus') {
            dw.targetSec = minutes * 60;
            dw.remainingSec = dw.targetSec;
            dw.mode = 'focus';
        }
        dw.microId = chosenMicro;
        dw.intention = intention;
        dw.isRunning = true;
        dw.isPaused = false;
        dw.lastTickAt = Date.now();

        if (chosenMicro) {
            const micro = (state.entities.micros || []).find(m => m.id === chosenMicro);
            if (micro && micro.status !== 'done') {
                const wasNotInProgress = micro.status !== 'in_progress';
                micro.status = 'in_progress';
                micro.completed = false;
                if (wasNotInProgress) this.cascadeStartUp(micro.id);
            }
        }

        this.ensureDeepWorkTicking();
        if (this.currentView === 'foco' && this.render.foco) this.render.foco();
        else this.renderDeepWorkPanel();
        this.saveState(true);
    },
    startDeepWorkForMicro: function(microId) {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const micro = this.getPlanMicros({ includeDone: false }).find(m => m.id === microId);
        if (!micro) {
            this.showToast('Micro ação indisponível para foco. Verifique se ela ainda está ativa.', 'error');
            return;
        }
        if (micro.status === 'done') {
            this.showToast('Esta micro já está concluída. Reabra antes de iniciar foco.', 'error');
            return;
        }
        const dw = state.deepWork;
        if (dw.isRunning) {
            this.showToast('Já existe um bloco de foco em andamento.', 'error');
            return;
        }
        dw.microId = micro.id;
        dw.intention = micro.title || '';
        const microEl = document.getElementById('deep-work-micro');
        const intentionEl = document.getElementById('deep-work-intention');
        if (microEl) microEl.value = micro.id;
        if (intentionEl) intentionEl.value = micro.title || '';
        this.startDeepWorkSession();
        const panel = document.getElementById('deep-work-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    openMicroInFocus: function(microId, autoStart = false) {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const micro = this.getPlanMicros({ includeDone: false }).find(m => m.id === microId);
        if (!micro) {
            this.showToast('Micro ação indisponível para foco. Verifique se ela ainda está ativa.', 'error');
            return;
        }
        if (micro.status === 'done') {
            this.showToast('Esta micro já está concluída. Reabra antes de gerenciar no foco.', 'error');
            return;
        }
        const dw = state.deepWork;
        if (dw.isRunning && dw.microId && dw.microId !== micro.id) {
            this.showToast('Finalize ou pause o bloco atual antes de trocar de micro ação.', 'error');
            this.navigate('foco');
            return;
        }

        dw.microId = micro.id;
        dw.intention = micro.title || '';
        if (autoStart && micro.status !== 'done') {
            const sourceMicro = (state.entities?.micros || []).find(m => m.id === micro.id);
            const targetMicro = sourceMicro || micro;
            const wasNotInProgress = targetMicro.status !== 'in_progress';
            targetMicro.status = 'in_progress';
            targetMicro.completed = false;
            if (wasNotInProgress && sourceMicro) this.cascadeStartUp(sourceMicro.id);
        }
        this.pendingFocusMicroId = micro.id;
        this.pendingFocusAutoStart = !!autoStart;
        this.navigate('foco');
    },

    selectDeepWorkMicro: function(microId) {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;
        if (dw.isRunning) return;
        const micro = this.getPlanMicros({ includeDone: false }).find(m => m.id === microId);
        dw.microId = micro ? micro.id : '';
        if (micro) {
            dw.intention = micro.title || '';
            const intentionEl = document.getElementById('deep-work-intention');
            if (intentionEl) intentionEl.value = dw.intention;
        } else {
            dw.intention = '';
            const intentionEl = document.getElementById('deep-work-intention');
            if (intentionEl) intentionEl.value = '';
        }
        this.renderDeepWorkPanel();
    },

    setDeepWorkPreset: function(minutes) {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        if (dw.isRunning) return;
        const safeMinutes = Math.max(5, Math.round(Number(minutes) || 90));
        const presetEl = document.getElementById('deep-work-preset');
        if (presetEl) presetEl.value = String(safeMinutes);
        dw.targetSec = safeMinutes * 60;
        dw.remainingSec = dw.targetSec;
        this.renderDeepWorkPanel();
    },

    setDeepWorkClockStyle: function(style) {
        this.ensureSettingsState();
        const safeStyle = ['classic', 'ring', 'tree'].includes(style) ? style : 'classic';
        window.sistemaVidaState.settings.deepWorkClockStyle = safeStyle;
        this.stopDeepWorkClockPreview();
        this.renderDeepWorkPanel();
        this.saveState(true);
    },

    stopDeepWorkClockPreview: function() {
        if (this._deepWorkClockPreviewTimer) {
            clearInterval(this._deepWorkClockPreviewTimer);
            this._deepWorkClockPreviewTimer = null;
        }
        this._deepWorkClockPreviewActive = false;
        const previewBtn = document.getElementById('deep-work-clock-preview-btn');
        if (previewBtn) {
            previewBtn.textContent = 'Preview';
            previewBtn.disabled = false;
            previewBtn.classList.remove('bg-primary', 'text-on-primary');
        }
    },

    previewDeepWorkClock: function() {
        this.normalizeDeepWorkState();
        this.ensureSettingsState();
        if (this._deepWorkClockPreviewActive) {
            this.stopDeepWorkClockPreview();
            this.renderDeepWorkPanel();
            return;
        }
        const state = window.sistemaVidaState;
        const dw = state.deepWork;
        const style = ['classic', 'ring', 'tree'].includes(state.settings?.deepWorkClockStyle)
            ? state.settings.deepWorkClockStyle
            : 'classic';
        const previewBtn = document.getElementById('deep-work-clock-preview-btn');
        if (previewBtn) {
            previewBtn.textContent = 'Preview...';
            previewBtn.disabled = true;
            previewBtn.classList.add('bg-primary', 'text-on-primary');
        }
        this._deepWorkClockPreviewActive = true;
        const durationMs = 9000;
        const startedAt = Date.now();
        const renderFrame = () => {
            const elapsed = Date.now() - startedAt;
            const progress = Math.max(0, Math.min(1, elapsed / durationMs));
            const phaseBreak = progress > 0.78;
            const visual = document.getElementById('deep-work-clock-visual');
            if (!visual || !this._deepWorkClockPreviewActive) {
                this.stopDeepWorkClockPreview();
                return;
            }
            const fakeRemaining = Math.max(0, Math.round((1 - progress) * (dw.targetSec || 5400)));
            visual.outerHTML = `<div id="deep-work-clock-visual">${this.renderDeepWorkClockVisual({
                style,
                timeText: this.formatClock(fakeRemaining),
                phaseText: phaseBreak ? 'Pausa' : 'Preview',
                mode: phaseBreak ? 'break' : 'focus',
                isRunning: true,
                isPaused: false,
                progress,
                hasSelectedMicro: true,
                canCompleteSelectedMicro: progress > 0.92
            })}</div>`;
            if (progress >= 1) {
                this.stopDeepWorkClockPreview();
                this.renderDeepWorkPanel();
            }
        };
        renderFrame();
        this._deepWorkClockPreviewTimer = setInterval(renderFrame, 120);
    },

    toggleDeepWorkPause: function() {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        if (!dw.isRunning) return;
        dw.isPaused = !dw.isPaused;
        dw.lastTickAt = Date.now();
        if (dw.isPaused) this.stopDeepWorkTicking();
        else this.ensureDeepWorkTicking();
        this.renderDeepWorkPanel();
        this.saveState(true);
    },

    resetDeepWorkSession: function() {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        dw.isRunning = false;
        dw.isPaused = false;
        dw.mode = 'focus';
        dw.remainingSec = dw.targetSec || 5400;
        dw.lastTickAt = 0;
        this.stopDeepWorkTicking();
        this.renderDeepWorkPanel();
        this.saveState(true);
    },

    finishDeepWorkNow: function() {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const linkedMicro = state.deepWork?.microId ? (state.entities?.micros || []).find(m => m.id === state.deepWork.microId) : null;
        const canCompleteLinkedMicro = !!(linkedMicro && linkedMicro.status !== 'done');
        const dw = window.sistemaVidaState.deepWork;
        if (!dw.isRunning) {
            if (canCompleteLinkedMicro) {
                this.completeMicroAction(linkedMicro.id);
                if (this.showNotification) this.showNotification('Micro ação concluída.');
            }
            return;
        }
        if (dw.mode === 'focus') {
            dw.completedFocusSec = Math.max(60, Math.round((Number(dw.targetSec) || 0) - (Number(dw.remainingSec) || 0)));
            dw.remainingSec = 0;
            this.onDeepWorkCountdownEnd();
            return;
        }

        // Se está na pausa, o botão "Finalizar" também pode concluir a micro vinculada.
        dw.isRunning = false;
        dw.isPaused = false;
        dw.mode = 'focus';
        dw.remainingSec = dw.targetSec || 5400;
        dw.lastTickAt = 0;
        this.stopDeepWorkTicking();
        this.saveState(true);

        if (canCompleteLinkedMicro) {
            this.completeMicroAction(linkedMicro.id);
            if (this.showNotification) this.showNotification('Sessão encerrada e micro concluída.');
            return;
        }

        if (this.showNotification) this.showNotification('Pausa encerrada.');
        if (this.currentView === 'foco') this.renderDeepWorkPanel();
    },

    skipBreak: function() {
        this.normalizeDeepWorkState();
        const dw = window.sistemaVidaState.deepWork;
        if (!dw || !dw.isRunning || dw.mode !== 'break') return;
        dw.isRunning = false;
        dw.isPaused = false;
        dw.mode = 'focus';
        dw.remainingSec = dw.targetSec || 5400;
        dw.lastTickAt = 0;
        this.stopDeepWorkTicking();
        this.saveState(true);
        if (this.showNotification) this.showNotification('Descanso pulado. Pronto para nova sessão.');
        if (this.currentView === 'foco') this.renderDeepWorkPanel();
    },

    openSwlsModal: function() {
        this.normalizeSwlsState();
        const swls = window.sistemaVidaState.swls;
        for (let i = 1; i <= 5; i++) {
            const slider = document.getElementById(`swls-q${i}`);
            const valueEl = document.getElementById(`swls-q${i}-val`);
            const answer = this.normalizeSwlsAnswer(swls.answers[i - 1]);
            if (slider) slider.value = String(answer);
            if (valueEl) valueEl.textContent = String(answer);
        }
        const modal = document.getElementById('swls-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeSwlsModal: function() {
        const modal = document.getElementById('swls-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    saveSwls: function() {
        this.normalizeSwlsState();
        const state = window.sistemaVidaState;
        const answers = [];
        for (let i = 1; i <= 5; i++) {
            const slider = document.getElementById(`swls-q${i}`);
            answers.push(this.normalizeSwlsAnswer(slider ? slider.value : 4));
        }
        const score = answers.reduce((sum, n) => sum + n, 0);
        const dateKey = this.getLocalDateKey();
        state.swls.answers = answers;
        state.swls.lastScore = score;
        state.swls.lastDate = dateKey;
        if (!state.swls.history || typeof state.swls.history !== 'object') state.swls.history = {};
        state.swls.history[dateKey] = { score, answers: [...answers] };

        this.markCadence('swls', dateKey);
        this.saveState(true);
        this.closeSwlsModal();
        if (this.currentView === 'proposito' && this.render.proposito) this.render.proposito();
        this.showNotification(`SWLS atualizado: ${score}/35 (${this.getSwlsBand(score)}).`);
    },

    openPermaModal: function() {
        const state = window.sistemaVidaState;
        const perma = state.perma || {P:0, E:0, R:0, M:0, A:0};
        
        // Tarefa 2: Sincronização Total e Explícita (Sliders + Labels)
        const keys = ['P', 'E', 'R', 'M', 'A'];
        keys.forEach(k => {
            const id = k.toLowerCase();
            const slider = document.getElementById(`${id}-slider`);
            const label = document.getElementById(`val-${id}`);
            const normalized = this.normalizePermaScore(perma[k]);
            if (slider) slider.value = String(normalized);
            if (label) label.textContent = normalized.toFixed(1);
        });

        const modal = document.getElementById('perma-modal') || document.querySelector('[id*="perma-modal"]');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closePermaModal: function() {
        const modal = document.getElementById('perma-modal') || document.querySelector('[id*="perma-modal"]');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    savePerma: function() {
        const state = window.sistemaVidaState;
        if (!state.perma) state.perma = {P:0, E:0, R:0, M:0, A:0};

        // Salva lendo explicitamente os sliders
        const keys = ['P', 'E', 'R', 'M', 'A'];
        keys.forEach(k => {
            const slider = document.getElementById(`${k.toLowerCase()}-slider`);
            if (slider) {
                state.perma[k] = this.normalizePermaScore(slider.value);
            }
        });

        // Tarefa 3: Persistência Explícita e Atualização Padronizada
        this.recordWellbeingSnapshot('perma');
        this.markCadence('perma');
        this.saveState(true);
        this.closePermaModal();
        this.switchView('proposito'); // Força re-render completo
        this.showNotification("Diagnóstico PERMA atualizado com sucesso!");
    },

    openOdysseyModal: function(id) {
        const state = window.sistemaVidaState;
        if (!state.profile.odyssey) state.profile.odyssey = {
            A: { title: "Cenário A", desc: "Foco em ascensão na carreira atual.", conf: 4, nrg: 4 },
            B: { title: "Cenário B", desc: "Transição para trabalho solo.", conf: 3, nrg: 5 },
            C: { title: "Cenário C", desc: "Doutorado e pesquisa.", conf: 2, nrg: 3 }
        };
        const plan = state.profile.odyssey[id];
        document.getElementById('odyssey-id').value = id;
        document.getElementById('odyssey-title').value = plan.title;
        document.getElementById('odyssey-desc').value = plan.desc;
        document.getElementById('odyssey-conf').value = plan.conf;
        document.getElementById('odyssey-nrg').value = plan.nrg;
        
        const modal = document.getElementById('odyssey-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    saveOdyssey: function() {
        const id = document.getElementById('odyssey-id').value;
        if (!window.sistemaVidaState.profile.odyssey) window.sistemaVidaState.profile.odyssey = {};
        
        window.sistemaVidaState.profile.odyssey[id] = {
            title: document.getElementById('odyssey-title').value,
            desc: document.getElementById('odyssey-desc').value,
            conf: parseInt(document.getElementById('odyssey-conf').value),
            nrg: parseInt(document.getElementById('odyssey-nrg').value)
        };
        this.markCadence('odyssey');
        this.saveState();
        const modal = document.getElementById('odyssey-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (this.render.proposito) this.render.proposito();
    },

    openProfileModal: function() {
        const state = window.sistemaVidaState;
        const nameInput = document.getElementById('profile-name-input');
        if (nameInput) {
            nameInput.value = state.profile.name || "";
        }
        
        const modal = document.getElementById('profile-edit-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeProfileModal: function() {
        const modal = document.getElementById('profile-edit-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    saveProfile: function() {
        const nameInput = document.getElementById('profile-name-input');
        if (nameInput) {
            const newName = nameInput.value.trim();
            window.sistemaVidaState.profile.name = newName;
            
            // Sync UI displays
            const dashName = document.getElementById('perfil-nome-display');
            if (dashName) dashName.textContent = newName;
        }
        
        this.saveState(true);
        
        const modal = document.getElementById('profile-edit-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        this.renderSidebarValues(); // Sync any changes to values or name
        if (this.render.perfil) this.render.perfil();
        this.showToast("Perfil atualizado com sucesso!", "success");
    }
};

// Phase 9 module attachments ??? extend app with extracted modules
attachSubjectiveScales(app);
attachHabitSuggestions(app);
attachNotifications(app);
attachCadence(app);
attachOnboarding(app);
attachIdentity(app);
attachHabits(app);
attachStateModule(app);
attachRenderModule(app);
attachPlanningModule(app);
attachGamificationModule(app);
attachSocial(app);

window.app = app;

onAuthStateChanged(auth, (user) => {
    app.lastAuthUserId = user?.uid || '';
    app.lastAuthIsAnonymous = !!user?.isAnonymous;
    if (user) setSignedOutIntentionally(false);
    if (app.currentView === 'perfil') {
        try { app.renderAccountPanel(); } catch (_) {}
    }
    try { app.renderProfileChrome(); } catch (_) {}
});

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});




