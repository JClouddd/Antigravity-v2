"use client";
import { useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

/* Bulletproof API helper — never throws, always returns { error } on failure */
export function useFactoryApi() {
  const { user } = useAuth();

  const api = useCallback(async (route, body) => {
    try {
      const res = await fetch(`/api/factory/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid, ...body }),
      });
      const text = await res.text();
      if (!text || text.trim() === "") {
        return { error: `${route} returned empty response (HTTP ${res.status})` };
      }
      try { return JSON.parse(text); }
      catch { return { error: `${route} returned HTTP ${res.status}: ${text.slice(0, 100)}` }; }
    } catch (err) {
      return { error: `Network error: ${err.message}` };
    }
  }, [user?.uid]);

  return { api, userId: user?.uid };
}
