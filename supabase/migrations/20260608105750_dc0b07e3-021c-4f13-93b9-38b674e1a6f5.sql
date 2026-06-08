
-- =========================================================
-- Period-wise attendance: schema, RLS, functions, views
-- =========================================================

-- ---------- attendance_sessions ----------
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  period smallint NOT NULL,
  subject text NOT NULL,
  teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  start_time time,
  end_time time,
  slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','marked','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, date, period)
);
CREATE INDEX idx_att_sessions_date ON public.attendance_sessions(date);
CREATE INDEX idx_att_sessions_class_date ON public.attendance_sessions(class_id, date);
CREATE INDEX idx_att_sessions_teacher_date ON public.attendance_sessions(teacher_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and students view sessions"
ON public.attendance_sessions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'head_staff')
  OR public.has_role(auth.uid(),'regular_staff')
  OR public.has_role(auth.uid(),'guest_staff')
  OR public.has_role(auth.uid(),'accountant')
  OR EXISTS (
    SELECT 1 FROM public.class_enrollments ce
    JOIN public.students s ON s.id = ce.student_id
    WHERE ce.class_id = attendance_sessions.class_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Admin/Head manage sessions"
ON public.attendance_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'));

CREATE POLICY "Assigned teacher updates own session"
ON public.attendance_sessions FOR UPDATE TO authenticated
USING (
  teacher_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.staff st WHERE st.id = attendance_sessions.teacher_id AND st.user_id = auth.uid())
)
WITH CHECK (
  teacher_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.staff st WHERE st.id = attendance_sessions.teacher_id AND st.user_id = auth.uid())
);

CREATE TRIGGER trg_att_sessions_updated
BEFORE UPDATE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- period_attendance_records ----------
CREATE TABLE public.period_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by uuid,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX idx_par_student ON public.period_attendance_records(student_id);
CREATE INDEX idx_par_session ON public.period_attendance_records(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_attendance_records TO authenticated;
GRANT ALL ON public.period_attendance_records TO service_role;
ALTER TABLE public.period_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View period records"
ON public.period_attendance_records FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'head_staff')
  OR public.has_role(auth.uid(),'regular_staff')
  OR public.has_role(auth.uid(),'guest_staff')
  OR public.has_role(auth.uid(),'accountant')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = period_attendance_records.student_id AND s.user_id = auth.uid())
);

CREATE POLICY "Admin/Head manage period records"
ON public.period_attendance_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'));

CREATE POLICY "Assigned teacher marks own session"
ON public.period_attendance_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions sess
    JOIN public.staff st ON st.id = sess.teacher_id
    WHERE sess.id = period_attendance_records.session_id AND st.user_id = auth.uid()
  )
);

CREATE POLICY "Assigned teacher updates own session records"
ON public.period_attendance_records FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions sess
    JOIN public.staff st ON st.id = sess.teacher_id
    WHERE sess.id = period_attendance_records.session_id AND st.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions sess
    JOIN public.staff st ON st.id = sess.teacher_id
    WHERE sess.id = period_attendance_records.session_id AND st.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_par_updated
BEFORE UPDATE ON public.period_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- academic_calendar_days ----------
CREATE TABLE public.academic_calendar_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('holiday','closure','exam','special_working')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_acd_date_class_kind
  ON public.academic_calendar_days (date, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);
