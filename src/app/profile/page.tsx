"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    last_name_kana: "",
    first_name_kana: "",
    gender: "",
    birth_date: "",
    room_preference: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/");
        return;
      }
      setUser(authData.user);

      const { data } = await supabase
        .from("users")
        .select("last_name, first_name, last_name_kana, first_name_kana, gender, birth_date, room_preference")
        .eq("id", authData.user.id)
        .single();

      if (data) {
        setForm({
          last_name: data.last_name || "",
          first_name: data.first_name || "",
          last_name_kana: data.last_name_kana || "",
          first_name_kana: data.first_name_kana || "",
          gender: data.gender || "",
          birth_date: data.birth_date || "",
          room_preference: data.room_preference || "",
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        ...form,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-blue-50 text-sm outline-none transition-all focus:border-blue-400/40 focus:bg-white/[0.06] focus:shadow-[0_0_16px_rgba(99,182,255,0.08)] placeholder:text-blue-200/25";

  const labelClass = "block text-sm text-blue-200/60 mb-1.5";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)",
      }}
    >
      <div
        className="w-full max-w-lg p-10 rounded-3xl border border-blue-400/10"
        style={{
          background: "rgba(13, 18, 36, 0.8)",
          backdropFilter: "blur(40px) saturate(1.4)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 120px rgba(99,182,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-light text-blue-50" style={{ fontFamily: "'Georgia', serif" }}>
              プロフィール設定
            </h1>
            <p className="text-xs text-blue-200/40 mt-1">{user?.email}</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-blue-200/40 hover:text-blue-200/70 transition-colors"
          >
            ← 戻る
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/15 to-transparent mb-8" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 姓名 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>姓</label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="山田"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>名</label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="太郎"
                className={inputClass}
              />
            </div>
          </div>

          {/* フリガナ */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>セイ</label>
              <input
                type="text"
                name="last_name_kana"
                value={form.last_name_kana}
                onChange={handleChange}
                placeholder="ヤマダ"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>メイ</label>
              <input
                type="text"
                name="first_name_kana"
                value={form.first_name_kana}
                onChange={handleChange}
                placeholder="タロウ"
                className={inputClass}
              />
            </div>
          </div>

          {/* 性別 */}
          <div>
            <label className={labelClass}>性別</label>
            <div className="flex gap-3">
              {[
                { value: "male", label: "男性" },
                { value: "female", label: "女性" },
                { value: "other", label: "その他" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 text-center py-3 rounded-xl border text-sm cursor-pointer transition-all ${
                    form.gender === opt.value
                      ? "border-blue-400/40 bg-blue-400/10 text-blue-200"
                      : "border-white/10 bg-white/[0.02] text-blue-200/40 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={form.gender === opt.value}
                    onChange={handleChange}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 生年月日 */}
          <div>
            <label className={labelClass}>生年月日</label>
            <input
              type="date"
              name="birth_date"
              value={form.birth_date}
              onChange={handleChange}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>

          {/* 部屋の希望 */}
          <div>
            <label className={labelClass}>宿泊時の部屋の希望</label>
            <div className="flex gap-3">
              {[
                { value: "non_smoking", label: "禁煙" },
                { value: "smoking", label: "喫煙" },
                { value: "any", label: "どちらでも" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 text-center py-3 rounded-xl border text-sm cursor-pointer transition-all ${
                    form.room_preference === opt.value
                      ? "border-blue-400/40 bg-blue-400/10 text-blue-200"
                      : "border-white/10 bg-white/[0.02] text-blue-200/40 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="room_preference"
                    value={opt.value}
                    checked={form.room_preference === opt.value}
                    onChange={handleChange}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-blue-400/15 to-transparent" />

          {/* 保存ボタン */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl text-sm font-medium tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: saved
                ? "linear-gradient(135deg, #059669 0%, #34d399 100%)"
                : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
              boxShadow: saved
                ? "0 8px 32px rgba(5,150,105,0.3)"
                : "0 8px 32px rgba(37,99,235,0.3)",
              color: "white",
            }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </span>
            ) : saved ? (
              "✓ 保存しました"
            ) : (
              "保存する"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
