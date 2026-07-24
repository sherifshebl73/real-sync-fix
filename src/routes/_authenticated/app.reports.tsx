import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart3, Users, CalendarDays, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [all, present, absent, activities] = await Promise.all([
        supabase.from("players").select("id, total_sessions, remaining_sessions, archived"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("present", true),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("present", false),
        supabase.from("activities").select("id", { count: "exact", head: true }),
      ]);
      const players = all.data ?? [];
      const active = players.filter(p => !p.archived);
      const archived = players.filter(p => p.archived);
      const consumed = active.reduce((s, p) => s + (p.total_sessions - p.remaining_sessions), 0);
      const totalCap = active.reduce((s, p) => s + p.total_sessions, 0);
      return {
        totalPlayers: players.length,
        active: active.length,
        archived: archived.length,
        activities: activities.count ?? 0,
        totalPresent: present.count ?? 0,
        totalAbsent: absent.count ?? 0,
        consumed, totalCap,
      };
    },
  });

  if (!data) return <p className="text-sm text-muted-foreground">جاري تحضير التقارير…</p>;
  const attendanceRate = data.totalPresent + data.totalAbsent > 0
    ? Math.round((data.totalPresent / (data.totalPresent + data.totalAbsent)) * 100) : 0;
  const usagePct = data.totalCap > 0 ? Math.round((data.consumed / data.totalCap) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-brand" /> التقارير</h1>
        <p className="text-sm text-muted-foreground">إحصائيات عامة عن أكاديميتك</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="إجمالي المشتركين" value={data.totalPlayers} sub={`نشط ${data.active} • أرشيف ${data.archived}`} />
        <Stat icon={CalendarDays} label="الأنشطة" value={data.activities} />
        <Stat icon={CheckCircle2} label="مرات الحضور" value={data.totalPresent} color="success" />
        <Stat icon={XCircle} label="مرات الغياب" value={data.totalAbsent} color="destructive" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between"><span className="font-bold">نسبة الحضور</span><span className="text-2xl font-extrabold text-success">{attendanceRate}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success" style={{ width: `${attendanceRate}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">من إجمالي {data.totalPresent + data.totalAbsent} تسجيل</p>
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between"><span className="font-bold">استهلاك الحصص</span><span className="text-2xl font-extrabold text-brand">{usagePct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand" style={{ width: `${usagePct}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{data.consumed} من أصل {data.totalCap} حصة</p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, color = "brand" }: any) {
  const c: Record<string, string> = { brand: "bg-brand-soft text-brand", success: "bg-success/10 text-success", destructive: "bg-destructive/10 text-destructive" };
  return (
    <Card className="p-4">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c[color]}`}><Icon className="h-5 w-5" /></div>
      <div className="mt-3 text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
