import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Pencil, Archive as ArchiveIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Player, Activity } from "@/lib/hudoor-types";

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
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); toast.success("تم تجديد الاشتراك"); },
  });

  const filtered = players.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));

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
            <PlayerForm editing={editing} activities={activities} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["players"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="ابحث بالاسم…" value={q} onChange={e => setQ(e.target.value)} className="pe-9" />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> :
        filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            {players.length === 0 ? "لا يوجد مشتركون بعد." : "لا نتائج."}
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map(p => {
              const act = activities.find(a => a.id === p.activity_id);
              const pct = p.total_sessions > 0 ? (p.remaining_sessions / p.total_sessions) * 100 : 0;
              const low = p.remaining_sessions <= 2;
              return (
                <Card key={p.id} className="p-4 card-hover">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold">{p.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{act?.name ?? "بدون نشاط"} {p.receipt_number ? `• إيصال #${p.receipt_number}` : ""}</div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => renew.mutate(p)} title="تجديد"><RotateCcw className="h-4 w-4 text-brand" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => archive.mutate(p.id)} title="أرشفة"><ArchiveIcon className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => confirm("حذف نهائي؟") && del.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={low ? "font-bold text-warning" : "text-muted-foreground"}>
                      متبقي {p.remaining_sessions} من {p.total_sessions} حصة
                    </span>
                    <span className="text-muted-foreground">{new Date(p.registration_date).toLocaleDateString("ar-EG")}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${low ? "bg-warning" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

function PlayerForm({ editing, activities, onDone }: { editing: Player | null; activities: Activity[]; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [activityId, setActivityId] = useState(editing?.activity_id ?? "");
  const [regDate, setRegDate] = useState(editing?.registration_date ?? new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState(editing?.receipt_number ?? "");
  const [total, setTotal] = useState(editing?.total_sessions ?? 8);
  const [remaining, setRemaining] = useState(editing?.remaining_sessions ?? 8);
  const [note, setNote] = useState(editing?.note ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const payload = {
        name: name.trim(),
        activity_id: activityId || null,
        registration_date: regDate,
        receipt_number: receipt || null,
        total_sessions: Number(total),
        remaining_sessions: Number(remaining),
        note: note || null,
        user_id: user.id,
      };
      if (editing) {
        const { error } = await supabase.from("players").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("تم التحديث");
      } else {
        const { error } = await supabase.from("players").insert(payload);
        if (error) throw error;
        toast.success("تمت الإضافة");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div className="space-y-1.5"><Label>اسم المشترك *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div className="space-y-1.5">
        <Label>النشاط</Label>
        <Select value={activityId ?? ""} onValueChange={setActivityId}>
          <SelectTrigger><SelectValue placeholder="اختر نشاطاً" /></SelectTrigger>
          <SelectContent>
            {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
