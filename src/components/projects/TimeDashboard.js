"use client";

import { useMemo } from "react";

export default function TimeDashboard({ timeEntries, items, projects }) {
  const stats = useMemo(() => {
    if (!timeEntries?.length) return null;

    const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration || 0), 0);

    // By project
    const byProject = {};
    timeEntries.forEach(entry => {
      const item = items.find(i => i.id === entry.itemId);
      const projectId = item?.parentId || item?.id || "__standalone";
      const project = projects.find(p => p.id === projectId);
      const key = project?.id || "__standalone";
      if (!byProject[key]) {
        byProject[key] = { title: project?.title || "Standalone", color: project?.color || "var(--accent)", seconds: 0, entries: 0 };
      }
      byProject[key].seconds += entry.duration || 0;
      byProject[key].entries += 1;
    });

    // By day (last 7 days)
    const byDay = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      byDay[key] = { date: key, label: d.toLocaleDateString("en-US", { weekday: "short" }), seconds: 0 };
    }
    timeEntries.forEach(entry => {
      const day = entry.startedAt?.split("T")[0];
      if (day && byDay[day]) byDay[day].seconds += entry.duration || 0;
    });

    // By item
    const byItem = {};
    timeEntries.forEach(entry => {
      if (!byItem[entry.itemId]) {
        byItem[entry.itemId] = { title: entry.itemTitle || "Unknown", seconds: 0, entries: 0 };
      }
      byItem[entry.itemId].seconds += entry.duration || 0;
      byItem[entry.itemId].entries += 1;
    });

    const sortedProjects = Object.values(byProject).sort((a, b) => b.seconds - a.seconds);
    const sortedItems = Object.values(byItem).sort((a, b) => b.seconds - a.seconds);
    const dailyData = Object.values(byDay);
    const maxDaily = Math.max(...dailyData.map(d => d.seconds), 1);

    return { totalSeconds, sortedProjects, sortedItems, dailyData, maxDaily, totalEntries: timeEntries.length };
  }, [timeEntries, items, projects]);

  const fmt = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (!stats) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>⏱</div>
        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>No time tracked yet</h3>
        <p style={{ fontSize: 13 }}>Start a timer on any task to track your time.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Time Dashboard</h2>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>
        {stats.totalEntries} sessions tracked
      </p>

      {/* Total */}
      <div className="card" style={{ padding: 20, textAlign: "center", marginBottom: 16, background: "linear-gradient(135deg, var(--accent), #7c3aed)", color: "#fff", borderRadius: "var(--radius-lg)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>Total Time Tracked</div>
        <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace" }}>{fmt(stats.totalSeconds)}</div>
      </div>

      {/* Daily Bar Chart */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Last 7 Days</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
          {stats.dailyData.map((day) => (
            <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                {day.seconds > 0 ? fmt(day.seconds) : ""}
              </div>
              <div style={{
                width: "100%", maxWidth: 40,
                height: Math.max(day.seconds > 0 ? 4 : 0, (day.seconds / stats.maxDaily) * 80),
                background: day.seconds > 0 ? "var(--accent)" : "var(--border)",
                borderRadius: 4, transition: "height 0.3s",
              }} />
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500 }}>{day.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By Project */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>By Project</h3>
        {stats.sortedProjects.map((p, i) => {
          const pct = (p.seconds / stats.totalSeconds) * 100;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500 }}>{p.title}</span>
                </div>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmt(p.seconds)}</span>
              </div>
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* By Task */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top Tasks</h3>
        {stats.sortedItems.slice(0, 10).map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: i < stats.sortedItems.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontWeight: 500 }}>{item.title}</span>
            <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{fmt(item.seconds)} ({item.entries}x)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
