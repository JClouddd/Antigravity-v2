import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getDb() {
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      try {
        initializeApp({ credential: cert(JSON.parse(cred)) });
      } catch (e) {
        console.error("[CRON] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e.message);
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

/**
 * GET /api/factory/cron
 *
 * Called by Vercel Cron every hour (vercel.json).
 * Two jobs in one:
 *   1. SCHEDULER — checks due schedules, creates new pipelines
 *   2. WATCHDOG  — finds stalled/errored pipelines, auto-restarts them
 *
 * Self-Healing Rules:
 * - If a pipeline has been in the same state for >30 minutes → retry current step
 * - If a pipeline has an error and retryCount < 3 → clear error and retry
 * - If a pipeline has retryCount >= 3 → mark as FAILED (needs human review)
 * - If a pipeline is in COMPOSITING for >10 min without Cloud Run → skip to REVIEW
 */
export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = !!process.env.VERCEL;
    if (!cronSecret && isProduction) {
      // Refuse to run unsecured in production — set CRON_SECRET in Vercel env vars
      return NextResponse.json({ error: "CRON_SECRET not configured. Set it in Vercel env vars to secure this endpoint." }, { status: 500 });
    }
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const defaultUserId = process.env.DEFAULT_USER_ID;
    if (!defaultUserId) {
      return NextResponse.json({
        status: "skipped",
        message: "No DEFAULT_USER_ID configured — set in Vercel env vars",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || process.env.NEXTAUTH_URL
      || "http://localhost:3000";

    const db = getDb();
    const now = new Date();
    const results = { scheduler: null, watchdog: null };

    /* ═══════════════════════════════════════════
     * JOB 1: SCHEDULER — check due schedules
     * ═══════════════════════════════════════════ */
    try {
      const schedRes = await fetch(`${baseUrl}/api/factory/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-due", userId: defaultUserId }),
      });
      results.scheduler = await schedRes.json();

      // Auto-trigger first step for any newly created pipelines — fire-and-forget
      if (results.scheduler?.triggered?.length > 0) {
        for (const { pipelineId } of results.scheduler.triggered) {
          fetch(`${baseUrl}/api/factory/orchestrator`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "run-step", userId: defaultUserId, pipelineId }),
          }).catch(err => console.error(`[CRON SCHEDULER] Auto-start failed for ${pipelineId}:`, err.message));
        }
      }
    } catch (err) {
      results.scheduler = { error: err.message };
    }

    /* ═══════════════════════════════════════════
     * JOB 2: WATCHDOG — self-healing pipeline monitor
     * ═══════════════════════════════════════════ */
    try {
      const pipesRef = db.collection("users").doc(defaultUserId).collection("factory_pipelines");
      const watchdogLog = db.collection("users").doc(defaultUserId).collection("factory_watchdog_log");

      // Find all active (non-complete, non-cancelled) pipelines
      const snapshot = await pipesRef
        .where("state", "not-in", ["COMPLETE", "CANCELLED", "FAILED"])
        .orderBy("updatedAt", "desc")
        .limit(20)
        .get();

      const healed = [];
      const failed = [];

      for (const doc of snapshot.docs) {
        const pipe = doc.data();
        const pipelineId = doc.id;
        const updatedAt = new Date(pipe.updatedAt);
        const stalledMinutes = (now - updatedAt) / (1000 * 60);
        const retryCount = pipe.retryCount || 0;

        // Rule 1: Too many retries → mark FAILED
        if (retryCount >= 3) {
          await pipesRef.doc(pipelineId).update({
            state: "FAILED",
            updatedAt: now.toISOString(),
            stateHistory: FieldValue.arrayUnion({
              state: "FAILED",
              at: now.toISOString(),
              reason: "Max retries exceeded (3)",
            }),
          });

          await watchdogLog.add({
            pipelineId,
            action: "marked_failed",
            reason: `${retryCount} retries exhausted`,
            previousState: pipe.state,
            at: now.toISOString(),
          });

          failed.push({ pipelineId, reason: "max_retries", retries: retryCount });
          continue;
        }

        // Rule 2: Pipeline has an error → clear and retry
        if (pipe.error && stalledMinutes > 5) {
          await pipesRef.doc(pipelineId).update({
            error: null,
            updatedAt: now.toISOString(),
            retryCount: FieldValue.increment(1),
            stateHistory: FieldValue.arrayUnion({
              state: `RETRY_${pipe.state}`,
              at: now.toISOString(),
              reason: `Auto-retry after error: ${pipe.error}`,
            }),
          });

          // Re-run the current step — fire-and-forget, orchestrator has its own 120s timeout
          fetch(`${baseUrl}/api/factory/orchestrator`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "run-step", userId: defaultUserId, pipelineId }),
          }).catch(err => console.error(`[CRON WATCHDOG] Error-retry trigger failed for ${pipelineId}:`, err.message));

          await watchdogLog.add({
            pipelineId,
            action: "auto_retry",
            reason: `Error cleared: ${pipe.error}`,
            previousState: pipe.state,
            retryCount: retryCount + 1,
            at: now.toISOString(),
          });

          healed.push({ pipelineId, action: "retry", state: pipe.state });
          continue;
        }

        // Rule 3: Pipeline stalled for >30 min → nudge it
        if (stalledMinutes > 30 && !pipe.error) {
          // If stuck in COMPOSITING without Cloud Run → skip to REVIEW
          if (pipe.state === "COMPOSITING" && !process.env.FACTORY_COMPOSER_URL) {
            await pipesRef.doc(pipelineId).update({
              state: pipe.reviewRequired ? "REVIEW" : "PUBLISHED",
              updatedAt: now.toISOString(),
              stateHistory: FieldValue.arrayUnion({
                state: pipe.reviewRequired ? "REVIEW" : "PUBLISHED",
                at: now.toISOString(),
                reason: "Skipped compose — Cloud Run not configured",
              }),
            });

            await watchdogLog.add({
              pipelineId,
              action: "skip_compose",
              reason: "Cloud Run not configured, advanced past COMPOSITING",
              at: now.toISOString(),
            });

            healed.push({ pipelineId, action: "skip_compose" });
            continue;
          }

          // Otherwise, retry the current step
          await pipesRef.doc(pipelineId).update({
            retryCount: FieldValue.increment(1),
            updatedAt: now.toISOString(),
            stateHistory: FieldValue.arrayUnion({
              state: `STALL_RETRY_${pipe.state}`,
              at: now.toISOString(),
              reason: `Stalled ${Math.round(stalledMinutes)} minutes`,
            }),
          });

          // Nudge stalled step — fire-and-forget, orchestrator has its own 120s timeout
          fetch(`${baseUrl}/api/factory/orchestrator`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "run-step", userId: defaultUserId, pipelineId }),
          }).catch(err => console.error(`[CRON WATCHDOG] Stall-retry trigger failed for ${pipelineId}:`, err.message));

          await watchdogLog.add({
            pipelineId,
            action: "stall_retry",
            reason: `Stalled ${Math.round(stalledMinutes)} min in ${pipe.state}`,
            retryCount: retryCount + 1,
            at: now.toISOString(),
          });

          healed.push({ pipelineId, action: "stall_retry", stalledMinutes: Math.round(stalledMinutes) });
        }
      }

      results.watchdog = {
        checked: snapshot.size,
        healed: healed.length,
        failed: failed.length,
        details: { healed, failed },
      };
    } catch (err) {
      results.watchdog = { error: err.message };
    }

    return NextResponse.json({
      status: "ok",
      scheduler: results.scheduler,
      watchdog: results.watchdog,
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[FACTORY/CRON]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
