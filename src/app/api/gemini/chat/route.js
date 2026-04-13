import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Gemini Chat API Route ───────────────────────────────────────────────────
// General-purpose Gemini endpoint. Used by AI Advisor and other features.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req) {
  try {
    const { messages, systemPrompt, model: requestedModel } = await req.json();

    if (!messages || !messages.length) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const modelName = requestedModel || "gemini-2.0-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    // Build content from messages
    const systemInstruction = systemPrompt || "";
    const userContent = messages.map(m => m.content).join("\n\n");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    });

    const response = result.response.text();

    return Response.json({
      response,
      model: modelName,
      usage: {
        promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
        completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
      },
    });
  } catch (error) {
    console.error("[GEMINI] chat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
