import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/decision-fork
 *
 * Parallel scenario simulator. Takes a decision point and explores
 * multiple branches simultaneously, comparing outcomes.
 *
 * Body: { decision, branches?, timeframe?, context? }
 */
export async function POST(req) {
  try {
    const {
      decision,
      branches = 4,
      timeframe = "12 months",
      context = "",
    } = await req.json();

    if (!decision) return Response.json({ error: "decision is required" }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a strategic decision simulator for YouTube creators. You explore multiple parallel paths for a decision and compare their outcomes.

DECISION POINT: "${decision}"
${context ? `CONTEXT: ${context}` : ""}
NUMBER OF BRANCHES: ${branches}
TIMEFRAME: ${timeframe}

Explore ${branches} different possible paths/choices for this decision. For each branch, simulate a realistic timeline of what happens if the creator takes that path.

Return a JSON object (no markdown, no code fences):
{
  "decision": "${decision}",
  "branches": [
    {
      "name": "Branch Name",
      "description": "What this path involves",
      "color": "#hex",
      "timeline": [
        { "month": 1, "milestone": "What happens", "subscribers": 100, "revenue": 0, "effort": "10hr/week" },
        { "month": 3, "milestone": "Quarter 1 status", "subscribers": 1500, "revenue": 0, "effort": "12hr/week" },
        { "month": 6, "milestone": "Half year status", "subscribers": 8000, "revenue": 200, "effort": "10hr/week" },
        { "month": 12, "milestone": "One year status", "subscribers": 30000, "revenue": 1500, "effort": "8hr/week" }
      ],
      "projectedOutcome": {
        "subscribers": "~30K",
        "monthlyRevenue": "$1,500",
        "totalInvestment": "$2,000",
        "timePerWeek": "8-12 hours",
        "roi": "positive by month 8"
      },
      "strengths": ["Strength 1", "Strength 2"],
      "risks": ["Risk 1", "Risk 2"],
      "exitOptions": ["What you can do if this doesn't work"],
      "scalability": "high|medium|low",
      "burnoutRisk": "high|medium|low",
      "passiveIncomePotential": "high|medium|low"
    }
  ],
  "comparison": {
    "fastestGrowth": "Branch Name with fastest subscriber growth",
    "highestRevenue": "Branch Name with highest revenue potential",
    "lowestRisk": "Branch Name with lowest risk",
    "bestROI": "Branch Name with best return on investment",
    "recommendation": "Which branch to pick and why (2-3 sentences)"
  },
  "hybridStrategy": {
    "description": "A strategy that combines the best elements of multiple branches",
    "steps": ["Step 1", "Step 2", "Step 3"]
  }
}

Be realistic. Use actual YouTube growth data patterns. Don't over-inflate numbers. Consider the effort/reward ratio honestly. Assign distinct hex colors to each branch for visualization.`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let data;
        try { data = JSON.parse(text); }
        catch { data = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...data,
          model: modelName,
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          },
          simulatedAt: new Date().toISOString(),
        });
      } catch (err) {
        lastError = err;
        if (err.message?.includes("429")) continue;
        throw err;
      }
    }

    return Response.json({ error: lastError?.message || "All models exhausted" }, { status: 429 });
  } catch (err) {
    console.error("[YOUTUBE/DECISION-FORK]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
