/**
 * Phase 6 — Biblioteca de Hábitos Sugeridos
 * Catálogo curado de hábitos-base agrupados por dimensão.
 * Permite ao usuário partir de um template pronto e personalizar antes de salvar.
 *
 * Attached to the app object via attachHabitSuggestions(app).
 */

const HABIT_SUGGESTIONS = [
    /* ── Saúde ─────────────────────────────────────────────── */
    {
        id: 'sleep_earlier',
        dimension: 'Saúde',
        title: 'Deitar antes das 23h',
        description: 'Ajuste leve para proteger recuperação e energia no dia seguinte.',
        trigger: 'Depois de desligar o celular à noite',
        routine: 'Ir para a cama antes das 23h',
        reward: 'Acordar mais recuperado',
        steps: ['Desligar telas 30 min antes', 'Separar roupa do dia seguinte', 'Deitar antes das 23h'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'daily',
        startTime: '22:30',
        continuous: true
    },
    {
        id: 'sleep_no_screen',
        dimension: 'Saúde',
        title: 'Evitar tela 30 min antes de dormir',
        description: 'Ritual curto para reduzir estímulo e facilitar o sono.',
        trigger: 'Quando faltar 30 min para dormir',
        routine: 'Guardar o celular e sair das telas',
        reward: 'Sono mais tranquilo',
        steps: ['Ativar modo noturno', 'Guardar o celular longe da cama', 'Trocar tela por leitura leve'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'daily',
        startTime: '22:00',
        continuous: true
    },
    {
        id: 'health_walk',
        dimension: 'Saúde',
        title: 'Caminhada de 20 minutos',
        description: 'Movimento simples para corpo, humor e clareza mental.',
        trigger: 'Depois do café da manhã ou no fim da tarde',
        routine: 'Caminhar por 20 minutos',
        reward: 'Corpo mais desperto e mente mais leve',
        steps: ['Calçar tênis', 'Sair de casa', 'Caminhar por 20 minutos'],
        trackMode: 'timer',
        targetValue: 20,
        frequency: 'daily',
        startTime: '07:30',
        continuous: true
    },
    {
        id: 'health_water',
        dimension: 'Saúde',
        title: 'Beber 2 L de água',
        description: 'Base física pequena que melhora energia e constância.',
        trigger: 'Ao iniciar cada bloco do dia',
        routine: 'Beber água ao longo do dia',
        reward: 'Mais energia e menos fadiga',
        steps: ['Encher a garrafa pela manhã', 'Beber 1 copo a cada bloco', 'Completar 2 L até o fim do dia'],
        trackMode: 'numeric',
        targetValue: 8,
        frequency: 'daily',
        startTime: '08:00',
        reminderIntervalEnabled: true,
        reminderWindowStart: '08:00',
        reminderWindowEnd: '20:00',
        reminderIntervalMin: 60,
        continuous: true
    },
    /* ── Carreira ───────────────────────────────────────────── */
    {
        id: 'focus_block',
        dimension: 'Carreira',
        title: 'Bloco de foco de 90 minutos',
        description: 'Sessão protegida para a tarefa mais importante do dia.',
        trigger: 'Ao iniciar o primeiro bloco de trabalho',
        routine: 'Trabalhar por 90 minutos sem interrupção',
        reward: 'Avanço concreto no que realmente importa',
        steps: ['Definir uma meta única', 'Silenciar notificações', 'Rodar o bloco até o fim'],
        trackMode: 'timer',
        targetValue: 90,
        frequency: 'daily',
        startTime: '09:00',
        continuous: true
    },
    {
        id: 'weekly_plan',
        dimension: 'Carreira',
        title: 'Planejamento semanal',
        description: 'Escolha da carga da semana para evitar dispersão.',
        trigger: 'No domingo à noite ou segunda cedo',
        routine: 'Planejar a semana no app',
        reward: 'Clareza sobre o que merece energia',
        steps: ['Abrir a aba Semanal', 'Escolher micros da semana', 'Definir uma intenção da semana'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'specific',
        specificDays: ['0'],
        startTime: '19:00',
        continuous: true
    },
    /* ── Mente ──────────────────────────────────────────────── */
    {
        id: 'mind_reading',
        dimension: 'Mente',
        title: 'Leitura de 15 minutos',
        description: 'Ritual curto para nutrir repertório e profundidade.',
        trigger: 'Depois do almoço ou antes de dormir',
        routine: 'Ler por 15 minutos',
        reward: 'Mais repertório e calma mental',
        steps: ['Escolher o livro', 'Ler 15 minutos', 'Marcar uma ideia importante'],
        trackMode: 'timer',
        targetValue: 15,
        frequency: 'daily',
        startTime: '21:30',
        continuous: true
    },
    {
        id: 'recovery_breath',
        dimension: 'Mente',
        title: '3 respirações antes de reunião difícil',
        description: 'Micro-pausa para reduzir reatividade antes de conversas tensas.',
        trigger: 'Antes de uma reunião difícil',
        routine: 'Fazer 3 respirações lentas',
        reward: 'Mais presença e menos impulsividade',
        steps: ['Parar por 20 segundos', 'Inspirar e expirar 3 vezes', 'Entrar com a intenção clara'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'daily',
        startTime: '',
        continuous: true
    },
    /* ── Relacionamentos ────────────────────────────────────── */
    {
        id: 'connect_weekly',
        dimension: 'Relacionamentos',
        title: 'Check-in com alguém importante',
        description: 'Uma mensagem ou ligação para manter vínculos com intencionalidade.',
        trigger: 'Na quarta-feira ou no fim de semana',
        routine: 'Entrar em contato com uma pessoa próxima',
        reward: 'Relacionamento mais presente e recíproco',
        steps: ['Escolher quem', 'Mandar mensagem ou ligar', 'Perguntar como está de verdade'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'specific',
        specificDays: ['3'],
        startTime: '18:00',
        continuous: true
    },
    /* ── Propósito ──────────────────────────────────────────── */
    {
        id: 'purpose_review',
        dimension: 'Propósito',
        title: 'Revisão semanal de propósito',
        description: 'Pausa de 10 minutos para reconectar ação diária ao que realmente importa.',
        trigger: 'No domingo à noite',
        routine: 'Abrir Propósito e reler os resumos de Visão, Legado e Ikigai',
        reward: 'Semana com mais clareza de direção',
        steps: ['Abrir aba Propósito', 'Reler Visão e Legado', 'Ajustar intenção da semana se necessário'],
        trackMode: 'boolean',
        targetValue: 1,
        frequency: 'specific',
        specificDays: ['0'],
        startTime: '20:00',
        continuous: true
    }
];

function getHabitSuggestionsCatalog() {
    return HABIT_SUGGESTIONS.map(item => ({
        ...item,
        steps: Array.isArray(item.steps) ? [...item.steps] : [],
        specificDays: Array.isArray(item.specificDays) ? [...item.specificDays] : []
    }));
}

function groupHabitSuggestionsByDimension() {
    return getHabitSuggestionsCatalog().reduce((acc, item) => {
        if (!acc[item.dimension]) acc[item.dimension] = [];
        acc[item.dimension].push(item);
        return acc;
    }, {});
}

function closeHabitSuggestionsModal() {
    const modal = document.getElementById('habit-suggestions-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderHabitSuggestionsModal() {
    const container = document.getElementById('habit-suggestions-modal-list');
    if (!container) return;
    const grouped = this.groupHabitSuggestionsByDimension();
    const dims = Object.keys(grouped);
    container.innerHTML = dims.map((dimension) => {
        const items = grouped[dimension] || [];
        return `
            <section class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-primary">${this.escapeHtml(dimension)}</p>
                    <span class="text-[10px] text-outline">${items.length}</span>
                </div>
                <div class="space-y-3">
                    ${items.map((item) => `
                        <article class="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-on-surface">${this.escapeHtml(item.title)}</p>
                                    <p class="mt-1 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(item.description)}</p>
                                </div>
                                <button type="button" onclick="window.app.createHabitFromSuggestion('${this.escapeHtml(item.id)}')"
                                    class="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-primary hover:opacity-90 transition-opacity">
                                    <span class="material-symbols-outlined notranslate text-[13px]">add</span>
                                    Usar
                                </button>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
}

function openHabitSuggestionsModal() {
    const modal = document.getElementById('habit-suggestions-modal');
    if (!modal) return;
    this.renderHabitSuggestionsModal();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function createHabitFromSuggestion(id) {
    const suggestion = this.getHabitSuggestionsCatalog().find(item => item.id === id);
    if (!suggestion) return;
    this.closeHabitSuggestionsModal();
    this.openCreateModal('habits');
    setTimeout(() => {
        const setValue = (fieldId, value) => {
            const el = document.getElementById(fieldId);
            if (el) el.value = value;
        };
        setValue('crud-title', suggestion.title || '');
        setValue('crud-dimension', suggestion.dimension || 'Saúde');
        setValue('crud-trigger', suggestion.trigger || '');
        setValue('habit-routine', suggestion.routine || '');
        setValue('habit-reward', suggestion.reward || '');
        setValue('habit-steps', Array.isArray(suggestion.steps) ? suggestion.steps.join('\n') : '');
        setValue('habit-track-mode', suggestion.trackMode || 'boolean');
        if (typeof this.onHabitModeChange === 'function') this.onHabitModeChange(suggestion.trackMode || 'boolean');
        setValue('habit-target', suggestion.targetValue || 1);
        setValue('habit-frequency', suggestion.frequency || 'daily');
        if (typeof this.onHabitFreqChange === 'function') this.onHabitFreqChange(suggestion.frequency || 'daily');
        setValue('habit-start-time', suggestion.startTime || '');
        const reminderToggle = document.getElementById('habit-reminder-enabled');
        if (reminderToggle) reminderToggle.checked = true;
        const reminderIntervalToggle = document.getElementById('habit-reminder-interval-enabled');
        if (reminderIntervalToggle) reminderIntervalToggle.checked = !!suggestion.reminderIntervalEnabled;
        if (typeof this.onHabitReminderIntervalToggle === 'function') this.onHabitReminderIntervalToggle(!!suggestion.reminderIntervalEnabled);
        setValue('habit-reminder-window-start', suggestion.reminderWindowStart || '');
        setValue('habit-reminder-window-end', suggestion.reminderWindowEnd || '');
        setValue('habit-reminder-interval-min', suggestion.reminderIntervalMin || 60);
        const continuousEl = document.getElementById('habit-continuous');
        if (continuousEl) {
            continuousEl.checked = !!suggestion.continuous;
            if (typeof this.onHabitContinuousChange === 'function') this.onHabitContinuousChange(!!suggestion.continuous);
        }
        const daysSelect = document.getElementById('habit-days');
        if (daysSelect && Array.isArray(suggestion.specificDays)) {
            Array.from(daysSelect.options || []).forEach((opt) => {
                opt.selected = suggestion.specificDays.includes(opt.value);
            });
        }
        if (typeof this.showToast === 'function') {
            this.showToast(`Template aplicado: ${suggestion.title}. Ajuste antes de salvar.`, 'success');
        }
    }, 80);
}

export function attachHabitSuggestions(app) {
    app.getHabitSuggestionsCatalog = getHabitSuggestionsCatalog;
    app.groupHabitSuggestionsByDimension = groupHabitSuggestionsByDimension;
    app.openHabitSuggestionsModal = openHabitSuggestionsModal;
    app.closeHabitSuggestionsModal = closeHabitSuggestionsModal;
    app.renderHabitSuggestionsModal = renderHabitSuggestionsModal;
    app.createHabitFromSuggestion = createHabitFromSuggestion;
}
