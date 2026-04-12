"use client";

import { useState } from "react";
import RecurrencePicker from "./RecurrencePicker";

const ITEM_TYPES = [
  { key: "project", label: "Project", desc: "Top-level container with sub-tasks", icon: "📁" },
  { key: "task", label: "Task", desc: "Standalone action item", icon: "✅" },
  { key: "event", label: "Event", desc: "Calendar event with time block", icon: "📅" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];
const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4f46e5", "#be185d"];

export default function CreateItemModal({ projects, activeProject, defaultStatus, defaults = {}, onCreate, onClose }) {
  const hasPresetType = !!defaults.type;
  const [step, setStep] = useState(hasPresetType ? 2 : 1);
  const [type, setType] = useState(defaults.type || null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [parentId, setParentId] = useState(defaults.parentId || null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [timeBlockDate, setTimeBlockDate] = useState("");
  const [timeBlockStart, setTimeBlockStart] = useState("");
  const [timeBlockEnd, setTimeBlockEnd] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState(null);

  // Project sub-tasks (inline creation)
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const handleTypeSelect = (t) => {
    setType(t);
    if (t !== "subtask") setParentId(null);
    setStep(2);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { title: newSubtaskTitle.trim(), priority: "medium" }]);
    setNewSubtaskTitle("");
  };

  const handleRemoveSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    if (type === "project") {
      // Create project first, then sub-tasks
      await onCreate({
        type: "project",
        title: title.trim(),
        description,
        status: defaultStatus || "todo",
        priority,
        color,
        startDate: startDate || null,
        dueDate: dueDate || null,
        _subtasks: subtasks, // Pass subtasks for the parent to create
      });
    } else {
      await onCreate({
        type: type === "subtask" ? "subtask" : type,
        title: title.trim(),
        description,
        status: defaultStatus || "todo",
        priority,
        parentId: type === "subtask" ? parentId : null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        location: location || "",
        notes: notes || "",
        timeBlock: type === "event" && timeBlockDate ? { date: timeBlockDate, startTime: timeBlockStart, endTime: timeBlockEnd } : null,
        recurrence: recurrence || null,
      });
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>

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
                    borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s",
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
                onKeyDown={(e) => e.key === "Enter" && title.trim() && (type !== "project" ? handleCreate() : null)} autoFocus style={{ fontSize: 16 }}
              />

              <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={2} style={{ resize: "vertical", fontSize: 14 }}
              />

              {/* Project: Color picker */}
              {type === "project" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Color</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setColor(c)} style={{
                        width: 28, height: 28, borderRadius: "50%", background: c,
                        border: color === c ? "2px solid var(--text-primary)" : "2px solid transparent",
                        cursor: "pointer",
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Project: Inline sub-tasks */}
              {type === "project" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                    Sub-tasks ({subtasks.length})
                  </label>
                  {subtasks.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                      {subtasks.map((st, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                          background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)",
                          fontSize: 13,
                        }}>
                          <span style={{ color: "var(--text-tertiary)" }}>↳</span>
                          <span style={{ flex: 1, fontWeight: 500 }}>{st.title}</span>
                          <button className="btn-icon" onClick={() => handleRemoveSubtask(i)}
                            style={{ fontSize: 12, padding: 2 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text" placeholder="Add a sub-task..." value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                      style={{ flex: 1, fontSize: 13, padding: "8px 10px" }}
                    />
                    <button className="btn btn-sm" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}>Add</button>
                  </div>
                </div>
              )}

              {/* Priority */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Priority</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {PRIORITIES.map((p) => (
                    <button key={p} className={`btn btn-sm ${priority === p ? "btn-primary" : ""}`}
                      onClick={() => setPriority(p)} style={{ textTransform: "capitalize", flex: 1 }}>{p}</button>
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

              {/* Location (events + tasks) */}
              {(type === "event" || type === "task") && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Location</label>
                  <input type="text" placeholder="Add location..." value={location} onChange={(e) => setLocation(e.target.value)} style={{ fontSize: 14 }} />
                </div>
              )}

              {/* Notes */}
              {(type === "event" || type === "task") && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Notes</label>
                  <textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ fontSize: 13, resize: "vertical" }} />
                </div>
              )}

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

              {/* Recurrence */}
              {(type === "event" || type === "task") && (
                <RecurrencePicker value={recurrence} onChange={setRecurrence} />
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleCreate} disabled={!title.trim()}>
                Create{type === "project" && subtasks.length > 0 ? ` + ${subtasks.length} sub-tasks` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
