"use client";
import { useState } from "react";
import { card, btnPrimary, btnSecondary, inputStyle, TIERS, PROVIDERS } from "./FactoryStyles";
import { useFactoryApi } from "./useFactoryApi";

export default function StrategyTab({ channels, onActivate }) {
  const { api } = useFactoryApi();
  const [step, setStep] = useState(1);

  // Step 1: Niche Discovery
  const [nicheQuery, setNicheQuery] = useState("");
  const [nicheResults, setNicheResults] = useState(null);
  const [nicheLoading, setNicheLoading] = useState(false);

  // Step 2: Channel Strategy
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [channelStrategy, setChannelStrategy] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // Step 3: Content Calendar
  const [calendar, setCalendar] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Step 4: Automation Config
  const [config, setConfig] = useState({
    tier: "standard", frequency: "3x/week",
    days: ["monday", "wednesday", "friday"], timeOfDay: "14:00",
    reviewRequired: true,
    providers: { tts: "fal-kokoro", music: "fal-minimax", image: "fal-flux", video: "none" },
  });

  /* ── Step 1 Handlers ── */
  const discoverNiches = async () => {
    if (!nicheQuery.trim()) return;
    setNicheLoading(true);
    const data = await api("orchestrator", {
      action: "niche-discover", category: nicheQuery, count: 6,
    });
    setNicheResults(data.niches || data.raw || []);
    setNicheLoading(false);
  };

  const selectNiche = (niche) => {
    setSelectedNiche(niche);
    setStep(2);
    generateStrategy(niche);
  };

  /* ── Step 2 Handlers ── */
  const generateStrategy = async (niche) => {
    setStrategyLoading(true);
    const data = await api("orchestrator", {
      action: "channel-strategy",
      niche: niche.niche || niche.title || niche,
      competition: niche.competition,
      monetization: niche.monetization,
      linkedChannel: channels?.[0]?.snippet?.title || null,
    });
    if (data.strategy) {
      setChannelStrategy(data.strategy);
    } else if (data.error) {
      setChannelStrategy({ error: data.error });
    } else {
      setChannelStrategy(data);
    }
    setStrategyLoading(false);
  };

  /* ── Step 3 Handlers ── */
  const generateCalendar = async () => {
    setCalendarLoading(true);
    const data = await api("orchestrator", {
      action: "content-calendar",
      niche: selectedNiche?.niche || selectedNiche?.title,
      strategy: channelStrategy,
      days: 30,
      videosPerWeek: parseInt(config.frequency) || 3,
    });
    setCalendar(data.calendar || data.topics || []);
    setCalendarLoading(false);
    setStep(4);
  };

  /* ── Step 4 Handlers ── */
  const activateAutomation = async () => {
    const topicPool = (calendar || []).map(t => t.title || t);
    const schedData = await api("scheduler", {
      action: "create",
      channelId: channels?.[0]?.id || "default",
      channelName: channels?.[0]?.snippet?.title || channelStrategy?.channelName || "",
      niche: selectedNiche?.niche || selectedNiche?.title || "",
      frequency: config.frequency,
      days: config.days,
      timeOfDay: config.timeOfDay,
      videoTier: config.tier,
      reviewRequired: config.reviewRequired,
      topicPool,
      providers: config.providers,
    });
    if (schedData.error) {
      alert(`Activation failed: ${schedData.error}`);
      return;
    }
    // Also create the first pipeline immediately
    if (topicPool.length > 0) {
      await api("pipeline", {
        action: "create",
        topic: topicPool[0],
        niche: selectedNiche?.niche || selectedNiche?.title || "",
        videoTier: config.tier,
        channelName: channels?.[0]?.snippet?.title || "",
        channelId: channels?.[0]?.id || "",
        reviewRequired: config.reviewRequired,
      });
    }
    if (onActivate) onActivate();
    alert("✅ Automation activated! First video queued for production.");
  };

  /* ── Step indicators ── */
  const steps = [
    { n: 1, label: "Discover", icon: "🔍" },
    { n: 2, label: "Strategy", icon: "🧭" },
    { n: 3, label: "Calendar", icon: "📅" },
    { n: 4, label: "Activate", icon: "🚀" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Step bar */}
      <div style={{ display: "flex", gap: "4px" }}>
        {steps.map(s => (
          <button key={s.n} onClick={() => s.n <= step && setStep(s.n)} style={{
            flex: 1, padding: "8px 4px", borderRadius: "8px", cursor: s.n <= step ? "pointer" : "default",
            background: step === s.n ? "rgba(139,92,246,0.15)" : step > s.n ? "rgba(16,185,129,0.08)" : "var(--bg-tertiary)",
            border: step === s.n ? "1px solid #8b5cf6" : "1px solid var(--border, rgba(255,255,255,0.06))",
            color: step >= s.n ? "var(--text-primary)" : "var(--text-tertiary)",
            fontSize: "10px", textAlign: "center",
          }}>
            <div style={{ fontSize: "16px" }}>{step > s.n ? "✅" : s.icon}</div>
            <div style={{ fontWeight: step === s.n ? "700" : "400" }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* ━━ STEP 1: DISCOVER ━━ */}
      {step === 1 && (
        <div style={{ ...card, borderTop: "3px solid #8b5cf6" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>
            🔍 Discover Profitable Niches
          </h4>
          <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
            Enter a broad category. AI will analyze competition, monetization potential, and growth trends.
          </p>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            <input value={nicheQuery} onChange={e => setNicheQuery(e.target.value)}
              placeholder="e.g. philosophy, finance, cooking, tech reviews..."
              onKeyDown={e => e.key === "Enter" && discoverNiches()}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={discoverNiches} disabled={nicheLoading} style={btnPrimary}>
              {nicheLoading ? "Analyzing..." : "Discover"}
            </button>
          </div>

          {nicheResults && Array.isArray(nicheResults) && nicheResults.map((n, i) => (
            <div key={i} onClick={() => selectNiche(n)} style={{
              ...card, marginBottom: "6px", cursor: "pointer",
              border: "1px solid rgba(139,92,246,0.15)",
              transition: "border-color 0.2s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>{n.niche || n.title || n}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    {n.whyProfitable || n.description || ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: "60px" }}>
                  {n.score && <div style={{ fontSize: "14px", fontWeight: "800", color: "#10b981" }}>{n.score}/10</div>}
                  {n.competition && <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{n.competition}</div>}
                </div>
              </div>
            </div>
          ))}

          {nicheResults && !Array.isArray(nicheResults) && (
            <div style={{ ...card, fontSize: "11px", whiteSpace: "pre-wrap" }}>
              {typeof nicheResults === "string" ? nicheResults : JSON.stringify(nicheResults, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* ━━ STEP 2: CHANNEL STRATEGY ━━ */}
      {step === 2 && (
        <div style={{ ...card, borderTop: "3px solid #3b82f6" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>
            🧭 Channel Strategy — {selectedNiche?.niche || selectedNiche?.title || ""}
          </h4>

          {strategyLoading && (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <div style={{ fontSize: "24px", animation: "pulse 2s infinite" }}>🧠</div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                AI is building your channel strategy (~30s)...
              </div>
            </div>
          )}

          {channelStrategy && !strategyLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {channelStrategy.error ? (
                <div style={{ fontSize: "11px", color: "#ef4444" }}>Error: {channelStrategy.error}</div>
              ) : (
                <>
                  <div style={{ ...card, background: "rgba(59,130,246,0.05)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>Channel Name</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "2px" }}>{channelStrategy.channelName || "—"}</div>
                  </div>

                  {channelStrategy.description && (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {channelStrategy.description}
                    </div>
                  )}

                  {channelStrategy.contentPillars && (
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)" }}>Content Pillars</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {channelStrategy.contentPillars.map((p, i) => (
                          <span key={i} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "12px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                            {typeof p === "string" ? p : p.name || p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {channelStrategy.uploadFrequency && (
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                      📅 Recommended: {channelStrategy.uploadFrequency}
                    </div>
                  )}

                  {channelStrategy.targetAudience && (
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                      👥 Audience: {channelStrategy.targetAudience}
                    </div>
                  )}
                </>
              )}

              <button onClick={() => { setStep(3); generateCalendar(); }} style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: "13px" }}>
                📅 Generate Content Calendar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ━━ STEP 3: CONTENT CALENDAR ━━ */}
      {step === 3 && (
        <div style={{ ...card, borderTop: "3px solid #f59e0b" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>📅 30-Day Content Calendar</h4>

          {calendarLoading && (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <div style={{ fontSize: "24px", animation: "pulse 2s infinite" }}>📝</div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Generating content plan (~20s)...</div>
            </div>
          )}

          {calendar && !calendarLoading && (
            <>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                {calendar.length} videos planned. Review and edit, then activate automation.
              </p>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {calendar.map((topic, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px", borderRadius: "6px", marginBottom: "4px",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    border: "1px solid var(--border, rgba(255,255,255,0.04))",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", fontWeight: "600" }}>{topic.title || topic}</div>
                      {topic.angle && <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{topic.angle}</div>}
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)", minWidth: "50px", textAlign: "right" }}>
                      {topic.pillar || topic.category || `Week ${Math.ceil((i + 1) / 3)}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ━━ STEP 4: ACTIVATE ━━ */}
      {step === 4 && (
        <div style={{ ...card, borderTop: "3px solid #10b981" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>🚀 Automation Setup</h4>

          {/* Tier */}
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Video Quality</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
            {TIERS.map(t => (
              <button key={t.id} onClick={() => setConfig(c => ({ ...c, tier: t.id }))} style={{
                padding: "8px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                border: config.tier === t.id ? `2px solid ${t.color}` : "1px solid var(--border)",
                background: config.tier === t.id ? `${t.color}15` : "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}>
                <div style={{ fontSize: "11px", fontWeight: "700" }}>{t.label}</div>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Provider config */}
          <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>AI Providers</div>
          {Object.entries(PROVIDERS).map(([type, options]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label style={{ fontSize: "10px", fontWeight: "600", width: "50px", textTransform: "capitalize" }}>{type}</label>
              <select value={config.providers[type]} onChange={e => setConfig(c => ({
                ...c, providers: { ...c.providers, [type]: e.target.value },
              }))} style={{ ...inputStyle, flex: 1, padding: "4px 6px", fontSize: "10px" }}>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          ))}

          {/* Schedule */}
          <div style={{ fontSize: "10px", fontWeight: "700", margin: "12px 0 4px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Schedule</div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
            <select value={config.frequency} onChange={e => setConfig(c => ({ ...c, frequency: e.target.value }))}
              style={{ ...inputStyle, flex: 1, padding: "4px 6px", fontSize: "10px" }}>
              <option value="1x/week">1x/week</option>
              <option value="2x/week">2x/week</option>
              <option value="3x/week">3x/week</option>
              <option value="5x/week">5x/week</option>
              <option value="daily">Daily</option>
            </select>
            <input type="time" value={config.timeOfDay} onChange={e => setConfig(c => ({ ...c, timeOfDay: e.target.value }))}
              style={{ ...inputStyle, flex: 1, padding: "4px 6px", fontSize: "10px" }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", marginBottom: "16px", cursor: "pointer" }}>
            <input type="checkbox" checked={config.reviewRequired}
              onChange={e => setConfig(c => ({ ...c, reviewRequired: e.target.checked }))} />
            Review videos before publishing
          </label>

          <button onClick={activateAutomation} style={{
            ...btnPrimary, width: "100%", padding: "14px", fontSize: "14px",
            background: "linear-gradient(135deg, #10b981, #059669)",
          }}>
            🚀 Activate Automation — Start Producing Videos
          </button>
        </div>
      )}
    </div>
  );
}
