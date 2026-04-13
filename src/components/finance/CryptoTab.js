"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";

// ─── Crypto Portfolio Tracker ────────────────────────────────────────────────
// Manual holdings + CoinGecko live prices (free API, 10K calls/month)

const POPULAR_COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "polygon-ecosystem-token", symbol: "POL", name: "Polygon" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap" },
];

export default function CryptoTab({ user, profileId = "personal" }) {
  const [holdings, setHoldings] = useState([]);
  const [prices, setPrices] = useState({});
  const [markets, setMarkets] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showMarkets, setShowMarkets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [form, setForm] = useState({ coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", quantity: "", purchasePrice: "", note: "" });
  const [editing, setEditing] = useState(null);

  const uid = user?.uid;

  // Load holdings from Firestore
  const loadHoldings = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "finance_profiles", profileId, "crypto_holdings");
      const snap = await getDocs(query(ref, orderBy("name")));
      setHoldings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Load crypto error:", e); }
    setLoading(false);
  }, [uid, profileId]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // Fetch prices for held coins
  const fetchPrices = useCallback(async () => {
    if (!uid || holdings.length === 0) return;
    setPriceLoading(true);
    try {
      const coinIds = [...new Set(holdings.map(h => h.coinId))];
      const res = await fetch("/api/finance/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, action: "prices", coinIds }),
      });
      const data = await res.json();
      setPrices(data.prices || {});
    } catch (e) { console.error("Fetch prices error:", e); }
    setPriceLoading(false);
  }, [uid, holdings]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  // Fetch market overview
  const fetchMarkets = useCallback(async () => {
    if (!uid) return;
    try {
      const res = await fetch("/api/finance/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, action: "markets" }),
      });
      const data = await res.json();
      setMarkets(data.markets || []);
    } catch (e) { console.error("Fetch markets error:", e); }
  }, [uid]);

  // Add holding
  const addHolding = async () => {
    if (!uid || !form.quantity) return;
    const ref = doc(collection(db, "users", uid, "finance_profiles", profileId, "crypto_holdings"));
    await setDoc(ref, {
      coinId: form.coinId,
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      quantity: Number(form.quantity),
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      note: form.note || "",
      addedAt: new Date().toISOString(),
    });
    setForm({ coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", quantity: "", purchasePrice: "", note: "" });
    setShowAdd(false);
    loadHoldings();
  };

  // Update holding
  const updateHolding = async (id, updates) => {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid, "finance_profiles", profileId, "crypto_holdings", id), updates);
    setEditing(null);
    loadHoldings();
  };

  // Delete holding
  const deleteHolding = async (id) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "finance_profiles", profileId, "crypto_holdings", id));
    loadHoldings();
  };

  // ─── Computed ──────────────────────────────────────────────────────────────
  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const p = prices[h.coinId];
      const currentPrice = p?.usd || 0;
      const change24h = p?.usd_24h_change || 0;
      const currentValue = h.quantity * currentPrice;
      const costBasis = h.purchasePrice ? h.quantity * h.purchasePrice : null;
      const pnl = costBasis !== null ? currentValue - costBasis : null;
      const pnlPct = costBasis && costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : null;

      return { ...h, currentPrice, change24h, currentValue, costBasis, pnl, pnlPct };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings, prices]);

  const totalValue = useMemo(() => enrichedHoldings.reduce((s, h) => s + h.currentValue, 0), [enrichedHoldings]);
  const totalCost = useMemo(() => enrichedHoldings.reduce((s, h) => s + (h.costBasis || 0), 0), [enrichedHoldings]);
  const totalPnl = totalCost > 0 ? totalValue - totalCost : null;

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading crypto portfolio...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Portfolio Value</div>
        </div>
        {totalPnl !== null && (
          <div className="card">
            <div style={{ fontSize: 22, fontWeight: 700, color: totalPnl >= 0 ? "#10b981" : "#ef4444" }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total P&L</div>
          </div>
        )}
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{holdings.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Holdings</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-sm" onClick={() => { setShowMarkets(!showMarkets); if (!showMarkets && markets.length === 0) fetchMarkets(); }}>
          🌍 Market Overview
        </button>
        <button className="btn btn-sm" onClick={() => fetchPrices()} disabled={priceLoading}>
          {priceLoading ? "⏳" : "🔄"} Refresh Prices
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          + Add Holding
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add Crypto Holding</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Coin</label>
              <select className="input" value={form.coinId} onChange={e => {
                const coin = POPULAR_COINS.find(c => c.id === e.target.value);
                if (coin) setForm(f => ({ ...f, coinId: coin.id, symbol: coin.symbol, name: coin.name }));
              }}>
                {POPULAR_COINS.map(c => (
                  <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Quantity</label>
                <input className="input" type="number" step="any" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.5" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Purchase Price (USD, optional)</label>
                <input className="input" type="number" step="0.01" value={form.purchasePrice}
                  onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} placeholder="$50,000" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Note (optional)</label>
              <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Coinbase, DCA buy, etc." />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addHolding} disabled={!form.quantity}>Add Holding</button>
          </div>
        </div>
      )}

      {/* Holdings list */}
      {enrichedHoldings.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Coin", "Qty", "Price", "24h", "Value", "P&L", ""].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Coin" || h === "" ? "left" : "right",
                    padding: "10px 12px", fontSize: 10, color: "var(--text-tertiary)",
                    textTransform: "uppercase", letterSpacing: "0.5px",
                    borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedHoldings.map(h => (
                <tr key={h.id} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{h.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{h.name}</div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>{h.quantity}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13 }}>
                    ${h.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: h.change24h >= 0 ? "#10b981" : "#ef4444" }}>
                    {h.change24h >= 0 ? "+" : ""}{h.change24h.toFixed(2)}%
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#f59e0b" }}>
                    ${h.currentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                    {h.pnl !== null ? (
                      <span style={{ color: h.pnl >= 0 ? "#10b981" : "#ef4444" }}>
                        {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)} ({h.pnlPct?.toFixed(1)}%)
                      </span>
                    ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => deleteHolding(h.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>₿</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Crypto Holdings</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 13, marginBottom: 12 }}>
            Add your cryptocurrency holdings to track their value with live prices.
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Your First Holding</button>
        </div>
      )}

      {/* Market Overview */}
      {showMarkets && markets.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Top 20 by Market Cap</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "Coin", "Price", "24h", "7d", "Market Cap"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "#" || h === "Coin" ? "left" : "right",
                    padding: "8px 12px", fontSize: 10, color: "var(--text-tertiary)",
                    textTransform: "uppercase", borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markets.slice(0, 20).map((m, i) => (
                <tr key={m.id} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>{i + 1}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {m.image && <img src={m.image} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />}
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{m.symbol?.toUpperCase()}</span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12 }}>
                    ${m.current_price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: (m.price_change_percentage_24h_in_currency || 0) >= 0 ? "#10b981" : "#ef4444" }}>
                    {(m.price_change_percentage_24h_in_currency || 0) >= 0 ? "+" : ""}{(m.price_change_percentage_24h_in_currency || 0).toFixed(2)}%
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: (m.price_change_percentage_7d_in_currency || 0) >= 0 ? "#10b981" : "#ef4444" }}>
                    {(m.price_change_percentage_7d_in_currency || 0) >= 0 ? "+" : ""}{(m.price_change_percentage_7d_in_currency || 0).toFixed(2)}%
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>
                    ${(m.market_cap / 1e9).toFixed(1)}B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
