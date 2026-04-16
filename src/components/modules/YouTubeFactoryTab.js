"use client";
import { useState } from "react";
import StrategyTab from "./factory/StrategyTab";
import ProductionTab from "./factory/ProductionTab";
import DashboardTab from "./factory/DashboardTab";
import SettingsTab from "./factory/SettingsTab";

const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "12px", padding: "16px",
};
const btnTab = (active) => ({
  flex: 1, padding: "8px 4px", borderRadius: "8px", fontSize: "10px",
  cursor: "pointer", textAlign: "center", border: "none",
  fontWeight: active ? "700" : "400",
  background: active ? "rgba(139,92,246,0.15)" : "var(--bg-tertiary, rgba(255,255,255,0.04))",
  color: active ? "#c4b5fd" : "var(--text-secondary)",
  borderBottom: active ? "2px solid #8b5cf6" : "2px solid transparent",
});

const TABS = [
  { id: "strategy", icon: "🧭", label: "Strategy" },
  { id: "production", icon: "🏭", label: "Production" },
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

export default function YouTubeFactoryTab({ channels }) {
  const [tab, setTab] = useState("strategy");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ ...card, borderTop: "3px solid #8b5cf6", textAlign: "center", padding: "24px", background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(109,40,217,0.04))" }}>
        <div style={{ fontSize: "24px", marginBottom: "4px" }}>⚡</div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "2px" }}>RUBRIC Factory</h3>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "1px", textTransform: "uppercase" }}>
          Autonomous YouTube Channel Engine
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={btnTab(tab === t.id)}>
            <div style={{ fontSize: "14px" }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "strategy" && <StrategyTab channels={channels} onActivate={() => setTab("production")} />}
      {tab === "production" && <ProductionTab channels={channels} />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
