"use client";

import { useState } from "react";

export default function SettingsPanel({ settings, onSave, onClose }) {
  const [views, setViews] = useState([...(settings?.views || [])]);
  const [moduleName, setModuleName] = useState(settings?.moduleName || "Projects");
  const [dragIdx, setDragIdx] = useState(null);

  const handleRename = (idx, newLabel) => {
    const updated = [...views];
    updated[idx] = { ...updated[idx], label: newLabel };
    setViews(updated);
  };

  const handleToggle = (idx) => {
    const updated = [...views];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    setViews(updated);
  };

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const updated = [...views];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setViews(updated);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleSave = () => {
    onSave({ views, moduleName });
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 300 }} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 380,
        background: "var(--bg-primary)", borderLeft: "1px solid var(--border)",
        zIndex: 301, display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Settings</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Module Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Module Name
            </label>
            <input type="text" value={moduleName} onChange={(e) => setModuleName(e.target.value)}
              style={{ fontSize: 14 }} placeholder="Projects" />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              This name appears in the sidebar and page header.
            </div>
          </div>

          {/* View Tabs */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Views (drag to reorder)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {views.map((view, idx) => (
                <div
                  key={view.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", background: dragIdx === idx ? "var(--accent-light)" : "var(--bg-secondary)",
                    borderRadius: "var(--radius-sm)", cursor: "grab",
                    opacity: view.enabled ? 1 : 0.5,
                    transition: "background 0.1s",
                  }}
                >
                  {/* Drag handle */}
                  <span style={{ color: "var(--text-tertiary)", cursor: "grab", fontSize: 14 }}>⠿</span>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(idx)}
                    style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: "pointer",
                      border: view.enabled ? "none" : "2px solid var(--border)",
                      background: view.enabled ? "var(--accent)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {view.enabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>

                  {/* Name input */}
                  <input
                    type="text"
                    value={view.label}
                    onChange={(e) => handleRename(idx, e.target.value)}
                    style={{ flex: 1, fontSize: 13, fontWeight: 500, padding: "4px 6px", border: "1px solid transparent", borderRadius: 4, background: "transparent" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--border)"}
                    onBlur={(e) => e.target.style.borderColor = "transparent"}
                  />

                  {/* ID badge */}
                  <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{view.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}
