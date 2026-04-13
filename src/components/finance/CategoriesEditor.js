"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";

// ─── Categories Editor ───────────────────────────────────────────────────────
// Customize transaction categories: rename, recolor, add new, map Plaid → custom.

const DEFAULT_CATS = [
  { id: "INCOME", label: "Income", icon: "💰", color: "#10b981" },
  { id: "TRANSFER_IN", label: "Transfer In", icon: "📥", color: "#3b82f6" },
  { id: "TRANSFER_OUT", label: "Transfer Out", icon: "📤", color: "#6b7280" },
  { id: "LOAN_PAYMENTS", label: "Loan Payment", icon: "🏦", color: "#8b5cf6" },
  { id: "BANK_FEES", label: "Bank Fees", icon: "💸", color: "#ef4444" },
  { id: "ENTERTAINMENT", label: "Entertainment", icon: "🎬", color: "#f59e0b" },
  { id: "FOOD_AND_DRINK", label: "Food & Drink", icon: "🍔", color: "#f97316" },
  { id: "GENERAL_MERCHANDISE", label: "Shopping", icon: "🛍️", color: "#ec4899" },
  { id: "HOME_IMPROVEMENT", label: "Home", icon: "🔨", color: "#a855f7" },
  { id: "MEDICAL", label: "Medical", icon: "🏥", color: "#ef4444" },
  { id: "PERSONAL_CARE", label: "Personal Care", icon: "💇", color: "#14b8a6" },
  { id: "GENERAL_SERVICES", label: "Services", icon: "🔧", color: "#6366f1" },
  { id: "GOVERNMENT_AND_NON_PROFIT", label: "Government", icon: "🏛️", color: "#64748b" },
  { id: "TRANSPORTATION", label: "Transportation", icon: "🚗", color: "#0ea5e9" },
  { id: "TRAVEL", label: "Travel", icon: "✈️", color: "#0284c7" },
  { id: "RENT_AND_UTILITIES", label: "Rent & Utilities", icon: "🏠", color: "#7c3aed" },
  { id: "OTHER", label: "Other", icon: "📦", color: "#94a3b8" },
];

const ICON_OPTIONS = ["💰", "📥", "📤", "🏦", "💸", "🎬", "🍔", "🛍️", "🔨", "🏥", "💇", "🔧", "🏛️", "🚗", "✈️", "🏠", "📦", "☕", "🍕", "🎮", "📱", "💊", "🐾", "👶", "🎓", "💼", "🏋️", "📚", "🎵", "🛒"];

export default function CategoriesEditor({ user }) {
  const [categories, setCategories] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: "", label: "", icon: "📦", color: "#94a3b8" });
  const [saving, setSaving] = useState(false);

  const uid = user?.uid;

  // Load custom categories
  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const ref = collection(db, "users", uid, "finance_categories");
      const snap = await getDocs(query(ref, orderBy("label")));
      if (snap.empty) {
        // Initialize with defaults
        setCategories(DEFAULT_CATS);
      } else {
        setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }
    } catch (e) {
      console.error("Load categories error:", e);
      setCategories(DEFAULT_CATS);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // Save category
  const saveCategory = async (cat) => {
    if (!uid) return;
    setSaving(true);
    try {
      const ref = doc(db, "users", uid, "finance_categories", cat.id);
      await setDoc(ref, { label: cat.label, icon: cat.icon, color: cat.color });
      setEditing(null);
      setShowAdd(false);
      setForm({ id: "", label: "", icon: "📦", color: "#94a3b8" });
      load();
    } catch (e) { console.error("Save category error:", e); }
    setSaving(false);
  };

  // Save all defaults at once (first-time setup)
  const initDefaults = async () => {
    if (!uid) return;
    setSaving(true);
    for (const cat of DEFAULT_CATS) {
      const ref = doc(db, "users", uid, "finance_categories", cat.id);
      await setDoc(ref, { label: cat.label, icon: cat.icon, color: cat.color });
    }
    load();
    setSaving(false);
  };

  // Add custom category
  const addCategory = async () => {
    if (!form.label.trim()) return;
    const id = `CUSTOM_${form.label.trim().toUpperCase().replace(/\s+/g, "_")}`;
    await saveCategory({ id, label: form.label.trim(), icon: form.icon, color: form.color });
  };

  // Delete custom category
  const deleteCategory = async (catId) => {
    if (!uid) return;
    if (DEFAULT_CATS.find(c => c.id === catId)) return; // Can't delete defaults
    await deleteDoc(doc(db, "users", uid, "finance_categories", catId));
    load();
  };

  const isCustom = (catId) => !DEFAULT_CATS.find(c => c.id === catId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Transaction Categories</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {categories.length === DEFAULT_CATS.length && !categories[0]?.savedToFirestore && (
            <button className="btn btn-sm" onClick={initDefaults} disabled={saving} style={{ fontSize: 11 }}>
              Save Defaults to Cloud
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 11 }}>
            + Add Category
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card">
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>New Custom Category</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Name</label>
              <input className="input" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g., Coffee, Groceries..." />
            </div>
            <div style={{ width: 50 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Color</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 40, height: 32, border: "none", cursor: "pointer", background: "transparent" }} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addCategory}>Add</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {ICON_OPTIONS.map(icon => (
              <button key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                style={{
                  width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer",
                  background: form.icon === icon ? "var(--accent)" : "var(--bg-secondary)",
                  fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                }}>{icon}</button>
            ))}
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
            borderRadius: 6, background: "var(--bg-secondary)",
          }}>
            <span style={{ fontSize: 18 }}>{cat.icon}</span>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cat.color, flexShrink: 0 }} />

            {editing === cat.id ? (
              <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
                <input className="input" value={cat.label} style={{ flex: 1 }}
                  onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, label: e.target.value } : c))} />
                <input type="color" value={cat.color} style={{ width: 30, height: 26, border: "none", cursor: "pointer", background: "transparent" }}
                  onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, color: e.target.value } : c))} />
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                  onClick={() => saveCategory(cat)}>Save</button>
                <button className="btn btn-sm" style={{ fontSize: 11 }}
                  onClick={() => { setEditing(null); load(); }}>Cancel</button>
              </div>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.label}</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{cat.id}</span>
                <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setEditing(cat.id)}>Edit</button>
                {isCustom(cat.id) && (
                  <button className="btn btn-sm" style={{ fontSize: 11, color: "#ef4444" }}
                    onClick={() => deleteCategory(cat.id)}>✕</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
