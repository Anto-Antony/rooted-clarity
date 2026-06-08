import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceSession } from "@/lib/attendance";

export function useAttendanceSessions(classId: string, date: string) {
  return useQuery({
    queryKey: ["att-sessions", classId, date],
    enabled: !!classId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("class_id", classId)
        .eq("date", date)
        .order("period");
      if (error) throw error;
      return (data ?? []) as AttendanceSession[];
    },
  });
}
