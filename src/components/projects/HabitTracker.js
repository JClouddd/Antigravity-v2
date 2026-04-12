"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getHabits, createHabit, toggleHabitDay, deleteHabit } from "@/lib/habits";

const COLORS = ["#059669", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#be185d"];

export default function HabitTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("#059669");

  const load = useCallback(async () => {
    if (!user) return;
    setHabits(await getHabits(user.uid));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().split("T")[0];

  // Generate last 28 days for the grid
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i));
    return d.toISOString().split("T")[0];
  });

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const h = await createHabit(user.uid, { title: newTitle.trim(), color: newColor });
    setHabits(prev => [...prev, h]);
    setNewTitle(""); setShowAdd(false);
  };

  const handleToggle = async (habit, date) => {
    const { completions, streak } = await toggleHabitDay(user.uid, habit.id, date, habit.completions || []);
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, completions, streak } : h));
  };

  const handleDelete = async (id) => {
    await deleteHabit(user.uid, id);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Habits</h2>
        <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>+ Add Habit</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Habit name..." style={{ flex: 1, fontSize: 13 }} autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <div style={{ display: "flex", gap: 3 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} style={{
                width: 18, height: 18, borderRadius: "50%", border: newColor === c ? "2px solid white" : "none",
                background: c, cursor: "pointer", outline: newColor === c ? `2px solid ${c}` : "none",
              }} />
            ))}
          </div>
          <button className="btn btn-sm btn-primary" onClick={handleAdd}>Add</button>
          <button className="btn btn-sm" onClick={() => setShowAdd(false)}>✕</button>
        </div>
      )}

      {habits.length === 0 && !showAdd && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
          <p>No habits yet. Build consistency one day at a time.</p>
        </div>
      )}

      {habits.map(habit => (
        <div key={habit.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: habit.color }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{habit.title}</span>
              {habit.streak > 0 && (
                <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>🔥 {habit.streak}d</span>
              )}
            </div>
            <button onClick={() => handleDelete(habit.id)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
          {/* Contribution grid */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {days.map(day => {
              const done = (habit.completions || []).includes(day);
              const isToday = day === today;
              return (
                <button key={day} onClick={() => handleToggle(habit, day)} title={day}
                  style={{
                    width: 16, height: 16, borderRadius: 2, border: isToday ? `1px solid ${habit.color}` : "none",
                    background: done ? habit.color : "var(--bg-secondary)",
                    opacity: done ? 1 : 0.3, cursor: "pointer", transition: "all 0.15s",
                  }} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
