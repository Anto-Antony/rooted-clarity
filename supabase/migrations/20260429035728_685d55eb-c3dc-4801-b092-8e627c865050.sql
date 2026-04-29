
-- ============================================================
-- TIMETABLE
-- ============================================================
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period SMALLINT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, day_of_week, period)
);
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Head manage timetable" ON public.timetable_slots FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'));
CREATE TRIGGER trg_timetable_updated BEFORE UPDATE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STUDENT-CLASS ENROLLMENTS (needed for attendance, assignments)
-- ============================================================
CREATE TABLE public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view enrollments" ON public.class_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Head manage enrollments" ON public.class_enrollments FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'));

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view attendance" ON public.attendance_records FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff')
  OR has_role(auth.uid(),'regular_staff') OR has_role(auth.uid(),'guest_staff')
  OR EXISTS (SELECT 1 FROM students s WHERE s.id = attendance_records.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Staff manage attendance" ON public.attendance_records FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_attendance_class_date ON public.attendance_records(class_id, date);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);

-- ============================================================
-- LEAVES
-- ============================================================
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected');
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  requester_type TEXT NOT NULL CHECK (requester_type IN ('staff','student')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or admin leaves" ON public.leaves FOR SELECT TO authenticated USING (
  requester_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff')
);
CREATE POLICY "Insert own leave" ON public.leaves FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Admin/Head update leaves" ON public.leaves FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'));
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  due_date DATE NOT NULL,
  max_marks NUMERIC(6,2) NOT NULL DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view assignments" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage assignments" ON public.assignments FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'));
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  file_url TEXT,
  notes TEXT,
  marks NUMERIC(6,2),
  feedback TEXT,
  graded_by UUID,
  graded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff')
  OR EXISTS (SELECT 1 FROM students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Student submit own" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Student update own submission" ON public.assignment_submissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Staff grade submissions" ON public.assignment_submissions FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'));
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TESTS / RESULTS
-- ============================================================
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  title TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'unit',
  subject TEXT,
  test_date DATE NOT NULL,
  max_marks NUMERIC(6,2) NOT NULL DEFAULT 100,
  published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view tests" ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage tests" ON public.tests FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'));
CREATE TRIGGER trg_tests_updated BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  student_id UUID NOT NULL,
  marks NUMERIC(6,2),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View results" ON public.test_results FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff')
  OR (
    EXISTS (SELECT 1 FROM tests t WHERE t.id = test_results.test_id AND t.published = true)
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = test_results.student_id AND s.user_id = auth.uid())
  )
);
CREATE POLICY "Staff manage results" ON public.test_results FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff'));
CREATE TRIGGER trg_results_updated BEFORE UPDATE ON public.test_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FINANCE
-- ============================================================
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  program TEXT,
  amount NUMERIC(12,2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'one_time',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View fee structures" ON public.fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Accountant manage fees" ON public.fee_structures FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_fees_updated BEFORE UPDATE ON public.fee_structures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.invoice_status AS ENUM ('pending','partial','paid','overdue','cancelled');
CREATE TABLE public.fee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  fee_structure_id UUID,
  invoice_number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View invoices" ON public.fee_invoices FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant') OR has_role(auth.uid(),'head_staff')
  OR EXISTS (SELECT 1 FROM students s WHERE s.id = fee_invoices.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admin/Accountant manage invoices" ON public.fee_invoices FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.fee_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  proof_url TEXT,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View payments" ON public.payments FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant')
  OR EXISTS (
    SELECT 1 FROM fee_invoices i JOIN students s ON s.id = i.student_id
    WHERE i.id = payments.invoice_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "Admin/Accountant manage payments" ON public.payments FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant'));

-- Auto-update invoice on payment
CREATE OR REPLACE FUNCTION public.update_invoice_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  SELECT amount, amount_paid INTO inv FROM fee_invoices WHERE id = NEW.invoice_id;
  UPDATE fee_invoices
  SET amount_paid = inv.amount_paid + NEW.amount,
      status = CASE
        WHEN (inv.amount_paid + NEW.amount) >= amount THEN 'paid'::invoice_status
        WHEN (inv.amount_paid + NEW.amount) > 0 THEN 'partial'::invoice_status
        ELSE status
      END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payment_updates_invoice AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_on_payment();

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin/Head create notifications" ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff'));
CREATE INDEX idx_notif_user_read ON public.notifications(user_id, read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view audit" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('assignment-submissions','assignment-submissions',false),
  ('payment-proofs','payment-proofs',false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own submission files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own submission files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-submissions' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_staff') OR has_role(auth.uid(),'regular_staff')
));

CREATE POLICY "Users upload own payment proof" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read payment proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'accountant')
));

-- ============================================================
-- REALTIME for notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
