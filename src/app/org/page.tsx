"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Organization = {
  id: string;
  name: string;
  role: string;
  member_count: number;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: {
    email: string;
    name: string;
    last_name: string;
    first_name: string;
    avatar_url: string;
  };
};

export default function OrgPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

    // Get user's organizations
    const { data: memberData } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name)")
      .eq("user_id", authData.user.id);

    if (memberData) {
      const orgList: Organization[] = [];
      for (const m of memberData) {
        const org = m.organizations as any;
        // Get member count
        const { count } = await supabase
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);

        orgList.push({
          id: org.id,
          name: org.name,
          role: m.role,
          member_count: count || 0,
        });
      }
      setOrgs(orgList);
      if (orgList.length > 0 && !selectedOrg) {
        setSelectedOrg(orgList[0]);
        await loadMembers(orgList[0].id);
      }
    }
    setLoading(false);
  }

  async function loadMembers(orgId: string) {
    const { data } = await supabase
      .from("organization_members")
      .select("id, user_id, role, joined_at, users(email, name, last_name, first_name, avatar_url)")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: true });

    if (data) {
      setMembers(
        data.map((m: any) => ({
          ...m,
          user: m.users,
        }))
      );
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setSaving(true);

    // Create organization
    const { data: newOrg, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: orgName.trim(), owner_id: user.id })
      .select()
      .single();

    if (orgError || !newOrg) {
      setMessage("組織の作成に失敗しました");
      setSaving(false);
      return;
    }

    // Add creator as owner member
    await supabase.from("organization_members").insert({
      organization_id: newOrg.id,
      user_id: user.id,
      role: "owner",
    });

    setOrgName("");
    setShowCreateForm(false);
    setSaving(false);
    await loadData();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedOrg) return;
    setSaving(true);
    setMessage("");

    // Find user by email
    const { data: invitedUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", inviteEmail.trim())
      .single();

    if (!invitedUser) {
      setMessage("このメールアドレスのユーザーが見つかりません");
      setSaving(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", selectedOrg.id)
      .eq("user_id", invitedUser.id)
      .single();

    if (existing) {
      setMessage("このユーザーは既にメンバーです");
      setSaving(false);
      return;
    }

    // Add member
    const { error } = await supabase.from("organization_members").insert({
      organization_id: selectedOrg.id,
      user_id: invitedUser.id,
      role: "member",
    });

    if (error) {
      setMessage("メンバーの追加に失敗しました");
    } else {
      setMessage("メンバーを追加しました");
      setInviteEmail("");
      setShowInviteForm(false);
      await loadMembers(selectedOrg.id);
      await loadData();
    }
    setSaving(false);
  }

  async function selectOrg(org: Organization) {
    setSelectedOrg(org);
    await loadMembers(org.id);
  }

  const getMemberDisplayName = (member: Member) => {
    if (member.user.last_name && member.user.first_name) {
      return `${member.user.last_name} ${member.user.first_name}`;
    }
    return member.user.name || member.user.email;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner": return "オーナー";
      case "admin": return "管理者";
      case "member": return "メンバー";
      default: return role;
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-light text-blue-50">組織管理</h2>
            <p className="text-sm text-blue-200/40 mt-1">組織の作成・メンバー管理</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{
              background: showCreateForm
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
              color: "white",
              border: showCreateForm ? "1px solid rgba(255,255,255,0.1)" : "none",
              boxShadow: showCreateForm ? "none" : "0 8px 32px rgba(37,99,235,0.3)",
            }}
          >
            {showCreateForm ? "キャンセル" : "+ 新規組織"}
          </button>
        </div>

        {/* Create Org Form */}
        {showCreateForm && (
          <div
            className="mb-8 p-8 rounded-2xl border border-blue-400/10"
            style={{
              background: "rgba(13, 18, 36, 0.8)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
            }}
          >
            <h3 className="text-lg font-light text-blue-50 mb-6">新規組織の作成</h3>
            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div>
                <label className="block text-sm text-blue-200/60 mb-1.5">組織名 *</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="例：株式会社フレームワーク"
                  className={inputClass}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving || !orgName.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-medium tracking-wide text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                  boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
                }}
              >
                {saving ? "作成中..." : "組織を作成"}
              </button>
            </form>
          </div>
        )}

        {/* Org List */}
        {orgs.length === 0 && !showCreateForm ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-200/20">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <p className="text-sm text-blue-200/30">まだ組織がありません</p>
            <p className="text-xs text-blue-200/20 mt-1">「+ 新規組織」から作成してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Org Tabs */}
            {orgs.length > 0 && (
              <div className="flex gap-2 mb-6">
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => selectOrg(org)}
                    className={`px-4 py-2 rounded-xl text-sm transition-all ${
                      selectedOrg?.id === org.id
                        ? "bg-blue-400/15 border border-blue-400/30 text-blue-200"
                        : "bg-white/[0.02] border border-white/10 text-blue-200/50 hover:border-white/20"
                    }`}
                  >
                    {org.name}
                    <span className="ml-2 text-xs opacity-50">{org.member_count}人</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Org Details */}
            {selectedOrg && (
              <div
                className="p-6 rounded-2xl border border-white/10"
                style={{
                  background: "rgba(13, 18, 36, 0.6)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-blue-100">{selectedOrg.name}</h3>
                    <p className="text-xs text-blue-200/40 mt-1">
                      {getRoleLabel(selectedOrg.role)} · {selectedOrg.member_count}人のメンバー
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(selectedOrg.role === "owner" || selectedOrg.role === "admin") && (
                      <button
                        onClick={() => setShowInviteForm(!showInviteForm)}
                        className="px-4 py-2 rounded-xl text-sm border border-white/10 text-blue-200/60 hover:border-blue-400/30 hover:text-blue-200 transition-all"
                      >
                        {showInviteForm ? "キャンセル" : "+ メンバー追加"}
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/schedule/org/${selectedOrg.id}`)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:-translate-y-0.5"
                      style={{
                        background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                        boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
                      }}
                    >
                      組織カレンダー
                    </button>
                  </div>
                </div>

                {/* Invite Form */}
                {showInviteForm && (
                  <div className="mb-6 p-5 rounded-xl border border-blue-400/10 bg-white/[0.02]">
                    <form onSubmit={handleInvite} className="flex gap-3">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="メールアドレスを入力"
                        className={`${inputClass} flex-1`}
                        required
                      />
                      <button
                        type="submit"
                        disabled={saving || !inviteEmail.trim()}
                        className="px-5 py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 hover:-translate-y-0.5"
                        style={{
                          background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                        }}
                      >
                        {saving ? "追加中..." : "追加"}
                      </button>
                    </form>
                    {message && (
                      <p className={`text-xs mt-2 ${message.includes("失敗") || message.includes("見つかりません") || message.includes("既に") ? "text-red-400/70" : "text-green-400/70"}`}>
                        {message}
                      </p>
                    )}
                  </div>
                )}

                {/* Member List */}
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {member.user.avatar_url ? (
                          <img
                            src={member.user.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-full border border-white/10"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-400/20 flex items-center justify-center text-xs text-blue-200">
                            {getMemberDisplayName(member).charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-blue-100">{getMemberDisplayName(member)}</p>
                          <p className="text-xs text-blue-200/30">{member.user.email}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          member.role === "owner"
                            ? "bg-amber-400/10 text-amber-400/70 border border-amber-400/20"
                            : member.role === "admin"
                            ? "bg-blue-400/10 text-blue-400/70 border border-blue-400/20"
                            : "bg-white/5 text-blue-200/40 border border-white/10"
                        }`}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
