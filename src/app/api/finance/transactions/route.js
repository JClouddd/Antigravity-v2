import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { userId, profileId, startDate, endDate } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const pId = profileId || "personal";
    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    // Get all active Plaid items for this profile
    const itemsSnap = await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").where("status", "==", "active").get();

    if (itemsSnap.empty) {
      return Response.json({ transactions: [], accounts: [], message: "No linked accounts" });
    }

    const plaidClient = getPlaidClient();

    const end = endDate || new Date().toISOString().split("T")[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let allTransactions = [];
    let allAccounts = [];

    for (const plaidDoc of itemsSnap.docs) {
      const { accessToken, institutionName } = plaidDoc.data();

      try {
        const txResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: { count: 500, offset: 0 },
        });

        // Map transactions — use Plaid's personal_finance_category (standard auto-categorization)
        const txns = txResponse.data.transactions.map(t => ({
          id: t.transaction_id,
          name: t.name,
          amount: t.amount,
          date: t.date,
          category: t.personal_finance_category?.primary || "OTHER",
          categoryDetail: t.personal_finance_category?.detailed || "",
          categoryConfidence: t.personal_finance_category?.confidence_level || "LOW",
          merchant: t.merchant_name || "",
          merchantLogo: t.logo_url || null,
          pending: t.pending,
          institution: institutionName,
          accountId: t.account_id,
          paymentChannel: t.payment_channel,  // "online" | "in_store" | "other"
          iso_currency: t.iso_currency_code || "USD",
        }));

        allTransactions.push(...txns);

        // Map accounts
        const accts = txResponse.data.accounts.map(a => ({
          id: a.account_id,
          name: a.name,
          officialName: a.official_name,
          type: a.type,         // "depository" | "credit" | "loan" | "investment"
          subtype: a.subtype,   // "checking" | "savings" | "credit card" etc.
          balanceCurrent: a.balances.current,
          balanceAvailable: a.balances.available,
          balanceLimit: a.balances.limit,  // Credit limit
          currency: a.balances.iso_currency_code || "USD",
          institution: institutionName,
          mask: a.mask,
        }));

        allAccounts.push(...accts);
      } catch (plaidErr) {
        console.error(`[PLAID] Error fetching from ${institutionName}:`, plaidErr.message);
      }
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({
      transactions: allTransactions,
      accounts: allAccounts,
      period: { start, end },
      env: process.env.PLAID_ENV || "sandbox",
      profileId: pId,
    });
  } catch (error) {
    console.error("[PLAID] transactions error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
