"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit } from "firebase/firestore";

// ─── Net Worth Tracker ───────────────────────────────────────────────────────
// Aggregates all assets and liabilities with historical snapshots.

const ASSET_TYPES = [
  { id: "bank", label: "Bank Accounts", icon: "🏦", auto: true },
  { id: "investment", label: "Investments", icon: "📈", auto: true },
  { id: "crypto", label: "Crypto", icon: "₿", auto: true },
  { id: "real_estate", label: "Real Estate", icon: "🏠", auto: false },
  { id: "vehicle", label: "Vehicles", icon: "🚗", auto: false },
  { id: "other_asset", label: "Other Assets", icon: "💎", auto: false },
];

const LIABILITY_TYPES = [
  { id: "credit_card", label: "Credit Cards", icon: "💳", auto: true },
  { id: "student_loan", label: "Student Loans", icon: "🎓", auto: true },
  { id: "mortgage", label: "Mortgage", icon: "🏡", auto: true },
  { id: "auto_loan", label: "Auto Loan", icon: "🚙", auto: false },
  { id: "personal_loan", label: "Personal Loan", icon: "📝", auto: false },
  { id: "other_liability", label: "Other", icon: "📋", auto: false },
];

export default function NetWorthTab({ user, accounts = [], profileId = "personal" }) {
  const [manualAssets, setManualAssets] = useState([]);
  const [manualLiabilities, setManualLiabilities] = useState([]);
  const [creditScores, setCreditScores] = useState([]);
  const [history, setHistory] = useState([]);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);
  const [showAddScore, setShowAddScore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [assetForm, setAssetForm] = useState({ name: "", value: "", type: "real_estate", note: "" });
  const [liabForm, setLiabForm] = useState({ name: "", balance: "", rate: "", type: "personal_loan", note: "" });
  const [scoreForm, setScoreForm] = useState({ score: "", date: new Date().toISOString().split("T")[0], source: "Credit Karma", note: "" });

  const uid = user?.uid;

  // Load data
  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // Manual assets
      const aSnap = await getDocs(query(collection(db, "users", uid, "finance_profiles", profileId, "manual_assets"), orderBy("name")));
      setManualAssets(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Manual liabilities
      const lSnap = await getDocs(query(collection(db, "users", uid, "finance_profiles", profileId, "manual_liabilities"), orderBy("name")));
      setManualLiabilities(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Credit scores
      const cSnap = await getDocs(query(collection(db, "users", uid, "finance_profiles", profileId, "credit_scores"), orderBy("date", "desc")));
      setCreditScores(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Net worth history
      const hSnap = await getDocs(query(collection(db, "users", uid, "finance_profiles", profileId, "net_worth_history"), orderBy("date", "desc"), limit(24)));
      setHistory(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Load net worth error:", e); }
    setLoading(false);
  }, [uid, profileId]);

  useEffect(() => { load(); }, [load]);

  // Add manual asset
  const addAsset = async () => {
    if (!uid || !assetForm.name || !assetForm.value) return;
    const ref = doc(collection(db, "users", uid, "finance_profiles", profileId, "manual_assets"));
    await setDoc(ref, {
      name: assetForm.name, value: Number(assetForm.value),
      type: assetForm.type, note: assetForm.note,
      updatedAt: new Date().toISOString(),
    });
    setAssetForm({ name: "", value: "", type: "real_estate", note: "" });
    setShowAddAsset(false);
    load();
  };

  // Add manual liability
  const addLiability = async () => {
    if (!uid || !liabForm.name || !liabForm.balance) return;
    const ref = doc(collection(db, "users", uid, "finance_profiles", profileId, "manual_liabilities"));
    await setDoc(ref, {
      name: liabForm.name, balance: Number(liabForm.balance),
      rate: liabForm.rate ? Number(liabForm.rate) : null,
      type: liabForm.type, note: liabForm.note,
      updatedAt: new Date().toISOString(),
    });
    setLiabForm({ name: "", balance: "", rate: "", type: "personal_loan", note: "" });
    setShowAddLiability(false);
    load();
  };

  // Add credit score
  const addCreditScore = async () => {
    if (!uid || !scoreForm.score) return;
    const ref = doc(collection(db, "users", uid, "finance_profiles", profileId, "credit_scores"));
    await setDoc(ref, {
      score: Number(scoreForm.score), date: scoreForm.date,
      source: scoreForm.source, note: scoreForm.note,
      createdAt: new Date().toISOString(),
    });
    setScoreForm({ score: "", date: new Date().toISOString().split("T")[0], source: "Credit Karma", note: "" });
    setShowAddScore(false);
    load();
  };

  // Save snapshot
  const saveSnapshot = async () => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "finance_profiles", profileId, "net_worth_history", new Date().toISOString().split("T")[0]);
    await setDoc(ref, {
      date: new Date().toISOString().split("T")[0],
      totalAssets, totalLiabilities, netWorth,
      breakdown: { bankAssets, manualAssetTotal, manualLiabTotal },
    });
    load();
  };

  // Delete helpers
  const deleteAsset = async (id) => { if (uid) { await deleteDoc(doc(db, "users", uid, "finance_profiles", profileId, "manual_assets", id)); load(); } };
  const deleteLiability = async (id) => { if (uid) { await deleteDoc(doc(db, "users", uid, "finance_profiles", profileId, "manual_liabilities", id)); load(); } };
  const deleteScore = async (id) => { if (uid) { await deleteDoc(doc(db, "users", uid, "finance_profiles", profileId, "credit_scores", id)); load(); } };

  // ─── Computed Values ──────────────────────────────────────────────────────
  const bankAssets = useMemo(() => accounts.reduce((s, a) => s + (a.balanceCurrent || 0), 0), [accounts]);
  const manualAssetTotal = useMemo(() => manualAssets.reduce((s, a) => s + (a.value || 0), 0), [manualAssets]);
  const manualLiabTotal = useMemo(() => manualLiabilities.reduce((s, l) => s + (l.balance || 0), 0), [manualLiabilities]);

  const totalAssets = bankAssets + manualAssetTotal;
  const totalLiabilities = manualLiabTotal; // Will add Plaid liabilities in Phase 2
  const netWorth = totalAssets - totalLiabilities;

  const latestScore = creditScores[0];

  const scoreColor = (score) => {
    if (score >= 750) return "#10b981";
    if (score >= 700) return "#3b82f6";
    if (score >= 650) return "#f59e0b";
    return "#ef4444";
  };

  const scoreLabel = (score) => {
    if (score >= 800) return "Excellent";
    if (score >= 740) return "Very Good";
    if (score >= 670) return "Good";
    if (score >= 580) return "Fair";
    return "Poor";
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading net worth data...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Big Number */}
      <div className="card" style={{ textAlign: "center", padding: "24px 20px" }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Net Worth</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: netWorth >= 0 ? "#10b981" : "#ef4444" }}>
          {netWorth >= 0 ? "" : "-"}${Math.abs(netWorth).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8, fontSize: 13 }}>
          <span>Assets: <strong style={{ color: "#10b981" }}>${totalAssets.toLocaleString()}</strong></span>
          <span>Liabilities: <strong style={{ color: "#ef4444" }}>${totalLiabilities.toLocaleString()}</strong></span>
        </div>
        <button className="btn btn-sm" style={{ marginTop: 10, fontSize: 11 }} onClick={saveSnapshot}>
          📸 Save Monthly Snapshot
        </button>
      </div>

      {/* History Chart (simple text for now) */}
      {history.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Net Worth History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.slice(0, 12).map(h => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{h.date}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: (h.netWorth || 0) >= 0 ? "#10b981" : "#ef4444" }}>
                  ${(h.netWorth || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Assets</h3>
          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddAsset(!showAddAsset)}>+ Add Asset</button>
        </div>

        {showAddAsset && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Name</label>
              <input className="input" value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Home, Car, etc." />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Value</label>
              <input className="input" type="number" value={assetForm.value} onChange={e => setAssetForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Type</label>
              <select className="input" value={assetForm.type} onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}>
                {ASSET_TYPES.filter(t => !t.auto).map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addAsset}>Add</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Auto assets (bank) */}
          {accounts.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>🏦</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Bank Accounts ({accounts.length})</span>
                <span className="badge" style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1" }}>Auto</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>${bankAssets.toLocaleString()}</span>
            </div>
          )}

          {/* Manual assets */}
          {manualAssets.map(a => {
            const type = ASSET_TYPES.find(t => t.id === a.type) || ASSET_TYPES[5];
            return (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{type.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                  {a.note && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>({a.note})</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>${(a.value || 0).toLocaleString()}</span>
                  <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => deleteAsset(a.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liabilities */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Liabilities</h3>
          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddLiability(!showAddLiability)}>+ Add Liability</button>
        </div>

        {showAddLiability && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Name</label>
              <input className="input" value={liabForm.name} onChange={e => setLiabForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Car Loan, Student Loan..." />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Balance</label>
              <input className="input" type="number" value={liabForm.balance} onChange={e => setLiabForm(f => ({ ...f, balance: e.target.value }))} />
            </div>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>APR %</label>
              <input className="input" type="number" step="0.1" value={liabForm.rate} onChange={e => setLiabForm(f => ({ ...f, rate: e.target.value }))} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Type</label>
              <select className="input" value={liabForm.type} onChange={e => setLiabForm(f => ({ ...f, type: e.target.value }))}>
                {LIABILITY_TYPES.filter(t => !t.auto).map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addLiability}>Add</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {manualLiabilities.map(l => {
            const type = LIABILITY_TYPES.find(t => t.id === l.type) || LIABILITY_TYPES[5];
            return (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{type.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</span>
                  {l.rate && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{l.rate}% APR</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>-${(l.balance || 0).toLocaleString()}</span>
                  <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => deleteLiability(l.id)}>✕</button>
                </div>
              </div>
            );
          })}
          {manualLiabilities.length === 0 && accounts.filter(a => a.type === "credit").length === 0 && (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>
              No liabilities tracked. Add debts and loans to calculate true net worth.
            </div>
          )}
        </div>
      </div>

      {/* Credit Score */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Credit Score</h3>
          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddScore(!showAddScore)}>+ Update Score</button>
        </div>

        {showAddScore && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Score</label>
              <input className="input" type="number" min={300} max={850} value={scoreForm.score}
                onChange={e => setScoreForm(f => ({ ...f, score: e.target.value }))} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Date</label>
              <input type="date" className="input" value={scoreForm.date}
                onChange={e => setScoreForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "block" }}>Note</label>
              <input className="input" value={scoreForm.note}
                onChange={e => setScoreForm(f => ({ ...f, note: e.target.value }))} placeholder="Paid off car loan..." />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addCreditScore}>Save</button>
          </div>
        )}

        {latestScore ? (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(latestScore.score) }}>{latestScore.score}</span>
              <span style={{ fontSize: 13, color: scoreColor(latestScore.score), fontWeight: 600 }}>{scoreLabel(latestScore.score)}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>as of {latestScore.date}</span>
            </div>
            {/* Score bar */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 4, height: 8, position: "relative", marginBottom: 8 }}>
              <div style={{
                position: "absolute", left: 0, top: 0, height: 8, borderRadius: 4,
                width: `${((latestScore.score - 300) / 550) * 100}%`,
                background: `linear-gradient(90deg, #ef4444, #f59e0b, #10b981)`,
              }} />
            </div>
            {/* History */}
            {creditScores.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {creditScores.slice(0, 6).map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                    <span style={{ color: "var(--text-tertiary)" }}>{s.date}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: scoreColor(s.score) }}>{s.score}</span>
                      {s.note && <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{s.note}</span>}
                      <button className="btn btn-sm" style={{ fontSize: 9, padding: "0 4px" }} onClick={() => deleteScore(s.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>
            No credit score recorded. Add your score to track it over time.
          </div>
        )}
      </div>
    </div>
  );
}
