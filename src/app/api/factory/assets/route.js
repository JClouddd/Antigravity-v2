import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getDb() {
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      initializeApp({ credential: cert(JSON.parse(cred)) });
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore();
}

/**
 * POST /api/factory/assets
 *
 * Asset management for the Factory pipeline.
 * Manages generated media assets — images, videos, audio, thumbnails.
 * Tracks asset metadata, styles, and favorites for re-use.
 *
 * Actions: save, list, favorite, delete, styles
 *
 * This is the "Generations Gallery" (inspired by RUBRIC Generations tab).
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const db = getDb();
    const assetsRef = db.collection("users").doc(userId).collection("factory_assets");
    const stylesRef = db.collection("users").doc(userId).collection("factory_styles");

    /* ── SAVE asset ── */
    if (action === "save") {
      const { url, type, prompt, model, pipelineId, channelId, metadata } = body;
      if (!url) return Response.json({ error: "url required" }, { status: 400 });

      const asset = {
        url,
        type: type || "image", // image, video, audio, thumbnail, music
        prompt: prompt || "",
        model: model || "",
        pipelineId: pipelineId || "",
        channelId: channelId || "",
        favorited: false,
        tags: metadata?.tags || [],
        style: metadata?.style || "",
        width: metadata?.width || null,
        height: metadata?.height || null,
        duration: metadata?.duration || null,
        fileSize: metadata?.fileSize || null,
        createdAt: new Date().toISOString(),
      };

      const ref = await assetsRef.add(asset);
      return Response.json({ assetId: ref.id, ...asset });
    }

    /* ── LIST assets ── */
    if (action === "list") {
      const { type, pipelineId, channelId, favoritesOnly, limit: queryLimit } = body;

      let query = assetsRef.orderBy("createdAt", "desc");
      if (queryLimit) query = query.limit(Number(queryLimit));
      else query = query.limit(50);

      const snapshot = await query.get();
      let assets = [];
      snapshot.forEach(doc => assets.push({ assetId: doc.id, ...doc.data() }));

      // Client-side filters (Firestore single-field index limitation)
      if (type) assets = assets.filter(a => a.type === type);
      if (pipelineId) assets = assets.filter(a => a.pipelineId === pipelineId);
      if (channelId) assets = assets.filter(a => a.channelId === channelId);
      if (favoritesOnly) assets = assets.filter(a => a.favorited);

      return Response.json({ assets, count: assets.length });
    }

    /* ── FAVORITE / UNFAVORITE ── */
    if (action === "favorite") {
      const { assetId, favorited } = body;
      if (!assetId) return Response.json({ error: "assetId required" }, { status: 400 });

      await assetsRef.doc(assetId).update({ favorited: favorited !== false });
      return Response.json({ assetId, favorited: favorited !== false });
    }

    /* ── DELETE asset ── */
    if (action === "delete") {
      const { assetId } = body;
      if (!assetId) return Response.json({ error: "assetId required" }, { status: 400 });
      await assetsRef.doc(assetId).delete();
      return Response.json({ assetId, deleted: true });
    }

    /* ── SAVE STYLE — bookmark a generation style for re-use ── */
    if (action === "save-style") {
      const { name, prompt, model, settings, previewUrl, category } = body;
      if (!name || !prompt) return Response.json({ error: "name and prompt required" }, { status: 400 });

      const style = {
        name,
        prompt,
        model: model || "",
        settings: settings || {},
        previewUrl: previewUrl || "",
        category: category || "general", // cinematic, minimal, dramatic, playful, professional
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };

      const ref = await stylesRef.add(style);
      return Response.json({ styleId: ref.id, ...style });
    }

    /* ── LIST STYLES ── */
    if (action === "styles") {
      const snapshot = await stylesRef.orderBy("usageCount", "desc").get();
      const styles = [];
      snapshot.forEach(doc => styles.push({ styleId: doc.id, ...doc.data() }));
      return Response.json({ styles, count: styles.length });
    }

    /* ── USE STYLE — increment usage, return prompt + settings ── */
    if (action === "use-style") {
      const { styleId } = body;
      if (!styleId) return Response.json({ error: "styleId required" }, { status: 400 });

      const doc = await stylesRef.doc(styleId).get();
      if (!doc.exists) return Response.json({ error: "Style not found" }, { status: 404 });

      const { FieldValue } = await import("firebase-admin/firestore");
      await stylesRef.doc(styleId).update({ usageCount: FieldValue.increment(1) });

      const style = doc.data();
      return Response.json({ prompt: style.prompt, model: style.model, settings: style.settings });
    }

    return Response.json({
      error: "action must be: save, list, favorite, delete, save-style, styles, or use-style",
    }, { status: 400 });
  } catch (err) {
    console.error("[FACTORY/ASSETS]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
