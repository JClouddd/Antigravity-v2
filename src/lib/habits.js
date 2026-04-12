// Habits library — manages habit definitions and daily completions
import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";

const HABITS_COL = "v2_habits";

export async function getHabits(userId) {
  const ref = collection(db, "users", userId, HABITS_COL);
  const snap = await getDocs(query(ref, orderBy("createdAt", "asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createHabit(userId, data) {
  const ref = collection(db, "users", userId, HABITS_COL);
  const newDoc = doc(ref);
  const habit = {
    title: data.title,
    frequency: data.frequency || "daily", // daily, weekdays, weekly
    color: data.color || "#059669",
    icon: data.icon || "✓",
    completions: [], // ["2026-04-10", "2026-04-11"]
    streak: 0,
    bestStreak: 0,
    createdAt: new Date().toISOString(),
  };
  await setDoc(newDoc, habit);
  return { id: newDoc.id, ...habit };
}

export async function toggleHabitDay(userId, habitId, date, currentCompletions) {
  const ref = doc(db, "users", userId, HABITS_COL, habitId);
  const isComplete = currentCompletions.includes(date);
  const completions = isComplete
    ? currentCompletions.filter(d => d !== date)
    : [...currentCompletions, date].sort();

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (completions.includes(ds)) streak++;
    else break;
  }

  await updateDoc(ref, { completions, streak, updatedAt: new Date().toISOString() });
  return { completions, streak };
}

export async function deleteHabit(userId, habitId) {
  await deleteDoc(doc(db, "users", userId, HABITS_COL, habitId));
}
