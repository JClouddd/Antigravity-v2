"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Investments Tab ─────────────────────────────────────────────────────────
// Plaid Investments API — shows brokerage holdings, P&L, allocation.

const TYPE_META = {
  equity: { icon: "📈", label: "Stocks", color: "#3b82f6" },
  etf: { icon: "📊", label: "ETFs", color: "#6366f1" },
  "mutual fund": { icon: "🏦", label: "Mutual Funds", color: "#8b5cf6" },
  fixed_income: { icon: "📋", label: "Bonds", color: "#14b8a6" },
  derivative: { icon: "📉", label: "Options", color: "#f59e0b" },
  cash: { icon: "💵", label: "Cash", color: "#10b981" },
  cryptocurrency: { icon: "₿", label: "Crypto", color: "#f97316" },
  other: { icon: "📦", label: "Other", color: "#94a3b8" },
};

const getTypeMeta = (type) => TYPE_META[type?.toLowerCase()] || TYPE_META.other;

export default function InvestmentsTab({ user, profileId = "personal" }) {
  const [holdings, setHoldings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const uid = user?.uid;

  const fetchInvestments = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finance/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, profileId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setHoldings(data.holdings || []);
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [uid, profileId]);

  useEffect(() => { fetchInvestments(); }, [fetchInvestments]);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const totalValue = useMemo(() => holdings.reduce((s, h) => s + (h.value || 0), 0), [holdings]);
  const totalCost = useMemo(() => holdings.reduce((s, h) => s + (h.costBasis || 0), 0), [holdings]);
  const totalPnl = totalCost > 0 ? totalValue - totalCost : null;

  const byType = useMemo(() => {
    const map = {};
    holdings.forEach(h => {
      const t = h.type || "other";
      if (!map[t]) map[t] = { value: 0, count: 0 };
      map[t].value += h.value || 0;
      map[t].count++;
    });
    return Object.entries(map).sort((a, b) => b[1].value - a[1].value);
  }, [holdings]);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading investment data...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div className="card" style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.05)" }}>
          <div style={{ fontSize: 13, color: "#f59e0b" }}>⚠️ {error}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            Make sure you have an investment account linked via Plaid (e.g., Fidelity, Schwab, Robinhood).
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Value</div>
        </div>
        {totalPnl !== null && (
          <div className="card">
            <div style={{ fontSize: 22, fontWeight: 700, color: totalPnl >= 0 ? "#10b981" : "#ef4444" }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Unrealized P&L</div>
          </div>
        )}
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{holdings.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Positions</div>
        </div>
      </div>

      {/* Allocation breakdown */}
      {byType.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Allocation</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byType.map(([type, data]) => {
              const meta = getTypeMeta(type);
              const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
              return (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 110, fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                    <span>{meta.icon}</span> {meta.label}
                  </div>
                  <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 3, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: meta.color, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{pct.toFixed(1)}%</div>
                  <div style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 600 }}>${data.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings table */}
      {holdings.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Security", "Type", "Qty", "Price", "Cost Basis", "Value", "P&L"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Security" || h === "Type" ? "left" : "right",
                    padding: "10px 12px", fontSize: 10, color: "var(--text-tertiary)",
                    textTransform: "uppercase", borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.sort((a, b) => (b.value || 0) - (a.value || 0)).map(h => {
                const pnl = h.costBasis ? (h.value || 0) - h.costBasis : null;
                const pnlPct = h.costBasis && h.costBasis > 0 ? (pnl / h.costBasis) * 100 : null;
                const meta = getTypeMeta(h.type);
                return (
                  <tr key={h.id} style={{ transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{h.ticker || h.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{h.ticker ? h.name : ""} • {h.institution}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="badge" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.icon} {meta.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>{h.quantity?.toFixed(4)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                      ${(h.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>
                      {h.costBasis ? `$${h.costBasis.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                      ${(h.value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                      {pnl !== null ? (
                        <span style={{ color: pnl >= 0 ? "#10b981" : "#ef4444" }}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          <br /><span style={{ fontSize: 10 }}>({pnlPct?.toFixed(1)}%)</span>
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !error && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📈</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Investment Accounts Linked</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            Link a brokerage account (Fidelity, Schwab, Robinhood, etc.) via Plaid to see your holdings here.
          </div>
        </div>
      )}

      {/* Linked accounts */}
      {accounts.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Investment Accounts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>{a.institution} • {a.subtype} • ****{a.mask}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>
                  ${(a.balanceCurrent || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
