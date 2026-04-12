import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCfYLKI6_lqPP76sVI2Pgq5Idb7PhmTxk",
  authDomain: "antigravity-hub-jcloud.firebaseapp.com",
  projectId: "antigravity-hub-jcloud",
  storageBucket: "antigravity-hub-jcloud.firebasestorage.app",
  messagingSenderId: "426017291723",
  appId: "1:426017291723:web:f3cb5e26db812e291a8a4e",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
