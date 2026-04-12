"use client";

import { useState, useEffect } from "react";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const TYPE_ICONS = { project: "📁", task: "✅", subtask: "↳", event: "📅" };
const PRIORITY_DOT = { urgent: "#dc2626", high: "#d97706", medium: "#2563eb", low: "#94a3b8" };

export default function KanbanBoard({ items, allItems, projects, onUpdate, onSelect, onAddSubtask }) {
  const [dragging, setDragging] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});

  useEffect(() => {
    const now = new Date();
    (allItems || items).forEach((item) => {
      if (item.type === "event" && item.status !== "done" && item.timeBlock) {
        const endTime = new Date(`${item.timeBlock.date}T${item.timeBlock.endTime || "23:59"}`);
        if (endTime < now) onUpdate(item.id, { status: "done", completedAt: now.toISOString() });
      }
    });
  }, []);

  const toggleProject = (id) => setExpandedProjects((p) => ({ ...p, [id]: !p[id] }));
  const getSubs = (id) => (allItems || items).filter((i) => i.parentId === id);
  const getSubsDone = (id) => getSubs(id).filter((i) => i.status === "done").length;
  const handleDragStart = (e, id) => { setDragging(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e, status) => { e.preventDefault(); if (dragging) { onUpdate(dragging, { status }); setDragging(null); } };
  const markDone = (e, id) => { e.stopPropagation(); onUpdate(id, { status: "done", completedAt: new Date().toISOString() }); };
  const undoDone = (e, id) => { e.stopPropagation(); onUpdate(id, { status: "todo", completedAt: null }); };

  const buildColumnItems = (colItems) => {
    const ordered = [], used = new Set();
    for (const p of colItems.filter((i) => i.type === "project")) {
      ordered.push(p); used.add(p.id);
      for (const s of getSubs(p.id)) { ordered.push(s); used.add(s.id); }
    }
    for (const i of colItems) { if (!used.has(i.id) && i.type !== "subtask") { ordered.push(i); } }
    return ordered;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  // Metadata pills — shared across all card types
  const MetaRow = ({ item }) => {
    const pills = [];
    if (item.timeBlock?.startTime) pills.push({ icon: "🕐", text: `${item.timeBlock.startTime}–${item.timeBlock.endTime || ""}` });
    if (item.dueDate) pills.push({ icon: "📅", text: formatDate(item.dueDate) });
    if (item.location) pills.push({ icon: "📍", text: item.location });
    if (item.notes) pills.push({ icon: "📝", text: item.notes.length > 40 ? item.notes.slice(0, 40) + "…" : item.notes });
    if (item.dependencies?.length > 0) pills.push({ icon: "🔗", text: `${item.dependencies.length} dep${item.dependencies.length > 1 ? "s" : ""}` });
    if (item.conferenceLink) pills.push({ icon: "🎥", text: "Meet" });
    if (item.attendees?.length > 0) pills.push({ icon: "👥", text: `${item.attendees.length}` });
    if (item.recurrence) pills.push({ icon: "🔁", text: "Repeats" });
    if (pills.length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {pills.map((p, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, color: "var(--text-secondary)",
            background: "var(--bg-secondary)", padding: "2px 6px",
            borderRadius: 4, whiteSpace: "nowrap", maxWidth: 160,
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ fontSize: 10 }}>{p.icon}</span> {p.text}
          </span>
        ))}
      </div>
    );
  };

  // Action bar — done/undo + edit
  const Actions = ({ item, isDone, extra, noBorder }) => (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6, paddingTop: noBorder ? 0 : 6, borderTop: noBorder ? "none" : "1px solid var(--border)" }}>
      <span style={{ flex: 1 }} />
      {isDone ? (
        <button className="btn-icon" onClick={(e) => undoDone(e, item.id)} title="Undo" style={{ padding: 2, color: "var(--text-tertiary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      ) : (
        <button className="btn-icon" onClick={(e) => markDone(e, item.id)} title="Mark done" style={{ padding: 2, color: "var(--success)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      )}
      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }} title="Edit" style={{ padding: 2 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      {extra}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: "var(--bg-primary)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 100 }}>{rawCol.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {orderedCol.map((item) => {
                const isProject = item.type === "project";
                const isSubtask = item.type === "subtask";
                const isDone = item.status === "done";
                const subs = isProject ? getSubs(item.id) : [];
                const subsDone = isProject ? getSubsDone(item.id) : 0;
                if (isSubtask && expandedProjects[item.parentId] === false) return null;
                const pColor = isSubtask ? (projects.find(p => p.id === item.parentId)?.color || "var(--accent)") : null;

                return (
                  <div key={item.id}>
                    <div
                      draggable={!isSubtask}
                      onDragStart={!isSubtask ? (e) => handleDragStart(e, item.id) : undefined}
                      style={{
                        border: `1px solid ${isSubtask ? "transparent" : "var(--border)"}`,
                        borderRadius: isSubtask ? "var(--radius-sm)" : "var(--radius-md)",
                        padding: isSubtask ? "8px 10px" : 12,
                        marginLeft: isSubtask ? 12 : 0,
                        borderLeft: isSubtask ? `2px solid ${pColor}` : undefined,
                        background: isSubtask ? "var(--bg-primary)" : "var(--bg-elevated)",
                        opacity: dragging === item.id ? 0.5 : 1,
                        transition: "box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isSubtask) e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                    >
                      {/* ── PROJECT ── */}
                      {isProject && (
                        <>
                          <div onClick={() => toggleProject(item.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <div style={{ transition: "transform 0.15s", transform: expandedProjects[item.id] === false ? "rotate(-90deg)" : "rotate(0deg)", color: "var(--text-tertiary)", display: "flex" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color || "var(--accent)", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.title}</span>
                            {subs.length > 0 && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{subsDone}/{subs.length}</span>}
                          </div>
                          {item.description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>}
                          {subs.length > 0 && (
                            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                              <div style={{ height: "100%", width: `${(subsDone / subs.length) * 100}%`, background: "var(--success)", transition: "width 0.3s" }} />
                            </div>
                          )}
                          <MetaRow item={item} />
                          <Actions item={item} isDone={isDone} noBorder extra={
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onAddSubtask(item.id); }} title="Add sub-task" style={{ padding: 2 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                          } />
                        </>
                      )}

                      {/* ── TASK / EVENT ── */}
                      {!isProject && !isSubtask && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium, flexShrink: 0 }} />
                            <span style={{ fontSize: 14 }}>{TYPE_ICONS[item.type]}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.title}</span>
                          </div>
                          {item.description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 26 }}>{item.description}</div>}
                          <MetaRow item={item} />
                          <Actions item={item} isDone={isDone} />
                        </>
                      )}

                      {/* ── SUBTASK ── */}
                      {isSubtask && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={(e) => isDone ? undoDone(e, item.id) : markDone(e, item.id)} style={{
                              width: 18, height: 18, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                              border: isDone ? "none" : "2px solid var(--border)",
                              background: isDone ? "var(--success)" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.title}</span>
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }} title="Edit" style={{ padding: 2, opacity: 0.4 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                          </div>
                          {/* Subtask meta — compact, only show if has data */}
                          {(item.dueDate || item.location || item.notes) && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4, paddingLeft: 26, flexWrap: "wrap" }}>
                              {item.dueDate && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>📅 {formatDate(item.dueDate)}</span>}
                              {item.location && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>📍 {item.location}</span>}
                              {item.notes && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>📝</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <style jsx>{`@media (max-width: 768px) { div:first-child { grid-template-columns: 1fr !important; overflow-y: auto !important; } }`}</style>
    </div>
  );
}
