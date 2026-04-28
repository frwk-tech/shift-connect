import { NextResponse } from "next/server";
import { getSupabaseServer, getValidToken } from "@/lib/google";

async function syncCalendarEvents(supabase: any, userId: string, token: string) {
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
  }

  const gcalEventIds = new Set(gcalEvents.map((e: any) => e.id));
  for (const [gcalId, projectId] of existingMap) {
    if (!gcalEventIds.has(gcalId)) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
  }
}

export async function POST(request: Request) {
  try {
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    if (resourceState === "sync") {
      return NextResponse.json({ ok: true });
    }

    if (!channelId) {
      return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
    }

    const userId = channelId.replace("user-", "");
    const supabase = getSupabaseServer();
    const token = await getValidToken(supabase, userId);
    await syncCalendarEvents(supabase, userId, token);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Calendar webhook endpoint active" });
}