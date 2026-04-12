// Goals / OKR library
import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";

const GOALS_COL = "v2_goals";

export async function getGoals(userId) {
  const ref = collection(db, "users", userId, GOALS_COL);
  const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createGoal(userId, data) {
  const ref = collection(db, "users", userId, GOALS_COL);
  const newDoc = doc(ref);
  const goal = {
    title: data.title,
    description: data.description || "",
    timeframe: data.timeframe || "Q2 2026", // Quarter label
    status: "active", // active, achieved, abandoned
    keyResults: data.keyResults || [], // [{ title, target, current, unit }]
    linkedProjectIds: data.linkedProjectIds || [],
    color: data.color || "#7c3aed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(newDoc, goal);
  return { id: newDoc.id, ...goal };
}

export async function updateGoal(userId, goalId, updates) {
  const ref = doc(db, "users", userId, GOALS_COL, goalId);
  await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteGoal(userId, goalId) {
  await deleteDoc(doc(db, "users", userId, GOALS_COL, goalId));
}

// Calculate goal progress from linked projects
export function calculateGoalProgress(goal, items) {
  if (!goal.linkedProjectIds?.length) {
    // Use key results
    if (!goal.keyResults?.length) return 0;
    const total = goal.keyResults.reduce((s, kr) => s + (kr.target > 0 ? (kr.current / kr.target) * 100 : 0), 0);
    return Math.round(total / goal.keyResults.length);
  }
  // Calculate from linked projects
  const linkedProjects = items.filter(i => goal.linkedProjectIds.includes(i.id));
  if (!linkedProjects.length) return 0;
  const subtasks = items.filter(i => i.type === "subtask" && goal.linkedProjectIds.includes(i.parentId));
  if (!subtasks.length) {
    const done = linkedProjects.filter(p => p.status === "done").length;
    return Math.round((done / linkedProjects.length) * 100);
  }
  const done = subtasks.filter(s => s.status === "done").length;
  return Math.round((done / subtasks.length) * 100);
}
