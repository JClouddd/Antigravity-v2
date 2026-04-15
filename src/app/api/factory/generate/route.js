import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // fal.ai video generation can take 60-90 seconds

function getDb() {
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      initializeApp({ credential: cert(JSON.parse(cred)) });
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

const FAL_KEY = process.env.FAL_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/* ── Default model config per asset type ── */
const DEFAULT_MODELS = {
  script: { provider: "gemini", model: "gemini-2.5-flash" },
  tts: { provider: "fal", model: "fal-ai/kokoro/american-english" },
  music: { provider: "fal", model: "fal-ai/minimax-music" },
  image: { provider: "fal", model: "fal-ai/flux/schnell" },
  video_budget: { provider: "fal", model: "fal-ai/veo3" },
  video_standard: { provider: "fal", model: "fal-ai/kling-video/v2/standard" },
  video_premium: { provider: "fal", model: "fal-ai/seedance-2.0/fast" },
  video_cinematic: { provider: "fal", model: "fal-ai/seedance-2.0" },
  subtitles: { provider: "gemini", model: "gemini-2.5-flash" },
  thumbnail: { provider: "fal", model: "fal-ai/flux/schnell" },
};

/* ── Cost per unit ── */
const COST_MAP = {
  "fal-ai/kokoro/american-english": { unit: "chars", rate: 0.00001 },
  "fal-ai/minimax-music": { unit: "track", rate: 0.05 },
  "fal-ai/flux/schnell": { unit: "image", rate: 0.003 },
  "fal-ai/veo3": { unit: "second", rate: 0.06 },
  "fal-ai/kling-video/v2/standard": { unit: "second", rate: 0.15 },
  "fal-ai/seedance-2.0/fast": { unit: "second", rate: 0.24 },
  "fal-ai/seedance-2.0": { unit: "second", rate: 0.30 },
};

/**
 * Call fal.ai API directly (server-side)
 */
async function callFal(model, input) {
  const res = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${FAL_KEY}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai ${res.status}: ${err}`);
  }

  // Check if queued
  const data = await res.json();
  if (data.request_id && !data.output) {
    // Poll for result
    const reqId = data.request_id;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`https://queue.fal.run/${model}/requests/${reqId}/status`, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      const status = await statusRes.json();
      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`https://queue.fal.run/${model}/requests/${reqId}`, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        return await resultRes.json();
      }
      if (status.status === "FAILED") throw new Error(`fal.ai job failed: ${JSON.stringify(status)}`);
    }
    throw new Error("fal.ai job timed out after 3 minutes");
  }
  return data;
}

