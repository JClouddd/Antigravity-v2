"use client";

import { useState, useMemo } from "react";

export default function WeeklyReview({ items, habits, onCreateJournal }) {
  const [journalText, setJournalText] = useState("");
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const stats = useMemo(() => {
    if (!items?.length) return null;

    const thisWeek = items.filter(i => {
      const d = i.completedAt?.split("T")[0] || i.updatedAt?.split("T")[0];
      return d && d >= weekStartStr && d <= todayStr;
    });

    const completed = thisWeek.filter(i => i.status === "done" && i.type !== "journal");
    const created = items.filter(i => i.createdAt?.split("T")[0] >= weekStartStr);
    const overdue = items.filter(i => i.dueDate && i.dueDate < todayStr && i.status !== "done");
    const inProgress = items.filter(i => i.status === "in_progress");

    const projectBreakdown = {};
    completed.forEach(i => {
      const key = i.parentId || "__standalone";
      if (!projectBreakdown[key]) projectBreakdown[key] = { count: 0, title: "" };
      projectBreakdown[key].count++;
    });
    const projects = items.filter(i => i.type === "project");
    Object.keys(projectBreakdown).forEach(k => {
      const p = projects.find(p => p.id === k);
      projectBreakdown[k].title = p?.title || "Standalone Tasks";
    });

    const byType = { project: 0, task: 0, subtask: 0, event: 0 };
    completed.forEach(i => { if (byType[i.type] !== undefined) byType[i.type]++; });

    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeekEnd.toISOString().split("T")[0];
    const upcoming = items.filter(i => i.dueDate && i.dueDate > todayStr && i.dueDate <= nextWeekStr && i.status !== "done");

    const habitSummary = (habits || []).map(h => ({
      title: h.title,
      streak: h.streak || 0,
      thisWeek: (h.completions || []).filter(d => d >= weekStartStr).length,
    }));

    // Journal entries this week
    const journals = items.filter(i => i.type === "journal" && (i.date || i.createdAt?.split("T")[0]) >= weekStartStr)
      .sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));

    return { completed, created, overdue, inProgress, projectBreakdown, byType, upcoming, habitSummary, journals };
  }, [items, habits, weekStartStr, todayStr]);

  if (!stats) return <div style={{ padding: 20, color: "var(--text-tertiary)", textAlign: "center" }}>Loading review...</div>;

  const StatCard = ({ label, value, color, icon }) => (
    <div className="card" style={{ padding: 16, textAlign: "center", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{label}</div>
    </div>
  );

  const handleAddJournal = () => {
    if (!journalText.trim() || !onCreateJournal) return;
    onCreateJournal({
      type: "journal",
      title: `Reflection — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      description: journalText.trim(),
      status: "done",
      date: todayStr,
      notes: journalText.trim(),
    });
    setJournalText("");
  };

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

      {/* Journal / Reflection */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📓 Journal & Reflections</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: stats.journals.length > 0 ? 12 : 0 }}>
          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Write a reflection... What went well? What can improve?"
            rows={2}
            style={{ flex: 1, fontSize: 13, resize: "vertical", padding: "8px 10px" }}
          />
          <button className="btn btn-sm btn-primary" onClick={handleAddJournal} disabled={!journalText.trim()}
            style={{ alignSelf: "flex-end", whiteSpace: "nowrap" }}>
            Add Entry
          </button>
        </div>
        {stats.journals.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.journals.map(j => (
              <div key={j.id} style={{ padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid #7c3aed" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
                  {new Date(j.date || j.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div style={{ fontSize: 13 }}>{j.description || j.notes || j.title}</div>
              </div>
            ))}
          </div>
        )}
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
