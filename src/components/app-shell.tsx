import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/hudoor-logo-light.jpg.asset.json";
import { Home, CalendarDays, Users, ClipboardCheck, Archive, Bell, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV = [
  { to: "/app", label: "الرئيسية", icon: Home, exact: true },
  { to: "/app/activities", label: "الأنشطة", icon: CalendarDays },
  { to: "/app/players", label: "المشتركون", icon: Users },
  { to: "/app/attendance", label: "تسجيل الحضور", icon: ClipboardCheck },
  { to: "/app/alerts", label: "التنبيهات", icon: Bell },
  { to: "/app/reports", label: "التقارير", icon: BarChart3 },
  { to: "/app/archive", label: "الأرشيف", icon: Archive },
  { to: "/app/settings", label: "الإعدادات", icon: Settings },
];

export function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [academy, setAcademy] = useState("أكاديميتي");
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("academy_name,logo_url").maybeSingle().then(async ({ data }) => {
      if (data?.academy_name) setAcademy(data.academy_name);
      if (data?.logo_url) {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(data.logo_url, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) setCustomLogo(signed.signedUrl);
      }
    });
  }, []);


  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    nav({ to: "/auth" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={customLogo ?? logo.url} alt="حُضور" className="h-9 w-9 rounded-lg object-cover" />
            <div className="text-sm font-bold">{academy}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(v => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className={`${open ? "block" : "hidden"} md:block fixed md:sticky md:top-0 inset-y-0 right-0 z-30 h-screen w-64 shrink-0 border-l bg-card`}>
          <div className="flex h-full flex-col p-4">
            <Link to="/app" className="mb-6 flex items-center gap-3 rounded-xl p-2 hover:bg-muted">
              <img src={customLogo ?? logo.url} alt="حُضور" className="h-11 w-11 rounded-xl object-cover" />
              <div className="leading-tight">
                <div className="text-sm font-extrabold">{academy}</div>
                <div className="text-xs text-muted-foreground">حُضور</div>
              </div>
            </Link>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV.map(({ to, label, icon: Icon, exact }) => {
                const active = isActive(to, exact);
                return (
                  <Link key={to} to={to as string}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active ? "bg-brand-soft text-brand" : "text-foreground hover:bg-muted"
                    }`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <Button variant="ghost" onClick={signOut} className="mt-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="ms-2 h-4 w-4" /> تسجيل الخروج
            </Button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
