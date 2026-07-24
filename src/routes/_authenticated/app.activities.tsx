import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, User, Calendar, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { WEEKDAYS, type Activity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/activities")({
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">الأنشطة</h1>
          <p className="text-sm text-muted-foreground">أدر أنشطتك ومدربيها ومواقعها</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-brand-foreground"><Plus className="ms-1 h-4 w-4" /> نشاط جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل النشاط" : "نشاط جديد"}</DialogTitle></DialogHeader>
            <ActivityForm editing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["activities"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> :
        activities.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground">لا توجد أنشطة بعد. ابدأ بإضافة نشاطك الأول.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map(a => (
              <Card key={a.id} className="p-5 card-hover">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold">{a.name}</div>
                    {a.instructor && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" />{a.instructor}</div>}
                    {a.location && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{a.location}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => confirm("حذف النشاط؟") && del.mutate(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {a.days.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.days.map(d => (
                      <span key={d} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand"><Calendar className="ms-0.5 inline h-3 w-3" />{d}</span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

function ActivityForm({ editing, onDone }: { editing: Activity | null; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [instructor, setInstructor] = useState(editing?.instructor ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [days, setDays] = useState<string[]>(editing?.days ?? []);
  const [loading, setLoading] = useState(false);

  const toggle = (d: string) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const payload = { name: name.trim(), instructor: instructor || null, location: location || null, days, user_id: user.id };
      if (editing) {
        const { error } = await supabase.from("activities").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("تم التحديث");
      } else {
        const { error } = await supabase.from("activities").insert(payload);
        if (error) throw error;
        toast.success("تم إضافة النشاط");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5"><Label>اسم النشاط *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>المدرب</Label><Input value={instructor ?? ""} onChange={e => setInstructor(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>المكان</Label><Input value={location ?? ""} onChange={e => setLocation(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>أيام النشاط</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(d => (
            <button type="button" key={d} onClick={() => toggle(d)}
              className={`rounded-full px-3 py-1.5 text-sm border transition ${days.includes(d) ? "bg-brand text-brand-foreground border-brand" : "bg-card hover:bg-muted"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
    </form>
  );
}
