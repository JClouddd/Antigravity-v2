import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/analytics-deep?channelId=UCxxx&startDate=2025-01-01&endDate=2025-12-31
 *
 * Deep analytics via YouTube Analytics API.
 * Returns: watch time, retention, traffic sources, demographics, top videos.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    const baseUrl = "https://youtubeanalytics.googleapis.com/v2/reports";
    // Use specific channel ID when provided, otherwise fall back to MINE (active channel)
    const channelTarget = channelId ? `channel==${channelId}` : "channel==MINE";

    /* ── 1. Overview metrics ── */
    const overviewRes = await fetch(
      `${baseUrl}?ids=${channelTarget}&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,dislikes,comments,shares&dimensions=day&sort=day`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let overview = { rows: [], columnHeaders: [] };
    if (overviewRes.ok) {
      overview = await overviewRes.json();
    }

    /* ── 2. Traffic sources ── */
    const trafficRes = await fetch(
      `${baseUrl}?ids=${channelTarget}&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched&dimensions=insightTrafficSourceType&sort=-views`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let trafficSources = [];
    if (trafficRes.ok) {
      const trafficData = await trafficRes.json();
      trafficSources = (trafficData.rows || []).map(row => ({
        source: row[0],
        views: row[1],
        watchTimeMinutes: row[2],
      }));
    }

    /* ── 3. Demographics ── */
    const demoRes = await fetch(
      `${baseUrl}?ids=${channelTarget}&startDate=${startDate}&endDate=${endDate}&metrics=viewerPercentage&dimensions=ageGroup,gender`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let demographics = [];
    if (demoRes.ok) {
      const demoData = await demoRes.json();
      demographics = (demoData.rows || []).map(row => ({
        ageGroup: row[0],
        gender: row[1],
        percentage: row[2],
      }));
    }

    /* ── 4. Top videos ── */
    const topRes = await fetch(
      `${baseUrl}?ids=${channelTarget}&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,likes,subscribersGained&dimensions=video&sort=-views&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let topVideos = [];
    if (topRes.ok) {
      const topData = await topRes.json();
      topVideos = (topData.rows || []).map(row => ({
        videoId: row[0],
        views: row[1],
        watchTimeMinutes: row[2],
        avgDuration: row[3],
        likes: row[4],
        subsGained: row[5],
      }));
    }

    /* ── 5. Geography ── */
    const geoRes = await fetch(
      `${baseUrl}?ids=${channelTarget}&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=country&sort=-views&maxResults=15`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let geography = [];
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      geography = (geoData.rows || []).map(row => ({
        country: row[0],
        views: row[1],
      }));
    }

    // Process daily overview
    const dailyData = (overview.rows || []).map(row => ({
      date: row[0],
      views: row[1],
      watchTimeMinutes: row[2],
      avgDuration: row[3],
      subsGained: row[4],
      subsLost: row[5],
      likes: row[6],
      dislikes: row[7],
      comments: row[8],
      shares: row[9],
    }));

    // Compute totals
    const totals = dailyData.reduce((acc, d) => ({
      views: acc.views + (d.views || 0),
      watchTimeMinutes: acc.watchTimeMinutes + (d.watchTimeMinutes || 0),
      subsGained: acc.subsGained + (d.subsGained || 0),
      subsLost: acc.subsLost + (d.subsLost || 0),
      likes: acc.likes + (d.likes || 0),
      comments: acc.comments + (d.comments || 0),
      shares: acc.shares + (d.shares || 0),
    }), { views: 0, watchTimeMinutes: 0, subsGained: 0, subsLost: 0, likes: 0, comments: 0, shares: 0 });

    totals.watchTimeHours = Math.round(totals.watchTimeMinutes / 60);
    totals.netSubs = totals.subsGained - totals.subsLost;
    totals.avgDailyViews = dailyData.length ? Math.round(totals.views / dailyData.length) : 0;

    return NextResponse.json({
      totals,
      dailyData,
      trafficSources,
      demographics,
      topVideos,
      geography,
      period: { startDate, endDate },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[YOUTUBE/ANALYTICS-DEEP]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
