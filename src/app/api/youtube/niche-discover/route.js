import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/niche-discover
 *
 * AI-powered niche discovery engine. Takes interests, skills, and goals
 * and generates profitable YouTube niche recommendations.
 *
 * Body: { interests?, skills?, contentStyle?, budget?, goal?, count? }
 */
export async function POST(req) {
  try {
    const {
      interests = [],
      skills = [],
      contentStyle = "any",
      budget = "low",
      goal = "revenue",
      count = 8,
      excludeNiches = [],
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const interestsText = interests.length ? `Interests: ${interests.join(", ")}` : "No specific interests (explore all)";
    const skillsText = skills.length ? `Skills: ${skills.join(", ")}` : "No specific skills";
    const excludeText = excludeNiches.length ? `\nExclude these niches (already explored): ${excludeNiches.join(", ")}` : "";

    const goalDescriptions = {
      revenue: "Maximize ad revenue and sponsorships (high CPM niches)",
      growth: "Maximize subscriber growth speed",
      passive: "Build passive income with evergreen content",
      authority: "Build expertise and authority for consulting/courses",
      fun: "Maximum creative freedom while still being profitable",
    };

    const budgetDescriptions = {
      zero: "Zero budget — phone only, no equipment",
      low: "Low budget — basic camera, free editing software",
      medium: "Medium budget — good camera, lighting, paid tools",
      high: "High budget — professional equipment, team, studio",
    };

    const styleDescriptions = {
      any: "Open to any content style",
      faceless: "Faceless content only (no on-camera appearance)",
      talking_head: "Talking head / vlog style",
      tutorial: "Tutorial / how-to / educational",
      entertainment: "Entertainment / reaction / commentary",
      documentary: "Documentary / essay style",
      shorts: "YouTube Shorts focused",
      automated: "Highly automated / AI-assisted content",
    };

    const prompt = `You are a YouTube niche research expert and business strategist with knowledge of CPM rates, audience demographics, advertiser demand, and content trends as of 2026.

${interestsText}
${skillsText}
Content Style: ${styleDescriptions[contentStyle] || contentStyle}
Budget Level: ${budgetDescriptions[budget] || budget}
Primary Goal: ${goalDescriptions[goal] || goal}${excludeText}

Generate ${count} profitable YouTube niche recommendations. For EACH niche, provide deep analysis.

Return a JSON object (no markdown, no code fences):
{
  "niches": [
    {
      "name": "Niche Name",
      "slug": "niche-slug",
      "description": "2-3 sentence description of this niche and why it's a good opportunity",
      "profitabilityScore": 85,
      "competitionLevel": "medium",
      "growthPotential": "high",
      "estimatedCPM": "$8-15",
      "monthlySearchVolume": "high",
      "timeToMonetization": "3-6 months",
      "evergreen": 70,
      "trending": 30,
      "contentTypes": ["tutorials", "reviews", "listicles"],
      "exampleChannels": ["Channel Name 1 (~500K subs)", "Channel Name 2 (~100K subs)"],
      "topKeywords": ["keyword 1", "keyword 2", "keyword 3"],
      "audienceProfile": {
        "ageRange": "25-44",
        "gender": "65% male",
        "interests": ["tech", "productivity"],
        "buyingPower": "high"
      },
      "monetizationPaths": [
        { "method": "AdSense", "potential": "high", "note": "High CPM tech niche" },
        { "method": "Sponsorships", "potential": "high", "note": "SaaS companies pay well" },
        { "method": "Affiliate", "potential": "medium", "note": "Amazon + software affiliates" }
      ],
      "risks": ["Risk 1", "Risk 2"],
      "quickStartPlan": "3-4 sentences on how to start this niche immediately",
      "contentIdeas": ["Video idea 1", "Video idea 2", "Video idea 3"]
    }
  ],
  "insights": {
    "bestOverall": "niche-slug of the best option overall",
    "bestForBeginners": "niche-slug easiest to start",
    "highestCPM": "niche-slug with highest CPM",
    "fastestGrowth": "niche-slug with fastest growth potential",
    "mostEvergreen": "niche-slug with most evergreen content"
  },
  "marketTrends": [
    "Trend observation 1 about YouTube in 2026",
    "Trend observation 2",
    "Trend observation 3"
  ]
}

Rules:
- Profitability score: 0-100 based on CPM, audience buying power, sponsor interest, and scalability
- Competition level: low/medium/high/saturated
- Growth potential: low/medium/high/explosive
- Evergreen + trending should add up to 100
- Include at least 2 real example channels per niche
- Be specific about CPM ranges (use realistic 2025-2026 data)
- Content ideas should be specific, not generic
- Consider the user's budget and content style constraints
- Rank niches by profitability score (highest first)`;

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.8 },
        });

        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let data;
        try { data = JSON.parse(text); }
        catch { data = { raw: text, error: "Parse failed" }; }

        return Response.json({
          ...data,
          query: { interests, skills, contentStyle, budget, goal },
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
    console.error("[YOUTUBE/NICHE-DISCOVER]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
