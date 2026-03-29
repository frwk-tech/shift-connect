"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  memo: string;
  status?: string;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    memo: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/");
      return;
    }
    setUser(authData.user);

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", authData.user.id)
      .order("start_date", { ascending: true });

    setProjects(data || []);
    setLoading(false);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date) return;
    setSaving(true);

    const { error } = await supabase.from("projects").insert({
      owner_id: user.id,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location,
      memo: form.memo,
      visibility: "private",
    });

    setSaving(false);
    if (!error) {
      setForm({ name: "", start_date: "", end_date: "", start_time: "", end_time: "", location: "", memo: "" });
      setShowForm(false);
      loadData();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
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
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)",
      }}
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xl font-light text-blue-50"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Shift<span className="text-blue-400">Connect</span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-blue-200/40 hover:text-blue-200/70 transition-colors"
          >
            ← ダッシュボードに戻る
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Title + Add Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-light text-blue-50">案件管理</h2>
            <p className="text-sm text-blue-200/40 mt-1">案件の作成・管理ができます</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: showForm
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
              color: "white",
              border: showForm ? "1px solid rgba(255,255,255,0.1)" : "none",
              boxShadow: showForm ? "none" : "0 8px 32px rgba(37,99,235,0.3)",
            }}
          >
            {showForm ? "キャンセル" : "+ 新規案件"}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div
            className="mb-8 p-8 rounded-2xl border border-blue-400/10"
            style={{
              background: "rgba(13, 18, 36, 0.8)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
            }}
          >
            <h3 className="text-lg font-light text-blue-50 mb-6">新規案件の作成</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelClass}>案件名 *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="例：〇〇フェスティバル 映像演出"
                  className={inputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>開始日 *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    className={`${inputClass} [color-scheme:dark]`}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>終了日</label>
                  <input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>開始時間</label>
                  <input
                    type="time"
                    name="start_time"
                    value={form.start_time}
                    onChange={handleChange}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className={labelClass}>終了時間</label>
                  <input
                    type="time"
                    name="end_time"
                    value={form.end_time}
                    onChange={handleChange}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>場所</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="例：幕張メッセ ホール4"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>メモ</label>
                <textarea
                  name="memo"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="案件の詳細やメモ"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !form.name || !form.start_date}
                className="w-full py-3.5 rounded-xl text-sm font-medium tracking-wide text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                  boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
                }}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    作成中...
                  </span>
                ) : (
                  "案件を作成"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Project List */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-200/20">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-sm text-blue-200/30">まだ案件がありません</p>
            <p className="text-xs text-blue-200/20 mt-1">「+ 新規案件」から作成してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-blue-400/15 hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-blue-100 mb-2">{project.name}</h3>
                    <div className="flex items-center gap-4 text-xs text-blue-200/40">
                      <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {formatDate(project.start_date)}
                        {project.end_date && project.end_date !== project.start_date && ` 〜 ${formatDate(project.end_date)}`}
                      </span>
                      {project.start_time && (
                        <span className="flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {formatTime(project.start_time)}
                          {project.end_time && ` 〜 ${formatTime(project.end_time)}`}
                        </span>
                      )}
                      {project.location && (
                        <span className="flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {project.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {project.memo && (
                  <p className="mt-3 text-xs text-blue-200/30 border-t border-white/5 pt-3">{project.memo}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