/**
 * POST /api/factory/generate
 *
 * Unified media generation endpoint.
 * Actions: script, tts, music, image, video, subtitles, thumbnail
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId, pipelineId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const costRef = db.collection("users").doc(userId).collection("factory_costs");

    /* ── Track cost ── */
    async function logCost(type, model, amount, metadata = {}) {
      await costRef.add({
        type,
        model,
        amount: Number(amount.toFixed(4)),
        pipelineId: pipelineId || "",
        ...metadata,
        createdAt: new Date().toISOString(),
      });
    }

    /* ── SCRIPT GENERATION ── */
    if (action === "script") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { topic, niche, tone, duration, style, channelName } = body;
      if (!topic) return Response.json({ error: "topic required" }, { status: 400 });

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);

      const prompt = `You are a YouTube script writer. Write a complete narration script for a ${duration || "8-10 minute"} YouTube video.

Topic: ${topic}
${niche ? `Niche: ${niche}` : ""}
${tone ? `Tone: ${tone}` : "Casual, engaging, informative"}
${style ? `Style: ${style}` : "Faceless narration with visual descriptions"}
${channelName ? `Channel: ${channelName}` : ""}

Return JSON (no markdown fences):
{
  "title": "Video title (SEO optimized)",
  "description": "YouTube description (300+ words, keywords, links, timestamps)",
  "tags": ["tag1", "tag2", ...],
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "Exact text the narrator will say for this scene",
      "visualDescription": "Detailed description of what should appear on screen",
      "duration": "estimated seconds for this scene",
      "imagePrompt": "Prompt for generating the visual with AI (be specific about composition, style, mood)",
      "videoPrompt": "Prompt for generating a motion video clip (if applicable)"
    }
  ],
  "chapters": [
    { "timestamp": "0:00", "title": "Introduction" },
    ...
  ],
  "category": "YouTube category (e.g. Entertainment, Education, Sports)",
  "estimatedDuration": "total minutes",
  "thumbnailPrompt": "Detailed prompt for generating thumbnail image",
  "hookLine": "Opening hook to grab attention in first 5 seconds"
}

Write 8-15 scenes. Each scene should have 30-60 seconds of narration. Be specific in visual descriptions.`;

      let lastError = null;
      for (const modelName of FALLBACK_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
          });

          let text = result.response.text().trim();
          text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

          const usage = result.response.usageMetadata;
          const inputTokens = usage?.promptTokenCount || 0;
          const outputTokens = usage?.candidatesTokenCount || 0;
          const cost = (inputTokens / 1e6 * 0.15) + (outputTokens / 1e6 * 0.60);

          let data;
          try { data = JSON.parse(text); }
          catch { data = { raw: text }; }

          await logCost("script", modelName, cost, { topic, inputTokens, outputTokens });

          return Response.json({ script: data, model: modelName, cost: Number(cost.toFixed(4)) });
        } catch (err) {
          lastError = err;
          if (err.message?.includes("429")) continue;
          throw err;
        }
      }
      return Response.json({ error: lastError?.message || "All models exhausted" }, { status: 429 });
    }

    /* ── TTS (Text to Speech) ── */
    if (action === "tts") {
      if (!FAL_KEY) return Response.json({ error: "FAL_KEY not configured" }, { status: 500 });

      const { text, voice } = body;
      if (!text) return Response.json({ error: "text required" }, { status: 400 });

      const model = body.model || DEFAULT_MODELS.tts.model;
      const result = await callFal(model, {
        text,
        voice: voice || "af_heart",
        speed: 1.0,
      });

      const chars = text.length;
      const cost = chars * 0.00001;
      await logCost("tts", model, cost, { chars });

      return Response.json({
        audioUrl: result.audio?.url || result.audio_url || result.url,
        duration: result.duration || null,
        model,
        cost: Number(cost.toFixed(4)),
      });
    }

    /* ── MUSIC GENERATION ── */
    if (action === "music") {
      if (!FAL_KEY) return Response.json({ error: "FAL_KEY not configured" }, { status: 500 });

      const { prompt, duration } = body;
      const model = body.model || DEFAULT_MODELS.music.model;

      const result = await callFal(model, {
        prompt: prompt || "Calm background music for a YouTube video, no vocals, ambient and cinematic",
        duration: duration || 120,
      });

      const cost = COST_MAP[model]?.rate || 0.05;
      await logCost("music", model, cost, { prompt });

      return Response.json({
        audioUrl: result.audio?.url || result.audio_url || result.url,
        duration: result.duration || duration,
        model,
        cost: Number(cost.toFixed(4)),
      });
    }

    /* ── IMAGE GENERATION ── */
    if (action === "image") {
      if (!FAL_KEY) return Response.json({ error: "FAL_KEY not configured" }, { status: 500 });

      const { prompt, width, height, referenceImages } = body;
      if (!prompt) return Response.json({ error: "prompt required" }, { status: 400 });

      const model = body.model || DEFAULT_MODELS.image.model;
      const input = {
        prompt,
        image_size: { width: width || 1920, height: height || 1080 },
        num_images: 1,
      };

      const result = await callFal(model, input);
      const cost = COST_MAP[model]?.rate || 0.003;
      await logCost("image", model, cost, { prompt: prompt.slice(0, 100) });

      return Response.json({
        imageUrl: result.images?.[0]?.url || result.output?.url,
        model,
        cost: Number(cost.toFixed(4)),
      });
    }

    /* ── VIDEO GENERATION ── */
    if (action === "video") {
      if (!FAL_KEY) return Response.json({ error: "FAL_KEY not configured" }, { status: 500 });

      const { prompt, imageUrl, duration, tier, referenceImages } = body;
      if (!prompt) return Response.json({ error: "prompt required" }, { status: 400 });

      const tierKey = `video_${tier || "standard"}`;
      const model = body.model || DEFAULT_MODELS[tierKey]?.model || DEFAULT_MODELS.video_standard.model;

      const input = { prompt };
      if (imageUrl) input.image_url = imageUrl;
      if (referenceImages?.length) input.reference_images = referenceImages;
      if (duration) input.duration = duration;

      const result = await callFal(model, input);
      const vidDuration = result.duration || duration || 5;
      const rate = COST_MAP[model]?.rate || 0.15;
      const cost = rate * vidDuration;
      await logCost("video", model, cost, { prompt: prompt.slice(0, 100), duration: vidDuration, tier: tier || "standard" });

      return Response.json({
        videoUrl: result.video?.url || result.output?.url,
        duration: vidDuration,
        model,
        tier: tier || "standard",
        cost: Number(cost.toFixed(4)),
      });
    }

    /* ── SUBTITLES (from script) ── */
    if (action === "subtitles") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { scenes } = body;
      if (!scenes?.length) return Response.json({ error: "scenes array required" }, { status: 400 });

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const prompt = `Convert these scenes into an SRT subtitle file. Each scene has narration text and estimated duration.

Scenes: ${JSON.stringify(scenes.map((s, i) => ({ num: i + 1, text: s.narration, dur: s.duration })))}

Return a valid .srt format string with index, timecodes (HH:MM:SS,mmm --> HH:MM:SS,mmm), and text. Break long narrations into multiple subtitle blocks of 2-3 lines, 5-8 words per line. Calculate timecodes based on speaking rate of ~150 words per minute.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
      });

      let srt = result.response.text().trim();
      srt = srt.replace(/^```srt\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

      await logCost("subtitles", "gemini-2.5-flash", 0.001);

      return Response.json({ srt, cost: 0.001 });
    }

    /* ── THUMBNAIL ── */
    if (action === "thumbnail") {
      if (!FAL_KEY) return Response.json({ error: "FAL_KEY not configured" }, { status: 500 });

      const { prompt } = body;
      if (!prompt) return Response.json({ error: "prompt required" }, { status: 400 });

      const model = body.model || DEFAULT_MODELS.thumbnail.model;
      const result = await callFal(model, {
        prompt: prompt + ". YouTube thumbnail style, bold text, high contrast, eye-catching, 16:9 aspect ratio",
        image_size: { width: 1280, height: 720 },
        num_images: 1,
      });

      const cost = COST_MAP[model]?.rate || 0.003;
      await logCost("thumbnail", model, cost, { prompt: prompt.slice(0, 100) });

      return Response.json({
        imageUrl: result.images?.[0]?.url || result.output?.url,
        model,
        cost: Number(cost.toFixed(4)),
      });
    }

    /* ── GET COSTS ── */
    if (action === "costs") {
      const snapshot = await costRef.orderBy("createdAt", "desc").limit(100).get();
      const costs = [];
      snapshot.forEach(doc => costs.push({ id: doc.id, ...doc.data() }));

      const total = costs.reduce((sum, c) => sum + c.amount, 0);
      const byType = {};
      costs.forEach(c => { byType[c.type] = (byType[c.type] || 0) + c.amount; });

      return Response.json({ costs, total: Number(total.toFixed(4)), byType, count: costs.length });
    }

    return Response.json({ error: "action must be: script, tts, music, image, video, subtitles, thumbnail, or costs" }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/GENERATE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
