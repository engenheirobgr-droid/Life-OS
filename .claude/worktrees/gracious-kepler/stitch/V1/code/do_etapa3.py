import re

# 1. perfil.html
with open('views/perfil.html', 'r', encoding='utf-8') as f:
    perfil = f.read()

perfil = perfil.replace('<h2 class="font-headline italic text-3xl tracking-tight text-on-surface">Bruno Gomes</h2>',
                        '<h2 id="perfil-nome-display" class="font-headline italic text-3xl tracking-tight text-on-surface">Bruno Gomes</h2>')

with open('views/perfil.html', 'w', encoding='utf-8') as f:
    f.write(perfil)

# 2. onboarding.html
with open('views/onboarding.html', 'r', encoding='utf-8') as f:
    onb = f.read()

onb = onb.replace('''<button onclick="app.navigate('hoje')" class="w-full bg-primary text-white py-4 rounded-xl font-bold font-label uppercase tracking-widest text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all">
                    Entrar no Sistema Vida
                </button>''',
                '''<button onclick="finishOnboarding()" class="w-full bg-primary text-white py-4 rounded-xl font-bold font-label uppercase tracking-widest text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all">
                    Entrar no Sistema Vida
                </button>''')

finish_logic = """
        function finishOnboarding() {
            const global = window.sistemaVidaState;
            Object.keys(state.wheel).forEach(dim => {
                global.dimensions[dim].score = state.wheel[dim] * 10;
            });
            if (state.valuesSet.essential.length > 0) {
                global.profile.values = state.valuesSet.essential;
            }
            if (!global.profile) global.profile = {};
            global.profile.legacy = state.legacy.trim();
            app.navigate('hoje');
        }
        
        initWheel();
"""
onb = onb.replace('initWheel();', finish_logic)

with open('views/onboarding.html', 'w', encoding='utf-8') as f:
    f.write(onb)


# 3. app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Replace the state section
old_state_pattern = r'window\.sistemaVidaState = \{.*?\n\};\n\nconst app ='
new_state = """window.sistemaVidaState = {
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

const app ="""

app_js = re.sub(old_state_pattern, new_state, app_js, flags=re.DOTALL)

# Add render.perfil and render.onboarding
new_renders = """        proposito: function() {"""

renders_addition = """        perfil: function() {
            const state = window.sistemaVidaState;
            const nomeDisplay = document.getElementById('perfil-nome-display');
            if (nomeDisplay && state.profile) {
                nomeDisplay.textContent = state.profile.name;
            }
        },

        onboarding: function() {
            console.log("Onboarding renderizado. Lógica de passo-a-passo no fragmento interno.");
        },

        proposito: function() {"""

app_js = app_js.replace(new_renders, renders_addition)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)
