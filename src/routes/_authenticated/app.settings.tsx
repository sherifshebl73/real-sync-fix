import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, LogOut, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const [academy, setAcademy] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return { user, profile };
    },
  });

  useEffect(() => {
    if (data?.profile) setAcademy(data.profile.academy_name);
    if (data?.user) setEmail(data.user.email ?? "");
  }, [data]);

  const save = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({ academy_name: academy }).eq("id", user!.id);
      if (error) throw error;
      toast.success("تم الحفظ");
      window.location.reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setLoading(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><SettingsIcon className="h-6 w-6" /> الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إدارة بيانات أكاديميتك وحسابك</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-bold">بيانات الأكاديمية</h2>
        <div className="space-y-1.5"><Label>اسم الأكاديمية</Label><Input value={academy} onChange={e => setAcademy(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input value={email} disabled dir="ltr" /></div>
        <Button onClick={save} disabled={loading} className="gradient-brand text-brand-foreground"><Save className="ms-1 h-4 w-4" /> حفظ</Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-destructive mb-2">منطقة الخطر</h2>
        <p className="text-sm text-muted-foreground mb-3">سيتم تسجيل خروجك من الجهاز الحالي.</p>
        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="ms-1 h-4 w-4" /> تسجيل الخروج
        </Button>
      </Card>
    </div>
  );
}
