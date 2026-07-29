import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bell, AlertTriangle } from "lucide-react";
import type { Player, Activity, PlayerActivity } from "@/lib/hudoor-types";

export const Route = createFileRoute("/_authenticated/app/alerts")({
  component: AlertsPage,
});

type AlertItem = {
  key: string;
  player: Player;
  activityName: string;
  remaining: number;
  total: number;
};

function AlertsPage() {
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*")).data as Activity[] ?? [],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", activities.map(a => a.id).join(",")],
    queryFn: async () => {
      const { data: players } = await supabase.from("players").select("*").eq("archived", false);
      const { data: links } = await supabase.from("player_activities").select("*").lte("remaining_sessions", 2);
      const playersMap = new Map((players ?? []).map(p => [p.id, p as Player]));
      const items: AlertItem[] = [];

      ((links ?? []) as PlayerActivity[]).forEach(l => {
        const p = playersMap.get(l.player_id);
        if (!p) return;
        const a = activities.find(x => x.id === l.activity_id);
        items.push({
          key: l.id,
          player: p,
          activityName: a?.name ?? "—",
          remaining: l.remaining_sessions,
          total: l.total_sessions,
        });
      });

      // Legacy players without any link but low remaining
      const linkedIds = new Set(((links ?? []) as PlayerActivity[]).map(l => l.player_id));
      const { data: allLinks } = await supabase.from("player_activities").select("player_id");
      const anyLinkedIds = new Set(((allLinks ?? []) as { player_id: string }[]).map(x => x.player_id));
      (players ?? []).forEach(p => {
        if (!anyLinkedIds.has(p.id) && (p as Player).remaining_sessions <= 2) {
          const a = activities.find(x => x.id === (p as Player).activity_id);
          items.push({
            key: `legacy-${p.id}`,
            player: p as Player,
            activityName: a?.name ?? "بدون نشاط",
            remaining: (p as Player).remaining_sessions,
            total: (p as Player).total_sessions,
          });
        }
      });

      return items.sort((a, b) => a.remaining - b.remaining);
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><Bell className="h-6 w-6 text-warning" /> التنبيهات</h1>
        <p className="text-sm text-muted-foreground">اشتراكات تبقى لها ≤ 2 حصة في نشاط معين</p>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا تنبيهات — كل الاشتراكات بحالة جيدة ✅</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map(a => (
            <Card key={a.key} className={`p-4 border-r-4 ${a.remaining === 0 ? "border-r-destructive" : "border-r-warning"}`}>
              <div className="flex items-start gap-3">
                <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.remaining === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{a.player.name}</div>
                  <div className="text-xs text-muted-foreground">{a.activityName}</div>
                  <div className={`mt-1 text-sm font-semibold ${a.remaining === 0 ? "text-destructive" : "text-warning"}`}>
                    {a.remaining === 0 ? "انتهى الاشتراك في هذا النشاط — يحتاج تجديد" : `متبقي ${a.remaining} من ${a.total} حصة`}
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
