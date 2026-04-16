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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || process.env.NEXTAUTH_URL
      || "http://localhost:3000";

    /* ── Helper: call internal factory APIs ── */
    async function callFactory(route, payload) {
      const res = await fetch(`${baseUrl}/api/factory/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      // Handle non-JSON responses (Vercel error pages)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.error(`[ORCHESTRATOR] ${route} returned non-JSON (${res.status}):`, text.slice(0, 200));
        return { error: `${route} returned HTTP ${res.status}` };
      }
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
        generationConfig: { maxOutputTokens: 8192, temperature: 0.6, responseMimeType: "application/json" },
      });

      let text = result.response.text().trim();
      // Strip markdown fences aggressively
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Try to repair truncated JSON by closing open brackets
        let repaired = text;
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/]/g) || []).length;
        // Remove trailing comma
        repaired = repaired.replace(/,\s*$/, "");
        // Close any unclosed strings
        const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) repaired += '"';
        // Close brackets/braces
        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
        try {
          data = JSON.parse(repaired);
        } catch {
          data = { raw: text };
        }
      }

      // Store in knowledge base (non-blocking — don't crash if it fails)
      try {
        await callFactory("knowledge", {
          action: "ingest",
          title: `Niche Discovery — ${category || "General"} — ${new Date().toISOString().split("T")[0]}`,
          content: JSON.stringify(data, null, 2),
          sourceType: "niche_discovery",
          category: "niche",
          tags: [category || "general", "discovery"],
        });
      } catch (kbErr) {
        console.warn("[ORCHESTRATOR] Knowledge ingest failed (non-fatal):", kbErr.message);
      }

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
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7, responseMimeType: "application/json" },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        let repaired = text;
        const ob = (repaired.match(/{/g) || []).length;
        const cb = (repaired.match(/}/g) || []).length;
        const obk = (repaired.match(/\[/g) || []).length;
        const cbk = (repaired.match(/]/g) || []).length;
        repaired = repaired.replace(/,\s*$/, "");
        const qc = (repaired.match(/(?<!\\)"/g) || []).length;
        if (qc % 2 !== 0) repaired += '"';
        for (let i = 0; i < obk - cbk; i++) repaired += "]";
        for (let i = 0; i < ob - cb; i++) repaired += "}";
        try { data = JSON.parse(repaired); }
        catch { data = { raw: text }; }
      }

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

          // Auto-generate the Production Blueprint timeline from the script
          let blueprint = null;
          let blueprintCost = 0;
          try {
            const bpResult = await callFactory("generate", {
              action: "blueprint",
              script: scriptResult.script,
              videoTier: pipeData.videoTier,
            });
            blueprint = bpResult.blueprint;
            blueprintCost = bpResult.cost || 0;
          } catch { /* blueprint is optional — pipeline continues without it */ }

          await callFactory("pipeline", {
            action: "advance",
            pipelineId,
            assetUpdates: {
              script: scriptResult.script,
              blueprint: blueprint,
            },
            costUpdate: { type: "script", amount: (scriptResult.cost || 0) + blueprintCost },
          });

          results.script = scriptResult.script;
          results.blueprint = blueprint ? "generated" : "skipped";
          results.cost = (scriptResult.cost || 0) + blueprintCost;
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

          // Use blueprint music plan if available, otherwise generic prompt
          const musicPlan = pipeData.assets?.blueprint?.assetManifest?.musicPrompt
            || script.musicPlan?.prompt;
          const musicResult = await callFactory("generate", {
            action: "music",
            prompt: musicPlan || `Background music for a ${pipeData.niche || "general"} YouTube video. ${pipeData.tone || "Calm"}, no vocals, ambient.`,
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
          const blueprint = pipeData.assets?.blueprint;
          const sceneImages = [];
          const sceneVideos = [];
          let totalCost = 0;

          for (const scene of script.scenes) {
            // Check blueprint for per-scene visual type decision
            const bpVisualType = scene.visualType;
            const shouldGenerateVideo = bpVisualType === "video_clip"
              || (tier === "premium" || tier === "cinematic");

            // Generate image for every scene (used as fallback or thumbnail)
            const imgResult = await callFactory("generate", {
              action: "image",
              prompt: scene.imagePrompt || scene.visualDescription,
            });

            if (imgResult.imageUrl) {
              sceneImages.push(imgResult.imageUrl);
              totalCost += imgResult.cost || 0;

              await callFactory("assets", {
                action: "save",
                url: imgResult.imageUrl,
                type: "image",
                prompt: scene.imagePrompt || scene.visualDescription,
                model: imgResult.model,
                pipelineId,
                metadata: {
                  tags: [scene.section, `scene_${scene.sceneNumber}`],
                  style: scene.cameraMove || "",
                },
              });
            }

            // Generate video clip based on blueprint visual type or tier
            if (shouldGenerateVideo) {
              const vidResult = await callFactory("generate", {
                action: "video",
                prompt: scene.videoPrompt || scene.visualDescription,
                imageUrl: imgResult.imageUrl,
                tier,
                duration: scene.estimatedDuration ? Math.min(scene.estimatedDuration, 10) : 5,
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
                  metadata: {
                    tags: [scene.section, `scene_${scene.sceneNumber}`],
                  },
                });
              }
            }
          }

          // Generate thumbnail using blueprint's thumbnail plan
          const thumbPlan = script.thumbnailPlan;
          const thumbResult = await callFactory("generate", {
            action: "thumbnail",
            prompt: thumbPlan?.prompt || script.thumbnailPrompt || `${pipeData.topic} YouTube thumbnail`,
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

    /* ── RUN FULL PIPELINE (step-by-step, no self-reference) ── */
    if (action === "run-full") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      // Execute only the FIRST pending step per invocation.
      // The UI calls run-full repeatedly until all steps are done.
      // This avoids serverless self-referencing timeouts.
      const pipeData = await callFactory("pipeline", { action: "status", pipelineId });
      if (pipeData.error) return Response.json({ error: pipeData.error }, { status: 404 });

      const currentStep = getNextStep(pipeData.state);
      if (!currentStep || pipeData.state === "COMPLETE" || pipeData.state === "COMPOSED" || pipeData.state === "PUBLISHED") {
        return Response.json({
          pipelineId,
          completed: true,
          state: pipeData.state,
          progress: pipeData.progress || 100,
          totalCost: pipeData.totalCost || 0,
          results: { status: "all steps complete" },
        });
      }

      // Execute this one step inline (not via self-referencing HTTP)
      // We replicate the run-step logic here to avoid the fetch-to-self problem.
      const results = {};
      let stepError = null;

      try {
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

            if (scriptResult.error) { stepError = scriptResult.error; break; }

            await callFactory("pipeline", {
              action: "advance",
              pipelineId,
              assetUpdates: { script: scriptResult.script },
              costUpdate: { type: "script", amount: scriptResult.cost || 0 },
            });

            results.script = "generated";
            results.cost = scriptResult.cost || 0;
            break;
          }

          case "generate_voice": {
            const script = pipeData.assets?.script;
            if (!script?.scenes) { stepError = "No script found — run script generation first"; break; }

            const fullNarration = script.scenes.map(s => s.narration).join("\n\n");
            if (!fullNarration.trim()) { stepError = "Script has no narration text"; break; }

            // TTS is critical — must succeed
            const ttsResult = await callFactory("generate", { action: "tts", text: fullNarration });
            if (ttsResult.error) { stepError = `TTS failed: ${ttsResult.error}`; break; }

            // Subtitles — non-fatal
            let srtResult = { srt: null };
            try {
              srtResult = await callFactory("generate", { action: "subtitles", scenes: script.scenes });
            } catch (e) { console.warn("[ORCHESTRATOR] Subtitles failed (non-fatal):", e.message); }

            // Music — non-fatal
            let musicResult = { audioUrl: null, cost: 0 };
            try {
              const musicPlan = pipeData.assets?.blueprint?.assetManifest?.musicPrompt || script.musicPlan?.prompt;
              musicResult = await callFactory("generate", {
                action: "music",
                prompt: musicPlan || `Background music for ${pipeData.niche || "general"} video. Calm, no vocals.`,
              });
            } catch (e) { console.warn("[ORCHESTRATOR] Music failed (non-fatal):", e.message); }

            const totalCost = (ttsResult.cost || 0) + (srtResult.cost || 0) + (musicResult.cost || 0);
            await callFactory("pipeline", {
              action: "advance",
              pipelineId,
              assetUpdates: {
                voiceUrl: ttsResult.audioUrl,
                subtitlesSrt: srtResult.srt || null,
                musicUrl: musicResult.audioUrl || null,
              },
              costUpdate: { type: "audio", amount: totalCost },
            });

            results.voice = ttsResult.audioUrl ? "generated" : "failed";
            results.subtitles = srtResult.srt ? "generated" : "skipped";
            results.music = musicResult.audioUrl ? "generated" : "skipped";
            results.cost = totalCost;
            break;
          }

          default: {
            results.step = currentStep;
            results.status = "step not yet implemented in run-full inline";
            break;
          }
        }
      } catch (err) {
        stepError = err.message;
      }

      if (stepError) {
        await callFactory("pipeline", { action: "error", pipelineId, error: stepError }).catch(() => {});
      }

      const finalStatus = await callFactory("pipeline", { action: "status", pipelineId });

      return Response.json({
        pipelineId,
        completed: !stepError && (finalStatus.state === "COMPLETE" || finalStatus.state === "COMPOSED"),
        stepExecuted: currentStep,
        state: finalStatus.state,
        progress: finalStatus.progress,
        totalCost: finalStatus.totalCost,
        results,
        error: stepError,
        nextStep: stepError ? null : getNextStep(finalStatus.state),
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
