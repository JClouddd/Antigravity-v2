"use client";

import { useState, useEffect, useRef } from "react";

export default function TimeTracker({ item, onLogTime }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => { return () => clearInterval(intervalRef.current); }, []);

  const start = () => {
    startRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    const duration = Math.floor((Date.now() - startRef.current) / 1000);
    if (duration > 5 && onLogTime) {
      onLogTime({
        itemId: item.id,
        itemTitle: item.title,
        startedAt: new Date(startRef.current).toISOString(),
        endedAt: new Date().toISOString(),
        duration,
      });
    }
    setElapsed(0);
  };

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`;
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {running && (
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>
          {fmt(elapsed)}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); running ? stop() : start(); }}
        title={running ? "Stop timer" : "Start timer"}
        style={{
          width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer",
          background: running ? "#dc2626" : "var(--bg-secondary)",
          color: running ? "white" : "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
          transition: "all 0.15s",
        }}
      >
        {running ? "■" : "▶"}
      </button>
    </div>
  );
}

// Standalone: show total time logged for an item
export function TimeLog({ entries }) {
  if (!entries?.length) return null;
  const total = entries.reduce((s, e) => s + (e.duration || 0), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return (
    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
      ⏱ {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}
