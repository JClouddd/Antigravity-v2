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
  medium: { background: "var(--accent-light)", color: "var(--accent)" },
  low: { background: "var(--bg-secondary)", color: "var(--text-secondary)" },
};

export default function KanbanBoard({ items, projects, onUpdate, onSelect }) {
  const [dragging, setDragging] = useState(null);

  const getProjectColor = (parentId) => {
    const p = projects.find((pr) => pr.id === parentId);
    return p?.color || "var(--accent)";
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
          <div
            key={key}
            style={{
              display: "flex", flexDirection: "column",
              background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: 12, overflow: "hidden",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, key)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: "var(--bg-primary)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 100 }}>{col.length}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {col.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onClick={() => onSelect(item)}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", padding: 12, cursor: "pointer",
                    opacity: dragging === item.id ? 0.5 : 1, transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                >
                  {/* Project bar */}
                  {item.parentId && (
                    <div style={{ width: 24, height: 3, borderRadius: 2, background: getProjectColor(item.parentId), marginBottom: 8 }} />
                  )}
                  {item.type === "project" && (
                    <div style={{ width: 24, height: 3, borderRadius: 2, background: item.color || "var(--accent)", marginBottom: 8 }} />
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12 }}>{TYPE_ICONS[item.type] || ""}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {item.priority && item.priority !== "medium" && (
                      <span className="badge" style={PRIORITY_STYLES[item.priority]}>{item.priority}</span>
                    )}
                    {item.dueDate && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {item.source === "antigravity" && (
                      <span style={{ fontSize: 10, color: "var(--accent)" }}>🤖</span>
                    )}
                  </div>
                </div>
              ))}
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
