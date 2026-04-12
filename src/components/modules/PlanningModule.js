"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem } from "@/lib/projects";
import PlanningView from "@/components/projects/PlanningView";

const STATUS_COLORS = {
  todo: { bg: "var(--bg-secondary)", color: "var(--text-secondary)" },
  planning: { bg: "var(--bg-secondary)", color: "var(--text-secondary)" },
  in_progress: { bg: "var(--warning-light)", color: "var(--warning)" },
  done: { bg: "var(--success-light)", color: "var(--success)" },
};

const TABS = [
  { id: "blueprints", label: "📋 Blueprints" },
  { id: "ai_plans", label: "🤖 AI Plans" },
];

export default function PlanningModule() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ai_plans");
  const [items, setItems] = useState([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getItems(user.uid);
    setItems(data);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // AI Plans = projects created by the AI agent (source === "ai_agent")
  const aiProjects = items
    .filter(i => i.source === "ai_agent" && i.type === "project")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  // Get subtasks for an AI project
  const getSubtasks = (projectId) =>
    items.filter(i => i.parentId === projectId).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const getProgress = (projectId) => {
    const subs = getSubtasks(projectId);
    if (subs.length === 0) return null;
    const done = subs.filter(s => s.status === "done").length;
    return { done, total: subs.length, pct: Math.round((done / subs.length) * 100) };
  };

  const handleImplementPlan = async (plan) => {
    if (!user) return;
    const project = await createItem(user.uid, {
      type: "project", title: plan.title, description: plan.description,
      status: "planning", priority: plan.priority || "medium",
    });
    if (plan.steps?.length && project) {
      for (const step of plan.steps) {
        await createItem(user.uid, {
          type: "subtask", title: step.title || step, parentId: project.id,
          status: "todo", priority: "medium",
        });
      }
    }
    loadData();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 32px 0" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Planning</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Blueprints and AI implementation plans</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, padding: "0 32px", borderBottom: "1px solid var(--border)" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            border: "none", background: "none",
            color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
            borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
            transition: "all 0.15s",
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px 32px" }}>
        {activeTab === "blueprints" && (
          <PlanningView items={items} onUpdate={async (id, updates) => { if (user) { await updateItem(user.uid, id, updates); loadData(); } }} onImplementPlan={handleImplementPlan} />
        )}

        {activeTab === "ai_plans" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Implementation Plans from AI Sessions</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{aiProjects.length} plan{aiProjects.length !== 1 ? "s" : ""}</span>
                <button className="btn btn-sm" onClick={loadData} title="Refresh">🔄</button>
              </div>
            </div>

            {aiProjects.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No AI Plans Yet</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                  When the AI agent works on features, implementation plans automatically appear here as projects with tracked subtasks.
                </p>
                <div style={{ marginTop: 16, padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  POST /api/ai-sync<br />
                  {"{"} action: &quot;create_plan&quot;, token: &quot;uid&quot;, title, tasks [...] {"}"}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {aiProjects.map(project => {
                const progress = getProgress(project.id);
                const subtasks = getSubtasks(project.id);

                return (
                  <div key={project.id} className="card" style={{ padding: 16 }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 600 }}>{project.title}</h4>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(124,58,237,0.1)", color: "#7c3aed", fontWeight: 600 }}>AI</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          {project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <span className="badge" style={STATUS_COLORS[project.status] || STATUS_COLORS.todo}>
                        {(project.status || "todo").replace("_", " ")}
                      </span>
                    </div>

                    {/* Description */}
                    {project.description && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{project.description}</p>
                    )}

                    {/* Progress bar */}
                    {progress && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                          <span>Progress</span>
                          <span>{progress.done}/{progress.total} ({progress.pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${progress.pct}%`, background: progress.pct === 100 ? "var(--success)" : "var(--accent)", borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    )}

                    {/* Subtasks */}
                    {subtasks.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Tasks ({subtasks.length})</div>
                        {subtasks.map(task => (
                          <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 12 }}>
                            <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>
                              {task.status === "done" ? "✅" : task.status === "in_progress" ? "🔄" : "⬜"}
                            </span>
                            <span style={{
                              flex: 1,
                              color: task.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)",
                              textDecoration: task.status === "done" ? "line-through" : "none",
                            }}>{task.title}</span>
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{(task.status || "todo").replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {project.sourceRef && (
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>Session: {project.sourceRef}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
