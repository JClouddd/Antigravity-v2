"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

/* ─── Shared Styles ─── */
const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "12px",
  padding: "16px",
};
const btnPrimary = {
  background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
};
const btnSecondary = {
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  color: "var(--text-secondary)",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "12px",
  cursor: "pointer",
};
const inputStyle = {
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "12px",
  color: "var(--text-primary, #fff)",
  width: "100%",
};

const TIERS = [
  { id: "budget", label: "💰 Budget", desc: "VEO 3.1 · $0.06/sec", color: "#10b981" },
  { id: "standard", label: "⚡ Standard", desc: "Kling 3.0 · $0.15/sec", color: "#3b82f6" },
  { id: "premium", label: "🔥 Premium", desc: "Seedance Fast · $0.24/sec", color: "#f59e0b" },
  { id: "cinematic", label: "🎬 Cinematic", desc: "Seedance Pro · $0.30/sec", color: "#ef4444" },
];

const PIPELINE_STATES = [
  { key: "NICHE_SELECTED", icon: "🧭", label: "Niche" },
  { key: "SCRIPT_GENERATED", icon: "📝", label: "Script" },
  { key: "ASSETS_GENERATING", icon: "🎨", label: "Assets" },
  { key: "ASSETS_READY", icon: "✅", label: "Ready" },
  { key: "COMPOSITING", icon: "🎬", label: "Compose" },
  { key: "COMPOSED", icon: "📦", label: "Done" },
  { key: "REVIEW", icon: "👁️", label: "Review" },
  { key: "PUBLISHING", icon: "📤", label: "Upload" },
  { key: "PUBLISHED", icon: "🎉", label: "Live" },
  { key: "PROMOTING", icon: "📢", label: "Promo" },
  { key: "COMPLETE", icon: "✨", label: "Complete" },
];

