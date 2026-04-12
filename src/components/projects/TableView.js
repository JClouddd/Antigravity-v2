"use client";

import { useState, useMemo } from "react";

const STATUS_LABELS = { planning: "Planning", todo: "To Do", in_progress: "In Progress", done: "Done", archived: "Archived" };
const TYPE_LABELS = { project: "📁 Project", task: "✅ Task", subtask: "↳ Sub-task", event: "📅 Event", plan: "📋 Plan", goal: "🎯 Goal", habit: "🔄 Habit", journal: "📓 Journal" };
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER = { in_progress: 0, todo: 1, planning: 2, done: 3, archived: 4 };

const PRIORITY_STYLES = {
  urgent: { background: "var(--error-light)", color: "var(--error)" },
  high: { background: "var(--warning-light)", color: "var(--warning)" },
  medium: { background: "var(--accent-light)", color: "var(--accent)" },
  low: { background: "var(--bg-secondary)", color: "var(--text-secondary)" },
};

const SORTABLE_FIELDS = [
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "dueDate", label: "Due Date" },
  { key: "createdAt", label: "Created" },
];

export default function TableView({ items, projects, onUpdate, onSelect, isBlocked }) {
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState({});

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleProject = (id) => {
    setExpandedProjects((p) => ({ ...p, [id]: p[id] === false ? true : (p[id] === undefined ? false : !p[id]) }));
  };

  const sortedItems = useMemo(() => {
    let filtered = [...items];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) => i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }

    // Filters
    if (filterType !== "all") filtered = filtered.filter((i) => i.type === filterType);
    if (filterStatus !== "all") filtered = filtered.filter((i) => i.status === filterStatus);
    if (filterPriority !== "all") filtered = filtered.filter((i) => i.priority === filterPriority);

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortField === "priority") {
        aVal = PRIORITY_ORDER[a.priority] ?? 99;
        bVal = PRIORITY_ORDER[b.priority] ?? 99;
      } else if (sortField === "status") {
        aVal = STATUS_ORDER[a.status] ?? 99;
        bVal = STATUS_ORDER[b.status] ?? 99;
      } else {
        aVal = a[sortField] || "";
        bVal = b[sortField] || "";
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    // Group: projects first, then their subtasks, then standalone items
    const ordered = [];
    const used = new Set();

    // First pass: projects with their subtasks immediately following
    for (const item of filtered) {
      if (item.type === "project" && !used.has(item.id)) {
        ordered.push(item);
        used.add(item.id);
        // Find subtasks of this project (from ALL items, not just filtered)
        const subs = items
          .filter(s => s.parentId === item.id && s.type === "subtask")
          .sort((a, b) => {
            if (a.status === "done" && b.status !== "done") return 1;
            if (a.status !== "done" && b.status === "done") return -1;
            return 0;
          });
        for (const sub of subs) {
          ordered.push(sub);
          used.add(sub.id);
        }
      }
    }

    // Second pass: standalone items (not subtasks, not already added)
    for (const item of filtered) {
      if (!used.has(item.id) && item.type !== "subtask") {
        ordered.push(item);
        used.add(item.id);
      }
    }

    return ordered;
  }, [items, sortField, sortDir, filterType, filterStatus, filterPriority, searchQuery]);

  const getProjectTitle = (parentId) => {
    const p = projects.find((pr) => pr.id === parentId);
    return p?.title || "";
  };

  const getSubCount = (projectId) => {
    const subs = items.filter(i => i.parentId === projectId && i.type === "subtask");
    const done = subs.filter(i => i.status === "done").length;
    return { total: subs.length, done };
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 10h18M3 14h18M9 18h6M9 6h6"/></svg>
        <h3>No items yet</h3>
        <p>Create a project, task, or event to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters Bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" placeholder="Search..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 180, padding: "6px 10px", fontSize: 13 }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
          <option value="all">All Types</option>
          <option value="project">Projects</option>
          <option value="task">Tasks</option>
          <option value="subtask">Sub-tasks</option>
          <option value="event">Events</option>
          <option value="plan">Plans</option>
          <option value="goal">Goals</option>
          <option value="habit">Habits</option>
          <option value="journal">Journals</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 4 }}>
          {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              {SORTABLE_FIELDS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{
                    padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11,
                    color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap",
                    textTransform: "uppercase", letterSpacing: "0.04em", userSelect: "none",
                  }}
                >
                  {label} {sortField === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th style={{ padding: "10px 12px", width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => {
              const isProject = item.type === "project";
              const isSubtask = item.type === "subtask";
              const isExpanded = expandedProjects[item.id] !== false; // default expanded
              const blocked = isBlocked ? isBlocked(item) : false;

              // Hide subtasks if their parent project is collapsed
              if (isSubtask && expandedProjects[item.parentId] === false) return null;

              const subInfo = isProject ? getSubCount(item.id) : null;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  style={{
                    borderBottom: "1px solid var(--border)", cursor: "pointer",
                    background: isProject ? "var(--bg-secondary)" : isSubtask ? "var(--bg-primary)" : "transparent",
                    transition: "background 0.1s",
                    opacity: blocked ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = isProject ? "var(--bg-secondary)" : isSubtask ? "var(--bg-primary)" : "transparent"}
                >
                  {/* Title */}
                  <td style={{ padding: "10px 12px", fontWeight: isProject ? 600 : 500 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: isSubtask ? 20 : 0 }}>
                      {isProject && (
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleProject(item.id); }}
                          style={{ cursor: "pointer", transition: "transform 0.15s", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", color: "var(--text-tertiary)", display: "flex", flexShrink: 0 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      )}
                      {isProject && <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color || "var(--accent)", flexShrink: 0 }} />}
                      {isSubtask && <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>↳</span>}
                      {blocked && <span title="Blocked by dependency">🔒</span>}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </span>
                      {isProject && subInfo && subInfo.total > 0 && (
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>
                          {subInfo.done}/{subInfo.total}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Type */}
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
                    {TYPE_LABELS[item.type] || item.type}
                  </td>
                  {/* Status */}
                  <td style={{ padding: "10px 12px" }}>
                    <select
                      value={item.status}
                      onChange={(e) => { e.stopPropagation(); onUpdate(item.id, { status: e.target.value }); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: "auto", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6 }}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  {/* Priority */}
                  <td style={{ padding: "10px 12px" }}>
                    {item.priority && <span className="badge" style={PRIORITY_STYLES[item.priority]}>{item.priority}</span>}
                  </td>
                  {/* Due Date */}
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  {/* Created */}
                  <td style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                  </td>
                  {/* Quick actions */}
                  <td style={{ padding: "10px 12px" }}>
                    {item.status !== "done" && (
                      <button
                        className="btn-icon" title="Mark done"
                        onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { status: "done", completedAt: new Date().toISOString() }); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
