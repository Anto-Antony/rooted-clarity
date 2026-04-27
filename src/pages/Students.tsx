import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";

const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  admission_date: z.string().min(1, "Admission date is required"),
  program: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.string(),
});

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  admission_date: string;
  program: string | null;
  address: string | null;
  status: string;
  locked_at: string | null;
};

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  admission_date: new Date().toISOString().slice(0, 10),
  program: "",
  address: "",
  status: "active",
};

export default function Students() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = hasAnyRole(roles, ["admin", "head_staff"]);
  const canUnlock = hasAnyRole(roles, ["admin"]);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
  });

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.full_name.toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q) || (s.program ?? "").toLowerCase().includes(q);
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      full_name: s.full_name,
      email: s.email ?? "",
      phone: s.phone ?? "",
      date_of_birth: s.date_of_birth ?? "",
      admission_date: s.admission_date,
      program: s.program ?? "",
      address: s.address ?? "",
      status: s.status,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = studentSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = {
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        date_of_birth: parsed.data.date_of_birth || null,
        admission_date: parsed.data.admission_date,
        program: parsed.data.program || null,
        address: parsed.data.address || null,
        status: parsed.data.status,
      };
      if (editing) {
        if (editing.locked_at && !canUnlock) {
          throw new Error("This record is locked. Only Admin can edit a locked student record.");
        }
        const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // New admission: lock the record on creation (admission finalized).
        const { error } = await supabase.from("students").insert({ ...payload, locked_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Student updated." : "Student admitted and record locked.");
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Students"
        description="Admissions, directory and detail records."
        actions={
          canManage ? (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> New admission
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search name, email, or program…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      <div className="ra-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students yet"
            description={canManage ? "Start by admitting a student." : "No records match your search."}
            action={canManage ? <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New admission</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium">Admission</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-2">
                        {s.full_name}
                        {s.locked_at && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.program ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.admission_date}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.status === "active"
                            ? "text-xs bg-success/10 text-success px-2 py-0.5 rounded-full"
                            : "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          {s.locked_at && !canUnlock ? "View" : "Edit"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit student" : "New admission"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? editing.locked_at
                  ? "This record is locked. Changes are audited; only Admin may edit."
                  : "Update student details."
                : "Register a new student. The record will be locked after admission."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="md:col-span-2">
              <div className="ra-section-title mb-2">Personal</div>
            </section>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>

            <section className="md:col-span-2 mt-2">
              <div className="ra-section-title mb-2">Academic</div>
            </section>
            <div className="space-y-2">
              <Label>Program</Label>
              <Input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="e.g. B.Sc. Computer Science" />
            </div>
            <div className="space-y-2">
              <Label>Admission date</Label>
              <Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <section className="md:col-span-2 mt-2">
              <div className="ra-section-title mb-2">Contact</div>
            </section>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {canManage && (!editing?.locked_at || canUnlock) && (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save changes" : "Admit student"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
