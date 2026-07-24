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

export type AttendanceRow = {
  id: string;
  user_id: string;
  player_id: string;
  activity_id: string | null;
  attendance_date: string;
  present: boolean;
};

export const WEEKDAYS = ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"] as const;
