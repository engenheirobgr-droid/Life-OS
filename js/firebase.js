/**
 * Firebase initialization — single source of truth.
 * Import all Firebase instances and Firestore/Auth/Storage helpers from here.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getAuth, signInAnonymously, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail, updateProfile,
    EmailAuthProvider, linkWithCredential,
    setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDXu7ddS77_deDezWQqrLd4Ww-MRVL1bgM",
    authDomain: "life-os-753f2.firebaseapp.com",
    projectId: "life-os-753f2",
    storageBucket: "life-os-753f2.firebasestorage.app",
    messagingSenderId: "339455340566",
    appId: "1:339455340566:web:976675a53891f365c48537"
};

const firebaseApp = initializeApp(firebaseConfig);

export const db      = getFirestore(firebaseApp);
export const auth    = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);

// Kick off persistence setup as early as possible (module-load side-effect).
// Exported so app.js can chain auth initialization on top of it.
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[AUTH] Falha ao configurar persistência local:', err);
});

// Constants
export const LOCAL_USER_SCOPE = 'guest';

// Firestore helpers — re-exported so callers don't import CDN URLs directly
export { doc, setDoc, getDoc, onSnapshot, deleteDoc };

// Auth helpers — re-exported
export {
    signInAnonymously, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail, updateProfile,
    EmailAuthProvider, linkWithCredential
};

// Storage helpers — re-exported
export { storageRef, uploadString, getDownloadURL };