CREATE INDEX idx_acd_date ON public.academic_calendar_days(date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar_days TO authenticated;
GRANT ALL ON public.academic_calendar_days TO service_role;
ALTER TABLE public.academic_calendar_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view calendar"
ON public.academic_calendar_days FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Head manage calendar"
ON public.academic_calendar_days FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff'));

CREATE TRIGGER trg_acd_updated
BEFORE UPDATE ON public.academic_calendar_days
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- is_working_day ----------
CREATE OR REPLACE FUNCTION public.is_working_day(_date date, _class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind
  FROM public.academic_calendar_days
  WHERE date = _date
    AND (class_id = _class_id OR class_id IS NULL)
  ORDER BY (class_id = _class_id) DESC NULLS LAST
  LIMIT 1;

  IF v_kind = 'holiday' THEN
    RETURN jsonb_build_object('working', false, 'reason', 'holiday');
  ELSIF v_kind = 'closure' THEN
    RETURN jsonb_build_object('working', false, 'reason', 'closure');
  ELSIF v_kind = 'special_working' THEN
    RETURN jsonb_build_object('working', true, 'reason', 'special_working');
  ELSIF v_kind = 'exam' THEN
    RETURN jsonb_build_object('working', true, 'reason', 'exam_day');
  END IF;

  IF EXTRACT(DOW FROM _date) = 0 THEN
    RETURN jsonb_build_object('working', false, 'reason', 'sunday');
  END IF;

  RETURN jsonb_build_object('working', true, 'reason', 'weekday');
END;
$$;


-- ---------- generate_attendance_sessions ----------
CREATE OR REPLACE FUNCTION public.generate_attendance_sessions(_class_id uuid, _from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  inserted_count integer := 0;
  ins integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'head_staff')
       OR public.has_role(auth.uid(),'regular_staff')
       OR public.has_role(auth.uid(),'guest_staff')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  d := _from;
  WHILE d <= _to LOOP
    IF (public.is_working_day(d, _class_id)->>'working')::boolean THEN
      WITH ins_rows AS (
        INSERT INTO public.attendance_sessions
          (class_id, date, period, subject, teacher_id, start_time, end_time, slot_id)
        SELECT ts.class_id, d, ts.period, ts.subject, ts.teacher_id, ts.start_time, ts.end_time, ts.id
        FROM public.timetable_slots ts
        WHERE ts.class_id = _class_id
          AND ts.day_of_week = EXTRACT(DOW FROM d)::int
        ON CONFLICT (class_id, date, period) DO NOTHING
        RETURNING 1
      )
      SELECT count(*) INTO ins FROM ins_rows;
      inserted_count := inserted_count + COALESCE(ins, 0);
    END IF;
    d := d + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;


-- ---------- resync_future_sessions ----------
CREATE OR REPLACE FUNCTION public.resync_future_sessions(_slot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.timetable_slots%ROWTYPE;
  v_count integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_slot FROM public.timetable_slots WHERE id = _slot_id;
  IF NOT FOUND THEN
    -- slot deleted: remove future scheduled sessions for this slot
    DELETE FROM public.attendance_sessions
    WHERE slot_id = _slot_id
      AND date >= CURRENT_DATE
      AND status = 'scheduled';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
  END IF;

  UPDATE public.attendance_sessions
  SET subject = v_slot.subject,
      teacher_id = v_slot.teacher_id,
      start_time = v_slot.start_time,
      end_time = v_slot.end_time
  WHERE slot_id = _slot_id
    AND date >= CURRENT_DATE
    AND status = 'scheduled';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------- Reporting views ----------
CREATE OR REPLACE VIEW public.v_student_subject_attendance AS
SELECT r.student_id,
       s.subject,
       count(*) FILTER (WHERE r.status IN ('present','late','excused')) AS attended,
       count(*) AS conducted,
       ROUND(100.0 * count(*) FILTER (WHERE r.status IN ('present','late','excused'))
             / NULLIF(count(*),0), 2) AS pct
FROM public.period_attendance_records r
JOIN public.attendance_sessions s ON s.id = r.session_id
GROUP BY r.student_id, s.subject;

CREATE OR REPLACE VIEW public.v_student_daily_attendance AS
SELECT r.student_id,
       s.date,
       count(*) FILTER (WHERE r.status IN ('present','late','excused')) AS attended,
       count(*) AS conducted,
       ROUND(100.0 * count(*) FILTER (WHERE r.status IN ('present','late','excused'))
             / NULLIF(count(*),0), 2) AS pct
FROM public.period_attendance_records r
JOIN public.attendance_sessions s ON s.id = r.session_id
GROUP BY r.student_id, s.date;

CREATE OR REPLACE VIEW public.v_student_overall_attendance AS
SELECT r.student_id,
       count(*) FILTER (WHERE r.status IN ('present','late','excused')) AS attended,
       count(*) AS conducted,
       ROUND(100.0 * count(*) FILTER (WHERE r.status IN ('present','late','excused'))
             / NULLIF(count(*),0), 2) AS pct
FROM public.period_attendance_records r
GROUP BY r.student_id;

GRANT SELECT ON public.v_student_subject_attendance TO authenticated;
GRANT SELECT ON public.v_student_daily_attendance TO authenticated;
GRANT SELECT ON public.v_student_overall_attendance TO authenticated;
