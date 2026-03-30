import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token as string;
}

async function getValidToken(supabase: any, userId: string) {
  const { data: user } = await supabase
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", userId)
    .single();

  if (!user) throw new Error("User not found");

  const now = new Date();
  const expiresAt = new Date(user.google_token_expires_at);

  // If token is still valid, use it
  if (user.google_access_token && expiresAt > now) {
    return user.google_access_token;
  }

  // If expired, refresh it
  if (user.google_refresh_token) {
    const newToken = await refreshGoogleToken(user.google_refresh_token);
    await supabase
      .from("users")
      .update({
        google_access_token: newToken,
        google_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq("id", userId);
    return newToken;
  }

  throw new Error("No valid token available. Please re-login.");
}

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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const token = await getValidToken(supabase, userId);

    switch (action) {
      case "create": {
        const event = await createCalendarEvent(token, project);
        // Save gcal_event_id to project
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