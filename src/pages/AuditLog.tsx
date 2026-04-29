import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";

type Log = { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; before_data: any; after_data: any; created_at: string };

export default function AuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data as Log[] ?? [],
  });

  return (
    <div>
      <PageHeader title="Audit log" description="Immutable record of changes across the platform." />
      {isLoading ? <div className="ra-card p-8 text-center text-muted-foreground text-sm">Loading…</div> :
        logs.length === 0 ? <EmptyState icon={ShieldCheck} title="No activity yet" description="Audit entries will appear here as users make changes." /> : (
        <div className="ra-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(l.created_at), "PPp")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{l.actor_id?.slice(0, 8) ?? "system"}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{l.action}</span></td>
                  <td className="px-4 py-3">{l.entity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.entity_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
