import { initializeApp, cert, getApps } from "firebase-admin/app";

export const dynamic = "force-dynamic";

/**
 * POST /api/factory/storage
 *
 * Cloud Storage management for the Factory.
 * Uses Firebase Admin SDK to interact with Google Cloud Storage
 * (Firebase Admin includes full GCS access).
 *
 * Actions: setup, upload-url, list-files, delete-file
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // Initialize Firebase Admin (gives us GCS access)
    if (!getApps().length) {
      const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (cred) {
        initializeApp({ credential: cert(JSON.parse(cred)) });
      } else {
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      }
    }

    const { getStorage } = await import("firebase-admin/storage");
    const BUCKET_NAME = process.env.GCS_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`;

    /* ── SETUP — verify bucket access ── */
    if (action === "setup") {
      try {
        const bucket = getStorage().bucket(BUCKET_NAME);
        const [exists] = await bucket.exists();

        if (!exists) {
          return Response.json({
            status: "bucket_not_found",
            bucketName: BUCKET_NAME,
            message: "Bucket does not exist. Using default Firebase Storage bucket instead.",
            fallback: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
          });
        }

        // Test write access
        const testFile = bucket.file("_factory_test");
        await testFile.save("test", { contentType: "text/plain" });
        await testFile.delete();

        return Response.json({
          status: "ready",
          bucketName: BUCKET_NAME,
          message: "Cloud Storage is configured and writable.",
          structure: {
            pipelines: "pipelines/{pipelineId}/{assets}",
            templates: "templates/{intros,outros,overlays}",
            library: "library/{music,assets}",
          },
        });
      } catch (err) {
        // Fall back to Firebase default storage
        const fallbackBucket = `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`;
        try {
          const bucket = getStorage().bucket(fallbackBucket);
          const testFile = bucket.file("_factory_test");
          await testFile.save("test", { contentType: "text/plain" });
          await testFile.delete();

          return Response.json({
            status: "ready_fallback",
            bucketName: fallbackBucket,
            message: "Using default Firebase Storage bucket (works for files up to 5GB).",
            originalError: err.message,
          });
        } catch (fbErr) {
          return Response.json({
            status: "not_configured",
            message: "No writable storage bucket found. Ensure FIREBASE_SERVICE_ACCOUNT_KEY has Storage Admin role.",
            error: fbErr.message,
          });
        }
      }
    }

    /* ── UPLOAD URL — generate a signed upload URL ── */
    if (action === "upload-url") {
      const { fileName, contentType, pipelineId } = body;
      if (!fileName) return Response.json({ error: "fileName required" }, { status: 400 });

      const filePath = pipelineId
        ? `factory/pipelines/${pipelineId}/${fileName}`
        : `factory/uploads/${userId}/${fileName}`;

      const bucket = getStorage().bucket(BUCKET_NAME);
      const file = bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: contentType || "application/octet-stream",
      });

      return Response.json({
        uploadUrl: url,
        filePath,
        expiresIn: "15 minutes",
      });
    }

    /* ── LIST FILES in a pipeline ── */
    if (action === "list-files") {
      const { pipelineId, prefix } = body;
      const filePrefix = prefix || (pipelineId ? `factory/pipelines/${pipelineId}/` : `factory/uploads/${userId}/`);

      const bucket = getStorage().bucket(BUCKET_NAME);
      const [files] = await bucket.getFiles({ prefix: filePrefix, maxResults: 100 });

      const fileList = files.map(f => ({
        name: f.name,
        size: f.metadata.size,
        contentType: f.metadata.contentType,
        created: f.metadata.timeCreated,
        updated: f.metadata.updated,
      }));

      return Response.json({ files: fileList, count: fileList.length, prefix: filePrefix });
    }

    /* ── DELETE FILE ── */
    if (action === "delete-file") {
      const { filePath } = body;
      if (!filePath) return Response.json({ error: "filePath required" }, { status: 400 });

      // Safety: only allow deleting factory files
      if (!filePath.startsWith("factory/")) {
        return Response.json({ error: "Can only delete files in factory/ prefix" }, { status: 403 });
      }

      const bucket = getStorage().bucket(BUCKET_NAME);
      await bucket.file(filePath).delete();

      return Response.json({ deleted: true, filePath });
    }

    /* ── DOWNLOAD URL — generate a signed read URL ── */
    if (action === "download-url") {
      const { filePath } = body;
      if (!filePath) return Response.json({ error: "filePath required" }, { status: 400 });

      const bucket = getStorage().bucket(BUCKET_NAME);
      const [url] = await bucket.file(filePath).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      return Response.json({ downloadUrl: url, expiresIn: "24 hours" });
    }

    return Response.json({
      error: "action must be: setup, upload-url, list-files, delete-file, or download-url",
    }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/STORAGE]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
