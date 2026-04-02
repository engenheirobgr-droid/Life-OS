/**
 * Sistema Vida - Core OS
 * Vanilla JS Single Page Application Controller with Data Binding
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

window.sistemaVidaState = {
    profile: {
        name: "Viajante",
        level: 1,
        xp: 0,
        values: [],
        legacy: "",
        ikigai: { missao: "", vocacao: "" },
        legacyObj: { familia: "", profissao: "", mundo: "" },
        vision: { saude: "", carreira: "", intelecto: "", quote: "" }
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
    entities: { metas: [], okrs: [], macros: [], micros: [] },
    habits: [],
    dailyLogs: {},
    reviews: {}
};

const app = {
    config: {
        containerId: 'app-content',
        viewsPath: 'views/',
    },
    currentView: '',
    planosFilter: 'Todas',
    currentTextGroup: null,
    currentTextKey: null,

    // ------------------------------------------------------------------------
    // Cloud Persistence Engine
    // ------------------------------------------------------------------------
    saveState: async function() {
        try {
            const stateRef = doc(db, "users", "meu-sistema-vida");
            await setDoc(stateRef, window.sistemaVidaState);
            console.log("Sincronização com Nuvem: Concluída.");
        } catch (error) {
            console.error("Erro ao salvar o estado no Firestore:", error);
        }
    },

    loadState: async function() {
        try {
            const stateRef = doc(db, "users", "meu-sistema-vida");
            const docSnap = await getDoc(stateRef);
            
            if (docSnap.exists()) {
                console.log("Estado encontrado na Nuvem, mesclando dados...");
                window.sistemaVidaState = { ...window.sistemaVidaState, ...docSnap.data() };
            } else {
                console.log("Primeiro acesso. Criando documento base na Nuvem...");
                await this.saveState();
            }
        } catch (error) {
            console.error("Erro ao carregar o estado do Firestore:", error);
        }
    },

    init: async function() {
        console.log("Sistema Vida OS inicializando...");
        await this.loadState();
        if (!window.sistemaVidaState.onboardingComplete) {
            this.navigate('onboarding');
        } else {
            this.navigate('hoje');
        }
    },

    navigate: async function(viewName) {
        if (!viewName) return;
        this.currentView = viewName;
        this.updateNavUI(viewName);
        
        const container = document.getElementById(this.config.containerId);

        try {
            const response = await fetch(`${this.config.viewsPath}${viewName}.html`);
            if (!response.ok) throw new Error(`Failed to load view: ${response.statusText}`);

            container.innerHTML = await response.text();
            console.log(`View carregada via fetch: ${viewName}`);
        } catch (error) {
            console.warn(`Fallback ativado para a view '${viewName}'. Erro (CORS):`, error);
            container.innerHTML = this.getFallbackTemplate(viewName);
        }

        this.executeInjectedScripts(container);
        
        // Data Binding: Auto-render view
        if (this.render[viewName]) {
            this.render[viewName]();
        }
    },

    setPlanosFilter: function(dim) {
        this.planosFilter = dim;
        if (this.render.planos) this.render.planos();
    },

    updateDimensionScore: function(dim, val) {
        window.sistemaVidaState.dimensions[dim].score = parseInt(val);
        if (this.render.proposito) this.render.proposito();
        if (this.render.painel) this.render.painel();
        app.saveState();
    },

    saveValues: function(newValuesArray) {
        window.sistemaVidaState.profile.values = newValuesArray;
        if (this.render.proposito) this.render.proposito();
        app.saveState();
    },

    openCreateModal: function() {
        document.getElementById('crud-modal').classList.remove('hidden');
    },

    closeModal: function() {
        document.getElementById('crud-modal').classList.add('hidden');
        document.getElementById('crud-form').reset();
    },

    openTextEdit: function(title, group, key) {
        this.currentTextGroup = group;
        this.currentTextKey = key;
        document.getElementById('text-edit-title').textContent = title;
        document.getElementById('text-edit-input').value = window.sistemaVidaState.profile[group][key] || "";
        document.getElementById('text-edit-modal').classList.remove('hidden');
    },

    closeTextModal: function() {
        document.getElementById('text-edit-modal').classList.add('hidden');
    },

    saveTextEdit: function() {
        const val = document.getElementById('text-edit-input').value.trim();
        window.sistemaVidaState.profile[this.currentTextGroup][this.currentTextKey] = val;
        this.saveState();
        this.closeTextModal();
        if (this.currentView === 'proposito' && this.render.proposito) {
            this.render.proposito();
        }
    },

    openReviewModal: function() {
        document.getElementById('review-form').reset();
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

        const key = new Date().toISOString();
        if (!window.sistemaVidaState.reviews) {
            window.sistemaVidaState.reviews = {};
        }

        window.sistemaVidaState.reviews[key] = { q1, q2, q3, q4, q5 };
        
        this.saveState();

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

    saveNewEntity: function() {
        const title = document.getElementById('crud-title').value;
        const type = document.getElementById('crud-type').value;
        const dimension = document.getElementById('crud-dimension').value;
        const context = document.getElementById('crud-context').value;
        const trigger = (type === 'habits' && document.getElementById('crud-trigger')) ? document.getElementById('crud-trigger').value.trim() : '';

        const id = 'ent_' + Date.now();
        const obj = { id, title, dimension };

        if (type === 'metas' || type === 'okrs') {
            obj.purpose = context;
            obj.progress = 0;
        } else if (type === 'macros') {
            obj.description = context;
            obj.progress = 0;
        } else if (type === 'micros') {
            obj.indicator = context;
            obj.completed = false;
        } else if (type === 'habits') {
            obj.context = context;
            obj.completed = false;
            if (trigger) obj.trigger = trigger;
        }

        if (type === 'habits') {
            if (!window.sistemaVidaState.habits) window.sistemaVidaState.habits = [];
            window.sistemaVidaState.habits.push(obj);
        } else {
            if (!window.sistemaVidaState.entities[type]) {
                window.sistemaVidaState.entities[type] = [];
            }
            window.sistemaVidaState.entities[type].push(obj);
        }

        this.closeModal();
        this.saveState();

        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
    },

    toggleHabit: function(habitId) {
        const state = window.sistemaVidaState;
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            habit.completed = !habit.completed;
            this.saveState();
            if (habit.completed && typeof showIdentityToast === 'function') {
                showIdentityToast(habit.dimension);
            }
            if (this.currentView === 'hoje' && this.render.hoje) {
                this.render.hoje();
            }
        }
    },

    saveDailyLog: function() {
        const gratidao = document.getElementById('diario-gratidao') ? document.getElementById('diario-gratidao').value : '';
        const funcionou = document.getElementById('diario-funcionou') ? document.getElementById('diario-funcionou').value : '';
        const aprendi = document.getElementById('diario-aprendi') ? document.getElementById('diario-aprendi').value : '';
        const s1 = document.getElementById('diario-shutdown-1') ? document.getElementById('diario-shutdown-1').value : '';
        const s2 = document.getElementById('diario-shutdown-2') ? document.getElementById('diario-shutdown-2').value : '';
        const s3 = document.getElementById('diario-shutdown-3') ? document.getElementById('diario-shutdown-3').value : '';

        const today = new Date().toISOString().split('T')[0];
        
        if (!window.sistemaVidaState.dailyLogs) window.sistemaVidaState.dailyLogs = {};
        
        window.sistemaVidaState.dailyLogs[today] = { 
            gratidao, 
            funcionou, 
            aprendi, 
            shutdown: [s1, s2, s3], 
            energy: window.sistemaVidaState.energy 
        };

        this.saveState();

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
    // Rendering Engine (Data Binding)
    // ------------------------------------------------------------------------
    render: {
        painel: function() {
            const state = window.sistemaVidaState;
            
            for (const [dim, data] of Object.entries(state.dimensions)) {
                const el = document.querySelector(`[data-dimension="${dim}"]`);
                if (el) {
                    const textEl = el.querySelector('.dim-score-text');
                    const svgRing = el.querySelector('.dim-score-ring');
                    if (textEl) textEl.textContent = data.score + "%";
                    if (svgRing) {
                        const offset = 88 - (88 * data.score / 100);
                        svgRing.setAttribute('stroke-dashoffset', offset);
                    }
                }
            }

            if (state.perma) {
                const polygon = document.getElementById('perma-polygon');
                const scoreText = document.getElementById('perma-score');
                if (polygon && scoreText) {
                    const values = [state.perma.P, state.perma.E, state.perma.R, state.perma.M, state.perma.A];
                    const angles = [0, 72, 144, 216, 288].map(deg => deg * Math.PI / 180);
                    const pts = values.map((val, i) => {
                        const r = 40 * (val / 100);
                        const x = 50 + r * Math.sin(angles[i]);
                        const y = 50 - r * Math.cos(angles[i]);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });
                    polygon.setAttribute('points', pts.join(' '));
                    const avg = (values.reduce((a, b) => a + b, 0) / 5).toFixed(1);
                    scoreText.textContent = `Score PERMA: ${avg}`;
                }
            }
        },

        hoje: function() {
            const state = window.sistemaVidaState;
            
            // Restore Diário
            const today = new Date().toISOString().split('T')[0];
            if (state.dailyLogs && state.dailyLogs[today]) {
                const log = state.dailyLogs[today];
                const g = document.getElementById('diario-gratidao'); if (g) g.value = log.gratidao || '';
                const f = document.getElementById('diario-funcionou'); if (f) f.value = log.funcionou || '';
                const a = document.getElementById('diario-aprendi'); if (a) a.value = log.aprendi || '';
                const s1 = document.getElementById('diario-shutdown-1'); if (s1 && log.shutdown) s1.value = log.shutdown[0] || '';
                const s2 = document.getElementById('diario-shutdown-2'); if (s2 && log.shutdown) s2.value = log.shutdown[1] || '';
                const s3 = document.getElementById('diario-shutdown-3'); if (s3 && log.shutdown) s3.value = log.shutdown[2] || '';
            }

            // Render Habits
            const habitsContainer = document.getElementById('habits-container');
            if (habitsContainer && state.habits) {
                const habitIconMap = {
                    'Saúde': 'fitness_center', 'Mente': 'psychology', 'Carreira': 'work',
                    'Finanças': 'payments', 'Relacionamentos': 'groups', 'Família': 'family_restroom',
                    'Lazer': 'sports_esports', 'Propósito': 'auto_awesome'
                };
                
                let habitsHtml = '';
                state.habits.forEach(habit => {
                    const icon = habitIconMap[habit.dimension] || 'stars';
                    if (habit.completed) {
                        habitsHtml += `
                        <div onclick="window.app.toggleHabit('${habit.id}')" class="cursor-pointer min-w-[160px] max-w-[200px] bg-surface-container-low p-4 rounded-xl border border-transparent flex flex-col justify-between h-32 opacity-50 transition-all hover:scale-[0.98]">
                            <div class="flex justify-between items-start mb-2">
                                <span class="material-symbols-outlined text-primary text-2xl">${icon}</span>
                                <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-white text-[10px]" style="font-variation-settings: 'wght' 700;">check</span>
                                </div>
                            </div>
                            <div class="mt-auto">
                                <p class="font-medium text-on-surface text-sm line-through truncate">${habit.title}</p>
                                ${habit.trigger ? `<p class="mt-1 text-[10px] text-outline italic leading-tight break-words line-clamp-2">Gatilho: ${habit.trigger}</p>` : ''}
                            </div>
                        </div>`;
                    } else {
                        habitsHtml += `
                        <div onclick="window.app.toggleHabit('${habit.id}')" class="cursor-pointer min-w-[160px] max-w-[200px] bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-transparent hover:border-primary-container transition-all flex flex-col justify-between h-32 active:scale-95">
                            <div class="flex justify-between items-start mb-2">
                                <span class="material-symbols-outlined text-primary text-2xl">${icon}</span>
                                <div class="w-5 h-5 rounded-full border-2 border-outline-variant shrink-0"></div>
                            </div>
                            <div class="mt-auto">
                                <p class="font-medium text-on-surface text-sm truncate">${habit.title}</p>
                                ${habit.trigger ? `<p class="mt-1 text-[10px] text-outline italic leading-tight break-words line-clamp-2">Gatilho: ${habit.trigger}</p>` : ''}
                            </div>
                        </div>`;
                    }
                });
                
                if (state.habits.length === 0) {
                    habitsHtml = `<div class="p-4 text-xs italic text-outline">Nenhum hábito rastreado.</div>`;
                }
                
                habitsContainer.innerHTML = habitsHtml;
            }

            
            const energyBtns = document.querySelectorAll('.energy-btn');
            energyBtns.forEach(btn => {
                const val = parseInt(btn.textContent);
                if (val === state.energy) {
                    btn.className = "w-8 h-8 rounded-full border border-primary-container bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-medium energy-btn";
                } else {
                    btn.className = "w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center text-xs font-medium hover:border-primary hover:text-primary transition-all energy-btn";
                }

                btn.onclick = () => {
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

            state.entities.micros.forEach((micro, idx) => {
                if (micro.completed) {
                    html += `
                    <div class="bg-surface-container-low/50 p-4 rounded-xl flex items-center gap-4 opacity-60">
                        <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span class="material-symbols-outlined text-white text-sm" style="font-variation-settings: 'wght' 700;">check</span>
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
                    
                    html += `
                    <div class="space-y-2">
                        <div class="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                            <div class="flex-1">
                                <p class="text-base text-on-surface font-medium">${micro.title}</p>
                                <span class="inline-block mt-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded-full area-tag">${micro.dimension}</span>
                            </div>
                            <span class="material-symbols-outlined text-outline-variant text-sm">keyboard_arrow_down</span>
                        </div>
                        
                        <div class="hidden bg-stone-100 dark:bg-stone-900 rounded-lg p-6 space-y-6 relative trail-line text-on-surface-variant" id="trail-${idx}">
                            <div class="absolute left-[11px] top-4 bottom-4 w-px bg-primary/10"></div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5">check_circle</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Micro Ação</span>
                                    <span class="text-sm font-medium">${micro.title}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5">account_tree</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Macro Ação</span>
                                    <span class="text-xs">${macro.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5">track_changes</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">OKR</span>
                                    <span class="text-xs">${okr.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-stone-400 text-xl bg-stone-100 dark:bg-stone-900 p-0.5">flag</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Meta</span>
                                    <span class="text-xs text-on-surface-variant font-medium">${meta.title || '-'}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5">${dimIcon}</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Área</span>
                                    <span class="text-xs">${micro.dimension}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined text-primary text-xl bg-stone-100 dark:bg-stone-900 p-0.5" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold text-primary">Propósito (Nível 0)</span>
                                    <span class="text-base font-headline italic">${meta.purpose || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }
            });
            container.innerHTML = html;

            const pendingText = document.getElementById('pending-count');
            if (pendingText) pendingText.textContent = `${pendentes} pendentes`;
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

            const buildCards = (items, entityType) => {
                // Determine implicit dimension hierarchically
                const resolveDim = (item) => {
                    if (item.dimensionName) return item.dimensionName;
                    if (item.dimension) return item.dimension;
                    if (entityType === 'okrs') {
                         const m = state.entities.metas.find(x => x.id === item.metaId);
                         return m ? m.dimensionName : 'Geral';
                    }
                    if (entityType === 'macros') {
                         const o = state.entities.okrs.find(x => x.id === item.okrId);
                         const m = o ? state.entities.metas.find(x => x.id === o.metaId) : null;
                         return m ? m.dimensionName : 'Geral';
                    }
                    return 'Geral';
                };

                const filtered = filter === 'Todas' ? items : items.filter(i => resolveDim(i) === filter);
                
                const grouped = {};
                filtered.forEach(item => {
                    const dim = resolveDim(item) || 'Geral';
                    if (!grouped[dim]) grouped[dim] = [];
                    grouped[dim].push(item);
                });

                if (Object.keys(grouped).length === 0) {
                    return `<div class="p-8 text-center text-stone-400 italic">Nenhum plano encontrado para '${filter}'.</div>`;
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
                        
                        let trailNodes = [];
                        
                        // Base (Dimension)
                        trailNodes.push({ label: 'Dimensão', title: dim });

                        if (entityType === 'metas') {
                            // nothing
                        } else if (entityType === 'okrs') {
                            const meta = state.entities.metas.find(x => x.id === item.metaId);
                            if (meta) trailNodes.unshift({ label: 'Meta', title: meta.title });
                        } else if (entityType === 'macros') {
                            const okr = state.entities.okrs.find(x => x.id === item.okrId);
                            if (okr) {
                                trailNodes.unshift({ label: 'OKR', title: okr.title });
                                const meta = state.entities.metas.find(x => x.id === okr.metaId);
                                if (meta) trailNodes.unshift({ label: 'Meta', title: meta.title });
                            }
                        } else if (entityType === 'micros') {
                            const macro = state.entities.macros.find(x => x.id === item.macroId);
                            if (macro) {
                                trailNodes.unshift({ label: 'Macro Ação', title: macro.title });
                                const okr = state.entities.okrs.find(x => x.id === macro.okrId);
                                if (okr) {
                                    trailNodes.unshift({ label: 'OKR', title: okr.title });
                                    const meta = state.entities.metas.find(x => x.id === okr.metaId);
                                    if (meta) trailNodes.unshift({ label: 'Meta', title: meta.title });
                                }
                            }
                        }

                        let trailHtml = '';
                        trailNodes.forEach((node, i) => {
                            const isLast = i === trailNodes.length - 1;
                            trailHtml += `
                                <div class="relative ${!isLast ? 'pb-4' : ''}">
                                    <span class="material-symbols-outlined absolute -left-[23px] top-0 text-primary bg-background text-sm z-10" style="font-variation-settings: 'FILL' 1;">trip_origin</span>
                                    <p class="text-[9px] font-label uppercase tracking-widest text-primary mb-1">${node.label}</p>
                                    <p class="text-xs font-medium">${node.title}</p>
                                </div>
                            `;
                        });

                        html += `
                        <div class="bg-surface-container-lowest p-6 rounded-lg shadow-[0_12px_40px_rgba(27,28,26,0.02)] transition-all cursor-pointer hover:bg-surface-container-low" onclick="const p = this.querySelector('.trail-panel'); if(p){ p.classList.toggle('hidden'); p.classList.toggle('max-h-0'); }">
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="font-headline text-xl font-medium">${item.title}</h4>
                                <span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">${prog === 100 ? 'Concluído' : 'Ativo'}</span>
                            </div>
                            <div class="flex items-center gap-2 text-stone-400 text-xs mb-6">
                                <span class="material-symbols-outlined text-sm">event</span>
                                <span>No ciclo</span>
                            </div>
                            <div class="space-y-2">
                                <div class="flex justify-between text-[10px] font-label text-stone-500 uppercase">
                                    <span>Progresso</span>
                                    <span>${prog.toFixed(0)}%</span>
                                </div>
                                <div class="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div class="h-full bg-primary rounded-full transition-all" style="width: ${prog}%"></div>
                                </div>
                                ${entityType === 'okrs' && prog >= 95 ? '<div class="flex items-center gap-1 mt-2 text-amber-600 dark:text-amber-400 text-[11px] italic leading-tight">⚠️ Meta pode ter sido pouco desafiadora</div>' : ''}
                            </div>
                            <div class="trail-panel hidden overflow-hidden transition-all duration-300 max-h-0 mt-6 border-t border-outline-variant/10 pt-4">
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
                nomeDisplay.textContent = state.profile.name;
            }
        },

        onboarding: function() {
            console.log("Onboarding renderizado. Lógica de passo-a-passo no fragmento interno.");
        },

        proposito: function() {
            const state = window.sistemaVidaState;

            // Render Values (Bússola)
            const valuesContainer = document.getElementById('essentials-list');
            if (valuesContainer && state.profile && state.profile.values) {
                // If the user already finished the exercise
                valuesContainer.innerHTML = state.profile.values.map(val => 
                    `<span class="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-medium animate-in fade-in zoom-in duration-300">${val}</span>`
                ).join('');
                
                // Hide the cards and confirm buttons since we inject from state directly in real implementation
                const cardCont = document.getElementById('value-card');
                if (cardCont) cardCont.style.display = 'none';
                const confirmBtn = document.getElementById('confirm-values');
                if (confirmBtn) confirmBtn.style.display = 'none';
            }

            // Render SVG Roda da Vida Trigonometry
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
                        <input type="range" min="1" max="100" value="${data.score}" class="w-full accent-primary h-1 bg-surface-container-high rounded-full appearance-none cursor-pointer" onchange="app.updateDimensionScore('${dim}', this.value)" oninput="this.previousElementSibling.lastElementChild.textContent=this.value">
                    </div>`;
                }
                slidersContainer.innerHTML = html;
            }

            // Map text fields
            const textFields = [
                { id: 'prop-ikigai-missao', group: 'ikigai', key: 'missao' },
                { id: 'prop-ikigai-vocacao', group: 'ikigai', key: 'vocacao' },
                { id: 'prop-legacy-familia', group: 'legacyObj', key: 'familia' },
                { id: 'prop-legacy-profissao', group: 'legacyObj', key: 'profissao' },
                { id: 'prop-legacy-mundo', group: 'legacyObj', key: 'mundo' },
                { id: 'prop-vision-saude', group: 'vision', key: 'saude' },
                { id: 'prop-vision-carreira', group: 'vision', key: 'carreira' },
                { id: 'prop-vision-intelecto', group: 'vision', key: 'intelecto' },
                { id: 'prop-vision-quote', group: 'vision', key: 'quote' }
            ];

            textFields.forEach(field => {
                const el = document.getElementById(field.id);
                if (el) {
                    const val = state.profile[field.group]?.[field.key];
                    if (val && val.trim() !== "") {
                        el.textContent = val;
                        el.classList.remove('italic', 'text-on-surface-variant');
                        el.classList.add('font-medium', 'text-on-surface');
                    } else {
                        el.textContent = el.getAttribute('data-default');
                        el.classList.add('italic', 'text-on-surface-variant');
                        el.classList.remove('font-medium');
                    }
                }
            });
        }
    },

    // ------------------------------------------------------------------------
    // Reactive Actions
    // ------------------------------------------------------------------------
    completeMicroAction: function(microId) {
        const state = window.sistemaVidaState;
        const micro = state.entities.micros.find(m => m.id === microId);
        
        if (!micro || micro.completed) return;
        
        micro.completed = true;
        console.log(`✅ Micro Concluída: ${micro.title}`);

        const macro = state.entities.macros.find(m => m.id === micro.macroId);
        if (macro) {
            macro.progress += micro.weight || 10;
            const okr = state.entities.okrs.find(o => o.id === macro.okrId);
            if (okr) {
                okr.progress += (micro.weight || 10) * 0.5;
                const meta = state.entities.metas.find(m => m.id === okr.metaId);
                if (meta) {
                    meta.progress += (micro.weight || 10) * 0.2;
                    const dimension = state.dimensions[meta.dimensionName];
                    if (dimension) {
                        dimension.score = Math.min(100, dimension.score + 1);
                        if (typeof showIdentityToast === 'function') {
                            showIdentityToast(meta.dimensionName);
                        }
                    }
                }
            }
        }
        
        // Re-render active view after state mutation
        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
        app.saveState();
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

        // 1. Dados de Perfil e Propósito
        const perfilData = [
            ["Chave", "Valor"],
            ["Nome", state.profile.name || ""],
            ["Nível", state.profile.level || 1],
            ["XP", state.profile.xp || 0],
            ["Missão (Ikigai)", state.profile.ikigai?.missao || ""],
            ["Vocação (Ikigai)", state.profile.ikigai?.vocacao || ""],
            ["Valores", (state.profile.values || []).join(", ")],
            ["Legado (Família)", state.profile.legacyObj?.familia || ""],
            ["Legado (Profissão)", state.profile.legacyObj?.profissao || ""],
            ["Legado (Mundo)", state.profile.legacyObj?.mundo || ""],
            ["Visão (Saúde)", state.profile.vision?.saude || ""],
            ["Visão (Carreira)", state.profile.vision?.carreira || ""],
            ["Visão (Intelecto)", state.profile.vision?.intelecto || ""],
            ["Visão (Citação)", state.profile.vision?.quote || ""]
        ];
        const wsPerfil = XLSX.utils.aoa_to_sheet(perfilData);
        XLSX.utils.book_append_sheet(wb, wsPerfil, "Perfil e Propósito");

        // 2. Dimensões (Roda da Vida)
        const dimsData = [["Dimensão", "Score"]];
        for (const [dim, data] of Object.entries(state.dimensions)) {
            dimsData.push([dim, data.score]);
        }
        const wsDims = XLSX.utils.aoa_to_sheet(dimsData);
        XLSX.utils.book_append_sheet(wb, wsDims, "Roda da Vida");

        // 3. Score PERMA
        const permaData = [
            ["Pilar", "Score"],
            ["Positive Emotion (P)", state.perma?.P || 0],
            ["Engagement (E)", state.perma?.E || 0],
            ["Relationships (R)", state.perma?.R || 0],
            ["Meaning (M)", state.perma?.M || 0],
            ["Accomplishment (A)", state.perma?.A || 0]
        ];
        const wsPerma = XLSX.utils.aoa_to_sheet(permaData);
        XLSX.utils.book_append_sheet(wb, wsPerma, "PERMA");

        // Export
        XLSX.writeFile(wb, "SistemaVida_Dump.xlsx");
        console.log("Exportação Excel concluída com sucesso.");
    },

    importFromExcel: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("SheetJS não carregado. Verifique a conexão com a internet.");
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, {type: 'array'});
            
            // 1. Aba: Planos -> state.entities
            if (workbook.Sheets['Planos']) {
                const planosArr = XLSX.utils.sheet_to_json(workbook.Sheets['Planos']);
                window.sistemaVidaState.entities = { metas: [], okrs: [], macros: [], micros: [] };
                
                planosArr.forEach(row => {
                    let type = (row['Tipo'] || '').toLowerCase();
                    if (type.includes('meta')) type = 'metas';
                    else if (type.includes('okr')) type = 'okrs';
                    else if (type.includes('macro')) type = 'macros';
                    else if (type.includes('micro')) type = 'micros';
                    else {
                        if (row['Meta'] || row['metaId']) type = 'okrs';
                        else type = 'macros'; 
                    }

                    // Regra de Status Crítica: Progresso
                    let progressVal = row['Progresso'] || row['Progresso (G)'] || row['progress'] || 0;
                    if (typeof progressVal === 'string') {
                        progressVal = parseFloat(progressVal.replace('%', ''));
                    }
                    let numericProgress = (progressVal <= 1 && progressVal > 0) ? progressVal * 100 : (progressVal || 0);
                    let status = (numericProgress >= 100) ? 'done' : 'active';
                    
                    let obj = {
                        id: 'ent_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        title: row['Título'] || row['Nome'] || '',
                        dimension: row['Dimensão'] || row['Área'] || row['Dimension'] || 'Geral',
                        status: status,
                        progress: numericProgress
                    };

                    let context = row['Contexto / Indicador'] || row['Contexto'] || '';
                    let prazo = row['Prazo / Ciclo'] || row['Prazo'] || row['Ciclo'] || '';
                    
                    if (type === 'metas' || type === 'okrs') {
                        obj.purpose = context;
                        obj.prazo = prazo;
                    } else if (type === 'macros') {
                        obj.description = context;
                        obj.prazo = prazo;
                    } else if (type === 'micros') {
                        obj.indicator = context;
                        obj.completed = (status === 'done');
                        obj.prazo = prazo;
                    }

                    if (window.sistemaVidaState.entities[type]) {
                        window.sistemaVidaState.entities[type].push(obj);
                    }
                });
            }

            // 2. Aba: Propósito -> state.profile, state.dimensions
            if (workbook.Sheets['Propósito']) {
                const propArr = XLSX.utils.sheet_to_json(workbook.Sheets['Propósito']);
                propArr.forEach(row => {
                    let key = row['Chave'] || row['Dimensão'] || row['Propósito'] || '';
                    let val = row['Valor'] || row['Score'] || row['Nota'] || '';
                    
                    if (key) {
                        key = key.trim();
                        key = key.charAt(0).toUpperCase() + key.slice(1);
                    }

                    if (window.sistemaVidaState.dimensions[key] && !isNaN(parseFloat(val))) {
                        window.sistemaVidaState.dimensions[key].score = parseFloat(val) || 0;
                    } 
                    else if (key && typeof key === 'string') {
                        let kLow = key.toLowerCase();
                        if (kLow.includes('missão')) window.sistemaVidaState.profile.ikigai.missao = val;
                        else if (kLow.includes('vocação')) window.sistemaVidaState.profile.ikigai.vocacao = val;
                        else if (kLow.includes('valores')) window.sistemaVidaState.profile.values = typeof val === 'string' ? val.split(',').map(s=>s.trim()) : [val];
                        else if (kLow.includes('legado (família)')) window.sistemaVidaState.profile.legacyObj.familia = val;
                        else if (kLow.includes('legado (profissão)')) window.sistemaVidaState.profile.legacyObj.profissao = val;
                        else if (kLow.includes('legado (mundo)')) window.sistemaVidaState.profile.legacyObj.mundo = val;
                        else if (kLow.includes('saúde') && kLow.includes('visão')) window.sistemaVidaState.profile.vision.saude = val;
                        else if (kLow.includes('carreira') && kLow.includes('visão')) window.sistemaVidaState.profile.vision.carreira = val;
                        else if (kLow.includes('intelecto') && kLow.includes('visão')) window.sistemaVidaState.profile.vision.intelecto = val;
                        else if (kLow.includes('citação')) window.sistemaVidaState.profile.vision.quote = val;
                    }
                });
            }

            // 3. Aba: Hábitos -> state.habits
            if (workbook.Sheets['Hábitos']) {
                const habArr = XLSX.utils.sheet_to_json(workbook.Sheets['Hábitos']);
                window.sistemaVidaState.habits = [];
                habArr.forEach(row => {
                    window.sistemaVidaState.habits.push({
                        id: 'hab_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        title: row['Título'] || row['Hábito'] || '',
                        dimension: row['Dimensão'] || row['Área'] || 'Geral',
                        context: row['Contexto'] || '',
                        completed: String(row['Concluído'] || '').toLowerCase() === 'sim' || row['Concluído'] === 1 || row['Concluído'] === true
                    });
                });
            }

            // 4. Aba: Diário -> state.dailyLogs
            if (workbook.Sheets['Diário']) {
                const logArr = XLSX.utils.sheet_to_json(workbook.Sheets['Diário']);
                window.sistemaVidaState.dailyLogs = {};
                logArr.forEach(row => {
                    let dateStr = row['Data'];
                    if (typeof dateStr === 'number') {
                        const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                        dateStr = d.toISOString().split('T')[0];
                    } else if (dateStr) {
                        dateStr = String(dateStr).trim();
                    }
                    
                    if (dateStr) {
                        window.sistemaVidaState.dailyLogs[dateStr] = {
                            gratidao: row['Gratidão'] || '',
                            funcionou: row['Funcionou'] || '',
                            aprendi: row['Aprendi'] || '',
                            shutdown: [row['Shutdown 1'] || '', row['Shutdown 2'] || '', row['Shutdown 3'] || ''],
                            energy: parseFloat(row['Energia'] || row['Energy']) || 5
                        };
                    }
                });
            }

            // 5. Aba: Revisões -> state.reviews
            if (workbook.Sheets['Revisões']) {
                const revArr = XLSX.utils.sheet_to_json(workbook.Sheets['Revisões']);
                window.sistemaVidaState.reviews = {};
                revArr.forEach(row => {
                    let id = row['Data'] || row['ID'];
                    if (typeof id === 'number') {
                        const d = new Date(Math.round((id - 25569) * 86400 * 1000));
                        id = d.toISOString().split('T')[0];
                    } else if (!id) {
                        id = new Date().toISOString();
                    } else {
                        id = String(id).trim();
                    }

                    window.sistemaVidaState.reviews[id] = {
                        q1: row['Q1'] || row['1. Resumo'] || '',
                        q2: row['Q2'] || row['2. Vitórias'] || '',
                        q3: row['Q3'] || row['3. Desafios'] || '',
                        q4: row['Q4'] || row['4. Foco'] || '',
                        q5: row['Q5'] || row['5. Ajustes'] || ''
                    };
                });
            }

            // Finalização do Fluxo
            await window.app.saveState();
            alert('Dados importados com sucesso!');
            window.app.navigate('painel');
            
        } catch (error) {
            console.error("Erro na importação:", error);
            alert("Ocorreu um erro ao importar a planilha. Verifique o arquivo e tente novamente.");
        }
        
        // Reset para permitir nova importação do mesmo arquivo
        event.target.value = '';
    },

    updateNavUI: function(activeView) {
        document.querySelectorAll('nav .nav-item-link').forEach(link => {
            link.classList.remove('text-[#01696f]', 'dark:text-[#01696f]');
            link.classList.add('text-stone-400', 'dark:text-stone-500');
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.style.fontVariationSettings = "'FILL' 0";

            if (link.getAttribute('data-view') === activeView) {
                 link.classList.add('text-[#01696f]', 'dark:text-[#01696f]');
                 link.classList.remove('text-stone-400', 'dark:text-stone-500');
                 if (icon) icon.style.fontVariationSettings = "'FILL' 1";
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
    }
};

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
