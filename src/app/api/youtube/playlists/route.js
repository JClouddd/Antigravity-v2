import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/playlists — list user's playlists
 * POST /api/youtube/playlists — create, addVideo, reorder, removeVideo, autoOrganize, updateMeta
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlistId");
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    // If playlistId provided, return items in that playlist
    if (playlistId) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Playlist items fetch failed: ${res.status}`, detail: err }, { status: res.status });
      }
      const data = await res.json();
      const items = (data.items || []).map((item, index) => ({
        id: item.id,
        videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "",
        title: item.snippet?.title || "",
        thumbnail: item.snippet?.thumbnails?.medium?.url || "",
        position: item.snippet?.position ?? index,
        publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "",
        channelTitle: item.snippet?.videoOwnerChannelTitle || "",
      }));
      return NextResponse.json({ playlistId, items, totalItems: data.pageInfo?.totalResults || items.length });
    }

    // Otherwise list all playlists
    // Support channelId param to list a specific channel's playlists (vs. mine=true default)
    const channelId = searchParams.get("channelId");
    const playlistsUrl = channelId
      ? `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&channelId=${channelId}&maxResults=50`
      : "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50";
    const res = await fetch(playlistsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Playlists fetch failed: ${res.status}`, detail: err }, { status: res.status });
    }

    const data = await res.json();
    const playlists = (data.items || []).map(p => ({
      id: p.id,
      title: p.snippet?.title || "",
      description: p.snippet?.description || "",
      thumbnail: p.snippet?.thumbnails?.medium?.url || "",
      itemCount: p.contentDetails?.itemCount || 0,
      privacy: p.status?.privacyStatus || "private",
      publishedAt: p.snippet?.publishedAt || "",
    }));

    return NextResponse.json({ playlists });
  } catch (err) {
    console.error("[YOUTUBE/PLAYLISTS] GET:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    const body = await request.json();
    const { action } = body;

    /* ── Create Playlist ── */
    if (action === "create") {
      const { title, description = "", privacyStatus = "public" } = body;
      if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet: { title, description },
            status: { privacyStatus },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Playlist creation failed: ${res.status}`, detail: err }, { status: res.status });
      }

      const playlist = await res.json();
      return NextResponse.json({ success: true, playlistId: playlist.id, title: playlist.snippet?.title });
    }

    /* ── Update Playlist Metadata ── */
    if (action === "updateMeta") {
      const { playlistId, title, description, privacyStatus } = body;
      if (!playlistId) return NextResponse.json({ error: "playlistId required" }, { status: 400 });

      const updateBody = { id: playlistId, snippet: {}, status: {} };
      if (title) updateBody.snippet.title = title;
      if (description !== undefined) updateBody.snippet.description = description;
      if (privacyStatus) updateBody.status.privacyStatus = privacyStatus;

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Update failed: ${res.status}`, detail: err }, { status: res.status });
      }

      return NextResponse.json({ success: true, playlistId });
    }

    /* ── Add Video to Playlist ── */
    if (action === "addVideo") {
      const { playlistId, videoId, position } = body;
      if (!playlistId || !videoId) return NextResponse.json({ error: "playlistId and videoId required" }, { status: 400 });

      const itemBody = {
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
        },
      };
      if (position !== undefined) itemBody.snippet.position = position;

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(itemBody),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Add to playlist failed: ${res.status}`, detail: err }, { status: res.status });
      }

      const added = await res.json();
      return NextResponse.json({ success: true, itemId: added.id, playlistId, videoId });
    }

    /* ── Remove Video from Playlist ── */
    if (action === "removeVideo") {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ error: "itemId required (the playlistItem ID, not videoId)" }, { status: 400 });

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?id=${itemId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Remove failed: ${res.status}`, detail: err }, { status: res.status });
      }

      return NextResponse.json({ success: true, removed: itemId });
    }

    /* ── Reorder (move item to new position) ── */
    if (action === "reorder") {
      const { itemId, playlistId, videoId, newPosition } = body;
      if (!itemId || !playlistId || !videoId || newPosition === undefined) {
        return NextResponse.json({ error: "itemId, playlistId, videoId, and newPosition required" }, { status: 400 });
      }

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            id: itemId,
            snippet: {
              playlistId,
              resourceId: { kind: "youtube#video", videoId },
              position: newPosition,
            },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Reorder failed: ${res.status}`, detail: err }, { status: res.status });
      }

      return NextResponse.json({ success: true, itemId, newPosition });
    }

    /* ── Auto-Organize (sort playlist by criteria) ── */
    if (action === "autoOrganize") {
      const { playlistId, sortBy = "dateNewest" } = body;
      if (!playlistId) return NextResponse.json({ error: "playlistId required" }, { status: 400 });

      // Fetch all items
      const listRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listRes.ok) {
        const err = await listRes.text();
        return NextResponse.json({ error: `Fetch items failed: ${listRes.status}`, detail: err }, { status: listRes.status });
      }

      const listData = await listRes.json();
      let items = (listData.items || []).map(item => ({
        id: item.id,
        videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
        title: item.snippet?.title || "",
        publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "",
        position: item.snippet?.position,
      }));

      // Sort based on criteria
      const sortFunctions = {
        dateNewest: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
        dateOldest: (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
        titleAZ: (a, b) => a.title.localeCompare(b.title),
        titleZA: (a, b) => b.title.localeCompare(a.title),
      };

      items.sort(sortFunctions[sortBy] || sortFunctions.dateNewest);

      // Reorder each item to its new position
      const results = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].position === i) {
          results.push({ videoId: items[i].videoId, title: items[i].title, position: i, skipped: true });
          continue;
        }

        try {
          const moveRes = await fetch(
            "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                id: items[i].id,
                snippet: {
                  playlistId,
                  resourceId: { kind: "youtube#video", videoId: items[i].videoId },
                  position: i,
                },
              }),
            }
          );

          results.push({
            videoId: items[i].videoId,
            title: items[i].title,
            position: i,
            success: moveRes.ok,
          });
        } catch (err) {
          results.push({ videoId: items[i].videoId, title: items[i].title, position: i, error: err.message });
        }
      }

      const moved = results.filter(r => r.success && !r.skipped).length;
      return NextResponse.json({
        success: true,
        playlistId,
        sortBy,
        totalItems: items.length,
        itemsMoved: moved,
        results,
      });
    }

    return NextResponse.json({ error: "action must be: create, updateMeta, addVideo, removeVideo, reorder, or autoOrganize" }, { status: 400 });
  } catch (err) {
    console.error("[YOUTUBE/PLAYLISTS] POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
