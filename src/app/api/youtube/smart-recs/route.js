import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

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
 * POST /api/youtube/smart-recs
 *
 * Self-learning recommendation engine. Ingests ALL analytics across
 * the system, stores patterns, and generates personalized recommendations
 * that improve over time.
 *
 * Actions:
 * - "generate": Generate new recommendations based on all data
 * - "feedback": User marks a recommendation as helpful/not helpful (learning)
 * - "history": Get past recommendations and outcomes
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const recsRef = db.collection("users").doc(userId).collection("youtube_recs");
    const patternsRef = db.collection("users").doc(userId).collection("youtube_patterns");

    /* ── Submit feedback (learning) ── */
    if (action === "feedback") {
      const { recId, helpful, outcome, notes } = body;
      if (!recId) return Response.json({ error: "recId required" }, { status: 400 });

      await recsRef.doc(recId).update({
        feedback: {
          helpful: !!helpful,
          outcome: outcome || "",
          notes: notes || "",
          submittedAt: new Date().toISOString(),
        },
      });

      // Store the learning pattern
      const recDoc = await recsRef.doc(recId).get();
      if (recDoc.exists) {
        const rec = recDoc.data();
        await patternsRef.add({
          type: rec.category || "general",
          recommendation: rec.title || "",
          wasHelpful: !!helpful,
          context: rec.context || "",
          outcome: outcome || "",
          createdAt: new Date().toISOString(),
        });
      }

      return Response.json({ success: true, recId, learned: true });
    }

    /* ── Get recommendation history ── */
    if (action === "history") {
      const { limit: queryLimit } = body;
      const snapshot = await recsRef.orderBy("generatedAt", "desc").limit(queryLimit || 50).get();
      const recs = [];
      snapshot.forEach(doc => recs.push({ id: doc.id, ...doc.data() }));

      // Get learning stats
      const patternsSnapshot = await patternsRef.get();
      let totalRecs = 0;
      let helpfulCount = 0;
      const categoryStats = {};
      patternsSnapshot.forEach(doc => {
        const p = doc.data();
        totalRecs++;
        if (p.wasHelpful) helpfulCount++;
        if (!categoryStats[p.type]) categoryStats[p.type] = { total: 0, helpful: 0 };
        categoryStats[p.type].total++;
        if (p.wasHelpful) categoryStats[p.type].helpful++;
      });

      return Response.json({
        recommendations: recs,
        learningStats: {
          totalRecommendations: totalRecs,
          helpfulRate: totalRecs > 0 ? Math.round((helpfulCount / totalRecs) * 100) : 0,
          categoryStats,
        },
      });
    }

    /* ── Generate recommendations ── */
    if (action === "generate") {
      if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const {
        analytics,      // Current channel analytics
        channelData,    // Channel info
        costs,          // Production costs
        apiCosts,       // API usage costs
        recentVideos,   // Recent video performance
        competitorData, // Competitor insights
        nicheFocus,     // Current niche
      } = body;

      // Retrieve past patterns for self-learning context
      const patternsSnapshot = await patternsRef.orderBy("createdAt", "desc").limit(50).get();
      const patterns = [];
      patternsSnapshot.forEach(doc => patterns.push(doc.data()));

      const helpfulPatterns = patterns.filter(p => p.wasHelpful).map(p => p.recommendation);
      const unhelpfulPatterns = patterns.filter(p => !p.wasHelpful).map(p => p.recommendation);

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const prompt = `You are a self-learning YouTube strategy AI. You improve recommendations based on past feedback.

CURRENT DATA:
${analytics ? `Analytics: ${JSON.stringify(analytics)}` : "No analytics available"}
${channelData ? `Channels: ${JSON.stringify(channelData)}` : "No channel data"}
${costs ? `Production costs: ${JSON.stringify(costs)}` : "No cost data"}
${apiCosts ? `API costs: $${apiCosts}/month` : "No API cost data"}
${recentVideos ? `Recent videos: ${JSON.stringify(recentVideos)}` : "No recent video data"}
${competitorData ? `Competitors: ${JSON.stringify(competitorData)}` : "No competitor data"}
${nicheFocus ? `Niche: ${nicheFocus}` : "No niche specified"}

LEARNING CONTEXT (past feedback):
${helpfulPatterns.length > 0 ? `User found these HELPFUL: ${helpfulPatterns.slice(0, 10).join(", ")}` : "No feedback yet — first session"}
${unhelpfulPatterns.length > 0 ? `User found these NOT HELPFUL (avoid similar): ${unhelpfulPatterns.slice(0, 10).join(", ")}` : ""}

Generate personalized, actionable recommendations. Weight toward what the user found helpful before.

Return a JSON object (no markdown, no code fences):
{
  "recommendations": [
    {
      "id": "rec_1",
      "category": "content|growth|monetization|cost_optimization|engagement|seo|scheduling",
      "priority": "critical|high|medium|low",
      "title": "Short actionable title",
      "description": "Detailed explanation with specific numbers",
      "expectedImpact": {
        "metric": "views|subscribers|revenue|costs|engagement",
        "change": "+25%",
        "timeframe": "30 days"
      },
      "steps": ["Step 1", "Step 2", "Step 3"],
      "confidence": 85,
      "dataSource": "What data this recommendation is based on"
    }
  ],
  "systemHealth": {
    "overall": 75,
    "content": 80,
    "growth": 60,
    "monetization": 50,
    "costEfficiency": 70,
    "engagement": 65
  },
  "topPriority": "The single most impactful thing to do right now",
  "weeklyFocus": "What to focus on this week specifically",
  "monthlyGoal": "Realistic goal for the next 30 days",
  "learningNote": "What the AI learned from the feedback patterns"
}

Generate 6-10 recommendations. Mix categories. Prioritize actionable over theoretical. If you have learning context, explicitly adjust your recommendations based on the feedback.`;

      let lastError = null;
      for (const modelName of FALLBACK_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 6144, temperature: 0.6 },
          });

          let text = result.response.text().trim();
          text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

          let data;
          try { data = JSON.parse(text); }
          catch { data = { raw: text }; }

          // Store recommendations for future learning
          if (data.recommendations) {
            const batch = db.batch();
            for (const rec of data.recommendations) {
              const docRef = recsRef.doc();
              batch.set(docRef, {
                ...rec,
                generatedAt: new Date().toISOString(),
                context: { analytics: !!analytics, costs: !!costs, nicheFocus },
                feedback: null,
              });
            }
            await batch.commit();
          }

          return Response.json({
            ...data,
            learningContext: {
              totalPastRecs: patterns.length,
              helpfulCount: helpfulPatterns.length,
              unhelpfulCount: unhelpfulPatterns.length,
              isLearning: patterns.length > 0,
            },
            model: modelName,
            generatedAt: new Date().toISOString(),
          });
        } catch (err) {
          lastError = err;
          if (err.message?.includes("429")) continue;
          throw err;
        }
      }
      return Response.json({ error: lastError?.message || "All models exhausted" }, { status: 429 });
    }

    return Response.json({ error: "action must be: generate, feedback, or history" }, { status: 400 });
  } catch (err) {
    console.error("[YOUTUBE/SMART-RECS]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
