"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems } from "@/lib/projects";
import TimeDashboard from "@/components/projects/TimeDashboard";

export default function TimeModule() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getItems(user.uid);
    setItems(data);
    // Collect all time entries from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("time_entries") || "[]");
      setTimeEntries(stored);
    } catch { setTimeEntries([]); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 32px 0" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Time</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Track and analyze how you spend your time</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 32px" }}>
        <TimeDashboard items={items} timeEntries={timeEntries} />
      </div>
    </div>
  );
}
