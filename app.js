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
        vision: { saude: "", carreira: "", intelecto: "", quote: "" },
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
    entities: { metas: [], okrs: [], macros: [], micros: [] },
    habits: [],
    dailyLogs: {},
    reviews: {},
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
        try {
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
        } catch (_) {}
    },
    applyThemePreference: function() {
        this.ensureSettingsState();
        const pref = window.sistemaVidaState.settings.theme || 'auto';
        const root = document.documentElement;
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDark = pref === 'dark' || (pref === 'auto' && systemDark);
        root.classList.toggle('dark', useDark);
        root.classList.toggle('light', !useDark);
    },
    setThemePreference: function(theme) {
        this.ensureSettingsState();
        const next = ['light', 'dark', 'auto'].includes(theme) ? theme : 'auto';
        window.sistemaVidaState.settings.theme = next;
        this.applyThemePreference();
        this.saveState(true);
        this.showToast(`Tema aplicado: ${next === 'auto' ? 'Automatico' : (next === 'dark' ? 'Escuro' : 'Claro')}.`, 'success');
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
                        this.showToast('Permissao de notificacoes nao concedida no navegador.', 'error');
                        return;
                    }
                } else if (Notification.permission === 'denied') {
                    this.showToast('Notificacoes bloqueadas no navegador. Ative nas permissoes do site.', 'error');
                    return;
                }
            } catch (_) {
                this.showToast('Nao foi possivel solicitar a permissao de notificacoes.', 'error');
                return;
            }
        }
        window.sistemaVidaState.settings.notificationsEnabled = enabled;
        this.saveState(true);
        if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
        this.showToast(enabled ? 'Notificacoes diarias ativadas.' : 'Notificacoes diarias desativadas.', 'success');
    },
    openAvatarPicker: function() {
        const input = document.getElementById('profile-photo-input');
        if (input) input.click();
    },
    onProfilePhotoSelected: function(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            this.showToast('Selecione um arquivo de imagem valido.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            this.ensureSettingsState();
            window.sistemaVidaState.profile.avatarUrl = typeof reader.result === 'string' ? reader.result : '';
            try { localStorage.setItem('lifeos_profile_avatar', window.sistemaVidaState.profile.avatarUrl); } catch (_) {}
            this.saveState(true);
            if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
            this.showToast('Foto de perfil atualizada!', 'success');
        };
        reader.onerror = () => this.showToast('Falha ao ler a imagem selecionada.', 'error');
        reader.readAsDataURL(file);
        event.target.value = '';
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
            this.showToast('Selecione um arquivo de imagem valido para o cenario.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const current = window.sistemaVidaState.profile.odysseyImages || {};
            window.sistemaVidaState.profile.odysseyImages = { ...current, [key]: String(reader.result || '') };
            try {
                localStorage.setItem('lifeos_odyssey_images', JSON.stringify(window.sistemaVidaState.profile.odysseyImages));
            } catch (_) {}
            this.saveState(true);
            if (this.render.proposito) this.render.proposito();
            this.showToast('Imagem do cenario atualizada!', 'success');
        };
        reader.onerror = () => this.showToast('Falha ao ler a imagem selecionada.', 'error');
        reader.readAsDataURL(file);
        input.value = '';
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
    painelFilter: 'ciclo',
    planosFilter: 'Todas',
    planosStatusFilter: 'active',
    planosHierarchyType: '',
    planosHierarchyId: '',
    focusTypeFilter: 'Tudo',
    focusStatusFilter: 'Tudo',
    focusDistributionViewMode: '',
    currentTextGroup: null,
    currentTextKey: null,
    onboardingStep: 0,

    // ------------------------------------------------------------------------
    // Cloud Persistence Engine
    // ------------------------------------------------------------------------
    saveState: async function(silent = true) {
        try {
            const stateRef = doc(db, "users", "meu-sistema-vida");
            await setDoc(stateRef, window.sistemaVidaState);
            console.log("Sincronização com Nuvem: Concluída.");
            if (!silent && this.showToast) this.showToast('Progresso guardado na nuvem! ✨', 'success');
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
                this.renderSidebarValues();
            } else {
                console.log("Primeiro acesso. Criando documento base na Nuvem...");
                await this.saveState(true);
            }
        } catch (error) {
            console.error("Erro ao carregar o estado do Firestore:", error);
        }
    },

    showNotification: function(msg) {
        this.showToast(msg, 'success');
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
        this.saveState(true);

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

    getRiskAlerts: function() {
      const state = window.sistemaVidaState;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T');
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

      // Reação em cadeia: Renderiza a timeline ao entrar na tab
      if (tabId === 'timeline') this.renderTimeline();
    },

    init: async function() {
        console.log("Sistema Vida OS inicializando...");
        await this.loadState();
        this.ensureSettingsState();
        this.applyThemePreference();
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
            list.innerHTML = '<div class="text-center py-12 text-outline italic">Nenhum registo encontrado.</div>';
        } else {
            list.innerHTML = sortedLogs.map(log => {
                // Adiciona T12:00:00 para evitar que o fuso horário mude o dia no toLocaleDateString
                const dateObj = new Date(log.date + "T12:00:00");
                const dateStr = dateObj.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                const [dia, de, mes] = dateStr.split(' ');
                
                const energyColor = log.energy >= 4 ? 'text-green-600' : log.energy >= 3 ? 'text-yellow-600' : 'text-red-600';
                const gratidaoBlock = log.gratidao ? `<p class="text-[11px] text-on-surface-variant mt-2">Gratidão: ${log.gratidao}</p>` : '';
                const funcionouBlock = log.funcionou ? `<p class="text-[11px] text-on-surface-variant mt-1">Funcionou: ${log.funcionou}</p>` : '';
                const shutdownBlock = log.shutdown ? `<p class="text-[11px] text-on-surface-variant mt-1">Shutdown: ${log.shutdown}</p>` : '';
                
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
        const parentGroup = document.getElementById('crud-parent-group');
        const triggerGroup = document.getElementById('crud-trigger-container');
        const dimensionGroup = document.getElementById('crud-dimension-group');
        const contextLabel = document.getElementById('crud-context-label');
        const habitControls = document.getElementById('crud-habit-controls');
        const metaHorizonGroup = document.getElementById('crud-meta-horizon-group');
        
        // Esconde tudo por padrão para resetar estado visual
        if (parentGroup) parentGroup.classList.add('hidden');
        if (triggerGroup) triggerGroup.classList.add('hidden');
        if (habitControls) {
            habitControls.classList.add('hidden');
            habitControls.classList.remove('flex');
        }
        if (metaHorizonGroup) metaHorizonGroup.classList.add('hidden');
        if (dimensionGroup) dimensionGroup.classList.remove('hidden'); // Dimensão visível quase sempre

        // Configura baseado no tipo
        if (type === 'habits') {
            if (triggerGroup) {
                triggerGroup.classList.remove('hidden');
                triggerGroup.classList.add('flex');
            }
            if (habitControls) {
                habitControls.classList.remove('hidden');
                habitControls.classList.add('flex');
                
                // Força atualização da visibilidade dos sub-campos baseando nos valores dos selects
                const modeInput = document.getElementById('habit-track-mode');
                if (modeInput) this.onHabitModeChange(modeInput.value);
                const freqInput = document.getElementById('habit-frequency');
                if (freqInput) this.onHabitFreqChange(freqInput.value);
            }
            if (contextLabel) contextLabel.textContent = 'Gatilho de Execução';
        } else if (type === 'metas') {
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (metaHorizonGroup) metaHorizonGroup.classList.remove('hidden');
            if (contextLabel) contextLabel.textContent = 'Por que esta meta? (Propósito)';
            this.updateParentList(type);
        } else if (type === 'okrs') {
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (contextLabel) contextLabel.textContent = 'Indicador de Sucesso / Métrica';
            this.updateParentList(type);
        } else {
            // Macros, Micros
            if (parentGroup) parentGroup.classList.remove('hidden');
            if (contextLabel) contextLabel.textContent = 'Detalhes / Critério de Aceitação';
            this.updateParentList(type);
        }

        // Alterna campo de prazo padrão vs. janela real (macro/micro)
        const deadlineGroup = document.getElementById('prazo-deadline-group');
        const agendamentoGroup = document.getElementById('prazo-agendamento-group');
        const usaAgendamento = ['macros', 'micros'].includes(type);

        if (deadlineGroup) deadlineGroup.classList.toggle('hidden', usaAgendamento);
        if (agendamentoGroup) agendamentoGroup.classList.toggle('hidden', !usaAgendamento);

        // Defaults para datas reais no modal (macro/micro)
        if (usaAgendamento) {
            const hoje = new Date().toISOString().split('T')[0];
            const inicioInput = document.getElementById('crud-inicio-date');
            const prazoInput = document.getElementById('crud-prazo-date');
            if (inicioInput && !inicioInput.value) inicioInput.value = hoje;
            if (prazoInput && !prazoInput.value) prazoInput.value = hoje;
        }
    },

    getMetaHorizonYears: function(meta) {
        const explicit = Number(meta?.horizonYears);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        if (!meta?.prazo) return 1;
        const today = new Date();
        const deadline = new Date(meta.prazo + 'T00:00:00');
        if (isNaN(deadline.getTime())) return 1;
        const years = (deadline - today) / (1000 * 60 * 60 * 24 * 365.25);
        if (years > 3.5) return 5;
        if (years > 1.5) return 2.5;
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

    onHabitModeChange: function(mode) {
        const targetContainer = document.getElementById('habit-target-container');
        if (!targetContainer) return;
        if (mode === 'numeric' || mode === 'timer') {
            targetContainer.classList.remove('hidden');
            targetContainer.classList.add('flex');
        } else {
            targetContainer.classList.add('hidden');
            targetContainer.classList.remove('flex');
        }
    },

    onHabitFreqChange: function(freq) {
        const daysContainer = document.getElementById('habit-days-container');
        if (!daysContainer) return;
        if (freq === 'specific') {
            daysContainer.classList.remove('hidden');
            daysContainer.classList.add('flex');
        } else {
            daysContainer.classList.add('hidden');
            daysContainer.classList.remove('flex');
        }
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
            }
        }
        this.editingEntity = null;
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
            this.saveState(true);
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
          ikigai: { missao: '', vocacao: '', love: '', good: '', need: '', paid: '', sintese: '' },
          legacyObj: { familia: '', profissao: '', mundo: '' },
          vision: { saude: '', carreira: '', intelecto: '', quote: '' },
          odyssey: { cenarioA: '', cenarioB: '', cenarioC: '' },
          odysseyImages: { cenarioA: '', cenarioB: '', cenarioC: '' }
        },
        energy: 5,
        dimensions: {
          'Saúde': { score: 1 }, 'Mente': { score: 1 }, 'Carreira': { score: 1 },
          'Finanças': { score: 1 }, 'Relacionamentos': { score: 1 },
          'Família': { score: 1 }, 'Lazer': { score: 1 }, 'Propósito': { score: 1 }
        },
        perma: { P: 50, E: 50, R: 50, M: 50, A: 50 },
        entities: { metas: [], okrs: [], macros: [], micros: [] },
        dailyLogs: {},
        habits: [],
        reviews: {},
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
        perma: { P: 72, E: 68, R: 85, M: 75, A: 60 },
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
        await this.saveState(false);
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
        if (!listContainer) return;
        
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

    processQuarterlyReview: function() {
        const state = window.sistemaVidaState;
        // Motor de revisão: busca todos os cartões de OKR no modal
        const items = document.querySelectorAll('#quarterly-okrs-list div[data-okr-id]');
        
        if (items.length === 0) {
            this.closeQuarterlyModal();
            return;
        }

        items.forEach(item => {
            const id = item.getAttribute('data-okr-id');
            const action = item.querySelector(`input[name="action_${id}"]:checked`).value;
            const migrateChecked = item.querySelector(`#migrate_${id}`)?.checked;
            const okr = state.entities.okrs.find(o => o.id === id);
            
            if (okr) {
                if (action === 'concluir') {
                    okr.status = 'done'; 
                    okr.progress = 100;
                    // Opcional: Cascata para fechar macros/micros pendentes deste OKR
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
                    // Cascata para abandonar macros/micros pendentes deste OKR
                    const macros = state.entities.macros.filter(m => m.okrId === id);
                    macros.forEach(m => {
                        m.status = 'abandoned';
                        const micros = state.entities.micros.filter(mic => mic.macroId === m.id);
                        micros.forEach(mic => mic.status = 'abandoned');
                    });
                } else if (action === 'continuar') {
                    if (migrateChecked) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const macrosIds = state.entities.macros.filter(m => m.okrId === id).map(m => m.id);
                        state.entities.micros.forEach(micro => {
                            if (macrosIds.includes(micro.macroId) && micro.status !== 'done') {
                                micro.prazo = todayStr;
                            }
                        });
                    }
                }
            }
        });
        
        // Reset do Ciclo
        state.cycleStartDate = this.getLocalDateKey();
        
        // Persistir e atualizar UI com delay para garantir animação
        this.saveState(true);
        this.closeQuarterlyModal();
        
        setTimeout(() => {
            this.showToast("Revisão processada com sucesso!", "success");
            if (this.currentView === 'painel') this.render.painel();
            if (this.currentView === 'planos') this.render.planos();
        }, 300);
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
      const next = mode === 'one_line' ? 'one_line' : 'two_line';
      this.focusDistributionViewMode = next;
      try { localStorage.setItem('lifeos_focus_distribution_view_mode', next); } catch (_) {}
      if (this.currentView === 'foco') this.render.foco();
      if (this.currentView === 'painel') this.render.painel();
      if (this.currentView === 'hoje') this.render.hoje();
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
        
        const usaAgendamento = ['macros', 'micros'].includes(type);
        let prazo = '';
        let inicioDate = '';

        if (usaAgendamento) {
            inicioDate = document.getElementById('crud-inicio-date')?.value || '';
            prazo = document.getElementById('crud-prazo-date')?.value || '';
            if (!inicioDate && prazo) inicioDate = prazo; // fallback retrô
            if (!prazo && inicioDate) prazo = inicioDate; // consistência mínima
        } else {
            prazo = document.getElementById('create-prazo')?.value || '';
        }

        const parentId = document.getElementById('create-parent') ? document.getElementById('create-parent').value : '';
        const metaHorizonYears = Number(document.getElementById('crud-meta-horizon')?.value || 1);

        const isEditing = !!this.editingEntity;
        const id = isEditing ? this.editingEntity.id : 'ent_' + Date.now() + Math.random().toString(36).substr(2, 5);
        
        const obj = { id: id || '', title: title || '', dimension: dimension || 'Geral', prazo: prazo || '' };
        if (usaAgendamento && inicioDate) obj.inicioDate = inicioDate;

        const getOldItem = (eid, etype) => {
            const state = window.sistemaVidaState;
            const list = etype === 'habits' ? state.habits : state.entities[etype];
            return (list || []).find(e => e.id === eid) || {};
        };

        if (type === 'metas' || type === 'okrs') {
            obj.purpose = context || '';
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
            } else if (type === 'okrs' && parentId) {
                obj.metaId = parentId || '';
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
            obj.context = context || '';
            obj.completed = isEditing ? (getOldItem(id, 'habits').completed || false) : false;
            obj.trigger = trigger || '';
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
            shutdown: s1, 
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

    onboardingSaveCurrentStep: function() {
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
        this.saveState();
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
        this.onboardingSaveCurrentStep();
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

            if (!app.focusDistributionViewMode) {
                try {
                    app.focusDistributionViewMode = localStorage.getItem('lifeos_focus_distribution_view_mode') || 'two_line';
                } catch (_) {
                    app.focusDistributionViewMode = 'two_line';
                }
            }

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
            const mode = app.focusDistributionViewMode === 'one_line' ? 'one_line' : 'two_line';

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
                    ? "px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase transition-all"
                    : "px-3 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-bold uppercase hover:bg-surface-container-highest transition-all";
            });

            document.querySelectorAll('[data-focus-status]').forEach(btn => {
                const s = btn.getAttribute('data-focus-status');
                btn.className = s === statusFilter
                    ? "px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase transition-all"
                    : "px-3 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-bold uppercase hover:bg-surface-container-highest transition-all";
            });

            document.querySelectorAll('[data-focus-view-mode]').forEach(btn => {
                const btnMode = btn.getAttribute('data-focus-view-mode');
                btn.className = btnMode === mode
                    ? "px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-bold uppercase transition-all"
                    : "px-3 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-bold uppercase hover:bg-surface-container-highest transition-all";
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
                    const dim = normalizeDim(item.dimension || 'Geral');
                    if (!stats[dim]) return;
                    const isDone = item.status === 'done' || item.completed === true;
                    const isInProgress = item.status === 'in_progress';
                    stats[dim].total += 1;
                    if (isDone) stats[dim].done += 1;
                    else if (isInProgress) stats[dim].inProgress += 1;
                    else stats[dim].pending += 1;

                    if (matchesStatusFilter(item)) {
                        stats[dim].focusEffort += weight;
                        stats[dim].focusItems += 1;
                    }
                });
            });

            const totalFocusEffort = dimKeys.reduce((sum, d) => sum + stats[d].focusEffort, 0);

            const renderTwoLine = (dim) => {
                const s = stats[dim];
                const focusPct = totalFocusEffort > 0 ? Math.round((s.focusEffort / totalFocusEffort) * 100) : 0;
                const donePct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                const inProgressPct = s.total > 0 ? Math.round((s.inProgress / s.total) * 100) : 0;
                const pendingPct = s.total > 0 ? Math.max(0, 100 - donePct - inProgressPct) : 0;
                return `
                <div class="space-y-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3">
                    <div class="flex justify-between items-end gap-2">
                        <span class="${containerId === 'focus-distribution' ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-widest font-bold text-outline">${dimLabels[dim]}</span>
                        <div class="flex items-baseline gap-1">
                            <span class="${containerId === 'focus-distribution' ? 'text-[11px]' : 'text-xs'} font-bold ${focusPct > 0 ? 'text-primary' : 'text-outline-variant'}">Foco ${focusPct}%</span>
                            <span class="text-[9px] text-outline">(${s.focusItems} item${s.focusItems !== 1 ? 's' : ''})</span>
                        </div>
                    </div>
                    <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full ${focusPct > 0 ? 'bg-primary' : 'bg-outline-variant/30'} rounded-full transition-all duration-700" style="width: ${focusPct}%"></div>
                    </div>
                    <div class="flex justify-between items-center gap-2">
                        <span class="text-[10px] text-outline">Conclusao ${donePct}% (${s.done}/${s.total || 0})</span>
                        <span class="text-[10px] text-outline">C ${s.done} | A ${s.inProgress} | P ${s.pending}</span>
                    </div>
                    <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                        <div class="h-full bg-emerald-500 transition-all duration-700" style="width:${donePct}%"></div>
                        <div class="h-full bg-amber-500 transition-all duration-700" style="width:${inProgressPct}%"></div>
                        <div class="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-700" style="width:${pendingPct}%"></div>
                    </div>
                </div>`;
            };

            const renderOneLine = (dim) => {
                const s = stats[dim];
                const focusPct = totalFocusEffort > 0 ? Math.round((s.focusEffort / totalFocusEffort) * 100) : 0;
                const donePct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                const inProgressPct = s.total > 0 ? Math.round((s.inProgress / s.total) * 100) : 0;
                const pendingPct = s.total > 0 ? Math.max(0, 100 - donePct - inProgressPct) : 0;
                return `
                <div class="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-3">
                    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                        <span class="text-[10px] uppercase tracking-widest font-bold text-outline">${dimLabels[dim]}</span>
                        <span class="text-[10px] font-bold text-primary">Foco ${focusPct}% (${s.focusItems})</span>
                        <span class="text-[10px] text-emerald-600 font-semibold">C ${donePct}%</span>
                        <span class="text-[10px] text-amber-600 font-semibold">A ${inProgressPct}%</span>
                        <span class="text-[10px] text-outline font-semibold">P ${pendingPct}%</span>
                    </div>
                    <div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                        <div class="h-full bg-emerald-500 transition-all duration-700" style="width:${donePct}%"></div>
                        <div class="h-full bg-amber-500 transition-all duration-700" style="width:${inProgressPct}%"></div>
                        <div class="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-700" style="width:${pendingPct}%"></div>
                    </div>
                </div>`;
            };

            container.innerHTML = dimKeys.map(dim => mode === 'one_line' ? renderOneLine(dim) : renderTwoLine(dim)).join('');
        },

        foco: function() {
            const state = window.sistemaVidaState;
            this.renderSidebarValues();
            
            // 1. Distribuição de Foco
            this.renderFocusDistribution('foco-distribution');

            // 2. Progresso Semanal
            const weekMicros = state.entities.micros.filter(m =>
              app.isDateInCurrentWeek(m.inicioDate || m.prazo) || app.isDateInCurrentWeek(m.prazo)
            );
            const weekDone = weekMicros.filter(m => m.status === 'done').length;
            const weekProgress = weekMicros.length > 0 ? Math.round((weekDone / weekMicros.length) * 100) : 0;
            
            const weekBar = document.getElementById('foco-week-bar');
            const weekVal = document.getElementById('foco-week-val');
            if (weekBar) weekBar.style.width = weekProgress + '%';
            if (weekVal) weekVal.textContent = weekProgress + '%';

            // 3. Cycle Progress (Filtrado por data >= cycleStartDate)
            const cycleStartKey = String(state.cycleStartDate || app.getLocalDateKey()).split('T')[0];
            const cycleStartDate = new Date(`${cycleStartKey}T00:00:00`);
            const cycleDone = state.entities.micros.filter(m => {
                if (m.status !== 'done') return false;
                const ref = m.completedDate || m.prazo;
                if (!ref) return false;
                const refKey = String(ref).split('T')[0];
                const refDate = new Date(`${refKey}T00:00:00`);
                if (Number.isNaN(refDate.getTime()) || Number.isNaN(cycleStartDate.getTime())) return false;
                return refDate >= cycleStartDate;
            }).length;
            const cycleDoneEl = document.getElementById('cycle-micros-done');
            if (cycleDoneEl) cycleDoneEl.textContent = cycleDone;

            // 4. Micros Management List
            const listContainer = document.getElementById('micros-management-list');
            if (listContainer) {
                const dimFilter = document.getElementById('todo-dimension-filter')?.value || 'Tudo';
                const statusFilter = document.getElementById('todo-status-filter')?.value || 'active';

                let filtered = state.entities.micros.filter(m => {
                    const matchDim = dimFilter === 'Tudo' || m.dimension === dimFilter;
                    const matchStatus = statusFilter === 'all' ||
                                       (statusFilter === 'active' && m.status !== 'done') || // legado
                                       (statusFilter === 'pending' && m.status !== 'done' && m.status !== 'in_progress') ||
                                       (statusFilter === 'in_progress' && m.status === 'in_progress') ||
                                       (statusFilter === 'done' && m.status === 'done');
                    return matchDim && matchStatus;
                });

                // Ordenar por prazo
                filtered.sort((a,b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));

                listContainer.innerHTML = filtered.map(m => `
                    <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full">
                                ${m.dimension || 'Geral'}
                            </span>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.app.editEntity('${m.id}', 'micros')" class="p-1 hover:text-primary"><span class="material-symbols-outlined notranslate text-sm">edit</span></button>
                                <button onclick="window.app.deleteEntity('${m.id}', 'micros')" class="p-1 hover:text-error"><span class="material-symbols-outlined notranslate text-sm">delete</span></button>
                            </div>
                        </div>
                        <h3 class="font-bold text-on-surface mb-1 line-clamp-2">${m.title}</h3>
                        <p class="text-xs text-outline mb-4 line-clamp-1">${m.macroId ? (state.entities.macros.find(ma => ma.id === m.macroId)?.title || 'Macro não encontrada') : 'Sem Macro'}</p>
                        
                        <div class="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                            <div class="flex items-center gap-2 text-outline">
                                <span class="material-symbols-outlined notranslate text-xs">event</span>
                                <span class="text-[10px] font-bold uppercase">${m.prazo ? m.prazo.split('-').reverse().slice(0,2).join('/') : 'S/P'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                ${m.status === 'in_progress' ? '<span class="text-[10px] font-bold uppercase text-amber-600 flex items-center gap-1"><span class="material-symbols-outlined notranslate text-xs">sync</span> Andamento</span>' : ''}
                                ${m.status === 'done' ? 
                                    `<span class="text-[10px] font-bold uppercase text-green-600 flex items-center gap-1"><span class="material-symbols-outlined notranslate text-xs">check_circle</span> Concluída</span>` :
                                    `<button onclick="window.app.completeMicroAction('${m.id}')" class="text-[10px] font-bold uppercase text-primary hover:underline">Concluir</button>`
                                }
                            </div>
                        </div>
                    </div>
                `).join('');

                if (filtered.length === 0) {
                    listContainer.innerHTML = '<div class="col-span-full py-12 text-center text-outline italic">Nenhuma micro ação encontrada com estes filtros.</div>';
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
                const s1 = document.getElementById('diario-shutdown-1'); if (s1) s1.value = log.shutdown || '';
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
                
                const todayStr = new Date().toISOString().split('T')[0];
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
                    
                    let isDone = false;
                    if (mode === 'boolean') isDone = currentVal > 0;
                    else isDone = currentVal >= target;

                    // UI for mode
                    let controlHtml = '';
                    if (mode === 'boolean') {
                        controlHtml = `
                        <div class="w-7 h-7 rounded-full ${isDone ? 'bg-primary' : 'border-2 border-outline-variant hover:border-primary'} flex items-center justify-center shrink-0 cursor-pointer transition-colors" onclick="event.stopPropagation(); window.app.updateHabitLog('${habit.id}', '${todayStr}', ${isDone ? 0 : 1})">
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
                        const ds = d.toISOString().split('T')[0];
                        const val = logs[ds] || 0;
                        let dDone = false;
                        if (mode === 'boolean') dDone = val > 0;
                        else dDone = val >= target;
                        
                        weekHtml += `<div class="flex-1 h-1.5 rounded-full ${dDone ? 'bg-primary' : 'bg-surface-container-high'}" title="${ds}"></div>`;
                    }
                    weekHtml += '</div>';

                    // Track progress line
                    let progressText = '';
                    if (mode === 'numeric') progressText = `${currentVal}/${target}`;
                    if (mode === 'timer') progressText = `${currentVal}m/${target}m`;
                    
                    habitsHtml += `
                    <div class="min-w-[240px] max-w-[280px] bg-surface-container-low p-4 rounded-xl border border-transparent flex flex-col justify-between transition-all hover:shadow-md relative group ${isDone ? 'opacity-70' : ''}">
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
                    const overdueTag = isOverdue ? '<span class="inline-block mt-1 ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Atrasada</span>' : '';
                    const statusTag = micro.status === 'in_progress'
                        ? '<span class="inline-block mt-1 ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Em Andamento</span>'
                        : '';
                    const startBtn = shouldStart
                        ? `<button onclick="event.stopPropagation(); app.startEntity('${micro.id}', 'micros');" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">Iniciar</button>`
                        : '';

                    html += `
                    <div class="space-y-2">
                        <div class="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 group cursor-pointer active:scale-[0.98] transition-all checklist-item" onclick="document.getElementById('trail-${idx}').classList.toggle('hidden')">
                            <div class="w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors checklist-item-check" onclick="event.stopPropagation(); app.completeMicroAction('${micro.id}');"></div>
                            <div class="flex-1">
                                <p class="text-base text-on-surface font-medium">${micro.title}</p>
                                <span class="inline-block mt-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded-full area-tag">${micro.dimension}</span>${statusTag}${overdueTag}
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
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

                const statFilter = app.planosStatusFilter || 'active';
                const base = 'px-4 py-1.5 rounded-full text-xs font-bold transition-colors';
                const on = 'bg-primary text-on-primary';
                const off = 'bg-surface-container-high text-on-surface-variant hover:brightness-95';
                const btnPending = document.getElementById('btn-stat-pending');
                const btnInProgress = document.getElementById('btn-stat-in-progress');
                const btnDone = document.getElementById('btn-stat-done');
                const btnAll = document.getElementById('btn-stat-all');
                const btnActive = document.getElementById('btn-stat-active'); // legado
                if (btnPending) btnPending.className = `${base} ${statFilter === 'pending' ? on : off}`;
                if (btnInProgress) btnInProgress.className = `${base} ${statFilter === 'in_progress' ? on : off}`;
                if (btnDone) btnDone.className = `${base} ${statFilter === 'done' ? on : off}`;
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
                         const m = o ? state.entities.metas.find(x => x.id === o.metaId) : null;
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
                        if (m) { okrId = m.okrId; const o = state.entities.okrs.find(x => x.id === okrId); if (o) metaId = o.metaId; }
                    } else if (type === 'macros') {
                        okrId = item.okrId;
                        const o = state.entities.okrs.find(x => x.id === okrId);
                        if (o) metaId = o.metaId;
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
                    const statFilter = app.planosStatusFilter || 'active';
                    let passStatus = false;
                    if (statFilter === 'active') passStatus = !isDone && i.status !== 'abandoned'; // legado
                    else if (statFilter === 'pending') passStatus = !isDone && i.status !== 'abandoned' && i.status !== 'in_progress';
                    else if (statFilter === 'in_progress') passStatus = i.status === 'in_progress';
                    else if (statFilter === 'done') passStatus = isDone;
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
                        <h4 class="font-headline text-lg font-bold text-on-background">Nenhum registo encontrado</h4>
                        <p class="text-sm text-outline mt-2 max-w-sm">Ainda não tem planos definidos nesta categoria. Clique no botão de adicionar (+) para começar a planear.</p>
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
                            if (item.parentMetaId) {
                                const parentMeta = state.entities.metas.find(x => x.id === item.parentMetaId);
                                trailNodes.push({ label: 'Meta Pai', title: parentMeta ? parentMeta.title : '-' });
                            }
                            trailNodes.push({ label: 'Horizonte', title: `${app.getMetaHorizonYears(item)} anos` });
                            trailNodes.push({ label: 'Área', title: resolveDim(item) || '-' });
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

                        const isInProgress = item.status === 'in_progress';
                        const highlightClass = isInProgress ? 'ring-2 ring-amber-500/50 border-amber-500/50 shadow-md shadow-amber-500/10' : 'border-outline-variant/10 shadow-sm';

                        html += `
                        <div data-entity-id="${item.id}" data-entity-type="${entityType}" class="bg-gradient-to-b from-surface-container-lowest to-surface p-6 rounded-2xl border ${highlightClass} hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer overflow-hidden relative" onclick="app.toggleTrail(this)">
                            <div class="flex justify-between items-start mb-4 gap-3">
                                <div class="space-y-1 flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="shrink-0 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-label font-bold uppercase tracking-wider">${item.dimension}</span>
                                        ${isAligned ? '<span class="shrink-0 bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded border border-primary/20 font-bold">ALINHADO</span>' : ''}
                                    </div>
                                    <h4 class="font-headline text-xl font-medium truncate">${item.title}</h4>
                                    
                                    <!-- Ações do Card Refatoradas -->
                                    <div class="grid grid-cols-2 gap-2 mt-4">
                                        <button onclick="event.stopPropagation(); app.openEntityReview('${item.id}', '${entityType}')" 
                                            class="col-span-2 p-2.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all">
                                            <span class="material-symbols-outlined notranslate text-base">settings_accessibility</span> Gerir Estratégia
                                        </button>
                                        
                                        <button onclick="event.stopPropagation(); app.editEntity('${item.id}', '${entityType}')" 
                                            class="p-2 border border-outline-variant/30 hover:bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-on-surface transition-colors">
                                            <span class="material-symbols-outlined notranslate text-base">edit</span> Editar
                                        </button>

                                        ${item.status === 'pending' ? `
                                            <button onclick="event.stopPropagation(); app.startEntity('${item.id}', '${entityType}')" 
                                                class="p-2 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 transition-colors">
                                                <span class="material-symbols-outlined notranslate text-base">play_arrow</span> Iniciar
                                            </button>
                                        ` : (prog < 100 ? `
                                            <button onclick="event.stopPropagation(); app.forceCompleteEntity('${item.id}', '${entityType}')" 
                                                class="p-2 border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-green-700 dark:text-green-400 transition-colors">
                                                <span class="material-symbols-outlined notranslate text-base">check_circle</span> Concluir
                                            </button>
                                        ` : `
                                            <button onclick="event.stopPropagation(); app.deleteEntity('${item.id}', '${entityType}')" 
                                                class="p-2 border border-outline-variant/30 hover:bg-error-container/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-outline hover:text-error transition-colors">
                                                <span class="material-symbols-outlined notranslate text-base">delete</span> Excluir
                                            </button>
                                        `)}
                                    </div>
                                </div>
                                ${prog >= 100 ? 
                                    `<span class="shrink-0 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Concluído</span>` : 
                                    (isInProgress ? `<span class="bg-amber-100 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 animate-pulse">Iniciado</span>` : `<span class="shrink-0 bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider">Ativo</span>`)
                                }
                            </div>
                            <div class="flex items-center gap-2 text-stone-400 text-xs mb-6 px-1">
                                <span class="material-symbols-outlined notranslate text-sm">event</span>
                                ${app.formatPrazoDisplay(item)}
                            </div>
                            <div class="space-y-2 px-1">
                                <div class="flex justify-between text-[10px] font-label text-stone-500 uppercase">
                                    <span>Progresso</span>
                                    <span>${prog.toFixed(0)}%</span>
                                </div>
                                <div class="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
                                    <div class="h-full bg-primary rounded-full transition-all" style="width: ${visualProg}%"></div>
                                </div>
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
                        const score = Number(item.val);
                        const normalizedVal = score > 10 ? score / 10 : score;
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
        const statFilter = window.app.planosStatusFilter || 'active';
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

        const renderRow = (entity, tipo, marginClass, parentDim) => {
            if (!entity.title || entity.title.trim() === '') return;
            const durationFallbackByType = { metas: 60, okrs: 45, macros: 21, micros: 5 };
            const fallbackDays = durationFallbackByType[tipo] || 7;
            const hasPrazo = entity.prazo && entity.prazo.trim() !== '';
            const hasInicio = entity.inicioDate && entity.inicioDate.trim() !== '';

            let taskStart = hasInicio ? new Date(entity.inicioDate + 'T00:00:00') : null;
            let taskEnd = hasPrazo ? new Date(entity.prazo + 'T00:00:00') : null;

            if (!taskStart && taskEnd) {
                taskStart = new Date(taskEnd.getTime());
                taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
            } else if (taskStart && !taskEnd) {
                taskEnd = new Date(taskStart.getTime());
                taskEnd.setDate(taskEnd.getDate() + (fallbackDays - 1));
            } else if (!taskStart && !taskEnd) {
                taskEnd = new Date(today);
                taskStart = new Date(today);
                taskStart.setDate(taskStart.getDate() - (fallbackDays - 1));
            }

            if (isNaN(taskStart.getTime())) taskStart = new Date(today);
            if (isNaN(taskEnd.getTime())) taskEnd = new Date(today);
            if (taskEnd < taskStart) {
                const swap = taskStart;
                taskStart = taskEnd;
                taskEnd = swap;
            }

            if (taskEnd < startDate || taskStart > endDate) return; // fora da janela
            
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
            const visualWidth = Math.max(widthPct, minWidthPctByType[tipo] || 3);
            const showInlineTitle = visualWidth >= 8;
            
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
                       style="left:${leftPct.toFixed(2)}%; width:${visualWidth.toFixed(2)}%" title="${entity.title} | Progresso: ${progress}%">
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

        const processMetas = () => {
             const metas = (state.entities.metas || []).filter(m => {
                 if (!filterStatus(m)) return false;
                 const dim = m.dimensionName || m.dimension || 'Geral';
                 if (currentFilter !== 'Todas' && dim !== currentFilter) return false;
                 return true;
             });
             metas.forEach(meta => {
                 const dim = meta.dimensionName || meta.dimension || 'Geral';
                 renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                 processOkrs(meta.id, dim);
             });
        }

        // Lógica de Processamento de Árvore (Hierárquica vs. Global)
        if (hType && hId) {
            if (hType === 'metas') {
                const meta = state.entities.metas.find(m => m.id === hId);
                if (meta && filterStatus(meta)) {
                    const dim = meta.dimensionName || meta.dimension || 'Geral';
                    renderRow(meta, 'metas', 'ml-0 border-l-4 pl-2', dim);
                    processOkrs(meta.id, dim);
                }
            } else if (hType === 'okrs') {
                const okr = state.entities.okrs.find(o => o.id === hId);
                if (okr && filterStatus(okr)) {
                    renderRow(okr, 'okrs', 'ml-0 border-l-4 pl-2', 'Geral');
                    processMacros(okr.id, 'Geral');
                }
            } else if (hType === 'macros') {
                const macro = state.entities.macros.find(m => m.id === hId);
                if (macro && filterStatus(macro)) {
                    renderRow(macro, 'macros', 'ml-0 border-l-4 pl-2', 'Geral');
                    processMicros(macro.id, 'Geral');
                }
            } else if (hType === 'micros') {
                const micro = state.entities.micros.find(m => m.id === hId);
                if (micro && filterStatus(micro)) {
                    renderRow(micro, 'micros', 'ml-0 border-l-4 pl-2', 'Geral');
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
                    if (avg >= 99) {
                        okr.progress = 100;
                        okr.status = 'done';
                    } else {
                        okr.progress = Math.round(avg);
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
        
        this.saveState(true);
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
        this.saveState(true);
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

    deleteEntity: function(id, type) {
        const state = window.sistemaVidaState;
        const list = type === 'habits' ? state.habits : state.entities[type];
        const item = list.find(e => e.id === id);
        
        if (item && confirm(`Deseja realmente excluir "${item.title}"?`)) {
            // Guarda o ID do pai antes de remover para cascata
            const parentId = item.macroId || item.okrId || item.parentMetaId || item.metaId;

            if (type === 'habits') {
                state.habits = state.habits.filter(e => e.id !== id);
            } else {
                state.entities[type] = state.entities[type].filter(e => e.id !== id);
            }

            // Recálculo da cascata
            if (parentId) {
                const parentType = type === 'micros' ? 'macros' : (type === 'macros' ? 'okrs' : 'metas');
                this.updateCascadeProgress(parentId, parentType);
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
        if (inicioInput) inicioInput.value = item.inicioDate || item.agendamento?.inicioDate || item.prazo || '';
        if (prazoInput) prazoInput.value = item.prazo || '';
        document.getElementById('crud-context').value = item.purpose || item.description || item.indicator || '';
        
        // Compatibilidade retrô: agendamento antigo migra visualmente para datas reais
        
        if (type === 'habits') {
            document.getElementById('crud-trigger').value = item.trigger || '';
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
        
        // Seta o pai após popular a lista
        const parentSelect = document.getElementById('create-parent');
        if (parentSelect) {
            const parentId = type === 'metas'
                ? (item.parentMetaId || '')
                : (item.metaId || item.okrId || item.macroId || '');
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

