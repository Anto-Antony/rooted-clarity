import { AppRole } from "@/hooks/useAuth";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  head_staff: "Head Staff",
  regular_staff: "Regular Staff",
  guest_staff: "Guest Staff",
  accountant: "Accountant",
  student: "Student",
};

export const ALL_ROLES: AppRole[] = [
  "admin",
  "head_staff",
  "regular_staff",
  "guest_staff",
  "accountant",
  "student",
];

export const MANAGES_ACADEMICS: AppRole[] = ["admin", "head_staff"];
export const MANAGES_USERS: AppRole[] = ["admin"];
