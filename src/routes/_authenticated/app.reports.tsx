import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Users, CalendarDays, CheckCircle2, XCircle, Download } from "lucide-react";
import { toCSV, downloadFile, type Player, type Activity, type AttendanceRow } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-brand" /> التقارير</h1>
        <p className="text-sm text-muted-foreground">إحصائيات عامة، وتقارير تفصيلية لكل مشترك أو نشاط</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="general">عام</TabsTrigger>
          <TabsTrigger value="player">حسب المشترك</TabsTrigger>
          <TabsTrigger value="activity">حسب النشاط</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4"><GeneralTab /></TabsContent>
        <TabsContent value="player" className="mt-4"><PlayerTab /></TabsContent>
        <TabsContent value="activity" className="mt-4"><ActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralTab() {
  const { data } = useQuery({
    queryKey: ["reports-general"],
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
        totalPlayers: players.length, active: active.length, archived: archived.length,
        activities: activities.count ?? 0,
        totalPresent: present.count ?? 0, totalAbsent: absent.count ?? 0,
        consumed, totalCap,
      };
    },
  });
  if (!data) return <p className="text-sm text-muted-foreground">جاري التحضير…</p>;
  const attendanceRate = data.totalPresent + data.totalAbsent > 0
    ? Math.round((data.totalPresent / (data.totalPresent + data.totalAbsent)) * 100) : 0;
  const usagePct = data.totalCap > 0 ? Math.round((data.consumed / data.totalCap) * 100) : 0;

  return (
    <div className="space-y-4">
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

function DateRange({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  const preset = (days: number) => {
    const t = new Date();
    const f = new Date(); f.setDate(f.getDate() - days);
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label>من تاريخ</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      <div className="flex items-end gap-2"><Button variant="outline" size="sm" onClick={() => preset(7)}>آخر أسبوع</Button><Button variant="outline" size="sm" onClick={() => preset(30)}>آخر شهر</Button></div>
      <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>مسح الفلاتر</Button></div>
    </div>
  );
}

function PlayerTab() {
  const [playerId, setPlayerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: players = [] } = useQuery({
    queryKey: ["players-all"],
    queryFn: async () => (await supabase.from("players").select("*").order("name")).data as Player[] ?? [],
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*")).data as Activity[] ?? [],
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["player-attendance", playerId, from, to],
    enabled: !!playerId,
    queryFn: async () => {
      let q = supabase.from("attendance").select("*").eq("player_id", playerId).order("attendance_date", { ascending: false });
      if (from) q = q.gte("attendance_date", from);
      if (to) q = q.lte("attendance_date", to);
      return (await q).data as AttendanceRow[] ?? [];
    },
  });

  const stats = useMemo(() => {
    const present = rows.filter(r => r.present).length;
    const absent = rows.filter(r => !r.present).length;
    const total = rows.length;
    const rate = total ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, rate };
  }, [rows]);

  const player = players.find(p => p.id === playerId);
  const nameOf = (aid: string | null) => activities.find(a => a.id === aid)?.name ?? "—";

  const exportCSV = () => {
    if (!player) return;
    const data = rows.map(r => ({
      التاريخ: r.attendance_date, النشاط: nameOf(r.activity_id), الحالة: r.present ? "حاضر" : "غائب",
    }));
    downloadFile(`تقرير-${player.name}.csv`, toCSV(data));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>المشترك</Label>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger><SelectValue placeholder="اختر المشترك" /></SelectTrigger>
            <SelectContent>{players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.receipt_number ? ` — #${p.receipt_number}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </Card>

      {playerId && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat icon={CheckCircle2} label="حضور" value={stats.present} color="success" />
            <Stat icon={XCircle} label="غياب" value={stats.absent} color="destructive" />
            <Stat icon={CalendarDays} label="إجمالي" value={stats.total} />
            <Stat icon={BarChart3} label="نسبة الحضور" value={`${stats.rate}%`} color="brand" />
          </div>
          <div className="flex justify-end"><Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}><Download className="ms-1 h-4 w-4" /> تصدير CSV</Button></div>
          <Card className="p-0 overflow-hidden">
            {rows.length === 0 ? <div className="p-10 text-center text-muted-foreground">لا توجد سجلات في هذه الفترة.</div> : (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0"><tr>
                    <th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">النشاط</th><th className="p-3 text-start">الحالة</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">{new Date(r.attendance_date).toLocaleDateString("ar-EG")}</td>
                        <td className="p-3">{nameOf(r.activity_id)}</td>
                        <td className="p-3"><span className={r.present ? "text-success font-semibold" : "text-destructive font-semibold"}>{r.present ? "حاضر" : "غائب"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ActivityTab() {
  const [activityId, setActivityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*").order("name")).data as Activity[] ?? [],
  });
  const { data: players = [] } = useQuery({
    queryKey: ["players-all"],
    queryFn: async () => (await supabase.from("players").select("*")).data as Player[] ?? [],
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["activity-attendance", activityId, from, to],
    enabled: !!activityId,
    queryFn: async () => {
      let q = supabase.from("attendance").select("*").eq("activity_id", activityId);
      if (from) q = q.gte("attendance_date", from);
      if (to) q = q.lte("attendance_date", to);
      return (await q).data as AttendanceRow[] ?? [];
    },
  });

  const perPlayer = useMemo(() => {
    const map = new Map<string, { present: number; absent: number }>();
    rows.forEach(r => {
      const cur = map.get(r.player_id) ?? { present: 0, absent: 0 };
      if (r.present) cur.present++; else cur.absent++;
      map.set(r.player_id, cur);
    });
    return Array.from(map.entries()).map(([pid, s]) => {
      const p = players.find(x => x.id === pid);
      const total = s.present + s.absent;
      return { player: p, present: s.present, absent: s.absent, total, rate: total ? Math.round((s.present / total) * 100) : 0 };
    }).filter(x => x.player).sort((a, b) => b.rate - a.rate);
  }, [rows, players]);

  const totalPresent = rows.filter(r => r.present).length;
  const totalAbsent = rows.filter(r => !r.present).length;
  const totalRate = rows.length ? Math.round((totalPresent / rows.length) * 100) : 0;
  const activity = activities.find(a => a.id === activityId);

  const exportCSV = () => {
    if (!activity) return;
    const data = perPlayer.map(x => ({
      المشترك: x.player!.name, "رقم الإيصال": x.player!.receipt_number ?? "",
      حضور: x.present, غياب: x.absent, الإجمالي: x.total, "نسبة الحضور": `${x.rate}%`,
    }));
    downloadFile(`تقرير-نشاط-${activity.name}.csv`, toCSV(data));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>النشاط</Label>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger><SelectValue placeholder="اختر النشاط" /></SelectTrigger>
            <SelectContent>{activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </Card>

      {activityId && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat icon={Users} label="عدد المشتركين" value={perPlayer.length} />
            <Stat icon={CheckCircle2} label="حضور" value={totalPresent} color="success" />
            <Stat icon={XCircle} label="غياب" value={totalAbsent} color="destructive" />
            <Stat icon={BarChart3} label="نسبة الحضور" value={`${totalRate}%`} color="brand" />
          </div>
          <div className="flex justify-end"><Button variant="outline" onClick={exportCSV} disabled={perPlayer.length === 0}><Download className="ms-1 h-4 w-4" /> تصدير CSV</Button></div>
          <Card className="p-0 overflow-hidden">
            {perPlayer.length === 0 ? <div className="p-10 text-center text-muted-foreground">لا توجد سجلات.</div> : (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0"><tr>
                    <th className="p-3 text-start">المشترك</th><th className="p-3 text-start">حضور</th><th className="p-3 text-start">غياب</th><th className="p-3 text-start">النسبة</th>
                  </tr></thead>
                  <tbody>
                    {perPlayer.map(x => (
                      <tr key={x.player!.id} className="border-t">
                        <td className="p-3 font-semibold">{x.player!.name}</td>
                        <td className="p-3 text-success">{x.present}</td>
                        <td className="p-3 text-destructive">{x.absent}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand" style={{ width: `${x.rate}%` }} /></div>
                            <span className="font-semibold">{x.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
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
