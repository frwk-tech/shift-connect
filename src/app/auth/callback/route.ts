import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.session) {
      const session = sessionData.session;
      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;

      // Save Google tokens to users table
      if (providerToken) {
        await supabase
          .from("users")
          .update({
            google_access_token: providerToken,
            google_refresh_token: providerRefreshToken || undefined,
            google_token_expires_at: new Date(
              Date.now() + 3600 * 1000
            ).toISOString(),
          })
          .eq("id", session.user.id);
      }
    }
  }

  return NextResponse.redirect(`${origin}/schedule`);
}