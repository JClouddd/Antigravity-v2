import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

/**
 * Pipeline states in order:
 * NICHE_SELECTED → SCRIPT_GENERATED → ASSETS_GENERATING → ASSETS_READY →
 * COMPOSITING → COMPOSED → REVIEW → PUBLISHING → PUBLISHED → PROMOTING → COMPLETE
 */
const PIPELINE_STATES = [
  "NICHE_SELECTED", "SCRIPT_GENERATED", "ASSETS_GENERATING", "ASSETS_READY",
  "COMPOSITING", "COMPOSED", "REVIEW", "PUBLISHING", "PUBLISHED", "PROMOTING", "COMPLETE",
];

const STATE_INDEX = Object.fromEntries(PIPELINE_STATES.map((s, i) => [s, i]));

/**
 * POST /api/factory/pipeline
 *
 * Autonomous pipeline orchestrator.
 * Actions: create, status, list, advance, cancel, retry
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const pipesRef = db.collection("users").doc(userId).collection("factory_pipelines");

    /* ── CREATE pipeline ── */
    if (action === "create") {
      const {
        niche, topic, channelId, channelName,
        videoTier, reviewRequired, scheduledFor,
        style, tone, duration,
      } = body;

      if (!topic) return Response.json({ error: "topic required" }, { status: 400 });

      const pipeline = {
        state: "NICHE_SELECTED",
        stateHistory: [{ state: "NICHE_SELECTED", at: new Date().toISOString() }],
        niche: niche || "",
        topic,
        channelId: channelId || "",
        channelName: channelName || "",
        videoTier: videoTier || "standard",
        reviewRequired: reviewRequired !== false,
        scheduledFor: scheduledFor || null,
        style: style || "faceless",
        tone: tone || "engaging",
        targetDuration: duration || "8-10 minutes",
        // Asset references (populated as pipeline progresses)
        assets: {
          script: null,
          voiceUrl: null,
          musicUrl: null,
          subtitlesSrt: null,
          thumbnailUrl: null,
          sceneImages: [],
          sceneVideos: [],
          finalVideoUrl: null,
        },
        // Cost tracking
        totalCost: 0,
        costBreakdown: {},
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
        retryCount: 0,
      };

      const ref = await pipesRef.add(pipeline);
      return Response.json({ pipelineId: ref.id, ...pipeline });
    }

    /* ── STATUS of a pipeline ── */
    if (action === "status") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      const doc = await pipesRef.doc(pipelineId).get();
      if (!doc.exists) return Response.json({ error: "Pipeline not found" }, { status: 404 });

      const data = doc.data();
      const progress = Math.round(((STATE_INDEX[data.state] || 0) / (PIPELINE_STATES.length - 1)) * 100);

      return Response.json({ pipelineId, ...data, progress, stateIndex: STATE_INDEX[data.state] });
    }

    /* ── LIST all pipelines ── */
    if (action === "list") {
      const { limit: queryLimit, state } = body;
      let query = pipesRef.orderBy("createdAt", "desc");
      if (state) query = query.where("state", "==", state);
      if (queryLimit) query = query.limit(Number(queryLimit));
      else query = query.limit(50);

      const snapshot = await query.get();
      const pipelines = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const progress = Math.round(((STATE_INDEX[d.state] || 0) / (PIPELINE_STATES.length - 1)) * 100);
        pipelines.push({ pipelineId: doc.id, ...d, progress });
      });

      return Response.json({ pipelines, count: pipelines.length });
    }

    /* ── ADVANCE to next state ── */
    if (action === "advance") {
      const { pipelineId, assetUpdates, costUpdate } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      const doc = await pipesRef.doc(pipelineId).get();
      if (!doc.exists) return Response.json({ error: "Pipeline not found" }, { status: 404 });

      const data = doc.data();
      const currentIndex = STATE_INDEX[data.state];
      if (currentIndex >= PIPELINE_STATES.length - 1) {
        return Response.json({ error: "Pipeline already complete" }, { status: 400 });
      }

      const nextState = PIPELINE_STATES[currentIndex + 1];

      // Skip REVIEW if not required
      const effectiveNext = (nextState === "REVIEW" && !data.reviewRequired)
        ? PIPELINE_STATES[currentIndex + 2]
        : nextState;

      const update = {
        state: effectiveNext,
        updatedAt: new Date().toISOString(),
        stateHistory: FieldValue.arrayUnion({ state: effectiveNext, at: new Date().toISOString() }),
        error: null,
      };

      if (effectiveNext === "COMPLETE") update.completedAt = new Date().toISOString();

      // Merge asset updates
      if (assetUpdates) {
        for (const [key, value] of Object.entries(assetUpdates)) {
          update[`assets.${key}`] = value;
        }
      }

      // Merge cost
      if (costUpdate) {
        update.totalCost = FieldValue.increment(costUpdate.amount || 0);
        if (costUpdate.type) {
          update[`costBreakdown.${costUpdate.type}`] = FieldValue.increment(costUpdate.amount || 0);
        }
      }

      await pipesRef.doc(pipelineId).update(update);

      return Response.json({
        pipelineId,
        previousState: data.state,
        newState: effectiveNext,
        progress: Math.round((STATE_INDEX[effectiveNext] / (PIPELINE_STATES.length - 1)) * 100),
      });
    }

    /* ── UPDATE ASSETS without advancing state ── */
    if (action === "update-assets") {
      const { pipelineId, assetUpdates, costUpdate } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      const update = { updatedAt: new Date().toISOString() };

      if (assetUpdates) {
        for (const [key, value] of Object.entries(assetUpdates)) {
          update[`assets.${key}`] = value;
        }
      }

      if (costUpdate) {
        update.totalCost = FieldValue.increment(costUpdate.amount || 0);
        if (costUpdate.type) {
          update[`costBreakdown.${costUpdate.type}`] = FieldValue.increment(costUpdate.amount || 0);
        }
      }

      await pipesRef.doc(pipelineId).update(update);
      return Response.json({ pipelineId, updated: true });
    }

    /* ── CANCEL a pipeline ── */
    if (action === "cancel") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      await pipesRef.doc(pipelineId).update({
        state: "CANCELLED",
        updatedAt: new Date().toISOString(),
        stateHistory: FieldValue.arrayUnion({ state: "CANCELLED", at: new Date().toISOString() }),
      });

      return Response.json({ pipelineId, state: "CANCELLED" });
    }

    /* ── SET ERROR on pipeline ── */
    if (action === "error") {
      const { pipelineId, error: errorMsg } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      await pipesRef.doc(pipelineId).update({
        error: errorMsg,
        updatedAt: new Date().toISOString(),
        retryCount: FieldValue.increment(1),
      });

      return Response.json({ pipelineId, error: errorMsg });
    }

    return Response.json({
      error: "action must be: create, status, list, advance, cancel, or error",
    }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/PIPELINE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
