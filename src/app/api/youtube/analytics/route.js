import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/analytics?channelId=UCxxxxxx
 *
 * Fetches channel statistics and recent videos from YouTube Data API v3.
 * Requires Authorization header with a Google OAuth access token that has
 * the youtube.readonly scope.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ error: "channelId query parameter is required" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header (Bearer token)" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    /* ── 1. Fetch Channel Statistics ── */
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!channelRes.ok) {
      const errBody = await channelRes.text();
      if (channelRes.status === 403) {
        return NextResponse.json({
          error: "YouTube Data API access denied. Make sure the API is enabled in Google Cloud Console and the youtube.readonly scope is authorized.",
          detail: errBody,
        }, { status: 403 });
      }
      return NextResponse.json({ error: `YouTube API error: ${channelRes.status}`, detail: errBody }, { status: channelRes.status });
    }

    const channelData = await channelRes.json();
    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json({ error: "Channel not found. Check the Channel ID." }, { status: 404 });
    }

    const channel = channelData.items[0];
    const stats = {
      title: channel.snippet?.title || "",
      description: channel.snippet?.description || "",
      thumbnail: channel.snippet?.thumbnails?.default?.url || "",
      subscriberCount: Number(channel.statistics?.subscriberCount) || 0,
      viewCount: Number(channel.statistics?.viewCount) || 0,
      videoCount: Number(channel.statistics?.videoCount) || 0,
      hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount || false,
      publishedAt: channel.snippet?.publishedAt || "",
    };

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    /* ── 2. Fetch Recent Videos ── */
    let recentVideos = [];
    if (uploadsPlaylistId) {
      try {
        const playlistRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (playlistRes.ok) {
          const playlistData = await playlistRes.json();
          const videoIds = (playlistData.items || []).map((item) => item.snippet?.resourceId?.videoId).filter(Boolean);

          if (videoIds.length > 0) {
            const videosRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(",")}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (videosRes.ok) {
              const videosData = await videosRes.json();
              recentVideos = (videosData.items || []).map((v) => ({
                videoId: v.id,
                title: v.snippet?.title || "",
                description: v.snippet?.description?.substring(0, 200) || "",
                thumbnail: v.snippet?.thumbnails?.medium?.url || "",
                publishedAt: v.snippet?.publishedAt || "",
                viewCount: Number(v.statistics?.viewCount) || 0,
                likeCount: Number(v.statistics?.likeCount) || 0,
                commentCount: Number(v.statistics?.commentCount) || 0,
              }));
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch recent videos:", err);
      }
    }

    return NextResponse.json({ stats, recentVideos });
  } catch (err) {
    console.error("YouTube analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
