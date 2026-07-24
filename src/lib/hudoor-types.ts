export type Activity = {
  id: string;
  user_id: string;
  name: string;
  instructor: string | null;
  location: string | null;
  days: string[];
  color: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  user_id: string;
  activity_id: string | null;
  name: string;
  registration_date: string;
  receipt_number: string | null;
  total_sessions: number;
  remaining_sessions: number;
  note: string | null;
  archived: boolean;
  created_at: string;
};

export type PlayerActivity = {
  id: string;
  user_id: string;
  player_id: string;
  activity_id: string;
  created_at: string;
};

export type AttendanceRow = {
  id: string;
  user_id: string;
  player_id: string;
  activity_id: string | null;
  attendance_date: string;
  present: boolean;
};

export const WEEKDAYS = ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"] as const;

// ---------- CSV helpers ----------
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(name: string, content: string, mime = "text/csv;charset=utf-8") {
  // Add BOM for Excel Arabic support when CSV
  const prefix = mime.startsWith("text/csv") ? "\uFEFF" : "";
  const blob = new Blob([prefix + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = ""; let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  cur.push(field); rows.push(cur);
  const [head, ...body] = rows;
  return body.filter(r => r.some(v => v.trim() !== "")).map(r => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => { o[h.trim()] = (r[i] ?? "").trim(); });
    return o;
  });
}
