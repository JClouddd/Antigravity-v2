import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

/**
 * Plaid Client Factory
 * Environment is determined by PLAID_ENV env var: "sandbox" | "development" | "production"
 * Defaults to sandbox if not set — safe fallback.
 */
export function getPlaidClient() {
  const envStr = (process.env.PLAID_ENV || "sandbox").toLowerCase();

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env[`PLAID_SECRET_${envStr.toUpperCase()}`] || process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      `Missing Plaid credentials for ${envStr}. ` +
      `Set PLAID_CLIENT_ID and PLAID_SECRET_${envStr.toUpperCase()} in environment.`
    );
  }

  const config = new Configuration({
    basePath: PlaidEnvironments[envStr],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  console.log(`[PLAID] Client initialized → env: ${envStr}`);
  return new PlaidApi(config);
}
