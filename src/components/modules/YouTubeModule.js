"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/* ─── Helpers ─── */
const fmtNumber = (n) => {
  if (!n && n !== 0) return "—";
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return String(num);
};

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/* ─── Tabs ─── */
const TABS = [
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "channels", label: "Channels", icon: "📺" },
  { id: "creation", label: "Creation Tools", icon: "🎨" },
];

/* ─── Pipeline Stages ─── */
const PIPELINE_STAGES = [
  { id: "idea", label: "Ideation", icon: "💡", color: "#f59e0b" },
  { id: "research", label: "Research", icon: "🔬", color: "#3b82f6" },
  { id: "script", label: "Script", icon: "📝", color: "#8b5cf6" },
  { id: "production", label: "Production", icon: "🎬", color: "#ef4444" },
  { id: "review", label: "Review", icon: "👁️", color: "#06b6d4" },
  { id: "published", label: "Published", icon: "📤", color: "#10b981" },
];

/* ─── Template Types ─── */
const VIDEO_TYPES = [
  { id: "longform", label: "Long-form", icon: "🎬", desc: "8-20+ min standard videos" },
  { id: "shorts", label: "Shorts", icon: "📱", desc: "Vertical ≤60s clips" },
  { id: "live", label: "Live", icon: "🔴", desc: "Livestreams" },
  { id: "podcast", label: "Podcast", icon: "🎙️", desc: "Audio-first episodes" },
  { id: "community", label: "Community", icon: "📣", desc: "Text, polls, images" },
];

/* ─── Styles ─── */
const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "16px",
  padding: "20px",
};

