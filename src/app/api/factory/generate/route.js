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

  const text = await res.text();
  if (!text || text.trim() === "") throw new Error("fal.ai returned empty response");
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`fal.ai returned invalid JSON: ${text.slice(0, 200)}`); }

  // Check if queued
  if (data.request_id && !data.output) {
    const reqId = data.request_id;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`https://queue.fal.run/${model}/requests/${reqId}/status`, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      const statusText = await statusRes.text();
      if (!statusText) continue;
      let status;
      try { status = JSON.parse(statusText); }
      catch { continue; }

      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`https://queue.fal.run/${model}/requests/${reqId}`, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        const resultText = await resultRes.text();
        if (!resultText) throw new Error("fal.ai returned empty result");
        try { return JSON.parse(resultText); }
        catch { throw new Error(`fal.ai result invalid JSON: ${resultText.slice(0, 200)}`); }
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

    /* ── SCRIPT + PRODUCTION BLUEPRINT ── */
    if (action === "script") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { topic, niche, tone, duration, style, channelName } = body;
      if (!topic) return Response.json({ error: "topic required" }, { status: 400 });

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);

      const prompt = `You are a YouTube production director. Create a COMPLETE Production Blueprint for a ${duration || "8-10 minute"} YouTube video. This is not just a script — it's a unified plan coordinating every second of narration, visuals, audio, transitions, and camera.

Topic: ${topic}
${niche ? `Niche: ${niche}` : ""}
${tone ? `Tone: ${tone}` : "Casual, engaging, informative"}
${style ? `Style: ${style}` : "Faceless narration with visual descriptions"}
${channelName ? `Channel: ${channelName}` : ""}

Return JSON (no markdown fences):
{
  "title": "Video title (SEO optimized, curiosity-driving, 60 chars max)",
  "description": "YouTube description (300+ words with SEO keywords, timestamps, hashtags, CTA)",
  "tags": ["tag1", "tag2", "tag3", "...15-30 tags"],
  "hookLine": "Opening hook (first 5 seconds — must stop the scroll)",

  "scenes": [
    {
      "sceneNumber": 1,
      "section": "hook|intro|body|climax|outro|cta",
      "narration": "Exact narrator text. Write naturally — contractions, emphasis, pauses marked with (pause).",
      "narrationWordCount": 45,
      "estimatedDuration": 20,

      "visualType": "image|video_clip|text_overlay|split_screen|montage",
      "visualDescription": "Precise description of what appears on screen during this narration",
      "imagePrompt": "Detailed AI image prompt (style, mood, composition, colors, subject placement)",
      "videoPrompt": "AI video clip prompt (action, camera move, atmosphere). Null if visualType is 'image'.",
      "cameraMove": "static|slow_zoom_in|slow_zoom_out|pan_left|pan_right|tracking|parallax",

      "transition": {
        "type": "cut|fade|dissolve|zoom|swipe|morph|none",
        "duration": 0.5,
        "toNext": "How this scene connects visually to the next"
      },

      "audio": {
        "musicMood": "dramatic|calm|upbeat|tense|inspiring|minimal|none",
        "musicIntensity": 0.15,
        "sfx": ["whoosh", "impact"] ,
        "voiceEmotion": "neutral|excited|serious|warm|urgent|curious"
      },

      "textOverlay": {
        "text": "On-screen text (if any)",
        "style": "title|subtitle|stat|quote|callout|none",
        "position": "center|lower_third|top|left|right"
      },

      "retentionNote": "Why this scene keeps viewers engaged (for self-learning analysis)"
    }
  ],

  "timeline": {
    "totalDuration": "total seconds",
    "sectionBreakdown": {
      "hook": "0:00-0:08",
      "intro": "0:08-0:45",
      "body": "0:45-7:00",
      "climax": "7:00-8:30",
      "outro": "8:30-9:15",
      "cta": "9:15-9:30"
    }
  },

  "chapters": [
    { "timestamp": "0:00", "title": "Introduction" }
  ],

  "musicPlan": {
    "style": "Overall music style description",
    "prompt": "AI music generation prompt for background track",
    "keyMoments": [
      { "at": "0:00", "action": "Fade in ambient" },
      { "at": "2:30", "action": "Build tension" },
      { "at": "7:00", "action": "Climax swell" },
      { "at": "9:00", "action": "Fade to gentle outro" }
    ]
  },

  "thumbnailPlan": {
    "concept": "What the thumbnail should show",
    "prompt": "Detailed AI generation prompt — subject, composition, colors, text placement",
    "textOnThumbnail": "Bold text to overlay (2-5 words)",
    "emotionTarget": "curiosity|shock|excitement|awe"
  },

  "category": "YouTube category",
  "playlistSuggestion": "Which playlist this belongs in",

  "selfLearningMeta": {
    "targetAudience": "Who this is for",
    "retentionStrategy": "How scenes are designed to hold attention",
    "clickThroughStrategy": "Why the title/thumbnail combo works",
    "differentiator": "What makes this video unique vs competitors",
    "expectedPerformance": "low|medium|high|viral",
    "riskFactors": ["potential weakness 1"]
  }
}

Write 8-15 scenes. Each scene: 15-60 seconds. Total: ${duration || "8-10"} minute video. Be highly specific in ALL prompts — these will be fed directly to AI generators.`;

      let lastError = null;
      for (const modelName of FALLBACK_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 16384, temperature: 0.7 },
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

    /* ── BLUEPRINT — generate master timeline from existing script ── */
    if (action === "blueprint") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { script, videoTier } = body;
      if (!script?.scenes) return Response.json({ error: "script with scenes required" }, { status: 400 });

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const prompt = `Convert this video script into a second-by-second production timeline. This timeline will be used by an FFmpeg compositor to assemble the final video.

Video Tier: ${videoTier || "standard"} (determines whether scenes get generated video clips or just Ken Burns images)

Script: ${JSON.stringify(script, null, 2)}

Return JSON (no markdown fences):
{
  "timeline": [
    {
      "startTime": 0.0,
      "endTime": 15.5,
      "sceneNumber": 1,
      "layer": "visual",
      "source": "image|video_clip",
      "prompt": "The exact generation prompt for this visual",
      "cameraMove": "slow_zoom_in",
      "transition": { "in": "fade", "out": "dissolve", "duration": 0.5 }
    },
    {
      "startTime": 0.0,
      "endTime": 15.5,
      "sceneNumber": 1,
      "layer": "narration",
      "text": "The narrator text for this segment",
      "emotion": "warm"
    },
    {
      "startTime": 0.0,
      "endTime": 15.5,
      "sceneNumber": 1,
      "layer": "music",
      "intensity": 0.15,
      "mood": "ambient"
    },
    {
      "startTime": 3.0,
      "endTime": 8.0,
      "sceneNumber": 1,
      "layer": "text_overlay",
      "text": "On screen text",
      "style": "title",
      "position": "center"
    }
  ],
  "totalDuration": 540,
  "assetManifest": {
    "images": ["List of all image prompts needed"],
    "videoClips": ["List of all video clip prompts needed"],
    "narrationSegments": ["List of narration texts in order"],
    "musicPrompt": "Single prompt for the background music track"
  },
  "compositorInstructions": {
    "resolution": "1920x1080",
    "fps": 30,
    "codec": "h264",
    "audioMix": { "narration": 1.0, "music": 0.15, "sfx": 0.3 }
  }
}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16384, temperature: 0.2 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let blueprint;
      try { blueprint = JSON.parse(text); }
      catch { blueprint = { raw: text }; }

      const usage = result.response.usageMetadata;
      const cost = ((usage?.promptTokenCount || 0) / 1e6 * 0.15) + ((usage?.candidatesTokenCount || 0) / 1e6 * 0.60);
      await logCost("blueprint", "gemini-2.5-flash", cost);

      return Response.json({ blueprint, cost: Number(cost.toFixed(4)) });
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
