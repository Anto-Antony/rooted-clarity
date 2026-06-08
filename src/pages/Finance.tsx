import { useState, useMemo, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportData, ExportFormat } from "@/utils/export/exportData";
import { useRowSelection } from "@/components/reuse/finance/selection/useRowSelection";
import { useSelectionExport } from "@/components/reuse/finance/export/useSelectionExport";



type FeeStruct = { id: string; name: string; program: string | null; amount: number; frequency: string; active: boolean };
type Invoice = { id: string; invoice_number: string; student_id: string; amount: number; amount_paid: number; due_date: string; status: string; notes: string | null };
type Student = { id: string; full_name: string };
type Payment = { id: string; invoice_id: string; amount: number; method: string; reference: string | null; paid_on: string };
const FILTER_TYPES = ["all", "day", "week", "month", "year", "custom"] as const;
const EXPORT_FORMATS = ["pdf", "xlsx", "csv", "txt", "json"] as const;
const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel (.xlsx)",
  csv: "CSV",
  txt: "TXT",
  json: "JSON",
};

const PAYMENT_METHODS = ["cash", "bank_transfer", "upi", "card", "cheque"] as const;
const FILTER_LABELS: Record<string, string> = { all: "All", day: "Today", week: "This week", month: "This month", year: "This year", custom: "Custom range" };
const EXPORT_LABELS: Record<string, string> = { pdf: "PDF", xlsx: "Excel (.xlsx)", csv: "CSV", json: "JSON" };
const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", upi: "UPI", card: "Card", cheque: "Cheque"};
const INITIAL_STRUCT_FORM = { name: "", program: "", amount: 0, frequency: "one_time" };
const INITIAL_INV_FORM = { student_id: "", fee_structure_id: "none", amount: 0, due_date: "", notes: "" };
const INITIAL_PAY_FORM = { amount: 0, method: "cash", reference: "" };

