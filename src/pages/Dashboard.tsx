import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { ROLE_LABEL } from "@/lib/roles";
import { Users, GraduationCap, Briefcase, BookOpen, Layers } from "lucide-react";
import { AttendanceWidgets } from "@/components/dashboard/AttendanceWidgets";

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  loading?: boolean;
}) {
  return (
    <div className="ra-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-2xl font-semibold">
        {loading ? <span className="text-muted-foreground text-base">—</span> : value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, roles } = useAuth();

  const isAdminOrHead = hasAnyRole(roles, ["admin", "head_staff"]);

  const { data: counts, isLoading } = useQuery({
    queryKey: ["dashboard-counts"],
    enabled: isAdminOrHead,
    queryFn: async () => {
      const [u, s, st, c, cl] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("staff").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*", { count: "exact", head: true }),
      ]);
      return {
        users: u.count ?? 0,
        students: s.count ?? 0,
        staff: st.count ?? 0,
        courses: c.count ?? 0,
        classes: cl.count ?? 0,
      };
    },
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div>
      <PageHeader
        title={`${greeting}`}
        description={user?.email ? `Signed in as ${user.email}` : undefined}
      />

      {roles.length === 0 && (
        <div className="ra-card p-5 mb-6 border-warning/40 bg-warning/5">
          <div className="font-medium">No roles assigned yet</div>
          <p className="text-sm text-muted-foreground mt-1">
            Your account is active but has no roles. An administrator will assign permissions so you can access the right modules.
          </p>
        </div>
      )}

      {isAdminOrHead && (
        <>
          <div className="ra-section-title mb-3">Overview</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {hasAnyRole(roles, ["admin"]) && (
              <StatCard icon={Users} label="Users" value={counts?.users ?? 0} loading={isLoading} />
            )}
            <StatCard icon={GraduationCap} label="Students" value={counts?.students ?? 0} loading={isLoading} />
            <StatCard icon={Briefcase} label="Staff" value={counts?.staff ?? 0} loading={isLoading} />
            <StatCard icon={BookOpen} label="Courses" value={counts?.courses ?? 0} loading={isLoading} />
            <StatCard icon={Layers} label="Classes" value={counts?.classes ?? 0} loading={isLoading} />
          </div>
        </>
      )}

      <div className="ra-section-title mb-3">Attendance</div>
      <AttendanceWidgets />

      <div className="ra-section-title mb-3">Your access</div>
      <div className="ra-card p-5">
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r}
                className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full"
              >
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-4">
          Upcoming modules — Attendance, Timetable, Assignments, Tests & Results, Finance, Reports — will appear here as they are enabled for your roles.
        </p>
      </div>
    </div>
  );
}
