"use client";
import { useState, useEffect, useCallback } from "react";
import { card, btnPrimary, btnSecondary, inputStyle } from "./FactoryStyles";
import { useFactoryApi } from "./useFactoryApi";

const STATE_LABELS = {
  NICHE_SELECTED: { icon: "🧭", label: "Queued" },
  SCRIPT_GENERATED: { icon: "📝", label: "Script Done" },
  ASSETS_GENERATING: { icon: "🎨", label: "Generating" },
  ASSETS_READY: { icon: "✅", label: "Assets Ready" },
  COMPOSITING: { icon: "🎬", label: "Composing" },
  COMPOSED: { icon: "📦", label: "Ready" },
  REVIEW: { icon: "👁️", label: "Review" },
  PUBLISHING: { icon: "📤", label: "Uploading" },
  PUBLISHED: { icon: "🎉", label: "Live" },
  COMPLETE: { icon: "✨", label: "Complete" },
};

const STATE_ORDER = ["NICHE_SELECTED", "SCRIPT_GENERATED", "ASSETS_GENERATING", "ASSETS_READY", "COMPOSITING", "COMPOSED", "REVIEW", "PUBLISHED", "COMPLETE"];

export default function ProductionTab({ channels }) {
  const { api } = useFactoryApi();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePipeId, setActivePipeId] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [autoResults, setAutoResults] = useState(null);

  // Quick Produce state
  const [showQuickProduce, setShowQuickProduce] = useState(false);
  const [quickTopic, setQuickTopic] = useState("");
  const [quickNiche, setQuickNiche] = useState("");

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    const data = await api("pipeline", { action: "list", limit: 20 });
    setPipelines(data.pipelines || []);
    setLoading(false);
  }, [api]);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);

  /* ── Pipeline state helper ── */
  const getNextAction = (state) => {
    const map = {
      NICHE_SELECTED: "generate_script",
      SCRIPT_GENERATED: "generate_voice",
      ASSETS_GENERATING: "generate_visuals",
      ASSETS_READY: "compose",
    };
    return map[state] || null;
  };

  /* ── Direct execution (no orchestrator middleman) ── */
  const executePipeline = async (pid) => {
    setActivePipeId(pid);
    setAutoRunning(true);
    setAutoResults(null);
    setStepLabel("Checking pipeline...");
    const allResults = {};

    try {
      for (let i = 0; i < 30; i++) {
        const status = await api("pipeline", { action: "status", pipelineId: pid });
        if (status.error) { setAutoResults({ error: status.error }); break; }

        const nextAction = getNextAction(status.state);
        if (!nextAction || status.state === "COMPLETE" || status.state === "COMPOSED") {
          setAutoResults({ completed: true, state: status.state, totalCost: status.totalCost || 0, results: allResults });
          break;
        }

        setAutoResults({ state: status.state, progress: status.progress, totalCost: status.totalCost, results: { ...allResults }, completed: false });

        switch (nextAction) {
          case "generate_script": {
            setStepLabel("✍️ Writing script (~60s)...");
            const r = await api("generate", {
              action: "script", topic: status.topic, niche: status.niche,
              tone: status.tone, duration: status.targetDuration,
              channelName: status.channelName, pipelineId: pid,
            });
            if (r.error) { setAutoResults({ error: `Script: ${r.error}` }); setAutoRunning(false); return; }
            await api("pipeline", { action: "advance", pipelineId: pid, assetUpdates: { script: r.script }, costUpdate: { type: "script", amount: r.cost || 0 } });
            allResults.script = { cost: r.cost || 0 };
            setStepLabel("✅ Script done");
            continue;
          }
          case "generate_voice": {
            const script = status.assets?.script;
            if (!script?.scenes) { setAutoResults({ error: "No script" }); setAutoRunning(false); return; }

            setStepLabel("🎙️ Generating voice...");
            const narration = script.scenes.map(s => s.narration).join("\n\n");
            const tts = await api("generate", { action: "tts", text: narration, pipelineId: pid });
            if (tts.error) { setAutoResults({ error: `TTS: ${tts.error}` }); setAutoRunning(false); return; }

            setStepLabel("📝 Subtitles...");
            let srt = null;
            try { const sr = await api("generate", { action: "subtitles", scenes: script.scenes, pipelineId: pid }); srt = sr.srt || null; } catch {}

            setStepLabel("🎵 Music...");
            let musicUrl = null, musicCost = 0;
            try {
              const mr = await api("generate", { action: "music", pipelineId: pid, prompt: script.musicPlan?.prompt || `Background music for ${status.niche || "general"} video.` });
              musicUrl = mr.audioUrl || null; musicCost = mr.cost || 0;
            } catch {}

            const totalCost = (tts.cost || 0) + musicCost;
            await api("pipeline", { action: "advance", pipelineId: pid, assetUpdates: { voiceUrl: tts.audioUrl, subtitlesSrt: srt, musicUrl }, costUpdate: { type: "audio", amount: totalCost } });
            allResults.audio = { cost: totalCost };
            setStepLabel("✅ Audio done");
            continue;
          }
          case "generate_visuals": {
            const script = status.assets?.script;
            if (!script?.scenes) { setAutoResults({ error: "No script" }); setAutoRunning(false); return; }

            const imgs = status.assets?.sceneImages || [];
            if (imgs.length < script.scenes.length) {
              const scene = script.scenes[imgs.length];
              setStepLabel(`🎨 Image ${imgs.length + 1}/${script.scenes.length}...`);
              const ir = await api("generate", { action: "image", pipelineId: pid, prompt: scene.imagePrompt || scene.visualDescription || `Scene for ${status.topic}` });
              if (ir.imageUrl) {
                imgs.push(ir.imageUrl);
                await api("pipeline", { action: "update-assets", pipelineId: pid, assetUpdates: { sceneImages: imgs }, costUpdate: { type: "visuals", amount: ir.cost || 0 } });
              }
              allResults.visuals = { images: imgs.length, total: script.scenes.length };
              if (imgs.length < script.scenes.length) continue;
            }

            setStepLabel("🖼️ Thumbnail...");
            const th = await api("generate", { action: "thumbnail", pipelineId: pid, prompt: script.thumbnailPlan?.prompt || `${status.topic} thumbnail` });
            await api("pipeline", { action: "advance", pipelineId: pid, assetUpdates: { sceneImages: imgs, thumbnailUrl: th.imageUrl }, costUpdate: { type: "visuals", amount: th.cost || 0 } });
            allResults.visuals = { images: imgs.length, thumbnail: !!th.imageUrl };
            setStepLabel("✅ Visuals done");
            continue;
          }
          case "compose": {
            setStepLabel("🎬 Composing...");
            const cr = await api("compose", { action: "trigger", pipelineId: pid });
            allResults.compose = cr;
            setAutoResults({ completed: !cr.error, state: "COMPOSITING", results: allResults, ...(cr.error && { error: cr.message || cr.error }) });
            break;
          }
          default:
            setAutoResults({ error: `Unknown state: ${status.state}` });
            break;
        }
        break;
      }
    } catch (err) {
      setAutoResults({ error: err.message });
    }
    setAutoRunning(false);
    setStepLabel("");
    await loadPipelines();
  };

  /* ── Quick Produce ── */
  const quickProduce = async () => {
    if (!quickTopic.trim()) return;
    const data = await api("pipeline", {
      action: "create", topic: quickTopic, niche: quickNiche,
      videoTier: "standard", channelId: channels?.[0]?.id || "", channelName: channels?.[0]?.snippet?.title || "",
      reviewRequired: true,
    });
    if (data.pipelineId) {
      setShowQuickProduce(false);
      setQuickTopic("");
      await loadPipelines();
      executePipeline(data.pipelineId);
    }
  };

  const stateIdx = (s) => STATE_ORDER.indexOf(s);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ fontSize: "14px", fontWeight: "700" }}>🏭 Production Pipeline</h4>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => setShowQuickProduce(!showQuickProduce)} style={btnSecondary}>+ Quick Produce</button>
          <button onClick={loadPipelines} disabled={loading} style={btnSecondary}>
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      {/* Quick Produce form */}
      {showQuickProduce && (
        <div style={{ ...card, borderTop: "3px solid #8b5cf6" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input value={quickTopic} onChange={e => setQuickTopic(e.target.value)} placeholder="Video topic..." style={{ ...inputStyle, flex: 2 }} />
            <input value={quickNiche} onChange={e => setQuickNiche(e.target.value)} placeholder="Niche..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={quickProduce} style={btnPrimary}>Create</button>
          </div>
        </div>
      )}

      {/* Active production progress */}
      {autoRunning && (
        <div style={{ ...card, borderTop: "3px solid #f59e0b", textAlign: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>{stepLabel}</div>
          {autoResults && (
            <>
              <div style={{ height: "4px", borderRadius: "2px", background: "var(--bg-tertiary)", overflow: "hidden", margin: "8px 0" }}>
                <div style={{ height: "100%", borderRadius: "2px", background: "linear-gradient(90deg, #8b5cf6, #3b82f6)", width: `${autoResults.progress || 10}%`, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                State: {autoResults.state} · Cost: ${(autoResults.totalCost || 0).toFixed(2)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Error display */}
      {autoResults?.error && !autoRunning && (
        <div style={{ ...card, borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: "11px", color: "#ef4444" }}>⚠️ {autoResults.error}</div>
          {activePipeId && (
            <button onClick={() => executePipeline(activePipeId)} style={{ ...btnPrimary, marginTop: "8px", fontSize: "10px" }}>
              ▶ Resume Pipeline
            </button>
          )}
        </div>
      )}

      {/* Pipeline list */}
      {pipelines.length === 0 && !loading && (
        <div style={{ ...card, textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>📭</div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            No videos in production. Use the Strategy tab to set up automation, or Quick Produce a one-off video.
          </div>
        </div>
      )}

      {pipelines.map(p => (
        <div key={p.pipelineId} style={{ ...card, display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: "700" }}>{p.topic || "Untitled"}</div>
            <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>
              {p.niche} · {p.videoTier || "standard"} · ${(p.totalCost || 0).toFixed(2)}
            </div>
            {/* Mini state bar */}
            <div style={{ display: "flex", gap: "2px", marginTop: "6px" }}>
              {STATE_ORDER.slice(0, 6).map((s, i) => (
                <div key={s} style={{
                  flex: 1, height: "3px", borderRadius: "2px",
                  background: stateIdx(p.state) >= i ? "#8b5cf6" : "var(--bg-tertiary)",
                }} />
              ))}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14px" }}>{STATE_LABELS[p.state]?.icon || "❓"}</div>
            <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{STATE_LABELS[p.state]?.label || p.state}</div>
          </div>
          {getNextAction(p.state) && (
            <button onClick={() => executePipeline(p.pipelineId)} disabled={autoRunning}
              style={{ ...btnPrimary, padding: "6px 10px", fontSize: "10px" }}>▶</button>
          )}
        </div>
      ))}
    </div>
  );
}
