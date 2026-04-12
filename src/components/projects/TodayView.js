"use client";

import { useState, useMemo } from "react";

export default function TodayView({ items, projects, onUpdate, onSelect }) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Items relevant to today
  const todayItems = useMemo(() => {
    return items.filter((item) => {
      // Has a time block today
      if (item.timeBlock?.date === todayStr) return true;
      // Due today
      if (item.dueDate === todayStr) return true;
      // Start date is today
      if (item.startDate === todayStr) return true;
      // In progress (always show)
      if (item.status === "in_progress") return true;
      return false;
    }).sort((a, b) => {
      // Time-blocked items first, sorted by start time
      const aTime = a.timeBlock?.startTime || "99:99";
      const bTime = b.timeBlock?.startTime || "99:99";
      if (aTime < bTime) return -1;
      if (aTime > bTime) return 1;
      return 0;
    });
  }, [items, todayStr]);

  const timeBlocked = todayItems.filter((i) => i.timeBlock?.date === todayStr);
  const unscheduled = todayItems.filter((i) => !i.timeBlock || i.timeBlock.date !== todayStr);

  const getProjectColor = (parentId) => {
    const p = projects.find((pr) => pr.id === parentId);
    return p?.color || "var(--accent)";
  };

  const isDone = (item) => item.status === "done";
  const markDone = (id) => onUpdate(id, { status: "done", completedAt: new Date().toISOString() });
  const undoDone = (id) => onUpdate(id, { status: "todo", completedAt: null });

  const TYPE_ICONS = { project: "📁", task: "✅", subtask: "↳", event: "📅" };

  // Generate hour slots from 6am to 11pm
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  const formatHour = (h) => {
    if (h === 0 || h === 24) return "12 AM";
    if (h === 12) return "12 PM";
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  const parseTime = (t) => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
          {todayItems.length} item{todayItems.length !== 1 ? "s" : ""} · {timeBlocked.length} scheduled · {todayItems.filter(i => isDone(i)).length} completed
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left: Timeline */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Schedule
          </div>

          {timeBlocked.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              No time blocks scheduled for today.
            </div>
          ) : (
            <div style={{ position: "relative", minHeight: 400 }}>
              {/* Hour grid */}
              {hours.map((h) => (
                <div key={h} style={{ display: "flex", alignItems: "flex-start", height: 48, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", width: 50, flexShrink: 0, paddingTop: 2 }}>{formatHour(h)}</span>
                  <div style={{ flex: 1 }} />
                </div>
              ))}

              {/* Time block overlays */}
              {timeBlocked.map((item) => {
                const start = parseTime(item.timeBlock.startTime);
                const end = parseTime(item.timeBlock.endTime);
                if (start === null || end === null) return null;
                const top = (start - 6) * 48;
                const height = Math.max((end - start) * 48, 24);
                const done = isDone(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    style={{
                      position: "absolute", left: 54, right: 4, top,
                      height, borderRadius: "var(--radius-sm)",
                      background: done ? "var(--bg-secondary)" : (item.color || getProjectColor(item.parentId)),
                      opacity: done ? 0.5 : 0.85,
                      padding: "4px 8px", cursor: "pointer",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      overflow: "hidden", transition: "opacity 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: done ? "var(--text-tertiary)" : "#fff", textDecoration: done ? "line-through" : "none" }}>
                      {TYPE_ICONS[item.type]} {item.title}
                    </div>
                    {height > 30 && (
                      <div style={{ fontSize: 10, color: done ? "var(--text-tertiary)" : "rgba(255,255,255,0.8)" }}>
                        {item.timeBlock.startTime}–{item.timeBlock.endTime}
                        {item.location ? ` · 📍 ${item.location}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Current time indicator */}
              {(() => {
                const currentHour = now.getHours() + now.getMinutes() / 60;
                if (currentHour >= 6 && currentHour <= 23) {
                  const top = (currentHour - 6) * 48;
                  return (
                    <div style={{ position: "absolute", left: 46, right: 0, top, height: 2, background: "var(--error)", zIndex: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--error)", position: "absolute", left: -4, top: -3 }} />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        {/* Right: Tasks & Items due today */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Tasks & Events
          </div>

          {unscheduled.length === 0 && timeBlocked.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              Nothing due today. Enjoy your day!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* In Progress items */}
              {unscheduled.filter(i => i.status === "in_progress").length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginTop: 4, marginBottom: 2 }}>IN PROGRESS</div>
                  {unscheduled.filter(i => i.status === "in_progress").map((item) => (
                    <ItemRow key={item.id} item={item} done={isDone(item)} onSelect={onSelect} onToggle={() => isDone(item) ? undoDone(item.id) : markDone(item.id)} />
                  ))}
                </>
              )}

              {/* Due today */}
              {unscheduled.filter(i => i.status !== "in_progress" && !isDone(i)).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginTop: 8, marginBottom: 2 }}>DUE TODAY</div>
                  {unscheduled.filter(i => i.status !== "in_progress" && !isDone(i)).map((item) => (
                    <ItemRow key={item.id} item={item} done={false} onSelect={onSelect} onToggle={() => markDone(item.id)} />
                  ))}
                </>
              )}

              {/* Completed today */}
              {todayItems.filter(i => isDone(i)).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", marginTop: 8, marginBottom: 2 }}>COMPLETED</div>
                  {todayItems.filter(i => isDone(i)).map((item) => (
                    <ItemRow key={item.id} item={item} done={true} onSelect={onSelect} onToggle={() => undoDone(item.id)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, done, onSelect, onToggle }) {
  const TYPE_ICONS = { project: "📁", task: "✅", subtask: "↳", event: "📅" };
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)", cursor: "pointer",
      }}
      onClick={() => onSelect(item)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: 20, height: 20, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
          border: done ? "none" : "2px solid var(--border)",
          background: done ? "var(--success)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      </button>
      <span style={{ fontSize: 13 }}>{TYPE_ICONS[item.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {item.dueDate && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>📅 {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          {item.location && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>📍 {item.location}</span>}
          {item.timeBlock?.startTime && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>🕐 {item.timeBlock.startTime}</span>}
        </div>
      </div>
    </div>
  );
}
