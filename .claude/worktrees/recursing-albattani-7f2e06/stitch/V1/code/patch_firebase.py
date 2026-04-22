import sys

with open('d:/Antigravity/Life OS/stitch/V1/code/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Add Firebase Config & Imports
firebase_block = """/**
 * Sistema Vida - Core OS
 * Vanilla JS Single Page Application Controller with Data Binding
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "API_KEY_AQUI",
    authDomain: "AUTH_DOMAIN_AQUI",
    projectId: "life-os-753f2",
    storageBucket: "STORAGE_BUCKET_AQUI",
    messagingSenderId: "MESSAGING_SENDER_ID_AQUI",
    appId: "APP_ID_AQUI"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

window.sistemaVidaState = {"""
js = js.replace('/**\n * Sistema Vida - Core OS\n * Vanilla JS Single Page Application Controller with Data Binding\n */\n\nwindow.sistemaVidaState = {', firebase_block)

# 2. Add saveState and loadState before init
persistence_funcs = """    // ------------------------------------------------------------------------
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

    init:"""
js = js.replace('    init:', persistence_funcs)

# 3. Modify init
new_init = """    init: async function() {
        console.log("Sistema Vida OS inicializando...");
        await this.loadState();
        this.navigate('hoje');
    },"""
js = js.replace('    init: function() {\n        console.log("Sistema Vida OS inicializado.");\n        this.navigate(\'hoje\');\n    },', new_init)

# 4. Add save triggers
# updateDimensionScore
old_update_dim = """    updateDimensionScore: function(dim, val) {
        window.sistemaVidaState.dimensions[dim].score = parseInt(val);
        if (this.render.proposito) this.render.proposito();
        if (this.render.painel) this.render.painel();
    },"""
new_update_dim = """    updateDimensionScore: function(dim, val) {
        window.sistemaVidaState.dimensions[dim].score = parseInt(val);
        if (this.render.proposito) this.render.proposito();
        if (this.render.painel) this.render.painel();
        app.saveState();
    },"""
js = js.replace(old_update_dim, new_update_dim)

# completeMicroAction
old_comp = """        // Re-render active view after state mutation
        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
    },"""
new_comp = """        // Re-render active view after state mutation
        if (this.currentView && this.render[this.currentView]) {
            this.render[this.currentView]();
        }
        app.saveState();
    },"""
js = js.replace(old_comp, new_comp)

# 5. Add window.app = app;
footer = """window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});"""
js = js.replace('document.addEventListener("DOMContentLoaded", () => {\n    app.init();\n});', footer)

with open('d:/Antigravity/Life OS/stitch/V1/code/app.js', 'w', encoding='utf-8') as f:
    f.write(js)
