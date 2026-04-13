import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { publicToken, userId, profileId, institutionName } = await req.json();
    if (!publicToken || !userId) {
      return Response.json({ error: "publicToken and userId required" }, { status: 400 });
    }

    const { client: plaidClient, env } = await getPlaidClient(userId);
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = response.data;

    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    // Store under user's finance profile (personal or partner)
    const pId = profileId || "personal";
    await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").doc(item_id).set({
        accessToken: access_token,
        itemId: item_id,
        userId,
        profileId: pId,
        institutionName: institutionName || "Unknown Bank",
        linkedAt: new Date().toISOString(),
        status: "active",
        env,
      });

    return Response.json({
      success: true,
      itemId: item_id,
      institution: institutionName,
      env,
    });
  } catch (error) {
    console.error("[PLAID] exchange-token error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
