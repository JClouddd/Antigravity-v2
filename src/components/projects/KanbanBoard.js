"use client";

import { useState, useEffect } from "react";
import TimeTracker from "./TimeTracker";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const TYPE_ICONS = { project: "📁", task: "✅", subtask: "↳", event: "📅", plan: "📋", goal: "🎯", habit: "🔄", journal: "📓" };
const TYPE_TAG = { project: "PRJ", task: "TSK", subtask: "SUB", event: "EVT", plan: "PLN", goal: "GOL", habit: "HBT", journal: "JRN" };
const TYPE_TAG_COLOR = { project: "#7c3aed", task: "#2563eb", subtask: "#6b7280", event: "#059669", plan: "#d97706", goal: "#dc2626", habit: "#059669", journal: "#8b5cf6" };
const PRIORITY_DOT = { urgent: "#dc2626", high: "#d97706", medium: "#2563eb", low: "#94a3b8" };

export default function KanbanBoard({ items, allItems, projects, onUpdate, onSelect, onAddSubtask, onLogTime }) {
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
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  const buildColumnItems = (colItems) => {
    const ordered = [], used = new Set();
    for (const p of colItems.filter((i) => i.type === "project")) {
      ordered.push(p); used.add(p.id);
      for (const s of getSubs(p.id)) { ordered.push(s); used.add(s.id); }
    }
    for (const i of colItems) { if (!used.has(i.id) && i.type !== "subtask") { ordered.push(i); } }
    return ordered;
  };

  // Metadata pills
  const MetaRow = ({ item }) => {
    const pills = [];
    if (item.timeBlock?.startTime) pills.push({ icon: "🕐", text: `${item.timeBlock.startTime}–${item.timeBlock.endTime || ""}` });
    if (item.dueDate) pills.push({ icon: "📅", text: formatDate(item.dueDate) });
    if (item.location) pills.push({ icon: "📍", text: item.location });
    if (item.notes) pills.push({ icon: "📝", text: item.notes.length > 30 ? item.notes.slice(0, 30) + "…" : item.notes });
    if (item.dependencies?.length > 0) pills.push({ icon: "🔗", text: `${item.dependencies.length}` });
    if (item.conferenceLink) pills.push({ icon: "🎥", text: "Meet" });
    if (item.attendees?.length > 0) pills.push({ icon: "👥", text: `${item.attendees.length}` });
    if (item.recurrence) pills.push({ icon: "🔁", text: "Repeats" });
    if (pills.length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
        {pills.map((p, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: 10, color: "var(--text-secondary)",
            background: "var(--bg-secondary)", padding: "1px 5px",
            borderRadius: 3, whiteSpace: "nowrap", maxWidth: 140,
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ fontSize: 9 }}>{p.icon}</span> {p.text}
          </span>
        ))}
      </div>
    );
  };

  // Inline action buttons (small, sit in title row)
  const DoneBtn = ({ item, isDone }) => isDone ? (
    <button className="btn-icon" onClick={(e) => undoDone(e, item.id)} title="Undo" style={{ padding: 1, color: "var(--text-tertiary)", flexShrink: 0 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    </button>
  ) : (
    <button className="btn-icon" onClick={(e) => markDone(e, item.id)} title="Done" style={{ padding: 1, color: "var(--success)", flexShrink: 0 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
  );

  const EditBtn = ({ item }) => (
    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onSelect(item); }} title="Edit" style={{ padding: 1, flexShrink: 0, opacity: 0.5 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    </button>
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
                        padding: isSubtask ? "6px 8px" : "10px 12px",
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
                          {/* Title row: chevron + dot + title + count + done + edit + add */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div onClick={(e) => { e.stopPropagation(); toggleProject(item.id); }}
                              style={{ cursor: "pointer", transition: "transform 0.15s", transform: expandedProjects[item.id] === false ? "rotate(-90deg)" : "rotate(0deg)", color: "var(--text-tertiary)", display: "flex", flexShrink: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color || "var(--accent)", flexShrink: 0 }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_TAG_COLOR.project, background: `${TYPE_TAG_COLOR.project}15`, padding: "1px 4px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em" }}>PRJ</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                            {subs.length > 0 && <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>{subsDone}/{subs.length}</span>}
                            <DoneBtn item={item} isDone={isDone} />
                            <EditBtn item={item} />
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onAddSubtask(item.id); }} title="Add sub-task" style={{ padding: 1, flexShrink: 0, opacity: 0.5 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                          </div>
                          {/* Progress + meta */}
                          {subs.length > 0 && (
                            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 5 }}>
                              <div style={{ height: "100%", width: `${(subsDone / subs.length) * 100}%`, background: "var(--success)", transition: "width 0.3s" }} />
                            </div>
                          )}
                          <MetaRow item={item} />
                        </>
                      )}

                      {/* ── TASK / EVENT ── */}
                      {!isProject && !isSubtask && (
                        <>
                          {/* Title row: priority dot + icon + title + done + edit */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_TAG_COLOR[item.type], background: `${TYPE_TAG_COLOR[item.type]}15`, padding: "1px 4px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em" }}>{TYPE_TAG[item.type]}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                            {onLogTime && <TimeTracker item={item} onLogTime={onLogTime} />}
                            <DoneBtn item={item} isDone={isDone} />
                            <EditBtn item={item} />
                          </div>
                          <MetaRow item={item} />
                        </>
                      )}

                      {/* ── SUBTASK ── */}
                      {isSubtask && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={(e) => isDone ? undoDone(e, item.id) : markDone(e, item.id)} style={{
                            width: 16, height: 16, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                            border: isDone ? "none" : "2px solid var(--border)",
                            background: isDone ? "var(--success)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isDone && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-tertiary)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                          <EditBtn item={item} />
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
      <style jsx>{`@media (max-width: 768px) { div:first-child { grid-template-columns: 1fr !important; overflow-y: auto !important; } }`}</style>
    </div>
  );
}
