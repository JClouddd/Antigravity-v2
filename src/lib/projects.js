import { db } from "./firebase";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, writeBatch
} from "firebase/firestore";

const PROJECTS_COL = "v2_projects";
const TASKS_COL = "v2_tasks";

// ===== PROJECTS =====

export async function getProjects(userId) {
  const ref = collection(db, "users", userId, PROJECTS_COL);
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createProject(userId, data) {
  const ref = collection(db, "users", userId, PROJECTS_COL);
  const newDoc = doc(ref);
  const project = {
    title: data.title || "Untitled Project",
    description: data.description || "",
    color: data.color || "#2563eb",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(newDoc, project);
  return { id: newDoc.id, ...project };
}

export async function updateProject(userId, projectId, updates) {
  const ref = doc(db, "users", userId, PROJECTS_COL, projectId);
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteProject(userId, projectId) {
  const ref = doc(db, "users", userId, PROJECTS_COL, projectId);
  await deleteDoc(ref);
}

// ===== TASKS =====

export async function getTasks(userId, projectId = null) {
  const ref = collection(db, "users", userId, TASKS_COL);
  let q;
  if (projectId) {
    q = query(ref, where("projectId", "==", projectId), orderBy("createdAt", "asc"));
  } else {
    q = query(ref, orderBy("createdAt", "asc"));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createTask(userId, data) {
  const ref = collection(db, "users", userId, TASKS_COL);
  const newDoc = doc(ref);
  const task = {
    projectId: data.projectId || null,
    title: data.title || "New Task",
    description: data.description || "",
    status: data.status || "todo",       // todo | in_progress | done
    priority: data.priority || "medium", // low | medium | high | urgent
    startDate: data.startDate || null,
    dueDate: data.dueDate || null,
    timeBlock: data.timeBlock || null,    // { date, startTime, endTime }
    dependencies: data.dependencies || [],
    googleCalendarEventId: null,
    googleTaskId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(newDoc, task);
  return { id: newDoc.id, ...task };
}

export async function updateTask(userId, taskId, updates) {
  const ref = doc(db, "users", userId, TASKS_COL, taskId);
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteTask(userId, taskId) {
  const ref = doc(db, "users", userId, TASKS_COL, taskId);
  await deleteDoc(ref);
}

export async function batchUpdateTasks(userId, updates) {
  const batch = writeBatch(db);
  for (const { taskId, data } of updates) {
    const ref = doc(db, "users", userId, TASKS_COL, taskId);
    batch.update(ref, { ...data, updatedAt: new Date().toISOString() });
  }
  await batch.commit();
}
