-- Enums
DO $$ BEGIN
  CREATE TYPE public.payroll_type AS ENUM ('daily','weekly','monthly','one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('draft','issued','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payroll_invoices
CREATE TABLE public.payroll_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE DEFAULT ('PAY-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  payroll_type public.payroll_type NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions numeric DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_invoices_staff ON public.payroll_invoices(staff_id);

ALTER TABLE public.payroll_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own payroll or admin"
  ON public.payroll_invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = payroll_invoices.staff_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Admin/Accountant/Head manage payroll"
  ON public.payroll_invoices FOR ALL
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
  );

CREATE TRIGGER trg_payroll_invoices_updated_at
  BEFORE UPDATE ON public.payroll_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- payroll_payments
CREATE TABLE public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_invoice_id uuid NOT NULL REFERENCES public.payroll_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_payments_invoice ON public.payroll_payments(payroll_invoice_id);

ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own payroll payments or admin"
  ON public.payroll_payments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
    OR EXISTS (
      SELECT 1 FROM public.payroll_invoices pi
      JOIN public.staff s ON s.id = pi.staff_id
      WHERE pi.id = payroll_payments.payroll_invoice_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin/Accountant/Head manage payroll payments"
  ON public.payroll_payments FOR ALL
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'accountant')
    OR public.has_role(auth.uid(),'head_staff')
  );