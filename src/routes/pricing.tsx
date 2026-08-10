import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/hudoor-logo-light.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "الأسعار والاشتراكات — حُضور" },
      { name: "description", content: "خطط أسعار مرنة لأكاديميتك: ابدأ مجاناً لأول 50 مشترك، ثم اختر ما يناسب حجم أكاديميتك." },
      { property: "og:title", content: "الأسعار والاشتراكات — حُضور" },
      { property: "og:description", content: "ابدأ مجاناً وطوّر خطتك مع نمو أكاديميتك." },
    ],
  }),
});

type Plan = {
  key: string;
  name: string;
  tagline: string;
  cap: string;
  monthly: number;
  yearly: number;
  yearlyMonthlyEq: number;
  save: string;
  featured?: boolean;
  yearlyOnly?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    key: "free",
    name: "المجانية",
    tagline: "ابدأ بدون أي تكلفة",
    cap: "حتى 50 مشترك",
    monthly: 0,
    yearly: 0,
    yearlyMonthlyEq: 0,
    save: "",
    features: [
      "كل الميزات الأساسية",
      "أنشطة غير محدودة",
      "تسجيل حضور يومي",
      "تنبيهات نفاد الحصص",
      "نسخة احتياطية وتصدير CSV",
    ],
  },
  {
    key: "starter",
    name: "ستارتر",
    tagline: "للأكاديميات الصغيرة النامية",
    cap: "حتى 100 مشترك",
    monthly: 0,
    yearly: 10,
    yearlyMonthlyEq: 0.83,
    save: "اشتراك سنوي فقط",
    yearlyOnly: true,
    features: [
      "كل ميزات الخطة المجانية",
      "دعم عبر البريد",
      "تقارير تفصيلية بالفترة",
      "استيراد وتصدير Excel/CSV",
    ],
  },
  {
    key: "pro",
    name: "برو",
    tagline: "الأكثر شعبية للأكاديميات المتوسطة",
    cap: "حتى 500 مشترك",
    monthly: 5,
    yearly: 48,
    yearlyMonthlyEq: 4,
    save: "وفّر 20%",
    featured: true,
    features: [
      "كل ميزات ستارتر",
      "أولوية في الدعم",
      "أنشطة ومدربين متعددين",
      "تخصيص لوجو الأكاديمية",
    ],
  },
  {
    key: "unlimited",
    name: "غير محدود",
    tagline: "للمنشآت الكبرى والسلاسل",
    cap: "عدد مشتركين غير محدود",
    monthly: 20,
    yearly: 180,
    yearlyMonthlyEq: 15,
    save: "وفّر 25%",
    features: [
      "كل ميزات برو",
      "بدون حد أقصى للمشتركين",
      "دعم فني ذو أولوية قصوى",
      "نسخ احتياطي تلقائي",
    ],
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo.url} alt="حُضور" className="h-11 w-11 rounded-xl object-cover" />
            <div className="leading-tight">
              <div className="text-lg font-extrabold text-foreground">حُضور</div>
              <div className="text-xs text-muted-foreground">إدارة الحضور والحصص</div>
            </div>
          </Link>
          <Button variant="ghost" asChild><Link to="/">الرئيسية <ArrowLeft className="ms-1 h-4 w-4" /></Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-brand-soft/40 px-4 py-1.5 text-sm">
          <Sparkles className="h-4 w-4 text-brand" /> ابدأ مجاناً — لا حاجة لبطاقة ائتمان
        </div>
        <h1 className="text-4xl font-extrabold md:text-5xl">خطط تنمو مع أكاديميتك</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          اختر الخطة المناسبة لعدد مشتركيك. يمكنك الترقية أو التراجع في أي وقت.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border bg-card p-1">
          <button onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!yearly ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>
            شهري
          </button>
          <button onClick={() => setYearly(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${yearly ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>
            سنوي <span className="text-[10px]">(وفّر حتى 25%)</span>
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(p => {
            const price = yearly ? p.yearlyMonthlyEq : p.monthly;
            return (
              <Card key={p.key} className={`relative p-6 flex flex-col ${p.featured ? "border-brand border-2 shadow-lg" : ""}`}>
                {p.featured && (
                  <span className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">
                    الأكثر اختياراً
                  </span>
                )}
                <div className="mb-3">
                  <h3 className="text-xl font-extrabold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
                </div>
                <div className="mb-2 text-sm font-medium text-brand">{p.cap}</div>
                <div className="mb-4">
                  {p.monthly === 0 ? (
                    <div className="text-4xl font-extrabold">مجاناً</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold">${price % 1 === 0 ? price : price.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">/ شهر</span>
                      </div>
                      {yearly && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          يُدفع سنوياً ${p.yearly} — <span className="text-brand font-bold">{p.save}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <ul className="space-y-2 text-sm flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className={`mt-6 w-full ${p.featured ? "gradient-brand text-brand-foreground" : ""}`} variant={p.featured ? "default" : "outline"}>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {p.monthly === 0 ? "ابدأ مجاناً" : "اختر هذه الخطة"}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="mt-10 p-6 bg-brand-soft/30 border-brand/20">
          <p className="text-sm text-center text-muted-foreground">
            💳 طرق الدفع قيد الإعداد — سنعلن قريباً عن دعم البطاقات والمحافظ الإلكترونية.
            <br />
            كل الحسابات الحالية تعمل على الخطة المجانية حالياً بدون قيود حتى يتم تفعيل الدفع.
          </p>
        </Card>
      </section>

      <footer className="border-t bg-card/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} حُضور — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
