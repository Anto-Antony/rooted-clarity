# Auth Enhancement Plan

Extend the existing `/auth` page with email verification enforcement, forgot/reset password flows, and supporting pages. Reuse existing shadcn UI, `useAuth`, and Supabase client.

## 1. Supabase configuration

- Call `configure_auth` with `auto_confirm_email: false`, `password_hibp_enabled: true`, `disable_signup: false`, `external_anonymous_users_enabled: false` so signups require email confirmation and weak/leaked passwords are blocked.
- Keep Site URL / redirect URLs as-is (Lovable manages). All `emailRedirectTo` / `redirectTo` values use `${window.location.origin}/...` so they work in dev, preview, and production.
- Use Lovable's default auth emails (no custom templates scaffolded unless user asks later).

## 2. New routes (public, in `src/App.tsx`)

```
/auth                       (existing — Sign in / Sign up tabs + "Forgot password?" link)
/auth/verify-email          New — "check your inbox" pending screen + resend button
/auth/forgot-password       New — request password reset email
/auth/reset-password        New — set new password (handles recovery token from URL hash)
/auth/callback              New — handles email verification redirect, then routes to /app or /auth
```

All under the public area (outside `RequireAuth`).

## 3. New / changed files

**New pages** (`src/pages/auth/`):
- `VerifyEmail.tsx` — reads `email` from `location.state` or query, shows pending UI, "Resend verification email" button with 60s cooldown (localStorage-backed so refresh preserves it), success/error toasts via `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: \`${origin}/auth/callback\` } })`.
- `ForgotPassword.tsx` — single email field, zod validation, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/reset-password\` })`. Always shows the same success message (don't leak whether email exists). Cooldown on resend.
- `ResetPassword.tsx` — on mount, detects `type=recovery` access token in URL hash (Supabase auto-creates a session). If no recovery session, shows "Link invalid or expired" with link back to forgot-password. Otherwise shows new password + confirm fields (zod: min 8, must match, basic strength hint), calls `supabase.auth.updateUser({ password })`, then signs out and redirects to `/auth` with success toast — or routes to `/auth/reset-success`.
- `ResetSuccess.tsx` — confirmation screen with "Continue to sign in" button.
- `AuthCallback.tsx` — handles `?type=signup` / email confirmation redirect: waits for session, if `user.email_confirmed_at` present → toast success → `/app`; else → `/auth`.

**New shared component**:
- `src/components/auth/AuthCard.tsx` — extracts the header (logo + title + subtitle) + card wrapper currently in `Auth.tsx` so all five pages share consistent styling.

**New hook**:
- `src/hooks/useCooldown.ts` — `useCooldown(key, seconds)` returns `{ remaining, start }`, persists `expiresAt` in localStorage keyed by `key` so cooldown survives reload.

**Edits**:
- `src/pages/Auth.tsx`
  - After successful `signUp`, instead of toast "you're signed in", navigate to `/auth/verify-email` with `state: { email }`. Pass `emailRedirectTo: \`${origin}/auth/callback\`` (already mostly present — change target to `/auth/callback`).
  - Detect "Email not confirmed" sign-in error and route to `/auth/verify-email` with that email so user can resend.
  - Add a "Forgot password?" link under the password field on the Sign in tab → `/auth/forgot-password`.
- `src/components/auth/RequireAuth.tsx`
  - After the `user` check, also check `user.email_confirmed_at`. If missing → `Navigate` to `/auth/verify-email` with `state: { email: user.email }`. This is the verified-user route guard.
- `src/App.tsx` — register the 5 new routes; keep them outside `RequireAuth`.

## 4. Validation & UX

- All forms use existing zod schemas pattern from `Auth.tsx` (email max 255, password min 8 + max 72). Reset password form additionally requires `confirm === password`.
- Loading states: disabled buttons + "Sending…" / "Resetting…" labels (matches existing convention).
- Toasts: success/error via `sonner` (already used).
- Error mapping: "User already registered" → "Account exists — sign in or reset password"; "Email not confirmed" → route to verify; "Invalid login credentials" → existing handling; rate-limit/network errors → generic friendly toast.
- Cooldown defaults: 60s for resend verification and resend reset email.
- Mobile-responsive: same `max-w-md` card pattern; works at all viewport sizes.
- Accessibility: proper labels, `autoComplete` (`new-password`, `current-password`, `email`), focus management on navigation.

## 5. Security notes

- No tokens read from query strings manually — Supabase SDK handles hash fragments for both signup confirmation and recovery, which is the secure path. We only branch on session presence + `user.email_confirmed_at`.
- Forgot password response is identical whether the email exists or not (prevents enumeration).
- Password validation aligned with HIBP check enabled server-side.
- Public anon key remains in `.env` (this is correct/expected for Supabase).

## 6. Out of scope (unless you say otherwise)

- Custom-branded auth email templates (Lovable default emails will be used).
- Google / social sign-in.
- MFA / phone OTP.
- Changing the existing role-gated app routes.

## Files changed (summary)

```
src/App.tsx                                  edit  (5 new routes)
src/pages/Auth.tsx                           edit  (forgot link, post-signup redirect, unconfirmed handling)
src/components/auth/RequireAuth.tsx          edit  (email_confirmed_at guard)
src/components/auth/AuthCard.tsx             new   (shared header/card)
src/hooks/useCooldown.ts                     new
src/pages/auth/VerifyEmail.tsx               new
src/pages/auth/ForgotPassword.tsx            new
src/pages/auth/ResetPassword.tsx             new
src/pages/auth/ResetSuccess.tsx              new
src/pages/auth/AuthCallback.tsx              new
```

Plus one `configure_auth` call (no migration needed).
