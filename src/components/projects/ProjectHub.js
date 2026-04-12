"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getItems, createItem, updateItem, deleteItem, getProjects, getActiveItems, getPlanningItems } from "@/lib/projects";
import KanbanBoard from "./KanbanBoard";
import TableView from "./TableView";
import GanttTimeline from "./GanttTimeline";
import CalendarView from "./CalendarView";
import TaskDetailSheet from "./TaskDetailSheet";
import CreateItemModal from "./CreateItemModal";

const VIEWS = ["Board", "Table", "Timeline", "Calendar", "Planning"];

export default function ProjectHub() {
  const { user, googleAccessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [activeView, setActiveView] = useState("Board");
  const [activeProject, setActiveProject] = useState(null);
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

  // Create item — handles project + inline subtasks
  const handleCreate = async (data) => {
    const subtasksData = data._subtasks || [];
    delete data._subtasks;

    const item = await createItem(user.uid, data);
    if (!item) return;

    const newItems = [item];

    // If project with inline subtasks, create them
    if (data.type === "project" && subtasksData.length > 0) {
      for (const st of subtasksData) {
        const subtask = await createItem(user.uid, {
          type: "subtask",
          title: st.title,
          priority: st.priority || "medium",
          status: data.status || "todo",
          parentId: item.id,
        });
        if (subtask) newItems.push(subtask);
      }
    }

    setItems((prev) => [...newItems, ...prev]);
    setShowCreate(false);
    setCreateDefaults({});
  };

  // Update item — with cascade logic for projects
  const handleUpdate = async (itemId, updates) => {
    await updateItem(user.uid, itemId, updates);
    let updatedItems = items.map((i) => (i.id === itemId ? { ...i, ...updates } : i));

    // Cascade: marking a project "done" marks all its subtasks "done"
    if (updates.status === "done") {
      const item = items.find((i) => i.id === itemId);
      if (item?.type === "project") {
        const children = items.filter((i) => i.parentId === itemId && i.status !== "done");
        for (const child of children) {
          await updateItem(user.uid, child.id, { status: "done" });
        }
        updatedItems = updatedItems.map((i) =>
          i.parentId === itemId ? { ...i, status: "done" } : i
        );
      }
    }

    setItems(updatedItems);
    if (selectedItem?.id === itemId) setSelectedItem((prev) => ({ ...prev, ...updates }));
  };

  const handleDelete = async (itemId) => {
    // Also delete child subtasks if it's a project
    const item = items.find((i) => i.id === itemId);
    if (item?.type === "project") {
      const children = items.filter((i) => i.parentId === itemId);
      for (const child of children) {
        await deleteItem(user.uid, child.id);
      }
    }
    await deleteItem(user.uid, itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId && i.parentId !== itemId));
    if (selectedItem?.id === itemId) setSelectedItem(null);
  };

  // Open create modal with pre-set parent (for adding subtask to project)
  const handleAddSubtaskToProject = (projectId) => {
    setCreateDefaults({ parentId: projectId, type: "subtask" });
    setShowCreate(true);
  };

  const projects = getProjects(items);
  const activeItems = activeView === "Planning" ? getPlanningItems(items) : getActiveItems(items);

  const filteredItems = activeProject
    ? activeItems.filter((i) => i.id === activeProject || i.parentId === activeProject)
    : activeItems;

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
            <h1>{activeView === "Planning" ? "Planning" : "Projects"}</h1>
            <p>{activeView === "Planning" ? "Items under consideration — not yet committed." : "Manage projects, tasks, and events."}</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Item
          </button>
        </div>

        {activeView !== "Planning" && projects.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${!activeProject ? "btn-primary" : ""}`} onClick={() => setActiveProject(null)}>All</button>
            {projects.map((p) => (
              <button key={p.id} className={`btn btn-sm ${activeProject === p.id ? "btn-primary" : ""}`}
                onClick={() => setActiveProject(p.id)}
                style={activeProject !== p.id ? { borderLeft: `3px solid ${p.color}` } : {}}
              >{p.title}</button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 0, marginTop: 12, borderBottom: "1px solid var(--border)" }}>
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setActiveView(v)} style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
              color: activeView === v ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeView === v ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s",
            }}>{v}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ position: "relative" }}>
        {showCreate && (
          <CreateItemModal
            projects={projects} activeProject={activeProject}
            defaultStatus={activeView === "Planning" ? "planning" : "todo"}
            defaults={createDefaults}
            onCreate={handleCreate} onClose={() => { setShowCreate(false); setCreateDefaults({}); }}
          />
        )}

        {activeView === "Board" && (
          <KanbanBoard items={filteredItems} allItems={items} projects={projects}
            onUpdate={handleUpdate} onSelect={setSelectedItem} onAddSubtask={handleAddSubtaskToProject} />
        )}
        {activeView === "Table" && (
          <TableView items={filteredItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} />
        )}
        {activeView === "Timeline" && (
          <GanttTimeline tasks={filteredItems} projects={projects} onUpdateTask={handleUpdate} onSelectTask={setSelectedItem} />
        )}
        {activeView === "Calendar" && (
          <CalendarView tasks={filteredItems} projects={projects} onSelectTask={setSelectedItem} googleAccessToken={googleAccessToken} />
        )}
        {activeView === "Planning" && (
          <TableView items={filteredItems} projects={projects} onUpdate={handleUpdate} onSelect={setSelectedItem} />
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
