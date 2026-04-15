import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/calendar-sync
 *
 * Syncs YouTube content calendar events to Google Calendar.
 * Creates a "YouTube Uploads" calendar and adds events.
 *
 * Body: { events: [{ title, date, type, channelName }], calendarName }
 * Requires Authorization header with calendar.events scope.
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    const { events = [], calendarName = "YouTube Uploads" } = await request.json();

    if (events.length === 0) {
      return NextResponse.json({ error: "No events to sync" }, { status: 400 });
    }

    /* ── 1. Find or create the YouTube calendar ── */
    let calendarId = null;

    // List existing calendars
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      const existing = (listData.items || []).find(
        (cal) => cal.summary === calendarName
      );
      if (existing) {
        calendarId = existing.id;
      }
    }

    // Create if it doesn't exist
    if (!calendarId) {
      const createRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: calendarName,
            description: "YouTube upload schedule synced from Antigravity Hub",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
          }),
        }
      );

      if (!createRes.ok) {
        const err = await createRes.text();
        return NextResponse.json({
          error: `Failed to create calendar: ${createRes.status}`,
          detail: err,
        }, { status: createRes.status });
      }

      const createData = await createRes.json();
      calendarId = createData.id;
    }

    /* ── 2. Create events ── */
    const results = [];
    const typeEmoji = {
      longform: "🎬",
      shorts: "📱",
      podcast: "🎙️",
      live: "🔴",
      community: "📝",
    };

    for (const event of events) {
      try {
        const emoji = typeEmoji[event.type] || "🎬";
        const eventBody = {
          summary: `${emoji} ${event.title}`,
          description: `YouTube ${event.type || "video"} upload${event.channelName ? ` for ${event.channelName}` : ""}\n\nManaged by Antigravity Hub`,
          start: {
            date: event.date, // All-day event
          },
          end: {
            date: event.date,
          },
          colorId: event.type === "shorts" ? "6" : event.type === "live" ? "11" : "9",
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 1440 }, // 1 day before
              { method: "popup", minutes: 60 },   // 1 hour before
            ],
          },
        };

        const eventRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          }
        );

        if (eventRes.ok) {
          const eventData = await eventRes.json();
          results.push({
            success: true,
            title: event.title,
            googleEventId: eventData.id,
            htmlLink: eventData.htmlLink,
          });
        } else {
          const err = await eventRes.text();
          results.push({ success: false, title: event.title, error: err });
        }
      } catch (err) {
        results.push({ success: false, title: event.title, error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;

    return NextResponse.json({
      calendarId,
      calendarName,
      synced: succeeded,
      total: events.length,
      results,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[YOUTUBE/CALENDAR-SYNC] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
