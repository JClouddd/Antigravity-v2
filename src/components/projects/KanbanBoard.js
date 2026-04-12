"use client";

import { useState, useEffect } from "react";

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
  const [expandedProjects, setExpandedProjects] = useState({});

  // Auto-complete past events
  useEffect(() => {
    const now = new Date();
    (allItems || items).forEach((item) => {
      if (item.type === "event" && item.status !== "done" && item.timeBlock) {
        const endTime = new Date(`${item.timeBlock.date}T${item.timeBlock.endTime || "23:59"}`);
        if (endTime < now) {
          onUpdate(item.id, { status: "done", completedAt: new Date().toISOString() });
        }
      }
    });
  }, []);

  const toggleProject = (projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const getSubtasks = (projectId) => (allItems || items).filter((i) => i.parentId === projectId);
  const getSubtaskDoneCount = (projectId) => getSubtasks(projectId).filter((i) => i.status === "done").length;

  const handleDragStart = (e, itemId) => { setDragging(itemId); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e, status) => { e.preventDefault(); if (dragging) { onUpdate(dragging, { status }); setDragging(null); } };
  const handleMarkDone = (e, itemId) => { e.stopPropagation(); onUpdate(itemId, { status: "done", completedAt: new Date().toISOString() }); };
  const handleUndoDone = (e, itemId) => { e.stopPropagation(); onUpdate(itemId, { status: "todo", completedAt: null }); };

  const buildColumnItems = (columnItems) => {
    const ordered = [];
    const usedIds = new Set();
    const projectsInCol = columnItems.filter((i) => i.type === "project");
    for (const project of projectsInCol) {
      ordered.push(project);
      usedIds.add(project.id);
      for (const sub of getSubtasks(project.id)) { ordered.push(sub); usedIds.add(sub.id); }
    }
    for (const item of columnItems) {
      if (!usedIds.has(item.id) && item.type !== "subtask") { ordered.push(item); usedIds.add(item.id); }
    }
    return ordered;
  };

  // Shared action bar for all item types
  const ActionBar = ({ item, isDone }) => (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
      {item.priority && (item.priority === "urgent" || item.priority === "high") && (
        <span className="badge" style={PRIORITY_STYLES[item.priority]}>{item.priority}</span>
      )}
      {item.dueDate && (
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
      {item.location && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>📍</span>}
      <span style={{ flex: 1 }} />
      {/* Done / Undo */}
      {isDone ? (
        <button className="btn-icon" onClick={(e) => handleUndoDone(e, item.id)} title="Undo complete" style={{ padding: 2, color: "var(--text-tertiary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      ) : (
        <button className="btn-icon" onClick={(e) => handleMarkDone(e, item.id)} title="Mark done" style={{ padding: 2, color: "var(--success)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      )}
      {/* Edit */}
      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }} title="Edit" style={{ padding: 2 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, height: "100%", overflow: "hidden" }}>
      {COLUMNS.map(({ key, label }) => {
        const rawCol = items.filter((i) => i.status === key && i.type !== "subtask");
        const orderedCol = buildColumnItems(rawCol);

        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", padding: 12, overflow: "hidden" }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, key)}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: "var(--bg-primary)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 100 }}>{rawCol.length}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {orderedCol.map((item) => {
                const isProject = item.type === "project";
                const isSubtask = item.type === "subtask";
                const isDone = item.status === "done";
                const subtasks = isProject ? getSubtasks(item.id) : [];
                const subtaskTotal = subtasks.length;
                const subtaskDone = isProject ? getSubtaskDoneCount(item.id) : 0;

                if (isSubtask && expandedProjects[item.parentId] === false) return null;

                const projectColor = isSubtask ? (() => { const p = projects.find(pr => pr.id === item.parentId); return p?.color || "var(--accent)"; })() : null;

                return (
                  <div key={item.id}>
                    <div
                      draggable={!isSubtask}
                      onDragStart={!isSubtask ? (e) => handleDragStart(e, item.id) : undefined}
                      style={{
                        border: `1px solid ${isSubtask ? "transparent" : "var(--border)"}`,
                        borderRadius: isSubtask ? "var(--radius-sm)" : "var(--radius-md)",
                        padding: isSubtask ? "8px 10px" : 12,
                        cursor: "default",
                        opacity: dragging === item.id ? 0.5 : 1,
                        transition: "box-shadow 0.15s",
                        marginLeft: isSubtask ? 12 : 0,
                        borderLeft: isSubtask ? `2px solid ${projectColor}` : undefined,
                        background: isSubtask ? "var(--bg-primary)" : "var(--bg-elevated)",
                      }}
                      onMouseEnter={(e) => { if (!isSubtask) e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                    >

                      {/* ═══ PROJECT CARD ═══ */}
                      {isProject && (
                        <>
                          <div onClick={(e) => { e.stopPropagation(); toggleProject(item.id); }}
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", transition: "transform 0.15s", transform: expandedProjects[item.id] === false ? "rotate(-90deg)" : "rotate(0deg)" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color || "var(--accent)", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.title}</span>
                            {subtaskTotal > 0 && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{subtaskDone}/{subtaskTotal}</span>}
                          </div>

                          {subtaskTotal > 0 && (
                            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", margin: "6px 0" }}>
                              <div style={{ height: "100%", width: `${(subtaskDone / subtaskTotal) * 100}%`, background: "var(--success)", borderRadius: 2, transition: "width 0.3s" }} />
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                            {item.priority && (item.priority === "urgent" || item.priority === "high") && (
                              <span className="badge" style={PRIORITY_STYLES[item.priority]}>{item.priority}</span>
                            )}
                            {item.dueDate && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                            <span style={{ flex: 1 }} />
                            {isDone ? (
                              <button className="btn-icon" onClick={(e) => handleUndoDone(e, item.id)} title="Undo" style={{ padding: 2, color: "var(--text-tertiary)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                              </button>
                            ) : (
                              <button className="btn-icon" onClick={(e) => handleMarkDone(e, item.id)} title="Complete all" style={{ padding: 2, color: "var(--success)" }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                            )}
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }} title="Edit" style={{ padding: 2 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onAddSubtask(item.id); }} title="Add sub-task" style={{ padding: 2 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                          </div>
                        </>
                      )}

                      {/* ═══ TASK / EVENT CARD ═══ */}
                      {!isProject && !isSubtask && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{TYPE_ICONS[item.type]}</span>
                            <span style={{
                              fontSize: 13, fontWeight: 500, flex: 1,
                              textDecoration: isDone ? "line-through" : "none",
                              color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
                            }}>{item.title}</span>
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.description}
                            </div>
                          )}
                          {item.timeBlock && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                              🕐 {item.timeBlock.startTime}–{item.timeBlock.endTime}
                            </div>
                          )}
                          <ActionBar item={item} isDone={isDone} />
                        </>
                      )}

                      {/* ═══ SUBTASK CARD ═══ */}
                      {isSubtask && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Done toggle */}
                          {isDone ? (
                            <button onClick={(e) => handleUndoDone(e, item.id)} title="Undo" style={{
                              width: 18, height: 18, borderRadius: "50%", border: "none", flexShrink: 0,
                              background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                          ) : (
                            <button onClick={(e) => handleMarkDone(e, item.id)} title="Complete" style={{
                              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                              border: "2px solid var(--border)", background: "transparent", cursor: "pointer",
                            }} />
                          )}
                          <span style={{
                            fontSize: 13, fontWeight: 500, flex: 1,
                            textDecoration: isDone ? "line-through" : "none",
                            color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
                          }}>{item.title}</span>
                          {/* Edit button */}
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                            title="Edit" style={{ padding: 2, opacity: 0.5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
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
