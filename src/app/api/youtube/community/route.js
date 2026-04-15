import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/community
 *
 * Generates community tab post drafts (text, poll, quiz).
 * YouTube API doesn't support creating community posts directly,
 * so this generates ready-to-paste drafts.
 *
 * Body: { topic, postType, channelNiche, recentVideoTitle, tone }
 */
export async function POST(req) {
  try {
    const {
      topic = "",
      postType = "mixed",
      channelNiche = "",
      recentVideoTitle = "",
      tone = "engaging",
      count = 5,
    } = await req.json();

    if (!topic && !channelNiche) {
      return Response.json({ error: "topic or channelNiche required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const postTypeDesc = {
      text: "Text-only community posts that spark discussion",
      poll: "Polls with 2-4 options that drive engagement",
      quiz: "Quiz-style posts that test knowledge",
      image: "Posts designed to accompany an image (include image description)",
      mixed: "A mix of text posts, polls, and quizzes",
    };

    const prompt = `You are a YouTube community management expert. Generate ${count} community tab posts.

${topic ? `Topic Focus: ${topic}` : ""}
${channelNiche ? `Channel Niche: ${channelNiche}` : ""}
${recentVideoTitle ? `Latest Video: "${recentVideoTitle}" (reference this naturally)` : ""}
Post Type: ${postTypeDesc[postType] || postTypeDesc.mixed}
Tone: ${tone}

Return a JSON array (no markdown, no code fences) with ${count} objects:
[
  {
    "type": "text|poll|quiz|image",
    "content": "The post content (use emojis, line breaks with \\n)",
    "pollOptions": ["Option A", "Option B", "Option C", "Option D"],
    "quizAnswer": "The correct answer if quiz type",
    "imagePrompt": "Suggested image description if image type",
    "bestTime": "Best day/time to post",
    "estimatedEngagement": "high|medium|low",
    "strategy": "Why this post will drive engagement",
    "hashtags": ["#tag1", "#tag2"]
  }
]

Rules:
- Text posts: 1-3 paragraphs, end with a question or CTA
- Polls: Exactly 2-4 options, make them fun and relatable
- Quizzes: Educational, include the answer reveal
- Always include emojis for visual appeal
- Reference recent videos when natural
- ${postType === "mixed" ? "Include at least 1 poll, 1 text, and 1 quiz" : ""}
- Posts should feel authentic, not overly promotional
- Include strategic hashtags`;

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

        let posts;
        try { posts = JSON.parse(text); }
        catch { posts = [{ raw: text, error: "Parse failed" }]; }

        return Response.json({
          posts,
          topic: topic || channelNiche,
          postType,
          model: modelName,
          note: "YouTube API does not support creating community posts programmatically. Copy these drafts into YouTube Studio → Community tab.",
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
    console.error("[YOUTUBE/COMMUNITY]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
