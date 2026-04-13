"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getApiUsage } from "@/lib/apiCostTracker";

// ─── API Costs Tab ───────────────────────────────────────────────────────────
// Real-time cost tracking with per-instance activity log, service breakdown,
// and auto-refresh that catches new entries (like AI Advisor calls) instantly.

const SVC_META = {
  gemini:          { icon: "🤖", color: "#6366f1", label: "Gemini AI" },
  plaid:           { icon: "🏦", color: "#10b981", label: "Plaid" },
  coingecko:       { icon: "₿",  color: "#f59e0b", label: "CoinGecko" },
  alpaca:          { icon: "📈", color: "#3b82f6", label: "Alpaca" },
  youtube:         { icon: "▶️",  color: "#ef4444", label: "YouTube" },
  google_calendar: { icon: "📅", color: "#14b8a6", label: "Google Calendar" },
  firebase:        { icon: "🔥", color: "#f97316", label: "Firebase" },
  unknown:         { icon: "❓", color: "#94a3b8", label: "Unknown" },
};

const getMeta = (svc) => SVC_META[svc] || SVC_META.unknown;

// Cost reference data
const COST_REF = [
  ["Gemini (2.5 Flash)", "$0.15/1M input, $0.60/1M output", "Pay-as-you-go"],
  ["Gemini (2.5 Pro)", "$1.25/1M input, $10/1M output", "Heavy analysis"],
  ["Plaid", "$0 sandbox / $0.30 per link (prod)", "Transactions included"],
  ["CoinGecko", "Free", "10K calls/month, 5min cache"],
  ["Firebase/Firestore", "Free tier", "1GB storage, 50K reads/day"],
];

export default function APICostsTab({ user }) {
  const [usage, setUsage] = useState(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [logLimit, setLogLimit] = useState(25);
  const [lastRefresh, setLastRefresh] = useState(null);

  const uid = user?.uid;

  // Fetch usage data
  const fetchUsage = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await getApiUsage(uid, period);
      setUsage(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Fetch usage error:", e);
    }
    setLoading(false);
  }, [uid, period]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  // Auto-refresh every 15 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(fetchUsage, 15000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  // Format timestamp to readable
  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading && !usage) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading cost data...</div>;

  if (!usage) return null;

  const items = usage.items || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Period + Refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["7d", "30d", "90d", "all"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={period === p ? "btn btn-primary btn-sm" : "btn btn-sm"}>
              {p === "all" ? "All Time" : p}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              🔄 Auto-refresh 15s • Updated {formatTime(lastRefresh.toISOString())}
            </span>
          )}
          <button className="btn btn-sm" onClick={fetchUsage} style={{ fontSize: 10 }}>Refresh Now</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>${usage.totalCost.toFixed(4)}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Cost ({period})</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{usage.totalCalls.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>API Calls</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{usage.totalTokens.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Tokens</div>
        </div>
      </div>

      {/* By Service */}
      {Object.keys(usage.byService || {}).length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cost by Service</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(usage.byService).sort((a, b) => b[1].cost - a[1].cost).map(([svc, data]) => {
              const meta = getMeta(svc);
              const maxCost = Math.max(...Object.values(usage.byService).map(s => s.cost), 0.001);
              const pct = (data.cost / maxCost) * 100;
              return (
                <div key={svc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 120, fontSize: 12, fontWeight: 600, display: "flex", gap: 4, alignItems: "center" }}>
                    <span>{meta.icon}</span> {meta.label}
                  </div>
                  <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 3, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: meta.color, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ width: 70, textAlign: "right", fontSize: 12, fontWeight: 600 }}>${data.cost.toFixed(4)}</div>
                  <div style={{ width: 60, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{data.calls} calls</div>
                  <div style={{ width: 60, textAlign: "right", fontSize: 10, color: "var(--text-tertiary)" }}>{data.tokens?.toLocaleString() || 0} tkn</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>
            Activity Log
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 8 }}>
              {items.length} entries
            </span>
          </h3>
          <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowLog(!showLog)}>
            {showLog ? "Hide" : "Show"}
          </button>
        </div>

        {showLog && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Time", "Service", "Action", "Model", "Tokens", "Cost"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Tokens" || h === "Cost" ? "right" : "left",
                    padding: "8px 12px", fontSize: 10, color: "var(--text-tertiary)",
                    textTransform: "uppercase", letterSpacing: "0.5px",
                    borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, logLimit).map((item, i) => {
                const meta = getMeta(item.service);
                const totalTokens = (item.inputTokens || 0) + (item.outputTokens || 0);
                const isRecent = item.timestamp && (Date.now() - new Date(item.timestamp).getTime()) < 60000;
                return (
                  <tr key={item.id || i}
                    style={{
                      transition: "background 0.15s",
                      background: isRecent ? "rgba(16,185,129,0.05)" : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = isRecent ? "rgba(16,185,129,0.05)" : "transparent"}>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                      {isRecent && <span style={{ color: "#10b981", marginRight: 4 }}>●</span>}
                      {formatTime(item.timestamp)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span className="badge" style={{ background: `${meta.color}15`, color: meta.color, fontSize: 10 }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12 }}>{item.action || "—"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-secondary)" }}>{item.model || "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11 }}>
                      {totalTokens > 0 ? (
                        <span title={`In: ${item.inputTokens || 0} / Out: ${item.outputTokens || 0}`}>
                          {totalTokens.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: item.estimatedCost > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>
                      {item.estimatedCost > 0 ? `$${item.estimatedCost.toFixed(5)}` : "Free"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {showLog && items.length > logLimit && (
          <div style={{ padding: "8px 14px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setLogLimit(l => l + 25)}>
              Show More ({items.length - logLimit} remaining)
            </button>
          </div>
        )}

        {showLog && items.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            No API calls recorded yet. Use the AI Advisor or connect a bank to see entries appear here in real time.
          </div>
        )}
      </div>

      {/* Cost Reference */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Cost Reference</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          {COST_REF.map(([name, cost, note]) => (
            <div key={name} style={{ display: "flex", gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 150, fontWeight: 500 }}>{name}</div>
              <div style={{ flex: 1, color: "var(--text-secondary)" }}>{cost}</div>
              <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
