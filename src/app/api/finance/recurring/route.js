import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { userId, profileId } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const pId = profileId || "personal";
    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    // Get all active Plaid items for this profile
    const itemsSnap = await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").where("status", "==", "active").get();

    if (itemsSnap.empty) {
      return Response.json({ recurring: [], message: "No linked accounts" });
    }

    const { client: plaidClient, env } = await getPlaidClient(userId);

    let allRecurring = [];

    for (const plaidDoc of itemsSnap.docs) {
      const { accessToken, institutionName } = plaidDoc.data();

      try {
        const response = await plaidClient.transactionsRecurringGet({
          access_token: accessToken,
          options: {},
        });

        // Combine inflow and outflow streams
        const outflows = (response.data.outflow_streams || []).map(s => ({
          ...s,
          is_inflow_stream: false,
          institution: institutionName,
        }));
        const inflows = (response.data.inflow_streams || []).map(s => ({
          ...s,
          is_inflow_stream: true,
          institution: institutionName,
        }));

        allRecurring.push(...outflows, ...inflows);
      } catch (plaidErr) {
        console.error(`[PLAID] recurring error for ${institutionName}:`, plaidErr.message);
      }
    }

    return Response.json({
      recurring: allRecurring,
      env,
      profileId: pId,
    });
  } catch (error) {
    console.error("[PLAID] recurring error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
