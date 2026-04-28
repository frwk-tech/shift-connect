import { NextResponse } from "next/server";
import { getSupabaseServer, getValidToken } from "@/lib/google";

async function createCalendarEvent(token: string, project: any) {
  const event: any = {
    summary: project.name,
    location: project.location || "",
    description: project.memo || "",
  };

  if (project.start_time) {
    event.start = {
      dateTime: `${project.start_date}T${project.start_time}:00`,
      timeZone: "Asia/Tokyo",
    };
    event.end = {
      dateTime: `${project.end_date || project.start_date}T${project.end_time || project.start_time}:00`,
      timeZone: "Asia/Tokyo",
    };
  } else {
    event.start = { date: project.start_date };
    event.end = {
      date: project.end_date
        ? new Date(new Date(project.end_date).getTime() + 86400000).toISOString().split("T")[0]
        : new Date(new Date(project.start_date).getTime() + 86400000).toISOString().split("T")[0],
    };
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create event");
  }

  return await res.json();
}

async function updateCalendarEvent(token: string, eventId: string, project: any) {
  const event: any = {
    summary: project.name,
    location: project.location || "",
    description: project.memo || "",
  };

  if (project.start_time) {
    event.start = {
      dateTime: `${project.start_date}T${project.start_time}:00`,
      timeZone: "Asia/Tokyo",
    };
    event.end = {
      dateTime: `${project.end_date || project.start_date}T${project.end_time || project.start_time}:00`,
      timeZone: "Asia/Tokyo",
    };
  } else {
    event.start = { date: project.start_date };
    event.end = {
      date: project.end_date
        ? new Date(new Date(project.end_date).getTime() + 86400000).toISOString().split("T")[0]
        : new Date(new Date(project.start_date).getTime() + 86400000).toISOString().split("T")[0],
    };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to update event");
  }

  return await res.json();
}

async function deleteCalendarEvent(token: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error("Failed to delete event");
  }
}

async function listCalendarEvents(token: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin: `${timeMin}T00:00:00+09:00`,
    timeMax: `${timeMax}T23:59:59+09:00`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to list events");
  }

  return await res.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, project, eventId, timeMin, timeMax } = body;

    const supabase = getSupabaseServer();
    const token = await getValidToken(supabase, userId);

    switch (action) {
      case "create": {
        const event = await createCalendarEvent(token, project);
        if (project.id) {
          await supabase
            .from("projects")
            .update({ gcal_event_id: event.id, gcal_calendar_id: "primary" })
            .eq("id", project.id);
        }
        return NextResponse.json({ success: true, eventId: event.id });
      }

      case "update": {
        await updateCalendarEvent(token, eventId, project);
        return NextResponse.json({ success: true });
      }

      case "delete": {
        await deleteCalendarEvent(token, eventId);
        return NextResponse.json({ success: true });
      }

      case "list": {
        const events = await listCalendarEvents(token, timeMin, timeMax);
        return NextResponse.json({ success: true, events: events.items || [] });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}