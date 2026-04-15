import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/thumbnail-analyze
 *
 * Analyzes a thumbnail concept or existing thumbnail strategy.
 * Generates thumbnail composition recommendations.
 * Body: { title, niche, style, competitorTitles }
 */
export async function POST(req) {
  try {
    const {
      title,
      niche = "",
      style = "modern",
      competitorTitles = [],
    } = await req.json();

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const competitorContext = competitorTitles.length > 0
      ? `\n\nCompetitor video titles for reference:\n${competitorTitles.map(t => `- ${t}`).join("\n")}`
      : "";

    const prompt = `You are a YouTube thumbnail design expert. Create detailed thumbnail recommendations.

Video Title: "${title}"
${niche ? `Niche: ${niche}` : ""}
Desired Style: ${style}${competitorContext}

Return a JSON object (no markdown, no code fences):
{
  "concepts": [
    {
      "name": "Concept name",
      "layout": "Description of the thumbnail layout and composition",
      "textOverlay": "Exact text to put on the thumbnail (2-4 words max)",
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "faceExpression": "e.g. shocked, confident, curious",
      "elements": ["list", "of", "visual", "elements"],
      "ctrScore": 85
    }
  ],
  "principles": [
    "Thumbnail design principle 1",
    "Thumbnail design principle 2"
  ],
  "avoidList": [
    "Things to avoid in this thumbnail"
  ],
  "abTestPlan": {
    "variantA": "Description of variant A",
    "variantB": "Description of variant B",
    "metric": "What to measure",
    "duration": "Recommended test duration"
  }
}

Rules for great thumbnails:
- Maximum 3-4 words of text overlay
- High contrast colors that stand out in small sizes
- Human faces increase CTR by 30-40%
- Use the rule of thirds for composition
- Create visual curiosity/tension
- Avoid clutter — simplicity wins
- Design for mobile (small screen)
- Generate 3 distinct concepts with different approaches`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.8 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let analysis;
        try {
          analysis = JSON.parse(text);
        } catch {
          analysis = { raw: text, error: "Failed to parse analysis" };
        }

        return Response.json({
          ...analysis,
          title,
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
    console.error("[YOUTUBE/THUMBNAIL]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
