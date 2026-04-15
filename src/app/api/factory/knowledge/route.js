import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const GEMINI_KEY = process.env.GEMINI_API_KEY;

/**
 * POST /api/factory/knowledge
 *
 * Self-learning knowledge engine — persistent, queryable, NotebookLM-inspired.
 * Stores knowledge sources in Firestore, retrieves relevant context,
 * and feeds it into Gemini's long context window for conversational queries.
 *
 * Actions: ingest, query, learn, report, sources, delete-source
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const sourcesRef = db.collection("users").doc(userId).collection("knowledge_sources");
    const learningsRef = db.collection("users").doc(userId).collection("knowledge_learnings");
    const queryLogRef = db.collection("users").doc(userId).collection("knowledge_queries");

    /* ── INGEST a knowledge source ── */
    if (action === "ingest") {
      const { title, content, sourceType, sourceUrl, tags, category } = body;
      if (!content) return Response.json({ error: "content required" }, { status: 400 });

      // Summarize long content for indexing
      let summary = content.slice(0, 500);
      if (content.length > 1000 && GEMINI_KEY) {
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `Summarize in 2-3 sentences: ${content.slice(0, 5000)}` }] }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
          });
          summary = result.response.text().trim();
        } catch { /* keep original slice */ }
      }

      const source = {
        title: title || `Source ${Date.now()}`,
        content,
        summary,
        sourceType: sourceType || "text", // text, url, analytics, video_data, competitor, pdf
        sourceUrl: sourceUrl || "",
        tags: tags || [],
        category: category || "general", // strategy, analytics, competitors, costs, niche, content
        tokenEstimate: Math.ceil(content.length / 4),
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      };

      const ref = await sourcesRef.add(source);
      return Response.json({ sourceId: ref.id, title: source.title, summary, tokenEstimate: source.tokenEstimate });
    }

    /* ── QUERY the knowledge base ── */
    if (action === "query") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      const { question, categories, maxSources } = body;
      if (!question) return Response.json({ error: "question required" }, { status: 400 });

      // Retrieve relevant sources
      let query = sourcesRef.orderBy("createdAt", "desc").limit(maxSources || 20);
      const snapshot = await query.get();

      let sources = [];
      snapshot.forEach(doc => sources.push({ id: doc.id, ...doc.data() }));

      // Filter by category if specified
      if (categories?.length) {
        sources = sources.filter(s => categories.includes(s.category));
      }

      // Get recent learnings (what worked, what didn't)
      const learningsSnap = await learningsRef.orderBy("createdAt", "desc").limit(10).get();
      const learnings = [];
      learningsSnap.forEach(doc => learnings.push(doc.data()));

      // Build context window
      const contextParts = sources.map(s =>
        `[${s.category.toUpperCase()}] ${s.title}\n${s.content.slice(0, 2000)}`
      ).join("\n\n---\n\n");

      const learningContext = learnings.length > 0
        ? `\n\nLEARNINGS FROM PAST OUTCOMES:\n${learnings.map(l => `- ${l.insight} (${l.outcome})`).join("\n")}`
        : "";

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const prompt = `You are a YouTube strategy AI with access to a knowledge base. Answer the user's question using ONLY the provided sources. If you don't have enough information, say so.

KNOWLEDGE BASE (${sources.length} sources):
${contextParts}
${learningContext}

USER QUESTION: ${question}

Provide a detailed, actionable answer. Reference specific data points from the sources. If the question involves numbers, provide specific figures.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
      });

      const answer = result.response.text().trim();
      const usage = result.response.usageMetadata;

      // Log the query
      await queryLogRef.add({
        question,
        answer: answer.slice(0, 1000),
        sourcesUsed: sources.length,
        tokens: usage?.totalTokenCount || 0,
        createdAt: new Date().toISOString(),
      });

      // Update access counts
      for (const s of sources) {
        await sourcesRef.doc(s.id).update({
          lastAccessed: new Date().toISOString(),
          accessCount: FieldValue.increment(1),
        });
      }

      return Response.json({
        answer,
        sourcesUsed: sources.map(s => ({ id: s.id, title: s.title, category: s.category })),
        tokens: usage?.totalTokenCount || 0,
      });
    }

    /* ── LEARN from outcomes ── */
    if (action === "learn") {
      const { insight, outcome, category, relatedVideo, relatedChannel } = body;
      if (!insight) return Response.json({ error: "insight required" }, { status: 400 });

      const learning = {
        insight,
        outcome: outcome || "positive",
        category: category || "general",
        relatedVideo: relatedVideo || "",
        relatedChannel: relatedChannel || "",
        createdAt: new Date().toISOString(),
      };

      const ref = await learningsRef.add(learning);
      return Response.json({ learningId: ref.id, ...learning });
    }

    /* ── REPORT — periodic intelligence ── */
    if (action === "report") {
      if (!GEMINI_KEY) return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

      // Gather all knowledge
      const sourcesSnap = await sourcesRef.orderBy("createdAt", "desc").limit(30).get();
      const sources = [];
      sourcesSnap.forEach(doc => sources.push(doc.data()));

      const learningsSnap = await learningsRef.orderBy("createdAt", "desc").limit(20).get();
      const learnings = [];
      learningsSnap.forEach(doc => learnings.push(doc.data()));

      const queriesSnap = await queryLogRef.orderBy("createdAt", "desc").limit(10).get();
      const recentQueries = [];
      queriesSnap.forEach(doc => recentQueries.push(doc.data()));

      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const prompt = `You are a YouTube business intelligence analyst. Generate a weekly intelligence report.

