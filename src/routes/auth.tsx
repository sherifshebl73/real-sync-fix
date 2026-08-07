import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/hudoor-logo-light.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — حُضور" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً جديداً في حُضور." },
    ],
  }),
});

function AuthPage() {
  const nav = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [academy, setAcademy] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const sendReset = async () => {
    if (!email) return toast.error("اكتب بريدك الإلكتروني أولاً");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("أرسلنا رابط استعادة كلمة المرور إلى بريدك");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app" });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { academy_name: academy || "أكاديميتي" },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء حسابك بنجاح");
        nav({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("مرحباً بعودتك");
        nav({ to: "/app" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg.includes("Invalid") ? "بيانات الدخول غير صحيحة" :
                  msg.includes("already") ? "هذا البريد مسجل بالفعل" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img src={logo.url} alt="حُضور" className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
          <h1 className="mt-4 text-2xl font-extrabold text-foreground">حُضور</h1>
          <p className="text-sm text-muted-foreground">إدارة الحضور والحصص بذكاء</p>
        </div>

        <Card className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button type="button" onClick={() => setTab("signin")}
              className={`rounded-md py-2 text-sm font-semibold transition ${tab==="signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              تسجيل الدخول
            </button>
            <button type="button" onClick={() => setTab("signup")}
              className={`rounded-md py-2 text-sm font-semibold transition ${tab==="signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              حساب جديد
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="academy">اسم الأكاديمية</Label>
                <Input id="academy" value={academy} onChange={e => setAcademy(e.target.value)} placeholder="مثال: أكاديمية النجوم" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                {tab === "signin" && (
                  <button type="button" onClick={sendReset} className="text-xs font-semibold text-brand hover:underline">
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Input id="password" type={showPwd ? "text" : "password"} required minLength={6} dir="ltr" className="pe-10"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
                <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute inset-y-0 end-2 flex items-center text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (tab === "signup" ? "إنشاء الحساب" : "دخول")}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          بإنشائك للحساب فأنت توافق على شروط الاستخدام
        </p>
      </div>
    </div>
  );
}
