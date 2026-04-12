import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Default view configuration
const DEFAULT_VIEWS = [
  { id: "today", label: "Today", enabled: true },
  { id: "board", label: "Board", enabled: true },
  { id: "table", label: "Table", enabled: true },
  { id: "timeline", label: "Timeline", enabled: true },
  { id: "calendar", label: "Calendar", enabled: true },
  { id: "planning", label: "Planning", enabled: true },
];

const SETTINGS_DOC = "v2_settings";

export async function getSettings(userId) {
  try {
    const ref = doc(db, "users", userId, SETTINGS_DOC, "config");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...getDefaultSettings(), ...snap.data() };
    }
  } catch (e) {
    console.error("Settings load error:", e);
  }
  return getDefaultSettings();
}

export async function saveSettings(userId, settings) {
  try {
    const ref = doc(db, "users", userId, SETTINGS_DOC, "config");
    await setDoc(ref, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error("Settings save error:", e);
  }
}

function getDefaultSettings() {
  return {
    views: DEFAULT_VIEWS,
    moduleName: "Projects", // Renameable module title
    theme: "system",        // light | dark | system
  };
}

// Get ordered, enabled views with custom labels
export function getActiveViews(settings) {
  const views = settings?.views || DEFAULT_VIEWS;
  return views.filter((v) => v.enabled);
}

// Get view label by ID (respects custom names)
export function getViewLabel(settings, viewId) {
  const views = settings?.views || DEFAULT_VIEWS;
  const view = views.find((v) => v.id === viewId);
  return view?.label || viewId;
}
