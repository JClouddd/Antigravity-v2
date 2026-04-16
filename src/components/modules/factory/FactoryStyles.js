/* Shared styles + constants for YouTube Factory */
export const card = {
  background: "var(--bg-secondary, rgba(255,255,255,0.03))",
  border: "1px solid var(--border, rgba(255,255,255,0.06))",
  borderRadius: "12px",
  padding: "16px",
};
export const btnPrimary = {
  background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  color: "#fff", border: "none", borderRadius: "8px",
  padding: "8px 16px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
};
export const btnSecondary = {
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  color: "var(--text-secondary)",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  borderRadius: "8px", padding: "8px 16px", fontSize: "12px", cursor: "pointer",
};
export const inputStyle = {
  background: "var(--bg-tertiary, rgba(255,255,255,0.04))",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
  borderRadius: "6px", padding: "8px 10px", fontSize: "12px",
  color: "var(--text-primary, #fff)", width: "100%",
};

export const TIERS = [
  { id: "budget", label: "💰 Budget", desc: "Images + Ken Burns", color: "#10b981" },
  { id: "standard", label: "⚡ Standard", desc: "Images + short clips", color: "#3b82f6" },
  { id: "premium", label: "🔥 Premium", desc: "AI video per scene", color: "#f59e0b" },
  { id: "cinematic", label: "🎬 Cinematic", desc: "Full cinematic", color: "#ef4444" },
];

export const PROVIDERS = {
  tts: [
    { id: "fal-kokoro", label: "Kokoro (fal.ai)", model: "fal-ai/kokoro/american-english" },
    { id: "gemini-tts", label: "Gemini TTS", model: "gemini-2.5-flash" },
  ],
  music: [
    { id: "fal-minimax", label: "MiniMax (fal.ai)", model: "fal-ai/minimax-music" },
    { id: "none", label: "No music", model: null },
  ],
  image: [
    { id: "fal-flux", label: "FLUX Schnell (fal.ai)", model: "fal-ai/flux/schnell" },
    { id: "fal-flux-dev", label: "FLUX Dev (fal.ai)", model: "fal-ai/flux/dev" },
  ],
  video: [
    { id: "fal-veo3", label: "VEO 3 (fal.ai)", model: "fal-ai/veo3" },
    { id: "fal-kling", label: "Kling v2 (fal.ai)", model: "fal-ai/kling-video/v2/standard" },
    { id: "fal-seedance", label: "Seedance 2.0 (fal.ai)", model: "fal-ai/seedance-2.0" },
    { id: "none", label: "Images only", model: null },
  ],
};
