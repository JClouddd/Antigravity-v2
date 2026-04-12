"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem } from "@/lib/projects";
import PlanningView from "@/components/projects/PlanningView";

const PLAN_STATUS_COLORS = {
  draft: { bg: "var(--bg-secondary)", color: "var(--text-secondary)" },
  approved: { bg: "var(--accent-light)", color: "var(--accent)" },
  in_progress: { bg: "var(--warning-light)", color: "var(--warning)" },
  completed: { bg: "var(--success-light)", color: "var(--success)" },
};

const TABS = [
  { id: "blueprints", label: "📋 Blueprints" },
  { id: "ai_plans", label: "🤖 AI Plans" },
];

export default function PlanningModule() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("blueprints");
  const [items, setItems] = useState([]);
  const [aiPlans, setAiPlans] = useState([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getItems(user.uid);
    setItems(data);
    // Load AI implementation plans from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("ai_plans") || "[]");
      setAiPlans(stored);
    } catch { setAiPlans([]); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImplementPlan = async (plan) => {
    if (!user) return;
    // Create project from plan
    const project = await createItem(user.uid, {
      type: "project", title: plan.title, description: plan.description,
      status: "planning", priority: plan.priority || "medium",
    });
    // Create subtasks for each step
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

  const handleConvertAiPlan = async (plan) => {
    if (!user) return;
    const project = await createItem(user.uid, {
      type: "project", title: plan.title, description: plan.summary || plan.description,
      status: "planning", priority: "high",
    });
    if (plan.tasks?.length && project) {
      for (const task of plan.tasks) {
        await createItem(user.uid, {
          type: "subtask", title: typeof task === "string" ? task : task.title,
          parentId: project.id, status: "todo", priority: task.priority || "medium",
        });
      }
    }
    // Mark plan as converted
    const updated = aiPlans.map(p => p.id === plan.id ? { ...p, status: "in_progress", convertedAt: new Date().toISOString() } : p);
    localStorage.setItem("ai_plans", JSON.stringify(updated));
    setAiPlans(updated);
    loadData();
  };

  const handleDeleteAiPlan = (planId) => {
    const updated = aiPlans.filter(p => p.id !== planId);
    localStorage.setItem("ai_plans", JSON.stringify(updated));
    setAiPlans(updated);
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
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{aiPlans.length} plan{aiPlans.length !== 1 ? "s" : ""}</span>
            </div>

            {aiPlans.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📐</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No AI Plans Yet</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 300, margin: "0 auto" }}>
                  Implementation plans from AI coding sessions will appear here. You can convert them into projects with subtasks.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {aiPlans.map(plan => (
                <div key={plan.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{plan.title}</h4>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "Unknown date"}
                      </span>
                    </div>
                    <span className="badge" style={PLAN_STATUS_COLORS[plan.status || "draft"]}>
                      {(plan.status || "draft").replace("_", " ")}
                    </span>
                  </div>

                  {plan.summary && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{plan.summary}</p>}

                  {plan.tasks?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Tasks ({plan.tasks.length})</div>
                      {plan.tasks.slice(0, 5).map((task, i) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "2px 0", display: "flex", gap: 4 }}>
                          <span style={{ color: "var(--text-tertiary)" }}>•</span>
                          {typeof task === "string" ? task : task.title}
                        </div>
                      ))}
                      {plan.tasks.length > 5 && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>+{plan.tasks.length - 5} more</div>}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    {!plan.convertedAt && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleConvertAiPlan(plan)}>
                        Convert to Project
                      </button>
                    )}
                    {plan.convertedAt && <span style={{ fontSize: 11, color: "var(--success)" }}>✅ Converted</span>}
                    <button className="btn btn-sm" onClick={() => handleDeleteAiPlan(plan.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
