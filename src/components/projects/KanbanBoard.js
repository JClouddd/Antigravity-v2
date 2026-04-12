"use client";

import { useState } from "react";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const PRIORITY_STYLES = {
  urgent: { background: "var(--error-light)", color: "var(--error)" },
  high: { background: "var(--warning-light)", color: "var(--warning)" },
  medium: { background: "var(--accent-light)", color: "var(--accent)" },
  low: { background: "var(--bg-secondary)", color: "var(--text-secondary)" },
};

export default function KanbanBoard({ tasks, projects, onCreateTask, onUpdateTask, onSelectTask }) {
  const [quickAdd, setQuickAdd] = useState({ column: null, title: "" });
  const [dragging, setDragging] = useState(null);

  const getProjectColor = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p?.color || "var(--accent)";
  };

  const handleDragStart = (e, taskId) => {
    setDragging(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    if (dragging) {
      onUpdateTask(dragging, { status });
      setDragging(null);
    }
  };

  const handleQuickAdd = async (status) => {
    if (!quickAdd.title.trim()) return;
    await onCreateTask({ title: quickAdd.title.trim(), status });
    setQuickAdd({ column: null, title: "" });
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16,
      height: "100%",
      overflow: "hidden",
    }}>
      {COLUMNS.map(({ key, label }) => {
        const columnTasks = tasks.filter((t) => t.status === key);
        return (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-lg)",
              padding: 12,
              overflow: "hidden",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, key)}
          >
            {/* Column Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              padding: "0 4px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, background: "var(--bg-primary)",
                  color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 100,
                }}>
                  {columnTasks.length}
                </span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setQuickAdd({ column: key, title: "" })}
                style={{ fontSize: 18 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => onSelectTask(task)}
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: 12,
                    cursor: "pointer",
                    transition: "box-shadow 0.15s, transform 0.1s",
                    opacity: dragging === task.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                >
                  {/* Project indicator */}
                  {task.projectId && (
                    <div style={{
                      width: 24, height: 3, borderRadius: 2,
                      background: getProjectColor(task.projectId),
                      marginBottom: 8,
                    }} />
                  )}
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{task.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {task.priority && task.priority !== "medium" && (
                      <span className="badge" style={PRIORITY_STYLES[task.priority]}>
                        {task.priority}
                      </span>
                    )}
                    {task.dueDate && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {task.dependencies?.length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        🔗 {task.dependencies.length}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Quick Add */}
              {quickAdd.column === key && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Task name..."
                    value={quickAdd.title}
                    onChange={(e) => setQuickAdd({ ...quickAdd, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuickAdd(key);
                      if (e.key === "Escape") setQuickAdd({ column: null, title: "" });
                    }}
                    autoFocus
                    style={{ flex: 1, fontSize: 13, padding: "8px 10px" }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Mobile: make columns stack */}
      <style jsx>{`
        @media (max-width: 768px) {
          div:first-child {
            grid-template-columns: 1fr !important;
            overflow-y: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
