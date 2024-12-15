import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDIVqtaSgmmCS8Ro6FKVSznViK0eR04fJQ",
  authDomain: "challengeme-d7fef.firebaseapp.com",
  projectId: "challengeme-d7fef", // Ensure correctness
  storageBucket: "challengeme-d7fef.appspot.com",
  messagingSenderId: "344780684076",
  appId: "1:344780684076:web:8f1208a81ec9fbe25dca89",
  measurementId: "G-71TM15XWT8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth with persistence
import { getAuth } from "firebase/auth";
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
