import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/factory/cron
 *
 * Called by Vercel Cron every hour (configured in vercel.json).
 * Checks all users' schedules for due pipelines and triggers them.
 *
 * Note: On Vercel Hobby plan, crons run once/day. On Pro, they run
 * at the configured interval (hourly). This route is idempotent.
 */
export async function GET(req) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For now, we need a userId to check schedules.
    // In production, iterate over all users with active schedules.
    // For MVP, use a configured default user.
    const defaultUserId = process.env.DEFAULT_USER_ID;
    if (!defaultUserId) {
      return NextResponse.json({
        status: "skipped",
        message: "No DEFAULT_USER_ID configured — set in Vercel env vars",
      });
    }

    // Call the scheduler's check-due action
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/factory/scheduler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-due", userId: defaultUserId }),
    });

    const data = await res.json();

    return NextResponse.json({
      status: "ok",
      triggered: data.triggered || [],
      count: data.count || 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[FACTORY/CRON]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
