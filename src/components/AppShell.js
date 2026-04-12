"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/theme";
import { getSettings, getActiveModules } from "@/lib/settings";
import { getItems, createItem, updateItem } from "@/lib/projects";
import { syncItemToGoogle } from "@/lib/googleSync";
import ProjectHub from "@/components/projects/ProjectHub";
import SettingsPage from "@/components/SettingsPage";
import GeminiWidget from "@/components/GeminiWidget";

const ICONS = {
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

const PAGE_COMPONENTS = {
  projects: ProjectHub,
  settings: SettingsPage,
};

export default function AppShell() {
  const { user, logout, googleAccessToken } = useAuth();
  const [activePage, setActivePage] = useState("projects");
  const [settings, setSettings] = useState(null);
  const [allItems, setAllItems] = useState([]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const [s, items] = await Promise.all([getSettings(user.uid), getItems(user.uid)]);
    setSettings(s);
    setAllItems(items);
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  // Refresh items periodically for Gemini context
  useEffect(() => {
    const interval = setInterval(() => { if (user) getItems(user.uid).then(setAllItems); }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleGeminiCreate = async (data) => {
    const item = await createItem(user.uid, data);
    if (item && googleAccessToken) {
      syncItemToGoogle(googleAccessToken, item, async (updates) => {
        await updateItem(user.uid, item.id, updates);
      });
    }
    setAllItems(prev => [item, ...prev]);
  };

  const handleGeminiUpdate = async (itemId, updates) => {
    await updateItem(user.uid, itemId, updates);
    setAllItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
  };

  const modules = getActiveModules(settings);

  const renderPage = () => {
    const Component = PAGE_COMPONENTS[activePage];
    if (Component) return <Component />;
    return <ProjectHub />;
  };

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">Antigravity</div>
        <nav className="sidebar-nav">
          {modules.map((mod) => (
            <button
              key={mod.id}
              className={`nav-item ${activePage === mod.id ? "active" : ""}`}
              onClick={() => setActivePage(mod.id)}
            >
              {ICONS[mod.icon] || ICONS.clipboard}
              {mod.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Mobile Bottom Tabs */}
      <nav className="mobile-tabs">
        <div className="mobile-tabs-inner">
          {modules.map((mod) => (
            <button
              key={mod.id}
              className={`tab-item ${activePage === mod.id ? "active" : ""}`}
              onClick={() => setActivePage(mod.id)}
            >
              {ICONS[mod.icon] || ICONS.clipboard}
              <span>{mod.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Gemini AI Widget — global */}
      <GeminiWidget settings={settings} items={allItems} onCreateItem={handleGeminiCreate} onUpdateItem={handleGeminiUpdate} />
    </div>
  );
}
