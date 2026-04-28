import { createClient, SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export function getSupabaseServer(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
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

  if (!res.ok) {
    throw new Error("Failed to refresh Google token");
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function getValidToken(supabase: SupabaseClient, userId: string): Promise<string> {
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

  throw new Error("No valid token available. Please re-login.");
}