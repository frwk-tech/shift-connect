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

type Org = {
  id: string;
  name: string;
};

export default function SchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    memo: "",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const watchRegistered = useRef(false);

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

    // Load profile
    const { data: profileData } = await supabase
      .from("users")
      .select("last_name, first_name, avatar_url")
      .eq("id", authData.user.id)
      .single();
    setProfile(profileData);

    // Load orgs
    const { data: memberData } = await supabase
      .from("organization_members")
      .select("organizations(id, name)")
      .eq("user_id", authData.user.id);
    if (memberData) {
      setOrgs(memberData.map((m: any) => m.organizations));
    }

    // Save Google tokens if available
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.provider_token) {
      await supabase
        .from("users")
        .update({
          google_access_token: sessionData.session.provider_token,
          google_refresh_token: sessionData.session.provider_refresh_token || undefined,
          google_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq("id", authData.user.id);
    }

    // Register watch
    if (!watchRegistered.current) {
      watchRegistered.current = true;
      try {
        const res = await fetch("/api/calendar/watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: authData.user.id }),
        });
        const result = await res.json();
        setSyncStatus(result.success ? "ON" : "OFF");
      } catch {
        setSyncStatus("OFF");
      }
      setTimeout(() => setSyncStatus(""), 5000);
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

  // --- Form handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date) return;
    setSaving(true);
    setSyncMessage("");

    const { data: newProject, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location,
        memo: form.memo,
        visibility: "private",
      })
      .select()
      .single();

    if (error || !newProject) {
      setSaving(false);
      setSyncMessage("案件の作成に失敗しました");
      return;
    }

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          userId: user.id,
          project: { id: newProject.id, ...form, start_date: form.start_date, end_date: form.end_date || form.start_date },
        }),
      });
      const result = await res.json();
      setSyncMessage(result.success ? "Googleカレンダーに同期しました ✓" : "カレンダー同期に失敗しました");
    } catch {
      setSyncMessage("カレンダー同期に失敗しました");
    }

    setForm({ name: "", start_date: "", end_date: "", start_time: "", end_time: "", location: "", memo: "" });
    setShowCreateModal(false);
    setSaving(false);
    loadData();
    setTimeout(() => setSyncMessage(""), 5000);
  };

  // --- Google import ---
  async function fetchGCalEvents() {
    setImportLoading(true);
    setImportMessage("");
    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", userId: user.id, timeMin: startOfMonth, timeMax: endOfMonth }),
      });
      const result = await res.json();
      if (result.success && result.events) {
        const existingIds = projects.filter((p) => p.gcal_event_id).map((p) => p.gcal_event_id);
        const newEvents = result.events.filter((e: GCalEvent) => !existingIds.includes(e.id) && e.summary).map((e: GCalEvent) => ({ ...e, selected: true }));
        setGcalEvents(newEvents);
        if (newEvents.length === 0) setImportMessage("取り込み可能な新しい予定はありません");
      } else {
        setImportMessage("取得に失敗しました。再ログインしてください。");
      }
    } catch {
      setImportMessage("取得に失敗しました");
    }
    setImportLoading(false);
  }

  async function importSelectedEvents() {
    const selected = gcalEvents.filter((e) => e.selected);
    if (selected.length === 0) return;
    setImportLoading(true);
    let imported = 0;
    for (const event of selected) {
      let startDate = "", endDate = "", startTime = "", endTime = "";
      if (event.start.dateTime) {
        const s = new Date(event.start.dateTime);
        startDate = s.toISOString().split("T")[0];
        startTime = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
      } else if (event.start.date) startDate = event.start.date;
      if (event.end.dateTime) {
        const e = new Date(event.end.dateTime);
        endDate = e.toISOString().split("T")[0];
        endTime = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
      } else if (event.end.date) {
        const e = new Date(event.end.date);
        e.setDate(e.getDate() - 1);
        endDate = e.toISOString().split("T")[0];
      }
      const { error } = await supabase.from("projects").insert({
        owner_id: user.id, name: event.summary, start_date: startDate, end_date: endDate || startDate,
        start_time: startTime || null, end_time: endTime || null, location: event.location || "",
        memo: event.description || "", gcal_event_id: event.id, gcal_calendar_id: "primary", visibility: "private",
      });
      if (!error) imported++;
    }
    setImportMessage(`${imported}件取り込みました ✓`);
    setGcalEvents([]);
    setShowImport(false);
    loadData();
    setImportLoading(false);
    setTimeout(() => setImportMessage(""), 5000);
  }

  // --- Helpers ---
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());
  const getDayOfWeek = (day: number) => ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month, day).getDay()];
  const getDayColor = (day: number) => { const d = new Date(year, month, day).getDay(); return d === 0 ? "text-red-400/70" : d === 6 ? "text-blue-400/70" : "text-blue-200/40"; };
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  const getBarStyle = (project: Project) => {
    const s = new Date(project.start_date), e = new Date(project.end_date || project.start_date);
    const ms = new Date(year, month, 1), me = new Date(year, month, daysInMonth);
    const bs = s < ms ? 1 : s.getDate(), be = e > me ? daysInMonth : e.getDate();
    return { left: `${(bs - 1) * 48}px`, width: `${(be - bs + 1) * 48}px` };
  };
  const formatTime = (t: string) => t ? t.slice(0, 5) : "";
  const formatDateFull = (d: string) => { if (!d) return ""; const dt = new Date(d); const dw = ["日","月","火","水","木","金","土"]; return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}(${dw[dt.getDay()]})`; };
  const formatEventTime = (event: GCalEvent) => {
    if (event.start.dateTime) { const s = new Date(event.start.dateTime), e = new Date(event.end.dateTime!); return `${s.getMonth()+1}/${s.getDate()} ${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")} 〜 ${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`; }
    if (event.start.date) { const s = new Date(event.start.date); return `${s.getMonth()+1}/${s.getDate()} (終日)`; }
    return "";
  };
  const displayName = profile?.last_name && profile?.first_name ? `${profile.last_name} ${profile.first_name}` : user?.user_metadata?.full_name || user?.email || "";

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-blue-50 text-sm outline-none transition-all focus:border-blue-400/40 focus:bg-white/[0.06] focus:shadow-[0_0_16px_rgba(99,182,255,0.08)] placeholder:text-blue-200/25";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)" }}>

      {/* ===== Global Header ===== */}
      <header className="border-b border-white/5 sticky top-0 z-30" style={{ background: "rgba(10, 14, 26, 0.9)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          {/* Left: Logo */}
          <button onClick={() => router.push("/schedule")} className="text-xl font-light text-blue-50" style={{ fontFamily: "'Georgia', serif" }}>
            Shift<span className="text-blue-400">Connect</span>
          </button>

          {/* Center: Nav */}
          <nav className="flex items-center gap-1">
            <button onClick={() => router.push("/schedule")} className="px-3 py-1.5 rounded-lg text-sm text-blue-200 bg-blue-400/10 border border-blue-400/20">
              マイカレンダー
            </button>
            {orgs.map((org) => (
              <button key={org.id} onClick={() => router.push(`/schedule/org/${org.id}`)} className="px-3 py-1.5 rounded-lg text-sm text-blue-200/50 hover:text-blue-200/80 hover:bg-white/[0.04] transition-all">
                {org.name}
              </button>
            ))}
            <button onClick={() => router.push("/org")} className="px-2 py-1.5 rounded-lg text-sm text-blue-200/30 hover:text-blue-200/60 transition-all" title="組織管理">
              +
            </button>
          </nav>

          {/* Right: Icons */}
          <div className="flex items-center gap-3">
            {syncStatus && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${syncStatus === "ON" ? "bg-green-400/10 text-green-400/50 border border-green-400/10" : "bg-amber-400/10 text-amber-400/50 border border-amber-400/10"}`}>
                同期 {syncStatus}
              </span>
            )}
            {/* Bell */}
            <button className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-200/40 hover:text-blue-200/70 hover:bg-white/[0.04] transition-all relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            {/* Settings */}
            <button onClick={() => router.push("/dashboard")} className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-200/40 hover:text-blue-200/70 hover:bg-white/[0.04] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            {/* Profile */}
            <button onClick={() => router.push("/profile")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center text-xs text-blue-200">
                  {displayName.charAt(0)}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Calendar Title + Navigation */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-light text-blue-50 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                マイカレンダー
              </h2>
              <p className="text-xs text-blue-200/30 mt-0.5">{displayName} のスケジュール</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-lg text-blue-100">{year}年 {month + 1}月</span>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all text-sm">‹</button>
                <button onClick={goToday} className="px-2 h-7 rounded-lg border border-white/10 text-[11px] text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all">今日</button>
                <button onClick={nextMonth} className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-blue-200/50 hover:text-blue-200/80 hover:border-white/20 transition-all text-sm">›</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowImport(!showImport); if (!showImport) fetchGCalEvents(); }}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:-translate-y-0.5 border border-white/10 text-blue-200/60 hover:text-blue-200 hover:border-white/20"
            >
              📅 Google取り込み
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}
            >
              + 新規案件
            </button>
          </div>
        </div>

        {/* Messages */}
        {(syncMessage || importMessage) && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${(syncMessage || importMessage).includes("✓") ? "bg-green-400/10 border border-green-400/20 text-green-400/80" : "bg-amber-400/10 border border-amber-400/20 text-amber-400/80"}`}>
            {syncMessage || importMessage}
          </div>
        )}

        {/* Google Import Panel */}
        {showImport && (
          <div className="mb-5 p-5 rounded-2xl border border-blue-400/10" style={{ background: "rgba(13,18,36,0.8)", backdropFilter: "blur(40px)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-blue-50">Googleカレンダー（{year}年{month+1}月）</h3>
              {gcalEvents.length > 0 && (
                <button onClick={() => { const all = gcalEvents.every(e=>e.selected); setGcalEvents(gcalEvents.map(e=>({...e,selected:!all}))); }} className="text-xs text-blue-400/60 hover:text-blue-400">
                  {gcalEvents.every(e=>e.selected) ? "すべて解除" : "すべて選択"}
                </button>
              )}
            </div>
            {importLoading ? (
              <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" /><span className="ml-3 text-sm text-blue-200/40">読み込み中...</span></div>
            ) : gcalEvents.length === 0 ? (
              <p className="text-sm text-blue-200/30 text-center py-4">取り込み可能な新しい予定はありません</p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                  {gcalEvents.map(event => (
                    <label key={event.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${event.selected ? "bg-blue-400/10 border border-blue-400/20" : "bg-white/[0.02] border border-white/5 hover:border-white/10"}`}>
                      <input type="checkbox" checked={event.selected||false} onChange={()=>setGcalEvents(gcalEvents.map(e=>e.id===event.id?{...e,selected:!e.selected}:e))} className="w-4 h-4 rounded accent-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-blue-100 truncate">{event.summary}</p>
                        <p className="text-xs text-blue-200/40">{formatEventTime(event)}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={importSelectedEvents} disabled={importLoading||gcalEvents.filter(e=>e.selected).length===0}
                  className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #34d399 100%)", boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}>
                  {gcalEvents.filter(e=>e.selected).length}件を取り込む
                </button>
              </>
            )}
          </div>
        )}

        {/* ===== Gantt Chart ===== */}
        <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(13,18,36,0.6)", backdropFilter: "blur(20px)" }}>
          <div className="flex">
            {/* Left: Names */}
            <div className="flex-shrink-0 w-[200px] border-r border-white/5 z-10">
              <div className="h-[64px] border-b border-white/5 flex items-end px-4 pb-2"><span className="text-xs text-blue-200/30">案件名</span></div>
              {projects.length === 0 ? (
                <div className="h-[52px] flex items-center px-4"><span className="text-xs text-blue-200/20">案件がありません</span></div>
              ) : projects.map(project => (
                <div key={project.id} className="h-[48px] border-b border-white/5 flex items-center px-4 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setSelectedProject(project)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-blue-100 truncate">{project.name}</span>
                    {project.gcal_event_id && <span className="text-[9px] text-green-400/50 flex-shrink-0">●</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Grid */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ minWidth: `${daysInMonth * 48}px` }}>
                <div className="h-[64px] border-b border-white/5 flex">
                  {days.map(day => (
                    <div key={day} className={`flex-shrink-0 flex flex-col items-center justify-end pb-2 ${isToday(day)?"bg-blue-400/5":""}`} style={{ width: "48px" }}>
                      <span className={`text-[10px] ${getDayColor(day)}`}>{getDayOfWeek(day)}</span>
                      <span className={`text-sm mt-0.5 ${isToday(day) ? "text-blue-400 font-medium bg-blue-400/20 w-7 h-7 rounded-full flex items-center justify-center" : getDayColor(day)}`}>{day}</span>
                    </div>
                  ))}
                </div>
                {projects.length === 0 ? <div className="h-[52px]" /> : projects.map(project => {
                  const barStyle = getBarStyle(project);
                  return (
                    <div key={project.id} className="h-[48px] border-b border-white/5 relative">
                      <div className="absolute inset-0 flex">
                        {days.map(day => (
                          <div key={day} className={`flex-shrink-0 border-r border-white/[0.03] ${isToday(day)?"bg-blue-400/5":""} ${new Date(year,month,day).getDay()===0?"bg-red-400/[0.02]":new Date(year,month,day).getDay()===6?"bg-blue-400/[0.02]":""}`} style={{ width: "48px" }} />
                        ))}
                      </div>
                      <div className="absolute top-[8px] h-[32px] rounded-lg flex items-center px-3 cursor-pointer transition-all hover:brightness-110 hover:shadow-lg"
                        style={{ ...barStyle, background: project.gcal_event_id ? "linear-gradient(135deg, #059669 0%, #34d399 100%)" : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)", boxShadow: project.gcal_event_id ? "0 2px 8px rgba(5,150,105,0.3)" : "0 2px 8px rgba(37,99,235,0.3)" }}
                        onClick={() => setSelectedProject(project)}>
                        <span className="text-[11px] text-white font-medium truncate">{project.name}{project.start_time && ` ${formatTime(project.start_time)}`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        {today.getFullYear()===year && today.getMonth()===month && (
          <div className="mt-2 flex items-center justify-end gap-4 text-xs text-blue-200/30">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }} />ShiftConnect</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #059669, #34d399)" }} />Google同期</span>
            <span>● 今日: {today.getMonth()+1}/{today.getDate()}</span>
          </div>
        )}
      </main>

      {/* ===== Create Project Modal ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg p-8 rounded-2xl border border-blue-400/10" style={{ background: "rgba(13,18,36,0.95)", backdropFilter: "blur(40px)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-blue-200/30 hover:text-blue-200/60 transition-colors">✕</button>
            <h3 className="text-lg font-light text-blue-50 mb-6">新規案件の作成</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm text-blue-200/60 mb-1.5">案件名 *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="例：〇〇フェスティバル 映像演出" className={inputClass} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-blue-200/60 mb-1.5">開始日 *</label><input type="date" name="start_date" value={form.start_date} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} required /></div>
                <div><label className="block text-sm text-blue-200/60 mb-1.5">終了日</label><input type="date" name="end_date" value={form.end_date} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-blue-200/60 mb-1.5">開始時間</label><input type="time" name="start_time" value={form.start_time} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} /></div>
                <div><label className="block text-sm text-blue-200/60 mb-1.5">終了時間</label><input type="time" name="end_time" value={form.end_time} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} /></div>
              </div>
              <div><label className="block text-sm text-blue-200/60 mb-1.5">場所</label><input type="text" name="location" value={form.location} onChange={handleChange} placeholder="例：幕張メッセ ホール4" className={inputClass} /></div>
              <div><label className="block text-sm text-blue-200/60 mb-1.5">メモ</label><textarea name="memo" value={form.memo} onChange={handleChange} placeholder="案件の詳細やメモ" rows={2} className={`${inputClass} resize-none`} /></div>
              <button type="submit" disabled={saving||!form.name||!form.start_date}
                className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", boxShadow: "0 8px 32px rgba(37,99,235,0.3)" }}>
                {saving ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />作成・同期中...</span> : "案件を作成（Googleカレンダーに同期）"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Project Detail Modal ===== */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProject(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md p-8 rounded-2xl border border-blue-400/10" style={{ background: "rgba(13,18,36,0.95)", backdropFilter: "blur(40px)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProject(null)} className="absolute top-4 right-4 text-blue-200/30 hover:text-blue-200/60 transition-colors">✕</button>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-medium text-blue-50">{selectedProject.name}</h3>
              {selectedProject.gcal_event_id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400/60 border border-green-400/15">Google同期</span>}
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p className="text-sm text-blue-200/70">{formatDateFull(selectedProject.start_date)}{selectedProject.end_date && selectedProject.end_date !== selectedProject.start_date && <> 〜 {formatDateFull(selectedProject.end_date)}</>}</p>
              </div>
              {selectedProject.start_time && <div className="flex items-start gap-3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p className="text-sm text-blue-200/70">{formatTime(selectedProject.start_time)}{selectedProject.end_time && ` 〜 ${formatTime(selectedProject.end_time)}`}</p></div>}
              {selectedProject.location && <div className="flex items-start gap-3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><p className="text-sm text-blue-200/70">{selectedProject.location}</p></div>}
              {selectedProject.memo && <div className="flex items-start gap-3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/50 mt-0.5 flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><p className="text-sm text-blue-200/70">{selectedProject.memo}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
