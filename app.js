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
        odysseyImages: { cenarioA: "", cenarioB: "", cenarioC: "" },
        identity: { strengths: [], shadows: [] },
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
        theme: 'auto'
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
            ok:      { icon: 'cloud_done',    text: 'Sincronizado',     cls: 'text-emerald-500' },
            error:   { icon: 'cloud_off',     text: 'Falha na nuvem',   cls: 'text-red-400' },
            syncing: { icon: 'cloud_sync',    text: 'Sincronizando…',   cls: 'text-primary' },
            offline: { icon: 'cloud_off',     text: 'Modo local',       cls: 'text-amber-400' },
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
        return lv <= 2 ? 0 : lv <= 5 ? 1 : lv <= 9 ? 2 : lv <= 14 ? 3 : 4;
    },
    getDimensionIdentity: function(dimension, level) {
        const lv = Math.max(1, Number(level) || 1);
        const tier = this.getTierFromLevel(lv);
        const tiers = {
            'Saúde':          { titles: ['Sedentário', 'Ativo', 'Atleta', 'Guerreiro', 'Lendário'], icon: 'fitness_center' },
            'Mente':          { titles: ['Curioso', 'Estudioso', 'Pensador', 'Sábio', 'Iluminado'], icon: 'psychology' },
            'Carreira':       { titles: ['Aprendiz', 'Criador', 'Construtor', 'Mestre', 'Visionário'], icon: 'work' },
            'Finanças':       { titles: ['Administrador', 'Poupador', 'Estrategista', 'Investidor', 'Patriarca'], icon: 'payments' },
            'Relacionamentos':{ titles: ['Presente', 'Conector', 'Influente', 'Mentor', 'Catalisador'], icon: 'groups' },
            'Família':        { titles: ['Cuidador', 'Guardião', 'Pilar', 'Âncora', 'Legado'], icon: 'family_restroom' },
            'Lazer':          { titles: ['Espectador', 'Explorador', 'Aventureiro', 'Criativo', 'Maestro'], icon: 'sports_esports' },
            'Propósito':      { titles: ['Buscador', 'Visionário', 'Missionário', 'Guia', 'Sábio'], icon: 'auto_awesome' }
        };
        const def = tiers[dimension] || { titles: ['Iniciante', 'Integrador', 'Mestre', 'Líder', 'Lendário'], icon: 'stars' };
        return { title: def.titles[tier], icon: def.icon, tier, tierMax: 4 };
    },
    getLevelFromXp: function(xp) {
        return Math.floor(Math.max(0, Number(xp) || 0) / 100) + 1;
    },
    getLevelProgress: function(xp) {
        const safeXp = Math.max(0, Number(xp) || 0);
        const current = safeXp % 100;
        return {
            level: this.getLevelFromXp(safeXp),
            current,
            next: 100,
            pct: Math.max(0, Math.min(100, current))
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
        if (!gamification.dimensionXp || typeof gamification.dimensionXp !== 'object' || Array.isArray(gamification.dimensionXp)) {
            gamification.dimensionXp = {};
        }
        if (!gamification.events || typeof gamification.events !== 'object' || Array.isArray(gamification.events)) {
            gamification.events = {};
        }
        if (!Array.isArray(gamification.achievements)) gamification.achievements = [];
        if (!Array.isArray(gamification.recentEvents)) gamification.recentEvents = [];

        const legacyXp = Math.max(0, Number(state.profile?.xp) || 0);
        gamification.totalXp = Math.max(0, Number(gamification.totalXp) || 0, legacyXp);
        Object.keys(gamification.dimensionXp).forEach((dim) => {
            gamification.dimensionXp[dim] = Math.max(0, Number(gamification.dimensionXp[dim]) || 0);
        });
        gamification.achievements = gamification.achievements
            .filter(item => item && item.id)
            .filter((item, idx, arr) => arr.findIndex(a => a.id === item.id) === idx);
        gamification.recentEvents = gamification.recentEvents.filter(Boolean).slice(0, 20);

        if (!state.profile) state.profile = {};
        state.profile.xp = gamification.totalXp;
        state.profile.level = this.getLevelFromXp(gamification.totalXp);
        return gamification;
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
            first_habit_graduated: { title: 'Hábito automático', icon: 'verified' }
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
    awardGamification: function(eventType, payload = {}) {
        const gamification = this.ensureGamificationState();
        const key = payload.key || `${eventType}:${payload.id || ''}:${payload.date || this.getLocalDateKey()}`;
        if (!key || gamification.events[key]) return null;

        let xp = 0;
        if (eventType === 'micro_complete') xp = 12 + (payload.planned ? 6 : 0) + (payload.inProgress ? 4 : 0);
        if (eventType === 'habit_complete') xp = 6;
        if (eventType === 'deep_work') xp = Math.max(10, Math.min(40, Math.round((Number(payload.focusSec) || 0) / 300)));
        if (eventType === 'weekly_review') xp = 25;
        if (eventType === 'habit_complete' && payload.sourceType) xp += payload.sourceType === 'shadow' ? 4 : 2;
        if (eventType === 'habit_complete' && payload.maturity === 'graduated') xp = Math.max(1, Math.round(xp * 0.5));
        if (eventType === 'weekly_review' && payload.identityReflection) xp += 5;
        if (xp <= 0) return null;

        const dimension = payload.dimension || '';
        const totalBefore = gamification.totalXp;
        const dimensionBefore = Math.max(0, Number(gamification.dimensionXp[dimension]) || 0);
        gamification.events[key] = {
            type: eventType,
            at: new Date().toISOString(),
            xp,
            dimension,
            sourceType: payload.sourceType || '',
            sourceId: payload.sourceId || '',
            habitMode: payload.habitMode || '',
            maturity: payload.maturity || ''
        };
        gamification.totalXp += xp;
        if (dimension) gamification.dimensionXp[dimension] = dimensionBefore + xp;
        gamification.recentEvents.unshift({
            type: eventType,
            title: payload.title || '',
            xp,
            dimension,
            sourceType: payload.sourceType || '',
            sourceId: payload.sourceId || '',
            maturity: payload.maturity || '',
            at: new Date().toISOString()
        });
        gamification.recentEvents = gamification.recentEvents.slice(0, 20);

        const unlocked = [];
        if (eventType === 'micro_complete') {
            const firstMicro = this.unlockAchievement('first_micro_done');
            if (firstMicro) unlocked.push(firstMicro);
            if (payload.planned) {
                const planned = this.unlockAchievement('first_planned_micro');
                if (planned) unlocked.push(planned);
            }
        }
        if (eventType === 'habit_complete') {
            const habit = this.unlockAchievement('first_habit_done');
            if (habit) unlocked.push(habit);
        }
        if (eventType === 'deep_work') {
            const focus = this.unlockAchievement('first_focus_session');
            if (focus) unlocked.push(focus);
        }
        if (eventType === 'weekly_review') {
            const review = this.unlockAchievement('first_weekly_review');
            if (review) unlocked.push(review);
        }
        if (this.getLevelFromXp(totalBefore) < 5 && this.getLevelFromXp(gamification.totalXp) >= 5) {
            const total = this.unlockAchievement('total_level_5');
            if (total) unlocked.push(total);
        }
        const dimLevelAfter = dimension ? this.getLevelFromXp(gamification.dimensionXp[dimension]) : 0;
        const dimLevelBefore = this.getLevelFromXp(dimensionBefore);
        const tierBefore = this.getTierFromLevel(dimLevelBefore);
        const tierAfter = this.getTierFromLevel(dimLevelAfter);
        const tierPromotion = !!(dimension && tierAfter > tierBefore);

        if (dimension && dimLevelBefore < 3 && dimLevelAfter >= 3) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_2:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 6 && dimLevelAfter >= 6) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_3:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 10 && dimLevelAfter >= 10) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_4:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 15 && dimLevelAfter >= 15) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_5:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (eventType === 'habit_complete' || eventType === 'weekly_review') {
            this.syncIdentityLinkedHabits();
            const identityAchievements = this.evaluateIdentityAchievements();
            identityAchievements.forEach(ach => unlocked.push(ach));
        }

        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        window.sistemaVidaState.profile.xp = gamification.totalXp;
        window.sistemaVidaState.profile.level = this.getLevelFromXp(gamification.totalXp);
        return {
            xp,
            dimension,
            identity: this.getDimensionIdentity(dimension, dimLevelAfter),
            totalLevel: this.getLevelFromXp(gamification.totalXp),
            dimensionLevel: dimLevelAfter || null,
            totalLeveledUp: this.getLevelFromXp(totalBefore) < this.getLevelFromXp(gamification.totalXp),
            dimensionLeveledUp: !!(dimension && dimLevelBefore < dimLevelAfter),
            tierPromotion,
            achievementsUnlocked: unlocked
        };
    },

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
            const shouldAddStrength = habit.sourceType !== 'strength'
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
        if (habits.some(h => h.sourceType === 'strength' && h.sourceId)) {
            const ach = this.unlockAchievement('first_strength_habit');
            if (ach) unlocked.push(ach);
        }
        if (habits.some(h => h.sourceType === 'shadow' && this.getHabitDoneDates(h).length >= 7)) {
            const ach = this.unlockAchievement('shadow_antidote_7');
            if (ach) unlocked.push(ach);
        }
        const weekKey = this._getWeekKey ? this._getWeekKey() : '';
        if (weekKey) {
            const weekDates = this.getWeekDateKeys(weekKey);
            const didStrength = habits.some(h => h.sourceType === 'strength' && weekDates.some(d => this.isHabitDoneOnDate(h, d)));
            const didShadow = habits.some(h => h.sourceType === 'shadow' && weekDates.some(d => this.isHabitDoneOnDate(h, d)));
            if (didStrength && didShadow) {
                const ach = this.unlockAchievement('identity_integration_week');
                if (ach) unlocked.push(ach);
            }
        }
        const linkedHabits = habits.filter(h => h.sourceType && h.sourceId);
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
    showGamificationToast: function(result) {
        if (!result || !this.showToast) return;
        const tierPromotion = result.tierPromotion;
        const leveledUp = tierPromotion || result.totalLeveledUp || result.dimensionLeveledUp || result.achievementsUnlocked?.some(a => /desbloqueado|Sistema em movimento/i.test(a.title));
        const openers = tierPromotion
            ? ['Novo título desbloqueado!', 'Você avançou de tier!', 'Promoção registrada!']
            : leveledUp
                ? ['Subiu de nível!', 'Novo patamar!', 'Evolução registrada!']
                : ['Boa execução!', 'Pequena vitória registrada!', 'Consistência conta!'];
        const opener = openers[Math.floor(Math.random() * openers.length)];
        const parts = [`${opener} +${result.xp} XP`];
        if (result.dimension && result.identity) {
            parts.push(tierPromotion
                ? `${result.dimension}: agora ${result.identity.title}`
                : `${result.identity.title} · nível ${result.dimensionLevel}`);
        } else {
            parts.push(`Sistema nível ${result.totalLevel}`);
        }
        if (result.achievementsUnlocked && result.achievementsUnlocked.length) {
            parts.push(`Conquista: ${result.achievementsUnlocked[0].title}`);
        }
        this.showToast(parts.join(' · '), 'success');
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
    showTierPromotionOverlay: function(dimension, title, icon) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;';
        overlay.innerHTML = `
            <div style="position:absolute;top:50%;left:50%;animation:tierUpFade 2.1s cubic-bezier(0.19,1,0.22,1) forwards;background:var(--md-sys-color-surface-container-highest);border:1px solid var(--md-sys-color-outline-variant);border-radius:1.5rem;padding:2rem 3rem;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);min-width:220px;">
                <span class="material-symbols-outlined notranslate" style="font-size:2.5rem;color:var(--md-sys-color-primary);display:block;">${icon}</span>
                <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--md-sys-color-outline);margin-top:0.75rem;">${this.escapeHtml(dimension)}</p>
                <p style="font-size:1.4rem;font-weight:800;color:var(--md-sys-color-on-surface);margin-top:0.2rem;">${this.escapeHtml(title)}</p>
                <p style="font-size:0.7rem;color:var(--md-sys-color-outline);margin-top:0.2rem;">Novo título desbloqueado</p>
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
        this.ensureGamificationState();
        this.syncIdentityLinkedHabits();
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
    },
    shouldShowSplashOnOpen: function() {
        this.ensureSettingsState();
        const settings = window.sistemaVidaState.settings;
        if (settings.splashEnabled === false) return false;
        if (settings.splashMode === 'always') return true;

        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        let log = {};
        try { log = JSON.parse(localStorage.getItem('lifeos_splash_log') || '{}') || {}; } catch (_) { log = {}; }
        const todayCount = Number(log.date === todayKey ? log.count : 0) || 0;
        const maxCount = settings.splashMode === 'twice_daily' ? 2 : 1;
        return todayCount < maxCount;
    },
    registerSplashShown: function() {
        const todayKey = this.getLocalDateKey ? this.getLocalDateKey() : new Date().toISOString().slice(0, 10);
        try {
            const raw = JSON.parse(localStorage.getItem('lifeos_splash_log') || '{}') || {};
            const count = raw.date === todayKey ? Number(raw.count || 0) + 1 : 1;
            localStorage.setItem('lifeos_splash_log', JSON.stringify({ date: todayKey, count }));
            localStorage.setItem('lifeos_last_splash', todayKey);
        } catch (_) {}
    },
    showDailySplash: function() {
        this.ensureSettingsState();
        const compass = this.getDailyCompass();
        const quote = compass.quote;
        this.registerSplashShown();
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
        if (el) {
            el.style.transition = 'opacity 0.3s ease-out';
            el.style.opacity = '0';
            setTimeout(() => { el.remove(); this.switchView('hoje'); }, 320);
        } else {
            this.switchView('hoje');
        }
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
            <p class="text-sm font-semibold ${isSuccess ? 'text-on-surface' : 'text-white'}">${message}</p>
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
        this.normalizeDimensionsState();
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
        this.renderProfileChrome();

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
        if (valuesBanner) {
            if (values.length > 0) {
                valuesBanner.innerHTML = values.map(v =>
                    `<span class="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest animate-fade-in">${v}</span>`
                ).join('');
            } else {
                valuesBanner.innerHTML = '<p class="text-xs text-outline italic">Escolha os valores que guiam suas decisões.</p>';
            }
        }
    },

    ensureIdentityState: function() {
        const profile = window.sistemaVidaState.profile || {};
        if (!profile.identity || typeof profile.identity !== 'object') {
            profile.identity = { strengths: [], shadows: [] };
        }
        const normalizeList = (list, type) => {
            if (!Array.isArray(list)) return [];
            return list.map((item) => {
                const title = String(item?.title || item?.name || item || '').trim();
                if (!title) return null;
                return {
                    id: String(item?.id || `${type}-${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`),
                    title,
                    dimension: String(item?.dimension || ''),
                    description: String(item?.description || ''),
                    evidence: String(item?.evidence || ''),
                    excessRisk: String(item?.excessRisk || ''),
                    practice: String(item?.practice || item?.suggestedPractice || ''),
                    obstacle: String(item?.obstacle || ''),
                    ifThen: String(item?.ifThen || ''),
                    trigger: String(item?.trigger || ''),
                    impact: String(item?.impact || ''),
                    desiredResponse: String(item?.desiredResponse || ''),
                    linkedHabitIds: Array.isArray(item?.linkedHabitIds) ? item.linkedHabitIds.map(String) : [],
                    weeklyLogs: item?.weeklyLogs && typeof item.weeklyLogs === 'object' && !Array.isArray(item.weeklyLogs) ? item.weeklyLogs : {},
                    createdAt: String(item?.createdAt || this.getLocalDateKey()),
                    updatedAt: String(item?.updatedAt || '')
                };
            }).filter(Boolean);
        };
        profile.identity.strengths = normalizeList(profile.identity.strengths, 'strength');
        profile.identity.shadows = normalizeList(profile.identity.shadows, 'shadow');
        window.sistemaVidaState.profile = profile;
    },

    getIdentityCatalog: function(type) {
        const strengths = [
            'Clareza', 'Disciplina', 'Coragem', 'Criatividade', 'Empatia',
            'Pensamento analítico', 'Resiliência', 'Comunicação', 'Autonomia', 'Curiosidade',
            'Organização', 'Liderança', 'Foco', 'Aprendizado rápido', 'Responsabilidade'
        ];
        const shadows = [
            'Impaciência', 'Procrastinação', 'Perfeccionismo', 'Autocrítica excessiva', 'Dispersão',
            'Dificuldade de pedir ajuda', 'Reatividade', 'Evitação de conflito', 'Ansiedade de controle', 'Rigidez',
            'Inconstância', 'Sobrecarga', 'Comparação', 'Dificuldade de dizer não', 'Paralisia por análise'
        ];
        return type === 'strengths' ? strengths : shadows;
    },

    getIdentityTypeLabel: function(type) {
        return type === 'strengths' ? 'Força' : 'Sombra';
    },

    getIdentityItemById: function(type, id) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity?.[type] || [];
        return list.find(item => item.id === id) || null;
    },

    getIdentityTitleById: function(type, id) {
        const item = this.getIdentityItemById(type, id);
        return item ? item.title : '';
    },

    addIdentityItem: function(type, title) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity[type];
        if (!Array.isArray(list)) return;
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle) return;
        if (list.some(item => item.title.toLowerCase() === cleanTitle.toLowerCase())) {
            this.showToast('Esse item já está na sua identidade.', 'success');
            return;
        }
        const prefix = type === 'strengths' ? 'strength' : 'shadow';
        list.push({
            id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: cleanTitle,
            dimension: '',
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
            createdAt: this.getLocalDateKey(),
            updatedAt: this.getLocalDateKey()
        });
        this.evaluateIdentityAchievements();
        this.saveState(true);
        this.renderIdentityBase();
        this.showToast(type === 'strengths' ? 'Força adicionada.' : 'Sombra adicionada.', 'success');
    },

    addCustomIdentityItem: function(type) {
        const label = type === 'strengths' ? 'força' : 'sombra';
        const title = window.prompt(`Nome da ${label}:`);
        if (!title || !title.trim()) return;
        this.addIdentityItem(type, title.trim());
    },

    removeIdentityItem: function(type, id) {
        this.ensureIdentityState();
        const list = window.sistemaVidaState.profile.identity[type];
        if (!Array.isArray(list)) return;
        window.sistemaVidaState.profile.identity[type] = list.filter(item => item.id !== id);
        this.saveState(true);
        this.renderIdentityBase();
        this.showToast(type === 'strengths' ? 'Força removida.' : 'Sombra removida.', 'success');
    },

    editIdentityItem: function(type, id) {
        this.ensureIdentityState();
        const item = this.getIdentityItemById(type, id);
        if (!item) return;
        const isStrength = type === 'strengths';
        const title = window.prompt(`${this.getIdentityTypeLabel(type)}: nome`, item.title);
        if (title === null) return;
        const dimension = window.prompt('Dimensão principal (opcional)', item.dimension || '');
        if (dimension === null) return;

        item.title = String(title || '').trim() || item.title;
        item.dimension = String(dimension || '').trim();
        if (isStrength) {
            const evidence = window.prompt('Evidência real: onde essa força aparece?', item.evidence || '');
            if (evidence === null) return;
            const excessRisk = window.prompt('Risco de excesso: quando essa força passa do ponto?', item.excessRisk || '');
            if (excessRisk === null) return;
            const practice = window.prompt('Prática sugerida: como treinar essa força?', item.practice || item.suggestedPractice || '');
            if (practice === null) return;
            item.evidence = String(evidence || '').trim();
            item.excessRisk = String(excessRisk || '').trim();
            item.practice = String(practice || '').trim();
        } else {
            const trigger = window.prompt('Gatilho: quando essa sombra aparece?', item.trigger || '');
            if (trigger === null) return;
            const impact = window.prompt('Impacto: o que ela costuma gerar?', item.impact || '');
            if (impact === null) return;
            const desiredResponse = window.prompt('Resposta desejada: o que praticar no lugar?', item.desiredResponse || '');
            if (desiredResponse === null) return;
            const obstacle = window.prompt('Obstáculo previsto: o que costuma te puxar para esse padrão?', item.obstacle || item.trigger || '');
            if (obstacle === null) return;
            const ifThen = window.prompt('Plano se-então: se o obstáculo aparecer, então...', item.ifThen || '');
            if (ifThen === null) return;
            item.trigger = String(trigger || '').trim();
            item.impact = String(impact || '').trim();
            item.desiredResponse = String(desiredResponse || '').trim();
            item.obstacle = String(obstacle || '').trim();
            item.ifThen = String(ifThen || '').trim();
        }
        item.updatedAt = this.getLocalDateKey();
        this.saveState(true);
        this.renderIdentityBase();
        this.showToast(`${this.getIdentityTypeLabel(type)} atualizada.`, 'success');
    },

    renderIdentityBase: function() {
        this.ensureIdentityState();
        this.renderSidebarValues();
        const identity = window.sistemaVidaState.profile.identity;
        const jsArg = (value) => this.escapeHtml(JSON.stringify(String(value)));
        const renderSelected = (type, emptyText) => {
            const container = document.getElementById(type === 'strengths' ? 'identity-strengths-list' : 'identity-shadows-list');
            if (!container) return;
            const items = identity[type] || [];
            if (!items.length) {
                container.innerHTML = `<p class="text-xs text-outline italic">${emptyText}</p>`;
                return;
            }
            container.innerHTML = items.map(item => `
                <div class="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest/70 p-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-on-surface">${this.escapeHtml(item.title)}</p>
                            ${item.dimension ? `<p class="mt-0.5 text-[10px] uppercase tracking-widest text-primary">${this.escapeHtml(item.dimension)}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="event.stopPropagation(); window.app.editIdentityItem(${jsArg(type)}, ${jsArg(item.id)})" class="material-symbols-outlined notranslate text-outline text-[16px] hover:text-primary" title="Editar">edit</button>
                            <button type="button" onclick="event.stopPropagation(); window.app.removeIdentityItem(${jsArg(type)}, ${jsArg(item.id)})" class="material-symbols-outlined notranslate text-outline text-[16px] hover:text-error" title="Remover">close</button>
                        </div>
                    </div>
                    <div class="mt-2 space-y-1 text-[11px] text-outline leading-relaxed">
                        ${type === 'strengths' && item.evidence ? `<p><span class="font-bold text-on-surface">Evidência:</span> ${this.escapeHtml(item.evidence)}</p>` : ''}
                        ${type === 'strengths' && item.excessRisk ? `<p><span class="font-bold text-on-surface">Excesso:</span> ${this.escapeHtml(item.excessRisk)}</p>` : ''}
                        ${type === 'strengths' && (item.practice || item.suggestedPractice) ? `<p><span class="font-bold text-on-surface">Prática:</span> ${this.escapeHtml(item.practice || item.suggestedPractice)}</p>` : ''}
                        ${type === 'shadows' && item.trigger ? `<p><span class="font-bold text-on-surface">Gatilho:</span> ${this.escapeHtml(item.trigger)}</p>` : ''}
                        ${type === 'shadows' && item.impact ? `<p><span class="font-bold text-on-surface">Impacto:</span> ${this.escapeHtml(item.impact)}</p>` : ''}
                        ${type === 'shadows' && item.desiredResponse ? `<p><span class="font-bold text-on-surface">Resposta:</span> ${this.escapeHtml(item.desiredResponse)}</p>` : ''}
                        ${type === 'shadows' && item.obstacle ? `<p><span class="font-bold text-on-surface">Obstáculo:</span> ${this.escapeHtml(item.obstacle)}</p>` : ''}
                        ${type === 'shadows' && item.ifThen ? `<p><span class="font-bold text-on-surface">Se-então:</span> ${this.escapeHtml(item.ifThen)}</p>` : ''}
                    </div>
                </div>
            `).join('');
        };
        const renderOptions = (type) => {
            const container = document.getElementById(type === 'strengths' ? 'identity-strengths-options' : 'identity-shadows-options');
            if (!container) return;
            const chosen = new Set((identity[type] || []).map(item => item.title.toLowerCase()));
            container.innerHTML = this.getIdentityCatalog(type).map(title => {
                const active = chosen.has(title.toLowerCase());
                return `<button type="button" onclick="window.app.addIdentityItem(${jsArg(type)}, ${jsArg(title)})"
                    class="px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${active ? 'border-primary/30 bg-primary/10 text-primary opacity-60' : 'border-outline-variant/30 text-outline hover:border-primary/40 hover:text-primary hover:bg-primary/5'}">
                    ${this.escapeHtml(title)}
                </button>`;
            }).join('');
        };
        renderSelected('strengths', 'Escolha uma força abaixo para começar — elas amplificam seu XP nos hábitos.');
        renderSelected('shadows', 'Escolha um padrão abaixo — trabalhar sombras vale mais XP nos hábitos.');
        renderOptions('strengths');
        renderOptions('shadows');
    },

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
    },

    // ── Renderização da aba Semanal ─────────────────────────────────────────────
    renderWeeklyPlans: function() {
        const state = window.sistemaVidaState;
        const weekPlans = state.weekPlans || {};
        const weekKey = this._getWeekKey();

        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const labelEl = document.getElementById('semanal-week-label');
        if (labelEl) labelEl.textContent = this._formatWeekRange(weekKey).toUpperCase();

        // Card da semana atual
        const currentCard = document.getElementById('semanal-current-card');
        const currentPlan = weekPlans[weekKey];
        const primaryLabel = document.getElementById('weekly-plan-primary-label');
        const primaryIcon = document.getElementById('weekly-plan-primary-icon');
        if (primaryLabel) primaryLabel.textContent = currentPlan ? 'Editar Plano' : 'Criar Plano da Semana';
        if (primaryIcon) primaryIcon.textContent = currentPlan ? 'edit_calendar' : 'event_available';
        if (currentCard) {
            currentCard.className = 'mb-10';
            currentCard.innerHTML = this._renderWeeklyPlanShell({
                weekKey,
                plan: currentPlan,
                label: 'Semana Atual',
                actionLabel: currentPlan ? 'Editar Plano' : 'Criar Plano',
                actionIcon: currentPlan ? 'edit_calendar' : 'event_available',
                actionOptions: '',
                isCurrent: true,
                emptyText: 'Nenhum plano para esta semana ainda. Clique em "Criar Plano" para começar.'
            });
        }

        const nextCard = document.getElementById('semanal-next-card');
        if (nextCard) {
            const nextWeekKey = this._getNextWeekKey();
            const nextPlan = weekPlans[nextWeekKey];
            const suggestions = this.getNextWeekCarryoverSuggestions(weekKey);
            if (nextPlan) {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: nextPlan,
                    label: 'Próxima Semana',
                    actionLabel: 'Editar Plano',
                    actionIcon: 'edit_calendar',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true`,
                    isCurrent: false,
                    emptyText: ''
                });
            } else if (suggestions.length > 0) {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: null,
                    label: 'Próxima Semana',
                    actionLabel: 'Planejar Próxima',
                    actionIcon: 'auto_awesome',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true, suggestCarryover: true`,
                    isCurrent: false,
                    emptyText: `<span class="font-bold text-primary">Há ${suggestions.length} micro${suggestions.length > 1 ? 's' : ''} pendente${suggestions.length > 1 ? 's' : ''} para considerar.</span> Priorizei o que ficou planejado e não concluído, está atrasado ou já estava em andamento.`
                });
            } else {
                nextCard.innerHTML = this._renderWeeklyPlanShell({
                    weekKey: nextWeekKey,
                    plan: null,
                    label: 'Próxima Semana',
                    actionLabel: 'Planejar Próxima',
                    actionIcon: 'event_upcoming',
                    actionOptions: `weekKey: '${nextWeekKey}', nextWeek: true`,
                    isCurrent: false,
                    emptyText: 'Quando fechar esta semana, prepare o próximo plano aqui.'
                });
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
                    const reviewSection = review ? this._renderWeeklyReviewSummary(review) : '';
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
                <button onclick="window.app.openWeeklyPlanModal(${options})"
                    class="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                    <span class="material-symbols-outlined notranslate text-[16px]">${this.escapeHtml(actionIcon || 'edit_calendar')}</span>
                    ${this.escapeHtml(actionLabel || 'Editar')}
                </button>
            </div>
            ${body}
        </div>`;
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

            ${isCurrent ? `
            <button onclick="window.app.openWeeklyPlanModal({ addMicro: true })"
                class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-outline-variant/40 text-outline text-xs font-bold uppercase tracking-wider hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all">
                <span class="material-symbols-outlined notranslate text-[16px]">add_task</span>
                Nova micro para esta semana
            </button>` : ''}

            ${(() => {
                if (!isCurrent) return '';
                const review = (state.reviews || {})[plan.weekKey || app._getWeekKey()];
                return review ? app._renderWeeklyReviewSummary(review) : '';
            })()}

            ${(() => {
                if (!isCurrent) return '';
                const todayDow = new Date().getDay();
                if (![5, 6, 0].includes(todayDow)) return '';
                const wk = app._getWeekKey();
                const hasReview = !!(state.reviews || {})[wk];
                if (hasReview) return `
                <div class="flex items-center gap-2 mt-2 text-primary text-xs font-bold uppercase tracking-wider">
                    <span class="material-symbols-outlined notranslate text-[16px]">check_circle</span>
                    Revisão da semana já realizada
                </div>`;
                return `
                <button onclick="window.app.startWeeklyReview()"
                    class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary text-sm font-bold rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all">
                    <span class="material-symbols-outlined notranslate text-[18px]">rate_review</span>
                    Fazer Revisão da Semana
                </button>`;
            })()}
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
            if (this.shouldShowSplashOnOpen()) {
                this.showDailySplash();
            } else {
                this.switchView('hoje');
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
        return { dateKey, checkin, log, habitsDone, microsDone, notes, dwSessions, dwMinutes, xpEarned, achievements };
    },

    renderTimelineHistory: function(showAll) {
        const container = document.getElementById('timeline-history-container');
        if (!container) return;
        const allDates = this.getAllActiveDates();
        const PAGE = 30;
        const dates = showAll ? allDates : allDates.slice(0, PAGE);
        const hasMore = !showAll && allDates.length > PAGE;

        if (!dates.length) {
            container.innerHTML = '<p class="text-sm text-outline italic p-4 text-center">Nenhum registro ainda. Use o app por alguns dias para construir sua linha do tempo.</p>';
            return;
        }

        const emotionEmojis = { calmo:'😌', ansioso:'😰', animado:'🥳', focado:'🎯', cansado:'😴', sobrecarregado:'🤯', esperancoso:'🌟', irritado:'😤', grato:'🙏', motivado:'🚀', triste:'😔', confiante:'💪' };
        const energyEmojis = ['', '🪫', '😩', '😐', '⚡', '🔥'];
        const dimIcons = { 'Saúde':'💪','Mente':'🧠','Carreira':'💼','Finanças':'💰','Relacionamentos':'🤝','Família':'🏠','Lazer':'🎨','Propósito':'✨' };
        const habitIconMap = { 'Saúde':'fitness_center','Mente':'psychology','Carreira':'work','Finanças':'payments','Relacionamentos':'groups','Família':'family_restroom','Lazer':'sports_esports','Propósito':'auto_awesome' };
        const macros = (window.sistemaVidaState.entities?.macros) || [];
        const todayKey = this.getLocalDateKey();
        const dots = (n, col) => Array.from({length:5}, (_,i) =>
            `<span class="inline-block w-2 h-2 rounded-full ${i < n ? col : 'bg-surface-container-high'}"></span>`
        ).join('');

        const cards = dates.map(dateKey => {
            const d = this.getAggregatedDayData(dateKey);
            const dateObj = new Date(dateKey + 'T12:00:00');
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
            const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const isToday = dateKey === todayKey;
            const emotionEmoji = d.checkin?.emotion ? (emotionEmojis[d.checkin.emotion] || '') : '';
            const energyEmoji = d.checkin?.energy ? (energyEmojis[d.checkin.energy] || '') : '';

            // Resumo rápido para o card colapsado
            const stats = [];
            if (d.microsDone.length) stats.push(`${d.microsDone.length} micro${d.microsDone.length > 1 ? 's' : ''}`);
            if (d.habitsDone.length) stats.push(`${d.habitsDone.length} hábito${d.habitsDone.length > 1 ? 's' : ''}`);
            if (d.dwMinutes) stats.push(`${d.dwMinutes}min foco`);
            if (d.notes.length) stats.push(`${d.notes.length} nota${d.notes.length > 1 ? 's' : ''}`);
            if (d.xpEarned) stats.push(`+${d.xpEarned} XP`);

            // ── Seções expandidas ──
            let checkinHtml = '';
            if (d.checkin) {
                const c = d.checkin;
                checkinHtml = `<div class="space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Como estava</p>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        ${c.sleepHours ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Sono</span><span class="font-semibold text-on-surface">${c.sleepHours}h</span></div>` : ''}
                        ${c.sleepQuality ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Qualidade</span><div class="flex gap-1">${dots(c.sleepQuality,'bg-tertiary')}</div></div>` : ''}
                        ${c.energy ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Energia</span><div class="flex gap-1">${dots(c.energy,'bg-primary')}</div></div>` : ''}
                        ${c.mood ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Humor</span><div class="flex gap-1">${dots(c.mood,'bg-secondary')}</div></div>` : ''}
                        ${c.stress ? `<div class="flex items-center gap-2 text-xs"><span class="text-outline w-20 shrink-0">Estresse</span><div class="flex gap-1">${dots(c.stress,'bg-error')}</div></div>` : ''}
                        ${c.emotion ? `<div class="flex items-center gap-2 text-xs col-span-2"><span class="text-outline w-20 shrink-0">Emoção</span><span class="font-medium">${emotionEmoji} ${this.escapeHtml(c.emotion)}</span></div>` : ''}
                    </div>
                </div>`;
            }

            let diaryHtml = '';
            if (d.log) {
                const parts = [];
                if (d.log.focus) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Intenção</p><p class="text-xs italic text-on-surface">"${this.escapeHtml(d.log.focus)}"</p></div>`);
                if (d.log.gratidao) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Gratidão</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(d.log.gratidao)}</p></div>`);
                if (d.log.funcionou) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">O que funcionou</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(d.log.funcionou)}</p></div>`);
                const dimEntries = Object.entries(d.log.dimensionNotes || {}).filter(([,v]) => v?.trim());
                if (dimEntries.length) parts.push(`<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Shutdown</p><div class="space-y-2">${dimEntries.map(([dim, text]) => `<div><p class="text-xs font-bold text-on-surface">${dimIcons[dim] || '⭐'} ${this.escapeHtml(dim)}</p><p class="text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(text)}</p></div>`).join('')}</div></div>`);
                if (parts.length) diaryHtml = `<div class="space-y-3">${parts.join('')}</div>`;
            }

            let habitsHtml = '';
            if (d.habitsDone.length) {
                habitsHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Hábitos concluídos</p><ul class="space-y-1">${
                    d.habitsDone.map(h => `<li class="flex items-center gap-2 text-xs text-on-surface-variant"><span class="material-symbols-outlined notranslate text-primary text-[14px]">${habitIconMap[h.dimension] || 'stars'}</span>${this.escapeHtml(h.title)}</li>`).join('')
                }</ul></div>`;
            }

            let microsHtml = '';
            if (d.microsDone.length) {
                microsHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Micro-ações concluídas</p><ul class="space-y-1">${
                    d.microsDone.map(m => {
                        const macro = macros.find(mc => mc.id === m.macroId);
                        return `<li class="flex items-start gap-2 text-xs"><span class="material-symbols-outlined notranslate text-secondary text-[14px] mt-0.5 shrink-0">check_circle</span><span class="text-on-surface-variant">${this.escapeHtml(m.title)}${macro ? `<span class="ml-1 text-outline">· ${this.escapeHtml(macro.title)}</span>` : ''}</span></li>`;
                    }).join('')
                }</ul></div>`;
            }

            let dwHtml = '';
            if (d.dwSessions.length) {
                dwHtml = `<div class="flex items-center gap-3"><span class="material-symbols-outlined notranslate text-tertiary text-[18px]">timer</span><div><p class="text-[10px] font-bold uppercase tracking-widest text-outline">Foco profundo</p><p class="text-xs text-on-surface-variant">${d.dwSessions.length} sessão${d.dwSessions.length > 1 ? 'ões' : ''} · ${d.dwMinutes} min</p></div></div>`;
            }

            let notesHtml = '';
            if (d.notes.length) {
                notesHtml = `<div><p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Anotações</p><ul class="space-y-1.5">${
                    d.notes.map(n => `<li class="text-xs"><span class="font-medium text-on-surface">${this.escapeHtml(n.title)}</span>${n.body ? `<span class="text-on-surface-variant"> — ${this.escapeHtml(n.body.slice(0, 100))}${n.body.length > 100 ? '…' : ''}</span>` : ''}</li>`).join('')
                }</ul></div>`;
            }

            let xpHtml = '';
            if (d.xpEarned || d.achievements.length) {
                xpHtml = `<div class="flex flex-wrap gap-2">
                    ${d.xpEarned ? `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">+${d.xpEarned} XP</span>` : ''}
                    ${d.achievements.map(a => `<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600"><span class="material-symbols-outlined notranslate text-[12px]">${this.escapeHtml(a.icon || 'military_tech')}</span>${this.escapeHtml(a.title)}</span>`).join('')}
                </div>`;
            }

            const sections = [checkinHtml, diaryHtml, habitsHtml, microsHtml, dwHtml, notesHtml, xpHtml].filter(Boolean);
            const safeKey = dateKey.replace(/-/g, '');

            return `<div class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm overflow-hidden">
                <button type="button" onclick="window.app.toggleTimelineCard('${safeKey}')"
                    class="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container-low transition-colors">
                    <div class="text-center shrink-0 w-9">
                        <span class="block text-[9px] uppercase font-bold text-outline leading-tight">${weekday}</span>
                        <span class="block text-xl font-bold text-primary leading-tight">${dayNum}</span>
                        <span class="block text-[9px] uppercase text-outline">${monthStr}</span>
                    </div>
                    <div class="w-px h-10 bg-outline-variant/20 shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${isToday ? '<span class="text-[10px] font-bold text-primary">Hoje</span>' : ''}
                            ${emotionEmoji ? `<span>${emotionEmoji}</span>` : ''}
                            ${energyEmoji ? `<span>${energyEmoji}</span>` : ''}
                            ${d.log?.focus ? `<span class="text-xs text-on-surface-variant italic truncate">${this.escapeHtml(d.log.focus.slice(0, 60))}${d.log.focus.length > 60 ? '…' : ''}</span>` : ''}
                        </div>
                        ${stats.length ? `<p class="mt-0.5 text-[10px] text-outline">${stats.join(' · ')}</p>` : ''}
                    </div>
                    ${sections.length ? `<span class="material-symbols-outlined notranslate text-outline text-[18px] shrink-0 tl-chev-${safeKey}">expand_more</span>` : ''}
                </button>
                ${sections.length ? `<div id="tl-expand-${safeKey}" class="hidden px-4 pb-5 pt-4 border-t border-outline-variant/10 space-y-4">${sections.join('<div class="h-px bg-outline-variant/10"></div>')}</div>` : ''}
            </div>`;
        }).join('');

        const moreBtn = hasMore
            ? `<div class="text-center pt-2"><button type="button" onclick="window.app.renderTimelineHistory(true)" class="text-xs font-bold text-primary hover:underline">Ver mais (${allDates.length - PAGE} dias restantes)</button></div>`
            : '';
        container.innerHTML = cards + moreBtn;
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

    saveValues: function(newValuesArray) {
        window.sistemaVidaState.profile.values = newValuesArray;
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
        this.showToast(`Trilha criada: 1 meta, ${okrs.length} OKR(s), ${macros.length} macro(s), ${micros.length} micro(s).`, 'success');

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

    openCreateModal: function(type = 'metas') {
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
        const woopGroup = document.getElementById('crud-woop-group');
        const metaHorizonGroup = document.getElementById('crud-meta-horizon-group');
        const successCriteriaGroup = document.getElementById('crud-success-criteria-group');
        const goalRigorGroup = document.getElementById('crud-goal-rigor-group');
        const keyResultsGroup = document.getElementById('crud-key-results-group');
        const effortGroup = document.getElementById('crud-effort-group');
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
        setGroupVisible(woopGroup, false);
        setGroupVisible(habitIdentityGroup, false);
        setGroupVisible(habitStepsChecklistWrap, false);
        setGroupVisible(successCriteriaGroup, false);
        setGroupVisible(goalRigorGroup, false);
        setGroupVisible(keyResultsGroup, false);
        setGroupVisible(effortGroup, false);
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
            this.populateHabitLinkedMeta();
            this.populateHabitIdentitySource();
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
            if (type === 'micros') setGroupVisible(effortGroup, true);
            if (['macros', 'micros'].includes(type)) {
                setGroupVisible(woopGroup, true, 'block');
                this.toggleCrudWoop(type === 'micros');
            }
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

    /**
     * Gera uma lista de insights automáticos baseados nos dados já existentes.
     * Retorna um array de objetos {icon, tone, text} ordenados por prioridade.
     * Zero impacto em dados — apenas leitura.
     */
    /**
     * Popula o select #habit-linked-meta com todas as Metas ativas,
     * agrupadas por dimensão. Mantém a seleção atual se o id ainda existir.
     */
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
        const select = document.getElementById('habit-identity-source');
        if (!select) return;
        this.ensureIdentityState();
        const prev = select.value;
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const strengths = identity.strengths || [];
        const shadows = identity.shadows || [];
        const isEmpty = !strengths.length && !shadows.length;

        const notice = document.getElementById('habit-identity-empty-notice');
        if (notice) notice.classList.toggle('hidden', !isEmpty);
        select.classList.toggle('hidden', isEmpty);

        if (!isEmpty) {
            const renderOption = (type, item) => {
                const prefix = type === 'strengths' ? 'Força' : 'Sombra';
                return `<option value="${type}:${this.escapeHtml(item.id)}">${prefix}: ${this.escapeHtml(item.title)}</option>`;
            };
            let html = '<option value="">— Sem conexão —</option>';
            if (strengths.length) {
                html += '<optgroup label="Forças">';
                strengths.forEach(item => { html += renderOption('strengths', item); });
                html += '</optgroup>';
            }
            if (shadows.length) {
                html += '<optgroup label="Sombras">';
                shadows.forEach(item => { html += renderOption('shadows', item); });
                html += '</optgroup>';
            }
            select.innerHTML = html;
            if (prev && select.querySelector(`option[value="${prev}"]`)) select.value = prev;
            this.onHabitIdentitySourceChange(select.value);
        }
    },

    onHabitIdentitySourceChange: function(value) {
        const wrap = document.getElementById('habit-identity-mode-wrap');
        const mode = document.getElementById('habit-identity-mode');
        const isShadow = String(value || '').startsWith('shadows:');
        if (wrap) {
            wrap.classList.toggle('hidden', !value);
            wrap.classList.toggle('flex', !!value);
        }
        if (mode && value) {
            mode.value = isShadow ? (mode.value === 'build' ? 'replace' : mode.value) : 'build';
        }
    },

    parseHabitIdentitySource: function(rawValue) {
        const raw = String(rawValue || '');
        const [type, ...rest] = raw.split(':');
        const id = rest.join(':');
        if (!id || !['strengths', 'shadows'].includes(type)) return { sourceType: '', sourceId: '', habitMode: '' };
        const sourceType = type === 'strengths' ? 'strength' : 'shadow';
        const modeEl = document.getElementById('habit-identity-mode');
        let habitMode = modeEl ? String(modeEl.value || '') : '';
        if (!['build', 'reduce', 'replace'].includes(habitMode)) habitMode = sourceType === 'strength' ? 'build' : 'replace';
        if (sourceType === 'strength') habitMode = 'build';
        return { sourceType, sourceId: id, habitMode };
    },

    getHabitIdentityItem: function(habit) {
        if (!habit || !habit.sourceType || !habit.sourceId) return null;
        const type = habit.sourceType === 'strength' ? 'strengths' : habit.sourceType === 'shadow' ? 'shadows' : '';
        if (!type) return null;
        return this.getIdentityItemById(type, habit.sourceId);
    },

    renderHabitIdentityChip: function(habit) {
        const item = this.getHabitIdentityItem(habit);
        if (!item) return '';
        const isStrength = habit.sourceType === 'strength';
        const label = isStrength ? 'Força' : 'Sombra';
        const icon = isStrength ? 'workspace_premium' : 'change_circle';
        return `<p class="mt-1 text-[10px] ${isStrength ? 'text-primary' : 'text-secondary'} leading-tight truncate flex items-center gap-1">
            <span class="material-symbols-outlined notranslate text-[11px]">${icon}</span>${label}: ${this.escapeHtml(item.title)}
        </p>`;
    },

    syncIdentityLinkedHabits: function() {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || {};
        ['strengths', 'shadows'].forEach(type => {
            (identity[type] || []).forEach(item => { item.linkedHabitIds = []; });
        });
        (window.sistemaVidaState.habits || []).forEach(habit => {
            const type = habit.sourceType === 'strength' ? 'strengths' : habit.sourceType === 'shadow' ? 'shadows' : '';
            if (!type || !habit.sourceId) return;
            const item = (identity[type] || []).find(i => i.id === habit.sourceId);
            if (!item) return;
            if (!Array.isArray(item.linkedHabitIds)) item.linkedHabitIds = [];
            if (!item.linkedHabitIds.includes(habit.id)) item.linkedHabitIds.push(habit.id);
        });
    },

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
                    savedAt: String(entry?.savedAt || new Date().toISOString())
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 180);
    },

    ensureCadenceState: function() {
        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        const profile = window.sistemaVidaState.profile;
        if (!profile.cadence || typeof profile.cadence !== 'object' || Array.isArray(profile.cadence)) profile.cadence = {};
        Object.keys(profile.cadence).forEach((key) => {
            const item = profile.cadence[key];
            if (!item || typeof item !== 'object') profile.cadence[key] = {};
            if (profile.cadence[key].lastAt && typeof profile.cadence[key].lastAt !== 'string') {
                profile.cadence[key].lastAt = String(profile.cadence[key].lastAt);
            }
        });
    },

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
                const entityType = String(rawLinked.entityType || '').trim();
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

    renderNotesPanel: function(showAll) {
        const container = document.getElementById('notes-list');
        if (!container) return;
        this.ensureNotesState();
        this.populateNoteLinkedSelect();
        const query = String(document.getElementById('notes-search')?.value || '').trim().toLowerCase();
        const allNotes = (window.sistemaVidaState.profile.notes || []).filter(note => {
            if (!query) return true;
            const haystack = [note.title, note.body, note.url, ...(note.tags || []), this.getNoteLinkLabel(note.linkedTo)]
                .join(' ').toLowerCase();
            return haystack.includes(query);
        });
        if (!allNotes.length) {
            container.innerHTML = '<p class="md:col-span-2 text-sm text-outline italic rounded-xl bg-surface-container-low p-4">Nenhuma nota encontrada.</p>';
            return;
        }
        const PAGE = 8;
        const notes = (showAll || query) ? allNotes : allNotes.slice(0, PAGE);
        const hasMore = !showAll && !query && allNotes.length > PAGE;
        const noteCards = notes.map(note => {
            const linkLabel = this.getNoteLinkLabel(note.linkedTo);
            const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
            const tags = (note.tags || []).map(tag =>
                `<span class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">${this.escapeHtml(tag)}</span>`
            ).join('');
            const url = note.url
                ? `<a href="${this.escapeHtml(note.url)}" target="_blank" rel="noopener" class="text-[11px] text-primary hover:underline truncate">${this.escapeHtml(note.url)}</a>`
                : '';
            return `
                <article class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 flex flex-col gap-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h4 class="text-sm font-bold text-on-surface leading-snug">${this.escapeHtml(note.title)}</h4>
                            ${linkLabel ? `<p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">${this.escapeHtml(linkLabel)}</p>` : ''}
                            ${dateStr ? `<p class="mt-0.5 text-[10px] text-outline">${dateStr}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="window.app.editProfileNote('${this.escapeHtml(note.id)}')" class="material-symbols-outlined notranslate text-outline text-[17px] hover:text-primary" title="Editar">edit</button>
                            <button type="button" onclick="window.app.deleteProfileNote('${this.escapeHtml(note.id)}')" class="material-symbols-outlined notranslate text-outline text-[17px] hover:text-error" title="Excluir">delete</button>
                        </div>
                    </div>
                    ${note.body ? `<p class="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line line-clamp-4">${this.escapeHtml(note.body)}</p>` : ''}
                    ${url}
                    ${tags ? `<div class="flex flex-wrap gap-1.5">${tags}</div>` : ''}
                </article>`;
        }).join('');
        const moreBtn = hasMore
            ? `<div class="md:col-span-2 text-center pt-1"><button type="button" onclick="window.app.renderNotesPanel(true)" class="text-xs font-bold text-primary hover:underline">Ver mais (${allNotes.length - PAGE} restantes)</button></div>`
            : '';
        container.innerHTML = noteCards + moreBtn;
    },

    getLinkedNotes: function(entityType, entityId) {
        this.ensureNotesState();
        return (window.sistemaVidaState.profile.notes || []).filter(note =>
            note.linkedTo?.entityType === entityType && note.linkedTo?.entityId === entityId
        );
    },

    getCadenceConfig: function() {
        return {
            checkin: { label: 'Check-in diário', expectedDays: 1, icon: 'monitor_heart', why: 'Sono, energia, humor e estresse.' },
            diary: { label: 'Diário / Shutdown', expectedDays: 1, icon: 'edit_note', why: 'Fechamento consciente do dia.' },
            weeklyPlan: { label: 'Planejamento semanal', expectedDays: 7, icon: 'edit_calendar', why: 'Escolher a carga da semana.' },
            weeklyReview: { label: 'Revisão semanal', expectedDays: 7, icon: 'rate_review', why: 'Transformar experiência em aprendizado.' },
            wheel: { label: 'Roda da Vida', expectedDays: 30, icon: 'pie_chart', why: 'Termômetro mensal das áreas.' },
            perma: { label: 'PERMA', expectedDays: 30, icon: 'psychology', why: 'Florescimento mensal.' },
            swls: { label: 'SWLS', expectedDays: 90, icon: 'monitoring', why: 'Satisfação global trimestral.' },
            odyssey: { label: 'Odyssey / Visão', expectedDays: 180, icon: 'explore', why: 'Revisão semestral dos cenários.' }
        };
    },

    markCadence: function(toolKey, dateKey = this.getLocalDateKey()) {
        this.ensureCadenceState();
        const config = this.getCadenceConfig();
        if (!config[toolKey]) return;
        window.sistemaVidaState.profile.cadence[toolKey] = {
            ...(window.sistemaVidaState.profile.cadence[toolKey] || {}),
            lastAt: dateKey,
            updatedAt: new Date().toISOString()
        };
    },

    getCadenceStatus: function(toolKey) {
        this.ensureCadenceState();
        const cfg = this.getCadenceConfig()[toolKey];
        if (!cfg) return { state: 'overdue', daysSince: null, expectedFreq: 0, label: toolKey };
        const lastAt = window.sistemaVidaState.profile.cadence?.[toolKey]?.lastAt || '';
        if (!lastAt) return { ...cfg, state: 'overdue', daysSince: null, expectedFreq: cfg.expectedDays, lastAt: '' };
        const today = new Date(this.getLocalDateKey() + 'T00:00:00');
        const last = new Date(lastAt + 'T00:00:00');
        const daysSince = Number.isFinite(last.getTime()) ? Math.max(0, Math.floor((today - last) / 86400000)) : null;
        let state = 'overdue';
        if (daysSince === null) state = 'overdue';
        else if (cfg.expectedDays <= 1) state = daysSince === 0 ? 'ok' : daysSince === 1 ? 'soon' : 'overdue';
        else if (daysSince <= Math.floor(cfg.expectedDays * 0.75)) state = 'ok';
        else if (daysSince <= cfg.expectedDays) state = 'soon';
        return { ...cfg, state, daysSince, expectedFreq: cfg.expectedDays, lastAt };
    },

    renderCadenceBadge: function(toolKey) {
        const status = this.getCadenceStatus(toolKey);
        const cfg = {
            ok: { text: 'Em dia', cls: 'bg-primary/10 text-primary border-primary/20' },
            soon: { text: 'Próximo', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
            overdue: { text: 'Em atraso', cls: 'bg-error/10 text-error border-error/20' }
        }[status.state] || {};
        const detail = status.daysSince === null ? 'Nunca feito' : `${status.daysSince}d`;
        return `<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.cls}">
            ${cfg.text} · ${detail}
        </span>`;
    },

    renderCadencePanel: function(containerId = 'cadence-status-panel', limit = 4) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const keys = Object.keys(this.getCadenceConfig());
        const items = keys
            .map(key => ({ key, status: this.getCadenceStatus(key) }))
            .sort((a, b) => {
                const rank = { overdue: 0, soon: 1, ok: 2 };
                return (rank[a.status.state] ?? 9) - (rank[b.status.state] ?? 9);
            })
            .slice(0, limit);
        container.innerHTML = items.map(({ key, status }) => `
            <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-bold text-on-surface flex items-center gap-1">
                        <span class="material-symbols-outlined notranslate text-primary text-[16px]">${this.escapeHtml(status.icon)}</span>
                        ${this.escapeHtml(status.label)}
                    </p>
                    <p class="mt-1 text-[11px] text-outline leading-relaxed">${this.escapeHtml(status.why)}</p>
                </div>
                <div class="shrink-0">${this.renderCadenceBadge(key)}</div>
            </div>
        `).join('');
    },

    renderProfileCadence: function() {
        const container = document.getElementById('profile-cadence-list');
        if (!container) return;
        const keys = Object.keys(this.getCadenceConfig());
        container.innerHTML = keys.map(key => {
            const status = this.getCadenceStatus(key);
            const freq = status.expectedFreq === 1 ? 'Diário' : `${status.expectedFreq} dias`;
            return `
            <div class="flex items-start justify-between gap-4 rounded-xl bg-surface-container-low p-4 border border-outline-variant/10">
                <div class="min-w-0">
                    <p class="text-sm font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined notranslate text-primary text-[18px]">${this.escapeHtml(status.icon)}</span>
                        ${this.escapeHtml(status.label)}
                    </p>
                    <p class="mt-1 text-xs text-outline leading-relaxed">${this.escapeHtml(status.why)} · Frequência: ${this.escapeHtml(freq)}</p>
                </div>
                ${this.renderCadenceBadge(key)}
            </div>`;
        }).join('');
    },

    getTodayCheckin: function() {
        this.ensureDailyCheckinState();
        const today = this.getLocalDateKey();
        return (window.sistemaVidaState.profile.dailyCheckins || []).find(entry => entry.date === today) || null;
    },

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
            savedAt: new Date().toISOString()
        };
        const list = window.sistemaVidaState.profile.dailyCheckins.filter(item => item.date !== today);
        list.unshift(entry);
        window.sistemaVidaState.profile.dailyCheckins = list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 180);
        window.sistemaVidaState.energy = entry.energy;
        this.markCadence('checkin', today);
        this.saveState(true);
        this.renderDailyCheckinPanel();
        this.renderProfileCadence();
        if (this.showToast) this.showToast('Check-in do dia salvo.', 'success');
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
    },

    renderDailyCheckinPanel: function() {
        const root = document.getElementById('daily-checkin-panel');
        if (!root) return;
        this.ensureDailyCheckinState();
        const todayEntry = this.getTodayCheckin();
        const defaults = todayEntry || { sleepHours: '', sleepQuality: 3, energy: window.sistemaVidaState.energy || 3, mood: 3, stress: 3, emotion: '' };
        const sleepEl = document.getElementById('daily-checkin-sleep-hours');
        if (sleepEl) sleepEl.value = defaults.sleepHours || '';
        ['daily-checkin-sleep-quality', 'daily-checkin-energy', 'daily-checkin-mood', 'daily-checkin-stress'].forEach(id => {
            const key = id.replace('daily-checkin-', '').replace('-', '');
            const fieldMap = { 'sleepquality': 'sleepQuality', 'energy': 'energy', 'mood': 'mood', 'stress': 'stress' };
            const field = fieldMap[key] || key;
            const val = Number(defaults[field] || 3);
            this.setCheckinVal(id, val, null);
        });
        const emotionVal = defaults.emotion || '';
        const emotionHidden = document.getElementById('daily-checkin-emotion');
        if (emotionHidden) emotionHidden.value = emotionVal;
        document.querySelectorAll('.emotion-chip').forEach(chip => {
            const active = chip.getAttribute('data-emotion') === emotionVal;
            chip.classList.toggle('bg-primary/20', active);
            chip.classList.toggle('border-primary', active);
            chip.classList.toggle('text-primary', active);
            chip.classList.toggle('font-bold', active);
        });

        const empty = document.getElementById('daily-checkin-empty');
        if (empty) empty.classList.toggle('hidden', !!todayEntry);
        const history = document.getElementById('daily-checkin-history');
        if (history) {
            const rows = (window.sistemaVidaState.profile.dailyCheckins || []).slice(0, 7);
            history.innerHTML = rows.length ? rows.map(item => `
                <div class="grid grid-cols-5 gap-2 text-[10px] text-center rounded-lg bg-surface-container-low px-2 py-2">
                    <span class="text-left text-outline">${this.escapeHtml(item.date.slice(5))}</span>
                    <span title="Sono">${this.escapeHtml(String(item.sleepHours || '--'))}h</span>
                    <span title="Energia">E${this.escapeHtml(String(item.energy))}</span>
                    <span title="Humor">H${this.escapeHtml(String(item.mood))}</span>
                    <span title="Estresse">S${this.escapeHtml(String(item.stress))}</span>
                </div>
            `).join('') : '<p class="text-xs text-outline italic">Sem histórico ainda. O primeiro check-in já cria a linha base.</p>';
        }
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

    toggleEmotionChip: function(btn) {
        const emotion = btn.getAttribute('data-emotion');
        const hidden = document.getElementById('daily-checkin-emotion');
        const currentVal = hidden ? hidden.value : '';
        const newVal = currentVal === emotion ? '' : emotion;
        if (hidden) hidden.value = newVal;
        document.querySelectorAll('.emotion-chip').forEach(chip => {
            const active = chip.getAttribute('data-emotion') === newVal;
            chip.classList.toggle('bg-primary/20', active);
            chip.classList.toggle('border-primary', active);
            chip.classList.toggle('text-primary', active);
            chip.classList.toggle('font-bold', active);
        });
    },

    getIdentityPracticeStats: function(weekKey = this._getWeekKey()) {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const habits = window.sistemaVidaState.habits || [];
        const weekDates = this.getWeekDateKeys(weekKey);
        const priorWeekDates = this.getWeekDateKeys(this.getRelativeWeekKey(weekKey, -1));
        const linkedHabits = habits.filter(h => h.sourceType && h.sourceId);
        const doneThisWeek = linkedHabits.filter(h => weekDates.some(date => this.isHabitDoneOnDate(h, date)));
        const doneLastWeek = linkedHabits.filter(h => priorWeekDates.some(date => this.isHabitDoneOnDate(h, date)));
        const practicedStrengthIds = new Set(doneThisWeek.filter(h => h.sourceType === 'strength').map(h => h.sourceId));
        const workedShadowIds = new Set(doneThisWeek.filter(h => h.sourceType === 'shadow').map(h => h.sourceId));
        const strengthIdsWithHabits = new Set(linkedHabits.filter(h => h.sourceType === 'strength').map(h => h.sourceId));
        const shadowIdsWithHabits = new Set(linkedHabits.filter(h => h.sourceType === 'shadow').map(h => h.sourceId));
        return {
            strengths: identity.strengths || [],
            shadows: identity.shadows || [],
            linkedHabits,
            doneThisWeek,
            doneLastWeek,
            practicedStrengthIds,
            workedShadowIds,
            strengthsWithoutPractice: (identity.strengths || []).filter(item => !practicedStrengthIds.has(item.id)),
            shadowsWithoutHabit: (identity.shadows || []).filter(item => !shadowIdsWithHabits.has(item.id)),
            strengthsWithoutHabit: (identity.strengths || []).filter(item => !strengthIdsWithHabits.has(item.id))
        };
    },

    getIdentityTrendSummary: function(weekKey = this._getWeekKey(), weeks = 4) {
        const habits = window.sistemaVidaState.habits || [];
        const summary = [];
        for (let i = weeks - 1; i >= 0; i--) {
            const wk = this.getRelativeWeekKey(weekKey, -i);
            const dates = this.getWeekDateKeys(wk);
            const strengthIds = new Set();
            const shadowIds = new Set();
            let linkedCompletions = 0;
            habits.forEach(habit => {
                if (!habit.sourceType || !habit.sourceId) return;
                const count = dates.reduce((acc, date) => acc + (this.isHabitDoneOnDate(habit, date) ? 1 : 0), 0);
                if (!count) return;
                linkedCompletions += count;
                if (habit.sourceType === 'strength') strengthIds.add(habit.sourceId);
                if (habit.sourceType === 'shadow') shadowIds.add(habit.sourceId);
            });
            summary.push({ weekKey: wk, strengthCount: strengthIds.size, shadowCount: shadowIds.size, linkedCompletions });
        }
        return summary;
    },

    renderPersonalEvolutionPanel: function() {
        const container = document.getElementById('personal-evolution-panel');
        if (!container) return;
        const stats = this.getIdentityPracticeStats();
        const card = ({ icon, title, value, copy, tone = 'primary' }) => `
            <div class="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(title)}</p>
                        <p class="mt-2 font-headline text-3xl italic text-${tone}">${this.escapeHtml(value)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-${tone}">${this.escapeHtml(icon)}</span>
                </div>
                <p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${copy}</p>
            </div>`;
        const practicedNames = stats.strengths
            .filter(item => stats.practicedStrengthIds.has(item.id))
            .map(item => item.title);
        const shadowNames = stats.shadows
            .filter(item => stats.workedShadowIds.has(item.id))
            .map(item => item.title);
        const missingShadowNames = stats.shadowsWithoutHabit.map(item => item.title).slice(0, 3);
        const trend = this.getIdentityTrendSummary();
        const trendCopy = trend.map(row => `${row.linkedCompletions}`).join(' · ');
        container.innerHTML = [
            card({
                icon: 'workspace_premium',
                title: 'Forças praticadas',
                value: String(stats.practicedStrengthIds.size),
                copy: practicedNames.length ? `Você praticou ${this.escapeHtml(practicedNames.join(', '))} nesta semana.` : 'Nenhuma força mapeada apareceu em hábitos concluídos nesta semana.'
            }),
            card({
                icon: 'change_circle',
                title: 'Sombras trabalhadas',
                value: String(stats.workedShadowIds.size),
                copy: shadowNames.length ? `Você trabalhou ${this.escapeHtml(shadowNames.join(', '))} com hábitos antídoto.` : 'Nenhuma sombra foi trabalhada por hábito vinculado nesta semana.',
                tone: 'secondary'
            }),
            card({
                icon: 'link_off',
                title: 'Sem antídoto',
                value: String(stats.shadowsWithoutHabit.length),
                copy: missingShadowNames.length ? `Sombras sem hábito: ${this.escapeHtml(missingShadowNames.join(', '))}.` : 'Todas as sombras mapeadas já têm algum hábito conectado.',
                tone: stats.shadowsWithoutHabit.length ? 'error' : 'primary'
            }),
            card({
                icon: 'timeline',
                title: 'Últimas 4 semanas',
                value: String(trend.reduce((sum, row) => sum + row.linkedCompletions, 0)),
                copy: `Conclusões ligadas à identidade por semana: ${this.escapeHtml(trendCopy || '0 · 0 · 0 · 0')}.`,
                tone: 'primary'
            })
        ].join('');
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

    renderPatternsPanel: function() {
        const container = document.getElementById('patterns-panel');
        if (!container) return;
        const gate = this.hasEnoughData('checkin', 14);
        if (!gate.ok) {
            container.innerHTML = `
                <div class="lg:col-span-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Dados insuficientes</p>
                    <h4 class="mt-2 font-headline text-xl font-bold text-on-surface">Precisa de ${gate.minDays} dias de check-in</h4>
                    <p class="mt-2 text-sm text-on-surface-variant leading-relaxed">Hoje existem ${gate.count}. Quando houver base suficiente, o Painel cruza sono, humor, estresse, execução de micros e hábitos. Correlação não é causalidade.</p>
                </div>`;
            return;
        }
        const rows = this.getCheckinJoinedRows(28);
        const sleepGood = this.splitAverage(rows, r => Number(r.sleepQuality) >= 4 || Number(r.sleepHours) >= 7, r => r.microRate);
        const sleepLow = this.splitAverage(rows, r => Number(r.sleepQuality) <= 2 || Number(r.sleepHours) < 6, r => r.microRate);
        const moodGood = this.splitAverage(rows, r => Number(r.mood) >= 4, r => r.habitRate);
        const moodLow = this.splitAverage(rows, r => Number(r.mood) <= 2, r => r.habitRate);
        const stressHigh = this.splitAverage(rows, r => Number(r.stress) >= 4, r => r.microRate);
        const stressLow = this.splitAverage(rows, r => Number(r.stress) <= 2, r => r.microRate);
        const fmtPct = (n) => Number.isFinite(Number(n)) ? `${Math.round(Number(n) * 100)}%` : '--';
        const deltaText = (a, b, labelA, labelB) => {
            if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return 'Ainda faltam dias em um dos grupos.';
            const delta = Math.round((Number(a) - Number(b)) * 100);
            if (Math.abs(delta) < 5) return `${labelA} e ${labelB} estao parecidos.`;
            return `${labelA} esta ${delta > 0 ? '+' : ''}${delta} pts vs ${labelB}.`;
        };
        const cards = [
            {
                icon: 'bedtime',
                title: 'Sono vs micros',
                value: `${fmtPct(sleepGood)} / ${fmtPct(sleepLow)}`,
                body: deltaText(sleepGood, sleepLow, 'Sono melhor', 'sono baixo'),
                trend: rows.map(r => r.microRate)
            },
            {
                icon: 'mood',
                title: 'Humor vs habitos',
                value: `${fmtPct(moodGood)} / ${fmtPct(moodLow)}`,
                body: deltaText(moodGood, moodLow, 'Humor alto', 'humor baixo'),
                trend: rows.map(r => r.habitRate)
            },
            {
                icon: 'stress_management',
                title: 'Estresse vs execucao',
                value: `${fmtPct(stressLow)} / ${fmtPct(stressHigh)}`,
                body: deltaText(stressLow, stressHigh, 'Estresse baixo', 'estresse alto'),
                trend: rows.map(r => Math.max(0, 1 - (Number(r.stress || 1) - 1) / 4)),
                tone: 'warn'
            }
        ];
        container.innerHTML = cards.map(card => `
            <article class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(card.title)}</p>
                        <p class="mt-2 font-headline text-2xl font-bold text-on-surface">${this.escapeHtml(card.value)}</p>
                    </div>
                    <span class="material-symbols-outlined notranslate text-primary">${this.escapeHtml(card.icon)}</span>
                </div>
                <div class="mt-4">${this.renderMiniTrend(card.trend, card.tone || 'primary')}</div>
                <p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(card.body)} Correlação não é causalidade.</p>
            </article>
        `).join('');
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

    getNextBestAction: function(options = {}) {
        const state = window.sistemaVidaState;
        const todayStr = this.getLocalDateKey();
        const today = new Date(todayStr + 'T00:00:00');
        const scope = options.scope || 'today';
        const micros = (state.entities?.micros || []).filter(m =>
            m && m.id && m.status !== 'done' && m.status !== 'abandoned' && !m.completed
        );

        const candidates = micros.map(micro => {
            const reasons = [];
            let score = 0;
            const { macro, okr, meta } = this._getMicroContext(micro);
            const prazo = micro.prazo ? new Date(micro.prazo + 'T00:00:00') : null;
            const inicio = micro.inicioDate ? new Date(micro.inicioDate + 'T00:00:00') : null;
            const daysToDue = prazo && !Number.isNaN(prazo.getTime())
                ? Math.floor((prazo - today) / (1000 * 60 * 60 * 24))
                : null;
            const hasStarted = !inicio || Number.isNaN(inicio.getTime()) || inicio <= today;
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
        }).filter(item => item.score > 0);

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

        const top = ranked[0] || null;
        if (!top) return null;
        if (top.reasons.length === 0) top.reasons.push('é a melhor próxima micro ativa');
        return top;
    },

    _renderNextActionCard: function(next, variant = 'today') {
        if (!next?.micro) {
            const title = variant === 'panel' ? 'Nenhuma decisão urgente' : 'Nada urgente agora';
            const text = variant === 'panel'
                ? 'O plano não mostra uma micro crítica neste momento. Continue executando o que já foi planejado.'
                : 'Seu dia não tem uma micro crítica pendente. Execute o plano com calma ou capture uma próxima ação.';
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
            ...next.reasons.map(r => `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">${this.escapeHtml(r)}</span>`)
        ].join('');
        const wrapper = variant === 'panel'
            ? 'bg-primary/5 border-primary/20'
            : 'bg-surface-container-lowest border-primary/20 shadow-sm';

        return `
            <div class="${wrapper} border rounded-2xl p-5 md:p-6">
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[10px] font-label uppercase tracking-widest text-primary font-bold mb-2">Próxima melhor ação</p>
                        <h4 class="font-headline text-xl md:text-2xl font-bold text-on-background leading-tight">${this.escapeHtml(micro.title)}</h4>
                        <div class="mt-3 flex flex-wrap gap-2">${reasons}</div>
                        <p class="mt-3 text-xs text-on-surface-variant leading-relaxed">${metaText}</p>
                    </div>
                    <div class="flex flex-wrap md:flex-col gap-2 md:min-w-[140px]">
                        <button type="button" onclick="window.app.completeMicroAction('${micro.id}')"
                            class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                            Concluir
                        </button>
                        <button type="button" onclick="window.app.postponeMicroOneDay('${micro.id}')"
                            class="flex-1 md:flex-none px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest active:scale-95 transition-all">
                            Adiar
                        </button>
                        <button type="button" onclick="window.app.openEntityReview('${micro.id}', 'micros')"
                            class="flex-1 md:flex-none px-4 py-2 rounded-xl border border-outline-variant/30 text-outline text-xs font-bold uppercase tracking-widest hover:bg-surface-container-high active:scale-95 transition-all">
                            Ver detalhes
                        </button>
                    </div>
                </div>
            </div>`;
    },

    renderNextBestAction: function() {
        const container = document.getElementById('next-best-action-container');
        if (!container) return;
        container.innerHTML = this._renderNextActionCard(this.getNextBestAction({ scope: 'today' }), 'today');
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
                microsContainer.innerHTML = '<p class="text-xs text-outline italic">Nenhum micro ativo disponível.</p>';
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
        this.saveState(true);
        const isNextWeek = weekKey > this._getWeekKey();
        this.closeWeeklyPlanModal();
        this.showNotification(isNextWeek ? 'Plano da próxima semana salvo!' : 'Plano semanal salvo!');
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
        await this.switchView('proposito');
        await new Promise(r => setTimeout(r, 350));
        this._showReviewPurposeAnchor();
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

    populateReviewIdentityFields: function() {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || { strengths: [], shadows: [] };
        const isEmpty = !(identity.strengths || []).length && !(identity.shadows || []).length;

        const cta = document.getElementById('review-identity-cta');
        const selects = document.getElementById('review-identity-selects');
        if (cta) cta.classList.toggle('hidden', !isEmpty);
        if (selects) selects.classList.toggle('hidden', isEmpty);

        if (!isEmpty) {
            const fillSelect = (id, items) => {
                const select = document.getElementById(id);
                if (!select) return;
                select.innerHTML = '<option value="">— Opcional —</option>' + (items || []).map(item =>
                    `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.title)}</option>`
                ).join('');
            };
            fillSelect('rev-strength', identity.strengths || []);
            fillSelect('rev-shadow', identity.shadows || []);
        }

        const suggestion = document.getElementById('review-identity-suggestion');
        if (!suggestion) return;
        if (isEmpty) {
            suggestion.textContent = '';
            return;
        }
        const weekKey = this._getWeekKey();
        const weekDates = this.getWeekDateKeys(weekKey);
        const practiced = (window.sistemaVidaState.habits || [])
            .filter(h => h.sourceType && h.sourceId && weekDates.some(date => this.isHabitDoneOnDate(h, date)))
            .map(h => this.getHabitIdentityItem(h)?.title)
            .filter(Boolean);
        suggestion.textContent = practiced.length
            ? `Sugestão: esta semana você praticou ${practiced.slice(0, 3).join(', ')}.`
            : 'Opcional: conecte a semana às suas forças e sombras.';
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

    updateIdentityWeeklyLogs: function(weekKey, review) {
        this.ensureIdentityState();
        const identity = window.sistemaVidaState.profile.identity || {};
        const stamp = new Date().toISOString();
        const writeLog = (type, id, payload) => {
            if (!id) return;
            const item = (identity[type] || []).find(i => i.id === id);
            if (!item) return;
            if (!item.weeklyLogs || typeof item.weeklyLogs !== 'object') item.weeklyLogs = {};
            item.weeklyLogs[weekKey] = { ...(item.weeklyLogs[weekKey] || {}), ...payload, updatedAt: stamp };
            item.updatedAt = this.getLocalDateKey();
        };
        writeLog('strengths', review.strengthId, {
            used: true,
            note: review.responsePracticed || review.q3 || ''
        });
        writeLog('shadows', review.shadowId, {
            appeared: true,
            responsePracticed: review.responsePracticed || '',
            habitAdjustment: review.habitAdjustment || ''
        });
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
          odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' },
          identity: { strengths: [], shadows: [] },
          dailyCheckins: [],
          cadence: {},
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
        // ── Apaga backups locais para evitar que estado antigo sobreponha o reset ─
        try { localStorage.removeItem('lifeos_state_backup'); } catch (_) {}
        try { localStorage.removeItem('lifeos_state_backup_core'); } catch (_) {}
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
        const keyResults = this.readKrRows();
        const effort = this.getMicroEffort({ effort: document.getElementById('crud-effort')?.value || 'medio' });
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
                    app.showBlockingMessage('Defina o Critério / Meta do OKR para salvar.');
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
                    app.showBlockingMessage('Datas inválidas para Micro Ação. Verifique início e prazo.');
                    return;
                }
                const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                if (diffDays > 7) {
                    app.showBlockingMessage('Uma Micro Ação não pode durar mais de 7 dias. Divida-a em partes menores ou classifique como Macro Ação.');
                    return;
                }
            }
            obj.indicator = context || '';
            obj.effort = effort;
            obj.obstacle = obstacle;
            obj.ifThen = ifThen;
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
            obj.maturity = isEditing ? (getOldItem(id, 'habits').maturity || 'forming') : 'forming';
            obj.maturityMeta = isEditing ? (getOldItem(id, 'habits').maturityMeta || {}) : {};
            const linkedSel = document.getElementById('habit-linked-meta');
            obj.linkedMetaId = linkedSel && linkedSel.value ? linkedSel.value : null;
            const identityLink = this.parseHabitIdentitySource(document.getElementById('habit-identity-source')?.value || '');
            obj.sourceType = identityLink.sourceType || '';
            obj.sourceId = identityLink.sourceId || '';
            obj.habitMode = identityLink.habitMode || '';
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
        if (type === 'habits') {
            this.syncIdentityLinkedHabits();
            this.evaluateIdentityAchievements();
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
                    habitMode: habit.habitMode || '',
                    maturity: habit.maturity || 'forming'
                });
                this.showGamificationToast(award);
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
                habitMode: habit.habitMode || '',
                maturity: habit.maturity || 'forming'
            });
            this.showGamificationToast(award);
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
                    habitMode: habit.habitMode || '',
                    maturity: habit.maturity || 'forming'
                });
                this.showGamificationToast(award);
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

        this.markCadence('diary', today);
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

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    onboardingGetFieldValue: function(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return String(el.value || '').trim();
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

    renderGamificationProfile: function() {
        const panel = document.getElementById('gamification-profile-panel');
        if (!panel) return;
        const state = window.sistemaVidaState;
        const gamification = this.ensureGamificationState();
        const totalProgress = this.getLevelProgress(gamification.totalXp);

        const totalLevelEl = document.getElementById('gamification-total-level');
        const totalXpEl = document.getElementById('gamification-total-xp');
        const totalBarEl = document.getElementById('gamification-total-bar');
        if (totalLevelEl) totalLevelEl.textContent = `Nível ${totalProgress.level}`;
        if (totalXpEl) totalXpEl.textContent = `${totalProgress.current}/${totalProgress.next} XP para o próximo nível`;
        if (totalBarEl) totalBarEl.style.width = `${totalProgress.pct}%`;

        const dimensionsEl = document.getElementById('gamification-dimensions');
        if (dimensionsEl) {
            const dimKeys = Object.keys(state.dimensions || {});
            dimensionsEl.innerHTML = dimKeys.map((dim) => {
                const xp = Math.max(0, Number(gamification.dimensionXp[dim]) || 0);
                const progress = this.getLevelProgress(xp);
                const identity = this.getDimensionIdentity(dim, progress.level);
                const tierNames = ['I', 'II', 'III', 'IV', 'V'];
                const tierLabel = tierNames[identity.tier] || 'I';
                return `
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 min-w-0">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-outline truncate">${this.escapeHtml(dim)}</p>
                            <p class="mt-1 text-sm font-bold text-on-surface truncate">${this.escapeHtml(identity.title)}</p>
                            <p class="text-[10px] text-outline mt-0.5">Tier ${tierLabel} · Nível ${progress.level}</p>
                        </div>
                        <span class="material-symbols-outlined notranslate text-primary text-xl">${identity.icon}</span>
                    </div>
                    <div class="mt-3 flex items-center justify-between text-[11px] text-outline">
                        <span>Próximo nível</span>
                        <span>${progress.current}/100 XP</span>
                    </div>
                    <div class="mt-2 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                        <div class="h-full rounded-full bg-primary" style="width:${progress.pct}%"></div>
                    </div>
                </div>`;
            }).join('');
        }

        const achievementsEl = document.getElementById('gamification-achievements');
        if (achievementsEl) {
            const achievements = (gamification.achievements || []).slice(0, 4);
            achievementsEl.innerHTML = achievements.length
                ? achievements.map((achievement) => `
                    <div class="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
                        <span class="material-symbols-outlined notranslate text-primary text-lg">${this.escapeHtml(achievement.icon || 'military_tech')}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-on-surface truncate">${this.escapeHtml(achievement.title)}</p>
                            <p class="text-[10px] text-outline">${achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString('pt-BR') : ''}</p>
                        </div>
                    </div>
                `).join('')
                : `<div class="rounded-xl bg-surface-container-low p-4 text-sm text-outline">Conclua uma micro, um hábito, um foco ou uma revisão para desbloquear conquistas.</div>`;
        }

        const rulesEl = document.getElementById('gamification-rules');
        if (rulesEl) {
            const rules = [
                { icon: 'task_alt', label: 'Micro concluída', xp: '+12 XP', note: '+6 se está no plano da semana' },
                { icon: 'repeat', label: 'Hábito do dia', xp: '+6 XP', note: 'automáticos recebem XP de manutenção (50%)' },
                { icon: 'timer', label: 'Foco profundo', xp: '+10 a +40 XP', note: 'varia pela duração do bloco' },
                { icon: 'rate_review', label: 'Revisão semanal', xp: '+25 XP', note: 'conta uma vez por semana' }
            ];
            rulesEl.innerHTML = rules.map(rule => `
                <div class="rounded-lg bg-surface-container-lowest border border-outline-variant/10 p-3">
                    <div class="flex items-center gap-2 text-primary">
                        <span class="material-symbols-outlined notranslate text-base">${rule.icon}</span>
                        <span class="text-xs font-bold">${rule.xp}</span>
                    </div>
                    <p class="mt-2 text-xs font-bold text-on-surface">${rule.label}</p>
                    <p class="mt-1 text-[10px] text-outline leading-snug">${rule.note}</p>
                </div>
            `).join('');
        }
    },
    toggleGamificationRules: function() {
        const wrap = document.getElementById('gamification-rules-wrap');
        const chevron = document.getElementById('gamification-rules-chevron');
        if (!wrap) return;
        const willOpen = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', !willOpen);
        if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : '';
    },

    manualGuideChapters: [
        {
            id: 'visao-geral',
            icon: 'menu_book',
            title: 'Visão Geral',
            subtitle: 'A arquitetura do Life OS em uma página',
            what: 'O Life OS funciona em quatro camadas que se alimentam: <strong>Propósito</strong> (quem você é e quer ser) → <strong>Planos</strong> (Meta→OKR→Macro→Micro) → <strong>Execução</strong> (Hoje + Foco) → <strong>Reflexão</strong> (Painel + Revisão Semanal). Identidade e hábitos atravessam todas as camadas.',
            why: 'Sistemas de mudança duradoura precisam de coerência vertical: ações diárias devem servir objetivos de médio prazo, que servem propósito de longo prazo. Sem essa cadeia, o esforço diário não acumula em direção a algo significativo.',
            refs: ['Covey — 7 Habits (begin with the end in mind)', 'Locke & Latham — Goal-Setting Theory'],
            how: [
                'Comece pelo Propósito: defina valores, identidade (forças e sombras) e Ikigai antes de criar Metas.',
                'Quebre cada Meta em OKRs (90 dias) → Macros (semanais) → Micros (atômicos, executáveis em uma sessão).',
                'Use o Hoje para executar Micros e o Foco para sessões de atenção profunda.',
                'Revise no Painel e na Revisão Semanal para fechar o ciclo.'
            ],
            cta: null
        },
        {
            id: 'identidade',
            icon: 'person_pin',
            title: 'Identidade & Valores',
            subtitle: 'Quem você está se tornando',
            what: 'A aba Propósito guarda <strong>Valores</strong> (princípios inegociáveis), <strong>Forças</strong> (o que quer expressar mais) e <strong>Sombras</strong> (padrões a transformar). Cada hábito pode ser conectado a uma força ou sombra, e a Revisão Semanal pergunta qual delas você praticou.',
            why: 'Mudanças sustentáveis acontecem em nível de identidade, não de comportamento isolado. Trabalhar sombras (psicologia junguiana) e cultivar forças (VIA Character Strengths) cria uma narrativa interna coerente: cada ação vira "voto" para a pessoa que você está se tornando.',
            refs: ['James Clear — Atomic Habits (identity-based habits)', 'Peterson & Seligman — VIA Character Strengths', 'Carl Jung — Shadow integration'],
            how: [
                'Em Propósito, escolha 3-5 forças do catálogo e 1-2 sombras a observar.',
                'Ao criar um hábito, conecte-o a uma força (modo "construir") ou sombra (modo "substituir").',
                'Hábitos de sombra valem +4 XP, hábitos de força valem +2 XP — a diferença reflete o esforço cognitivo.',
                'Na Revisão Semanal, marque qual força usou e qual sombra apareceu.'
            ],
            cta: { label: 'Abrir Propósito', view: 'proposito' }
        },
        {
            id: 'ikigai-odyssey',
            icon: 'explore',
            title: 'Ikigai, Odyssey & Visão',
            subtitle: 'Razão de viver e cenários de futuro',
            what: 'O <strong>Ikigai</strong> cruza o que você ama, no que é bom, o que o mundo precisa e pelo que pode ser pago. Os <strong>Odyssey Plans</strong> projetam três cenários distintos para os próximos 5 anos. A <strong>Visão de Vida</strong> declara quem você quer ser em saúde, carreira e intelecto.',
            why: 'O futuro psicologicamente "próximo" é o que motiva ação no presente. Pesquisas em continuidade do self mostram que pessoas que visualizam um futuro vívido tomam decisões financeiras e de saúde melhores. Designing Your Life (Stanford) recomenda múltiplos cenários porque combate a falsa premissa de que existe "um caminho certo".',
            refs: ['Mieko Kamiya / Ken Mogi — Ikigai', 'Burnett & Evans — Designing Your Life', 'Hal Hershfield — Future Self Continuity'],
            how: [
                'Preencha cada quadrante do Ikigai com 1-2 frases honestas, depois sintetize sua "razão de viver".',
                'Crie 3 Odyssey Plans bem distintos — um conservador, um audacioso, um radical — para forçar imaginação.',
                'Atualize a Visão de Vida a cada 6-12 meses; ela é uma bússola, não um contrato.',
                'Quando definir Metas, pergunte: "qual cenário Odyssey isso serve?"'
            ],
            cta: { label: 'Editar Ikigai e Odyssey', view: 'proposito' }
        },
        {
            id: 'bem-estar',
            icon: 'monitoring',
            title: 'Bem-estar: Roda da Vida, PERMA & SWLS',
            subtitle: 'Diagnóstico holístico de florescimento',
            what: 'Três instrumentos complementares: a <strong>Roda da Vida</strong> mede equilíbrio em 8 dimensões; o <strong>PERMA</strong> mensura florescimento em 5 dimensões (Emoções positivas, Engajamento, Relacionamentos, Meaning, Achievement); o <strong>SWLS</strong> é uma escala validada de satisfação cognitiva global.',
            why: 'PERMA (Seligman) e SWLS (Diener) são instrumentos validados em centenas de estudos. Usados juntos, capturam tanto o "como me sinto" (afetivo) quanto o "como avalio minha vida" (cognitivo). A Roda da Vida adiciona granularidade por dimensão para detectar áreas negligenciadas.',
            refs: ['Seligman — Flourish (PERMA)', 'Diener et al. — Satisfaction with Life Scale (SWLS)', 'Paul J. Meyer — Wheel of Life'],
            how: [
                'Reavalie a Roda da Vida a cada 4-6 semanas — anote a dimensão mais baixa.',
                'PERMA é mais sensível: avalie mensalmente para detectar tendências.',
                'SWLS deve ser preenchido a cada 3 meses; comparações curtas demais são ruído.',
                'Cruze: dimensões baixas na Roda devem aparecer como Metas em Planos.'
            ],
            cta: { label: 'Reavaliar bem-estar', view: 'proposito' }
        },
        {
            id: 'planos',
            icon: 'account_tree',
            title: 'Planos: Hierarquia Meta → OKR → Macro → Micro',
            subtitle: 'Cascata de objetivos com weekly planning',
            what: 'A hierarquia decompõe ambição em ação: <strong>Meta</strong> (1-5 anos) → <strong>OKR</strong> (trimestral, com Key Results mensuráveis) → <strong>Macro</strong> (mensal, 2-6 semanas) → <strong>Micro</strong> (atômico, ~1 sessão). O <strong>Planejamento Semanal</strong> seleciona quais Micros entram na semana com previsão de energia.',
            why: 'OKRs (Andy Grove, popularizado por John Doerr) separam objetivo qualitativo (Objective) de medidas (Key Results), evitando metas vagas. Decomposição em Micros respeita a teoria da auto-eficácia (Bandura): vitórias pequenas alimentam crença de competência. Weekly planning aplica o "12 Week Year" — comprimir o foco em ciclos curtos aumenta execução.',
            refs: ['John Doerr — Measure What Matters (OKRs)', 'Brian Moran — The 12 Week Year', 'Albert Bandura — Self-Efficacy Theory'],
            how: [
                'Crie 1-3 Metas por dimensão, não mais. Foco vence quantidade.',
                'Para cada OKR, defina 2-4 Key Results numéricos (não tarefas, mas resultados mensuráveis).',
                'Quebre Macros em Micros executáveis em até 90 minutos.',
                'No Planejamento Semanal, selecione Micros com base na energia prevista — não encha o calendário.',
                'Pais (Meta/OKR/Macro) só ficam "concluídos" quando você decide; o sistema não fecha automaticamente.'
            ],
            cta: { label: 'Abrir Planos', view: 'planos' }
        },
        {
            id: 'woop',
            icon: 'psychology_alt',
            title: 'WOOP e Se-entao',
            subtitle: 'Antecipar obstaculos antes da execucao',
            what: 'Macros, Micros e Sombras podem guardar dois campos opcionais: <strong>obstaculo previsto</strong> e <strong>plano se-entao</strong>. A ideia e transformar uma intencao vaga em uma resposta preparada para o atrito real.',
            why: 'WOOP (Wish, Outcome, Obstacle, Plan) combina contraste mental com implementation intentions. O ponto forte e nomear o obstaculo interno ou contextual antes que ele apareca, reduzindo improviso quando a energia ja esta baixa.',
            refs: ['Gabriele Oettingen — WOOP / Mental Contrasting', 'Peter Gollwitzer — Implementation Intentions'],
            how: [
                'Ao criar uma Macro ou Micro, abra "Antecipar obstaculo" apenas quando houver risco claro.',
                'Escreva o obstaculo em linguagem concreta: "chegar cansado depois do trabalho", nao "falta de disciplina".',
                'Use o formato se-entao: "Se eu chegar cansado, entao farei 5 minutos antes de decidir parar".',
                'Na Revisao Semanal, os obstaculos das Micros planejadas aparecem como lembrete de ajuste.'
            ],
            cta: { label: 'Abrir Planos', view: 'planos' }
        },
        {
            id: 'notas',
            icon: 'note_stack',
            title: 'Notas e Memoria Externa',
            subtitle: 'Contexto vinculado ao sistema',
            what: 'Notas ficam no Perfil e podem ser vinculadas a Metas, OKRs, Macros, Micros, Habitos, Forcas ou Sombras. Elas guardam contexto, links, aprendizados e referencias sem transformar o app em uma area separada de documentos.',
            why: 'Memoria externa reduz carga cognitiva: voce nao precisa manter todo o contexto ativo na cabeca. Quando uma nota esta vinculada a uma entidade do sistema, ela vira suporte para decisao e revisao, nao apenas arquivo solto.',
            refs: ['David Allen — Getting Things Done', 'Tiago Forte — Building a Second Brain', 'Extended Mind / cognitive offloading'],
            how: [
                'Crie notas curtas com titulo, corpo, tags e URL quando houver uma referencia importante.',
                'Vincule a nota ao item que ela ajuda: uma Micro, uma Meta, um Habito ou uma Sombra.',
                'Use a busca do Perfil para encontrar notas por texto, tag ou entidade vinculada.',
                'Prefira notas que apoiem uma decisao futura, nao colecoes infinitas de informacao.'
            ],
            cta: { label: 'Abrir Perfil', view: 'perfil' }
        },
        {
            id: 'hoje',
            icon: 'today',
            title: 'Hoje: Bússola, Diário, Gratidão & Shutdown',
            subtitle: 'A camada de execução e reflexão diária',
            what: 'O <strong>Hoje</strong> reúne: a <strong>Bússola do Dia</strong> (frase + ação sugerida), a lista de <strong>Micros</strong> da semana, os <strong>hábitos</strong> ativos, o <strong>Diário</strong> (escrita livre + 3 gratidões) e o <strong>Shutdown Ritual</strong> (encerramento consciente do dia).',
            why: 'A Bússola usa "implementation intentions" (Gollwitzer): declarar antecipadamente o que vai fazer aumenta execução em ~2-3x. Gratidão (3 Good Things, Seligman) por 1-2 semanas eleva afeto positivo por meses. O Shutdown Ritual fecha o "loop Zeigarnik" — tarefas inacabadas criam ruminação; declarar fechamento libera capacidade cognitiva para descansar.',
            refs: ['Gollwitzer — Implementation Intentions', 'Seligman — Three Good Things', 'Cal Newport — Deep Work (shutdown)', 'Zeigarnik Effect'],
            how: [
                'Abra o Hoje pela manhã; deixe a Bússola do Dia ancorar a primeira ação.',
                'Faça o Diário e 3 gratidões à noite — específicas, não genéricas ("o sorriso do meu filho ao voltar pra casa", não "minha família").',
                'Execute o Shutdown ao terminar o trabalho: revise o que ficou, anote pendências para amanhã, declare fechamento.',
                'Não tente esvaziar todos os Micros da semana num dia só — sobrecarga mata consistência.'
            ],
            cta: { label: 'Ir para Hoje', view: 'hoje' }
        },
        {
            id: 'cadencia',
            icon: 'sync_alt',
            title: 'Cadência e Ritmo',
            subtitle: 'Frequências saudáveis sem travar o sistema',
            what: 'A <strong>Cadência</strong> mostra se ferramentas essenciais estão em dia, próximas do vencimento ou atrasadas. O <strong>Check-in diário</strong> coleta sono, qualidade do sono, energia, humor e estresse em poucos segundos para criar uma linha de base do seu estado interno.',
            why: 'Mudança pessoal melhora quando dados de estado são coletados perto do momento real, princípio usado em EMA (Ecological Momentary Assessment). Revisões semanais sustentam OKRs e execução; escalas como PERMA/SWLS pedem cadência mais espaçada para evitar ruído e fadiga de medição.',
            refs: ['Ecological Momentary Assessment (EMA)', 'Brian Moran — 12 Week Year', 'Diener — SWLS', 'Seligman — PERMA'],
            how: [
                'Faça o check-in diário na aba Hoje (topo da página): sono, qualidade do sono, energia, humor e estresse.',
                'Use os badges de cadência como sinal visual, nunca como punição.',
                'Roda da Vida e PERMA: mensal. SWLS: trimestral. Odyssey/Visão: semestral.',
                'Quando algo atrasar, retome com a menor ação possível em vez de compensar tudo de uma vez.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'foco',
            icon: 'timer',
            title: 'Foco: Pomodoro 90/20 & Deep Work',
            subtitle: 'Atenção profunda em ritmos ultradianos',
            what: 'Timer de <strong>90 minutos de foco + 20 minutos de pausa</strong>, conectado a um Micro específico. Ao final da sessão, registra Deep Work e atribui XP.',
            why: 'O ciclo 90/20 segue os ritmos ultradianos (Kleitman) — o cérebro alterna entre alta e baixa ativação a cada ~90 minutos. Pomodoros de 25 minutos são bons para tarefas leves, mas trabalho profundo (Deep Work, Cal Newport) exige blocos longos sem interrupção. A pausa de 20 minutos permite consolidação e redução de fadiga atencional (depleção de glicose pré-frontal).',
            refs: ['Nathan Kleitman — BRAC (Basic Rest-Activity Cycle)', 'Cal Newport — Deep Work', 'Csikszentmihalyi — Flow'],
            how: [
                'Antes de iniciar, escolha UM Micro — multitarefa destrói deep work.',
                'Desligue notificações; o ambiente deve sinalizar "agora é foco".',
                'Use a pausa de 20 min para movimento físico ou descanso real, não redes sociais.',
                'Faça no máximo 3-4 sessões por dia; deep work é caro biologicamente.'
            ],
            cta: { label: 'Iniciar Foco', view: 'foco' }
        },
        {
            id: 'habitos',
            icon: 'repeat',
            title: 'Hábitos: Habit Loop & Identidade em Ação',
            subtitle: 'Cue → Routine → Reward, ancorado em quem você quer ser',
            what: 'Cada hábito tem <strong>Gatilho</strong> (cue), <strong>Rotina</strong> (routine), <strong>Recompensa</strong> (reward) e pode estar conectado a uma força ou sombra. Modos: construir (força), reduzir (sombra) ou substituir (resposta melhor).',
            why: 'O Habit Loop (Duhigg, baseado em pesquisa do MIT/Graybiel) é a estrutura mínima de qualquer comportamento automatizado. James Clear adiciona a camada de identidade: "todo hábito é um voto para o tipo de pessoa que você quer ser". Implementation intentions ("depois de X, eu farei Y") aumentam aderência em meta-análises de 2-3x.',
            refs: ['Charles Duhigg — The Power of Habit', 'James Clear — Atomic Habits', 'B.J. Fogg — Tiny Habits'],
            how: [
                'Ancore o hábito em uma rotina existente: "depois de escovar os dentes, eu...".',
                'Comece ridiculamente pequeno: 2 minutos, não 30. Consistência > intensidade.',
                'Conecte à identidade: "sou alguém que..." em vez de "vou fazer X".',
                'Para sombras, defina a resposta-substituta antes do gatilho aparecer.',
                'Use o checklist de passos para hábitos complexos; quebra em micropassos previne paralisia.'
            ],
            cta: { label: 'Criar hábito', view: 'planos' }
        },
        {
            id: 'maturacao-habitos',
            icon: 'verified',
            title: 'Maturacao de Habitos',
            subtitle: 'Do esforco consciente para o automatico',
            what: 'Habitos agora podem estar <strong>em formacao</strong> ou <strong>automaticos</strong>. Quando um habito sustenta consistencia por semanas, ele gradua: continua sendo acompanhado, mas passa a render XP de manutencao em vez de XP cheio.',
            why: 'A formacao de habitos segue curva de repeticao em contexto estavel. Recompensas ajudam no inicio, mas a Teoria da Autodeterminacao alerta que recompensa externa demais pode competir com motivacao intrinseca. Graduar reduz esse risco e reforca identidade.',
            refs: ['Lally et al. — habit formation', 'James Clear — Atomic Habits', 'Deci & Ryan — Self-Determination Theory'],
            how: [
                'Um habito gradua apos 4 semanas com 80% ou mais de consistencia.',
                'Habitos automaticos aparecem com chip proprio e recebem XP reduzido de manutencao.',
                'Se a consistencia cair por 2 semanas, o habito volta para formacao com aviso compassivo.',
                'No Painel, acompanhe quantos habitos estao em formacao, automaticos e proximos de graduar.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'reflexao',
            icon: 'insights',
            title: 'Painel & Revisão Semanal',
            subtitle: 'Fechamento de ciclo e aprendizado',
            what: 'O <strong>Painel</strong> mostra scores de Foco/Execução, ciclo de 12 semanas e heatmap. A <strong>Revisão Semanal</strong> faz 5 perguntas (planejei → executei → aprendi → ajustar → próxima intenção) + autoconhecimento aplicado (força usada, sombra observada).',
            why: 'Reflexão estruturada transforma experiência em aprendizado — sem revisão, repetimos os mesmos erros. Brian Moran (12 Week Year) mostra que a frequência de revisão (semanal > mensal > trimestral) é o maior preditor de execução de OKRs. Escrever o que aprendeu ativa metacognição e consolida memória (Bjork — desirable difficulties).',
            refs: ['Brian Moran — 12 Week Year', 'Robert Bjork — Desirable Difficulties', 'Kolb — Experiential Learning Cycle'],
            how: [
                'Faça a Revisão Semanal todo domingo ou segunda — não pule, mesmo na semana ruim (especialmente nela).',
                'Seja específico: "aprendi que reuniões antes das 10h drenam minha energia para deep work" > "preciso focar mais".',
                'Use a aba "Autoconhecimento aplicado" para fechar o loop identidade → ação → reflexão.',
                'No Painel, observe tendências, não dias isolados — métricas voláteis enganam.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'padroes',
            icon: 'query_stats',
            title: 'Lendo seus Padroes',
            subtitle: 'Cruzamentos sem confundir correlacao com causa',
            what: 'O Painel cruza check-ins diarios com execucao de micros e adesao a habitos. A secao so aparece com leitura completa depois de dados suficientes, para evitar conclusoes precipitadas.',
            why: 'Dados pessoais sao ruidosos. Um padrao util nasce de repeticao: sono, humor e estresse precisam de historico antes de orientar decisoes. O sistema usa gating minimo e sempre lembra que correlacao nao e causalidade.',
            refs: ['Ecological Momentary Assessment (EMA)', 'Personal informatics', 'Behavioral self-tracking'],
            how: [
                'Faça check-in por pelo menos 14 dias para liberar os primeiros cruzamentos.',
                'Leia diferencas como hipoteses praticas, nao como diagnostico.',
                'Se sono baixo coincidir com pouca execucao, ajuste carga antes de culpar disciplina.',
                'Use a Revisao Semanal para decidir um experimento pequeno para a proxima semana.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        },
        {
            id: 'carga-recuperacao',
            icon: 'health_and_safety',
            title: 'Carga e Recuperacao',
            subtitle: 'Melhorar sem ultrapassar o limite saudavel',
            what: 'O alerta de carga observa energia, estresse, execucao e volume planejado. Quando sinais ruins aparecem junto com carga alta, o app sugere reduzir o ritmo em vez de empurrar mais tarefas.',
            why: 'Produtividade sustentavel depende de recuperacao. Carga alostatica acumulada aumenta risco de fadiga, abandono e burnout. O sistema deve proteger consistencia de longo prazo, nao maximizar volume a qualquer custo.',
            refs: ['Allostatic load', 'Ultradian rhythms', 'Cal Newport — Deep Work'],
            how: [
                'Se o alerta aparecer, reduza micros, simplifique habitos ou escolha uma semana de manutencao.',
                'Nao trate alerta como falha: ele e um instrumento de regulacao.',
                'Combine com a Revisao Semanal para ajustar energia prevista e prioridades.',
                'Depois de dispensar o alerta, ele fica silencioso pelo dia.'
            ],
            cta: { label: 'Abrir Painel', view: 'painel' }
        }
    ],

    ensureManualGuideState: function() {
        if (!window.sistemaVidaState.profile) return;
        const profile = window.sistemaVidaState.profile;
        if (!profile.manualGuide || typeof profile.manualGuide !== 'object') {
            profile.manualGuide = { read: [] };
        }
        if (!Array.isArray(profile.manualGuide.read)) profile.manualGuide.read = [];
    },

    isManualChapterRead: function(id) {
        this.ensureManualGuideState();
        return (window.sistemaVidaState.profile.manualGuide.read || []).includes(id);
    },

    toggleManualChapter: function(id) {
        const wrap = document.getElementById(`manual-ch-body-${id}`);
        const chevron = document.getElementById(`manual-ch-chevron-${id}`);
        if (!wrap) return;
        const willOpen = wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', !willOpen);
        if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : '';
        if (willOpen && !this.isManualChapterRead(id)) {
            this.ensureManualGuideState();
            window.sistemaVidaState.profile.manualGuide.read.push(id);
            this.saveState(true);
            this.renderManualGuideProgress();
            const card = document.getElementById(`manual-ch-card-${id}`);
            if (card) card.classList.add('manual-ch-read');
            const badge = document.getElementById(`manual-ch-badge-${id}`);
            if (badge) badge.textContent = 'Lido';
        }
    },

    manualGuideJumpTo: function(view) {
        if (!view) return;
        this.switchView(view);
    },

    renderManualGuideProgress: function() {
        const total = this.manualGuideChapters.length;
        const read = (window.sistemaVidaState?.profile?.manualGuide?.read || []).filter(id =>
            this.manualGuideChapters.some(c => c.id === id)
        ).length;
        const progress = document.getElementById('manual-guide-progress');
        const bar = document.getElementById('manual-guide-progress-bar');
        if (progress) progress.textContent = `${read}/${total}`;
        if (bar) bar.style.width = total ? `${Math.round((read / total) * 100)}%` : '0%';
    },

    renderManualGuide: function() {
        const list = document.getElementById('manual-guide-list');
        if (!list) return;
        this.ensureManualGuideState();
        const esc = (s) => this.escapeHtml(String(s || ''));
        const cards = this.manualGuideChapters.map((ch, idx) => {
            const isRead = this.isManualChapterRead(ch.id);
            const refs = (ch.refs || []).map(r => `<li>${esc(r)}</li>`).join('');
            const how = (ch.how || []).map(h => `<li>${esc(h)}</li>`).join('');
            const cta = ch.cta ? `
                <button type="button" onclick="window.app.manualGuideJumpTo('${esc(ch.cta.view)}')"
                    class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all">
                    <span class="material-symbols-outlined notranslate text-[16px]">arrow_forward</span>
                    ${esc(ch.cta.label)}
                </button>` : '';
            return `
            <div id="manual-ch-card-${esc(ch.id)}" class="rounded-xl border border-outline-variant/15 bg-surface-container-low overflow-hidden ${isRead ? 'manual-ch-read' : ''}">
                <button type="button" onclick="window.app.toggleManualChapter('${esc(ch.id)}')"
                    class="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container transition-colors">
                    <span class="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                        <span class="material-symbols-outlined notranslate text-[18px]">${esc(ch.icon)}</span>
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Capítulo ${idx + 1}</p>
                        <p class="text-sm font-bold text-on-surface leading-tight mt-0.5">${esc(ch.title)}</p>
                        <p class="text-[11px] text-outline mt-0.5 leading-snug">${esc(ch.subtitle)}</p>
                    </div>
                    <span id="manual-ch-badge-${esc(ch.id)}" class="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0">${isRead ? 'Lido' : 'Novo'}</span>
                    <span id="manual-ch-chevron-${esc(ch.id)}" class="material-symbols-outlined notranslate text-outline text-[18px] transition-transform shrink-0">expand_more</span>
                </button>
                <div id="manual-ch-body-${esc(ch.id)}" class="hidden px-5 pb-5 pt-1 space-y-4 text-sm text-on-surface-variant leading-relaxed">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">O que é</p>
                        <p>${ch.what}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Por que funciona</p>
                        <p>${esc(ch.why)}</p>
                        ${refs ? `<ul class="mt-2 list-disc list-inside text-[11px] text-outline space-y-0.5">${refs}</ul>` : ''}
                    </div>
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Como usar</p>
                        <ol class="list-decimal list-inside space-y-1.5">${how}</ol>
                    </div>
                    ${cta}
                </div>
            </div>`;
        }).join('');
        list.innerHTML = cards;
        this.renderManualGuideProgress();
    },

    render: {
        onboarding: function() {
            app.onboardingHydrateFields();
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
                const weekKey = app._getWeekKey();
                const weekPlan = (state.weekPlans || {})[weekKey];
                const plannedIds = (weekPlan && weekPlan.selectedMicros) || [];
                if (plannedIds.length > 0) {
                    micros = micros.filter(m => plannedIds.includes(m.id));
                    const macroIds = new Set(micros.map(m => m.macroId).filter(Boolean));
                    macros = macros.filter(m => macroIds.has(m.id));
                } else {
                    micros = micros.filter(m => app.isDateInCurrentWeek(m.prazo));
                    macros = macros.filter(m => app.isDateInCurrentWeek(m.prazo));
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
            app.renderWeeklyHealthScore({ execScore, plannedCount: totalMicros, doneCount: doneMicros });
            // ---------------------------------------------------------
            
            // Fix Filter Buttons Highlight
            document.querySelectorAll('[data-painel-filter]').forEach(btn => {
                const btnType = btn.getAttribute('data-painel-filter');
                const isSelected = btnType === filter;
                btn.className = isSelected ?
                    'px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider transition-all shadow-sm' :
                    'px-4 py-2 rounded-lg text-outline text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all';
            });

            // Cycle Progress Logic
            const cycleStart = new Date((state.cycleStartDate || app.getLocalDateKey()) + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const elapsedCycleDays = Math.max(0, Math.min(84, Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)) + 1));
            const diffWeeks = Math.max(1, Math.min(12, Math.ceil(elapsedCycleDays / 7) || 1));
            const cyclePercent = Math.min(100, Math.round((elapsedCycleDays / 84) * 100)); // 12 weeks = 84 days

            const cycleBar = document.getElementById('cycle-progress-bar');
            const cycleVal = document.getElementById('cycle-percent-val');
            const cycleWeekText = document.getElementById('cycle-week-text');

            if (cycleBar) cycleBar.style.width = cyclePercent + '%';
            if (cycleVal) cycleVal.textContent = cyclePercent + '%';
            if (cycleWeekText) cycleWeekText.textContent = `Semana ${diffWeeks} de 12 · ${elapsedCycleDays}/84 dias`;

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

            app.renderPainelDiagnostics();
            app.renderPainelDecision();
            app.renderPersonalEvolutionPanel();
            app.renderHabitMaturityPanel();
            app.renderWellbeingTrendsPanel();
            app.renderLoadRecoveryPanel();
            app.renderPatternsPanel();
            app.renderTimelineHistory();
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
            app.focusStatusFilter = 'Tudo';
            const statusFilter = 'Tudo';

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
                    ? "px-2 py-2 rounded-lg bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    : "px-2 py-2 rounded-lg text-outline text-[9px] font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all";
            });

            document.querySelectorAll('[data-focus-status]').forEach(btn => {
                const s = btn.getAttribute('data-focus-status');
                btn.className = s === statusFilter
                    ? "px-2 py-2 rounded-lg bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    : "px-2 py-2 rounded-lg text-outline text-[9px] font-bold uppercase tracking-wider hover:bg-surface-container-high transition-all";
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
                    <div class="grid grid-cols-1 sm:grid-cols-[128px_minmax(0,1fr)] gap-2 mb-2 min-w-0">
                        <span class="text-[10px] uppercase tracking-widest font-bold text-outline leading-tight break-words">${dimLabels[dim]}</span>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1 min-w-0">
                            <span class="rounded-md bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary whitespace-nowrap">Foco ${focusPct}% (${s.focusItems})</span>
                            <span class="rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap">C ${donePct}%</span>
                            <span class="rounded-md bg-amber-500/10 px-2 py-1 text-[9px] text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap">A ${inProgressPct}%</span>
                            <span class="rounded-md bg-surface-container-high px-2 py-1 text-[9px] text-outline font-semibold whitespace-nowrap">P ${pendingPct}%</span>
                        </div>
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
                    const isDone = m.status === 'done' || m.completed;
                    const isInProgress = m.status === 'in_progress';
                    const cardStateClass = isDone
                        ? 'border-emerald-500/35 bg-emerald-500/[0.035] shadow-sm shadow-emerald-500/10'
                        : (isInProgress
                            ? 'border-amber-500/40 bg-amber-500/[0.035] shadow-sm shadow-amber-500/10'
                            : 'border-outline-variant/10 bg-surface-container-lowest shadow-sm');
                    const accentClass = isDone ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary/30');
                    const statusBadge = isDone
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                        : (isInProgress
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                            : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/20');
                    const isTimerMicro = state.deepWork?.isRunning && state.deepWork?.microId === m.id;
                    const actionLabel = (m.status === 'in_progress' || isTimerMicro) ? 'Gerenciar' : 'Iniciar';
                    const actionHandler = (m.status === 'in_progress' || isTimerMicro)
                        ? `window.app.openMicroInFocus('${m.id}', false)`
                        : `window.app.startDeepWorkForMicro('${m.id}')`;
                    const isFocoPlanned = app._isPlannedThisWeek(m.id);
                    const focoPlannedBadge = isFocoPlanned
                        ? '<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest"><span class="material-symbols-outlined notranslate text-[10px]">event</span>Semana</span>'
                        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[9px] font-bold uppercase tracking-widest">Captura</span>';
                    return `
                    <div class="relative overflow-hidden p-5 rounded-2xl border ${cardStateClass} hover:shadow-md transition-all group min-w-0">
                        <div class="absolute left-0 top-0 bottom-0 w-1 ${accentClass}"></div>
                        ${isDone ? '<div class="absolute right-3 bottom-3 pointer-events-none opacity-[0.07]"><span class="material-symbols-outlined notranslate text-6xl text-emerald-500">verified</span></div>' : ''}
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
                                <span class="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${statusBadge}">${statusText}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                ${m.status !== 'done' ? `<button onclick="${actionHandler}" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20">${actionLabel}</button>` : ''}
                                ${m.status === 'done' ?
                                    `<button onclick="window.app.completeMicroAction('${m.id}')" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20">Reabrir</button>` :
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
            const cycleStart = new Date((state.cycleStartDate || app.getLocalDateKey()) + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const elapsedDays = Math.max(0, Math.min(84, Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)) + 1));
            const daysLabel = document.getElementById('painel-exec-days');
            if (daysLabel) daysLabel.textContent = `${elapsedDays}/84 dias`;

            let html = '<div class="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2">';
            for (let week = 0; week < 12; week++) {
                const weekStart = new Date(cycleStart);
                weekStart.setDate(cycleStart.getDate() + (week * 7));
                let weekDone = 0;
                let weekElapsed = 0;
                for (let day = 0; day < 7; day++) {
                    const offset = (week * 7) + day;
                    const d = new Date(cycleStart);
                    d.setDate(cycleStart.getDate() + offset);
                    const key = app.getLocalDateKey(d);
                    if (d <= today) weekElapsed += 1;
                    if (app.hasDayActivity(key)) weekDone += 1;
                }
                const isCurrentWeek = elapsedDays >= (week * 7) + 1 && elapsedDays <= (week + 1) * 7;
                const weekPct = weekElapsed > 0 ? Math.round((weekDone / weekElapsed) * 100) : 0;
                const isFutureWeek = weekElapsed === 0;
                const fillClass = isFutureWeek ? 'bg-transparent' : (weekDone > 0 ? 'bg-primary' : 'bg-surface-container-highest');
                const cardClass = isCurrentWeek
                    ? 'border-primary/35 bg-primary/[0.04] shadow-sm'
                    : 'border-outline-variant/10 bg-surface-container-low';
                html += `
                    <div class="rounded-xl border ${cardClass} p-2 min-w-0" title="Semana ${week + 1}: ${weekDone}/${weekElapsed || 7} dias ativos">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-[9px] font-bold uppercase tracking-widest text-outline">S${week + 1}</span>
                            <span class="text-[9px] font-bold ${isCurrentWeek ? 'text-primary' : 'text-outline'}">${isFutureWeek ? '--' : weekPct + '%'}</span>
                        </div>
                        <div class="h-12 rounded-lg bg-surface-container-highest/70 overflow-hidden flex items-end">
                            <div class="w-full ${fillClass} transition-all duration-500" style="height:${isFutureWeek ? 0 : Math.max(8, weekPct)}%"></div>
                        </div>
                    </div>`;
            }
            html += '</div>';
            html += '<div class="mt-4 flex items-center justify-between text-[10px] text-on-surface-variant"><span>Dias ativos por semana</span><span class="font-bold text-primary">12 semanas</span></div>';
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
                let streak = 0;
                const check = new Date();
                check.setHours(0, 0, 0, 0);
                // Conta apenas dias passados completos (hoje não conta)
                check.setDate(check.getDate() - 1);
                while (true) {
                    const key = app.getLocalDateKey(check);
                    if (app.hasDayActivity(key)) {
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

            // Progresso semanal — usa plano selecionado; fallback por datas se não houver plano
            const _weekKey = app._getWeekKey();
            const _weekPlan = (state.weekPlans || {})[_weekKey];
            const _selectedIds = (_weekPlan && _weekPlan.selectedMicros) || [];
            const weekMicros = _selectedIds.length > 0
              ? state.entities.micros.filter(m => _selectedIds.includes(m.id))
              : state.entities.micros.filter(m =>
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
                const days = ['D','S','T','Q','Q','S','S'];
                const today = new Date();
                today.setHours(0,0,0,0);
                const dayOfWeek = today.getDay(); // 0=Dom
                let html = '';
                for (let i = 0; i < 7; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - dayOfWeek + i);
                    const key = app.getLocalDateKey(d);
                    const isToday = i === dayOfWeek;
                    const hasDone = app.hasDayActivity(key);
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
                        circleClass = 'w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/30';
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
                const dimNotes = log.dimensionNotes || {};
                Object.entries(dimNotes).forEach(([dim, text]) => {
                    if (!text || !text.trim()) return;
                    app.toggleDiaryDimensionArea(dim);
                    const safeId = 'dim-note-' + dim.replace(/[^a-zA-Z0-9]/g, '-');
                    const ta = document.querySelector(`#${safeId} textarea`);
                    if (ta) ta.value = text;
                });
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

                    // Expandable steps section
                    let stepsHtml = '';
                    if (hasSteps) {
                        const stepsListItems = steps.map((step, idx) => {
                            const done = !!(todayStepMap[idx] || todayStepMap[String(idx)]);
                            return `<label class="flex items-center gap-2 cursor-pointer py-1" onclick="event.stopPropagation(); window.app.toggleHabitStepLog('${habit.id}', '${todayStr}', ${idx})">
                                <div class="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${done ? 'bg-primary border-primary' : 'border-outline-variant'}">
                                    ${done ? '<span class="material-symbols-outlined notranslate text-white text-[10px]" style="font-variation-settings: \\\'wght\\\' 700;">check</span>' : ''}
                                </div>
                                <span class="text-xs ${done ? 'line-through text-outline' : 'text-on-surface-variant'}">${app.escapeHtml(step)}</span>
                            </label>`;
                        }).join('');
                        stepsHtml = `
                        <div class="mt-2 pt-2 border-t border-outline-variant/10" onclick="event.stopPropagation()">
                            <button class="flex items-center gap-1 w-full text-left"
                                onclick="event.stopPropagation(); var list=this.nextElementSibling; list.classList.toggle('hidden'); this.querySelector('.chev').textContent=list.classList.contains('hidden')?'expand_more':'expand_less';">
                                <span class="text-[10px] font-bold uppercase tracking-widest text-primary">${todayStepsDone}/${steps.length} passos</span>
                                <span class="material-symbols-outlined notranslate text-primary text-[14px] chev ml-auto">expand_more</span>
                            </button>
                            <div class="hidden mt-1 space-y-0.5">
                                ${stepsListItems}
                            </div>
                        </div>`;
                    }

                    // Meta vinculada (opcional)
                    let linkedMetaHtml = '';
                    if (habit.linkedMetaId) {
                        const linkedMeta = (state.entities?.metas || []).find(m => m.id === habit.linkedMetaId);
                        if (linkedMeta) {
                            const linkTitle = (linkedMeta.title || '').replace(/</g, '&lt;');
                            linkedMetaHtml = `<p class="mt-1 text-[10px] text-primary/90 leading-tight truncate flex items-center gap-1"><span class="material-symbols-outlined notranslate text-[11px]">flag</span>${linkTitle}</p>`;
                        }
                    }
                    const maturityChip = app.renderHabitMaturityChip(habit);
                    const maturityClass = habit.maturity === 'graduated'
                        ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                        : 'border-transparent bg-surface-container-low';

                    habitsHtml += `
                    <div onclick="window.app.editEntity('${habit.id}', 'habits')" class="min-w-[240px] max-w-[280px] p-4 rounded-xl border ${maturityClass} flex flex-col justify-between transition-all hover:shadow-md relative group ${isDone ? 'opacity-70' : ''} cursor-pointer">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-2xl">${icon}</span>
                                ${maturityChip}
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
                                    ${linkedMetaHtml}
                                    ${app.renderHabitIdentityChip(habit)}
                                    ${habit.trigger ? `<p class="mt-1 text-[10px] text-outline italic leading-tight truncate">Gatilho: ${habit.trigger}</p>` : ''}
                                    ${habit.routine ? `<p class="mt-1 text-[10px] text-outline leading-tight truncate">Rotina: ${habit.routine}</p>` : ''}
                                    ${habit.reward ? `<p class="mt-1 text-[10px] text-primary/80 leading-tight truncate">Recompensa: ${habit.reward}</p>` : ''}
                                </div>
                                ${progressText ? `<span class="text-xs font-bold text-primary shrink-0">${progressText}</span>` : ''}
                            </div>
                            ${weekHtml}
                            ${stepsHtml}
                        </div>
                    </div>`;
                });
                
                if (state.habits.length === 0) {
                    habitsHtml = `<div class="p-4 text-xs italic text-outline">Nenhum hábito rastreado.</div>`;
                }
                
                habitsContainer.innerHTML = habitsHtml;
            }

            
            app.renderDailyCheckinPanel();
            app.renderDailyCompass();
            app.renderNextBestAction();

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
            
            const isInTodayWindow = (m) => {
                // Normalização para meia-noite local para comparação precisa
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const inicioStr = m.inicioDate || m.prazo;
                const prazoStr = m.prazo;
                if (!prazoStr) return false; // Sem prazo, sem janela
                const start = new Date(inicioStr + 'T00:00:00');
                const end = new Date(prazoStr + 'T00:00:00');
                return start <= today && end >= today;
            };
            const allTodayMicros = (state.entities.micros || []).filter(isInTodayWindow);
            const dayDone = allTodayMicros.filter(m => m.status === 'done' || m.completed).length;
            const dayTotal = allTodayMicros.length;
            const dayProgress = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;
            const dayProgressCard = document.getElementById('day-progress-card');
            const dayProgressLabel = document.getElementById('day-progress-label');
            const dayProgressBar = document.getElementById('day-progress-bar');
            if (dayProgressCard) dayProgressCard.classList.toggle('hidden', dayTotal === 0);
            if (dayProgressLabel) dayProgressLabel.textContent = `${dayDone} de ${dayTotal} feitas`;
            if (dayProgressBar) dayProgressBar.style.width = dayProgress + '%';

            // Filtro "Para Hoje": pendentes/in_progress dentro da janela, mantendo a recém-concluída por um pulso visual.
            const todayMicros = allTodayMicros
                .filter(m => {
                    const completedToday = (m.status === 'done' || m.completed) && (m.completedDate === todayStr || m.doneDate === todayStr);
                    return m.status !== 'done' || completedToday || m.id === app.recentCompletedMicroId;
                })
                .sort((a, b) => {
                    const aDone = a.status === 'done' || a.completed ? 1 : 0;
                    const bDone = b.status === 'done' || b.completed ? 1 : 0;
                    if (aDone !== bDone) return aDone - bDone;
                    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                    const dim = String(a.dimension || '').localeCompare(String(b.dimension || ''), 'pt-BR');
                    if (dim !== 0) return dim;
                    return String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'));
                });

            let lastDimension = '';
            todayMicros.forEach((micro, idx) => {
                const dimensionLabel = micro.dimension || 'Geral';
                if (dimensionLabel !== lastDimension) {
                    lastDimension = dimensionLabel;
                    html += `
                    <div class="pt-2 first:pt-0">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-label uppercase tracking-widest text-outline font-bold">${app.escapeHtml(dimensionLabel)}</span>
                            <span class="h-px flex-1 bg-outline-variant/20"></span>
                        </div>
                    </div>`;
                }
                if (micro.status === 'done' || micro.completed) {
                    const isRecentCompletion = micro.id === app.recentCompletedMicroId;
                    html += `
                    <div class="relative overflow-hidden bg-emerald-500/[0.04] border border-emerald-500/25 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm shadow-emerald-500/5 ${isRecentCompletion ? 'micro-complete-feedback' : ''}">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                        <div class="absolute right-3 bottom-2 pointer-events-none opacity-[0.05]">
                            <span class="material-symbols-outlined notranslate text-4xl text-emerald-500">verified</span>
                        </div>
                        <div class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ${isRecentCompletion ? 'micro-complete-check' : ''}">
                            <span class="material-symbols-outlined notranslate text-white leading-none" style="font-size:13px; font-variation-settings: 'wght' 700;">check</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm text-on-surface font-semibold leading-snug line-through">${micro.title}</p>
                            <span class="inline-flex items-center mt-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wide rounded-md leading-none area-tag">${dimensionLabel}</span>
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
                    const isPlanned = app._isPlannedThisWeek(micro.id);
                    const badge = (icon, label, color, bg) => `<span class="inline-flex items-center gap-0.5 ${color} ${bg} border border-outline-variant/20 rounded-md px-1 py-0.5 shrink-0 leading-none"><span class="material-symbols-outlined notranslate leading-none" style="font-size:11px">${icon}</span><span>${label}</span></span>`;
                    const dimensionBadge = badge(dimIcon, micro.dimension || 'Geral', 'text-primary', 'bg-primary/5');
                    const statusBadge = micro.status === 'in_progress' ? badge('radio_button_checked', 'Andamento', 'text-amber-600 dark:text-amber-400', 'bg-amber-500/10') : '';
                    const overdueBadge = isOverdue ? badge('alarm', 'Atrasada', 'text-red-600 dark:text-red-400', 'bg-red-500/10') : '';
                    const planBadge = isPlanned ? badge('event', 'Semana', 'text-primary', 'bg-primary/5') : badge('inbox', 'Captura', 'text-on-surface-variant', 'bg-surface-container-high');
                    const startBtn = shouldStart
                        ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', true);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">Iniciar</button>`
                        : (micro.status === 'in_progress'
                            ? `<button onclick="event.stopPropagation(); app.openMicroInFocus('${micro.id}', false);" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors">Gerenciar</button>`
                            : '');

                    html += `
                    <div class="space-y-2">
                        <div class="relative overflow-hidden ${micro.status === 'in_progress' ? 'bg-amber-500/[0.04] border border-amber-500/35 shadow-sm shadow-amber-500/10' : 'bg-surface-container-lowest border border-outline-variant/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]'} px-4 py-3 rounded-xl group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${micro.status === 'in_progress' ? 'bg-amber-500' : 'bg-primary/30'}"></div>
                            <div class="flex items-center gap-3">
                                <div class="w-5 h-5 rounded-full border-2 ${micro.status === 'in_progress' ? 'border-amber-500 bg-amber-500/10' : 'border-outline-variant'} flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check shrink-0" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                                <div class="flex-1 min-w-0 space-y-1.5">
                                    <div class="flex items-center gap-3">
                                        <p class="text-sm font-semibold text-on-surface leading-snug flex-1 min-w-0">${micro.title}</p>
                                        <div class="flex items-center gap-1 shrink-0">
                                            ${startBtn}
                                            <button type="button" title="Adiar para amanhã" onclick="event.stopPropagation(); app.postponeMicroOneDay('${micro.id}');" class="w-7 h-7 flex items-center justify-center rounded-md text-outline hover:bg-surface-container-high hover:text-on-surface transition-colors active:scale-90">
                                                <span class="material-symbols-outlined notranslate text-[18px]">event_upcoming</span>
                                            </button>
                                            <span class="material-symbols-outlined notranslate text-outline-variant text-sm transition-transform group-[.open]:rotate-180">keyboard_arrow_down</span>
                                        </div>
                                    </div>
                                    <div class="flex flex-nowrap items-center gap-1 overflow-hidden text-[9px] font-bold uppercase tracking-wide leading-none">
                                        ${dimensionBadge}
                                        ${statusBadge}
                                        ${overdueBadge}
                                        ${planBadge}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="hidden bg-surface-container-low rounded-lg p-4 space-y-3 relative trail-line text-on-surface-variant overflow-hidden" id="trail-${idx}">
                            <div class="absolute left-[12px] top-3 bottom-3 w-px bg-primary/10"></div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full">check_circle</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Micro Ação</span>
                                    <span class="text-sm font-medium truncate">${micro.title}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">account_tree</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Macro Ação</span>
                                    <span class="text-xs truncate">${macro.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">track_changes</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">OKR</span>
                                    <span class="text-xs truncate">${okr.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-outline text-xl bg-surface-container-lowest p-0.5 rounded-full">flag</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Meta</span>
                                    <span class="text-xs text-on-surface-variant font-medium truncate">${meta.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full">${dimIcon}</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Área</span>
                                    <span class="text-xs truncate">${micro.dimension}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate text-primary text-xl bg-surface-container-lowest p-0.5 rounded-full" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold text-primary">Propósito (Nível 0)</span>
                                    <span class="text-base font-headline italic truncate">${meta.purpose || '-'}</span>
                                </div>
                            </div>

                            <div class="pt-3 border-t border-outline-variant/10 flex justify-end">
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
            if (app.recentCompletedMicroId) {
                const completedId = app.recentCompletedMicroId;
                setTimeout(() => {
                    if (app.recentCompletedMicroId !== completedId) return;
                    app.recentCompletedMicroId = '';
                    if (app.currentView === 'hoje' && app.render.hoje) app.render.hoje();
                }, 850);
            }

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
            const filterContainer = document.getElementById('planos-dimension-filters') || document.querySelector('.overflow-x-auto.no-scrollbar.mb-12');
            if (filterContainer) {
                const btns = filterContainer.querySelectorAll('button');
                btns.forEach(btn => {
                    const txt = btn.textContent.trim();
                    const isMatched = (txt === filter || (filter === 'Relacionamentos' && txt === 'Relac.'));

                    if (isMatched) {
                        btn.className = "px-4 py-2 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shadow-sm";
                    } else {
                        btn.className = "px-4 py-2 rounded-lg text-outline text-[10px] font-bold uppercase tracking-wider whitespace-nowrap hover:bg-surface-container-high transition-all";
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
                const base = 'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap';
                const on = 'bg-primary text-on-primary shadow-sm';
                const off = 'text-outline hover:bg-surface-container-high';
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
                    // Micros usam regra binária; macro/okr/meta exigem decisão explícita do usuário.
                    const isDone = entityType === 'micros'
                        ? (i.status === 'done' || i.completed || (Number(i.progress) || 0) >= 100)
                        : (i.status === 'done');
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
                    const emptyTypeLabel = ({ metas: 'meta', okrs: 'OKR', macros: 'macro', micros: 'micro ação' })[entityType] || 'plano';
                    const filterCopy = filter === 'Todas' ? 'nesta categoria' : `em ${filter}`;
                    return `
                    <div class="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 border-dashed text-center flex flex-col items-center justify-center">
                        <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                            <span class="material-symbols-outlined notranslate text-outline text-3xl">${emptyIcon}</span>
                        </div>
                        <h4 class="font-headline text-lg font-bold text-on-background">Nenhum ${emptyTypeLabel} encontrado</h4>
                        <p class="text-sm text-outline mt-2 max-w-sm">Não há itens ${filterCopy} com os filtros atuais.</p>
                        <div class="mt-5 flex flex-wrap justify-center gap-2">
                            <button type="button" onclick="window.app.openCreateModal('${entityType}')"
                                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                                <span class="material-symbols-outlined notranslate text-[16px]">add</span>
                                Criar ${emptyTypeLabel}
                            </button>
                            <button type="button" onclick="window.app.clearPlanosFilters()"
                                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest active:scale-95 transition-all">
                                <span class="material-symbols-outlined notranslate text-[16px]">filter_alt_off</span>
                                Limpar filtros
                            </button>
                        </div>
                    </div>`;
                }

                let html = '';
                for (const [dim, entities] of Object.entries(grouped)) {
                    html += `
                    <div>
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xs font-label uppercase tracking-[0.2em] text-outline">${dim}</h3>
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

                        let trailHtml = `<div class="bg-surface-container-low rounded-lg p-3 space-y-2 relative trail-line text-on-surface-variant mt-0 overflow-hidden">
                            <div class="absolute left-[20px] top-4 bottom-4 w-px bg-primary/15"></div>`;

                        trailNodes.forEach((node) => {
                            let icon = 'trip_origin'; let colorClass = 'text-outline'; let titleClass = 'text-xs text-on-surface-variant font-medium';
                            let nodeShell = '';
                            if (node.label === 'Propósito (Nível 0)') { icon = 'auto_awesome'; colorClass = 'text-primary'; titleClass = 'text-sm font-headline italic text-on-surface'; nodeShell = 'mt-1 rounded-xl bg-primary/5 border border-primary/10 p-3'; }
                            else if (node.label === 'Área') { icon = 'stars'; colorClass = 'text-primary'; }
                            else if (node.label === 'Meta') { icon = 'flag'; colorClass = 'text-outline'; }
                            else if (node.label === 'Meta Pai') { icon = 'outbound'; colorClass = 'text-outline'; }
                            else if (node.label === 'Horizonte') { icon = 'schedule'; colorClass = 'text-primary'; }
                            else if (node.label === 'OKR') { icon = 'track_changes'; colorClass = 'text-outline'; }
                            else if (node.label === 'Macro Ação') { icon = 'account_tree'; colorClass = 'text-outline'; }
                            else if (node.label === 'Micro Ação') { icon = 'check_circle'; colorClass = 'text-primary'; }
                            else if (node.label === 'Critério de Sucesso') { icon = 'rule'; colorClass = 'text-primary'; }
                            else if (node.label === 'Desafio') { icon = 'military_tech'; colorClass = 'text-primary'; }
                            else if (node.label === 'Comprometimento') { icon = 'verified'; colorClass = 'text-primary'; }
                            else if (node.label === 'Key Results') { icon = 'query_stats'; colorClass = 'text-primary'; }

                            trailHtml += `
                            <div class="${nodeShell} flex items-start gap-3 relative z-10 min-w-0">
                                <span class="material-symbols-outlined notranslate ${colorClass} text-base bg-surface-container-lowest p-1 rounded-full shrink-0 mt-0.5 ring-1 ring-outline-variant/10" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                                <div class="flex flex-col min-w-0 flex-1">
                                    <span class="text-[9px] uppercase tracking-wider opacity-60 font-bold ${colorClass}">${node.label}</span>
                                    <span class="${titleClass} ${node.label === 'Propósito (Nível 0)' ? 'line-clamp-2' : 'break-words'}">${node.title}</span>
                                </div>
                            </div>`;
                        });
                        trailHtml += `</div>`;

                        const userValues = state.profile.values || [];
                        const isAligned = userValues.includes(item.dimension);
                        const microPlanChip = entityType === 'micros'
                            ? (app._isPlannedThisWeek(item.id)
                                ? '<span title="Micro selecionada no planejamento semanal" class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold uppercase tracking-wider">Semana</span>'
                                : '<span title="Micro capturada fora do plano semanal" class="shrink-0 bg-surface-container-high text-on-surface-variant text-[9px] px-2 py-0.5 rounded-full border border-outline-variant/20 font-bold uppercase tracking-wider">Captura</span>')
                            : '';
                        const woopHtml = (item.obstacle || item.ifThen) ? `
                            <div class="mb-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-on-surface-variant leading-relaxed">
                                <p class="text-[9px] uppercase tracking-widest font-bold text-primary mb-1">WOOP / Se-então</p>
                                ${item.obstacle ? `<p><span class="font-bold text-on-surface">Obstáculo:</span> ${app.escapeHtml(item.obstacle)}</p>` : ''}
                                ${item.ifThen ? `<p class="mt-1"><span class="font-bold text-on-surface">Plano:</span> ${app.escapeHtml(item.ifThen)}</p>` : ''}
                            </div>` : '';

                        const isInProgress = item.status === 'in_progress';
                        // Para micros (atômicas): completed/progress 100 implicam done.
                        // Para macros/okrs/metas: done EXIGE decisão explícita (status === 'done').
                        const isDone = entityType === 'micros'
                            ? (item.status === 'done' || item.completed || prog >= 100)
                            : (item.status === 'done');
                        const isPending = item.status === 'pending';
                        const isReadyToClose = !isDone && entityType !== 'micros' && prog >= 100;
                        const highlightClass = isReadyToClose
                            ? 'ring-2 ring-emerald-500/40 border-emerald-500/50 shadow-md shadow-emerald-500/10 bg-emerald-500/[0.03]'
                            : (isInProgress
                                ? 'ring-2 ring-amber-500/30 border-amber-500/50 shadow-md shadow-amber-500/10 bg-amber-500/[0.03]'
                                : (isDone ? 'border-emerald-500/40 shadow-md shadow-emerald-500/10 bg-emerald-500/[0.035]' : 'border-outline-variant/20 shadow-sm'));
                        const accentClass = isDone ? 'bg-emerald-500' : (isReadyToClose ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary/30'));
                        const progressColor = isDone ? 'bg-emerald-500' : (isReadyToClose ? 'bg-emerald-500' : (isInProgress ? 'bg-amber-500' : 'bg-primary'));
                        const statusChip = isDone
                            ? '<span class="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Concluído</span>'
                            : (isReadyToClose
                                ? '<span class="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pronto p/ fechar</span>'
                                : (isInProgress
                                    ? '<span class="shrink-0 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Andamento</span>'
                                    : '<span class="shrink-0 bg-surface-container-high text-on-surface-variant px-2.5 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Pendente</span>'));
                        const actionButton = entityType === 'micros' && !isDone
                            ? `
                                <button onclick="event.stopPropagation(); app.openMicroInFocus('${item.id}', ${isPending ? 'true' : 'false'})"
                                    class="p-2.5 border ${isPending ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary'} rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">${isPending ? 'play_arrow' : 'timer'}</span> ${isPending ? 'Iniciar' : 'Gerenciar'}
                                </button>
                            `
                            : (isDone
                                ? `
                                ${entityType === 'micros'
                                    ? `<button onclick="event.stopPropagation(); app.completeMicroAction('${item.id}')"
                                        class="p-2.5 border border-primary/30 bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-primary transition-colors">
                                        <span class="material-symbols-outlined notranslate text-base">undo</span> Reabrir
                                    </button>`
                                    : `<button onclick="event.stopPropagation(); app.deleteEntity('${item.id}', '${entityType}')"
                                        class="p-2.5 border border-outline-variant/30 hover:bg-error-container/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-error transition-colors">
                                        <span class="material-symbols-outlined notranslate text-base">delete</span> Excluir
                                    </button>`
                                }
                                `
                                : (isPending
                                    ? `
                                <div class="p-2.5 border border-outline-variant/20 bg-surface-container-low rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline" title="Inicia automaticamente quando uma micro filha entra em execução">
                                    <span class="material-symbols-outlined notranslate text-base">account_tree</span> Inicia via cascata
                                </div>
                                `
                                    : `
                                <button onclick="event.stopPropagation(); app.forceCompleteEntity('${item.id}', '${entityType}')"
                                    class="p-2.5 border ${isReadyToClose ? 'border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 ring-2 ring-emerald-500/20' : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'} rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 transition-colors">
                                    <span class="material-symbols-outlined notranslate text-base">check_circle</span> ${isReadyToClose ? 'Fechar agora' : 'Concluir'}
                                </button>
                                `));

                        html += `
                        <div data-entity-id="${item.id}" data-entity-type="${entityType}" class="bg-surface-container-lowest p-4 md:p-5 rounded-2xl border ${highlightClass} hover:shadow-lg transition-all group cursor-pointer overflow-hidden relative" onclick="app.toggleTrail(this)">
                            <div class="absolute left-0 top-0 bottom-0 w-1 ${accentClass}"></div>
                            ${isDone ? '<div class="absolute right-4 bottom-4 pointer-events-none opacity-[0.07]"><span class="material-symbols-outlined notranslate text-7xl text-emerald-500">verified</span></div>' : ''}
                            <div class="flex items-start justify-between gap-3 mb-3">
                                <div class="space-y-1.5 flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="shrink-0 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-label font-bold uppercase tracking-wider">${item.dimension || 'Geral'}</span>
                                        ${microPlanChip}
                                        ${isAligned ? '<span class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full border border-primary/20 font-bold">ALINHADO</span>' : ''}
                                    </div>
                                    <h4 class="font-headline text-lg md:text-xl font-semibold leading-tight line-clamp-2">${item.title}</h4>
                                    ${subMetaText ? `<p class="text-[11px] text-outline">${subMetaText}</p>` : ''}
                                </div>
                                <div class="flex flex-col items-end gap-2 shrink-0">
                                    ${statusChip}
                                    <span class="material-symbols-outlined notranslate text-outline text-lg transition-transform group-hover:translate-x-0.5">chevron_right</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 mb-3 text-[11px] text-outline whitespace-nowrap overflow-x-auto no-scrollbar border-t border-outline-variant/10 pt-3">
                                <span class="inline-flex items-center gap-1 shrink-0">
                                    <span class="material-symbols-outlined notranslate text-sm">event</span>
                                    ${app.formatPrazoDisplay(item)}
                                </span>
                                ${countLine ? `<span class="text-outline/40 shrink-0">·</span><span class="font-label uppercase tracking-wider shrink-0">${countLine}</span>` : ''}
                            </div>

                            <div class="space-y-1.5 mb-4">
                                <div class="flex justify-between items-center text-[10px] font-label uppercase tracking-wider text-outline">
                                    <span>Progresso</span>
                                    <span>${prog.toFixed(0)}%</span>
                                </div>
                                <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div class="h-full ${progressColor} rounded-full transition-all" style="width: ${visualProg}%"></div>
                                </div>
                            </div>

                            ${woopHtml}

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

                            <div class="trail-panel hidden overflow-hidden transition-all duration-300 max-h-0 mt-3 border-t border-outline-variant/10 pt-3">
                                ${trailHtml}
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
            app.renderProfileChrome();

            const notifKnob = document.getElementById('notif-toggle-knob');
            const notifTrack = document.getElementById('notif-toggle-track');
            if (notifTrack && notifKnob) {
                const on = !!state.settings.notificationsEnabled;
                notifTrack.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${on ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                notifKnob.className = `w-3 h-3 rounded-full absolute transition-all ${on ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }

            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) themeSelect.value = state.settings.theme || 'auto';
            app.updateSplashSettingsControls();
            const soundTrack = document.getElementById('sound-toggle-track');
            const soundKnob = document.getElementById('sound-toggle-knob');
            if (soundTrack && soundKnob) {
                const soundOn = !!state.settings.soundEnabled;
                soundTrack.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${soundOn ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                soundKnob.className = `w-3 h-3 rounded-full absolute transition-all ${soundOn ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }
            app.renderGamificationProfile();
            app.renderProfileCadence();
            app.renderNotesPanel();
            app.renderManualGuide();
            app.updateProfileAppVersion();
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
                    app.normalizeSwlsState();
                    const swls = state.swls || { answers: [4, 4, 4, 4, 4], lastScore: 20, lastDate: "", history: {} };
                    const scoreEl = document.getElementById('swls-score');
                    const bandEl = document.getElementById('swls-band');
                    const dateEl = document.getElementById('swls-last-date');
                    const historyEl = document.getElementById('swls-history-list');
                    const insightEl = document.getElementById('swls-perma-insight');
                    const score = Number(swls.lastScore) || 0;
                    const permaVals = ['P', 'E', 'R', 'M', 'A'].map((k) => app.normalizePermaScore(state.perma?.[k]));
                    const permaAvg = permaVals.reduce((sum, n) => sum + n, 0) / permaVals.length;
                    const swlsEq10 = Math.round((score / 35) * 100) / 10;
                    const delta = Math.abs(permaAvg - swlsEq10);

                    if (scoreEl) scoreEl.textContent = `${score}/35`;
                    if (bandEl) bandEl.textContent = app.getSwlsBand(score);
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
                        valuesTool.classList.add('hidden');
                    }

                    // Identidade Base (valores, forças e sombras)
                    window.app.renderIdentityBase();

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

            // Render SVG Roda da Vida
            try {
                app.normalizeDimensionsState();
                app.updateWheelPolygon();
            } catch (e) {
                console.error("Erro na renderização das barras PERMA ou Roda da Vida:", e);
            }

            const topValuesContainer = document.getElementById('top-values-banner');

            // Render Sliders UI
            const slidersContainer = document.getElementById('roda-sliders');
            if (slidersContainer) {
                let html = '';
                for (const dim of app.getWheelAxes()) {
                    const data = state.dimensions[dim] || { score: 1 };
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

        // ── Janela: mês anterior até dez/ano corrente (mínimo 5 meses à frente) ───
        const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const minEnd    = new Date(today.getFullYear(), today.getMonth() + 5, 0);
        const yearEnd   = new Date(today.getFullYear(), 11, 31);
        const endDate   = yearEnd > minEnd ? yearEnd : minEnd;
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

            const labelMap = { metas: 'Meta', okrs: 'OKR', macros: 'Macro', micros: 'Micro' };

            const progress = entity.progress || (entity.status === 'done' ? 100 : 0);
            const isOverdue = taskEnd < today && entity.status !== 'done';
            const isMicro = tipo === 'micros';

            let barBg;
            if (entity.status === 'done') {
                barBg = 'bg-emerald-500';
            } else if (isOverdue) {
                barBg = 'bg-error/80';
            } else if (entity.status === 'in_progress') {
                barBg = 'bg-amber-500';
            } else {
                barBg = isMicro ? 'bg-outline/30' : 'bg-outline/40';
            }
            const barStyles = barBg;
            const txtColor = (entity.status === 'done' || entity.status === 'in_progress' || isOverdue)
                ? 'text-white'
                : 'text-on-surface-variant';

            const dimValue = entity.dimension || entity.dimensionName || parentDim || 'Geral';
            const borderColor = dimColorMap[dimValue] || 'border-outline-variant/40';

            const barHeight = isMicro ? 'h-4' : 'h-6';
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
                  <div class="absolute ${barHeight} rounded-lg overflow-hidden shadow-sm transition-all group-hover:shadow-md ${barStyles} ${txtColor}"
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

        const legendHTML = `
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 px-2 opacity-60">
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>Concluído
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>Em andamento
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-outline/40 flex-shrink-0"></span>Pendente
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-outline font-label uppercase tracking-widest">
              <span class="inline-block w-2 h-2 rounded-full bg-error/80 flex-shrink-0"></span>Atrasado
            </span>
          </div>`;

        container.innerHTML = `
          <div class="relative min-w-[600px]">
            ${headerHTML}
            <div class="relative pb-6">
              ${todayLine}
              ${rowsHTML}
            </div>
            ${legendHTML}
          </div>`;
    },

    // Cascata bottom-up:
    // - Calcula progress dos pais a partir das filhas (done-count para macros; avg para okr/meta).
    // - NUNCA marca pai como 'done' automaticamente — chegar a 100% só sinaliza "pronto para fechar".
    //   Apenas o usuário fecha (via forceCompleteEntity / botão Concluir).
    // - Auto-start: se algum filho está ativo (in_progress/done) e o pai está pending → pai vira in_progress.
    // - Auto-revert: se pai estava 'done' mas filha foi reaberta → volta para in_progress.
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

    // ------------------------------------------------------------------------
    // Reactive Actions
    // ------------------------------------------------------------------------
    completeMicroAction: function(id) {
        const state = window.sistemaVidaState;
        const micro = state.entities.micros.find(m => m.id === id);
        if (!micro) {
            this.showToast('Micro ação não encontrada. Atualize a tela e tente novamente.', 'error');
            return;
        }

        // Define se estamos marcando ou desmarcando a tarefa
        const isCompleting = micro.status !== 'done';
        const wasInProgress = micro.status === 'in_progress';
        if (!isCompleting) {
            const confirmed = confirm('Reabrir esta micro vai remover a conclusão e recalcular o progresso da trilha. Deseja continuar?');
            if (!confirmed) return;
        } else {
            const focusSec = Number(micro.focusSec || 0);
            const focusSessions = Number(micro.focusSessions || 0);
            const hasFocusEvidence = focusSec > 0 || focusSessions > 0;
            if (!hasFocusEvidence) {
                const confirmed = confirm('Esta micro não tem tempo de foco registrado. Concluir mesmo assim?');
                if (!confirmed) return;
            }
        }
        micro.status = isCompleting ? 'done' : 'pending';
        // Sincroniza com a propriedade Legada 'completed' para manter UI funcionando
        micro.completed = isCompleting;
        micro.progress = isCompleting ? 100 : 0;

        if (isCompleting) {
          micro.completedDate = this.getLocalDateKey();
          const award = this.awardGamification('micro_complete', {
              key: `micro:${micro.id}:complete`,
              id: micro.id,
              title: micro.title,
              dimension: micro.dimension,
              planned: this._isPlannedThisWeek ? this._isPlannedThisWeek(micro.id) : false,
              inProgress: wasInProgress
          });
          this.showGamificationToast(award);
          this.recentCompletedMicroId = micro.id;
          if (award) {
              this.showFloatingXp(award.xp);
              this.flashMicroCard(micro.id);
              if (award.tierPromotion) {
                  this.playXpSound('tierup');
                  setTimeout(() => this.showTierPromotionOverlay(award.dimension, award.identity.title, award.identity.icon), 600);
              } else if (award.dimensionLeveledUp || award.totalLeveledUp) {
                  this.playXpSound('levelup');
              } else {
                  this.playXpSound('xp');
              }
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
                            if (this.showNotification) this.showNotification("🎯 OKR atingiu 70% (Alvo Ideal). Bônus de realização aplicado!");
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

    // Sobe a cascata de status quando uma micro entra em execução: pais que estavam
    // 'pending' viram 'in_progress'. Não toca em pais 'done' (usuário decidiu fechar).
    // Não altera progress dos pais — isso é responsabilidade do updateCascadeProgress.
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
        const effortInput = document.getElementById('crud-effort');
        if (effortInput) effortInput.value = this.getMicroEffort(item);
        const obstacleInput = document.getElementById('crud-obstacle');
        if (obstacleInput) obstacleInput.value = item.obstacle || '';
        const ifThenInput = document.getElementById('crud-ifthen');
        if (ifThenInput) ifThenInput.value = item.ifThen || '';
        this.populateKrRows(item.keyResults);
        
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
            const identitySel = document.getElementById('habit-identity-source');
            const identityMode = document.getElementById('habit-identity-mode');
            const identityType = item.sourceType === 'strength' ? 'strengths' : item.sourceType === 'shadow' ? 'shadows' : '';
            if (identitySel && identityType && item.sourceId) {
                const value = `${identityType}:${item.sourceId}`;
                if (identitySel.querySelector(`option[value="${value}"]`)) identitySel.value = value;
                this.onHabitIdentitySourceChange(identitySel.value);
            }
            if (identityMode && item.habitMode) identityMode.value = item.habitMode;
        }
        
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
        const contextActionsEl = document.getElementById('deep-work-context-actions');

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
        const selectedMicro = dw.microId ? (state.entities.micros || []).find(m => m.id === dw.microId) : null;
        const canCompleteSelectedMicro = !!(selectedMicro && selectedMicro.status !== 'done');
        if (statusEl) {
            if (!dw.isRunning && !hasSelectedMicro) statusEl.textContent = 'Escolha uma micro ação';
            else if (!dw.isRunning) statusEl.textContent = 'Pronto para iniciar';
            else if (dw.isPaused) statusEl.textContent = 'Sessão pausada';
            else statusEl.textContent = dw.mode === 'focus' ? 'Foco profundo em andamento' : (canCompleteSelectedMicro ? 'Sessão concluída: confirme a micro ação' : 'Pausa de recuperação');
        }
        if (stepEl) {
            if (!dw.isRunning && !hasSelectedMicro) stepEl.textContent = 'Passo 1 de 3: selecione a micro';
            else if (!dw.isRunning) stepEl.textContent = 'Passo 2 de 3: inicie o bloco';
            else if (dw.isPaused) stepEl.textContent = 'Pausado: retome ou finalize';
            else stepEl.textContent = dw.mode === 'focus' ? 'Passo 3 de 3: executando foco' : (canCompleteSelectedMicro ? 'Passo final: conclua ou reabra a micro após o foco' : 'Pausa estruturada');
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
            if (dw.isRunning && dw.mode === 'focus') {
                finishBtn.textContent = 'Finalizar sessão';
                finishBtn.className = activeBtn;
                finishBtn.disabled = false;
                finishBtn.onclick = () => window.app.finishDeepWorkNow();
            } else if (dw.isRunning && dw.mode === 'break') {
                finishBtn.textContent = 'Pular descanso';
                finishBtn.className = neutralBtn;
                finishBtn.disabled = false;
                finishBtn.onclick = () => window.app.skipBreak();
            } else {
                finishBtn.textContent = 'Finalizar';
                finishBtn.className = finishBtnClass;
                finishBtn.disabled = true;
                finishBtn.onclick = () => window.app.finishDeepWorkNow();
            }
        }

        if (contextActionsEl) {
            const shouldShowQuickComplete = !!(hasSelectedMicro && canCompleteSelectedMicro && (dw.mode === 'break' || !dw.isRunning));
            contextActionsEl.classList.toggle('hidden', !shouldShowQuickComplete);
            if (shouldShowQuickComplete && selectedMicro) {
                contextActionsEl.innerHTML = `
                    <div class="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3">
                        <p class="text-[11px] text-on-surface-variant leading-snug">Sessão finalizada para <span class="font-bold text-on-surface">${this.escapeHtml(selectedMicro.title)}</span>. Concluir agora?</p>
                        <button onclick="window.app.completeMicroAction('${selectedMicro.id}')" class="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-90">
                            Concluir
                        </button>
                    </div>`;
            } else {
                contextActionsEl.innerHTML = '';
            }
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

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
