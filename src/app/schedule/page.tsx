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
  gcal_event_id?: string;
};

type GCalEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  selected?: boolean;
};

export default function SchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
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

  async function fetchGCalEvents() {
    setImportLoading(true);
    setImportMessage("");

    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list",
          userId: user.id,
          timeMin: startOfMonth,
          timeMax: endOfMonth,
        }),
      });

      const result = await res.json();
      if (result.success && result.events) {
        // Filter out events already imported
        const existingGcalIds = projects
          .filter((p) => p.gcal_event_id)
          .map((p) => p.gcal_event_id);

        const newEvents = result.events
          .filter((e: GCalEvent) => !existingGcalIds.includes(e.id) && e.summary)
          .map((e: GCalEvent) => ({ ...e, selected: true }));

        setGcalEvents(newEvents);

        if (newEvents.length === 0) {
          setImportMessage("取り込み可能な新しい予定はありません");
        }
      } else {
        setImportMessage("Googleカレンダーの取得に失敗しました。再ログインしてください。");
      }
    } catch {
      setImportMessage("Googleカレンダーの取得に失敗しました");
    }

    setImportLoading(false);
  }

  async function importSelectedEvents() {
    const selected = gcalEvents.filter((e) => e.selected);
    if (selected.length === 0) return;

    setImportLoading(true);
    let imported = 0;

    for (const event of selected) {
      let startDate = "";
      let endDate = "";
      let startTime = "";
      let endTime = "";

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
        // All-day events: end date is exclusive, subtract 1 day
        const e = new Date(event.end.date);
        e.setDate(e.getDate() - 1);
        endDate = e.toISOString().split("T")[0];
      }

      const { error } = await supabase.from("projects").insert({
        owner_id: user.id,
        name: event.summary,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        location: event.location || "",
        memo: event.description || "",
        gcal_event_id: event.id,
        gcal_calendar_id: "primary",
        visibility: "private",
      });

      if (!error) imported++;
    }

    setImportMessage(`${imported}件の予定を取り込みました ✓`);
    setGcalEvents([]);
    setShowImport(false);
    loadData();
    setImportLoading(false);
    setTimeout(() => setImportMessage(""), 5000);
  }

  function toggleEventSelection(eventId: string) {
    setGcalEvents(
      gcalEvents.map((e) =>
        e.id === eventId ? { ...e, selected: !e.selected } : e
      )
    );
  }

  function toggleSelectAll() {
    const allSelected = gcalEvents.every((e) => e.selected);
    setGcalEvents(gcalEvents.map((e) => ({ ...e, selected: !allSelected })));
  }

  const formatEventTime = (event: GCalEvent) => {
    if (event.start.dateTime) {
      const s = new Date(event.start.dateTime);
      const e = new Date(event.end.dateTime!);
      return `${s.getMonth() + 1}/${s.getDate()} ${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")} 〜 ${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
    }
    if (event.start.date) {
      const s = new Date(event.start.date);
      return `${s.getMonth() + 1}/${s.getDate()} (終日)`;
    }
    return "";
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const getDayOfWeek = (day: number) => {
    return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month, day).getDay()];
  };

  const getDayColor = (day: number) => {
    const dow = new Date(year, month, day).getDay();
    if (dow === 0) return "text-red-400/70";
    if (dow === 6) return "text-blue-400/70";
    return "text-blue-200/40";
  };

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const getBarStyle = (project: Project) => {
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date || project.start_date);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);
    const barStart = startDate < monthStart ? 1 : startDate.getDate();
    const barEnd = endDate > monthEnd ? daysInMonth : endDate.getDate();
    const cellWidth = 48;
    return {
      left: `${(barStart - 1) * cellWidth}px`,
      width: `${(barEnd - barStart + 1) * cellWidth}px`,
    };
  };

  const formatTime = (t: string) => (t ? t.slice(0, 5) : "");

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dw = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${dw[d.getDay()]})`;
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
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all">
                ‹
              </button>
              <button onClick={goToday} className="px-3 h-8 rounded-lg border border-white/10 text-xs text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all">
                今日
              </button>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all">
                ›
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowImport(!showImport);
                if (!showImport) fetchGCalEvents();
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
              style={{
                background: showImport ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.04)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {showImport ? "閉じる" : "📅 Googleから取り込み"}
            </button>
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
        </div>

        {/* Import Message */}
        {importMessage && (
          <div
            className={`mb-6 px-5 py-3 rounded-xl text-sm ${
              importMessage.includes("✓")
                ? "bg-green-400/10 border border-green-400/20 text-green-400/80"
                : importMessage.includes("失敗") || importMessage.includes("ありません")
                ? "bg-amber-400/10 border border-amber-400/20 text-amber-400/80"
                : "bg-blue-400/10 border border-blue-400/20 text-blue-400/80"
            }`}
          >
            {importMessage}
          </div>
        )}

        {/* Google Calendar Import Panel */}
        {showImport && (
          <div
            className="mb-6 p-6 rounded-2xl border border-blue-400/10"
            style={{
              background: "rgba(13, 18, 36, 0.8)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-light text-blue-50">
                Googleカレンダーの予定（{year}年{month + 1}月）
              </h3>
              {gcalEvents.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
                >
                  {gcalEvents.every((e) => e.selected) ? "すべて解除" : "すべて選択"}
                </button>
              )}
            </div>

            {importLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
                <span className="ml-3 text-sm text-blue-200/40">読み込み中...</span>
              </div>
            ) : gcalEvents.length === 0 ? (
              <p className="text-sm text-blue-200/30 text-center py-6">
                取り込み可能な新しい予定はありません
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {gcalEvents.map((event) => (
                    <label
                      key={event.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        event.selected
                          ? "bg-blue-400/10 border border-blue-400/20"
                          : "bg-white/[0.02] border border-white/5 hover:border-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={event.selected || false}
                        onChange={() => toggleEventSelection(event.id)}
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-blue-100 truncate">{event.summary}</p>
                        <p className="text-xs text-blue-200/40">{formatEventTime(event)}</p>
                      </div>
                      {event.location && (
                        <span className="text-xs text-blue-200/30 truncate max-w-[150px]">
                          📍 {event.location}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <button
                  onClick={importSelectedEvents}
                  disabled={importLoading || gcalEvents.filter((e) => e.selected).length === 0}
                  className="w-full mt-4 py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
                    boxShadow: "0 8px 32px rgba(5,150,105,0.3)",
                  }}
                >
                  {gcalEvents.filter((e) => e.selected).length}件の予定を取り込む
                </button>
              </>
            )}
          </div>
        )}

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
              <div className="h-[72px] border-b border-white/5 flex items-end px-4 pb-2">
                <span className="text-xs text-blue-200/30">案件名</span>
              </div>
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-blue-100 truncate">{project.name}</span>
                      {project.gcal_event_id && (
                        <span className="text-[9px] text-green-400/50 flex-shrink-0">●</span>
                      )}
                    </div>
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
                      <span className={`text-[10px] ${getDayColor(day)}`}>{getDayOfWeek(day)}</span>
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
                      <div key={project.id} className="h-[52px] border-b border-white/5 relative">
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
                        <div
                          className="absolute top-[10px] h-[32px] rounded-lg flex items-center px-3 cursor-pointer transition-all hover:brightness-110 hover:shadow-lg"
                          style={{
                            ...barStyle,
                            background: project.gcal_event_id
                              ? "linear-gradient(135deg, #059669 0%, #34d399 100%)"
                              : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                            boxShadow: project.gcal_event_id
                              ? "0 2px 8px rgba(5,150,105,0.3)"
                              : "0 2px 8px rgba(37,99,235,0.3)",
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

        {today.getFullYear() === year && today.getMonth() === month && (
          <div className="mt-2 flex items-center justify-end gap-4 text-xs text-blue-200/30">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }} />
              ShiftConnect作成
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #059669, #34d399)" }} />
              Google取り込み
            </span>
            <span>● 今日: {today.getMonth() + 1}/{today.getDate()}</span>
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

            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-medium text-blue-50">{selectedProject.name}</h3>
              {selectedProject.gcal_event_id && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400/60 border border-green-400/15">
                  Google同期
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-sm text-blue-200/70">
                  {formatDateFull(selectedProject.start_date)}
                  {selectedProject.end_date && selectedProject.end_date !== selectedProject.start_date && (
                    <> 〜 {formatDateFull(selectedProject.end_date)}</>
                  )}
                </p>
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
