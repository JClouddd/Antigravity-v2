"use client";

import { useState, useEffect, useRef, useMemo } from "react";

const TYPE_ICONS = {
  project: "📁", task: "✅", subtask: "↳", event: "📅",
  plan: "📋", goal: "🎯", habit: "🔄", journal: "📓",
};

export default function CommandPalette({ items, onSelect, onNavigate, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const NAV_ACTIONS = [
    { id: "nav-today", title: "Go to Today", icon: "📅", action: () => onNavigate("today") },
    { id: "nav-board", title: "Go to Board", icon: "📋", action: () => onNavigate("board") },
    { id: "nav-table", title: "Go to Table", icon: "📊", action: () => onNavigate("table") },
    { id: "nav-timeline", title: "Go to Timeline", icon: "📈", action: () => onNavigate("timeline") },
    { id: "nav-calendar", title: "Go to Calendar", icon: "🗓", action: () => onNavigate("calendar") },
    { id: "nav-planning", title: "Go to Planning", icon: "📋", action: () => onNavigate("planning") },
    { id: "nav-habits", title: "Go to Habits", icon: "🔄", action: () => onNavigate("habits") },
    { id: "nav-goals", title: "Go to Goals", icon: "🎯", action: () => onNavigate("goals") },
    { id: "nav-review", title: "Go to Review", icon: "📓", action: () => onNavigate("review") },
    { id: "nav-time", title: "Go to Time", icon: "⏱", action: () => onNavigate("time") },
  ];

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Show nav shortcuts + recent items
      return [
        ...NAV_ACTIONS.slice(0, 5),
        ...(items || []).slice(0, 5).map(item => ({ id: item.id, title: item.title, icon: TYPE_ICONS[item.type] || "📄", item, isItem: true })),
      ];
    }

    const matched = [];

    // Search navigation
    NAV_ACTIONS.forEach(action => {
      if (action.title.toLowerCase().includes(q)) matched.push(action);
    });

    // Search items
    (items || []).forEach(item => {
      if (item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)) {
        matched.push({ id: item.id, title: item.title, icon: TYPE_ICONS[item.type] || "📄", subtitle: item.type, item, isItem: true });
      }
    });

    return matched.slice(0, 12);
  }, [query, items]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSelect = (result) => {
    if (result.action) {
      result.action();
    } else if (result.isItem && result.item) {
      onSelect(result.item);
    }
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 520, background: "var(--bg-primary)",
        border: "1px solid var(--border)", borderRadius: 12,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", zIndex: 501,
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search items, navigate views..."
            style={{ width: "100%", fontSize: 15, fontWeight: 500, border: "none", outline: "none", background: "transparent", color: "var(--text-primary)" }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: "auto", padding: "4px 0" }}>
          {results.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              No results found
            </div>
          )}
          {results.map((result, idx) => (
            <div
              key={result.id}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIdx(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
                cursor: "pointer",
                background: idx === selectedIdx ? "var(--accent-light)" : "transparent",
                transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{result.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {result.title}
                </div>
                {result.subtitle && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{result.subtitle}</div>
                )}
              </div>
              {result.action && <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>Navigate</span>}
              {result.isItem && <span style={{ fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>Open</span>}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </>
  );
}
