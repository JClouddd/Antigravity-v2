import { getAdminDb } from "@/lib/firebaseAdmin";

// GET — Load finance config (Plaid keys + environment)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    const doc = await adminDb.collection("users").doc(userId)
      .collection("finance_config").doc("plaid").get();

    if (!doc.exists) {
      return Response.json({
        configured: false,
        environment: "sandbox",
        clientId: "",
        hasSandboxSecret: false,
        hasDevelopmentSecret: false,
        hasProductionSecret: false,
      });
    }

    const data = doc.data();
    // Never return actual secrets — just whether they exist
    return Response.json({
      configured: true,
      environment: data.environment || "sandbox",
      clientId: data.clientId || "",
      hasSandboxSecret: !!data.secretSandbox,
      hasDevelopmentSecret: !!data.secretDevelopment,
      hasProductionSecret: !!data.secretProduction,
      updatedAt: data.updatedAt || null,
    });
  } catch (error) {
    console.error("[FINANCE CONFIG] GET error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST — Save finance config
export async function POST(req) {
  try {
    const { userId, clientId, secretSandbox, secretDevelopment, secretProduction, environment } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    const ref = adminDb.collection("users").doc(userId)
      .collection("finance_config").doc("plaid");

    // Merge — only update fields that were provided (don't wipe existing secrets)
    const update = { updatedAt: new Date().toISOString() };
    if (clientId !== undefined) update.clientId = clientId;
    if (environment !== undefined) update.environment = environment;
    if (secretSandbox !== undefined && secretSandbox !== "") update.secretSandbox = secretSandbox;
    if (secretDevelopment !== undefined && secretDevelopment !== "") update.secretDevelopment = secretDevelopment;
    if (secretProduction !== undefined && secretProduction !== "") update.secretProduction = secretProduction;

    await ref.set(update, { merge: true });

    return Response.json({
      success: true,
      environment: update.environment || environment,
      message: "Plaid configuration saved",
    });
  } catch (error) {
    console.error("[FINANCE CONFIG] POST error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
