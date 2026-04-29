import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["notif-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notif-count", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/app/notifications")} aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );
}
