"use client";

import { useState } from "react";
import { getAvailableRules } from "@/lib/automations";

const REMINDER_OPTIONS = [
  { value: "none", label: "No reminders" },
  { value: "5min", label: "5 minutes before" },
  { value: "15min", label: "15 minutes before" },
  { value: "30min", label: "30 minutes before" },
  { value: "1hr", label: "1 hour before" },
  { value: "1day", label: "1 day before" },
];

export default function SettingsPanel({ settings, onSave, onClose }) {
  const [views, setViews] = useState([...(settings?.views || [])]);
  const [modules, setModules] = useState([...(settings?.modules || [])]);
  const [moduleName, setModuleName] = useState(settings?.moduleName || "Projects");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragSection, setDragSection] = useState(null); // "views" or "modules"

  // Automation rules
  const availableRules = getAvailableRules();
  const [enabledRules, setEnabledRules] = useState(settings?.enabledRules || availableRules.map(r => r.id));

  // Notification prefs
  const [defaultReminder, setDefaultReminder] = useState(settings?.defaultReminder || "15min");
  const [overdueAlerts, setOverdueAlerts] = useState(settings?.overdueAlerts !== false);
  const [habitReminders, setHabitReminders] = useState(settings?.habitReminders !== false);

  // ── Generic drag handler for both views and modules ──
  const makeDragHandlers = (list, setList, section) => ({
    onDragStart: (idx) => { setDragIdx(idx); setDragSection(section); },
    onDragOver: (e, idx) => {
      e.preventDefault();
      if (dragSection !== section || dragIdx === null || dragIdx === idx) return;
      const updated = [...list];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(idx, 0, moved);
      setList(updated);
      setDragIdx(idx);
    },
    onDragEnd: () => { setDragIdx(null); setDragSection(null); },
  });

  const viewDrag = makeDragHandlers(views, setViews, "views");
  const modDrag = makeDragHandlers(modules, setModules, "modules");

  const handleRename = (list, setList, idx, newLabel) => {
    const updated = [...list];
    updated[idx] = { ...updated[idx], label: newLabel };
    setList(updated);
  };

  const handleToggle = (list, setList, idx) => {
    const updated = [...list];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    setList(updated);
  };

  const toggleRule = (ruleId) => {
    setEnabledRules(prev =>
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]
    );
  };

  const handleSave = () => {
    onSave({ views, modules, moduleName, enabledRules, defaultReminder, overdueAlerts, habitReminders });
    onClose();
  };

  const SectionLabel = ({ children }) => (
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </label>
  );

  const ToggleSwitch = ({ checked, onChange, label }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <button onClick={onChange} style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
        background: checked ? "var(--accent)" : "var(--border)",
        position: "relative", transition: "background 0.2s",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 2, left: checked ? 18 : 2,
          transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );

  // Reusable draggable list row
  const DraggableRow = ({ item, idx, dragHandlers, isActive, onToggle, onRename }) => (
    <div
      draggable
      onDragStart={() => dragHandlers.onDragStart(idx)}
      onDragOver={(e) => dragHandlers.onDragOver(e, idx)}
      onDragEnd={dragHandlers.onDragEnd}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", background: isActive ? "var(--accent-light)" : "var(--bg-secondary)",
        borderRadius: "var(--radius-sm)", cursor: "grab",
        opacity: item.enabled ? 1 : 0.5, transition: "background 0.1s",
      }}
    >
      <span style={{ color: "var(--text-tertiary)", cursor: "grab", fontSize: 14 }}>⠿</span>
      <button
        onClick={onToggle}
        style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: "pointer",
          border: item.enabled ? "none" : "2px solid var(--border)",
          background: item.enabled ? "var(--accent)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {item.enabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      </button>
      <input
        type="text" value={item.label}
        onChange={(e) => onRename(e.target.value)}
        style={{ flex: 1, fontSize: 13, fontWeight: 500, padding: "4px 6px", border: "1px solid transparent", borderRadius: 4, background: "transparent" }}
        onFocus={(e) => e.target.style.borderColor = "var(--border)"}
        onBlur={(e) => e.target.style.borderColor = "transparent"}
      />
      <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{item.id}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 300 }} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 400,
        background: "var(--bg-primary)", borderLeft: "1px solid var(--border)",
        zIndex: 301, display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Settings</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Module Name ── */}
          <div>
            <SectionLabel>Module Name</SectionLabel>
            <input type="text" value={moduleName} onChange={(e) => setModuleName(e.target.value)}
              style={{ fontSize: 14 }} placeholder="Projects" />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              This name appears in the sidebar and page header.
            </div>
          </div>

          {/* ── Sidebar Modules ── */}
          <div>
            <SectionLabel>📌 Sidebar Modules (drag to reorder)</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {modules.map((mod, idx) => (
                <DraggableRow
                  key={mod.id} item={mod} idx={idx}
                  dragHandlers={modDrag}
                  isActive={dragSection === "modules" && dragIdx === idx}
                  onToggle={() => handleToggle(modules, setModules, idx)}
                  onRename={(val) => handleRename(modules, setModules, idx, val)}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Reorder or hide sidebar modules. These appear in the left navigation.
            </div>
          </div>

          {/* ── View Tabs ── */}
          <div>
            <SectionLabel>📋 Views (drag to reorder)</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {views.map((view, idx) => (
                <DraggableRow
                  key={view.id} item={view} idx={idx}
                  dragHandlers={viewDrag}
                  isActive={dragSection === "views" && dragIdx === idx}
                  onToggle={() => handleToggle(views, setViews, idx)}
                  onRename={(val) => handleRename(views, setViews, idx, val)}
                />
              ))}
            </div>
          </div>

          {/* ── Automations ── */}
          <div>
            <SectionLabel>⚡ Automations</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {availableRules.map(rule => (
                <ToggleSwitch
                  key={rule.id}
                  label={rule.label}
                  checked={enabledRules.includes(rule.id)}
                  onChange={() => toggleRule(rule.id)}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
              Automation rules run automatically when conditions are met.
            </div>
          </div>

          {/* ── Notifications & Reminders ── */}
          <div>
            <SectionLabel>🔔 Notifications</SectionLabel>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Default reminder for events</div>
              <select value={defaultReminder} onChange={(e) => setDefaultReminder(e.target.value)} style={{ fontSize: 13 }}>
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <ToggleSwitch
              label="Overdue task alerts"
              checked={overdueAlerts}
              onChange={() => setOverdueAlerts(!overdueAlerts)}
            />
            <ToggleSwitch
              label="Daily habit reminders"
              checked={habitReminders}
              onChange={() => setHabitReminders(!habitReminders)}
            />
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
