import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/comments?videoId=xxx&maxResults=50
 * POST /api/youtube/comments — reply to a comment
 *
 * Comment management via YouTube Data API v3.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");
    const maxResults = Math.min(Number(searchParams.get("maxResults")) || 50, 100);

    if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&order=time&maxResults=${maxResults}&textFormat=plainText`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Comments fetch failed: ${res.status}`, detail: err }, { status: res.status });
    }

    const data = await res.json();
    const comments = (data.items || []).map(item => {
      const top = item.snippet?.topLevelComment?.snippet || {};
      return {
        id: item.id,
        commentId: item.snippet?.topLevelComment?.id,
        author: top.authorDisplayName || "",
        authorImage: top.authorProfileImageUrl || "",
        text: top.textDisplay || "",
        likes: top.likeCount || 0,
        publishedAt: top.publishedAt || "",
        isHearted: top.viewerRating === "like",
        replyCount: item.snippet?.totalReplyCount || 0,
        replies: (item.replies?.comments || []).map(r => ({
          id: r.id,
          author: r.snippet?.authorDisplayName || "",
          text: r.snippet?.textDisplay || "",
          likes: r.snippet?.likeCount || 0,
          publishedAt: r.snippet?.publishedAt || "",
        })),
      };
    });

    // Stats
    const totalComments = data.pageInfo?.totalResults || comments.length;
    const avgLikes = comments.length ? (comments.reduce((s, c) => s + c.likes, 0) / comments.length).toFixed(1) : 0;

    return NextResponse.json({
      comments,
      stats: { totalComments, displayed: comments.length, avgLikes: Number(avgLikes) },
      videoId,
    });
  } catch (err) {
    console.error("[YOUTUBE/COMMENTS] GET:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const accessToken = authHeader.replace("Bearer ", "");

    const { parentId, text } = await request.json();
    if (!parentId || !text) return NextResponse.json({ error: "parentId and text required" }, { status: 400 });

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/comments?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { parentId, textOriginal: text },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Reply failed: ${res.status}`, detail: err }, { status: res.status });
    }

    const reply = await res.json();
    return NextResponse.json({ success: true, replyId: reply.id });
  } catch (err) {
    console.error("[YOUTUBE/COMMENTS] POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
