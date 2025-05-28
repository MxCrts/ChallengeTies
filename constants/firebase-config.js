import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
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

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
