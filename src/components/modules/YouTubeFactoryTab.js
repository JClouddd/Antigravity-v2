"use client";

import { useState, useEffect } from "react";
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
  const [subTab, setSubTab] = useState("command");

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

  /* ── Command Center State ── */
  const [wizardStep, setWizardStep] = useState(1);
  const [nicheResults, setNicheResults] = useState(null);
  const [nicheCategory, setNicheCategory] = useState("");
  const [nicheLoading, setNicheLoading] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [topicResults, setTopicResults] = useState(null);
  const [topicNiche, setTopicNiche] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [wizardTier, setWizardTier] = useState("standard");
  const [wizardPipelineId, setWizardPipelineId] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResults, setAutoResults] = useState(null);

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

  /* ── Command Center Actions ── */
  const discoverNiches = async () => {
    setNicheLoading(true);
    setNicheResults(null);
    try {
      const data = await api("orchestrator", { action: "niche-discover", category: nicheCategory || undefined, count: 5 });
      console.log("[RUBRIC] Niche discovery response:", data);
      if (data.error) {
        alert("Niche discovery error: " + data.error);
        setNicheLoading(false);
        return;
      }
      // Handle both { niches: [...] } and { raw: "..." } responses
      const niches = data.niches;
      if (niches?.raw) {
        alert("AI returned malformed data. Retrying may fix this. Check console for raw output.");
        console.log("[RUBRIC] Raw response:", niches.raw);
      }
      setNicheResults(niches);
    } catch (err) {
      console.error("[RUBRIC] Niche discovery failed:", err);
      alert("Niche discovery failed: " + err.message);
    }
    setNicheLoading(false);
  };
  const selectNiche = (niche) => {
    setSelectedNiche(niche);
    setTopicNiche(niche.name);
    setWizardStep(3);
  };
  const generateTopics = async () => {
    if (!topicNiche) return;
    setTopicLoading(true);
    setTopicResults(null);
    try {
      const data = await api("orchestrator", { action: "topic-generate", niche: topicNiche, count: 10 });
      console.log("[RUBRIC] Topic generation response:", data);
      if (data.error) {
        alert("Topic generation error: " + data.error);
        setTopicLoading(false);
        return;
      }
      const topics = data.topics;
      if (topics?.raw) {
        alert("AI returned malformed topic data. Try again.");
        console.log("[RUBRIC] Raw response:", topics.raw);
      }
      setTopicResults(topics);
    } catch (err) {
      console.error("[RUBRIC] Topic generation failed:", err);
      alert("Topic generation failed: " + err.message);
    }
    setTopicLoading(false);
  };
  const selectTopicAndCreate = async (topic) => {
    setSelectedTopic(topic);
    setWizardStep(5);
    // Auto-create pipeline
    const data = await api("pipeline", {
      action: "create",
      topic: topic.title,
      niche: topicNiche,
      videoTier: wizardTier,
      channelName: channels?.[0]?.title || "",
      channelId: channels?.[0]?.id || "",
      reviewRequired: true,
    });
    if (data.pipelineId) {
      setWizardPipelineId(data.pipelineId);
      await loadPipelines();
    }
  };
  const [currentStepLabel, setCurrentStepLabel] = useState("");
  const runFullPipeline = async (pipelineId) => {
    setAutoRunning(true);
    setAutoResults(null);
    setCurrentStepLabel("Initializing pipeline...");
    const pid = pipelineId || wizardPipelineId;
    const allResults = {};
    let finalData = null;

    const stepLabels = {
      generate_script: "✍️ Writing script with AI...",
      generate_voice: "🎙️ Generating voice & music...",
      generate_visuals: "🎨 Creating images & video...",
      compose: "🎬 Composing final video...",
    };

    // Drive pipeline step-by-step from the UI
    for (let i = 0; i < 10; i++) {
      try {
        const data = await api("orchestrator", { action: "run-full", pipelineId: pid });
        console.log(`[RUBRIC] Step ${i + 1}:`, data.stepExecuted, data);

        if (data.stepExecuted) {
          allResults[data.stepExecuted] = { ...data.results, cost: data.totalCost };
          // Show incremental progress
          setAutoResults({
            ...data,
            results: { ...allResults },
            completed: false,
          });
          setCurrentStepLabel(`✅ ${data.stepExecuted.replace(/_/g, " ")} done`);
        }
        finalData = data;

        if (data.completed || data.error || !data.nextStep) {
          break;
        }

        // Show label for next step
        setCurrentStepLabel(stepLabels[data.nextStep] || `Running ${data.nextStep}...`);
      } catch (err) {
        console.error("[RUBRIC] Pipeline step failed:", err);
        finalData = { error: err.message, completed: false };
        break;
      }
    }

    if (finalData) {
      finalData.results = allResults;
    }
    setAutoResults(finalData);
    setAutoRunning(false);
    setCurrentStepLabel("");
    if (finalData?.completed) setWizardStep(6);
    await loadPipelines();
  };
  const runStep = async (pipelineId, step) => {
    const data = await api("orchestrator", { action: "run-step", pipelineId, step });
    await loadPipelines();
    return data;
  };

  /* ── Sub-tabs ── */
  const subTabs = [
    { id: "command", icon: "🎯", label: "Command" },
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
      <div style={{ ...card, borderTop: "3px solid #8b5cf6", textAlign: "center", padding: "24px", background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(109,40,217,0.04))" }}>
        <div style={{ fontSize: "24px", marginBottom: "4px" }}>⚡</div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "2px" }}>RUBRIC Factory</h3>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "1px", textTransform: "uppercase" }}>
          Autonomous Video Production Engine
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
      {/* ── RUBRIC COMMAND CENTER — GUIDED WIZARD ── */}
      {subTab === "command" && (
        <>
          {/* Wizard Step Indicator */}
          <div style={{ ...card, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {[
                { n: 1, icon: "🧭", label: "Discover" },
                { n: 2, icon: "✅", label: "Pick Niche" },
                { n: 3, icon: "📝", label: "Topics" },
                { n: 4, icon: "⚙️", label: "Configure" },
                { n: 5, icon: "🚀", label: "Execute" },
                { n: 6, icon: "📊", label: "Review" },
              ].map((s, i) => (
                <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <button onClick={() => setWizardStep(s.n)} style={{
                    width: "28px", height: "28px", borderRadius: "50%", border: "none", cursor: "pointer",
                    fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center",
                    background: wizardStep === s.n ? "linear-gradient(135deg, #8b5cf6, #6d28d9)" : wizardStep > s.n ? "rgba(16,185,129,0.2)" : "var(--bg-tertiary, rgba(255,255,255,0.05))",
                    color: wizardStep === s.n ? "#fff" : wizardStep > s.n ? "#10b981" : "var(--text-tertiary)",
                  }}>
                    {wizardStep > s.n ? "✓" : s.n}
                  </button>
                  {i < 5 && <div style={{ flex: 1, height: "2px", background: wizardStep > s.n ? "#10b981" : "var(--border, rgba(255,255,255,0.06))", margin: "0 2px" }} />}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              {["Discover", "Pick", "Topics", "Config", "Execute", "Review"].map((l, i) => (
                <div key={l} style={{ fontSize: "7px", color: wizardStep === i + 1 ? "#8b5cf6" : "var(--text-tertiary)", textAlign: "center", flex: 1, fontWeight: wizardStep === i + 1 ? "700" : "400" }}>{l}</div>
              ))}
            </div>
          </div>

          {/* ── STEP 1: DISCOVER NICHES ── */}
          {wizardStep === 1 && (
            <div style={{ ...card, borderTop: "3px solid #f59e0b" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 1: Discover Profitable Niches</h4>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                AI analyzes search volume, competition, CPM, and automation compatibility to find the best opportunities.
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input placeholder="Focus area (e.g. Sports, Tech, Finance) or leave blank for all" value={nicheCategory} onChange={e => setNicheCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && discoverNiches()} />
                <button style={btnPrimary} onClick={discoverNiches} disabled={nicheLoading}>
                  {nicheLoading ? "⏳ Analyzing..." : "🧭 Discover Niches"}
                </button>
              </div>

              {nicheResults?.niches && (
                <>
                  {nicheResults.topPick && (
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#f59e0b" }}>⭐ AI Recommendation: {nicheResults.topPick.name}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>{nicheResults.topPick.reason}</div>
                    </div>
                  )}
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "6px" }}>Click a niche to continue →</div>
                  {nicheResults.niches.map((n, i) => (
                    <div key={i} onClick={() => selectNiche(n)} style={{
                      padding: "10px", borderRadius: "8px", marginBottom: "6px", cursor: "pointer",
                      border: selectedNiche?.name === n.name ? "2px solid #8b5cf6" : "1px solid var(--border, rgba(255,255,255,0.06))",
                      background: selectedNiche?.name === n.name ? "rgba(139,92,246,0.08)" : "var(--bg-tertiary, rgba(255,255,255,0.02))",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "13px", fontWeight: "700" }}>{n.name}</div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <span style={{ fontSize: "8px", padding: "2px 6px", borderRadius: "4px", background: n.type === "evergreen" ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)", color: n.type === "evergreen" ? "#10b981" : "#3b82f6" }}>{n.type}</span>
                          <span style={{ fontSize: "8px", padding: "2px 6px", borderRadius: "4px", background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>Auto: {n.automationScore}/10</span>
                          <span style={{ fontSize: "8px", padding: "2px 6px", borderRadius: "4px", background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>{n.estimatedCPM}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "3px" }}>
                        Search: {n.searchVolume} · Competition: {n.competition} · {n.recommendedFrequency}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "3px" }}>{n.whyProfitable}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: NICHE SELECTED (auto-advances to 3) ── */}
          {wizardStep === 2 && selectedNiche && (
            <div style={{ ...card, borderTop: "3px solid #10b981" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 2: Niche Selected</h4>
              <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginTop: "8px" }}>
                <div style={{ fontSize: "16px", fontWeight: "700" }}>{selectedNiche.name}</div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  CPM: {selectedNiche.estimatedCPM} · Auto Score: {selectedNiche.automationScore}/10
                </div>
              </div>
              <button style={{ ...btnPrimary, width: "100%", marginTop: "12px" }} onClick={() => { setTopicNiche(selectedNiche.name); setWizardStep(3); }}>
                Continue → Generate Topics
              </button>
            </div>
          )}

          {/* ── STEP 3: GENERATE TOPICS ── */}
          {wizardStep === 3 && (
            <div style={{ ...card, borderTop: "3px solid #3b82f6" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 3: Generate Video Topics</h4>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                AI creates SEO-optimized, high-CTR video ideas for <strong style={{ color: "#8b5cf6" }}>{topicNiche}</strong>
              </p>

              {!topicResults?.topics && (
                <button style={{ ...btnPrimary, width: "100%" }} onClick={generateTopics} disabled={topicLoading}>
                  {topicLoading ? "⏳ Generating 10 topics..." : `📝 Generate Topics for "${topicNiche}"`}
                </button>
              )}

              {topicResults?.topics && (
                <>
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "6px" }}>Click a topic to build a video →</div>
                  {topicResults.topics.map((t, i) => (
                    <div key={i} onClick={() => { setSelectedTopic(t); setWizardStep(4); }} style={{
                      padding: "10px", borderRadius: "8px", marginBottom: "4px", cursor: "pointer",
                      border: "1px solid var(--border, rgba(255,255,255,0.06))",
                      background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div style={{ fontSize: "12px", fontWeight: "600", flex: 1 }}>{t.title}</div>
                        <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                          <span style={{ fontSize: "8px", padding: "2px 5px", borderRadius: "3px", background: t.estimatedViews === "viral" ? "rgba(239,68,68,0.2)" : t.estimatedViews === "high" ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)", color: t.estimatedViews === "viral" ? "#ef4444" : t.estimatedViews === "high" ? "#10b981" : "#6b7280" }}>{t.estimatedViews}</span>
                          <span style={{ fontSize: "8px", padding: "2px 5px", borderRadius: "3px", background: "rgba(59,130,246,0.2)", color: "#3b82f6" }}>{t.type}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "9px", color: "#f59e0b", marginTop: "2px", fontStyle: "italic" }}>"{t.hook}"</div>
                      {t.searchKeyword && <div style={{ fontSize: "8px", color: "var(--text-tertiary)", marginTop: "2px" }}>🔍 {t.searchKeyword}</div>}
                    </div>
                  ))}
                  <button style={{ ...btnSecondary, width: "100%", marginTop: "6px" }} onClick={generateTopics} disabled={topicLoading}>
                    {topicLoading ? "⏳ Regenerating..." : "🔄 Regenerate Topics"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── STEP 4: CONFIGURE & CREATE PIPELINE ── */}
          {wizardStep === 4 && selectedTopic && (
            <div style={{ ...card, borderTop: "3px solid #8b5cf6" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 4: Configure & Launch</h4>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Choose your video quality tier, then launch the pipeline.
              </p>

              {/* Selected topic summary */}
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700" }}>{selectedTopic.title}</div>
                <div style={{ fontSize: "9px", color: "#f59e0b", marginTop: "2px" }}>"{selectedTopic.hook}"</div>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>Niche: {topicNiche}</div>
              </div>

              {/* Tier Selection */}
              <div style={{ fontSize: "10px", fontWeight: "600", marginBottom: "6px" }}>Video Quality Tier:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
                {TIERS.map(t => (
                  <button key={t.id} onClick={() => setWizardTier(t.id)} style={{
                    padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                    border: wizardTier === t.id ? `2px solid ${t.color}` : "1px solid var(--border, rgba(255,255,255,0.06))",
                    background: wizardTier === t.id ? `${t.color}15` : "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    color: "var(--text-primary, #fff)",
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: "700" }}>{t.label}</div>
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{t.desc}</div>
                  </button>
                ))}
              </div>

              <button style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: "14px" }} onClick={() => selectTopicAndCreate(selectedTopic)}>
                🚀 Create Pipeline & Start Production
              </button>
            </div>
          )}

          {/* ── STEP 5: EXECUTE ── */}
          {wizardStep === 5 && (() => {
            // Auto-load pipelines if none loaded and no pipelineId
            if (!wizardPipelineId && pipelines.length === 0 && !pipeLoading) { setTimeout(loadPipelines, 0); }
            return true;
          })() && (
            <div style={{ ...card, borderTop: "3px solid #ef4444" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 5: Autonomous Production</h4>

              {/* No pipeline ID — show resume option */}
              {!wizardPipelineId && !autoRunning && !autoResults && (
                <div style={{ marginTop: "8px" }}>
                  <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                    No active pipeline. Resume an existing one or go back to create a new pipeline.
                  </p>
                  {pipelines.filter(p => p.state !== "COMPLETE" && p.state !== "CANCELLED").length > 0 ? (
                    pipelines.filter(p => p.state !== "COMPLETE" && p.state !== "CANCELLED").map(p => (
                      <div key={p.pipelineId} style={{
                        padding: "10px", borderRadius: "8px", marginBottom: "6px", cursor: "pointer",
                        border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)",
                      }} onClick={() => { setWizardPipelineId(p.pipelineId); setSelectedTopic({ title: p.topic }); setTopicNiche(p.niche); }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: "600" }}>{p.topic}</div>
                            <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                              {p.state?.replace(/_/g, " ")} · {p.progress}% · ${(p.totalCost || 0).toFixed(3)}
                            </div>
                          </div>
                          <button style={{ ...btnPrimary, fontSize: "9px", padding: "4px 10px" }}>
                            ▶ Resume
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <button style={{ ...btnSecondary, width: "100%", marginBottom: "6px" }} onClick={loadPipelines}>
                      📋 Load Existing Pipelines
                    </button>
                  )}
                  <button style={{ ...btnSecondary, width: "100%", marginTop: "4px" }} onClick={() => setWizardStep(1)}>
                    ← Back to Discover Niches
                  </button>
                </div>
              )}

              {wizardPipelineId && !autoRunning && !autoResults && (
                <>
                  <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                    Pipeline ready. Click below to execute (resumes from where it left off).
                  </p>
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(139,92,246,0.06)", marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "600" }}>{selectedTopic?.title}</div>
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>Niche: {topicNiche} · Tier: {wizardTier} · ID: {wizardPipelineId?.slice(0, 8)}...</div>
                  </div>
                  <button style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: "14px", background: "linear-gradient(135deg, #ef4444, #dc2626)" }} onClick={() => runFullPipeline()}>
                    🤖 Execute Full Autonomous Pipeline
                  </button>
                </>
              )}

              {autoRunning && (
                <div style={{ textAlign: "center", padding: "24px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px", animation: "pulse 2s infinite" }}>🤖</div>
                  <div style={{ fontSize: "13px", fontWeight: "600" }}>RUBRIC Engine Running...</div>
                  <div style={{ fontSize: "11px", color: "#8b5cf6", marginTop: "6px", fontWeight: "600" }}>
                    {currentStepLabel || "Preparing..."}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Each step takes 30-90 seconds. Do not close this page.
                  </div>
                  <div style={{ width: "100%", height: "4px", borderRadius: "2px", background: "var(--bg-tertiary)", marginTop: "12px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #10b981)", width: autoResults?.progress ? `${autoResults.progress}%` : "30%", borderRadius: "2px", transition: "width 0.5s", animation: autoResults?.progress ? "none" : "progress 3s ease-in-out infinite" }} />
                  </div>
                  {/* Show completed steps so far */}
                  {autoResults?.results && Object.keys(autoResults.results).length > 0 && (
                    <div style={{ marginTop: "12px", textAlign: "left" }}>
                      {Object.entries(autoResults.results).map(([step, data]) => (
                        <div key={step} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px" }}>
                          <span style={{ color: "#10b981" }}>✅ {step.replace(/_/g, " ")}</span>
                          <span style={{ color: "var(--text-tertiary)" }}>${(data.cost || 0).toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {autoResults && !autoRunning && (
                <div style={{ padding: "12px", borderRadius: "8px", background: autoResults.completed ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${autoResults.completed ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, marginTop: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "6px" }}>
                    {autoResults.completed ? "✅ Production Complete!" : "⚠️ Production Paused"}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                    State: {autoResults.state} · Progress: {autoResults.progress}% · Total Cost: ${(autoResults.totalCost || 0).toFixed(2)}
                  </div>
                  {autoResults.error && (
                    <div style={{ fontSize: "10px", color: "#ef4444", marginBottom: "8px" }}>Error: {autoResults.error}</div>
                  )}
                  <div style={{ fontSize: "10px" }}>
                    {Object.entries(autoResults.results || {}).map(([step, data]) => (
                      <div key={step} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                        <span style={{ fontWeight: "600" }}>{step.replace(/_/g, " ")}</span>
                        {data.error ? <span style={{ color: "#ef4444" }}>❌ {data.error}</span> : <span style={{ color: "#10b981" }}>✅ ${(data.cost || 0).toFixed(3)}</span>}
                      </div>
                    ))}
                  </div>
                  {autoResults.completed && (
                    <button style={{ ...btnPrimary, width: "100%", marginTop: "8px" }} onClick={() => setWizardStep(6)}>
                      Continue → Review & Publish
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 6: REVIEW & PUBLISH ── */}
          {wizardStep === 6 && (
            <div style={{ ...card, borderTop: "3px solid #10b981" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "2px" }}>Step 6: Review & Publish</h4>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Your video is ready. Review the results, then publish to YouTube.
              </p>

              {autoResults && (
                <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "4px" }}>{selectedTopic?.title}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                    Niche: {topicNiche} · Tier: {wizardTier} · Cost: ${(autoResults.totalCost || 0).toFixed(2)}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button style={{ ...btnSecondary, padding: "10px" }} onClick={() => { setSubTab("gallery"); loadGallery(); }}>
                  🖼️ View Assets
                </button>
                <button style={{ ...btnSecondary, padding: "10px" }} onClick={() => { setSubTab("pipeline"); loadPipelines(); }}>
                  🏭 View Pipeline
                </button>
                <button style={{ ...btnPrimary, padding: "10px", gridColumn: "span 2" }} onClick={() => {
                  setWizardStep(1);
                  setNicheResults(null); setSelectedNiche(null);
                  setTopicResults(null); setSelectedTopic(null);
                  setWizardPipelineId(null); setAutoResults(null);
                }}>
                  🔄 Start New Production
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
