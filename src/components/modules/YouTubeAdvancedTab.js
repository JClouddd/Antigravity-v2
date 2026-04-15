"use client";

import { useState } from "react";

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

  /* ─── API Calls ─── */
  const fetchDeepAnalytics = async () => {
    if (!googleAccessToken) return;
    setDeepLoading(true);
    try {
      const days = Number(analyticsPeriod);
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/youtube/analytics-deep?startDate=${startDate}&endDate=${endDate}`, {
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
      const res = await fetch("/api/youtube/playlists", {
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

  /* ─── Premium Tools Grid ─── */
  const tools = [
    { id: "analytics", icon: "📈", label: "Deep Analytics", desc: "Watch time, retention, traffic sources, demographics", color: "#3b82f6" },
    { id: "competitors", icon: "🏆", label: "Competitor Tracker", desc: "Benchmark against any channel", color: "#f59e0b" },
    { id: "viral", icon: "🔥", label: "Viral Predictor", desc: "AI scores your video's viral potential", color: "#ef4444" },
    { id: "comments", icon: "💬", label: "Comment Manager", desc: "Read, reply, and manage comments", color: "#10b981" },
    { id: "playlists", icon: "📋", label: "Playlist Manager", desc: "Create and manage playlists", color: "#8b5cf6" },
    { id: "repurpose", icon: "♻️", label: "Content Repurposer", desc: "Transform content across platforms", color: "#06b6d4" },
  ];

  if (activePanel) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => setActivePanel(null)} style={{ ...btnSecondary, alignSelf: "flex-start" }}>← Back to Pro Tools</button>

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
                  <div key={p.id} style={{ ...card, padding: "12px" }}>
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
