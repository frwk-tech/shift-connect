"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-light mb-4">
          Shift<span className="text-blue-400">Connect</span>
        </h1>
        {user ? (
          <div>
            <p className="text-blue-200/70 mb-2">ログイン成功！</p>
            <p className="text-sm text-blue-200/50 mb-6">{user.email}</p>
            <button
              onClick={handleLogout}
              className="px-6 py-2 rounded-lg border border-white/10 text-sm text-blue-200/70 hover:bg-white/5 transition-colors"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <p className="text-blue-200/50">読み込み中...</p>
        )}
      </div>
    </div>
  );
}
