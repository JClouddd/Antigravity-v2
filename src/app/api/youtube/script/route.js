import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/script
 *
 * Generates a full video script using Gemini.
 * Body: { topic, type, length, style, channelContext, templateStructure }
 */
export async function POST(req) {
  try {
    const { topic, type = "longform", length = "10min", style = "educational", channelContext = "", templateStructure = null } = await req.json();

    if (!topic) {
      return Response.json({ error: "topic is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const typeInstructions = {
      longform: `Create a detailed ${length} video script. Include timestamps for each section.`,
      shorts: "Create a punchy 30-60 second vertical video script. Every second counts — start with the hook immediately.",
      podcast: "Create podcast episode notes with talking points, segues, and audience engagement moments.",
      live: "Create a livestream outline with key talking points, audience interaction moments, and segment transitions.",
      community: "Create a compelling community post (text + optional poll) that drives engagement.",
    };

    const templateGuide = templateStructure
      ? `Follow this template structure:\n- Hook: ${templateStructure.hook || "Attention-grabbing opening"}\n- Intro: ${templateStructure.intro || "Context setting"}\n- Sections: ${JSON.stringify(templateStructure.sections || [])}\n- CTA: ${templateStructure.cta || "Call to action"}\n- Outro: ${templateStructure.outro || "Wrap up"}`
      : "";

    const prompt = `You are an expert YouTube script writer. Generate a complete, production-ready video script.

Topic: ${topic}
Video Type: ${type}
Target Length: ${length}
Style: ${style}
${channelContext ? `Channel Context: ${channelContext}` : ""}
${templateGuide}

${typeInstructions[type] || typeInstructions.longform}

Format the script with these sections:
1. **HOOK** (first 3-5 seconds — must stop the scroll)
2. **INTRO** (set context, tell them what they'll learn)
3. **MAIN CONTENT** (3-5 key sections with clear transitions)
4. **CTA** (what to do next — subscribe, comment, etc.)
5. **OUTRO** (memorable close)

For each section include:
- [TIMESTAMP] approximate timing
- [VISUAL] what should be on screen
- [SCRIPT] exact words to say
- [B-ROLL] suggested b-roll/graphics

Make the script engaging, conversational, and optimized for YouTube retention. Use pattern interrupts every 30-60 seconds.`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.8 },
        });

        const script = result.response.text();

        return Response.json({
          script,
          topic,
          type,
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
    console.error("[YOUTUBE/SCRIPT]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
