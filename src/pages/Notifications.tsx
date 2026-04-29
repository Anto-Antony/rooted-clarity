import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";

type Notif = { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string };

export default function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data as Notif[] ?? [],
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
  const markOne = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return (
    <div>
      <PageHeader title="Notifications" actions={<Button variant="outline" onClick={() => markAll.mutate()} disabled={!items.some(i => !i.read)}><CheckCheck className="h-4 w-4 mr-1" /> Mark all read</Button>} />
      {items.length === 0 ? <EmptyState icon={Bell} title="No notifications" /> : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className={`ra-card p-4 ${!n.read ? "border-primary/40 bg-primary/5" : ""}`} onClick={() => !n.read && markOne.mutate(n.id)} role="button">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(n.created_at), "PPp")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
