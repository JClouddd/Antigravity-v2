import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

// Siri Shortcuts API
// URL: /api/siri?action=add&type=task&title=Buy%20groceries&token=USER_UID

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const token = searchParams.get("token");
  const type = searchParams.get("type") || "task";
  const title = searchParams.get("title");
  const dueDate = searchParams.get("due") || null;
  const priority = searchParams.get("priority") || "medium";

  if (!token) {
    return NextResponse.json({ error: "Missing token (user UID)" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Server not configured — set FIREBASE_SERVICE_ACCOUNT_KEY" }, { status: 503 });
  }

  if (action === "add") {
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const item = {
      type: ["task", "event", "project"].includes(type) ? type : "task",
      title, description: "", status: "todo", priority,
      parentId: null, startDate: null, dueDate,
      timeBlock: null, allDay: false, location: "", notes: "",
      reminders: [], recurrence: null, attendees: [],
      conferenceLink: null, calendarId: "primary", dependencies: [],
      googleCalendarEventId: null, googleTaskId: null, googleTaskListId: null,
      color: "#2563eb", source: "siri", sourceRef: null,
      createdAt: now, updatedAt: now, completedAt: null,
    };

    try {
      const ref = adminDb.collection("users").doc(token).collection("v2_items").doc();
      await ref.set(item);
      return NextResponse.json({ success: true, id: ref.id, title, type });
    } catch (err) {
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }
  }

  if (action === "today") {
    try {
      const today = new Date().toISOString().split("T")[0];
      const snapshot = await adminDb.collection("users").doc(token).collection("v2_items")
        .where("status", "!=", "done").get();
      const items = snapshot.docs
        .map(d => d.data())
        .filter(i => i.dueDate === today || i.timeBlock?.date === today)
        .map(i => `${i.type === "event" ? "📅" : "✅"} ${i.title}`);
      return NextResponse.json({ count: items.length, items });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action. Use: add, today" }, { status: 400 });
}
