"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { logApiCall } from "@/lib/apiCostTracker";

// ─── Enhanced AI Financial Advisor ───────────────────────────────────────────
// Aggregates ALL financial data + ingestion knowledge and feeds to Gemini
// for context-aware, personalized financial advice.

const QUICK_PROMPTS = [
  { label: "📊 Full Financial Summary", q: "Give me a comprehensive summary of my entire financial picture — income, spending, debts, assets, net worth, and any red flags." },
  { label: "💰 How can I save more?", q: "Analyze my spending patterns and suggest specific ways I can save more money. Be concrete with numbers." },
  { label: "📋 Am I on budget?", q: "Compare my actual spending against my budget categories. Where am I over? Where am I under?" },
  { label: "🔮 6-Month Forecast", q: "Based on my recurring bills, income, and spending patterns, forecast my financial position 6 months from now." },
  { label: "🎯 Debt Payoff Strategy", q: "Look at all my debts and liabilities. What's the optimal payoff strategy? Should I use avalanche or snowball method?" },
  { label: "📈 Investment Review", q: "Review my investment portfolio allocation. Is it diversified enough? Any rebalancing needed?" },
  { label: "✂️ Split Review", q: "Review my split agreements. Am I tracking expenses properly? Any missed splits or adjustments needed?" },
  { label: "⚠️ Financial Health Check", q: "Do a complete financial health check. Emergency fund status, debt-to-income ratio, credit utilization — give me a score." },
];

