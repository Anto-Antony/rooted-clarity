export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type AttendanceSession = {
  id: string;
  class_id: string;
  date: string;
  period: number;
  subject: string;
  teacher_id: string | null;
  start_time: string | null;
  end_time: string | null;
  slot_id: string | null;
  status: "scheduled" | "marked" | "cancelled";
};

export type WorkingDay = { working: boolean; reason: string };

export function calculatePct(attended: number, conducted: number): number {
  if (!conducted) return 0;
  return Math.round((attended / conducted) * 10000) / 100;
}

export const ATTENDED_STATUSES: AttendanceStatus[] = ["present", "late", "excused"];
