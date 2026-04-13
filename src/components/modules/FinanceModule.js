"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getApiUsage, logApiCall, COST_REFERENCE } from "@/lib/apiCostTracker";

// ─── Tab Config ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "transactions", label: "💳 Transactions" },
  { id: "budget", label: "📋 Budget" },
  { id: "advisor", label: "🤖 AI Advisor" },
  { id: "costs", label: "⚡ API Costs" },
  { id: "settings", label: "⚙️ Settings" },
];

const PLAID_ENVS = [
  { id: "sandbox", label: "Sandbox", desc: "Free test data", color: "#10b981" },
  { id: "development", label: "Development", desc: "Real banks, limited users", color: "#3b82f6" },
  { id: "production", label: "Production", desc: "Live with real money", color: "#ef4444" },
];

// ─── Plaid category map (standard personal_finance_category) ─────────────────
const CATEGORY_META = {
  INCOME: { icon: "💰", color: "#10b981", label: "Income" },
  TRANSFER_IN: { icon: "📥", color: "#3b82f6", label: "Transfer In" },
  TRANSFER_OUT: { icon: "📤", color: "#6b7280", label: "Transfer Out" },
  LOAN_PAYMENTS: { icon: "🏦", color: "#8b5cf6", label: "Loan Payment" },
  BANK_FEES: { icon: "💸", color: "#ef4444", label: "Bank Fees" },
  ENTERTAINMENT: { icon: "🎬", color: "#f59e0b", label: "Entertainment" },
  FOOD_AND_DRINK: { icon: "🍔", color: "#f97316", label: "Food & Drink" },
  GENERAL_MERCHANDISE: { icon: "🛍️", color: "#ec4899", label: "Shopping" },
  HOME_IMPROVEMENT: { icon: "🔨", color: "#a855f7", label: "Home" },
  MEDICAL: { icon: "🏥", color: "#ef4444", label: "Medical" },
  PERSONAL_CARE: { icon: "💇", color: "#14b8a6", label: "Personal Care" },
  GENERAL_SERVICES: { icon: "🔧", color: "#6366f1", label: "Services" },
  GOVERNMENT_AND_NON_PROFIT: { icon: "🏛️", color: "#64748b", label: "Government" },
  TRANSPORTATION: { icon: "🚗", color: "#0ea5e9", label: "Transportation" },
  TRAVEL: { icon: "✈️", color: "#0284c7", label: "Travel" },
  RENT_AND_UTILITIES: { icon: "🏠", color: "#7c3aed", label: "Rent & Utilities" },
  OTHER: { icon: "📦", color: "#94a3b8", label: "Other" },
};

const getCatMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.OTHER;

// ─── Profile Config ──────────────────────────────────────────────────────────
const DEFAULT_PROFILES = [
  { id: "personal", name: "Personal", icon: "👤" },
];

