"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getGoals, createGoal, updateGoal, deleteGoal, calculateGoalProgress } from "@/lib/goals";

const COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2", "#be185d"];

export default function GoalsView({ items }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", timeframe: "Q2 2026", color: "#7c3aed", keyResults: [], linkedProjectIds: [] });

  const load = useCallback(async () => {
    if (!user) return;
    setGoals(await getGoals(user.uid));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const projects = (items || []).filter(i => i.type === "project");

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    const g = await createGoal(user.uid, form);
    setGoals(prev => [g, ...prev]);
    setForm({ title: "", description: "", timeframe: "Q2 2026", color: "#7c3aed", keyResults: [], linkedProjectIds: [] });
    setShowAdd(false);
  };

  const handleDelete = async (id) => {
    await deleteGoal(user.uid, id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const addKeyResult = () => {
    setForm(prev => ({ ...prev, keyResults: [...prev.keyResults, { title: "", target: 100, current: 0, unit: "%" }] }));
  };

  const updateKR = (idx, field, value) => {
    setForm(prev => {
      const kr = [...prev.keyResults];
      kr[idx] = { ...kr[idx], [field]: value };
      return { ...prev, keyResults: kr };
    });
  };

  const toggleProject = (projectId) => {
    setForm(prev => {
      const ids = prev.linkedProjectIds.includes(projectId)
        ? prev.linkedProjectIds.filter(id => id !== projectId)
        : [...prev.linkedProjectIds, projectId];
      return { ...prev, linkedProjectIds: ids };
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Goals & OKRs</h2>
        <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>+ New Goal</button>
      </div>

      {/* Create Form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <input type="text" value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Goal title..." style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, width: "100%" }} autoFocus />
          <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description..." style={{ fontSize: 12, marginBottom: 8, width: "100%", minHeight: 50 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input type="text" value={form.timeframe} onChange={(e) => setForm(prev => ({ ...prev, timeframe: e.target.value }))}
              placeholder="Q2 2026" style={{ width: 120, fontSize: 12 }} />
            <div style={{ display: "flex", gap: 3 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(prev => ({ ...prev, color: c }))} style={{
                  width: 18, height: 18, borderRadius: "50%", border: form.color === c ? "2px solid white" : "none",
                  background: c, cursor: "pointer", outline: form.color === c ? `2px solid ${c}` : "none",
                }} />
              ))}
            </div>
          </div>

          {/* Key Results */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Key Results</span>
              <button className="btn btn-sm" onClick={addKeyResult} style={{ fontSize: 11 }}>+ Add KR</button>
            </div>
            {form.keyResults.map((kr, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                <input type="text" value={kr.title} onChange={(e) => updateKR(idx, "title", e.target.value)}
                  placeholder="Key result..." style={{ flex: 1, fontSize: 12 }} />
                <input type="number" value={kr.current} onChange={(e) => updateKR(idx, "current", Number(e.target.value))}
                  style={{ width: 50, fontSize: 12 }} />
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>/</span>
                <input type="number" value={kr.target} onChange={(e) => updateKR(idx, "target", Number(e.target.value))}
                  style={{ width: 50, fontSize: 12 }} />
              </div>
            ))}
          </div>

          {/* Link Projects */}
          {projects.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Linked Projects</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {projects.map(p => (
                  <button key={p.id} className={`btn btn-sm ${form.linkedProjectIds.includes(p.id) ? "btn-primary" : ""}`}
                    onClick={() => toggleProject(p.id)} style={{ fontSize: 11 }}>
                    {form.linkedProjectIds.includes(p.id) ? "✓ " : ""}{p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={handleCreate}>Create Goal</button>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 && !showAdd && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <p>No goals set. Define objectives to drive your projects forward.</p>
        </div>
      )}

      {goals.map(goal => {
        const progress = calculateGoalProgress(goal, items || []);
        const linkedProjects = projects.filter(p => goal.linkedProjectIds?.includes(p.id));
        const linkedSubtasks = (items || []).filter(i => i.type === "subtask" && goal.linkedProjectIds?.includes(i.parentId));
        const doneSubtasks = linkedSubtasks.filter(s => s.status === "done").length;

        return (
          <div key={goal.id} className="card" style={{ marginBottom: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: goal.color }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{goal.title}</h3>
                  <span className="badge" style={{ fontSize: 9 }}>{goal.timeframe}</span>
                </div>
                {goal.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{goal.description}</p>}
              </div>
              <button onClick={() => handleDelete(goal.id)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>✕</button>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: goal.color }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: goal.color, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Key Results */}
            {goal.keyResults?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {goal.keyResults.map((kr, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                    <span>{kr.title}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>{kr.current}/{kr.target}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Linked Projects */}
            {linkedProjects.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  📁 {linkedProjects.map(p => p.title).join(", ")} • {doneSubtasks}/{linkedSubtasks.length} tasks done
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
