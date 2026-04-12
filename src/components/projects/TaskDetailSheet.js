"use client";

import { useState } from "react";
import TimeTracker, { TimeLog } from "./TimeTracker";
import RecurrencePicker from "./RecurrencePicker";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = [
  { key: "planning", label: "Planning" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];
const TYPE_LABELS = {
  project: "📁 Project", task: "✅ Task", subtask: "↳ Sub-task", event: "📅 Event",
  plan: "📋 Plan", goal: "🎯 Goal", habit: "🔄 Habit", journal: "📓 Journal",
};
const PRIORITY_STYLES = {
  urgent: { background: "var(--error-light)", color: "var(--error)" },
  high: { background: "var(--warning-light)", color: "var(--warning)" },
  medium: { background: "var(--accent-light)", color: "var(--accent)" },
  low: { background: "var(--bg-secondary)", color: "var(--text-secondary)" },
};

export default function TaskDetailSheet({ task, tasks, projects, onUpdate, onDelete, onClose, onAddSubtask, timeEntries, onLogTime }) {
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [status, setStatus] = useState(task.status || "todo");
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [timeBlockDate, setTimeBlockDate] = useState(task.timeBlock?.date || "");
  const [timeBlockStart, setTimeBlockStart] = useState(task.timeBlock?.startTime || "");
  const [timeBlockEnd, setTimeBlockEnd] = useState(task.timeBlock?.endTime || "");
  const [deps, setDeps] = useState(task.dependencies || []);
  const [location, setLocation] = useState(task.location || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [recurrence, setRecurrence] = useState(task.recurrence || null);

  const project = projects.find((p) => p.id === task.parentId);
  const isProject = task.type === "project";
  const subtasks = isProject ? tasks.filter((t) => t.parentId === task.id) : [];
  const availableDeps = tasks.filter((t) => t.id !== task.id && t.type !== "project");
  const itemTimeEntries = (timeEntries || []).filter(e => e.itemId === task.id);

  const handleSave = () => {
    const updates = {
      title, description, priority, status,
      startDate: startDate || null, dueDate: dueDate || null,
      timeBlock: timeBlockDate ? { date: timeBlockDate, startTime: timeBlockStart, endTime: timeBlockEnd } : null,
      dependencies: deps, location, notes,
      recurrence: recurrence || null,
    };
    if (status === "done" && task.status !== "done") {
      updates.completedAt = new Date().toISOString();
    }
    onUpdate(updates);
    onClose();
  };

  const SectionLabel = ({ children }) => (
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>{children}</label>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200 }} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 440,
        background: "var(--bg-primary)", borderLeft: "1px solid var(--border)",
        zIndex: 201, display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          paddingTop: "max(16px, env(safe-area-inset-top))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {project && <div style={{ width: 10, height: 10, borderRadius: "50%", background: project.color }} />}
            {isProject && <div style={{ width: 10, height: 10, borderRadius: "50%", background: task.color || "var(--accent)" }} />}
            <span style={{ fontSize: 13, fontWeight: 600 }}>{TYPE_LABELS[task.type] || "Item"}</span>
            {task.source === "antigravity" && <span style={{ fontSize: 11, color: "var(--accent)" }}>🤖 AI</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Time Tracker */}
            {(task.type === "task" || task.type === "subtask" || task.type === "event") && onLogTime && (
              <TimeTracker item={task} onLogTime={onLogTime} />
            )}
            <button className="btn btn-sm" style={{ color: "var(--error)" }} onClick={onDelete}>Delete</button>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <SectionLabel>Title</SectionLabel>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 16 }} />
          </div>

          <div>
            <SectionLabel>Description</SectionLabel>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ resize: "vertical", fontSize: 14 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <SectionLabel>Status</SectionLabel>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel>Priority</SectionLabel>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <SectionLabel>Start</SectionLabel>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <SectionLabel>Due</SectionLabel>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Time Block */}
          <div>
            <SectionLabel>Time Block</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input type="date" value={timeBlockDate} onChange={(e) => setTimeBlockDate(e.target.value)} />
              <input type="time" value={timeBlockStart} onChange={(e) => setTimeBlockStart(e.target.value)} />
              <input type="time" value={timeBlockEnd} onChange={(e) => setTimeBlockEnd(e.target.value)} />
            </div>
          </div>

          {/* Location */}
          <div>
            <SectionLabel>Location</SectionLabel>
            <input type="text" placeholder="Add location..." value={location} onChange={(e) => setLocation(e.target.value)} style={{ fontSize: 14 }} />
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ fontSize: 13, resize: "vertical" }} />
          </div>

          {/* Recurrence */}
          {(task.type === "task" || task.type === "event" || task.type === "habit") && (
            <div>
              <SectionLabel>Recurrence</SectionLabel>
              <RecurrencePicker value={recurrence} onChange={setRecurrence} />
            </div>
          )}

          {/* Time Logged */}
          {itemTimeEntries.length > 0 && (
            <div>
              <SectionLabel>Time Logged</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {itemTimeEntries.map((entry, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 8px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {new Date(entry.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(entry.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                      {Math.floor(entry.duration / 3600) > 0 ? `${Math.floor(entry.duration / 3600)}h ` : ""}{Math.floor((entry.duration % 3600) / 60)}m
                    </span>
                  </div>
                ))}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <TimeLog entries={itemTimeEntries} />
                </div>
              </div>
            </div>
          )}

          {/* Project: Sub-task list */}
          {isProject && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <SectionLabel>Sub-tasks ({subtasks.filter(s => s.status === "done").length}/{subtasks.length})</SectionLabel>
                <button className="btn btn-sm" onClick={() => { onClose(); setTimeout(() => onAddSubtask(), 100); }}
                  style={{ fontSize: 11, padding: "3px 8px" }}>+ Add</button>
              </div>
              {subtasks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {subtasks.map((st) => (
                    <div key={st.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                      background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", fontSize: 13,
                    }}>
                      <input type="checkbox" checked={st.status === "done"} onChange={() => {}} style={{ accentColor: "var(--accent)" }} />
                      <span style={{ flex: 1, fontWeight: 500, textDecoration: st.status === "done" ? "line-through" : "none", color: st.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)" }}>
                        {st.title}
                      </span>
                      <span className="badge" style={{ ...PRIORITY_STYLES[st.priority], fontSize: 10 }}>{st.priority}</span>
                    </div>
                  ))}
                </div>
              )}
              {subtasks.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "8px 0" }}>No sub-tasks yet. Click + Add to create one.</div>
              )}
            </div>
          )}

          {/* Dependencies */}
          {!isProject && (
            <div>
              <SectionLabel>Blocked By ({deps.length})</SectionLabel>
              {deps.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {deps.map((depId) => {
                    const dep = tasks.find((t) => t.id === depId);
                    return (
                      <span key={depId} className="badge badge-accent" style={{ cursor: "pointer" }}
                        onClick={() => setDeps(deps.filter((d) => d !== depId))}>{dep?.title || depId} ✕</span>
                    );
                  })}
                </div>
              )}
              <select value="" onChange={(e) => { if (e.target.value && !deps.includes(e.target.value)) setDeps([...deps, e.target.value]); }}>
                <option value="">Add dependency...</option>
                {availableDeps.filter((t) => !deps.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}

          {/* Sync info */}
          {(task.googleCalendarEventId || task.googleTaskId) && (
            <div style={{ padding: 10, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-secondary)" }}>
              {task.googleCalendarEventId && <div>📅 Synced to Google Calendar</div>}
              {task.googleTaskId && <div>✅ Synced to Google Tasks</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 20px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, justifyContent: "flex-end",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}
