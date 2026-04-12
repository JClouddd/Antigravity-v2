"use client";

import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/theme";
import { useState } from "react";

export default function SettingsPage() {
  const { user, googleAccessToken, isTokenFresh, refreshGoogleToken, logout } = useAuth();
  const { theme, preference, setTheme, themes } = useTheme();

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <p>System configuration and connected services.</p>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

          {/* Theme */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Appearance</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {themes.map((t) => (
                <button
                  key={t}
                  className={`btn btn-sm ${preference === t ? "btn-primary" : ""}`}
                  onClick={() => setTheme(t)}
                  style={{ textTransform: "capitalize" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Account</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: "50%" }}
                />
              )}
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
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sync events with projects</div>
                </div>
                <span className={`badge ${googleAccessToken && isTokenFresh() ? "badge-success" : "badge-warning"}`}>
                  {googleAccessToken && isTokenFresh() ? "Connected" : "Expired"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Google Tasks</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sync tasks bidirectionally</div>
                </div>
                <span className={`badge ${googleAccessToken && isTokenFresh() ? "badge-success" : "badge-warning"}`}>
                  {googleAccessToken && isTokenFresh() ? "Connected" : "Expired"}
                </span>
              </div>
              {!(googleAccessToken && isTokenFresh()) && (
                <button className="btn btn-sm btn-primary" onClick={refreshGoogleToken} style={{ marginTop: 4, alignSelf: "flex-start" }}>
                  Reconnect Google
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
