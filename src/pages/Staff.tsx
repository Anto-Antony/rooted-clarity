import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const staffSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  designation: z.string().trim().max(100).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.string(),
});

type Staff = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  status: string;
};
type StaffSubject = { id: string; staff_id: string; subject: string };

const emptyForm = {
  full_name: "",
  user_id: null as string | null,
  email: "",
  phone: "",
  designation: "",
  department: "",
  status: "active",
};

const NO_LINK = "__none__";

const STAFF_LINK_ROLES = ["head_staff", "regular_staff", "guest_staff", "accountant"] as const;
type StaffLinkRole = (typeof STAFF_LINK_ROLES)[number];

// Auth-account candidate list for staff.user_id linking
// (Uses user_roles join table; excludes accounts with role = admin)
type UserRoleRow = { user_id: string; role: string };

type ProfileLite = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  // returned by join: user_roles!inner(role)
  user_roles?: { role: string }[];
};

export default function Staff() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Staff[];
    },
  });

  // Candidate selection for staff.user_id linking:
  // - include accounts with role in (head_staff, regular_staff, guest_staff, accountant)
  // - exclude any user that also has role = admin
  const { data: authCandidates = [] } = useQuery({
    queryKey: ["staff-auth-candidates"],
    queryFn: async () => {
      const desiredRoles = Array.from(STAFF_LINK_ROLES);

      // Users with desired roles (may include admin users; we'll filter those out)
      const { data: desiredRows, error: e1 } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", desiredRoles);
      if (e1) throw e1;

      // Users with admin role to exclude
      const { data: adminRows, error: e2 } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (e2) throw e2;

      const adminUserIds = new Set((adminRows ?? []).map((r) => r.user_id));

      const candidatesMap = new Map<string, ProfileLite>();

      // ProfileLite shape is used only if we can join to profiles.
      // If your schema doesn't have profiles.full_name/email, remove this join.
      const candidateUserIds = Array.from(
        new Set((desiredRows ?? []).map((r) => r.user_id))
      ).filter((uid) => !adminUserIds.has(uid));

      if (candidateUserIds.length === 0) return [] as ProfileLite[];

      // Fetch lightweight profile info for display.
      // If your auth user table is different, adjust the table/columns.
      const { data: profiles, error: e3 } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", candidateUserIds);
      if (e3) throw e3;

      // Supabase typing sometimes can't infer joined shape; validate via runtime guards.
      for (const p of (profiles ?? []) as unknown as ProfileLite[]) {
        if (!p?.id) continue;
        candidatesMap.set(p.id, p);
      }

      // Preserve deterministic ordering by user_id list
      return candidateUserIds
        .map((id) => candidatesMap.get(id))
        .filter(Boolean) as ProfileLite[];
    },
  });


  const { data: allSubjects = [] } = useQuery({
    queryKey: ["staff_subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_subjects").select("*");
      if (error) throw error;
      return data as StaffSubject[];
    },
  });

  const subjectsByStaff = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const s of allSubjects) (m[s.staff_id] ??= []).push(s.subject);
    return m;
  }, [allSubjects]);

  const departments = useMemo(
    () => Array.from(new Set(staff.map((s) => s.department).filter(Boolean))) as string[],
    [staff]
  );

  const filtered = staff.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesQ = !q || s.full_name.toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q) || (s.designation ?? "").toLowerCase().includes(q);
    const matchesDept = deptFilter === "all" || s.department === deptFilter;
    return matchesQ && matchesDept;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setSubjects([]);
    setNewSubject("");
    setOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      full_name: s.full_name,
      user_id: s.user_id,
      email: s.email ?? "",
      phone: s.phone ?? "",
      designation: s.designation ?? "",
      department: s.department ?? "",
      status: s.status,
    });
    setSubjects(subjectsByStaff[s.id] ?? []);
    setNewSubject("");
    setOpen(true);
  };

  const onPickAuthCandidate = (userId: string) => {
    setForm((f) => ({
      ...f,
      user_id: userId === NO_LINK ? null : userId,
    }));
    if (userId === NO_LINK) return;

    const p = authCandidates.find((c) => c.id === userId);
    if (!p) return;

    const derivedRole = p.user_roles?.[0]?.role;

    setForm((f) => ({
      ...f,
      full_name: f.full_name ? f.full_name : p.full_name || "",
      email: f.email ? f.email : p.email || "",
      phone: f.phone ? f.phone : p.phone || "",
      designation: f.designation ? f.designation : (derivedRole ?? ""),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = staffSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const payload = {
        user_id: form.user_id ?? null,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        designation: parsed.data.designation || null,
        department: parsed.data.department || null,
        status: parsed.data.status,
      };
      let staffId: string;
      if (editing) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editing.id);
        if (error) throw error;
        staffId = editing.id;
      } else {
        const { data, error } = await supabase.from("staff").insert(payload).select("id").single();
        if (error) throw error;
        staffId = data.id;
      }

      // Sync subjects
      const current = subjectsByStaff[staffId] ?? [];
      const unique = Array.from(new Set(subjects.map((s) => s.trim()).filter(Boolean)));
      const toAdd = unique.filter((s) => !current.includes(s));
      const toRemove = current.filter((s) => !unique.includes(s));
      if (toRemove.length) {
        const { error } = await supabase
          .from("staff_subjects")
          .delete()
          .eq("staff_id", staffId)
          .in("subject", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("staff_subjects")
          .insert(toAdd.map((subject) => ({ staff_id: staffId, subject })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Staff updated." : "Staff added.");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff_subjects"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addSubject = () => {
    const v = newSubject.trim();
    if (!v) return;
    if (!subjects.includes(v)) setSubjects([...subjects, v]);
    setNewSubject("");
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Teaching and administrative staff directory."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add staff</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder="Search name, email, designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="ra-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No staff yet" description="Add your first staff member." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Subjects</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.designation ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.department ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(subjectsByStaff[s.id] ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        ) : (
                          (subjectsByStaff[s.id] ?? []).map((sub) => (
                            <span key={sub} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              {sub}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff" : "Add staff"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Lecturer" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linked auth account</Label>
              <Select
                value={form.user_id ?? NO_LINK}
                onValueChange={(v) => onPickAuthCandidate(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select auth account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>Unlinked (no auth account)</SelectItem>
                  {authCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} {c.email ? `(${c.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Subjects</Label>
              <div className="flex gap-2">
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Add a subject and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addSubject(); }
                  }}
                />
                <Button type="button" variant="outline" onClick={addSubject}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {subjects.map((s) => (
                  <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => setSubjects(subjects.filter((x) => x !== s))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
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
    </div>
  );
}