export default function YouTubeFactoryTab({ channels }) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState("pipeline");

  /* ── Pipeline State ── */
  const [pipelines, setPipelines] = useState([]);
  const [pipeLoading, setPipeLoading] = useState(false);
  const [newPipe, setNewPipe] = useState({ topic: "", niche: "", tier: "standard", reviewRequired: true });

  /* ── Schedule State ── */
  const [schedules, setSchedules] = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [newSched, setNewSched] = useState({
    channelId: "", niche: "", frequency: "3x/week",
    days: ["monday", "wednesday", "friday"], timeOfDay: "14:00", tier: "standard",
  });

  /* ── Knowledge State ── */
  const [kbQuery, setKbQuery] = useState("");
  const [kbAnswer, setKbAnswer] = useState(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSources, setKbSources] = useState([]);
  const [ingestText, setIngestText] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");

  /* ── Assets / Gallery State ── */
  const [factoryCosts, setFactoryCosts] = useState(null);
  const [galleryAssets, setGalleryAssets] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [savedStyles, setSavedStyles] = useState([]);

  /* ── Notebook State ── */
  const [notebooks, setNotebooks] = useState([]);
  const [nbLoading, setNbLoading] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [nbQuery, setNbQuery] = useState("");
  const [nbAnswer, setNbAnswer] = useState(null);
  const [selectedNb, setSelectedNb] = useState(null);
  const [nbHealth, setNbHealth] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);

  /* ── API Helpers ── */
  const api = async (route, body) => {
    const res = await fetch(`/api/factory/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user?.uid, ...body }),
    });
    return res.json();
  };

  /* ── Pipeline Actions ── */
  const loadPipelines = async () => {
    setPipeLoading(true);
    const data = await api("pipeline", { action: "list", limit: 20 });
    setPipelines(data.pipelines || []);
    setPipeLoading(false);
  };

  const createPipeline = async () => {
    if (!newPipe.topic) return;
    setPipeLoading(true);
    await api("pipeline", {
      action: "create",
      ...newPipe,
      videoTier: newPipe.tier,
      channelId: channels?.[0]?.id || "",
      channelName: channels?.[0]?.snippet?.title || "",
    });
    setNewPipe({ topic: "", niche: "", tier: "standard", reviewRequired: true });
    await loadPipelines();
  };

  /* ── Schedule Actions ── */
  const loadSchedules = async () => {
    setSchedLoading(true);
    const data = await api("scheduler", { action: "list" });
    setSchedules(data.schedules || []);
    setSchedLoading(false);
  };

  const createSchedule = async () => {
    if (!newSched.channelId && !channels?.[0]) return;
    setSchedLoading(true);
    await api("scheduler", {
      action: "create",
      channelId: newSched.channelId || channels?.[0]?.id || "default",
      channelName: channels?.find(c => c.id === newSched.channelId)?.snippet?.title || "",
      ...newSched,
      videoTier: newSched.tier,
      reviewRequired: true,
    });
    await loadSchedules();
  };

  /* ── Knowledge Actions ── */
  const queryKB = async () => {
    if (!kbQuery) return;
    setKbLoading(true);
    setKbAnswer(null);
    const data = await api("knowledge", { action: "query", question: kbQuery });
    setKbAnswer(data);
    setKbLoading(false);
  };

  const loadSources = async () => {
    const data = await api("knowledge", { action: "sources" });
    setKbSources(data.sources || []);
  };

  const ingestSource = async () => {
    if (!ingestText) return;
    await api("knowledge", { action: "ingest", title: ingestTitle || "Manual Entry", content: ingestText, sourceType: "text" });
    setIngestText("");
    setIngestTitle("");
    await loadSources();
  };

  /* ── Cost Actions ── */
  const loadCosts = async () => {
    const data = await api("generate", { action: "costs" });
    setFactoryCosts(data);
  };

  /* ── Gallery Actions ── */
  const loadGallery = async (type) => {
    setGalleryLoading(true);
    const data = await api("assets", { action: "list", type: type || undefined, limit: 50 });
    setGalleryAssets(data.assets || []);
    setGalleryLoading(false);
  };
  const toggleFavorite = async (assetId, current) => {
    await api("assets", { action: "favorite", assetId, favorited: !current });
    setGalleryAssets(prev => prev.map(a => a.assetId === assetId ? { ...a, favorited: !current } : a));
  };
  const loadStyles = async () => {
    const data = await api("assets", { action: "styles" });
    setSavedStyles(data.styles || []);
  };

  /* ── Notebook Actions ── */
  const loadNotebooks = async () => {
    setNbLoading(true);
    const data = await api("notebook", { action: "list-notebooks" });
    setNotebooks(data.notebooks || []);
    setNbLoading(false);
  };
  const createNotebook = async () => {
    if (!newNbName) return;
    setNbLoading(true);
    await api("notebook", { action: "create-notebook", name: newNbName });
    setNewNbName("");
    await loadNotebooks();
  };
  const queryNotebook = async () => {
    if (!nbQuery) return;
    setNbLoading(true);
    setNbAnswer(null);
    const data = await api("notebook", { action: "query", question: nbQuery, notebookId: selectedNb });
    setNbAnswer(data);
    setNbLoading(false);
  };
  const checkNbHealth = async () => {
    const data = await api("notebook", { action: "health-check" });
    setNbHealth(data);
  };
  const checkStorage = async () => {
    const data = await api("storage", { action: "setup" });
    setStorageStatus(data);
  };

  /* ── Sub-tabs ── */
  const subTabs = [
    { id: "pipeline", icon: "🏭", label: "Pipelines" },
    { id: "schedule", icon: "📅", label: "Schedules" },
    { id: "knowledge", icon: "🧠", label: "Knowledge" },
    { id: "notebook", icon: "📓", label: "Notebooks" },
    { id: "gallery", icon: "🖼️", label: "Gallery" },
    { id: "costs", icon: "💰", label: "Costs" },
  ];

  const stateIdx = (s) => PIPELINE_STATES.findIndex(p => p.key === s);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ ...card, borderTop: "3px solid #8b5cf6", textAlign: "center", padding: "24px" }}>
        <div style={{ fontSize: "24px", marginBottom: "4px" }}>🏭</div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Video Factory</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          Autonomous video production. Create pipelines, schedule uploads, query your knowledge base.
        </p>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: "6px" }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              ...btnSecondary,
              flex: 1,
              fontWeight: subTab === t.id ? "700" : "400",
              background: subTab === t.id ? "rgba(139,92,246,0.15)" : undefined,
              borderColor: subTab === t.id ? "#8b5cf6" : undefined,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── PIPELINES ── */}
      {subTab === "pipeline" && (
        <>
          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🚀 New Pipeline</h4>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <input placeholder="Topic (e.g. 'Top 10 NBA Plays 2025')" value={newPipe.topic} onChange={e => setNewPipe(p => ({ ...p, topic: e.target.value }))} style={inputStyle} />
              <input placeholder="Niche (e.g. sports)" value={newPipe.niche} onChange={e => setNewPipe(p => ({ ...p, niche: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
              {TIERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setNewPipe(p => ({ ...p, tier: t.id }))}
                  style={{
                    ...btnSecondary,
                    padding: "4px 10px",
                    fontSize: "10px",
                    borderColor: newPipe.tier === t.id ? t.color : undefined,
                    color: newPipe.tier === t.id ? t.color : undefined,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="checkbox" checked={newPipe.reviewRequired} onChange={e => setNewPipe(p => ({ ...p, reviewRequired: e.target.checked }))} />
                Review before publish
              </label>
              <div style={{ flex: 1 }} />
              <button style={btnPrimary} onClick={createPipeline} disabled={!newPipe.topic || pipeLoading}>
                {pipeLoading ? "⏳ Creating..." : "🚀 Create Pipeline"}
              </button>
            </div>
          </div>

          <button style={btnSecondary} onClick={loadPipelines} disabled={pipeLoading}>
            {pipeLoading ? "⏳ Loading..." : "📋 Load Pipelines"}
          </button>

          {pipelines.map(p => (
            <div key={p.pipelineId} style={{ ...card, borderLeft: `3px solid ${p.state === "COMPLETE" ? "#10b981" : p.error ? "#ef4444" : "#8b5cf6"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>{p.topic}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                    {p.niche && `${p.niche} · `}{p.channelName || "No channel"} · {p.videoTier}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#8b5cf6" }}>{p.progress}%</div>
                  <div style={{ fontSize: "8px", color: "var(--text-tertiary)" }}>${(p.totalCost || 0).toFixed(2)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ display: "flex", gap: "2px", marginBottom: "6px" }}>
                {PIPELINE_STATES.map((s, i) => (
                  <div
                    key={s.key}
                    title={s.label}
                    style={{
                      flex: 1,
                      height: "4px",
                      borderRadius: "2px",
                      background: i <= stateIdx(p.state)
                        ? (p.state === "COMPLETE" ? "#10b981" : "#8b5cf6")
                        : "var(--border, rgba(255,255,255,0.06))",
                    }}
                  />
                ))}
              </div>

              {/* State label */}
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                {PIPELINE_STATES.find(s => s.key === p.state)?.icon} {p.state?.replace(/_/g, " ")}
                {p.error && <span style={{ color: "#ef4444", marginLeft: "8px" }}>⚠️ {p.error}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── SCHEDULES ── */}
      {subTab === "schedule" && (
        <>
          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>📅 New Schedule</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <select value={newSched.channelId} onChange={e => setNewSched(s => ({ ...s, channelId: e.target.value }))} style={inputStyle}>
                <option value="">Select channel</option>
                {(channels || []).map(c => (
                  <option key={c.id} value={c.id}>{c.snippet?.title || c.id}</option>
                ))}
              </select>
              <input placeholder="Niche (e.g. sports)" value={newSched.niche} onChange={e => setNewSched(s => ({ ...s, niche: e.target.value }))} style={inputStyle} />
              <select value={newSched.frequency} onChange={e => setNewSched(s => ({ ...s, frequency: e.target.value }))} style={inputStyle}>
                <option value="1x/week">1x/week</option>
                <option value="2x/week">2x/week</option>
                <option value="3x/week">3x/week</option>
                <option value="5x/week">5x/week</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <input type="time" value={newSched.timeOfDay} onChange={e => setNewSched(s => ({ ...s, timeOfDay: e.target.value }))} style={inputStyle} />
              <select value={newSched.tier} onChange={e => setNewSched(s => ({ ...s, tier: e.target.value }))} style={inputStyle}>
                {TIERS.map(t => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
            <button style={btnPrimary} onClick={createSchedule} disabled={schedLoading}>
              {schedLoading ? "⏳ Creating..." : "📅 Create Schedule"}
            </button>
          </div>

          <button style={btnSecondary} onClick={loadSchedules} disabled={schedLoading}>
            {schedLoading ? "⏳ Loading..." : "📋 Load Schedules"}
          </button>

          {schedules.map(s => (
            <div key={s.scheduleId} style={{ ...card, borderLeft: `3px solid ${s.active ? "#10b981" : "#6b7280"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700" }}>{s.channelName || "Channel"}</div>
                <span style={{ fontSize: "10px", color: s.active ? "#10b981" : "#6b7280" }}>{s.active ? "🟢 Active" : "⏸️ Paused"}</span>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                {s.niche} · {s.frequency} · {s.timeOfDay} · {s.videoTier} tier · {s.totalRuns} runs
              </div>
              {s.nextRun && (
                <div style={{ fontSize: "9px", color: "#3b82f6", marginTop: "2px" }}>Next: {new Date(s.nextRun).toLocaleString()}</div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── KNOWLEDGE ── */}
      {subTab === "knowledge" && (
        <>
          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🧠 Ask Your Knowledge Base</h4>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input placeholder="Ask anything about your channels, content, strategy..." value={kbQuery} onChange={e => setKbQuery(e.target.value)} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && queryKB()} />
              <button style={btnPrimary} onClick={queryKB} disabled={kbLoading || !kbQuery}>
                {kbLoading ? "⏳" : "🔍"}
              </button>
            </div>
            {kbAnswer && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                {kbAnswer.answer || kbAnswer.error || "No answer"}
                {kbAnswer.sourcesUsed?.length > 0 && (
                  <div style={{ marginTop: "8px", fontSize: "9px", color: "var(--text-tertiary)" }}>
                    Sources: {kbAnswer.sourcesUsed.map(s => s.title).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>📥 Ingest Knowledge</h4>
            <input placeholder="Title" value={ingestTitle} onChange={e => setIngestTitle(e.target.value)} style={{ ...inputStyle, marginBottom: "6px" }} />
            <textarea placeholder="Paste content, data, research, strategy notes..." value={ingestText} onChange={e => setIngestText(e.target.value)} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button style={btnPrimary} onClick={ingestSource} disabled={!ingestText}>📥 Ingest</button>
              <button style={btnSecondary} onClick={loadSources}>📋 View Sources ({kbSources.length})</button>
            </div>
          </div>

          {kbSources.length > 0 && (
            <div style={card}>
              <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>📚 Knowledge Sources</h4>
              {kbSources.map((s, i) => (
                <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))", fontSize: "11px" }}>
                  <span style={{ fontWeight: "600" }}>{s.title}</span>
                  <span style={{ color: "var(--text-tertiary)", marginLeft: "6px" }}>{s.category} · {s.tokenEstimate} tokens · accessed {s.accessCount}x</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── COSTS ── */}
      {subTab === "costs" && (
        <>
          <button style={btnPrimary} onClick={loadCosts}>📊 Load Factory Costs</button>
          {factoryCosts && (
            <>
              <div style={{ ...card, borderTop: "3px solid #10b981" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "700" }}>💰 Total Factory Spend</h4>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#ef4444" }}>${(factoryCosts.total || 0).toFixed(2)}</div>
                </div>
                {factoryCosts.byType && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "6px" }}>
                    {Object.entries(factoryCosts.byType).map(([type, amount]) => (
                      <div key={type} style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))" }}>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b" }}>${amount.toFixed(3)}</div>
                        <div style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "capitalize" }}>{type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {factoryCosts.costs?.length > 0 && (
                <div style={card}>
                  <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>📋 Recent Costs</h4>
                  <div style={{ maxHeight: "200px", overflow: "auto" }}>
                    {factoryCosts.costs.slice(0, 20).map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))", fontSize: "10px" }}>
                        <span>{c.type} · {c.model?.split("/").pop()}</span>
                        <span style={{ color: "#ef4444", fontWeight: "600" }}>-${c.amount.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {/* ── NOTEBOOKS ── */}
      {subTab === "notebook" && (
        <>
          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>📓 NotebookLM Bridge</h4>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              Create knowledge notebooks per channel/niche. Query with AI. Falls back to built-in Knowledge Engine.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input placeholder="New Notebook Name (e.g. 'Sports Strategy')" value={newNbName} onChange={e => setNewNbName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button style={btnPrimary} onClick={createNotebook} disabled={!newNbName || nbLoading}>📓 Create</button>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button style={btnSecondary} onClick={loadNotebooks} disabled={nbLoading}>{nbLoading ? "⏳" : "📋 Load"}</button>
              <button style={btnSecondary} onClick={checkNbHealth}>🔧 Health</button>
              <button style={btnSecondary} onClick={checkStorage}>💾 Storage</button>
            </div>
          </div>

          {nbHealth && (
            <div style={{ ...card, borderLeft: `3px solid ${nbHealth.fallbackActive ? "#f59e0b" : "#10b981"}` }}>
              <div style={{ fontSize: "11px" }}>
                <b>Bridge:</b> {nbHealth.bridge} · <b>Fallback:</b> {nbHealth.fallbackActive ? "Active ⚠️" : "Standby ✅"}
                · <b>Failures:</b> {nbHealth.failureCount} · <b>Selectors v{nbHealth.selectorVersion}</b>
              </div>
            </div>
          )}

          {storageStatus && (
            <div style={{ ...card, borderLeft: `3px solid ${storageStatus.status?.includes("ready") ? "#10b981" : "#ef4444"}` }}>
              <div style={{ fontSize: "11px" }}>
                <b>Storage:</b> {storageStatus.status} · <b>Bucket:</b> {storageStatus.bucketName || "N/A"}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>{storageStatus.message}</div>
            </div>
          )}

          {notebooks.length > 0 && (
            <div style={card}>
              <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>📚 Your Notebooks</h4>
              {notebooks.map(nb => (
                <div key={nb.notebookId}
                  onClick={() => setSelectedNb(nb.notebookId)}
                  style={{
                    padding: "6px 8px", marginBottom: "4px", borderRadius: "6px", cursor: "pointer",
                    background: selectedNb === nb.notebookId ? "rgba(139,92,246,0.15)" : "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    border: selectedNb === nb.notebookId ? "1px solid #8b5cf6" : "1px solid transparent",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: "600" }}>{nb.name}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                    {nb.sourceCount} sources · {nb.queryCount} queries · {nb.isLocal ? "🏠 Local" : "☁️ NotebookLM"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={card}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🔍 Query Notebook</h4>
            <div style={{ display: "flex", gap: "8px" }}>
              <input placeholder="Ask your notebook anything..." value={nbQuery} onChange={e => setNbQuery(e.target.value)} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && queryNotebook()} />
              <button style={btnPrimary} onClick={queryNotebook} disabled={nbLoading || !nbQuery}>{nbLoading ? "⏳" : "🔍"}</button>
            </div>
            {selectedNb && <div style={{ fontSize: "9px", color: "#8b5cf6", marginTop: "4px" }}>Querying: {notebooks.find(n => n.notebookId === selectedNb)?.name || selectedNb}</div>}
            {nbAnswer && (
              <div style={{ marginTop: "8px", padding: "10px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", fontSize: "12px", whiteSpace: "pre-wrap" }}>
                <div style={{ fontSize: "8px", color: "#8b5cf6", marginBottom: "4px" }}>Source: {nbAnswer.source || "unknown"}</div>
                {nbAnswer.result?.answer || nbAnswer.result?.raw || JSON.stringify(nbAnswer.result, null, 2)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── GALLERY ── */}
      {subTab === "gallery" && (
        <>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["all", "image", "video", "audio", "thumbnail", "music"].map(t => (
              <button key={t} style={{ ...btnSecondary, fontSize: "10px", padding: "4px 10px" }} onClick={() => loadGallery(t === "all" ? null : t)}>
                {t === "all" ? "🗂️" : t === "image" ? "🖼️" : t === "video" ? "🎬" : t === "audio" ? "🔊" : t === "thumbnail" ? "📸" : "🎵"} {t}
              </button>
            ))}
            <button style={{ ...btnSecondary, fontSize: "10px", padding: "4px 10px" }} onClick={loadStyles}>🎨 Styles</button>
          </div>

          {galleryLoading && <div style={{ textAlign: "center", padding: "16px", fontSize: "12px", color: "var(--text-tertiary)" }}>⏳ Loading gallery...</div>}

          {galleryAssets.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
              {galleryAssets.map(a => (
                <div key={a.assetId} style={{ ...card, padding: "8px", position: "relative" }}>
                  {(a.type === "image" || a.type === "thumbnail") && a.url && (
                    <div style={{ width: "100%", height: "80px", borderRadius: "6px", background: "var(--bg-tertiary)", backgroundImage: `url(${a.url})`, backgroundSize: "cover", backgroundPosition: "center", marginBottom: "4px" }} />
                  )}
                  {a.type === "video" && (
                    <div style={{ width: "100%", height: "80px", borderRadius: "6px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>🎬</div>
                  )}
                  {(a.type === "audio" || a.type === "music") && (
                    <div style={{ width: "100%", height: "80px", borderRadius: "6px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>{a.type === "music" ? "🎵" : "🔊"}</div>
                  )}
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.prompt?.slice(0, 40) || a.type}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-tertiary)" }}>{a.model?.split("/").pop()}</span>
                    <button onClick={() => toggleFavorite(a.assetId, a.favorited)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>
                      {a.favorited ? "⭐" : "☆"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {savedStyles.length > 0 && (
            <div style={card}>
              <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>🎨 Saved Styles</h4>
              {savedStyles.map(s => (
                <div key={s.styleId} style={{ padding: "6px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))", fontSize: "11px" }}>
                  <span style={{ fontWeight: "600" }}>{s.name}</span>
                  <span style={{ color: "var(--text-tertiary)", marginLeft: "6px" }}>{s.category} · used {s.usageCount}x</span>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>{s.prompt?.slice(0, 80)}...</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
