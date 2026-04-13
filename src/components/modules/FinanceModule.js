"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getApiUsage, logApiCall, COST_REFERENCE } from "@/lib/apiCostTracker";

// ─── Tab Config ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "transactions", label: "Transactions", icon: "💳" },
  { id: "budget", label: "Budget", icon: "📋" },
  { id: "advisor", label: "AI Advisor", icon: "🤖" },
  { id: "costs", label: "API Costs", icon: "⚡" },
  { id: "settings", label: "Settings", icon: "⚙️" },
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

// ─── Budget defaults (user can customize) ────────────────────────────────────
const DEFAULT_BUDGETS = [
  { category: "FOOD_AND_DRINK", limit: 800 },
  { category: "TRANSPORTATION", limit: 400 },
  { category: "RENT_AND_UTILITIES", limit: 2500 },
  { category: "ENTERTAINMENT", limit: 200 },
  { category: "GENERAL_MERCHANDISE", limit: 500 },
  { category: "PERSONAL_CARE", limit: 150 },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  page: { padding: "0", minHeight: "100%" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 },
  profileBar: { display: "flex", gap: 6, alignItems: "center" },
  profileChip: (active) => ({
    padding: "5px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: active ? 600 : 400,
    background: active ? "var(--accent-dim)" : "transparent", color: active ? "var(--accent)" : "var(--text-tertiary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, transition: "all 0.2s",
  }),
  tabs: { display: "flex", gap: 2, marginBottom: 20, background: "var(--bg-secondary)", padding: 3, borderRadius: 10, flexWrap: "wrap" },
  tab: (active) => ({
    padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "none",
    background: active ? "var(--bg-elevated)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-tertiary)",
    fontWeight: active ? 600 : 400, transition: "all 0.2s", display: "flex", gap: 5, alignItems: "center",
    boxShadow: active ? "var(--shadow-sm)" : "none",
  }),
  card: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 },
  statValue: { fontSize: 24, fontWeight: 700, marginBottom: 2 },
  statLabel: { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" },
  btn: { background: "var(--accent)", border: "none", padding: "8px 16px", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "transparent", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" },
  input: { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, width: "100%" },
  budgetBar: (pct) => ({
    width: `${Math.min(pct, 100)}%`, height: 6, borderRadius: 3, transition: "width 0.5s ease",
    background: pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#10b981",
  }),
  envBadge: (env) => ({
    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
    background: env === "production" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
    color: env === "production" ? "#ef4444" : "#10b981",
  }),
};

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

      // Load Plaid Link script
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>
          💰 Financial Command Center
          <span style={s.envBadge(plaidEnv)}>{plaidEnv.toUpperCase()}</span>
        </div>
        <div style={s.profileBar}>
          {profiles.map(p => (
            <div key={p.id} style={s.profileChip(activeProfile === p.id)} onClick={() => setActiveProfile(p.id)}>
              {p.icon} {p.name}
            </div>
          ))}
          <div style={{ ...s.profileChip(false), borderStyle: "dashed", color: "var(--accent)" }} onClick={() => setShowAddProfile(!showAddProfile)}>+</div>
        </div>
      </div>

      {/* Add Profile */}
      {showAddProfile && (
        <div style={{ ...s.card, display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="Partner name..." style={{ ...s.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && addProfile()} />
          <button onClick={addProfile} style={s.btn}>Add</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ═══════ OVERVIEW ═══════ */}
      {tab === "overview" && (
        <div>
          <div style={s.statGrid}>
            <div style={s.card}>
              <div style={{ ...s.statValue, color: "#10b981" }}>${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              <div style={s.statLabel}>Total Balance</div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.statValue, color: "#3b82f6" }}>${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              <div style={s.statLabel}>Income (30d)</div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.statValue, color: "#ef4444" }}>${totalSpending.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              <div style={s.statLabel}>Spending (30d)</div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.statValue, color: netCashflow >= 0 ? "#10b981" : "#ef4444" }}>
                {netCashflow >= 0 ? "+" : ""}${netCashflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div style={s.statLabel}>Net Cash Flow</div>
            </div>
          </div>

          {/* Accounts */}
          {accounts.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Linked Accounts ({accounts.length})</div>
              <div style={{ display: "grid", gap: 8 }}>
                {accounts.map(a => (
                  <div key={a.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <div style={{ ...s.card, textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Connect Your Accounts</div>
              <div style={{ color: "var(--text-tertiary)", marginBottom: 16, fontSize: 13 }}>
                Securely link your bank accounts via Plaid to see real-time balances and transactions.
              </div>
              <button onClick={connectBank} style={s.btn}>🔗 Connect via Plaid</button>
            </div>
          )}

          {/* Spending breakdown */}
          {Object.keys(categorySpending).length > 0 && (
            <div style={s.card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Spending by Category</div>
              <div style={{ display: "grid", gap: 8 }}>
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
                        <div style={s.budgetBar(pct)} />
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
      {tab === "transactions" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...s.input, width: 220, flex: "unset" }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...s.input, width: 160, flex: "unset" }}>
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{getCatMeta(c).icon} {getCatMeta(c).label}</option>)}
            </select>
            <button onClick={connectBank} style={s.btnGhost}>🔗 Link Account</button>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>{filteredTxns.length} transactions</span>
          </div>

          <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
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
                        {t.pending && <span style={{ fontSize: 9, background: "rgba(251,191,36,0.2)", color: "#fbbf24", padding: "1px 5px", borderRadius: 3 }}>Pending</span>}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: `${meta.color}15`, color: meta.color, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
                          {meta.icon} {meta.label}
                        </span>
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
      {tab === "budget" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Monthly Budget Tracker</div>
          <div style={{ display: "grid", gap: 10 }}>
            {budgets.map(b => {
              const meta = getCatMeta(b.category);
              const spent = categorySpending[b.category] || 0;
              const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
              const remaining = b.limit - spent;
              return (
                <div key={b.category} style={s.card}>
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
                    <div style={s.budgetBar(pct)} />
                  </div>
                  <div style={{ fontSize: 11, color: remaining >= 0 ? "#10b981" : "#ef4444" }}>
                    {remaining >= 0 ? `$${remaining.toFixed(0)} remaining` : `$${Math.abs(remaining).toFixed(0)} over budget`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ AI ADVISOR ═══════ */}
      {tab === "advisor" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} placeholder="Ask about your finances..." style={{ ...s.input, flex: 1 }}
              onKeyDown={e => e.key === "Enter" && askAdvisor(aiQuestion)} />
            <button onClick={() => askAdvisor(aiQuestion)} disabled={aiLoading} style={s.btn}>
              {aiLoading ? "⏳" : "🤖 Ask"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["Summarize my spending", "How can I save more?", "Am I on budget?", "What bills are coming up?"].map(q => (
              <button key={q} onClick={() => { setAiQuestion(q); askAdvisor(q); }} style={s.btnGhost}>{q}</button>
            ))}
          </div>
          {aiInsight && (
            <div style={{ ...s.card, background: "var(--accent-dim)", borderColor: "var(--accent)", lineHeight: 1.7, fontSize: 13, whiteSpace: "pre-wrap" }}>
              {aiInsight}
            </div>
          )}
          {!aiInsight && !aiLoading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>AI Financial Advisor</div>
              <div>Ask questions about your spending, budgeting, and financial health.</div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ API COSTS ═══════ */}
      {tab === "costs" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["7d", "30d", "90d", "all"].map(p => (
              <button key={p} onClick={() => setCostPeriod(p)} style={costPeriod === p ? s.btn : s.btnGhost}>{p === "all" ? "All Time" : p}</button>
            ))}
          </div>

          {apiUsage ? (
            <div>
              {/* Summary cards */}
              <div style={s.statGrid}>
                <div style={s.card}>
                  <div style={{ ...s.statValue, color: "var(--accent)" }}>${apiUsage.totalCost.toFixed(4)}</div>
                  <div style={s.statLabel}>Total Cost ({costPeriod})</div>
                </div>
                <div style={s.card}>
                  <div style={{ ...s.statValue, color: "#3b82f6" }}>{apiUsage.totalCalls.toLocaleString()}</div>
                  <div style={s.statLabel}>API Calls</div>
                </div>
                <div style={s.card}>
                  <div style={{ ...s.statValue, color: "#f59e0b" }}>{apiUsage.totalTokens.toLocaleString()}</div>
                  <div style={s.statLabel}>Total Tokens</div>
                </div>
              </div>

              {/* By Service */}
              <div style={s.card}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cost by Service</div>
                <div style={{ display: "grid", gap: 8 }}>
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
                </div>
                {Object.keys(apiUsage.byService).length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)", fontSize: 13 }}>No API calls recorded yet</div>
                )}
              </div>

              {/* Cost Reference */}
              <div style={{ ...s.card, marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Cost Reference</div>
                <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
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
      {tab === "settings" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Environment Toggle */}
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Plaid Environment</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {PLAID_ENVS.map(e => (
                <div key={e.id}
                  onClick={() => switchPlaidEnv(e.id)}
                  style={{
                    ...s.card, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                    border: plaidEnv === e.id ? `2px solid ${e.color}` : "1px solid var(--border)",
                    background: plaidEnv === e.id ? `${e.color}10` : "var(--bg-elevated)",
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: plaidEnv === e.id ? e.color : "var(--text-primary)" }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{e.desc}</div>
                  {plaidEnv === e.id && <div style={{ fontSize: 11, marginTop: 6, color: e.color, fontWeight: 600 }}>● Active</div>}
                </div>
              ))}
            </div>
          </div>

          {/* API Credentials */}
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Plaid API Credentials</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 14 }}>
              Keys are stored securely in Firestore and never exposed to the browser after saving.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {/* Client ID */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Client ID</label>
                <input
                  value={configForm.clientId}
                  onChange={e => setConfigForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="Enter Plaid Client ID..."
                  style={s.input}
                />
              </div>

              {/* Sandbox Secret */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  Sandbox Secret
                  {plaidConfig.hasSandboxSecret && <span style={{ fontSize: 9, background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "1px 5px", borderRadius: 3 }}>Saved</span>}
                </label>
                <input
                  type="password"
                  value={configForm.secretSandbox}
                  onChange={e => setConfigForm(f => ({ ...f, secretSandbox: e.target.value }))}
                  placeholder={plaidConfig.hasSandboxSecret ? "••••••••• (saved — enter new to replace)" : "Enter Sandbox Secret..."}
                  style={s.input}
                />
              </div>

              {/* Development Secret */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  Development Secret
                  {plaidConfig.hasDevelopmentSecret && <span style={{ fontSize: 9, background: "rgba(59,130,246,0.15)", color: "#3b82f6", padding: "1px 5px", borderRadius: 3 }}>Saved</span>}
                </label>
                <input
                  type="password"
                  value={configForm.secretDevelopment}
                  onChange={e => setConfigForm(f => ({ ...f, secretDevelopment: e.target.value }))}
                  placeholder={plaidConfig.hasDevelopmentSecret ? "••••••••• (saved — enter new to replace)" : "Enter Development Secret..."}
                  style={s.input}
                />
              </div>

              {/* Production Secret */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  Production Secret
                  {plaidConfig.hasProductionSecret && <span style={{ fontSize: 9, background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "1px 5px", borderRadius: 3 }}>Saved</span>}
                </label>
                <input
                  type="password"
                  value={configForm.secretProduction}
                  onChange={e => setConfigForm(f => ({ ...f, secretProduction: e.target.value }))}
                  placeholder={plaidConfig.hasProductionSecret ? "••••••••• (saved — enter new to replace)" : "Enter Production Secret..."}
                  style={s.input}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
              <button onClick={savePlaidConfig} disabled={configSaving} style={s.btn}>
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

          {/* Status Summary */}
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Connection Status</div>
            <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
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

      {/* Loading overlay */}
      {loading && (
        <div style={{ textAlign: "center", padding: 30, color: "var(--text-tertiary)" }}>
          <div style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
          Syncing financial data...
        </div>
      )}
    </div>
  );
}
