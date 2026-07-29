import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Save, ClipboardCheck } from "lucide-react";
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
      if (allPlayerIds.length === 0) return [] as Array<Player & { link_id: string | null; act_total: number; act_remaining: number }>;

      const { data: playersData } = await supabase
        .from("players").select("*").in("id", allPlayerIds).eq("archived", false).order("name");
      const players = (playersData ?? []) as Player[];

      return players.map(p => {
        const link = linkRows.find(l => l.player_id === p.id);
        if (link) {
          return { ...p, link_id: link.id, act_total: link.total_sessions, act_remaining: link.remaining_sessions };
        }
        return { ...p, link_id: null, act_total: p.total_sessions, act_remaining: p.remaining_sessions };
      });
    },
  });

  const players = enrollments;

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

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const entries = Object.entries(marks);
      if (entries.length === 0) throw new Error("لم تقم بتحديد أي حضور");

      const rows = entries.map(([player_id, present]) => ({
        user_id: user.id, player_id, activity_id: activityId, attendance_date: date, present,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "player_id,attendance_date" });
      if (error) throw error;

      const existingMap = new Map(existing.map(r => [r.player_id, r.present]));
      for (const [pid, present] of entries) {
        const wasPresent = existingMap.get(pid);
        const p = players.find(x => x.id === pid);
        if (!p) continue;

        // Delta only for this specific activity
        if (present && !wasPresent && p.act_remaining > 0) {
          if (p.link_id) {
            await supabase.from("player_activities").update({ remaining_sessions: p.act_remaining - 1 }).eq("id", p.link_id);
          } else {
            await supabase.from("players").update({ remaining_sessions: p.act_remaining - 1 }).eq("id", pid);
          }
        } else if (!present && wasPresent) {
          if (p.link_id) {
            await supabase.from("player_activities").update({ remaining_sessions: p.act_remaining + 1 }).eq("id", p.link_id);
          } else {
            await supabase.from("players").update({ remaining_sessions: p.act_remaining + 1 }).eq("id", pid);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الحضور");
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["enrollments-by-activity"] });
      qc.invalidateQueries({ queryKey: ["player_activities_all"] });
      qc.invalidateQueries({ queryKey: ["att", activityId, date] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string, val: boolean) => setMarks(prev => ({ ...prev, [id]: val }));
  const markAll = (val: boolean) => setMarks(Object.fromEntries(players.map(p => [p.id, val])));

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
      </Card>

      {activityId && (
        players.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">لا يوجد مشتركون في هذا النشاط.</Card>
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
                    <div key={p.id} className="flex items-center justify-between px-3 py-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">متبقي {p.remaining_sessions} من {p.total_sessions}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={val === true ? "default" : "outline"}
                          className={val === true ? "bg-success text-white hover:bg-success/90" : ""}
                          onClick={() => toggle(p.id, true)}>
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
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full gradient-brand text-brand-foreground">
              <Save className="ms-1 h-4 w-4" /> {save.isPending ? "جاري الحفظ…" : "حفظ الحضور"}
            </Button>
          </>
        )
      )}
    </div>
  );
}
