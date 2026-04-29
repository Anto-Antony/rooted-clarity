import { useState, useMemo } from "react";
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
import { FileText, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ClassRow = { id: string; section: string; academic_year: string; course_id: string };
type Course = { id: string; name: string };
type Assignment = {
  id: string; class_id: string; title: string; description: string | null;
  subject: string | null; due_date: string; max_marks: number; created_at: string;
};
type Submission = {
  id: string; assignment_id: string; student_id: string; file_url: string | null;
  notes: string | null; marks: number | null; feedback: string | null; submitted_at: string;
};

export default function Assignments() {
  const { user, roles } = useAuth();
  const isStaff = hasAnyRole(roles, ["admin", "head_staff", "regular_staff"]);
  const isStudent = hasAnyRole(roles, ["student"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", title: "", description: "", subject: "", due_date: "", max_marks: 100 });
  const [submitOpen, setSubmitOpen] = useState<Assignment | null>(null);
  const [subForm, setSubForm] = useState<{ notes: string; file: File | null }>({ notes: "", file: null });
  const [gradeOpen, setGradeOpen] = useState<Assignment | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["asg-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, section, academic_year, course_id")).data as ClassRow[] ?? [],
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["asg-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, name")).data as Course[] ?? [],
  });
  const courseById = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);
  const classLabel = (c: ClassRow) => `${courseById[c.course_id] ?? "—"} · ${c.section} · ${c.academic_year}`;

  // Student profile
  const { data: studentRecord } = useQuery({
    queryKey: ["my-student", user?.id],
    enabled: !!user && isStudent,
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await supabase.from("assignments").select("*").order("due_date", { ascending: false })).data as Assignment[] ?? [],
  });

  const { data: mySubs = [] } = useQuery({
    queryKey: ["my-submissions", studentRecord?.id],
    enabled: !!studentRecord?.id,
    queryFn: async () => (await supabase.from("assignment_submissions").select("*").eq("student_id", studentRecord!.id)).data as Submission[] ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.class_id) throw new Error("Select a class");
      if (!form.title.trim() || !form.due_date) throw new Error("Title and due date required");
      const { error } = await supabase.from("assignments").insert([{
        class_id: form.class_id, title: form.title.trim(), description: form.description.trim() || null,
        subject: form.subject.trim() || null, due_date: form.due_date, max_marks: form.max_marks, created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assignment created"); qc.invalidateQueries({ queryKey: ["assignments"] }); setOpen(false); setForm({ class_id: "", title: "", description: "", subject: "", due_date: "", max_marks: 100 }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!submitOpen || !studentRecord?.id || !user) throw new Error("Not allowed");
      let file_url: string | null = null;
      if (subForm.file) {
        const path = `${user.id}/${submitOpen.id}-${Date.now()}-${subForm.file.name}`;
        const { error: upErr } = await supabase.storage.from("assignment-submissions").upload(path, subForm.file);
        if (upErr) throw upErr;
        file_url = path;
      }
      const { error } = await supabase.from("assignment_submissions").upsert([{
        assignment_id: submitOpen.id, student_id: studentRecord.id, file_url, notes: subForm.notes || null,
      }], { onConflict: "assignment_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Submitted"); qc.invalidateQueries({ queryKey: ["my-submissions", studentRecord?.id] }); setSubmitOpen(null); setSubForm({ notes: "", file: null }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Manage class assignments and submissions."
        actions={isStaff ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New assignment</Button> : null}
      />

      {isLoading ? (
        <div className="ra-card p-8 text-center text-muted-foreground text-sm">Loading…</div>
      ) : assignments.length === 0 ? (
        <EmptyState icon={FileText} title="No assignments yet" />
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const cls = classes.find(c => c.id === a.class_id);
            const mySub = mySubs.find(s => s.assignment_id === a.id);
            const overdue = new Date(a.due_date) < new Date();
            return (
              <div key={a.id} className="ra-card p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {cls ? classLabel(cls) : "—"} · Due {format(new Date(a.due_date), "PP")} · {a.max_marks} marks
                      {a.subject && <> · {a.subject}</>}
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground mt-2">{a.description}</p>}
                  </div>
                  <div className="flex gap-2 items-start">
                    {isStudent && studentRecord && (
                      mySub ? (
                        <span className="text-xs px-3 py-1 rounded-full bg-success/15 text-success">
                          Submitted{mySub.marks != null ? ` · ${mySub.marks}/${a.max_marks}` : ""}
                        </span>
                      ) : (
                        <Button size="sm" variant={overdue ? "outline" : "default"} onClick={() => setSubmitOpen(a)}>
                          <Upload className="h-4 w-4 mr-1" /> {overdue ? "Submit late" : "Submit"}
                        </Button>
                      )
                    )}
                    {isStaff && <Button size="sm" variant="outline" onClick={() => setGradeOpen(a)}>Grade</Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max marks</Label><Input type="number" value={form.max_marks} onChange={e => setForm({ ...form, max_marks: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit dialog */}
      <Dialog open={!!submitOpen} onOpenChange={() => setSubmitOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit: {submitOpen?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>File (optional)</Label>
              <Input type="file" onChange={e => setSubForm({ ...subForm, file: e.target.files?.[0] ?? null })} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={subForm.notes} onChange={e => setSubForm({ ...subForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitOpen(null)}>Cancel</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade dialog */}
      {gradeOpen && <GradePanel assignment={gradeOpen} onClose={() => setGradeOpen(null)} />}
    </div>
  );
}

function GradePanel({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery({
    queryKey: ["asg-grade", assignment.id],
    queryFn: async () => (await supabase.from("assignment_submissions").select("*").eq("assignment_id", assignment.id)).data as Submission[] ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["asg-students-of", assignment.class_id],
    queryFn: async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", assignment.class_id);
      const ids = (enr ?? []).map(e => e.student_id);
      if (!ids.length) return [];
      return (await supabase.from("students").select("id, full_name").in("id", ids).order("full_name")).data ?? [];
    },
  });
  const [edits, setEdits] = useState<Record<string, { marks: string; feedback: string }>>({});

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(edits).map(([sid, v]) => {
        const sub = subs.find(s => s.student_id === sid);
        return {
          id: sub?.id, assignment_id: assignment.id, student_id: sid,
          marks: v.marks === "" ? null : Number(v.marks), feedback: v.feedback || null, graded_at: new Date().toISOString(),
        };
      });
      for (const r of rows) {
        if (r.id) await supabase.from("assignment_submissions").update({ marks: r.marks, feedback: r.feedback, graded_at: r.graded_at }).eq("id", r.id);
        else await supabase.from("assignment_submissions").insert([{ assignment_id: r.assignment_id, student_id: r.student_id, marks: r.marks, feedback: r.feedback, graded_at: r.graded_at }]);
      }
    },
    onSuccess: () => { toast.success("Grades saved"); qc.invalidateQueries({ queryKey: ["asg-grade", assignment.id] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Grade: {assignment.title}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className="text-left py-2">Student</th><th className="text-left py-2">Submitted</th><th className="text-left py-2">Marks /{assignment.max_marks}</th><th className="text-left py-2">Feedback</th></tr></thead>
            <tbody>
              {students.map((s: any) => {
                const sub = subs.find(x => x.student_id === s.id);
                const e = edits[s.id] ?? { marks: sub?.marks?.toString() ?? "", feedback: sub?.feedback ?? "" };
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">{s.full_name}</td>
                    <td className="py-2 pr-2 text-muted-foreground text-xs">{sub ? format(new Date(sub.submitted_at), "PP") : "—"}</td>
                    <td className="py-2 pr-2 w-24"><Input type="number" value={e.marks} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, marks: ev.target.value } })} /></td>
                    <td className="py-2"><Input value={e.feedback} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, feedback: ev.target.value } })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save grades</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