export default function Finance() {
  const { user, roles } = useAuth();
  const canManage = hasAnyRole(roles, ["admin", "accountant"]);
  const isStudent = hasAnyRole(roles, ["student"]);
  const qc = useQueryClient();
  const { data: structures = [] } = useQuery({
    queryKey: ["fee-structures"],
    queryFn: async () => (await supabase.from("fee_structures").select("*").order("created_at", { ascending: false })).data as FeeStruct[] ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("fee_invoices").select("*").order("due_date", { ascending: false })).data as Invoice[] ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["fin-students"],
    queryFn: async () => (await supabase.from("students").select("id, full_name").order("full_name")).data as Student[] ?? [],
  });
  const studentById = useMemo(() => Object.fromEntries(students.map(s => [s.id, s.full_name])), [students]);

  // Student own
  const { data: myStudent } = useQuery({
    queryKey: ["my-student-fin", user?.id],
    enabled: !!user && isStudent,
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  // visibleInvoices depends on myStudent/invoices and must be available before filteredInvoices
  const visibleInvoices = isStudent && !canManage
    ? invoices.filter(i => i.student_id === myStudent?.id)
    : invoices;

  // --- Filter state and helpers ---
  const [filterType, setFilterType] = useState<string>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // single memo for date range used by filters
  const dateRange = useMemo((): [Date, Date] | null => {
    const now = new Date();
    try {
      switch (filterType) {
        case "day":
          return [startOfDay(now), endOfDay(now)];
        case "week":
          return [startOfWeek(now), endOfWeek(now)];
        case "month":
          return [startOfMonth(now), endOfMonth(now)];
        case "year":
          return [startOfYear(now), endOfYear(now)];
        case "custom":
          if (!customStart || !customEnd) return null;
          return [startOfDay(parseISO(customStart)), endOfDay(parseISO(customEnd))];
        default:
          return null;
      }
    } catch {
      return null;
    }
  }, [filterType, customStart, customEnd]);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    if (filterType === "all") return visibleInvoices;
    const range = dateRange;
    if (!range) return visibleInvoices; // if custom range not set, fall back
    const [start, end] = range;
    return visibleInvoices.filter(i => {
      try {
        const d = i.due_date ? parseISO(i.due_date) : new Date(i.due_date);
        return isWithinInterval(d, { start, end });
      } catch {
        return false;
      }
    });
  }, [visibleInvoices, filterType, dateRange, invoices]);

  // Fee structure dialog
  const [structOpen, setStructOpen] = useState(false);
  const [structForm, setStructForm] = useState(INITIAL_STRUCT_FORM);

  const resetStructForm = useCallback(() => setStructForm(INITIAL_STRUCT_FORM), []);

  const createStruct = useMutation({
    mutationFn: async () => {
      if (!structForm.name.trim() || structForm.amount <= 0) throw new Error("Name and amount required");
      const { error } = await supabase.from("fee_structures").insert([{
        name: structForm.name.trim(), program: structForm.program.trim() || null, amount: structForm.amount, frequency: structForm.frequency,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fee plan created"); qc.invalidateQueries({ queryKey: ["fee-structures"] }); setStructOpen(false); resetStructForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Invoice dialog
  const [invOpen, setInvOpen] = useState(false);
  const [invForm, setInvForm] = useState(INITIAL_INV_FORM);
  const resetInvForm = useCallback(() => setInvForm(INITIAL_INV_FORM), []);
  const createInv = useMutation({
    mutationFn: async () => {
      if (!invForm.student_id || !invForm.due_date || invForm.amount <= 0) throw new Error("All fields required");
      const { error } = await supabase.from("fee_invoices").insert([{
        student_id: invForm.student_id,
        fee_structure_id: invForm.fee_structure_id === "none" ? null : invForm.fee_structure_id,
        amount: invForm.amount, due_date: invForm.due_date, notes: invForm.notes || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice created"); qc.invalidateQueries({ queryKey: ["invoices"] }); setInvOpen(false); resetInvForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Payment dialog
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState(INITIAL_PAY_FORM);
  const resetPayForm = useCallback(() => setPayForm(INITIAL_PAY_FORM), []);
  const recordPay = useMutation({
    mutationFn: async () => {
      if (!payFor || payForm.amount <= 0) throw new Error("Enter amount");
      const { error } = await supabase.from("payments").insert([{
        invoice_id: payFor.id, amount: payForm.amount, method: payForm.method, reference: payForm.reference || null, recorded_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded"); qc.invalidateQueries({ queryKey: ["invoices"] }); setPayFor(null); resetPayForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Selection + export state
  const invoiceSelection = useRowSelection<Invoice>({
    getRowId: (i) => i.id,
    getVisibleRows: () => filteredInvoices,
    clearSelectionOnExit: true,
  });

  const selectionMode = invoiceSelection.selectionMode;
  const selectedInvoiceIds = invoiceSelection.selectedIds;
  const selectedCount = invoiceSelection.selectedCount;


  const invoiceToExportRow = useCallback(
    (i: Invoice) => ({
      invoice_number: i.invoice_number,
      student: studentById[i.student_id] ?? "—",
      amount: Number(i.amount).toFixed(2),
      paid: Number(i.amount_paid).toFixed(2),
      due: format(new Date(i.due_date), "PP"),
      status: i.status,
    }),
    [studentById]
  );

  const visibleExportRows = useMemo(
    () => filteredInvoices.map(invoiceToExportRow),
    [filteredInvoices, invoiceToExportRow]
  );

  const selectedInvoices = useMemo(
    () => invoiceSelection.getSelectedRows(filteredInvoices),
    [invoiceSelection, filteredInvoices]
  );

  const selectedExportRows = useMemo(
    () => selectedInvoices.map(invoiceToExportRow),
    [selectedInvoices, invoiceToExportRow]
  );


  const toggleInvoice = invoiceSelection.toggleRow;


  const selectedAllVisible = invoiceSelection.selectedAllVisible;
  const toggleSelectAllVisible = invoiceSelection.toggleSelectAllVisible;
  const exitSelectionMode = invoiceSelection.exitSelectionMode;


  const filenameBase = useCallback(
    () => `invoices_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`,
    []
  );

  const { handleExport } = useSelectionExport<Invoice>({
    selectionMode,
    selectedCount: selectedCount,
    visibleRows: filteredInvoices,
    selectedRows: selectedInvoices,
    filenameBase: filenameBase(),
    mapRow: invoiceToExportRow,
  });




  return (
    <div>
      <PageHeader title="Finance" description="Fee plans, invoices, and payments." />
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          {canManage && <TabsTrigger value="structures">Fee plans</TabsTrigger>}
        </TabsList>

        <TabsContent value="invoices" className="space-y-3 mt-4">
          <div className="flex items-center gap-3">
            {canManage && <Button onClick={() => setInvOpen(true)}><Plus className="h-4 w-4 mr-1" /> New invoice</Button>}

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={selectionMode ? "default" : "outline"}
                onClick={() => invoiceSelection.enterSelectionMode()}
              >
                Select
              </Button>


              {selectionMode && (
                <Button variant="ghost" onClick={exitSelectionMode}>
                  Cancel
                </Button>

              )}

              {selectionMode && (
                <div className="text-sm text-muted-foreground">
                  {selectedCount} records selected
                </div>
              )}

              <Select value={filterType} onValueChange={v => setFilterType(v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{FILTER_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filterType === "custom" && (
                <div className="flex items-center gap-2">
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              )}

              {/* Export controls */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Receipt className="h-4 w-4" />
                      <span>Download</span>
                      <span className="text-muted-foreground">▼</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Export options</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {EXPORT_FORMATS.map((f) => (
                      <div key={f}>
                        {/* <DropdownMenuLabel className="pt-2">{EXPORT_FORMAT_LABELS[f]}</DropdownMenuLabel> */}
                        <DropdownMenuItem onClick={() => handleExport(f)} className="pt-2">
                          {EXPORT_FORMAT_LABELS[f]}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />

                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

            </div>
          </div>

          {filteredInvoices.length === 0 ? <EmptyState icon={Receipt} title="No invoices" /> : (
            <div className="ra-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {selectionMode && (
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={selectedAllVisible}
                          onCheckedChange={() => toggleSelectAllVisible()}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left font-medium">Invoice #</th>

                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Paid</th>
                    <th className="px-4 py-3 text-left font-medium">Due</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((i) => {
                    const isSelected = selectedInvoiceIds.has(i.id);
                    return (
                      <tr
                        key={i.id}
                        className={`border-b border-border last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        {selectionMode && (
                          <td className="px-4 py-3 w-10">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleInvoice(i.id)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-xs">{i.invoice_number}</td>
                        <td className="px-4 py-3">{studentById[i.student_id] ?? "—"}</td>
                        <td className="px-4 py-3">{i.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">{i.amount_paid.toFixed(2)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(i.due_date), "PP")}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              i.status === "paid"
                                ? "bg-success/15 text-success"
                                : i.status === "partial"
                                  ? "bg-warning/15 text-warning"
                                  : i.status === "overdue"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {i.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {i.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPayFor(i);
                                  setPayForm({
                                    amount: i.amount - i.amount_paid,
                                    method: "cash",
                                    reference: "",
                                  });
                                }}
                              >
                                Record payment
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="structures" className="space-y-3 mt-4">
            <Button onClick={() => setStructOpen(true)}><Plus className="h-4 w-4 mr-1" /> New fee plan</Button>
            {structures.length === 0 ? <EmptyState icon={Wallet} title="No fee plans" /> : (
              <div className="ra-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Program</th><th className="px-4 py-3 text-left font-medium">Amount</th><th className="px-4 py-3 text-left font-medium">Frequency</th></tr>
                  </thead>
                  <tbody>
                    {structures.map(s => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.program ?? "—"}</td>
                        <td className="px-4 py-3">{s.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={structOpen} onOpenChange={setStructOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New fee plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={structForm.name} onChange={e => setStructForm({ ...structForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Program</Label><Input value={structForm.program} onChange={e => setStructForm({ ...structForm, program: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount</Label><Input type="number" value={structForm.amount} onChange={e => setStructForm({ ...structForm, amount: Number(e.target.value) })} /></div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={structForm.frequency} onValueChange={v => setStructForm({ ...structForm, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setStructOpen(false)}>Cancel</Button><Button onClick={() => createStruct.mutate()} disabled={createStruct.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Student</Label>
              <Select value={invForm.student_id} onValueChange={v => setInvForm({ ...invForm, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fee plan</Label>
              <Select value={invForm.fee_structure_id} onValueChange={v => {
                const s = structures.find(x => x.id === v);
                setInvForm({ ...invForm, fee_structure_id: v, amount: s ? s.amount : invForm.amount });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Custom —</SelectItem>
                  {structures.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.amount})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount</Label><Input type="number" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Due date</Label><Input type="date" value={invForm.due_date} onChange={e => setInvForm({ ...invForm, due_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setInvOpen(false)}>Cancel</Button><Button onClick={() => createInv.mutate()} disabled={createInv.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payFor} onOpenChange={() => setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment · {payFor?.invoice_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Outstanding: {payFor ? (payFor.amount - payFor.amount_paid).toFixed(2) : 0}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Reference</Label><Input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Transaction ID, cheque number, etc." /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button><Button onClick={() => recordPay.mutate()} disabled={recordPay.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
