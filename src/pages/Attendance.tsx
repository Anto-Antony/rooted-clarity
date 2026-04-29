import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Save } from "lucide-react";
import { toast } from "sonner";

type ClassRow = { id: string; section: string; academic_year: string; course_id: string };
type Course = { id: string; name: string };
type Student = { id: string; full_name: string };
type Status = "present" | "absent" | "late" | "excused";

export default function Attendance() {
  const { user, roles } = useAuth();
  const canMark = hasAnyRole(roles, ["admin", "head_staff", "regular_staff"]);
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, Status>>({});

  const { data: classes = [] } = useQuery({
    queryKey: ["att-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, section, academic_year, course_id").order("academic_year", { ascending: false })).data as ClassRow[] ?? [],
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["att-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, name")).data as Course[] ?? [],
  });
  const courseById = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);

  const { data: enrolled = [] } = useQuery({
    queryKey: ["att-enrolled", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = (enr ?? []).map(e => e.student_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("students").select("id, full_name").in("id", ids).order("full_name");
      return (data ?? []) as Student[];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["att-existing", classId, date],
    enabled: !!classId && !!date,
    queryFn: async () => {
      const { data } = await supabase.from("attendance_records").select("student_id, status").eq("class_id", classId).eq("date", date);
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, Status> = {};
    enrolled.forEach(s => { next[s.id] = "present"; });
    existing.forEach((r: any) => { next[r.student_id] = r.status; });
    setMarks(next);
  }, [enrolled, existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("Select a class");
      const rows = enrolled.map(s => ({
        class_id: classId, student_id: s.id, date, status: marks[s.id] ?? "present", marked_by: user?.id,
      }));
      const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "class_id,student_id,date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance saved"); qc.invalidateQueries({ queryKey: ["att-existing", classId, date] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(marks).forEach(s => { c[s]++; });
    return c;
  }, [marks]);

  return (
    <div>
      <PageHeader title="Attendance" description="Mark daily attendance per class." />
      <div className="ra-card p-4 mb-4 grid sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{courseById[c.course_id] ?? "—"} · {c.section} · {c.academic_year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Button disabled={!canMark || !classId || enrolled.length === 0 || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save attendance"}
        </Button>
      </div>

      {classId && enrolled.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Present</span> <span className="font-semibold ml-1">{counts.present}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Absent</span> <span className="font-semibold ml-1">{counts.absent}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Late</span> <span className="font-semibold ml-1">{counts.late}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Excused</span> <span className="font-semibold ml-1">{counts.excused}</span></div>
        </div>
      )}

      {!classId ? (
        <EmptyState icon={ClipboardCheck} title="Select a class" description="Pick a class to mark attendance." />
      ) : enrolled.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No students enrolled" description="Enroll students to this class first (Classes → Manage roster)." />
      ) : (
        <div className="ra-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr><th className="px-4 py-3 text-left font-medium">Student</th><th className="px-4 py-3 text-left font-medium">Status</th></tr>
            </thead>
            <tbody>
              {enrolled.map(s => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{s.full_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(["present", "absent", "late", "excused"] as Status[]).map(opt => (
                        <button
                          key={opt}
                          disabled={!canMark}
                          onClick={() => setMarks({ ...marks, [s.id]: opt })}
                          className={`px-3 py-1 rounded-full text-xs border transition ${
                            marks[s.id] === opt
                              ? opt === "present" ? "bg-success text-success-foreground border-success"
                              : opt === "absent" ? "bg-destructive text-destructive-foreground border-destructive"
                              : opt === "late" ? "bg-warning text-warning-foreground border-warning"
                              : "bg-muted text-foreground border-border"
                              : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                          }`}
                        >{opt}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
