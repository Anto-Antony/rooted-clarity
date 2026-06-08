import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkingDay } from "@/lib/attendance";

export function useWorkingDay(date: string, classId: string) {
  return useQuery({
    queryKey: ["working-day", date, classId],
    enabled: !!date && !!classId,
    queryFn: async (): Promise<WorkingDay> => {
      const { data, error } = await supabase.rpc("is_working_day", {
        _date: date,
        _class_id: classId,
      });
      if (error) throw error;
      return (data as unknown as WorkingDay) ?? { working: true, reason: "weekday" };
    },
  });
}
