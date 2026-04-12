"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems } from "@/lib/projects";

const STAT_CARDS = [
  { key: "today", label: "Today", icon: "📅", filter: (items) => { const d = new Date().toISOString().split("T")[0]; return items.filter(i => i.dueDate === d || i.timeBlock?.date === d); } },
  { key: "overdue", label: "Overdue", icon: "⚠️", filter: (items) => { const d = new Date().toISOString().split("T")[0]; return items.filter(i => i.dueDate && i.dueDate < d && i.status !== "done"); } },
  { key: "inProgress", label: "In Progress", icon: "🔄", filter: (items) => items.filter(i => i.status === "in_progress") },
  { key: "done", label: "Completed", icon: "✅", filter: (items) => items.filter(i => i.status === "done") },
];

export default function DashboardModule() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getItems(user.uid);
    setItems(data);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split("T")[0];
  const todayItems = items.filter(i => i.dueDate === today || i.timeBlock?.date === today);
  const upcoming = items.filter(i => i.dueDate && i.dueDate > today && i.dueDate <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] && i.status !== "done");

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{greeting()} 👋</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {STAT_CARDS.map(card => {
          const count = card.filter(items).length;
          return (
            <div key={card.key} className="card" style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{card.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>📅 Today&apos;s Schedule</h3>
        {todayItems.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Nothing scheduled for today!</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {todayItems.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-secondary)" }}>
              <span style={{ fontSize: 14 }}>{item.type === "event" ? "📅" : item.type === "task" ? "✅" : "📋"}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.title}</span>
              {item.timeBlock?.startTime && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.timeBlock.startTime}</span>}
              <span className="badge badge-accent" style={{ fontSize: 10 }}>{item.status?.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>📆 Upcoming (7 days)</h3>
        {upcoming.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No upcoming items this week.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {upcoming.slice(0, 10).map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-secondary)" }}>
              <span style={{ flex: 1, fontSize: 13 }}>{item.title}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.dueDate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
