"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Liabilities Tab ─────────────────────────────────────────────────────────
// Plaid Liabilities API — credit cards, student loans, mortgages with details.

export default function LiabilitiesTab({ user, profileId = "personal" }) {
  const [credit, setCredit] = useState([]);
  const [student, setStudent] = useState([]);
  const [mortgage, setMortgage] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const uid = user?.uid;

  const fetchLiabilities = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finance/liabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, profileId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCredit(data.credit || []);
        setStudent(data.student || []);
        setMortgage(data.mortgage || []);
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [uid, profileId]);

  useEffect(() => { fetchLiabilities(); }, [fetchLiabilities]);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const totalDebt = useMemo(() => accounts.reduce((s, a) => s + Math.abs(a.balanceCurrent || 0), 0), [accounts]);
  const totalMinPayment = useMemo(() => {
    const cMin = credit.reduce((s, c) => s + (c.minimumPayment || 0), 0);
    const sMin = student.reduce((s, s2) => s + (s2.minimumPayment || 0), 0);
    const mMin = mortgage.reduce((s, m) => s + (m.nextPaymentAmount || 0), 0);
    return cMin + sMin + mMin;
  }, [credit, student, mortgage]);

  // Find account name by ID
  const acctName = (id) => {
    const a = accounts.find(a => a.id === id);
    return a ? `${a.name} (****${a.mask})` : "Account";
  };
  const acctBalance = (id) => {
    const a = accounts.find(a => a.id === id);
    return a?.balanceCurrent || 0;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading liability data...</div>;

  const hasData = credit.length > 0 || student.length > 0 || mortgage.length > 0 || accounts.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div className="card" style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.05)" }}>
          <div style={{ fontSize: 13, color: "#f59e0b" }}>⚠️ {error}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            Some accounts may not support the liabilities product.
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>
            ${totalDebt.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Total Debt</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>
            ${totalMinPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Monthly Minimums</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            {accounts.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Accounts</div>
        </div>
      </div>

      {!hasData && !error && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏦</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Liability Accounts</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            Link a credit card, student loan, or mortgage account via Plaid to track your debts.
          </div>
        </div>
      )}

      {/* Credit Cards */}
      {credit.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>💳 Credit Cards</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {credit.map(c => {
              const balance = acctBalance(c.id);
              const acct = accounts.find(a => a.id === c.id);
              const utilization = acct?.balanceLimit ? (balance / acct.balanceLimit) * 100 : 0;
              const topApr = c.aprs?.find(a => a.type === "purchase_apr") || c.aprs?.[0];

              return (
                <div key={c.id} style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{acctName(c.id)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.institution}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                      {acct?.balanceLimit && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Limit: ${acct.balanceLimit.toLocaleString()}</div>}
                    </div>
                  </div>

                  {/* Utilization bar */}
                  {acct?.balanceLimit && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Utilization</span>
                        <span style={{ color: utilization > 30 ? "#ef4444" : "#10b981", fontWeight: 600 }}>{utilization.toFixed(0)}%</span>
                      </div>
                      <div style={{ background: "var(--bg-primary)", borderRadius: 3, height: 4 }}>
                        <div style={{
                          width: `${Math.min(utilization, 100)}%`, height: 4, borderRadius: 3,
                          background: utilization > 50 ? "#ef4444" : utilization > 30 ? "#f59e0b" : "#10b981",
                          transition: "width 0.5s",
                        }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
                    {topApr && <span style={{ color: "var(--text-secondary)" }}>APR: <strong>{topApr.percentage}%</strong></span>}
                    {c.minimumPayment && <span style={{ color: "var(--text-secondary)" }}>Min: <strong>${c.minimumPayment}</strong></span>}
                    {c.nextPaymentDue && <span style={{ color: "var(--text-secondary)" }}>Due: <strong>{c.nextPaymentDue}</strong></span>}
                    {c.lastPaymentAmount && <span style={{ color: "var(--text-secondary)" }}>Last: <strong>${c.lastPaymentAmount}</strong> on {c.lastPaymentDate}</span>}
                    {c.isOverdue && <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠️ OVERDUE</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student Loans */}
      {student.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🎓 Student Loans</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {student.map(s => {
              const balance = acctBalance(s.id);
              return (
                <div key={s.id} style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name || acctName(s.id)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.institution} • {s.servicerName}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Rate: <strong>{s.interestRate}%</strong></span>
                    <span style={{ color: "var(--text-secondary)" }}>Status: <strong>{s.status}</strong></span>
                    {s.minimumPayment && <span style={{ color: "var(--text-secondary)" }}>Min: <strong>${s.minimumPayment}</strong></span>}
                    {s.nextPaymentDue && <span style={{ color: "var(--text-secondary)" }}>Due: <strong>{s.nextPaymentDue}</strong></span>}
                    {s.expectedPayoff && <span style={{ color: "var(--text-secondary)" }}>Payoff: <strong>{s.expectedPayoff}</strong></span>}
                    {s.repaymentPlan && <span style={{ color: "var(--text-secondary)" }}>Plan: <strong>{s.repaymentPlan}</strong></span>}
                    {s.originalPrincipal && <span style={{ color: "var(--text-secondary)" }}>Original: <strong>${s.originalPrincipal.toLocaleString()}</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mortgages */}
      {mortgage.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🏡 Mortgages</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mortgage.map(m => {
              const balance = acctBalance(m.id);
              return (
                <div key={m.id} style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.type || "Mortgage"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.institution}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
                    {m.interestRate && <span style={{ color: "var(--text-secondary)" }}>Rate: <strong>{m.interestRate}% ({m.interestType})</strong></span>}
                    {m.nextPaymentAmount && <span style={{ color: "var(--text-secondary)" }}>Payment: <strong>${m.nextPaymentAmount.toLocaleString()}</strong></span>}
                    {m.nextPaymentDue && <span style={{ color: "var(--text-secondary)" }}>Due: <strong>{m.nextPaymentDue}</strong></span>}
                    {m.maturityDate && <span style={{ color: "var(--text-secondary)" }}>Maturity: <strong>{m.maturityDate}</strong></span>}
                    {m.ytdInterestPaid && <span style={{ color: "var(--text-secondary)" }}>YTD Interest: <strong>${m.ytdInterestPaid.toLocaleString()}</strong></span>}
                    {m.ytdPrincipalPaid && <span style={{ color: "var(--text-secondary)" }}>YTD Principal: <strong>${m.ytdPrincipalPaid.toLocaleString()}</strong></span>}
                    {m.originalPrincipal && <span style={{ color: "var(--text-secondary)" }}>Original: <strong>${m.originalPrincipal.toLocaleString()}</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All liability accounts overview */}
      {accounts.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>All Liability Accounts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>{a.institution} • {a.subtype} • ****{a.mask}</span>
                </div>
                <span style={{ fontWeight: 700, color: "#ef4444" }}>
                  -${Math.abs(a.balanceCurrent || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
