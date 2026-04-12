"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem } from "@/lib/projects";
import { getHabits } from "@/lib/habits";
import HabitTracker from "@/components/projects/HabitTracker";
import GoalsView from "@/components/projects/GoalsView";

const TABS = [
  { id: "habits", label: "🔄 Habits" },
  { id: "goals", label: "🎯 Goals" },
  { id: "journal", label: "📓 Journal" },
];

export default function LifeModule() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("habits");
  const [items, setItems] = useState([]);
  const [journalEntry, setJournalEntry] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getItems(user.uid);
    setItems(data);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const journals = items.filter(i => i.type === "journal").sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));

  const handleAddJournal = async () => {
    if (!journalEntry.trim() || !user) return;
    const entry = {
      type: "journal",
      title: journalEntry.trim().slice(0, 60),
      description: journalEntry.trim(),
      date: new Date().toISOString().split("T")[0],
      status: "done",
      priority: "low",
    };
    await createItem(user.uid, entry);
    setJournalEntry("");
    loadData();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 0" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Life</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Habits, goals, and reflections</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, padding: "0 32px", borderBottom: "1px solid var(--border)" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            border: "none", background: "none",
            color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
            borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
            transition: "all 0.15s",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px 32px" }}>
        {activeTab === "habits" && <HabitTracker />}
        {activeTab === "goals" && <GoalsView items={items} />}
        {activeTab === "journal" && (
          <div>
            {/* New entry */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>New Entry</h3>
              <textarea
                value={journalEntry} onChange={(e) => setJournalEntry(e.target.value)}
                placeholder="What's on your mind today?"
                rows={3} style={{ fontSize: 13, resize: "vertical", marginBottom: 8 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddJournal} disabled={!journalEntry.trim()}>Save Entry</button>
            </div>

            {/* Past entries */}
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Past Entries</h3>
            {journals.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No journal entries yet. Start writing above!</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {journals.map(j => (
                <div key={j.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{j.title}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{j.date || j.createdAt?.split("T")[0]}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{j.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
