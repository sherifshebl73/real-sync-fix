import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/hudoor-logo-light.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Users, CalendarDays, BarChart3, Bell } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "حُضور — إدارة الحضور والحصص بذكاء" },
      { name: "description", content: "نظام متكامل لإدارة اشتراكات وحضور الأنشطة الرياضية والأكاديميات." },
      { property: "og:title", content: "حُضور — إدارة الحضور والحصص بذكاء" },
      { property: "og:description", content: "أنشطة، مشتركين، حضور، تنبيهات — كل شيء في مكان واحد." },
    ],
  }),
});

function Landing() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="حُضور" className="h-11 w-11 rounded-xl object-cover" />
            <div className="leading-tight">
              <div className="text-lg font-extrabold text-foreground">حُضور</div>
              <div className="text-xs text-muted-foreground">إدارة الحضور والحصص</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild><Link to="/app">افتح لوحة التحكم <ArrowLeft className="ms-2 h-4 w-4" /></Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/auth">تسجيل الدخول</Link></Button>
                <Button asChild><Link to="/auth" search={{ mode: "signup" }}>ابدأ مجاناً</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-brand-soft/40 px-4 py-1.5 text-sm text-foreground">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          نسخة جديدة أنظف وأسرع
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
          أدر حضور طلابك<br />
          <span className="bg-gradient-to-l from-brand to-navy bg-clip-text text-transparent">بذكاء وبساطة</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          حُضور نظام متكامل للأكاديميات والأنشطة الرياضية. سجّل المشتركين، تابع الحضور،
          احسب الحصص المتبقية، واستلم تنبيهات ذكية — كل ذلك من هاتفك.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild className="gradient-brand text-brand-foreground hover:opacity-90">
            <Link to="/auth" search={{ mode: "signup" }}>ابدأ مجاناً الآن</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/auth">لدي حساب</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarDays, title: "أنشطة متعددة", d: "نظّم أنشطتك بأيامها ومدربيها ومواقعها." },
            { icon: Users, title: "المشتركون", d: "بيانات كل مشترك مع عدد الحصص والإيصالات." },
            { icon: CheckCircle2, title: "تسجيل الحضور", d: "بنقرة واحدة، مع خصم تلقائي للحصص." },
            { icon: Bell, title: "تنبيهات ذكية", d: "تعرف مبكراً بمن اقترب اشتراكه من النهاية." },
          ].map(({ icon: Icon, title, d }) => (
            <div key={title} className="rounded-2xl border bg-card p-5 card-hover">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-bold text-foreground">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          تقارير وأرشيف كامل لكل نشاط ومشترك
        </div>
      </section>

      <footer className="border-t bg-card/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} حُضور — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
