"use client";

import { useMemo } from "react";
import { format, addDays, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

const STATUS_COLORS = {
  todo: "var(--text-tertiary)",
  in_progress: "var(--accent)",
  done: "var(--success)",
};

export default function GanttTimeline({ tasks, projects, onUpdateTask, onSelectTask }) {
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
    const tStart = task.startDate ? new Date(task.startDate) : new Date();
    const tEnd = task.dueDate ? new Date(task.dueDate) : addDays(tStart, 3);
    const left = Math.max(0, differenceInDays(tStart, startDate)) * dayWidth;
    const width = Math.max(1, differenceInDays(tEnd, tStart) + 1) * dayWidth;
    return { left, width };
  };

  const getProjectColor = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p?.color || "var(--accent)";
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
      <div style={{ display: "flex", minWidth: timelineDays.length * dayWidth + 200 }}>
        {/* Task Labels Column */}
        <div style={{
          width: 200, flexShrink: 0, borderRight: "1px solid var(--border)",
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
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelectTask(task)}
              style={{
                height: rowHeight, borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", padding: "0 12px",
                fontSize: 13, cursor: "pointer", gap: 8,
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: STATUS_COLORS[task.status] || "var(--text-tertiary)",
                flexShrink: 0,
              }} />
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontWeight: 500,
              }}>
                {task.title}
              </span>
            </div>
          ))}
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
          {tasks.map((task, rowIndex) => {
            const { left, width } = getTaskPosition(task);
            const color = getProjectColor(task.projectId);
            return (
              <div
                key={task.id}
                style={{
                  height: rowHeight, borderBottom: "1px solid var(--border)",
                  position: "relative",
                }}
              >
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
                    top: 8, left, width: Math.max(width, dayWidth),
                    height: rowHeight - 16,
                    background: task.status === "done" ? "var(--success)" : color,
                    opacity: task.status === "done" ? 0.6 : 0.85,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex", alignItems: "center",
                    padding: "0 8px",
                    fontSize: 11, fontWeight: 500, color: "#fff",
                    overflow: "hidden", whiteSpace: "nowrap",
                    transition: "opacity 0.15s",
                  }}
                >
                  {width > dayWidth * 2 ? task.title : ""}
                </div>
                {/* Dependency arrows */}
                {task.dependencies?.map((depId) => {
                  const depIndex = tasks.findIndex((t) => t.id === depId);
                  if (depIndex < 0) return null;
                  const depTask = tasks[depIndex];
                  const depPos = getTaskPosition(depTask);
                  const fromX = depPos.left + depPos.width;
                  const fromY = depIndex * rowHeight + rowHeight / 2;
                  const toX = left;
                  const toY = rowIndex * rowHeight + rowHeight / 2;
                  return (
                    <svg
                      key={depId}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
                    >
                      <line x1={fromX} y1={fromY - rowIndex * rowHeight} x2={toX} y2={toY - rowIndex * rowHeight}
                        stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 2" />
                    </svg>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
