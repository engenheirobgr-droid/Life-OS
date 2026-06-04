const BASE_PROTOCOLS = [
    {
        id: 'protocol_study',
        slug: 'study',
        title: 'Estudo',
        family: 'estudo',
        cadence: 'sessao',
        description: 'Sessao de estudo com foco em aprender, testar memoria, praticar e registrar duvidas.',
        rationaleShort: 'Ajuda a estudar com mais clareza e menos passividade.',
        evidenceCard: {
            summary: 'Combina estudo ativo, tentativa de lembrar sem consultar, explicacao com palavras proprias e aplicacao pratica.',
            principles: [
                'Lembrar sem olhar fortalece a retencao melhor do que apenas reler.',
                'Explicar com as proprias palavras ajuda a organizar o entendimento.',
                'Aplicar em exercicio ou caso pratico reduz a ilusao de aprendizagem.'
            ],
            references: [
                { label: 'Dunlosky et al. 2013', url: 'https://journals.sagepub.com/stoken/rbtfl/Z10jaVH/60XQM/full' },
                { label: 'Roediger & Karpicke 2006', url: 'https://doi.org/10.1111/j.1745-6916.2006.00012.x' },
                { label: 'Nature Reviews Psychology 2022', url: 'https://www.nature.com/articles/s44159-022-00089-1.pdf' }
            ]
        },
        steps: [
            { id: 'study_1', title: 'Escolher o tema da sessao', optional: false, kind: 'prepare' },
            { id: 'study_2', title: 'Estudar o material', optional: false, kind: 'learn' },
            { id: 'study_3', title: 'Tentar lembrar sem olhar', optional: false, kind: 'recall' },
            { id: 'study_4', title: 'Resumir com minhas palavras', optional: false, kind: 'synthesize' },
            { id: 'study_5', title: 'Fazer exercicio ou aplicacao pratica', optional: false, kind: 'apply' },
            { id: 'study_6', title: 'Anotar duvidas', optional: false, kind: 'review' },
            { id: 'study_7', title: 'Escrever o que falta estudar depois', optional: false, kind: 'close' }
        ],
        suggestedHabit: {
            dimension: 'Carreira',
            trackMode: 'timer',
            targetValue: 90,
            frequency: 'specific',
            specificDays: ['1', '3', '5'],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '19:00',
            continuous: true,
            trigger: 'Quando eu iniciar meu bloco de estudo',
            routine: 'Estudar com um bloco de foco e fechar com registro claro do que aprendi.',
            reward: 'Sair da sessao com avancos e proximos passos definidos.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_start_day',
        slug: 'start-day',
        title: 'Inicio do dia',
        family: 'rotina',
        cadence: 'diario',
        description: 'Ritual de abertura do dia para ativar corpo, mente e clareza de prioridade.',
        rationaleShort: 'Uma sequencia curta e previsivel reduz atrito de inicio e melhora direcao do dia.',
        evidenceCard: {
            summary: 'Combina design de ambiente, acao em sequencia e foco nas primeiras decisoes para reduzir piloto automatico.',
            principles: [
                'Sequencias estaveis no mesmo horario aumentam consistencia de execucao.',
                'Comecar com passos simples reduz resistencia e acelera entrada em acao.',
                'Definir prioridade e agenda cedo reduz dispersao ao longo do dia.'
            ],
            references: [
                { label: 'Lally et al. 2010', url: 'https://openresearch.surrey.ac.uk/esploro/outputs/journalArticle/How-are-habits-formed-Modelling-habit/99783513802346' },
                { label: 'Gollwitzer 1999 (Implementation Intentions)', url: 'https://psycnet.apa.org/record/1999-05116-005' }
            ]
        },
        steps: [
            { id: 'start_day_1', title: 'Organizar a cama', optional: false, kind: 'reset' },
            { id: 'start_day_2', title: 'Beber agua', optional: false, kind: 'care' },
            { id: 'start_day_3', title: 'Meditar', optional: false, kind: 'mind' },
            { id: 'start_day_4', title: 'Higiene basica', optional: false, kind: 'care' },
            { id: 'start_day_5', title: 'Skincare: limpeza do rosto, hidratante e protetor solar', optional: false, kind: 'care' },
            { id: 'start_day_6', title: 'Cafe da manha', optional: false, kind: 'care' },
            { id: 'start_day_7', title: 'Check-in do dia no Life OS', optional: false, kind: 'plan' },
            { id: 'start_day_8', title: 'Revisar agenda do dia', optional: false, kind: 'plan' },
            { id: 'start_day_9', title: 'Acompanhar noticias com tempo limitado', optional: true, kind: 'review' }
        ],
        suggestedHabit: {
            dimension: 'Mente',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'daily',
            specificDays: [],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '06:30',
            continuous: true,
            trigger: 'Ao acordar',
            routine: 'Executar o protocolo de inicio do dia.',
            reward: 'Comecar o dia com presenca, clareza e prioridade definida.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_night',
        slug: 'night',
        title: 'Noite',
        family: 'rotina',
        cadence: 'diario',
        description: 'Ritual de fechamento para desacelerar, organizar o proximo dia e proteger o sono.',
        rationaleShort: 'Fechar o dia com intencao reduz carga mental e melhora preparacao para o dia seguinte.',
        evidenceCard: {
            summary: 'Combina descarregamento mental, reducao de estimulacao e rotina previsivel de sono.',
            principles: [
                'Reduzir estimulacao noturna favorece transicao para descanso.',
                'Preparar o dia seguinte diminui ansiedade de inicio do proximo ciclo.',
                'Ritual noturno consistente melhora regularidade de sono.'
            ],
            references: [
                { label: 'Sleep Education - Healthy Sleep Habits', url: 'https://sleepeducation.org/healthy-sleep/healthy-sleep-habits/' },
                { label: 'Sleep hygiene review - ScienceDirect', url: 'https://www.sciencedirect.com/science/article/pii/S1087079224000340' }
            ]
        },
        steps: [
            { id: 'night_1', title: 'Higiene basica', optional: false, kind: 'care' },
            { id: 'night_2', title: 'Skincare: limpeza do rosto, tratamento especifico (se usar) e hidratante', optional: false, kind: 'care' },
            { id: 'night_3', title: 'Alinhar a barba, se necessario', optional: true, kind: 'care' },
            { id: 'night_4', title: 'Organizar o dia seguinte: roupa, mochila, mesa e materiais', optional: false, kind: 'prepare' },
            { id: 'night_5', title: 'Checkout diario no Life OS', optional: false, kind: 'review' },
            { id: 'night_6', title: 'Reduzir telas, trabalho, redes sociais e noticias pesadas', optional: false, kind: 'mind' },
            { id: 'night_7', title: 'Leitura leve', optional: true, kind: 'mind' },
            { id: 'night_8', title: 'Oracao', optional: true, kind: 'mind' },
            { id: 'night_9', title: 'Dormir', optional: false, kind: 'close' }
        ],
        suggestedHabit: {
            dimension: 'Saude',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'daily',
            specificDays: [],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '21:30',
            continuous: true,
            trigger: 'Ao iniciar o fechamento do dia',
            routine: 'Executar o protocolo da noite.',
            reward: 'Encerrar o dia com mente leve e sono protegido.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_cleaning_daily',
        slug: 'cleaning-daily',
        title: 'Limpeza diaria',
        family: 'limpeza',
        cadence: 'diario',
        description: 'Reset rapido da casa para reduzir acumulo e manter o ambiente funcional.',
        rationaleShort: 'Pequenos resets diarios evitam que a casa vire um mutirao.',
        evidenceCard: {
            summary: 'Este protocolo e operacional: reduz acumulacao de bagunca e distribui manutencao ao longo da semana.',
            principles: [
                'Frequencia alta com passos curtos reduz friccao de retomada.',
                'Ambiente menos carregado tende a facilitar continuidade de outras rotinas.',
                'Checklist simples melhora consistencia em manutencao domestica.'
            ],
            references: []
        },
        steps: [
            { id: 'clean_daily_1', title: 'Arrumar a cama', optional: false, kind: 'reset' },
            { id: 'clean_daily_2', title: 'Lavar ou guardar a louca', optional: false, kind: 'reset' },
            { id: 'clean_daily_3', title: 'Guardar itens fora do lugar', optional: false, kind: 'reset' },
            { id: 'clean_daily_4', title: 'Limpar bancada e pia', optional: false, kind: 'reset' },
            { id: 'clean_daily_5', title: 'Revisar chao e lixo leve', optional: false, kind: 'reset' }
        ],
        suggestedHabit: {
            dimension: 'Mente',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'daily',
            specificDays: [],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '20:00',
            continuous: true,
            trigger: 'Antes de encerrar o dia',
            routine: 'Fazer um reset rapido da casa.',
            reward: 'Acordar com a casa mais leve e funcional.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_cleaning_weekly',
        slug: 'cleaning-weekly',
        title: 'Limpeza semanal',
        family: 'limpeza',
        cadence: 'semanal',
        description: 'Manutencao semanal para cuidar do que o reset diario nao cobre.',
        rationaleShort: 'Organiza a manutencao pesada em um bloco previsivel da semana.',
        evidenceCard: {
            summary: 'Este protocolo e operacional: distribui tarefas mais densas em uma revisao recorrente.',
            principles: [
                'Separar tarefas semanais evita acumulacao silenciosa.',
                'Checklist fixo reduz esquecimento de areas menos visiveis.',
                'Cadencia previsivel facilita aderencia.'
            ],
            references: []
        },
        steps: [
            { id: 'clean_weekly_1', title: 'Trocar roupa de cama', optional: false, kind: 'maintenance' },
            { id: 'clean_weekly_2', title: 'Limpar banheiro', optional: false, kind: 'maintenance' },
            { id: 'clean_weekly_3', title: 'Limpar cozinha e eletrodomesticos principais', optional: false, kind: 'maintenance' },
            { id: 'clean_weekly_4', title: 'Revisar a geladeira', optional: false, kind: 'maintenance' },
            { id: 'clean_weekly_5', title: 'Organizar os pontos de bagunca da casa', optional: false, kind: 'maintenance' }
        ],
        suggestedHabit: {
            dimension: 'Mente',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'specific',
            specificDays: ['6'],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '10:00',
            continuous: true,
            trigger: 'No bloco de manutencao da semana',
            routine: 'Fazer a limpeza semanal da casa.',
            reward: 'Casa mais organizada sem acumulo pesado.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_cleaning_monthly',
        slug: 'cleaning-monthly',
        title: 'Limpeza mensal',
        family: 'limpeza',
        cadence: 'mensal',
        description: 'Revisao mensal de sujeira estrutural, excesso e manutencao mais invisivel.',
        rationaleShort: 'Evita degradacao silenciosa e tarefas esquecidas por meses.',
        evidenceCard: {
            summary: 'Este protocolo e operacional: trata manutencao estrutural que nao cabe no ritmo diario ou semanal.',
            principles: [
                'Cadencia mensal reduz esquecimento de tarefas menos frequentes.',
                'Revisao estrutural previne acumulo mais dificil de reverter.',
                'Bloco mensal ajuda a manter a casa previsivel ao longo do tempo.'
            ],
            references: []
        },
        steps: [
            { id: 'clean_monthly_1', title: 'Limpar areas internas de armarios ou superficies menos tocadas', optional: false, kind: 'structural' },
            { id: 'clean_monthly_2', title: 'Revisar lixeiras e areas umidas', optional: false, kind: 'structural' },
            { id: 'clean_monthly_3', title: 'Limpar fogao, forno ou area pesada', optional: false, kind: 'structural' },
            { id: 'clean_monthly_4', title: 'Revisar textis maiores', optional: false, kind: 'structural' },
            { id: 'clean_monthly_5', title: 'Descartar ou reorganizar excessos', optional: false, kind: 'structural' }
        ],
        suggestedHabit: {
            dimension: 'Mente',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'monthly',
            specificDays: [],
            intervalDays: 0,
            dayOfMonth: 1,
            scheduleStartDate: '',
            startTime: '09:00',
            continuous: true,
            trigger: 'No inicio do ciclo mensal',
            routine: 'Fazer a revisao mensal da casa.',
            reward: 'Evitar acumulacao e deixar a manutencao em dia.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_training',
        slug: 'training',
        title: 'Treino',
        family: 'treino',
        cadence: 'sessao',
        description: 'Sessao de treino com aquecimento, bloco principal, registro e encerramento.',
        rationaleShort: 'Ajuda a treinar com mais consistencia, seguranca e memoria do progresso.',
        evidenceCard: {
            summary: 'Baseado em principios gerais de preparacao, progressao e registro da sessao.',
            principles: [
                'Aquecimento melhora prontidao para o bloco principal.',
                'Registrar carga, repeticoes ou esforco ajuda a acompanhar progressao.',
                'Fechar a sessao com mobilidade e observacao reduz treino sem memoria.'
            ],
            references: [
                { label: 'ACSM - Physical Activity Guidelines', url: 'https://acsm.org/education-resources/trending-topics-resources/physical-activity-guidelines/' },
                { label: 'ACSM - Effective Resistance Training Plan', url: 'https://acsm.org/effective-resistance-training-program-infographic/' }
            ]
        },
        steps: [
            { id: 'training_1', title: 'Definir o treino do dia', optional: false, kind: 'prepare' },
            { id: 'training_2', title: 'Aquecer', optional: false, kind: 'prepare' },
            { id: 'training_3', title: 'Fazer o treino principal', optional: false, kind: 'perform' },
            { id: 'training_4', title: 'Anotar cargas, repeticoes ou esforco', optional: false, kind: 'track' },
            { id: 'training_5', title: 'Encerrar com mobilidade ou volta a calma', optional: true, kind: 'close' },
            { id: 'training_6', title: 'Escrever o ajuste do proximo treino', optional: true, kind: 'close' }
        ],
        suggestedHabit: {
            dimension: 'Saúde',
            trackMode: 'timer',
            targetValue: 60,
            frequency: 'specific',
            specificDays: ['1', '3', '5'],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '07:00',
            continuous: true,
            trigger: 'Quando eu iniciar meu treino',
            routine: 'Executar a sessao completa de treino.',
            reward: 'Treino registrado e progresso mais visivel.'
        },
        isBase: true,
        userEditable: true
    },
    {
        id: 'protocol_finances',
        slug: 'finances',
        title: 'Financas',
        family: 'financas',
        cadence: 'semanal',
        description: 'Revisao financeira periodica para dar clareza, detectar desvios e decidir ajustes.',
        rationaleShort: 'Ajuda a nao deixar a vida financeira rodar no automatico.',
        evidenceCard: {
            summary: 'Protocolo de higiene financeira baseado em consolidacao, revisao de desvios e decisao consciente.',
            principles: [
                'Olhar entradas e saidas com frequencia reduz surpresa financeira.',
                'Registrar decisoes evita esquecer ajustes combinados consigo mesmo.',
                'Acompanhamento recorrente melhora senso de controle e previsibilidade.'
            ],
            references: [
                { label: 'ANBIMA - Planeje seu orcamento', url: 'https://comoinvestir.anbima.com.br/planeje/orcamento/planeje-seu-orcamento/' },
                { label: 'OECD - Financial Education', url: 'https://www.oecd.org/finance/financial-education/latestdocuments/' }
            ]
        },
        steps: [
            { id: 'finances_1', title: 'Ver entradas e saidas do periodo', optional: false, kind: 'review' },
            { id: 'finances_2', title: 'Revisar gastos fora do esperado', optional: false, kind: 'review' },
            { id: 'finances_3', title: 'Conferir contas, cartoes e vencimentos', optional: false, kind: 'review' },
            { id: 'finances_4', title: 'Atualizar saldo, reserva e investimentos', optional: false, kind: 'review' },
            { id: 'finances_5', title: 'Registrar a decisao financeira da semana', optional: false, kind: 'decide' },
            { id: 'finances_6', title: 'Escrever o proximo ajuste', optional: true, kind: 'close' }
        ],
        suggestedHabit: {
            dimension: 'Finanças',
            trackMode: 'boolean',
            targetValue: 1,
            frequency: 'specific',
            specificDays: ['0'],
            intervalDays: 0,
            dayOfMonth: 0,
            scheduleStartDate: '',
            startTime: '18:00',
            continuous: true,
            trigger: 'No fechamento da semana',
            routine: 'Fazer minha revisao financeira.',
            reward: 'Mais clareza e controle sobre o dinheiro.'
        },
        isBase: true,
        userEditable: true
    }
];

function cloneProtocol(protocol) {
    return JSON.parse(JSON.stringify(protocol));
}

function getProtocolStepDefaultMinutes(step = {}) {
    const kind = String(step?.kind || 'step').trim().toLowerCase();
    const title = String(step?.title || '').trim().toLowerCase();
    if (['learn', 'recall', 'synthesize', 'apply', 'perform', 'maintenance', 'structural'].includes(kind)) return 15;
    if (['prepare', 'care', 'mind', 'plan', 'decide'].includes(kind)) return 10;
    if (['reset', 'track', 'review', 'close'].includes(kind)) return 5;
    if (title.includes('aquecer') || title.includes('along')) return 10;
    if (title.includes('treino principal') || title.includes('estudar o material')) return 25;
    if (title.includes('meditar') || title.includes('leitura')) return 15;
    return 8;
}

function normalizeProtocol(protocol = {}) {
    const steps = Array.isArray(protocol.steps) ? protocol.steps : [];
    const evidence = protocol.evidenceCard && typeof protocol.evidenceCard === 'object' ? protocol.evidenceCard : {};
    const suggestedHabit = protocol.suggestedHabit && typeof protocol.suggestedHabit === 'object' ? protocol.suggestedHabit : {};
    return {
        id: String(protocol.id || `protocol_${Date.now()}${Math.random().toString(36).slice(2, 6)}`),
        slug: String(protocol.slug || protocol.id || '').trim(),
        title: String(protocol.title || '').trim(),
        family: String(protocol.family || 'geral').trim(),
        cadence: String(protocol.cadence || 'sob_demanda').trim(),
        description: String(protocol.description || '').trim(),
        rationaleShort: String(protocol.rationaleShort || '').trim(),
        evidenceCard: {
            summary: String(evidence.summary || '').trim(),
            principles: Array.isArray(evidence.principles) ? evidence.principles.map(item => String(item || '').trim()).filter(Boolean) : [],
            references: Array.isArray(evidence.references)
                ? evidence.references.map(ref => ({
                    label: String(ref?.label || '').trim(),
                    url: String(ref?.url || '').trim()
                })).filter(ref => ref.label || ref.url)
                : []
        },
        steps: steps.map((step, idx) => ({
            id: String(step?.id || `step_${idx + 1}`),
            title: String(step?.title || '').trim(),
            optional: !!step?.optional,
            kind: String(step?.kind || 'step').trim(),
            estimatedMinutes: Math.max(1, Math.round(Number(step?.estimatedMinutes) || getProtocolStepDefaultMinutes(step)))
        })).filter(step => step.title),
        suggestedHabit: {
            dimension: String(suggestedHabit.dimension || '').trim(),
            trackMode: String(suggestedHabit.trackMode || 'boolean').trim(),
            targetValue: Number(suggestedHabit.targetValue || 1),
            frequency: String(suggestedHabit.frequency ?? '').trim(),
            specificDays: Array.isArray(suggestedHabit.specificDays) ? suggestedHabit.specificDays.map(String) : [],
            intervalDays: Math.max(0, Math.round(Number(suggestedHabit.intervalDays) || 0)),
            dayOfMonth: Math.max(0, Math.round(Number(suggestedHabit.dayOfMonth) || 0)),
            scheduleStartDate: String(suggestedHabit.scheduleStartDate || '').trim(),
            startTime: String(suggestedHabit.startTime || '').trim(),
            continuous: !!suggestedHabit.continuous,
            trigger: String(suggestedHabit.trigger || '').trim(),
            routine: String(suggestedHabit.routine || '').trim(),
            reward: String(suggestedHabit.reward || '').trim()
        },
        isBase: !!protocol.isBase,
        userEditable: protocol.userEditable !== false,
        createdAt: String(protocol.createdAt || '').trim(),
        updatedAt: String(protocol.updatedAt || '').trim()
    };
}

export function attachProtocolsModule(app) {
    Object.assign(app, {
        formatProtocolSuggestedHabitSummary: function(protocol) {
            const suggested = protocol?.suggestedHabit || {};
            const pieces = [];
            if (suggested.dimension) pieces.push(suggested.dimension);

            const frequency = String(suggested.frequency || '').trim();
            if (frequency === 'daily') pieces.push('Todos os dias');
            else if (frequency === 'specific') {
                const days = Array.isArray(suggested.specificDays) ? suggested.specificDays : [];
                pieces.push(days.length ? 'Dias específicos' : 'Frequencia personalizada');
            } else if (frequency === 'every_x_days' && Number(suggested.intervalDays) > 0) {
                pieces.push(`A cada ${Number(suggested.intervalDays)} dias`);
            } else if (frequency === 'monthly' && Number(suggested.dayOfMonth) > 0) {
                pieces.push(`Todo dia ${Number(suggested.dayOfMonth)}`);
            } else if (frequency === 'manual') {
                pieces.push('Sob demanda');
            }

            if (String(suggested.trackMode || '') === 'timer' && Number(suggested.targetValue) > 0) {
                pieces.push(`${Number(suggested.targetValue)} min`);
            } else if (String(suggested.trackMode || '') === 'numeric' && Number(suggested.targetValue) > 0) {
                pieces.push(`Meta ${Number(suggested.targetValue)}`);
            }

            if (suggested.startTime) pieces.push(suggested.startTime);
            return pieces.filter(Boolean).join(' · ');
        },

        getProtocolEstimatedMinutes: function(protocol, options = {}) {
            const normalized = protocol ? normalizeProtocol(protocol) : null;
            if (!normalized) return 0;
            const includeOptional = options.includeOptional === true;
            const steps = Array.isArray(normalized.steps) ? normalized.steps : [];
            const relevant = includeOptional ? steps : steps.filter((step) => !step.optional);
            const base = relevant.length ? relevant : steps;
            return base.reduce((sum, step) => sum + Math.max(1, Math.round(Number(step?.estimatedMinutes) || getProtocolStepDefaultMinutes(step))), 0);
        },

        parseProtocolStepLine: function(line = '', idx = 0) {
            const raw = String(line || '').trim();
            if (!raw) return null;
            const parts = raw.split('|').map((part) => String(part || '').trim()).filter(Boolean);
            const title = parts[0] || '';
            if (!title) return null;
            const maybeMinutes = Number(parts[1] || 0);
            return {
                id: `step_${idx + 1}`,
                title,
                optional: false,
                kind: 'step',
                estimatedMinutes: Math.max(1, Math.round(Number.isFinite(maybeMinutes) && maybeMinutes > 0 ? maybeMinutes : getProtocolStepDefaultMinutes({ title })))
            };
        },

        getBaseProtocolsCatalog: function() {
            return BASE_PROTOCOLS.map(cloneProtocol);
        },

        ensureProtocolsState: function() {
            const state = window.sistemaVidaState;
            if (!Array.isArray(state.protocols)) state.protocols = [];
            const existing = new Map(state.protocols.map(item => [String(item?.id || ''), normalizeProtocol(item)]));
            this.getBaseProtocolsCatalog().forEach((baseProtocol) => {
                const normalized = normalizeProtocol(baseProtocol);
                if (!existing.has(normalized.id)) {
                    const now = new Date().toISOString();
                    normalized.createdAt = now;
                    normalized.updatedAt = now;
                    existing.set(normalized.id, normalized);
                }
            });
            state.protocols = Array.from(existing.values()).filter(item => item.id && item.title);
        },

        getAllProtocols: function() {
            this.ensureProtocolsState();
            return (window.sistemaVidaState.protocols || []).map(normalizeProtocol);
        },

        getProtocolById: function(id) {
            this.ensureProtocolsState();
            return (window.sistemaVidaState.protocols || []).map(normalizeProtocol).find(item => item.id === id) || null;
        },

        getProtocolFamilies: function() {
            return {
                estudo: 'Estudo',
                rotina: 'Rotina',
                limpeza: 'Limpeza',
                treino: 'Treino',
                financas: 'Financas',
                geral: 'Geral'
            };
        },

        getProtocolCadenceLabel: function(value) {
            const map = {
                sessao: 'Sessao',
                diario: 'Diario',
                semanal: 'Semanal',
                mensal: 'Mensal',
                sob_demanda: 'Sob demanda'
            };
            return map[value] || 'Sob demanda';
        },

        renderProtocolsPanelLegacy: function() {
            this.ensureProtocolsState();
            const container = document.getElementById('protocols-container');
            if (!container) return;
            const protocols = this.getAllProtocols();
            const familyMap = this.getProtocolFamilies();
            const grouped = protocols.reduce((acc, item) => {
                const family = item.family || 'geral';
                if (!acc[family]) acc[family] = [];
                acc[family].push(item);
                return acc;
            }, {});

            const familyOrder = ['rotina', 'estudo', 'limpeza', 'treino', 'financas', 'geral'];
            const families = Object.keys(grouped).sort((a, b) => {
                const ia = familyOrder.indexOf(a);
                const ib = familyOrder.indexOf(b);
                if (ia === -1 && ib === -1) return a.localeCompare(b);
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
            container.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="ui-surface p-5">
                        <div class="flex flex-col gap-3">
                            <div class="flex flex-col gap-3">
                                <div class="min-w-0 max-w-2xl">
                                    <div class="flex items-center justify-between gap-3">
                                        <h3 class="min-w-0 pr-2 font-headline text-[1.75rem] italic font-bold leading-none text-on-background ui-section-title">Protocolos</h3>
                                        <button type="button" onclick="window.app.openProtocolModal()"
                                            class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-primary hover:opacity-90 active:scale-95 transition-all">
                                            <span class="material-symbols-outlined notranslate text-[14px]">add</span>
                                            Protocolo
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p class="max-w-2xl text-sm text-on-surface-variant leading-relaxed">Protocolos-base e versoes editadas para transformar rotinas recorrentes em passos claros, reutilizaveis e mais faceis de executar.</p>
                        </div>
                    </div>
                    ${families.map((family) => {
                        const items = grouped[family] || [];
                        return `
                            <section class="space-y-4">
                                <div class="flex items-center gap-3">
                                    <p class="ui-section-label text-primary">${this.escapeHtml(familyMap[family] || family)}</p>
                                    <div class="h-px flex-1 bg-surface-container-high"></div>
                                    <span class="text-[10px] text-outline">${items.length}</span>
                                </div>
                                <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    ${items.map((protocol) => {
                                        const references = protocol.evidenceCard.references || [];
                                        const principles = protocol.evidenceCard.principles || [];
                                        const suggestedHabitSummary = this.formatProtocolSuggestedHabitSummary(protocol);
                                        return `
                                            <article class="ui-surface p-5 space-y-4">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div class="min-w-0 flex-1">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="ui-card-title text-on-surface">${this.escapeHtml(protocol.title)}</p>
                                                                ${protocol.isBase ? `<span class="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Base do app</span>` : ''}
                                                            </div>
                                                            <p class="mt-1 text-sm text-on-surface-variant leading-relaxed">${this.escapeHtml(protocol.description)}</p>
                                                        </div>
                                                        <div class="w-full shrink-0 text-left sm:w-auto sm:text-right">
                                                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(this.getProtocolCadenceLabel(protocol.cadence))}</p>
                                                            <p class="mt-1 text-[10px] text-outline">${protocol.steps.length} passo${protocol.steps.length === 1 ? '' : 's'} · ${estimatedMinutes} min</p>
                                                        </div>
                                                </div>
                                                    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(230px,0.85fr)]">
                                                        <div class="ui-surface-subtle p-4 space-y-2">
                                                            <p class="ui-section-label">Por que esse protocolo existe</p>
                                                            <p class="text-sm leading-relaxed text-on-surface-variant">${this.escapeHtml(protocol.rationaleShort || protocol.evidenceCard.summary || 'Sem resumo ainda.')}</p>
                                                            ${principles.length ? `<div class="space-y-1 pt-1">${principles.map(item => `<p class="text-xs leading-relaxed text-on-surface-variant">- ${this.escapeHtml(item)}</p>`).join('')}</div>` : ''}
                                                            ${references.length ? `<div class="space-y-1 pt-2"><p class="ui-section-label">Referencias</p>${references.map(ref => `<a href="${this.escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer" class="block text-xs text-primary hover:underline">${this.escapeHtml(ref.label || ref.url)}</a>`).join('')}</div>` : ''}
                                                        </div>
                                                        <div class="ui-surface-subtle px-4 py-3">
                                                            <p class="ui-section-label text-primary">${suggestedHabitSummary ? 'Sugestao de habito' : 'Encaixe do protocolo'}</p>
                                                            <p class="mt-1 text-sm leading-relaxed text-on-surface-variant">${this.escapeHtml(suggestedHabitSummary || 'Use este protocolo como ritual sob demanda, checklist de sessao ou base para uma rotina editavel.')}</p>
                                                        </div>
                                                    </div>

                                                    <div class="space-y-3">
                                                        <div class="flex items-center justify-between gap-3">
                                                            <p class="ui-section-label">Passos</p>
                                                            <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${protocol.steps.length} item${protocol.steps.length === 1 ? '' : 's'}</p>
                                                        </div>
                                                        <div class="space-y-2">
                                                            ${protocol.steps.map((step, idx) => `
                                                                <div class="flex items-start gap-3 rounded-xl bg-surface-container-low px-3 py-2.5">
                                                                    <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">${idx + 1}</span>
                                                                    <div class="min-w-0 flex-1">
                                                                        <p class="text-sm leading-relaxed text-on-surface">${this.escapeHtml(step.title)}</p>
                                                                        <p class="mt-1 text-[10px] text-outline">${Math.round(Number(step.estimatedMinutes) || 0)} min${step.optional ? ' · opcional' : ''}</p>
                                                                    </div>
                                                                </div>
                                                            `).join('')}
                                                        </div>
                                                    </div>

                                                    <div class="flex flex-wrap gap-2 pt-1">
                                                        <button type="button" onclick="window.app.openProtocolModal('${protocol.id}')"
                                                            class="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-highest">
                                                            <span class="material-symbols-outlined notranslate text-[14px]">edit</span>
                                                            Editar
                                                        </button>
                                                        <button type="button" onclick="window.app.createHabitFromProtocol('${protocol.id}')"
                                                            class="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/15">
                                                            <span class="material-symbols-outlined notranslate text-[14px]">playlist_add_check</span>
                                                            Usar em habito
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        `;
                                    }).join('')}
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
        },

        renderProtocolsPanel: function() {
            this.ensureProtocolsState();
            const container = document.getElementById('protocols-container');
            if (!container) return;
            const protocols = this.getAllProtocols();
            const familyMap = this.getProtocolFamilies();
            const grouped = protocols.reduce((acc, item) => {
                const family = item.family || 'geral';
                if (!acc[family]) acc[family] = [];
                acc[family].push(item);
                return acc;
            }, {});

            const familyOrder = ['rotina', 'estudo', 'limpeza', 'treino', 'financas', 'geral'];
            const families = Object.keys(grouped).sort((a, b) => {
                const ia = familyOrder.indexOf(a);
                const ib = familyOrder.indexOf(b);
                if (ia === -1 && ib === -1) return a.localeCompare(b);
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });

            container.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
                        <div class="flex flex-col gap-3">
                            <div class="flex flex-col gap-3">
                                <div class="min-w-0 max-w-2xl">
                                    <div class="flex items-center justify-between gap-3">
                                        <h3 class="min-w-0 pr-2 font-headline text-[1.75rem] italic font-bold leading-none text-on-background">Protocolos</h3>
                                        <button type="button" onclick="window.app.openProtocolModal()"
                                            class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-primary hover:opacity-90 active:scale-95 transition-all">
                                            <span class="material-symbols-outlined notranslate text-[14px]">add</span>
                                            Protocolo
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p class="max-w-2xl text-sm text-on-surface-variant leading-relaxed">Protocolos-base e versoes editadas para transformar rotinas recorrentes em passos claros, reutilizaveis e mais faceis de executar.</p>
                        </div>
                    </div>
                    ${families.map((family) => {
                        const items = grouped[family] || [];
                        return `
                            <section class="space-y-4">
                                <div class="flex items-center gap-3">
                                    <p class="ui-section-label text-primary">${this.escapeHtml(familyMap[family] || family)}</p>
                                    <div class="h-px flex-1 bg-surface-container-high"></div>
                                    <span class="text-[10px] text-outline">${items.length}</span>
                                </div>
                                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    ${items.map((protocol) => {
                                        const references = protocol.evidenceCard.references || [];
                                        const principles = protocol.evidenceCard.principles || [];
                                        const suggestedHabitSummary = this.formatProtocolSuggestedHabitSummary(protocol);
                                        const estimatedMinutes = this.getProtocolEstimatedMinutes(protocol, { includeOptional: false });
                                        return `
                                            <article class="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm space-y-4">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div class="min-w-0 flex-1">
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <p class="text-lg font-bold text-on-surface">${this.escapeHtml(protocol.title)}</p>
                                                            ${protocol.isBase ? `<span class="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Base do app</span>` : ''}
                                                        </div>
                                                        <p class="mt-1 text-sm text-on-surface-variant leading-relaxed">${this.escapeHtml(protocol.description)}</p>
                                                    </div>
                                                    <div class="w-full shrink-0 text-left sm:w-auto sm:text-right">
                                                        <p class="text-[10px] font-bold uppercase tracking-widest text-outline">${this.escapeHtml(this.getProtocolCadenceLabel(protocol.cadence))}</p>
                                                        <p class="mt-1 text-[10px] text-outline">${protocol.steps.length} passo${protocol.steps.length === 1 ? '' : 's'} · ${estimatedMinutes} min</p>
                                                    </div>
                                                </div>
                                                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 space-y-2">
                                                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Por que esse protocolo existe</p>
                                                    <p class="text-sm text-on-surface-variant leading-relaxed">${this.escapeHtml(protocol.rationaleShort || protocol.evidenceCard.summary || 'Sem resumo ainda.')}</p>
                                                    ${principles.length ? `<div class="pt-1 space-y-1">${principles.map(item => `<p class="text-xs text-on-surface-variant leading-relaxed">- ${this.escapeHtml(item)}</p>`).join('')}</div>` : ''}
                                                    ${references.length ? `<div class="pt-2 space-y-1"><p class="text-[10px] font-bold uppercase tracking-widest text-outline">Referencias</p>${references.map(ref => `<a href="${this.escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer" class="block text-xs text-primary hover:underline">${this.escapeHtml(ref.label || ref.url)}</a>`).join('')}</div>` : ''}
                                                </div>
                                                <div class="space-y-2">
                                                    <p class="text-[10px] font-bold uppercase tracking-widest text-outline">Passos</p>
                                                    <div class="space-y-2">
                                                        ${protocol.steps.map((step, idx) => `
                                                            <div class="flex items-start gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2.5">
                                                                <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">${idx + 1}</span>
                                                                <div class="min-w-0 flex-1">
                                                                    <p class="text-sm text-on-surface leading-relaxed">${this.escapeHtml(step.title)}</p>
                                                                    <p class="mt-1 text-[10px] text-outline">${Math.round(Number(step.estimatedMinutes) || 0)} min${step.optional ? ' · opcional' : ''}</p>
                                                                </div>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                                ${suggestedHabitSummary ? `
                                                    <div class="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
                                                        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Sugestao de habito</p>
                                                        <p class="mt-1 text-sm text-on-surface-variant leading-relaxed">${this.escapeHtml(suggestedHabitSummary)}</p>
                                                    </div>
                                                ` : ''}
                                                <div class="flex flex-wrap gap-2 pt-1">
                                                    <button type="button" onclick="window.app.openProtocolModal('${protocol.id}')"
                                                        class="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container-highest transition-colors">
                                                        <span class="material-symbols-outlined notranslate text-[14px]">edit</span>
                                                        Editar
                                                    </button>
                                                    <button type="button" onclick="window.app.createHabitFromProtocol('${protocol.id}')"
                                                        class="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:bg-primary/15 transition-colors">
                                                        <span class="material-symbols-outlined notranslate text-[14px]">playlist_add_check</span>
                                                        Usar em habito
                                                    </button>
                                                </div>
                                            </article>
                                        `;
                                    }).join('')}
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
        },

        openProtocolModal: function(id = '') {
            this.ensureProtocolsState();
            const modal = document.getElementById('protocol-modal');
            if (!modal) return;
            const protocol = id ? this.getProtocolById(id) : null;
            document.getElementById('protocol-edit-id').value = protocol?.id || '';
            document.getElementById('protocol-title').value = protocol?.title || '';
            document.getElementById('protocol-family').value = protocol?.family || 'geral';
            document.getElementById('protocol-cadence').value = protocol?.cadence || 'sob_demanda';
            document.getElementById('protocol-description').value = protocol?.description || '';
            document.getElementById('protocol-rationale-short').value = protocol?.rationaleShort || '';
            document.getElementById('protocol-evidence-summary').value = protocol?.evidenceCard?.summary || '';
            document.getElementById('protocol-evidence-principles').value = Array.isArray(protocol?.evidenceCard?.principles) ? protocol.evidenceCard.principles.join('\n') : '';
            document.getElementById('protocol-evidence-references').value = Array.isArray(protocol?.evidenceCard?.references)
                ? protocol.evidenceCard.references.map(ref => `${ref.label || ''}${ref.url ? ` | ${ref.url}` : ''}`).join('\n')
                : '';
            document.getElementById('protocol-steps').value = Array.isArray(protocol?.steps)
                ? protocol.steps.map(step => `${step.title}${Number(step?.estimatedMinutes) > 0 ? ` | ${Math.round(Number(step.estimatedMinutes))}` : ''}`).join('\n')
                : '';
            document.getElementById('protocol-suggested-dimension').value = protocol?.suggestedHabit?.dimension || 'Carreira';
            document.getElementById('protocol-suggested-track-mode').value = protocol?.suggestedHabit?.trackMode || 'boolean';
            document.getElementById('protocol-suggested-target').value = protocol?.suggestedHabit?.targetValue || 1;
            document.getElementById('protocol-suggested-frequency').value = protocol?.suggestedHabit?.frequency ?? '';
            document.getElementById('protocol-suggested-interval-days').value = protocol?.suggestedHabit?.intervalDays || '';
            document.getElementById('protocol-suggested-day-of-month').value = protocol?.suggestedHabit?.dayOfMonth || '';
            document.getElementById('protocol-suggested-start-date').value = protocol?.suggestedHabit?.scheduleStartDate || '';
            document.getElementById('protocol-suggested-start-time').value = protocol?.suggestedHabit?.startTime || '';
            document.getElementById('protocol-suggested-trigger').value = protocol?.suggestedHabit?.trigger || '';
            document.getElementById('protocol-suggested-routine').value = protocol?.suggestedHabit?.routine || '';
            document.getElementById('protocol-suggested-reward').value = protocol?.suggestedHabit?.reward || '';
            document.getElementById('protocol-modal-title').textContent = protocol ? `Editar protocolo: ${protocol.title}` : 'Novo protocolo';
            this.onProtocolSuggestedFrequencyChange?.(document.getElementById('protocol-suggested-frequency')?.value || '');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        },

        closeProtocolModal: function() {
            const modal = document.getElementById('protocol-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        onProtocolSuggestedFrequencyChange: function(freq) {
            const daysContainer = document.getElementById('protocol-suggested-interval-container');
            const monthlyContainer = document.getElementById('protocol-suggested-monthly-container');
            const startContainer = document.getElementById('protocol-suggested-start-container');
            const setVisible = (el, show) => {
                if (!el) return;
                el.classList.toggle('hidden', !show);
                el.classList.toggle('flex', show);
                el.style.display = show ? 'flex' : 'none';
            };
            setVisible(daysContainer, freq === 'every_x_days');
            setVisible(startContainer, freq === 'every_x_days');
            setVisible(monthlyContainer, freq === 'monthly');
        },

        saveProtocolFromModal: function() {
            this.ensureProtocolsState();
            const state = window.sistemaVidaState;
            const id = String(document.getElementById('protocol-edit-id')?.value || '').trim();
            const title = String(document.getElementById('protocol-title')?.value || '').trim();
            if (!title) {
                this.showToast('Defina um titulo para o protocolo.', 'error');
                return;
            }
            const now = new Date().toISOString();
            const rawReferences = String(document.getElementById('protocol-evidence-references')?.value || '');
            const references = rawReferences.split(/\r?\n/).map(line => {
                const [label, url] = String(line || '').split('|').map(part => String(part || '').trim());
                return { label: label || url || '', url: url || '' };
            }).filter(item => item.label || item.url);
            const steps = String(document.getElementById('protocol-steps')?.value || '')
                .split(/\r?\n/)
                .map((line, idx) => this.parseProtocolStepLine?.(line, idx))
                .filter(Boolean);
            if (!steps.length) {
                this.showToast('Adicione pelo menos um passo ao protocolo.', 'error');
                return;
            }
            const existingProtocol = id ? this.getProtocolById(id) : null;
            const suggestedFrequency = String(document.getElementById('protocol-suggested-frequency')?.value || '');
            const intervalDays = Math.max(0, Math.round(Number(document.getElementById('protocol-suggested-interval-days')?.value || 0)));
            const dayOfMonth = Math.max(0, Math.round(Number(document.getElementById('protocol-suggested-day-of-month')?.value || 0)));
            const scheduleStartDate = String(document.getElementById('protocol-suggested-start-date')?.value || '').trim();
            const preservedSpecificDays = Array.isArray(existingProtocol?.suggestedHabit?.specificDays) ? [...existingProtocol.suggestedHabit.specificDays] : [];
            const protocol = normalizeProtocol({
                id: id || `protocol_${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
                slug: (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                title,
                family: String(document.getElementById('protocol-family')?.value || 'geral'),
                cadence: String(document.getElementById('protocol-cadence')?.value || 'sob_demanda'),
                description: String(document.getElementById('protocol-description')?.value || '').trim(),
                rationaleShort: String(document.getElementById('protocol-rationale-short')?.value || '').trim(),
                evidenceCard: {
                    summary: String(document.getElementById('protocol-evidence-summary')?.value || '').trim(),
                    principles: String(document.getElementById('protocol-evidence-principles')?.value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean),
                    references
                },
                steps,
                suggestedHabit: {
                    dimension: String(document.getElementById('protocol-suggested-dimension')?.value || 'Carreira'),
                    trackMode: String(document.getElementById('protocol-suggested-track-mode')?.value || 'boolean'),
                    targetValue: Number(document.getElementById('protocol-suggested-target')?.value || 1),
                    frequency: suggestedFrequency,
                    specificDays: suggestedFrequency === 'specific' ? preservedSpecificDays : [],
                    intervalDays: suggestedFrequency === 'every_x_days' ? intervalDays : 0,
                    dayOfMonth: suggestedFrequency === 'monthly' ? dayOfMonth : 0,
                    scheduleStartDate: suggestedFrequency === 'every_x_days' ? scheduleStartDate : '',
                    startTime: String(document.getElementById('protocol-suggested-start-time')?.value || ''),
                    continuous: existingProtocol?.suggestedHabit?.continuous !== false,
                    trigger: String(document.getElementById('protocol-suggested-trigger')?.value || '').trim(),
                    routine: String(document.getElementById('protocol-suggested-routine')?.value || '').trim(),
                    reward: String(document.getElementById('protocol-suggested-reward')?.value || '').trim()
                },
                isBase: !!existingProtocol?.isBase,
                userEditable: true,
                createdAt: existingProtocol?.createdAt || now,
                updatedAt: now
            });

            const list = Array.isArray(state.protocols) ? state.protocols : (state.protocols = []);
            const idx = list.findIndex(item => String(item?.id || '') === protocol.id);
            if (idx >= 0) list[idx] = protocol;
            else list.unshift(protocol);
            this.saveState(true);
            this.closeProtocolModal();
            this.renderProtocolsPanel();
            this.showToast(`Protocolo salvo: ${protocol.title}.`, 'success');
        },

        populateHabitProtocolSelect: function(selectedId = '') {
            this.ensureProtocolsState();
            const select = document.getElementById('habit-protocol');
            if (!select) return;
            const protocols = this.getAllProtocols();
            const grouped = protocols.reduce((acc, item) => {
                if (!acc[item.family]) acc[item.family] = [];
                acc[item.family].push(item);
                return acc;
            }, {});
            const familyMap = this.getProtocolFamilies();
            let html = '<option value="">- Sem protocolo -</option>';
            Object.keys(grouped).forEach((family) => {
                const familyLabel = this.escapeHtml(familyMap[family] || family);
                html += `<optgroup label="${familyLabel}">`;
                grouped[family].forEach((protocol) => {
                    const title = String(protocol.title || '').trim();
                    const cadence = this.getProtocolCadenceLabel?.(protocol.cadence) || '';
                    const normalizedTitle = title.toLowerCase();
                    const normalizedFamily = String(familyMap[family] || family).trim().toLowerCase();
                    const optionLabel = normalizedTitle === normalizedFamily && cadence
                        ? `${title} (${cadence})`
                        : title;
                    html += `<option value="${this.escapeHtml(protocol.id)}">${this.escapeHtml(optionLabel)}</option>`;
                });
                html += '</optgroup>';
            });
            select.innerHTML = html;
            if (selectedId && select.querySelector(`option[value="${selectedId}"]`)) {
                select.value = selectedId;
            }
        },

        populateMicroProtocolSelect: function(selectedId = '') {
            this.ensureProtocolsState();
            const select = document.getElementById('micro-protocol');
            if (!select) return;
            const protocols = this.getAllProtocols();
            const grouped = protocols.reduce((acc, item) => {
                if (!acc[item.family]) acc[item.family] = [];
                acc[item.family].push(item);
                return acc;
            }, {});
            const familyMap = this.getProtocolFamilies();
            let html = '<option value="">- Sem protocolo -</option>';
            Object.keys(grouped).forEach((family) => {
                html += `<optgroup label="${this.escapeHtml(familyMap[family] || family)}">`;
                grouped[family].forEach((protocol) => {
                    html += `<option value="${this.escapeHtml(protocol.id)}">${this.escapeHtml(protocol.title || '')}</option>`;
                });
                html += '</optgroup>';
            });
            select.innerHTML = html;
            if (selectedId && select.querySelector(`option[value="${selectedId}"]`)) {
                select.value = selectedId;
            }
        },

        inferProtocolIdFromSteps: function(steps = []) {
            const normalizedSteps = (Array.isArray(steps) ? steps : [])
                .map(step => String(step || '').trim().toLowerCase())
                .filter(Boolean);
            if (!normalizedSteps.length) return '';
            const signature = normalizedSteps.join('\n');
            const protocols = this.getAllProtocols();
            const match = protocols.find((protocol) => {
                const protocolSteps = (protocol.steps || [])
                    .map(step => String(step?.title || '').trim().toLowerCase())
                    .filter(Boolean);
                return protocolSteps.length && protocolSteps.join('\n') === signature;
            });
            return match?.id || '';
        },

        inferHabitProtocolIdFromSteps: function(steps = []) {
            return this.inferProtocolIdFromSteps(steps);
        },

        inferMicroProtocolIdFromSteps: function(steps = []) {
            return this.inferProtocolIdFromSteps(steps);
        },

        applyProtocolToHabitForm: function(protocolId, options = {}) {
            const protocol = this.getProtocolById(protocolId);
            if (!protocol) return;
            const stepsInput = document.getElementById('habit-steps');
            const modeInput = document.getElementById('habit-track-mode');
            const targetInput = document.getElementById('habit-target');
            const freqInput = document.getElementById('habit-frequency');
            const startTimeInput = document.getElementById('habit-start-time');
            const triggerInput = document.getElementById('crud-trigger');
            const routineInput = document.getElementById('habit-routine');
            const rewardInput = document.getElementById('habit-reward');
            const dimensionInput = document.getElementById('crud-dimension');
            const estimatedInput = document.getElementById('crud-estimated-minutes');
            const supportsHabitFrequency = (value) => {
                if (!value) return false;
                return !!freqInput?.querySelector(`option[value="${value}"]`);
            };
            const existingSteps = String(stepsInput?.value || '').trim();
            const nextSteps = protocol.steps.map(step => step.title).join('\n');
            const suggestedMode = this.normalizeHabitTrackMode?.(protocol.suggestedHabit.trackMode || 'boolean') || 'boolean';
            const suggestedTarget = Math.max(1, Number(protocol.suggestedHabit.targetValue) || 1);
            if (!options.force && existingSteps && existingSteps !== nextSteps) {
                const confirmed = confirm(`Substituir os passos atuais pelo protocolo "${protocol.title}"?`);
                if (!confirmed) return false;
            }
            if (stepsInput) stepsInput.value = nextSteps;
            if (dimensionInput && !dimensionInput.value) dimensionInput.value = protocol.suggestedHabit.dimension || 'Carreira';
            if (modeInput && !options.preserveMode) modeInput.value = suggestedMode;
            if (targetInput && !options.preserveMode) targetInput.value = suggestedMode === 'boolean' ? 1 : suggestedTarget;
            this.onHabitModeChange?.(modeInput?.value || suggestedMode);
            const protocolMinutes = this.getProtocolEstimatedMinutes?.(protocol, { includeOptional: false }) || 0;
            if (estimatedInput && protocolMinutes > 0 && (!estimatedInput.value || Number(estimatedInput.value) <= 0 || options.force)) {
                estimatedInput.value = String(protocolMinutes);
                estimatedInput.dataset.manualOverride = 'false';
                estimatedInput.dataset.estimateSource = 'protocol';
            }
            if (freqInput && supportsHabitFrequency(protocol.suggestedHabit.frequency) && (!freqInput.value || freqInput.value === 'daily' || options.force)) {
                freqInput.value = protocol.suggestedHabit.frequency || 'daily';
                this.onHabitFreqChange?.(freqInput.value);
            }
            const intervalInput = document.getElementById('habit-interval-days');
            const monthlyInput = document.getElementById('habit-day-of-month');
            const scheduleStartInput = document.getElementById('habit-schedule-start-date');
            const daysSelect = document.getElementById('habit-days');
            if (daysSelect && Array.isArray(protocol.suggestedHabit.specificDays) && protocol.suggestedHabit.specificDays.length) {
                Array.from(daysSelect.options || []).forEach((opt) => {
                    opt.selected = protocol.suggestedHabit.specificDays.includes(opt.value);
                });
            }
            if (intervalInput && (!intervalInput.value || options.force)) intervalInput.value = protocol.suggestedHabit.intervalDays || '';
            if (monthlyInput && (!monthlyInput.value || options.force)) monthlyInput.value = protocol.suggestedHabit.dayOfMonth || '';
            if (scheduleStartInput && (!scheduleStartInput.value || options.force)) scheduleStartInput.value = protocol.suggestedHabit.scheduleStartDate || '';
            if (startTimeInput && !startTimeInput.value) startTimeInput.value = protocol.suggestedHabit.startTime || '';
            if (triggerInput && !triggerInput.value) triggerInput.value = protocol.suggestedHabit.trigger || '';
            if (routineInput && !routineInput.value) routineInput.value = protocol.suggestedHabit.routine || protocol.title;
            if (rewardInput && !rewardInput.value) rewardInput.value = protocol.suggestedHabit.reward || '';
            const continuousCheck = document.getElementById('habit-continuous');
            if (continuousCheck && options.force) {
                continuousCheck.checked = !!protocol.suggestedHabit.continuous;
                this.onHabitContinuousChange?.(continuousCheck.checked);
            }
            const select = document.getElementById('habit-protocol');
            if (select) select.value = protocol.id;
            this.syncHabitProtocolAuthorityUI?.(protocol.id);
            this.refreshCrudEstimatedFieldState?.('habits');
            return true;
        },

        applyProtocolToMicroForm: function(protocolId, options = {}) {
            const protocol = this.getProtocolById(protocolId);
            if (!protocol) return false;
            const stepsInput = document.getElementById('micro-steps');
            const estimatedInput = document.getElementById('crud-estimated-minutes');
            const existingSteps = String(stepsInput?.value || '').trim();
            const nextSteps = protocol.steps.map(step => step.title).join('\n');
            if (!options.force && existingSteps && existingSteps !== nextSteps) {
                const confirmed = confirm(`Substituir os passos atuais da micro pelo protocolo "${protocol.title}"?`);
                if (!confirmed) return false;
            }
            if (stepsInput) stepsInput.value = nextSteps;
            const protocolMinutes = this.getProtocolEstimatedMinutes?.(protocol, { includeOptional: false }) || 0;
            if (estimatedInput && protocolMinutes > 0 && (!estimatedInput.value || Number(estimatedInput.value) <= 0 || options.force)) {
                estimatedInput.value = String(protocolMinutes);
                estimatedInput.dataset.manualOverride = 'false';
                estimatedInput.dataset.estimateSource = 'protocol';
            }
            const select = document.getElementById('micro-protocol');
            if (select) select.value = protocol.id;
            this.refreshCrudEstimatedFieldState?.('micros');
            return true;
        },

        onHabitProtocolChange: function(protocolId) {
            this.syncHabitProtocolAuthorityUI?.(protocolId);
            if (!protocolId) {
                this.refreshCrudEstimatedFieldState?.('habits');
                return;
            }
            this.applyProtocolToHabitForm(protocolId);
        },

        onMicroProtocolChange: function(protocolId) {
            if (!protocolId) {
                this.refreshCrudEstimatedFieldState?.('micros');
                return;
            }
            this.applyProtocolToMicroForm(protocolId);
        },

        createHabitFromProtocol: function(protocolId) {
            const protocol = this.getProtocolById(protocolId);
            if (!protocol) return;
            this.openCreateModal('habits');
            setTimeout(() => {
                const titleInput = document.getElementById('crud-title');
                const dimensionInput = document.getElementById('crud-dimension');
                const select = document.getElementById('habit-protocol');
                if (titleInput && !titleInput.value) titleInput.value = protocol.title;
                if (dimensionInput) dimensionInput.value = protocol.suggestedHabit.dimension || 'Carreira';
                this.populateHabitProtocolSelect(protocol.id);
                if (select) select.value = protocol.id;
                this.applyProtocolToHabitForm(protocol.id, { force: true });
                this.showToast(`Protocolo aplicado: ${protocol.title}. Ajuste o habito antes de salvar.`, 'success');
            }, 80);
        },

        openProtocolsLibrary: function() {
            this.switchView('planos');
            setTimeout(() => {
                this.switchPlanosTab('protocolos');
                this.renderProtocolsPanel?.();
            }, 120);
        }
    });
}
