import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/suggest
 *
 * AI-powered topic suggestions based on niche, channel context, and trends.
 * Body: { niche, channelName, recentTopics, performanceData }
 */
export async function POST(req) {
  try {
    const {
      niche,
      channelName = "",
      recentTopics = [],
      performanceData = [],
      count = 10,
    } = await req.json();

    if (!niche) {
      return Response.json({ error: "niche is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const performanceContext = performanceData.length > 0
      ? `\n\nPast video performance (use this to identify what works):\n${performanceData.map(p => `- "${p.title}" → ${p.views} views, ${p.likes} likes, ${p.engagement}% engagement`).join("\n")}`
      : "";

    const recentContext = recentTopics.length > 0
      ? `\n\nRecent topics already covered (avoid repeats):\n${recentTopics.map(t => `- ${t}`).join("\n")}`
      : "";

    const prompt = `You are a YouTube content strategist. Generate ${count} video topic suggestions.

Niche: ${niche}
${channelName ? `Channel: ${channelName}` : ""}${performanceContext}${recentContext}

Return a JSON array (no markdown, no code fences) with exactly ${count} objects:
[
  {
    "title": "Suggested video title",
    "hook": "One-line hook for the thumbnail/intro",
    "type": "longform|shorts|podcast|live|community",
    "difficulty": "easy|medium|hard",
    "estimatedViews": "potential view range like 5K-20K",
    "reason": "Why this topic would perform well right now",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "trendScore": 85
  }
]

Rules:
- Prioritize topics with high search demand and low competition
- Mix evergreen content with trending/timely topics
- Consider the channel's past performance data if provided
- Include at least 2 Shorts ideas and 1 community post
- Score each topic's trend potential from 1-100
- Account for seasonality and current events in ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.9 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let suggestions;
        try {
          suggestions = JSON.parse(text);
        } catch {
          suggestions = [{ raw: text, error: "Failed to parse suggestions" }];
        }

        return Response.json({
          suggestions,
          niche,
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
    console.error("[YOUTUBE/SUGGEST]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
