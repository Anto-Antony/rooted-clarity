import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const PAYROLL_TYPE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  paid: "default",
  cancelled: "destructive",
};

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(n ?? 0));

const today = () => new Date().toISOString().slice(0, 10);

const invoiceSchema = z
  .object({
    staff_id: z.string().uuid({ message: "Select a staff member" }),
    payroll_type: z.enum(["daily", "weekly", "monthly", "one_time"]),
    period_start: z.string().min(1, "Period start required"),
    period_end: z.string().min(1, "Period end required"),
    issued_date: z.string().min(1, "Issued date required"),
    due_date: z.string().min(1, "Due date required"),
    gross_amount: z.number().nonnegative(),
    deductions: z.number().nonnegative(),
    net_amount: z.number().nonnegative(),
    status: z.enum(["draft", "issued", "paid", "cancelled"]),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.period_end >= d.period_start, {
    message: "Period end must be after period start",
    path: ["period_end"],
  });

type FormState = {
  staff_id: string;
  payroll_type: "daily" | "weekly" | "monthly" | "one_time";
  period_start: string;
  period_end: string;
  issued_date: string;
  due_date: string;
  gross_amount: string;
  deductions: string;
  net_amount: string;
  status: "draft" | "issued" | "paid" | "cancelled";
  notes: string;
};

const emptyForm = (): FormState => ({
  staff_id: "",
  payroll_type: "monthly",
  period_start: today(),
  period_end: today(),
  issued_date: today(),
  due_date: today(),
  gross_amount: "0",
  deductions: "0",
  net_amount: "0",
  status: "draft",
  notes: "",
});

export default function Payroll() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isManager = hasAnyRole(roles, ["admin", "accountant"]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Auto-calc net = gross - deductions (still editable)
  useEffect(() => {
    const g = parseFloat(form.gross_amount) || 0;
    const d = parseFloat(form.deductions) || 0;
    setForm((f) => ({ ...f, net_amount: (g - d).toFixed(2) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gross_amount, form.deductions]);

  const { data: myStaff } = useQuery({
    queryKey: ["my-staff", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-for-payroll"],
    enabled: isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["payroll-invoices", isManager, myStaff?.id],
    enabled: isManager || !!myStaff?.id,
    queryFn: async () => {
      let q = supabase
        .from("payroll_invoices")
        .select("*, staff:staff_id(full_name)")
        .order("issued_date", { ascending: false });
      if (!isManager && myStaff?.id) q = q.eq("staff_id", myStaff.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = invoiceSchema.safeParse({
        staff_id: form.staff_id,
        payroll_type: form.payroll_type,
        period_start: form.period_start,
        period_end: form.period_end,
        issued_date: form.issued_date,
        due_date: form.due_date,
        gross_amount: parseFloat(form.gross_amount) || 0,
        deductions: parseFloat(form.deductions) || 0,
        net_amount: parseFloat(form.net_amount) || 0,
        status: form.status,
        notes: form.notes,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = {
        ...parsed.data,
        notes: parsed.data.notes || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("payroll_invoices")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payroll_invoices")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Payroll invoice updated." : "Payroll invoice created.");
      qc.invalidateQueries({ queryKey: ["payroll-invoices"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payroll invoice deleted.");
      qc.invalidateQueries({ queryKey: ["payroll-invoices"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (inv: any) => {
    setEditingId(inv.id);
    setForm({
      staff_id: inv.staff_id,
      payroll_type: inv.payroll_type,
      period_start: inv.period_start,
      period_end: inv.period_end,
      issued_date: inv.issued_date,
      due_date: inv.due_date,
      gross_amount: String(inv.gross_amount ?? 0),
      deductions: String(inv.deductions ?? 0),
      net_amount: String(inv.net_amount ?? 0),
      status: inv.status,
      notes: inv.notes ?? "",
    });
    setOpen(true);
  };

  const colSpan = useMemo(() => (isManager ? 10 : 8), [isManager]);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={
          isManager
            ? "Manage staff payroll invoices and payouts."
            : "Your payroll invoices and pay periods."
        }
        actions={
          isManager ? (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> New payroll invoice
            </Button>
          ) : undefined
        }
      />

      {!isManager && !myStaff && (
        <EmptyState
          icon={Wallet}
          title="No staff profile linked"
          description="Your account is not linked to a staff record yet. Please contact your administrator."
        />
      )}

      {(isManager || myStaff) && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                {isManager && <TableHead>Staff</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                {isManager && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !invoices || invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                    No payroll invoices yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    {isManager && <TableCell>{inv.staff?.full_name ?? "—"}</TableCell>}
                    <TableCell>
                      <Badge variant="outline">
                        {PAYROLL_TYPE_LABEL[inv.payroll_type] ?? inv.payroll_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {inv.period_start} → {inv.period_end}
                    </TableCell>
                    <TableCell className="text-right">{fmt(inv.gross_amount)}</TableCell>
                    <TableCell className="text-right">{fmt(inv.deductions)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(inv.net_amount)}</TableCell>
                    <TableCell className="text-sm">{inv.due_date}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"} className="capitalize">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit payroll invoice" : "New payroll invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Staff</Label>
              <Select
                value={form.staff_id}
                onValueChange={(v) => setForm({ ...form, staff_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payroll type</Label>
              <Select
                value={form.payroll_type}
                onValueChange={(v: any) => setForm({ ...form, payroll_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: any) => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period start</Label>
              <Input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Period end</Label>
              <Input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Issued date</Label>
              <Input
                type="date"
                value={form.issued_date}
                onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gross amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.gross_amount}
                onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Deductions</Label>
              <Input
                type="number"
                step="0.01"
                value={form.deductions}
                onChange={(e) => setForm({ ...form, deductions: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Net amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.net_amount}
                onChange={(e) => setForm({ ...form, net_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payroll invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the invoice and any related payments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