export default function AIAdvisorTab({
  user,
  accounts = [],
  transactions = [],
  totalBalance = 0,
  totalIncome = 0,
  totalSpending = 0,
  budgets = [],
  categorySpending = {},
  profileId = "personal",
}) {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const chatEndRef = useRef(null);

  const uid = user?.uid;

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // ─── Gather Full Financial Context ─────────────────────────────────────
  const gatherContext = useCallback(async () => {
    if (!uid) return null;
    setContextLoading(true);

    const ctx = {
      accounts: accounts.slice(0, 15),
      totalBalance,
      totalIncome,
      totalSpending,
      netCashflow: totalIncome - totalSpending,
      categorySpending,
      budgets,
      recentTransactions: transactions.slice(0, 100).map(t => ({
        name: t.merchant || t.name,
        amount: t.amount,
        category: t.category,
        date: t.date,
      })),
    };

    try {
      // Recurring bills
      const recurRes = await fetch("/api/finance/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, profileId }),
      });
      const recurData = await recurRes.json();
      ctx.recurring = (recurData.recurring || []).map(r => ({
        name: r.merchant_name || r.description,
        amount: Math.abs(r.average_amount?.amount || r.last_amount?.amount || 0),
        frequency: r.frequency,
        isIncome: r.is_inflow_stream,
      }));
    } catch (e) { ctx.recurring = []; }

    try {
      // Crypto holdings
      const cryptoSnap = await getDocs(
        query(collection(db, "users", uid, "finance_profiles", profileId, "crypto_holdings"), orderBy("name"))
      );
      ctx.cryptoHoldings = cryptoSnap.docs.map(d => d.data());
    } catch (e) { ctx.cryptoHoldings = []; }

    try {
      // Manual assets
      const aSnap = await getDocs(collection(db, "users", uid, "finance_profiles", profileId, "manual_assets"));
      ctx.manualAssets = aSnap.docs.map(d => d.data());
    } catch (e) { ctx.manualAssets = []; }

    try {
      // Manual liabilities
      const lSnap = await getDocs(collection(db, "users", uid, "finance_profiles", profileId, "manual_liabilities"));
      ctx.manualLiabilities = lSnap.docs.map(d => d.data());
    } catch (e) { ctx.manualLiabilities = []; }

    try {
      // Credit scores
      const cSnap = await getDocs(
        query(collection(db, "users", uid, "finance_profiles", profileId, "credit_scores"), orderBy("date", "desc"), limit(3))
      );
      ctx.creditScores = cSnap.docs.map(d => d.data());
    } catch (e) { ctx.creditScores = []; }

    try {
      // Net worth history
      const nSnap = await getDocs(
        query(collection(db, "users", uid, "finance_profiles", profileId, "net_worth_history"), orderBy("date", "desc"), limit(6))
      );
      ctx.netWorthHistory = nSnap.docs.map(d => d.data());
    } catch (e) { ctx.netWorthHistory = []; }

    try {
      // Split agreements
      const sSnap = await getDocs(collection(db, "users", uid, "split_agreements"));
      ctx.splitAgreements = sSnap.docs.map(d => {
        const data = d.data();
        return { name: data.name, participants: data.participants, status: data.status };
      });
    } catch (e) { ctx.splitAgreements = []; }

    try {
      // Ingestion knowledge — pull any finance-related brain entries
      const iSnap = await getDocs(
        query(collection(db, "users", uid, "brain_entries"), orderBy("createdAt", "desc"), limit(20))
      );
      ctx.ingestedKnowledge = iSnap.docs.map(d => {
        const data = d.data();
        return { title: data.title, summary: data.summary, tags: data.tags, type: data.type };
      }).filter(e => {
        // Filter for finance-relevant entries
        const text = `${e.title} ${e.summary} ${(e.tags || []).join(" ")}`.toLowerCase();
        return text.includes("financ") || text.includes("money") || text.includes("invest")
          || text.includes("budget") || text.includes("saving") || text.includes("debt")
          || text.includes("credit") || text.includes("tax") || text.includes("income")
          || text.includes("expense") || text.includes("wealth") || text.includes("retire");
      });
    } catch (e) { ctx.ingestedKnowledge = []; }

    setContext(ctx);
    setContextLoading(false);
    return ctx;
  }, [uid, accounts, totalBalance, totalIncome, totalSpending, categorySpending, budgets, transactions, profileId]);

  // Load context on mount
  useEffect(() => { gatherContext(); }, [gatherContext]);

  // ─── Build System Prompt ──────────────────────────────────────────────
  const buildSystemPrompt = (ctx) => {
    return `You are the Antigravity Financial Advisor — an expert AI financial advisor embedded in a personal finance command center. You provide clear, actionable, personalized financial advice.

## Your Capabilities
- Analyze spending patterns and budget adherence
- Evaluate debt-to-income ratios and credit health
- Suggest savings opportunities and investment strategies
- Provide forecasts and goal-setting guidance
- Consider the user's ingested financial knowledge (articles, videos, research they've saved)

## Communication Style
- Be concise but thorough — use bullet points and numbers
- Always reference the user's actual data when making points
- Flag warnings with ⚠️ and positive items with ✅
- Provide specific dollar amounts whenever possible
- If you don't have enough data to answer, say so honestly

## The User's Complete Financial Picture

### Accounts & Balances
${JSON.stringify(ctx.accounts?.slice(0, 10) || [], null, 0)}
Total Balance: $${ctx.totalBalance?.toFixed(2) || "0.00"}

### Income & Spending (Last 30 Days)
Income: $${ctx.totalIncome?.toFixed(2) || "0.00"}
Spending: $${ctx.totalSpending?.toFixed(2) || "0.00"}
Net Cashflow: $${ctx.netCashflow?.toFixed(2) || "0.00"}

### Spending by Category
${Object.entries(ctx.categorySpending || {}).map(([cat, amt]) => `- ${cat}: $${amt.toFixed(0)}`).join("\n")}

### Budget Targets
${(ctx.budgets || []).map(b => {
  const spent = ctx.categorySpending?.[b.category] || 0;
  return `- ${b.category}: $${spent.toFixed(0)} of $${b.limit} (${((spent / b.limit) * 100).toFixed(0)}%)`;
}).join("\n")}

### Recurring Bills (Auto-Detected + Manual)
${(ctx.recurring || []).map(r => `- ${r.name}: $${r.amount?.toFixed(2)} (${r.frequency})${r.isIncome ? " [INCOME]" : ""}`).join("\n") || "None detected"}

### Assets
Bank Accounts: $${ctx.totalBalance?.toFixed(2) || "0.00"}
Manual Assets: ${(ctx.manualAssets || []).map(a => `${a.name}: $${(a.value || 0).toLocaleString()}`).join(", ") || "None"}
Crypto Holdings: ${(ctx.cryptoHoldings || []).map(c => `${c.symbol}: ${c.quantity}`).join(", ") || "None"}

### Liabilities
Manual: ${(ctx.manualLiabilities || []).map(l => `${l.name}: $${(l.balance || 0).toLocaleString()} (${l.rate || "?"}% APR)`).join(", ") || "None tracked"}

### Credit Score
${ctx.creditScores?.length ? ctx.creditScores.map(s => `${s.date}: ${s.score}`).join(", ") : "Not tracked"}

### Net Worth Trend
${ctx.netWorthHistory?.length ? ctx.netWorthHistory.map(h => `${h.date}: $${(h.netWorth || 0).toLocaleString()}`).join(" → ") : "No snapshots yet"}

### Split Agreements
${(ctx.splitAgreements || []).map(s => `${s.name} (${s.status}) — ${s.participants?.map(p => `${p.name}: ${p.pct}%`).join(", ")}`).join("\n") || "None"}

### Recent Transactions (Last 30 Days)
${(ctx.recentTransactions || []).slice(0, 50).map(t => `${t.date} | ${t.name} | $${t.amount} | ${t.category}`).join("\n")}

${ctx.ingestedKnowledge?.length ? `### User's Financial Knowledge Base (Ingested Research)
The user has saved these finance-related resources to their knowledge base. Consider them when giving advice:
${ctx.ingestedKnowledge.map(k => `- "${k.title}": ${k.summary || ""}`).join("\n")}` : ""}`;
  };

  // ─── Ask Advisor ──────────────────────────────────────────────────────
  const askAdvisor = async (q) => {
    if (!q?.trim() || loading) return;
    setLoading(true);

    const userMsg = { role: "user", content: q, timestamp: new Date().toISOString() };
    setConversation(prev => [...prev, userMsg]);
    setQuestion("");

    try {
      const ctx = context || await gatherContext();
      const systemPrompt = buildSystemPrompt(ctx);

      // Build conversation history for context
      const history = conversation.slice(-6).map(m => m.content).join("\n\n");
      const fullPrompt = history ? `Previous conversation:\n${history}\n\nNew question: ${q}` : q;

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: fullPrompt }],
          systemPrompt,
        }),
      });
      const data = await res.json();

      const assistantMsg = {
        role: "assistant",
        content: data.response || data.error || "No response.",
        timestamp: new Date().toISOString(),
        usage: data.usage,
      };
      setConversation(prev => [...prev, assistantMsg]);

      if (uid) {
        await logApiCall(uid, {
          service: "gemini",
          action: "finance_advisor",
          model: data.model || "gemini-2.0-flash",
          tokens: data.usage?.totalTokens || 0,
          estimatedCost: ((data.usage?.totalTokens || 0) / 1000000) * 0.15,
        });
      }
    } catch (err) {
      setConversation(prev => [...prev, {
        role: "assistant",
        content: "❌ Error: " + err.message,
        timestamp: new Date().toISOString(),
      }]);
    }
    setLoading(false);
  };

  // Data summary for context indicator
  const contextSummary = useMemo(() => {
    if (!context) return null;
    return {
      accounts: context.accounts?.length || 0,
      transactions: context.recentTransactions?.length || 0,
      recurring: context.recurring?.length || 0,
      assets: (context.manualAssets?.length || 0) + (context.cryptoHoldings?.length || 0),
      liabilities: context.manualLiabilities?.length || 0,
      creditScores: context.creditScores?.length || 0,
      splits: context.splitAgreements?.length || 0,
      knowledge: context.ingestedKnowledge?.length || 0,
      netWorthSnapshots: context.netWorthHistory?.length || 0,
    };
  }, [context]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      {/* Context indicator */}
      {contextSummary && (
        <div className="card" style={{ padding: "8px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>🧠 AI Context:</span>
              {[
                contextSummary.accounts > 0 && `${contextSummary.accounts} accounts`,
                contextSummary.transactions > 0 && `${contextSummary.transactions} txns`,
                contextSummary.recurring > 0 && `${contextSummary.recurring} recurring`,
                contextSummary.assets > 0 && `${contextSummary.assets} assets`,
                contextSummary.liabilities > 0 && `${contextSummary.liabilities} debts`,
                contextSummary.creditScores > 0 && `credit score`,
                contextSummary.splits > 0 && `${contextSummary.splits} splits`,
                contextSummary.knowledge > 0 && `${contextSummary.knowledge} knowledge items`,
              ].filter(Boolean).map(item => (
                <span key={item} className="badge" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 10 }}>
                  ✓ {item}
                </span>
              ))}
              {contextLoading && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Loading context...</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowContext(!showContext)}>
                {showContext ? "Hide" : "View"} Raw
              </button>
              <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={gatherContext} disabled={contextLoading}>
                🔄 Refresh
              </button>
            </div>
          </div>
          {showContext && context && (
            <pre style={{ marginTop: 8, fontSize: 10, maxHeight: 200, overflow: "auto", color: "var(--text-tertiary)", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(context, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_PROMPTS.map(p => (
          <button key={p.label} className="btn btn-sm" style={{ fontSize: 11 }}
            onClick={() => { setQuestion(p.q); askAdvisor(p.q); }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
        {conversation.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Antigravity Financial Advisor</div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
              Ask anything about your finances. I have access to your complete financial picture — accounts, transactions, budgets, recurring bills, assets, debts, credit score, split agreements, and any financial research you&apos;ve ingested.
            </div>
          </div>
        )}

        {conversation.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: msg.role === "user" ? "70%" : "90%",
          }}>
            <div className="card" style={{
              padding: "10px 14px",
              borderColor: msg.role === "user" ? "var(--accent)" : "var(--border)",
              background: msg.role === "user" ? "rgba(var(--accent-rgb, 99,102,241), 0.08)" : undefined,
            }}>
              <div style={{
                fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
                color: msg.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
              }}>
                {msg.content}
              </div>
              {msg.usage && (
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 6, textAlign: "right" }}>
                  {msg.usage.totalTokens} tokens • ~${((msg.usage.totalTokens / 1000000) * 0.15).toFixed(5)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: "flex-start" }}>
            <div className="card" style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s infinite" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s infinite 0.2s" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s infinite 0.4s" }} />
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>Analyzing your finances...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="Ask about your finances, budgeting, debt strategy, investments..."
          className="input" style={{ flex: 1 }}
          onKeyDown={e => e.key === "Enter" && askAdvisor(question)} />
        <button className="btn btn-primary" onClick={() => askAdvisor(question)} disabled={loading || !question.trim()}>
          {loading ? "⏳" : "🤖"} Ask
        </button>
      </div>

      {/* Clear */}
      {conversation.length > 0 && (
        <div style={{ textAlign: "right" }}>
          <button className="btn btn-sm" style={{ fontSize: 10, color: "var(--text-tertiary)" }}
            onClick={() => setConversation([])}>
            Clear Conversation
          </button>
        </div>
      )}
    </div>
  );
}
