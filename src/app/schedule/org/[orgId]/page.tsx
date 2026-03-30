"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type MemberWithProjects = {
  user_id: string;
  name: string;
  avatar_url: string;
  role: string;
  projects: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    location: string;
    memo: string;
    status: string;
  }[];
};

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

export default function OrgSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const [orgName, setOrgName] = useState("");
  const [membersData, setMembersData] = useState<MemberWithProjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const cellWidth = 48;

  useEffect(() => {
    loadData();
  }, [currentDate]);

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/");
      return;
    }

    // Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    if (org) setOrgName(org.name);

    // Get all members
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, role, users(name, last_name, first_name, avatar_url, email)")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: true });

    if (!members) {
      setLoading(false);
      return;
    }

    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

    // Get projects for each member
    const result: MemberWithProjects[] = [];
    for (const member of members) {
      const user = member.users as any;
      const displayName =
        user.last_name && user.first_name
          ? `${user.last_name} ${user.first_name}`
          : user.name || user.email;

      // Get projects owned by this member in this month
      const { data: ownedProjects } = await supabase
        .from("projects")
        .select("*")
        .eq("owner_id", member.user_id)
        .or(`and(start_date.lte.${endOfMonth},end_date.gte.${startOfMonth})`)
        .order("start_date", { ascending: true });

      // Get projects assigned to this member
      const { data: assignedData } = await supabase
        .from("project_assignments")
        .select("project_id, status, projects(*)")
        .eq("user_id", member.user_id)
        .eq("status", "approved");

      const assignedProjects = (assignedData || [])
        .map((a: any) => ({ ...a.projects, status: a.status }))
        .filter((p: any) => p.start_date <= endOfMonth && p.end_date >= startOfMonth);

      // Merge and deduplicate
      const allProjects = [...(ownedProjects || [])];
      for (const ap of assignedProjects) {
        if (!allProjects.find((p) => p.id === ap.id)) {
          allProjects.push(ap);
        }
      }

      result.push({
        user_id: member.user_id,
        name: displayName,
        avatar_url: user.avatar_url || "",
        role: member.role,
        projects: allProjects,
      });
    }

    setMembersData(result);
    setLoading(false);
  }

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

  const getBarStyle = (project: any) => {
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date || project.start_date);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, daysInMonth);
    const barStart = startDate < monthStart ? 1 : startDate.getDate();
    const barEnd = endDate > monthEnd ? daysInMonth : endDate.getDate();
    return {
      left: `${(barStart - 1) * cellWidth}px`,
      width: `${(barEnd - barStart + 1) * cellWidth}px`,
    };
  };

  const formatTime = (t: string) => (t ? t.slice(0, 5) : "");

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  const barColors = [
    "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
    "linear-gradient(135deg, #059669 0%, #34d399 100%)",
    "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
    "linear-gradient(135deg, #dc2626 0%, #f87171 100%)",
    "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
  ];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner": return "オーナー";
      case "admin": return "管理者";
      default: return "メンバー";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate row height based on max overlapping projects
  const getRowHeight = (member: MemberWithProjects) => {
    return Math.max(52, member.projects.length * 36 + 16);
  };

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/org")}
              className="text-sm text-blue-200/40 hover:text-blue-200/70 transition-colors"
            >
              ← 組織管理
            </button>
            <button
              onClick={() => router.push("/schedule")}
              className="text-sm text-blue-200/40 hover:text-blue-200/70 transition-colors"
            >
              個人カレンダー
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-light text-blue-50">
                {year}年 {month + 1}月
              </h2>
              <p className="text-sm text-blue-200/40 mt-0.5">{orgName}</p>
            </div>
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
            {/* Left: Member Names */}
            <div className="flex-shrink-0 w-[200px] border-r border-white/5 z-10">
              {/* Header */}
              <div className="h-[72px] border-b border-white/5 flex items-end px-4 pb-2">
                <span className="text-xs text-blue-200/30">メンバー</span>
              </div>
              {/* Member rows */}
              {membersData.length === 0 ? (
                <div className="h-[52px] flex items-center px-4">
                  <span className="text-xs text-blue-200/20">メンバーがいません</span>
                </div>
              ) : (
                membersData.map((member) => (
                  <div
                    key={member.user_id}
                    className="border-b border-white/5 flex items-center px-4 gap-3"
                    style={{ height: `${getRowHeight(member)}px` }}
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt=""
                        className="w-7 h-7 rounded-full border border-white/10 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-400/20 flex items-center justify-center text-[10px] text-blue-200 flex-shrink-0">
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-blue-100 truncate">{member.name}</p>
                      <p className="text-[10px] text-blue-200/30">{getRoleLabel(member.role)}</p>
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

                {/* Member Rows */}
                {membersData.map((member, memberIdx) => (
                  <div
                    key={member.user_id}
                    className="border-b border-white/5 relative"
                    style={{ height: `${getRowHeight(member)}px` }}
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

                    {/* Project Bars */}
                    {member.projects.map((project, projIdx) => {
                      const barStyle = getBarStyle(project);
                      const colorIdx = (memberIdx + projIdx) % barColors.length;
                      return (
                        <div
                          key={project.id}
                          className="absolute h-[28px] rounded-md flex items-center px-2.5 cursor-pointer transition-all hover:brightness-110 hover:shadow-lg z-10"
                          style={{
                            ...barStyle,
                            top: `${8 + projIdx * 36}px`,
                            background: barColors[colorIdx],
                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          }}
                          onClick={() => setSelectedProject(project)}
                        >
                          <span className="text-[10px] text-white font-medium truncate">
                            {project.name}
                            {project.start_time && ` ${formatTime(project.start_time)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
