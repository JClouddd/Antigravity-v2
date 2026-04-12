// Automation Rules Engine
// Evaluates rules against items and executes actions

const RULE_TYPES = [
  {
    id: "auto_complete_project",
    label: "Auto-complete project when all subtasks done",
    trigger: "subtask_completed",
    evaluate: (items, changedItem) => {
      if (changedItem.type !== "subtask" || changedItem.status !== "done") return null;
      const parent = items.find(i => i.id === changedItem.parentId && i.type === "project");
      if (!parent) return null;
      const siblings = items.filter(i => i.parentId === parent.id && i.type === "subtask");
      const allDone = siblings.every(s => s.status === "done");
      if (allDone) return { itemId: parent.id, updates: { status: "done", completedAt: new Date().toISOString() } };
      return null;
    },
  },
  {
    id: "auto_complete_past_event",
    label: "Auto-complete events after their end time",
    trigger: "time_check",
    evaluate: (items) => {
      const now = new Date();
      const results = [];
      for (const item of items) {
        if (item.type !== "event" || item.status === "done") continue;
        if (item.timeBlock?.date && item.timeBlock?.endTime) {
          const end = new Date(`${item.timeBlock.date}T${item.timeBlock.endTime}:00`);
          if (end < now) results.push({ itemId: item.id, updates: { status: "done", completedAt: now.toISOString() } });
        } else if (item.dueDate) {
          const due = new Date(item.dueDate + "T23:59:59");
          if (due < now) results.push({ itemId: item.id, updates: { status: "done", completedAt: now.toISOString() } });
        }
      }
      return results;
    },
  },
  {
    id: "escalate_overdue",
    label: "Escalate overdue tasks to urgent priority",
    trigger: "time_check",
    config: { daysThreshold: 3 },
    evaluate: (items, _, config) => {
      const threshold = (config?.daysThreshold || 3) * 86400000;
      const now = Date.now();
      const results = [];
      for (const item of items) {
        if (item.status === "done" || item.priority === "urgent") continue;
        if (item.dueDate) {
          const due = new Date(item.dueDate).getTime();
          if (due + threshold < now) results.push({ itemId: item.id, updates: { priority: "urgent" } });
        }
      }
      return results;
    },
  },
  {
    id: "auto_progress",
    label: "Move to in-progress when timer starts",
    trigger: "timer_start",
    evaluate: (items, changedItem) => {
      if (changedItem.status === "todo") {
        return { itemId: changedItem.id, updates: { status: "in_progress" } };
      }
      return null;
    },
  },
];

export function getAvailableRules() {
  return RULE_TYPES.map(r => ({ id: r.id, label: r.label, config: r.config || null }));
}

// Run all enabled rules against current items
export function evaluateRules(items, changedItem, enabledRules, trigger = "subtask_completed") {
  const results = [];
  for (const rule of RULE_TYPES) {
    if (!enabledRules?.includes(rule.id)) continue;
    if (rule.trigger !== trigger) continue;
    const config = enabledRules.find(r => typeof r === "object" && r.id === rule.id)?.config;
    const result = rule.evaluate(items, changedItem, config);
    if (result) {
      if (Array.isArray(result)) results.push(...result);
      else results.push(result);
    }
  }
  return results;
}

// Time-based rules (run periodically)
export function evaluateTimeRules(items, enabledRules) {
  return evaluateRules(items, null, enabledRules, "time_check");
}
