import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Gemini Chat API Route ───────────────────────────────────────────────────
// General-purpose Gemini endpoint with retry logic and model fallback.

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
const MAX_RETRIES = 2;

export async function POST(req) {
  try {
    const { messages, systemPrompt, model: requestedModel } = await req.json();

    if (!messages || !messages.length) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured. Add it in Vercel → Settings → Environment Variables." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const userContent = messages.map(m => m.content).join("\n\n");
    const systemInstruction = systemPrompt || undefined;

    // Build model priority — requested first, then fallbacks
    const modelsToTry = requestedModel
      ? [requestedModel, ...FALLBACK_MODELS.filter(m => m !== requestedModel)]
      : [...FALLBACK_MODELS];

    let lastError = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });

          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            systemInstruction,
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.7,
            },
          });

          const response = result.response.text();

          return Response.json({
            response,
            model: modelName,
            attempt: attempt + 1,
            usage: {
              promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
              completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
              totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
            },
          });
        } catch (err) {
          lastError = err;
          const is429 = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("Too Many Requests");

          if (is429 && attempt < MAX_RETRIES) {
            // Wait before retry (exponential backoff)
            const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.log(`[GEMINI] Rate limited on ${modelName}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          if (is429) {
            // Move to next model
            console.log(`[GEMINI] ${modelName} exhausted, trying next model...`);
            break;
          }

          // Non-rate-limit error, throw immediately
          throw err;
        }
      }
    }

    // All models exhausted
    const isQuotaError = lastError?.message?.includes("429") || lastError?.message?.includes("quota");
    return Response.json({
      error: isQuotaError
        ? "Rate limit exceeded on all models. If you're on the free tier, enable billing at https://aistudio.google.com to remove limits (~$0.001 per query). Or wait a minute and try again."
        : lastError?.message || "Unknown error",
    }, { status: isQuotaError ? 429 : 500 });

  } catch (error) {
    console.error("[GEMINI] chat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
