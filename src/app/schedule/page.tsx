"use client";

import { useState, useEffect, useRef } from "react";
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
};

export default function SchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();

  useEffect(() => {
    loadData();
  }, [currentDate]);

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/");
      return;
    }
    setUser(authData.user);

    // Save Google tokens if available in session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const session = sessionData.session;
      if (session.provider_token) {
        await supabase
          .from("users")
          .update({
            google_access_token: session.provider_token,
            google_refresh_token: session.provider_refresh_token || undefined,
            google_token_expires_at: new Date(
              Date.now() + 3600 * 1000
            ).toISOString(),
          })
          .eq("id", authData.user.id);
      }
    }

    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", authData.user.id)
      .or(`and(start_date.lte.${endOfMonth},end_date.gte.${startOfMonth})`)
      .order("start_date", { ascending: true });

    setProjects(data || []);
    setLoading(false);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const getDayOfWeek = (day: number) => {
    const d = new Date(year, month, day);
    return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  };

  const getDayColor = (day: number) => {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    if (dow === 0) return "text-red-400/70";
    if (dow === 6) return "text-blue-400/70";
    return "text-blue-200/40";
  };

  const isToday = (day: number) => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const getBarStyle = (project: Project) => {
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date || project.start_date);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);

    const barStart = startDate < monthStart ? 1 : startDate.getDate();
    const barEnd = endDate > monthEnd ? daysInMonth : endDate.getDate();

    const cellWidth = 48;
    const left = (barStart - 1) * cellWidth;
    const width = (barEnd - barStart + 1) * cellWidth;

    return { left: `${left}px`, width: `${width}px` };
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
  };

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  const cellWidth = 48;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)",
      }}
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
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

      <main className="px-6 py-8">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-light text-blue-50">
              {year}年 {month + 1}月
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all"
              >
                ‹
              </button>
              <button
                onClick={goToday}
                className="px-3 h-8 rounded-lg border border-white/10 text-xs text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all"
              >
                今日
              </button>
              <button
                onClick={nextMonth}
                className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all"
              >
                ›
              </button>
            </div>
          </div>
          <button
            onClick={() => router.push("/projects")}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
              boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
            }}
          >
            + 新規案件
          </button>
        </div>

        {/* Gantt Chart */}
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{
            background: "rgba(13, 18, 36, 0.6)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex">
            {/* Left: Project Names */}
            <div className="flex-shrink-0 w-[200px] border-r border-white/5 z-10">
              {/* Header cell */}
              <div className="h-[72px] border-b border-white/5 flex items-end px-4 pb-2">
                <span className="text-xs text-blue-200/30">案件名</span>
              </div>
              {/* Project rows */}
              {projects.length === 0 ? (
                <div className="h-[60px] flex items-center px-4">
                  <span className="text-xs text-blue-200/20">案件がありません</span>
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="h-[52px] border-b border-white/5 flex items-center px-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setSelectedProject(project)}
                  >
                    <span className="text-sm text-blue-100 truncate">{project.name}</span>
                  </div>
                ))
              )}
            </div>

            {/* Right: Gantt Grid */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ minWidth: `${daysInMonth * cellWidth}px` }}>
                {/* Date Header */}
                <div className="h-[72px] border-b border-white/5 flex">
                  {days.map((day) => (
                    <div
                      key={day}
                      className={`flex-shrink-0 flex flex-col items-center justify-end pb-2 ${
                        isToday(day) ? "bg-blue-400/5" : ""
                      }`}
                      style={{ width: `${cellWidth}px` }}
                    >
                      <span className={`text-[10px] ${getDayColor(day)}`}>
                        {getDayOfWeek(day)}
                      </span>
                      <span
                        className={`text-sm mt-0.5 ${
                          isToday(day)
                            ? "text-blue-400 font-medium bg-blue-400/20 w-7 h-7 rounded-full flex items-center justify-center"
                            : getDayColor(day)
                        }`}
                      >
                        {day}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Project Bars */}
                {projects.length === 0 ? (
                  <div className="h-[60px]" />
                ) : (
                  projects.map((project) => {
                    const barStyle = getBarStyle(project);
                    return (
                      <div
                        key={project.id}
                        className="h-[52px] border-b border-white/5 relative"
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex">
                          {days.map((day) => (
                            <div
                              key={day}
                              className={`flex-shrink-0 border-r border-white/[0.03] ${
                                isToday(day) ? "bg-blue-400/5" : ""
                              } ${
                                new Date(year, month, day).getDay() === 0
                                  ? "bg-red-400/[0.02]"
                                  : new Date(year, month, day).getDay() === 6
                                  ? "bg-blue-400/[0.02]"
                                  : ""
                              }`}
                              style={{ width: `${cellWidth}px` }}
                            />
                          ))}
                        </div>

                        {/* Bar */}
                        <div
                          className="absolute top-[10px] h-[32px] rounded-lg flex items-center px-3 cursor-pointer transition-all hover:brightness-110 hover:shadow-lg"
                          style={{
                            ...barStyle,
                            background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                            boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                          }}
                          onClick={() => setSelectedProject(project)}
                        >
                          <span className="text-[11px] text-white font-medium truncate">
                            {project.name}
                            {project.start_time && ` ${formatTime(project.start_time)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Today line indicator */}
        {today.getFullYear() === year && today.getMonth() === month && (
          <div className="mt-2 text-xs text-blue-400/40 text-right">
            ● 今日: {today.getMonth() + 1}/{today.getDate()}
          </div>
        )}
      </main>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedProject(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md p-8 rounded-2xl border border-blue-400/10"
            style={{
              background: "rgba(13, 18, 36, 0.95)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute top-4 right-4 text-blue-200/30 hover:text-blue-200/60 transition-colors"
            >
              ✕
            </button>

            <h3 className="text-lg font-medium text-blue-50 mb-4">{selectedProject.name}</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div>
                  <p className="text-sm text-blue-200/70">
                    {formatDateFull(selectedProject.start_date)}
                    {selectedProject.end_date && selectedProject.end_date !== selectedProject.start_date && (
                      <> 〜 {formatDateFull(selectedProject.end_date)}</>
                    )}
                  </p>
                </div>
              </div>

              {selectedProject.start_time && (
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p className="text-sm text-blue-200/70">
                    {formatTime(selectedProject.start_time)}
                    {selectedProject.end_time && ` 〜 ${formatTime(selectedProject.end_time)}`}
                  </p>
                </div>
              )}

              {selectedProject.location && (
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <p className="text-sm text-blue-200/70">{selectedProject.location}</p>
                </div>
              )}

              {selectedProject.memo && (
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <p className="text-sm text-blue-200/70">{selectedProject.memo}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  setSelectedProject(null);
                  router.push("/projects");
                }}
                className="w-full py-2.5 rounded-xl text-sm text-blue-200/50 border border-white/10 hover:bg-white/[0.04] hover:text-blue-200/70 transition-all"
              >
                案件管理で編集
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
