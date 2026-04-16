"use client";
import { useState, useEffect, useCallback } from "react";
import { card, btnSecondary } from "./FactoryStyles";
import { useFactoryApi } from "./useFactoryApi";

export default function DashboardTab() {
  const { api } = useFactoryApi();
  const [costs, setCosts] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [costData, schedData, galleryData] = await Promise.all([
      api("generate", { action: "costs" }),
      api("scheduler", { action: "list" }),
      api("assets", { action: "list", limit: 12 }),
    ]);
    setCosts(costData);
    setSchedules(schedData.schedules || []);
    setGallery(galleryData.assets || []);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ fontSize: "14px", fontWeight: "700" }}>📊 Dashboard</h4>
        <button onClick={load} disabled={loading} style={btnSecondary}>{loading ? "..." : "↻"}</button>
      </div>

      {/* Cost Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: "800", color: "#8b5cf6" }}>
            ${(costs?.total || 0).toFixed(2)}
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Spent</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: "800", color: "#3b82f6" }}>
            {costs?.count || 0}
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Operations</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: "800", color: "#10b981" }}>
            {schedules.filter(s => s.active).length}
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Active Schedules</div>
        </div>
      </div>

      {/* Cost breakdown */}
      {costs?.byType && Object.keys(costs.byType).length > 0 && (
        <div style={card}>
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Cost Breakdown</div>
          {Object.entries(costs.byType).map(([type, amount]) => (
            <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
              <span style={{ fontSize: "11px", textTransform: "capitalize" }}>{type}</span>
              <span style={{ fontSize: "11px", fontWeight: "600" }}>${Number(amount).toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active Schedules */}
      {schedules.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Automation Schedules</div>
          {schedules.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "600" }}>{s.niche || s.channelName || "Schedule"}</div>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{s.frequency} · {s.videoTier} · {s.totalRuns || 0} videos produced</div>
              </div>
              <div style={{ fontSize: "10px", color: s.active ? "#10b981" : "#ef4444" }}>
                {s.active ? "● Active" : "○ Paused"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery preview */}
      {gallery.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Recent Assets</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
            {gallery.slice(0, 8).map((a, i) => (
              <div key={i} style={{ aspectRatio: "16/9", borderRadius: "6px", overflow: "hidden", background: "var(--bg-tertiary)" }}>
                {a.url && <img src={a.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {!costs && !loading && (
        <div style={{ ...card, textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "20px", marginBottom: "8px" }}>📊</div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            No production data yet. Start producing videos from the Strategy tab.
          </div>
        </div>
      )}
    </div>
  );
}
