import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Default view configuration (project sub-tabs)
const DEFAULT_VIEWS = [
  { id: "today", label: "Today", enabled: true },
  { id: "board", label: "Board", enabled: true },
  { id: "table", label: "Table", enabled: true },
  { id: "timeline", label: "Timeline", enabled: true },
  { id: "calendar", label: "Calendar", enabled: true },
  { id: "planning", label: "Planning", enabled: true },
  { id: "habits", label: "Habits", enabled: true },
  { id: "goals", label: "Goals", enabled: true },
  { id: "review", label: "Review", enabled: true },
  { id: "time", label: "Time", enabled: true },
];

// Default module configuration (sidebar / main navigation)
const DEFAULT_MODULES = [
  { id: "projects", label: "Projects", icon: "clipboard", enabled: true },
  { id: "settings", label: "Settings", icon: "settings", enabled: true },
];

const SETTINGS_DOC = "v2_settings";

export async function getSettings(userId) {
  try {
    const ref = doc(db, "users", userId, SETTINGS_DOC, "config");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...getDefaultSettings(),
        ...data,
        // Merge views: keep user's saved views + append any NEW default views they don't have yet
        views: mergeViews(data.views, DEFAULT_VIEWS),
        modules: mergeModules(data.modules, DEFAULT_MODULES),
      };
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

// Merge saved views with defaults — keeps user order/labels but adds new defaults
function mergeViews(saved, defaults) {
  if (!saved || saved.length === 0) return defaults;
  const savedIds = new Set(saved.map(v => v.id));
  const newViews = defaults.filter(d => !savedIds.has(d.id));
  return [...saved, ...newViews];
}

function mergeModules(saved, defaults) {
  if (!saved || saved.length === 0) return defaults;
  const savedIds = new Set(saved.map(m => m.id));
  const newMods = defaults.filter(d => !savedIds.has(d.id));
  return [...saved, ...newMods];
}

function getDefaultSettings() {
  return {
    views: DEFAULT_VIEWS,
    modules: DEFAULT_MODULES,
    moduleName: "Projects",
    theme: "system",
    geminiApiKey: "",
  };
}

// Get ordered, enabled views with custom labels
export function getActiveViews(settings) {
  return (settings?.views || DEFAULT_VIEWS).filter((v) => v.enabled);
}

// Get ordered, enabled modules with custom labels
export function getActiveModules(settings) {
  return (settings?.modules || DEFAULT_MODULES).filter((m) => m.enabled);
}

// Get a specific module label
export function getModuleLabel(settings, moduleId) {
  const modules = settings?.modules || DEFAULT_MODULES;
  return modules.find((m) => m.id === moduleId)?.label || moduleId;
}
