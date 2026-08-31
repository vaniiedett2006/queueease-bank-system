/*
# Fix generate_ticket token generation

## Problem
generate_ticket uses gen_random_bytes(32) which is not available in this Supabase instance.

## Fix
Replace gen_random_bytes with gen_random_uuid() based token generation.
*/

CREATE OR REPLACE FUNCTION public.generate_ticket(
  p_customer_name text,
  p_customer_email text DEFAULT NULL,
  p_queue_type text DEFAULT 'regular',
  p_priority_category text DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_service_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket_number text;
  v_prefix text;
  v_max_num int;
  v_position int;
  v_estimated_wait int;
  v_avg_service_time int;
  v_ownership_token text;
  v_today date := CURRENT_DATE;
  v_waiting_count int;
  v_priority_waiting_count int;
BEGIN
  IF p_queue_type NOT IN ('regular', 'priority') THEN
    RETURN json_build_object('error', 'Invalid queue type');
  END IF;

  IF p_priority_category IS NOT NULL AND p_priority_category NOT IN ('senior_citizen', 'pwd', 'pregnant') THEN
    RETURN json_build_object('error', 'Invalid priority category');
  END IF;

  v_prefix := CASE WHEN p_queue_type = 'priority' THEN 'P' ELSE 'A' END;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 2) AS int)
  ), 0)
  INTO v_max_num
  FROM queues
  WHERE queue_type = p_queue_type
  AND DATE(registered_at) = v_today
  AND status IN ('waiting', 'serving', 'recalled');

  v_ticket_number := v_prefix || LPAD(CAST(v_max_num + 1 AS text), 3, '0');

  SELECT COUNT(*) INTO v_waiting_count
  FROM queues
  WHERE status IN ('waiting', 'serving', 'recalled')
  AND DATE(registered_at) = v_today;

  SELECT COUNT(*) INTO v_priority_waiting_count
  FROM queues
  WHERE queue_type = 'priority'
  AND status IN ('waiting', 'serving', 'recalled')
  AND DATE(registered_at) = v_today;

  IF p_queue_type = 'priority' THEN
    v_position := v_priority_waiting_count + 1;
  ELSE
    v_position := (v_waiting_count - v_priority_waiting_count) + 1;
  END IF;

  SELECT CAST(value AS int) INTO v_avg_service_time
  FROM settings WHERE key = 'average_service_time_minutes';
  IF v_avg_service_time IS NULL THEN
    v_avg_service_time := 5;
  END IF;

  v_estimated_wait := (v_position - 1) * v_avg_service_time;

  v_ownership_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO queues (
    ticket_number, customer_name, customer_email, queue_type,
    priority_category, service_id, service_name,
    counter_id, counter_number, status, ownership_token,
    position, estimated_wait_minutes
  ) VALUES (
    v_ticket_number, p_customer_name, p_customer_email, p_queue_type,
    p_priority_category, p_service_id, p_service_name,
    NULL, NULL, 'waiting', v_ownership_token,
    v_position, v_estimated_wait
  );

  RETURN json_build_object(
    'success', true,
    'ticket_number', v_ticket_number,
    'ownership_token', v_ownership_token,
    'position', v_position,
    'estimated_wait', v_estimated_wait
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_ticket(text, text, text, text, uuid, text) TO anon, authenticated;
