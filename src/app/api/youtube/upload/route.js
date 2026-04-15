import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/upload
 *
 * Uploads a video to YouTube using the YouTube Data API v3.
 * Uses resumable upload protocol for reliability.
 *
 * Body (FormData):
 *   - file: video file (MP4, MOV, AVI, etc.)
 *   - title: video title
 *   - description: video description
 *   - tags: comma-separated tags
 *   - categoryId: YouTube category (default: 22 = People & Blogs)
 *   - privacyStatus: public | unlisted | private (default: private)
 *   - scheduledAt: ISO date for scheduled publish (optional)
 *
 * Requires Authorization header with YouTube upload scope.
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title") || "Untitled Video";
    const description = formData.get("description") || "";
    const tags = formData.get("tags") ? formData.get("tags").split(",").map(t => t.trim()) : [];
    const categoryId = formData.get("categoryId") || "22";
    const privacyStatus = formData.get("privacyStatus") || "private";
    const scheduledAt = formData.get("scheduledAt") || null;

    if (!file || !(file instanceof File || file instanceof Blob)) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 });
    }

    /* ── 1. Build metadata ── */
    const metadata = {
      snippet: {
        title,
        description,
        tags,
        categoryId,
      },
      status: {
        privacyStatus: scheduledAt ? "private" : privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    // If scheduled, set publishAt
    if (scheduledAt) {
      metadata.status.privacyStatus = "private";
      metadata.status.publishAt = new Date(scheduledAt).toISOString();
    }

    /* ── 2. Initiate resumable upload ── */
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": file.type || "video/mp4",
          "X-Upload-Content-Length": String(file.size),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      console.error("[UPLOAD] Init failed:", initRes.status, err);

      if (initRes.status === 403) {
        return NextResponse.json({
          error: "YouTube upload access denied. Re-login to grant upload permissions, and make sure the YouTube Data API is enabled in Google Cloud Console.",
          detail: err,
        }, { status: 403 });
      }
      return NextResponse.json({
        error: `Upload init failed: ${initRes.status}`,
        detail: err,
      }, { status: initRes.status });
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      return NextResponse.json({ error: "No upload URL returned" }, { status: 500 });
    }

    /* ── 3. Upload the file ── */
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "video/mp4",
        "Content-Length": String(fileBuffer.length),
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("[UPLOAD] Upload failed:", uploadRes.status, err);
      return NextResponse.json({
        error: `Upload failed: ${uploadRes.status}`,
        detail: err,
      }, { status: uploadRes.status });
    }

    const result = await uploadRes.json();

    return NextResponse.json({
      success: true,
      videoId: result.id,
      title: result.snippet?.title,
      url: `https://youtube.com/watch?v=${result.id}`,
      status: result.status?.uploadStatus,
      privacyStatus: result.status?.privacyStatus,
      publishAt: result.status?.publishAt || null,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[YOUTUBE/UPLOAD] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
