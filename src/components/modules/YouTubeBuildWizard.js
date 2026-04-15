"use client";

import { useState } from "react";

/* ─── Shared Styles ─── */
const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "12px",
  padding: "16px",
};
const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border, rgba(255,255,255,0.1))",
  background: "var(--bg-primary, rgba(0,0,0,0.3))",
  color: "var(--text-primary, #fff)",
  fontSize: "13px",
  boxSizing: "border-box",
};
const btnPrimary = {
  padding: "10px 20px",
  borderRadius: "8px",
  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "13px",
};
const btnSecondary = {
  padding: "8px 16px",
  borderRadius: "8px",
  background: "var(--bg-secondary, rgba(255,255,255,0.06))",
  color: "var(--text-primary, #fff)",
  border: "1px solid var(--border, rgba(255,255,255,0.1))",
  cursor: "pointer",
  fontSize: "12px",
};

const STEPS = [
  { id: "niche", label: "Pick Niche", icon: "🧭", desc: "Find your profitable niche" },
  { id: "topic", label: "Research Topic", icon: "🔍", desc: "Choose your video topic" },
  { id: "script", label: "Write Script", icon: "📝", desc: "Generate your script" },
  { id: "chapters", label: "Chapters", icon: "📑", desc: "Auto-generate timestamps" },
  { id: "thumbnail", label: "Thumbnail", icon: "🎨", desc: "Create your thumbnail" },
  { id: "seo", label: "SEO & Metadata", icon: "🏷️", desc: "Optimize title, tags, description" },
  { id: "upload", label: "Upload", icon: "🚀", desc: "Publish to YouTube" },
  { id: "promote", label: "Promote", icon: "📢", desc: "Community posts & repurpose" },
];

