import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole, hasAnyRole } from "@/hooks/useAuth";
import { ReactNode } from "react";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { user, roles: userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (!user.email_confirmed_at) {
    return <Navigate to="/auth/verify-email" state={{ email: user.email }} replace />;
  }
  if (roles && roles.length && !hasAnyRole(userRoles, roles)) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}
