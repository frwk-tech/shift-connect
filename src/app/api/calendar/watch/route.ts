import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const WEBHOOK_URL = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/calendar/webhook`
  : process.env.WEBHOOK_URL || "https://shift-connect-td5s.vercel.app/api/calendar/webhook";

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

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const token = await getValidToken(supabase, userId);

    // Register watch on primary calendar
    const channelId = `user-${userId}`;
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

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

    // Save watch info to user record
    await supabase
      .from("users")
      .update({
        updated_at: new Date().toISOString(),
      })
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