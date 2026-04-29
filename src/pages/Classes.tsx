import { useState, useMemo } from "react";
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
import { Layers, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Course = { id: string; name: string };
type Staff = { id: string; full_name: string };
type ClassRow = {
  id: string; course_id: string; section: string; academic_year: string;
  class_teacher_id: string | null;
};

const schema = z.object({
  course_id: z.string().uuid("Select a course"),
  section: z.string().trim().min(1).max(40),
  academic_year: z.string().trim().min(1).max(20),
  class_teacher_id: z.string().uuid().optional().nullable(),
});

export default function Classes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [rosterFor, setRosterFor] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({
    course_id: "",
    section: "",
    academic_year: new Date().getFullYear().toString(),
    class_teacher_id: "none",
  });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("academic_year", { ascending: false });
      if (error) throw error;
      return data as ClassRow[];
    },
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, name").order("name");
      if (error) throw error;
      return data as Course[];
    },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, full_name").eq("status", "active").order("full_name");
      if (error) throw error;
      return data as Staff[];
    },
  });

  const courseById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c.name])), [courses]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.full_name])), [staff]);

  const openNew = () => {
    setEditing(null);
    setForm({ course_id: "", section: "", academic_year: new Date().getFullYear().toString(), class_teacher_id: "none" });
    setOpen(true);
  };
  const openEdit = (c: ClassRow) => {
    setEditing(c);
    setForm({
      course_id: c.course_id,
      section: c.section,
      academic_year: c.academic_year,
      class_teacher_id: c.class_teacher_id ?? "none",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        course_id: form.course_id,
        section: form.section.trim(),
        academic_year: form.academic_year.trim(),
        class_teacher_id: form.class_teacher_id === "none" ? null : form.class_teacher_id,
      };
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const insertPayload = {
        course_id: payload.course_id,
        section: payload.section,
        academic_year: payload.academic_year,
        class_teacher_id: payload.class_teacher_id,
      };
      if (editing) {
        const { error } = await supabase.from("classes").update(insertPayload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classes").insert([insertPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Class updated." : "Class created.");
      qc.invalidateQueries({ queryKey: ["classes"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class deleted.");
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Sections and academic-year offerings for each course."
        actions={
          <Button onClick={openNew} disabled={courses.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> New class
          </Button>
        }
      />

      {courses.length === 0 && (
        <div className="ra-card p-5 mb-4 border-warning/40 bg-warning/5 text-sm">
          Create a course first before adding classes.
        </div>
      )}

      <div className="ra-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : classes.length === 0 ? (
          <EmptyState icon={Layers} title="No classes yet" description="Create the first section for a course." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Academic year</th>
                  <th className="px-4 py-3 font-medium">Class teacher</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{courseById[c.course_id] ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.section}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.academic_year}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.class_teacher_id ? staffById[c.class_teacher_id] ?? "—" : <span className="italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)} disabled={del.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit class" : "New class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Section</Label>
                <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. A" />
              </div>
              <div className="space-y-2">
                <Label>Academic year</Label>
                <Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="e.g. 2025-2026" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Class teacher</Label>
              <Select value={form.class_teacher_id} onValueChange={(v) => setForm({ ...form, class_teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
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
