import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/viral-score
 *
 * AI predicts viral potential of a video concept.
 * Body: { title, topic, niche, type, thumbnailConcept }
 */
export async function POST(req) {
  try {
    const { title, topic, niche = "", type = "longform", thumbnailConcept = "" } = await req.json();
    if (!title && !topic) return Response.json({ error: "title or topic required" }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a YouTube algorithm expert. Analyze this video concept and predict its viral potential.

Title: "${title || topic}"
${niche ? `Niche: ${niche}` : ""}
Type: ${type}
${thumbnailConcept ? `Thumbnail: ${thumbnailConcept}` : ""}
Current date: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}

Return a JSON object (no markdown, no code fences):
{
  "viralScore": 78,
  "breakdown": {
    "titleStrength": { "score": 85, "feedback": "Why the title works or doesn't" },
    "topicDemand": { "score": 72, "feedback": "Search volume and audience interest" },
    "competition": { "score": 65, "feedback": "How saturated this space is" },
    "timing": { "score": 90, "feedback": "Whether this is timely/trending" },
    "shareability": { "score": 70, "feedback": "Likelihood of being shared" },
    "retentionPotential": { "score": 75, "feedback": "Will viewers watch to the end" }
  },
  "prediction": {
    "estimatedViews": "10K-50K",
    "estimatedCTR": "4-6%",
    "growthPotential": "medium",
    "bestPublishTime": "Tuesday/Thursday 2-4 PM EST",
    "idealLength": "8-12 minutes"
  },
  "recommendations": [
    "Specific actionable improvement 1",
    "Specific actionable improvement 2",
    "Specific actionable improvement 3"
  ],
  "risks": [
    "Potential risk or downside 1",
    "Potential risk or downside 2"
  ],
  "comparables": [
    { "title": "Similar successful video", "views": "500K", "channel": "ChannelName" }
  ]
}`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let analysis;
        try { analysis = JSON.parse(text); }
        catch { analysis = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...analysis,
          title: title || topic,
          model: modelName,
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          },
          analyzedAt: new Date().toISOString(),
        });
      } catch (err) {
        lastError = err;
        if (err.message?.includes("429")) continue;
        throw err;
      }
    }

    return Response.json({ error: lastError?.message || "All models exhausted" }, { status: 429 });
  } catch (err) {
    console.error("[YOUTUBE/VIRAL-SCORE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
