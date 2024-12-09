import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDIVqtaSgmmCS8Ro6FKVSznViK0eR04fJQ",
  authDomain: "challengeme-d7fef.firebaseapp.com",
  projectId: "challengeme-d7fef", // Make sure this is correct
  storageBucket: "challengeme-d7fef.appspot.com",
  messagingSenderId: "344780684076",
  appId: "1:344780684076:web:8f1208a81ec9fbe25dca89",
  measurementId: "G-71TM15XWT8",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
