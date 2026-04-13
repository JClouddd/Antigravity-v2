import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getAdminDb } from "@/lib/firebaseAdmin";

/**
 * Plaid Client Factory
 * Priority: Firestore config → Environment variables → Error
 * This allows keys to be entered via the Hub UI and toggled between sandbox/dev/production.
 */
export async function getPlaidClient(userId) {
  let clientId, secret, envStr;

  // 1. Try Firestore config (set via Hub UI)
  if (userId) {
    try {
      const adminDb = getAdminDb();
      if (adminDb) {
        const doc = await adminDb.collection("users").doc(userId)
          .collection("finance_config").doc("plaid").get();

        if (doc.exists) {
          const config = doc.data();
          envStr = (config.environment || "sandbox").toLowerCase();
          clientId = config.clientId;

          // Pick the right secret for the active environment
          if (envStr === "sandbox") secret = config.secretSandbox;
          else if (envStr === "development") secret = config.secretDevelopment;
          else if (envStr === "production") secret = config.secretProduction;

          if (clientId && secret) {
            console.log(`[PLAID] Client from Firestore → env: ${envStr}`);
          }
        }
      }
    } catch (e) {
      console.warn("[PLAID] Firestore config read failed, falling back to env vars:", e.message);
    }
  }

  // 2. Fallback to env vars
  if (!clientId || !secret) {
    envStr = (process.env.PLAID_ENV || "sandbox").toLowerCase();
    clientId = process.env.PLAID_CLIENT_ID;
    secret = process.env[`PLAID_SECRET_${envStr.toUpperCase()}`] || process.env.PLAID_SECRET;
    if (clientId && secret) {
      console.log(`[PLAID] Client from env vars → env: ${envStr}`);
    }
  }

  if (!clientId || !secret) {
    throw new Error(
      `Missing Plaid credentials for ${envStr || "sandbox"}. ` +
      `Configure them in Finance → Settings or set environment variables.`
    );
  }

  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[envStr],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return { client: new PlaidApi(plaidConfig), env: envStr };
}
