import { db } from "./firebase";
import { collection, doc, setDoc, getDocs, query, where, orderBy } from "firebase/firestore";

const USAGE_COL = "api_usage";

/**
 * Log an API call for cost tracking.
 * Call this from any module that uses external APIs.
 */
export async function logApiCall(userId, {
  service,        // "gemini" | "plaid" | "alpaca" | "youtube" | "google_calendar" | "firebase"
  action,         // Descriptive action: "chat", "link_token", "transactions", etc.
  model = null,   // Model name if applicable: "gemini-2.5-flash", etc.
  inputTokens = 0,
  outputTokens = 0,
  estimatedCost = 0,  // In USD
  metadata = {},       // Optional extra data
}) {
  try {
    const ref = collection(db, "users", userId, USAGE_COL);
    const newDoc = doc(ref);
    await setDoc(newDoc, {
      service,
      action,
      model,
      inputTokens,
      outputTokens,
      estimatedCost: Number(estimatedCost) || 0,
      metadata,
      timestamp: new Date().toISOString(),
    });
    return { id: newDoc.id };
  } catch (e) {
    console.error("[API Cost Tracker] Log error:", e);
    return null;
  }
}

/**
 * Get aggregated API usage for a user.
 * @param {string} period - "7d" | "30d" | "90d" | "all"
 */
export async function getApiUsage(userId, period = "30d") {
  try {
    const ref = collection(db, "users", userId, USAGE_COL);
    const cutoff = getCutoffDate(period);
    const q = cutoff
      ? query(ref, where("timestamp", ">=", cutoff), orderBy("timestamp", "desc"))
      : query(ref, orderBy("timestamp", "desc"));

    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Aggregate by service
    const byService = {};
    const byDay = {};
    let totalCost = 0;
    let totalTokens = 0;

    for (const item of items) {
      const svc = item.service || "unknown";
      if (!byService[svc]) byService[svc] = { calls: 0, cost: 0, tokens: 0 };
      byService[svc].calls++;
      byService[svc].cost += item.estimatedCost || 0;
      byService[svc].tokens += (item.inputTokens || 0) + (item.outputTokens || 0);
      totalCost += item.estimatedCost || 0;
      totalTokens += (item.inputTokens || 0) + (item.outputTokens || 0);

      const day = (item.timestamp || "").split("T")[0];
      if (day) {
        if (!byDay[day]) byDay[day] = { cost: 0, calls: 0 };
        byDay[day].cost += item.estimatedCost || 0;
        byDay[day].calls++;
      }
    }

    return {
      items,
      byService,
      byDay,
      totalCost,
      totalTokens,
      totalCalls: items.length,
      period,
    };
  } catch (e) {
    console.error("[API Cost Tracker] Fetch error:", e);
    return { items: [], byService: {}, byDay: {}, totalCost: 0, totalTokens: 0, totalCalls: 0, period };
  }
}

function getCutoffDate(period) {
  if (period === "all") return null;
  const days = parseInt(period) || 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Service cost reference (for estimation when exact cost isn't known)
export const COST_REFERENCE = {
  gemini: { inputPer1k: 0.00125, outputPer1k: 0.005 },
  plaid: { linkToken: 0, exchangeToken: 0.30, transactions: 0 },
  alpaca: { trade: 0, data: 0 },
  youtube: { quotaUnit: 0 },  // Free within 10K/day
  google_calendar: { call: 0 },
  firebase: { read: 0, write: 0 },  // Free tier
};
