import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/chapters
 *
 * Auto-generates YouTube chapters from a script or transcript.
 * Body: { content, videoLength, type }
 */
export async function POST(req) {
  try {
    const {
      content,
      videoLength = "10:00",
      type = "script",
      title = "",
    } = await req.json();

    if (!content) return Response.json({ error: "content is required" }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a YouTube chapter generation expert. Analyze this ${type} and create optimal YouTube chapters.

${title ? `Video Title: "${title}"` : ""}
Estimated Video Length: ${videoLength}

${type === "transcript" ? "Transcript" : "Script"}:
---
${content.substring(0, 8000)}
---

Create YouTube chapters that:
- Start at 0:00 (required by YouTube)
- Have 5-12 chapters for a typical video (adjust based on content)
- Use clear, SEO-friendly chapter titles (3-8 words)
- Group related content logically
- Help viewers navigate to specific sections
- Distribute timestamps evenly based on estimated video length

Return a JSON object (no markdown, no code fences):
{
  "chapters": [
    { "timestamp": "0:00", "title": "Introduction", "description": "Brief description of this section" },
    { "timestamp": "1:30", "title": "Chapter Title", "description": "Brief description" }
  ],
  "description": "The full chapter list formatted for YouTube description (just timestamps and titles, one per line)",
  "pinnedComment": "A formatted pinned comment version with emojis and section links",
  "seoKeywords": ["keyword1", "keyword2"],
  "contentSummary": "One paragraph summary of the entire content"
}`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.5 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let data;
        try { data = JSON.parse(text); }
        catch { data = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...data,
          title: title || null,
          videoLength,
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
    console.error("[YOUTUBE/CHAPTERS]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
