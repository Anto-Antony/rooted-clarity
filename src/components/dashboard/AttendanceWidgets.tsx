import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ra-card p-5">
      <div className="text-sm text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function StudentAttendance({ userId }: { userId: string }) {
  const { data: student } = useQuery({
    queryKey: ["my-student", userId],
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", userId).maybeSingle()).data,
  });

  const studentId = student?.id;
  const { data: overall } = useQuery({
    queryKey: ["att-overall", studentId],
    enabled: !!studentId,
    queryFn: async () => (await supabase.from("v_student_overall_attendance").select("attended, conducted, pct").eq("student_id", studentId!).maybeSingle()).data,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["att-subjects", studentId],
    enabled: !!studentId,
    queryFn: async () => (await supabase.from("v_student_subject_attendance").select("subject, attended, conducted, pct").eq("student_id", studentId!).order("subject")).data ?? [],
  });
  const { data: recent = [] } = useQuery({
    queryKey: ["att-recent-absent", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("period_attendance_records")
        .select("status, attendance_sessions!inner(date, subject, period)")
        .eq("student_id", studentId!)
        .eq("status", "absent")
        .order("attendance_sessions(date)" as any, { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (!studentId) return null;
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-8">
      <Card title="Overall attendance">
        <div className="text-3xl font-semibold">{overall?.pct ?? 0}%</div>
        <div className="text-xs text-muted-foreground mt-1">{overall?.attended ?? 0} / {overall?.conducted ?? 0} periods</div>
      </Card>
      <Card title="Subject-wise">
        {subjects.length === 0 ? <div className="text-sm text-muted-foreground">No data yet.</div> : (
          <ul className="space-y-1 text-sm max-h-44 overflow-auto">
            {subjects.map((s: any) => (
              <li key={s.subject} className="flex justify-between">
                <span className="truncate">{s.subject}</span>
                <span className="font-medium">{s.pct ?? 0}%</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Recent absences">
        {recent.length === 0 ? <div className="text-sm text-muted-foreground">None — nice.</div> : (
          <ul className="space-y-1 text-sm">
            {recent.map((r: any, i) => (
              <li key={i} className="flex justify-between">
                <span className="truncate">{r.attendance_sessions?.subject} · P{r.attendance_sessions?.period}</span>
                <span className="text-muted-foreground">{r.attendance_sessions?.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StaffAttendance({ userId }: { userId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: staff } = useQuery({
    queryKey: ["my-staff", userId],
    queryFn: async () => (await supabase.from("staff").select("id").eq("user_id", userId).maybeSingle()).data,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-sessions", staff?.id, today],
    enabled: !!staff?.id,
    queryFn: async () => (await supabase
      .from("attendance_sessions")
      .select("id, period, subject, status")
      .eq("teacher_id", staff!.id)
      .eq("date", today)
      .eq("status", "scheduled")
      .order("period")).data ?? [],
  });

  const { data: completion } = useQuery({
    queryKey: ["completion-today", today],
    queryFn: async () => {
      const { count: total } = await supabase.from("attendance_sessions").select("*", { count: "exact", head: true }).eq("date", today);
      const { count: marked } = await supabase.from("attendance_sessions").select("*", { count: "exact", head: true }).eq("date", today).eq("status", "marked");
      return { total: total ?? 0, marked: marked ?? 0 };
    },
  });

  return (
    <div className="grid md:grid-cols-3 gap-4 mb-8">
      <Card title="Your pending sessions today">
        {pending.length === 0 ? <div className="text-sm text-muted-foreground">All caught up.</div> : (
          <ul className="space-y-1 text-sm">
            {pending.map((s: any) => <li key={s.id}>P{s.period} · {s.subject}</li>)}
          </ul>
        )}
      </Card>
      <Card title="Today's completion">
        <div className="text-3xl font-semibold">
          {completion?.total ? Math.round((completion.marked / completion.total) * 100) : 0}%
        </div>
        <div className="text-xs text-muted-foreground mt-1">{completion?.marked ?? 0} / {completion?.total ?? 0} sessions marked</div>
      </Card>
      <Card title="Tip">
        <p className="text-sm text-muted-foreground">Generate today's sessions from the Attendance page if missing.</p>
      </Card>
    </div>
  );
}

export function AttendanceWidgets() {
  const { user, roles } = useAuth();
  if (!user) return null;
  if (hasAnyRole(roles, ["student"])) return <StudentAttendance userId={user.id} />;
  if (hasAnyRole(roles, ["admin", "head_staff", "regular_staff", "guest_staff"])) return <StaffAttendance userId={user.id} />;
  return null;
}
