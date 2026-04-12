"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function GeminiWidget({ settings, items, onCreateItem, onUpdateItem }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gemini_history") || "[]"); } catch { return []; }
  });
  const [activeChatId, setActiveChatId] = useState(null);

  // Drag state
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 20, y: 20 };
    try { const s = localStorage.getItem("gemini_pos"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [locked, setLocked] = useState(() => {
    try { return localStorage.getItem("gemini_locked") === "true"; } catch { return false; }
  });
  const draggingRef = useRef(false);
  const didDragRef = useRef(false); // Track if mouse actually moved (not just click)
  const startPosRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(null);

  // Default position: bottom-right
  useEffect(() => {
    if (!pos && typeof window !== "undefined") {
      setPos({ x: window.innerWidth - 68, y: window.innerHeight - 68 });
    }
  }, [pos]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Auto-save current conversation when messages change
  useEffect(() => {
    if (messages.length === 0) return;
    const saveConversation = () => {
      try {
        const history = JSON.parse(localStorage.getItem("gemini_history") || "[]");
        const firstUserMsg = messages.find(m => m.role === "user");
        const label = firstUserMsg?.text?.slice(0, 40) || "Untitled";
        const existing = activeChatId ? history.findIndex(h => h.id === activeChatId) : -1;
        const entry = {
          id: activeChatId || `chat_${Date.now()}`,
          label,
          messages,
          updatedAt: new Date().toISOString(),
          createdAt: existing >= 0 ? history[existing].createdAt : new Date().toISOString(),
        };
        if (!activeChatId) setActiveChatId(entry.id);
        if (existing >= 0) {
          history[existing] = entry;
        } else {
          history.unshift(entry);
        }
        // Keep max 20 conversations
        const trimmed = history.slice(0, 20);
        localStorage.setItem("gemini_history", JSON.stringify(trimmed));
        setChatHistory(trimmed);
      } catch (e) { console.error("Chat save error:", e); }
    };
    saveConversation();
  }, [messages]);

  // Drag handlers — use refs instead of state to avoid the click race condition
  const handlePointerDown = useCallback((e) => {
    if (locked || open) return;
    e.preventDefault();
    draggingRef.current = true;
    didDragRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    offsetRef.current = { x: e.clientX - (pos?.x || 0), y: e.clientY - (pos?.y || 0) };

    const handleMove = (ev) => {
      if (!draggingRef.current) return;
      const dx = Math.abs(ev.clientX - startPosRef.current.x);
      const dy = Math.abs(ev.clientY - startPosRef.current.y);
      if (dx > 3 || dy > 3) didDragRef.current = true; // Only count as drag if moved > 3px
      const newPos = {
        x: Math.max(0, Math.min(window.innerWidth - 48, ev.clientX - offsetRef.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 48, ev.clientY - offsetRef.current.y)),
      };
      setPos(newPos);
    };

    const handleUp = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      // Save position
      setPos(prev => {
        if (prev) localStorage.setItem("gemini_pos", JSON.stringify(prev));
        return prev;
      });
      // If it was NOT a drag (just a click), open the chat
      setTimeout(() => {
        if (!didDragRef.current) setOpen(true);
      }, 10);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [locked, open, pos]);

  const toggleLock = (e) => {
    e.stopPropagation();
    const next = !locked;
    setLocked(next);
    localStorage.setItem("gemini_locked", String(next));
  };

  const apiKey = settings?.geminiApiKey;
  const bx = pos?.x ?? 20;
  const by = pos?.y ?? 20;

  // Build system context from items
  const buildContext = () => {
    if (!items?.length) return "No items in the system yet.";
    const today = new Date().toISOString().split("T")[0];
    const todayItems = items.filter(i => i.dueDate === today || i.timeBlock?.date === today);
    const overdue = items.filter(i => i.dueDate && i.dueDate < today && i.status !== "done");
    const inProgress = items.filter(i => i.status === "in_progress");
    return `SYSTEM CONTEXT (${new Date().toLocaleDateString()}):
- Total items: ${items.length} (${items.filter(i=>i.status==="done").length} done)
- Today: ${todayItems.length} items
- Overdue: ${overdue.length} items
- In progress: ${inProgress.length} items
- Projects: ${items.filter(i=>i.type==="project").map(p=>p.title).join(", ") || "none"}`;
  };

  // Slash command handler
  const handleSlashCommand = async (cmd) => {
    const parts = cmd.slice(1).split(" ");
    const action = parts[0].toLowerCase();

    if (action === "today") {
      const today = new Date().toISOString().split("T")[0];
      const todayItems = (items || []).filter(i => i.dueDate === today || i.timeBlock?.date === today);
      if (todayItems.length === 0) return "Nothing scheduled for today. 🎉";
      return "📅 Today:\n" + todayItems.map(i => `• ${i.status === "done" ? "~~" : ""}${i.title}${i.status === "done" ? "~~" : ""} (${i.type})`).join("\n");
    }

    if (action === "overdue") {
      const today = new Date().toISOString().split("T")[0];
      const overdue = (items || []).filter(i => i.dueDate && i.dueDate < today && i.status !== "done");
      if (overdue.length === 0) return "No overdue items! 🎉";
      return "⚠️ Overdue:\n" + overdue.map(i => `• ${i.title} (due ${i.dueDate})`).join("\n");
    }

    if (action === "add" && parts.length >= 3) {
      const type = parts[1].toLowerCase();
      const title = parts.slice(2).join(" ");
      if (["task", "event", "project", "plan", "goal", "habit", "journal"].includes(type) && onCreateItem) {
        await onCreateItem({ type, title, status: "todo", priority: "medium" });
        return `✅ Created ${type}: "${title}"`;
      }
      return `Unknown type "${type}". Use: task, event, project, plan, goal, habit, or journal.`;
    }

    if (action === "done" && parts.length >= 2) {
      const search = parts.slice(1).join(" ").toLowerCase();
      const match = (items || []).find(i => i.title.toLowerCase().includes(search) && i.status !== "done");
      if (match && onUpdateItem) {
        await onUpdateItem(match.id, { status: "done", completedAt: new Date().toISOString() });
        return `✅ Marked done: "${match.title}"`;
      }
      return `Couldn't find an active item matching "${search}"`;
    }

    if (action === "suggest") {
      const today = new Date().toISOString().split("T")[0];
      const inProgress = (items || []).filter(i => i.status === "in_progress");
      const overdue = (items || []).filter(i => i.dueDate && i.dueDate < today && i.status !== "done");
      let suggestion = "💡 Suggestions:\n";
      if (overdue.length > 0) suggestion += `• Focus on ${overdue.length} overdue item(s) first\n`;
      if (inProgress.length > 3) suggestion += `• You have ${inProgress.length} in-progress items — consider finishing some before starting new work\n`;
      if (inProgress.length === 0) suggestion += `• Nothing in progress — pick your highest priority item and start!\n`;
      const urgent = (items || []).filter(i => i.priority === "urgent" && i.status !== "done");
      if (urgent.length > 0) suggestion += `• ${urgent.length} urgent item(s): ${urgent.map(i => i.title).join(", ")}\n`;
      return suggestion;
    }

    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    if (userMsg.startsWith("/")) {
      setLoading(true);
      const result = await handleSlashCommand(userMsg);
      if (result) {
        setMessages(prev => [...prev, { role: "ai", text: result }]);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!apiKey) {
      setMessages(prev => [...prev, { role: "ai", text: "⚠️ No Gemini API key set. Go to Settings → API Keys." }]);
      return;
    }

    setLoading(true);
    try {
      const conversation = messages.map(m => ({
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: m.text }],
      }));
      conversation.push({ role: "user", parts: [{ text: userMsg }] });

      const systemPrompt = `You are Antigravity AI — a concise, helpful assistant embedded in the Antigravity Hub project management system. Keep replies short and actionable. Use markdown when helpful.

${buildContext()}

AVAILABLE COMMANDS (tell the user about these if relevant):
/add [task|event|project|plan|goal|habit|journal] [title] — Quick create
/today — Show today's schedule
/overdue — Show overdue items
/done [item name] — Mark complete
/suggest — Get task suggestions based on current workload`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: conversation,
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!res.ok) {
        setMessages(prev => [...prev, { role: "ai", text: `❌ Error ${res.status}. Check API key in Settings.` }]);
      } else {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
        setMessages(prev => [...prev, { role: "ai", text: reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Bubble (collapsed)
  if (!open) {
    return (
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={toggleLock}
        style={{
          position: "fixed",
          left: bx, top: by,
          zIndex: 9999, width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #4285f4, #7c3aed)",
          border: locked ? "2px solid rgba(255,255,255,0.4)" : "none",
          cursor: locked ? "pointer" : "grab",
          boxShadow: "0 4px 16px rgba(66,133,244,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          userSelect: "none", touchAction: "none",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 3z"/>
          <path d="M17 4a2 2 0 002 2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 002-2"/>
        </svg>
        {locked && <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "var(--accent)", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 7 }}>🔒</span>
        </div>}
      </div>
    );
  }

  // Chat panel (expanded)
  return (
    <div style={{
      position: "fixed",
      left: Math.min(bx, (typeof window !== "undefined" ? window.innerWidth : 400) - 400),
      top: Math.max(0, Math.min(by - 480, (typeof window !== "undefined" ? window.innerHeight : 600) - 540)),
      zIndex: 9999, width: 380, maxWidth: "calc(100vw - 20px)",
      height: 520, maxHeight: "calc(100dvh - 20px)",
      background: "var(--bg-primary)", border: "1px solid var(--border)",
      borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        background: "linear-gradient(135deg, #4285f4, #7c3aed)", color: "white",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 3z"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Antigravity AI</span>
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, padding: "2px 6px", borderRadius: 4, ...(showHistory ? { background: "rgba(255,255,255,0.2)", color: "white" } : {}) }} title="Chat History">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
        <button onClick={() => { setMessages([]); setActiveChatId(null); setShowHistory(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12 }} title="New Chat">+</button>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>✕</button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={{ maxHeight: 260, overflowY: "auto", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
            Chat History ({chatHistory.length})
          </div>
          {chatHistory.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No saved conversations</div>
          )}
          {chatHistory.map((chat) => (
            <div key={chat.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              cursor: "pointer", borderBottom: "1px solid var(--border)",
              background: activeChatId === chat.id ? "var(--accent-light)" : "transparent",
              transition: "background 0.1s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = activeChatId === chat.id ? "var(--accent-light)" : "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = activeChatId === chat.id ? "var(--accent-light)" : "transparent"}
              onClick={() => { setMessages(chat.messages); setActiveChatId(chat.id); setShowHistory(false); }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                  {chat.messages?.length || 0} messages · {new Date(chat.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={(e) => {
                e.stopPropagation();
                const updated = chatHistory.filter(c => c.id !== chat.id);
                localStorage.setItem("gemini_history", JSON.stringify(updated));
                setChatHistory(updated);
                if (activeChatId === chat.id) { setMessages([]); setActiveChatId(null); }
              }} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12, padding: "2px 4px" }} title="Delete">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>Ask me anything or use commands:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              {["/today", "/overdue", "/suggest", "/add task Fix bug", "/add goal Learn React", "/done task name"].map(c => (
                <button key={c} onClick={() => { setInput(c); }}
                  style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent)", background: "var(--bg-secondary)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%", padding: "8px 12px",
            borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
            background: m.role === "user" ? "var(--accent)" : "var(--bg-secondary)",
            color: m.role === "user" ? "white" : "var(--text-primary)",
            fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
          }}>{m.text}</div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 12, fontSize: 13, color: "var(--text-tertiary)" }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Ask or type /command..."
          style={{ flex: 1, fontSize: 13, border: "none", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 8 }}
          autoFocus />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 600, opacity: loading || !input.trim() ? 0.5 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}
