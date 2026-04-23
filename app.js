/**
 * Sistema Vida - Core OS
 * Vanilla JS Single Page Application Controller with Data Binding
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDXu7ddS77_deDezWQqrLd4Ww-MRVL1bgM",
    authDomain: "life-os-753f2.firebaseapp.com",
    projectId: "life-os-753f2",
    storageBucket: "life-os-753f2.firebasestorage.app",
    messagingSenderId: "339455340566",
    appId: "1:339455340566:web:976675a53891f365c48537"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const storage = getStorage(firebaseApp);
// getAuthReady() cria uma Promise fresca a cada chamada.
// Isso evita que uma falha de auth transitória (ex: rede lenta na abertura do app)
// deixe o authReady permanentemente rejeitado, bloqueando todos os saves futuros.
function getAuthReady() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) { unsub(); resolve(user); }
        }, (err) => { reject(err); });
        // Só chama signInAnonymously se ainda não há usuário
        if (!auth.currentUser) {
            signInAnonymously(auth).catch((err) => {
                // Não reject direto — o onAuthStateChanged vai tratar
                console.warn('[AUTH] signInAnonymously falhou, aguardando onAuthStateChanged:', err);
            });
        }
    });
}
// authReady: mantido para compatibilidade com onSnapshot (que precisa de uma promise inicial)
const authReady = getAuthReady();

window.sistemaVidaState = {
    profile: {
        name: "Bruno",
        level: 1,
        xp: 0,
        values: [],
        legacy: "",
        ikigai: { missao: "", vocacao: "", love: "", good: "", need: "", paid: "", sintese: "", sinteseResumo: "" },
        legacyObj: { familia: "", profissao: "", mundo: "", familiaResumo: "", profissaoResumo: "", mundoResumo: "" },
        vision: { saude: "", carreira: "", intelecto: "", quote: "", saudeResumo: "", carreiraResumo: "", intelectoResumo: "" },
        odyssey: { cenarioA: "", cenarioB: "", cenarioC: "" },
        odysseyImages: { cenarioA: "", cenarioB: "", cenarioC: "" }
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
    settings: {
        notificationsEnabled: false,
        theme: 'auto'
    },
    cycleStartDate: new Date(new Date(new Date().setDate(new Date().getDate() - 21)).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
    onboardingComplete: false
};

const app = {
    config: {
        containerId: 'app-content',
        viewsPath: 'views/',
    },
    getLocalDateKey: function(date = new Date()) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    },
    getSafeMonotonicTs: function() {
        const prev = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
        const now = Date.now();
        return Math.max(now, prev + 1);
    },
    persistLocalMirror: function() {
        try {
            localStorage.setItem('lifeos_state_backup', JSON.stringify(this.getPersistableState('full')));
        } catch (_) {}
        try {
            const completed = !!window.sistemaVidaState?.onboardingComplete;
            localStorage.setItem('lifeos_onboarding_complete', completed ? '1' : '0');
        } catch (_) {}
    },
    updateSyncBadge: function(state) {
        // state: 'ok' | 'error' | 'syncing' | 'offline'
        const labels = {
            ok:      { icon: 'cloud_done',    text: 'Sincronizado',     cls: 'text-green-500' },
            error:   { icon: 'cloud_off',     text: 'Falha na nuvem',   cls: 'text-red-400' },
            syncing: { icon: 'cloud_sync',    text: 'Sincronizando…',   cls: 'text-primary' },
            offline: { icon: 'cloud_off',     text: 'Modo local',       cls: 'text-yellow-400' },
        };
        const d = labels[state] || labels['ok'];
        document.querySelectorAll('.lifeos-sync-badge').forEach(el => {
            el.innerHTML = '<span class="material-symbols-outlined notranslate text-sm">' + d.icon + '</span>'
                         + '<span class="text-[10px] font-bold">' + d.text + '</span>';
            el.className = 'lifeos-sync-badge flex items-center gap-1 ' + d.cls;
        });
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
        if (txt.includes('saud')) return 'Saúde';
        if (txt.includes('ment') || txt.includes('pessoal')) return 'Mente';
        if (txt.includes('carre') || txt.includes('profiss') || txt.includes('trabalh')) return 'Carreira';
        if (txt.includes('finan')) return 'Finanças';
        if (txt.includes('relac')) return 'Relacionamentos';
        if (txt.includes('fam')) return 'Família';
        if (txt.includes('lazer')) return 'Lazer';
        if (txt.includes('propos') || txt.includes('contribu')) return 'Propósito';
        return '';
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
        const normalizedStatus = (rawStatus, progress, completedRaw = false) => {
            if (completedRaw || progress >= 100 || rawStatus === 'done') return 'done';
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
            const status = normalizedStatus(meta?.status, progress, meta?.completed);
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
            const status = normalizedStatus(okr?.status, progress, okr?.completed);
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
            const status = normalizedStatus(macro?.status, progress, macro?.completed);
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
            const status = normalizedStatus(micro?.status, progress, micro?.completed);
            return {
                ...micro,
                id: String(micro?.id || ''),
                title: String(micro?.title || micro?.nome || micro?.name || micro?.tarefa || '').trim(),
                dimension: String(micro?.dimension || micro?.dimensao || micro?.area || ''),
                progress: status === 'done' ? 100 : progress,
                status,
                completed: status === 'done'
            };
        }).filter((micro) => {
            const keep = micro.id && micro.title;
            if (!keep) console.warn('[normalizeEntitiesState] Micro removed - missing id or title:', micro);
            return keep;
        });
        if (beforeCount !== state.entities.micros.length) {
            console.log(`[normalizeEntitiesState] Micros filtered: ${beforeCount} → ${state.entities.micros.length}`);
        }
    },
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
            changed = true;
        }
        if (micro.completed) {
            micro.completed = false;
            changed = true;
        }
        if (!micro.progress || micro.progress < 1) {
            micro.progress = 1;
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
    ensureSettingsState: function() {
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
        if (typeof window.sistemaVidaState.profile.avatarUrl !== 'string') {
            window.sistemaVidaState.profile.avatarUrl = '';
        }
        if (!window.sistemaVidaState.profile.odysseyImages) {
            window.sistemaVidaState.profile.odysseyImages = { cenarioA: "", cenarioB: "", cenarioC: "" };
        }
        if (!window.sistemaVidaState.perma) {
            window.sistemaVidaState.perma = { P: 0, E: 0, R: 0, M: 0, A: 0 };
        }
        if (!window.sistemaVidaState.swls) {
            window.sistemaVidaState.swls = { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
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
            const cachedTheme = localStorage.getItem('lifeos_theme_pref');
            if (cachedTheme && ['light', 'dark', 'auto'].includes(cachedTheme)) {
                window.sistemaVidaState.settings.theme = cachedTheme;
            }
            const cachedNotif = localStorage.getItem('lifeos_notif_enabled');
            if (cachedNotif === '1' || cachedNotif === '0') {
                window.sistemaVidaState.settings.notificationsEnabled = cachedNotif === '1';
            }
            if (!window.sistemaVidaState.profile.avatarUrl) {
                const cached = localStorage.getItem('lifeos_profile_avatar') || '';
                if (cached) window.sistemaVidaState.profile.avatarUrl = cached;
            }
            const cachedOdyssey = localStorage.getItem('lifeos_odyssey_images');
            if (cachedOdyssey) {
                const parsed = JSON.parse(cachedOdyssey);
                window.sistemaVidaState.profile.odysseyImages = {
                    ...window.sistemaVidaState.profile.odysseyImages,
                    ...parsed
                };
            }
            const onboardingFlag = localStorage.getItem('lifeos_onboarding_complete');
            if (onboardingFlag === '1') window.sistemaVidaState.onboardingComplete = true;
            if (onboardingFlag === '0') window.sistemaVidaState.onboardingComplete = false;
        } catch (_) {}
        this.normalizePermaState();
        this.normalizeEntitiesState();
        this.normalizeSwlsState();
        this.normalizeDailyLogsState();
        this.normalizeDeepWorkState();
    },
    applyThemePreference: function() {
        this.ensureSettingsState();
        const pref = window.sistemaVidaState.settings.theme || 'auto';
        const root = document.documentElement;
        const hour = new Date().getHours();
        const isNightByHour = hour < 6 || hour >= 18;
        const useDark = pref === 'dark' || (pref === 'auto' && isNightByHour);
        root.classList.toggle('dark', useDark);
        root.classList.toggle('light', !useDark);
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
        try { localStorage.setItem('lifeos_theme_pref', next); } catch (_) {}
        this.applyThemePreference();
        this.saveState(true);
        this.showToast(`Tema aplicado: ${next === 'auto' ? 'Automático' : (next === 'dark' ? 'Escuro' : 'Claro')}.`, 'success');
        if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
    },
    toggleDailyNotifications: async function() {
        this.ensureSettingsState();
        const enabled = !window.sistemaVidaState.settings.notificationsEnabled;
        if (enabled && typeof Notification !== 'undefined') {
            try {
                if (Notification.permission === 'default') {
                    const result = await Notification.requestPermission();
                    if (result !== 'granted') {
                        this.showToast('Permissão de notificações não concedida no navegador.', 'error');
                        return;
                    }
                } else if (Notification.permission === 'denied') {
                    this.showToast('Notificações bloqueadas no navegador. Ative nas permissões do site.', 'error');
                    return;
                }
            } catch (_) {
                this.showToast('Não foi possível solicitar a permissão de notificações.', 'error');
                return;
            }
        }
        window.sistemaVidaState.settings.notificationsEnabled = enabled;
        try { localStorage.setItem('lifeos_notif_enabled', enabled ? '1' : '0'); } catch (_) {}
        this.saveState(true);
        if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
        this.showToast(enabled ? 'Notificações diárias ativadas.' : 'Notificações diárias desativadas.', 'success');
    },
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
        const imagesRef = doc(db, 'users', 'meu-sistema-vida-images');
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
            try { localStorage.setItem('lifeos_profile_avatar', dataUrl); } catch (_) {}
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
                localStorage.setItem('lifeos_odyssey_images', JSON.stringify(window.sistemaVidaState.profile.odysseyImages));
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

    showToast: function(message, type = 'success') {
        const container = document.getElementById('global-toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        const isSuccess = type === 'success';
        const icon = isSuccess ? 'check_circle' : 'error';
        const bgColor = isSuccess ? 'bg-surface-container-highest' : 'bg-error';
        const textColor = isSuccess ? 'text-primary' : 'text-white';
        const ringColor = isSuccess ? 'ring-primary/20' : 'ring-error/20';
        
        toast.className = `flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl transform transition-all duration-500 translate-y-8 opacity-0 ${bgColor} border border-outline-variant/10 ring-4 ${ringColor}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined notranslate ${textColor} text-xl">${icon}</span>
            <p class="text-sm font-semibold text-on-surface">${message}</p>
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
                // Images are stored in a separate Firestore document (meu-sistema-vida-images).
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
            localStorage.setItem('lifeos_state_backup', JSON.stringify(fullSnapshot));
        } catch (backupErr) {
            console.warn('Falha ao gravar backup local do estado:', backupErr);
            try {
                localStorage.setItem('lifeos_state_backup_core', JSON.stringify(coreSnapshot));
            } catch (_) {}
        }
        this.persistLocalMirror();

        if (!this._saveChain) this._saveChain = Promise.resolve();
        const enqueueTs = Number(state._lastUpdatedAt || 0);
        const runSave = async () => {
            this._isSaving = true;
            this.updateSyncBadge('syncing');
            try {
                await this.withTimeout(getAuthReady(), 8000, 'auth_ready');
                try {
                    const imagesChanged = await this.withTimeout(
                        this.syncImagesToFirestoreDoc(), 15000, 'sync_images'
                    );
                    if (imagesChanged) this.persistLocalMirror();
                } catch (imageError) {
                    console.warn('Falha ao sincronizar imagens com Firestore (ignorado):', imageError);
                }
                const stateRef = doc(db, "users", "meu-sistema-vida");
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

    loadState: async function() {
        let cloudData = null;
        let localData = null;
        try {
            const rawLocal = localStorage.getItem('lifeos_state_backup');
            const rawCore = localStorage.getItem('lifeos_state_backup_core');
            if (rawLocal) {
                try { localData = JSON.parse(rawLocal); } catch (_) { localData = null; }
            } else if (rawCore) {
                try { localData = JSON.parse(rawCore); } catch (_) { localData = null; }
            }
            await this.withTimeout(getAuthReady(), 8000, 'auth_ready');
            const stateRef = doc(db, "users", "meu-sistema-vida");
            const docSnap = await this.withTimeout(getDoc(stateRef), 10000, 'firestore_getDoc');
            
            if (docSnap.exists()) {
                console.log("Estado encontrado na Nuvem, mesclando dados...");
                cloudData = docSnap.data();
            } else {
                console.log("Primeiro acesso. Criando documento base na Nuvem...");
                await this.saveState(true);
            }
        } catch (error) {
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
        else if (!cloudData) console.warn('[SYNC] Firestore unavailable — using local backup.');
        else console.log('[SYNC] Using cloud state (source of truth).');

        if (preferred) window.sistemaVidaState = this.mergeDeep(window.sistemaVidaState, preferred);
        if (!shouldKeepLocal && window.sistemaVidaState._pendingLocalChanges) {
            window.sistemaVidaState._pendingLocalChanges = false;
        }
        // Load images from dedicated Firestore document (Firestore-native image storage)
        try {
            const imagesRef = doc(db, 'users', 'meu-sistema-vida-images');
            const imagesSnap = await this.withTimeout(getDoc(imagesRef), 8000, 'firestore_getImages');
            if (imagesSnap.exists()) {
                const imgData = imagesSnap.data();
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                if (imgData.avatarUrl && typeof imgData.avatarUrl === 'string') {
                    window.sistemaVidaState.profile.avatarUrl = imgData.avatarUrl;
                    try { localStorage.setItem('lifeos_profile_avatar', imgData.avatarUrl); } catch (_) {}
                }
                if (imgData.odysseyImages && typeof imgData.odysseyImages === 'object') {
                    if (!window.sistemaVidaState.profile.odysseyImages) window.sistemaVidaState.profile.odysseyImages = {};
                    Object.entries(imgData.odysseyImages).forEach(([k, v]) => {
                        if (v && typeof v === 'string') window.sistemaVidaState.profile.odysseyImages[k] = v;
                    });
                    try { localStorage.setItem('lifeos_odyssey_images', JSON.stringify(imgData.odysseyImages)); } catch (_) {}
                }
                console.log('[Images] Imagens carregadas do Firestore.');
            }
        } catch (imgErr) {
            // Fallback to local cache if Firestore images doc unavailable
            try {
                const cachedAvatar = localStorage.getItem('lifeos_profile_avatar');
                if (cachedAvatar && !window.sistemaVidaState.profile?.avatarUrl) {
                    if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                    window.sistemaVidaState.profile.avatarUrl = cachedAvatar;
                }
                const cachedOdyssey = localStorage.getItem('lifeos_odyssey_images');
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
        this.normalizeEntitiesState();
        this.normalizeSwlsState();
        this.normalizeDailyLogsState();
        this.normalizeDeepWorkState();
        this.renderSidebarValues();
        if (window.sistemaVidaState._pendingLocalChanges) {
            this.saveState(true).catch((err) => {
                console.warn('[SYNC] Retry cloud sync after load failed:', err);
            });
        }
    },
    setupRealtimeSync: function() {
        if (this._realtimeSyncUnsub) return; // already active
        const self = this;
        const trySetup = function() {
            self.withTimeout(getAuthReady(), 10000, 'auth_ready').then(() => {
                const stateRef = doc(db, 'users', 'meu-sistema-vida');
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
                if (window.sistemaVidaState._pendingLocalChanges) window.sistemaVidaState._pendingLocalChanges = false;
                window.sistemaVidaState._lastUpdatedAt = Number(remoteData?._lastUpdatedAt || window.sistemaVidaState._lastUpdatedAt || Date.now());
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
                    const imagesRef = doc(db, 'users', 'meu-sistema-vida-images');
                    self._imagesSyncUnsub = onSnapshot(imagesRef, (imgSnap) => {
                        if (!imgSnap.exists()) return;
                        if (self._isSaving) return;
                        const imgData = imgSnap.data();
                        try {
                            if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                            if (imgData.avatarUrl && typeof imgData.avatarUrl === 'string') {
                                window.sistemaVidaState.profile.avatarUrl = imgData.avatarUrl;
                            }
                            if (imgData.odysseyImages && typeof imgData.odysseyImages === 'object') {
                                if (!window.sistemaVidaState.profile.odysseyImages) window.sistemaVidaState.profile.odysseyImages = {};
                                Object.entries(imgData.odysseyImages).forEach(([k, v]) => {
                                    if (v && typeof v === 'string') window.sistemaVidaState.profile.odysseyImages[k] = v;
                                });
                            }
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
                            const ref = doc(db, 'users', 'meu-sistema-vida');
                            return self.withTimeout(getDoc(ref), 8000, 'periodic_getDoc');
                        }).then((snap) => {
                            if (!snap || !snap.exists()) return;
                            const remote = snap.data();
                            const remoteTs = Number(remote?._lastUpdatedAt || 0);
                            const localTs  = Number(window.sistemaVidaState?._lastUpdatedAt || 0);
                            if (remoteTs <= localTs) return;
                            console.log('[SYNC] Periodic pull: applying newer cloud state (remoteTs=' + remoteTs + ')');
                            window.sistemaVidaState = app.mergeDeep(window.sistemaVidaState, remote);
                            window.sistemaVidaState._lastUpdatedAt = remoteTs;
                            if (window.sistemaVidaState._pendingLocalChanges) window.sistemaVidaState._pendingLocalChanges = false;
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


    showNotification: function(msg) {
        this.showToast(msg, 'success');
        // Mostra notificação real do SO se permissão concedida e app aberto
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(reg => {
                        reg.showNotification('Life OS', {
                            body: msg,
                            icon: './icons/icon-192.png',
                            badge: './icons/icon-96.png',
                            tag: 'lifeos-alert'
                        });
                    }).catch(() => {});
                } else {
                    new Notification('Life OS', { body: msg, icon: './icons/icon-192.png' });
                }
            } catch (_) {}
        }
    },

    // Agenda notificações locais relevantes para o contexto do dia
    // (Dispara quando o app é aberto e as permissões estão concedidas)
    scheduleLocalNotifications: function() {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const state = window.sistemaVidaState;
        if (!state.settings?.notificationsEnabled) return;
        if (!('serviceWorker' in navigator)) return;

        const today = new Date();
        const dow = today.getDay(); // 0=Dom, 1=Seg...6=Sáb
        const weekKey = this._getWeekKey();
        const hasPlan = !!(state.weekPlans || {})[weekKey];
        const hasReview = !!(state.reviews || {})[weekKey];

        // Segunda-feira sem plano → lembrar de planejar a semana
        if (dow === 1 && !hasPlan) {
            setTimeout(() => {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification('Life OS — Planejar Semana', {
                        body: '📅 Segunda-feira! Que tal definir sua intenção e micros para esta semana?',
                        icon: './icons/icon-192.png',
                        tag: 'lifeos-weekly-plan',
                        requireInteraction: false
                    });
                }).catch(() => {});
            }, 3000);
        }

        // Sexta/Sáb/Dom com plano mas sem revisão → lembrar de revisar
        if ([5, 6, 0].includes(dow) && hasPlan && !hasReview) {
            setTimeout(() => {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification('Life OS — Revisão Semanal', {
                        body: '✍️ Fim de semana! Hora de revisar o que foi feito e fechar o ciclo semanal.',
                        icon: './icons/icon-192.png',
                        tag: 'lifeos-weekly-review',
                        requireInteraction: false
                    });
                }).catch(() => {});
            }, 3500);
        }
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
            if (this.needsReview) setTimeout(() => this.showNotification("✍️ Fim de semana! Que tal fazer a revisão da semana?"), 2500);
        }
        // Agenda notificações locais do SO (apenas se permissão concedida)
        setTimeout(() => this.scheduleLocalNotifications(), 5000);

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
        const values = profile.values || [];
        
        const container = document.getElementById('sidebar-values-container');
        if (container) {
            if (values.length > 0) {
                container.innerHTML = values.map(v => 
                    `<span class="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase italic transition-all hover:bg-primary/20 cursor-default animate-fade-in">${v}</span>`
                ).join('');
            } else {
                container.innerHTML = `<span class="text-[10px] text-outline italic">Defina seus valores no Propósito</span>`;
            }
        }

        // Também atualiza o banner no Propósito se estiver visível
        const valuesBanner = document.getElementById('top-values-banner');
        if (valuesBanner && values.length > 0) {
            valuesBanner.innerHTML = values.map(v => 
                `<span class="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest animate-fade-in">${v}</span>`
            ).join('');
        }
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
        btn.classList.add('text-stone-500');
      });
    
      const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active', 'text-primary');
        activeBtn.classList.remove('text-stone-500');
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
    },

    // ── Renderização da aba Semanal ─────────────────────────────────────────────
    renderWeeklyPlans: function() {
        const state = window.sistemaVidaState;
        const weekPlans = state.weekPlans || {};
        const weekKey = this._getWeekKey();

        // Rótulo da semana atual
        const weekStart = new Date(weekKey + 'T00:00:00');
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const labelEl = document.getElementById('semanal-week-label');
        if (labelEl) labelEl.textContent = `Semana de ${fmt(weekStart)} a ${fmt(weekEnd)}`;

        // Card da semana atual
        const currentCard = document.getElementById('semanal-current-card');
        const currentPlan = weekPlans[weekKey];
        if (currentCard) {
            if (currentPlan) {
                currentCard.innerHTML = this._renderWeekPlanCard(currentPlan, state, true);
            } else {
                currentCard.innerHTML = '<p class="text-sm text-outline italic">Nenhum plano para esta semana ainda. Clique em "Planejar Semana" para começar.</p>';
            }
        }

        // Histórico (semanas passadas, ordenadas da mais recente para mais antiga)
        const historyContainer = document.getElementById('semanal-history-container');
        const historyCount = document.getElementById('semanal-history-count');
        const pastKeys = Object.keys(weekPlans)
            .filter(k => k < weekKey)
            .sort((a, b) => b.localeCompare(a));

        if (historyCount) historyCount.textContent = pastKeys.length > 0 ? `${pastKeys.length} semana${pastKeys.length > 1 ? 's' : ''} anteriores` : '';

        if (historyContainer) {
            if (pastKeys.length === 0) {
                historyContainer.innerHTML = '<p class="text-sm text-outline italic">Nenhum histórico ainda.</p>';
            } else {
                historyContainer.innerHTML = pastKeys.map(key => {
                    const plan = weekPlans[key];
                    const review = (state.reviews || {})[key];
                    const start = new Date(key + 'T00:00:00');
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    const reviewBadge = review
                        ? `<span class="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full"><span class="material-symbols-outlined notranslate text-[12px]">check_circle</span>Revisado</span>`
                        : `<span class="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-outline bg-surface-container-high px-2 py-0.5 rounded-full">Sem revisão</span>`;
                    const reviewSection = review ? `
                        <div class="mt-4 pt-4 border-t border-outline-variant/10">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3 flex items-center gap-1">
                                <span class="material-symbols-outlined notranslate text-[14px]">rate_review</span>
                                Revisão da Semana
                            </p>
                            <div class="grid md:grid-cols-2 gap-3">
                                ${review.q1 ? `<div class="bg-surface-container p-3 rounded-xl"><p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">O que planejei</p><p class="text-xs text-on-surface leading-relaxed">${review.q1}</p></div>` : ''}
                                ${review.q2 ? `<div class="bg-surface-container p-3 rounded-xl"><p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">O que executei</p><p class="text-xs text-on-surface leading-relaxed">${review.q2}</p></div>` : ''}
                                ${review.q3 ? `<div class="bg-surface-container p-3 rounded-xl"><p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">O que aprendi</p><p class="text-xs text-on-surface leading-relaxed">${review.q3}</p></div>` : ''}
                                ${review.q4 ? `<div class="bg-surface-container p-3 rounded-xl"><p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">O que ajustaria</p><p class="text-xs text-on-surface leading-relaxed">${review.q4}</p></div>` : ''}
                                ${review.q5 ? `<div class="bg-surface-container p-3 rounded-xl md:col-span-2"><p class="text-[9px] uppercase tracking-widest text-outline font-bold mb-1">Gratidão / Destaque</p><p class="text-xs text-on-surface leading-relaxed">${review.q5}</p></div>` : ''}
                            </div>
                        </div>` : '';
                    return `<details class="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden group">
                        <summary class="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-container transition-colors list-none">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined notranslate text-outline text-lg">calendar_month</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface flex items-center flex-wrap gap-1">${fmt(start)} — ${fmt(end)}${reviewBadge}</p>
                                    ${plan.intention ? `<p class="text-xs text-outline mt-0.5 truncate max-w-[240px]">${plan.intention}</p>` : ''}
                                </div>
                            </div>
                            <span class="material-symbols-outlined notranslate text-outline text-sm transition-transform group-open:rotate-180">expand_more</span>
                        </summary>
                        <div class="px-5 pb-5 border-t border-outline-variant/10">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline mt-4 mb-2 flex items-center gap-1">
                                <span class="material-symbols-outlined notranslate text-[14px]">edit_calendar</span>
                                Plano da Semana
                            </p>
                            ${this._renderWeekPlanCard(plan, state, false)}
                            ${reviewSection}
                        </div>
                    </details>`;
                }).join('');
            }
        }
    },

    _renderWeekPlanCard: function(plan, state, isCurrent) {
        const micros = state.entities?.micros || [];
        const energyLabels = { 1: '1 — Semana leve', 2: '2 — Abaixo do normal', 3: '3 — Normal', 4: '4 — Energia alta', 5: '5 — Semana de pico' };

        const selectedMicros = (plan.selectedMicros || []).map(id => micros.find(m => m.id === id)).filter(Boolean);
        const doneMicros = selectedMicros.filter(m => m.status === 'done' || m.completed);
        const pendingMicros = selectedMicros.filter(m => m.status !== 'done' && !m.completed);

        const completionPct = selectedMicros.length > 0 ? Math.round((doneMicros.length / selectedMicros.length) * 100) : 0;

        return `<div class="space-y-4 mt-4">
            ${plan.intention ? `
            <div class="flex flex-col gap-1">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Intenção</p>
                <p class="text-sm text-on-surface leading-relaxed">${plan.intention}</p>
            </div>` : ''}

            <div class="flex gap-6">
                <div class="flex flex-col gap-0.5">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Energia</p>
                    <p class="text-sm text-on-surface">${energyLabels[plan.energyForecast] || plan.energyForecast}</p>
                </div>
                ${selectedMicros.length > 0 ? `
                <div class="flex flex-col gap-0.5">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Execução</p>
                    <p class="text-sm text-on-surface font-bold text-primary">${doneMicros.length}/${selectedMicros.length} <span class="text-outline font-normal">(${completionPct}%)</span></p>
                </div>` : ''}
            </div>

            ${selectedMicros.length > 0 ? `
            <div class="flex flex-col gap-2">
                <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Micros Planejados</p>
                <div class="space-y-1.5">
                    ${selectedMicros.map(m => {
                        const done = m.status === 'done' || m.completed;
                        return `<div class="flex items-center gap-2">
                            <span class="material-symbols-outlined notranslate text-[16px] ${done ? 'text-primary' : 'text-outline'}">${done ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span class="text-xs ${done ? 'line-through text-outline' : 'text-on-surface'}">${m.title}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '<p class="text-xs text-outline italic">Nenhum micro selecionado.</p>'}

            ${isCurrent && selectedMicros.length > 0 ? `
            <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-700" style="width: ${completionPct}%"></div>
            </div>` : ''}

            ${(() => {
                if (!isCurrent) return '';
                const todayDow = new Date().getDay();
                if (![5, 6, 0].includes(todayDow)) return '';
                const wk = app._getWeekKey();
                const hasReview = !!(state.reviews || {})[wk];
                if (hasReview) return `
                <div class="flex items-center gap-2 mt-2 text-primary text-xs font-bold">
                    <span class="material-symbols-outlined notranslate text-[16px]">check_circle</span>
                    Revisão da semana já realizada
                </div>`;
                return `
                <button onclick="window.app.openReviewModal()"
                    class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary text-sm font-bold rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all">
                    <span class="material-symbols-outlined notranslate text-[18px]">rate_review</span>
                    Fazer Revisão da Semana
                </button>`;
            })()}
        </div>`;
    },

    init: async function() {
        console.log("Sistema Vida OS inicializando... v35");
    // Signal dead-man's switch that the module loaded
    document.dispatchEvent(new CustomEvent('lifeos-app-ready'));
        console.log("[DIAG] localStorage keys:", Object.keys(localStorage).filter(k => k.startsWith("lifeos")));
        try {
            await this.withTimeout(this.loadState(), 12000, 'loadState');
        } catch (err) {
            console.warn('Falha/timeout no carregamento da nuvem. Iniciando com backup local.', err);
        }
        if (!this._localFlushBound) {
            this._localFlushBound = true;
            const flushLocalMirror = () => {
                try { this.persistLocalMirror(); } catch (_) {}
            };
            window.addEventListener('pagehide', flushLocalMirror);
            window.addEventListener('beforeunload', flushLocalMirror);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') flushLocalMirror();
            });
        }
        try { this.ensureSettingsState(); } catch (_) {}
        try { this.applyThemePreference(); } catch (_) {}
        try { this.checkAlerts(); } catch (_) {}
        try { this.ensureDeepWorkTicking(); } catch (_) {}
        try { this.setupRealtimeSync(); } catch (_) {} // real-time cross-device sync

        // Auto-sincroniza imagens com Firestore logo após o carregamento
        try {
            const hasAvatar = !!(window.sistemaVidaState.profile?.avatarUrl);
            const odysseyImgs = window.sistemaVidaState.profile?.odysseyImages || {};
            const hasOdyssey = Object.values(odysseyImgs).some(v => v && typeof v === 'string' && v.length > 10);
            if (hasAvatar || hasOdyssey) {
                authReady.then(() => {
                    this.syncImagesToFirestoreDoc().catch(e => console.warn('[Images] Falha ao sincronizar imagens na inicialização:', e));
                }).catch(() => {});
            }
        } catch (_) {}

        // Always navigate — even if something above threw
        if (!window.sistemaVidaState.onboardingComplete) {
            this.switchView('onboarding');
        } else {
            this.switchView('hoje');
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

    switchView: async function(viewName) {
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
            const response = await fetch(`${this.config.viewsPath}${viewName}.html`, { signal: ctrl.signal });
            clearTimeout(timer);
            html = response.ok ? await response.text() : null;
        } catch (error) {
            console.warn(`Erro ao carregar a view '${viewName}':`, error);
            html = null;
        }
        if (!html) html = this.getFallbackTemplate(viewName);

        setTimeout(() => {
            if (container) {
                container.innerHTML = html;
                container.style.opacity = '1';
                this.executeInjectedScripts(container);
            }
            if (this.render[viewName]) {
                try { this.render[viewName](); } catch (e) { console.warn('render error:', e); }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 200);
    },

    // Alias para compatibilidade com as chamadas do index.html
    navigate: function(viewName) {
        this.switchView(viewName);
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
                
                const energyColor = log.energy >= 4 ? 'text-green-600' : log.energy >= 3 ? 'text-yellow-600' : 'text-red-600';
                const gratidaoBlock = log.gratidao ? `<p class="text-[11px] text-on-surface-variant mt-2">Gratidão: ${log.gratidao}</p>` : '';
                const funcionouBlock = log.funcionou ? `<p class="text-[11px] text-on-surface-variant mt-1">Funcionou: ${log.funcionou}</p>` : '';
                const shutdownText = Array.isArray(log.shutdown) ? (log.shutdown[0] || '') : (log.shutdown || '');
                const shutdownBlock = shutdownText ? `<p class="text-[11px] text-on-surface-variant mt-1">Shutdown: ${shutdownText}</p>` : '';
                
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

    openDiarioModal: function() {
        const modal = document.getElementById('diario-flash-modal');
        const selectMicros = document.getElementById('flash-micro-select');
        if (!modal || !selectMicros) return;

        // Limpa select
        selectMicros.innerHTML = '<option value="">Qual foi a Micro Ação?</option>';

        // Busca Micro Ações pendentes do estado
        const micros = window.sistemaVidaState.entities.micros || [];
        const pendingMicros = micros.filter(m => m.status !== 'done');

        pendingMicros.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.title;
            selectMicros.appendChild(opt);
        });

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeDiarioModal: function() {
        const modal = document.getElementById('diario-flash-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    saveDiarioFlash: function() {
        const microId = document.getElementById('flash-micro-select').value;
        const emotion = document.getElementById('flash-emotion-input')?.value || 'neutral';
        const gratitude = document.getElementById('flash-gratidao').value.trim();

        if (!gratitude) {
            alert('Por favor, escreva um motivo de gratidão.');
            return;
        }

        const date = this.getLocalDateKey();
        const state = window.sistemaVidaState;

        // Atualiza log do dia sem apagar outros campos (ex: intenção/energy/gratidão do diário de sono)
        state.dailyLogs[date] = {
            ...state.dailyLogs[date],
            flashEmotion: emotion,
            flashGratitude: gratitude,
            lastMicroActionId: microId,
            timestamp: new Date().getTime()
        };
        // Dispara completeMicroAction apenas se o checkbox estiver marcado
        const markDone = document.getElementById('flash-mark-done')?.checked;
        if (microId && markDone) {
            this.completeMicroAction(microId);
            setTimeout(() => this.showToast('Diário e Ação concluídos!', 'success'), 500);
        } else {
            this.saveState(false);
            this.showToast('Diário Flash salvo com sucesso!', 'success');
        }
        this.closeDiarioModal();
    },

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

    isDateInCurrentMonth: function(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr + "T00:00:00");
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    },

    saveValues: function(newValuesArray) {
        window.sistemaVidaState.profile.values = newValuesArray;
        if (this.render.proposito) this.render.proposito();
        app.saveState(true);
    },

    _trailRowId: function(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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
            <textarea rows="3" class="trail-okr-krs w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-on-surface resize-none" placeholder="Key Results (um por linha): Título | Atual | Alvo" oninput="window.app.refreshTrailSummary()">${this.escapeHtml(prefill.keyResultsText || '')}</textarea>
        `;
        list.appendChild(row);
        this.refreshTrailMacroParentOptions();
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
            const keyResultsText = (row.querySelector('.trail-okr-krs')?.value || '').trim();
            const keyResults = this.parseKeyResultsText(keyResultsText);
            const hasAny = !!(title || metric || inicioDate || prazo || keyResultsText);
            const isComplete = !!(title && metric && prazo);
            if (hasAny && !isComplete) hasPartial = true;
            if (isComplete) items.push({ rowId, title, metric, inicioDate, prazo, challengeLevel, commitmentLevel, keyResults, keyResultsText });
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
                this.showToast('Complete os campos de cada OKR preenchido (resultado, métrica e prazo).', 'error');
                return false;
            }
            if (okrs.items.length < 1 || okrs.items.length > 3) {
                this.showToast('Defina de 1 a 3 OKRs para continuar.', 'error');
                return false;
            }
            const invalidOkr = okrs.items.find((okr, idx) => {
                const validation = this.validateEntityTimeWindow('okrs', {
                    inicioDate: okr.inicioDate,
                    prazo: okr.prazo
                });
                if (validation.ok) return false;
                this.showToast(`OKR ${idx + 1}: ${validation.message}`, 'error');
                return true;
            });
            if (invalidOkr) return false;
            return true;
        }
        if (s === 3) {
            const macros = this._readTrailMacros();
            if (macros.hasPartial) {
                this.showToast('Cada Macro precisa de título, OKR vinculado, início e prazo.', 'error');
                return false;
            }
            if (macros.items.length < 2 || macros.items.length > 5) {
                this.showToast('Defina de 2 a 5 Macros para continuar.', 'error');
                return false;
            }
            const invalidMacro = macros.items.find((macro, idx) => {
                const validation = this.validateEntityTimeWindow('macros', {
                    inicioDate: macro.inicioDate,
                    prazo: macro.prazo
                });
                if (validation.ok) return false;
                this.showToast(`Macro ${idx + 1}: ${validation.message}`, 'error');
                return true;
            });
            if (invalidMacro) return false;
            return true;
        }
        if (s === 4) {
            const micros = this._readTrailMicros();
            if (micros.hasPartial) {
                this.showToast('Cada Micro precisa de título, Macro vinculada, início e prazo.', 'error');
                return false;
            }
            if (micros.items.length < 1) {
                this.showToast('Defina ao menos 1 Micro para começar a semana.', 'error');
                return false;
            }
            const invalidMicro = micros.items.find((micro, idx) => {
                const validation = this.validateEntityTimeWindow('micros', {
                    inicioDate: micro.inicioDate,
                    prazo: micro.prazo
                });
                if (validation.ok) return false;
                this.showToast(`Micro ${idx + 1}: ${validation.message}`, 'error');
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
                this.showToast('Os prazos dos Micros devem ficar dentro das próximas 2 semanas.', 'error');
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
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">OKR ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(okr.title)}</p>
                    <p class="text-xs text-outline mt-1">${this.escapeHtml(okr.metric)}</p>
                    <p class="text-[11px] text-outline mt-1">Desafio ${okr.challengeLevel || 3}/5 • Comprometimento ${okr.commitmentLevel || 3}/5</p>
                    <p class="text-[11px] text-outline mt-1">${Array.isArray(okr.keyResults) && okr.keyResults.length > 0 ? `${okr.keyResults.length} key result(s)` : 'Sem key results'}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${okr.inicioDate ? `${this._formatTrailDate(okr.inicioDate)} → ` : ''}${this._formatTrailDate(okr.prazo)}</p>
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem OKRs completos.</p>';

        const macroCards = macros.length > 0
            ? macros.map((macro, idx) => `
                <div class="bg-surface-container rounded-lg border border-outline-variant/15 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Macro ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(macro.title)}</p>
                    <p class="text-xs text-outline mt-1">Vinculada a: ${this.escapeHtml(okrByRow[macro.okrRowId]?.title || 'OKR não definido')}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${this._formatTrailDate(macro.inicioDate)} → ${this._formatTrailDate(macro.prazo)}</p>
                    ${macro.description ? `<p class="text-xs text-on-surface mt-2">${this.escapeHtml(macro.description)}</p>` : ''}
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem Macros completas.</p>';

        const microCards = micros.length > 0
            ? micros.map((micro, idx) => `
                <div class="bg-surface-container rounded-lg border border-outline-variant/15 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Micro ${idx + 1}</p>
                    <p class="text-sm font-semibold text-on-surface mt-1">${this.escapeHtml(micro.title)}</p>
                    <p class="text-xs text-outline mt-1">Macro: ${this.escapeHtml(macroByRow[micro.macroRowId]?.title || 'Macro não definida')}</p>
                    <p class="text-[11px] text-primary font-bold mt-2">${this._formatTrailDate(micro.inicioDate)} → ${this._formatTrailDate(micro.prazo)}</p>
                </div>
            `).join('')
            : '<p class="text-xs text-outline italic">Sem Micros completas.</p>';

        summary.innerHTML = `
            ${metaCard}
            <div class="grid md:grid-cols-3 gap-3">
                <div class="space-y-2">${okrCards}</div>
                <div class="space-y-2">${macroCards}</div>
                <div class="space-y-2">${microCards}</div>
            </div>
        `;
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
        this.showToast(`Trilha criada: 1 meta, ${okrs.length} OKR(s), ${macros.length} macro(s), ${micros.length} micro(s).`, 'success');

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

    openCreateModal: function(type = 'metas') {
        this.closeFabMenu();
        this.editingEntity = null; // Limpa estado de edição
        // Reseta chips do seletor de propósito
        document.querySelectorAll('.purpose-option-chip').forEach(c => {
            c.classList.remove('bg-primary/10', 'border-primary');
        });
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Novo Item';

        const successCriteriaInput = document.getElementById('crud-success-criteria');
        const challengeInput = document.getElementById('crud-challenge-level');
        const commitmentInput = document.getElementById('crud-commitment-level');
        const keyResultsInput = document.getElementById('crud-key-results');
        const deadlineInput = document.getElementById('create-prazo');
        const inicioDateInput = document.getElementById('crud-inicio-date');
        const prazoDateInput = document.getElementById('crud-prazo-date');
        if (successCriteriaInput) successCriteriaInput.value = '';
        if (challengeInput) challengeInput.value = '3';
        if (commitmentInput) commitmentInput.value = '3';
        if (keyResultsInput) keyResultsInput.value = '';
        if (deadlineInput) deadlineInput.value = '';
        if (inicioDateInput) inicioDateInput.value = '';
        if (prazoDateInput) prazoDateInput.value = '';

        document.getElementById('crud-type').value = type;
        this.onTypeChange(type);
        document.getElementById('crud-modal').classList.remove('hidden');
        document.getElementById('crud-title').focus();
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
        const metaHorizonGroup = document.getElementById('crud-meta-horizon-group');
        const successCriteriaGroup = document.getElementById('crud-success-criteria-group');
        const goalRigorGroup = document.getElementById('crud-goal-rigor-group');
        const keyResultsGroup = document.getElementById('crud-key-results-group');
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
        setGroupVisible(habitIdentityGroup, false);
        setGroupVisible(habitStepsChecklistWrap, false);
        setGroupVisible(successCriteriaGroup, false);
        setGroupVisible(goalRigorGroup, false);
        setGroupVisible(keyResultsGroup, false);
        if (metaHorizonGroup) metaHorizonGroup.classList.add('hidden');
        if (dimensionGroup) dimensionGroup.classList.remove('hidden'); // Dimensão visível quase sempre
        if (contextGroup) contextGroup.classList.remove('hidden');
        if (contextInput) contextInput.required = true;
        if (triggerInput) triggerInput.required = false;
        if (routineInput) routineInput.required = false;
        if (rewardInput) rewardInput.required = false;

        // Configura baseado no tipo
        if (type === 'habits') {
            setGroupVisible(triggerGroup, true);
            setGroupVisible(habitIdentityGroup, true);
            setGroupVisible(habitControls, true);
            setGroupVisible(habitStepsChecklistWrap, !!this.editingEntity && this.editingEntity.type === 'habits');
            if (habitControls) {
                // Força atualização da visibilidade dos sub-campos baseando nos valores dos selects
                const modeInput = document.getElementById('habit-track-mode');
                if (modeInput) this.onHabitModeChange(modeInput.value);
                const freqInput = document.getElementById('habit-frequency');
                if (freqInput) this.onHabitFreqChange(freqInput.value);
            }
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
            if (successCriteriaLabel) successCriteriaLabel.textContent = 'Critério / Meta do OKR';
            if (contextGroup) contextGroup.classList.add('hidden');
            if (contextInput) contextInput.required = false;
            this.updateParentList(type);
        } else {
            // Macros, Micros
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (successCriteriaLabel) successCriteriaLabel.textContent = 'Critério de Sucesso';
            if (contextLabel) contextLabel.textContent = 'Detalhes / Critério de Aceitação';
            this.updateParentList(type);
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

        // Alterna campo de prazo padrão vs. janela real (OKR/macro/micro)
        const deadlineGroup = document.getElementById('prazo-deadline-group');
        const agendamentoGroup = document.getElementById('prazo-agendamento-group');
        const usaAgendamento = ['okrs', 'macros', 'micros'].includes(type);

        if (deadlineGroup) deadlineGroup.classList.toggle('hidden', usaAgendamento);
        if (agendamentoGroup) agendamentoGroup.classList.toggle('hidden', !usaAgendamento);

        // Defaults para datas reais no modal (OKR/macro/micro)
        if (usaAgendamento) {
            const hoje = new Date().toISOString().split('T')[0];
            const inicioInput = document.getElementById('crud-inicio-date');
            const prazoInput = document.getElementById('crud-prazo-date');
            if (type !== 'okrs' && inicioInput && !inicioInput.value) inicioInput.value = hoje;
            if (prazoInput && !prazoInput.value) prazoInput.value = hoje;
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
                            <p class="text-[10px] text-outline">Aparecerá nos micros comprometidos da semana</p>
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

    // ── Seletor de Propósito no modal de criação de Metas ──────────────────────
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

    // ── Painel de Propósito no modal de criação ─────────────────────────────────
    // Dimensões mapeadas ao campo de legado do perfil
    _dimensionLegacyMap: {
        'Carreira': 'profissao', 'Finanças': 'profissao',
        'Família': 'familia', 'Relacionamentos': 'familia',
        'Propósito': 'mundo', 'Saúde': null, 'Mente': null, 'Lazer': null
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
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};

        // Verifica se há algum dado para mostrar
        const hasValues = values.length > 0;
        const hasIkigai = !!(ikigai.sintese || ikigai.love);
        const legacyKey = this._dimensionLegacyMap[dimension];
        const legacyText = legacyKey ? (legacyObj[legacyKey] || '') : '';
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
            ikigaiText.textContent = ikigai.sintese || ikigai.love || '';
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
            return { ok: false, message: 'Defina um prazo para respeitar a janela temporal deste tipo.' };
        }

        if (normalizedType === 'metas') {
            const days = this.getDayDiffFromNow(prazo);
            if (days === null || days < 1) return { ok: false, message: 'Meta precisa de um prazo futuro válido.' };
            const rule = this.getMetaHorizonRule(metaHorizonYears);
            if (days < rule.min || days > rule.max) {
                return { ok: false, message: `Para meta de ${rule.label}, ajuste o prazo para a janela esperada desse horizonte.` };
            }
            return { ok: true };
        }

        if (normalizedType === 'okrs') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'OKR precisa de início e prazo válidos.' };
            if (days > 92) return { ok: false, message: 'OKR deve ficar dentro de até 3 meses (máx. 92 dias).' };
            return { ok: true };
        }

        if (normalizedType === 'macros') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'Macro Ação precisa de início e prazo válidos.' };
            if (days > 31) return { ok: false, message: 'Macro Ação deve ficar dentro de 1 mês (máx. 31 dias).' };
            return { ok: true };
        }

        if (normalizedType === 'micros') {
            const startRef = String(inicioDate || this.getLocalDateKey());
            const days = this.getDayDiffBetween(startRef, prazo);
            if (days === null || days < 0) return { ok: false, message: 'Micro Ação precisa de início e prazo válidos.' };
            if (days > 7) return { ok: false, message: 'Micro Ação deve ficar dentro de 1 semana (máx. 7 dias).' };
            return { ok: true };
        }

        return { ok: true };
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
            const macros = (e.macros || []).filter(m => m.metaId === entityId);
            const micros = (e.micros || []).filter(m => m.metaId === entityId);
            return { okrs: okrs.length, macros: macros.length, micros: micros.length };
        }
        if (entityType === 'okrs') {
            const macros = (e.macros || []).filter(m => m.okrId === entityId);
            const micros = (e.micros || []).filter(m => m.okrId === entityId);
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

    openWeeklyPlanModal: function() {
        const state = window.sistemaVidaState;
        const weekKey = this._getWeekKey();

        // Formata o rótulo da semana
        const weekStart = new Date(weekKey + 'T00:00:00');
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const label = document.getElementById('weekly-plan-week-label');
        if (label) label.textContent = `Semana de ${fmt(weekStart)} a ${fmt(weekEnd)}`;

        // Pré-preenche com plano existente para esta semana (se houver)
        const existing = (state.weekPlans || {})[weekKey] || {};
        const trailSuggestion = this._wizardPlanSuggestion || null;
        const suggestedMicros = Array.isArray(trailSuggestion?.microIds) ? trailSuggestion.microIds : [];
        const intentionEl = document.getElementById('wp-intention');
        const energyEl = document.getElementById('wp-energy');
        if (intentionEl) intentionEl.value = existing.intention || trailSuggestion?.intention || '';
        if (energyEl) energyEl.value = existing.energyForecast || 3;

        // Monta lista de micros ativos
        const microsContainer = document.getElementById('wp-micros-list');
        if (microsContainer) {
            const activeMicros = (state.entities?.micros || []).filter(m => m.status !== 'done' && !m.completed);
            if (activeMicros.length === 0) {
                microsContainer.innerHTML = '<p class="text-xs text-outline italic">Nenhum micro ativo disponível.</p>';
            } else {
                microsContainer.innerHTML = activeMicros.map(m => {
                    const checked = ((existing.selectedMicros || []).includes(m.id) || suggestedMicros.includes(m.id)) ? 'checked' : '';
                    const macroTitle = state.entities.macros?.find(ma => ma.id === m.macroId)?.title || '';
                    const sub = macroTitle ? `<span class="text-[10px] text-outline block">${macroTitle}</span>` : '';
                    return `<label class="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-primary/5 transition-colors">
                        <input type="checkbox" class="wp-micro-check mt-0.5 accent-primary" value="${m.id}" ${checked}>
                        <span class="text-sm text-on-surface leading-snug">${m.title}${sub}</span>
                    </label>`;
                }).join('');
            }
        }

        document.getElementById('weekly-plan-modal').classList.remove('hidden');
        this._wizardPlanSuggestion = null;
    },

    closeWeeklyPlanModal: function() {
        document.getElementById('weekly-plan-modal').classList.add('hidden');
    },

    saveWeeklyPlan: function() {
        const weekKey = this._getWeekKey();
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

        this.saveState(true);
        this.closeWeeklyPlanModal();
        this.showNotification('Plano semanal salvo!');
    },

    openReviewModal: function() {
        document.getElementById('review-form').reset();

        // Auto-preenche q1/q2 a partir do plano semanal
        const state = window.sistemaVidaState;
        const weekKey = this._getWeekKey();
        const plan = (state.weekPlans || {})[weekKey];

        if (plan) {
            const q1El = document.getElementById('rev-q1');
            const q2El = document.getElementById('rev-q2');

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
        }

        document.getElementById('review-modal').classList.remove('hidden');
    },

    closeReviewModal: function() {
        document.getElementById('review-modal').classList.add('hidden');
    },

    saveReview: function() {
        const q1 = document.getElementById('rev-q1').value.trim();
        const q2 = document.getElementById('rev-q2').value.trim();
        const q3 = document.getElementById('rev-q3').value.trim();
        const q4 = document.getElementById('rev-q4').value.trim();
        const q5 = document.getElementById('rev-q5').value.trim();

        // Salva pelo weekKey da segunda-feira (igual à chave de weekPlans)
        const weekKey = this._getWeekKey();
        if (!window.sistemaVidaState.reviews) {
            window.sistemaVidaState.reviews = {};
        }

        window.sistemaVidaState.reviews[weekKey] = { q1, q2, q3, q4, q5, savedAt: new Date().toISOString() };

        this.saveState(true);

        const btn = document.getElementById('btn-save-review');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✔ Revisão Salva!";
            setTimeout(() => {
                btn.innerHTML = originalText;
                this.closeReviewModal();
            }, 1000);
        } else {
            this.closeReviewModal();
        }
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
        profile: {
          name: 'Viajante', level: 1, xp: 0, values: [], legacy: '',
          ikigai: { missao: '', vocacao: '', love: '', good: '', need: '', paid: '', sintese: '', sinteseResumo: '' },
          legacyObj: { familia: '', profissao: '', mundo: '', familiaResumo: '', profissaoResumo: '', mundoResumo: '' },
          vision: { saude: '', carreira: '', intelecto: '', quote: '', saudeResumo: '', carreiraResumo: '', intelectoResumo: '' },
          odyssey: { cenarioA: '', cenarioB: '', cenarioC: '' },
          odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' }
        },
        energy: 5,
        dimensions: {
          'Saúde': { score: 1 }, 'Mente': { score: 1 }, 'Carreira': { score: 1 },
          'Finanças': { score: 1 }, 'Relacionamentos': { score: 1 },
          'Família': { score: 1 }, 'Lazer': { score: 1 }, 'Propósito': { score: 1 }
        },
        perma: { P: 5, E: 5, R: 5, M: 5, A: 5 },
        swls: { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} },
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
          const imagesRef = doc(db, 'users', 'meu-sistema-vida-images');
          await this.withTimeout(
            setDoc(imagesRef, { avatarUrl: '', odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' } }),
            8000, 'firestore_clearImages'
          );
        } catch (imgErr) {
          console.warn('[Reset] Falha ao limpar imagens do Firestore (ignorado):', imgErr);
        }
        // ── Apaga imagens do localStorage ──────────────────────────────────────
        try { localStorage.removeItem('lifeos_profile_avatar'); } catch (_) {}
        try { localStorage.removeItem('lifeos_odyssey_images'); } catch (_) {}
        // ── Se for reset total (sem mockup), força onboarding na próxima carga ─
        if (!useMockup) {
          try { localStorage.setItem('lifeos_onboarding_complete', '0'); } catch (_) {}
        }
        // ── Desliga listeners em tempo real ──
        try { if (this._realtimeSyncUnsub) { this._realtimeSyncUnsub(); this._realtimeSyncUnsub = null; } } catch (_) {}
        try { if (this._imagesSyncUnsub) { this._imagesSyncUnsub(); this._imagesSyncUnsub = null; } } catch (_) {}
        // ── Grava o novo estado SEM merge ──
        await getAuthReady();
        const stateRef = doc(db, 'users', 'meu-sistema-vida');
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
        
        const activeOkrs = state.entities.okrs.filter(o => o.status === 'active');
        
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
        
        const dimensions = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
        let html = '';
        
        dimensions.forEach(dim => {
            const score = (state.dimensions && state.dimensions[dim]) ? state.dimensions[dim].score : 1;
            html += `
            <div class="space-y-1">
                <div class="flex justify-between text-xs font-label uppercase tracking-widest text-outline font-bold">
                    <label>${dim}</label>
                    <span id="val-wheel-${dim}">${score}</span>
                </div>
                <input type="range" id="slider-wheel-${dim}" data-dim="${dim}" min="1" max="100" value="${score}" class="w-full accent-primary" oninput="document.getElementById('val-wheel-${dim}').textContent = this.value" style="touch-action: none; overscroll-behavior: contain;">
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
        if (!state.dimensions) state.dimensions = {};
        
        const container = document.getElementById('wheel-sliders-container');
        if (container) {
            const ranges = container.querySelectorAll('input[type="range"]');
            ranges.forEach(range => {
                const dim = range.getAttribute('data-dim');
                if (dim) {
                    if (!state.dimensions[dim]) state.dimensions[dim] = { score: 1 };
                    state.dimensions[dim].score = parseInt(range.value, 10);
                }
            });
        }
        
        this.saveState(false);
        this.closeWheelModal();
        if (this.render.proposito) this.render.proposito();
        if (this.render.painel) this.render.painel();
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
            // Motor de revisão: busca todos os cartões de OKR no modal
            const items = document.querySelectorAll('#quarterly-okrs-list div[data-okr-id]');
            if (items.length === 0) {
                state.cycleStartDate = this.getLocalDateKey();
                await this.saveState(true);
                this.closeQuarterlyModal();
                this.showToast('Novo ciclo iniciado. Nenhum OKR ativo para revisar.', 'success');
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
                        state.entities.micros.forEach(micro => {
                            if (macrosIds.includes(micro.macroId) && micro.status !== 'done' && micro.prazo !== todayStr) {
                                micro.prazo = todayStr;
                                migrated++;
                            }
                        });
                    }
                }
                processed++;
            });

            // Reset do ciclo para a data atual
            state.cycleStartDate = this.getLocalDateKey();
            await this.saveState(true);
            this.closeQuarterlyModal();

            const summary = `${processed} OKRs: ${concluded} concluídos, ${archived} arquivados, ${carried} continuados` + (migrated ? `, ${migrated} micros migradas` : '');
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

    saveNewEntity: function() {
        const titleInput = document.getElementById('crud-title');
        const title = titleInput ? titleInput.value.trim() : '';
        
        if (!title) {
            if (this.showToast) this.showToast('Por favor, insira um título.', 'error');
            else alert('Por favor, insira um título.');
            return;
        }

        const type = document.getElementById('crud-type').value;
        const dimension = document.getElementById('crud-dimension').value;
        const context = document.getElementById('crud-context').value;
        const trigger = (type === 'habits' && document.getElementById('crud-trigger')) ? document.getElementById('crud-trigger').value.trim() : '';
        if (type === 'habits') {
            const routineVal = document.getElementById('habit-routine') ? document.getElementById('habit-routine').value.trim() : '';
            const rewardVal = document.getElementById('habit-reward') ? document.getElementById('habit-reward').value.trim() : '';
            if (!trigger || !routineVal || !rewardVal) {
                this.showToast('Para hábitos, preencha gatilho, rotina e recompensa do dia.', 'error');
                return;
            }
        }

        const usaAgendamento = ['okrs', 'macros', 'micros'].includes(type);
        let prazo = '';
        let inicioDate = '';
        if (usaAgendamento) {
            inicioDate = document.getElementById('crud-inicio-date')?.value || '';
            prazo = document.getElementById('crud-prazo-date')?.value || '';
            if (type !== 'okrs' && !inicioDate && prazo) inicioDate = prazo; // fallback retrô para macro/micro
            if (!prazo && inicioDate) prazo = inicioDate; // consistência mínima
        } else {
            prazo = document.getElementById('create-prazo')?.value || '';
        }

        const parentId = document.getElementById('create-parent') ? document.getElementById('create-parent').value : '';
        let metaHorizonYears = Number(document.getElementById('crud-meta-horizon')?.value || 1);
        const successCriteria = (document.getElementById('crud-success-criteria')?.value || '').trim();
        const challengeLevel = Number(document.getElementById('crud-challenge-level')?.value || 3);
        const commitmentLevel = Number(document.getElementById('crud-commitment-level')?.value || 3);
        const keyResults = this.parseKeyResultsText(document.getElementById('crud-key-results')?.value || '');

        const isEditing = !!this.editingEntity;
        const id = isEditing ? this.editingEntity.id : 'ent_' + Date.now() + Math.random().toString(36).substr(2, 5);
        if (type === 'metas') {
            const horizonAlign = this.alignMetaHorizonSelection({
                prazo,
                selectedHorizonYears: metaHorizonYears,
                selectElementId: 'crud-meta-horizon'
            });
            if (!horizonAlign.ok) {
                app.showToast(horizonAlign.message || 'Ajuste o horizonte da meta antes de salvar.', 'error');
                return;
            }
            metaHorizonYears = horizonAlign.horizonYears;
        }
        const windowValidation = this.validateEntityTimeWindow(type, { prazo, inicioDate, metaHorizonYears });
        if (!windowValidation.ok) {
            app.showToast(windowValidation.message, 'error');
            return;
        }

        const obj = { id: id || '', title: title || '', dimension: dimension || 'Geral', prazo: prazo || '' };
        if (usaAgendamento && inicioDate) obj.inicioDate = inicioDate;

        const getOldItem = (eid, etype) => {
            const state = window.sistemaVidaState;
            const list = etype === 'habits' ? state.habits : state.entities[etype];
            return (list || []).find(e => e.id === eid) || {};
        };
        const oldEntity = isEditing ? getOldItem(id, type) : {};
        if (['metas', 'okrs', 'macros', 'micros'].includes(type)) {
            obj.createdAt = oldEntity.createdAt || this.getLocalDateKey();
        }

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
                if (parentId) obj.metaId = parentId || '';
                const okrCriterion = successCriteria || context || '';
                if (!okrCriterion.trim()) {
                    app.showToast('Defina o Critério / Meta do OKR para salvar.', 'error');
                    return;
                }
                obj.successCriteria = okrCriterion;
                obj.purpose = okrCriterion;
                obj.keyResults = keyResults;
                const oldItem = getOldItem(id, 'okrs');
                obj.rewarded70 = !!oldItem.rewarded70;
                const krProgress = this.computeKeyResultsProgress(obj.keyResults);
                if (krProgress !== null) obj.progress = krProgress;
            }
        } else if (type === 'macros') {
            obj.description = context || '';
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (parentId) {
                obj.okrId = parentId;
                const okr = window.sistemaVidaState.entities.okrs.find(o => o.id === parentId);
                if (okr) obj.metaId = okr.metaId || '';
            }
        } else if (type === 'micros') {
            if (obj.inicioDate && obj.prazo) {
                const start = new Date(obj.inicioDate + 'T00:00:00');
                const end = new Date(obj.prazo + 'T00:00:00');
                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
                    app.showToast('Datas inválidas para Micro Ação. Verifique início e prazo.', 'error');
                    return;
                }
                const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                if (diffDays > 7) {
                    app.showToast('Uma Micro Ação não pode durar mais de 7 dias. Divida-a em partes menores ou classifique como Macro Ação.', 'error');
                    return;
                }
            }
            obj.indicator = context || '';
            const oldItem = getOldItem(id, 'micros');
            obj.status = isEditing ? (oldItem.status || 'pending') : 'pending';
            obj.completed = obj.status === 'done';
            obj.progress = obj.completed ? 100 : 0;
            
            if (parentId) {
                const macro = window.sistemaVidaState.entities.macros.find(m => m.id === parentId);
                if (macro) {
                    obj.macroId = macro.id || '';
                    obj.okrId = macro.okrId || '';
                    obj.metaId = macro.metaId || '';
                }
            }
        } else if (type === 'habits') {
            obj.context = '';
            obj.completed = isEditing ? (getOldItem(id, 'habits').completed || false) : false;
            obj.trigger = trigger || '';
            obj.routine = (document.getElementById('habit-routine') ? document.getElementById('habit-routine').value.trim() : '') || title;
            obj.reward = document.getElementById('habit-reward') ? document.getElementById('habit-reward').value.trim() : '';
            const stepsRaw = document.getElementById('habit-steps') ? document.getElementById('habit-steps').value : '';
            obj.steps = stepsRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            obj.trackMode = document.getElementById('habit-track-mode') ? document.getElementById('habit-track-mode').value : 'boolean';
            obj.targetValue = document.getElementById('habit-target') ? parseFloat(document.getElementById('habit-target').value) : 1;
            obj.frequency = document.getElementById('habit-frequency') ? document.getElementById('habit-frequency').value : 'daily';
            const daysSelect = document.getElementById('habit-days');
            if (daysSelect && obj.frequency === 'specific') {
                obj.specificDays = Array.from(daysSelect.selectedOptions).map(o => o.value);
            } else {
                obj.specificDays = [];
            }
            obj.logs = isEditing ? (getOldItem(id, 'habits').logs || {}) : {};
            obj.stepLogs = isEditing ? (getOldItem(id, 'habits').stepLogs || {}) : {};
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
        }

        this.editingEntity = null;
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

    // ------------------------------------------------------------------------
    // Review Próximo Nível (Promotion & Reassignment)
    // ------------------------------------------------------------------------
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
        const typeLabels = { metas: 'Meta', okrs: 'OKR', macros: 'Macro Ação', micros: 'Micro Ação' };
        title.textContent = `Gerir ${typeLabels[type] || 'Entidade'}: ${entity.title}`;

        // Configuração de Promoção
        if (type === 'metas') {
            promoteSection.classList.add('hidden');
        } else {
            promoteSection.classList.remove('hidden');
            const nextLevel = { okrs: 'Meta', macros: 'OKR', micros: 'Macro Ação' };
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
                parentTypeLabel = 'Selecionar Novo OKR';
            } else if (type === 'micros') {
                potentialParents = state.entities.macros;
                currentParentId = entity.macroId;
                parentTypeLabel = 'Selecionar Nova Macro';
            }

            parentLabel.textContent = parentTypeLabel;
            parentSelect.innerHTML = potentialParents.map(p => 
                `<option value="${p.id}" ${p.id === currentParentId ? 'selected' : ''}>${p.title}</option>`
            ).join('');
            
            if (potentialParents.length === 0) {
                parentSelect.innerHTML = '<option value="">Nenhum pai disponível</option>';
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
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

    updateHabitLog: function(habitId, dateStr, value) {
        const state = window.sistemaVidaState;
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            if (!habit.logs) habit.logs = {};
            habit.logs[dateStr] = value;
            if (Array.isArray(habit.steps) && habit.steps.length > 0) {
                if (!habit.stepLogs) habit.stepLogs = {};
                const markAll = value > 0;
                const map = {};
                if (markAll) habit.steps.forEach((_, idx) => { map[idx] = true; });
                habit.stepLogs[dateStr] = map;
            }
            
            // Legacy sync removed to avoid hybrid state contradictions
            // Derive completion dynamically from log values during render cycle.
            this.saveState(true);

            // Toast feedback based on new value
            const target = habit.targetValue || 1;
            const isDone = (habit.trackMode || 'boolean') === 'boolean' ? value > 0 : value >= target;
            if (isDone && typeof showIdentityToast === 'function') {
                showIdentityToast(habit.title, habit.dimension);
            }
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
        const current = !!(habit.stepLogs[dateStr][stepIndex] || habit.stepLogs[dateStr][String(stepIndex)]);
        habit.stepLogs[dateStr][stepIndex] = !current;
        const doneCount = habit.steps.reduce((acc, _, idx) => acc + (habit.stepLogs[dateStr][idx] ? 1 : 0), 0);
        const allDone = doneCount === habit.steps.length;
        if (!habit.logs) habit.logs = {};
        if ((habit.trackMode || 'boolean') === 'boolean') {
            habit.logs[dateStr] = allDone ? 1 : 0;
        }
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
        if (currentlyDone) {
            habit.stepLogs[dateStr] = {};
            if ((habit.trackMode || 'boolean') === 'boolean') habit.logs[dateStr] = 0;
        } else {
            const all = {};
            habit.steps.forEach((_, idx) => { all[idx] = true; });
            habit.stepLogs[dateStr] = all;
            if ((habit.trackMode || 'boolean') === 'boolean') habit.logs[dateStr] = 1;
        }
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

        this.saveState(true);

        const btn = document.getElementById('btn-salvar-diario');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✔ Salvo!";
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        }
    },

    // ------------------------------------------------------------------------
    // Onboarding Experience Logic
    // ------------------------------------------------------------------------
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
        if (indicator) indicator.textContent = `${step + 1}/6`;

        // Renderização especial do resumo
        if (step === 5) {
            const state = window.sistemaVidaState;
            const nameEl = document.getElementById('conclusao-nome');
            const valuesEl = document.getElementById('conclusao-valores');
            if (nameEl) nameEl.textContent = state.profile.name;
            if (valuesEl) valuesEl.textContent = (state.profile.values || []).join(', ');
        }
    },

    onboardingSaveCurrentStep: function(persist = true) {
        const state = window.sistemaVidaState;
        if (this.onboardingStep === 1) {
            const nameInput = document.getElementById('onboarding-nome');
            if (nameInput) state.profile.name = nameInput.value.trim() || "Viajante";
        } else if (this.onboardingStep === 2) {
            // Valores da Roda já são atualizados em tempo real via onboardingUpdateSlider
        } else if (this.onboardingStep === 3) {
            // Valores já salvos em tempo real via onboardingToggleValor
        } else if (this.onboardingStep === 4) {
            const purposeInput = document.getElementById('onboarding-proposito');
            if (purposeInput) state.profile.purpose = purposeInput.value.trim();
        }
        if (persist) this.saveState();
    },

    onboardingNext: function() {
        this.onboardingSaveCurrentStep();
        if (this.onboardingStep < 5) {
            this.onboardingGoTo(this.onboardingStep + 1);
        }
    },

    onboardingBack: function() {
        if (this.onboardingStep > 0) {
            this.onboardingGoTo(this.onboardingStep - 1);
        }
    },

    onboardingComplete: function() {
        this.onboardingSaveCurrentStep(false);
        window.sistemaVidaState.onboardingComplete = true;
        this.saveState();
        this.navigate('hoje');
    },

    onboardingUpdateSlider: function(dim, val) {
        if (window.sistemaVidaState.dimensions[dim]) {
            window.sistemaVidaState.dimensions[dim].score = parseInt(val);
            const valEl = document.getElementById(`slider-val-${dim}`);
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

    // ------------------------------------------------------------------------
    // Rendering Engine (Data Binding)
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

    render: {
        onboarding: function() {
            // Inicializa o primeiro passo
            app.onboardingGoTo(0);
        },
        painel: function() {
            const state = window.sistemaVidaState;
            app.syncDeepWorkMicroStatus();
            const filter = app.painelFilter || 'semana';

            // ---------------------------------------------------------
            // CÁLCULO DE FOCO E EXECUÇÃO
            // ---------------------------------------------------------
            let micros = state.entities.micros || [];
            let macros = state.entities.macros || [];
            
            // Filtro Temporal
            if (filter === 'semana') {
                micros = micros.filter(m => app.isDateInCurrentWeek(m.prazo));
                macros = macros.filter(m => app.isDateInCurrentWeek(m.prazo));
                // Se existe plano ativo, usa selectedMicros como base para execScore
                const weekKey = this._getWeekKey();
                const weekPlan = (state.weekPlans || {})[weekKey];
                if (weekPlan && weekPlan.selectedMicros && weekPlan.selectedMicros.length > 0) {
                    const plannedIds = new Set(weekPlan.selectedMicros);
                    micros = micros.filter(m => plannedIds.has(m.id));
                }
            } else if (filter === 'mes') {
                micros = micros.filter(m => app.isDateInCurrentMonth(m.prazo));
                macros = macros.filter(m => app.isDateInCurrentMonth(m.prazo));
            }
            
            // Execução: % de Micro Ações Concluídas
            const totalMicros = micros.length;
            const doneMicros = micros.filter(m => m.status === 'done').length;
            const execScore = totalMicros === 0 ? 0 : Math.round((doneMicros / totalMicros) * 100);
            
            // Foco: % de Macro Ações Concluídas (Visão Tática)
            const totalMacros = macros.length;
            const doneMacros = macros.filter(m => m.status === 'done').length;
            const focoScore = totalMacros === 0 ? 0 : Math.round((doneMacros / totalMacros) * 100);

            // Atualiza a UI do Painel
            const focoVal = document.getElementById('painel-foco-val');
            const focoBar = document.getElementById('painel-foco-bar');
            const execVal = document.getElementById('painel-exec-val');
            const execBar = document.getElementById('painel-exec-bar');
            const concluidasVal = document.getElementById('painel-concluidas-val');
            const atrasadasVal = document.getElementById('painel-atrasadas-val');

            if (focoVal) focoVal.textContent = focoScore + '%';
            if (focoBar) focoBar.style.width = focoScore + '%';
            if (execVal) execVal.textContent = execScore + '%';
            if (execBar) execBar.style.width = execScore + '%';
            if (concluidasVal) concluidasVal.textContent = doneMicros;
            
            if (atrasadasVal) {
                const todayStr = new Date().toISOString().split('T')[0];
                const delayedMicros = micros.filter(m => m.status !== 'done' && m.prazo && m.prazo < todayStr).length;
                atrasadasVal.textContent = delayedMicros;
            }
            // ---------------------------------------------------------
            
            // Fix Filter Buttons Highlight
            document.querySelectorAll('header .flex.gap-2 button').forEach(btn => {
                const btnType = btn.getAttribute('data-painel-filter');
                const isSelected = btnType === filter;
                btn.className = isSelected ? 
                    'px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-medium transition-transform active:scale-95' :
                    'px-5 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-container-highest transition-colors';
            });

            // Cycle Progress Logic
            const cycleStart = new Date(state.cycleStartDate || new Date());
            const today = new Date();
            const diffDays = Math.ceil((today - cycleStart) / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.ceil(diffDays / 7) || 1;
            const cyclePercent = Math.min(100, Math.round((diffDays / 84) * 100)); // 12 weeks = 84 days

            const cycleBar = document.getElementById('cycle-progress-bar');
            const cycleVal = document.getElementById('cycle-percent-val');
            const cycleWeekText = document.getElementById('cycle-week-text');
            
            if (cycleBar) cycleBar.style.width = cyclePercent + '%';
            if (cycleVal) cycleVal.textContent = cyclePercent + '%';
            if (cycleWeekText) cycleWeekText.textContent = `Semana ${diffWeeks} de 12`;

            // Dynamic OKR Rendering
            const okrList = document.getElementById('painel-okr-list');
            if (okrList) {
                const activeOkrs = (state.entities.okrs || []).filter(o => o.status !== 'done' && o.status !== 'abandoned').slice(0, 3);
                if (activeOkrs.length === 0) {
                    okrList.innerHTML = '<p class="text-xs text-outline italic">Nenhum objetivo ativo. Defina um novo OKR para começar.</p>';
                } else {
                    okrList.innerHTML = activeOkrs.map(okr => `
                        <div class="flex items-start gap-3">
                            <div class="mt-1 w-2 h-2 rounded-full bg-primary shrink-0"></div>
                            <div class="text-sm text-on-surface leading-relaxed">${okr.title}</div>
                        </div>
                    `).join('');
                }
            }

            // Dimension Scores Rendering
            document.querySelectorAll('[data-dimension]').forEach(card => {
                const dim = card.getAttribute('data-dimension');
                const score = state.dimensions[dim]?.score || 0;
                const text = card.querySelector('.dim-score-text');
                const ring = card.querySelector('.dim-score-ring');
                
                if (text) text.textContent = score + '%';
                if (ring) {
                    const offset = 88 - (88 * (score / 100));
                    ring.style.strokeDashoffset = offset;
                }
            });

            // 1. Ativa o Gráfico de Execução (Heatmap)
            this.renderAnnualHeatmap();

            // 2. Calcula e Renderiza a Distribuição de Foco
            this.renderFocusDistribution('focus-distribution');
        },
        renderFocusDistribution: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const state = window.sistemaVidaState;
            const dimKeys = ['Saude', 'Mente', 'Carreira', 'Financas', 'Relacionamentos', 'Familia', 'Lazer', 'Proposito'];
            const dimLabels = {
                Saude: 'Saude',
                Mente: 'Mente',
                Carreira: 'Carreira',
                Financas: 'Financas',
                Relacionamentos: 'Relacionamentos',
                Familia: 'Familia',
                Lazer: 'Lazer',
                Proposito: 'Proposito'
            };
            const typeMap = { Macro: 'Macros', Micro: 'Micros' };
            const typeFilter = typeMap[app.focusTypeFilter] || app.focusTypeFilter || 'Tudo';
            const statusFilter = app.focusStatusFilter || 'Tudo';

            const normalizeText = (value) => String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const normalizeDim = (dimRaw) => {
                const low = normalizeText(dimRaw || 'Geral');
                if (low.includes('sa')) return 'Saude';
                if (low.includes('ment')) return 'Mente';
                if (low.includes('carr')) return 'Carreira';
                if (low.includes('fin')) return 'Financas';
                if (low.includes('relac')) return 'Relacionamentos';
                if (low.includes('fam')) return 'Familia';
                if (low.includes('laz')) return 'Lazer';
                if (low.includes('prop')) return 'Proposito';
                return 'Geral';
            };

            const statusFilterNorm = normalizeText(statusFilter);
            const matchesStatusFilter = (item) => {
                const isDone = item.status === 'done' || item.completed === true;
                const isInProgress = item.status === 'in_progress';
                if (statusFilterNorm === 'pendentes') return !isDone && !isInProgress;
                if (statusFilterNorm === 'em andamento' || statusFilterNorm === 'em_andamento') return isInProgress;
                if (statusFilterNorm.includes('conclu')) return isDone;
                return true;
            };

            const stats = {};
            dimKeys.forEach(d => {
                stats[d] = { focusEffort: 0, focusItems: 0, total: 0, done: 0, inProgress: 0, pending: 0 };
            });

            document.querySelectorAll('[data-focus-type]').forEach(btn => {
                const raw = btn.getAttribute('data-focus-type');
                const t = typeMap[raw] || raw;
                btn.className = t === typeFilter
                    ? "shrink-0 px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase transition-all"
                    : "shrink-0 px-3 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-bold uppercase hover:bg-surface-container-highest transition-all";
            });

            document.querySelectorAll('[data-focus-status]').forEach(btn => {
                const s = btn.getAttribute('data-focus-status');
                btn.className = s === statusFilter
                    ? "shrink-0 px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase transition-all"
                    : "shrink-0 px-3 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-bold uppercase hover:bg-surface-container-highest transition-all";
            });

            const lists = [
                { typeName: 'Metas', list: state.entities.metas, weight: 6 },
                { typeName: 'OKRs', list: state.entities.okrs, weight: 4 },
                { typeName: 'Macros', list: state.entities.macros, weight: 2 },
                { typeName: 'Micros', list: state.entities.micros, weight: 1 }
            ];

            lists.forEach(({ typeName, list, weight }) => {
                if (typeFilter !== 'Tudo' && typeFilter !== typeName) return;
                (list || []).forEach(item => {
                    if (!matchesStatusFilter(item)) return;
                    const dim = normalizeDim(item.dimension || 'Geral');
                    if (!stats[dim]) return;
                    const isDone = item.status === 'done' || item.completed === true;
                    const isInProgress = item.status === 'in_progress';
                    stats[dim].total += 1;
                    if (isDone) stats[dim].done += 1;
                    else if (isInProgress) stats[dim].inProgress += 1;
                    else stats[dim].pending += 1;
                    stats[dim].focusEffort += weight;
                    stats[dim].focusItems += 1;
                });
            });

            const totalFocusEffort = dimKeys.reduce((sum, d) => sum + stats[d].focusEffort, 0);

            const renderOneLine = (dim) => {
                const s = stats[dim];
                const focusPct = totalFocusEffort > 0 ? Math.round((s.focusEffort / totalFocusEffort) * 100) : 0;
                const donePct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                const inProgressPct = s.total > 0 ? Math.round((s.inProgress / s.total) * 100) : 0;
                const pendingPct = s.total > 0 ? Math.max(0, 100 - donePct - inProgressPct) : 0;
                return `
                <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3 min-w-0">
                    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2 min-w-0">
                        <span class="text-[10px] uppercase tracking-widest font-bold text-outline">${dimLabels[dim]}</span>
                        <span class="text-[10px] font-bold text-primary">Foco ${focusPct}% (${s.focusItems})</span>
                        <span class="text-[10px] text-emerald-600 font-semibold">C ${donePct}%</span>
                        <span class="text-[10px] text-amber-600 font-semibold">A ${inProgressPct}%</span>
                        <span class="text-[10px] text-outline font-semibold">P ${pendingPct}%</span>
                    </div>
                    <div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full transition-all duration-700 flex" style="width:${focusPct}%">
                            <div class="h-full bg-emerald-500" style="width:${donePct}%"></div>
                            <div class="h-full bg-amber-500" style="width:${inProgressPct}%"></div>
                            <div class="h-full bg-slate-300 dark:bg-slate-600" style="width:${pendingPct}%"></div>
                        </div>
                    </div>
                </div>`;
            };

            container.innerHTML = dimKeys.map(dim => renderOneLine(dim)).join('');
        },

        foco: function() {
            const state = window.sistemaVidaState;
            app.normalizeDeepWorkState();
            app.syncDeepWorkMicroStatus();
            app.renderSidebarValues();

            app.renderDeepWorkPanel();

            // Micros Management List
            const listContainer = document.getElementById('micros-management-list');
            if (listContainer) {
                app.syncFocoPlannedFilterOption();
                const dimFilter = document.getElementById('todo-dimension-filter')?.value || 'Tudo';
                const statusFilter = document.getElementById('todo-status-filter')?.value || 'all';

                let filtered = app.getPlanMicros({ includeDone: true }).filter(m => {
                    const matchDim = dimFilter === 'Tudo' || m.dimension === dimFilter;
                    const matchStatus = statusFilter === 'all' ||
                                       (statusFilter === 'active' && m.status !== 'done') || // legado
                                       (statusFilter === 'pending' && m.status !== 'done' && m.status !== 'in_progress') ||
                                       (statusFilter === 'in_progress' && m.status === 'in_progress') ||
                                       (statusFilter === 'done' && m.status === 'done') ||
                                       (statusFilter === 'planned' && app._isPlannedThisWeek(m.id));
                    return matchDim && matchStatus;
                });

                // Ordenar por prazo
                filtered.sort((a,b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));

                listContainer.innerHTML = filtered.map(m => {
                    const ctx = app.getMicroPlanContext(m);
                    const focusText = app.formatDurationHuman(m.focusSec || 0);
                    const sessionCount = Number(m.focusSessions || 0);
                    const statusText = m.status === 'done' ? 'Concluída' : (m.status === 'in_progress' ? 'Em andamento' : 'Pendente');
                    const isTimerMicro = state.deepWork?.isRunning && state.deepWork?.microId === m.id;
                    const actionLabel = (m.status === 'in_progress' || isTimerMicro) ? 'Gerenciar' : 'Focar';
                    const actionHandler = (m.status === 'in_progress' || isTimerMicro)
                        ? `window.app.openMicroInFocus('${m.id}', false)`
                        : `window.app.startDeepWorkForMicro('${m.id}')`;
                    const isFocoPlanned = app._isPlannedThisWeek(m.id);
                    const focoPlannedBadge = isFocoPlanned
                        ? '<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest"><span class="material-symbols-outlined notranslate text-[10px]">event</span>Semana</span>'
                        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[9px] font-bold uppercase tracking-widest">Captura</span>';
                    return `
                    <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group min-w-0">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full">
                                ${app.escapeHtml(m.dimension || 'Geral')}
                            </span>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.app.editEntity('${m.id}', 'micros')" class="p-1 hover:text-primary"><span class="material-symbols-outlined notranslate text-sm">edit</span></button>
                                <button onclick="window.app.deleteEntity('${m.id}', 'micros')" class="p-1 hover:text-error"><span class="material-symbols-outlined notranslate text-sm">delete</span></button>
                            </div>
                        </div>
                        <h3 class="font-bold text-on-surface mb-1 line-clamp-2">${app.escapeHtml(m.title)}</h3>
                        <div class="mb-2">${focoPlannedBadge}</div>
                        <p class="text-xs text-outline mb-3 line-clamp-2">${app.escapeHtml(ctx.path)}</p>
                        <div class="grid grid-cols-2 gap-2 mb-4 text-[10px]">
                            <div class="rounded-lg bg-surface-container-low px-3 py-2">
                                <span class="block uppercase tracking-widest text-outline font-bold">Foco</span>
                                <span class="font-bold text-primary">${focusText}</span>
                            </div>
                            <div class="rounded-lg bg-surface-container-low px-3 py-2">
                                <span class="block uppercase tracking-widest text-outline font-bold">Sessões</span>
                                <span class="font-bold text-on-surface">${sessionCount}</span>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-outline-variant/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div class="flex items-center gap-2 text-outline">
                                <span class="material-symbols-outlined notranslate text-xs">event</span>
                                <span class="text-[10px] font-bold uppercase">${m.prazo ? m.prazo.split('-').reverse().slice(0,2).join('/') : 'S/P'}</span>
                                <span class="text-[10px] font-bold uppercase">${statusText}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                ${m.status !== 'done' ? `<button onclick="${actionHandler}" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20">${actionLabel}</button>` : ''}
                                ${m.status === 'done' ?
                                    `<span class="text-[10px] font-bold uppercase text-green-600 flex items-center gap-1"><span class="material-symbols-outlined notranslate text-xs">check_circle</span> Concluída</span>` :
                                    `<button onclick="window.app.completeMicroAction('${m.id}')" class="text-[10px] font-bold uppercase text-primary hover:underline">Concluir</button>`
                                }
                            </div>
                        </div>
                    </div>
                `;
                }).join('');

                if (filtered.length === 0) {
                    listContainer.innerHTML = `<div class="col-span-full rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center">
                        <span class="material-symbols-outlined notranslate text-3xl text-outline mb-2">checklist</span>
                        <p class="font-bold text-on-surface">Nenhuma micro ação encontrada.</p>
                        <p class="text-sm text-on-surface-variant mt-1">Crie uma micro em Planos ou ajuste os filtros para montar sua fila de execução.</p>
                    </div>`;
                }
            }

            if (app.pendingFocusMicroId) {
                const pendingId = app.pendingFocusMicroId;
                const autoStart = !!app.pendingFocusAutoStart;
                app.pendingFocusMicroId = '';
                app.pendingFocusAutoStart = false;
                const micro = app.getPlanMicros({ includeDone: false }).find(m => m.id === pendingId);
                if (micro) {
                    state.deepWork.microId = micro.id;
                    state.deepWork.intention = micro.title || '';
                    const microEl = document.getElementById('deep-work-micro');
                    const intentionEl = document.getElementById('deep-work-intention');
                    if (microEl) microEl.value = micro.id;
                    if (intentionEl) intentionEl.value = micro.title || '';
                    if (autoStart && !state.deepWork.isRunning) app.startDeepWorkSession();
                    else app.renderDeepWorkPanel();
                    const panel = document.getElementById('deep-work-panel');
                    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        },

        renderAnnualHeatmap: function() {
            const heatmap = document.getElementById('annual-heatmap');
            if (!heatmap) return;
            
            const state = window.sistemaVidaState;
            const logs = state.dailyLogs || {};
            let html = '';
            
            // Gerar 140 quadradinhos (20 semanas x 7 dias)
            // Começa de 140 dias atrás até hoje
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 139);
            
            for (let i = 0; i < 140; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const key = d.toISOString().split('T')[0];
                const hasLog = !!logs[key];
                const color = hasLog ? 'bg-primary' : 'bg-stone-200 dark:bg-stone-800';
                
                html += `<div class="w-2 h-2 rounded-[1px] ${color}" title="${key}"></div>`;
            }
            
            heatmap.innerHTML = html;
        },

        hoje: function() {
            const state = window.sistemaVidaState;
            app.syncDeepWorkMicroStatus();

            const dateEl = document.getElementById('data-hoje');
            if (dateEl) {
                // Força data atual local para evitar cache de data de ontem
                const now = new Date();
                const opts = { weekday: 'long', day: 'numeric', month: 'long' };
                let dateStr = now.toLocaleDateString('pt-BR', opts);
                // Capitaliza primeira letra (ex: Quinta-feira -> Quinta)
                dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
                dateEl.textContent = dateStr;
                console.log("Data 'Hoje' atualizada:", dateStr);
            }

            const streakEl = document.getElementById('streak-count');
            if (streakEl) {
                const logs = window.sistemaVidaState.dailyLogs || {};
                let streak = 0;
                const check = new Date();
                check.setHours(0, 0, 0, 0);
                while (true) {
                    const key = check.toISOString().split('T')[0];
                    if (logs[key]) {
                        streak++;
                        check.setDate(check.getDate() - 1);
                    } else {
                        break;
                    }
                }
                streakEl.textContent = `${streak} ${streak === 1 ? 'Dia' : 'Dias'} de sequência`;
                const headerStreak = document.getElementById('header-streak');
                if (headerStreak) headerStreak.textContent = streak + ' dias';
            }

            // Progresso semanal — apenas Micro Ações com janela ativa nesta semana
            const weekMicros = state.entities.micros.filter(m =>
              app.isDateInCurrentWeek(m.inicioDate || m.prazo) || app.isDateInCurrentWeek(m.prazo)
            );
            const weekDone = weekMicros.filter(m => m.status === 'done').length;
            const weekProgress = weekMicros.length > 0
              ? Math.round((weekDone / weekMicros.length) * 100)
              : 0;

            const weekBar = document.getElementById('week-progress-bar');
            const weekVal = document.getElementById('week-progress-val');
            if (weekBar) weekBar.style.width = weekProgress + '%';
            if (weekVal) weekVal.textContent = weekProgress + '%';

            const heatmapEl = document.getElementById('week-days-container');
            if (heatmapEl) {
                const logs = window.sistemaVidaState.dailyLogs || {};
                const days = ['D','S','T','Q','Q','S','S'];
                const today = new Date();
                today.setHours(0,0,0,0);
                const dayOfWeek = today.getDay(); // 0=Dom
                let html = '';
                for (let i = 0; i < 7; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - dayOfWeek + i);
                    const key = d.toISOString().split('T')[0];
                    const isToday = i === dayOfWeek;
                    const hasDone = !!logs[key];
                    const isFuture = d > today;
                    let circleClass = '';
                    let inner = '';
                    if (isFuture) {
                        circleClass = 'w-7 h-7 rounded-full bg-surface-container border border-outline-variant/20';
                    } else if (hasDone) {
                        circleClass = 'w-7 h-7 rounded-full bg-[#01696f] flex items-center justify-center';
                        inner = `<span class="material-symbols-outlined notranslate text-white text-[12px]" style="font-variation-settings: 'wght' 700;">check</span>`;
                    } else if (isToday) {
                        circleClass = 'w-7 h-7 rounded-full bg-[#01696f]/15 border-2 border-[#01696f] ring-2 ring-[#01696f]/30';
                    } else {
                        circleClass = 'w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-800 border border-outline-variant/30';
                    }
                    html += `
                    <div class="flex flex-col items-center gap-2">
                        <div class="${circleClass}">${inner}</div>
                        <span class="text-[10px] text-outline font-medium">${days[i]}</span>
                    </div>`;
                }
                heatmapEl.innerHTML = html;
            }
            
            // Alertas de Risco de Início
            const riskContainer = document.getElementById('risk-alerts-container');
            if (riskContainer) {
              const alerts = window.app.getRiskAlerts();
              if (alerts.length === 0) {
                riskContainer.classList.add('hidden');
                riskContainer.innerHTML = '';
              } else {
                riskContainer.classList.remove('hidden');
                const alertConfig = {
                  overdue: { icon: 'warning', color: 'bg-error/10 border-error/30 text-error', label: 'Atrasada' },
                  hoje:    { icon: 'schedule', color: 'bg-warning/10 border-warning/30 text-warning', label: 'Vence hoje' },
                  risco:   { icon: 'timelapse', color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Em risco' },
                  urgente: { icon: 'priority_high', color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', label: 'Urgente' },
                };
                riskContainer.innerHTML = alerts.map(a => {
                  const cfg = alertConfig[a.tipo] || alertConfig.risco;
                  const diasLabel = a.tipo === 'overdue'
                    ? `${a.dias} dia${a.dias !== 1 ? 's' : ''} em atraso`
                    : a.tipo === 'hoje'
                    ? 'Vence hoje'
                    : `${a.dias} dia${a.dias !== 1 ? 's' : ''} restante${a.dias !== 1 ? 's' : ''}`;
                  return `
                    <div class="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${cfg.color} text-sm">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="material-symbols-outlined notranslate text-base shrink-0"
                              style="font-variation-settings:'FILL' 1">${cfg.icon}</span>
                        <span class="font-medium truncate">${a.title}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">${diasLabel}</span>
                        <button onclick="window.app.completeMicroAction('${a.id}')"
                                class="text-[10px] font-bold uppercase tracking-wider underline opacity-70 hover:opacity-100 transition-opacity">
                          Concluir
                        </button>
                      </div>
                    </div>`;
                }).join('');
              }
            }

            // Restore Diário
            const today = app.getLocalDateKey();
            if (state.dailyLogs && state.dailyLogs[today]) {
                const log = state.dailyLogs[today];
                const focoInput = document.getElementById('diario-foco');
                if (focoInput && log.focus) focoInput.value = log.focus;
                const g = document.getElementById('diario-gratidao'); if (g) g.value = log.gratidao || '';
                const f = document.getElementById('diario-funcionou'); if (f) f.value = log.funcionou || '';
                const s1 = document.getElementById('diario-shutdown-1');
                const shutdown = Array.isArray(log.shutdown) ? (log.shutdown[0] || '') : (log.shutdown || '');
                if (s1) s1.value = shutdown;
            }

            // Indicador de Diário Flash (Raio Amarelo)
            const flashBtn = document.getElementById('btn-open-flash');
            if (flashBtn) {
                const hasFlash = state.dailyLogs && state.dailyLogs[today] && state.dailyLogs[today].flashGratitude;
                if (hasFlash) {
                    flashBtn.classList.add('ring-4', 'ring-secondary/30');
                    if (!flashBtn.querySelector('.flash-indicator')) {
                        const badge = document.createElement('span');
                        badge.className = 'flash-indicator absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[12px] shadow-sm animate-pulse border-2 border-white dark:border-stone-900';
                        badge.innerHTML = '⚡';
                        flashBtn.style.position = 'relative';
                        flashBtn.appendChild(badge);
                    }
                } else {
                    flashBtn.classList.remove('ring-4', 'ring-secondary/30');
                    flashBtn.querySelector('.flash-indicator')?.remove();
                }
            }

            // Render Habits
            const habitsContainer = document.getElementById('habits-container');
            if (habitsContainer && state.habits) {
                const habitIconMap = {
                    'Saúde': 'fitness_center', 'Mente': 'psychology', 'Carreira': 'work',
                    'Finanças': 'payments', 'Relacionamentos': 'groups', 'Família': 'family_restroom',
                    'Lazer': 'sports_esports', 'Propósito': 'auto_awesome'
                };
                
                const todayStr = app.getLocalDateKey();
                const dayIndex = new Date().getDay().toString(); // 0(Sun) to 6(Sat)
                
                let habitsHtml = '';
                state.habits.forEach(habit => {
                    // Check if frequency allows showing today
                    if (habit.frequency === 'specific' && habit.specificDays && habit.specificDays.length > 0) {
                        if (!habit.specificDays.includes(dayIndex)) return; // skip for today
                    }

                    const icon = habitIconMap[habit.dimension] || 'stars';
                    const target = habit.targetValue || 1;
                    const mode = habit.trackMode || 'boolean';
                    const logs = habit.logs || {};
                    let currentVal = logs[todayStr] || 0;
                    const steps = Array.isArray(habit.steps) ? habit.steps.filter(Boolean) : [];
                    const hasSteps = steps.length > 0;
                    const stepLogs = habit.stepLogs || {};
                    const todayStepMap = stepLogs[todayStr] || {};
                    const todayStepsDone = hasSteps ? steps.reduce((acc, _, idx) => acc + (todayStepMap[idx] || todayStepMap[String(idx)] ? 1 : 0), 0) : 0;
                    const allStepsDone = hasSteps && todayStepsDone === steps.length;
                    
                    let isDone = false;
                    if (mode === 'boolean') isDone = currentVal > 0;
                    else isDone = currentVal >= target;
                    if (hasSteps) isDone = allStepsDone;

                    // UI for mode
                    let controlHtml = '';
                    if (mode === 'boolean') {
                        const actionClick = hasSteps
                            ? `window.app.toggleHabitAllSteps('${habit.id}', '${todayStr}', ${allStepsDone ? 'true' : 'false'})`
                            : `window.app.updateHabitLog('${habit.id}', '${todayStr}', ${isDone ? 0 : 1})`;
                        controlHtml = `
                        <div class="w-7 h-7 rounded-full ${isDone ? 'bg-primary' : 'border-2 border-outline-variant hover:border-primary'} flex items-center justify-center shrink-0 cursor-pointer transition-colors" onclick="event.stopPropagation(); ${actionClick}">
                            ${isDone ? '<span class="material-symbols-outlined notranslate text-white text-[16px]" style="font-variation-settings: \\\'wght\\\' 700;">check</span>' : ''}
                        </div>`;
                    } else if (mode === 'numeric' || mode === 'timer') {
                        controlHtml = `
                        <div class="flex items-center gap-1 bg-surface-container rounded-lg p-1 shrink-0" onclick="event.stopPropagation()">
                            <button class="w-6 h-6 flex justify-center items-center rounded-md hover:bg-outline-variant/20 text-on-surface" onclick="window.app.updateHabitLog('${habit.id}', '${todayStr}', Math.max(0, ${currentVal} - 1))">-</button>
                            <span class="text-xs font-semibold text-primary w-6 text-center">${currentVal}</span>
                            <button class="w-6 h-6 flex justify-center items-center rounded-md hover:bg-outline-variant/20 text-on-surface" onclick="window.app.updateHabitLog('${habit.id}', '${todayStr}', ${currentVal} + 1)">+</button>
                        </div>
                        `;
                    }

                    // Week progress strip
                    let weekHtml = '<div class="flex gap-1 mt-3">';
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const ds = app.getLocalDateKey(d);
                        const val = logs[ds] || 0;
                        const dayStepMap = stepLogs[ds] || {};
                        let dDone = false;
                        if (hasSteps) {
                            const dCount = steps.reduce((acc, _, idx) => acc + (dayStepMap[idx] || dayStepMap[String(idx)] ? 1 : 0), 0);
                            dDone = dCount === steps.length;
                        } else if (mode === 'boolean') dDone = val > 0;
                        else dDone = val >= target;
                        
                        weekHtml += `<div class="flex-1 h-1.5 rounded-full ${dDone ? 'bg-primary' : 'bg-surface-container-high'}" title="${ds}"></div>`;
                    }
                    weekHtml += '</div>';

                    // Track progress line
                    let progressText = '';
                    if (mode === 'numeric') progressText = `${currentVal}/${target}`;
                    if (mode === 'timer') progressText = `${currentVal}m/${target}m`;
                    if (hasSteps) progressText = `${todayStepsDone}/${steps.length} passos`;
                    
                    habitsHtml += `
                    <div onclick="window.app.editEntity('${habit.id}', 'habits')" class="min-w-[240px] max-w-[280px] bg-surface-container-low p-4 rounded-xl border border-transparent flex flex-col justify-between transition-all hover:shadow-md relative group ${isDone ? 'opacity-70' : ''} cursor-pointer">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined notranslate text-primary text-2xl">${icon}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined notranslate text-outline text-[18px] opacity-0 group-hover:opacity-100 hover:text-primary transition-all p-1 cursor-pointer" onclick="event.stopPropagation(); window.app.editEntity('${habit.id}', 'habits')">edit</span>
                                <span class="material-symbols-outlined notranslate text-outline text-[18px] opacity-0 group-hover:opacity-100 hover:text-error transition-all p-1 cursor-pointer" onclick="event.stopPropagation(); window.app.deleteEntity('${habit.id}', 'habits')">delete</span>
                                ${controlHtml}
                            </div>
                        </div>
                        <div class="mt-auto">
                            <div class="flex justify-between items-end">
                                <div class="overflow-hidden pr-2">
                                    <p class="font-medium text-on-surface text-sm ${isDone ? 'line-through' : ''} truncate">${habit.title}</p>
                                    ${habit.trigger ? `<p class="mt-1 text-[10px] text-outline italic leading-tight truncate">Gatilho: ${habit.trigger}</p>` : ''}
                                    ${habit.routine ? `<p class="mt-1 text-[10px] text-outline leading-tight truncate">Rotina: ${habit.routine}</p>` : ''}
                                    ${habit.reward ? `<p class="mt-1 text-[10px] text-primary/80 leading-tight truncate">Recompensa: ${habit.reward}</p>` : ''}
                                </div>
                                ${progressText ? `<span class="text-xs font-bold text-primary shrink-0">${progressText}</span>` : ''}
                            </div>
                            ${weekHtml}
                        </div>
                    </div>`;
                });
                
                if (state.habits.length === 0) {
                    habitsHtml = `<div class="p-4 text-xs italic text-outline">Nenhum hábito rastreado.</div>`;
                }
                
                habitsContainer.innerHTML = habitsHtml;
            }

            
            // Energy Emojis Logic
            const energyInput = document.getElementById('daily-energy');
            const energyValue = state.energy || 0;
            if (energyInput) energyInput.value = energyValue;

            const emojiBtns = document.querySelectorAll('.energy-emoji-btn');
            emojiBtns.forEach(btn => {
                const val = parseInt(btn.getAttribute('data-value'));
                if (val === energyValue) {
                    btn.classList.add('bg-primary/20', 'ring-2', 'ring-primary');
                } else {
                    btn.classList.remove('bg-primary/20', 'ring-2', 'ring-primary');
                }

                btn.onclick = (e) => {
                    e.stopPropagation();
                    state.energy = val;
                    app.render.hoje();
                };
            });

            const container = document.getElementById('checklist-container');
            if (!container) return;
            
            const iconMap = {
                'Saúde': 'fitness_center', 'Mente': 'psychology', 'Carreira': 'work',
                'Finanças': 'payments', 'Relacionamentos': 'groups', 'Família': 'family_restroom',
                'Lazer': 'sports_esports', 'Propósito': 'auto_awesome'
            };

            let html = '';
            let pendentes = 0;
            const now = new Date();
            const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            
            // Filtro "Para Hoje": pendentes/in_progress dentro da janela [inicio, prazo]
            const todayMicros = (state.entities.micros || []).filter(m => {
                if (m.status === 'done') return false;
                
                // Normalização para meia-noite local para comparação precisa
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const inicioStr = m.inicioDate || m.prazo;
                const prazoStr = m.prazo;
                
                if (!prazoStr) return false; // Sem prazo, sem janela

                const start = new Date(inicioStr + 'T00:00:00');
                const end = new Date(prazoStr + 'T00:00:00');

                return start <= today && end >= today;
            });

            todayMicros.forEach((micro, idx) => {
                if (micro.completed) {
                    html += `
                    <div class="bg-surface-container-low/50 p-4 rounded-xl flex items-center gap-4 opacity-60">
                        <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span class="material-symbols-outlined notranslate text-white text-sm" style="font-variation-settings: 'wght' 700;">check</span>
                        </div>
                        <div class="flex-1">
                            <p class="text-base text-on-surface font-medium line-through">${micro.title}</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded-full area-tag">${micro.dimension}</span>
                        </div>
                    </div>`;
                } else {
                    pendentes++;
                    const macro = state.entities.macros.find(m => m.id === micro.macroId) || {};
                    const okr = state.entities.okrs.find(o => o.id === macro.okrId) || {};
                    const meta = state.entities.metas.find(m => m.id === okr.metaId) || {};
                    const dimIcon = iconMap[micro.dimension] || 'stars';
                    
                    const startDate = micro.inicioDate || micro.prazo || '';
                    const shouldStart = !!startDate && startDate <= todayStr && micro.status === 'pending';
                    const isOverdue = micro.prazo && micro.prazo < todayStr;
                    const overdueTag = isOverdue ? '<span class="inline-flex items-center px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Atrasada</span>' : '';
                    const statusTag = micro.status === 'in_progress'
                        ? '<span class="inline-flex items-center px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Em Andamento</span>'
                        : '';
                    const isHojePlanned = app._isPlannedThisWeek(micro.id);
                    const hojePlannedTag = isHojePlanned
                        ? '<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest"><span class="material-symbols-outlined notranslate text-[10px]">event</span>Semana</span>'
                        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[9px] font-bold uppercase tracking-widest">Captura</span>';
                    const startBtn = shouldStart
                        ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', true);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">Iniciar</button>`
                        : (micro.status === 'in_progress'
                            ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', false);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors">Gerenciar</button>`
                            : '');

                    html += `
                    <div class="space-y-2">
                        <div class="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-start gap-3 sm:gap-4 group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check shrink-0 mt-1" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm sm:text-base text-on-surface font-medium leading-snug break-words">${micro.title}</p>
                                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span class="inline-flex items-center px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded-full area-tag max-w-full">${micro.dimension}</span>${statusTag}${overdueTag}${hojePlannedTag}
                                </div>
                            </div>
                            <div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                ${startBtn}
                                <span class="material-symbols-outlined notranslate text-outline-variant text-sm">keyboard_arrow_down</span>
                            </div>
                        </div>
                        
                        <div class="hidden bg-stone-100 dark:bg-stone-900 rounded-lg p-6 space-y-6 relative trail-line text-on-surface-variant overflow-hidden" id="trail-${idx}">
                            <div class="absolute left-[12px] top-4 bottom-4 w-px bg-primary/10"></div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low">check_circle</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Micro Ação</span>
                                    <span class="text-sm font-medium truncate">${micro.title}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low">account_tree</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Macro Ação</span>
                                    <span class="text-xs truncate">${macro.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low">track_changes</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">OKR</span>
                                    <span class="text-xs truncate">${okr.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low">flag</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Meta</span>
                                    <span class="text-xs text-on-surface-variant font-medium truncate">${meta.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low">${dimIcon}</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Área</span>
                                    <span class="text-xs truncate">${micro.dimension}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold text-primary">Propósito (Nível 0)</span>
                                    <span class="text-base font-headline italic truncate">${meta.purpose || '-'}</span>
                                </div>
                            </div>

                            <div class="pt-4 border-t border-outline-variant/10 flex justify-end">
                                <button onclick="event.stopPropagation(); app.openEntityReview('${micro.id}', 'micros')" class="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all shadow-sm">
                                    <span class="material-symbols-outlined notranslate text-[18px]">settings_accessibility</span> Gerir Micro Ação
                                </button>
                            </div>
                        </div>
                    </div>`;
                }
            });

            // Se houver tarefas atrasadas, adiciona um banner/botão de resolução rápida
            const nowOverdue = new Date();
            const localTodayStr = new Date(nowOverdue.getTime() - (nowOverdue.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const overdueList = (state.entities.micros || []).filter(m => m.status !== 'done' && m.prazo && m.prazo < localTodayStr);
            const atrasadasCount = overdueList.length;

            if (atrasadasCount > 0) {
                const migrationBtnHtml = `
                <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl mb-4 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined notranslate text-amber-600 dark:text-amber-400">warning</span>
                        <div>
                            <p class="text-sm font-bold text-amber-900 dark:text-amber-100">${atrasadasCount} tarefas em atraso</p>
                            <p class="text-xs text-amber-700/70 dark:text-amber-400/70">Deseja migrá-las para o planejamento de hoje?</p>
                        </div>
                    </div>
                    <button onclick="app.migrateOverdueTasks()" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap">
                        Migrar Tudo
                    </button>
                </div>`;
                html = migrationBtnHtml + html;
            }

            container.innerHTML = html;

            const pendingBadge = document.getElementById('macros-pendentes-badge');
            if (pendingBadge) {
                pendingBadge.textContent = `${pendentes} Pendentes`;
            }

            // Distribuição de Foco na aba Hoje
            this.renderFocusDistribution('focus-distribution');
        },

        planos: function() {
            const state = window.sistemaVidaState;
            const filter = app.planosFilter || 'Todas';

            // Sync filter buttons UI
            const filterContainer = document.querySelector('.overflow-x-auto.no-scrollbar.mb-12');
            if (filterContainer) {
                const btns = filterContainer.querySelectorAll('button');
                btns.forEach(btn => {
                    const txt = btn.textContent.trim();
                    const isMatched = (txt === filter || (filter === 'Relacionamentos' && txt === 'Relac.'));

                    if (isMatched) {
                        btn.className = "bg-primary text-on-primary px-4 py-2 rounded-full text-[11px] font-label uppercase tracking-widest whitespace-nowrap";
                    } else {
                        btn.className = "bg-surface-container-high text-on-surface-variant px-4 py-2 rounded-full text-[11px] font-label uppercase tracking-widest whitespace-nowrap hover:bg-surface-container-highest transition-colors";
                    }
                    
                    btn.onclick = () => {
                        app.setPlanosFilter(txt === 'Relac.' ? 'Relacionamentos' : txt);
                    };
                });
            }

            // Configure buttons and selects in already existing HTML
            const filterAreaId = 'planos-advanced-filters';
            const filterArea = document.getElementById(filterAreaId);
            if (!filterArea) return; // Wait for view to be ready
            
            if (document.getElementById('hier-type')) {
                document.getElementById('hier-type').value = app.planosHierarchyType || '';
                const hierIdSelect = document.getElementById('hier-id');
                if (app.planosHierarchyType) {
                    hierIdSelect.classList.remove('hidden');
                    const list = state.entities[app.planosHierarchyType] || [];
                    hierIdSelect.innerHTML = '<option value="">Selecione a referência...</option>' + list.map(e => `<option value="${e.id}" ${app.planosHierarchyId === e.id ? 'selected' : ''}>${e.title}</option>`).join('');
                } else {
                    hierIdSelect.classList.add('hidden');
                }

                const activeTabFromDom = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'metas';
                app.planosActiveTab = activeTabFromDom;
                const showPlannedFilter = app.planosActiveTab === 'micro';
                if (!showPlannedFilter && app.planosStatusFilter === 'planned') {
                    app.planosStatusFilter = 'all';
                }
                const statFilterRaw = app.planosStatusFilter || 'all';
                let statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
                const base = 'px-4 py-1.5 rounded-full text-xs font-bold transition-colors';
                const on = 'bg-primary text-on-primary';
                const off = 'bg-surface-container-high text-on-surface-variant hover:brightness-95';
                const btnPending = document.getElementById('btn-stat-pending');
                const btnInProgress = document.getElementById('btn-stat-in-progress');
                const btnDone = document.getElementById('btn-stat-done');
                const btnPlanned = document.getElementById('btn-stat-planned');
                const btnAll = document.getElementById('btn-stat-all');
                const btnActive = document.getElementById('btn-stat-active'); // legado
                if (btnPending) btnPending.className = `${base} ${statFilter === 'pending' ? on : off}`;
                if (btnInProgress) btnInProgress.className = `${base} ${statFilter === 'in_progress' ? on : off}`;
                if (btnDone) btnDone.className = `${base} ${statFilter === 'done' ? on : off}`;
                if (btnPlanned) btnPlanned.className = `${showPlannedFilter ? '' : 'hidden '} ${base} ${statFilter === 'planned' ? on : off}`.trim();
                if (btnAll) btnAll.className = `${base} ${statFilter === 'all' ? on : off}`;
                if (btnActive) btnActive.className = `${base} ${statFilter === 'active' ? on : off}`;
            }

            const buildCards = (items, entityType) => {
                // Determine implicit dimension hierarchically
                const resolveDim = (item) => {
                    if (item.dimension) return item.dimension;
                    if (item.dimensionName) return item.dimensionName;
                    if (entityType === 'okrs') {
                         const m = state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    if (entityType === 'macros') {
                         const o = state.entities.okrs.find(x => x.id === item.okrId);
                         const m = o ? state.entities.metas.find(x => x.id === o.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    if (entityType === 'micros') {
                         const macro = state.entities.macros.find(x => x.id === item.macroId);
                         const okr = macro ? state.entities.okrs.find(x => x.id === macro.okrId) : state.entities.okrs.find(x => x.id === item.okrId);
                         const m = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                         return m ? (m.dimension || m.dimensionName) : 'Geral';
                    }
                    return 'Geral';
                };

                const resolveLineage = (item, type) => {
                    let metaId = type === 'metas' ? item.id : null;
                    let okrId = type === 'okrs' ? item.id : null;
                    let macroId = type === 'macros' ? item.id : null;
                    if (type === 'micros') {
                        macroId = item.macroId;
                        const m = state.entities.macros.find(x => x.id === macroId);
                        if (m) {
                            okrId = m.okrId;
                            const o = state.entities.okrs.find(x => x.id === okrId);
                            if (o) metaId = o.metaId;
                            else metaId = m.metaId || item.metaId || null;
                        } else {
                            okrId = item.okrId || null;
                            const o = state.entities.okrs.find(x => x.id === okrId);
                            if (o) metaId = o.metaId;
                            else metaId = item.metaId || null;
                        }
                    } else if (type === 'macros') {
                        okrId = item.okrId;
                        const o = state.entities.okrs.find(x => x.id === okrId);
                        if (o) metaId = o.metaId;
                        else metaId = item.metaId || null;
                    } else if (type === 'okrs') {
                        metaId = item.metaId;
                    }
                    const metaChain = metaId ? app.getMetaParentChain(metaId) : [];
                    return { metaId, okrId, macroId, metaChain };
                };

                const filteredByDim = filter === 'Todas' ? items : items.filter(i => resolveDim(i) === filter);
                const filtered = filteredByDim.filter(i => {
                    // Filtro 1: Status
                    const isDone = i.progress >= 100 || i.status === 'done' || i.completed;
                    const statFilterRaw = app.planosStatusFilter || 'all';
                    const statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
                    let passStatus = false;
                    if (statFilter === 'active') passStatus = !isDone && i.status !== 'abandoned'; // legado
                    else if (statFilter === 'pending') passStatus = !isDone && i.status !== 'abandoned' && i.status !== 'in_progress';
                    else if (statFilter === 'in_progress') passStatus = i.status === 'in_progress';
                    else if (statFilter === 'done') passStatus = isDone;
                    else if (statFilter === 'planned') passStatus = entityType === 'micros' ? app._isPlannedThisWeek(i.id) : true;
                    else passStatus = i.status !== 'abandoned';
                    if (!passStatus) return false;

                    // Filtro 2: Raio-X Relacional (Lineage Omnidirecional)
                    if (app.planosHierarchyType && app.planosHierarchyId) {
                        const lineage = resolveLineage(i, entityType);
                        if (app.planosHierarchyType === 'metas' && !lineage.metaChain.includes(app.planosHierarchyId)) return false;
                        if (app.planosHierarchyType === 'okrs' && lineage.okrId !== app.planosHierarchyId) return false;
                        if (app.planosHierarchyType === 'macros' && lineage.macroId !== app.planosHierarchyId) return false;
                    }
                    return true;
                });
                
                const grouped = {};
                filtered.forEach(item => {
                    const dim = resolveDim(item) || 'Geral';
                    if (!grouped[dim]) grouped[dim] = [];
                    grouped[dim].push(item);
                });

                if (Object.keys(grouped).length === 0) {
                    const emptyIcon = (entityType === 'metas' || entityType === 'okrs') ? 'flag' : 'task_alt';
                    return `
                    <div class="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 border-dashed text-center flex flex-col items-center justify-center">
                        <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                            <span class="material-symbols-outlined notranslate text-outline text-3xl">${emptyIcon}</span>
                        </div>
                        <h4 class="font-headline text-lg font-bold text-on-background">Nenhum registro encontrado</h4>
                        <p class="text-sm text-outline mt-2 max-w-sm">Você ainda não tem planos definidos nesta categoria. Clique no botão de adicionar (+) para começar a planejar.</p>
                    </div>`;
                }

                let html = '';
                for (const [dim, entities] of Object.entries(grouped)) {
                    html += `
                    <div>
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xs font-label uppercase tracking-[0.2em] text-stone-400">${dim}</h3>
                            <div class="h-px flex-1 bg-surface-container-high mx-4"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;
                        
                    entities.forEach((item, idx) => {
                        const prog = item.progress || (item.completed ? 100 : 0);
                        let visualProg = prog;
                        const hasKrs = entityType === 'okrs' && Array.isArray(item.keyResults) && item.keyResults.length > 0;
                        const subMetaText = entityType === 'okrs'
                            ? (hasKrs ? `${item.keyResults.length} KRs • ${item.challengeLevel || 3}/5 desafio` : `Sem KRs • ${item.challengeLevel || 3}/5 desafio`)
                            : (entityType === 'metas'
                                ? `Comprometimento ${item.commitmentLevel || 3}/5`
                                : '');
                        
                        // Count children for hierarchy display
                        let countLine = '';
                        if (entityType === 'metas' || entityType === 'okrs' || entityType === 'macros') {
                            const counts = app._getEntityCounts(entityType, item.id, state);
                            const parts = [];
                            if (counts.okrs > 0) parts.push(`${counts.okrs} OKR${counts.okrs > 1 ? 's' : ''}`);
                            if (counts.macros > 0) parts.push(`${counts.macros} Macro${counts.macros > 1 ? 's' : ''}`);
                            if (counts.micros > 0) parts.push(`${counts.micros} Micro${counts.micros > 1 ? 's' : ''}`);
                            countLine = parts.join(' · ');
                        }

                        // Build Hierarchy Trail Nodes
                        let trailNodes = [];
                        if (entityType === 'micros') {
                            trailNodes.push({ label: 'Micro Ação', title: item.title });
                            const macro = state.entities.macros.find(x => x.id === item.macroId);
                            trailNodes.push({ label: 'Macro Ação', title: macro ? macro.title : '-' });
                            const okr = macro ? state.entities.okrs.find(x => x.id === macro.okrId) : state.entities.okrs.find(x => x.id === item.okrId);
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'macros') {
                            trailNodes.push({ label: 'Macro Ação', title: item.title });
                            const okr = state.entities.okrs.find(x => x.id === item.okrId);
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'okrs') {
                            trailNodes.push({ label: 'OKR', title: item.title });
                            const meta = state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Critério de Sucesso', title: item.successCriteria || '-' });
                            trailNodes.push({ label: 'Desafio', title: `${item.challengeLevel || 3}/5` });
                            trailNodes.push({ label: 'Comprometimento', title: `${item.commitmentLevel || 3}/5` });
                            if (Array.isArray(item.keyResults) && item.keyResults.length > 0) {
                                trailNodes.push({ label: 'Key Results', title: `${item.keyResults.length} indicadores` });
                            }
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'metas') {
                            trailNodes.push({ label: 'Meta', title: item.title });
                            if (item.parentMetaId) {
                                const parentMeta = state.entities.metas.find(x => x.id === item.parentMetaId);
                                trailNodes.push({ label: 'Meta Pai', title: parentMeta ? parentMeta.title : '-' });
                            }
                            trailNodes.push({ label: 'Horizonte', title: `${app.getMetaHorizonYears(item)} anos` });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Critério de Sucesso', title: item.successCriteria || '-' });
                            trailNodes.push({ label: 'Desafio', title: `${item.challengeLevel || 3}/5` });
                            trailNodes.push({ label: 'Comprometimento', title: `${item.commitmentLevel || 3}/5` });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: item.purpose || '-' });
                        }

                        let trailHtml = `<div class="bg-stone-100 dark:bg-stone-900 rounded-lg p-6 space-y-6 relative trail-line text-on-surface-variant mt-6 overflow-hidden">
                            <div class="absolute left-[12px] top-4 bottom-4 w-px bg-primary/10"></div>`;
                        
                        trailNodes.forEach((node) => {
                            let icon = 'trip_origin'; let colorClass = 'text-stone-400'; let titleClass = 'text-xs text-on-surface-variant font-medium';
                            if (node.label === 'Propósito (Nível 0)') { icon = 'auto_awesome'; colorClass = 'text-primary'; titleClass = 'text-base font-headline italic text-on-surface'; }
                            else if (node.label === 'Área') { icon = 'stars'; colorClass = 'text-primary'; }
                            else if (node.label === 'Meta') { icon = 'flag'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Meta Pai') { icon = 'outbound'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Horizonte') { icon = 'schedule'; colorClass = 'text-primary'; }
                            else if (node.label === 'OKR') { icon = 'track_changes'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Macro Ação') { icon = 'account_tree'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Micro Ação') { icon = 'check_circle'; colorClass = 'text-primary'; }
                            else if (node.label === 'Critério de Sucesso') { icon = 'rule'; colorClass = 'text-primary'; }
                            else if (node.label === 'Desafio') { icon = 'military_tech'; colorClass = 'text-primary'; }
                            else if (node.label === 'Comprometimento') { icon = 'verified'; colorClass = 'text-primary'; }
                            else if (node.label === 'Key Results') { icon = 'query_stats'; colorClass = 'text-primary'; }
                            
                            trailHtml += `
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate ${colorClass} text-xl bg-stone-100 dark:bg-stone-900 p-0.5 rounded-full bg-surface-container-low" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold ${colorClass}">${node.label}</span>
                                    <span class="${titleClass} truncate">${node.title}</span>
                                </div>
                            </div>`;
                        });
                        trailHtml += `</div>`;

                        const userValues = state.profile.values || [];
                        const isAligned = userValues.includes(item.dimension);
                        const microPlanChip = entityType === 'micros'
                            ? (app._isPlannedThisWeek(item.id)
                                ? '<span class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold uppercase tracking-wider">Semana</span>'
                                : '<span class="shrink-0 bg-surface-container-high text-on-surface-variant text-[9px] px-2 py-0.5 rounded-full border border-outline-variant/20 font-bold uppercase tracking-wider">Captura</span>')
                            : '';

                        const isInProgress = item.status === 'in_progress';
                        const isDone = prog >= 100 || item.status === 'done' || item.completed;
                        const isPending = item.status === 'pending';
                        const highlightClass = isInProgress
                            ? 'ring-2 ring-amber-500/40 border-amber-500/40 shadow-md shadow-amber-500/10'
                            : (isDone ? 'border-emerald-500/30 shadow-md shadow-emerald-500/10' : 'border-outline-variant/20 shadow-sm');
                        const statusChip = isDone
                            ? '<span class="shrink-0 bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Concluído</span>'
                            : (isInProgress
                                ? '<span class="shrink-0 bg-amber-100 text-amber-700 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Andamento</span>'
                                : '<span class="shrink-0 bg-surface-container-high text-on-surface-variant px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Pendente</span>');
                        const actionButton = entityType === 'micros' && !isDone
                            ? `
                                <button onclick="event.stopPropagation(); app.openMicroInFocus('${item.id}', ${isPending ? 'true' : 'false'})"
                                    class="p-2.5 border ${isPending ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary'} rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">${isPending ? 'play_arrow' : 'timer'}</span> ${isPending ? 'Iniciar' : 'Gerenciar'}
                                </button>
                            `
                            : (isPending
                            ? `
                                <button onclick="event.stopPropagation(); app.startEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">play_arrow</span> Iniciar
                                </button>
                            `
                            : (isDone
                                ? `
                                <button onclick="event.stopPropagation(); app.deleteEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-outline-variant/30 hover:bg-error-container/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-error transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">delete</span> Excluir
                                </button>
                                `
                                : `
                                <button onclick="event.stopPropagation(); app.forceCompleteEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-green-700 dark:text-green-400 transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">check_circle</span> Concluir
                                </button>
                                `));

                        html += `
                        <div data-entity-id="${item.id}" data-entity-type="${entityType}" class="bg-surface-container-lowest p-4 md:p-5 rounded-2xl border ${highlightClass} hover:shadow-lg transition-all group cursor-pointer overflow-hidden relative" onclick="app.toggleTrail(this)">
                            <div class="flex items-start justify-between gap-3 mb-3">
                                <div class="space-y-1.5 flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="shrink-0 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-label font-bold uppercase tracking-wider">${item.dimension || 'Geral'}</span>
                                        ${microPlanChip}
                                        ${isAligned ? '<span class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold">ALINHADO</span>' : ''}
                                    </div>
                                    <h4 class="font-headline text-lg md:text-xl font-semibold leading-tight line-clamp-2">${item.title}</h4>
                                    ${subMetaText ? `<p class="text-[11px] text-outline">${subMetaText}</p>` : ''}
                                    ${countLine ? `<p class="text-[10px] text-outline font-label uppercase tracking-widest mt-1">${countLine}</p>` : ''}
                                </div>
                                <div class="flex flex-col items-end gap-2 shrink-0">
                                    ${statusChip}
                                    <span class="material-symbols-outlined notranslate text-outline text-lg transition-transform group-hover:translate-x-0.5">chevron_right</span>
                                </div>
                            </div>

                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div class="flex items-center gap-2 text-outline text-xs min-w-0">
                                    <span class="material-symbols-outlined notranslate text-sm shrink-0">event</span>
                                    <span class="truncate">${app.formatPrazoDisplay(item)}</span>
                                </div>
                                <span class="text-[10px] font-label uppercase tracking-wider text-outline shrink-0">Trilha estrategica</span>
                            </div>

                            <div class="space-y-1.5 mb-4">
                                <div class="flex justify-between items-center text-[10px] font-label uppercase tracking-wider text-stone-500">
                                    <span>Progresso</span>
                                    <span>${prog.toFixed(0)}%</span>
                                </div>
                                <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div class="h-full bg-primary rounded-full transition-all" style="width: ${visualProg}%"></div>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-2">
                                <button onclick="event.stopPropagation(); app.openEntityReview('${item.id}', '${entityType}')"
                                    class="col-span-3 p-2.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all">
                                    <span class="material-symbols-outlined notranslate text-base">settings_accessibility</span> Gerir Estrategia
                                </button>
                                <button onclick="event.stopPropagation(); app.editEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-outline-variant/30 hover:bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-on-surface transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">edit</span> Editar
                                </button>
                                <button onclick="event.stopPropagation(); app.duplicateEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border border-outline-variant/30 hover:bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-on-surface transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">content_copy</span> Duplicar
                                </button>
                                ${actionButton}
                            </div>

                            <div class="trail-panel hidden overflow-hidden transition-all duration-300 max-h-0 mt-5 border-t border-outline-variant/10 pt-4">
                                <div class="relative pl-6 pt-1">
                                    <div class="absolute left-[7px] top-2 bottom-2 w-px bg-primary/20"></div>
                                    ${trailHtml}
                                </div>
                            </div>
                        </div>`;
                    });

                    html += `</div></div>`;
                }
                return html;
            };

            const metasC = document.getElementById('metas-container');
            if (metasC) metasC.innerHTML = buildCards(state.entities.metas, 'metas');
            
            const okrsC = document.getElementById('okrs-container');
            if (okrsC) okrsC.innerHTML = buildCards(state.entities.okrs, 'okrs');

            const macroC = document.getElementById('macro-container');
            if (macroC) macroC.innerHTML = buildCards(state.entities.macros, 'macros');

            const microC = document.getElementById('micro-container');
            if (microC) microC.innerHTML = buildCards(state.entities.micros, 'micros');
        },

        perfil: function() {
            const state = window.sistemaVidaState;
            const nomeDisplay = document.getElementById('perfil-nome-display');
            if (nomeDisplay && state.profile) {
                nomeDisplay.textContent = state.profile.name || "Seu Nome";
            }
            app.ensureSettingsState();

            const profileImg = document.getElementById('profile-avatar-image');
            if (profileImg) {
                profileImg.src = state.profile.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDE4p8AoYVsz6pEXUcgS6BkD6ZMnpFej1qRvtAnjsOWWGCk7xJhzaMTg6eRpIrmf1nkexNBtrYL3KbuHY6ZwSPi-Kdj4ivoosw4MlhSqGkDRZeaWiu0ULKlO9WJofnhhFK3dg6DTg4IQBS1fYuInfMqPQH2xU1CoJ_kNGEuGwa-nEMQzBHm4jSNxfxVSNi8W5QYdVVAzvIMm62lcyjTcDnQkk9xlvlKrssjp1lApdoTVkjnhRL8luZ5XJaaZ8Tgexi6luLt5O1w6g';
            }

            const notifKnob = document.getElementById('notif-toggle-knob');
            const notifTrack = document.getElementById('notif-toggle-track');
            if (notifTrack && notifKnob) {
                const on = !!state.settings.notificationsEnabled;
                notifTrack.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${on ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                notifKnob.className = `w-3 h-3 rounded-full absolute transition-all ${on ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }

            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) themeSelect.value = state.settings.theme || 'auto';
        },

        proposito: function() {
            const state = window.sistemaVidaState;

            // Limpa o banner de valores para evitar duplicidade visual
            const valuesBannerTop = document.getElementById('top-values-banner');
            if (valuesBannerTop) valuesBannerTop.innerHTML = '';

            // 1. Renderiza as barras PERMA exclusivamente aqui
            setTimeout(() => {
                try {
                    const container = document.getElementById('perma-charts-container');
                    if (!container) return;
                    container.innerHTML = '';

                    const permaData = [
                        { label: 'Emoções Positivas (P)', val: state.perma?.P || 0, color: 'bg-rose-500' },
                        { label: 'Engajamento (E)', val: state.perma?.E || 0, color: 'bg-orange-500' },
                        { label: 'Relacionamentos (R)', val: state.perma?.R || 0, color: 'bg-emerald-500' },
                        { label: 'Significado (M)', val: state.perma?.M || 0, color: 'bg-sky-500' },
                        { label: 'Realização (A)', val: state.perma?.A || 0, color: 'bg-violet-500' }
                    ];

                    permaData.forEach(item => {
                        const normalizedVal = app.normalizePermaScore(item.val);
                        const percentage = normalizedVal * 10;
                        const row = document.createElement('div');
                        row.className = 'space-y-2';
                        row.innerHTML = `
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-on-surface-variant">${item.label}</span>
                                <span class="text-xs font-bold text-primary">${normalizedVal.toFixed(1)}/10</span>
                            </div>
                            <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                <div class="h-full ${item.color} transition-all duration-1000" style="width: ${percentage}%"></div>
                            </div>
                        `;
                        container.appendChild(row);
                    });
                } catch(e) {
                    console.error('Erro ao renderizar barras PERMA em Propósito:', e);
                }
            }, 150);

            // 2. Renderização SWLS (score + histórico)
            setTimeout(() => {
                try {
                    this.normalizeSwlsState();
                    const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
                    const scoreEl = document.getElementById('swls-score');
                    const bandEl = document.getElementById('swls-band');
                    const dateEl = document.getElementById('swls-last-date');
                    const historyEl = document.getElementById('swls-history-list');
                    const insightEl = document.getElementById('swls-perma-insight');
                    const score = Number(swls.lastScore) || 0;
                    const permaVals = ['P', 'E', 'R', 'M', 'A'].map((k) => this.normalizePermaScore(state.perma?.[k]));
                    const permaAvg = permaVals.reduce((sum, n) => sum + n, 0) / permaVals.length;
                    const swlsEq10 = Math.round((score / 35) * 100) / 10;
                    const delta = Math.abs(permaAvg - swlsEq10);

                    if (scoreEl) scoreEl.textContent = `${score}/35`;
                    if (bandEl) bandEl.textContent = this.getSwlsBand(score);
                    if (dateEl) dateEl.textContent = swls.lastDate ? `Última avaliação: ${swls.lastDate}` : '';
                    if (insightEl) {
                        let insight = `PERMA médio ${permaAvg.toFixed(1)}/10 e SWLS equivalente ${swlsEq10.toFixed(1)}/10: leitura coerente.`;
                        if (delta >= 2) {
                            if (swlsEq10 > permaAvg) insight = `SWLS (${swlsEq10.toFixed(1)}/10) está acima do PERMA médio (${permaAvg.toFixed(1)}/10): investigue dimensões específicas do PERMA com notas baixas.`;
                            else insight = `PERMA médio (${permaAvg.toFixed(1)}/10) está acima do SWLS (${swlsEq10.toFixed(1)}/10): vale revisar satisfação global e expectativas de vida.`;
                        }
                        insightEl.textContent = insight;
                    }

                    if (historyEl) {
                        const entries = Object.entries(swls.history || {})
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 5);
                        if (entries.length === 0) {
                            historyEl.innerHTML = '<p class="text-xs text-outline italic">Sem histórico disponível.</p>';
                        } else {
                            historyEl.innerHTML = entries.map(([date, item]) => {
                                const val = Number(item?.score) || 0;
                                return `<div class="flex items-center justify-between text-xs border border-outline-variant/10 rounded-lg px-3 py-2">
                                    <span class="text-outline">${date}</span>
                                    <span class="font-bold text-primary">${val}/35</span>
                                </div>`;
                            }).join('');
                        }
                    }
                } catch (e) {
                    console.error('Erro ao renderizar SWLS em Propósito:', e);
                }
            }, 170);

            // 3. Renderização de Textos do Propósito (Ikigai, Valores, Visão, Legado)
            setTimeout(() => {
                try {
                    const state = window.sistemaVidaState;
                    const profile = state.profile || {};
                    
                    // Controle de visibilidade da ferramenta de valores
                    const valuesTool = document.getElementById('values-selection-tool');
                    if (valuesTool) {
                        if (profile.values && profile.values.length > 0) {
                            valuesTool.classList.add('hidden');
                        } else {
                            valuesTool.classList.remove('hidden');
                        }
                    }

                    // Valores Essenciais (Sincronizado)
                    window.app.renderSidebarValues();

                    // 3. Preenchimento de Textos do Perfil (Padrao de Exibicao)
                        // Helper para Placeholders (Standard Sênior)
                        const renderField = (id, val, placeholder) => {
                            const el = document.getElementById(id);
                            if (!el) return;
                            if (!val || val.trim() === "" || val === "Clique para definir") {
                                el.textContent = placeholder;
                                el.classList.remove('text-on-surface-variant');
                                el.classList.add('text-outline', 'opacity-40');
                            } else {
                                el.textContent = val;
                                el.classList.add('text-on-surface-variant');
                                el.classList.remove('text-outline', 'opacity-40');
                            }
                        };
                        
                        const prof = state.profile || {};
                        
                        // Ikigai (display-id)
                        renderField('display-ikigai-love', prof.ikigai.love, "O que você ama fazer?");
                        renderField('display-ikigai-good', prof.ikigai.good, "No que você é excelente?");
                        renderField('display-ikigai-need', prof.ikigai.need, "Do que o mundo precisa?");
                        renderField('display-ikigai-paid', prof.ikigai.paid, "Pelo que você pode ser pago?");
                        renderField('display-ikigai-sintese', prof.ikigai.sintese, "Sua razão de ser...");

                        // Visao (display-id)
                        renderField('display-vision-saude', prof.vision.saude, "Sua visão para o corpo e energia...");
                        renderField('display-vision-carreira', prof.vision.carreira, "Sua visão para trabalho e sustento...");
                        renderField('display-vision-intelecto', prof.vision.intelecto, "Sua visão para a mente e o espírito...");
                        renderField('display-vision-quote', prof.vision.quote, "Uma frase que te define...");

                        // Legado (display-id)
                        renderField('display-legacy-familia', prof.legacyObj.familia, "Como você quer ser lembrado pelos seus?");
                        renderField('display-legacy-profissao', prof.legacyObj.profissao, "Qual obra você quer deixar no mercado?");
                        renderField('display-legacy-mundo', prof.legacyObj.mundo, "Como sua passagem muda a sociedade?");

                        // Odyssey Plan (Novas Chaves Consolidadas)
                        renderField('display-cenarioA', prof.odyssey.cenarioA, "Cenário A: Descreva aqui sua visão de 5 anos (Vida Atual)...");
                        renderField('display-cenarioB', prof.odyssey.cenarioB, "Cenário B: Descreva aqui sua visão de 5 anos (Plano B)...");
                        renderField('display-cenarioC', prof.odyssey.cenarioC, "Cenário C: Descreva aqui sua visão de 5 anos (Vida Radical)...");
                        const odysseyImages = prof.odysseyImages || {};
                        ['cenarioA', 'cenarioB', 'cenarioC'].forEach(key => {
                            const img = document.getElementById(`odyssey-image-${key}`);
                            if (!img) return;
                            const src = odysseyImages[key] || '';
                            if (src) {
                                img.src = src;
                                img.classList.remove('hidden');
                            } else {
                                img.src = '';
                                img.classList.add('hidden');
                            }
                        });
                } catch(e) {
                    console.error("Erro ao renderizar textos do Propósito:", e);
                }
            }, 150);

            // Render SVG Roda da Vida Trigonometry
            try {
                const polygon = document.getElementById('roda-polygon');
                if (polygon) {
                    // The order must match the SVG visual spokes: Saúde (top/0), Mente (45), Carreira (90), Finanças (135), Relac (180), Família (225), Lazer (270), Propósito (315)
                    const axes = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
                    const angles = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => deg * Math.PI / 180);
                    
                    const pts = axes.map((dim, i) => {
                        const score = state.dimensions[dim]?.score || 0;
                        // Max radius is ~40. Center is 50,50.
                        const r = 40 * (score / 100);
                        const x = 50 + r * Math.sin(angles[i]);
                        const y = 50 - r * Math.cos(angles[i]);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });
                    
                    polygon.setAttribute('points', pts.join(' '));
                }
            } catch (e) {
                console.error("Erro na renderização das barras PERMA ou Roda da Vida:", e);
            }

            const topValuesContainer = document.getElementById('top-values-banner');

            // Render Sliders UI
            const slidersContainer = document.getElementById('roda-sliders');
            if (slidersContainer) {
                let html = '';
                for (const [dim, data] of Object.entries(state.dimensions)) {
                    html += `
                    <div class="flex flex-col gap-1 w-full">
                        <div class="flex justify-between items-center text-[10px] font-label uppercase tracking-widest">
                            <span class="text-outline font-bold">${dim}</span>
                            <span class="text-primary font-bold">${data.score}</span>
                        </div>
                        <input type="range" min="1" max="100" value="${data.score}" class="w-full accent-primary h-1 bg-surface-container-high rounded-full appearance-none cursor-pointer" oninput="app.updateDimensionVisual('${dim}', this.value); this.previousElementSibling.lastElementChild.textContent=this.value" onchange="app.saveState()">
                    </div>`;
                }
                slidersContainer.innerHTML = html;
            }


        },
    },

    renderTimeline: function() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        const state = window.sistemaVidaState;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ── Janela de 6 meses ──────────────────────────────────────
        const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endDate   = new Date(today.getFullYear(), today.getMonth() + 5, 0);
        const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

        // ── Cabeçalho de meses ─────────────────────────────────────
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun',
                       'Jul','Ago','Set','Out','Nov','Dez'];
        let headerHTML = '<div class="flex border-b border-outline-variant/20 bg-surface-container">';
        headerHTML += '<div class="w-48 shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline border-r border-outline-variant/20">Entidade</div>';
        headerHTML += '<div class="flex-1 relative flex">';

        // Gera célula por mês na janela
        let cursor = new Date(startDate);
        while (cursor <= endDate) {
          const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
          const widthPct = (daysInMonth / totalDays) * 100;
          headerHTML += `
            <div class="text-center text-xs font-bold uppercase tracking-widest
                        text-outline py-2 border-r border-outline-variant/10"
                 style="width:${widthPct.toFixed(2)}%">
              ${meses[cursor.getMonth()]}
            </div>`;
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
        headerHTML += '</div></div>';

        // ── Linha de "hoje" ────────────────────────────────────────
        const todayPct = Math.min(100, Math.max(0, ((today - startDate) / (endDate - startDate)) * 100));
        const todayLine = `
          <div class="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
               style="left: calc(192px + (100% - 192px) * ${(todayPct / 100).toFixed(4)}); box-shadow: 0 0 10px var(--md-sys-color-primary);"
               title="Hoje">
               <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full"></div>
          </div>`;

        // ── Filtros Globais da Aba Planos ──────────────────────────
        const currentFilter = window.app.planosFilter || 'Todas';
        const statFilterRaw = window.app.planosStatusFilter || 'all';
        const statFilter = statFilterRaw === 'active' ? 'all' : statFilterRaw;
        const hType = window.app.planosHierarchyType || '';
        const hId = window.app.planosHierarchyId || '';

        const filterStatus = (item) => {
            if (item.status === 'abandoned') return false;
            if (statFilter === 'active' && item.status === 'done') return false; // legado
            if (statFilter === 'pending' && (item.status === 'done' || item.status === 'in_progress')) return false;
            if (statFilter === 'in_progress' && item.status !== 'in_progress') return false;
            if (statFilter === 'done' && item.status !== 'done') return false;
            return true;
        };

        const dimColorMap = {
            'Saúde': 'border-rose-400', 'Mente': 'border-purple-400', 'Carreira': 'border-blue-400',
            'Finanças': 'border-emerald-400', 'Relacionamentos': 'border-pink-400', 'Família': 'border-orange-400',
            'Lazer': 'border-sky-400', 'Propósito': 'border-amber-400', 'Geral': 'border-stone-400'
        };

        // ── Entidades (Render) ─────────────────────────────────────
        let rowsHTML = '';
        const renderedIds = { metas: new Set(), okrs: new Set(), macros: new Set(), micros: new Set() };

        const renderRow = (entity, tipo, marginClass, parentDim) => {
            if (!entity.title || entity.title.trim() === '') return;
            if (!entity.id) return;
            if (renderedIds[tipo] && renderedIds[tipo].has(entity.id)) return;
            let fallbackDays = 7;
            if (tipo === 'okrs') fallbackDays = 92;
            else if (tipo === 'macros') fallbackDays = 31;
            else if (tipo === 'micros') fallbackDays = 7;
            else if (tipo === 'metas') fallbackDays = Math.max(180, Math.round(this.getMetaHorizonYears(entity) * 365));
            const hasPrazo = entity.prazo && entity.prazo.trim() !== '';
            const hasInicio = entity.inicioDate && entity.inicioDate.trim() !== '';
            const hasCreatedAt = entity.createdAt !== undefined && entity.createdAt !== null && String(entity.createdAt).trim() !== '';
            let createdAtDate = null;
            if (hasCreatedAt) {
                if (typeof entity.createdAt === 'number') {
                    createdAtDate = new Date(entity.createdAt);
                } else {
                    const createdRaw = String(entity.createdAt).trim();
                    createdAtDate = createdRaw.includes('T')
                        ? new Date(createdRaw)
                        : new Date(createdRaw + 'T00:00:00');
                }
            }
            const hasValidCreatedAt = !!(createdAtDate && !Number.isNaN(createdAtDate.getTime()));

            let taskStart = hasInicio ? new Date(entity.inicioDate + 'T00:00:00') : null;
            let taskEnd = hasPrazo ? new Date(entity.prazo + 'T00:00:00') : null;

            if (!taskStart && taskEnd) {
                if (hasValidCreatedAt) {
                    taskStart = new Date(createdAtDate.getTime());
                } else {
                    taskStart = new Date(taskEnd.getTime());
                    taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
                }
            } else if (taskStart && !taskEnd) {
                taskEnd = new Date(taskStart.getTime());
                taskEnd.setDate(taskEnd.getDate() + (fallbackDays - 1));
            } else if (!taskStart && !taskEnd) {
                if (hasValidCreatedAt) {
                    taskStart = new Date(createdAtDate.getTime());
                    taskEnd = new Date(createdAtDate.getTime());
                    taskEnd.setDate(taskEnd.getDate() + (fallbackDays - 1));
                } else {
                    taskEnd = new Date(today);
                    taskStart = new Date(today);
                    taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
                }
            }

            if (isNaN(taskStart.getTime())) taskStart = new Date(today);
            if (isNaN(taskEnd.getTime())) taskEnd = new Date(today);
            if (taskEnd < taskStart) {
                const swap = taskStart;
                taskStart = taskEnd;
                taskEnd = swap;
            }

            const isOutsideWindow = taskEnd < startDate || taskStart > endDate;
            if (isOutsideWindow) {
                // Metas ainda devem aparecer como contexto da hierarquia,
                // mesmo quando o prazo está fora da janela de 6 meses.
                if (tipo !== 'metas') return;
                if (taskStart > endDate) {
                    taskStart = new Date(endDate);
                    taskEnd = new Date(endDate);
                } else if (taskEnd < startDate) {
                    taskStart = new Date(startDate);
                    taskEnd = new Date(startDate);
                }
            }
            
            // Clamping para a janela de visualização
            const visualStart = new Date(Math.max(taskStart, startDate));
            const visualEnd = new Date(Math.min(taskEnd, endDate));

            const totalWindowTime = endDate - startDate;
            const leftPct = ((visualStart - startDate) / totalWindowTime) * 100;
            const oneDayMs = 1000 * 60 * 60 * 24;
            const widthPct = (((visualEnd - visualStart) + oneDayMs) / totalWindowTime) * 100;

            const textMap = { metas: 'text-white', okrs: 'text-white', macros: 'text-white', micros: 'text-on-surface-variant' };
            const labelMap = { metas: 'Meta', okrs: 'OKR', macros: 'Macro', micros: 'Micro' };
            
            const txtColor = textMap[tipo] || 'text-white';
            const progress = entity.progress || (entity.status === 'done' ? 100 : 0);
            const isOverdue = taskEnd < today && entity.status !== 'done';
            
            const dimValue = entity.dimension || entity.dimensionName || parentDim || 'Geral';
            const borderColor = dimColorMap[dimValue] || 'border-outline-variant/40';

            const isMicro = tipo === 'micros';
            const barHeight = isMicro ? 'h-4' : 'h-6';
            const barStyles = isMicro ? 'bg-secondary/60' : (entity.status === 'done' ? 'bg-primary' : 'bg-primary/85 opacity-80 gantt-stripe-bg');
            const minWidthPctByType = { metas: 6, okrs: 5, macros: 4, micros: 3 };
            const visualWidth = Math.min(100, Math.max(widthPct, minWidthPctByType[tipo] || 3));
            const maxLeftForWidth = Math.max(0, 100 - visualWidth);
            const visualLeft = Math.min(Math.max(0, leftPct), maxLeftForWidth);
            const showInlineTitle = visualWidth >= 8;
            if (renderedIds[tipo]) renderedIds[tipo].add(entity.id);
            
            rowsHTML += `
              <div class="flex items-center border-b border-outline-variant/10 hover:bg-surface-container-high transition-colors group even:bg-surface-container-low/30">
                <div class="w-48 shrink-0 px-4 py-3 border-r border-outline-variant/20 flex flex-col justify-center overflow-hidden">
                  <div class="${marginClass} ${borderColor} flex items-center gap-1 group-hover:opacity-100 opacity-90 transition-opacity">
                      <span class="text-[9px] font-bold uppercase tracking-widest text-outline shrink-0 group-hover:text-primary transition-colors">${labelMap[tipo]}</span>
                      <button onclick="event.stopPropagation(); window.app.openTimelineEntity('${entity.id}', '${tipo}')" class="text-xs text-on-surface leading-tight truncate font-medium group-hover:text-primary transition-colors text-left hover:underline" title="Abrir em Planos">${entity.title}</button>
                  </div>
                </div>
                <!-- Área do Gráfico de Gantt -->
                <div class="flex-1 relative h-12 py-3 flex items-center cursor-default group/bar">
                  <div class="absolute ${barHeight} rounded-lg overflow-hidden shadow-sm transition-all group-hover:shadow-md ${barStyles} ${txtColor} ${isOverdue ? 'ring-2 ring-error/60' : ''}"
                       style="left:${visualLeft.toFixed(2)}%; width:${visualWidth.toFixed(2)}%" title="${entity.title} | Progresso: ${progress}%">
                    <!-- Fundo de progresso Real -->
                    <div class="absolute top-0 bottom-0 left-0 bg-black/20 dark:bg-white/10" style="width: ${progress}%"></div>
                    <div class="absolute inset-0 flex items-center px-2">
                        <span class="text-[10px] font-bold truncate leading-none z-10 drop-shadow-sm whitespace-nowrap block ${showInlineTitle ? 'w-full text-center' : 'w-0 h-0 overflow-hidden'}">${showInlineTitle ? entity.title : ''}</span>
                    </div>
                  </div>
                </div>
              </div>`;
        };

        const processMicros = (macroId, dim) => {
            const micros = (state.entities.micros || []).filter(m => m.macroId === macroId && filterStatus(m));
            micros.forEach(micro => renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim));
        };
        const processMacros = (okrId, dim) => {
            const macros = (state.entities.macros || []).filter(m => m.okrId === okrId && filterStatus(m));
            macros.forEach(macro => {
                renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                processMicros(macro.id, dim);
            });
        };
        const processOkrs = (metaId, dim) => {
            const okrs = (state.entities.okrs || []).filter(o => o.metaId === metaId && filterStatus(o));
            okrs.forEach(okr => {
                renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                processMacros(okr.id, dim);
            });
        };

        const processMetaBranch = (meta, ignoreDimFilter = false) => {
            if (!meta || !filterStatus(meta)) return;
            const dim = meta.dimensionName || meta.dimension || 'Geral';
            if (!ignoreDimFilter && currentFilter !== 'Todas' && dim !== currentFilter) return;

            renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
            processOkrs(meta.id, dim);

            const macrosWithoutOkr = (state.entities.macros || []).filter(m => {
                if (!filterStatus(m)) return false;
                if (renderedIds.macros.has(m.id)) return false;
                if (m.metaId !== meta.id) return false;
                if (!m.okrId) return true;
                return !(state.entities.okrs || []).some(o => o.id === m.okrId);
            });
            macrosWithoutOkr.forEach(macro => {
                renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                processMicros(macro.id, dim);
            });

            const microsWithoutMacro = (state.entities.micros || []).filter(micro => {
                if (!filterStatus(micro)) return false;
                if (renderedIds.micros.has(micro.id)) return false;
                if (micro.metaId !== meta.id) return false;
                if (!micro.macroId) return true;
                return !(state.entities.macros || []).some(m => m.id === micro.macroId);
            });
            microsWithoutMacro.forEach(micro => {
                renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim);
            });
        };

        const processMetas = () => {
             const metas = (state.entities.metas || []).filter(m => filterStatus(m));
             metas.forEach(meta => processMetaBranch(meta));
        };

        // Lógica de Processamento de Árvore (Hierárquica vs. Global)
        if (hType && hId) {
            if (hType === 'metas') {
                const meta = state.entities.metas.find(m => m.id === hId);
                if (meta && filterStatus(meta)) processMetaBranch(meta, true);
            } else if (hType === 'okrs') {
                const okr = state.entities.okrs.find(o => o.id === hId);
                if (okr && filterStatus(okr)) {
                    const meta = state.entities.metas.find(m => m.id === okr.metaId);
                    const dim = okr.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    processMacros(okr.id, dim);
                }
            } else if (hType === 'macros') {
                const macro = state.entities.macros.find(m => m.id === hId);
                if (macro && filterStatus(macro)) {
                    const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                    const meta = okr ? state.entities.metas.find(m => m.id === okr.metaId) : state.entities.metas.find(m => m.id === macro.metaId);
                    const dim = macro.dimension || okr?.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    if (okr && filterStatus(okr)) renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                    processMicros(macro.id, dim);
                }
            } else if (hType === 'micros') {
                const micro = state.entities.micros.find(m => m.id === hId);
                if (micro && filterStatus(micro)) {
                    const macro = state.entities.macros.find(m => m.id === micro.macroId);
                    const okr = macro ? state.entities.okrs.find(o => o.id === macro.okrId) : state.entities.okrs.find(o => o.id === micro.okrId);
                    const meta = okr ? state.entities.metas.find(m => m.id === okr.metaId) : state.entities.metas.find(m => m.id === micro.metaId);
                    const dim = micro.dimension || macro?.dimension || okr?.dimension || meta?.dimension || meta?.dimensionName || 'Geral';
                    if (meta && filterStatus(meta)) renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    if (okr && filterStatus(okr)) renderRow(okr, 'okrs', 'ml-4 border-l-4 pl-2', dim);
                    if (macro && filterStatus(macro)) renderRow(macro, 'macros', 'ml-8 border-l-4 pl-2', dim);
                    renderRow(micro, 'micros', 'ml-16 border-l-4 pl-2', dim);
                }
            }
        } else {
             processMetas();
        }

        // ── Estado vazio ───────────────────────────────────────────
        if (!rowsHTML) {
          rowsHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-outline">
              <span class="material-symbols-outlined notranslate text-4xl mb-3">
                calendar_today
              </span>
              <p class="text-sm italic">
                Nenhuma entidade correspondente ao seu filtro atual foi encontrada nesta janela de visualização.
              </p>
            </div>`;
        }

        container.innerHTML = `
          <div class="relative min-w-[600px]">
            ${headerHTML}
            <div class="relative pb-6">
              ${todayLine}
              ${rowsHTML}
            </div>
          </div>`;
    },

    updateCascadeProgress: function(entityId, type) {
        const state = window.sistemaVidaState;
        
        if (type === 'micros') {
            const micro = state.entities.micros.find(m => m.id === entityId);
            if (micro && micro.macroId) {
                const siblings = state.entities.micros.filter(m => m.macroId === micro.macroId && m.status !== 'abandoned');
                console.log("Calculando progresso:", micro.macroId, "| Filhos (Micros) encontrados:", siblings.length);
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const macro = state.entities.macros.find(m => m.id === micro.macroId);
                if (macro) {
                    if (avg >= 99) {
                        macro.progress = 100;
                        macro.status = 'done';
                    } else {
                        macro.progress = Math.round(avg);
                        if (macro.status === 'done') macro.status = 'active';
                    }
                    this.updateCascadeProgress(macro.id, 'macros');
                }
            }
        } else if (type === 'macros') {
            const macro = state.entities.macros.find(m => m.id === entityId);
            if (macro && macro.okrId) {
                const siblings = state.entities.macros.filter(m => m.okrId === macro.okrId && m.status !== 'abandoned');
                console.log("Calculando progresso:", macro.okrId, "| Filhos (Macros) encontrados:", siblings.length);
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                if (okr) {
                    const krProgress = this.computeKeyResultsProgress(okr.keyResults);
                    const hasKrs = krProgress !== null;
                    const finalProgress = hasKrs ? Math.round((krProgress * 0.7) + (avg * 0.3)) : Math.round(avg);
                    if (finalProgress >= 99) {
                        okr.progress = 100;
                        okr.status = 'done';
                    } else {
                        okr.progress = finalProgress;
                        if (okr.status === 'done') okr.status = 'active';
                    }
                    this.updateCascadeProgress(okr.id, 'okrs');
                }
            }
        } else if (type === 'okrs') {
            const okr = state.entities.okrs.find(o => o.id === entityId);
            if (okr && okr.metaId) {
                const siblings = state.entities.okrs.filter(o => o.metaId === okr.metaId && o.status !== 'abandoned');
                console.log("Calculando progresso:", okr.metaId, "| Filhos (OKRs) encontrados:", siblings.length);
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const meta = state.entities.metas.find(m => m.id === okr.metaId);
                if (meta) {
                    if (avg >= 99) {
                        meta.progress = 100;
                        meta.status = 'done';
                    } else {
                        meta.progress = Math.round(avg);
                        if (meta.status === 'done') meta.status = 'active';
                    }
                }
            }
        } else if (type === 'metas') {
            const meta = state.entities.metas.find(m => m.id === entityId);
            if (meta && meta.parentMetaId) {
                const siblings = state.entities.metas.filter(m => m.parentMetaId === meta.parentMetaId && m.status !== 'abandoned');
                console.log("Calculando progresso:", meta.parentMetaId, "| Filhos (Metas) encontrados:", siblings.length);
                const avg = siblings.length > 0 ? siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length : 0;
                const parentMeta = state.entities.metas.find(m => m.id === meta.parentMetaId);
                if (parentMeta) {
                    if (avg >= 99) {
                        parentMeta.progress = 100;
                        parentMeta.status = 'done';
                    } else {
                        parentMeta.progress = Math.round(avg);
                        if (parentMeta.status === 'done') parentMeta.status = 'active';
                    }
                    this.updateCascadeProgress(parentMeta.id, 'metas');
                }
            }
        }
    },

    // ------------------------------------------------------------------------
    // Reactive Actions
    // ------------------------------------------------------------------------
    completeMicroAction: function(id) {
        const state = window.sistemaVidaState;
        const micro = state.entities.micros.find(m => m.id === id);
        if (!micro) return;

        // Define se estamos marcando ou desmarcando a tarefa
        const isCompleting = micro.status !== 'done';
        micro.status = isCompleting ? 'done' : 'pending';
        // Sincroniza com a propriedade Legada 'completed' para manter UI funcionando
        micro.completed = isCompleting;
        micro.progress = isCompleting ? 100 : 0;

        if (isCompleting) {
          micro.completedDate = this.getLocalDateKey();
        } else {
          delete micro.completedDate;
        }

        // Dispara cascata
        this.updateCascadeProgress(micro.id, 'micros');

        if (isCompleting && micro.macroId) {
            const macro = state.entities.macros.find(m => m.id === micro.macroId);
            if (macro && macro.okrId) {
                const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                if (okr) {
                    // Regra de Sucesso (Locke & Latham): 70% é o alvo ideal.
                    if (okr.progress >= 70 && !okr.rewarded70) {
                        okr.rewarded70 = true;
                        if (state.perma) {
                            state.perma.A = this.normalizePermaScore((state.perma.A || 0) + 0.5);
                        }
                        const metaLocal = state.entities.metas.find(m => m.id === okr.metaId);
                        const bonusDim = this.normalizeDimensionKey(metaLocal?.dimension || metaLocal?.dimensionName);
                        if (bonusDim && state.dimensions[bonusDim]) {
                            state.dimensions[bonusDim].score = Math.min(100, state.dimensions[bonusDim].score + 5);
                        }
                        if (this.showNotification) this.showNotification("🎯 OKR atingiu 70% (Alvo Ideal). Bônus de realização aplicado!");
                    }
                }
            }
        }
        
        this.saveState(false);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
        if (this.currentView === 'foco') this.render.foco();
    },

    startEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const list = (state.entities && state.entities[type]) || [];
        const entity = list.find(e => e.id === id);
        if (!entity || entity.status === 'done') return;
        entity.status = 'in_progress';
        if (!entity.progress || entity.progress < 1) entity.progress = 1;
        if (type === 'micros') entity.completed = false;
        this.saveState(false);
        if (this.currentView === 'hoje' && this.render.hoje) this.render.hoje();
        if (this.currentView === 'painel' && this.render.painel) this.render.painel();
        if (this.currentView === 'planos' && this.render.planos) this.render.planos();
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
        if (confirm('Deseja marcar este item (e todos os seus dependentes diretos) como 100% concluído?')) {
            const state = window.sistemaVidaState;
            const item = state.entities[type].find(e => e.id === id);
            if (item) {
                item.progress = 100; item.status = 'done';
                if (type === 'micros') item.completed = true;
                this.updateCascadeProgress(id, type); // Mantém a automação Bottom-Up
                this.cascadeStatusDown(id, type, 'done'); // Dispara a nova Cascata Top-Down
                this.saveState(false);
                if (this.render.planos) this.render.planos();
                if (this.render.painel) this.render.painel();
            }
        }
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
        }
        if (['metas', 'okrs', 'macros', 'micros'].includes(type)) {
            clone.createdAt = this.getLocalDateKey();
        }

        list.push(clone);
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
        window.sistemaVidaState.dimensions[dim].score = parseInt(score);
        const polygon = document.getElementById('roda-polygon');
        if (polygon) {
            const axes = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
            const angles = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => deg * Math.PI / 180);
            const pts = axes.map((d, i) => {
                const sc = window.sistemaVidaState.dimensions[d]?.score || 0;
                const r = 40 * (sc / 100);
                const x = 50 + r * Math.sin(angles[i]);
                const y = 50 - r * Math.cos(angles[i]);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            });
            polygon.setAttribute('points', pts.join(' '));
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
        if (inicioInput) inicioInput.value = item.inicioDate || item.agendamento?.inicioDate || (type === 'okrs' ? '' : (item.prazo || ''));
        if (prazoInput) prazoInput.value = item.prazo || '';
        document.getElementById('crud-context').value = item.purpose || item.description || item.indicator || '';
        const successCriteriaInput = document.getElementById('crud-success-criteria');
        if (successCriteriaInput) successCriteriaInput.value = item.successCriteria || item.purpose || '';
        const challengeInput = document.getElementById('crud-challenge-level');
        if (challengeInput) challengeInput.value = String(item.challengeLevel || 3);
        const commitmentInput = document.getElementById('crud-commitment-level');
        if (commitmentInput) commitmentInput.value = String(item.commitmentLevel || 3);
        const keyResultsInput = document.getElementById('crud-key-results');
        if (keyResultsInput) keyResultsInput.value = this.serializeKeyResultsText(item.keyResults);
        
        // Compatibilidade retrô: agendamento antigo migra visualmente para datas reais
        
        if (type === 'habits') {
            document.getElementById('crud-trigger').value = item.trigger || '';
            const routineInput = document.getElementById('habit-routine');
            if (routineInput) routineInput.value = item.routine || item.context || item.title || '';
            const rewardInput = document.getElementById('habit-reward');
            if (rewardInput) rewardInput.value = item.reward || '';
            const stepsInput = document.getElementById('habit-steps');
            if (stepsInput) stepsInput.value = Array.isArray(item.steps) ? item.steps.join('\n') : '';
            if (document.getElementById('habit-track-mode')) document.getElementById('habit-track-mode').value = item.trackMode || 'boolean';
            if (document.getElementById('habit-target')) document.getElementById('habit-target').value = item.targetValue || 1;
            if (document.getElementById('habit-frequency')) document.getElementById('habit-frequency').value = item.frequency || 'daily';
            if (document.getElementById('habit-days') && item.specificDays) {
                Array.from(document.getElementById('habit-days').options).forEach(opt => {
                    opt.selected = item.specificDays.includes(opt.value);
                });
            }
        }

        this.onTypeChange(type);
        if (type === 'habits') this.renderHabitStepsChecklist(id);
        
        // Seta o pai após popular a lista
        const parentSelect = document.getElementById('create-parent');
        if (parentSelect) {
            let parentId = '';
            if (type === 'metas') parentId = item.parentMetaId || '';
            if (type === 'okrs') parentId = item.metaId || '';
            if (type === 'macros') parentId = item.okrId || '';
            if (type === 'micros') parentId = item.macroId || '';
            const hasOption = Array.from(parentSelect.options || []).some(opt => opt.value === parentId);
            if (parentId && !hasOption) {
                const ghost = document.createElement('option');
                ghost.value = parentId;
                ghost.textContent = 'Vínculo atual (fora do filtro de dimensão)';
                parentSelect.appendChild(ghost);
            }
            parentSelect.value = parentId;
        }
        if (type === 'micros') this.syncMicroWeekPlanToggle(id);
    },

    // ------------------------------------------------------------------------
    // Utils
    // ------------------------------------------------------------------------
    exportToExcel: function() {
        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const state = window.sistemaVidaState;

        // 1. Aba: Planos
        const planosCol = ["ID", "Tipo", "Dimensão", "Título", "Contexto_Indicador", "Prazo", "Progresso", "ID_Pai", "Critério_Sucesso", "Desafio", "Comprometimento", "Key_Results"];
        const planosData = [planosCol];
        const types = ['metas', 'okrs', 'macros', 'micros'];
        types.forEach(t => {
            (state.entities[t] || []).forEach(e => {
                const context = e.purpose || e.description || e.indicator || "";
                const parentId = e.metaId || e.okrId || e.macroId || "";
                const keyResultsText = this.serializeKeyResultsText(e.keyResults);
                planosData.push([
                    e.id, t.slice(0, -1), e.dimension || "Geral", e.title, context, e.prazo || "", e.progress || 0, parentId,
                    e.successCriteria || "", e.challengeLevel || "", e.commitmentLevel || "", keyResultsText
                ]);
            });
        });
        const wsPlanos = XLSX.utils.aoa_to_sheet(planosData);
        wsPlanos['!cols'] = [{wch:15}, {wch:10}, {wch:15}, {wch:40}, {wch:40}, {wch:15}, {wch:10}, {wch:15}, {wch:30}, {wch:12}, {wch:16}, {wch:42}];
        XLSX.utils.book_append_sheet(wb, wsPlanos, "Planos");

        // 2. Aba: Propósito
        const propCol = ["Categoria", "Chave", "Texto_Preenchido"];
        const propData = [propCol];
        
        // Perfil / Valores
        propData.push(["Identidade", "Valores Pessoais", (state.profile.values || []).join(", ")]);
        
        // Ikigai
        const ikigaiM = { missao: "Missão", vocacao: "Vocação", love: "Paixão (O que ama)", good: "Bom em (O que é bom)", need: "O que o Mundo Precisa", paid: "Pelo que pode ser Pago", sintese: "Síntese Ikigai" };
        Object.entries(ikigaiM).forEach(([k, label]) => {
            propData.push(["Ikigai", label, state.profile.ikigai?.[k] || ""]);
        });

        // Visão
        const visionM = { saude: "Visão Saúde", carreira: "Visão Carreira", intelecto: "Visão Intelectual", quote: "Citação Inspiradora" };
        Object.entries(visionM).forEach(([k, label]) => {
            propData.push(["Visão", label, state.profile.vision?.[k] || ""]);
        });

        // Legado
        const legacyM = { familia: "Legado Família", profissao: "Legado Profissional", mundo: "Legado Mundo" };
        Object.entries(legacyM).forEach(([k, label]) => {
            propData.push(["Legado", label, state.profile.legacyObj?.[k] || ""]);
        });

        // Roda da Vida
        Object.entries(state.dimensions || {}).forEach(([dim, data]) => {
            propData.push(["Roda da Vida", dim, data.score || 0]);
        });

        // PERMA
        const permaM = { P: "Emoções Positivas (P)", E: "Engajamento (E)", R: "Relacionamentos (R)", M: "Significado (M)", A: "Realização (A)" };
        Object.entries(permaM).forEach(([k, label]) => {
            propData.push(["PERMA", label, state.perma?.[k] || 0]);
        });
        
        // SWLS
        const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
        propData.push(["SWLS", "Score", swls.lastScore || 0]);
        propData.push(["SWLS", "Data", swls.lastDate || ""]);
        (swls.answers || []).slice(0, 5).forEach((answer, idx) => {
            propData.push(["SWLS", `Q${idx + 1}`, answer]);
        });

        const wsProp = XLSX.utils.aoa_to_sheet(propData);
        wsProp['!cols'] = [{wch:15}, {wch:30}, {wch:60}];
        XLSX.utils.book_append_sheet(wb, wsProp, "Propósito");

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

        // 4. Aba: Diário
        const logCol = ["Data", "Energia", "Gratidão", "O_Que_Funcionou", "O_Que_Aprendi", "Shutdown_1", "Shutdown_2", "Shutdown_3"];
        const logData = [logCol];
        Object.entries(state.dailyLogs || {}).sort().forEach(([date, log]) => {
            const shutdown = Array.isArray(log.shutdown)
                ? log.shutdown
                : (typeof log.shutdown === 'string' ? [log.shutdown] : []);
            const row = [
                date,
                log.energy || 5,
                log.gratidao || "",
                log.funcionou || "",
                log.aprendi || "",
                shutdown[0] || "",
                shutdown[1] || "",
                shutdown[2] || ""
            ];
            logData.push(row);
        });
        const wsDiario = XLSX.utils.aoa_to_sheet(logData);
        wsDiario['!cols'] = [{wch:12}, {wch:10}, {wch:40}, {wch:40}, {wch:40}, {wch:30}, {wch:30}, {wch:30}];
        XLSX.utils.book_append_sheet(wb, wsDiario, "Diário");

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

    updateNavUI: function(activeView) {
        document.querySelectorAll('nav button').forEach(btn => {
            const icon = btn.querySelector('.material-symbols-outlined.notranslate');
            const view = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            btn.setAttribute('data-active', view === activeView ? 'true' : 'false');
            
            if (view === activeView) {
                btn.classList.add('text-primary');
                btn.classList.remove('text-on-surface-variant');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                btn.classList.remove('text-primary');
                btn.classList.add('text-on-surface-variant');
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
                linkedMicro.status = 'in_progress';
                linkedMicro.completed = false;
                linkedMicro.progress = Math.max(Number(linkedMicro.progress) || 0, 1);
                linkedMicro.focusSec = Math.max(0, Number(linkedMicro.focusSec) || 0) + focusSec;
                linkedMicro.focusSessions = Math.max(0, Number(linkedMicro.focusSessions) || 0) + 1;
                linkedMicro.lastFocusDate = dateKey;
            }
            dw.sessions.unshift({
                endedAt: dateKey,
                endedAtTs: new Date().toISOString(),
                focusSec: focusSec,
                mode: 'focus',
                microId: dw.microId || '',
                intention: dw.intention || ''
            });
            dw.sessions = dw.sessions.slice(0, 50);
            dw.mode = 'break';
            dw.remainingSec = dw.breakSec;
            dw.lastTickAt = Date.now();
            if (this.showNotification) this.showNotification('Bloco de foco concluído. Iniciando pausa de 20 minutos.');
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

    renderDeepWorkPanel: function() {
        this.normalizeDeepWorkState();
        const state = window.sistemaVidaState;
        const dw = state.deepWork;

        const statusEl = document.getElementById('deep-work-status');
        const stepEl = document.getElementById('deep-work-step');
        const timerEl = document.getElementById('deep-work-timer');
        const phaseEl = document.getElementById('deep-work-phase');
        const summaryEl = document.getElementById('deep-work-week-summary');
        const historyEl = document.getElementById('deep-work-history');
        const presetEl = document.getElementById('deep-work-preset');
        const microEl = document.getElementById('deep-work-micro');
        const intentionEl = document.getElementById('deep-work-intention');
        const startBtn = document.getElementById('deep-work-start-btn');
        const pauseBtn = document.getElementById('deep-work-pause-btn');
        const resetBtn = document.getElementById('deep-work-reset-btn');
        const finishBtn = document.getElementById('deep-work-finish-btn');

        if (presetEl && !dw.isRunning) {
            const presetMin = Math.max(5, Math.round((dw.targetSec || 5400) / 60));
            presetEl.value = String(presetMin);
        }
        if (microEl) {
            const micros = this.getPlanMicros({ includeDone: false });
            let selected = dw.microId || '';
            if (selected && !micros.some(m => m.id === selected)) {
                dw.microId = '';
                selected = '';
            }
            const plannedMicros = micros.filter(m => this._isPlannedThisWeek(m.id));
            const otherMicros = micros.filter(m => !this._isPlannedThisWeek(m.id));
            const makeOption = m => {
                const ctx = this.getMicroPlanContext(m);
                const label = `${m.title} - ${ctx.parentLabel}`;
                return `<option value="${this.escapeHtml(m.id)}" ${m.id === selected ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
            };
            let dwOptionsHtml = '<option value="">Selecione uma micro</option>';
            if (plannedMicros.length > 0) {
                dwOptionsHtml += `<optgroup label="📅 Plano da Semana">${plannedMicros.map(makeOption).join('')}</optgroup>`;
            }
            if (otherMicros.length > 0) {
                dwOptionsHtml += `<optgroup label="Outros">${otherMicros.map(makeOption).join('')}</optgroup>`;
            }
            microEl.innerHTML = dwOptionsHtml;
        }
        if (intentionEl && !intentionEl.value && dw.intention) intentionEl.value = dw.intention;

        const hasSelectedMicro = !!(dw.microId || microEl?.value);
        if (statusEl) {
            if (!dw.isRunning && !hasSelectedMicro) statusEl.textContent = 'Escolha uma micro ação';
            else if (!dw.isRunning) statusEl.textContent = 'Pronto para iniciar';
            else if (dw.isPaused) statusEl.textContent = 'Sessão pausada';
            else statusEl.textContent = dw.mode === 'focus' ? 'Foco profundo em andamento' : 'Pausa de recuperação';
        }
        if (stepEl) {
            if (!dw.isRunning && !hasSelectedMicro) stepEl.textContent = 'Passo 1 de 3: selecione a micro';
            else if (!dw.isRunning) stepEl.textContent = 'Passo 2 de 3: inicie o bloco';
            else if (dw.isPaused) stepEl.textContent = 'Pausado: retome ou finalize';
            else stepEl.textContent = dw.mode === 'focus' ? 'Passo 3 de 3: executando foco' : 'Pausa estruturada';
        }
        if (timerEl) timerEl.textContent = this.formatClock(dw.remainingSec);
        if (phaseEl) phaseEl.textContent = dw.mode === 'focus' ? 'Foco' : 'Pausa';

        const baseBtn = 'px-3 md:px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50';
        const primaryBtn = `${baseBtn} bg-primary text-on-primary shadow-sm`;
        const neutralBtn = `${baseBtn} bg-surface-container-high border border-outline-variant/20 text-on-surface`;
        const activeBtn = `${baseBtn} bg-primary/10 border border-primary/30 text-primary ring-2 ring-primary/20`;
        const finishBtnClass = `${baseBtn} bg-secondary-container text-on-secondary-container`;
        if (startBtn) {
            startBtn.textContent = dw.isRunning ? (dw.isPaused ? 'Em pausa' : 'Em foco') : 'Iniciar';
            startBtn.className = dw.isRunning && dw.mode === 'focus' ? activeBtn : primaryBtn;
            startBtn.disabled = dw.isRunning;
        }
        if (pauseBtn) {
            pauseBtn.textContent = dw.isPaused ? 'Retomar' : 'Pausar';
            pauseBtn.className = dw.isPaused ? activeBtn : neutralBtn;
            pauseBtn.disabled = !dw.isRunning;
        }
        if (resetBtn) {
            resetBtn.className = neutralBtn;
            resetBtn.disabled = !dw.isRunning && !hasSelectedMicro;
        }
        if (finishBtn) {
            finishBtn.className = dw.isRunning ? activeBtn : finishBtnClass;
            finishBtn.disabled = !dw.isRunning;
        }

        if (summaryEl) {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(today.getDate() - today.getDay());
            const sessions = (dw.sessions || []).filter(s => {
                const dt = new Date(`${s.endedAt || ''}T00:00:00`);
                return !Number.isNaN(dt.getTime()) && dt >= weekStart;
            });
            const totalSec = sessions.reduce((sum, s) => sum + (Number(s.focusSec) || 0), 0);
            const hours = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            summaryEl.textContent = `${sessions.length} sessões, ${hours}h${String(mins).padStart(2, '0')} de foco profundo.`;
        }

        if (historyEl) {
            const rows = (dw.sessions || []).slice(0, 5);
            if (rows.length === 0) {
                historyEl.innerHTML = '<p class="text-xs text-outline italic">Nenhuma sessão registrada.</p>';
            } else {
                historyEl.innerHTML = rows.map((s) => {
                    const mins = Math.max(1, Math.round((Number(s.focusSec) || 0) / 60));
                    const micro = (state.entities.micros || []).find(m => m.id === s.microId);
                    const microLabel = micro?.title || 'Sem vínculo';
                    const ctx = micro ? this.getMicroPlanContext(micro) : null;
                    const dateLabel = this.formatDateTimeLocal(s.endedAtTs) || s.endedAt || '';
                    return `<div class="flex items-center justify-between text-xs border border-outline-variant/10 rounded-lg px-3 py-2">
                        <div class="min-w-0">
                            <p class="font-medium text-on-surface truncate">${this.escapeHtml(microLabel)}</p>
                            <p class="text-outline truncate">${this.escapeHtml(ctx ? ctx.path : dateLabel)}</p>
                            <p class="text-outline/80 truncate">${this.escapeHtml(dateLabel)}</p>
                        </div>
                        <span class="font-bold text-primary shrink-0">${mins} min</span>
                    </div>`;
                }).join('');
            }
        }

        this.ensureDeepWorkTicking();
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
                micro.status = 'in_progress';
                if (!micro.progress || micro.progress < 1) micro.progress = 1;
                micro.completed = false;
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
        if (!micro || micro.status === 'done') return;
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
        if (!micro || micro.status === 'done') return;
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
            targetMicro.status = 'in_progress';
            targetMicro.completed = false;
            if (!targetMicro.progress || targetMicro.progress < 1) targetMicro.progress = 1;
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
        const dw = window.sistemaVidaState.deepWork;
        if (!dw.isRunning) return;
        if (dw.mode === 'focus') {
            dw.completedFocusSec = Math.max(60, Math.round((Number(dw.targetSec) || 0) - (Number(dw.remainingSec) || 0)));
        }
        dw.remainingSec = 0;
        this.onDeepWorkCountdownEnd();
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
        this.saveState(true);
        this.closePermaModal();
        this.switchView('proposito'); // Força re-render completo
        this.showNotification("Diagnóstico PERMA atualizado com sucesso!");
    },

    openOdysseyModal: function(id) {
        const state = window.sistemaVidaState;
        if (!state.profile.odyssey) state.profile.odyssey = {
            A: { title: "A Via Consolidada", desc: "Foco em ascensão na carreira atual.", conf: 4, nrg: 4 },
            B: { title: "O Salto Criativo", desc: "Transição para trabalho solo.", conf: 3, nrg: 5 },
            C: { title: "A Vida Acadêmica", desc: "Doutorado e pesquisa.", conf: 2, nrg: 3 }
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

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
