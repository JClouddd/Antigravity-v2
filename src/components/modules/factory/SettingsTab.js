"use client";
import { useState } from "react";
import { card, btnPrimary, btnSecondary, inputStyle, PROVIDERS } from "./FactoryStyles";
import { useFactoryApi } from "./useFactoryApi";

export default function SettingsTab() {
  const { api } = useFactoryApi();

  // Knowledge Base
  const [kbQuery, setKbQuery] = useState("");
  const [kbAnswer, setKbAnswer] = useState(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");

  // Storage status
  const [storageStatus, setStorageStatus] = useState(null);

  const queryKB = async () => {
    if (!kbQuery.trim()) return;
    setKbLoading(true);
    const data = await api("knowledge", { action: "query", query: kbQuery });
    setKbAnswer(data);
    setKbLoading(false);
  };

  const ingestKB = async () => {
    if (!ingestText.trim()) return;
    const data = await api("knowledge", { action: "ingest", title: ingestTitle || "Manual entry", content: ingestText, source: "manual" });
    if (data.error) { alert(data.error); return; }
    alert("✅ Knowledge ingested");
    setIngestText("");
    setIngestTitle("");
  };

  const checkStorage = async () => {
    const data = await api("storage", { action: "setup" });
    setStorageStatus(data);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h4 style={{ fontSize: "14px", fontWeight: "700" }}>⚙️ Settings</h4>

      {/* Provider defaults */}
      <div style={card}>
        <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          AI Provider Defaults
        </div>
        <p style={{ fontSize: "9px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
          Default providers for new automations. Override per-channel in Strategy tab.
        </p>
        {Object.entries(PROVIDERS).map(([type, options]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", fontWeight: "600", width: "50px", textTransform: "capitalize" }}>{type}</span>
            <div style={{ flex: 1, display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {options.map(o => (
                <span key={o.id} style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  {o.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Knowledge Base */}
      <div style={card}>
        <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          🧠 Knowledge Base
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          <input value={kbQuery} onChange={e => setKbQuery(e.target.value)}
            placeholder="Ask the knowledge base..." style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => e.key === "Enter" && queryKB()} />
          <button onClick={queryKB} disabled={kbLoading} style={btnPrimary}>
            {kbLoading ? "..." : "Ask"}
          </button>
        </div>
        {kbAnswer && (
          <div style={{ fontSize: "11px", lineHeight: 1.5, padding: "8px", borderRadius: "6px", background: "rgba(139,92,246,0.05)", marginBottom: "8px" }}>
            {kbAnswer.answer || kbAnswer.error || JSON.stringify(kbAnswer)}
          </div>
        )}
        <details style={{ fontSize: "10px" }}>
          <summary style={{ cursor: "pointer", color: "var(--text-tertiary)" }}>+ Ingest Knowledge</summary>
          <div style={{ marginTop: "8px" }}>
            <input value={ingestTitle} onChange={e => setIngestTitle(e.target.value)} placeholder="Title" style={{ ...inputStyle, marginBottom: "6px" }} />
            <textarea value={ingestText} onChange={e => setIngestText(e.target.value)} placeholder="Paste research, notes, or training data..." rows={4}
              style={{ ...inputStyle, resize: "vertical" }} />
            <button onClick={ingestKB} style={{ ...btnPrimary, marginTop: "6px", width: "100%", fontSize: "10px" }}>
              Ingest →
            </button>
          </div>
        </details>
      </div>

      {/* Storage */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)" }}>
            ☁️ Storage Status
          </div>
          <button onClick={checkStorage} style={{ ...btnSecondary, padding: "4px 8px", fontSize: "9px" }}>
            Check
          </button>
        </div>
        {storageStatus && (
          <div style={{ fontSize: "10px", marginTop: "8px", color: storageStatus.status === "ready" ? "#10b981" : "var(--text-tertiary)" }}>
            {storageStatus.status === "ready" ? "✅ Connected" : storageStatus.status === "not_configured" ? "❌ Not configured" : `ℹ️ ${storageStatus.message || storageStatus.status}`}
            {storageStatus.bucketName && <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>Bucket: {storageStatus.bucketName}</div>}
          </div>
        )}
      </div>

      {/* API Status */}
      <div style={card}>
        <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          🔑 API Status
        </div>
        <div style={{ fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div>Gemini: <span style={{ color: "#10b981" }}>● Connected</span></div>
          <div>fal.ai: <span style={{ color: "#10b981" }}>● Connected</span></div>
          <div>YouTube API: <span style={{ color: "#f59e0b" }}>○ Optional</span></div>
          <div>Cloud Run (Composer): <span style={{ color: "#ef4444" }}>○ Not deployed</span></div>
        </div>
      </div>
    </div>
  );
}
