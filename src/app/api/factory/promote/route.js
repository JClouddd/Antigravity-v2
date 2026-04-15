import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
 * POST /api/factory/promote
 *
 * Post-publish promotion engine.
 * Generates social media posts, SEO optimizations, community engagement
 * scripts, and cross-promotion strategies after a video goes live.
 *
 * Actions: generate-promo, optimize-seo, community-post, analytics-check
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
    if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const db = getDb();
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);

    /* ── GENERATE PROMO — social media posts for a video ── */
    if (action === "generate-promo") {
      const { title, description, niche, channelName, videoUrl, platforms } = body;
      if (!title) return Response.json({ error: "title required" }, { status: 400 });

      const targetPlatforms = platforms || ["twitter", "reddit", "instagram", "tiktok", "linkedin"];

      const prompt = `Generate social media promotion posts for a YouTube video.

Video Title: ${title}
${description ? `Description: ${description.slice(0, 300)}` : ""}
${niche ? `Niche: ${niche}` : ""}
${channelName ? `Channel: ${channelName}` : ""}
${videoUrl ? `URL: ${videoUrl}` : ""}

Create engaging posts for: ${targetPlatforms.join(", ")}

Return JSON (no markdown fences):
{
  "posts": {
    "twitter": { "text": "Tweet text (280 chars max)", "hashtags": ["tag1", "tag2"] },
    "reddit": { "title": "Reddit post title", "body": "Post body", "subreddits": ["sub1", "sub2"] },
    "instagram": { "caption": "Instagram caption", "hashtags": ["tag1"] },
    "tiktok": { "caption": "TikTok caption", "hooks": ["hook1", "hook2"] },
    "linkedin": { "text": "LinkedIn post text" }
  },
  "pinComment": "Suggested pinned comment for the YouTube video",
  "communityPost": "Text for YouTube community tab post",
  "crossPromoStrategy": "Brief strategy for promoting across channels"
}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let promo;
      try { promo = JSON.parse(text); }
      catch { promo = { raw: text }; }

      return Response.json({ promo });
    }

    /* ── OPTIMIZE SEO — improve existing video metadata ── */
    if (action === "optimize-seo") {
      const { videoId, currentTitle, currentDescription, currentTags, niche } = body;

      const prompt = `Optimize YouTube SEO for this video:

Current Title: ${currentTitle || "Unknown"}
Current Description: ${(currentDescription || "").slice(0, 500)}
Current Tags: ${(currentTags || []).join(", ")}
Niche: ${niche || "General"}

Return JSON (no markdown fences):
{
  "optimizedTitle": "SEO-optimized title (60 chars max, front-load keywords)",
  "optimizedDescription": "Full 500+ word description with keywords, timestamps, links, CTAs",
  "optimizedTags": ["tag1", "tag2", "tag3", "...up to 30 tags"],
  "titleScore": { "before": 1-10, "after": 1-10 },
  "improvements": ["What was improved and why"],
  "targetKeyword": "Primary keyword to rank for",
  "relatedKeywords": ["secondary keyword 1", "secondary keyword 2"]
}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let seo;
      try { seo = JSON.parse(text); }
      catch { seo = { raw: text }; }

      return Response.json({ seo, videoId });
    }

    /* ── ANALYTICS CHECK — post-publish performance review ── */
    if (action === "analytics-check") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      const pipeDoc = await db
        .collection("users").doc(userId)
        .collection("factory_pipelines").doc(pipelineId).get();

      if (!pipeDoc.exists) return Response.json({ error: "Pipeline not found" }, { status: 404 });
      const pipe = pipeDoc.data();

      // Calculate ROI
      const cost = pipe.totalCost || 0;
      const revenue = pipe.analytics?.estimatedRevenue || 0;
      const views = pipe.analytics?.views || 0;
      const roi = cost > 0 ? ((revenue - cost) / cost * 100) : 0;

      // Generate performance insights
      const prompt = `Analyze this YouTube video's performance:

Title: ${pipe.assets?.script?.title || pipe.topic}
Niche: ${pipe.niche}
Production Cost: $${cost.toFixed(2)}
Video Tier: ${pipe.videoTier}
Views: ${views}
Estimated Revenue: $${revenue.toFixed(2)}
ROI: ${roi.toFixed(1)}%
Days Since Publish: ${pipe.completedAt ? Math.round((Date.now() - new Date(pipe.completedAt)) / (1000 * 60 * 60 * 24)) : "N/A"}

Return JSON (no markdown fences):
{
  "performanceGrade": "A/B/C/D/F",
  "insights": ["insight 1", "insight 2"],
  "improvements": ["what to do differently next time"],
  "shouldRepeat": true/false,
  "suggestedFollowUp": "Follow-up video idea based on performance"
}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let analysis;
      try { analysis = JSON.parse(text); }
      catch { analysis = { raw: text }; }

      // Store learnings from the analysis
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      try {
        await fetch(`${baseUrl}/api/factory/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "learn",
            userId,
            insight: `${pipe.assets?.script?.title}: Grade ${analysis.performanceGrade}. ${analysis.insights?.[0] || ""}. Cost: $${cost.toFixed(2)}, Views: ${views}, ROI: ${roi.toFixed(1)}%`,
            outcome: analysis.performanceGrade === "A" || analysis.performanceGrade === "B" ? "positive" : "negative",
            category: "performance",
            relatedVideo: pipe.assets?.youtubeVideoId || "",
            relatedChannel: pipe.channelId || "",
          }),
        });
      } catch {}

      return Response.json({
        pipelineId,
        cost,
        revenue,
        roi: Number(roi.toFixed(1)),
        views,
        analysis,
      });
    }

    return Response.json({
      error: "action must be: generate-promo, optimize-seo, or analytics-check",
    }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/PROMOTE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
