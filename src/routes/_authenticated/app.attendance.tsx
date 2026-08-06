import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, ClipboardCheck, Search } from "lucide-react";
import { toast } from "sonner";
import type { Player, Activity, AttendanceRow, PlayerActivity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const [activityId, setActivityId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");


  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*").order("name")).data as Activity[] ?? [],
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments-by-activity", activityId],
    enabled: !!activityId,
    queryFn: async () => {
      // Junction rows for this activity (source of truth for per-activity sessions)
      const { data: links } = await supabase
        .from("player_activities")
        .select("id, player_id, activity_id, total_sessions, remaining_sessions")
        .eq("activity_id", activityId);
      const linkRows = (links ?? []) as PlayerActivity[];

      // Legacy: players with activity_id = this activity but no junction row
      const linkedIds = new Set(linkRows.map(r => r.player_id));
      const { data: legacy } = await supabase
        .from("players")
        .select("id, total_sessions, remaining_sessions")
        .eq("activity_id", activityId)
        .eq("archived", false);
      const legacyExtras = (legacy ?? []).filter(p => !linkedIds.has(p.id));

      const allPlayerIds = [...linkedIds, ...legacyExtras.map(p => p.id)];
      if (allPlayerIds.length === 0) return [] as Array<Player & { link_id: string | null; act_total: number; act_remaining: number; activity_names: string[] }>;

      const { data: playersData } = await supabase
        .from("players").select("*").in("id", allPlayerIds).eq("archived", false).order("name");
      const players = (playersData ?? []) as Player[];

      // كل الأنشطة التي يشترك فيها هؤلاء المشتركون
      const { data: allLinks } = await supabase
        .from("player_activities")
        .select("player_id, activity_id")
        .in("player_id", allPlayerIds);
      const { data: acts } = await supabase.from("activities").select("id,name");
      const actName = new Map((acts ?? []).map(a => [a.id, a.name as string]));
      const byPlayer = new Map<string, string[]>();
      for (const l of allLinks ?? []) {
        const n = actName.get(l.activity_id);
        if (!n) continue;
        const arr = byPlayer.get(l.player_id) ?? [];
        if (!arr.includes(n)) arr.push(n);
        byPlayer.set(l.player_id, arr);
      }

      return players.map(p => {
        const link = linkRows.find(l => l.player_id === p.id);
        const names = byPlayer.get(p.id) ?? [];
        if (names.length === 0 && p.activity_id) {
          const n = actName.get(p.activity_id);
          if (n) names.push(n);
        }
        if (link) {
          return { ...p, link_id: link.id, act_total: link.total_sessions, act_remaining: link.remaining_sessions, activity_names: names };
        }
        return { ...p, link_id: null, act_total: p.total_sessions, act_remaining: p.remaining_sessions, activity_names: names };
      });
    },
  });

  const term = search.trim().toLowerCase();
  const players = term
    ? enrollments.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.receipt_number ?? "").toLowerCase().includes(term))
    : enrollments;


  const { data: existing = [] } = useQuery({
    queryKey: ["att", activityId, date],
    enabled: !!activityId && !!date,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("activity_id", activityId).eq("attendance_date", date);
      const rows = (data ?? []) as AttendanceRow[];
      const m: Record<string, boolean> = {};
      rows.forEach(r => { m[r.player_id] = r.present; });
      setMarks(m);
      return rows;
    },
  });


  // ===== بحث عام (بدون اختيار نشاط) =====
  const globalTerm = !activityId ? term : "";
  const { data: globalResults = [], refetch: refetchGlobal } = useQuery({
    queryKey: ["global-attendance-search", globalTerm, date],
    enabled: globalTerm.length >= 2 && !!date,
    queryFn: async () => {
      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("archived", false)
        .or(`name.ilike.%${globalTerm}%,receipt_number.ilike.%${globalTerm}%`)
        .order("name")
        .limit(30);
      const found = (playersData ?? []) as Player[];
      if (found.length === 0) return [];
      const ids = found.map(p => p.id);

      const { data: links } = await supabase
        .from("player_activities")
        .select("id, player_id, activity_id, total_sessions, remaining_sessions")
        .in("player_id", ids);
      const { data: acts } = await supabase.from("activities").select("id,name");
      const actName = new Map((acts ?? []).map(a => [a.id, a.name as string]));

      const { data: attRows } = await supabase
        .from("attendance")
        .select("*")
        .eq("attendance_date", date)
        .in("player_id", ids);
      const att = (attRows ?? []) as AttendanceRow[];

      return found.map(p => {
        const rows = ((links ?? []) as PlayerActivity[]).filter(l => l.player_id === p.id);
        let entries = rows.map(l => ({
          link_id: l.id as string | null,
          activity_id: l.activity_id,
          activity_name: actName.get(l.activity_id) ?? "نشاط",
          total: l.total_sessions,
          remaining: l.remaining_sessions,
        }));
        if (entries.length === 0 && p.activity_id) {
          entries = [{
            link_id: null,
            activity_id: p.activity_id,
            activity_name: actName.get(p.activity_id) ?? "نشاط",
            total: p.total_sessions,
            remaining: p.remaining_sessions,
          }];
        }
        const marks: Record<string, boolean> = {};
        att.filter(a => a.player_id === p.id).forEach(a => {
          if (a.activity_id) marks[a.activity_id] = a.present;
        });
        return { player: p, entries, marks };
      });
    },
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);

  const toggleGlobal = async (
    p: Player,
    entry: { link_id: string | null; activity_id: string; remaining: number },
    present: boolean,
    wasPresent: boolean | undefined,
  ) => {
    if (wasPresent === present) return;
    const key = `${p.id}:${entry.activity_id}`;
    setSavingKey(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const { error } = await supabase.from("attendance").upsert(
        [{ user_id: user.id, player_id: p.id, activity_id: entry.activity_id, attendance_date: date, present }],
        { onConflict: "player_id,attendance_date" },
      );
      if (error) throw error;

      if (present && !wasPresent && entry.remaining > 0) {
        if (entry.link_id) await supabase.from("player_activities").update({ remaining_sessions: entry.remaining - 1 }).eq("id", entry.link_id);
        else await supabase.from("players").update({ remaining_sessions: entry.remaining - 1 }).eq("id", p.id);
      } else if (!present && wasPresent) {
        if (entry.link_id) await supabase.from("player_activities").update({ remaining_sessions: entry.remaining + 1 }).eq("id", entry.link_id);
        else await supabase.from("players").update({ remaining_sessions: entry.remaining + 1 }).eq("id", p.id);
      }
      toast.success(present ? "تم تسجيل الحضور" : "تم تسجيل الغياب");
      await refetchGlobal();
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const [savingId, setSavingId] = useState<string | null>(null);

  const persistOne = async (pid: string, present: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("غير مسجل");
    const { error } = await supabase.from("attendance").upsert(
      [{ user_id: user.id, player_id: pid, activity_id: activityId, attendance_date: date, present }],
      { onConflict: "player_id,attendance_date" },
    );
    if (error) throw error;

    const wasPresent = existing.find(r => r.player_id === pid)?.present;
    const p = players.find(x => x.id === pid);
    if (!p || wasPresent === present) return;

    if (present && !wasPresent && p.act_remaining > 0) {
      if (p.link_id) await supabase.from("player_activities").update({ remaining_sessions: p.act_remaining - 1 }).eq("id", p.link_id);
      else await supabase.from("players").update({ remaining_sessions: p.act_remaining - 1 }).eq("id", pid);
    } else if (!present && wasPresent) {
      if (p.link_id) await supabase.from("player_activities").update({ remaining_sessions: p.act_remaining + 1 }).eq("id", p.link_id);
      else await supabase.from("players").update({ remaining_sessions: p.act_remaining + 1 }).eq("id", pid);
    }
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["players"] });
    qc.invalidateQueries({ queryKey: ["enrollments-by-activity"] });
    qc.invalidateQueries({ queryKey: ["player_activities_all"] });
    qc.invalidateQueries({ queryKey: ["att", activityId, date] });
    qc.invalidateQueries({ queryKey: ["home-stats"] });
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const toggle = async (id: string, val: boolean) => {
    if (marks[id] === val) return;
    const prevVal = marks[id];
    setMarks(prev => ({ ...prev, [id]: val }));
    setSavingId(id);
    try {
      await persistOne(id, val);
      toast.success(val ? "تم تسجيل الحضور" : "تم تسجيل الغياب");
      refreshAll();
    } catch (e) {
      setMarks(prev => ({ ...prev, [id]: prevVal as boolean }));
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const markAll = async (val: boolean) => {
    const targets = players.filter(p => marks[p.id] !== val);
    if (targets.length === 0) return;
    setMarks(prev => ({ ...prev, ...Object.fromEntries(targets.map(p => [p.id, val])) }));
    try {
      for (const p of targets) await persistOne(p.id, val);
      toast.success("تم الحفظ");
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><ClipboardCheck className="h-6 w-6 text-brand" /> تسجيل الحضور</h1>
        <p className="text-sm text-muted-foreground">اختر النشاط والتاريخ ثم علّم الحاضرين</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>النشاط</Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger><SelectValue placeholder="اختر النشاط" /></SelectTrigger>
              <SelectContent>{activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        {activityId && (
          <div className="mt-3 space-y-1.5">
            <Label>بحث</Label>
            <div className="relative">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pe-9" placeholder="ابحث بالاسم أو رقم الإيصال" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}
      </Card>

      {activityId && (
        players.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            {enrollments.length === 0 ? "لا يوجد مشتركون في هذا النشاط." : "لا توجد نتائج مطابقة للبحث."}
          </Card>
        ) : (
          <>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => markAll(true)}>تحديد الكل حاضر</Button>
              <Button size="sm" variant="outline" onClick={() => markAll(false)}>تحديد الكل غائب</Button>
            </div>
            <Card className="p-2">
              <div className="divide-y">
                {players.map(p => {
                  const val = marks[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {p.name}
                          {p.receipt_number ? <span className="ms-2 text-xs font-normal text-muted-foreground">#{p.receipt_number}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">متبقي {p.act_remaining} من {p.act_total} (لهذا النشاط)</div>
                        {p.activity_names.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.activity_names.map(n => (
                              <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{n}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant={val === true ? "default" : "outline"}
                          className={val === true ? "bg-success text-white hover:bg-success/90" : ""}
                          disabled={savingId === p.id} onClick={() => toggle(p.id, true)}>
                          <Check className="h-4 w-4" /> حاضر
                        </Button>
                        <Button size="sm" variant={val === false ? "default" : "outline"}
                          className={val === false ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                          onClick={() => toggle(p.id, false)}>
                          <X className="h-4 w-4" /> غائب
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <p className="text-center text-xs text-muted-foreground">يتم الحفظ تلقائياً عند الضغط على حاضر أو غائب</p>
          </>
        )
      )}
    </div>
  );
}
