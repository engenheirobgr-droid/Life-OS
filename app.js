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
        ikigai: { missao: "", vocacao: "", love: "", good: "", need: "", paid: "", sintese: "" },
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
    planosStatusFilter: 'active',
    planosHierarchyType: '',
    planosHierarchyId: '',
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
                const cloudData = docSnap.data();
                
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
                
                window.sistemaVidaState = mergeDeep(window.sistemaVidaState, cloudData);
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
        
        if (!state.purposeStartDate) state.purposeStartDate = todayStr;
        if (!state.cycleStartDate) state.cycleStartDate = todayStr;
        
        if (state.lastAccess) {
            const diffDays = Math.floor((today - new Date(state.lastAccess)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 2) setTimeout(() => this.showNotification("Bom ter você de volta à sua jornada!"), 1000);
        }
        state.lastAccess = todayStr;
        this.saveState();

        this.needsReview = false;
        if (today.getDay() === 0) { // Domingo
            const reviews = Object.keys(state.reviews || {});
            const hasRecent = reviews.some(dateStr => (today - new Date(dateStr)) / (1000 * 60 * 60 * 24) <= 3);
            this.needsReview = !hasRecent;
            if (this.needsReview) setTimeout(() => this.showNotification("📅 É Domingo! Dia de planear a semana e rever as suas ações."), 2500);
        }

        const diffDaysCycle = Math.floor((today - new Date(state.cycleStartDate)) / (1000 * 60 * 60 * 24));
        if (diffDaysCycle >= 84) setTimeout(() => this.showNotification("🔄 Ciclo concluído! Reavalie a Roda da Vida e o PERMA na aba Propósito."), 4000);

        const diffDaysPurpose = Math.floor((today - new Date(state.purposeStartDate)) / (1000 * 60 * 60 * 24));
        if (diffDaysPurpose >= 365 && diffDaysPurpose % 365 === 0) setTimeout(() => this.showNotification("🌟 1 ano de jornada! Hora da revisão profunda do seu Propósito e Ikigai."), 5500);
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
            this.switchView('onboarding');
        } else {
            this.switchView('hoje');
        }

        // Tarefa 2: Filtro Inteligente - Listener de Dimensão
        const dimSelect = document.getElementById('crud-dimension');
        if (dimSelect) {
            dimSelect.addEventListener('change', () => {
                const typeSelect = document.getElementById('crud-type');
                if (typeSelect) this.updateParentList(typeSelect.value);
            });
        }
    },

    switchView: async function(viewName) {
        if (!viewName) return;
        this.currentView = viewName;
        this.updateNavUI(viewName);
        
        const container = document.getElementById(this.config.containerId);
        if (container) {
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.2s ease-in-out';
        }

        try {
            const response = await fetch(`${this.config.viewsPath}${viewName}.html`);
            const html = response.ok ? await response.text() : this.getFallbackTemplate(viewName);
            
            setTimeout(() => {
                if (container) {
                    container.innerHTML = html;
                    container.style.opacity = '1';
                    this.executeInjectedScripts(container);
                }
                if (this.render[viewName]) {
                    this.render[viewName]();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 200);
        } catch (error) {
            console.warn(`Erro ao carregar a view '${viewName}':`, error);
            if (container) {
                container.innerHTML = this.getFallbackTemplate(viewName);
                container.style.opacity = '1';
            }
        }
    },

    // Alias para compatibilidade com as chamadas do index.html
    navigate: function(viewName) {
        this.switchView(viewName);
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
        const logs = state.habitsLog || [];
        
        // Sort by date desc
        const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedLogs.length === 0) {
            list.innerHTML = '<li class="text-center py-12 text-outline italic">Nenhum registro encontrado.</li>';
        } else {
            list.innerHTML = sortedLogs.map(log => {
                const dateObj = new Date(log.date);
                const dateStr = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
                const moodColor = log.mood >= 8 ? 'text-green-600' : log.mood >= 5 ? 'text-yellow-600' : 'text-red-600';
                
                return `
                    <li class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 shadow-sm flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="text-center min-w-[50px]">
                                <span class="block text-lg font-bold text-primary leading-tight">${dateStr.split(' ')[0]}</span>
                                <span class="block text-[10px] uppercase font-bold text-outline">${dateStr.split(' ')[1]}</span>
                            </div>
                            <div class="h-8 w-px bg-outline-variant/20"></div>
                            <div>
                                <p class="text-sm font-medium text-on-surface italic">"${log.focus || 'Sem foco definido'}"</p>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[10px] uppercase font-bold text-outline">Humor:</span>
                                    <span class="text-xs font-bold ${moodColor}">${log.mood}/10</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="material-symbols-outlined text-primary/40">history_edu</span>
                            <span class="text-[9px] text-outline mt-1">${log.energy}% Energia</span>
                        </div>
                    </li>
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

    setPlanosFilter: function(dim) {
        this.planosFilter = dim;
        if (this.render.planos) this.render.planos();
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
        const parentGroup = document.getElementById('parent-group');
        const triggerGroup = document.getElementById('trigger-group');
        const contextLabel = document.getElementById('crud-context-label');
        
        // Configura labels e visibilidade baseado no tipo
        if (type === 'habits') {
            if (parentGroup) parentGroup.classList.add('hidden');
            if (triggerGroup) triggerGroup.classList.remove('hidden');
            if (contextLabel) contextLabel.textContent = 'Gatilho de Execução';
        } else if (type === 'metas') {
            if (parentGroup) parentGroup.classList.add('hidden');
            if (triggerGroup) triggerGroup.classList.add('hidden');
            if (contextLabel) contextLabel.textContent = 'Por que esta meta? (Propósito)';
        } else {
            // OKRs, Macros, Micros
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (triggerGroup) triggerGroup.classList.add('hidden');
            if (contextLabel) contextLabel.textContent = 'Contexto / Indicador de Sucesso';
            this.updateParentList(type);
        }
    },

    onParentChange: function(parentId) {
        const typeSelect = document.getElementById('crud-type');
        const dimSelect = document.getElementById('crud-dimension');
        if (!typeSelect || !dimSelect || !parentId) return;

        const type = typeSelect.value;
        let parentType = '';
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
        if (!parentSelect) return;
        
        const currentDim = dimSelect ? dimSelect.value : null;
        parentSelect.innerHTML = '<option value="">Sem vínculo (Mestre)</option>';
        
        let parentType = '';
        if (type === 'okrs') parentType = 'metas';
        if (type === 'macros') parentType = 'okrs';
        if (type === 'micros') parentType = 'macros';
        
        if (parentType && window.sistemaVidaState.entities[parentType]) {
            // Filtragem por contexto (Dimensão)
            const parents = window.sistemaVidaState.entities[parentType].filter(p => {
                return !currentDim || currentDim === 'Geral' || p.dimension === currentDim || p.dimension === 'Geral';
            });

            parents.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `[${p.dimension}] ${p.title}`;
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
        if (this.currentTextGroup && this.currentTextKey) {
            if (!window.sistemaVidaState.profile[this.currentTextGroup]) {
                window.sistemaVidaState.profile[this.currentTextGroup] = {};
            }
            window.sistemaVidaState.profile[this.currentTextGroup][this.currentTextKey] = val;
            this.saveState();
            this.closeTextModal();
            if (this.currentView === 'proposito' && this.render.proposito) {
                this.render.proposito();
            }
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
                ikigai: { missao: "", vocacao: "", paixao: "", profissao: "", sintese: "" }, 
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
                    okr.status = 'done'; okr.progress = 100;
                    this.cascadeStatusDown(okr.id, 'okrs', 'done');
                    this.updateCascadeProgress(okr.id, 'okrs');
                } else if (action === 'arquivar') {
                    okr.status = 'abandoned';
                    this.cascadeStatusDown(okr.id, 'okrs', 'abandoned');
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
        const id = isEditing ? this.editingEntity.id : 'ent_' + Date.now() + Math.random().toString(36).substr(2, 5);
        
        const obj = { id: id || '', title: title || '', dimension: dimension || 'Geral', prazo: prazo || '' };

        const getOldItem = (eid, etype) => {
            const state = window.sistemaVidaState;
            const list = etype === 'habits' ? state.habits : state.entities[etype];
            return (list || []).find(e => e.id === eid) || {};
        };

        if (type === 'metas' || type === 'okrs') {
            obj.purpose = context || '';
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (type === 'okrs' && parentId) obj.metaId = parentId || '';
        } else if (type === 'macros') {
            obj.description = context || '';
            obj.progress = isEditing ? (getOldItem(id, type).progress || 0) : 0;
            if (parentId) {
                obj.okrId = parentId;
                const okr = window.sistemaVidaState.entities.okrs.find(o => o.id === parentId);
                if (okr) obj.metaId = okr.metaId || '';
            }
        } else if (type === 'micros') {
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
            obj.context = context || '';
            obj.completed = isEditing ? (getOldItem(id, 'habits').completed || false) : false;
            obj.trigger = trigger || '';
        }

        if (isEditing) {
            const list = type === 'habits' ? window.sistemaVidaState.habits : window.sistemaVidaState.entities[type];
            const idx = list.findIndex(e => e.id === id);
            if (idx !== -1) list[idx] = obj;
            if (['micros', 'macros', 'okrs'].includes(type)) this.updateCascadeProgress(id, type);
        } else {
            if (type === 'habits') {
                if (!window.sistemaVidaState.habits) window.sistemaVidaState.habits = [];
                window.sistemaVidaState.habits.push(obj);
            } else {
                if (!window.sistemaVidaState.entities[type]) window.sistemaVidaState.entities[type] = [];
                window.sistemaVidaState.entities[type].push(obj);
                if (['micros', 'macros', 'okrs'].includes(type)) this.updateCascadeProgress(obj.id, type);
            }
        }

        this.editingEntity = null;
        this.closeModal();
        this.saveState();

        if (this.currentView === 'planos') {
            const typeMapping = { metas: 'metas', okrs: 'okrs', macros: 'macro', micros: 'micro' };
            this.switchPlanosTab(typeMapping[type]);
            this.render.planos();
        } else if (this.currentView && this.render[this.currentView]) {
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
        const s1 = document.getElementById('diario-shutdown-1') ? document.getElementById('diario-shutdown-1').value : '';

        const today = new Date().toISOString().split('T')[0];
        
        if (!window.sistemaVidaState.dailyLogs) window.sistemaVidaState.dailyLogs = {};
        
        window.sistemaVidaState.dailyLogs[today] = { 
            gratidao, 
            funcionou, 
            shutdown: s1, 
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

            // ---------------------------------------------------------
            // CÁLCULO DE FOCO E EXECUÇÃO
            // ---------------------------------------------------------
            const micros = state.entities.micros || [];
            const macros = state.entities.macros || [];
            
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
                const isSelected = btn.textContent.trim() === 'Semana'; // Mockup, assuming default is Semana
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
            const focusContainer = document.getElementById('focus-distribution');
            if (focusContainer) {
                const effort = {}; 
                const dims = ['Saúde', 'Mente', 'Carreira', 'Finanças', 'Relacionamentos', 'Família', 'Lazer', 'Propósito'];
                dims.forEach(d => effort[d] = 0);
                
                // Soma os pesos estratégicos
                const addScore = (list, weight) => {
                    (list || []).forEach(item => {
                        const dim = item.dimension || item.dimensionName || 'Geral';
                        if (effort[dim] !== undefined) { effort[dim] += weight; }
                    });
                };
                
                addScore(state.entities.metas, 3);
                addScore(state.entities.okrs, 2);
                addScore(state.entities.macros, 1);
                addScore(state.entities.micros, 0.5);
                
                // Descobre o total para fazer a porcentagem
                const total = Object.values(effort).reduce((a, b) => a + b, 0) || 1;
                
                let focusHtml = '';
                dims.forEach(dim => {
                    const score = effort[dim];
                    const pct = (score / total) * 100;
                    focusHtml += `
                    <div class="space-y-1">
                        <div class="flex justify-between text-[10px] uppercase tracking-wider font-bold text-outline">
                            <span>${dim}</span><span>Esforço: ${score}</span>
                        </div>
                        <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full transition-all duration-700" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
                });
                focusContainer.innerHTML = focusHtml;
            }

            // PERMA Dynamic SVG (Com delay seguro)
            setTimeout(() => {
                try {
                    const state = window.sistemaVidaState;
                    const perma = state.perma || {P:0, E:0, R:0, M:0, A:0};
                    const pPoly = document.getElementById('perma-polygon');
                    const pScore = document.getElementById('perma-score');
                    if (pPoly && pScore) {
                        const angles = [0, 72, 144, 216, 288].map(d => d * Math.PI / 180);
                        const vals = [perma.P, perma.E, perma.R, perma.M, perma.A];
                        const pts = vals.map((val, i) => {
                            const r = 40 * (val / 100);
                            return `${(50 + r * Math.sin(angles[i])).toFixed(1)},${(50 - r * Math.cos(angles[i])).toFixed(1)}`;
                        });
                        pPoly.setAttribute('points', pts.join(' '));
                        const avg = (vals.reduce((a,b)=>a+b,0)/5).toFixed(1);
                        pScore.textContent = `Score PERMA: ${avg}`;
                    }
                } catch(e) { 
                    console.error("Erro no render PERMA Painel:", e); 
                }
            }, 100);
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
                const s1 = document.getElementById('diario-shutdown-1'); if (s1) s1.value = log.shutdown || '';
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
                                <p class="font-medium text-on-surface text-sm line-through">${habit.title}</p>
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

            const filterAreaId = 'planos-advanced-filters';
            let filterArea = document.getElementById(filterAreaId);
            if (!filterArea) {
                const dimensionFilters = document.querySelector('.overflow-x-auto.no-scrollbar.mb-12') || document.querySelector('#tab-metas').parentNode;
                if (dimensionFilters) {
                    dimensionFilters.insertAdjacentHTML('afterend', `
                        <div id="${filterAreaId}" class="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 mb-6 space-y-4">
                            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                                <span class="text-[10px] font-label uppercase tracking-widest text-outline font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">account_tree</span> Raio-X Relacional:</span>
                                <div class="flex gap-2 w-full sm:w-auto">
                                    <select id="hier-type" onchange="app.planosHierarchyType = this.value; app.planosHierarchyId = ''; app.render.planos()" class="flex-1 sm:flex-none bg-surface-container-high text-on-surface text-xs font-medium rounded-lg px-3 py-1.5 outline-none">
                                        <option value="">Mostrar Tudo</option>
                                        <option value="metas">Por Meta</option>
                                        <option value="okrs">Por OKR</option>
                                        <option value="macros">Por Macro Ação</option>
                                    </select>
                                    <select id="hier-id" onchange="app.planosHierarchyId = this.value; app.render.planos()" class="hidden flex-1 sm:flex-none bg-surface-container-high text-on-surface text-xs font-medium rounded-lg px-3 py-1.5 outline-none w-full sm:max-w-[250px] truncate">
                                        <option value="">Selecione...</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 pt-3 border-t border-outline-variant/10 overflow-x-auto no-scrollbar">
                                <span class="text-[10px] font-label uppercase tracking-widest text-outline font-bold flex items-center gap-1 shrink-0"><span class="material-symbols-outlined text-[14px]">check_circle</span> Status:</span>
                                <div class="flex gap-2 shrink-0">
                                    <button onclick="app.planosStatusFilter='active'; app.render.planos()" id="btn-stat-active" class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Ativos</button>
                                    <button onclick="app.planosStatusFilter='done'; app.render.planos()" id="btn-stat-done" class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Concluídos</button>
                                    <button onclick="app.planosStatusFilter='all'; app.render.planos()" id="btn-stat-all" class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Todos</button>
                                </div>
                            </div>
                        </div>
                    `);
                }
            }
            
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

                const statFilter = app.planosStatusFilter || 'active';
                document.getElementById('btn-stat-active').className = `px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${statFilter === 'active' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:brightness-95'}`;
                document.getElementById('btn-stat-done').className = `px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${statFilter === 'done' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:brightness-95'}`;
                document.getElementById('btn-stat-all').className = `px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${statFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:brightness-95'}`;
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

                const resolveLineage = (item, type) => {
                    let metaId = type === 'metas' ? item.id : null;
                    let okrId = type === 'okrs' ? item.id : null;
                    let macroId = type === 'macros' ? item.id : null;
                    if (type === 'micros') {
                        macroId = item.macroId;
                        const m = state.entities.macros.find(x => x.id === macroId);
                        if (m) { okrId = m.okrId; const o = state.entities.okrs.find(x => x.id === okrId); if (o) metaId = o.metaId; }
                    } else if (type === 'macros') {
                        okrId = item.okrId;
                        const o = state.entities.okrs.find(x => x.id === okrId);
                        if (o) metaId = o.metaId;
                    } else if (type === 'okrs') {
                        metaId = item.metaId;
                    }
                    return { metaId, okrId, macroId };
                };

                const filteredByDim = filter === 'Todas' ? items : items.filter(i => resolveDim(i) === filter);
                const filtered = filteredByDim.filter(i => {
                    // Filtro 1: Status
                    const isDone = i.progress >= 100 || i.status === 'done' || i.completed;
                    const statFilter = app.planosStatusFilter || 'active';
                    let passStatus = false;
                    if (statFilter === 'active') passStatus = !isDone && i.status !== 'abandoned';
                    else if (statFilter === 'done') passStatus = isDone;
                    else passStatus = i.status !== 'abandoned';
                    if (!passStatus) return false;

                    // Filtro 2: Raio-X Relacional (Lineage Omnidirecional)
                    if (app.planosHierarchyType && app.planosHierarchyId) {
                        const lineage = resolveLineage(i, entityType);
                        if (app.planosHierarchyType === 'metas' && lineage.metaId !== app.planosHierarchyId) return false;
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
                        
                        // Build Hierarchy Trail Nodes
                        let trailNodes = [];
                        if (entityType === 'micros') {
                            trailNodes.push({ label: 'Micro Ação', title: item.title });
                            const macro = state.entities.macros.find(x => x.id === item.macroId);
                            trailNodes.push({ label: 'Macro Ação', title: macro ? macro.title : '-' });
                            const okr = macro ? state.entities.okrs.find(x => x.id === macro.okrId) : null;
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : null;
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'macros') {
                            trailNodes.push({ label: 'Macro Ação', title: item.title });
                            const okr = state.entities.okrs.find(x => x.id === item.okrId);
                            trailNodes.push({ label: 'OKR', title: okr ? okr.title : '-' });
                            const meta = okr ? state.entities.metas.find(x => x.id === okr.metaId) : null;
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'okrs') {
                            trailNodes.push({ label: 'OKR', title: item.title });
                            const meta = state.entities.metas.find(x => x.id === item.metaId);
                            trailNodes.push({ label: 'Meta', title: meta ? meta.title : '-' });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: meta ? (meta.purpose || '-') : '-' });
                        } else if (entityType === 'metas') {
                            trailNodes.push({ label: 'Meta', title: item.title });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
                            trailNodes.push({ label: 'Propósito (Nível 0)', title: item.purpose || '-' });
                        }

                        let trailHtml = `<div class="bg-stone-100 dark:bg-stone-900 rounded-lg p-6 space-y-6 relative trail-line text-on-surface-variant mt-6">
                            <div class="absolute left-[11px] top-4 bottom-4 w-px bg-primary/10"></div>`;
                        
                        trailNodes.forEach((node) => {
                            let icon = 'trip_origin'; let colorClass = 'text-stone-400'; let titleClass = 'text-xs text-on-surface-variant font-medium';
                            if (node.label === 'Propósito (Nível 0)') { icon = 'auto_awesome'; colorClass = 'text-primary'; titleClass = 'text-base font-headline italic text-on-surface'; }
                            else if (node.label === 'Área') { icon = 'stars'; colorClass = 'text-primary'; }
                            else if (node.label === 'Meta') { icon = 'flag'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'OKR') { icon = 'track_changes'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Macro Ação') { icon = 'account_tree'; colorClass = 'text-stone-400'; }
                            else if (node.label === 'Micro Ação') { icon = 'check_circle'; colorClass = 'text-primary'; }
                            
                            trailHtml += `
                            <div class="flex items-center gap-4 relative z-10">
                                <span class="material-symbols-outlined ${colorClass} text-xl bg-stone-100 dark:bg-stone-900 p-0.5" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                                <div class="flex flex-col">
                                    <span class="text-[9px] uppercase tracking-tighter opacity-50 font-bold ${colorClass}">${node.label}</span>
                                    <span class="${titleClass}">${node.title}</span>
                                </div>
                            </div>`;
                        });
                        trailHtml += `</div>`;

                        const userValues = state.profile.values || [];
                        const isAligned = userValues.includes(item.dimension);

                        html += `
                        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group cursor-pointer overflow-hidden relative" onclick="app.toggleTrail(this)">
                            <div class="flex justify-between items-start mb-4">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-label font-bold uppercase tracking-wider">${item.dimension}</span>
                                        ${isAligned ? '<span class="bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded border border-primary/20 font-bold">ALINHADO AOS VALORES</span>' : ''}
                                    </div>
                                    <h4 class="font-headline text-xl font-medium">${item.title}</h4>
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        ${prog < 100 ? `<button onclick="event.stopPropagation(); app.forceCompleteEntity('${item.id}', '${entityType}')" class="p-1 px-2 border border-outline-variant hover:bg-primary/10 rounded flex items-center gap-1 text-[10px] font-bold text-outline hover:text-primary transition-colors">
                                            <span class="material-symbols-outlined text-[14px]">done_all</span> Concluir
                                        </button>` : ''}
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

            // 1. Blindagem do PERMA (Delay para garantir DOM)
            setTimeout(() => {
                try {
                    const state = window.sistemaVidaState;
                    const perma = state.perma || { P: 0, E: 0, R: 0, M: 0, A: 0 };
                    ['P', 'E', 'R', 'M', 'A'].forEach(k => {
                        const bar = document.getElementById('perma-bar-' + k.toLowerCase());
                        const txt = document.getElementById('perma-text-' + k.toLowerCase());
                        if (bar) bar.style.width = perma[k] + '%';
                        if (txt) txt.textContent = perma[k] + '%';
                    });
                } catch(e) { 
                    console.error("Erro no render PERMA Propósito:", e); 
                }
            }, 100);

            // 3. Renderização de Textos do Propósito (Ikigai, Valores, Visão, Legado)
            setTimeout(() => {
                try {
                    const state = window.sistemaVidaState;
                    const profile = state.profile || {};
                    
                    // Valores Essenciais
                    const valuesBanner = document.getElementById('top-values-banner');
                    if (valuesBanner && profile.values && profile.values.length > 0) {
                        valuesBanner.innerHTML = profile.values.map(v => `<span class="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest">${v}</span>`).join('');
                    }

                    // Função Caçadora de IDs para Textos de Exibição
                    const safeSetText = (idBase, text) => { 
                        const el = document.getElementById(`display-${idBase}`) 
                                || document.getElementById(`${idBase}-display`) 
                                || document.getElementById(`${idBase}-text`) 
                                || document.getElementById(idBase);
                        
                        // Garante que não está substituindo o value de um input do modal
                        if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
                            el.textContent = text || 'Não definido. Clique para editar.'; 
                        }
                    };

                    // Ikigai
                    const iki = profile.ikigai || {};
                    safeSetText('ikigai-missao', iki.missao);
                    safeSetText('ikigai-vocacao', iki.vocacao);
                    safeSetText('ikigai-love', iki.love);
                    safeSetText('ikigai-good', iki.good);
                    safeSetText('ikigai-need', iki.need);
                    safeSetText('ikigai-paid', iki.paid);
                    safeSetText('ikigai-sintese', iki.sintese);

                    // Visão e Legado
                    const vis = profile.vision || {};
                    safeSetText('vision-saude', vis.saude);
                    safeSetText('vision-carreira', vis.carreira);
                    safeSetText('vision-intelecto', vis.intelecto);
                    safeSetText('vision-quote', vis.quote);

                    const leg = profile.legacyObj || {};
                    safeSetText('legacy-familia', leg.familia);
                    safeSetText('legacy-profissao', leg.profissao);
                    safeSetText('legacy-mundo', leg.mundo);

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


            // Injeção Dinâmica dos Odyssey Scenarios (A, B, C)
            const scenarios = ['A', 'B', 'C'];
            scenarios.forEach(id => {
                const plan = state.profile.odyssey?.[id];
                if (plan) {
                    const titleEl = document.getElementById(`ody-title-${id}`);
                    const descEl = document.getElementById(`ody-desc-${id}`);
                    const confEl = document.getElementById(`ody-conf-${id}`);
                    const nrgEl = document.getElementById(`ody-nrg-${id}`);

                    if (titleEl) titleEl.textContent = plan.title;
                    if (descEl) descEl.textContent = plan.desc;
                    if (confEl) {
                        confEl.innerHTML = Array(5).fill(0).map((_, i) => 
                            `<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' ${i < plan.conf ? 1 : 0};">star</span>`
                        ).join('');
                    }
                    if (nrgEl) {
                        nrgEl.innerHTML = Array(5).fill(0).map((_, i) => 
                            `<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' ${i < plan.nrg ? 1 : 0};">bolt</span>`
                        ).join('');
                    }
                }
            });
        },
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
                this.saveState();
                if (this.render.planos) this.render.planos();
                if (this.render.painel) this.render.painel();
            }
        }
    },

    deleteEntity: function(id, type) {
        if (confirm('Deseja realmente excluir este item? Esta ação não pode ser desfeita.')) {
            const state = window.sistemaVidaState;
            const list = type === 'habits' ? state.habits : state.entities[type];
            const item = list.find(e => e.id === id);
            if (!item) return;

            // Guarda o ID do pai antes de remover
            const parentId = item.macroId || item.okrId || item.metaId;

            // Remove a entidade
            if (type === 'habits') {
                state.habits = state.habits.filter(e => e.id !== id);
            } else {
                state.entities[type] = state.entities[type].filter(e => e.id !== id);
            }

            // Força o recálculo da cascata a partir dos irmãos sobreviventes
            if (parentId) {
                const sibling = state.entities[type].find(e => (e.macroId === parentId || e.okrId === parentId || e.metaId === parentId));
                if (sibling) {
                    this.updateCascadeProgress(sibling.id, type);
                } else {
                    // Se não restarem irmãos, o pai deve ser zerado
                    const parentType = type === 'micros' ? 'macros' : (type === 'macros' ? 'okrs' : 'metas');
                    const parent = state.entities[parentType]?.find(p => p.id === parentId);
                    if (parent) {
                        parent.progress = 0;
                        this.updateCascadeProgress(parent.id, parentType);
                    }
                }
            }

            this.saveState();
            if (this.render.planos) this.render.planos();
            if (this.render.hoje) this.render.hoje();
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

        // 1. Aba: Planos
        const planosCol = ["ID", "Tipo", "Dimensão", "Título", "Contexto_Indicador", "Prazo", "Progresso", "ID_Pai"];
        const planosData = [planosCol];
        const types = ['metas', 'okrs', 'macros', 'micros'];
        types.forEach(t => {
            (state.entities[t] || []).forEach(e => {
                const context = e.purpose || e.description || e.indicator || "";
                const parentId = e.metaId || e.okrId || e.macroId || "";
                planosData.push([e.id, t.slice(0, -1), e.dimension || "Geral", e.title, context, e.prazo || "", e.progress || 0, parentId]);
            });
        });
        const wsPlanos = XLSX.utils.aoa_to_sheet(planosData);
        wsPlanos['!cols'] = [{wch:15}, {wch:10}, {wch:15}, {wch:40}, {wch:40}, {wch:15}, {wch:10}, {wch:15}];
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

        const wsProp = XLSX.utils.aoa_to_sheet(propData);
        wsProp['!cols'] = [{wch:15}, {wch:30}, {wch:60}];
        XLSX.utils.book_append_sheet(wb, wsProp, "Propósito");

        // 3. Aba: Hábitos
        const habCol = ["ID", "Dimensão", "Título", "Gatilho", "Status"];
        const habData = [habCol];
        (state.habits || []).forEach(h => {
            habData.push([h.id, h.dimension || "Geral", h.title, h.trigger || h.context || "", h.completed ? "Ativo" : "Inativo"]);
        });
        const wsHabits = XLSX.utils.aoa_to_sheet(habData);
        wsHabits['!cols'] = [{wch:15}, {wch:15}, {wch:40}, {wch:30}, {wch:10}];
        XLSX.utils.book_append_sheet(wb, wsHabits, "Hábitos");

        // 4. Aba: Diário
        const logCol = ["Data", "Energia", "Gratidão", "O_Que_Funcionou", "O_Que_Aprendi", "Shutdown_1", "Shutdown_2", "Shutdown_3"];
        const logData = [logCol];
        Object.entries(state.dailyLogs || {}).sort().forEach(([date, log]) => {
            const row = [
                date,
                log.energy || 5,
                log.gratidao || "",
                log.funcionou || "",
                log.aprendi || "",
                log.shutdown?.[0] || "",
                log.shutdown?.[1] || "",
                log.shutdown?.[2] || ""
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

                    let context = getValue(row, ['Contexto / Indicador', 'Contexto', 'Notes', 'Descrição']);
                    let prazo = getValue(row, ['Prazo / Ciclo', 'Prazo', 'Ciclo', 'Deadline', 'Data']);
                    
                    if (type === 'metas' || type === 'okrs') { obj.purpose = context; obj.prazo = prazo; }
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
                        if (['P','E','R','M','A'].includes(pKey)) window.sistemaVidaState.perma[pKey] = parseFloat(val) || 0;
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
            await window.app.saveState();
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
            const icon = btn.querySelector('.material-symbols-outlined');
            const view = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            
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

    openPermaModal: function() {
        const state = window.sistemaVidaState;
        const perma = state.perma || {P:0, E:0, R:0, M:0, A:0};
        
        // Tarefa 2: Sincronização Total e Explícita (Sliders + Labels)
        const keys = ['P', 'E', 'R', 'M', 'A'];
        keys.forEach(k => {
            const id = k.toLowerCase();
            const slider = document.getElementById(`${id}-slider`);
            const label = document.getElementById(`val-${id}`);
            if (slider) slider.value = perma[k];
            if (label) label.textContent = perma[k];
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
                state.perma[k] = parseInt(slider.value, 10) || 0;
            }
        });

        // Tarefa 3: Persistência Explícita e Atualização Padronizada
        this.saveState();
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
    }
};

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
