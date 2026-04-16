import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getDb() {
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      try {
        initializeApp({ credential: cert(JSON.parse(cred)) });
      } catch (e) {
        console.error("[SCHEDULER] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e.message);
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

/**
 * POST /api/factory/scheduler
 *
 * Cron-based scheduling for autonomous video production.
 * Actions: create, list, pause, resume, delete, check-due, history
 *
 * The "check-due" action is called by a Vercel Cron job every hour.
 * It finds schedules that are due and creates pipeline jobs for them.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const schedRef = db.collection("users").doc(userId).collection("factory_schedules");
    const histRef = db.collection("users").doc(userId).collection("factory_schedule_history");

    /* ── CREATE schedule ── */
    if (action === "create") {
      const {
        channelId, channelName, niche, frequency,
        days, timeOfDay, videoTier, reviewRequired,
        style, tone, duration, topicPool,
      } = body;

      if (!channelId) return Response.json({ error: "channelId required" }, { status: 400 });
      if (!frequency) return Response.json({ error: "frequency required (e.g. '3x/week')" }, { status: 400 });

      const schedule = {
        channelId,
        channelName: channelName || "",
        niche: niche || "",
        frequency: frequency || "3x/week",
        days: days || ["monday", "wednesday", "friday"],
        timeOfDay: timeOfDay || "14:00",
        videoTier: videoTier || "standard",
        reviewRequired: reviewRequired !== false,
        style: style || "faceless",
        tone: tone || "engaging",
        targetDuration: duration || "8-10 minutes",
        topicPool: topicPool || [],
        active: true,
        lastRun: null,
        nextRun: null,
        totalRuns: 0,
        totalCost: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Calculate next run
      schedule.nextRun = calculateNextRun(schedule.days, schedule.timeOfDay);

      const ref = await schedRef.add(schedule);
      return Response.json({ scheduleId: ref.id, ...schedule });
    }

    /* ── LIST schedules ── */
    if (action === "list") {
      const snapshot = await schedRef.orderBy("createdAt", "desc").get();
      const schedules = [];
      snapshot.forEach(doc => schedules.push({ scheduleId: doc.id, ...doc.data() }));
      return Response.json({ schedules, count: schedules.length });
    }

    /* ── PAUSE schedule ── */
    if (action === "pause") {
      const { scheduleId } = body;
      if (!scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });
      await schedRef.doc(scheduleId).update({ active: false, updatedAt: new Date().toISOString() });
      return Response.json({ scheduleId, active: false });
    }

    /* ── RESUME schedule ── */
    if (action === "resume") {
      const { scheduleId } = body;
      if (!scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });
      const doc = await schedRef.doc(scheduleId).get();
      if (!doc.exists) return Response.json({ error: "Schedule not found" }, { status: 404 });
      const data = doc.data();
      const nextRun = calculateNextRun(data.days, data.timeOfDay);
      await schedRef.doc(scheduleId).update({ active: true, nextRun, updatedAt: new Date().toISOString() });
      return Response.json({ scheduleId, active: true, nextRun });
    }

    /* ── DELETE schedule ── */
    if (action === "delete") {
      const { scheduleId } = body;
      if (!scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });
      await schedRef.doc(scheduleId).delete();
      return Response.json({ scheduleId, deleted: true });
    }

    /* ── CHECK DUE (called by Vercel Cron) ── */
    if (action === "check-due") {
      const now = new Date();
      const snapshot = await schedRef.where("active", "==", true).get();
      const triggered = [];

      for (const doc of snapshot.docs) {
        const sched = doc.data();
        if (!sched.nextRun) continue;

        const nextRun = new Date(sched.nextRun);
        if (now >= nextRun) {
          // Pick a topic
          let topic = "";
          if (sched.topicPool?.length > 0) {
            const idx = sched.totalRuns % sched.topicPool.length;
            topic = sched.topicPool[idx];
          } else {
            topic = `${sched.niche || "trending"} topic #${sched.totalRuns + 1}`;
          }

          // Create pipeline
          const pipesRef = db.collection("users").doc(userId).collection("factory_pipelines");
          const pipeline = {
            state: "NICHE_SELECTED",
            stateHistory: [{ state: "NICHE_SELECTED", at: now.toISOString() }],
            niche: sched.niche,
            topic,
            channelId: sched.channelId,
            channelName: sched.channelName,
            videoTier: sched.videoTier,
            reviewRequired: sched.reviewRequired,
            scheduledFor: sched.nextRun,
            style: sched.style,
            tone: sched.tone,
            targetDuration: sched.targetDuration,
            assets: { script: null, voiceUrl: null, musicUrl: null, subtitlesSrt: null, thumbnailUrl: null, sceneImages: [], sceneVideos: [], finalVideoUrl: null },
            totalCost: 0,
            costBreakdown: {},
            sourceScheduleId: doc.id,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            completedAt: null,
            error: null,
            retryCount: 0,
          };

          const pipeRef = await pipesRef.add(pipeline);
          triggered.push({ pipelineId: pipeRef.id, scheduleId: doc.id, topic });

          // Log history
          await histRef.add({
            scheduleId: doc.id,
            pipelineId: pipeRef.id,
            topic,
            triggeredAt: now.toISOString(),
          });

          // Update schedule — next run and count
          const newNextRun = calculateNextRun(sched.days, sched.timeOfDay);
          await schedRef.doc(doc.id).update({
            lastRun: now.toISOString(),
            nextRun: newNextRun,
            totalRuns: (sched.totalRuns || 0) + 1,
            updatedAt: now.toISOString(),
          });
        }
      }

      return Response.json({ triggered, count: triggered.length, checkedAt: now.toISOString() });
    }

    /* ── HISTORY ── */
    if (action === "history") {
      const { scheduleId, limit: queryLimit } = body;
      let query = histRef.orderBy("triggeredAt", "desc");
      if (scheduleId) query = query.where("scheduleId", "==", scheduleId);
      query = query.limit(queryLimit || 50);

      const snapshot = await query.get();
      const history = [];
      snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
      return Response.json({ history, count: history.length });
    }

    return Response.json({ error: "action must be: create, list, pause, resume, delete, check-due, or history" }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/SCHEDULER]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Calculate the next run time based on allowed days and time of day
 */
function calculateNextRun(days, timeOfDay) {
  const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const now = new Date();
  const [hours, minutes] = (timeOfDay || "14:00").split(":").map(Number);

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    const dayName = Object.keys(dayMap).find(k => dayMap[k] === candidate.getDay());
    if (days.includes(dayName) && candidate > now) {
      return candidate.toISOString();
    }
  }
  // Fallback — next occurrence of first allowed day
  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + 7);
  candidate.setHours(hours, minutes, 0, 0);
  return candidate.toISOString();
}
