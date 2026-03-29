"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/");
        return;
      }
      setUser(authData.user);

      const { data } = await supabase
        .from("users")
        .select("last_name, first_name, avatar_url")
        .eq("id", authData.user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  const displayName =
    profile?.last_name && profile?.first_name
      ? `${profile.last_name} ${profile.first_name}`
      : user?.user_metadata?.full_name || user?.email;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)",
      }}
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-light text-blue-50" style={{ fontFamily: "'Georgia', serif" }}>
            Shift<span className="text-blue-400">Connect</span>
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-2 text-sm text-blue-200/50 hover:text-blue-200/80 transition-colors"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center text-xs text-blue-200">
                  {displayName?.charAt(0)}
                </div>
              )}
              {displayName}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-blue-200/30 hover:text-blue-200/60 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-light text-blue-50 mb-2">
          ようこそ、{displayName} さん
        </h2>
        <p className="text-sm text-blue-200/40 mb-10">
          ShiftConnectのダッシュボードです
        </p>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => router.push("/profile")}
            className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] text-left hover:border-blue-400/20 hover:bg-white/[0.04] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center mb-4 group-hover:bg-blue-400/20 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 10-16 0" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-blue-100 mb-1">プロフィール設定</h3>
            <p className="text-xs text-blue-200/35">氏名・生年月日などの基本情報を設定</p>
          </button>

          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] text-left opacity-40">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-200/40">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-blue-100/50 mb-1">コネクション</h3>
            <p className="text-xs text-blue-200/25">Coming Soon</p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] text-left opacity-40">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-200/40">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-blue-100/50 mb-1">スケジュール</h3>
            <p className="text-xs text-blue-200/25">Coming Soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}
