import { getAdminDb } from "@/lib/firebaseAdmin";

// CoinGecko free API proxy — caches results in Firestore to stay within 10K/month limit.
// No API key needed for the free tier.

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req) {
  try {
    const { userId, action, coinIds, holdings } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const adminDb = getAdminDb();

    // ─── Get Prices ──────────────────────────────────────────────────────
    if (action === "prices") {
      const ids = (coinIds || []).join(",");
      if (!ids) return Response.json({ prices: {} });

      // Check cache
      if (adminDb) {
        const cacheRef = adminDb.collection("cache").doc(`crypto_prices_${ids.slice(0, 50)}`);
        const cached = await cacheRef.get();
        if (cached.exists) {
          const data = cached.data();
          if (Date.now() - new Date(data.timestamp).getTime() < CACHE_TTL_MS) {
            return Response.json({ prices: data.prices, cached: true });
          }
        }
      }

      const res = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        { headers: { accept: "application/json" } }
      );
      if (!res.ok) {
        const txt = await res.text();
        return Response.json({ error: `CoinGecko error: ${res.status} ${txt}` }, { status: 502 });
      }
      const prices = await res.json();

      // Cache result
      if (adminDb) {
        const cacheRef = adminDb.collection("cache").doc(`crypto_prices_${ids.slice(0, 50)}`);
        await cacheRef.set({ prices, timestamp: new Date().toISOString() });
      }

      return Response.json({ prices, cached: false });
    }

    // ─── Search Coins ────────────────────────────────────────────────────
    if (action === "search") {
      const { query } = await req.json().catch(() => ({}));
      const searchQuery = query || (await req.json()).query || "";
      const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      return Response.json({ coins: (data.coins || []).slice(0, 20) });
    }

    // ─── Top Coins (market overview) ─────────────────────────────────────
    if (action === "markets") {
      // Check cache
      if (adminDb) {
        const cacheRef = adminDb.collection("cache").doc("crypto_markets");
        const cached = await cacheRef.get();
        if (cached.exists) {
          const data = cached.data();
          if (Date.now() - new Date(data.timestamp).getTime() < CACHE_TTL_MS) {
            return Response.json({ markets: data.markets, cached: true });
          }
        }
      }

      const res = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d`,
        { headers: { accept: "application/json" } }
      );
      const markets = await res.json();

      if (adminDb) {
        const cacheRef = adminDb.collection("cache").doc("crypto_markets");
        await cacheRef.set({ markets, timestamp: new Date().toISOString() });
      }

      return Response.json({ markets, cached: false });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[CRYPTO] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
