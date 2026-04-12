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
import CommandPalette from "@/components/CommandPalette";
import DashboardModule from "@/components/modules/DashboardModule";
import LifeModule from "@/components/modules/LifeModule";
import TimeModule from "@/components/modules/TimeModule";
import PlanningModule from "@/components/modules/PlanningModule";

// All available icons for sidebar modules
const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  ),
  life: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  planning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

// Map module IDs to their page components
const PAGE_COMPONENTS = {
  dashboard: DashboardModule,
  projects: ProjectHub,
  life: LifeModule,
  time: TimeModule,
  planning: PlanningModule,
  settings: SettingsPage,
};

export default function AppShell() {
  const { user, logout, googleAccessToken } = useAuth();
  const { theme, setTheme, preference } = useTheme();
  const [activePage, _setActivePage] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    try { return localStorage.getItem("hub_active_page") || "dashboard"; } catch { return "dashboard"; }
  });
  const setActivePage = (page) => {
    _setActivePage(page);
    try { localStorage.setItem("hub_active_page", page); } catch {}
  };
  const [settings, setSettings] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const [s, items] = await Promise.all([getSettings(user.uid), getItems(user.uid)]);
    setSettings(s);
    setAllItems(items);
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => {
    const interval = setInterval(() => { if (user) getItems(user.uid).then(setAllItems); }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // CMD+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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

  const handleCommandNavigate = (viewId) => {
    // Check if it's a module-level nav or a project sub-view
    const moduleIds = ["dashboard", "projects", "life", "time", "planning", "settings"];
    if (moduleIds.includes(viewId)) {
      setActivePage(viewId);
    } else {
      // It's a project sub-view (board, table, timeline, calendar)
      setActivePage("projects");
      window.dispatchEvent(new CustomEvent("navigate-view", { detail: viewId }));
    }
  };

  const modules = getActiveModules(settings);
  const cycleTheme = () => {
    const order = ["system", "light", "dark"];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setTheme(next);
  };
  const themeIcon = preference === "dark" ? "🌙" : preference === "light" ? "☀️" : "🖥";

  const handleModuleClick = (mod) => {
    if (mod.id === "search") {
      setCommandOpen(true);
      return;
    }
    setActivePage(mod.id);
  };

  const renderPage = () => {
    const Component = PAGE_COMPONENTS[activePage];
    if (Component) return <Component />;
    return <DashboardModule />;
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
              className={`nav-item ${activePage === mod.id ? "active" : ""} ${mod.id === "search" && commandOpen ? "active" : ""}`}
              onClick={() => handleModuleClick(mod)}
            >
              {ICONS[mod.icon] || ICONS.clipboard}
              {mod.label}
              {mod.id === "search" && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-tertiary)", background: "var(--bg-secondary)", padding: "1px 5px", borderRadius: 4 }}>⌘K</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={cycleTheme} title={`Theme: ${preference}`}>
            <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{themeIcon}</span>
            {preference === "system" ? "System" : preference === "dark" ? "Dark" : "Light"}
          </button>
          <button className="nav-item" onClick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <button className="mobile-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
        <span className="mobile-topbar-title">Antigravity</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="mobile-hamburger" onClick={() => setCommandOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button className="mobile-hamburger" onClick={cycleTheme}>
            <span style={{ fontSize: 16 }}>{themeIcon}</span>
          </button>
        </div>
      </div>

      {/* Mobile Slide Menu */}
      {mobileMenuOpen && (
        <>
          <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400 }} />
          <div style={{
            position: "fixed", left: 0, top: 0, bottom: 0, width: 260,
            background: "var(--bg-primary)", zIndex: 401, padding: "20px 12px",
            borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, padding: "0 8px 16px", borderBottom: "1px solid var(--border)", marginBottom: 12 }}>Antigravity</div>
            {modules.map((mod) => (
              <button
                key={mod.id}
                className={`nav-item ${activePage === mod.id ? "active" : ""}`}
                onClick={() => { handleModuleClick(mod); setMobileMenuOpen(false); }}
                style={{ justifyContent: "flex-start", width: "100%", textAlign: "left", padding: "10px 12px" }}
              >
                {ICONS[mod.icon] || ICONS.clipboard}
                {mod.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button className="nav-item" onClick={cycleTheme} style={{ padding: "10px 12px" }}>
              <span style={{ fontSize: 16 }}>{themeIcon}</span> Theme: {preference}
            </button>
            <button className="nav-item" onClick={logout} style={{ padding: "10px 12px" }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Mobile Bottom Tabs — show first 5 modules */}
      <nav className="mobile-tabs">
        <div className="mobile-tabs-inner">
          {modules.filter(m => m.id !== "search" && m.id !== "settings").slice(0, 5).map((mod) => (
            <button
              key={mod.id}
              className={`tab-item ${activePage === mod.id ? "active" : ""}`}
              onClick={() => handleModuleClick(mod)}
            >
              {ICONS[mod.icon] || ICONS.clipboard}
              <span>{mod.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* CMD+K Command Palette */}
      {commandOpen && (
        <CommandPalette
          items={allItems}
          onSelect={(item) => { setActivePage("projects"); }}
          onNavigate={handleCommandNavigate}
          onClose={() => setCommandOpen(false)}
        />
      )}

      {/* Gemini AI Widget — global */}
      <GeminiWidget settings={settings} items={allItems} onCreateItem={handleGeminiCreate} onUpdateItem={handleGeminiUpdate} />
    </div>
  );
}
