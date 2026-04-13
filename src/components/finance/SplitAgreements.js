"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";

// ─── Split Agreements Tab ────────────────────────────────────────────────────
// Manages date-bounded split periods where transactions can be assigned
// with flexible per-transaction splitting (percentage or exact dollar amount).

export default function SplitAgreements({ user, transactions = [] }) {
  const [agreements, setAgreements] = useState([]);
  const [activeAgreement, setActiveAgreement] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(null); // txn being assigned
  const [loading, setLoading] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [form, setForm] = useState({ name: "", participants: [{ name: "", pct: 50 }] });
  const [periodForm, setPeriodForm] = useState({ start: "", end: "", note: "" });
  const [assignForm, setAssignForm] = useState({ mode: "percentage", pct: 50, amount: 0, note: "" });

  const uid = user?.uid;

  // ─── Load Agreements ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "split_agreements");
      const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
      const items = [];
      for (const d of snap.docs) {
        const agr = { id: d.id, ...d.data() };
        // Load periods
        const pRef = collection(db, "users", uid, "split_agreements", d.id, "periods");
        const pSnap = await getDocs(query(pRef, orderBy("start", "desc")));
        agr.periods = pSnap.docs.map(p => ({ id: p.id, ...p.data() }));
        // Load transaction assignments
        const tRef = collection(db, "users", uid, "split_agreements", d.id, "assignments");
        const tSnap = await getDocs(tRef);
        agr.assignments = tSnap.docs.map(t => ({ id: t.id, ...t.data() }));
        items.push(agr);
      }
      setAgreements(items);
      if (items.length > 0 && !activeAgreement) setActiveAgreement(items[0].id);
    } catch (e) { console.error("Load splits error:", e); }
    setLoading(false);
  }, [uid, activeAgreement]);

  useEffect(() => { load(); }, [load]);

  // ─── Create Agreement ────────────────────────────────────────────────────
  const createAgreement = async () => {
    if (!uid || !form.name.trim()) return;
    const ref = doc(collection(db, "users", uid, "split_agreements"));
    await setDoc(ref, {
      name: form.name.trim(),
      participants: [
        { name: "Me", pct: 100 - form.participants[0].pct },
        { name: form.participants[0].name || "Partner", pct: form.participants[0].pct },
      ],
      createdAt: new Date().toISOString(),
      status: "active",
    });
    setForm({ name: "", participants: [{ name: "", pct: 50 }] });
    setShowCreate(false);
    setActiveAgreement(ref.id);
    load();
  };

  // ─── Add Period ──────────────────────────────────────────────────────────
  const addPeriod = async (agrId) => {
    if (!uid || !periodForm.start) return;
    const ref = doc(collection(db, "users", uid, "split_agreements", agrId, "periods"));
    await setDoc(ref, {
      start: periodForm.start,
      end: periodForm.end || null,
      note: periodForm.note || "",
      status: periodForm.end ? "closed" : "active",
      createdAt: new Date().toISOString(),
    });
    setPeriodForm({ start: "", end: "", note: "" });
    load();
  };

  // ─── Close/Edit Period ───────────────────────────────────────────────────
  const closePeriod = async (agrId, periodId, endDate) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "split_agreements", agrId, "periods", periodId);
    await updateDoc(ref, { end: endDate || new Date().toISOString().split("T")[0], status: "closed" });
    load();
  };

  const updatePeriod = async (agrId, periodId, updates) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "split_agreements", agrId, "periods", periodId);
    await updateDoc(ref, updates);
    setEditingPeriod(null);
    load();
  };

  const deletePeriod = async (agrId, periodId) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "split_agreements", agrId, "periods", periodId));
    load();
  };

  // ─── Assign Transaction ─────────────────────────────────────────────────
  const assignTransaction = async (agrId, txn) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "split_agreements", agrId, "assignments", txn.id || txn.transaction_id);
    const agr = agreements.find(a => a.id === agrId);
    const otherPct = assignForm.mode === "percentage" ? assignForm.pct : null;
    const otherAmt = assignForm.mode === "amount" ? assignForm.amount : null;

    await setDoc(ref, {
      transactionId: txn.id || txn.transaction_id,
      name: txn.merchant || txn.name,
      amount: txn.amount,
      date: txn.date,
      category: txn.category || "OTHER",
      splitMode: assignForm.mode,
      splitPct: otherPct,
      splitAmount: otherAmt,
      myShare: assignForm.mode === "percentage"
        ? txn.amount * ((100 - (otherPct || 50)) / 100)
        : txn.amount - (otherAmt || 0),
      otherShare: assignForm.mode === "percentage"
        ? txn.amount * ((otherPct || 50) / 100)
        : (otherAmt || 0),
      note: assignForm.note || "",
      assignedAt: new Date().toISOString(),
    });
    setShowAssign(null);
    setAssignForm({ mode: "percentage", pct: 50, amount: 0, note: "" });
    load();
  };

  // ─── Remove Assignment ───────────────────────────────────────────────────
  const removeAssignment = async (agrId, assignId) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "split_agreements", agrId, "assignments", assignId));
    load();
  };

  // ─── Delete Agreement ────────────────────────────────────────────────────
  const deleteAgreement = async (agrId) => {
    if (!uid || !confirm("Delete this split agreement and all its periods?")) return;
    await deleteDoc(doc(db, "users", uid, "split_agreements", agrId));
    setActiveAgreement(null);
    load();
  };

  // ─── Current Agreement ───────────────────────────────────────────────────
  const current = useMemo(() => agreements.find(a => a.id === activeAgreement), [agreements, activeAgreement]);
  const activePeriod = useMemo(() => current?.periods?.find(p => p.status === "active"), [current]);

  // Transactions in active period date range
  const periodTxns = useMemo(() => {
    if (!activePeriod) return [];
    return transactions.filter(t => {
      if (!t.date) return false;
      if (t.date < activePeriod.start) return false;
      if (activePeriod.end && t.date > activePeriod.end) return false;
      return true;
    });
  }, [transactions, activePeriod]);

  // Split totals for current agreement
  const splitTotals = useMemo(() => {
    if (!current?.assignments?.length) return { myTotal: 0, otherTotal: 0, count: 0 };
    return current.assignments.reduce((acc, a) => ({
      myTotal: acc.myTotal + (a.myShare || 0),
      otherTotal: acc.otherTotal + (a.otherShare || 0),
      count: acc.count + 1,
    }), { myTotal: 0, otherTotal: 0, count: 0 });
  }, [current]);

  const assignedIds = useMemo(() => new Set(current?.assignments?.map(a => a.transactionId) || []), [current]);

  // ─── Render ────────────────────────────────────────────────────────────
  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading split agreements...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Agreement selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {agreements.map(a => (
          <button key={a.id} onClick={() => setActiveAgreement(a.id)}
            className={activeAgreement === a.id ? "btn btn-primary btn-sm" : "btn btn-sm"}
            style={{ fontSize: 12 }}>
            {a.name}
          </button>
        ))}
        <button className="btn btn-sm" style={{ borderStyle: "dashed" }} onClick={() => setShowCreate(!showCreate)}>
          + New Agreement
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>New Split Agreement</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Agreement Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder='e.g., "Apartment with Partner"' />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Other Person&apos;s Name</label>
                <input className="input" value={form.participants[0].name}
                  onChange={e => setForm(f => ({ ...f, participants: [{ ...f.participants[0], name: e.target.value }] }))}
                  placeholder="Partner, Roommate, etc." />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Their Default %</label>
                <input className="input" type="number" min={1} max={99}
                  value={form.participants[0].pct}
                  onChange={e => setForm(f => ({ ...f, participants: [{ ...f.participants[0], pct: Number(e.target.value) }] }))} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={createAgreement} disabled={!form.name.trim()}>
              Create Agreement
            </button>
          </div>
        </div>
      )}

      {/* No agreements state */}
      {agreements.length === 0 && !showCreate && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Split Agreements</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 13, marginBottom: 12 }}>
            Create a split agreement to track shared expenses with a partner, roommate, or anyone.
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Split Agreement</button>
        </div>
      )}

      {/* Active Agreement Detail */}
      {current && (
        <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div className="card">
              <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981" }}>${splitTotals.myTotal.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>My Share</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>${splitTotals.otherTotal.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                {current.participants?.[1]?.name || "Other"}&apos;s Share
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{splitTotals.count}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Transactions Split</div>
            </div>
          </div>

          {/* Periods */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Periods</h3>
              <button className="btn btn-sm" onClick={() => setEditingPeriod("new")}>+ Add Period</button>
            </div>

            {editingPeriod === "new" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Start Date</label>
                  <input type="date" className="input" value={periodForm.start}
                    onChange={e => setPeriodForm(f => ({ ...f, start: e.target.value }))} style={{ width: 150 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>End Date (empty = ongoing)</label>
                  <input type="date" className="input" value={periodForm.end}
                    onChange={e => setPeriodForm(f => ({ ...f, end: e.target.value }))} style={{ width: 150 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Note</label>
                  <input className="input" value={periodForm.note}
                    onChange={e => setPeriodForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional note..." />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => addPeriod(current.id)}>Add</button>
                <button className="btn btn-sm" onClick={() => setEditingPeriod(null)}>Cancel</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(current.periods || []).map(p => (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 6,
                  background: p.status === "active" ? "rgba(16,185,129,0.08)" : "var(--bg-secondary)",
                  border: p.status === "active" ? "1px solid rgba(16,185,129,0.25)" : "1px solid transparent",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: p.status === "active" ? "#10b981" : "var(--text-tertiary)",
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {p.start} → {p.end || "Ongoing"}
                    </span>
                    {p.note && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>({p.note})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {p.status === "active" && (
                      <button className="btn btn-sm" style={{ fontSize: 11 }}
                        onClick={() => closePeriod(current.id, p.id, new Date().toISOString().split("T")[0])}>
                        Close
                      </button>
                    )}
                    <button className="btn btn-sm" style={{ fontSize: 11 }}
                      onClick={() => deletePeriod(current.id, p.id)}>✕</button>
                  </div>
                </div>
              ))}
              {(current.periods || []).length === 0 && (
                <div style={{ textAlign: "center", padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>
                  No periods yet. Add a date range to start splitting transactions.
                </div>
              )}
            </div>
          </div>

          {/* Assigned Transactions */}
          {current.assignments?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                Split Transactions ({current.assignments.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {current.assignments.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(a => (
                  <div key={a.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", borderRadius: 6, background: "var(--bg-secondary)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {a.date} • {a.splitMode === "percentage" ? `${100 - (a.splitPct || 50)}% / ${a.splitPct || 50}%` : `$${(a.amount - (a.splitAmount || 0)).toFixed(2)} / $${(a.splitAmount || 0).toFixed(2)}`}
                        {a.note && ` • ${a.note}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#10b981" }}>Me: ${(a.myShare || 0).toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: "#3b82f6" }}>{current.participants?.[1]?.name || "Other"}: ${(a.otherShare || 0).toFixed(2)}</div>
                      </div>
                      <button className="btn btn-sm" style={{ fontSize: 11 }}
                        onClick={() => removeAssignment(current.id, a.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Transactions to Assign */}
          {activePeriod && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                Transactions in Active Period ({activePeriod.start} → {activePeriod.end || "Now"})
              </h3>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10 }}>
                Click &quot;Split&quot; on any transaction to assign it to this agreement.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {periodTxns.filter(t => t.amount > 0).map(t => {
                  const txnId = t.id || t.transaction_id;
                  const isAssigned = assignedIds.has(txnId);
                  return (
                    <div key={txnId} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 6,
                      background: isAssigned ? "rgba(16,185,129,0.06)" : "var(--bg-secondary)",
                      opacity: isAssigned ? 0.6 : 1,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.merchant || t.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.date} • {t.category || "OTHER"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>${t.amount.toFixed(2)}</div>
                        {isAssigned ? (
                          <span className="badge" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>Split ✓</span>
                        ) : (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                            onClick={() => { setShowAssign(t); setAssignForm({ mode: "percentage", pct: current.participants?.[1]?.pct || 50, amount: 0, note: "" }); }}>
                            Split
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {periodTxns.filter(t => t.amount > 0).length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)", fontSize: 12 }}>
                    No transactions in this date range yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assignment Modal */}
          {showAssign && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
              display: "flex", alignItems: "center", justifyContent: "center",
            }} onClick={() => setShowAssign(null)}>
              <div className="card" style={{ width: 400, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Split Transaction</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                  {showAssign.merchant || showAssign.name} — <strong>${showAssign.amount.toFixed(2)}</strong>
                </p>

                {/* Mode toggle */}
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  <button className={assignForm.mode === "percentage" ? "btn btn-primary btn-sm" : "btn btn-sm"}
                    onClick={() => setAssignForm(f => ({ ...f, mode: "percentage" }))}>
                    By Percentage
                  </button>
                  <button className={assignForm.mode === "amount" ? "btn btn-primary btn-sm" : "btn btn-sm"}
                    onClick={() => setAssignForm(f => ({ ...f, mode: "amount" }))}>
                    By Amount
                  </button>
                </div>

                {assignForm.mode === "percentage" ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                      {current.participants?.[1]?.name || "Other"}&apos;s Percentage
                    </label>
                    <input type="range" min={1} max={99} value={assignForm.pct}
                      onChange={e => setAssignForm(f => ({ ...f, pct: Number(e.target.value) }))}
                      style={{ width: "100%", marginBottom: 4 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>Me: <strong>{100 - assignForm.pct}%</strong> (${(showAssign.amount * (100 - assignForm.pct) / 100).toFixed(2)})</span>
                      <span>{current.participants?.[1]?.name || "Other"}: <strong>{assignForm.pct}%</strong> (${(showAssign.amount * assignForm.pct / 100).toFixed(2)})</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                      {current.participants?.[1]?.name || "Other"}&apos;s Exact Amount
                    </label>
                    <input type="number" className="input" step="0.01" min={0} max={showAssign.amount}
                      value={assignForm.amount}
                      onChange={e => setAssignForm(f => ({ ...f, amount: Number(e.target.value) }))} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                      <span>Me: <strong>${(showAssign.amount - assignForm.amount).toFixed(2)}</strong></span>
                      <span>{current.participants?.[1]?.name || "Other"}: <strong>${assignForm.amount.toFixed(2)}</strong></span>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Note (optional)</label>
                  <input className="input" value={assignForm.note} onChange={e => setAssignForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g., My portion of rent" />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => assignTransaction(current.id, showAssign)}>
                    Assign Split
                  </button>
                  <button className="btn" onClick={() => setShowAssign(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-sm" style={{ color: "#ef4444", fontSize: 11 }}
              onClick={() => deleteAgreement(current.id)}>
              🗑️ Delete Agreement
            </button>
          </div>
        </>
      )}
    </div>
  );
}
