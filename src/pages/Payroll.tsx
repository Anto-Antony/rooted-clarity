import { useQuery } from "@tanstack/react-query";
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
import { Wallet } from "lucide-react";

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

export default function Payroll() {
  const { user, roles } = useAuth();
  const isManager = hasAnyRole(roles, ["admin", "accountant", "head_staff"]);

  // Resolve current user's staff profile (for self-service staff)
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

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={
          isManager
            ? "Manage staff payroll invoices and payouts."
            : "Your payroll invoices and pay periods."
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !invoices || invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">
                    No payroll invoices yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    {isManager && <TableCell>{inv.staff?.full_name ?? "—"}</TableCell>}
                    <TableCell>
                      <Badge variant="outline">{PAYROLL_TYPE_LABEL[inv.payroll_type] ?? inv.payroll_type}</Badge>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
