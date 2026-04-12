import { db } from "./firebase";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, writeBatch
} from "firebase/firestore";

const ITEMS_COL = "v2_items"; // Unified collection for projects, tasks, sub-tasks, events

// ===== ITEM TYPES =====
// project  — Top-level container (has sub-tasks, events)
// task     — Standalone task (not tied to a project)
// subtask  — Child of a project
// event    — Calendar event (standalone or tied to a project)

// ===== READ =====

export async function getItems(userId) {
  const ref = collection(db, "users", userId, ITEMS_COL);
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ===== CREATE =====

export async function createItem(userId, data) {
  const ref = collection(db, "users", userId, ITEMS_COL);
  const newDoc = doc(ref);
  const now = new Date().toISOString();

  const item = {
    // Core fields
    type: data.type || "task",            // project | task | subtask | event
    title: data.title || "Untitled",
    description: data.description || "",
    status: data.status || "todo",        // planning | todo | in_progress | done | archived
    priority: data.priority || "medium",  // low | medium | high | urgent

    // Hierarchy
    parentId: data.parentId || null,       // For sub-tasks: points to project ID

    // Dates
    startDate: data.startDate || null,
    dueDate: data.dueDate || null,

    // Time blocking (events + tasks)
    timeBlock: data.timeBlock || null,      // { date, startTime, endTime }
    allDay: data.allDay || false,           // Google Calendar: all-day event

    // Google Calendar fields (full widget compatibility)
    location: data.location || "",          // Physical or virtual location
    notes: data.notes || "",               // Additional notes (maps to Google Tasks notes)
    reminders: data.reminders || [],        // [{ method: "popup"|"email", minutes: 10 }]
    recurrence: data.recurrence || null,    // RRULE string: "RRULE:FREQ=WEEKLY;BYDAY=MO"
    attendees: data.attendees || [],        // [{ email: "...", displayName: "..." }]
    conferenceLink: data.conferenceLink || null, // Google Meet link
    calendarId: data.calendarId || "primary",

    // Dependencies
    dependencies: data.dependencies || [],

    // Google sync IDs
    googleCalendarEventId: data.googleCalendarEventId || null,
    googleTaskId: data.googleTaskId || null,
    googleTaskListId: data.googleTaskListId || null,

    // Visual
    color: data.color || "#2563eb",

    // Source tracking (for AI-generated items)
    source: data.source || "manual",       // manual | antigravity | planning
    sourceRef: data.sourceRef || null,      // Reference to implementation plan, etc.

    // Timestamps
    createdAt: now,
    updatedAt: now,
    completedAt: data.completedAt || null,  // When marked done
  };

  await setDoc(newDoc, item);
  return { id: newDoc.id, ...item };
}

// ===== UPDATE =====

export async function updateItem(userId, itemId, updates) {
  const ref = doc(db, "users", userId, ITEMS_COL, itemId);
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
}

// ===== DELETE =====

export async function deleteItem(userId, itemId) {
  const ref = doc(db, "users", userId, ITEMS_COL, itemId);
  await deleteDoc(ref);
}

// ===== BATCH =====

export async function batchUpdateItems(userId, updates) {
  const batch = writeBatch(db);
  for (const { itemId, data } of updates) {
    const ref = doc(db, "users", userId, ITEMS_COL, itemId);
    batch.update(ref, { ...data, updatedAt: new Date().toISOString() });
  }
  await batch.commit();
}

// ===== HELPERS =====

export function getProjects(items) {
  return items.filter((i) => i.type === "project");
}

export function getSubtasks(items, projectId) {
  return items.filter((i) => i.type === "subtask" && i.parentId === projectId);
}

export function getStandaloneTasks(items) {
  return items.filter((i) => i.type === "task");
}

export function getEvents(items) {
  return items.filter((i) => i.type === "event");
}

export function getPlanningItems(items) {
  const planIds = new Set(items.filter(i => i.type === "plan").map(i => i.id));
  return items.filter((i) => i.status === "planning" || i.type === "plan" || planIds.has(i.parentId));
}

export function getActiveItems(items) {
  return items.filter((i) => i.status !== "planning" && i.status !== "archived");
}

// ===== UPSERT (for pull sync) =====

export async function upsertItemByGoogleId(userId, googleField, googleId, data) {
  // Check if an item with this Google ID already exists
  const ref = collection(db, "users", userId, ITEMS_COL);
  const q = query(ref, where(googleField, "==", googleId));
  const snap = await getDocs(q);

  if (snap.docs.length > 0) {
    // Update existing — only update fields the user hasn't manually changed
    const existing = snap.docs[0];
    const existingData = existing.data();
    // Don't overwrite if user manually edited it more recently
    if (existingData.source === "google" || !existingData.updatedAt || existingData.updatedAt < data.updatedAt) {
      await updateDoc(existing.ref, { ...data, updatedAt: new Date().toISOString() });
    }
    return { id: existing.id, ...existingData, ...data };
  } else {
    // Create new
    const newDoc = doc(ref);
    const item = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(newDoc, item);
    return { id: newDoc.id, ...item };
  }
}
