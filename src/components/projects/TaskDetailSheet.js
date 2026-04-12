"use client";

import { useState } from "react";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function TaskDetailSheet({ task, tasks, projects, onUpdate, onDelete, onClose }) {
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

  const project = projects.find((p) => p.id === task.projectId);
  const availableDeps = tasks.filter((t) => t.id !== task.id);

  const handleSave = () => {
    onUpdate({
      title, description, priority, status,
      startDate: startDate || null,
      dueDate: dueDate || null,
      timeBlock: timeBlockDate ? { date: timeBlockDate, startTime: timeBlockStart, endTime: timeBlockEnd } : null,
      dependencies: deps,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 420,
        background: "var(--bg-primary)", borderLeft: "1px solid var(--border)",
        zIndex: 201, display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          paddingTop: "max(16px, env(safe-area-inset-top))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {project && (
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: project.color,
              }} />
            )}
            <span style={{ fontSize: 14, fontWeight: 600 }}>Task Details</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" style={{ color: "var(--error)" }} onClick={onDelete}>Delete</button>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 16 }} />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ resize: "vertical", fontSize: 16 }}
            />
          </div>

          {/* Status & Priority */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Time Block */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Time Block</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <input type="date" value={timeBlockDate} onChange={(e) => setTimeBlockDate(e.target.value)} placeholder="Date" />
              <input type="time" value={timeBlockStart} onChange={(e) => setTimeBlockStart(e.target.value)} />
              <input type="time" value={timeBlockEnd} onChange={(e) => setTimeBlockEnd(e.target.value)} />
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
              Blocked By ({deps.length})
            </label>
            {deps.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {deps.map((depId) => {
                  const depTask = tasks.find((t) => t.id === depId);
                  return (
                    <span key={depId} className="badge badge-accent" style={{ cursor: "pointer" }}
                      onClick={() => setDeps(deps.filter((d) => d !== depId))}
                    >
                      {depTask?.title || depId} ✕
                    </span>
                  );
                })}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !deps.includes(e.target.value)) {
                  setDeps([...deps, e.target.value]);
                }
              }}
            >
              <option value="">Add dependency...</option>
              {availableDeps.filter((t) => !deps.includes(t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 20px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, justifyContent: "flex-end",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </>
  );
}
