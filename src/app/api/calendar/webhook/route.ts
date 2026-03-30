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

  if (user.google_access_token && expiresAt > now) {
    return user.google_access_token;
  }

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

  throw new Error("No valid token");
}

async function syncCalendarEvents(supabase: any, userId: string, token: string) {
  // Get events from the last 30 days to next 90 days
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 90);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) return;

  const data = await res.json();
  const gcalEvents = data.items || [];

  // Get existing projects with gcal_event_id for this user
  const { data: existingProjects } = await supabase
    .from("projects")
    .select("id, gcal_event_id")
    .eq("owner_id", userId)
    .not("gcal_event_id", "is", null);

  const existingMap = new Map(
    (existingProjects || []).map((p: any) => [p.gcal_event_id, p.id])
  );

  for (const event of gcalEvents) {
    if (!event.summary) continue;

    let startDate = "";
    let endDate = "";
    let startTime: string | null = null;
    let endTime: string | null = null;

    if (event.start.dateTime) {
      const s = new Date(event.start.dateTime);
      startDate = s.toISOString().split("T")[0];
      startTime = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
    } else if (event.start.date) {
      startDate = event.start.date;
    }

    if (event.end.dateTime) {
      const e = new Date(event.end.dateTime);
      endDate = e.toISOString().split("T")[0];
      endTime = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
    } else if (event.end.date) {
      const e = new Date(event.end.date);
      e.setDate(e.getDate() - 1);
      endDate = e.toISOString().split("T")[0];
    }

    if (existingMap.has(event.id)) {
      // Update existing project
      await supabase
        .from("projects")
        .update({
          name: event.summary,
          start_date: startDate,
          end_date: endDate || startDate,
          start_time: startTime,
          end_time: endTime,
          location: event.location || "",
          memo: event.description || "",
        })
        .eq("id", existingMap.get(event.id));
    }
    // Note: We don't auto-create new events from webhook to avoid duplicates
    // Users can manually import via the UI
  }

  // Handle deleted events: check if any synced projects no longer exist in Google
  const gcalEventIds = new Set(gcalEvents.map((e: any) => e.id));
  for (const [gcalId, projectId] of existingMap) {
    if (!gcalEventIds.has(gcalId)) {
      // Event was deleted from Google Calendar, mark or delete in ShiftConnect
      await supabase.from("projects").delete().eq("id", projectId);
    }
  }
}

// POST handler for Google Push Notification
export async function POST(request: Request) {
  try {
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    // Ignore sync messages (initial verification)
    if (resourceState === "sync") {
      return NextResponse.json({ ok: true });
    }

    if (!channelId) {
      return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
    }

    // channelId format: "user-{userId}"
    const userId = channelId.replace("user-", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const token = await getValidToken(supabase, userId);
    await syncCalendarEvents(supabase, userId, token);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET handler for verification
export async function GET() {
  return NextResponse.json({ status: "Calendar webhook endpoint active" });
}