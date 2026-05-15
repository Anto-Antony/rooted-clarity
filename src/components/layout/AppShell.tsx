import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, hasAnyRole, AppRole } from "@/hooks/useAuth";
import { ROLE_LABEL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Briefcase,
  BookOpen,
  Layers,
  UserCircle,
  LogOut,
  Sprout,
  Menu,
  Calendar,
  ClipboardCheck,
  FileText,
  ClipboardList,
  Wallet,
  CalendarOff,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard },
  { label: "Users", to: "/app/users", icon: Users, roles: ["admin"] },
  { label: "Students", to: "/app/students", icon: GraduationCap },
  { label: "Staff", to: "/app/staff", icon: Briefcase, roles: ["admin", "head_staff"] },
  { label: "Courses", to: "/app/courses", icon: BookOpen, roles: ["admin", "head_staff"] },
  { label: "Classes", to: "/app/classes", icon: Layers, roles: ["admin", "head_staff"] },
  { label: "Timetable", to: "/app/timetable", icon: Calendar },
  { label: "Attendance", to: "/app/attendance", icon: ClipboardCheck, roles: ["admin", "head_staff", "regular_staff", "guest_staff"] },
  { label: "Assignments", to: "/app/assignments", icon: FileText },
  { label: "Tests & Results", to: "/app/tests", icon: ClipboardList },
  { label: "Leaves", to: "/app/leaves", icon: CalendarOff },
  { label: "Finance", to: "/app/finance", icon: Wallet, roles: ["admin", "accountant", "student"] },
  { label: "Payroll", to: "/app/payroll", icon: Wallet, roles: ["admin", "accountant", "head_staff", "regular_staff", "guest_staff"] },
  { label: "Audit log", to: "/app/audit", icon: ShieldCheck, roles: ["admin"] },
  { label: "Profile", to: "/app/profile", icon: UserCircle },
];

export function AppShell() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = NAV.filter((n) => !n.roles || hasAnyRole(roles, n.roles));

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-6 py-6 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
          <Sprout className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold text-sidebar-foreground leading-tight">RootedAcademy</div>
          <div className="text-xs text-muted-foreground">Where Clarity Begins</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground px-3 mb-2">Your roles</div>
        <div className="px-3 flex flex-wrap gap-1">
          {roles.length === 0 && (
            <span className="text-xs text-muted-foreground italic">None assigned</span>
          )}
          {roles.map((r) => (
            <span
              key={r}
              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
            >
              {ROLE_LABEL[r]}
            </span>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-64 bg-sidebar flex flex-col border-r border-sidebar-border"
            onClick={(e) => e.stopPropagation()}
          >
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur flex items-center gap-3 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                  {initials}
                </div>
                <span className="text-sm hidden sm:inline">{user?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/app/profile")}>
                <UserCircle className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
