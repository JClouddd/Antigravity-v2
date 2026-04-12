"use client";

import { useState, useRef, useEffect } from "react";

export default function GeminiWidget({ settings }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const apiKey = settings?.geminiApiKey;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: "user", text: input.trim() }, { role: "ai", text: "⚠️ No Gemini API key set. Go to Settings → API Keys to add one." }]);
      setInput("");
      return;
    }

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const conversation = messages.map((m) => ({
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      conversation.push({
        role: "user",
        parts: [{ text: userMsg }],
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "You are Antigravity AI — a concise, helpful assistant embedded in the Antigravity Hub project management system. Keep replies short and actionable. Use markdown for formatting when helpful." }],
            },
            contents: conversation,
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("[GEMINI]", errText);
        setMessages((prev) => [...prev, { role: "ai", text: `❌ Error ${res.status}: Check your API key in Settings.` }]);
      } else {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
        setMessages((prev) => [...prev, { role: "ai", text: reply }]);
      }
    } catch (err) {
      console.error("[GEMINI]", err);
      setMessages((prev) => [...prev, { role: "ai", text: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 500,
          width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #4285f4, #7c3aed)",
          border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(66,133,244,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(66,133,244,0.5)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(66,133,244,0.4)"; }}
        title="Antigravity AI"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 3z"/>
          <path d="M17 4a2 2 0 002 2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 002-2"/>
          <path d="M21 11a1 1 0 001-1 1 1 0 00-1-1 1 1 0 00-1 1 1 1 0 001 1"/>
        </svg>
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 500,
      width: 380, maxWidth: "calc(100vw - 40px)", height: 520, maxHeight: "calc(100dvh - 40px)",
      background: "var(--bg-primary)", border: "1px solid var(--border)",
      borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "linear-gradient(135deg, #4285f4, #7c3aed)",
        color: "white",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 3z"/>
          <path d="M17 4a2 2 0 002 2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 002-2"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Antigravity AI</span>
        <button onClick={() => setMessages([])} title="Clear" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12 }}>Clear</button>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 13 }}>Ask me anything about your projects, schedule, or tasks.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: "8px 12px",
            borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
            background: m.role === "user" ? "var(--accent)" : "var(--bg-secondary)",
            color: m.role === "user" ? "white" : "var(--text-primary)",
            fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 12, fontSize: 13, color: "var(--text-tertiary)" }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Ask Antigravity AI..."
          style={{ flex: 1, fontSize: 13, border: "none", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 8 }}
          autoFocus
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 600,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}>
          Send
        </button>
      </div>
    </div>
  );
}