const cardHover = {
  ...card,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const btnPrimary = {
  padding: "8px 18px", borderRadius: "10px", border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white",
  fontWeight: "600", fontSize: "12px", transition: "all 0.2s",
  boxShadow: "0 2px 12px rgba(239,68,68,0.25)",
};

const btnSecondary = {
  padding: "8px 18px", borderRadius: "10px",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  background: "var(--bg-secondary, rgba(255,255,255,0.04))",
  color: "var(--text-primary, white)", fontSize: "12px",
  cursor: "pointer", transition: "all 0.2s",
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  color: "var(--text-primary, white)", fontSize: "13px", outline: "none",
};

/* ═══════════════════════════════════════════════════════════
   MAIN MODULE
   ═══════════════════════════════════════════════════════════ */
export default function YouTubeModule() {
  const { user, googleAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState("channels");
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelBoardTab, setChannelBoardTab] = useState("videos");
  const [showAddModal, setShowAddModal] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", channelId: "", url: "" });
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [pipelineItems, setPipelineItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [nicheQuery, setNicheQuery] = useState("");
  const [nicheResults, setNicheResults] = useState(null);
  const [analyticsSubTab, setAnalyticsSubTab] = useState("overview");
  const [newPipelineTitle, setNewPipelineTitle] = useState("");

  /* ─── Firestore Load ─── */
  useEffect(() => {
    if (!user) return;
    loadChannels();
    loadPipeline();
    loadTemplates();
  }, [user]);

  const loadChannels = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "channels");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setChannels(snap.data().list || []);
      }
    } catch (e) { console.error("Load channels:", e); }
  };

  const saveChannels = async (list) => {
    setChannels(list);
    try {
      const ref = doc(db, "users", user.uid, "youtube", "channels");
      await setDoc(ref, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save channels:", e); }
  };

  const loadPipeline = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "pipeline");
      const snap = await getDoc(ref);
      if (snap.exists()) setPipelineItems(snap.data().items || []);
    } catch (e) { console.error("Load pipeline:", e); }
  };

  const savePipeline = async (items) => {
    setPipelineItems(items);
    try {
      const ref = doc(db, "users", user.uid, "youtube", "pipeline");
      await setDoc(ref, { items, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save pipeline:", e); }
  };

  const loadTemplates = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "templates");
      const snap = await getDoc(ref);
      if (snap.exists()) setTemplates(snap.data().list || []);
    } catch (e) { console.error("Load templates:", e); }
  };

  const saveTemplates = async (list) => {
    setTemplates(list);
    try {
      const ref = doc(db, "users", user.uid, "youtube", "templates");
      await setDoc(ref, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save templates:", e); }
  };

  /* ─── Channel Actions ─── */
  const addChannel = () => {
    if (!channelForm.name.trim()) return;
    const ch = {
      id: `ch_${Date.now()}`,
      name: channelForm.name.trim(),
      channelId: channelForm.channelId.trim(),
      url: channelForm.url.trim(),
      addedAt: new Date().toISOString(),
      linked: false,
      stats: null,
    };
    saveChannels([...channels, ch]);
    setChannelForm({ name: "", channelId: "", url: "" });
    setShowAddModal(false);
  };

  const removeChannel = (id) => {
    if (!confirm("Remove this channel?")) return;
    saveChannels(channels.filter(c => c.id !== id));
    if (activeChannel?.id === id) setActiveChannel(null);
  };

  const syncChannel = async (channel) => {
    if (!googleAccessToken || !channel.channelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube/analytics?channelId=${channel.channelId}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const updated = channels.map(c =>
        c.id === channel.id
          ? { ...c, linked: true, stats: data.stats, lastSync: new Date().toISOString() }
          : c
      );
      saveChannels(updated);
      setAnalyticsData(prev => ({ ...prev, [channel.id]: data }));
      if (activeChannel?.id === channel.id) {
        setActiveChannel({ ...channel, linked: true, stats: data.stats, lastSync: new Date().toISOString() });
      }
    } catch (e) {
      console.error("Sync failed:", e);
    }
    setLoading(false);
  };

  /* ─── Pipeline Actions ─── */
  const addPipelineItem = (channelId, title, stage = "idea") => {
    const item = {
      id: `pi_${Date.now()}`,
      channelId,
      title,
      stage,
      type: "longform",
      createdAt: new Date().toISOString(),
      notes: "",
    };
    savePipeline([...pipelineItems, item]);
  };

  const movePipelineItem = (itemId, newStage) => {
    savePipeline(pipelineItems.map(p =>
      p.id === itemId ? { ...p, stage: newStage } : p
    ));
  };

  const removePipelineItem = (itemId) => {
    savePipeline(pipelineItems.filter(p => p.id !== itemId));
  };

  /* ─── Template Actions ─── */
  const addTemplate = (tmpl) => {
    saveTemplates([...templates, { ...tmpl, id: `tmpl_${Date.now()}`, createdAt: new Date().toISOString(), usageCount: 0, avgPerformance: null }]);
  };

  /* ═══════════════════════════════════════════════════════
     RENDER: Channels Tab
     ═══════════════════════════════════════════════════════ */
  const renderChannelsTab = () => {
    // Drill-down: if a channel is selected, show its board
    if (activeChannel) return renderChannelBoard();

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Channel Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {channels.map(ch => (
            <div
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              style={{
                ...cardHover,
                borderTop: `3px solid ${ch.linked ? "#10b981" : "#f59e0b"}`,
                position: "relative",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              {/* Status badge */}
              <div style={{
                position: "absolute", top: "12px", right: "12px",
                padding: "2px 10px", borderRadius: "12px", fontSize: "10px",
                background: ch.linked ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                color: ch.linked ? "#10b981" : "#f59e0b",
                border: `1px solid ${ch.linked ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
              }}>
                {ch.linked ? "● Linked" : "○ Pending"}
              </div>

              {/* Channel info */}
              <div style={{ fontSize: "28px", marginBottom: "12px" }}>📺</div>
              <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>{ch.name}</div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginBottom: "16px" }}>
                {ch.channelId || "No Channel ID"}
              </div>

              {/* Stats row */}
              {ch.stats ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Subs", value: fmtNumber(ch.stats.subscriberCount), color: "#ef4444" },
                    { label: "Views", value: fmtNumber(ch.stats.viewCount), color: "#8b5cf6" },
                    { label: "Videos", value: fmtNumber(ch.stats.videoCount), color: "#3b82f6" },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))" }}>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", textAlign: "center", padding: "12px 0" }}>
                  Link channel to see stats →
                </div>
              )}

              {/* Last sync */}
              {ch.lastSync && (
                <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.3))", marginTop: "12px", textAlign: "right" }}>
                  Synced {fmtDate(ch.lastSync)}
                </div>
              )}
            </div>
          ))}

          {/* Add Channel Card */}
          <div
            onClick={() => setShowAddModal(true)}
            style={{
              ...cardHover,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              minHeight: "200px", borderStyle: "dashed",
              color: "var(--text-tertiary, rgba(255,255,255,0.3))",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = "var(--text-tertiary, rgba(255,255,255,0.3))"; }}
          >
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>+</div>
            <div style={{ fontSize: "14px", fontWeight: "600" }}>Add Channel</div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Channel Board (drill-down) ─── */
  const renderChannelBoard = () => {
    const ch = activeChannel;
    const channelPipeline = pipelineItems.filter(p => p.channelId === ch.id);
    const channelAnalytics = analyticsData[ch.id];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header with back button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setActiveChannel(null)} style={{ ...btnSecondary, padding: "6px 12px" }}>← Back</button>
            <span style={{ fontSize: "20px" }}>📺</span>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "700" }}>{ch.name}</div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>{ch.channelId}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={btnSecondary} onClick={() => syncChannel(ch)} disabled={loading}>
              {loading ? "⏳ Syncing..." : "🔄 Sync"}
            </button>
            <button style={{ ...btnSecondary, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => removeChannel(ch.id)}>
              Remove
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {ch.stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {[
              { label: "Subscribers", value: fmtNumber(ch.stats.subscriberCount), icon: "👥", color: "#ef4444" },
              { label: "Total Views", value: fmtNumber(ch.stats.viewCount), icon: "👁️", color: "#8b5cf6" },
              { label: "Videos", value: fmtNumber(ch.stats.videoCount), icon: "🎬", color: "#3b82f6" },
              { label: "Avg/Video", value: ch.stats.videoCount > 0 ? fmtNumber(Math.round(ch.stats.viewCount / ch.stats.videoCount)) : "—", icon: "📊", color: "#10b981" },
            ].map((s, i) => (
              <div key={i} style={{ ...card, textAlign: "center", borderTop: `3px solid ${s.color}`, padding: "16px" }}>
                <div style={{ fontSize: "18px" }}>{s.icon}</div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "4px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Board sub-tabs */}
        <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", paddingBottom: "8px" }}>
          {[
            { id: "videos", label: "Videos", icon: "🎬" },
            { id: "pipeline", label: "Pipeline", icon: "⚙️" },
            { id: "calendar", label: "Calendar", icon: "📅" },
            { id: "settings", label: "Settings", icon: "🔧" },
          ].map(t => (
            <button key={t.id} onClick={() => setChannelBoardTab(t.id)} style={{
              ...btnSecondary,
              background: channelBoardTab === t.id ? "rgba(239,68,68,0.1)" : "transparent",
              border: channelBoardTab === t.id ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent",
              fontWeight: channelBoardTab === t.id ? "600" : "400",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Board content */}
        {channelBoardTab === "videos" && renderVideosBoard(channelAnalytics)}
        {channelBoardTab === "pipeline" && renderPipelineBoard(ch.id, channelPipeline)}
        {channelBoardTab === "calendar" && renderCalendarBoard(ch.id)}
        {channelBoardTab === "settings" && renderChannelSettings(ch)}
      </div>
    );
  };

  /* ─── Videos Board ─── */
  const renderVideosBoard = (data) => {
    const videos = data?.recentVideos || [];
    return (
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>🎬 Published Videos</h3>
        {videos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px" }}>
            Sync the channel to load video data
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {videos.map((v, i) => (
              <div key={i} style={{
                padding: "12px 16px", borderRadius: "10px",
                background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                border: "1px solid var(--border, rgba(255,255,255,0.04))",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "500", fontSize: "13px" }}>{v.title}</div>
                  <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
                    <span>👁️ {fmtNumber(v.viewCount)}</span>
                    <span>👍 {fmtNumber(v.likeCount)}</span>
                    <span>💬 {fmtNumber(v.commentCount)}</span>
                    <span>📅 {fmtDate(v.publishedAt)}</span>
                  </div>
                </div>
                <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#60a5fa", textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap" }}>
                  Watch →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ─── Pipeline Board (Kanban) ─── */
  const renderPipelineBoard = (channelId, items) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Add new item */}
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={newPipelineTitle}
            onChange={e => setNewPipelineTitle(e.target.value)}
            placeholder="New video idea..."
            style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter" && newPipelineTitle.trim()) { addPipelineItem(channelId, newPipelineTitle.trim()); setNewPipelineTitle(""); } }}
          />
          <button style={btnPrimary} onClick={() => { if (newPipelineTitle.trim()) { addPipelineItem(channelId, newPipelineTitle.trim()); setNewPipelineTitle(""); } }}>
            + Add
          </button>
        </div>

        {/* Kanban columns */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)`, gap: "8px", overflowX: "auto" }}>
          {PIPELINE_STAGES.map(stage => {
            const stageItems = items.filter(p => p.stage === stage.id);
            return (
              <div key={stage.id} style={{ ...card, padding: "12px", minWidth: "150px" }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { const id = e.dataTransfer.getData("itemId"); movePipelineItem(id, stage.id); }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                  <span>{stage.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: stage.color }}>{stage.label}</span>
                  <span style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.3))", marginLeft: "auto" }}>{stageItems.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {stageItems.map(item => (
                    <div key={item.id} draggable
                      onDragStart={e => e.dataTransfer.setData("itemId", item.id)}
                      style={{
                        padding: "8px 10px", borderRadius: "8px", fontSize: "12px",
                        background: "var(--bg-tertiary, rgba(255,255,255,0.03))",
                        border: "1px solid var(--border, rgba(255,255,255,0.04))",
                        cursor: "grab",
                      }}
                    >
                      <div style={{ fontWeight: "500" }}>{item.title}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.3))", marginTop: "4px" }}>
                        {VIDEO_TYPES.find(t => t.id === item.type)?.icon || "🎬"} {item.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ─── Content Calendar ─── */
  const renderCalendarBoard = (channelId) => (
    <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: "40px", marginBottom: "12px" }}>📅</div>
      <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Content Calendar</div>
      <div style={{ color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px", maxWidth: "400px", margin: "0 auto" }}>
        Separate YouTube content calendar — plan uploads, schedule across channels, and view optimal posting times.
      </div>
    </div>
  );

  /* ─── Channel Settings ─── */
  const renderChannelSettings = (ch) => (
    <div style={{ ...card }}>
      <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>🔧 Channel Settings</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary, rgba(255,255,255,0.5))", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel Name</label>
          <input value={ch.name} readOnly style={{ ...inputStyle, marginTop: "4px" }} />
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary, rgba(255,255,255,0.5))", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel ID</label>
          <input value={ch.channelId} readOnly style={{ ...inputStyle, marginTop: "4px" }} />
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary, rgba(255,255,255,0.5))", textTransform: "uppercase", letterSpacing: "0.5px" }}>URL</label>
          <input value={ch.url || ""} readOnly style={{ ...inputStyle, marginTop: "4px" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border, rgba(255,255,255,0.06))" }}>
          <span style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))" }}>Added</span>
          <span style={{ fontSize: "12px" }}>{fmtDate(ch.addedAt)}</span>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Analytics Tab
     ═══════════════════════════════════════════════════════ */
  const renderAnalyticsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", paddingBottom: "8px" }}>
        {[
          { id: "overview", label: "Overview", icon: "📊" },
          { id: "market", label: "Market Intel", icon: "🌍" },
          { id: "algorithm", label: "Algorithm", icon: "🧠" },
        ].map(t => (
          <button key={t.id} onClick={() => setAnalyticsSubTab(t.id)} style={{
            ...btnSecondary,
            background: analyticsSubTab === t.id ? "rgba(139,92,246,0.1)" : "transparent",
            border: analyticsSubTab === t.id ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
            fontWeight: analyticsSubTab === t.id ? "600" : "400",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {analyticsSubTab === "overview" && (
        <>
          {/* Aggregate stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {[
              { label: "Channels", value: String(channels.length), icon: "📺", color: "#ef4444" },
              { label: "Total Subs", value: fmtNumber(channels.reduce((s, c) => s + (c.stats?.subscriberCount || 0), 0)), icon: "👥", color: "#8b5cf6" },
              { label: "Total Views", value: fmtNumber(channels.reduce((s, c) => s + (c.stats?.viewCount || 0), 0)), icon: "👁️", color: "#3b82f6" },
              { label: "Pipeline", value: String(pipelineItems.length), icon: "⚙️", color: "#10b981" },
            ].map((s, i) => (
              <div key={i} style={{ ...card, textAlign: "center", borderTop: `3px solid ${s.color}`, padding: "16px" }}>
                <div style={{ fontSize: "18px" }}>{s.icon}</div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "4px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-channel breakdown */}
          <div style={card}>
            <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>📈 Channel Performance</h3>
            {channels.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px" }}>
                Add channels in the Channels tab to see analytics
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {channels.map(ch => (
                  <div key={ch.id} style={{
                    padding: "12px 16px", borderRadius: "10px",
                    background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    border: "1px solid var(--border, rgba(255,255,255,0.04))",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>📺</span>
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "13px" }}>{ch.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
                          {ch.linked ? `${fmtNumber(ch.stats?.subscriberCount)} subs · ${fmtNumber(ch.stats?.viewCount)} views` : "Not linked"}
                        </div>
                      </div>
                    </div>
                    <button style={btnSecondary} onClick={() => { setActiveChannel(ch); setActiveTab("channels"); }}>
                      View →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {analyticsSubTab === "market" && (
        <div style={card}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>🌍 Niche Scanner</h3>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
            Search YouTube to discover high-return niches, analyze competition, and find content gaps. Results are cached to save API quota.
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <input
              value={nicheQuery}
              onChange={e => setNicheQuery(e.target.value)}
              placeholder="Enter niche keyword (e.g. 'AI automation', 'crypto trading')..."
              style={inputStyle}
            />
            <button style={btnPrimary}>🔍 Scan</button>
          </div>
          {nicheResults ? (
            <div>Results will appear here</div>
          ) : (
            <div style={{ textAlign: "center", padding: "30px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px" }}>
              Enter a niche keyword and scan to discover opportunities
            </div>
          )}
        </div>
      )}

      {analyticsSubTab === "algorithm" && (
        <div style={card}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>🧠 Algorithm Intelligence</h3>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
            Patterns and strategies extracted from ingested Brain Vault videos. The system learns from your video performance data to refine these insights.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { cat: "Content", strategies: ["Hook in first 3 seconds", "Open loop structure", "Pattern interrupts every 60s"], color: "#3b82f6" },
              { cat: "Growth", strategies: ["Consistent posting schedule", "Cross-promote Shorts", "Community engagement"], color: "#10b981" },
              { cat: "SEO", strategies: ["Keyword in first 3 words of title", "Tags match search intent", "Description front-loaded"], color: "#06b6d4" },
              { cat: "Monetization", strategies: ["Mid-roll placement strategy", "Affiliate link in description", "Membership tier structure"], color: "#f59e0b" },
            ].map(group => (
              <div key={group.cat} style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", border: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: group.color, marginBottom: "10px" }}>{group.cat}</div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary, rgba(255,255,255,0.7))" }}>
                  {group.strategies.map((s, i) => <li key={i} style={{ marginBottom: "6px" }}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Creation Tools Tab
     ═══════════════════════════════════════════════════════ */
  const renderCreationTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Template Engine */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "600" }}>🎬 Video Templates</h3>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>
              Reusable templates for different video types and channels. The system learns from performance data.
            </p>
          </div>
          <button style={btnPrimary} onClick={() => addTemplate({
            name: "New Template",
            type: "longform",
            channelId: null,
            structure: { hook: "", intro: "", sections: [], cta: "", outro: "" },
          })}>+ New Template</button>
        </div>

        {/* Video type filter */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {VIDEO_TYPES.map(vt => (
            <div key={vt.id} style={{
              ...card, padding: "12px 16px", flex: "1", minWidth: "120px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "18px" }}>{vt.icon}</span>
              <div>
                <div style={{ fontSize: "12px", fontWeight: "600" }}>{vt.label}</div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>{vt.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Template list */}
        {templates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px" }}>
            No templates yet. Create your first template to standardize your content production.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
            {templates.map(t => (
              <div key={t.id} style={{ ...card, padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{t.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>
                      {VIDEO_TYPES.find(vt => vt.id === t.type)?.icon} {t.type} · Used {t.usageCount}×
                    </div>
                  </div>
                  {t.avgPerformance && (
                    <span style={{
                      padding: "2px 8px", borderRadius: "12px", fontSize: "10px",
                      background: "rgba(16,185,129,0.15)", color: "#10b981",
                    }}>{t.avgPerformance}% avg</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Tools Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        {[
          { icon: "📝", label: "Script Generator", desc: "AI-powered video scripts with hooks, sections, CTAs", color: "#8b5cf6" },
          { icon: "🖼️", label: "Thumbnail Studio", desc: "Generate and analyze thumbnails", color: "#3b82f6" },
          { icon: "🏷️", label: "Title & SEO", desc: "Optimize titles, tags, and descriptions", color: "#06b6d4" },
          { icon: "🎨", label: "Media Generator", desc: "AI images and video clips", color: "#f59e0b" },
          { icon: "📅", label: "Content Calendar", desc: "Schedule across all channels", color: "#10b981" },
          { icon: "🤖", label: "Auto-Suggest", desc: "AI recommends topics based on trends", color: "#ef4444" },
        ].map((tool, i) => (
          <div key={i} style={{
            ...cardHover, padding: "20px", textAlign: "center",
            borderTop: `3px solid ${tool.color}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${tool.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>{tool.icon}</div>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>{tool.label}</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>{tool.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Add Channel Modal
     ═══════════════════════════════════════════════════════ */
  const renderAddModal = () => (
    <>
      <div onClick={() => setShowAddModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(440px, 90vw)", background: "var(--bg-primary, #0f0f1a)", borderRadius: "20px",
        border: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "28px", zIndex: 1001,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px" }}>📺 Add Channel</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel Name *</label>
            <input value={channelForm.name} onChange={e => setChannelForm(p => ({ ...p, name: e.target.value }))}
              placeholder="My Awesome Channel" style={{ ...inputStyle, marginTop: "6px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel ID</label>
            <input value={channelForm.channelId} onChange={e => setChannelForm(p => ({ ...p, channelId: e.target.value }))}
              placeholder="UCxxxxxxxxxx (from YouTube Studio)" style={{ ...inputStyle, marginTop: "6px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel URL</label>
            <input value={channelForm.url} onChange={e => setChannelForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://youtube.com/@channel" style={{ ...inputStyle, marginTop: "6px" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "24px", justifyContent: "flex-end" }}>
          <button style={btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
          <button style={btnPrimary} onClick={addChannel} disabled={!channelForm.name.trim()}>Add Channel</button>
        </div>
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="module-container" style={{ padding: "24px", color: "var(--text-primary, white)" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", paddingBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "-0.5px" }}>
              <span style={{ marginRight: "8px" }}>▶</span>YouTube Command Center
            </h1>
            <p style={{ color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "4px", fontSize: "13px" }}>
              {channels.length} channels · {pipelineItems.length} in pipeline · {templates.length} templates
            </p>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
                fontSize: "13px", fontWeight: activeTab === tab.id ? "600" : "400",
                transition: "all 0.2s",
                background: activeTab === tab.id ? "rgba(239,68,68,0.12)" : "var(--bg-secondary, rgba(255,255,255,0.04))",
                border: `1px solid ${activeTab === tab.id ? "rgba(239,68,68,0.3)" : "var(--border, rgba(255,255,255,0.06))"}`,
                color: activeTab === tab.id ? "#f87171" : "var(--text-primary, white)",
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "analytics" && renderAnalyticsTab()}
      {activeTab === "channels" && renderChannelsTab()}
      {activeTab === "creation" && renderCreationTab()}

      {/* Modals */}
      {showAddModal && renderAddModal()}
    </div>
  );
}
