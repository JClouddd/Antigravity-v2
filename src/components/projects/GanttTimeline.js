"use client";

import { useState, useMemo } from "react";
import { format, addDays, differenceInDays, startOfWeek, eachDayOfInterval } from "date-fns";

const STATUS_COLORS = {
  todo: "var(--text-tertiary)",
  in_progress: "var(--accent)",
  done: "var(--success)",
  planning: "#7c3aed",
  active: "#059669",
};

const TYPE_ICONS = {
  project: "📁", task: "✅", subtask: "↳", event: "📅",
  plan: "📋", goal: "🎯", habit: "🔄", journal: "📓",
};

export default function GanttTimeline({ tasks, projects, onUpdateTask, onSelectTask }) {
  const [expandedProjects, setExpandedProjects] = useState({});

  const toggleProject = (id) => setExpandedProjects(p => ({ ...p, [id]: p[id] === false ? true : (p[id] === undefined ? false : !p[id]) }));

  // Order: projects first, then their subtasks, then standalone items
  const orderedTasks = useMemo(() => {
    const ordered = [];
    const used = new Set();

    // Projects with subtasks
    const projectItems = tasks.filter(t => t.type === "project");
    for (const p of projectItems) {
      ordered.push(p);
      used.add(p.id);
      if (expandedProjects[p.id] !== false) { // default expanded
        const subs = tasks.filter(t => t.parentId === p.id).sort((a, b) => (a.dueDate || "z").localeCompare(b.dueDate || "z"));
        for (const s of subs) { ordered.push(s); used.add(s.id); }
      }
    }

    // Standalone items
    for (const t of tasks) {
      if (!used.has(t.id) && t.type !== "subtask") { ordered.push(t); used.add(t.id); }
    }

    return ordered;
  }, [tasks, expandedProjects]);

  // Calculate timeline range
  const { timelineDays, startDate } = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(addDays(now, -7));
    const end = addDays(start, 42); // 6 weeks
    const days = eachDayOfInterval({ start, end });
    return { timelineDays: days, startDate: start };
  }, []);

  const dayWidth = 36;
  const rowHeight = 40;

  const getTaskPosition = (task) => {
    const tStart = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : new Date());
    const tEnd = task.dueDate ? new Date(task.dueDate) : addDays(tStart, 3);
    const left = Math.max(0, differenceInDays(tStart, startDate)) * dayWidth;
    const width = Math.max(1, differenceInDays(tEnd, tStart) + 1) * dayWidth;
    return { left, width };
  };

  const getItemColor = (item) => {
    if (item.color) return item.color;
    const p = projects.find(pr => pr.id === item.parentId);
    return p?.color || "var(--accent)";
  };

  const getSubCount = (projectId) => {
    const subs = tasks.filter(t => t.parentId === projectId);
    const done = subs.filter(t => t.status === "done").length;
    return { total: subs.length, done };
  };

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/>
        </svg>
        <h3>No tasks yet</h3>
        <p>Create tasks with dates to see them on the timeline.</p>
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", minWidth: timelineDays.length * dayWidth + 220 }}>
        {/* Task Labels Column */}
        <div style={{
          width: 220, flexShrink: 0, borderRight: "1px solid var(--border)",
          background: "var(--bg-secondary)", position: "sticky", left: 0, zIndex: 2,
        }}>
          {/* Header */}
          <div style={{
            height: 48, borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "0 12px",
            fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
          }}>
            Task
          </div>
          {/* Rows */}
          {orderedTasks.map((task) => {
            const isProject = task.type === "project";
            const isSubtask = task.type === "subtask";
            const subInfo = isProject ? getSubCount(task.id) : null;
            const isExpanded = expandedProjects[task.id] !== false;

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                style={{
                  height: rowHeight, borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", padding: "0 12px",
                  fontSize: 13, cursor: "pointer", gap: 6,
                  background: isProject ? "var(--bg-secondary)" : "transparent",
                  paddingLeft: isSubtask ? 28 : 12,
                }}
              >
                {isProject && (
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleProject(task.id); }}
                    style={{ cursor: "pointer", transition: "transform 0.15s", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", color: "var(--text-tertiary)", display: "flex", flexShrink: 0 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                )}
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: isProject ? (task.color || "var(--accent)") : STATUS_COLORS[task.status] || "var(--text-tertiary)",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11 }}>{TYPE_ICONS[task.type] || ""}</span>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: isProject ? 600 : 500, flex: 1,
                  color: task.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)",
                  textDecoration: task.status === "done" ? "line-through" : "none",
                }}>
                  {task.title}
                </span>
                {isProject && subInfo && subInfo.total > 0 && (
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>{subInfo.done}/{subInfo.total}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline Grid */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Day Headers */}
          <div style={{ display: "flex", height: 48, borderBottom: "1px solid var(--border)" }}>
            {timelineDays.map((day, i) => {
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div key={i} style={{
                  width: dayWidth, flexShrink: 0, textAlign: "center",
                  borderRight: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  background: isToday ? "var(--accent-light)" : isWeekend ? "var(--bg-secondary)" : "transparent",
                  fontSize: 10, color: isToday ? "var(--accent)" : "var(--text-tertiary)",
                  fontWeight: isToday ? 700 : 400,
                }}>
                  <div>{format(day, "EEE")}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{format(day, "d")}</div>
                </div>
              );
            })}
          </div>

          {/* Task Bars */}
          {orderedTasks.map((task, rowIndex) => {
            const { left, width } = getTaskPosition(task);
            const color = getItemColor(task);
            const isProject = task.type === "project";

            return (
              <div key={task.id} style={{ height: rowHeight, borderBottom: "1px solid var(--border)", position: "relative" }}>
                {/* Background grid */}
                <div style={{ display: "flex", height: "100%" }}>
                  {timelineDays.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={i} style={{
                        width: dayWidth, flexShrink: 0,
                        borderRight: "1px solid var(--border)",
                        background: isWeekend ? "var(--bg-secondary)" : "transparent",
                      }} />
                    );
                  })}
                </div>
                {/* Bar */}
                <div
                  onClick={() => onSelectTask(task)}
                  style={{
                    position: "absolute",
                    top: isProject ? 6 : 8,
                    left,
                    width: Math.max(width, dayWidth),
                    height: isProject ? rowHeight - 12 : rowHeight - 16,
                    background: task.status === "done" ? "var(--success)" : color,
                    opacity: task.status === "done" ? 0.5 : 0.85,
                    borderRadius: isProject ? 8 : 6,
                    cursor: "pointer",
                    display: "flex", alignItems: "center",
                    padding: "0 8px",
                    fontSize: 11, fontWeight: isProject ? 600 : 500, color: "#fff",
                    overflow: "hidden", whiteSpace: "nowrap",
                    transition: "opacity 0.15s",
                    border: isProject ? "2px solid rgba(255,255,255,0.3)" : "none",
                  }}
                >
                  {width > dayWidth * 2 ? task.title : ""}
                </div>
                {/* Dependency arrows */}
                {task.dependencies?.map((depId) => {
                  const depIndex = orderedTasks.findIndex((t) => t.id === depId);
                  if (depIndex < 0) return null;
                  const depTask = orderedTasks[depIndex];
                  const depPos = getTaskPosition(depTask);
                  const fromX = depPos.left + depPos.width;
                  const fromY = depIndex * rowHeight + rowHeight / 2;
                  const toX = left;
                  const toY = rowIndex * rowHeight + rowHeight / 2;
                  return (
                    <svg key={depId} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
                      <defs>
                        <marker id={`arrow-${depId}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill="var(--text-tertiary)" />
                        </marker>
                      </defs>
                      <line x1={fromX} y1={fromY - rowIndex * rowHeight} x2={toX} y2={toY - rowIndex * rowHeight}
                        stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 2"
                        markerEnd={`url(#arrow-${depId})`} />
                    </svg>
                  );
                })}
              </div>
            );
          })}

          {/* Today line */}
          {(() => {
            const todayIdx = differenceInDays(new Date(), startDate);
            if (todayIdx >= 0 && todayIdx < timelineDays.length) {
              return (
                <div style={{
                  position: "absolute", top: 48, bottom: 0,
                  left: todayIdx * dayWidth + dayWidth / 2,
                  width: 2, background: "var(--error)", zIndex: 5, opacity: 0.6,
                }} />
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
}
