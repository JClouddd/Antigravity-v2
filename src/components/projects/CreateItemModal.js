"use client";

import { useState } from "react";

const ITEM_TYPES = [
  { key: "project", label: "Project", desc: "Top-level container with sub-tasks", icon: "📁" },
  { key: "task", label: "Task", desc: "Standalone action item", icon: "✅" },
  { key: "event", label: "Event", desc: "Calendar event with time block", icon: "📅" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];
const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4f46e5", "#be185d"];

export default function CreateItemModal({ projects, activeProject, defaultStatus, onCreate, onClose }) {
  const [step, setStep] = useState(1); // 1 = type select, 2 = details
  const [type, setType] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [parentId, setParentId] = useState(activeProject || null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [timeBlockDate, setTimeBlockDate] = useState("");
  const [timeBlockStart, setTimeBlockStart] = useState("");
  const [timeBlockEnd, setTimeBlockEnd] = useState("");
  const [color, setColor] = useState("#2563eb");

  const handleTypeSelect = (t) => {
    setType(t);
    if (t === "project") setParentId(null); // Projects can't have parents
    setStep(2);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const data = {
      type: type === "task" && parentId ? "subtask" : type,
      title: title.trim(),
      description,
      status: defaultStatus || "todo",
      priority,
      parentId: type === "project" ? null : parentId,
      startDate: startDate || null,
      dueDate: dueDate || null,
      color: type === "project" ? color : undefined,
      timeBlock: type === "event" && timeBlockDate ? { date: timeBlockDate, startTime: timeBlockStart, endTime: timeBlockEnd } : null,
    };
    onCreate(data);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step 1: Type Selection */}
        {step === 1 && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>What would you like to add?</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ITEM_TYPES.map(({ key, label, desc, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTypeSelect(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", cursor: "pointer",
                    textAlign: "left", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button className="btn btn-sm" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button className="btn-icon" onClick={() => setStep(1)} style={{ marginRight: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                New {type === "project" ? "Project" : type === "event" ? "Event" : "Task"}
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="text" placeholder="Title..." value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus style={{ fontSize: 16 }}
              />

              <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={2} style={{ resize: "vertical", fontSize: 14 }}
              />

              {/* Project-specific: Color picker */}
              {type === "project" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Color</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setColor(c)} style={{
                        width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "2px solid var(--text-primary)" : "2px solid transparent",
                        cursor: "pointer", transition: "transform 0.1s",
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Task/Subtask: Assign to project */}
              {type === "task" && projects.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                    Project (optional — makes it a sub-task)
                  </label>
                  <select value={parentId || ""} onChange={(e) => setParentId(e.target.value || null)}>
                    <option value="">Standalone Task</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Priority</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {PRIORITIES.map((p) => (
                    <button key={p} className={`btn btn-sm ${priority === p ? "btn-primary" : ""}`}
                      onClick={() => setPriority(p)} style={{ textTransform: "capitalize", flex: 1 }}
                    >{p}</button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Start</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Due</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              {/* Event: Time block */}
              {type === "event" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Time Block</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <input type="date" value={timeBlockDate} onChange={(e) => setTimeBlockDate(e.target.value)} />
                    <input type="time" value={timeBlockStart} onChange={(e) => setTimeBlockStart(e.target.value)} />
                    <input type="time" value={timeBlockEnd} onChange={(e) => setTimeBlockEnd(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleCreate} disabled={!title.trim()}>Create</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
