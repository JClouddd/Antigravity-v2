"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getProjects, createProject, getTasks, createTask, updateTask, deleteTask } from "@/lib/projects";
import KanbanBoard from "./KanbanBoard";
import GanttTimeline from "./GanttTimeline";
import CalendarView from "./CalendarView";
import TaskDetailSheet from "./TaskDetailSheet";

const VIEWS = ["Board", "Timeline", "Calendar"];

export default function ProjectHub() {
  const { user, googleAccessToken } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeView, setActiveView] = useState("Board");
  const [activeProject, setActiveProject] = useState(null); // null = all
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [p, t] = await Promise.all([
        getProjects(user.uid),
        getTasks(user.uid),
      ]);
      setProjects(p);
      setTasks(t);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    const p = await createProject(user.uid, { title: newProjectTitle.trim() });
    if (p) {
      setProjects((prev) => [p, ...prev]);
      setNewProjectTitle("");
      setShowNewProject(false);
    }
  };

  const handleCreateTask = async (data) => {
    const task = await createTask(user.uid, {
      ...data,
      projectId: activeProject,
    });
    if (task) {
      setTasks((prev) => [...prev, task]);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    await updateTask(user.uid, taskId, updates);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({ ...prev, ...updates }));
    }
  };

  const handleDeleteTask = async (taskId) => {
    await deleteTask(user.uid, taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);
  };

  const filteredTasks = activeProject
    ? tasks.filter((t) => t.projectId === activeProject)
    : tasks;

  if (loading) return <div className="spinner" />;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>Projects</h1>
            <p>Manage tasks, timelines, and schedules.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>

        {/* Project Filter Chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            className={`btn btn-sm ${!activeProject ? "btn-primary" : ""}`}
            onClick={() => setActiveProject(null)}
          >
            All
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className={`btn btn-sm ${activeProject === p.id ? "btn-primary" : ""}`}
              onClick={() => setActiveProject(p.id)}
              style={activeProject !== p.id ? { borderLeft: `3px solid ${p.color}` } : {}}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                background: "none",
                color: activeView === v ? "var(--accent)" : "var(--text-secondary)",
                borderBottom: activeView === v ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ position: "relative" }}>
        {/* New Project Modal */}
        {showNewProject && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
          }} onClick={() => setShowNewProject(false)}>
            <div className="card" style={{ width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>New Project</h3>
              <input
                type="text"
                placeholder="Project name..."
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                <button className="btn btn-sm" onClick={() => setShowNewProject(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={handleCreateProject}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Views */}
        {activeView === "Board" && (
          <KanbanBoard
            tasks={filteredTasks}
            projects={projects}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onSelectTask={setSelectedTask}
          />
        )}
        {activeView === "Timeline" && (
          <GanttTimeline
            tasks={filteredTasks}
            projects={projects}
            onUpdateTask={handleUpdateTask}
            onSelectTask={setSelectedTask}
          />
        )}
        {activeView === "Calendar" && (
          <CalendarView
            tasks={filteredTasks}
            projects={projects}
            onSelectTask={setSelectedTask}
            googleAccessToken={googleAccessToken}
          />
        )}

        {/* Task Detail */}
        {selectedTask && (
          <TaskDetailSheet
            task={selectedTask}
            tasks={tasks}
            projects={projects}
            onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
            onDelete={() => handleDeleteTask(selectedTask.id)}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </div>
    </>
  );
}
