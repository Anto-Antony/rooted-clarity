import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarOff, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Leave = { id: string; requester_id: string; requester_type: string; start_date: string; end_date: string; reason: string; status: string; reviewed_at: string | null };

export default function Leaves() {
  const { user, roles } = useAuth();
  const canApprove = hasAnyRole(roles, ["admin", "head_staff"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requester_type: "staff", start_date: "", end_date: "", reason: "" });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await supabase.from("leaves").select("*").order("created_at", { ascending: false })).data as Leave[] ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.start_date || !form.end_date || !form.reason.trim()) throw new Error("All fields required");
      const { error } = await supabase.from("leaves").insert([{
        requester_id: user!.id, requester_type: form.requester_type,
        start_date: form.start_date, end_date: form.end_date, reason: form.reason.trim(),
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave requested"); qc.invalidateQueries({ queryKey: ["leaves"] }); setOpen(false); setForm({ requester_type: "staff", start_date: "", end_date: "", reason: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leaves").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["leaves"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Leaves" description="Request and review leave applications." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Request leave</Button>} />

      {leaves.length === 0 ? <EmptyState icon={CalendarOff} title="No leave requests" /> : (
        <div className="ra-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">From</th>
                <th className="px-4 py-3 text-left font-medium">To</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {canApprove && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 capitalize">{l.requester_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(l.start_date), "PP")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(l.end_date), "PP")}</td>
                  <td className="px-4 py-3 max-w-md truncate">{l.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      l.status === "approved" ? "bg-success/15 text-success" :
                      l.status === "rejected" ? "bg-destructive/15 text-destructive" :
                      "bg-warning/15 text-warning"
                    }`}>{l.status}</span>
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3 text-right">
                      {l.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: l.id, status: "approved" })}><Check className="h-4 w-4 text-success" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: l.id, status: "rejected" })}><X className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.requester_type} onValueChange={v => setForm({ ...form, requester_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>From</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>To</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => create.mutate()} disabled={create.isPending}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
