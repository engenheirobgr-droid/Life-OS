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
        legacy: ""
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
    entities: { metas: [], okrs: [], macros: [], micros: [] }
};

const app = {
    config: {
        containerId: 'app-content',
        viewsPath: 'views/',
    },
    currentView: '',
    planosFilter: 'Todas',

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
        this.navigate('hoje');
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
                            </div>
                            <div class="trail-panel hidden overflow-hidden transition-all duration-300 max-h-0 mt-6 border-t border-outline-variant/10 pt-4">
                                <div class="relative pl-6 space-y-4">
                                    <div class="absolute left-[7px] top-2 bottom-2 w-px bg-primary/10"></div>
                                    <div class="relative">
                                        <span class="material-symbols-outlined absolute -left-[23px] top-0 text-primary bg-background text-sm" style="font-variation-settings: 'FILL' 1;">trip_origin</span>
                                        <p class="text-[9px] font-label uppercase tracking-widest text-primary mb-1">Rastreabilidade</p>
                                        <p class="text-xs font-medium">Vinculado à Dimensão ${dim}</p>
                                    </div>
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
