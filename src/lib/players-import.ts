import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type ImportMode = "merge" | "replace";

export type ImportRow = {
  name: string;
  receipt_number: string | null;
  activity_name: string;
  total_sessions: number;
  remaining_sessions: number;
  registration_date: string;
  note: string | null;
  archived: boolean;
};

export const IMPORT_HEADERS = [
  "الاسم",
  "رقم الإيصال",
  "النشاط الأساسي",
  "الحصص الكلية",
  "الحصص المتبقية",
  "تاريخ التسجيل",
  "ملاحظات",
  "مؤرشف",
] as const;

const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

function normalizeDate(v: string): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  // Excel serial number
  if (/^\d{5}$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) as unknown as number);
    d.setUTCDate(d.getUTCDate() + Number(v));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** يقرأ ملف Excel (xlsx/xls) أو CSV ويحوله لصفوف */
export async function readPlayersFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", codepage: 65001 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("الملف لا يحتوي على أوراق عمل");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  return raw
    .map((r) => {
      const total = Number(pick(r, "الحصص الكلية", "total_sessions") || 8) || 8;
      const remainingRaw = pick(r, "الحصص المتبقية", "remaining_sessions");
      return {
        name: pick(r, "الاسم", "name"),
        receipt_number: pick(r, "رقم الإيصال", "receipt_number") || null,
        activity_name: pick(r, "النشاط الأساسي", "activity", "activity_name"),
        total_sessions: total,
        remaining_sessions: remainingRaw !== "" ? Number(remainingRaw) || 0 : total,
        registration_date: normalizeDate(pick(r, "تاريخ التسجيل", "registration_date")),
        note: pick(r, "ملاحظات", "note") || null,
        archived: pick(r, "مؤرشف", "archived") === "نعم",
      };
    })
    .filter((r) => r.name);
}

export type ImportPreview = {
  rows: ImportRow[];
  updates: number;
  inserts: number;
  existingTotal: number;
  missingActivities: string[];
};

const keyOf = (receipt: string | null | undefined, name: string) =>
  receipt && receipt.trim() ? `r:${receipt.trim()}` : `n:${name.trim()}`;

export async function buildPreview(rows: ImportRow[]): Promise<ImportPreview> {
  const { data: players } = await supabase.from("players").select("id,name,receipt_number");
  const { data: activities } = await supabase.from("activities").select("id,name");
  const existing = new Map((players ?? []).map((p) => [keyOf(p.receipt_number, p.name), p.id]));
  const actNames = new Set((activities ?? []).map((a) => a.name.trim()));

  let updates = 0;
  const missing = new Set<string>();
  for (const r of rows) {
    if (existing.has(keyOf(r.receipt_number, r.name))) updates++;
    if (r.activity_name && !actNames.has(r.activity_name)) missing.add(r.activity_name);
  }
  return {
    rows,
    updates,
    inserts: rows.length - updates,
    existingTotal: players?.length ?? 0,
    missingActivities: [...missing],
  };
}

export type ImportResult = { inserted: number; updated: number; deleted: number; createdActivities: number };

export async function applyImport(rows: ImportRow[], mode: ImportMode): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجل الدخول");

  // أنشطة: إنشاء الناقص منها
  const { data: activities } = await supabase.from("activities").select("id,name");
  const actMap = new Map((activities ?? []).map((a) => [a.name.trim(), a.id]));
  let createdActivities = 0;
  for (const nameRaw of new Set(rows.map((r) => r.activity_name).filter(Boolean))) {
    if (!actMap.has(nameRaw)) {
      const { data, error } = await supabase
        .from("activities")
        .insert({ user_id: user.id, name: nameRaw, days: [] })
        .select("id")
        .single();
      if (!error && data) { actMap.set(nameRaw, data.id); createdActivities++; }
    }
  }

  const toRow = (r: ImportRow) => ({
    user_id: user.id,
    name: r.name,
    receipt_number: r.receipt_number,
    activity_id: r.activity_name ? actMap.get(r.activity_name) ?? null : null,
    total_sessions: r.total_sessions,
    remaining_sessions: r.remaining_sessions,
    registration_date: r.registration_date,
    note: r.note,
    archived: r.archived,
  });

  let deleted = 0;
  if (mode === "replace") {
    const { data: old } = await supabase.from("players").select("id");
    const ids = (old ?? []).map((p) => p.id);
    if (ids.length) {
      await supabase.from("attendance").delete().in("player_id", ids);
      await supabase.from("player_activities").delete().in("player_id", ids);
      const { error } = await supabase.from("players").delete().in("id", ids);
      if (error) throw error;
      deleted = ids.length;
    }
    if (rows.length) {
      const { error } = await supabase.from("players").insert(rows.map(toRow));
      if (error) throw error;
    }
    return { inserted: rows.length, updated: 0, deleted, createdActivities };
  }

  // merge: تحديث الموجود وإضافة الجديد
  const { data: players } = await supabase.from("players").select("id,name,receipt_number");
  const existing = new Map((players ?? []).map((p) => [keyOf(p.receipt_number, p.name), p.id]));

  const inserts: ReturnType<typeof toRow>[] = [];
  let updated = 0;
  for (const r of rows) {
    const id = existing.get(keyOf(r.receipt_number, r.name));
    if (id) {
      const { user_id: _u, ...patch } = toRow(r);
      const { error } = await supabase.from("players").update(patch).eq("id", id);
      if (!error) updated++;
    } else {
      inserts.push(toRow(r));
    }
  }
  if (inserts.length) {
    const { error } = await supabase.from("players").insert(inserts);
    if (error) throw error;
  }
  return { inserted: inserts.length, updated, deleted: 0, createdActivities };
}

/** تصدير المشتركين كملف Excel جاهز للتعديل ثم إعادة الاستيراد */
export async function exportPlayersXLSX() {
  const { data: players } = await supabase.from("players").select("*").order("name");
  const { data: activities } = await supabase.from("activities").select("id,name");
  const map = new Map((activities ?? []).map((a) => [a.id, a.name]));
  const rows = (players ?? []).map((p) => ({
    "الاسم": p.name,
    "رقم الإيصال": p.receipt_number ?? "",
    "النشاط الأساسي": map.get(p.activity_id ?? "") ?? "",
    "الحصص الكلية": p.total_sessions,
    "الحصص المتبقية": p.remaining_sessions,
    "تاريخ التسجيل": p.registration_date,
    "ملاحظات": p.note ?? "",
    "مؤرشف": p.archived ? "نعم" : "لا",
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [], {
    header: [...IMPORT_HEADERS] as string[],
  });
  ws["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المشتركون");
  XLSX.writeFile(wb, `المشتركون-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}
