import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, LogOut, Save, Download, Upload, Database, ImageIcon, KeyRound, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { toCSV, downloadFile } from "@/lib/hudoor-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readPlayersFile, buildPreview, applyImport, exportPlayersXLSX, type ImportPreview, type ImportMode } from "@/lib/players-import";


export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});


function SettingsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [academy, setAcademy] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);


  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return { user, profile };
    },
  });

  useEffect(() => {
    if (data?.profile) {
      setAcademy(data.profile.academy_name);
      setLogoPath(data.profile.logo_url);
    }
    if (data?.user) setEmail(data.user.email ?? "");
  }, [data]);

  // Resolve signed URL for private logo
  useEffect(() => {
    if (!logoPath) { setLogoUrl(null); return; }
    supabase.storage.from("logos").createSignedUrl(logoPath, 60 * 60 * 24 * 365).then(({ data }) => {
      if (data?.signedUrl) setLogoUrl(data.signedUrl);
    });
  }, [logoPath]);

  const save = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({ academy_name: academy }).eq("id", user!.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("تم الحفظ");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setLoading(false); }
  };

  const uploadLogo = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      if (file.size > 2 * 1024 * 1024) throw new Error("حجم الصورة أكبر من 2MB");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Remove old
      if (logoPath) await supabase.storage.from("logos").remove([logoPath]);
      const { error } = await supabase.from("profiles").update({ logo_url: path }).eq("id", user.id);
      if (error) throw error;
      setLogoPath(path);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("تم رفع اللوجو");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  };

  const removeLogo = async () => {
    if (!logoPath) return;
    if (!confirm("حذف اللوجو؟")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.storage.from("logos").remove([logoPath]);
      await supabase.from("profiles").update({ logo_url: null }).eq("id", user!.id);
      setLogoPath(null); setLogoUrl(null);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("تم الحذف");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
  };

  const changePassword = async () => {
    if (pwd1.length < 6) return toast.error("كلمة المرور 6 أحرف على الأقل");
    if (pwd1 !== pwd2) return toast.error("كلمتا المرور غير متطابقتين");
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;
      setPwd1(""); setPwd2("");
      toast.success("تم تغيير كلمة المرور");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setPwdLoading(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };


  // ---------- Export players CSV ----------
  const exportPlayersCSV = async () => {
    const { data: players } = await supabase.from("players").select("*").order("name");
    const { data: activities } = await supabase.from("activities").select("id,name");
    const map = new Map((activities ?? []).map(a => [a.id, a.name]));
    const rows = (players ?? []).map(p => ({
      الاسم: p.name, "رقم الإيصال": p.receipt_number ?? "",
      "النشاط الأساسي": map.get(p.activity_id ?? "") ?? "",
      "الحصص الكلية": p.total_sessions, "الحصص المتبقية": p.remaining_sessions,
      "تاريخ التسجيل": p.registration_date, ملاحظات: p.note ?? "", مؤرشف: p.archived ? "نعم" : "لا",
    }));
    downloadFile(`المشتركون-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    toast.success(`تم تصدير ${rows.length} مشترك`);
  };

  // ---------- Import players (Excel/CSV) with mode ----------
  const pickImportFile = async (file: File) => {
    try {
      const rows = await readPlayersFile(file);
      if (rows.length === 0) throw new Error("لا توجد صفوف صالحة (تأكد من عمود 'الاسم')");
      const pv = await buildPreview(rows);
      setPreview(pv);
      setMode("merge");
      setImportOpen(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذّر قراءة الملف"); }
  };

  const confirmImport = async () => {
    if (!preview) return;
    if (mode === "replace" && !confirm("سيتم حذف كل المشتركين الحاليين وسجلات حضورهم واستبدالهم ببيانات الملف. متأكد؟")) return;
    setImporting(true);
    try {
      const res = await applyImport(preview.rows, mode);
      qc.invalidateQueries();
      setImportOpen(false); setPreview(null);
      toast.success(
        mode === "replace"
          ? `تم الاستبدال: ${res.inserted} مشترك (حُذف ${res.deleted})`
          : `تم التحديث: ${res.updated} معدّل، ${res.inserted} جديد`
      );
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ في الاستيراد"); }
    finally { setImporting(false); }
  };


  // ---------- Full backup JSON ----------
  const exportBackup = async () => {
    const [profiles, activities, players, attendance, links] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("activities").select("*"),
      supabase.from("players").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("player_activities").select("*"),
    ]);
    const backup = {
      version: 1, exported_at: new Date().toISOString(),
      profiles: profiles.data, activities: activities.data,
      players: players.data, attendance: attendance.data, player_activities: links.data,
    };
    downloadFile(`hudoor-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
    toast.success("تم تصدير النسخة الاحتياطية");
  };

  const importBackup = async (file: File) => {
    if (!confirm("سيتم إضافة بيانات النسخة الاحتياطية إلى أكاديميتك (بدون حذف الحالي). هل تريد المتابعة؟")) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");

      const idMap = { activities: new Map<string, string>(), players: new Map<string, string>() };
      let counts = { activities: 0, players: 0, links: 0, attendance: 0 };

      // Activities
      for (const a of backup.activities ?? []) {
        const { data, error } = await supabase.from("activities").insert({
          user_id: user.id, name: a.name, instructor: a.instructor, location: a.location,
          days: a.days ?? [], color: a.color,
        }).select("id").single();
        if (!error && data) { idMap.activities.set(a.id, data.id); counts.activities++; }
      }
      // Players
      for (const p of backup.players ?? []) {
        const { data, error } = await supabase.from("players").insert({
          user_id: user.id, name: p.name, activity_id: p.activity_id ? idMap.activities.get(p.activity_id) ?? null : null,
          receipt_number: p.receipt_number, total_sessions: p.total_sessions, remaining_sessions: p.remaining_sessions,
          registration_date: p.registration_date, note: p.note, archived: p.archived,
        }).select("id").single();
        if (!error && data) { idMap.players.set(p.id, data.id); counts.players++; }
      }
      // Junction
      for (const l of backup.player_activities ?? []) {
        const pid = idMap.players.get(l.player_id); const aid = idMap.activities.get(l.activity_id);
        if (pid && aid) {
          const { error } = await supabase.from("player_activities").insert({ user_id: user.id, player_id: pid, activity_id: aid });
          if (!error) counts.links++;
        }
      }
      // Attendance
      for (const r of backup.attendance ?? []) {
        const pid = idMap.players.get(r.player_id); const aid = r.activity_id ? idMap.activities.get(r.activity_id) : null;
        if (pid) {
          const { error } = await supabase.from("attendance").insert({
            user_id: user.id, player_id: pid, activity_id: aid ?? null,
            attendance_date: r.attendance_date, present: r.present,
          });
          if (!error) counts.attendance++;
        }
      }
      qc.invalidateQueries();
      toast.success(`تم الاستيراد: ${counts.activities} نشاط، ${counts.players} مشترك، ${counts.attendance} سجل حضور`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ في الاستيراد"); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><SettingsIcon className="h-6 w-6" /> الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إدارة بيانات أكاديميتك، الاستيراد والتصدير</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5 text-brand" /> لوجو الأكاديمية</h2>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 rounded-xl border overflow-hidden bg-muted flex items-center justify-center">
            {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => logoRef.current?.click()}><Upload className="ms-1 h-4 w-4" /> رفع لوجو</Button>
            {logoPath && <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={removeLogo}><Trash2 className="ms-1 h-4 w-4" /> حذف</Button>}
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">PNG أو JPG، حجم أقصى 2MB. يظهر في الشريط الجانبي والتقارير.</p>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-bold">بيانات الأكاديمية</h2>
        <div className="space-y-1.5"><Label>اسم الأكاديمية</Label><Input value={academy} onChange={e => setAcademy(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input value={email} disabled dir="ltr" /></div>
        <Button onClick={save} disabled={loading} className="gradient-brand text-brand-foreground"><Save className="ms-1 h-4 w-4" /> حفظ</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><KeyRound className="h-5 w-5 text-brand" /> تغيير كلمة المرور</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>كلمة المرور الجديدة</Label><Input type="password" value={pwd1} onChange={e => setPwd1(e.target.value)} dir="ltr" /></div>
          <div className="space-y-1.5"><Label>تأكيد كلمة المرور</Label><Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} dir="ltr" /></div>
        </div>
        <Button onClick={changePassword} disabled={pwdLoading || !pwd1 || !pwd2} className="gradient-brand text-brand-foreground"><KeyRound className="ms-1 h-4 w-4" /> تحديث كلمة المرور</Button>
        <p className="text-[11px] text-muted-foreground">6 أحرف على الأقل.</p>
      </Card>


      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-bold flex items-center gap-2"><Database className="h-5 w-5 text-brand" /> استيراد وتصدير المشتركين</h2>
          <p className="text-xs text-muted-foreground mt-1">صدّر الملف، عدّل عليه في Excel، ثم استورده مع اختيار: إضافة التعديلات فقط أو استبدال كامل.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={async () => { const n = await exportPlayersXLSX(); toast.success(`تم تصدير ${n} مشترك`); }}>
            <FileSpreadsheet className="ms-1 h-4 w-4" /> تصدير Excel (xlsx)
          </Button>
          <Button variant="outline" onClick={() => csvRef.current?.click()}><Upload className="ms-1 h-4 w-4" /> استيراد ملف (Excel / CSV)</Button>
          <Button variant="outline" onClick={exportPlayersCSV}><Download className="ms-1 h-4 w-4" /> تصدير CSV</Button>
          <input ref={csvRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickImportFile(f); e.target.value = ""; }} />
        </div>
        <p className="text-[11px] text-muted-foreground">الأعمدة المتوقعة: الاسم، رقم الإيصال، النشاط الأساسي، الحصص الكلية، الحصص المتبقية، تاريخ التسجيل، ملاحظات، مؤرشف. المطابقة تتم برقم الإيصال وإن لم يوجد فبالاسم.</p>
      </Card>


      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-bold flex items-center gap-2"><Database className="h-5 w-5 text-brand" /> نسخة احتياطية كاملة (JSON)</h2>
          <p className="text-xs text-muted-foreground mt-1">تحتوي على كل بياناتك: أنشطة، مشتركون، حضور، وارتباطاتهم.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={exportBackup}><Download className="ms-1 h-4 w-4" /> تصدير نسخة احتياطية</Button>
          <Button variant="outline" onClick={() => jsonRef.current?.click()}><Upload className="ms-1 h-4 w-4" /> استيراد نسخة احتياطية</Button>
          <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ""; }} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-destructive mb-2">منطقة الخطر</h2>
        <p className="text-sm text-muted-foreground mb-3">سيتم تسجيل خروجك من الجهاز الحالي.</p>
        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="ms-1 h-4 w-4" /> تسجيل الخروج
        </Button>
      </Card>

      <Dialog open={importOpen} onOpenChange={o => { if (!importing) { setImportOpen(o); if (!o) setPreview(null); } }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>خيارات الاستيراد</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <div>صفوف الملف: <b>{preview.rows.length}</b></div>
                <div>مطابقة لمشتركين حاليين (سيتم تعديلها): <b>{preview.updates}</b></div>
                <div>جديدة (ستُضاف): <b>{preview.inserts}</b></div>
                <div>المسجّلون حالياً في النظام: <b>{preview.existingTotal}</b></div>
                {preview.missingActivities.length > 0 && (
                  <div className="text-muted-foreground text-xs">سيتم إنشاء أنشطة جديدة: {preview.missingActivities.join("، ")}</div>
                )}
              </div>

              <RadioGroup value={mode} onValueChange={v => setMode(v as ImportMode)} className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-brand">
                  <RadioGroupItem value="merge" className="mt-1" />
                  <span>
                    <span className="font-semibold block">إضافة التعديلات فقط (دمج)</span>
                    <span className="text-xs text-muted-foreground">تحديث بيانات المشتركين المطابقين وإضافة الجدد، مع الاحتفاظ بكل البيانات القديمة وسجلات الحضور.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-destructive">
                  <RadioGroupItem value="replace" className="mt-1" />
                  <span>
                    <span className="font-semibold block text-destructive">استبدال كامل</span>
                    <span className="text-xs text-muted-foreground">حذف جميع المشتركين الحاليين وسجلات حضورهم، ثم إدخال بيانات الملف فقط.</span>
                  </span>
                </label>
              </RadioGroup>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>إلغاء</Button>
            <Button onClick={confirmImport} disabled={importing} className={mode === "replace" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-brand text-brand-foreground"}>
              {importing ? "جارٍ التنفيذ..." : mode === "replace" ? "استبدال كامل" : "تطبيق التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
