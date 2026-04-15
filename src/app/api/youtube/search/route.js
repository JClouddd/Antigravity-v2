import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/search?q=keyword&maxResults=20
 *
 * Niche Scanner — searches YouTube for top videos in a niche.
 * Returns video metrics for competition analysis.
 * Cost: 100 quota units per call — results should be cached client-side.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const maxResults = Math.min(Number(searchParams.get("maxResults")) || 20, 50);

    if (!q) {
      return NextResponse.json({ error: "q (search query) is required" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    /* ── 1. Search YouTube ── */
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      return NextResponse.json({ error: `YouTube search error: ${searchRes.status}`, detail: errBody }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const videoIds = (searchData.items || []).map(item => item.id?.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return NextResponse.json({ results: [], summary: { totalResults: 0 } });
    }

    /* ── 2. Get video stats ── */
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let videos = [];
    if (videosRes.ok) {
      const videosData = await videosRes.json();
      videos = (videosData.items || []).map(v => ({
        videoId: v.id,
        title: v.snippet?.title || "",
        channelTitle: v.snippet?.channelTitle || "",
        publishedAt: v.snippet?.publishedAt || "",
        thumbnail: v.snippet?.thumbnails?.medium?.url || "",
        duration: v.contentDetails?.duration || "",
        viewCount: Number(v.statistics?.viewCount) || 0,
        likeCount: Number(v.statistics?.likeCount) || 0,
        commentCount: Number(v.statistics?.commentCount) || 0,
      }));
    }

    /* ── 3. Compute niche summary ── */
    const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;
    const avgLikes = videos.length ? Math.round(totalLikes / videos.length) : 0;
    const avgEngagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : 0;

    return NextResponse.json({
      query: q,
      results: videos,
      summary: {
        totalResults: searchData.pageInfo?.totalResults || videos.length,
        videosAnalyzed: videos.length,
        avgViews,
        avgLikes,
        avgEngagement: Number(avgEngagement),
        topVideo: videos[0] || null,
      },
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("YouTube search error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
