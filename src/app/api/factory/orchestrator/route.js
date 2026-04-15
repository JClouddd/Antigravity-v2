import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

const GEMINI_KEY = process.env.GEMINI_API_KEY;

/**
 * POST /api/factory/orchestrator
 *
 * RUBRIC-inspired autonomous pipeline orchestrator.
 * This is the "brain" that drives pipelines from start to finish.
 *
 * Unlike the pipeline route (which just tracks state), this route
 * EXECUTES each step: generates scripts, creates assets, triggers
 * composition, and publishes — all autonomously.
 *
 * Actions: run-step, run-full, niche-discover, topic-generate
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";

    /* ── Helper: call internal factory APIs ── */
    async function callFactory(route, payload) {
      const res = await fetch(`${baseUrl}/api/factory/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      return res.json();
    }

    /* ── NICHE DISCOVERY ── */
    if (action === "niche-discover") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { category, count } = body;

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are a YouTube niche analyst. Analyze current trends and suggest ${count || 5} profitable YouTube niches.

${category ? `Focus area: ${category}` : "Consider any category."}

For each niche, evaluate:
- Search volume and competition level
- Monetization potential (CPM, sponsorship appeal)
- Content sustainability (evergreen vs trending)
- Automation compatibility (can AI produce this content?)

Return JSON (no markdown fences):
{
  "niches": [
    {
      "name": "Niche name",
      "category": "Sports|Tech|Finance|Entertainment|Education|Health|Lifestyle",
      "type": "evergreen|trending|seasonal|hybrid",
      "searchVolume": "high|medium|low",
      "competition": "high|medium|low",
      "estimatedCPM": "$X.XX",
      "automationScore": 1-10,
      "monthlySearches": "estimated number",
      "topKeywords": ["keyword1", "keyword2", "keyword3"],
      "contentIdeas": ["idea1", "idea2", "idea3"],
      "whyProfitable": "Brief explanation",
      "risks": "Potential downsides",
      "recommendedFrequency": "X videos/week"
    }
  ],
  "topPick": {
    "name": "Best niche name",
    "reason": "Why this is the top recommendation"
  }
}`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.6 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let data;
      try { data = JSON.parse(text); }
      catch { data = { raw: text }; }

      // Store in knowledge base for future reference
      await callFactory("knowledge", {
        action: "ingest",
        title: `Niche Discovery — ${category || "General"} — ${new Date().toISOString().split("T")[0]}`,
        content: JSON.stringify(data, null, 2),
        sourceType: "niche_discovery",
        category: "niche",
        tags: [category || "general", "discovery"],
      });

      return Response.json({ niches: data });
    }

    /* ── TOPIC GENERATION for a niche ── */
    if (action === "topic-generate") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { niche, count, channelName, existingTopics } = body;
      if (!niche) return Response.json({ error: "niche required" }, { status: 400 });

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Generate ${count || 10} YouTube video topic ideas for a ${niche} channel${channelName ? ` called "${channelName}"` : ""}.

${existingTopics?.length ? `Already published: ${existingTopics.join(", ")}. Do NOT repeat these.` : ""}

Each topic should be SEO-optimized and designed for high click-through rate.

Return JSON (no markdown fences):
{
  "topics": [
    {
      "title": "Video title (SEO optimized, curiosity-driving)",
      "hook": "Opening hook for first 5 seconds",
      "angle": "What makes this topic unique",
      "searchKeyword": "Primary keyword to target",
      "estimatedViews": "low|medium|high|viral",
      "type": "listicle|explainer|comparison|story|how-to|reaction|news",
      "urgency": "evergreen|trending|time-sensitive"
    }
  ]
}`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let data;
      try { data = JSON.parse(text); }
      catch { data = { raw: text }; }

      return Response.json({ topics: data });
    }

    /* ── RUN A SINGLE PIPELINE STEP ── */
    if (action === "run-step") {
      const { pipelineId, step } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      // Get current pipeline state
      const pipeData = await callFactory("pipeline", { action: "status", pipelineId });
      if (pipeData.error) return Response.json({ error: pipeData.error }, { status: 404 });

      const currentStep = step || getNextStep(pipeData.state);
      const results = {};

      switch (currentStep) {
        case "generate_script": {
          const scriptResult = await callFactory("generate", {
            action: "script",
            topic: pipeData.topic,
            niche: pipeData.niche,
            tone: pipeData.tone,
            duration: pipeData.targetDuration,
            style: pipeData.style,
            channelName: pipeData.channelName,
          });

          if (scriptResult.error) {
            await callFactory("pipeline", { action: "error", pipelineId, error: scriptResult.error });
            return Response.json({ error: scriptResult.error, step: currentStep }, { status: 500 });
          }

          await callFactory("pipeline", {
            action: "advance",
            pipelineId,
            assetUpdates: { script: scriptResult.script },
            costUpdate: { type: "script", amount: scriptResult.cost || 0 },
          });

          results.script = scriptResult.script;
          results.cost = scriptResult.cost;
          break;
        }

        case "generate_voice": {
          const script = pipeData.assets?.script;
          if (!script?.scenes) {
            return Response.json({ error: "No script found — run generate_script first" }, { status: 400 });
          }

          const fullNarration = script.scenes.map(s => s.narration).join("\n\n");
          const ttsResult = await callFactory("generate", {
            action: "tts",
            text: fullNarration,
          });

          if (ttsResult.error) {
            await callFactory("pipeline", { action: "error", pipelineId, error: ttsResult.error });
            return Response.json({ error: ttsResult.error, step: currentStep }, { status: 500 });
          }

          // Also generate subtitles
          const srtResult = await callFactory("generate", {
            action: "subtitles",
            scenes: script.scenes,
          });

          // Also generate background music
          const musicResult = await callFactory("generate", {
            action: "music",
            prompt: `Background music for a ${pipeData.niche || "general"} YouTube video. ${pipeData.tone || "Calm"}, no vocals, ambient.`,
          });

          const totalCost = (ttsResult.cost || 0) + (srtResult.cost || 0) + (musicResult.cost || 0);

          await callFactory("pipeline", {
            action: "advance",
            pipelineId,
            assetUpdates: {
              voiceUrl: ttsResult.audioUrl,
              subtitlesSrt: srtResult.srt,
              musicUrl: musicResult.audioUrl || null,
            },
            costUpdate: { type: "audio", amount: totalCost },
          });

          results.voiceUrl = ttsResult.audioUrl;
          results.musicUrl = musicResult.audioUrl;
          results.cost = totalCost;
          break;
        }

        case "generate_visuals": {
          const script = pipeData.assets?.script;
          if (!script?.scenes) {
            return Response.json({ error: "No script found" }, { status: 400 });
          }

          const tier = pipeData.videoTier || "standard";
          const sceneImages = [];
          const sceneVideos = [];
          let totalCost = 0;

          for (const scene of script.scenes) {
            // Generate image for each scene
            const imgResult = await callFactory("generate", {
              action: "image",
              prompt: scene.imagePrompt || scene.visualDescription,
            });

            if (imgResult.imageUrl) {
              sceneImages.push(imgResult.imageUrl);
              totalCost += imgResult.cost || 0;

              // Save to asset gallery
              await callFactory("assets", {
                action: "save",
                url: imgResult.imageUrl,
                type: "image",
                prompt: scene.imagePrompt || scene.visualDescription,
                model: imgResult.model,
                pipelineId,
              });
            }

            // For premium/cinematic tiers, also generate video clips
            if (tier === "premium" || tier === "cinematic") {
              const vidResult = await callFactory("generate", {
                action: "video",
                prompt: scene.videoPrompt || scene.visualDescription,
                imageUrl: imgResult.imageUrl,
                tier,
                duration: 5,
              });

              if (vidResult.videoUrl) {
                sceneVideos.push(vidResult.videoUrl);
                totalCost += vidResult.cost || 0;

                await callFactory("assets", {
                  action: "save",
                  url: vidResult.videoUrl,
                  type: "video",
                  prompt: scene.videoPrompt || scene.visualDescription,
                  model: vidResult.model,
                  pipelineId,
                });
              }
            }
          }

          // Generate thumbnail
          const thumbResult = await callFactory("generate", {
            action: "thumbnail",
            prompt: script.thumbnailPrompt || `${pipeData.topic} YouTube thumbnail`,
          });

          if (thumbResult.imageUrl) {
            totalCost += thumbResult.cost || 0;
            await callFactory("assets", {
              action: "save",
              url: thumbResult.imageUrl,
              type: "thumbnail",
              prompt: script.thumbnailPrompt,
              pipelineId,
            });
          }

          // Advance twice: ASSETS_GENERATING → ASSETS_READY
          await callFactory("pipeline", {
            action: "advance",
            pipelineId,
            assetUpdates: { sceneImages, sceneVideos, thumbnailUrl: thumbResult.imageUrl },
            costUpdate: { type: "visuals", amount: totalCost },
          });
          await callFactory("pipeline", { action: "advance", pipelineId });

          results.images = sceneImages.length;
          results.videos = sceneVideos.length;
          results.thumbnail = thumbResult.imageUrl;
          results.cost = totalCost;
          break;
        }

        case "compose": {
          const composeResult = await callFactory("compose", {
            action: "trigger",
            pipelineId,
          });

          results.compose = composeResult;
          break;
        }

        default:
          return Response.json({ error: `Unknown step: ${currentStep}` }, { status: 400 });
      }

      return Response.json({ pipelineId, step: currentStep, results });
    }

    /* ── RUN FULL PIPELINE (autonomous) ── */
    if (action === "run-full") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      const steps = ["generate_script", "generate_voice", "generate_visuals", "compose"];
      const results = {};
      let lastError = null;

      for (const step of steps) {
        try {
          const stepResult = await callFactory("orchestrator", {
            action: "run-step",
            pipelineId,
            step,
          });

          results[step] = stepResult.results || stepResult;

          if (stepResult.error) {
            lastError = stepResult.error;
            break;
          }
        } catch (err) {
          lastError = err.message;
          results[step] = { error: err.message };
          break;
        }
      }

      // Get final pipeline status
      const finalStatus = await callFactory("pipeline", { action: "status", pipelineId });

      return Response.json({
        pipelineId,
        completed: !lastError,
        state: finalStatus.state,
        progress: finalStatus.progress,
        totalCost: finalStatus.totalCost,
        results,
        error: lastError,
      });
    }

    return Response.json({
      error: "action must be: run-step, run-full, niche-discover, or topic-generate",
    }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/ORCHESTRATOR]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function getNextStep(state) {
  const stepMap = {
    NICHE_SELECTED: "generate_script",
    SCRIPT_GENERATED: "generate_voice",
    ASSETS_GENERATING: "generate_visuals",
    ASSETS_READY: "compose",
  };
  return stepMap[state] || "generate_script";
}
