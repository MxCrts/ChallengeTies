import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Your Firebase project's configuration.
 * Make sure these values match your Firebase console settings.
 */
const firebaseConfig = {
  apiKey: "AIzaSyDIVqtaSgmmCS8Ro6FKVSznViK0eR04fJQ",
  authDomain: "challengeme-d7fef.firebaseapp.com",
  projectId: "challengeme-d7fef",
  storageBucket: "challengeme-d7fef.appspot.com",
  messagingSenderId: "344780684076",
  appId: "1:344780684076:web:8f1208a81ec9fbe25dca89",
  measurementId: "G-71TM15XWT8",
};

/**
 * 1) Initialize your Firebase App
 */
const app = initializeApp(firebaseConfig);

/**
 * 2) Initialize Firestore instance
 *    This gives you the 'db' reference to read/write collections and docs.
 */
export const db = getFirestore(app);

/**
 * 3) Initialize Firebase Auth with React Native persistence using AsyncStorage
 *    so user remains logged in even after app restarts.
 */
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Alternatively, you could do:
// export const auth = getAuth(app);
// if you prefer a simpler approach, but 'initializeAuth' is recommended for React Native.
