import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

// AI Sync API — allows the AI agent to push implementation plans and mark progress
// 
// ACTIONS:
//   POST /api/ai-sync
//   Body: { action, token (user UID), ... }
//
//   action: "create_plan"   → Creates a project + subtasks from an implementation plan
//   action: "update_task"   → Updates a task/subtask status (mark done, in_progress, etc.)
//   action: "complete_plan" → Marks an entire project + all subtasks as done
//   action: "get_plans"     → Lists all AI-created projects

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, token } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token (user UID)" }, { status: 401 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: "Server not configured — set FIREBASE_SERVICE_ACCOUNT_KEY" }, { status: 503 });
    }

    const itemsRef = adminDb.collection("users").doc(token).collection("v2_items");
    const now = new Date().toISOString();

    // ──────────────────────────────────────────
    // CREATE PLAN → Project + Subtasks
    // ──────────────────────────────────────────
    if (action === "create_plan") {
      const { title, description, tasks = [], priority = "high" } = body;

      if (!title) {
        return NextResponse.json({ error: "Missing title" }, { status: 400 });
      }

      // Create the project
      const projectRef = itemsRef.doc();
      const project = {
        type: "project",
        title,
        description: description || "",
        status: "in_progress",
        priority,
        parentId: null,
        startDate: now.split("T")[0],
        dueDate: null,
        timeBlock: null,
        allDay: false,
        location: "",
        notes: "",
        reminders: [],
        recurrence: null,
        attendees: [],
        conferenceLink: null,
        dependencies: [],
        googleCalendarEventId: null,
        googleTaskId: null,
        color: "#7c3aed",
        source: "ai_agent",
        sourceRef: body.sessionId || null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      await projectRef.set(project);

      // Create subtasks
      const subtaskIds = [];
      for (const task of tasks) {
        const taskTitle = typeof task === "string" ? task : task.title;
        const taskPriority = typeof task === "string" ? "medium" : (task.priority || "medium");
        const subtaskRef = itemsRef.doc();
        await subtaskRef.set({
          type: "subtask",
          title: taskTitle,
          description: typeof task === "string" ? "" : (task.description || ""),
          status: "todo",
          priority: taskPriority,
          parentId: projectRef.id,
          startDate: null,
          dueDate: null,
          timeBlock: null,
          allDay: false,
          location: "",
          notes: "",
          reminders: [],
          recurrence: null,
          attendees: [],
          conferenceLink: null,
          dependencies: [],
          googleCalendarEventId: null,
          googleTaskId: null,
          color: null,
          source: "ai_agent",
          sourceRef: body.sessionId || null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
        subtaskIds.push({ id: subtaskRef.id, title: taskTitle });
      }

      return NextResponse.json({
        success: true,
        projectId: projectRef.id,
        projectTitle: title,
        subtasks: subtaskIds,
        message: `Created project "${title}" with ${subtaskIds.length} subtasks`,
      });
    }

    // ──────────────────────────────────────────
    // UPDATE TASK → Mark status on a specific item
    // ──────────────────────────────────────────
    if (action === "update_task") {
      const { taskId, status, notes } = body;

      if (!taskId || !status) {
        return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
      }

      const updates = { status, updatedAt: now };
      if (status === "done") updates.completedAt = now;
      if (notes) updates.notes = notes;

      await itemsRef.doc(taskId).update(updates);

      return NextResponse.json({
        success: true,
        taskId,
        status,
        message: `Updated task ${taskId} to ${status}`,
      });
    }

    // ──────────────────────────────────────────
    // COMPLETE PLAN → Mark project + all subtasks done
    // ──────────────────────────────────────────
    if (action === "complete_plan") {
      const { projectId } = body;

      if (!projectId) {
        return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
      }

      // Mark the project done
      await itemsRef.doc(projectId).update({
        status: "done",
        completedAt: now,
        updatedAt: now,
      });

      // Mark all subtasks done
      const subtasksSnap = await itemsRef.where("parentId", "==", projectId).get();
      const batch = adminDb.batch();
      subtasksSnap.docs.forEach(doc => {
        batch.update(doc.ref, { status: "done", completedAt: now, updatedAt: now });
      });
      await batch.commit();

      return NextResponse.json({
        success: true,
        projectId,
        subtasksCompleted: subtasksSnap.size,
        message: `Completed project ${projectId} and ${subtasksSnap.size} subtasks`,
      });
    }

    // ──────────────────────────────────────────
    // GET PLANS → List AI-created projects
    // ──────────────────────────────────────────
    if (action === "get_plans") {
      const snap = await itemsRef
        .where("source", "==", "ai_agent")
        .where("type", "==", "project")
        .get();

      const plans = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({ success: true, plans });
    }

    return NextResponse.json({ error: "Unknown action. Use: create_plan, update_task, complete_plan, get_plans" }, { status: 400 });
  } catch (err) {
    console.error("[AI-SYNC] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Also support GET for simple status checks
export async function GET(req) {
  return NextResponse.json({
    status: "ok",
    actions: ["create_plan", "update_task", "complete_plan", "get_plans"],
    usage: "POST with { action, token, ... }",
  });
}
