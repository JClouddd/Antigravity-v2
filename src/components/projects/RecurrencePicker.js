"use client";

import { useState } from "react";

const PRESETS = [
  { label: "Daily", rule: "RRULE:FREQ=DAILY" },
  { label: "Weekdays", rule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", rule: "RRULE:FREQ=WEEKLY" },
  { label: "Biweekly", rule: "RRULE:FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", rule: "RRULE:FREQ=MONTHLY" },
  { label: "Yearly", rule: "RRULE:FREQ=YEARLY" },
];

const DAYS = [
  { id: "MO", label: "M" },
  { id: "TU", label: "T" },
  { id: "WE", label: "W" },
  { id: "TH", label: "Th" },
  { id: "FR", label: "F" },
  { id: "SA", label: "S" },
  { id: "SU", label: "Su" },
];

export default function RecurrencePicker({ value, onChange }) {
  const [mode, setMode] = useState(value ? "preset" : "none");
  const [customDays, setCustomDays] = useState([]);
  const [customInterval, setCustomInterval] = useState(1);
  const [customFreq, setCustomFreq] = useState("WEEKLY");

  const handlePreset = (rule) => {
    onChange(rule);
    setMode("preset");
  };

  const handleClear = () => {
    onChange(null);
    setMode("none");
  };

  const toggleDay = (dayId) => {
    const updated = customDays.includes(dayId)
      ? customDays.filter((d) => d !== dayId)
      : [...customDays, dayId];
    setCustomDays(updated);
    if (updated.length > 0) {
      const rule = `RRULE:FREQ=${customFreq};INTERVAL=${customInterval};BYDAY=${updated.join(",")}`;
      onChange(rule);
    }
  };

  const isActive = (rule) => value === rule;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        Recurrence
      </label>

      {/* Presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button type="button" className={`btn btn-sm ${!value ? "btn-primary" : ""}`}
          onClick={handleClear} style={{ fontSize: 11 }}>None</button>
        {PRESETS.map((p) => (
          <button key={p.label} type="button"
            className={`btn btn-sm ${isActive(p.rule) ? "btn-primary" : ""}`}
            onClick={() => handlePreset(p.rule)} style={{ fontSize: 11 }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom day picker */}
      <div>
        <button type="button" className="btn btn-sm"
          onClick={() => setMode(mode === "custom" ? "preset" : "custom")}
          style={{ fontSize: 11, marginBottom: 4 }}>
          {mode === "custom" ? "Hide Custom" : "Custom..."}
        </button>
        {mode === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Every</span>
              <input type="number" min="1" max="12" value={customInterval}
                onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                style={{ width: 40, fontSize: 12, padding: "2px 4px" }} />
              <select value={customFreq} onChange={(e) => setCustomFreq(e.target.value)}
                style={{ fontSize: 12, padding: "2px 4px", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4 }}>
                <option value="DAILY">day(s)</option>
                <option value="WEEKLY">week(s)</option>
                <option value="MONTHLY">month(s)</option>
              </select>
            </div>
            {customFreq === "WEEKLY" && (
              <div style={{ display: "flex", gap: 3 }}>
                {DAYS.map((d) => (
                  <button key={d.id} type="button" onClick={() => toggleDay(d.id)}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", fontSize: 10, fontWeight: 600,
                      border: "none", cursor: "pointer",
                      background: customDays.includes(d.id) ? "var(--accent)" : "var(--bg-primary)",
                      color: customDays.includes(d.id) ? "white" : "var(--text-secondary)",
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {value && (
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          {value}
        </div>
      )}
    </div>
  );
}
