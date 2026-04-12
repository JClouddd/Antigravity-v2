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

    // Dependencies
    dependencies: data.dependencies || [],

    // Google sync
    googleCalendarEventId: data.googleCalendarEventId || null,
    googleTaskId: data.googleTaskId || null,

    // Visual
    color: data.color || "#2563eb",

    // Source tracking (for AI-generated items)
    source: data.source || "manual",       // manual | antigravity | planning
    sourceRef: data.sourceRef || null,      // Reference to implementation plan, etc.

    // Timestamps
    createdAt: now,
    updatedAt: now,
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
  return items.filter((i) => i.status === "planning");
}

export function getActiveItems(items) {
  return items.filter((i) => i.status !== "planning" && i.status !== "archived");
}
