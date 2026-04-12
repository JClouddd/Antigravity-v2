"use client";

import { useMemo } from "react";

export default function WeeklyReview({ items, habits }) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const stats = useMemo(() => {
    if (!items?.length) return null;

    const thisWeek = items.filter(i => {
      const d = i.completedAt?.split("T")[0] || i.updatedAt?.split("T")[0];
      return d && d >= weekStartStr && d <= todayStr;
    });

    const completed = thisWeek.filter(i => i.status === "done");
    const created = items.filter(i => i.createdAt?.split("T")[0] >= weekStartStr);
    const overdue = items.filter(i => i.dueDate && i.dueDate < todayStr && i.status !== "done");
    const inProgress = items.filter(i => i.status === "in_progress");

    // By project
    const projectBreakdown = {};
    completed.forEach(i => {
      const key = i.parentId || "__standalone";
      if (!projectBreakdown[key]) projectBreakdown[key] = { count: 0, title: "" };
      projectBreakdown[key].count++;
    });
    // Resolve project names
    const projects = items.filter(i => i.type === "project");
    Object.keys(projectBreakdown).forEach(k => {
      const p = projects.find(p => p.id === k);
      projectBreakdown[k].title = p?.title || "Standalone Tasks";
    });

    // By type
    const byType = { project: 0, task: 0, subtask: 0, event: 0 };
    completed.forEach(i => { if (byType[i.type] !== undefined) byType[i.type]++; });

    // Upcoming next week
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeekEnd.toISOString().split("T")[0];
    const upcoming = items.filter(i => i.dueDate && i.dueDate > todayStr && i.dueDate <= nextWeekStr && i.status !== "done");

    // Habit streaks
    const habitSummary = (habits || []).map(h => ({
      title: h.title,
      streak: h.streak || 0,
      thisWeek: (h.completions || []).filter(d => d >= weekStartStr).length,
    }));

    return { completed, created, overdue, inProgress, projectBreakdown, byType, upcoming, habitSummary };
  }, [items, habits, weekStartStr, todayStr]);

  if (!stats) return <div style={{ padding: 20, color: "var(--text-tertiary)", textAlign: "center" }}>Loading review...</div>;

  const StatCard = ({ label, value, color, icon }) => (
    <div className="card" style={{ padding: 16, textAlign: "center", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: 20, maxWidth: 640 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Weekly Review</h2>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>
        Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>

      {/* Stats Grid */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Completed" value={stats.completed.length} color="#059669" icon="✅" />
        <StatCard label="Created" value={stats.created.length} color="#2563eb" icon="➕" />
        <StatCard label="Overdue" value={stats.overdue.length} color="#dc2626" icon="⚠️" />
        <StatCard label="In Progress" value={stats.inProgress.length} color="#d97706" icon="⏳" />
      </div>

      {/* Completion by Type */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Completed by Type</h3>
        <div style={{ display: "flex", gap: 12 }}>
          {Object.entries(stats.byType).filter(([,v]) => v > 0).map(([type, count]) => (
            <div key={type} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{count}</span> <span style={{ color: "var(--text-tertiary)" }}>{type}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Project */}
      {Object.keys(stats.projectBreakdown).length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>By Project</h3>
          {Object.values(stats.projectBreakdown).sort((a, b) => b.count - a.count).map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{p.title}</span>
              <span style={{ fontWeight: 600 }}>{p.count} done</span>
            </div>
          ))}
        </div>
      )}

      {/* Habit Streaks */}
      {stats.habitSummary.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Habits</h3>
          {stats.habitSummary.map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{h.title}</span>
              <span><span style={{ color: "#d97706" }}>🔥{h.streak}d</span> • {h.thisWeek}/7 this week</span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming */}
      {stats.upcoming.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Coming Up Next Week</h3>
          {stats.upcoming.map(i => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{i.title}</span>
              <span style={{ color: "var(--text-tertiary)" }}>{i.dueDate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
