// constants/firebase-config.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDIVqtaSgmmCS8Ro6FKVSznViK0eR04fJQ",
  authDomain: "challengeme-d7fef.firebaseapp.com",
  projectId: "challengeme-d7fef",
  storageBucket: "challengeme-d7fef.firebasestorage.app",
  messagingSenderId: "344780684076",
  appId: "1:344780684076:web:8f1208a81ec9fbe25dca89",
  measurementId: "G-71TM15XWT8",
};

// ✅ Singleton app
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Singleton auth (évite "already-initialized")
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    } catch {
    // ⚠️ Déjà initialisé (souvent en dev / fast refresh) → on récupère l’instance existante
    return getAuth(app);
  }
})();
