"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import YouTubeAdvancedTab from "./YouTubeAdvancedTab";

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
  { id: "publish", label: "Upload & Publish", icon: "🚀" },
  { id: "pro", label: "Pro Tools", icon: "⚡" },
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
  const [nicheLoading, setNicheLoading] = useState(false);
  const [analyticsSubTab, setAnalyticsSubTab] = useState("overview");
  const [newPipelineTitle, setNewPipelineTitle] = useState("");
  // Creation tools state
  const [activeTool, setActiveTool] = useState(null);
  const [scriptForm, setScriptForm] = useState({ topic: "", type: "longform", length: "10min", style: "educational" });
  const [scriptResult, setScriptResult] = useState(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [seoForm, setSeoForm] = useState({ title: "", niche: "" });
  const [seoResult, setSeoResult] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", channelId: "", type: "longform" });
  // Phase 7 state
  const [thumbForm, setThumbForm] = useState({ title: "", niche: "", style: "modern" });
  const [thumbResult, setThumbResult] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [suggestNiche, setSuggestNiche] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [learningData, setLearningData] = useState({ templateScores: {}, topFormats: [], insights: [] });
  // Phase 8 state — upload, sync, thumbnail gen, pipeline
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", tags: "", privacyStatus: "private", categoryId: "22", scheduledAt: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [calSyncLoading, setCalSyncLoading] = useState(false);
  const [calSyncResult, setCalSyncResult] = useState(null);
  const [thumbGenPrompt, setThumbGenPrompt] = useState("");
  const [thumbGenImages, setThumbGenImages] = useState(null);
  const [thumbGenLoading, setThumbGenLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState("");

  /* ─── Firestore Load ─── */
  useEffect(() => {
    if (!user) return;
    loadChannels();
    loadPipeline();
    loadTemplates();
    loadCalendar();
    loadNicheCache();
    loadLearningData();
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

  const loadCalendar = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "calendar");
      const snap = await getDoc(ref);
      if (snap.exists()) setCalendarEvents(snap.data().events || []);
    } catch (e) { console.error("Load calendar:", e); }
  };

  const saveCalendar = async (events) => {
    setCalendarEvents(events);
    try {
      const ref = doc(db, "users", user.uid, "youtube", "calendar");
      await setDoc(ref, { events, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save calendar:", e); }
  };

  const loadNicheCache = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "niche_cache");
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().results) {
        const cached = snap.data();
        // Only use cache if less than 24 hours old
        if (cached.cachedAt && (Date.now() - new Date(cached.cachedAt).getTime()) < 86400000) {
          setNicheResults(cached.results);
          setNicheQuery(cached.query || "");
        }
      }
    } catch (e) { console.error("Load niche cache:", e); }
  };

  const saveNicheCache = async (query, results) => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "niche_cache");
      await setDoc(ref, { query, results, cachedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save niche cache:", e); }
  };

  /* ─── API Calls ─── */
  const runNicheScan = async () => {
    if (!nicheQuery.trim() || !googleAccessToken) return;
    setNicheLoading(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(nicheQuery.trim())}&maxResults=20`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setNicheResults(data);
      saveNicheCache(nicheQuery.trim(), data);
    } catch (e) {
      console.error("Niche scan failed:", e);
      setNicheResults({ error: e.message });
    }
    setNicheLoading(false);
  };

  const generateScript = async () => {
    if (!scriptForm.topic.trim()) return;
    setScriptLoading(true);
    try {
      const res = await fetch("/api/youtube/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scriptForm),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setScriptResult(data);
    } catch (e) {
      console.error("Script gen failed:", e);
      setScriptResult({ error: e.message });
    }
    setScriptLoading(false);
  };

  const optimizeSeo = async () => {
    if (!seoForm.title.trim()) return;
    setSeoLoading(true);
    try {
      const res = await fetch("/api/youtube/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seoForm),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setSeoResult(data);
    } catch (e) {
      console.error("SEO opt failed:", e);
      setSeoResult({ error: e.message });
    }
    setSeoLoading(false);
  };

  const addCalendarEvent = () => {
    if (!eventForm.title.trim() || !eventForm.date) return;
    const event = {
      id: `ev_${Date.now()}`,
      ...eventForm,
      createdAt: new Date().toISOString(),
    };
    saveCalendar([...calendarEvents, event]);
    setEventForm({ title: "", date: "", channelId: "", type: "longform" });
    setShowEventModal(false);
  };

  const removeCalendarEvent = (id) => {
    saveCalendar(calendarEvents.filter(e => e.id !== id));
  };

  /* ─── Phase 7: Thumbnail Studio ─── */
  const analyzeThumbnail = async () => {
    if (!thumbForm.title.trim()) return;
    setThumbLoading(true);
    try {
      const res = await fetch("/api/youtube/thumbnail-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thumbForm),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setThumbResult(await res.json());
    } catch (e) {
      console.error("Thumbnail analysis failed:", e);
      setThumbResult({ error: e.message });
    }
    setThumbLoading(false);
  };

  /* ─── Phase 7: Auto-Suggest ─── */
  const fetchSuggestions = async () => {
    if (!suggestNiche.trim()) return;
    setSuggestLoading(true);
    try {
      const performanceData = channels.flatMap(c =>
        (c.recentVideos || []).slice(0, 5).map(v => ({
          title: v.title, views: v.viewCount, likes: v.likeCount,
          engagement: v.viewCount > 0 ? ((v.likeCount / v.viewCount) * 100).toFixed(1) : 0,
        }))
      );
      const recentTopics = pipelineItems.map(p => p.title);
      const res = await fetch("/api/youtube/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: suggestNiche.trim(),
          channelName: channels[0]?.name || "",
          recentTopics,
          performanceData,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setSuggestions(await res.json());
    } catch (e) {
      console.error("Suggestions failed:", e);
      setSuggestions({ error: e.message });
    }
    setSuggestLoading(false);
  };

  /* ─── Phase 7: Self-Learning Engine ─── */
  const loadLearningData = async () => {
    try {
      const ref = doc(db, "users", user.uid, "youtube", "learning");
      const snap = await getDoc(ref);
      if (snap.exists()) setLearningData(snap.data());
    } catch (e) { console.error("Load learning:", e); }
  };

  const saveLearningData = async (data) => {
    setLearningData(data);
    try {
      const ref = doc(db, "users", user.uid, "youtube", "learning");
      await setDoc(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error("Save learning:", e); }
  };

  const recordTemplateUsage = (templateId) => {
    const updated = templates.map(t => t.id === templateId ? { ...t, usageCount: (t.usageCount || 0) + 1, lastUsed: new Date().toISOString() } : t);
    saveTemplates(updated);
  };

  const recordVideoPerformance = (templateId, metrics) => {
    const scores = { ...learningData.templateScores };
    if (!scores[templateId]) scores[templateId] = { totalVideos: 0, totalViews: 0, totalLikes: 0, avgRetention: 0 };
    const s = scores[templateId];
    s.totalVideos += 1;
    s.totalViews += metrics.views || 0;
    s.totalLikes += metrics.likes || 0;
    s.avgRetention = ((s.avgRetention * (s.totalVideos - 1)) + (metrics.retention || 0)) / s.totalVideos;

    // Compute top formats
    const formatScores = {};
    templates.forEach(t => {
      const sc = scores[t.id];
      if (sc && sc.totalVideos > 0) {
        formatScores[t.type] = formatScores[t.type] || { views: 0, videos: 0 };
        formatScores[t.type].views += sc.totalViews;
        formatScores[t.type].videos += sc.totalVideos;
      }
    });
    const topFormats = Object.entries(formatScores)
      .map(([type, d]) => ({ type, avgViews: Math.round(d.views / d.videos), videos: d.videos }))
      .sort((a, b) => b.avgViews - a.avgViews);

    // Generate insights
    const insights = [];
    if (topFormats.length > 0) insights.push(`${topFormats[0].type} videos perform best with ${fmtNumber(topFormats[0].avgViews)} avg views`);
    const bestTemplate = Object.entries(scores).sort(([, a], [, b]) => (b.totalViews / b.totalVideos) - (a.totalViews / a.totalVideos))[0];
    if (bestTemplate) {
      const tpl = templates.find(t => t.id === bestTemplate[0]);
      if (tpl) insights.push(`"${tpl.name}" template avg ${fmtNumber(Math.round(bestTemplate[1].totalViews / bestTemplate[1].totalVideos))} views/video`);
    }

    saveLearningData({ ...learningData, templateScores: scores, topFormats, insights });
  };

  /* ─── Phase 8: YouTube Upload ─── */
  const uploadVideo = async () => {
    if (!uploadFile || !uploadForm.title.trim() || !googleAccessToken) return;
    setUploadLoading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadForm.title.trim());
      fd.append("description", uploadForm.description);
      fd.append("tags", uploadForm.tags);
      fd.append("privacyStatus", uploadForm.privacyStatus);
      fd.append("categoryId", uploadForm.categoryId);
      if (uploadForm.scheduledAt) fd.append("scheduledAt", uploadForm.scheduledAt);

      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`);
      setUploadResult(data);
    } catch (e) {
      console.error("Upload failed:", e);
      setUploadResult({ error: e.message });
    }
    setUploadLoading(false);
  };

  /* ─── Phase 8: Google Calendar Sync ─── */
  const syncToGoogleCalendar = async () => {
    if (!googleAccessToken || calendarEvents.length === 0) return;
    setCalSyncLoading(true);
    setCalSyncResult(null);
    try {
      const eventsToSync = calendarEvents.filter(e => new Date(e.date) >= new Date()).map(e => ({
        title: e.title,
        date: e.date,
        type: e.type,
        channelName: channels.find(c => c.id === e.channelId)?.name || "",
      }));

      if (eventsToSync.length === 0) {
        setCalSyncResult({ error: "No upcoming events to sync" });
        setCalSyncLoading(false);
        return;
      }

      const res = await fetch("/api/youtube/calendar-sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: eventsToSync }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Sync failed: ${res.status}`);
      setCalSyncResult(data);
    } catch (e) {
      console.error("Calendar sync failed:", e);
      setCalSyncResult({ error: e.message });
    }
    setCalSyncLoading(false);
  };

  /* ─── Phase 8: Thumbnail Generation ─── */
  const generateThumbnailImage = async () => {
    if (!thumbGenPrompt.trim()) return;
    setThumbGenLoading(true);
    setThumbGenImages(null);
    try {
      const res = await fetch("/api/youtube/thumbnail-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: thumbGenPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Generation failed: ${res.status}`);
      setThumbGenImages(data);
    } catch (e) {
      console.error("Thumbnail gen failed:", e);
      setThumbGenImages({ error: e.message });
    }
    setThumbGenLoading(false);
  };

  /* ─── Phase 8: Automated Pipeline ─── */
  const runAutoPipeline = async (topic, channelId) => {
    if (!topic.trim()) return;
    setPipelineRunning(true);

    try {
      // Step 1: Generate script
      setPipelineStep("Generating script...");
      const scriptRes = await fetch("/api/youtube/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type: "longform", length: "10min", style: "educational" }),
      });
      const scriptData = await scriptRes.json();

      // Step 2: Optimize SEO
      setPipelineStep("Optimizing SEO...");
      const seoRes = await fetch("/api/youtube/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: topic }),
      });
      const seoData = await seoRes.json();

      // Step 3: Generate thumbnail concept
      setPipelineStep("Designing thumbnail...");
      const thumbRes = await fetch("/api/youtube/thumbnail-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: seoData.titles?.[0]?.text || topic }),
      });
      const thumbData = await thumbRes.json();

      // Step 4: Add to pipeline
      setPipelineStep("Adding to pipeline...");
      const pipelineItem = {
        id: `pi_${Date.now()}`,
        title: seoData.titles?.[0]?.text || topic,
        stage: "scripting",
        channelId: channelId || null,
        createdAt: new Date().toISOString(),
        generatedScript: scriptData.script,
        seoData: { titles: seoData.titles, tags: seoData.tags, description: seoData.description },
        thumbnailConcept: thumbData.concepts?.[0] || null,
      };
      const updated = [...pipelineItems, pipelineItem];
      setPipelineItems(updated);
      try {
        const ref = doc(db, "users", user.uid, "youtube", "pipeline");
        await setDoc(ref, { items: updated, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (e) { console.error("Save pipeline:", e); }

      setPipelineStep("✅ Pipeline complete!");
      setTimeout(() => setPipelineStep(""), 3000);
    } catch (e) {
      console.error("Pipeline failed:", e);
      setPipelineStep(`❌ Failed: ${e.message}`);
      setTimeout(() => setPipelineStep(""), 5000);
    }

    setPipelineRunning(false);
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
            Search YouTube to discover high-return niches. Results are cached for 24 hours to save API quota (100 units/scan).
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <input
              value={nicheQuery}
              onChange={e => setNicheQuery(e.target.value)}
              placeholder="Enter niche keyword (e.g. 'AI automation', 'crypto trading')..."
              style={inputStyle}
              onKeyDown={e => { if (e.key === "Enter") runNicheScan(); }}
            />
            <button style={btnPrimary} onClick={runNicheScan} disabled={nicheLoading || !nicheQuery.trim()}>
              {nicheLoading ? "⏳ Scanning..." : "🔍 Scan"}
            </button>
          </div>

          {nicheResults && !nicheResults.error && nicheResults.summary && (
            <>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
                {[
                  { label: "Videos Found", value: String(nicheResults.summary.videosAnalyzed || 0), color: "#3b82f6" },
                  { label: "Avg Views", value: fmtNumber(nicheResults.summary.avgViews), color: "#8b5cf6" },
                  { label: "Avg Likes", value: fmtNumber(nicheResults.summary.avgLikes), color: "#10b981" },
                  { label: "Engagement", value: `${nicheResults.summary.avgEngagement}%`, color: "#f59e0b" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "10px", borderRadius: "10px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", borderTop: `2px solid ${s.color}` }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Video results */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
                {(nicheResults.results || []).map((v, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: "10px",
                    background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    border: "1px solid var(--border, rgba(255,255,255,0.04))",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "500", fontSize: "12px" }}>{v.title}</div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
                        <span>📺 {v.channelTitle}</span>
                        <span>👁️ {fmtNumber(v.viewCount)}</span>
                        <span>👍 {fmtNumber(v.likeCount)}</span>
                        <span>💬 {fmtNumber(v.commentCount)}</span>
                      </div>
                    </div>
                    <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#60a5fa", textDecoration: "none", fontSize: "11px", whiteSpace: "nowrap", marginLeft: "12px" }}>
                      Watch →
                    </a>
                  </div>
                ))}
              </div>
              {nicheResults.cachedAt && (
                <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.3))", marginTop: "8px", textAlign: "right" }}>
                  Cached {fmtDate(nicheResults.cachedAt)}
                </div>
              )}
            </>
          )}

          {nicheResults?.error && (
            <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
              ❌ {nicheResults.error}
            </div>
          )}

          {!nicheResults && !nicheLoading && (
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
  const renderCreationTab = () => {
    // If a tool is active, show its full view
    if (activeTool === "script") return renderScriptGenerator();
    if (activeTool === "seo") return renderSeoOptimizer();
    if (activeTool === "calendar") return renderContentCalendar();
    if (activeTool === "thumbnail") return renderThumbnailStudio();
    if (activeTool === "suggest") return renderAutoSuggest();
    if (activeTool === "learning") return renderLearningInsights();

    return (
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

      {/* Quick Tools Grid — now clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        {[
          { icon: "📝", label: "Script Generator", desc: "AI-powered video scripts with hooks, sections, CTAs", color: "#8b5cf6", action: () => setActiveTool("script") },
          { icon: "🏷️", label: "Title & SEO", desc: "Optimize titles, tags, and descriptions", color: "#06b6d4", action: () => setActiveTool("seo") },
          { icon: "📅", label: "Content Calendar", desc: "Schedule across all channels", color: "#10b981", action: () => setActiveTool("calendar") },
          { icon: "🖼️", label: "Thumbnail Studio", desc: "AI thumbnail concepts and A/B plans", color: "#3b82f6", action: () => setActiveTool("thumbnail") },
          { icon: "🤖", label: "Auto-Suggest", desc: "AI topic recommendations from trends", color: "#ef4444", action: () => setActiveTool("suggest") },
          { icon: "🧠", label: "Learning Insights", desc: "Performance data and format analysis", color: "#f59e0b", action: () => setActiveTool("learning") },
        ].map((tool, i) => (
          <div key={i} style={{
            ...cardHover, padding: "20px", textAlign: "center",
            borderTop: `3px solid ${tool.color}`,
          }}
            onClick={tool.action}
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
  };

  /* ─── Script Generator Full View ─── */
  const renderScriptGenerator = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 12px" }}>← Back to Tools</button>

      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>📝 Script Generator</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Topic *</label>
            <input value={scriptForm.topic} onChange={e => setScriptForm(p => ({ ...p, topic: e.target.value }))}
              placeholder="e.g. How to build AI agents with Claude" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Video Type</label>
            <select value={scriptForm.type} onChange={e => setScriptForm(p => ({ ...p, type: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }}>
              {VIDEO_TYPES.map(vt => <option key={vt.id} value={vt.id}>{vt.icon} {vt.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Target Length</label>
            <select value={scriptForm.length} onChange={e => setScriptForm(p => ({ ...p, length: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }}>
              {["30sec", "1min", "3min", "5min", "10min", "15min", "20min", "30min"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Style</label>
            <select value={scriptForm.style} onChange={e => setScriptForm(p => ({ ...p, style: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }}>
              {["educational", "entertainment", "storytelling", "tutorial", "review", "commentary", "vlog"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <button style={btnPrimary} onClick={generateScript} disabled={scriptLoading || !scriptForm.topic.trim()}>
          {scriptLoading ? "⏳ Generating Script..." : "✨ Generate Script"}
        </button>
      </div>

      {scriptResult && !scriptResult.error && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "600" }}>📜 Generated Script</h3>
            <span style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
              Model: {scriptResult.model} · {fmtDate(scriptResult.generatedAt)}
            </span>
          </div>
          <pre style={{
            whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: "1.6",
            color: "var(--text-secondary, rgba(255,255,255,0.8))",
            background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
            padding: "16px", borderRadius: "10px", maxHeight: "500px", overflowY: "auto",
            border: "1px solid var(--border, rgba(255,255,255,0.04))",
          }}>
            {scriptResult.script}
          </pre>
        </div>
      )}

      {scriptResult?.error && (
        <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
          ❌ {scriptResult.error}
        </div>
      )}
    </div>
  );

  /* ─── SEO Optimizer Full View ─── */
  const renderSeoOptimizer = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 12px" }}>← Back to Tools</button>

      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>🏷️ Title & SEO Optimizer</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Working Title *</label>
            <input value={seoForm.title} onChange={e => setSeoForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. How I Made $10K with AI Automation" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Niche</label>
            <input value={seoForm.niche} onChange={e => setSeoForm(p => ({ ...p, niche: e.target.value }))}
              placeholder="e.g. AI, tech, automation" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
        </div>

        <button style={btnPrimary} onClick={optimizeSeo} disabled={seoLoading || !seoForm.title.trim()}>
          {seoLoading ? "⏳ Optimizing..." : "✨ Optimize"}
        </button>
      </div>

      {seoResult && !seoResult.error && (
        <>
          {/* Title suggestions */}
          {seoResult.titles && (
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>📋 Title Suggestions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {seoResult.titles.map((t, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: "10px",
                    background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    border: "1px solid var(--border, rgba(255,255,255,0.04))",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "500", fontSize: "13px" }}>{t.text}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>{t.reason}</div>
                    </div>
                    <span style={{
                      padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600",
                      background: t.score >= 90 ? "rgba(16,185,129,0.15)" : t.score >= 80 ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
                      color: t.score >= 90 ? "#10b981" : t.score >= 80 ? "#3b82f6" : "#f59e0b",
                    }}>{t.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {seoResult.tags && (
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>🏷️ Recommended Tags</h3>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {seoResult.tags.map((tag, i) => (
                  <span key={i} style={{
                    padding: "4px 12px", borderRadius: "20px", fontSize: "12px",
                    background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Analysis */}
          {seoResult.analysis && (
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>📊 SEO Analysis</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                {[
                  { label: "Search Volume", value: seoResult.analysis.searchVolume, color: "#3b82f6" },
                  { label: "Competition", value: seoResult.analysis.competition, color: "#f59e0b" },
                  { label: "Opportunity", value: `${seoResult.analysis.opportunity}/100`, color: "#10b981" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "12px", borderRadius: "10px", background: "var(--bg-tertiary, rgba(255,255,255,0.02))", borderTop: `2px solid ${s.color}` }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: s.color, textTransform: "capitalize" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {seoResult.analysis.tips && (
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary, rgba(255,255,255,0.7))" }}>
                  {seoResult.analysis.tips.map((tip, i) => <li key={i} style={{ marginBottom: "4px" }}>{tip}</li>)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {seoResult?.error && (
        <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
          ❌ {seoResult.error}
        </div>
      )}
    </div>
  );

  /* ─── Content Calendar Full View ─── */
  const renderContentCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthName = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const getEventsForDay = (day) => {
      if (!day) return [];
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return calendarEvents.filter(e => e.date === dateStr);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, padding: "6px 12px" }}>← Back to Tools</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button style={btnSecondary} onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}>◀</button>
            <span style={{ fontSize: "16px", fontWeight: "600", minWidth: "160px", textAlign: "center" }}>{monthName}</span>
            <button style={btnSecondary} onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}>▶</button>
          </div>
          <button style={btnPrimary} onClick={() => setShowEventModal(true)}>+ Schedule Upload</button>
        </div>

        {/* Calendar grid */}
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} style={{ textAlign: "center", padding: "8px", fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>{d}</div>
            ))}
            {days.map((day, i) => {
              const events = getEventsForDay(day);
              const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
              return (
                <div key={i} style={{
                  minHeight: "70px", padding: "4px", borderRadius: "8px",
                  background: isToday ? "rgba(239,68,68,0.08)" : day ? "var(--bg-tertiary, rgba(255,255,255,0.02))" : "transparent",
                  border: isToday ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border, rgba(255,255,255,0.03))",
                }}>
                  {day && (
                    <>
                      <div style={{ fontSize: "11px", fontWeight: isToday ? "700" : "400", color: isToday ? "#f87171" : "var(--text-secondary)", padding: "2px 4px" }}>{day}</div>
                      {events.map(ev => (
                        <div key={ev.id} style={{
                          fontSize: "9px", padding: "2px 4px", borderRadius: "4px", marginTop: "1px",
                          background: "rgba(139,92,246,0.15)", color: "#a78bfa",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "pointer",
                        }} title={ev.title} onClick={() => removeCalendarEvent(ev.id)}>
                          {VIDEO_TYPES.find(vt => vt.id === ev.type)?.icon || "🎬"} {ev.title}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming uploads */}
        <div style={card}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>📋 Upcoming Uploads</h3>
          {calendarEvents.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "13px" }}>
              No upcoming uploads scheduled
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {calendarEvents.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).map(ev => (
                <div key={ev.id} style={{
                  padding: "8px 12px", borderRadius: "8px",
                  background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                  border: "1px solid var(--border, rgba(255,255,255,0.04))",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{VIDEO_TYPES.find(vt => vt.id === ev.type)?.icon || "🎬"}</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "500" }}>{ev.title}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
                        {fmtDate(ev.date)} · {channels.find(c => c.id === ev.channelId)?.name || "No channel"}
                      </div>
                    </div>
                  </div>
                  <button style={{ ...btnSecondary, padding: "4px 8px", fontSize: "10px", color: "#ef4444" }} onClick={() => removeCalendarEvent(ev.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ─── Thumbnail Studio Full View ─── */
  const renderThumbnailStudio = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 12px" }}>← Back to Tools</button>

      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>🖼️ Thumbnail Studio</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          Get AI-generated thumbnail concepts with composition, color palettes, and A/B test plans.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Video Title *</label>
            <input value={thumbForm.title} onChange={e => setThumbForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Your video title" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Niche</label>
            <input value={thumbForm.niche} onChange={e => setThumbForm(p => ({ ...p, niche: e.target.value }))}
              placeholder="e.g. tech, fitness" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Style</label>
            <select value={thumbForm.style} onChange={e => setThumbForm(p => ({ ...p, style: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }}>
              {["modern", "minimalist", "bold", "cinematic", "playful", "professional"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <button style={btnPrimary} onClick={analyzeThumbnail} disabled={thumbLoading || !thumbForm.title.trim()}>
          {thumbLoading ? "⏳ Analyzing..." : "✨ Generate Concepts"}
        </button>
      </div>

      {thumbResult && !thumbResult.error && (
        <>
          {/* Thumbnail concepts */}
          {thumbResult.concepts && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
              {thumbResult.concepts.map((c, i) => (
                <div key={i} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontWeight: "600", fontSize: "13px" }}>{c.name}</span>
                    <span style={{
                      padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600",
                      background: c.ctrScore >= 80 ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                      color: c.ctrScore >= 80 ? "#10b981" : "#3b82f6",
                    }}>CTR: {c.ctrScore}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary, rgba(255,255,255,0.7))", marginBottom: "8px" }}>{c.layout}</p>
                  <div style={{ fontSize: "11px", marginBottom: "6px" }}>
                    <strong>Text:</strong> <span style={{ color: "#f59e0b" }}>{c.textOverlay}</span>
                  </div>
                  <div style={{ fontSize: "11px", marginBottom: "6px" }}>
                    <strong>Expression:</strong> {c.faceExpression}
                  </div>
                  {c.colorPalette && (
                    <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                      {c.colorPalette.map((color, ci) => (
                        <div key={ci} style={{ width: "24px", height: "24px", borderRadius: "6px", background: color, border: "1px solid rgba(255,255,255,0.1)" }} title={color} />
                      ))}
                    </div>
                  )}
                  {c.elements && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {c.elements.map((el, ei) => (
                        <span key={ei} style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))" }}>{el}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* A/B Test Plan */}
          {thumbResult.abTestPlan && (
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px" }}>🧪 A/B Test Plan</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  <div style={{ fontWeight: "600", color: "#3b82f6", marginBottom: "4px" }}>Variant A</div>
                  {thumbResult.abTestPlan.variantA}
                </div>
                <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <div style={{ fontWeight: "600", color: "#8b5cf6", marginBottom: "4px" }}>Variant B</div>
                  {thumbResult.abTestPlan.variantB}
                </div>
              </div>
              <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.5))" }}>
                📏 Metric: {thumbResult.abTestPlan.metric} · ⏱ Duration: {thumbResult.abTestPlan.duration}
              </div>
            </div>
          )}

          {/* Design Principles */}
          {thumbResult.principles && (
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>✅ Design Principles</h3>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary, rgba(255,255,255,0.7))" }}>
                {thumbResult.principles.map((p, i) => <li key={i} style={{ marginBottom: "4px" }}>{p}</li>)}
              </ul>
              {thumbResult.avoidList && (
                <>
                  <h4 style={{ fontSize: "13px", fontWeight: "600", marginTop: "12px", marginBottom: "6px", color: "#f87171" }}>❌ Avoid</h4>
                  <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))" }}>
                    {thumbResult.avoidList.map((a, i) => <li key={i} style={{ marginBottom: "4px" }}>{a}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}

      {thumbResult?.error && (
        <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
          ❌ {thumbResult.error}
        </div>
      )}
    </div>
  );

  /* ─── Auto-Suggest Full View ─── */
  const renderAutoSuggest = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 12px" }}>← Back to Tools</button>

      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>🤖 Auto-Suggest</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          AI analyzes trends, your channel performance, and pipeline to suggest winning topics. Uses your video data to learn what works.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input value={suggestNiche} onChange={e => setSuggestNiche(e.target.value)}
            placeholder="Enter your niche (e.g. AI tools, personal finance, gaming)..."
            style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter") fetchSuggestions(); }}
          />
          <button style={btnPrimary} onClick={fetchSuggestions} disabled={suggestLoading || !suggestNiche.trim()}>
            {suggestLoading ? "⏳ Thinking..." : "✨ Suggest Topics"}
          </button>
        </div>
      </div>

      {suggestions && !suggestions.error && suggestions.suggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {suggestions.suggestions.map((s, i) => (
            <div key={i} style={{
              ...card, padding: "14px",
              borderLeft: `3px solid ${s.trendScore >= 80 ? "#10b981" : s.trendScore >= 60 ? "#3b82f6" : "#f59e0b"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "6px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>{s.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginTop: "2px" }}>
                    💡 {s.hook}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: "10px", fontSize: "10px",
                    background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
                  }}>{VIDEO_TYPES.find(vt => vt.id === s.type)?.icon || "🎬"} {s.type}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600",
                    background: s.trendScore >= 80 ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                    color: s.trendScore >= 80 ? "#10b981" : "#3b82f6",
                  }}>🔥 {s.trendScore}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginBottom: "6px" }}>
                <span>📊 {s.estimatedViews} views</span>
                <span>⚡ {s.difficulty}</span>
                <span>💬 {s.reason}</span>
              </div>
              {s.keywords && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {s.keywords.map((kw, ki) => (
                    <span key={ki} style={{ padding: "1px 8px", borderRadius: "10px", fontSize: "9px", background: "var(--bg-tertiary, rgba(255,255,255,0.04))" }}>{kw}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {suggestions?.error && (
        <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
          ❌ {suggestions.error}
        </div>
      )}
    </div>
  );

  /* ─── Learning Insights Full View ─── */
  const renderLearningInsights = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button onClick={() => setActiveTool(null)} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 12px" }}>← Back to Tools</button>

      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>🧠 Self-Learning Engine</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          The system tracks template usage, video performance, and format success rates to automatically refine content strategy recommendations.
        </p>

        {/* AI Insights */}
        {learningData.insights && learningData.insights.length > 0 && (
          <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#a78bfa", marginBottom: "6px" }}>💡 AI Insights</div>
            <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary, rgba(255,255,255,0.7))" }}>
              {learningData.insights.map((ins, i) => <li key={i} style={{ marginBottom: "4px" }}>{ins}</li>)}
            </ul>
          </div>
        )}

        {/* Top Formats */}
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px" }}>📊 Format Performance</h4>
          {learningData.topFormats && learningData.topFormats.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
              {learningData.topFormats.map((f, i) => (
                <div key={i} style={{
                  padding: "12px", borderRadius: "10px",
                  background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                  border: "1px solid var(--border, rgba(255,255,255,0.04))",
                  borderLeft: `3px solid ${i === 0 ? "#10b981" : i === 1 ? "#3b82f6" : "#f59e0b"}`,
                }}>
                  <div style={{ fontWeight: "600", fontSize: "13px", textTransform: "capitalize" }}>{VIDEO_TYPES.find(vt => vt.id === f.type)?.icon} {f.type}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginTop: "4px" }}>
                    {fmtNumber(f.avgViews)} avg views · {f.videos} videos
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "12px" }}>
              No performance data yet. As you publish videos using templates and record their metrics, the system will learn which formats work best.
            </div>
          )}
        </div>

        {/* Template Scores */}
        <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px" }}>🎯 Template Scores</h4>
        {templates.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {templates.map(t => {
              const score = learningData.templateScores?.[t.id];
              return (
                <div key={t.id} style={{
                  padding: "10px 14px", borderRadius: "8px",
                  background: "var(--bg-tertiary, rgba(255,255,255,0.02))",
                  border: "1px solid var(--border, rgba(255,255,255,0.04))",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontWeight: "500", fontSize: "12px" }}>{t.name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>
                      {VIDEO_TYPES.find(vt => vt.id === t.type)?.icon} {t.type} · Used {t.usageCount || 0}×
                    </div>
                  </div>
                  {score ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "#10b981" }}>{fmtNumber(Math.round(score.totalViews / score.totalVideos))} avg views</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.4))" }}>{score.totalVideos} videos tracked</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.3))" }}>No data yet</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: "12px" }}>
            Create templates first, then the system will track their performance automatically.
          </div>
        )}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Upload & Publish Tab
     ═══════════════════════════════════════════════════════ */
  const renderPublishTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Automated Pipeline */}
      <div style={{ ...card, borderTop: "3px solid #8b5cf6" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>⚡ Automated Pipeline</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          Enter a topic and the system will auto-generate: script → SEO-optimized title → thumbnail concept → add to pipeline. One click from idea to production.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            id="pipeline-topic"
            placeholder="Enter video topic..."
            style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter" && !pipelineRunning) runAutoPipeline(e.target.value, channels[0]?.id); }}
          />
          <select
            id="pipeline-channel"
            style={{ ...inputStyle, maxWidth: "180px" }}
            defaultValue=""
          >
            <option value="">No channel</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={btnPrimary} disabled={pipelineRunning} onClick={() => {
            const topic = document.getElementById("pipeline-topic")?.value;
            const channelId = document.getElementById("pipeline-channel")?.value;
            if (topic) runAutoPipeline(topic, channelId);
          }}>
            {pipelineRunning ? "⏳ Running..." : "🚀 Run Pipeline"}
          </button>
        </div>
        {pipelineStep && (
          <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "12px", color: "#a78bfa" }}>
            {pipelineStep}
          </div>
        )}
      </div>

      {/* Upload to YouTube */}
      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>📤 Upload to YouTube</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          Upload videos directly to YouTube. Supports scheduled publishing and privacy settings.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Video File *</label>
            <input type="file" accept="video/*" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              style={{ ...inputStyle, marginTop: "4px", padding: "8px" }} />
            {uploadFile && (
              <div style={{ fontSize: "10px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginTop: "4px" }}>
                {uploadFile.name} · {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Title *</label>
            <input value={uploadForm.title} onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Video title" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Privacy</label>
            <select value={uploadForm.privacyStatus} onChange={e => setUploadForm(p => ({ ...p, privacyStatus: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }}>
              <option value="private">🔒 Private</option>
              <option value="unlisted">🔗 Unlisted</option>
              <option value="public">🌍 Public</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Description</label>
            <textarea value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Video description..." rows={3} style={{ ...inputStyle, marginTop: "4px", resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Tags (comma separated)</label>
            <input value={uploadForm.tags} onChange={e => setUploadForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="tag1, tag2, tag3" style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Schedule Publish</label>
            <input type="datetime-local" value={uploadForm.scheduledAt} onChange={e => setUploadForm(p => ({ ...p, scheduledAt: e.target.value }))}
              style={{ ...inputStyle, marginTop: "4px" }} />
          </div>
        </div>

        <button style={btnPrimary} onClick={uploadVideo} disabled={uploadLoading || !uploadFile || !uploadForm.title.trim()}>
          {uploadLoading ? "⏳ Uploading..." : "📤 Upload to YouTube"}
        </button>

        {uploadResult && !uploadResult.error && (
          <div style={{ marginTop: "12px", padding: "14px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ fontWeight: "600", color: "#10b981", marginBottom: "6px" }}>✅ Upload Successful!</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary, rgba(255,255,255,0.7))" }}>
              <div>Title: {uploadResult.title}</div>
              <div>Status: {uploadResult.status}</div>
              {uploadResult.publishAt && <div>Scheduled: {fmtDate(uploadResult.publishAt)}</div>}
              <a href={uploadResult.url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>
                {uploadResult.url} →
              </a>
            </div>
          </div>
        )}

        {uploadResult?.error && (
          <div style={{ marginTop: "12px", padding: "14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
            ❌ {uploadResult.error}
          </div>
        )}
      </div>

      {/* Thumbnail Image Generator */}
      <div style={card}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>🎨 Thumbnail Generator</h3>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginBottom: "16px" }}>
          Generate actual thumbnail images using AI. Describe what you want and the system will create it.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input value={thumbGenPrompt} onChange={e => setThumbGenPrompt(e.target.value)}
            placeholder="Describe your thumbnail (e.g. 'person looking shocked at a laptop with money flying around')..."
            style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter") generateThumbnailImage(); }}
          />
          <button style={btnPrimary} onClick={generateThumbnailImage} disabled={thumbGenLoading || !thumbGenPrompt.trim()}>
            {thumbGenLoading ? "⏳ Generating..." : "🎨 Generate"}
          </button>
        </div>

        {thumbGenImages && !thumbGenImages.error && (
          <div>
            {thumbGenImages.images && thumbGenImages.images.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
                {thumbGenImages.images.map((img, i) => (
                  <div key={i} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                    <img
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={`Thumbnail ${i + 1}`}
                      style={{ width: "100%", display: "block" }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "12px", color: "#f59e0b" }}>
                {thumbGenImages.fallbackMessage || thumbGenImages.description || "No images generated. Try the Thumbnail Studio for concept-based design briefs."}
              </div>
            )}
          </div>
        )}

        {thumbGenImages?.error && (
          <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
            ❌ {thumbGenImages.error}
          </div>
        )}
      </div>

      {/* Calendar Sync */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "600" }}>📱 Sync to Google Calendar</h3>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary, rgba(255,255,255,0.5))", marginTop: "4px" }}>
              Push your upload schedule to Google Calendar so you can see it on your phone. Creates a &quot;YouTube Uploads&quot; calendar with reminders.
            </p>
          </div>
          <button style={btnPrimary} onClick={syncToGoogleCalendar} disabled={calSyncLoading || calendarEvents.length === 0}>
            {calSyncLoading ? "⏳ Syncing..." : `📱 Sync ${calendarEvents.filter(e => new Date(e.date) >= new Date()).length} Events`}
          </button>
        </div>

        {calSyncResult && !calSyncResult.error && (
          <div style={{ marginTop: "12px", padding: "14px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ fontWeight: "600", color: "#10b981", marginBottom: "6px" }}>✅ Synced {calSyncResult.synced}/{calSyncResult.total} events to &quot;{calSyncResult.calendarName}&quot;</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary, rgba(255,255,255,0.5))" }}>Open Google Calendar on your phone to see them.</div>
          </div>
        )}

        {calSyncResult?.error && (
          <div style={{ marginTop: "12px", padding: "14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
            ❌ {calSyncResult.error}
          </div>
        )}
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
      {activeTab === "publish" && renderPublishTab()}
      {activeTab === "pro" && <YouTubeAdvancedTab googleAccessToken={googleAccessToken} channels={channels} />}

      {/* Modals */}
      {showAddModal && renderAddModal()}

      {/* Schedule Event Modal */}
      {showEventModal && (
        <>
          <div onClick={() => setShowEventModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(440px, 90vw)", background: "var(--bg-primary, #0f0f1a)", borderRadius: "20px",
            border: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "28px", zIndex: 1001,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px" }}>📅 Schedule Upload</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Title *</label>
                <input value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Video title" style={{ ...inputStyle, marginTop: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date *</label>
                <input type="date" value={eventForm.date} onChange={e => setEventForm(p => ({ ...p, date: e.target.value }))}
                  style={{ ...inputStyle, marginTop: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel</label>
                <select value={eventForm.channelId} onChange={e => setEventForm(p => ({ ...p, channelId: e.target.value }))}
                  style={{ ...inputStyle, marginTop: "6px" }}>
                  <option value="">— Select channel —</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</label>
                <select value={eventForm.type} onChange={e => setEventForm(p => ({ ...p, type: e.target.value }))}
                  style={{ ...inputStyle, marginTop: "6px" }}>
                  {VIDEO_TYPES.map(vt => <option key={vt.id} value={vt.id}>{vt.icon} {vt.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowEventModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={addCalendarEvent} disabled={!eventForm.title.trim() || !eventForm.date}>Schedule</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