export default function YouTubeBuildWizard({ googleAccessToken }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  /* ─── Wizard State — data flows downward ─── */
  const [wizardData, setWizardData] = useState({
    // Step 1: Niche
    nicheInterests: "",
    nicheStyle: "any",
    nicheBudget: "low",
    nicheGoal: "revenue",
    selectedNiche: null,
    nicheResults: null,
    // Step 2: Topic
    topicQuery: "",
    selectedTopic: null,
    topicSuggestions: null,
    // Step 3: Script
    scriptResult: null,
    // Step 4: Chapters
    chaptersResult: null,
    // Step 5: Thumbnail
    thumbnailConcepts: null,
    // Step 6: SEO
    seoResult: null,
    // Step 7: Upload
    uploadResult: null,
    // Step 8: Promote
    communityResult: null,
    repurposeResult: null,
  });

  const update = (fields) => setWizardData(prev => ({ ...prev, ...fields }));

  const apiCall = async (url, body, method = "POST", useAuth = false) => {
    setLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (useAuth && googleAccessToken) headers.Authorization = `Bearer ${googleAccessToken}`;
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch (e) {
      return { error: e.message };
    } finally {
      setLoading(false);
    }
  };

  /* ─── Step Actions ─── */
  const discoverNiches = async () => {
    const interests = wizardData.nicheInterests.split(",").map(s => s.trim()).filter(Boolean);
    const result = await apiCall("/api/youtube/niche-discover", {
      interests, contentStyle: wizardData.nicheStyle, budget: wizardData.nicheBudget, goal: wizardData.nicheGoal,
    });
    update({ nicheResults: result });
  };

  const suggestTopics = async () => {
    const niche = wizardData.selectedNiche?.name || wizardData.topicQuery;
    const result = await apiCall("/api/youtube/suggest", { niche, count: 8 });
    update({ topicSuggestions: result });
  };

  const generateScript = async () => {
    const topic = wizardData.selectedTopic?.title || wizardData.selectedTopic || wizardData.topicQuery;
    const result = await apiCall("/api/youtube/script", { topic, style: wizardData.nicheStyle, niche: wizardData.selectedNiche?.name });
    update({ scriptResult: result });
  };

  const generateChapters = async () => {
    const content = wizardData.scriptResult?.script || wizardData.scriptResult?.content || "";
    const result = await apiCall("/api/youtube/chapters", { content, videoLength: "10:00", title: wizardData.selectedTopic?.title || wizardData.topicQuery });
    update({ chaptersResult: result });
  };

  const generateThumbnail = async () => {
    const topic = wizardData.selectedTopic?.title || wizardData.topicQuery;
    const result = await apiCall("/api/youtube/thumbnail-analyze", { topic, niche: wizardData.selectedNiche?.name });
    update({ thumbnailConcepts: result });
  };

  const optimizeSEO = async () => {
    const topic = wizardData.selectedTopic?.title || wizardData.topicQuery;
    const result = await apiCall("/api/youtube/seo", { title: topic, niche: wizardData.selectedNiche?.name });
    update({ seoResult: result });
  };

  const generateCommunityPost = async () => {
    const topic = wizardData.selectedTopic?.title || wizardData.topicQuery;
    const result = await apiCall("/api/youtube/community", { topic, type: "mixed" });
    update({ communityResult: result });
  };

  const repurposeContent = async () => {
    const content = wizardData.scriptResult?.script || wizardData.scriptResult?.content || wizardData.selectedTopic?.title || "";
    const result = await apiCall("/api/youtube/repurpose", { content, targets: ["shorts", "community", "tweet", "blog", "instagram"] });
    update({ repurposeResult: result });
  };

  /* ─── Step Renderer ─── */
  const renderStep = () => {
    const step = STEPS[currentStep];

    /* ── Step 1: Niche ── */
    if (step.id === "niche") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>🧭 What interests you?</h3>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>Leave blank to explore all niches, or enter your interests to narrow down.</p>
          <input value={wizardData.nicheInterests} onChange={e => update({ nicheInterests: e.target.value })}
            placeholder="tech, fitness, cooking, gaming..." style={{ ...inputStyle, marginBottom: "10px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <select value={wizardData.nicheStyle} onChange={e => update({ nicheStyle: e.target.value })} style={inputStyle}>
              <option value="any">🎲 Any style</option><option value="faceless">👻 Faceless</option><option value="talking_head">🗣️ Talking head</option>
              <option value="tutorial">📚 Tutorial</option><option value="shorts">⚡ Shorts</option><option value="automated">🤖 Automated</option>
            </select>
            <select value={wizardData.nicheBudget} onChange={e => update({ nicheBudget: e.target.value })} style={inputStyle}>
              <option value="zero">📱 No budget</option><option value="low">💵 Low</option><option value="medium">💰 Medium</option><option value="high">🎥 High</option>
            </select>
            <select value={wizardData.nicheGoal} onChange={e => update({ nicheGoal: e.target.value })} style={inputStyle}>
              <option value="revenue">💲 Revenue</option><option value="growth">🚀 Growth</option><option value="passive">🏖️ Passive</option><option value="authority">🏆 Authority</option>
            </select>
          </div>
          <button style={{ ...btnPrimary, marginTop: "12px", width: "100%" }} onClick={discoverNiches} disabled={loading}>
            {loading ? "⏳ Finding niches..." : "🧭 Discover Niches"}
          </button>
        </div>
        {wizardData.nicheResults?.niches?.map((n, i) => (
          <div key={i} style={{ ...card, cursor: "pointer", borderLeft: `3px solid ${n.profitabilityScore >= 80 ? "#10b981" : n.profitabilityScore >= 60 ? "#f59e0b" : "#ef4444"}`,
            background: wizardData.selectedNiche?.name === n.name ? "rgba(59,130,246,0.08)" : card.background,
            transition: "all 0.15s" }}
            onClick={() => { update({ selectedNiche: n, topicQuery: n.name }); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700" }}>{n.name}</div>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>{n.description}</div>
              </div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: n.profitabilityScore >= 80 ? "#10b981" : "#f59e0b" }}>{n.profitabilityScore}</div>
            </div>
            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
              <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "9px", background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>CPM: {n.estimatedCPM}</span>
              <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "9px", background: "rgba(16,185,129,0.1)", color: "#10b981" }}>🌿{n.evergreen}%</span>
            </div>
            {wizardData.selectedNiche?.name === n.name && <div style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "600", marginTop: "6px" }}>✅ Selected — click Next to continue</div>}
          </div>
        ))}
      </div>
    );

    /* ── Step 2: Topic ── */
    if (step.id === "topic") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>🔍 Pick Your Video Topic</h3>
          {wizardData.selectedNiche && <p style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "8px" }}>Niche: {wizardData.selectedNiche.name}</p>}
          <input value={wizardData.topicQuery} onChange={e => update({ topicQuery: e.target.value })}
            placeholder="Enter niche or topic to explore..." style={{ ...inputStyle, marginBottom: "8px" }} />
          <button style={{ ...btnPrimary, width: "100%" }} onClick={suggestTopics} disabled={loading || !wizardData.topicQuery.trim()}>
            {loading ? "⏳ Finding topics..." : "🔍 Suggest Topics"}
          </button>
        </div>
        {wizardData.topicSuggestions?.topics?.map((t, i) => (
          <div key={i} style={{ ...card, cursor: "pointer",
            background: wizardData.selectedTopic?.title === t.title ? "rgba(59,130,246,0.08)" : card.background,
            transition: "all 0.15s" }}
            onClick={() => update({ selectedTopic: t })}>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>{t.title}</div>
            {t.description && <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>{t.description}</div>}
            {wizardData.selectedTopic?.title === t.title && <div style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "600", marginTop: "4px" }}>✅ Selected</div>}
          </div>
        ))}
        {wizardData.topicSuggestions?.suggestions?.map((t, i) => (
          <div key={i} style={{ ...card, cursor: "pointer",
            background: wizardData.selectedTopic === t ? "rgba(59,130,246,0.08)" : card.background }}
            onClick={() => update({ selectedTopic: { title: t } })}>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>{t}</div>
            {wizardData.selectedTopic?.title === t && <div style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "600", marginTop: "4px" }}>✅ Selected</div>}
          </div>
        ))}
      </div>
    );

    /* ── Step 3: Script ── */
    if (step.id === "script") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>📝 Generate Script</h3>
          <p style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "8px" }}>Topic: {wizardData.selectedTopic?.title || wizardData.topicQuery}</p>
          <button style={{ ...btnPrimary, width: "100%" }} onClick={generateScript} disabled={loading}>
            {loading ? "⏳ Writing..." : "📝 Generate Script"}
          </button>
        </div>
        {wizardData.scriptResult && !wizardData.scriptResult.error && (
          <div style={card}>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0, maxHeight: "400px", overflow: "auto" }}>
              {wizardData.scriptResult.script || wizardData.scriptResult.content || JSON.stringify(wizardData.scriptResult, null, 2)}
            </pre>
            <button onClick={() => navigator.clipboard?.writeText(wizardData.scriptResult.script || wizardData.scriptResult.content || "")}
              style={{ ...btnSecondary, marginTop: "8px", fontSize: "11px" }}>📋 Copy Script</button>
          </div>
        )}
        {wizardData.scriptResult?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {wizardData.scriptResult.error}</div>}
      </div>
    );

    /* ── Step 4: Chapters ── */
    if (step.id === "chapters") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>📑 Auto-Generate Chapters</h3>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
            {wizardData.scriptResult ? "Using your generated script →" : "Generate a script first, or paste one →"}
          </p>
          <button style={{ ...btnPrimary, width: "100%" }} onClick={generateChapters} disabled={loading || !wizardData.scriptResult}>
            {loading ? "⏳ Generating..." : "📑 Generate Chapters"}
          </button>
        </div>
        {wizardData.chaptersResult?.chapters && (
          <div style={card}>
            {wizardData.chaptersResult.chapters.map((ch, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", padding: "4px 0", alignItems: "baseline" }}>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#a78bfa", minWidth: "40px" }}>{ch.timestamp}</span>
                <span style={{ fontSize: "12px", fontWeight: "600" }}>{ch.title}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button onClick={() => navigator.clipboard?.writeText(wizardData.chaptersResult.description || "")}
                style={{ ...btnSecondary, fontSize: "11px" }}>📋 Copy for Description</button>
              <button onClick={() => navigator.clipboard?.writeText(wizardData.chaptersResult.pinnedComment || "")}
                style={{ ...btnSecondary, fontSize: "11px" }}>📌 Copy Pinned Comment</button>
            </div>
          </div>
        )}
      </div>
    );

    /* ── Step 5: Thumbnail ── */
    if (step.id === "thumbnail") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>🎨 Thumbnail Concepts</h3>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>AI generates thumbnail ideas based on your topic.</p>
          <button style={{ ...btnPrimary, width: "100%" }} onClick={generateThumbnail} disabled={loading}>
            {loading ? "⏳ Analyzing..." : "🎨 Generate Thumbnail Ideas"}
          </button>
        </div>
        {wizardData.thumbnailConcepts && !wizardData.thumbnailConcepts.error && (
          <div style={card}>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
              {wizardData.thumbnailConcepts.concepts || wizardData.thumbnailConcepts.analysis || JSON.stringify(wizardData.thumbnailConcepts, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );

    /* ── Step 6: SEO ── */
    if (step.id === "seo") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>🏷️ SEO Optimization</h3>
          <p style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "8px" }}>Topic: {wizardData.selectedTopic?.title || wizardData.topicQuery}</p>
          <button style={{ ...btnPrimary, width: "100%" }} onClick={optimizeSEO} disabled={loading}>
            {loading ? "⏳ Optimizing..." : "🏷️ Optimize SEO"}
          </button>
        </div>
        {wizardData.seoResult && !wizardData.seoResult.error && (
          <div style={card}>
            {wizardData.seoResult.titles && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>📌 Title Options</div>
                {(Array.isArray(wizardData.seoResult.titles) ? wizardData.seoResult.titles : [wizardData.seoResult.titles]).map((t, i) => (
                  <div key={i} style={{ padding: "4px 8px", borderRadius: "6px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", fontSize: "12px", marginBottom: "2px", cursor: "pointer" }}
                    onClick={() => navigator.clipboard?.writeText(typeof t === "string" ? t : t.title || t)}>{typeof t === "string" ? t : t.title || JSON.stringify(t)}</div>
                ))}
              </div>
            )}
            {wizardData.seoResult.tags && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>🏷️ Tags</div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {(Array.isArray(wizardData.seoResult.tags) ? wizardData.seoResult.tags : []).map((tag, i) => (
                    <span key={i} style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>{tag}</span>
                  ))}
                </div>
                <button onClick={() => navigator.clipboard?.writeText((wizardData.seoResult.tags || []).join(", "))}
                  style={{ ...btnSecondary, marginTop: "6px", fontSize: "10px" }}>📋 Copy All Tags</button>
              </div>
            )}
            {wizardData.seoResult.description && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>📝 Description</div>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", padding: "8px", borderRadius: "6px", margin: 0 }}>
                  {wizardData.seoResult.description}
                </pre>
                <button onClick={() => navigator.clipboard?.writeText(wizardData.seoResult.description || "")}
                  style={{ ...btnSecondary, marginTop: "6px", fontSize: "10px" }}>📋 Copy Description</button>
              </div>
            )}
          </div>
        )}
      </div>
    );

    /* ── Step 7: Upload ── */
    if (step.id === "upload") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>🚀 Ready to Upload</h3>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
            Everything is prepared. Go to the Upload tab to publish, or use the data below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {wizardData.selectedNiche && <div style={{ fontSize: "11px" }}>🧭 <strong>Niche:</strong> {wizardData.selectedNiche.name}</div>}
            {wizardData.selectedTopic && <div style={{ fontSize: "11px" }}>🔍 <strong>Topic:</strong> {wizardData.selectedTopic.title || wizardData.selectedTopic}</div>}
            {wizardData.scriptResult && <div style={{ fontSize: "11px" }}>📝 <strong>Script:</strong> ✅ Generated</div>}
            {wizardData.chaptersResult && <div style={{ fontSize: "11px" }}>📑 <strong>Chapters:</strong> ✅ {wizardData.chaptersResult.chapters?.length || 0} chapters</div>}
            {wizardData.thumbnailConcepts && <div style={{ fontSize: "11px" }}>🎨 <strong>Thumbnail:</strong> ✅ Concepts ready</div>}
            {wizardData.seoResult && <div style={{ fontSize: "11px" }}>🏷️ <strong>SEO:</strong> ✅ Optimized</div>}
          </div>
        </div>
        <div style={{ ...card, borderTop: "3px solid #10b981", textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
          <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>Your Video Package is Ready</div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Upload your video file through the Upload tab. All your metadata, chapters, and SEO data are generated.</div>
        </div>
      </div>
    );

    /* ── Step 8: Promote ── */
    if (step.id === "promote") return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={card}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>📢 Promote Your Video</h3>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>Generate community posts and repurpose your content for other platforms.</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{ ...btnPrimary, flex: 1 }} onClick={generateCommunityPost} disabled={loading}>📝 Community Post</button>
            <button style={{ ...btnPrimary, flex: 1, background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }} onClick={repurposeContent} disabled={loading}>♻️ Repurpose</button>
          </div>
        </div>
        {wizardData.communityResult && !wizardData.communityResult.error && (
          <div style={card}>
            <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>📝 Community Post Drafts</div>
            {(wizardData.communityResult.posts || []).map((p, i) => (
              <div key={i} style={{ padding: "8px", borderRadius: "6px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", marginBottom: "4px" }}>
                <div style={{ fontSize: "11px" }}>{p.content || p}</div>
                <button onClick={() => navigator.clipboard?.writeText(p.content || p)}
                  style={{ ...btnSecondary, padding: "2px 8px", fontSize: "9px", marginTop: "4px" }}>Copy</button>
              </div>
            ))}
          </div>
        )}
        {wizardData.repurposeResult && !wizardData.repurposeResult.error && (
          <div style={card}>
            <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>♻️ Repurposed Content</div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "var(--text-secondary)", maxHeight: "300px", overflow: "auto", margin: 0 }}>
              {JSON.stringify(wizardData.repurposeResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );

    return null;
  };

  /* ─── Render ─── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Step Progress Bar */}
      <div style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: "4px", overflowX: "auto" }}>
        {STEPS.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, cursor: "pointer" }}
            onClick={() => setCurrentStep(i)}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: "700",
              background: i === currentStep ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : i < currentStep ? "#10b981" : "var(--bg-tertiary, rgba(255,255,255,0.06))",
              color: i <= currentStep ? "#fff" : "var(--text-tertiary)",
              border: i === currentStep ? "2px solid #8b5cf6" : "2px solid transparent",
              transition: "all 0.2s",
            }}>
              {i < currentStep ? "✓" : step.icon}
            </div>
            <div style={{ fontSize: "10px", fontWeight: i === currentStep ? "700" : "400", color: i === currentStep ? "var(--text-primary)" : "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {step.label}
            </div>
            {i < STEPS.length - 1 && <div style={{ width: "16px", height: "1px", background: i < currentStep ? "#10b981" : "var(--border, rgba(255,255,255,0.06))" }} />}
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div style={{ ...card, borderTop: "3px solid #3b82f6", padding: "4px 16px 16px", minHeight: "200px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingTop: "12px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Step {currentStep + 1} of {STEPS.length}</div>
            <div style={{ fontSize: "14px", fontWeight: "700" }}>{STEPS[currentStep].icon} {STEPS[currentStep].label}</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {currentStep > 0 && <button style={btnSecondary} onClick={() => setCurrentStep(currentStep - 1)}>← Back</button>}
            {currentStep < STEPS.length - 1 && <button style={btnPrimary} onClick={() => setCurrentStep(currentStep + 1)}>Next →</button>}
            {currentStep === STEPS.length - 1 && (
              <button style={{ ...btnPrimary, background: "linear-gradient(135deg, #10b981, #059669)" }} onClick={() => { setCurrentStep(0); setWizardData(prev => ({ ...prev })); }}>
                🔄 New Video
              </button>
            )}
          </div>
        </div>
        {renderStep()}
      </div>

      {/* Data Summary */}
      <div style={{ ...card, padding: "10px 14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: "600" }}>PIPELINE:</span>
        {wizardData.selectedNiche && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", background: "rgba(34,211,238,0.1)", color: "#22d3ee" }}>🧭 {wizardData.selectedNiche.name}</span>}
        {wizardData.selectedTopic && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>🔍 {wizardData.selectedTopic.title || wizardData.selectedTopic}</span>}
        {wizardData.scriptResult && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", background: "rgba(16,185,129,0.1)", color: "#10b981" }}>📝 Script ✓</span>}
        {wizardData.chaptersResult && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>📑 Chapters ✓</span>}
        {wizardData.seoResult && <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "9px", background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>🏷️ SEO ✓</span>}
      </div>
    </div>
  );
}
