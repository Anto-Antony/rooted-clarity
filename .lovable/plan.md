## Plan: Restrict Payroll Visibility and CRUD to Correct Roles

### A) Hide Payroll from student navigation
**File:** `src/components/layout/AppShell.tsx`

- Update the Payroll `NavItem` roles array to remove `student`.
- Current: `["admin", "accountant", "head_staff", "regular_staff", "guest_staff"]`
- Change to: `["admin", "accountant", "head_staff", "regular_staff", "guest_staff"]` (student was never in this list, but verify no other code leaks it)

Actually reading the code: Payroll nav already does NOT include `student`. The `Finance` nav includes `student`. So Payroll is already hidden from students in the sidebar. **No change needed for A** — but confirm with test.

Wait, re-reading line 56 of AppShell.tsx:
```
{ label: "Payroll", to: "/app/payroll", icon: Wallet, roles: ["admin", "accountant", "head_staff", "regular_staff", "guest_staff"] },
```
Student is not in the list. So students already cannot see Payroll in the nav. However, they could still access `/app/payroll` if they know the URL because the route in `App.tsx` does not block them. 

So the real fix for A is: **Add `student` role exclusion at the route level in `App.tsx`** if the intent is to completely prevent student access. OR if the intent is just sidebar hiding, it already works.

Given the user's wording "student there shuldnt be a payroll option hide it", the sidebar already achieves this. But to be safe, I recommend also blocking the route.

### B) Restrict CRUD management to admin + accountant only
**File:** `src/pages/Payroll.tsx`

- Change `isManager` from:
  ```ts
  const isManager = hasAnyRole(roles, ["admin", "accountant", "head_staff"]);
  ```
  to:
  ```ts
  const isManager = hasAnyRole(roles, ["admin", "accountant"]);
  ```

- Effect:
  - `admin`, `accountant`: manager view (all invoices, extra Staff column)
  - `head_staff`, `regular_staff`, `guest_staff`: self-service view (own invoices only, no Staff column)
  - The self-service logic (`myStaff` lookup + `eq("staff_id", myStaff.id)`) remains unchanged and works for all non-manager staff.

### C) Align route access (optional but recommended)
**File:** `src/App.tsx`

- Keep current route access: `["admin", "accountant", "head_staff", "regular_staff", "guest_staff"]` — head_staff should still be able to view payroll, just not manage it. The page-level `isManager` flag correctly downgrades them to read-only.
- If strict route-level blocking of head_staff is desired, change the route roles. But per user requirements, leave it as-is.

### Files to edit
1. `src/pages/Payroll.tsx` — change `isManager` to `admin | accountant` only.
2. `src/App.tsx` — optionally add `student` exclusion if route-level blocking is desired; otherwise no change.

### Testing checklist
- [ ] Student login: no "Payroll" in left navigation, and `/app/payroll` route is inaccessible (or at least not visible).
- [ ] Regular/Guest staff login: can open Payroll, sees only own invoices, no Staff column.
- [ ] Head Staff login: can open Payroll, sees only own invoices (read-only), no Staff column.
- [ ] Admin/Accountant login: can open Payroll, sees all invoices, Staff column visible.
- [ ] Project builds with zero TypeScript errors.