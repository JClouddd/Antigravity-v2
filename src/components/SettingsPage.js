"use client";

import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/theme";
import { useState, useEffect, useCallback } from "react";
import { getSettings, saveSettings } from "@/lib/settings";

export default function SettingsPage() {
  const { user, googleAccessToken, isTokenFresh, refreshGoogleToken, logout } = useAuth();
  const { theme, preference, setTheme, themes } = useTheme();
  const [settings, setSettings] = useState(null);
  const [modules, setModules] = useState([]);
  const [views, setViews] = useState([]);
  const [geminiKey, setGeminiKey] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragType, setDragType] = useState(null); // "modules" or "views"
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const s = await getSettings(user.uid);
    setSettings(s);
    setModules(s.modules || []);
    setViews(s.views || []);
    setGeminiKey(s.geminiApiKey || "");
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    await saveSettings(user.uid, { ...settings, modules, views, geminiApiKey: geminiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRename = (arr, setArr, idx, label) => {
    const u = [...arr]; u[idx] = { ...u[idx], label }; setArr(u);
  };
  const handleToggle = (arr, setArr, idx) => {
    const u = [...arr]; u[idx] = { ...u[idx], enabled: !u[idx].enabled }; setArr(u);
  };
  const handleDragStart = (type, idx) => { setDragType(type); setDragIdx(idx); };
  const handleDragOver = (e, type, arr, setArr, idx) => {
    e.preventDefault();
    if (dragType !== type || dragIdx === null || dragIdx === idx) return;
    const u = [...arr]; const [moved] = u.splice(dragIdx, 1); u.splice(idx, 0, moved);
    setArr(u); setDragIdx(idx);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragType(null); };

  const DraggableList = ({ items, setItems, type }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item, idx) => (
        <div key={item.id} draggable onDragStart={() => handleDragStart(type, idx)}
          onDragOver={(e) => handleDragOver(e, type, items, setItems, idx)} onDragEnd={handleDragEnd}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
            background: dragType === type && dragIdx === idx ? "var(--accent-light)" : "var(--bg-secondary)",
            borderRadius: "var(--radius-sm)", cursor: "grab", opacity: item.enabled ? 1 : 0.5,
          }}>
          <span style={{ color: "var(--text-tertiary)", cursor: "grab", fontSize: 14 }}>⠿</span>
          <button onClick={() => handleToggle(items, setItems, idx)} style={{
            width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: "pointer",
            border: item.enabled ? "none" : "2px solid var(--border)",
            background: item.enabled ? "var(--accent)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {item.enabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
          </button>
          <input type="text" value={item.label} onChange={(e) => handleRename(items, setItems, idx, e.target.value)}
            style={{ flex: 1, fontSize: 13, fontWeight: 500, padding: "4px 6px", border: "1px solid transparent", borderRadius: 4, background: "transparent" }}
            onFocus={(e) => e.target.style.borderColor = "var(--border)"} onBlur={(e) => e.target.style.borderColor = "transparent"} />
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{item.id}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Settings</h1>
            <p>System configuration, modules, and connected services.</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

          {/* Theme */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Appearance</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {themes.map((t) => (
                <button key={t} className={`btn btn-sm ${preference === t ? "btn-primary" : ""}`}
                  onClick={() => setTheme(t)} style={{ textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Modules (sidebar navigation) */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Modules</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Drag to reorder, click name to rename, toggle to show/hide in sidebar.
            </p>
            <DraggableList items={modules} setItems={setModules} type="modules" />
          </div>

          {/* Views (project sub-tabs) */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Project Views</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Configure project sub-tabs. Drag to reorder, rename, or toggle.
            </p>
            <DraggableList items={views} setItems={setViews} type="views" />
          </div>

          {/* API Keys */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>API Keys</h3>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                Gemini API Key
              </label>
              <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter your Gemini API key..." style={{ fontSize: 13 }} />
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                Powers the AI assistant widget. Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>AI Studio</a>.
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Account</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {user?.photoURL && <img src={user.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.displayName || "User"}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user?.email}</div>
              </div>
            </div>
            <button className="btn btn-sm" onClick={logout}>Sign Out</button>
          </div>

          {/* Connected Services */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Connected Services</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Google Calendar</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bidirectional event sync</div>
                </div>
                <span className={`badge ${googleAccessToken && isTokenFresh() ? "badge-success" : "badge-warning"}`}>
                  {googleAccessToken && isTokenFresh() ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Google Tasks</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bidirectional task sync</div>
                </div>
                <span className={`badge ${googleAccessToken && isTokenFresh() ? "badge-success" : "badge-warning"}`}>
                  {googleAccessToken && isTokenFresh() ? "Connected" : "Disconnected"}
                </span>
              </div>
              {!(googleAccessToken && isTokenFresh()) && (
                <div style={{ padding: 12, background: "var(--warning-light)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--warning)" }}>
                  ⚠️ Google connection expired. Reconnect to enable Calendar & Tasks sync.
                </div>
              )}
              <button className="btn btn-sm btn-primary" onClick={refreshGoogleToken} style={{ alignSelf: "flex-start" }}>
                {googleAccessToken && isTokenFresh() ? "Reconnect Google (re-auth)" : "Connect Google"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
