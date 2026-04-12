"use client";

import { useState } from "react";

export default function PlanningView({ items, onUpdate, onSelect, onImplementPlan }) {
  const [expandedId, setExpandedId] = useState(null);

  const plans = items.filter(i => i.type === "plan");
  const planningItems = items.filter(i => i.type !== "plan" && i.status === "planning");
  // Steps (subtasks of plans)
  const getSteps = (planId) => items.filter(i => i.parentId === planId);

  return (
    <div style={{ padding: 20 }}>
      {/* Plans Section */}
      {plans.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            📋 Plans & Blueprints
          </h3>
          {plans.map(plan => {
            const steps = getSteps(plan.id);
            const doneSteps = steps.filter(s => s.status === "done").length;
            const expanded = expandedId === plan.id;
            const implemented = plan.implementedProjectId;

            return (
              <div key={plan.id} className="card" style={{ marginBottom: 8, padding: 0, overflow: "hidden" }}>
                {/* Plan Header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : plan.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                    cursor: "pointer", borderLeft: `3px solid ${plan.color || "#7c3aed"}`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.title}</div>
                    {plan.description && (
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {plan.description.slice(0, 80)}{plan.description.length > 80 ? "..." : ""}
                      </div>
                    )}
                  </div>
                  {steps.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {doneSteps}/{steps.length} steps
                    </span>
                  )}
                  {implemented ? (
                    <span className="badge" style={{ fontSize: 10, background: "#059669", color: "white" }}>
                      Implemented
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => { e.stopPropagation(); onImplementPlan(plan); }}
                      style={{ fontSize: 11, whiteSpace: "nowrap" }}
                    >
                      Implement →
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </div>

                {/* Expanded Steps */}
                {expanded && (
                  <div style={{ padding: "0 16px 12px 32px", borderTop: "1px solid var(--border)" }}>
                    {plan.description && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0", whiteSpace: "pre-wrap" }}>
                        {plan.description}
                      </div>
                    )}
                    {steps.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {steps.map(step => (
                          <div key={step.id} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                            fontSize: 13, borderBottom: "1px solid var(--border)",
                          }}>
                            <button
                              onClick={() => onUpdate(step.id, { status: step.status === "done" ? "planning" : "done", completedAt: step.status === "done" ? null : new Date().toISOString() })}
                              style={{
                                width: 16, height: 16, borderRadius: 3, border: "1px solid var(--border)",
                                background: step.status === "done" ? "var(--accent)" : "transparent",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                color: "white", fontSize: 9,
                              }}
                            >{step.status === "done" ? "✓" : ""}</button>
                            <span style={{ textDecoration: step.status === "done" ? "line-through" : "none", color: step.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                              {step.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>
                        No steps defined. Click to edit and add steps.
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-sm" onClick={() => onSelect(plan)} style={{ fontSize: 11 }}>
                        Edit Plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Other Planning Items */}
      {planningItems.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            ⏳ Items in Planning
          </h3>
          {planningItems.map(item => (
            <div key={item.id} className="card" style={{ marginBottom: 6, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => onSelect(item)}>
              <span>{item.type === "project" ? "📁" : item.type === "task" ? "✅" : "📅"}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.title}</span>
              <span className="badge" style={{ fontSize: 10 }}>{item.type}</span>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { status: "todo" }); }}
                style={{ fontSize: 11 }}>
                Activate →
              </button>
            </div>
          ))}
        </div>
      )}

      {plans.length === 0 && planningItems.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ marginBottom: 4 }}>No plans yet.</p>
          <p style={{ fontSize: 12 }}>Create a plan to stage objectives before implementing them as projects.</p>
        </div>
      )}
    </div>
  );
}
