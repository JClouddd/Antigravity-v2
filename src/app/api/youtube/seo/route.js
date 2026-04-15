import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/seo
 *
 * Optimize video title, tags, and description using Gemini.
 * Body: { title, topic, niche, description }
 */
export async function POST(req) {
  try {
    const { title, topic, niche = "", description = "" } = await req.json();

    if (!title && !topic) {
      return Response.json({ error: "title or topic is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a YouTube SEO expert. Analyze and optimize this video for maximum discoverability and CTR.

${title ? `Working Title: "${title}"` : `Topic: "${topic}"`}
${niche ? `Niche: ${niche}` : ""}
${description ? `Current Description: ${description}` : ""}

Return a JSON object with this exact structure (no markdown, no code fences, just raw JSON):
{
  "titles": [
    {"text": "title option 1", "score": 92, "reason": "why this works"},
    {"text": "title option 2", "score": 88, "reason": "why this works"},
    {"text": "title option 3", "score": 85, "reason": "why this works"},
    {"text": "title option 4", "score": 82, "reason": "why this works"},
    {"text": "title option 5", "score": 78, "reason": "why this works"}
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "description": "Optimized description with front-loaded keywords (first 150 chars are critical), timestamps template, and relevant links section",  
  "analysis": {
    "searchVolume": "estimated search demand (low/medium/high)",
    "competition": "estimated competition level (low/medium/high)",
    "opportunity": "overall opportunity score 1-100",
    "tips": ["tip 1", "tip 2", "tip 3"]
  }
}

Rules for titles:
- Use number hooks when possible (e.g., "7 Ways to...")
- Keep under 60 characters
- Put the keyword in the first 3 words
- Use emotional triggers (surprising, shocking, easy, secret)
- Avoid clickbait that doesn't deliver

Rules for tags:
- Mix broad and specific tags
- Include the main keyword and variations
- Add related search terms
- 10 total tags, ordered by relevance

Rules for description:
- Front-load the most important keywords (YouTube only shows first 150 chars)
- Include a clear value proposition in line 1
- Add a structured timestamp template
- Include relevant hashtags (3 max)`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        });

        let text = result.response.text().trim();
        // Strip markdown code fences if present
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let seoData;
        try {
          seoData = JSON.parse(text);
        } catch {
          // If the response isn't valid JSON, wrap it
          seoData = { raw: text, error: "Failed to parse structured response" };
        }

        return Response.json({
          ...seoData,
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
    console.error("[YOUTUBE/SEO]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
