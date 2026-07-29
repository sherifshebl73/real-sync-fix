import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Pencil, Archive as ArchiveIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Player, Activity, PlayerActivity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/players")({
  component: PlayersPage,
});

function PlayersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*").order("name")).data as Activity[] ?? [],
  });

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").eq("archived", false).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Player[];
    },
  });

  const { data: allLinks = [] } = useQuery({
    queryKey: ["player_activities_all"],
    queryFn: async () => (await supabase.from("player_activities").select("*")).data as PlayerActivity[] ?? [],
  });

  const linksByPlayer = new Map<string, PlayerActivity[]>();
  allLinks.forEach(l => {
    const arr = linksByPlayer.get(l.player_id) ?? [];
    arr.push(l);
    linksByPlayer.set(l.player_id, arr);
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); toast.success("تم أرشفة المشترك"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); toast.success("تم الحذف"); },
  });

  const renew = useMutation({
    mutationFn: async (p: Player) => {
      const { error } = await supabase.from("players").update({ remaining_sessions: p.total_sessions }).eq("id", p.id);
      if (error) throw error;
      // Reset per-activity remaining to each link's total
      const links = linksByPlayer.get(p.id) ?? [];
      for (const l of links) {
        await supabase.from("player_activities").update({ remaining_sessions: l.total_sessions }).eq("id", l.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player_activities_all"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("تم تجديد الاشتراك");
    },
  });

  const filtered = players.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.receipt_number ?? "").includes(q));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">المشتركون</h1>
          <p className="text-sm text-muted-foreground">{players.length} مشترك نشط</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-brand-foreground"><Plus className="ms-1 h-4 w-4" /> مشترك جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل المشترك" : "مشترك جديد"}</DialogTitle></DialogHeader>
            <PlayerForm
              editing={editing}
              activities={activities}
              initialLinks={editing ? (linksByPlayer.get(editing.id) ?? []) : []}
              onDone={() => {
                setOpen(false); setEditing(null);
                qc.invalidateQueries({ queryKey: ["players"] });
                qc.invalidateQueries({ queryKey: ["player_activities_all"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="ابحث بالاسم أو رقم الإيصال…" value={q} onChange={e => setQ(e.target.value)} className="pe-9" />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> :
        filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            {players.length === 0 ? "لا يوجد مشتركون بعد." : "لا نتائج."}
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map(p => {
              const links = linksByPlayer.get(p.id) ?? [];
              const hasLinks = links.length > 0;
              const totalCap = hasLinks ? links.reduce((s, l) => s + l.total_sessions, 0) : p.total_sessions;
              const totalRem = hasLinks ? links.reduce((s, l) => s + l.remaining_sessions, 0) : p.remaining_sessions;
              const pct = totalCap > 0 ? (totalRem / totalCap) * 100 : 0;
              const low = links.some(l => l.remaining_sessions <= 2) || (!hasLinks && p.remaining_sessions <= 2);
              return (
                <Card key={p.id} className="p-4 card-hover">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold">{p.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.receipt_number ? `إيصال #${p.receipt_number} • ` : ""}
                        {new Date(p.registration_date).toLocaleDateString("ar-EG")}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => renew.mutate(p)} title="تجديد"><RotateCcw className="h-4 w-4 text-brand" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => archive.mutate(p.id)} title="أرشفة"><ArchiveIcon className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => confirm("حذف نهائي؟") && del.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>

                  {hasLinks ? (
                    <div className="mt-3 space-y-1.5">
                      {links.map(l => {
                        const a = activities.find(x => x.id === l.activity_id);
                        const lp = l.total_sessions > 0 ? (l.remaining_sessions / l.total_sessions) * 100 : 0;
                        const ll = l.remaining_sessions <= 2;
                        return (
                          <div key={l.id} className="rounded-md border p-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold">{a?.name ?? "—"}</span>
                              <span className={ll ? "font-bold text-warning" : "text-muted-foreground"}>
                                متبقي {l.remaining_sessions} من {l.total_sessions}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div className={`h-full ${ll ? "bg-warning" : "bg-brand"}`} style={{ width: `${lp}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">بدون نشاط</span>
                        <span className={low ? "font-bold text-warning" : "text-muted-foreground"}>
                          متبقي {totalRem} من {totalCap}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${low ? "bg-warning" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

function PlayerForm({ editing, activities, initialActivityIds, onDone }: {
  editing: Player | null;
  activities: Activity[];
  initialActivityIds: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [activityIds, setActivityIds] = useState<string[]>(initialActivityIds);
  const [regDate, setRegDate] = useState(editing?.registration_date ?? new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState(editing?.receipt_number ?? "");
  const [total, setTotal] = useState(editing?.total_sessions ?? 8);
  const [remaining, setRemaining] = useState(editing?.remaining_sessions ?? 8);
  const [note, setNote] = useState(editing?.note ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setActivityIds(initialActivityIds); }, [editing?.id]);

  const toggle = (id: string) => setActivityIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const primary = activityIds[0] ?? null;
      const payload = {
        name: name.trim(),
        activity_id: primary,
        registration_date: regDate,
        receipt_number: receipt || null,
        total_sessions: Number(total),
        remaining_sessions: Number(remaining),
        note: note || null,
        user_id: user.id,
      };

      let playerId: string;
      if (editing) {
        const { error } = await supabase.from("players").update(payload).eq("id", editing.id);
        if (error) throw error;
        playerId = editing.id;
      } else {
        const { data, error } = await supabase.from("players").insert(payload).select("id").single();
        if (error) throw error;
        playerId = data!.id;
      }

      // Sync junction
      await supabase.from("player_activities").delete().eq("player_id", playerId);
      if (activityIds.length > 0) {
        const rows = activityIds.map(aid => ({ user_id: user.id, player_id: playerId, activity_id: aid }));
        const { error: linkErr } = await supabase.from("player_activities").insert(rows);
        if (linkErr) throw linkErr;
      }

      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div className="space-y-1.5"><Label>اسم المشترك *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>

      <div className="space-y-2">
        <Label>الأنشطة {activityIds.length > 0 && <span className="text-xs text-muted-foreground">({activityIds.length} مختارة)</span>}</Label>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد أنشطة — أضف نشاطاً أولاً.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activities.map(a => (
              <button type="button" key={a.id} onClick={() => toggle(a.id)}
                className={`rounded-full px-3 py-1.5 text-sm border transition ${activityIds.includes(a.id) ? "bg-brand text-brand-foreground border-brand" : "bg-card hover:bg-muted"}`}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">يمكن اختيار أكثر من نشاط.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>تاريخ التسجيل</Label><Input type="date" value={regDate} onChange={e => setRegDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>رقم الإيصال</Label><Input value={receipt ?? ""} onChange={e => setReceipt(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>عدد الحصص الكلي</Label><Input type="number" min={1} value={total} onChange={e => { setTotal(Number(e.target.value)); if (!editing) setRemaining(Number(e.target.value)); }} /></div>
        <div className="space-y-1.5"><Label>الحصص المتبقية</Label><Input type="number" min={0} value={remaining} onChange={e => setRemaining(Number(e.target.value))} /></div>
      </div>
      <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={note ?? ""} onChange={e => setNote(e.target.value)} /></div>
      <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading}>{editing ? "حفظ" : "إضافة"}</Button>
    </form>
  );
}
