## Goal

Make the student login flow correct end-to-end so that:
1. A student signs up via Supabase Auth (existing `/auth` page).
2. Admin/Head Staff grants the `student` role.
3. Admin/Head Staff "admits" the student into `public.students` with `user_id` linked to the auth user.
4. Student logs in and immediately sees their data on Assignments, Tests, Finance, etc. (because every student-facing page filters by `students.user_id = auth.uid()`).

The critical gotcha: **if `students.user_id` is NULL or doesn't match the authenticated user's id, the student will see an empty account even though they have the `student` role.** Linking is the whole point of this iteration.

---

## Recommended workflow (admin-facing)

**Phase A — Account creation (student-driven, already works)**
1. Student goes to `/auth → Create account` and signs up with email + password.
2. The existing `handle_new_user()` trigger inserts a row into `public.profiles`. No `student` row exists yet, no roles assigned.

**Phase B — Role assignment (Users page, already works)**
3. Admin opens **Users**, finds the new profile, ticks the **Student** role, saves. This inserts into `public.user_roles`.

**Phase C — Admission (Students page, NEW behavior)**
4. Admin opens **Students → New admission**.
5. Instead of typing a free-form name, admin picks from a dropdown of **auth users who have the `student` role but no row in `public.students` yet** ("Unlinked student accounts").
6. Admin fills program / admission_date / DOB / phone / address.
7. On save, we insert a `public.students` row with `user_id` set to the chosen profile id, and `locked_at = now()`.

**Phase D — Login**
8. Student signs in → `useAuth` loads their `student` role → student-facing pages query `students` by `user_id` and find their record.

**Edge case kept supported:** admitting a student who is *not yet* an auth user (paper admission). The dialog should still allow "No linked account yet" — insert with `user_id = null`, then later re-open the record and link it once the student signs up.

---

## SQL — what already exists vs. what to add

Everything required is already in place:
- `public.students.user_id uuid` exists (nullable — keep it nullable to support paper admissions).
- `public.user_roles` + `has_role()` function exist.
- RLS on `students` allows admin/head_staff full management; authenticated users can `SELECT`. Student-facing pages filter by `user_id = auth.uid()` in the queries themselves, which works because they can read all student rows but only join their own in practice. (Optional hardening listed below.)

**No migration is strictly required** for the feature to work. The only SQL admin would run manually (e.g. to fix an existing student) is:

```sql
-- 1) Find the auth user id of the student (by email)
select id, email from auth.users where email = 'student@example.com';

-- 2) Grant the student role (id = auth user id)
insert into public.user_roles (user_id, role)
values ('<auth-user-id>', 'student')
on conflict do nothing;

-- 3a) If a students row already exists (created on paper), link it:
update public.students
set user_id = '<auth-user-id>'
where id = '<students-row-id>';

-- 3b) Or create a fresh admission row linked to the auth user:
insert into public.students (user_id, full_name, email, admission_date, program, status, locked_at)
values ('<auth-user-id>', 'Jane Doe', 'student@example.com', current_date, 'B.Sc. CS', 'active', now());
```

**Optional hardening migration (recommended, ask before applying):**
- Add a partial unique index so one auth user maps to at most one student row:
  `create unique index students_user_id_uidx on public.students(user_id) where user_id is not null;`
- Tighten the `students` SELECT policy so a plain student only sees their own row:
  replace `Authenticated view students` with `(user_id = auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff') OR has_role(auth.uid(),'guest_staff') OR has_role(auth.uid(),'accountant')`.

---

## Code changes

### 1. New helper query in `src/pages/Students.tsx`

Add two React Query hooks alongside the existing `students` query:

- `unlinkedStudentAccounts` — profiles that (a) have the `student` role and (b) have no `students` row pointing at them yet.

Implementation pattern (two cheap queries, joined client-side — keeps RLS simple):

```ts
// auth users that hold the student role
const { data: studentRoleRows } = await supabase
  .from("user_roles").select("user_id").eq("role", "student");

// profiles for those user_ids
const ids = studentRoleRows.map(r => r.user_id);
const { data: candidateProfiles } = await supabase
  .from("profiles").select("id, full_name, email").in("id", ids);

// already-linked students
const { data: linked } = await supabase
  .from("students").select("user_id").not("user_id", "is", null);
const linkedSet = new Set(linked.map(l => l.user_id));

const unlinked = candidateProfiles.filter(p => !linkedSet.has(p.id));
```

### 2. Update the "New admission" dialog

Add a first step to the form:

```
Linked account  [ Select student account ▾ ]
                - Jane Doe (jane@example.com)
                - Ravi Kumar (ravi@example.com)
                - No linked account (paper admission)
```

- When a profile is selected, prefill `full_name` and `email` from the profile (still editable).
- The save mutation includes `user_id: selectedProfileId ?? null` in the insert payload.
- Keep the existing `locked_at = now()` behavior on insert.
- Keep "No linked account" as an explicit choice so paper admissions still work.

### 3. Edit dialog: allow linking later

When editing an existing students row that has `user_id IS NULL`, show the same dropdown so admin can attach an auth account retroactively. (One-line change: include the same `<Select>` and add `user_id` to the update payload when present.)

### 4. Visual cue in the table

Add a small "Linked" / "Unlinked" pill next to the lock icon in `Students.tsx` so admins can scan which records still need an account attached.

### 5. No changes needed to

- `useAuth.tsx`, `RequireAuth.tsx`, `Auth.tsx` — sign-up/sign-in already produce a `profiles` row via the `handle_new_user()` trigger.
- Student-facing pages (`Assignments`, `Tests`, `Finance`, `Attendance`) — they already query `students` by `user_id = auth.uid()`. Once linkage is correct they will populate automatically.

---

## What might break / things to verify

1. **Stale records**: any existing `students` rows created before this change have `user_id = NULL`. Those students cannot see their data until admin re-opens the row and links it (covered by §3 above).
2. **Wrong link**: if admin links the wrong profile, the student will see another student's data. The optional partial unique index above prevents two students rows pointing at the same auth user, but does not prevent a wrong link — make link easy to undo.
3. **Email mismatch is fine**: `students.email` and `auth.users.email` don't have to match — linkage is by `user_id`, not email. The dropdown shows the profile email so admin can sanity-check.
4. **RLS on `profiles`**: `Admin/Head view all profiles` already exists, so the unlinked-accounts dropdown will populate for admin/head_staff.
5. **Role enum**: `student` is already in the `app_role` enum — no schema change.
6. **Realtime / cache**: after admission, invalidate both `["students"]` and `["unlinked-student-accounts"]` query keys.

---

## End-to-end test checklist

1. As a fresh email, register at `/auth` → land on `/app` with no roles, no data.
2. As admin, open **Users**, find that profile, tick **Student**, save.
3. As admin, open **Students → New admission**. Confirm the new profile appears in the "Linked account" dropdown.
4. Select it, fill program + admission date, save. Confirm the row appears with a "Linked" pill.
5. Sign out, sign back in as the student. Confirm:
   - Dashboard shows their name.
   - Assignments / Tests / Finance pages load without "no record" errors.
6. Re-open the student's row as admin → "Linked account" should be greyed/locked to the same profile.
7. Create a paper admission with "No linked account". Later open it and link it to a freshly-registered student → confirm the student now sees data.
8. (If hardening migration applied) try linking a second students row to the same auth user → expect a unique-violation error.

---

## Open question

Do you want me to also apply the **optional hardening migration** (partial unique index on `students.user_id` + tighter SELECT policy so plain students can't list other students)? It's safe with the current code but is a behavior change worth confirming.
