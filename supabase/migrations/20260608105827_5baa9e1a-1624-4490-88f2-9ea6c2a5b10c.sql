
ALTER VIEW public.v_student_subject_attendance SET (security_invoker = on);
ALTER VIEW public.v_student_daily_attendance SET (security_invoker = on);
ALTER VIEW public.v_student_overall_attendance SET (security_invoker = on);

-- is_working_day reads only tables readable by authenticated; use INVOKER
CREATE OR REPLACE FUNCTION public.is_working_day(_date date, _class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_kind text;
BEGIN
  SELECT kind INTO v_kind
  FROM public.academic_calendar_days
  WHERE date = _date AND (class_id = _class_id OR class_id IS NULL)
  ORDER BY (class_id = _class_id) DESC NULLS LAST
  LIMIT 1;
  IF v_kind = 'holiday' THEN RETURN jsonb_build_object('working',false,'reason','holiday');
  ELSIF v_kind = 'closure' THEN RETURN jsonb_build_object('working',false,'reason','closure');
  ELSIF v_kind = 'special_working' THEN RETURN jsonb_build_object('working',true,'reason','special_working');
  ELSIF v_kind = 'exam' THEN RETURN jsonb_build_object('working',true,'reason','exam_day');
  END IF;
  IF EXTRACT(DOW FROM _date) = 0 THEN RETURN jsonb_build_object('working',false,'reason','sunday'); END IF;
  RETURN jsonb_build_object('working',true,'reason','weekday');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_attendance_sessions(_class_id uuid, _from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE d date; inserted_count integer := 0; ins integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'head_staff')
       OR public.has_role(auth.uid(),'regular_staff')
       OR public.has_role(auth.uid(),'guest_staff')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  d := _from;
  WHILE d <= _to LOOP
    IF (public.is_working_day(d,_class_id)->>'working')::boolean THEN
      WITH ins_rows AS (
        INSERT INTO public.attendance_sessions
          (class_id,date,period,subject,teacher_id,start_time,end_time,slot_id)
        SELECT ts.class_id,d,ts.period,ts.subject,ts.teacher_id,ts.start_time,ts.end_time,ts.id
        FROM public.timetable_slots ts
        WHERE ts.class_id = _class_id AND ts.day_of_week = EXTRACT(DOW FROM d)::int
        ON CONFLICT (class_id,date,period) DO NOTHING
        RETURNING 1
      )
      SELECT count(*) INTO ins FROM ins_rows;
      inserted_count := inserted_count + COALESCE(ins,0);
    END IF;
    d := d + 1;
  END LOOP;
  RETURN inserted_count;
END; $$;

CREATE OR REPLACE FUNCTION public.resync_future_sessions(_slot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_slot public.timetable_slots%ROWTYPE; v_count integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_staff')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_slot FROM public.timetable_slots WHERE id = _slot_id;
  IF NOT FOUND THEN
    DELETE FROM public.attendance_sessions
    WHERE slot_id = _slot_id AND date >= CURRENT_DATE AND status = 'scheduled';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
  END IF;
  UPDATE public.attendance_sessions
  SET subject=v_slot.subject, teacher_id=v_slot.teacher_id,
      start_time=v_slot.start_time, end_time=v_slot.end_time
  WHERE slot_id=_slot_id AND date >= CURRENT_DATE AND status='scheduled';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.generate_attendance_sessions(uuid,date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resync_future_sessions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_working_day(date,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_attendance_sessions(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resync_future_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_working_day(date,uuid) TO authenticated;
