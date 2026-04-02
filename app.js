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
        name: "Bruno",
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
    reviews: {},
    cycleStartDate: new Date(new Date().setDate(new Date().getDate() - 21)).toISOString()
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

    showNotification: function(msg) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-surface-container-lowest border-l-4 border-primary text-on-surface px-6 py-4 rounded shadow-2xl z-[100] text-sm font-medium transition-all transform translate-y-0 opacity-100 flex items-center gap-3';
        toast.innerHTML = `<span class="material-symbols-outlined text-primary">notifications_active</span> ${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('-translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    checkAlerts: function() {
        const state = window.sistemaVidaState;
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // 1. Inatividade / Boas-vindas
        if (state.lastAccess) {
            const diffDays = Math.floor((today - new Date(state.lastAccess)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 2) {
                setTimeout(() => this.showNotification("Bom ter você de volta à sua jornada!"), 1000);
            }
        }
        state.lastAccess = todayStr;
        this.saveState();

        // 2. Alerta de Revisão Semanal (Segunda-feira)
        this.needsReview = false;
        if (today.getDay() === 1) { 
            const reviews = Object.keys(state.reviews || {});
            const hasRecent = reviews.some(dateStr => {
                const diff = (today - new Date(dateStr)) / (1000 * 60 * 60 * 24);
                return diff <= 3;
            });
            this.needsReview = !hasRecent;
        }
    },

    switchPlanosTab: function(tabId) {
        // Esconde todos os conteúdos
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        // Mostra o selecionado
        const targetContent = document.getElementById('tab-' + tabId);
        if (targetContent) targetContent.classList.add('active');
        
        // Remove estado ativo dos botões
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('text-primary'));
        // Adiciona estado ativo no botão clicado
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('text-primary');
    },

    init: async function() {
        console.log("Sistema Vida OS inicializando...");
        await this.loadState();
        this.checkAlerts();
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

    openCreateModal: function(type = 'metas') {
        this.editingEntity = null; // Limpa estado de edição
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = 'Novo Item';

        document.getElementById('crud-type').value = type;
        this.onTypeChange(type);
        document.getElementById('crud-modal').classList.remove('hidden');
        document.getElementById('crud-title').focus();
    },

    onTypeChange: function(type) {
        const triggerContainer = document.getElementById('crud-trigger-container');
        if (triggerContainer) triggerContainer.style.display = (type === 'habits' ? 'flex' : 'none');
        
        // Controle de visibilidade do seletor de Pai
        const parentField = document.getElementById('create-parent')?.parentElement;
        if (parentField) {
            parentField.style.display = (type === 'metas' || type === 'habits' ? 'none' : 'flex');
        }

        this.updateParentList(type);
    },

    updateParentList: function(type) {
        const parentSelect = document.getElementById('create-parent');
        if (!parentSelect) return;

        parentSelect.innerHTML = '<option value="">Sem vínculo</option>';
        let parentType = '';
        if (type === 'micros') parentType = 'macros';
        else if (type === 'macros') parentType = 'okrs';
        else if (type === 'okrs') parentType = 'metas';

        const state = window.sistemaVidaState;
        if (parentType && state.entities[parentType]) {
            state.entities[parentType].forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                parentSelect.appendChild(opt);
            });
        }
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

    openPermaModal: function() {
        if (!window.sistemaVidaState.perma) window.sistemaVidaState.perma = {P:85, E:70, R:92, M:60, A:75};
        document.getElementById('p-slider').value = window.sistemaVidaState.perma.P;
        document.getElementById('val-p').textContent = window.sistemaVidaState.perma.P;
        document.getElementById('e-slider').value = window.sistemaVidaState.perma.E;
        document.getElementById('val-e').textContent = window.sistemaVidaState.perma.E;
        document.getElementById('r-slider').value = window.sistemaVidaState.perma.R;
        document.getElementById('val-r').textContent = window.sistemaVidaState.perma.R;
        document.getElementById('m-slider').value = window.sistemaVidaState.perma.M;
        document.getElementById('val-m').textContent = window.sistemaVidaState.perma.M;
        document.getElementById('a-slider').value = window.sistemaVidaState.perma.A;
        document.getElementById('val-a').textContent = window.sistemaVidaState.perma.A;
        document.getElementById('perma-modal').classList.remove('hidden');
        document.getElementById('perma-modal').classList.add('flex');
    },

    closePermaModal: function() {
        document.getElementById('perma-modal').classList.add('hidden');
        document.getElementById('perma-modal').classList.remove('flex');
    },

    savePerma: function() {
        window.sistemaVidaState.perma = {
            P: parseInt(document.getElementById('p-slider').value),
            E: parseInt(document.getElementById('e-slider').value),
            R: parseInt(document.getElementById('r-slider').value),
            M: parseInt(document.getElementById('m-slider').value),
            A: parseInt(document.getElementById('a-slider').value)
        };
        this.saveState();
        this.closePermaModal();
        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
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

    factoryReset: async function() {
        const confirm1 = confirm("⚠️ ATENÇÃO EXTREMA ⚠️\n\nIsso apagará TODOS os seus dados salvos na nuvem (Metas, OKRs, Diários, Roda da Vida). Essa ação NÃO pode ser desfeita.\n\nTem certeza absoluta?");
        if (!confirm1) return;

        const confirm2 = prompt("Para confirmar a exclusão total, digite a palavra: ZERAR");
        if (confirm2 !== "ZERAR") {
            alert("Reset cancelado. Seus dados estão seguros.");
            return;
        }

        // Sobrescreve o estado global com a estrutura virgem
        window.sistemaVidaState = {
            profile: { 
                name: "Viajante", level: 1, xp: 0, values: [], legacy: "", 
                ikigai: { missao: "", vocacao: "", paixao: "", profissao: "" }, 
                legacyObj: { familia: "", profissao: "", mundo: "" } 
            },
            dimensions: {
                'Saúde': { score: 1 }, 'Mente': { score: 1 }, 'Carreira': { score: 1 }, 'Finanças': { score: 1 },
                'Relacionamentos': { score: 1 }, 'Família': { score: 1 }, 'Lazer': { score: 1 }, 'Propósito': { score: 1 }
            },
            perma: { P: 50, E: 50, R: 50, M: 50, A: 50 },
            entities: { metas: [], okrs: [], macros: [], micros: [] },
            dailyLogs: {},
            habits: [],
            reviews: {},
            onboardingComplete: false
        };

        // Salva no Firestore (sobrescrevendo o documento antigo) e limpa cache local
        try {
            await this.saveState();
            localStorage.clear();
            alert("Sistema Vida resetado com sucesso. Reiniciando...");
            window.location.reload(); // Força o recarregamento da página para puxar o Onboarding
        } catch (error) {
            console.error("Erro ao resetar o sistema:", error);
            alert("Houve um erro ao tentar apagar os dados da nuvem.");
        }
    },

    openQuarterlyModal: function() {
        const state = window.sistemaVidaState;
        const listContainer = document.getElementById('quarterly-okrs-list');
        if (!listContainer) return;
        
        const activeOkrs = state.entities.okrs.filter(o => o.status === 'active');
        
        if (activeOkrs.length === 0) {
            listContainer.innerHTML = '<p class="text-sm text-outline italic text-center py-8">Nenhum OKR ativo no momento.</p>';
        } else {
            let html = '';
            activeOkrs.forEach(okr => {
                html += `
                <div class="bg-surface-container-low p-4 rounded-lg border border-outline-variant/20" data-okr-id="${okr.id}">
                    <p class="text-sm font-medium mb-3">${okr.title}</p>
                    <div class="flex flex-col gap-2">
                        <label class="flex items-center gap-2 text-xs cursor-pointer"><input type="radio" name="action_${okr.id}" value="continuar" checked class="accent-primary"> Continuar no próximo ciclo</label>
                        <label class="flex items-center gap-2 text-xs cursor-pointer"><input type="radio" name="action_${okr.id}" value="concluir" class="accent-primary"> Marcar como Concluído</label>
                        <label class="flex items-center gap-2 text-xs cursor-pointer text-error"><input type="radio" name="action_${okr.id}" value="arquivar" class="accent-error"> Arquivar / Abandonar</label>
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

    processQuarterlyReview: function() {
        const state = window.sistemaVidaState;
        const items = document.querySelectorAll('#quarterly-okrs-list > div[data-okr-id]');
        
        items.forEach(item => {
            const id = item.getAttribute('data-okr-id');
            const action = item.querySelector(`input[name="action_${id}"]:checked`).value;
            const okr = state.entities.okrs.find(o => o.id === id);
            
            if (okr) {
                if (action === 'concluir') {
                    okr.status = 'done';
                    okr.progress = 100;
                } else if (action === 'arquivar') {
                    okr.status = 'abandoned';
                }
            }
        });
        
        this.saveState();
        this.closeQuarterlyModal();
        this.showNotification("Ciclo atualizado! Seus OKRs foram processados.");
        if (this.render.painel) this.render.painel();
        if (this.render.planos) this.render.planos();
    },

    resetWheelOfLife: function() {
        const confirmReset = confirm("Isto iniciará um novo ciclo da Roda da Vida, zerando as notas atuais para reavaliação. Deseja continuar?");
        if (confirmReset) {
            const state = window.sistemaVidaState;
            // Salva snapshot (simplificado para histórico)
            if (!state.history) state.history = {};
            state.history['roda_' + Date.now()] = JSON.parse(JSON.stringify(state.dimensions));
            
            // Zera as notas
            for (const dim in state.dimensions) {
                state.dimensions[dim].score = 1; 
            }
            
            this.saveState();
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
        const title = document.getElementById('crud-title').value;
        const type = document.getElementById('crud-type').value;
        const dimension = document.getElementById('crud-dimension').value;
        const context = document.getElementById('crud-context').value;
        const trigger = (type === 'habits' && document.getElementById('crud-trigger')) ? document.getElementById('crud-trigger').value.trim() : '';
        const prazo = document.getElementById('create-prazo') ? document.getElementById('create-prazo').value : '';
        const parentId = document.getElementById('create-parent') ? document.getElementById('create-parent').value : '';

        const isEditing = !!this.editingEntity;
        const id = isEditing ? this.editingEntity.id : 'ent_' + Date.now();
        const obj = { id, title, dimension, prazo };

        const getOldItem = (eid, etype) => {
            const state = window.sistemaVidaState;
            const list = etype === 'habits' ? state.habits : state.entities[etype];
            return (list || []).find(e => e.id === eid) || {};
        };

        if (type === 'metas' || type === 'okrs') {
            obj.purpose = context;
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (type === 'okrs' && parentId) obj.metaId = parentId;
        } else if (type === 'macros') {
            obj.description = context;
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (parentId) {
                obj.okrId = parentId;
                const okr = window.sistemaVidaState.entities.okrs.find(o => o.id === parentId);
                if (okr) obj.metaId = okr.metaId;
            }
        } else if (type === 'micros') {
            obj.indicator = context;
            const oldItem = getOldItem(id, 'micros');
            obj.status = isEditing ? (oldItem.status || 'pending') : 'pending';
            obj.completed = obj.status === 'done';
            obj.progress = obj.completed ? 100 : 0;
            
            if (parentId) {
                const macro = window.sistemaVidaState.entities.macros.find(m => m.id === parentId);
                if (macro) {
                    obj.macroId = macro.id;
                    obj.okrId = macro.okrId;
                    obj.metaId = macro.metaId;
                }
            }
        } else if (type === 'habits') {
            obj.context = context;
            obj.completed = isEditing ? (getOldItem(id, 'habits').completed || false) : false;
            if (trigger) obj.trigger = trigger;
        }

        if (isEditing) {
            const list = type === 'habits' ? window.sistemaVidaState.habits : window.sistemaVidaState.entities[type];
            const idx = list.findIndex(e => e.id === id);
            if (idx !== -1) list[idx] = obj;
            
            // Re-calcula cascata se necessário após edição
            if (['micros', 'macros', 'okrs'].includes(type)) {
                this.updateCascadeProgress(id, type);
            }
        } else {
            if (type === 'habits') {
                if (!window.sistemaVidaState.habits) window.sistemaVidaState.habits = [];
                window.sistemaVidaState.habits.push(obj);
            } else {
                if (!window.sistemaVidaState.entities[type]) {
                    window.sistemaVidaState.entities[type] = [];
                }
                window.sistemaVidaState.entities[type].push(obj);
            }
        }

        this.editingEntity = null;
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
                    if (scoreText) scoreText.textContent = `Score PERMA: ${avg}`;
                }
            }
            const rb = document.getElementById('review-banner'); if (rb) { rb.style.display = app.needsReview ? 'flex' : 'none'; rb.classList.remove('hidden'); }

            // Tarefa 1: Tempo de Ciclo Dinâmico
            const diff = new Date() - new Date(state.cycleStartDate);
            const week = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7));
            const cyclePercent = Math.min(100, Math.max(0, (week / 12) * 100)); // Base 12 semanas
            
            const weekText = document.getElementById('cycle-week-text');
            const cycleBar = document.getElementById('cycle-progress-bar');
            const cycleVal = document.getElementById('cycle-percent-val');
            
            if (weekText) weekText.textContent = `Semana ${week} de 12`;
            if (cycleBar) cycleBar.style.width = cyclePercent + '%';
            if (cycleVal) cycleVal.textContent = Math.round(cyclePercent) + '%';

            // Tarefa 3: Distribuição de Foco
            const focusContainer = document.getElementById('focus-distribution');
            if (focusContainer) {
                const counts = {};
                (state.entities.micros || []).forEach(m => {
                    counts[m.dimension] = (counts[m.dimension] || 0) + 1;
                });
                
                const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
                let focusHtml = '';
                
                // Dimensões padrão para garantir ordem
                ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'].forEach(dim => {
                    const count = counts[dim] || 0;
                    const pct = (count / total) * 100;
                    focusHtml += `
                    <div class="space-y-1">
                        <div class="flex justify-between text-[10px] uppercase tracking-wider font-bold text-outline">
                            <span>${dim}</span>
                            <span>${count} ações</span>
                        </div>
                        <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
                });
                focusContainer.innerHTML = focusHtml;
            }

            // Tarefa 5: Ativar Filtros Temporais
            const filterBtns = document.querySelectorAll('header .flex.gap-2 button');
            const painelTitle = document.getElementById('painel-title');
            
            filterBtns.forEach(btn => {
                btn.onclick = () => {
                    filterBtns.forEach(b => b.className = "px-5 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-container-highest transition-colors");
                    btn.className = "px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-medium transition-transform active:scale-95";
                    if (painelTitle) painelTitle.textContent = `Progresso ${btn.textContent}`;
                };
            });

            this.renderAnnualHeatmap();
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

            const heatmapEl = document.getElementById('weekly-heatmap');
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
                        inner = `<span class="material-symbols-outlined text-white text-[12px]" style="font-variation-settings: 'wght' 700;">check</span>`;
                    } else if (isToday) {
                        circleClass = 'w-7 h-7 rounded-full bg-surface-container-lowest border-2 border-outline-variant/30 ring-2 ring-[#01696f]/40';
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
                heatmapEl.className = 'flex justify-between px-2';
            }
            
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
            const todayStr = new Date().toISOString().split('T')[0];
            
            // Filtro aplicado: Pendentes e Prazo <= Hoje (ou sem prazo)
            const todayMicros = (state.entities.micros || []).filter(m => 
                (m.status !== 'done' && (!m.prazo || m.prazo <= todayStr))
            );

            todayMicros.forEach((micro, idx) => {
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
                    
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = micro.prazo && micro.prazo < todayStr;
                    const overdueTag = isOverdue ? '<span class="inline-block mt-1 ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Atrasada</span>' : '';

                    html += `
                    <div class="space-y-2">
                        <div class="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                            <div class="flex-1">
                                <p class="text-base text-on-surface font-medium">${micro.title}</p>
                                <span class="inline-block mt-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded-full area-tag">${micro.dimension}</span>${overdueTag}
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
                        let visualProg = prog;
                        
                        let trailNodes = [];
                        
                        // Base (Dimension)
                        trailNodes.push({ label: 'Dimensão', title: dim });

                        if (entityType === 'metas') {
                            // metas are self-contained
                        } else if (entityType === 'okrs') {
                            const meta = state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.unshift({ label: 'Meta', title: meta ? meta.title : 'Não vinculado' });
                        } else if (entityType === 'macros') {
                            const okr = state.entities.okrs.find(x => x.id === item.okrId);
                            if (okr) {
                                trailNodes.unshift({ label: 'OKR', title: okr.title });
                                const meta = state.entities.metas.find(x => x.id === okr.metaId);
                                trailNodes.unshift({ label: 'Meta', title: meta ? meta.title : 'Não vinculado' });
                            } else {
                                trailNodes.unshift({ label: 'OKR', title: 'Não vinculado' });
                            }
                        } else if (entityType === 'micros') {
                            const macro = state.entities.macros.find(x => x.id === item.macroId);
                            if (macro) {
                                trailNodes.unshift({ label: 'Macro Ação', title: macro.title });
                                const okr = state.entities.okrs.find(x => x.id === macro.okrId);
                                if (okr) {
                                    trailNodes.unshift({ label: 'OKR', title: okr.title });
                                    const meta = state.entities.metas.find(x => x.id === okr.metaId);
                                    trailNodes.unshift({ label: 'Meta', title: meta ? meta.title : 'Não vinculado' });
                                } else {
                                    trailNodes.unshift({ label: 'OKR', title: 'Não vinculado' });
                                }
                            } else {
                                trailNodes.unshift({ label: 'Macro Ação', title: 'Não vinculado' });
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
                        <div class="bg-surface-container-lowest p-6 rounded-lg shadow-[0_12px_40px_rgba(27,28,26,0.02)] transition-all cursor-pointer hover:bg-surface-container-low group" onclick="const p = this.querySelector('.trail-panel'); if(p){ p.classList.toggle('hidden'); p.classList.toggle('max-h-0'); }">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex flex-col gap-1">
                                    <h4 class="font-headline text-xl font-medium">${item.title}</h4>
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="event.stopPropagation(); app.editEntity('${item.id}', '${entityType}')" class="p-1 px-2 border border-outline-variant hover:bg-primary-container/20 rounded flex items-center gap-1 text-[10px] font-bold text-outline hover:text-primary transition-colors">
                                            <span class="material-symbols-outlined text-[14px]">edit</span> Editar
                                        </button>
                                        <button onclick="event.stopPropagation(); app.deleteEntity('${item.id}', '${entityType}')" class="p-1 px-2 border border-outline-variant hover:bg-error-container/20 rounded flex items-center gap-1 text-[10px] font-bold text-outline hover:text-error transition-colors">
                                            <span class="material-symbols-outlined text-[14px]">delete</span> Excluir
                                        </button>
                                    </div>
                                </div>
                                <span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">${prog >= 100 ? 'Concluído' : 'Ativo'}</span>
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
                                    <div class="h-full bg-primary rounded-full transition-all" style="width: ${visualProg}%"></div>
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

            // Update PERMA progress bars and text
            if (state.perma) {
                const mapId = { P: 'p', E: 'e', R: 'r', M: 'm', A: 'a' };
                for (const [key, val] of Object.entries(state.perma)) {
                    const txt = document.getElementById('perma-text-' + mapId[key]);
                    const bar = document.getElementById('perma-bar-' + mapId[key]);
                    if (txt) txt.textContent = val + '%';
                    if (bar) bar.style.width = val + '%';
                }
            }
        }
    },

    updateCascadeProgress: function(entityId, type) {
        const state = window.sistemaVidaState;
        
        if (type === 'micros') {
            const micro = state.entities.micros.find(m => m.id === entityId);
            if (micro && micro.macroId) {
                const siblings = state.entities.micros.filter(m => m.macroId === micro.macroId);
                const avg = siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length;
                const macro = state.entities.macros.find(m => m.id === micro.macroId);
                if (macro) {
                    macro.progress = Math.round(avg);
                    this.updateCascadeProgress(macro.id, 'macros');
                }
            }
        } else if (type === 'macros') {
            const macro = state.entities.macros.find(m => m.id === entityId);
            if (macro && macro.okrId) {
                const siblings = state.entities.macros.filter(m => m.okrId === macro.okrId);
                const avg = siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length;
                const okr = state.entities.okrs.find(o => o.id === macro.okrId);
                if (okr) {
                    okr.progress = Math.round(avg);
                    this.updateCascadeProgress(okr.id, 'okrs');
                }
            }
        } else if (type === 'okrs') {
            const okr = state.entities.okrs.find(o => o.id === entityId);
            if (okr && okr.metaId) {
                const siblings = state.entities.okrs.filter(o => o.metaId === okr.metaId);
                const avg = siblings.reduce((acc, curr) => acc + (curr.progress || 0), 0) / siblings.length;
                const meta = state.entities.metas.find(m => m.id === okr.metaId);
                if (meta) {
                    meta.progress = Math.round(avg);
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
                            state.perma.A = Math.min(100, state.perma.A + 5); 
                        }
                        const metaLocal = state.entities.metas.find(m => m.id === okr.metaId);
                        if (metaLocal && state.dimensions[metaLocal.dimensionName]) {
                            state.dimensions[metaLocal.dimensionName].score = Math.min(100, state.dimensions[metaLocal.dimensionName].score + 5);
                        }
                        if (this.showNotification) this.showNotification("🎯 OKR atingiu 70% (Alvo Ideal). Bônus de realização aplicado!");
                    }
                }
            }
        }
        
        this.saveState();
        if (this.render.hoje) this.render.hoje();
        if (this.render.planos) this.render.planos();
    },

    deleteEntity: function(id, type) {
        if (confirm('Deseja realmente excluir este item? Esta ação não pode ser desfeita.')) {
            const state = window.sistemaVidaState;
            state.entities[type] = state.entities[type].filter(e => e.id !== id);
            this.saveState();
            if (this.render.planos) this.render.planos();
            if (this.render.hoje) this.render.hoje();
        }
    },

    editEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const item = state.entities[type].find(e => e.id === id);
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
        document.getElementById('crud-context').value = item.purpose || item.description || item.indicator || '';
        
        if (type === 'habits') {
            document.getElementById('crud-trigger').value = item.trigger || '';
        }

        this.onTypeChange(type);
        
        // Seta o pai após popular a lista
        const parentSelect = document.getElementById('create-parent');
        if (parentSelect) {
            const parentId = item.metaId || item.okrId || item.macroId || '';
            parentSelect.value = parentId;
        }
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
                    
                    let obj = {
                        id: 'ent_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        title: getValue(row, ['Título', 'Nome', 'Tarefa', 'Title']),
                        dimension: getValue(row, ['Dimensão', 'Área', 'Dimension', 'Area']) || 'Geral',
                        status: status,
                        progress: Math.min(100, Math.max(0, numericProgress))
                    };

                    let context = getValue(row, ['Contexto / Indicador', 'Contexto', 'Notes', 'Descrição']);
                    let prazo = getValue(row, ['Prazo / Ciclo', 'Prazo', 'Ciclo', 'Deadline', 'Data']);
                    
                    if (type === 'metas' || type === 'okrs') { obj.purpose = context; obj.prazo = prazo; }
                    else if (type === 'macros') { obj.description = context; obj.prazo = prazo; }
                    else if (type === 'micros') { obj.indicator = context; obj.completed = (status === 'done'); obj.prazo = prazo; }

                    if (window.sistemaVidaState.entities[type]) {
                        window.sistemaVidaState.entities[type].push(obj);
                    }
                });
            }

            // 2. Aba: Propósito -> state.profile, state.dimensions
            const wsProp = workbook.Sheets['Propósito'] || workbook.Sheets['Proposito'] || workbook.Sheets['Identidade'];
            if (wsProp) {
                // Safe checks para garantir a estrutura aninhada antes de popular
                if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
                if (!window.sistemaVidaState.profile.ikigai) window.sistemaVidaState.profile.ikigai = {};
                if (!window.sistemaVidaState.profile.legacyObj) window.sistemaVidaState.profile.legacyObj = {};
                if (!window.sistemaVidaState.profile.vision) window.sistemaVidaState.profile.vision = {};

                const propArr = XLSX.utils.sheet_to_json(wsProp);
                propArr.forEach(row => {
                    let key = String(getValue(row, ['Chave', 'Dimensão', 'Propósito', 'Item', 'Key'])).trim();
                    let val = getValue(row, ['Valor', 'Score', 'Nota', 'Value']);
                    
                    if (!key) return;
                    key = key.charAt(0).toUpperCase() + key.slice(1);

                    if (window.sistemaVidaState.dimensions[key] && !isNaN(parseFloat(val))) {
                        window.sistemaVidaState.dimensions[key].score = parseFloat(val) || 0;
                    } else {
                        let kLow = key.toLowerCase();
                        if (kLow.includes('missão')) window.sistemaVidaState.profile.ikigai.missao = val;
                        else if (kLow.includes('vocação')) window.sistemaVidaState.profile.ikigai.vocacao = val;
                        else if (kLow.includes('valores')) window.sistemaVidaState.profile.values = typeof val === 'string' ? val.split(/[,\n]/).map(s=>s.trim()) : [val];
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
            const wsHabits = workbook.Sheets['Hábitos'] || workbook.Sheets['Habitos'] || workbook.Sheets['Habits'];
            if (wsHabits) {
                const habArr = XLSX.utils.sheet_to_json(wsHabits);
                window.sistemaVidaState.habits = [];
                habArr.forEach(row => {
                    const title = getValue(row, ['Título', 'Hábito', 'Habit', 'Task']);
                    if (title) {
                        window.sistemaVidaState.habits.push({
                            id: 'hab_' + Date.now() + Math.random().toString(36).substr(2, 9),
                            title: title,
                            dimension: getValue(row, ['Dimensão', 'Área', 'Dimension', 'Area']) || 'Geral',
                            context: getValue(row, ['Contexto', 'Gatilho', 'Trigger']) || '',
                            completed: String(getValue(row, ['Concluído', 'Status']) || '').toLowerCase() === 'sim' || getValue(row, ['Concluído']) === 1 || !!getValue(row, ['Concluído'])
                        });
                    }
                });
            }

            // 4. Aba: Diário -> state.dailyLogs
            const wsDiario = workbook.Sheets['Diário'] || workbook.Sheets['Diario'] || workbook.Sheets['Logs'];
            if (wsDiario) {
                const logArr = XLSX.utils.sheet_to_json(wsDiario);
                window.sistemaVidaState.dailyLogs = window.sistemaVidaState.dailyLogs || {};
                logArr.forEach(row => {
                    let dateRaw = getValue(row, ['Data', 'Date', 'Dia']);
                    let dateStr = "";
                    if (typeof dateRaw === 'number') {
                        const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                        dateStr = d.toISOString().split('T')[0];
                    } else if (dateRaw) {
                        dateStr = String(dateRaw).trim();
                    }
                    
                    if (dateStr && dateStr.length >= 10) {
                        window.sistemaVidaState.dailyLogs[dateStr.substring(0,10)] = {
                            gratidao: getValue(row, ['Gratidão', 'Gratidao', 'Grato']),
                            funcionou: getValue(row, ['Funcionou', 'Vitorias', 'Wins']),
                            aprendi: getValue(row, ['Aprendi', 'Lessons', 'Aprendizado']),
                            shutdown: [getValue(row, ['Shutdown 1', 'S1']), getValue(row, ['Shutdown 2', 'S2']), getValue(row, ['Shutdown 3', 'S3'])],
                            energy: parseFloat(getValue(row, ['Energia', 'Energy', 'Power'])) || 5
                        };
                    }
                });
            }

            // Finalização do Fluxo
            await window.app.saveState();
            alert('Dados importados com sucesso!');
            window.app.navigate('painel');
            
        } catch (error) {
            console.error("Erro detalhado na importação:", error);
            alert(`Erro na importação: ${error.message || "Formato de arquivo incompatível"}.\n\nVerifique se o Excel possui as abas: Planos, Propósito, Hábitos, Diário.`);
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
