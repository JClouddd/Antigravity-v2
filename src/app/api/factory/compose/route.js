import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
 * POST /api/factory/compose
 *
 * Triggers FFmpeg video composition via Cloud Run Job.
 * Sends asset URLs to the Cloud Run composer service,
 * which downloads assets, runs FFmpeg, and uploads the final video.
 *
 * Actions: trigger, status
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const CLOUD_RUN_URL = process.env.FACTORY_COMPOSER_URL;
    const db = getDb();

    /* ── TRIGGER composition ── */
    if (action === "trigger") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      // Get pipeline data
      const pipeDoc = await db
        .collection("users").doc(userId)
        .collection("factory_pipelines").doc(pipelineId).get();

      if (!pipeDoc.exists) return Response.json({ error: "Pipeline not found" }, { status: 404 });
      const pipeline = pipeDoc.data();

      if (!pipeline.assets?.voiceUrl) {
        return Response.json({ error: "Pipeline missing voice asset — generate TTS first" }, { status: 400 });
      }

      // Build composition request
      const composeRequest = {
        pipelineId,
        userId,
        assets: {
          voiceUrl: pipeline.assets.voiceUrl,
          musicUrl: pipeline.assets.musicUrl || null,
          subtitlesSrt: pipeline.assets.subtitlesSrt || null,
          scenes: [
            ...(pipeline.assets.sceneImages || []).map((url, i) => ({
              type: "image",
              url,
              order: i,
              duration: 5, // 5 seconds per image with ken burns
            })),
            ...(pipeline.assets.sceneVideos || []).map((url, i) => ({
              type: "video",
              url,
              order: i,
            })),
          ].sort((a, b) => a.order - b.order),
          thumbnailUrl: pipeline.assets.thumbnailUrl || null,
        },
        settings: {
          resolution: "1920x1080",
          fps: 30,
          codec: "h264",
          musicVolume: 0.15,
          voiceVolume: 1.0,
          burnSubtitles: true,
          kenBurnsEffect: true,
        },
        outputBucket: process.env.GCS_BUCKET || "antigravity-youtube-factory",
        outputPath: `pipelines/${pipelineId}/final.mp4`,
      };

      if (!CLOUD_RUN_URL) {
        // Cloud Run not configured yet — store request for later
        await db.collection("users").doc(userId)
          .collection("factory_pipelines").doc(pipelineId)
          .update({
            composeRequest,
            state: "COMPOSITING",
            updatedAt: new Date().toISOString(),
            error: "Cloud Run composer not configured — set FACTORY_COMPOSER_URL env var",
          });

        return Response.json({
          status: "queued",
          message: "Compose request saved. Cloud Run FFmpeg composer not yet deployed — set FACTORY_COMPOSER_URL in Vercel env vars.",
          composeRequest,
        });
      }

      // Send to Cloud Run
      const res = await fetch(CLOUD_RUN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeRequest),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cloud Run ${res.status}: ${err}`);
      }

      const result = await res.json();

      // Update pipeline
      await db.collection("users").doc(userId)
        .collection("factory_pipelines").doc(pipelineId)
        .update({
          state: "COMPOSITING",
          "assets.composeJobId": result.jobId || "",
          updatedAt: new Date().toISOString(),
        });

      return Response.json({
        status: "compositing",
        jobId: result.jobId,
        pipelineId,
      });
    }

    /* ── STATUS of composition ── */
    if (action === "status") {
      const { pipelineId } = body;
      if (!pipelineId) return Response.json({ error: "pipelineId required" }, { status: 400 });

      if (!CLOUD_RUN_URL) {
        return Response.json({
          status: "not_configured",
          message: "Cloud Run composer not deployed yet",
        });
      }

      const res = await fetch(`${CLOUD_RUN_URL}/status/${pipelineId}`, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(`Cloud Run status ${res.status}`);
      return Response.json(await res.json());
    }

    return Response.json({ error: "action must be: trigger or status" }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/COMPOSE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
