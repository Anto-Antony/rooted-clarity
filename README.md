# Vite React + Supabase (Staff/Student Portal)

A React (TypeScript) single-page application built with **Vite** and styled with **Tailwind CSS** (plus shadcn/ui components). The app uses **Supabase** for authentication, authorization (role-based access), and data operations.

## What this app does

- Provides login / registration and account flows (verify email, forgot/reset password).
- Uses **Supabase Auth** and an app-level **role system** (`admin`, `head_staff`, `regular_staff`, `guest_staff`, `accountant`, `student`).
- Protects routes with role guards and renders an authenticated app shell.
- Supports common school/workflow features (examples found in the routes):
  - Dashboard
  - Users / Students / Staff
  - Courses / Classes / Timetable
  - Attendance
  - Assignments / Tests
  - Leaves
  - Finance / Payroll
  - Notifications
  - Audit log

## Tech stack

- **React 18** + **TypeScript**
- **Vite**
- **react-router-dom** for routing
- **@tanstack/react-query** for server-state
- **Supabase** (`@supabase/supabase-js`) for auth + database + storage
- **Tailwind CSS** + **shadcn/ui**-style components
- **Vitest** for tests

## Key concepts

### Authentication & authorization

- `src/hooks/useAuth.tsx` manages:
  - Supabase session state
  - Current user
  - User roles loaded from the `user_roles` table
- Route protection is handled by `src/components/auth/RequireAuth` (see `src/App.tsx`).
- Roles are represented by the union type:
  - `admin`, `head_staff`, `regular_staff`, `guest_staff`, `accountant`, `student`

### Data layer

- Supabase client lives in `src/integrations/supabase/client.ts`.
- Pages call Supabase directly and typically use React Query for fetching/mutations.

## Supabase configuration

The Supabase client requires these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-publishable-key>"
```

### Required database tables (by usage)

The code references (at minimum):

- `user_roles` (used to fetch roles by `user_id`)

Additional tables are referenced by individual pages (e.g., classes, courses, attendance records, assignments, notifications, audit logs). Run/validate your Supabase migrations in `supabase/migrations/`.

### Storage

Some flows upload files (e.g., assignment submissions) via Supabase Storage. Make sure the referenced storage bucket(s) exist and permissions are configured.

## Development

Install dependencies (pick one based on your lockfile):

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

## Tests

Run tests:

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

## Routes (high level)

Routes are declared in `src/App.tsx`:

- Public/auth routes:
  - `/auth`
  - `/auth/verify-email`
  - `/auth/forgot-password`
  - `/auth/reset-password`
  - `/auth/reset-success`
  - `/auth/callback`
- Authenticated app routes under `/app`:
  - `/app` (Dashboard)
  - `/app/users` (admin)
  - `/app/students`
  - `/app/staff` (admin, head_staff)
  - `/app/courses` (admin, head_staff)
  - `/app/classes` (admin, head_staff)
  - `/app/timetable`
  - `/app/attendance` (admin, head_staff, regular_staff, guest_staff)
  - `/app/assignments`
  - `/app/tests`
  - `/app/leaves`
  - `/app/finance` (admin, accountant, head_staff, student)
  - `/app/payroll` (admin, accountant, head_staff, regular_staff, guest_staff)
  - `/app/notifications`
  - `/app/audit` (admin)
  - `/app/profile`

A catch-all route renders `src/pages/NotFound.tsx`.

## Project structure (important files)

- `src/App.tsx` — router + route guards
- `src/hooks/useAuth.tsx` — auth context + roles
- `src/integrations/supabase/client.ts` — Supabase client
- `src/components/auth/*` — auth-related UI and route protection
- `src/components/layout/*` — app shell layout
- `src/pages/*` — route pages

## Notes

- This project is configured for **Vite** and will use `import.meta.env.*` variables.
- Ensure Supabase rules/policies align with the tables and storage usage in your app.

## License

Add a license if you have one. Otherwise, default rights reserved.

