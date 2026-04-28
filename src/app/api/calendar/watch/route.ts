import { NextResponse } from "next/server";
import { getSupabaseServer, getValidToken } from "@/lib/google";

const WEBHOOK_URL = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/calendar/webhook`
  : process.env.WEBHOOK_URL || "https://shift-connect-td5s.vercel.app/api/calendar/webhook";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    const supabase = getSupabaseServer();
    const token = await getValidToken(supabase, userId);

    const channelId = `user-${userId}`;
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: WEBHOOK_URL,
          expiration: expiration,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Failed to register watch" },
        { status: 500 }
      );
    }

    await supabase
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      channelId: data.id,
      expiration: data.expiration,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}