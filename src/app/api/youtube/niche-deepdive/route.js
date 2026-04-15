import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/niche-deepdive
 *
 * Deep analysis of a specific niche. Breaks down evergreen vs trending,
 * sub-niches, content pillars, competitor gaps, and year-round content calendar.
 *
 * Body: { niche, depth? }
 */
export async function POST(req) {
  try {
    const {
      niche,
      depth = "full",
    } = await req.json();

    if (!niche) return Response.json({ error: "niche is required" }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const prompt = `You are a YouTube niche intelligence analyst with deep knowledge of the "${niche}" space as of 2026.

Perform a comprehensive deep-dive analysis of the "${niche}" YouTube niche.

Return a JSON object (no markdown, no code fences):
{
  "niche": "${niche}",
  "overview": {
    "description": "Detailed description of this niche landscape on YouTube",
    "marketSize": "small|medium|large|massive",
    "maturityStage": "emerging|growing|mature|saturated",
    "estimatedCPM": { "low": "$X", "average": "$Y", "high": "$Z" },
    "avgRevenuePerVideo": "Estimate for 100K view video",
    "totalCreators": "Estimated number of active creators",
    "audienceSize": "Estimated total addressable audience"
  },
  "contentSustainability": {
    "evergreenPercentage": 65,
    "trendingPercentage": 35,
    "evergreenTopics": [
      { "topic": "Topic name", "searchVolume": "high", "competition": "medium", "lifespan": "Years of relevance", "exampleTitle": "Specific video title" }
    ],
    "trendingTopics": [
      { "topic": "Trending topic", "window": "How long this trend will last", "urgency": "high|medium|low", "risk": "Risk if you miss this window", "exampleTitle": "Specific video title" }
    ],
    "seasonalPatterns": [
      { "months": "Jan-Mar", "trend": "What happens in this niche during these months", "opportunity": "What to create" }
    ],
    "decayRisk": "low|medium|high — how quickly content becomes outdated"
  },
  "subNiches": [
    {
      "name": "Sub-niche name",
      "competition": "low|medium|high",
      "profitability": "low|medium|high",
      "description": "Why this sub-niche is interesting",
      "gapOpportunity": "What existing creators are missing"
    }
  ],
  "contentPillars": [
    {
      "pillar": "Content pillar name",
      "description": "What this pillar covers",
      "frequency": "How often to publish this type",
      "evergreen": true,
      "examples": ["Video title 1", "Video title 2", "Video title 3"]
    }
  ],
  "competitorAnalysis": {
    "topCreators": [
      { "name": "Channel name", "subscribers": "~500K", "avgViews": "~50K", "strength": "What they do well", "weakness": "What they're missing", "contentFrequency": "2x/week" }
    ],
    "marketGaps": [
      "Gap in the market 1",
      "Gap in the market 2",
      "Gap in the market 3"
    ],
    "differentiationAngles": [
      "How to stand out 1",
      "How to stand out 2"
    ]
  },
  "monetization": {
    "primaryRevenue": [
      { "method": "Method name", "potential": "$X/month at 100K subs", "difficulty": "easy|medium|hard", "notes": "Specific advice" }
    ],
    "sponsorTypes": ["Type of sponsor 1", "Type of sponsor 2"],
    "affiliatePrograms": ["Program 1", "Program 2"],
    "productOpportunities": ["Digital product idea 1", "Course idea"],
    "totalPotential": "Estimated monthly revenue at 100K subscribers"
  },
  "yearPlan": {
    "month1to3": { "focus": "What to focus on", "videoCount": 20, "milestones": ["Milestone 1", "Milestone 2"] },
    "month4to6": { "focus": "What to focus on", "videoCount": 25, "milestones": ["Milestone 1", "Milestone 2"] },
    "month7to12": { "focus": "What to focus on", "videoCount": 50, "milestones": ["Milestone 1", "Milestone 2"] }
  },
  "risks": [
    { "risk": "Risk name", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "How to mitigate" }
  ],
  "verdict": {
    "recommendation": "strong_yes|yes|maybe|no|strong_no",
    "confidence": 85,
    "summary": "2-3 sentence final recommendation",
    "bestFor": "Who this niche is ideal for",
    "avoidIf": "Who should avoid this niche"
  }
}

Be highly specific and realistic. Use real channel names, real CPM data, real trends. Don't be overly optimistic — include genuine risks and honest competition assessments.`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.6 },
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
    console.error("[YOUTUBE/NICHE-DEEPDIVE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
