"use client";

import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths } from "date-fns";

const TYPE_COLORS = {
  project: "#2563eb",
  task: "#059669",
  subtask: "#6b7280",
  event: "#d97706",
  plan: "#7c3aed",
  goal: "#dc2626",
  habit: "#059669",
  journal: "#8b5cf6",
};

const TYPE_ICONS = {
  project: "📁", task: "✅", subtask: "↳", event: "📅",
  plan: "📋", goal: "🎯", habit: "🔄", journal: "📓",
};

export default function CalendarView({ tasks, projects, habits, onSelectTask, onNavigate, googleAccessToken }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [googleEvents, setGoogleEvents] = useState([]);

  // Fetch Google Calendar events
  useEffect(() => {
    if (!googleAccessToken) return;
    const fetchEvents = async () => {
      try {
        const start = startOfMonth(currentMonth).toISOString();
        const end = endOfMonth(currentMonth).toISOString();
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${googleAccessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setGoogleEvents(data.items || []);
        }
      } catch (e) {
        console.error("Calendar fetch error:", e);
      }
    };
    fetchEvents();
  }, [googleAccessToken, currentMonth]);

  // Generate habit items for each day of the month
  const habitItems = useMemo(() => {
    if (!habits?.length) return [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const items = [];
    habits.forEach(h => {
      const completions = new Set(h.completions || []);
      days.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        if (completions.has(dateStr)) {
          items.push({ id: `habit-${h.id}-${dateStr}`, title: h.title, type: "habit", date: dateStr, color: h.color || "#059669", completed: true });
        }
      });
    });
    return items;
  }, [habits, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const getItemsForDay = (day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const items = tasks.filter((t) => {
      if (t.timeBlock?.date === dayStr) return true;
      if (t.dueDate === dayStr) return true;
      if (t.startDate === dayStr && !t.dueDate) return true;
      if (t.date === dayStr) return true; // journals
      return false;
    });
    // Add habits for this day
    const dayHabits = habitItems.filter(h => h.date === dayStr);
    return [...items, ...dayHabits];
  };

  const getGoogleEventsForDay = (day) => {
    return googleEvents.filter((e) => {
      const eventDate = e.start?.dateTime || e.start?.date;
      if (!eventDate) return false;
      return isSameDay(new Date(eventDate), day);
    });
  };

  const getItemColor = (item) => {
    if (item.color) return item.color;
    const project = projects.find(p => p.id === item.parentId);
    if (project?.color) return project.color;
    return TYPE_COLORS[item.type] || "var(--accent)";
  };

  const handleItemClick = (item) => {
    // Navigate to the right view based on type
    if (item.type === "habit" && onNavigate) {
      onNavigate("habits");
    } else if (item.type === "goal" && onNavigate) {
      onNavigate("goals");
    } else if (item.type === "journal" && onNavigate) {
      onNavigate("review");
    } else if (item.type === "plan" && onNavigate) {
      onNavigate("planning");
    } else {
      onSelectTask(item);
    }
  };

  const today = new Date();

  return (
    <div>
      {/* Month Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button className="btn btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>← Prev</button>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{format(currentMonth, "MMMM yyyy")}</h2>
        <button className="btn btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>Next →</button>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(TYPE_ICONS).map(([type, icon]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-tertiary)" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[type] }} />
            {icon} {type}
          </div>
        ))}
      </div>

      {/* Day Headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {calendarDays.map((day, i) => {
          const dayItems = getItemsForDay(day);
          const dayEvents = getGoogleEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const allItems = [...dayItems, ...dayEvents.map(e => ({ id: e.id, title: e.summary, type: "google", _google: true }))];

          return (
            <div key={i} style={{
              minHeight: 80, padding: 4,
              borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--border)" : "none",
              borderBottom: i < calendarDays.length - 7 ? "1px solid var(--border)" : "none",
              background: isToday ? "var(--accent-light)" : !isCurrentMonth ? "var(--bg-secondary)" : "transparent",
              opacity: isCurrentMonth ? 1 : 0.4,
            }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--text-secondary)", padding: "2px 4px" }}>
                {format(day, "d")}
              </div>

              {dayItems.slice(0, 3).map((item) => (
                <div key={item.id} onClick={() => handleItemClick(item)} style={{
                  fontSize: 10, padding: "2px 4px", marginTop: 2, borderRadius: 4, cursor: "pointer",
                  background: getItemColor(item), color: "#fff", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {TYPE_ICONS[item.type] || ""} {item.timeBlock?.startTime ? `${item.timeBlock.startTime} ` : ""}{item.title}
                </div>
              ))}

              {dayEvents.slice(0, 2).map((event, ei) => (
                <div key={ei} style={{
                  fontSize: 10, padding: "2px 4px", marginTop: 2, borderRadius: 4,
                  background: "var(--success-light)", color: "var(--success)", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  📅 {event.summary}
                </div>
              ))}

              {allItems.length > 3 && (
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "0 4px" }}>
                  +{allItems.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
