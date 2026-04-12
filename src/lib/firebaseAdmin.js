import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _db = null;

function getAdminDb() {
  if (_db) return _db;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (!serviceAccount) {
    console.warn("[firebaseAdmin] No FIREBASE_SERVICE_ACCOUNT_KEY — Siri API will not work");
    return null;
  }

  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  _db = getFirestore();
  return _db;
}

export { getAdminDb };
