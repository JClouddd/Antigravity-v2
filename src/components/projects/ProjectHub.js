"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem, deleteItem, getProjects, getActiveItems, getPlanningItems, upsertItemByGoogleId } from "@/lib/projects";
import { syncItemToGoogle, unsyncItemFromGoogle, pullFromGoogle } from "@/lib/googleSync";
import { getSettings, saveSettings, getActiveViews } from "@/lib/settings";
import { evaluateRules, evaluateTimeRules } from "@/lib/automations";
import { getHabits } from "@/lib/habits";
import KanbanBoard from "./KanbanBoard";
import TableView from "./TableView";
import TodayView from "./TodayView";
import GanttTimeline from "./GanttTimeline";
import CalendarView from "./CalendarView";
import HabitTracker from "./HabitTracker";
import GoalsView from "./GoalsView";
import WeeklyReview from "./WeeklyReview";
import PlanningView from "./PlanningView";
import TaskDetailSheet from "./TaskDetailSheet";
import CreateItemModal from "./CreateItemModal";
import SettingsPanel from "./SettingsPanel";

const VIEW_COMPONENTS = {
  today: "Today",
  board: "Board",
  table: "Table",
  timeline: "Timeline",
  calendar: "Calendar",
  planning: "Planning",
};

export default function ProjectHub() {
  const { user, googleAccessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeViewId, setActiveViewId] = useState("today");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const enabledRules = ["auto_complete_project", "auto_complete_past_event", "escalate_overdue", "auto_progress"];

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [data, s, h] = await Promise.all([getItems(user.uid), getSettings(user.uid), getHabits(user.uid)]);
      setItems(data);
      setSettings(s);
      setHabits(h);
      const activeViews = getActiveViews(s);
      if (activeViews.length > 0 && !activeViews.find((v) => v.id === activeViewId)) {
        setActiveViewId(activeViews[0].id);
      }

      // Pull sync from Google (merge external events/tasks)
      if (googleAccessToken) {
        try {
          const { events, tasks } = await pullFromGoogle(googleAccessToken);
          const existingGoogleIds = new Set(data.map(i => i.googleCalendarEventId).filter(Boolean));
          const existingTaskIds = new Set(data.map(i => i.googleTaskId).filter(Boolean));
          const newItems = [];
          for (const evt of events) {
            if (!existingGoogleIds.has(evt.googleCalendarEventId)) {
              const upserted = await upsertItemByGoogleId(user.uid, "googleCalendarEventId", evt.googleCalendarEventId, evt);
              newItems.push(upserted);
            }
          }
          for (const task of tasks) {
            if (!existingTaskIds.has(task.googleTaskId)) {
              const upserted = await upsertItemByGoogleId(user.uid, "googleTaskId", task.googleTaskId, task);
              newItems.push(upserted);
            }
          }
          if (newItems.length > 0) {
            console.log(`[PULL] Merged ${newItems.length} items from Google`);
            setItems(prev => [...prev, ...newItems]);
          }
        } catch (pullErr) {
          console.warn("[PULL] Sync error (non-critical):", pullErr.message);
        }
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, googleAccessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    await saveSettings(user.uid, merged);
    // If current view was disabled, switch to first enabled
    const activeViews = getActiveViews(merged);
    if (!activeViews.find((v) => v.id === activeViewId)) {
      setActiveViewId(activeViews[0]?.id || "today");
    }
  };

  const handleCreate = async (data) => {
    const subtasksData = data._subtasks || [];
    delete data._subtasks;
    const item = await createItem(user.uid, data);
    if (!item) return;
    const newItems = [item];
    if (data.type === "project" && subtasksData.length > 0) {
      for (const st of subtasksData) {
        const subtask = await createItem(user.uid, {
          type: "subtask", title: st.title, priority: st.priority || "medium",
          status: data.status || "todo", parentId: item.id,
        });
        if (subtask) newItems.push(subtask);
      }
    }
    setItems((prev) => [...newItems, ...prev]);
    setShowCreate(false);
    setCreateDefaults({});
    if (googleAccessToken) {
      for (const newItem of newItems) {
        syncItemToGoogle(googleAccessToken, newItem, async (syncUpdates) => {
          await updateItem(user.uid, newItem.id, syncUpdates);
          setItems((prev) => prev.map((i) => i.id === newItem.id ? { ...i, ...syncUpdates } : i));
        });
      }
    }
  };

  const handleUpdate = async (itemId, updates) => {
    await updateItem(user.uid, itemId, updates);
    let updatedItems = items.map((i) => (i.id === itemId ? { ...i, ...updates } : i));
    if (updates.status === "done") {
      const item = items.find((i) => i.id === itemId);
      if (item?.type === "project") {
        const children = items.filter((i) => i.parentId === itemId && i.status !== "done");
        for (const child of children) {
          await updateItem(user.uid, child.id, { status: "done", completedAt: new Date().toISOString() });
        }
        updatedItems = updatedItems.map((i) => i.parentId === itemId ? { ...i, status: "done" } : i);
      }
    }
    setItems(updatedItems);
    if (selectedItem?.id === itemId) setSelectedItem((prev) => ({ ...prev, ...updates }));

    // Run automation rules
    const changedItem = updatedItems.find(i => i.id === itemId);
    if (changedItem) {
      const automationResults = evaluateRules(updatedItems, changedItem, enabledRules, "subtask_completed");
      for (const { itemId: ruleItemId, updates: ruleUpdates } of automationResults) {
        await updateItem(user.uid, ruleItemId, ruleUpdates);
        updatedItems = updatedItems.map(i => i.id === ruleItemId ? { ...i, ...ruleUpdates } : i);
      }
      if (automationResults.length > 0) setItems(updatedItems);
    }

    if (googleAccessToken) {
      const updatedItem = updatedItems.find((i) => i.id === itemId);
      if (updatedItem) {
        syncItemToGoogle(googleAccessToken, updatedItem, async (syncUpdates) => {
          await updateItem(user.uid, itemId, syncUpdates);
          setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...syncUpdates } : i));
        });
      }
    }
  };

  const handleDelete = async (itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === "project") {
      const children = items.filter((i) => i.parentId === itemId);
      for (const child of children) await deleteItem(user.uid, child.id);
    }
    if (googleAccessToken && item) {
      await unsyncItemFromGoogle(googleAccessToken, item);
      if (item.type === "project") {
        for (const child of items.filter((i) => i.parentId === itemId)) {
          await unsyncItemFromGoogle(googleAccessToken, child);
        }
      }
    }
    await deleteItem(user.uid, itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId && i.parentId !== itemId));
    if (selectedItem?.id === itemId) setSelectedItem(null);
  };

  const handleAddSubtaskToProject = (projectId) => {
    setCreateDefaults({ parentId: projectId, type: "subtask" });
    setShowCreate(true);
  };

  const projects = getProjects(items);
  // Implement plan → creates project + subtasks from plan steps
  const handleImplementPlan = async (plan) => {
    // Create project from the plan
    const project = await createItem(user.uid, {
      type: "project",
      title: plan.title,
      description: plan.description || "",
      status: "todo",
      priority: plan.priority || "medium",
      color: plan.color || "#2563eb",
      startDate: plan.startDate || null,
      dueDate: plan.dueDate || null,
      sourceRef: plan.id, // Link back to the plan
    });

    if (!project) return;
    const newItems = [project];

    // Convert plan steps (subtasks) to project subtasks
    const planSteps = items.filter(i => i.parentId === plan.id);
    for (const step of planSteps) {
      const subtask = await createItem(user.uid, {
        type: "subtask",
        title: step.title,
        description: step.description || "",
        status: step.status === "done" ? "done" : "todo",
        priority: step.priority || "medium",
        parentId: project.id, // Reparent to the new project
        completedAt: step.completedAt || null,
      });
      if (subtask) newItems.push(subtask);
    }

    // Mark plan as implemented
    await updateItem(user.uid, plan.id, {
      status: "archived",
      implementedProjectId: project.id,
    });

    setItems(prev => [...newItems, ...prev.map(i => i.id === plan.id ? { ...i, status: "archived", implementedProjectId: project.id } : i)]);

    // Sync to Google
    if (googleAccessToken) {
      for (const newItem of newItems) {
        syncItemToGoogle(googleAccessToken, newItem, async (syncUpdates) => {
          await updateItem(user.uid, newItem.id, syncUpdates);
          setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, ...syncUpdates } : i));
        });
      }
    }

    // Switch to board view to see the new project
    setActiveViewId("board");
  };

  const activeViews = getActiveViews(settings);
  const moduleName = settings?.moduleName || "Projects";

  const viewItems = activeViewId === "planning" ? getPlanningItems(items)
    : activeViewId === "today" ? items
    : activeViewId === "habits" ? items
    : activeViewId === "goals" ? items
    : activeViewId === "review" ? items
    : getActiveItems(items);

  // Time logging handler
  const handleLogTime = async (entry) => {
    setTimeEntries(prev => [...prev, entry]);
    // Auto-set to in_progress via automation
    const item = items.find(i => i.id === entry.itemId);
    if (item && item.status === "todo") {
      await handleUpdate(item.id, { status: "in_progress" });
    }
  };

  // Check if item is blocked by dependencies
  const isBlocked = (item) => {
    if (!item.dependencies?.length) return false;
    return item.dependencies.some(depId => {
      const dep = items.find(i => i.id === depId);
      return dep && dep.status !== "done";
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
        <div className="spinner" style={{ height: 40 }} />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>{activeViewId === "planning" ? activeViews.find(v => v.id === "planning")?.label || "Planning" :
                 activeViewId === "today" ? activeViews.find(v => v.id === "today")?.label || "Today" :
                 moduleName}</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {activeViewId === "today" ? "Your schedule and tasks for today." :
               `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${items.filter(i => i.type === "task").length} tasks · ${items.filter(i => i.type === "event").length} events`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setShowSettings(true)} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
            <button className="btn btn-primary" onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Item
            </button>
          </div>
        </div>

        {/* View Tabs — from settings */}
        <div style={{ display: "flex", gap: 0, marginTop: 12, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {activeViews.map((v) => (
            <button key={v.id} onClick={() => setActiveViewId(v.id)} style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
              color: activeViewId === v.id ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeViewId === v.id ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ position: "relative" }}>
        {showCreate && (
          <CreateItemModal
            projects={projects} defaultStatus={activeViewId === "planning" ? "planning" : "todo"}
            defaults={createDefaults} onCreate={handleCreate} onClose={() => { setShowCreate(false); setCreateDefaults({}); }}
          />
        )}

        {showSettings && (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
        )}

        {activeViewId === "today" && <TodayView items={viewItems} projects={projects} habits={habits} onUpdate={handleUpdate} onSelect={setSelectedItem} />}
        {activeViewId === "board" && <KanbanBoard items={viewItems} allItems={items} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} onAddSubtask={handleAddSubtaskToProject} isBlocked={isBlocked} onLogTime={handleLogTime} />}
        {activeViewId === "table" && <TableView items={viewItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} isBlocked={isBlocked} />}
        {activeViewId === "timeline" && <GanttTimeline tasks={viewItems} projects={projects} onUpdateTask={handleUpdate} onSelectTask={setSelectedItem} />}
        {activeViewId === "calendar" && <CalendarView tasks={viewItems} projects={projects} onSelectTask={setSelectedItem} googleAccessToken={googleAccessToken} />}
        {activeViewId === "planning" && <PlanningView items={viewItems} onUpdate={handleUpdate} onSelect={setSelectedItem} onImplementPlan={handleImplementPlan} />}
        {activeViewId === "habits" && <HabitTracker />}
        {activeViewId === "goals" && <GoalsView items={items} />}
        {activeViewId === "review" && <WeeklyReview items={items} habits={habits} onCreateJournal={handleCreate} />}

        {selectedItem && (
          <TaskDetailSheet
            task={selectedItem} tasks={items} projects={projects}
            onUpdate={(updates) => handleUpdate(selectedItem.id, updates)}
            onDelete={() => handleDelete(selectedItem.id)}
            onClose={() => setSelectedItem(null)}
            onAddSubtask={() => handleAddSubtaskToProject(selectedItem.id)}
          />
        )}
      </div>
    </>
  );
}