// ─── Budget defaults ─────────────────────────────────────────────────────────
const DEFAULT_BUDGETS = [
  { category: "FOOD_AND_DRINK", limit: 800 },
  { category: "TRANSPORTATION", limit: 400 },
  { category: "RENT_AND_UTILITIES", limit: 2500 },
  { category: "ENTERTAINMENT", limit: 200 },
  { category: "GENERAL_MERCHANDISE", limit: 500 },
  { category: "PERSONAL_CARE", limit: 150 },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function FinanceModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [activeProfile, setActiveProfile] = useState("personal");
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [apiUsage, setApiUsage] = useState(null);
  const [costPeriod, setCostPeriod] = useState("30d");
  const [plaidEnv, setPlaidEnv] = useState("sandbox");
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  // Settings state
  const [plaidConfig, setPlaidConfig] = useState({ configured: false, clientId: "", environment: "sandbox" });
  const [configForm, setConfigForm] = useState({ clientId: "", secretSandbox: "", secretDevelopment: "", secretProduction: "" });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  // Fetch financial data from Plaid
  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, profileId: activeProfile }),
      });
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTransactions(data.transactions || []);
      if (data.env) setPlaidEnv(data.env);
    } catch (err) {
      console.error("Fetch financial data error:", err);
    }
    setLoading(false);
  }, [user, activeProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch API costs
  const fetchCosts = useCallback(async () => {
    if (!user?.uid) return;
    const usage = await getApiUsage(user.uid, costPeriod);
    setApiUsage(usage);
  }, [user, costPeriod]);

  useEffect(() => { if (tab === "costs") fetchCosts(); }, [tab, fetchCosts]);

  // Fetch Plaid config status
  const fetchPlaidConfig = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`/api/finance/config?userId=${user.uid}`);
      const data = await res.json();
      setPlaidConfig(data);
      setPlaidEnv(data.environment || "sandbox");
      setConfigForm(prev => ({ ...prev, clientId: data.clientId || "" }));
    } catch (e) { console.error("Config fetch error:", e); }
  }, [user]);

  useEffect(() => { fetchPlaidConfig(); }, [fetchPlaidConfig]);

  // Save Plaid config
  const savePlaidConfig = async () => {
    if (!user?.uid) return;
    setConfigSaving(true);
    setConfigMsg("");
    try {
      const res = await fetch("/api/finance/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, ...configForm, environment: plaidEnv }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigMsg("✅ Configuration saved");
        setConfigForm(prev => ({ ...prev, secretSandbox: "", secretDevelopment: "", secretProduction: "" }));
        fetchPlaidConfig();
      } else {
        setConfigMsg("❌ " + (data.error || "Save failed"));
      }
    } catch (e) {
      setConfigMsg("❌ Error: " + e.message);
    }
    setConfigSaving(false);
  };

  // Switch Plaid environment
  const switchPlaidEnv = async (env) => {
    setPlaidEnv(env);
    if (!user?.uid) return;
    try {
      await fetch("/api/finance/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, environment: env }),
      });
      fetchPlaidConfig();
    } catch (e) { console.error("Env switch error:", e); }
  };

  // Connect bank via Plaid Link
  const connectBank = async () => {
    try {
      const res = await fetch("/api/finance/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const { link_token, env } = await res.json();
      if (env) setPlaidEnv(env);
      if (!link_token) return;

      const loadAndOpen = () => {
        const handler = window.Plaid.create({
          token: link_token,
          onSuccess: async (publicToken, metadata) => {
            await fetch("/api/finance/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicToken,
                userId: user.uid,
                profileId: activeProfile,
                institutionName: metadata.institution?.name || "Bank",
              }),
            });
            await logApiCall(user.uid, { service: "plaid", action: "link_account", estimatedCost: 0.30 });
            fetchData();
          },
          onExit: () => {},
        });
        handler.open();
      };

      if (!window.Plaid) {
        const script = document.createElement("script");
        script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
        script.onload = loadAndOpen;
        document.head.appendChild(script);
      } else {
        loadAndOpen();
      }
    } catch (err) {
      console.error("Connect bank error:", err);
    }
  };

  // AI Advisor
  const askAdvisor = async (q) => {
    if (!q?.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `You are a financial advisor AI for Antigravity Hub. The user's financial data:\n\nAccounts: ${JSON.stringify(accounts.slice(0, 10))}\n\nRecent Transactions (last 30 days): ${JSON.stringify(transactions.slice(0, 50).map(t => ({ name: t.name, amount: t.amount, category: t.category, date: t.date })))}\n\nTotal Balance: $${totalBalance.toFixed(2)}\nTotal Income (30d): $${totalIncome.toFixed(2)}\nTotal Spending (30d): $${totalSpending.toFixed(2)}\n\nUser question: ${q}\n\nProvide concise, actionable financial advice.`
          }],
        }),
      });
      const data = await res.json();
      setAiInsight(data.response || data.message || "No response.");
      await logApiCall(user.uid, { service: "gemini", action: "finance_advisor", model: "gemini-2.5-flash", estimatedCost: 0.003 });
    } catch (err) {
      setAiInsight("Error: " + err.message);
    }
    setAiLoading(false);
  };

  // Add profile
  const addProfile = () => {
    if (!newProfileName.trim()) return;
    const id = `profile_${Date.now()}`;
    setProfiles([...profiles, { id, name: newProfileName, icon: "👤" }]);
    setNewProfileName("");
    setShowAddProfile(false);
  };

  // ─── Computed ──────────────────────────────────────────────────────────────
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + (a.balanceCurrent || 0), 0), [accounts]);
  const totalIncome = useMemo(() => transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [transactions]);
  const totalSpending = useMemo(() => transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [transactions]);
  const netCashflow = totalIncome - totalSpending;

  const categorySpending = useMemo(() => {
    const map = {};
    transactions.filter(t => t.amount > 0).forEach(t => {
      const cat = t.category || "OTHER";
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = !searchTerm || t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.merchant?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCat === "all" || t.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [transactions, searchTerm, filterCat]);

  const uniqueCategories = useMemo(() => [...new Set(transactions.map(t => t.category || "OTHER"))].sort(), [transactions]);

  const envBadge = { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, letterSpacing: "0.05em",
    background: plaidEnv === "production" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
    color: plaidEnv === "production" ? "#ef4444" : "#10b981",
  };

  const budgetBar = (pct) => ({
    width: `${Math.min(pct, 100)}%`, height: 6, borderRadius: 3, transition: "width 0.5s ease",
    background: pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#10b981",
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            Finance <span style={envBadge}>{plaidEnv.toUpperCase()}</span>
          </h1>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {profiles.map(p => (
              <button key={p.id} onClick={() => setActiveProfile(p.id)}
                className={activeProfile === p.id ? "btn btn-primary btn-sm" : "btn btn-sm"}
                style={{ fontSize: 12 }}>
                {p.icon} {p.name}
              </button>
            ))}
            <button className="btn btn-sm" style={{ borderStyle: "dashed", fontSize: 12 }}
              onClick={() => setShowAddProfile(!showAddProfile)}>+</button>
          </div>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
          Accounts, spending, budgets, and financial intelligence
        </p>
      </div>

      {/* Add Profile inline */}
      {showAddProfile && (
        <div style={{ padding: "0 32px 8px", display: "flex", gap: 8 }}>
          <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
            placeholder="Profile name..." className="input" style={{ flex: 1 }}
            onKeyDown={e => e.key === "Enter" && addProfile()} />
          <button className="btn btn-primary btn-sm" onClick={addProfile}>Add</button>
        </div>
      )}

      {/* Tab bar — matches Life / Time / Planning pattern */}
      <div style={{ display: "flex", gap: 0, padding: "0 32px", borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
            border: "none", background: "none",
            color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px 32px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 30, color: "var(--text-tertiary)" }}>
            <div style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
            Syncing financial data...
          </div>
        )}

        {/* ═══════ OVERVIEW ═══════ */}
        {tab === "overview" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Balance", value: totalBalance, color: "#10b981" },
                { label: "Income (30d)", value: totalIncome, color: "#3b82f6" },
                { label: "Spending (30d)", value: totalSpending, color: "#ef4444" },
                { label: "Net Cash Flow", value: netCashflow, color: netCashflow >= 0 ? "#10b981" : "#ef4444", prefix: netCashflow >= 0 ? "+" : "" },
              ].map(stat => (
                <div key={stat.label} className="card">
                  <div style={{ fontSize: 24, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                    {stat.prefix || ""}${Math.abs(stat.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Accounts */}
            {accounts.length > 0 ? (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Linked Accounts ({accounts.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {accounts.map(a => (
                    <div key={a.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.institution} • {a.type} • ****{a.mask}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>${(a.balanceCurrent || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                        {a.balanceLimit && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Limit: ${a.balanceLimit.toLocaleString()}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Connect Your Accounts</div>
                <div style={{ color: "var(--text-tertiary)", marginBottom: 16, fontSize: 13 }}>
                  Securely link your bank accounts via Plaid to see real-time balances and transactions.
                </div>
                <button className="btn btn-primary" onClick={connectBank}>🔗 Connect via Plaid</button>
              </div>
            )}

            {/* Spending breakdown */}
            {Object.keys(categorySpending).length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Spending by Category</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(categorySpending).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat, amount]) => {
                    const meta = getCatMeta(cat);
                    const budget = budgets.find(b => b.category === cat);
                    const pct = budget ? (amount / budget.limit) * 100 : 30;
                    return (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 130, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 4, alignItems: "center" }}>
                          <span>{meta.icon}</span> {meta.label}
                        </div>
                        <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 3, height: 6 }}>
                          <div style={budgetBar(pct)} />
                        </div>
                        <div style={{ width: 70, textAlign: "right", fontSize: 13, fontWeight: 600 }}>${amount.toFixed(0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TRANSACTIONS ═══════ */}
        {tab === "transactions" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="input" style={{ width: 220 }} />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input" style={{ width: 160 }}>
                <option value="all">All Categories</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{getCatMeta(c).icon} {getCatMeta(c).label}</option>)}
              </select>
              <button className="btn btn-sm" onClick={connectBank}>🔗 Link Account</button>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{filteredTxns.length} transactions</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Date", "Description", "Category", "Bank", "Amount"].map(h => (
                      <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "10px 12px", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTxns.slice(0, 200).map(t => {
                    const meta = getCatMeta(t.category);
                    return (
                      <tr key={t.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{t.date}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          <div style={{ fontWeight: 500 }}>{t.merchant || t.name}</div>
                          {t.pending && <span className="badge" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>Pending</span>}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          <span className="badge" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.icon} {meta.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-tertiary)" }}>{t.institution}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, fontSize: 13, color: t.amount < 0 ? "#10b981" : "#ef4444" }}>
                          {t.amount < 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTxns.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                  {accounts.length === 0 ? "Connect a bank account to see transactions" : "No matching transactions"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ BUDGET ═══════ */}
        {tab === "budget" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Monthly Budget Tracker</h3>
            {budgets.map(b => {
              const meta = getCatMeta(b.category);
              const spent = categorySpending[b.category] || 0;
              const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
              const remaining = b.limit - spent;
              return (
                <div key={b.category} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span>{meta.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: pct > 90 ? "#ef4444" : "var(--text-secondary)" }}>${spent.toFixed(0)}</span>
                      <span style={{ color: "var(--text-tertiary)" }}> / ${b.limit}</span>
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 3, height: 6, marginBottom: 4 }}>
                    <div style={budgetBar(pct)} />
                  </div>
                  <div style={{ fontSize: 11, color: remaining >= 0 ? "#10b981" : "#ef4444" }}>
                    {remaining >= 0 ? `$${remaining.toFixed(0)} remaining` : `$${Math.abs(remaining).toFixed(0)} over budget`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════ AI ADVISOR ═══════ */}
        {tab === "advisor" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} placeholder="Ask about your finances..."
                className="input" style={{ flex: 1 }}
                onKeyDown={e => e.key === "Enter" && askAdvisor(aiQuestion)} />
              <button className="btn btn-primary" onClick={() => askAdvisor(aiQuestion)} disabled={aiLoading}>
                {aiLoading ? "⏳" : "🤖 Ask"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Summarize my spending", "How can I save more?", "Am I on budget?", "What bills are coming up?"].map(q => (
                <button key={q} className="btn btn-sm" onClick={() => { setAiQuestion(q); askAdvisor(q); }}>{q}</button>
              ))}
            </div>
            {aiInsight && (
              <div className="card" style={{ lineHeight: 1.7, fontSize: 13, whiteSpace: "pre-wrap", borderColor: "var(--accent)" }}>
                {aiInsight}
              </div>
            )}
            {!aiInsight && !aiLoading && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>AI Financial Advisor</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Ask questions about your spending, budgeting, and financial health.</div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ API COSTS ═══════ */}
        {tab === "costs" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["7d", "30d", "90d", "all"].map(p => (
                <button key={p} onClick={() => setCostPeriod(p)}
                  className={costPeriod === p ? "btn btn-primary btn-sm" : "btn btn-sm"}>
                  {p === "all" ? "All Time" : p}
                </button>
              ))}
            </div>

            {apiUsage ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div className="card">
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>${apiUsage.totalCost.toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Cost ({costPeriod})</div>
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginBottom: 2 }}>{apiUsage.totalCalls.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>API Calls</div>
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>{apiUsage.totalTokens.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Tokens</div>
                  </div>
                </div>

                {/* By Service */}
                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cost by Service</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(apiUsage.byService).sort((a, b) => b[1].cost - a[1].cost).map(([svc, data]) => {
                      const maxCost = Math.max(...Object.values(apiUsage.byService).map(s => s.cost), 0.001);
                      const pct = (data.cost / maxCost) * 100;
                      return (
                        <div key={svc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 100, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{svc}</div>
                          <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: 3, height: 6 }}>
                            <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: "var(--accent)", transition: "width 0.5s" }} />
                          </div>
                          <div style={{ width: 70, textAlign: "right", fontSize: 12 }}>${data.cost.toFixed(4)}</div>
                          <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{data.calls}x</div>
                        </div>
                      );
                    })}
                    {Object.keys(apiUsage.byService).length === 0 && (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)", fontSize: 13 }}>No API calls recorded yet</div>
                    )}
                  </div>
                </div>

                {/* Cost Reference */}
                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Cost Reference</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    {[
                      ["Gemini (2.5 Flash)", "$0.15/1M input, $0.60/1M output", "Free tier: 15 RPM"],
                      ["Plaid", "$0 sandbox / $0.30 per link (prod)", "Transactions included"],
                      ["Alpaca", "Free (paper & live)", "Commission-free trades"],
                      ["YouTube Data API", "Free", "10,000 quota units/day"],
                      ["Google Calendar", "Free", "Included with OAuth"],
                      ["Firebase/Firestore", "Free tier", "1GB storage, 50K reads/day"],
                    ].map(([name, cost, note]) => (
                      <div key={name} style={{ display: "flex", gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ width: 150, fontWeight: 500 }}>{name}</div>
                        <div style={{ flex: 1, color: "var(--text-secondary)" }}>{cost}</div>
                        <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>Loading cost data...</div>
            )}
          </div>
        )}

        {/* ═══════ SETTINGS ═══════ */}
        {tab === "settings" && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Environment Toggle */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Plaid Environment</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                {PLAID_ENVS.map(e => (
                  <div key={e.id} className="card" onClick={() => switchPlaidEnv(e.id)}
                    style={{
                      cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                      border: plaidEnv === e.id ? `2px solid ${e.color}` : undefined,
                      background: plaidEnv === e.id ? `${e.color}10` : undefined,
                    }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: plaidEnv === e.id ? e.color : "var(--text-primary)" }}>{e.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{e.desc}</div>
                    {plaidEnv === e.id && <div style={{ fontSize: 11, marginTop: 6, color: e.color, fontWeight: 600 }}>● Active</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* API Credentials */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Plaid API Credentials</h3>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>
                Keys are stored securely in Firestore and never exposed to the browser after saving.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Client ID */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Client ID</label>
                  <input value={configForm.clientId} onChange={e => setConfigForm(f => ({ ...f, clientId: e.target.value }))}
                    placeholder="Enter Plaid Client ID..." className="input" />
                </div>

                {/* Secrets */}
                {[
                  { key: "secretSandbox", label: "Sandbox Secret", saved: plaidConfig.hasSandboxSecret, color: "#10b981" },
                  { key: "secretDevelopment", label: "Development Secret", saved: plaidConfig.hasDevelopmentSecret, color: "#3b82f6" },
                  { key: "secretProduction", label: "Production Secret", saved: plaidConfig.hasProductionSecret, color: "#ef4444" },
                ].map(({ key, label, saved, color }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      {label}
                      {saved && <span className="badge" style={{ background: `${color}20`, color }}>Saved</span>}
                    </label>
                    <input type="password" value={configForm[key]}
                      onChange={e => setConfigForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={saved ? "••••••••• (saved — enter new to replace)" : `Enter ${label}...`}
                      className="input" />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
                <button className="btn btn-primary" onClick={savePlaidConfig} disabled={configSaving}>
                  {configSaving ? "Saving..." : "💾 Save Configuration"}
                </button>
                {configMsg && <span style={{ fontSize: 12 }}>{configMsg}</span>}
              </div>

              {plaidConfig.updatedAt && (
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 8 }}>
                  Last updated: {new Date(plaidConfig.updatedAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Connection Status */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Connection Status</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {[
                  ["Client ID", plaidConfig.clientId ? "✅ Configured" : "❌ Not set"],
                  ["Sandbox Secret", plaidConfig.hasSandboxSecret ? "✅ Saved" : "⚠️ Not set"],
                  ["Development Secret", plaidConfig.hasDevelopmentSecret ? "✅ Saved" : "⚠️ Not set"],
                  ["Production Secret", plaidConfig.hasProductionSecret ? "✅ Saved" : "⚠️ Not set"],
                  ["Active Environment", plaidEnv.toUpperCase()],
                  ["Linked Accounts", `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
