import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/batch-edit
 *
 * Batch update multiple videos at once.
 * Body: { videoIds: ["id1", "id2"], updates: { title?, description?, tags?, categoryId? } }
 * OR: { videoIds: ["id1"], updates: { appendDescription: "text to append" } }
 * OR: { videoIds: ["id1"], updates: { prependDescription: "text to prepend" } }
 * OR: { videoIds: ["id1"], updates: { addTags: ["new1", "new2"], removeTags: ["old1"] } }
 *
 * Requires Authorization header with youtube.force-ssl scope.
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    const { videoIds = [], updates = {} } = await request.json();

    if (videoIds.length === 0) {
      return NextResponse.json({ error: "videoIds array is required" }, { status: 400 });
    }

    if (videoIds.length > 50) {
      return NextResponse.json({ error: "Maximum 50 videos per batch" }, { status: 400 });
    }

    const results = [];

    for (const videoId of videoIds) {
      try {
        // Fetch current video data
        const getRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!getRes.ok) {
          results.push({ videoId, success: false, error: `Fetch failed: ${getRes.status}` });
          continue;
        }

        const getData = await getRes.json();
        const video = getData.items?.[0];

        if (!video) {
          results.push({ videoId, success: false, error: "Video not found" });
          continue;
        }

        const snippet = { ...video.snippet };

        // Apply updates
        if (updates.title) snippet.title = updates.title;

        if (updates.description) {
          snippet.description = updates.description;
        } else if (updates.appendDescription) {
          snippet.description = (snippet.description || "") + "\n\n" + updates.appendDescription;
        } else if (updates.prependDescription) {
          snippet.description = updates.prependDescription + "\n\n" + (snippet.description || "");
        }

        if (updates.tags) {
          snippet.tags = updates.tags;
        } else {
          const currentTags = snippet.tags || [];
          if (updates.addTags) {
            const newTags = [...new Set([...currentTags, ...updates.addTags])];
            snippet.tags = newTags;
          }
          if (updates.removeTags) {
            snippet.tags = (snippet.tags || currentTags).filter(
              t => !updates.removeTags.includes(t)
            );
          }
        }

        if (updates.categoryId) snippet.categoryId = updates.categoryId;

        // Remove fields YouTube rejects on update
        delete snippet.thumbnails;
        delete snippet.localized;

        // Update the video
        const updateRes = await fetch(
          "https://www.googleapis.com/youtube/v3/videos?part=snippet",
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: videoId,
              snippet,
            }),
          }
        );

        if (!updateRes.ok) {
          const err = await updateRes.text();
          results.push({ videoId, success: false, error: `Update failed: ${updateRes.status}`, detail: err });
          continue;
        }

        const updated = await updateRes.json();
        results.push({
          videoId,
          success: true,
          title: updated.snippet?.title,
          tags: updated.snippet?.tags?.length || 0,
        });
      } catch (err) {
        results.push({ videoId, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;

    return NextResponse.json({
      totalProcessed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      results,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[YOUTUBE/BATCH-EDIT]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
