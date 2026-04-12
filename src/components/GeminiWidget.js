"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function GeminiWidget({ settings, items, onCreateItem, onUpdateItem }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Drag state
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 20, y: 20 };
    try { const s = localStorage.getItem("gemini_pos"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [locked, setLocked] = useState(() => {
    try { return localStorage.getItem("gemini_locked") === "true"; } catch { return false; }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
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

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (locked || open) return;
    setDragging(true);
    offsetRef.current = { x: e.clientX - (pos?.x || 0), y: e.clientY - (pos?.y || 0) };
  }, [locked, open, pos]);

  const handleTouchStart = useCallback((e) => {
    if (locked || open) return;
    const t = e.touches[0];
    setDragging(true);
    offsetRef.current = { x: t.clientX - (pos?.x || 0), y: t.clientY - (pos?.y || 0) };
  }, [locked, open, pos]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null) return;
      const newPos = {
        x: Math.max(0, Math.min(window.innerWidth - 48, clientX - offsetRef.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 48, clientY - offsetRef.current.y)),
      };
      setPos(newPos);
    };
    const handleUp = () => {
      setDragging(false);
      if (pos) localStorage.setItem("gemini_pos", JSON.stringify(pos));
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging, pos]);

  const toggleLock = () => {
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
      if (["task", "event", "project"].includes(type) && onCreateItem) {
        await onCreateItem({ type, title, status: "todo", priority: "medium" });
        return `✅ Created ${type}: "${title}"`;
      }
      return `Unknown type "${type}". Use: task, event, or project.`;
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

    return null; // Not a known slash command, send to AI
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    // Handle slash commands locally
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
/add [task|event|project] [title] — Quick create
/today — Show today's schedule
/overdue — Show overdue items
/done [item name] — Mark complete`;

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
        ref={dragRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={toggleLock}
        onClick={() => { if (!dragging) setOpen(true); }}
        style={{
          position: "fixed",
          left: bx, top: by,
          zIndex: 9999, width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #4285f4, #7c3aed)",
          border: locked ? "2px solid rgba(255,255,255,0.4)" : "none",
          cursor: dragging ? "grabbing" : locked ? "pointer" : "grab",
          boxShadow: "0 4px 16px rgba(66,133,244,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: dragging ? "none" : "box-shadow 0.2s",
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
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "linear-gradient(135deg, #4285f4, #7c3aed)", color: "white",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 3z"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Antigravity AI</span>
        <button onClick={() => setMessages([])} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12 }}>Clear</button>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>Ask me anything or use commands:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              {["/today", "/overdue", "/add task Fix bug", "/done task name"].map(c => (
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
