import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/hudoor-logo-light.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — حُضور" },
      { name: "description", content: "أنشئ كلمة مرور جديدة لحسابك في حُضور." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — حُضور" },
      { property: "og:description", content: "أنشئ كلمة مرور جديدة لحسابك في حُضور." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd1.length < 6) return toast.error("كلمة المرور 6 أحرف على الأقل");
    if (pwd1 !== pwd2) return toast.error("كلمتا المرور غير متطابقتين");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح");
      nav({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img src={logo.url} alt="حُضور" className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
          <h1 className="mt-4 text-2xl font-extrabold text-foreground">تعيين كلمة مرور جديدة</h1>
          <p className="text-sm text-muted-foreground">اكتب كلمة المرور الجديدة لحسابك</p>
        </div>

        <Card className="p-6">
          {!ready && (
            <p className="mb-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              افتح هذه الصفحة من رابط الاستعادة المُرسل إلى بريدك الإلكتروني.
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p1">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input id="p1" type={show ? "text" : "password"} dir="ltr" className="ps-10" value={pwd1} onChange={e => setPwd1(e.target.value)} placeholder="6 أحرف على الأقل" />
                <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute inset-y-0 start-2 flex items-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2">تأكيد كلمة المرور</Label>
              <Input id="p2" type={show ? "text" : "password"} dir="ltr" value={pwd2} onChange={e => setPwd2(e.target.value)} />
            </div>
            <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading || !pwd1 || !pwd2}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="ms-1 h-4 w-4" /> حفظ كلمة المرور</>}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
