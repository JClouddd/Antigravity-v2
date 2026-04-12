"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem, deleteItem, getProjects, getActiveItems, getPlanningItems } from "@/lib/projects";
import KanbanBoard from "./KanbanBoard";
import TableView from "./TableView";
import TodayView from "./TodayView";
import GanttTimeline from "./GanttTimeline";
import CalendarView from "./CalendarView";
import TaskDetailSheet from "./TaskDetailSheet";
import CreateItemModal from "./CreateItemModal";

const VIEWS = ["Today", "Board", "Table", "Timeline", "Calendar", "Planning"];

export default function ProjectHub() {
  const { user, googleAccessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [activeView, setActiveView] = useState("Today");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getItems(user.uid);
      setItems(data);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

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
  };

  const handleDelete = async (itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === "project") {
      const children = items.filter((i) => i.parentId === itemId);
      for (const child of children) await deleteItem(user.uid, child.id);
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
  const viewItems = activeView === "Planning" ? getPlanningItems(items)
    : activeView === "Today" ? items // Today view handles its own filtering
    : getActiveItems(items);

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
            <h1>{activeView === "Planning" ? "Planning" : activeView === "Today" ? "Today" : "Projects"}</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {activeView === "Planning" ? "Items under consideration." :
               activeView === "Today" ? "Your schedule and tasks for today." :
               `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${items.filter(i => i.type === "task").length} tasks · ${items.filter(i => i.type === "event").length} events`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Item
          </button>
        </div>

        {/* View Tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 12, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setActiveView(v)} style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
              color: activeView === v ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeView === v ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{v}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ position: "relative" }}>
        {showCreate && (
          <CreateItemModal
            projects={projects} defaultStatus={activeView === "Planning" ? "planning" : "todo"}
            defaults={createDefaults} onCreate={handleCreate} onClose={() => { setShowCreate(false); setCreateDefaults({}); }}
          />
        )}

        {activeView === "Today" && (
          <TodayView items={viewItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} />
        )}
        {activeView === "Board" && (
          <KanbanBoard items={viewItems} allItems={items} projects={projects}
            onUpdate={handleUpdate} onSelect={setSelectedItem} onAddSubtask={handleAddSubtaskToProject} />
        )}
        {activeView === "Table" && (
          <TableView items={viewItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} />
        )}
        {activeView === "Timeline" && (
          <GanttTimeline tasks={viewItems} projects={projects} onUpdateTask={handleUpdate} onSelectTask={setSelectedItem} />
        )}
        {activeView === "Calendar" && (
          <CalendarView tasks={viewItems} projects={projects} onSelectTask={setSelectedItem} googleAccessToken={googleAccessToken} />
        )}
        {activeView === "Planning" && (
          <TableView items={viewItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} />
        )}

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
