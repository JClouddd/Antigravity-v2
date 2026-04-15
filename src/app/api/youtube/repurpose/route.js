import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/repurpose
 *
 * Content Repurposing Engine — transforms content across formats.
 * Body: { content, sourceType, targets }
 */
export async function POST(req) {
  try {
    const {
      content,
      sourceType = "longform_script",
      targets = ["shorts", "community", "tweet", "blog_intro"],
      title = "",
    } = await req.json();

    if (!content) return Response.json({ error: "content is required" }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const targetDescriptions = {
      shorts: "YouTube Shorts script (30-60 seconds, vertical, hook-first, punchy)",
      community: "YouTube Community post (text + optional poll, drives engagement)",
      tweet: "Twitter/X post (280 chars max, engaging, with relevant hashtags)",
      blog_intro: "Blog post intro paragraph (SEO-friendly, 150-200 words)",
      instagram_caption: "Instagram caption (engaging, with emojis, hashtags, CTA)",
      linkedin: "LinkedIn post (professional tone, thought leadership, 200-300 words)",
      email_subject: "Email newsletter subject line + preview text",
      podcast_notes: "Podcast episode talking points (5-7 key points with transitions)",
      tiktok: "TikTok script (15-60 sec, trend-aware, casual, hook-first)",
    };

    const targetList = targets.map(t => `- ${t}: ${targetDescriptions[t] || t}`).join("\n");

    const prompt = `You are a content repurposing expert. Transform this ${sourceType} content into multiple formats.

${title ? `Original Title: "${title}"` : ""}
Source Content:
---
${content.substring(0, 4000)}
---

Generate repurposed content for each of these targets:
${targetList}

Return a JSON object (no markdown, no code fences):
{
  "repurposed": {
${targets.map(t => `    "${t}": { "content": "The repurposed content", "notes": "Why this adaptation works", "bestTime": "Recommended posting time" }`).join(",\n")}
  },
  "contentMap": {
    "keyMessages": ["Core message 1", "Core message 2", "Core message 3"],
    "hooks": ["Hook variation 1", "Hook variation 2"],
    "ctas": ["CTA for platform 1", "CTA for platform 2"]
  },
  "schedule": "Recommended posting schedule across platforms"
}`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.8 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let data;
        try { data = JSON.parse(text); }
        catch { data = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...data,
          sourceType,
          targets,
          model: modelName,
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          },
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        lastError = err;
        if (err.message?.includes("429")) continue;
        throw err;
      }
    }

    return Response.json({ error: lastError?.message || "All models exhausted" }, { status: 429 });
  } catch (err) {
    console.error("[YOUTUBE/REPURPOSE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
