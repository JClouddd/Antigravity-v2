import { Products, CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });

    const plaidClient = getPlaidClient();

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Antigravity Hub",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({
      link_token: response.data.link_token,
      env: process.env.PLAID_ENV || "sandbox",
    });
  } catch (error) {
    console.error("[PLAID] link-token error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
