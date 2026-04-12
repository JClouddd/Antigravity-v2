"use client";

import { useState } from "react";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const TYPE_ICONS = { project: "📁", task: "✅", subtask: "↳", event: "📅" };
const PRIORITY_STYLES = {
  urgent: { background: "var(--error-light)", color: "var(--error)" },
  high: { background: "var(--warning-light)", color: "var(--warning)" },
};

export default function KanbanBoard({ items, allItems, projects, onUpdate, onSelect, onAddSubtask }) {
  const [dragging, setDragging] = useState(null);

  const getProjectColor = (parentId) => {
    const p = projects.find((pr) => pr.id === parentId);
    return p?.color || "var(--accent)";
  };

  const getSubtaskCount = (projectId) => {
    return (allItems || items).filter((i) => i.parentId === projectId).length;
  };

  const getSubtaskDoneCount = (projectId) => {
    return (allItems || items).filter((i) => i.parentId === projectId && i.status === "done").length;
  };

  const handleDragStart = (e, itemId) => {
    setDragging(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    if (dragging) {
      onUpdate(dragging, { status });
      setDragging(null);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, height: "100%", overflow: "hidden" }}>
      {COLUMNS.map(({ key, label }) => {
        const col = items.filter((i) => i.status === key);
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: 12, overflow: "hidden" }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, key)}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: "var(--bg-primary)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 100 }}>{col.length}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {col.map((item) => {
                const isProject = item.type === "project";
                const subtaskTotal = isProject ? getSubtaskCount(item.id) : 0;
                const subtaskDone = isProject ? getSubtaskDoneCount(item.id) : 0;

                return (
                  <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item.id)}
                    onClick={() => onSelect(item)}
                    style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)", padding: 12, cursor: "pointer",
                      opacity: dragging === item.id ? 0.5 : 1, transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                  >
                    {/* Color bar */}
                    {(item.parentId || isProject) && (
                      <div style={{ width: 24, height: 3, borderRadius: 2, background: isProject ? (item.color || "var(--accent)") : getProjectColor(item.parentId), marginBottom: 8 }} />
                    )}

                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{TYPE_ICONS[item.type] || ""}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{item.title}</span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {item.priority && (item.priority === "urgent" || item.priority === "high") && (
                        <span className="badge" style={PRIORITY_STYLES[item.priority]}>{item.priority}</span>
                      )}
                      {item.dueDate && (
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {item.source === "antigravity" && <span style={{ fontSize: 10 }}>🤖</span>}
                    </div>

                    {/* Project: subtask progress + add button */}
                    {isProject && (
                      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                        {subtaskTotal > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(subtaskDone / subtaskTotal) * 100}%`, background: "var(--success)", borderRadius: 2, transition: "width 0.3s" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                              {subtaskDone}/{subtaskTotal}
                            </span>
                          </div>
                        ) : null}
                        <button
                          className="btn btn-sm"
                          onClick={(e) => { e.stopPropagation(); onAddSubtask(item.id); }}
                          style={{ fontSize: 11, padding: "3px 8px", width: "100%" }}
                        >
                          + Add Sub-task
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @media (max-width: 768px) {
          div:first-child { grid-template-columns: 1fr !important; overflow-y: auto !important; }
        }
      `}</style>
    </div>
  );
}
