/**
 * Phase 1 — Subjective Scales
 * Provides descriptive text for daily check-in scale values (sleep, energy, mood, stress)
 * and the DOM helper that binds those descriptions to the check-in panel.
 *
 * Attached to the app object via attachSubjectiveScales(app).
 */

function getCheckinScaleText(kind, value) {
    const n = Math.max(1, Math.min(5, Number(value) || 3));
    const maps = {
        sleep: {
            1: 'Sono muito ruim: acordei quebrado e sem recuperar.',
            2: 'Sono abaixo do ideal: descanso parcial.',
            3: 'Sono ok: funcional, mas ainda melhoravel.',
            4: 'Sono bom: acordei recuperado.',
            5: 'Sono excelente: corpo e mente renovados.'
        },
        energy: {
            1: 'Energia minima: so o essencial.',
            2: 'Energia baixa: manter simples hoje.',
            3: 'Energia media: ritmo sustentavel.',
            4: 'Energia boa: da para avancar bem.',
            5: 'Energia alta: aproveite para atacar o importante.'
        },
        mood: {
            1: 'Humor muito baixo: cuide da base primeiro.',
            2: 'Humor baixo: ajuste expectativa e carga.',
            3: 'Humor neutro: siga o plano com calma.',
            4: 'Humor bom: bom momento para interacoes e entrega.',
            5: 'Humor excelente: use a maré a seu favor.'
        },
        stress: {
            1: 'Estresse leve: mente sob controle.',
            2: 'Estresse administravel: manter pausas curtas.',
            3: 'Estresse moderado: priorize e simplifique.',
            4: 'Estresse alto: reduzir volume e proteger foco.',
            5: 'Estresse critico: pare, respire e recorte o dia.'
        }
    };
    return maps[kind]?.[n] || '';
}

function renderDailyCheckinGuidance() {
    const read = (id, fallback = 3) => {
        const n = Number(document.getElementById(id)?.value);
        return Number.isFinite(n) ? n : fallback;
    };
    const sleepValue  = read('daily-checkin-sleep-quality', 3);
    const energyValue = read('daily-checkin-energy', 3);
    const moodValue   = read('daily-checkin-mood', 3);
    const stressValue = read('daily-checkin-stress', 3);

    const sleepValEl = document.getElementById('daily-checkin-sleep-quality-val');
    if (sleepValEl) sleepValEl.textContent = String(sleepValue);

    const bind = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    bind('daily-checkin-sleep-quality-help', this.getCheckinScaleText('sleep',  sleepValue));
    bind('daily-checkin-energy-help',        this.getCheckinScaleText('energy', energyValue));
    bind('daily-checkin-mood-help',          this.getCheckinScaleText('mood',   moodValue));
    bind('daily-checkin-stress-help',        this.getCheckinScaleText('stress', stressValue));
}

/**
 * Attaches Phase-1 methods to the app object.
 * Call once after the app object is defined but before init() runs.
 */
export function attachSubjectiveScales(app) {
    app.getCheckinScaleText        = getCheckinScaleText;
    app.renderDailyCheckinGuidance = renderDailyCheckinGuidance;
}
