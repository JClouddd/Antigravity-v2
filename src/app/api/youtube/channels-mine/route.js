import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/channels-mine
 *
 * Discovers ALL YouTube channels the authenticated user manages.
 * Returns the list + identifies which channel the current token acts as (the "active" channel).
 *
 * This is the foundational route for multi-channel safety.
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    /* ── 1. List all channels the user manages ── */
    const listRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      return NextResponse.json({
        error: `Channel list failed: ${listRes.status}`,
        detail: err,
      }, { status: listRes.status });
    }

    const listData = await listRes.json();
    const allChannels = (listData.items || []).map(ch => ({
      channelId: ch.id,
      title: ch.snippet?.title || "",
      description: ch.snippet?.description || "",
      customUrl: ch.snippet?.customUrl || "",
      thumbnail: ch.snippet?.thumbnails?.default?.url || "",
      subscriberCount: Number(ch.statistics?.subscriberCount) || 0,
      videoCount: Number(ch.statistics?.videoCount) || 0,
      viewCount: Number(ch.statistics?.viewCount) || 0,
      uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || "",
      publishedAt: ch.snippet?.publishedAt || "",
      country: ch.snippet?.country || "",
      keywords: ch.brandingSettings?.channel?.keywords || "",
    }));

    /* ── 2. Identify the active channel (the one write ops target) ── */
    // The first channel returned by mine=true is the active/primary channel
    const activeChannel = allChannels.length > 0 ? allChannels[0] : null;

    /* ── 3. Verify active channel with a lightweight self-query ── */
    let verifiedActive = null;
    if (activeChannel) {
      try {
        // Try to list user's own playlists — this confirms which channel the token acts as
        const verifyRes = await fetch(
          "https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=1",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const ownerChannelId = verifyData.items?.[0]?.snippet?.channelId;
          if (ownerChannelId) {
            verifiedActive = allChannels.find(c => c.channelId === ownerChannelId) || activeChannel;
          }
        }
      } catch {
        // Fallback to first channel
      }
      if (!verifiedActive) verifiedActive = activeChannel;
    }

    return NextResponse.json({
      channels: allChannels,
      totalChannels: allChannels.length,
      activeChannel: verifiedActive,
      activeChannelId: verifiedActive?.channelId || null,
      note: allChannels.length > 1
        ? `You manage ${allChannels.length} channels. Write operations (upload, comment, playlist create) will target "${verifiedActive?.title}". To switch, re-authenticate and select a different channel.`
        : allChannels.length === 1
          ? `Single channel detected: "${verifiedActive?.title}". All operations target this channel.`
          : "No channels found on this account.",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[YOUTUBE/CHANNELS-MINE]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
