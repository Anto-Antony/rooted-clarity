import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import Auth from "./pages/Auth";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ResetSuccess from "./pages/auth/ResetSuccess";
import AuthCallback from "./pages/auth/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Students from "./pages/Students";
import Staff from "./pages/Staff";
import Courses from "./pages/Courses";
import Classes from "./pages/Classes";
import Profile from "./pages/Profile";
import Timetable from "./pages/Timetable";
import Attendance from "./pages/Attendance";
import Assignments from "./pages/Assignments";
import Tests from "./pages/Tests";
import Leaves from "./pages/Leaves";
import Finance from "./pages/Finance";
import Payroll from "./pages/Payroll";
import Notifications from "./pages/Notifications";
import AuditLog from "./pages/AuditLog";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/reset-success" element={<ResetSuccess />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="users" element={<RequireAuth roles={["admin"]}><Users /></RequireAuth>} />
              <Route path="students" element={<Students />} />
              <Route path="staff" element={<RequireAuth roles={["admin", "head_staff"]}><Staff /></RequireAuth>} />
              <Route path="courses" element={<RequireAuth roles={["admin", "head_staff"]}><Courses /></RequireAuth>} />
              <Route path="classes" element={<RequireAuth roles={["admin", "head_staff"]}><Classes /></RequireAuth>} />
              <Route path="timetable" element={<Timetable />} />
              <Route path="attendance" element={<RequireAuth roles={["admin", "head_staff", "regular_staff", "guest_staff"]}><Attendance /></RequireAuth>} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="tests" element={<Tests />} />
              <Route path="leaves" element={<Leaves />} />
              <Route path="finance" element={<RequireAuth roles={["admin", "accountant", "head_staff", "student"]}><Finance /></RequireAuth>} />
              <Route path="payroll" element={<RequireAuth roles={["admin", "accountant", "head_staff", "regular_staff", "guest_staff"]}><Payroll /></RequireAuth>} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="audit" element={<RequireAuth roles={["admin"]}><AuditLog /></RequireAuth>} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
