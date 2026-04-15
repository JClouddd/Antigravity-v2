import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/sentiment
 *
 * Bulk comment sentiment analysis.
 * Body: { videoId } or { comments: ["text1", "text2", ...] }
 * If videoId provided with Authorization header, fetches comments automatically.
 */
export async function POST(req) {
  try {
    let { comments: rawComments, videoId } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // If videoId provided, fetch comments from YouTube
    if (videoId && !rawComments) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return Response.json({ error: "videoId requires Authorization header" }, { status: 401 });
      }
      const accessToken = authHeader.replace("Bearer ", "");

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=100&textFormat=plainText`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `Comments fetch failed: ${res.status}`, detail: err }, { status: res.status });
      }

      const data = await res.json();
      rawComments = (data.items || []).map(item => ({
        id: item.id,
        author: item.snippet?.topLevelComment?.snippet?.authorDisplayName || "",
        text: item.snippet?.topLevelComment?.snippet?.textDisplay || "",
        likes: item.snippet?.topLevelComment?.snippet?.likeCount || 0,
      }));
    }

    if (!rawComments || rawComments.length === 0) {
      return Response.json({ error: "No comments to analyze" }, { status: 400 });
    }

    // Format for AI — handle both string array and object array
    const commentTexts = rawComments.map((c, i) => {
      if (typeof c === "string") return `${i + 1}. ${c}`;
      return `${i + 1}. [${c.author || "Anon"}] ${c.text}`;
    }).join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a sentiment analysis expert. Analyze these ${rawComments.length} YouTube comments.

${commentTexts}

Return a JSON object (no markdown, no code fences):
{
  "overall": {
    "sentiment": "positive|negative|mixed|neutral",
    "score": 78,
    "summary": "One sentence summary of overall audience mood"
  },
  "breakdown": {
    "positive": 65,
    "neutral": 20,
    "negative": 10,
    "questions": 5
  },
  "themes": [
    { "theme": "Theme name", "count": 12, "sentiment": "positive", "examples": ["example comment"] }
  ],
  "topPraise": ["What viewers love most 1", "What viewers love most 2", "What viewers love most 3"],
  "topComplaints": ["Common complaint 1", "Common complaint 2"],
  "topQuestions": ["Most asked question 1", "Most asked question 2", "Most asked question 3"],
  "actionItems": [
    "Specific action based on comment analysis 1",
    "Specific action based on comment analysis 2",
    "Specific action based on comment analysis 3"
  ],
  "toxicComments": [
    { "index": 5, "text": "The toxic comment", "reason": "Why it's problematic" }
  ],
  "engagementInsights": {
    "mostEngaging": "What type of responses get the most likes",
    "communityHealth": "healthy|growing|declining|toxic",
    "recommendedResponse": "How the creator should respond to the overall sentiment"
  }
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

        let analysis;
        try { analysis = JSON.parse(text); }
        catch { analysis = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...analysis,
          videoId: videoId || null,
          commentsAnalyzed: rawComments.length,
          model: modelName,
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
    console.error("[YOUTUBE/SENTIMENT]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
