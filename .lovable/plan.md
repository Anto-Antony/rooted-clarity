# RootedAcademy — v1 Foundation Plan

**Tagline:** "Where Clarity Begins"

A clean, minimalist academic management platform. This first iteration builds the **core foundation**: authentication, role-based access, user/student/staff management, academic structure (courses & classes), and role-specific dashboards. Attendance, assignments, tests/grades, finance, audit, and notifications are planned as follow-up iterations so each module gets proper depth.

---

## Scope for this iteration

### In scope
1. **Authentication & RBAC** — email/password login, multi-role support
2. **User management** — admin CRUD + profiles
3. **Student management** — admission form, directory, detail view
4. **Staff management** — directory, designations, departments, subjects
5. **Academic structure** — courses and classes (with class teacher assignment)
6. **Role-aware layout** — sidebar + topbar, route guards
7. **Role dashboards** — Admin, HeadStaff, RegularStaff, GuestStaff, Accountant, Student (simple snapshot cards; richer data arrives with later modules)

### Deferred to later iterations (by design)
- Timetable, Attendance, Leaves, Assignments, Tests/Results, Finance/Payments, Reporting, Audit log viewer, Notifications
- Edge functions for business rules (conflict checks, result publication, payment workflows)
- File uploads (assignment submissions, payment screenshots)

Each deferred module will be a focused follow-up so logic and UX are done properly.

---

## Design language

- **Style:** minimalist, academic, lots of whitespace, clear hierarchy
- **Accent:** muted green (RootedAcademy brand)
- **Background:** soft off-white; cards on pure white with subtle borders
- **Typography:** clean sans-serif, generous line-height, strong headings
- **Components:** reusable DataTable (search, filter, paginate), FormField with validation, Modal for create/edit, empty states, subtle loading skeletons
- **Responsive:** sidebar collapses to a drawer on mobile; tables become stacked cards

---

## User roles

`Admin`, `HeadStaff`, `RegularStaff`, `GuestStaff`, `Accountant`, `Student` — users can hold multiple roles; effective permissions are the union. A role-switcher appears in the topbar when a user has more than one role.

### Navigation by role (v1)
| Role | Sees |
|---|---|
| Admin | Dashboard, Users, Students, Staff, Courses, Classes, Profile |
| HeadStaff | Dashboard, Students, Staff, Courses, Classes, Profile |
| RegularStaff / GuestStaff | Dashboard, Students (read), Classes (assigned), Profile |
| Accountant | Dashboard, Students (read), Profile *(Finance module arrives later)* |
| Student | Dashboard, Profile |

---

## Key screens

1. **Login** — logo, name + tagline, email, password, error states
2. **Admin Dashboard** — cards: total users, students, staff, courses, classes
3. **Users** — table with search + role/status filters; add/edit modal with role multi-select; soft-delete (deactivate)
4. **Students** — directory table; admission form grouped into Personal / Academic / Contact; detail page; edits restricted & auditable (audit wiring stubbed for later module)
5. **Staff** — directory with designation/department filters; form with subject tags
6. **Courses** — list + create/edit (name, credits)
7. **Classes** — list + create/edit (course, section, academic year, class teacher)
8. **Profile** — view own info, edit allowed fields

---

## Technical approach

**Stack:** React + TypeScript + Vite + Tailwind + shadcn/ui, React Router, TanStack Query, Zod. Lovable Cloud (Supabase) for Postgres, Auth, and Storage — organized to mirror the requested domain structure.

### Auth
- Supabase email/password; session via `onAuthStateChange` set up before `getSession`
- `profiles` table linked to `auth.users` (1:1, FK with cascade) auto-created by trigger on signup
- **Roles in a separate `user_roles` table** (never on profiles) with `app_role` enum
- `has_role(_user_id, _role)` SECURITY DEFINER function used in RLS policies to avoid recursion
- Client `useAuth` + `useRoles` hooks; `<RequireRole>` route guard component

### Data model (v1)
- `profiles` (id → auth.users, full_name, phone, address, status, timestamps)
- `user_roles` (user_id, role: app_role) — enum: admin, head_staff, regular_staff, guest_staff, accountant, student
- `students` (id, user_id?, name, email, dob, admission_date, program, status, locked_at)
- `staff` (id, user_id?, name, email, designation, department, status)
- `staff_subjects` (staff_id, subject text) — simple tag-style many-to-one
- `courses` (id, name, credits)
- `classes` (id, course_id FK, section, academic_year, class_teacher_id FK → staff)

FKs, indexes on lookup columns, and RLS on every table. Policies:
- Admin: full access (via `has_role`)
- HeadStaff: read/write students, staff, courses, classes
- Staff/Student/Accountant: scoped reads; users can read/update own profile

### Frontend structure
```text
src/
  components/
    layout/        AppShell, Sidebar, Topbar, RoleSwitcher
    auth/          RequireAuth, RequireRole
    shared/        DataTable, FormField, PageHeader, EmptyState, ConfirmDialog
  pages/
    auth/Login
    dashboard/     role-specific dashboard components
    users/         List, Form modal
    students/      List, Admission form, Detail
    staff/         List, Form
    courses/       List, Form
    classes/       List, Form
    profile/       Profile
  hooks/           useAuth, useRoles, useCurrentProfile
  lib/             validators (zod schemas), query keys
```

### Validation & integrity
- Zod schemas for every form; shared between pages and DB-bound mutations
- Trimmed, length-limited, type-checked inputs
- Referential integrity via FKs; class requires valid course; class_teacher must exist in staff
- Student record gets a `locked_at` timestamp after admission; edits gated by role check (audit logging arrives with the audit module)

### Security baseline
- RLS on every table; role checks via `has_role` (never client-trust)
- No role data client-side for authorization decisions beyond UI hints
- Password hashing handled by Supabase Auth
- Input validation on all forms (Zod)

---

## What you'll be able to do after this iteration

- Sign in, land on a role-appropriate dashboard
- Admin: create users, assign multiple roles, manage students/staff/courses/classes
- HeadStaff: manage academic entities
- All users: view and edit their profile
- Clean, branded UI ready to extend with attendance, finance, and the remaining modules

After approval, the next iteration I'd recommend is **Attendance + Timetable** (they share class/staff data and give immediate value to staff and students).