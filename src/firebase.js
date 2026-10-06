import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBzgChouE4W25XnD-vFybJrKVN9yl3R0IQ",
  authDomain: "ferroportluannogueira.firebaseapp.com",
  projectId: "ferroportluannogueira",
  storageBucket: "ferroportluannogueira.firebasestorage.app",
  messagingSenderId: "531699539518",
  appId: "1:531699539518:web:6e32a169d9110f70b9fb6f",
  measurementId: "G-61BRVCSHD7"
};

const app = initializeApp(firebaseConfig);

// Cache offline: os dados ficam salvos no aparelho e sincronizam quando a internet voltar
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn('Cache offline indisponível, usando modo online:', e);
  firestore = getFirestore(app);
}

export const db = firestore;
export const storage = getStorage(app);
export const auth = getAuth(app);
