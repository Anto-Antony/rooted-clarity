-- Set search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

-- Revoke execute from public/authenticated on internal functions (they are only used by triggers/RLS)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
-- authenticated may still call has_role since RLS runs as authenticated; keep it