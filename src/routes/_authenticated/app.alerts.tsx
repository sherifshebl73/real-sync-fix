import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bell, AlertTriangle } from "lucide-react";
import type { Player, Activity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/alerts")({
  component: AlertsPage,
});

function AlertsPage() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").eq("archived", false).lte("remaining_sessions", 2).order("remaining_sessions");
      return (data ?? []) as Player[];
    },
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*")).data as Activity[] ?? [],
  });

  const nameOf = (id: string | null) => activities.find(a => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><Bell className="h-6 w-6 text-warning" /> التنبيهات</h1>
        <p className="text-sm text-muted-foreground">المشتركون الذين تبقى لهم ≤ 2 حصة</p>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا تنبيهات — كل الاشتراكات بحالة جيدة ✅</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map(p => (
            <Card key={p.id} className={`p-4 border-r-4 ${p.remaining_sessions === 0 ? "border-r-destructive" : "border-r-warning"}`}>
              <div className="flex items-start gap-3">
                <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.remaining_sessions === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{nameOf(p.activity_id)}</div>
                  <div className={`mt-1 text-sm font-semibold ${p.remaining_sessions === 0 ? "text-destructive" : "text-warning"}`}>
                    {p.remaining_sessions === 0 ? "انتهى الاشتراك — يحتاج تجديد" : `متبقي ${p.remaining_sessions} حصة فقط`}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
