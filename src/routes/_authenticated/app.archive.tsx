import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, Archive as ArchiveIcon } from "lucide-react";
import { toast } from "sonner";
import type { Player } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: ["archived"],
    queryFn: async () => (await supabase.from("players").select("*").eq("archived", true).order("updated_at", { ascending: false })).data as Player[] ?? [],
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").update({ archived: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["archived"] }); qc.invalidateQueries({ queryKey: ["players"] }); toast.success("تم الاستعادة"); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("players").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["archived"] }); toast.success("تم الحذف نهائياً"); },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><ArchiveIcon className="h-6 w-6 text-muted-foreground" /> الأرشيف</h1>
        <p className="text-sm text-muted-foreground">{players.length} مشترك مؤرشف</p>
      </div>
      {players.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">الأرشيف فارغ</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {players.map(p => (
            <Card key={p.id} className="p-4 flex items-center justify-between opacity-80">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">متبقي {p.remaining_sessions} من {p.total_sessions}</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => restore.mutate(p.id)} title="استعادة"><RotateCcw className="h-4 w-4 text-brand" /></Button>
                <Button variant="ghost" size="icon" onClick={() => confirm("حذف نهائي؟") && del.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