KNOWLEDGE SOURCES (${sources.length}):
${sources.map(s => `- [${s.category}] ${s.title}: ${s.summary || s.content.slice(0, 200)}`).join("\n")}

LEARNINGS (${learnings.length}):
${learnings.map(l => `- ${l.insight} → ${l.outcome}`).join("\n")}

RECENT QUESTIONS:
${recentQueries.map(q => `- ${q.question}`).join("\n")}

Return JSON (no markdown fences):
{
  "weeklyDigest": "3-paragraph summary of the week's key intelligence",
  "topInsights": ["insight 1", "insight 2", "insight 3"],
  "actionItems": [
    { "priority": "high|medium|low", "action": "What to do", "reason": "Why" }
  ],
  "trendAlerts": ["Emerging trend 1", "Declining trend 2"],
  "knowledgeGaps": ["What data is missing that would improve decisions"],
  "recommendedIngestions": ["What new data sources to add"]
}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
      });

      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      let report;
      try { report = JSON.parse(text); }
      catch { report = { raw: text }; }

      return Response.json({ report, sourcesCount: sources.length, learningsCount: learnings.length });
    }

    /* ── LIST sources ── */
    if (action === "sources") {
      const { category, limit: queryLimit } = body;
      let query = sourcesRef.orderBy("createdAt", "desc");
      if (queryLimit) query = query.limit(Number(queryLimit));
      else query = query.limit(50);

      const snapshot = await query.get();
      let sources = [];
      snapshot.forEach(doc => sources.push({ id: doc.id, ...doc.data(), content: undefined }));

      if (category) sources = sources.filter(s => s.category === category);

      const totalTokens = sources.reduce((sum, s) => sum + (s.tokenEstimate || 0), 0);
      return Response.json({ sources, count: sources.length, totalTokens });
    }

    /* ── DELETE source ── */
    if (action === "delete-source") {
      const { sourceId } = body;
      if (!sourceId) return Response.json({ error: "sourceId required" }, { status: 400 });
      await sourcesRef.doc(sourceId).delete();
      return Response.json({ sourceId, deleted: true });
    }

    return Response.json({ error: "action must be: ingest, query, learn, report, sources, or delete-source" }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/KNOWLEDGE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
