
-- 1) Audit logs: drop client INSERT policy entirely
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_logs;

-- 2) Students SELECT: role-scoped + own row only
DROP POLICY IF EXISTS "Authenticated view students" ON public.students;
CREATE POLICY "Staff view students"
ON public.students FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'head_staff'::app_role)
  OR has_role(auth.uid(), 'regular_staff'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);
CREATE POLICY "Students view own record"
ON public.students FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3) Staff SELECT: role-scoped + own row only
DROP POLICY IF EXISTS "Authenticated view staff" ON public.staff;
CREATE POLICY "Privileged roles view staff"
ON public.staff FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'head_staff'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);
CREATE POLICY "Staff view own record"
ON public.staff FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 4) Assignment submissions: students cannot UPDATE
DROP POLICY IF EXISTS "Student update own submission" ON public.assignment_submissions;

-- 5) Storage policies for assignment-submissions bucket (DELETE + UPDATE)
CREATE POLICY "Users delete own submission files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'head_staff'::app_role)
    OR has_role(auth.uid(), 'regular_staff'::app_role)
  )
);
CREATE POLICY "Users update own submission files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'head_staff'::app_role)
    OR has_role(auth.uid(), 'regular_staff'::app_role)
  )
);

-- 6) Storage policies for payment-proofs bucket (DELETE + UPDATE)
CREATE POLICY "Users delete own payment proof"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  )
);
CREATE POLICY "Users update own payment proof"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  )
);

-- 7) Convert has_role to SECURITY INVOKER (relies on user_roles SELECT policy for own rows)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$function$;

-- 8) Realtime: restrict channel subscriptions to postgres_changes extension only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated postgres_changes only" ON realtime.messages';
    EXECUTE $p$CREATE POLICY "Authenticated postgres_changes only"
      ON realtime.messages FOR SELECT TO authenticated
      USING (extension = 'postgres_changes')$p$;
  END IF;
END$$;
