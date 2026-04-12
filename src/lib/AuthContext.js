"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";

const AuthContext = createContext({});

const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

function isEmbeddedBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    ua.includes("WebView") ||
    ua.includes("wv") ||
    window.Telegram?.WebApp !== undefined
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);

  const isTokenFresh = useCallback(() => {
    try {
      const ts = localStorage.getItem("google_token_timestamp");
      if (!ts) return false;
      return (Date.now() - parseInt(ts, 10)) < TOKEN_LIFETIME_MS;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            try {
              localStorage.setItem("google_access_token", credential.accessToken);
              localStorage.setItem("google_token_timestamp", String(Date.now()));
            } catch {}
            setGoogleAccessToken(credential.accessToken);
          }
        }
      })
      .catch((err) => console.error("Redirect result error:", err));

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        try {
          const stored = localStorage.getItem("google_access_token");
          if (stored && isTokenFresh()) {
            setGoogleAccessToken(stored);
          } else {
            localStorage.removeItem("google_access_token");
            localStorage.removeItem("google_token_timestamp");
            setGoogleAccessToken(null);
          }
        } catch {
          setGoogleAccessToken(null);
        }
      }
    });
    return () => unsubscribe();
  }, [isTokenFresh]);

  const buildProvider = () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/calendar.events");
    provider.addScope("https://www.googleapis.com/auth/tasks");
    return provider;
  };

  const loginWithGoogle = async () => {
    const provider = buildProvider();
    try {
      if (isEmbeddedBrowser()) {
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential) {
          localStorage.setItem("google_access_token", credential.accessToken);
          localStorage.setItem("google_token_timestamp", String(Date.now()));
          setGoogleAccessToken(credential.accessToken);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
        } catch (e) {
          console.error("Redirect fallback error:", e);
        }
      }
    }
  };

  const refreshGoogleToken = async () => {
    const provider = buildProvider();
    try {
      provider.setCustomParameters({ prompt: "consent" });
      if (isEmbeddedBrowser()) {
        await signInWithRedirect(auth, provider);
        return null;
      }
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        const token = credential.accessToken;
        localStorage.setItem("google_access_token", token);
        localStorage.setItem("google_token_timestamp", String(Date.now()));
        setGoogleAccessToken(token);
        return token;
      }
    } catch (error) {
      console.error("Token refresh error:", error);
    }
    return null;
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("google_access_token");
      localStorage.removeItem("google_token_timestamp");
      setGoogleAccessToken(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, googleAccessToken, refreshGoogleToken, isTokenFresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
