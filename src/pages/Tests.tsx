import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ClassRow = { id: string; section: string; academic_year: string; course_id: string };
type Course = { id: string; name: string };
type Test = { id: string; class_id: string; title: string; test_type: string; subject: string | null; test_date: string; max_marks: number; published: boolean };
type Result = { id: string; test_id: string; student_id: string; marks: number | null; remarks: string | null };

export default function Tests() {
  const { user, roles } = useAuth();
  const isStaff = hasAnyRole(roles, ["admin", "head_staff", "regular_staff"]);
  const isStudent = hasAnyRole(roles, ["student"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", title: "", test_type: "unit", subject: "", test_date: "", max_marks: 100 });
  const [resultsFor, setResultsFor] = useState<Test | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["t-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, section, academic_year, course_id")).data as ClassRow[] ?? [],
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["t-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, name")).data as Course[] ?? [],
  });
  const courseById = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);
  const classLabel = (c: ClassRow) => `${courseById[c.course_id] ?? "—"} · ${c.section} · ${c.academic_year}`;

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => (await supabase.from("tests").select("*").order("test_date", { ascending: false })).data as Test[] ?? [],
  });

  const { data: studentRecord } = useQuery({
    queryKey: ["my-student-tests", user?.id],
    enabled: !!user && isStudent,
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: myResults = [] } = useQuery({
    queryKey: ["my-results", studentRecord?.id],
    enabled: !!studentRecord?.id,
    queryFn: async () => (await supabase.from("test_results").select("*").eq("student_id", studentRecord!.id)).data as Result[] ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.class_id || !form.title.trim() || !form.test_date) throw new Error("Class, title and date required");
      const { error } = await supabase.from("tests").insert([{
        class_id: form.class_id, title: form.title.trim(), test_type: form.test_type,
        subject: form.subject.trim() || null, test_date: form.test_date, max_marks: form.max_marks, created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Test created"); qc.invalidateQueries({ queryKey: ["tests"] }); setOpen(false); setForm({ class_id: "", title: "", test_type: "unit", subject: "", test_date: "", max_marks: 100 }); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (t: Test) => { const { error } = await supabase.from("tests").update({ published: !t.published }).eq("id", t.id); if (error) throw error; },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["tests"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Tests & Results" description="Create assessments and publish marks." actions={isStaff ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New test</Button> : null} />

      {tests.length === 0 ? <EmptyState icon={ClipboardList} title="No tests yet" /> : (
        <div className="space-y-3">
          {tests.map(t => {
            const cls = classes.find(c => c.id === t.class_id);
            const myR = myResults.find(r => r.test_id === t.id);
            return (
              <div key={t.id} className="ra-card p-4">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {t.title}
                      {t.published ? <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">Published</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Draft</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {cls ? classLabel(cls) : "—"} · {t.test_type} · {format(new Date(t.test_date), "PP")} · {t.max_marks} marks{t.subject && ` · ${t.subject}`}
                    </div>
                    {isStudent && t.published && myR && (
                      <div className="text-sm mt-2 font-medium">Your score: {myR.marks ?? "—"} / {t.max_marks}{myR.remarks && <span className="text-muted-foreground font-normal"> · {myR.remarks}</span>}</div>
                    )}
                  </div>
                  {isStaff && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResultsFor(t)}>Enter results</Button>
                      <Button size="sm" variant="ghost" onClick={() => togglePublish.mutate(t)}>
                        {t.published ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Unpublish</> : <><Circle className="h-4 w-4 mr-1" /> Publish</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New test</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.test_type} onValueChange={v => setForm({ ...form, test_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit test</SelectItem>
                    <SelectItem value="midterm">Midterm</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.test_date} onChange={e => setForm({ ...form, test_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max marks</Label><Input type="number" value={form.max_marks} onChange={e => setForm({ ...form, max_marks: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {resultsFor && <ResultsPanel test={resultsFor} onClose={() => setResultsFor(null)} />}
    </div>
  );
}

function ResultsPanel({ test, onClose }: { test: Test; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery({
    queryKey: ["t-students", test.class_id],
    queryFn: async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", test.class_id);
      const ids = (enr ?? []).map(e => e.student_id);
      if (!ids.length) return [];
      return (await supabase.from("students").select("id, full_name").in("id", ids).order("full_name")).data ?? [];
    },
  });
  const { data: existing = [] } = useQuery({
    queryKey: ["t-results-existing", test.id],
    queryFn: async () => (await supabase.from("test_results").select("*").eq("test_id", test.id)).data as Result[] ?? [],
  });
  const [edits, setEdits] = useState<Record<string, { marks: string; remarks: string }>>({});

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(edits).map(([sid, v]) => ({
        test_id: test.id, student_id: sid, marks: v.marks === "" ? null : Number(v.marks), remarks: v.remarks || null,
      }));
      if (!rows.length) return;
      const { error } = await supabase.from("test_results").upsert(rows, { onConflict: "test_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["t-results-existing", test.id] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Results: {test.title}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border"><tr><th className="text-left py-2">Student</th><th className="text-left py-2 w-24">Marks /{test.max_marks}</th><th className="text-left py-2">Remarks</th></tr></thead>
            <tbody>
              {students.map((s: any) => {
                const r = existing.find(x => x.student_id === s.id);
                const e = edits[s.id] ?? { marks: r?.marks?.toString() ?? "", remarks: r?.remarks ?? "" };
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">{s.full_name}</td>
                    <td className="py-2 pr-2"><Input type="number" value={e.marks} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, marks: ev.target.value } })} /></td>
                    <td className="py-2"><Input value={e.remarks} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, remarks: ev.target.value } })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
