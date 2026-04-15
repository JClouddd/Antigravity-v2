import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/competitors
 *
 * Fetch stats for competitor channels for benchmarking.
 * Body: { channelIds: ["UCxxx", "UCyyy"] }
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    const { channelIds = [] } = await request.json();
    if (channelIds.length === 0) return NextResponse.json({ error: "channelIds required" }, { status: 400 });

    // Batch fetch channel data (up to 50)
    const ids = channelIds.slice(0, 50).join(",");
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${ids}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!channelRes.ok) {
      const err = await channelRes.text();
      return NextResponse.json({ error: `Channels fetch failed: ${channelRes.status}`, detail: err }, { status: channelRes.status });
    }

    const channelData = await channelRes.json();
    const competitors = [];

    for (const ch of (channelData.items || [])) {
      const stats = ch.statistics || {};
      const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads;

      // Get latest 5 videos for posting frequency + avg views
      let recentVideos = [];
      if (uploadsPlaylistId) {
        try {
          const plRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (plRes.ok) {
            const plData = await plRes.json();
            const videoIds = (plData.items || []).map(i => i.snippet?.resourceId?.videoId).filter(Boolean);
            if (videoIds.length > 0) {
              const vRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(",")}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (vRes.ok) {
                const vData = await vRes.json();
                recentVideos = (vData.items || []).map(v => ({
                  title: v.snippet?.title, views: Number(v.statistics?.viewCount) || 0,
                  likes: Number(v.statistics?.likeCount) || 0, publishedAt: v.snippet?.publishedAt,
                }));
              }
            }
          }
        } catch (e) { console.warn("Recent videos fetch failed:", e); }
      }

      const avgViews = recentVideos.length > 0
        ? Math.round(recentVideos.reduce((s, v) => s + v.views, 0) / recentVideos.length) : 0;

      // Posting frequency (days between recent videos)
      let postingFrequency = "Unknown";
      if (recentVideos.length >= 2) {
        const dates = recentVideos.map(v => new Date(v.publishedAt)).sort((a, b) => b - a);
        const gaps = [];
        for (let i = 0; i < dates.length - 1; i++) gaps.push((dates[i] - dates[i + 1]) / 86400000);
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        postingFrequency = avg < 2 ? "Daily" : avg < 4 ? "2-3x/week" : avg < 8 ? "Weekly" : avg < 15 ? "Bi-weekly" : "Monthly";
      }

      competitors.push({
        channelId: ch.id,
        title: ch.snippet?.title || "",
        thumbnail: ch.snippet?.thumbnails?.default?.url || "",
        subscribers: Number(stats.subscriberCount) || 0,
        totalViews: Number(stats.viewCount) || 0,
        videoCount: Number(stats.videoCount) || 0,
        avgRecentViews: avgViews,
        postingFrequency,
        recentVideos,
        publishedAt: ch.snippet?.publishedAt || "",
      });
    }

    // Sort by subscribers
    competitors.sort((a, b) => b.subscribers - a.subscribers);

    return NextResponse.json({ competitors, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[YOUTUBE/COMPETITORS]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
