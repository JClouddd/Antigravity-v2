import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];

  // In production (Vercel), use FIREBASE_SERVICE_ACCOUNT_KEY env var
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    return initializeApp({ credential: cert(serviceAccount) });
  }

  // Fallback: try default credentials (for local dev with gcloud auth)
  return initializeApp();
}

const app = initAdmin();
export const adminDb = getFirestore(app);
