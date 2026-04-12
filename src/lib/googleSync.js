// Google Calendar + Tasks API client
// Uses the user's OAuth access token from Firebase Auth
// All calls are client-side — no server relay needed since we have the token

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";
const GTASKS_BASE = "https://www.googleapis.com/tasks/v1";

// ===== GOOGLE CALENDAR =====

export async function createCalendarEvent(accessToken, item) {
  const event = itemToCalendarEvent(item);
  const res = await fetch(`${GCAL_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Calendar create failed: ${res.status}`);
  return res.json();
}

export async function updateCalendarEvent(accessToken, eventId, item) {
  const event = itemToCalendarEvent(item);
  const res = await fetch(`${GCAL_BASE}/calendars/primary/events/${eventId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Calendar update failed: ${res.status}`);
  return res.json();
}

export async function deleteCalendarEvent(accessToken, eventId) {
  const res = await fetch(`${GCAL_BASE}/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Calendar delete failed: ${res.status}`);
}

export async function getCalendarEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 30 * 86400000).toISOString(),
    maxResults: "250",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(`${GCAL_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// ===== GOOGLE TASKS =====

export async function createGoogleTask(accessToken, item, taskListId = "@default") {
  const task = itemToGoogleTask(item);
  const res = await fetch(`${GTASKS_BASE}/lists/${taskListId}/tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Tasks create failed: ${res.status}`);
  return res.json();
}

export async function updateGoogleTask(accessToken, taskId, item, taskListId = "@default") {
  const task = itemToGoogleTask(item);
  const res = await fetch(`${GTASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Tasks update failed: ${res.status}`);
  return res.json();
}

export async function deleteGoogleTask(accessToken, taskId, taskListId = "@default") {
  const res = await fetch(`${GTASKS_BASE}/lists/${taskListId}/tasks/${taskId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Tasks delete failed: ${res.status}`);
}

export async function getGoogleTasks(accessToken, taskListId = "@default") {
  const params = new URLSearchParams({ maxResults: "100", showCompleted: "true" });
  const res = await fetch(`${GTASKS_BASE}/lists/${taskListId}/tasks?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Tasks fetch failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// ===== SYNC ENGINE =====

// Push a Hub item to Google (create or update)
export async function syncItemToGoogle(accessToken, item, updateItemCallback) {
  if (!accessToken) return;

  try {
    if (item.type === "event" || item.timeBlock) {
      // Sync as calendar event
      if (item.googleCalendarEventId) {
        await updateCalendarEvent(accessToken, item.googleCalendarEventId, item);
      } else {
        const created = await createCalendarEvent(accessToken, item);
        await updateItemCallback({ googleCalendarEventId: created.id });
      }
    } else if (item.type === "task" || item.type === "subtask") {
      // Sync as Google Task
      if (item.googleTaskId) {
        await updateGoogleTask(accessToken, item.googleTaskId, item);
      } else {
        const created = await createGoogleTask(accessToken, item);
        await updateItemCallback({ googleTaskId: created.id });
      }
    }
  } catch (err) {
    console.error("Google sync error:", err);
  }
}

// Remove from Google when deleted locally
export async function unsyncItemFromGoogle(accessToken, item) {
  if (!accessToken) return;
  try {
    if (item.googleCalendarEventId) await deleteCalendarEvent(accessToken, item.googleCalendarEventId);
    if (item.googleTaskId) await deleteGoogleTask(accessToken, item.googleTaskId);
  } catch (err) {
    console.error("Google unsync error:", err);
  }
}

// ===== CONVERTERS =====

function itemToCalendarEvent(item) {
  const event = {
    summary: item.title,
    description: [item.description, item.notes].filter(Boolean).join("\n\n"),
    location: item.location || undefined,
  };

  // Time
  if (item.timeBlock?.date) {
    if (item.allDay) {
      event.start = { date: item.timeBlock.date };
      event.end = { date: item.timeBlock.date };
    } else {
      event.start = { dateTime: `${item.timeBlock.date}T${item.timeBlock.startTime || "09:00"}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      event.end = { dateTime: `${item.timeBlock.date}T${item.timeBlock.endTime || "10:00"}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    }
  } else if (item.startDate || item.dueDate) {
    const date = item.startDate || item.dueDate;
    event.start = { date };
    event.end = { date: item.dueDate || date };
  }

  // Reminders
  if (item.reminders?.length > 0) {
    event.reminders = { useDefault: false, overrides: item.reminders };
  }

  // Recurrence
  if (item.recurrence) {
    event.recurrence = [item.recurrence];
  }

  // Attendees
  if (item.attendees?.length > 0) {
    event.attendees = item.attendees;
  }

  // Conference
  if (item.conferenceLink) {
    event.conferenceData = { entryPoints: [{ entryPointType: "video", uri: item.conferenceLink }] };
  }

  // Color — map to Google Calendar color ID (1-11)
  const colorMap = { "#2563eb": "9", "#7c3aed": "3", "#059669": "10", "#d97706": "5", "#dc2626": "11", "#0891b2": "7", "#4f46e5": "9", "#be185d": "4" };
  if (item.color && colorMap[item.color]) {
    event.colorId = colorMap[item.color];
  }

  return event;
}

function itemToGoogleTask(item) {
  const task = {
    title: item.title,
    notes: [item.description, item.notes, item.location ? `📍 ${item.location}` : ""].filter(Boolean).join("\n"),
    status: item.status === "done" ? "completed" : "needsAction",
  };

  if (item.dueDate) {
    task.due = `${item.dueDate}T00:00:00.000Z`;
  }

  if (item.status === "done" && item.completedAt) {
    task.completed = item.completedAt;
  }

  return task;
}

// Convert Google Calendar event to Hub item format
export function calendarEventToItem(event) {
  const isAllDay = !!event.start?.date;
  const startDate = isAllDay ? event.start.date : event.start?.dateTime?.split("T")[0];
  const startTime = isAllDay ? null : event.start?.dateTime?.split("T")[1]?.slice(0, 5);
  const endTime = isAllDay ? null : event.end?.dateTime?.split("T")[1]?.slice(0, 5);

  return {
    type: "event",
    title: event.summary || "Untitled",
    description: event.description || "",
    location: event.location || "",
    status: event.status === "cancelled" ? "archived" : "todo",
    timeBlock: startDate ? { date: startDate, startTime: startTime || "", endTime: endTime || "" } : null,
    allDay: isAllDay,
    startDate: startDate || null,
    dueDate: startDate || null,
    googleCalendarEventId: event.id,
    attendees: event.attendees || [],
    conferenceLink: event.hangoutLink || null,
    recurrence: event.recurrence?.[0] || null,
    source: "google",
  };
}
