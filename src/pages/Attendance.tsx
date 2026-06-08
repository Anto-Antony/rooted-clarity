import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { useAttendanceSessions } from "@/hooks/useAttendanceSessions";
import { useWorkingDay } from "@/hooks/useWorkingDay";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceStatus } from "@/lib/attendance";

type ClassRow = { id: string; section: string; academic_year: string; course_id: string };
type Course = { id: string; name: string };
type Student = { id: string; full_name: string };

export default function Attendance() {
  const { user, roles } = useAuth();
  const canManageAll = hasAnyRole(roles, ["admin", "head_staff"]);
  const isStaff = hasAnyRole(roles, ["admin", "head_staff", "regular_staff", "guest_staff"]);
  const qc = useQueryClient();

  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionId, setSessionId] = useState("");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const { data: classes = [] } = useQuery({
    queryKey: ["att-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, section, academic_year, course_id").order("academic_year", { ascending: false })).data as ClassRow[] ?? [],
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["att-courses"],
    queryFn: async () => (await supabase.from("courses").select("id, name")).data as Course[] ?? [],
  });
  const courseById = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);

  const workingDay = useWorkingDay(date, classId);
  const sessions = useAttendanceSessions(classId, date);
  const session = sessions.data?.find(s => s.id === sessionId);

  useEffect(() => { setSessionId(""); }, [classId, date]);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_attendance_sessions", {
        _class_id: classId, _from: date, _to: date,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`Generated ${n} session(s)`); qc.invalidateQueries({ queryKey: ["att-sessions", classId, date] }); },
    onError: (e: any) => toast.error(e.message),
  });

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
    queryKey: ["att-period-existing", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase.from("period_attendance_records").select("student_id, status").eq("session_id", sessionId);
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    enrolled.forEach(s => { next[s.id] = "present"; });
    existing.forEach((r: any) => { next[r.student_id] = r.status; });
    setMarks(next);
  }, [enrolled, existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Select a period");
      const rows = enrolled.map(s => ({
        session_id: sessionId, student_id: s.id, status: marks[s.id] ?? "present", marked_by: user?.id,
      }));
      const { error } = await supabase.from("period_attendance_records").upsert(rows, { onConflict: "session_id,student_id" });
      if (error) throw error;
      await supabase.from("attendance_sessions").update({ status: "marked" }).eq("id", sessionId);
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["att-period-existing", sessionId] });
      qc.invalidateQueries({ queryKey: ["att-sessions", classId, date] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(marks).forEach(s => { c[s]++; });
    return c;
  }, [marks]);

  const isFuture = date > new Date().toISOString().slice(0, 10);
  const canMarkThis = isStaff && session && session.status !== "cancelled" && !isFuture && (
    canManageAll || (session.teacher_id != null)
  );

  return (
    <div>
      <PageHeader title="Attendance" description="Period-wise attendance per class." />

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
        <div className="space-y-1">
          <Label>Period</Label>
          <Select value={sessionId} onValueChange={setSessionId} disabled={!classId || (sessions.data?.length ?? 0) === 0}>
            <SelectTrigger><SelectValue placeholder={sessions.data?.length ? "Select period" : "No sessions"} /></SelectTrigger>
            <SelectContent>
              {(sessions.data ?? []).map(s => (
                <SelectItem key={s.id} value={s.id}>
                  P{s.period} · {s.subject}{s.status === "marked" ? " · ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {classId && workingDay.data && !workingDay.data.working && (
        <div className="ra-card p-4 mb-4 border-warning/40 bg-warning/5 text-sm">
          Not a working day ({workingDay.data.reason}). No sessions will be generated.
        </div>
      )}

      {classId && workingDay.data?.working && (sessions.data?.length ?? 0) === 0 && (
        <div className="ra-card p-4 mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">No sessions yet for this date.</div>
          {isStaff && (
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Sparkles className="h-4 w-4 mr-1" />{generate.isPending ? "Generating…" : "Generate from timetable"}
            </Button>
          )}
        </div>
      )}

      {sessionId && enrolled.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Present</span> <span className="font-semibold ml-1">{counts.present}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Absent</span> <span className="font-semibold ml-1">{counts.absent}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Late</span> <span className="font-semibold ml-1">{counts.late}</span></div>
          <div className="ra-card px-4 py-2"><span className="text-muted-foreground">Excused</span> <span className="font-semibold ml-1">{counts.excused}</span></div>
          <div className="ml-auto">
            <Button onClick={() => save.mutate()} disabled={!canMarkThis || save.isPending}>
              <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save attendance"}
            </Button>
          </div>
        </div>
      )}

      {!classId ? (
        <EmptyState icon={ClipboardCheck} title="Select a class" description="Pick a class to view its periods." />
      ) : !sessionId ? (
        <EmptyState icon={ClipboardCheck} title="Select a period" description="Choose a period (subject) to mark attendance." />
      ) : enrolled.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No students enrolled" description="Enroll students to this class first." />
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
                      {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(opt => (
                        <button
                          key={opt}
                          disabled={!canMarkThis}
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
