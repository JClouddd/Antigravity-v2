"use client";

import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths } from "date-fns";

export default function CalendarView({ tasks, projects, onSelectTask, googleAccessToken }) {
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

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const getTasksForDay = (day) => {
    return tasks.filter((t) => {
      if (t.timeBlock?.date) return isSameDay(new Date(t.timeBlock.date), day);
      if (t.dueDate) return isSameDay(new Date(t.dueDate), day);
      return false;
    });
  };

  const getGoogleEventsForDay = (day) => {
    return googleEvents.filter((e) => {
      const eventDate = e.start?.dateTime || e.start?.date;
      if (!eventDate) return false;
      return isSameDay(new Date(eventDate), day);
    });
  };

  const getProjectColor = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p?.color || "var(--accent)";
  };

  const today = new Date();

  return (
    <div>
      {/* Month Navigation */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
      }}>
        <button className="btn btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          ← Prev
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button className="btn btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          Next →
        </button>
      </div>

      {/* Day Headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        borderBottom: "1px solid var(--border)", marginBottom: 0,
      }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{
            textAlign: "center", padding: "8px 0",
            fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
            textTransform: "uppercase",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}>
        {calendarDays.map((day, i) => {
          const dayTasks = getTasksForDay(day);
          const dayEvents = getGoogleEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={i}
              style={{
                minHeight: 80,
                padding: 4,
                borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--border)" : "none",
                borderBottom: i < calendarDays.length - 7 ? "1px solid var(--border)" : "none",
                background: isToday ? "var(--accent-light)" : !isCurrentMonth ? "var(--bg-secondary)" : "transparent",
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: isToday ? "var(--accent)" : "var(--text-secondary)",
                padding: "2px 4px",
              }}>
                {format(day, "d")}
              </div>

              {/* Tasks */}
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  style={{
                    fontSize: 10, padding: "2px 4px", marginTop: 2,
                    borderRadius: 4, cursor: "pointer",
                    background: getProjectColor(task.projectId),
                    color: "#fff", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {task.timeBlock?.startTime ? `${task.timeBlock.startTime} ` : ""}{task.title}
                </div>
              ))}

              {/* Google Events */}
              {dayEvents.slice(0, 2).map((event, ei) => (
                <div
                  key={ei}
                  style={{
                    fontSize: 10, padding: "2px 4px", marginTop: 2,
                    borderRadius: 4, background: "var(--success-light)",
                    color: "var(--success)", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  📅 {event.summary}
                </div>
              ))}

              {dayTasks.length + dayEvents.length > 3 && (
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "0 4px" }}>
                  +{dayTasks.length + dayEvents.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
