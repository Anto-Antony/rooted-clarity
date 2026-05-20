import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Lock, Link2, Link2Off } from "lucide-react";
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
  user_id: string | null;
};

type ProfileLite = { id: string; full_name: string; email: string | null };

const NO_LINK = "__none__";

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
  const [linkedUserId, setLinkedUserId] = useState<string>(NO_LINK);

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

  // Fetch candidate auth accounts: profiles holding the `student` role.
  const { data: studentAccounts = [] } = useQuery({
    queryKey: ["student-role-accounts"],
    enabled: canManage,
    queryFn: async () => {
      const { data: roleRows, error: e1 } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (e1) throw e1;
      const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as ProfileLite[];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (e2) throw e2;
      return (profs ?? []) as ProfileLite[];
    },
  });

  const linkedUserIds = useMemo(
    () => new Set(students.map((s) => s.user_id).filter(Boolean) as string[]),
    [students]
  );

  // For "New admission": only profiles not yet linked to any student row.
  const unlinkedAccounts = useMemo(
    () => studentAccounts.filter((p) => !linkedUserIds.has(p.id)),
    [studentAccounts, linkedUserIds]
  );

  const profilesById = useMemo(() => {
    const m: Record<string, ProfileLite> = {};
    for (const p of studentAccounts) m[p.id] = p;
    return m;
  }, [studentAccounts]);

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.program ?? "").toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setLinkedUserId(NO_LINK);
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
    setLinkedUserId(s.user_id ?? NO_LINK);
    setOpen(true);
  };

  // When admin picks an account in "New admission", prefill name/email from profile.
  const onPickAccount = (val: string) => {
    setLinkedUserId(val);
    if (val !== NO_LINK) {
      const p = profilesById[val];
      if (p) {
        setForm((f) => ({
          ...f,
          full_name: f.full_name || p.full_name || "",
          email: f.email || p.email || "",
        }));
      }
    }
  };

  // Edit mode: which accounts can be assigned? Unlinked + the one already assigned.
  const editAssignableAccounts = useMemo(() => {
    if (!editing) return unlinkedAccounts;
    const current = editing.user_id ? profilesById[editing.user_id] : null;
    return current && !unlinkedAccounts.find((p) => p.id === current.id)
      ? [current, ...unlinkedAccounts]
      : unlinkedAccounts;
  }, [editing, unlinkedAccounts, profilesById]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = studentSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const userIdValue = linkedUserId === NO_LINK ? null : linkedUserId;

      const payload = {
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        date_of_birth: parsed.data.date_of_birth || null,
        admission_date: parsed.data.admission_date,
        program: parsed.data.program || null,
        address: parsed.data.address || null,
        status: parsed.data.status,
        user_id: userIdValue,
      };

      if (editing) {
        if (editing.locked_at && !canUnlock) {
          throw new Error("This record is locked. Only Admin can edit a locked student record.");
        }
        const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("students")
          .insert({ ...payload, locked_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Student updated." : "Student admitted and record locked.");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-role-accounts"] });
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
                  <th className="px-4 py-3 font-medium">Account</th>
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
                      {s.user_id ? (
                        <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> Linked
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Link2Off className="h-3 w-3" /> Unlinked
                        </span>
                      )}
                    </td>
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
            <DialogTitle>{editing ? "Edit student" : "New admission"}</DialogTitle>
            <DialogDescription>
              {editing
                ? editing.locked_at
                  ? "This record is locked. Changes are audited; only Admin may edit."
                  : "Update student details."
                : "Register a new student. Link to a sign-up account so they can log in and see their data."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="md:col-span-2">
              <div className="ra-section-title mb-2">Account linkage</div>
              <Label className="text-xs text-muted-foreground">
                Pick the sign-up account (must already exist and have the Student role assigned in Users).
              </Label>
              <Select value={linkedUserId} onValueChange={onPickAccount}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select student account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>No linked account (paper admission)</SelectItem>
                  {editAssignableAccounts.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      No unlinked student accounts available
                    </SelectItem>
                  ) : (
                    editAssignableAccounts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || "(no name)"} — {p.email ?? "no email"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {linkedUserId === NO_LINK && (
                <p className="text-xs text-muted-foreground mt-1">
                  Without a linked account the student cannot log in to view their record.
                </p>
              )}
            </section>

            <section className="md:col-span-2 mt-2">
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
