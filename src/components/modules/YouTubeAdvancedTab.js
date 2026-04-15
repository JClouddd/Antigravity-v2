"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Shared styles ─── */
const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "14px", padding: "20px",
};
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  color: "var(--text-primary, white)", fontSize: "13px", outline: "none",
};
const btnPrimary = {
  padding: "10px 20px", borderRadius: "10px", cursor: "pointer",
  background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none",
  color: "white", fontWeight: "600", fontSize: "13px", whiteSpace: "nowrap",
};
const btnSecondary = {
  padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  color: "var(--text-primary, white)", fontSize: "12px",
};

const fmtNumber = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
};

/**
 * YouTubeAdvancedTab — Premium features panel.
 * Deep analytics, competitor tracking, viral score, comments, playlists, repurposing.
 */
export default function YouTubeAdvancedTab({ googleAccessToken, channels }) {
  const [activePanel, setActivePanel] = useState(null);

  // Multi-channel context
  const [managedChannels, setManagedChannels] = useState([]);
  const [activeWriteChannel, setActiveWriteChannel] = useState(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [channelDiscoveryDone, setChannelDiscoveryDone] = useState(false);

  // Discover all managed channels on mount
  const discoverChannels = useCallback(async () => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch("/api/youtube/channels-mine", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setManagedChannels(data.channels || []);
      setActiveWriteChannel(data.activeChannel || null);
      if (data.activeChannelId && !selectedChannelId) {
        setSelectedChannelId(data.activeChannelId);
      }
    } catch (e) { console.error("Channel discovery failed:", e); }
    setChannelDiscoveryDone(true);
  }, [googleAccessToken, selectedChannelId]);

  useEffect(() => { discoverChannels(); }, [discoverChannels]);

  // Deep Analytics
  const [deepAnalytics, setDeepAnalytics] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30");

  // Competitors
  const [competitorIds, setCompetitorIds] = useState("");
  const [competitors, setCompetitors] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  // Viral Score
  const [viralTitle, setViralTitle] = useState("");
  const [viralNiche, setViralNiche] = useState("");
  const [viralResult, setViralResult] = useState(null);
  const [viralLoading, setViralLoading] = useState(false);

  // Comments
  const [commentVideoId, setCommentVideoId] = useState("");
  const [comments, setComments] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  // Playlists
  const [playlists, setPlaylists] = useState(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // Repurpose
  const [repurposeContent, setRepurposeContent] = useState("");
  const [repurposeResult, setRepurposeResult] = useState(null);
  const [repurposeLoading, setRepurposeLoading] = useState(false);
  const [repurposeTargets, setRepurposeTargets] = useState(["shorts", "community", "tweet"]);

  // Community Posts
  const [communityTopic, setCommunityTopic] = useState("");
  const [communityType, setCommunityType] = useState("mixed");
  const [communityPosts, setCommunityPosts] = useState(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  // Enhanced Playlists
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistItems, setPlaylistItems] = useState(null);
  const [autoOrganizeLoading, setAutoOrganizeLoading] = useState(false);
  const [autoOrganizeResult, setAutoOrganizeResult] = useState(null);

  // Sentiment
  const [sentimentVideoId, setSentimentVideoId] = useState("");
  const [sentimentResult, setSentimentResult] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  // Chapters
  const [chapterContent, setChapterContent] = useState("");
  const [chapterLength, setChapterLength] = useState("10:00");
  const [chapterResult, setChapterResult] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);

  // Batch Edit
  const [batchVideoIds, setBatchVideoIds] = useState("");
  const [batchAction, setBatchAction] = useState("appendDescription");
  const [batchValue, setBatchValue] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  /* ─── API Calls ─── */
  const fetchDeepAnalytics = async () => {
    if (!googleAccessToken) return;
    setDeepLoading(true);
    try {
      const days = Number(analyticsPeriod);
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];
      const channelParam = selectedChannelId ? `&channelId=${selectedChannelId}` : "";
      const res = await fetch(`/api/youtube/analytics-deep?startDate=${startDate}&endDate=${endDate}${channelParam}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setDeepAnalytics(await res.json());
    } catch (e) { setDeepAnalytics({ error: e.message }); }
    setDeepLoading(false);
  };

  const fetchCompetitors = async () => {
    if (!competitorIds.trim() || !googleAccessToken) return;
    setCompLoading(true);
    try {
      const ids = competitorIds.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch("/api/youtube/competitors", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channelIds: ids }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setCompetitors(await res.json());
    } catch (e) { setCompetitors({ error: e.message }); }
    setCompLoading(false);
  };

  const predictViral = async () => {
    if (!viralTitle.trim()) return;
    setViralLoading(true);
    try {
      const res = await fetch("/api/youtube/viral-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: viralTitle, niche: viralNiche }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setViralResult(await res.json());
    } catch (e) { setViralResult({ error: e.message }); }
    setViralLoading(false);
  };

  const fetchComments = async () => {
    if (!commentVideoId.trim() || !googleAccessToken) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/youtube/comments?videoId=${commentVideoId.trim()}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setComments(await res.json());
    } catch (e) { setComments({ error: e.message }); }
    setCommentsLoading(false);
  };

  const replyToComment = async (parentId) => {
    if (!replyText.trim() || !googleAccessToken) return;
    try {
      const res = await fetch("/api/youtube/comments", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, text: replyText }),
      });
      if (res.ok) { setReplyText(""); setReplyingTo(null); fetchComments(); }
    } catch (e) { console.error("Reply failed:", e); }
  };

  const fetchPlaylists = async () => {
    if (!googleAccessToken) return;
    setPlaylistsLoading(true);
    try {
      const channelParam = selectedChannelId ? `?channelId=${selectedChannelId}` : "";
      const res = await fetch(`/api/youtube/playlists${channelParam}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setPlaylists(await res.json());
    } catch (e) { setPlaylists({ error: e.message }); }
    setPlaylistsLoading(false);
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim() || !googleAccessToken) return;
    try {
      const res = await fetch("/api/youtube/playlists", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: newPlaylistName.trim() }),
      });
      if (res.ok) { setNewPlaylistName(""); fetchPlaylists(); }
    } catch (e) { console.error("Create playlist failed:", e); }
  };

  const repurposeContent_ = async () => {
    if (!repurposeContent.trim()) return;
    setRepurposeLoading(true);
    try {
      const res = await fetch("/api/youtube/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: repurposeContent, targets: repurposeTargets }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setRepurposeResult(await res.json());
    } catch (e) { setRepurposeResult({ error: e.message }); }
    setRepurposeLoading(false);
  };

  const generateCommunityPosts = async () => {
    if (!communityTopic.trim()) return;
    setCommunityLoading(true);
    try {
      const res = await fetch("/api/youtube/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: communityTopic.trim(),
          postType: communityType,
          channelNiche: channels?.[0]?.niche || "",
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setCommunityPosts(await res.json());
    } catch (e) { setCommunityPosts({ error: e.message }); }
    setCommunityLoading(false);
  };

  const fetchPlaylistItems = async (playlistId) => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch(`/api/youtube/playlists?playlistId=${playlistId}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setPlaylistItems(await res.json());
    } catch (e) { setPlaylistItems({ error: e.message }); }
  };

  const autoOrganizePlaylist = async (playlistId, sortBy) => {
    if (!googleAccessToken) return;
    setAutoOrganizeLoading(true);
    setAutoOrganizeResult(null);
    try {
      const res = await fetch("/api/youtube/playlists", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autoOrganize", playlistId, sortBy }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setAutoOrganizeResult(data);
      fetchPlaylistItems(playlistId);
    } catch (e) { setAutoOrganizeResult({ error: e.message }); }
    setAutoOrganizeLoading(false);
  };

  const removeFromPlaylist = async (itemId, playlistId) => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch("/api/youtube/playlists", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeVideo", itemId }),
      });
      if (res.ok) fetchPlaylistItems(playlistId);
    } catch (e) { console.error("Remove failed:", e); }
  };

  const analyzeSentiment = async () => {
    if (!sentimentVideoId.trim() || !googleAccessToken) return;
    setSentimentLoading(true);
    setSentimentResult(null);
    try {
      const res = await fetch("/api/youtube/sentiment", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: sentimentVideoId.trim() }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setSentimentResult(await res.json());
    } catch (e) { setSentimentResult({ error: e.message }); }
    setSentimentLoading(false);
  };

  const generateChapters = async () => {
    if (!chapterContent.trim()) return;
    setChapterLoading(true);
    setChapterResult(null);
    try {
      const res = await fetch("/api/youtube/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chapterContent, videoLength: chapterLength }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setChapterResult(await res.json());
    } catch (e) { setChapterResult({ error: e.message }); }
    setChapterLoading(false);
  };

  const runBatchEdit = async () => {
    if (!batchVideoIds.trim() || !batchValue.trim() || !googleAccessToken) return;
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const ids = batchVideoIds.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      const updates = {};
      if (batchAction === "appendDescription") updates.appendDescription = batchValue;
      else if (batchAction === "prependDescription") updates.prependDescription = batchValue;
      else if (batchAction === "addTags") updates.addTags = batchValue.split(",").map(s => s.trim());
      else if (batchAction === "removeTags") updates.removeTags = batchValue.split(",").map(s => s.trim());
      else if (batchAction === "title") updates.title = batchValue;
      else if (batchAction === "description") updates.description = batchValue;

      const res = await fetch("/api/youtube/batch-edit", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: ids, updates }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setBatchResult(await res.json());
    } catch (e) { setBatchResult({ error: e.message }); }
    setBatchLoading(false);
  };

  /* ─── Premium Tools Grid ─── */
  const tools = [
    { id: "analytics", icon: "📈", label: "Deep Analytics", desc: "Watch time, retention, traffic sources, demographics", color: "#3b82f6" },
    { id: "competitors", icon: "🏆", label: "Competitor Tracker", desc: "Benchmark against any channel", color: "#f59e0b" },
    { id: "viral", icon: "🔥", label: "Viral Predictor", desc: "AI scores your video's viral potential", color: "#ef4444" },
    { id: "comments", icon: "💬", label: "Comment Manager", desc: "Read, reply, and manage comments", color: "#10b981" },
    { id: "playlists", icon: "📋", label: "Playlist Manager", desc: "Create, organize, and auto-sort playlists", color: "#8b5cf6" },
    { id: "community", icon: "📝", label: "Community Posts", desc: "Generate text, poll, and quiz drafts", color: "#ec4899" },
    { id: "repurpose", icon: "♻️", label: "Content Repurposer", desc: "Transform content across platforms", color: "#06b6d4" },
    { id: "sentiment", icon: "🎭", label: "Sentiment Analysis", desc: "Bulk-analyze comment mood and themes", color: "#14b8a6" },
    { id: "chapters", icon: "📑", label: "Chapter Generator", desc: "Auto-generate chapters from scripts", color: "#a855f7" },
    { id: "batch", icon: "⚡", label: "Batch Editor", desc: "Update 50 videos at once", color: "#f97316" },
  ];

  // Channel Selector bar (shown inside panels)
  const channelSelector = managedChannels.length > 1 ? (
    <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", borderTop: "2px solid #3b82f6" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>📺 Channel:</span>
      <select value={selectedChannelId} onChange={e => setSelectedChannelId(e.target.value)} style={{ ...inputStyle, maxWidth: "250px" }}>
        {managedChannels.map(ch => (
          <option key={ch.channelId} value={ch.channelId}>
            {ch.title} {ch.channelId === activeWriteChannel?.channelId ? "(active — writes here)" : "(read-only)"}
          </option>
        ))}
      </select>
      {selectedChannelId !== activeWriteChannel?.channelId && (
        <span style={{ fontSize: "10px", color: "#f59e0b", padding: "2px 8px", borderRadius: "6px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", whiteSpace: "nowrap" }}>⚠️ Read-only — uploads/comments target {activeWriteChannel?.title || "default channel"}</span>
      )}
    </div>
  ) : managedChannels.length === 1 ? (
    <div style={{ ...card, padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", borderTop: "2px solid #10b981" }}>
      <img src={managedChannels[0].thumbnail} alt="" style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
      <span style={{ fontSize: "11px", fontWeight: "600" }}>{managedChannels[0].title}</span>
      <span style={{ fontSize: "10px", color: "#10b981" }}>✅ Single channel — all operations target here</span>
    </div>
  ) : null;

  if (activePanel) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => setActivePanel(null)} style={{ ...btnSecondary, alignSelf: "flex-start" }}>← Back to Pro Tools</button>
        {channelSelector}

        {/* ─── Deep Analytics Panel ─── */}
        {activePanel === "analytics" && (
          <div style={card}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>📈 Deep Analytics</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <select value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)} style={inputStyle}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
              <button style={btnPrimary} onClick={fetchDeepAnalytics} disabled={deepLoading}>
                {deepLoading ? "⏳ Loading..." : "📊 Fetch Analytics"}
              </button>
            </div>

            {deepAnalytics && !deepAnalytics.error && (
              <>
                {/* Totals */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
                  {[
                    { label: "Views", value: fmtNumber(deepAnalytics.totals?.views || 0), color: "#3b82f6" },
                    { label: "Watch Hours", value: fmtNumber(deepAnalytics.totals?.watchTimeHours || 0), color: "#8b5cf6" },
                    { label: "Net Subs", value: `+${fmtNumber(deepAnalytics.totals?.netSubs || 0)}`, color: "#10b981" },
                    { label: "Avg Daily", value: fmtNumber(deepAnalytics.totals?.avgDailyViews || 0), color: "#f59e0b" },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: "center", padding: "12px", borderRadius: "10px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", borderTop: `2px solid ${s.color}` }}>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Traffic Sources */}
                {deepAnalytics.trafficSources?.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🚦 Traffic Sources</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {deepAnalytics.trafficSources.slice(0, 8).map((s, i) => {
                        const maxViews = deepAnalytics.trafficSources[0]?.views || 1;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                            <span style={{ width: "120px", color: "var(--text-secondary)" }}>{s.source}</span>
                            <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))" }}>
                              <div style={{ width: `${(s.views / maxViews) * 100}%`, height: "100%", borderRadius: "4px", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
                            </div>
                            <span style={{ width: "60px", textAlign: "right", color: "var(--text-tertiary)" }}>{fmtNumber(s.views)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Geography */}
                {deepAnalytics.geography?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🌍 Top Countries</h4>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {deepAnalytics.geography.slice(0, 10).map((g, i) => (
                        <span key={i} style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))", border: "1px solid var(--border, rgba(255,255,255,0.06))" }}>
                          {g.country}: {fmtNumber(g.views)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {deepAnalytics?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {deepAnalytics.error}</div>}
          </div>
        )}

        {/* ─── Competitor Tracker ─── */}
        {activePanel === "competitors" && (
          <div style={card}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>🏆 Competitor Tracker</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input value={competitorIds} onChange={e => setCompetitorIds(e.target.value)}
                placeholder="Enter channel IDs (comma separated): UCxxx, UCyyy..." style={inputStyle} />
              <button style={btnPrimary} onClick={fetchCompetitors} disabled={compLoading}>
                {compLoading ? "⏳ Loading..." : "🔍 Analyze"}
              </button>
            </div>

            {competitors && !competitors.error && competitors.competitors && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {competitors.competitors.map((c, i) => (
                  <div key={i} style={{ ...card, padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
                    {c.thumbnail && <img src={c.thumbnail} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{c.title}</div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                        <span>👥 {fmtNumber(c.subscribers)}</span>
                        <span>👁️ {fmtNumber(c.totalViews)}</span>
                        <span>🎬 {c.videoCount} videos</span>
                        <span>📊 {fmtNumber(c.avgRecentViews)} avg</span>
                        <span>📅 {c.postingFrequency}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {competitors?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {competitors.error}</div>}
          </div>
        )}

        {/* ─── Viral Predictor ─── */}
        {activePanel === "viral" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>🔥 Viral Score Predictor</h3>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <input value={viralTitle} onChange={e => setViralTitle(e.target.value)} placeholder="Video title..." style={inputStyle} />
                <input value={viralNiche} onChange={e => setViralNiche(e.target.value)} placeholder="Niche..." style={inputStyle} />
              </div>
              <button style={btnPrimary} onClick={predictViral} disabled={viralLoading || !viralTitle.trim()}>
                {viralLoading ? "⏳ Analyzing..." : "🔥 Predict Viral Score"}
              </button>
            </div>

            {viralResult && !viralResult.error && (
              <>
                {/* Score */}
                <div style={{ ...card, textAlign: "center", borderTop: `3px solid ${viralResult.viralScore >= 80 ? "#10b981" : viralResult.viralScore >= 60 ? "#f59e0b" : "#ef4444"}` }}>
                  <div style={{ fontSize: "48px", fontWeight: "800", color: viralResult.viralScore >= 80 ? "#10b981" : viralResult.viralScore >= 60 ? "#f59e0b" : "#ef4444" }}>
                    {viralResult.viralScore}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Viral Score</div>
                </div>

                {/* Breakdown */}
                {viralResult.breakdown && (
                  <div style={card}>
                    <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px" }}>📊 Breakdown</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {Object.entries(viralResult.breakdown).map(([key, val]) => (
                        <div key={key} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: val.score >= 80 ? "#10b981" : val.score >= 60 ? "#f59e0b" : "#ef4444" }}>{val.score}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{val.feedback}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Predictions + Recommendations */}
                {viralResult.prediction && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={card}>
                      <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🎯 Predictions</h4>
                      <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-secondary)" }}>
                        <div>📊 Est. Views: <strong>{viralResult.prediction.estimatedViews}</strong></div>
                        <div>🖱️ Est. CTR: <strong>{viralResult.prediction.estimatedCTR}</strong></div>
                        <div>⏱️ Ideal Length: <strong>{viralResult.prediction.idealLength}</strong></div>
                        <div>📅 Best Time: <strong>{viralResult.prediction.bestPublishTime}</strong></div>
                      </div>
                    </div>
                    <div style={card}>
                      <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>💡 Recommendations</h4>
                      <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {(viralResult.recommendations || []).map((r, i) => <li key={i} style={{ marginBottom: "4px" }}>{r}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
            {viralResult?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {viralResult.error}</div>}
          </div>
        )}

        {/* ─── Comment Manager ─── */}
        {activePanel === "comments" && (
          <div style={card}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>💬 Comment Manager</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input value={commentVideoId} onChange={e => setCommentVideoId(e.target.value)}
                placeholder="Enter Video ID..." style={inputStyle} />
              <button style={btnPrimary} onClick={fetchComments} disabled={commentsLoading}>
                {commentsLoading ? "⏳ Loading..." : "💬 Load Comments"}
              </button>
            </div>

            {comments && !comments.error && (
              <>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                  {comments.stats?.totalComments} comments · Avg {comments.stats?.avgLikes} likes
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "500px", overflowY: "auto" }}>
                  {(comments.comments || []).map(c => (
                    <div key={c.id} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", border: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                        {c.authorImage && <img src={c.authorImage} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "600", fontSize: "11px" }}>{c.author} <span style={{ fontWeight: "400", color: "var(--text-tertiary)" }}>· 👍 {c.likes}</span></div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{c.text}</div>
                          <button onClick={() => setReplyingTo(replyingTo === c.commentId ? null : c.commentId)}
                            style={{ ...btnSecondary, padding: "2px 8px", fontSize: "10px", marginTop: "4px" }}>
                            {replyingTo === c.commentId ? "Cancel" : `Reply (${c.replyCount})`}
                          </button>
                          {replyingTo === c.commentId && (
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                              <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." style={{ ...inputStyle, fontSize: "11px" }} />
                              <button style={{ ...btnPrimary, padding: "4px 12px", fontSize: "11px" }} onClick={() => replyToComment(c.commentId)}>Send</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {comments?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {comments.error}</div>}
          </div>
        )}

        {/* ─── Playlist Manager ─── */}
        {activePanel === "playlists" && (
          <div style={card}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>📋 Playlist Manager</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name..." style={inputStyle} />
              <button style={btnPrimary} onClick={createPlaylist} disabled={!newPlaylistName.trim()}>+ Create</button>
              <button style={btnSecondary} onClick={fetchPlaylists} disabled={playlistsLoading}>
                {playlistsLoading ? "⏳" : "🔄 Refresh"}
              </button>
            </div>

            {playlists && !playlists.error && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
                {(playlists.playlists || []).map(p => (
                  <div key={p.id} style={{ ...card, padding: "12px", cursor: "pointer" }}
                    onClick={() => { setSelectedPlaylist(p); fetchPlaylistItems(p.id); }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#8b5cf6"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}>
                    {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width: "100%", borderRadius: "8px", marginBottom: "8px" }} />}
                    <div style={{ fontWeight: "600", fontSize: "12px" }}>{p.title}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                      {p.itemCount} videos · {p.privacy}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!playlists && <button style={btnSecondary} onClick={fetchPlaylists}>Load Playlists</button>}
            {playlists?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {playlists.error}</div>}

            {/* Playlist Drill-Down */}
            {selectedPlaylist && playlistItems && !playlistItems.error && (
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--border, rgba(255,255,255,0.06))", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "600" }}>{selectedPlaylist.title}</h4>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{playlistItems.totalItems} items</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["dateNewest", "dateOldest", "titleAZ", "titleZA"].map(sort => (
                      <button key={sort} style={{ ...btnSecondary, padding: "4px 10px", fontSize: "10px" }}
                        disabled={autoOrganizeLoading}
                        onClick={() => autoOrganizePlaylist(selectedPlaylist.id, sort)}>
                        {sort === "dateNewest" ? "📅 Newest" : sort === "dateOldest" ? "📅 Oldest" : sort === "titleAZ" ? "🔤 A→Z" : "🔤 Z→A"}
                      </button>
                    ))}
                  </div>
                </div>

                {autoOrganizeResult && !autoOrganizeResult.error && (
                  <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "11px", color: "#10b981", marginBottom: "10px" }}>
                    ✅ Reorganized: {autoOrganizeResult.itemsMoved} items moved (sorted by {autoOrganizeResult.sortBy})
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {(playlistItems.items || []).map((item, i) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-tertiary)", width: "20px" }}>#{i + 1}</span>
                      {item.thumbnail && <img src={item.thumbnail} alt="" style={{ width: "48px", height: "27px", borderRadius: "4px", objectFit: "cover" }} />}
                      <div style={{ flex: 1, fontSize: "11px", fontWeight: "500" }}>{item.title}</div>
                      <button onClick={() => removeFromPlaylist(item.id, selectedPlaylist.id)}
                        style={{ ...btnSecondary, padding: "2px 6px", fontSize: "9px", color: "#ef4444" }}>✕</button>
                    </div>
                  ))}
                </div>

                <button onClick={() => { setSelectedPlaylist(null); setPlaylistItems(null); setAutoOrganizeResult(null); }}
                  style={{ ...btnSecondary, marginTop: "10px", fontSize: "11px" }}>← Back to playlists</button>
              </div>
            )}
          </div>
        )}

        {/* ─── Content Repurposer ─── */}
        {activePanel === "repurpose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>♻️ Content Repurposer</h3>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Paste a script, blog post, or any content. The AI will transform it into Shorts, tweets, community posts, blog intros, and more.
              </p>
              <textarea value={repurposeContent} onChange={e => setRepurposeContent(e.target.value)}
                placeholder="Paste your content here..." rows={5}
                style={{ ...inputStyle, resize: "vertical", marginBottom: "12px" }} />

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                {["shorts", "community", "tweet", "blog_intro", "instagram_caption", "linkedin", "tiktok", "podcast_notes"].map(t => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", cursor: "pointer",
                    padding: "4px 10px", borderRadius: "8px",
                    background: repurposeTargets.includes(t) ? "rgba(139,92,246,0.15)" : "var(--bg-tertiary, rgba(255,255,255,0.04))",
                    border: `1px solid ${repurposeTargets.includes(t) ? "rgba(139,92,246,0.3)" : "var(--border, rgba(255,255,255,0.06))"}`,
                    color: repurposeTargets.includes(t) ? "#a78bfa" : "var(--text-secondary)",
                  }}>
                    <input type="checkbox" checked={repurposeTargets.includes(t)}
                      onChange={() => setRepurposeTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      style={{ display: "none" }} />
                    {t.replace("_", " ")}
                  </label>
                ))}
              </div>

              <button style={btnPrimary} onClick={repurposeContent_} disabled={repurposeLoading || !repurposeContent.trim()}>
                {repurposeLoading ? "⏳ Transforming..." : "♻️ Repurpose Content"}
              </button>
            </div>

            {repurposeResult && !repurposeResult.error && repurposeResult.repurposed && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(repurposeResult.repurposed).map(([platform, data]) => (
                  <div key={platform} style={{ ...card, padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: "600", fontSize: "13px", textTransform: "capitalize" }}>{platform.replace("_", " ")}</span>
                      {data.bestTime && <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>📅 {data.bestTime}</span>}
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", padding: "10px", borderRadius: "8px", margin: 0 }}>
                      {data.content}
                    </pre>
                    {data.notes && <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>💡 {data.notes}</div>}
                  </div>
                ))}

                {repurposeResult.schedule && (
                  <div style={{ ...card, padding: "14px", borderTop: "2px solid #8b5cf6" }}>
                    <div style={{ fontWeight: "600", fontSize: "12px", marginBottom: "4px" }}>📅 Recommended Schedule</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{repurposeResult.schedule}</div>
                  </div>
                )}
              </div>
            )}
            {repurposeResult?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {repurposeResult.error}</div>}
          </div>
        )}

        {/* ─── Community Posts ─── */}
        {activePanel === "community" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>📝 Community Post Generator</h3>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Generate ready-to-paste community tab posts. YouTube&apos;s API doesn&apos;t support direct posting — copy these into YouTube Studio.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <input value={communityTopic} onChange={e => setCommunityTopic(e.target.value)}
                  placeholder="Topic or theme for posts..." style={inputStyle} />
                <select value={communityType} onChange={e => setCommunityType(e.target.value)} style={inputStyle}>
                  <option value="mixed">🎲 Mix of all types</option>
                  <option value="text">📝 Text posts</option>
                  <option value="poll">📊 Polls</option>
                  <option value="quiz">🧠 Quizzes</option>
                  <option value="image">🖼️ Image posts</option>
                </select>
              </div>

              <button style={btnPrimary} onClick={generateCommunityPosts} disabled={communityLoading || !communityTopic.trim()}>
                {communityLoading ? "⏳ Generating..." : "📝 Generate Posts"}
              </button>
            </div>

            {communityPosts && !communityPosts.error && communityPosts.posts && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {communityPosts.posts.map((post, i) => (
                  <div key={i} style={{ ...card, padding: "14px", borderLeft: `3px solid ${post.type === "poll" ? "#3b82f6" : post.type === "quiz" ? "#f59e0b" : post.type === "image" ? "#ec4899" : "#10b981"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "capitalize", padding: "2px 8px", borderRadius: "8px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))" }}>
                        {post.type === "poll" ? "📊" : post.type === "quiz" ? "🧠" : post.type === "image" ? "🖼️" : "📝"} {post.type}
                      </span>
                      <span style={{ fontSize: "10px", color: post.estimatedEngagement === "high" ? "#10b981" : "var(--text-tertiary)" }}>
                        {post.estimatedEngagement} engagement · {post.bestTime}
                      </span>
                    </div>

                    <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", padding: "10px", borderRadius: "8px", margin: "0 0 8px 0", cursor: "pointer" }}
                      onClick={() => { navigator.clipboard?.writeText(post.content); }}>
                      {post.content}
                    </pre>

                    {post.pollOptions && post.pollOptions.length > 0 && (
                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: "10px", fontWeight: "600", marginBottom: "4px", color: "var(--text-tertiary)" }}>Poll Options:</div>
                        {post.pollOptions.map((opt, oi) => (
                          <div key={oi} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))", marginBottom: "2px" }}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    {post.quizAnswer && (
                      <div style={{ fontSize: "10px", color: "#f59e0b" }}>✅ Answer: {post.quizAnswer}</div>
                    )}

                    {post.hashtags && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                        {post.hashtags.map((tag, ti) => (
                          <span key={ti} style={{ padding: "1px 6px", borderRadius: "6px", fontSize: "9px", background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>💡 {post.strategy}</div>
                    <button onClick={() => { navigator.clipboard?.writeText(post.content + (post.hashtags ? "\n\n" + post.hashtags.join(" ") : "")); }}
                      style={{ ...btnSecondary, padding: "3px 10px", fontSize: "10px", marginTop: "6px" }}>📋 Copy</button>
                  </div>
                ))}

                {communityPosts.note && (
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontSize: "11px", color: "#f59e0b" }}>
                    ⚠️ {communityPosts.note}
                  </div>
                )}
              </div>
            )}
            {communityPosts?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {communityPosts.error}</div>}
          </div>
        )}

        {/* ─── Sentiment Analysis ─── */}
        {activePanel === "sentiment" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>🎭 Comment Sentiment Dashboard</h3>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                AI analyzes up to 100 comments — mood, themes, praise, complaints, questions, and toxic content.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={sentimentVideoId} onChange={e => setSentimentVideoId(e.target.value)}
                  placeholder="Enter Video ID..." style={inputStyle} />
                <button style={btnPrimary} onClick={analyzeSentiment} disabled={sentimentLoading || !sentimentVideoId.trim()}>
                  {sentimentLoading ? "⏳ Analyzing..." : "🎭 Analyze"}
                </button>
              </div>
            </div>

            {sentimentResult && !sentimentResult.error && (
              <>
                {/* Overall Score */}
                <div style={{ ...card, textAlign: "center", borderTop: `3px solid ${sentimentResult.overall?.score >= 70 ? "#10b981" : sentimentResult.overall?.score >= 40 ? "#f59e0b" : "#ef4444"}` }}>
                  <div style={{ fontSize: "48px", fontWeight: "800", color: sentimentResult.overall?.score >= 70 ? "#10b981" : sentimentResult.overall?.score >= 40 ? "#f59e0b" : "#ef4444" }}>
                    {sentimentResult.overall?.score}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "capitalize" }}>
                    {sentimentResult.overall?.sentiment} · {sentimentResult.commentsAnalyzed} comments
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{sentimentResult.overall?.summary}</div>
                </div>

                {/* Breakdown */}
                {sentimentResult.breakdown && (
                  <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    {[
                      { label: "Positive", val: sentimentResult.breakdown.positive, color: "#10b981" },
                      { label: "Neutral", val: sentimentResult.breakdown.neutral, color: "#6b7280" },
                      { label: "Negative", val: sentimentResult.breakdown.negative, color: "#ef4444" },
                      { label: "Questions", val: sentimentResult.breakdown.questions, color: "#3b82f6" },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: s.color }}>{s.val}%</div>
                        <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Insights Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {sentimentResult.topPraise?.length > 0 && (
                    <div style={card}>
                      <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#10b981" }}>👍 Top Praise</h4>
                      <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {sentimentResult.topPraise.map((p, i) => <li key={i} style={{ marginBottom: "3px" }}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  {sentimentResult.topComplaints?.length > 0 && (
                    <div style={card}>
                      <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#ef4444" }}>👎 Top Complaints</h4>
                      <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {sentimentResult.topComplaints.map((c, i) => <li key={i} style={{ marginBottom: "3px" }}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {sentimentResult.topQuestions?.length > 0 && (
                    <div style={card}>
                      <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#3b82f6" }}>❓ Top Questions</h4>
                      <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {sentimentResult.topQuestions.map((q, i) => <li key={i} style={{ marginBottom: "3px" }}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                  {sentimentResult.actionItems?.length > 0 && (
                    <div style={card}>
                      <h4 style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#f59e0b" }}>🎯 Action Items</h4>
                      <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {sentimentResult.actionItems.map((a, i) => <li key={i} style={{ marginBottom: "3px" }}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Community Health */}
                {sentimentResult.engagementInsights && (
                  <div style={{ ...card, borderTop: "2px solid #14b8a6" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>🏥 Community Health: <span style={{ textTransform: "capitalize", color: sentimentResult.engagementInsights.communityHealth === "healthy" ? "#10b981" : "#f59e0b" }}>{sentimentResult.engagementInsights.communityHealth}</span></div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{sentimentResult.engagementInsights.recommendedResponse}</div>
                  </div>
                )}
              </>
            )}
            {sentimentResult?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {sentimentResult.error}</div>}
          </div>
        )}

        {/* ─── Chapter Generator ─── */}
        {activePanel === "chapters" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>📑 Auto-Chapter Generator</h3>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Paste a script or transcript. The AI will generate YouTube chapters with timestamps, a ready-to-paste description block, and a pinned comment.
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input value={chapterLength} onChange={e => setChapterLength(e.target.value)}
                  placeholder="Video length (e.g. 10:00)" style={{ ...inputStyle, maxWidth: "150px" }} />
                <button style={btnPrimary} onClick={generateChapters} disabled={chapterLoading || !chapterContent.trim()}>
                  {chapterLoading ? "⏳ Generating..." : "📑 Generate Chapters"}
                </button>
              </div>
              <textarea value={chapterContent} onChange={e => setChapterContent(e.target.value)}
                placeholder="Paste your script or transcript here..." rows={6}
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {chapterResult && !chapterResult.error && (
              <>
                {/* Chapters List */}
                {chapterResult.chapters && (
                  <div style={card}>
                    <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>⏱️ Chapters</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {chapterResult.chapters.map((ch, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", alignItems: "baseline", padding: "4px 0" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#a78bfa", minWidth: "40px" }}>{ch.timestamp}</span>
                          <span style={{ fontSize: "12px", fontWeight: "600" }}>{ch.title}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{ch.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy Blocks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {chapterResult.description && (
                    <div style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <h4 style={{ fontSize: "12px", fontWeight: "600" }}>📋 Description Block</h4>
                        <button onClick={() => navigator.clipboard?.writeText(chapterResult.description)}
                          style={{ ...btnSecondary, padding: "2px 8px", fontSize: "10px" }}>Copy</button>
                      </div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", padding: "8px", borderRadius: "6px", margin: 0 }}>
                        {chapterResult.description}
                      </pre>
                    </div>
                  )}
                  {chapterResult.pinnedComment && (
                    <div style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <h4 style={{ fontSize: "12px", fontWeight: "600" }}>📌 Pinned Comment</h4>
                        <button onClick={() => navigator.clipboard?.writeText(chapterResult.pinnedComment)}
                          style={{ ...btnSecondary, padding: "2px 8px", fontSize: "10px" }}>Copy</button>
                      </div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", padding: "8px", borderRadius: "6px", margin: 0 }}>
                        {chapterResult.pinnedComment}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
            {chapterResult?.error && <div style={{ color: "#f87171", fontSize: "12px" }}>❌ {chapterResult.error}</div>}
          </div>
        )}

        {/* ─── Batch Editor ─── */}
        {activePanel === "batch" && (
          <div style={card}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>⚡ Batch Video Editor</h3>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "16px" }}>
              Update up to 50 videos at once. Append links to descriptions, add tags, or replace titles in bulk.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Video IDs (comma or newline separated)</label>
                <textarea value={batchVideoIds} onChange={e => setBatchVideoIds(e.target.value)}
                  placeholder={"dQw4w9WgXcQ\nabcdefghijk\nxyz123456"} rows={3}
                  style={{ ...inputStyle, marginTop: "4px", resize: "vertical", fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Action</label>
                <select value={batchAction} onChange={e => setBatchAction(e.target.value)} style={{ ...inputStyle, marginTop: "4px" }}>
                  <option value="appendDescription">📝 Append to description</option>
                  <option value="prependDescription">📝 Prepend to description</option>
                  <option value="addTags">🏷️ Add tags</option>
                  <option value="removeTags">🗑️ Remove tags</option>
                  <option value="title">✏️ Replace title</option>
                  <option value="description">📄 Replace entire description</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  {batchAction.includes("Tag") ? "Tags (comma separated)" : "Value"}
                </label>
                <textarea value={batchValue} onChange={e => setBatchValue(e.target.value)}
                  placeholder={batchAction.includes("Tag") ? "tag1, tag2, tag3" : "Text to apply..."}
                  rows={2} style={{ ...inputStyle, marginTop: "4px", resize: "vertical" }} />
              </div>
            </div>

            <button style={btnPrimary} onClick={runBatchEdit}
              disabled={batchLoading || !batchVideoIds.trim() || !batchValue.trim()}>
              {batchLoading ? "⏳ Processing..." : `⚡ Update ${batchVideoIds.split(/[,\n]/).filter(s => s.trim()).length} Videos`}
            </button>

            {batchResult && !batchResult.error && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: "10px" }}>
                  <span style={{ fontWeight: "600", color: "#10b981" }}>✅ {batchResult.succeeded}/{batchResult.totalProcessed} updated</span>
                  {batchResult.failed > 0 && <span style={{ color: "#f87171", marginLeft: "8px" }}>· {batchResult.failed} failed</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {batchResult.results?.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "11px" }}>
                      <span style={{ color: r.success ? "#10b981" : "#ef4444" }}>{r.success ? "✅" : "❌"}</span>
                      <code style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{r.videoId}</code>
                      {r.title && <span style={{ color: "var(--text-secondary)" }}>{r.title}</span>}
                      {r.error && <span style={{ color: "#f87171" }}>{r.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {batchResult?.error && <div style={{ marginTop: "12px", color: "#f87171", fontSize: "12px" }}>❌ {batchResult.error}</div>}
          </div>
        )}
      </div>
    );
  }

  /* ─── Tools Grid ─── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...card, borderTop: "3px solid #f59e0b", textAlign: "center", padding: "24px" }}>
        <div style={{ fontSize: "24px", marginBottom: "4px" }}>⚡</div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Pro Tools</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          Premium features for serious YouTube creators. Deep analytics, competitor intel, viral prediction, and cross-platform content repurposing.
        </p>
      </div>

      {/* Channel Status */}
      {channelDiscoveryDone && (
        <div style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: "600" }}>📺 {managedChannels.length} channel{managedChannels.length !== 1 ? "s" : ""} detected</span>
          {managedChannels.map(ch => (
            <div key={ch.channelId} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "8px",
              background: ch.channelId === selectedChannelId ? "rgba(59,130,246,0.1)" : "var(--bg-tertiary, rgba(255,255,255,0.04))",
              border: `1px solid ${ch.channelId === selectedChannelId ? "rgba(59,130,246,0.3)" : "var(--border, rgba(255,255,255,0.06))"}`,
              cursor: "pointer",
            }} onClick={() => setSelectedChannelId(ch.channelId)}>
              {ch.thumbnail && <img src={ch.thumbnail} alt="" style={{ width: "16px", height: "16px", borderRadius: "50%" }} />}
              <span style={{ fontSize: "11px", fontWeight: ch.channelId === selectedChannelId ? "600" : "400" }}>{ch.title}</span>
              {ch.channelId === activeWriteChannel?.channelId && <span style={{ fontSize: "8px", color: "#10b981" }}>✍️</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        {tools.map(tool => (
          <div key={tool.id} style={{
            ...card, padding: "20px", textAlign: "center", cursor: "pointer",
            borderTop: `3px solid ${tool.color}`, transition: "all 0.2s",
          }}
            onClick={() => setActivePanel(tool.id)}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${tool.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>{tool.icon}</div>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>{tool.label}</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{tool.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
