"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";

// ─── Recurring Bills & Subscriptions ─────────────────────────────────────────
// Auto-detects recurring charges via Plaid + manual entries.

export default function RecurringTab({ user, profileId = "personal" }) {
  const [recurring, setRecurring] = useState([]);
  const [manual, setManual] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", amount: "", frequency: "monthly", category: "OTHER",
    nextDue: "", autoPay: false, type: "bill",
  });

  const uid = user?.uid;

  // Fetch Plaid recurring
  const fetchRecurring = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/finance/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, profileId }),
      });
      const data = await res.json();
      setRecurring(data.recurring || []);
    } catch (e) {
      console.error("Fetch recurring error:", e);
    }

    // Fetch manual entries
    try {
      const ref = collection(db, "users", uid, "finance_profiles", profileId, "recurring_manual");
      const snap = await getDocs(query(ref, orderBy("name")));
      setManual(snap.docs.map(d => ({ id: d.id, ...d.data(), source: "manual" })));
    } catch (e) {
      console.error("Fetch manual recurring:", e);
    }
    setLoading(false);
  }, [uid, profileId]);

  useEffect(() => { fetchRecurring(); }, [fetchRecurring]);

  // Add manual recurring
  const addManual = async () => {
    if (!uid || !form.name.trim() || !form.amount) return;
    const ref = doc(collection(db, "users", uid, "finance_profiles", profileId, "recurring_manual"));
    await setDoc(ref, {
      name: form.name.trim(),
      amount: Number(form.amount),
      frequency: form.frequency,
      category: form.category,
      nextDue: form.nextDue || null,
      autoPay: form.autoPay,
      type: form.type,
      createdAt: new Date().toISOString(),
    });
    setForm({ name: "", amount: "", frequency: "monthly", category: "OTHER", nextDue: "", autoPay: false, type: "bill" });
    setShowAdd(false);
    fetchRecurring();
  };

  // Delete manual
  const deleteManual = async (id) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "finance_profiles", profileId, "recurring_manual", id));
    fetchRecurring();
  };

  // Combine all recurring
  const all = useMemo(() => {
    const plaidItems = recurring.map(r => ({
      id: r.stream_id || r.id,
      name: r.merchant_name || r.description || "Unknown",
      amount: Math.abs(r.average_amount?.amount || r.last_amount?.amount || 0),
      frequency: r.frequency || "monthly",
      category: r.personal_finance_category?.primary || "OTHER",
      nextDue: r.predicted_next_date || null,
      lastDate: r.last_date || null,
      status: r.status || "active",
      source: "plaid",
      isInflow: r.is_inflow_stream || false,
    }));
    return [...plaidItems, ...manual].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [recurring, manual]);

  const monthlyTotal = useMemo(() => {
    return all.filter(r => !r.isInflow).reduce((sum, r) => {
      const mult = r.frequency === "weekly" ? 4.33 : r.frequency === "biweekly" ? 2.17 : r.frequency === "yearly" ? 1/12 : 1;
      return sum + (r.amount * mult);
    }, 0);
  }, [all]);

  const incomeTotal = useMemo(() => {
    return all.filter(r => r.isInflow).reduce((sum, r) => sum + r.amount, 0);
  }, [all]);

  const typeIcon = (type) => {
    const map = { bill: "📄", subscription: "🔄", loan: "🏦", income: "💰", insurance: "🛡️" };
    return map[type] || "📄";
  };

  const freqLabel = (f) => {
    const map = { weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly", yearly: "Yearly" };
    return map[f] || f;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Detecting recurring transactions...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>${monthlyTotal.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Monthly Bills</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>${incomeTotal.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Recurring Income</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{all.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Recurring</div>
        </div>
      </div>

      {/* Add button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          + Add Manual Bill
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add Recurring Item</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Name</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Netflix, Rent, Car Insurance..." />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Amount</label>
                <input className="input" type="number" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="$0.00" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Frequency</label>
                <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="bill">📄 Bill</option>
                  <option value="subscription">🔄 Subscription</option>
                  <option value="loan">🏦 Loan Payment</option>
                  <option value="insurance">🛡️ Insurance</option>
                  <option value="income">💰 Income</option>
                </select>
              </div>
              <div style={{ width: 140 }}>
                <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Next Due</label>
                <input type="date" className="input" value={form.nextDue}
                  onChange={e => setForm(f => ({ ...f, nextDue: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={form.autoPay} onChange={e => setForm(f => ({ ...f, autoPay: e.target.checked }))} />
              Auto-pay enabled
            </label>
            <button className="btn btn-primary btn-sm" onClick={addManual}>Add Recurring Item</button>
          </div>
        </div>
      )}

      {/* Recurring list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {all.map(r => (
          <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: 18 }}>{typeIcon(r.type || (r.isInflow ? "income" : "bill"))}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {freqLabel(r.frequency)}
                  {r.nextDue && ` • Next: ${r.nextDue}`}
                  {r.source === "plaid" && <span className="badge" style={{ marginLeft: 6, background: "rgba(99,102,241,0.15)", color: "#6366f1" }}>Auto-detected</span>}
                  {r.source === "manual" && <span className="badge" style={{ marginLeft: 6, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>Manual</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: r.isInflow ? "#10b981" : "#ef4444" }}>
                {r.isInflow ? "+" : "-"}${r.amount.toFixed(2)}
              </div>
              {r.source === "manual" && (
                <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => deleteManual(r.id)}>✕</button>
              )}
            </div>
          </div>
        ))}

        {all.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Recurring Transactions</div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
              Connect a bank account with transaction history, or add bills manually.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
