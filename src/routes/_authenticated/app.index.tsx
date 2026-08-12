import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, CalendarDays, ClipboardCheck, Bell, ArrowLeft, TrendingUp } from "lucide-react";
import type { Player, Activity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

function HomePage() {
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [activities, players, todayAtt, lowLinks, legacyLow] = await Promise.all([
        supabase.from("activities").select("id", { count: "exact", head: true }),
        supabase.from("players").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("attendance_date", today).eq("present", true),
        supabase.from("player_activities").select("id", { count: "exact", head: true }).lte("remaining_sessions", 2),
        supabase.from("players").select("id", { count: "exact", head: true }).eq("archived", false).lte("remaining_sessions", 2).is("activity_id", null),
      ]);
      return {
        activities: activities.count ?? 0,
        players: players.count ?? 0,
        todayAttendance: todayAtt.count ?? 0,
        lowSessions: (lowLinks.count ?? 0) + (legacyLow.count ?? 0),
      };
    },
  });

  const { data: recentActivities } = useQuery({
    queryKey: ["recent-activities"],
    queryFn: async () => {
      const { data } = await supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(4);
      return (data ?? []) as Activity[];
    },
  });

  const { data: lowPlayers } = useQuery({
    queryKey: ["low-players"],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("player_activities")
        .select("player_id, activity_id, total_sessions, remaining_sessions")
        .lte("remaining_sessions", 2).gt("remaining_sessions", 0)
        .order("remaining_sessions").limit(10);
      const ids = Array.from(new Set(((links ?? []) as { player_id: string }[]).map(l => l.player_id)));
      if (ids.length === 0) return [] as (Player & { link_remaining: number; link_total: number })[];
      const { data: pdata } = await supabase.from("players").select("*").in("id", ids).eq("archived", false);
      const players = (pdata ?? []) as Player[];
      const out: (Player & { link_remaining: number; link_total: number })[] = [];
      players.forEach(p => {
        const l = (links ?? []).find((x: any) => x.player_id === p.id);
        if (l) out.push({ ...p, link_remaining: (l as any).remaining_sessions, link_total: (l as any).total_sessions });
      });
      return out.slice(0, 5);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">نظرة سريعة على أكاديميتك</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="الأنشطة" value={stats?.activities ?? 0} color="brand" to="/app/activities" />
        <StatCard icon={Users} label="المشتركون" value={stats?.players ?? 0} color="navy" to="/app/players" />
        <StatCard icon={ClipboardCheck} label="حضور اليوم" value={stats?.todayAttendance ?? 0} color="success" to="/app/attendance" />
        <StatCard icon={Bell} label="تنبيهات نشطة" value={stats?.lowSessions ?? 0} color="warning" to="/app/alerts" />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">أنشطتك</h2>
            <Link to="/app/activities" className="text-xs text-brand hover:underline">عرض الكل</Link>
          </div>
          {recentActivities && recentActivities.length > 0 ? (
            <div className="space-y-2">
              {recentActivities.map(a => (
                <Link key={a.id} to="/app/activities" className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.instructor ?? "بدون مدرب"} • {a.days.length} أيام</div>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState msg="لا توجد أنشطة بعد" cta="إضافة نشاط" to="/app/activities" />
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">تنبيهات — حصص قاربت على النفاد</h2>
            <Link to="/app/alerts" className="text-xs text-brand hover:underline">عرض الكل</Link>
          </div>
          {lowPlayers && lowPlayers.length > 0 ? (
            <div className="space-y-2">
              {lowPlayers.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">متبقي {p.link_remaining} من {p.link_total}</div>
                  </div>
                  <TrendingUp className="h-4 w-4 text-warning" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">لا تنبيهات — كل شيء ممتاز 🎉</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, to }: any) {
  const iconMap: Record<string, string> = {
    brand: "bg-brand/12 text-brand",
    navy: "bg-lilac/12 text-lilac",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
  };
  const tintMap: Record<string, string> = {
    brand: "var(--brand)",
    navy: "var(--lilac)",
    success: "var(--success)",
    warning: "var(--warning)",
  };
  return (
    <Link to={to}>
      <Card className="p-4 card-hover tint-card" style={{ ["--tint" as any]: tintMap[color] }}>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-3 text-2xl font-extrabold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </Card>
    </Link>
  );
}


function EmptyState({ msg, cta, to }: { msg: string; cta: string; to: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
      <Link to={to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
        {cta} <ArrowLeft className="h-3 w-3" />
      </Link>
    </div>
  );
}
