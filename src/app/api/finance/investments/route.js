import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { userId, profileId } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const pId = profileId || "personal";
    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    // Get all active Plaid items
    const itemsSnap = await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").where("status", "==", "active").get();

    if (itemsSnap.empty) {
      return Response.json({ holdings: [], securities: [], accounts: [], message: "No linked accounts" });
    }

    const { client: plaidClient, env } = await getPlaidClient(userId);

    let allHoldings = [];
    let allSecurities = [];
    let allAccounts = [];

    for (const plaidDoc of itemsSnap.docs) {
      const { accessToken, institutionName } = plaidDoc.data();

      try {
        const response = await plaidClient.investmentsHoldingsGet({
          access_token: accessToken,
        });

        const holdings = (response.data.holdings || []).map(h => ({
          ...h,
          institution: institutionName,
        }));

        const securities = (response.data.securities || []).map(s => ({
          securityId: s.security_id,
          name: s.name,
          ticker: s.ticker_symbol,
          type: s.type,
          closePrice: s.close_price,
          closePriceDate: s.close_price_as_of,
          isinNumber: s.isin_number,
          isoCurrencyCode: s.iso_currency_code,
        }));

        const accounts = (response.data.accounts || []).map(a => ({
          id: a.account_id,
          name: a.name,
          officialName: a.official_name,
          type: a.type,
          subtype: a.subtype,
          balanceCurrent: a.balances.current,
          institution: institutionName,
          mask: a.mask,
        }));

        allHoldings.push(...holdings);
        allSecurities.push(...securities);
        allAccounts.push(...accounts);
      } catch (plaidErr) {
        // PRODUCT_NOT_READY or not supported by this item — skip silently
        if (plaidErr?.response?.data?.error_code === "PRODUCTS_NOT_SUPPORTED") {
          console.log(`[PLAID] Investments not supported for ${institutionName}`);
        } else {
          console.error(`[PLAID] investments error for ${institutionName}:`, plaidErr.message);
        }
      }
    }

    // Enrich holdings with security details
    const secMap = {};
    allSecurities.forEach(s => { secMap[s.securityId] = s; });

    const enrichedHoldings = allHoldings.map(h => {
      const sec = secMap[h.security_id] || {};
      return {
        id: h.account_id + "_" + h.security_id,
        accountId: h.account_id,
        securityId: h.security_id,
        name: sec.name || "Unknown Security",
        ticker: sec.ticker || "",
        type: sec.type || "unknown",
        quantity: h.quantity,
        costBasis: h.cost_basis,
        value: h.institution_value,
        price: sec.closePrice,
        priceDate: sec.closePriceDate,
        currency: h.iso_currency_code || "USD",
        institution: h.institution,
      };
    });

    return Response.json({
      holdings: enrichedHoldings,
      securities: allSecurities,
      accounts: allAccounts.filter(a => a.type === "investment"),
      env,
      profileId: pId,
    });
  } catch (error) {
    console.error("[PLAID] investments error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
