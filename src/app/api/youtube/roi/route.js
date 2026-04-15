import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/* ── Firebase Admin (server-side) ── */
function getDb() {
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      initializeApp({ credential: cert(JSON.parse(cred)) });
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];

/**
 * POST /api/youtube/roi
 *
 * YouTube ROI Calculator + Cost Tracker.
 * Actions: "calculate", "log-cost", "get-costs", "summary"
 *
 * calculate: AI analyzes costs vs revenue for a video/channel
 * log-cost: Store a production cost entry
 * get-costs: Retrieve logged costs
 * summary: Full P&L summary across all channels
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const costsRef = db.collection("users").doc(userId).collection("youtube_costs");

    /* ── Log a production cost ── */
    if (action === "log-cost") {
      const { category, description, amount, channelId, videoId, date } = body;
      if (!category || !amount) return Response.json({ error: "category and amount required" }, { status: 400 });

      const entry = {
        category, // equipment, editing, music, talent, ads, software, outsource, api, other
        description: description || "",
        amount: Number(amount),
        channelId: channelId || "",
        videoId: videoId || "",
        date: date || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      };

      const ref = await costsRef.add(entry);
      return Response.json({ success: true, costId: ref.id, ...entry });
    }

    /* ── Get logged costs ── */
    if (action === "get-costs") {
      const { channelId, startDate, endDate, limit: queryLimit } = body;
      let query = costsRef.orderBy("date", "desc");
      if (channelId) query = query.where("channelId", "==", channelId);
      if (queryLimit) query = query.limit(Number(queryLimit));

      const snapshot = await query.get();
      const costs = [];
      snapshot.forEach(doc => costs.push({ id: doc.id, ...doc.data() }));

      // Filter by date range in memory (Firestore compound queries need indexes)
      const filtered = costs.filter(c => {
        if (startDate && c.date < startDate) return false;
        if (endDate && c.date > endDate) return false;
        return true;
      });

      const totalCost = filtered.reduce((sum, c) => sum + c.amount, 0);
      const byCategory = {};
      filtered.forEach(c => { byCategory[c.category] = (byCategory[c.category] || 0) + c.amount; });

      return Response.json({
        costs: filtered,
        totalCost,
        byCategory,
        count: filtered.length,
      });
    }

    /* ── Delete a cost entry ── */
    if (action === "delete-cost") {
      const { costId } = body;
      if (!costId) return Response.json({ error: "costId required" }, { status: 400 });
      await costsRef.doc(costId).delete();
      return Response.json({ success: true, deleted: costId });
    }

    /* ── Full P&L Summary with AI ── */
    if (action === "summary" || action === "calculate") {
      if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      // Get all costs
      const costSnapshot = await costsRef.orderBy("date", "desc").limit(200).get();
      const allCosts = [];
      costSnapshot.forEach(doc => allCosts.push({ id: doc.id, ...doc.data() }));

      const totalCosts = allCosts.reduce((sum, c) => sum + c.amount, 0);
      const costsByCategory = {};
      allCosts.forEach(c => { costsByCategory[c.category] = (costsByCategory[c.category] || 0) + c.amount; });

      // Get analytics data if available
      const { revenue, subscribers, views, channelData, apiCosts } = body;

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const prompt = `You are a YouTube business analyst. Analyze this creator's cost vs. revenue data and provide strategic recommendations.

PRODUCTION COSTS (logged):
Total: $${totalCosts.toFixed(2)}
By category: ${JSON.stringify(costsByCategory)}
Recent entries: ${JSON.stringify(allCosts.slice(0, 20).map(c => ({ cat: c.category, desc: c.description, amount: c.amount, date: c.date })))}

REVENUE DATA (if available):
${revenue ? `Monthly revenue: $${revenue}` : "Not provided — estimate based on views/subs"}
${subscribers ? `Subscribers: ${subscribers}` : ""}
${views ? `Monthly views: ${views}` : ""}
${channelData ? `Channel details: ${JSON.stringify(channelData)}` : ""}

API/INFRASTRUCTURE COSTS:
${apiCosts ? `Monthly API costs: $${apiCosts}` : "Not tracked separately"}

Return a JSON object (no markdown, no code fences):
{
  "profitAndLoss": {
    "totalRevenue": 0,
    "totalCosts": ${totalCosts.toFixed(2)},
    "apiCosts": 0,
    "netProfit": 0,
    "profitMargin": "0%",
    "breakEvenPoint": "When they'll break even",
    "monthlyBurnRate": 0
  },
  "costAnalysis": {
    "biggestExpense": "Category name",
    "unnecessaryCosts": ["Cost that could be cut"],
    "underInvested": ["Area that needs more investment"],
    "costPerVideo": 0,
    "costPerSubscriber": 0,
    "costPer1000Views": 0
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "cost_reduction|revenue_increase|efficiency|investment",
      "title": "Recommendation title",
      "description": "What to do and why",
      "estimatedImpact": "$X/month saved or earned",
      "effort": "easy|medium|hard"
    }
  ],
  "projections": {
    "month3": { "costs": 0, "revenue": 0, "profit": 0 },
    "month6": { "costs": 0, "revenue": 0, "profit": 0 },
    "month12": { "costs": 0, "revenue": 0, "profit": 0 }
  },
  "healthScore": 75,
  "healthLabel": "healthy|watch|warning|critical",
  "keyInsight": "One-sentence most important takeaway"
}

Be realistic. Factor in typical YouTube RPM rates for the likely niche. Account for the time value of the creator's effort.`;

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
          catch { data = { raw: text }; }

          return Response.json({
            ...data,
            rawCosts: { total: totalCosts, byCategory: costsByCategory, count: allCosts.length },
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
    }

    return Response.json({ error: "action must be: log-cost, get-costs, delete-cost, summary, or calculate" }, { status: 400 });
  } catch (err) {
    console.error("[YOUTUBE/ROI]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
