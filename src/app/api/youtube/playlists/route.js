import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/playlists — list user's playlists
 * POST /api/youtube/playlists — create playlist or add video to playlist
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

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

    const { action, title, description, privacyStatus, playlistId, videoId } = await request.json();

    if (action === "create") {
      if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet: { title, description: description || "" },
            status: { privacyStatus: privacyStatus || "public" },
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

    if (action === "addVideo") {
      if (!playlistId || !videoId) return NextResponse.json({ error: "playlistId and videoId required" }, { status: 400 });

      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: { kind: "youtube#video", videoId },
            },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Add to playlist failed: ${res.status}`, detail: err }, { status: res.status });
      }

      return NextResponse.json({ success: true, playlistId, videoId });
    }

    return NextResponse.json({ error: "action must be 'create' or 'addVideo'" }, { status: 400 });
  } catch (err) {
    console.error("[YOUTUBE/PLAYLISTS] POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
