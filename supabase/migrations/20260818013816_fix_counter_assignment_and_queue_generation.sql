/*
# Fix Counter Auto-Assignment and Queue Generation

## Problem
1. Employee ALLEYAH is assigned to counters 1, 2, AND 3 — should only own Counter 1.
   Counters 4-5 are unassigned. No auto-assignment logic exists.
2. generate_ticket pre-assigns a counter to the ticket and fails if no open counter exists.
   This blocks customers from joining the queue when counters are busy/closed/maintenance.
3. No function to auto-assign a counter when an employee logs in.

## Changes

### 1. ensure_employee_counter() function
- New SECURITY DEFINER function callable by authenticated users.
- Determines the employee's counter number based on creation order (1-5).
- First employee created → Counter 1, second → Counter 2, etc.
- If the counter doesn't exist, creates it.
- If the counter exists but has no employee_id (or wrong employee_id), assigns this employee.
- Fixes any counters that were wrongly assigned to this employee (removes their employee_id).
- Returns the counter record as JSON.

### 2. generate_ticket fix
- Removes the requirement for an open/available counter.
- Tickets are created with counter_id=NULL, counter_number=NULL.
- The counter is assigned later when an employee calls the next customer via call_next_customer.
- This means customers can ALWAYS join the queue regardless of counter status.
- Position and estimated_wait are still calculated correctly.

### 3. Data fix
- Removes wrong employee_id assignments from counters 2 and 3 (they belong to employee 1).
- Ensures counter 1 is assigned to the first employee.

### 4. RLS
- Grants EXECUTE on ensure_employee_counter to authenticated.
- No other RLS changes needed.

## Notes
- No data is deleted — only counter employee_id values are corrected.
- Existing queue tickets are preserved.
- Customer-facing generate_ticket remains callable by anon.
*/

-- ============================================================
-- 1. Create ensure_employee_counter function
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_employee_counter()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee RECORD;
  v_counter_number int;
  v_counter RECORD;
  v_employee_count int;
BEGIN
  -- Get the current authenticated employee
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- Determine this employee's counter number based on creation order
  SELECT COUNT(*) + 1 INTO v_counter_number
  FROM employees
  WHERE created_at < v_employee.created_at
     OR (created_at = v_employee.created_at AND id < v_employee.id);

  -- Clamp to 1-5
  IF v_counter_number > 5 THEN
    v_counter_number := 5;
  END IF;

  -- Remove this employee's ID from any counters they don't own
  UPDATE counters
  SET employee_id = NULL
  WHERE employee_id = v_employee.id
    AND counter_number != v_counter_number;

  -- Check if the target counter exists
  SELECT * INTO v_counter FROM counters WHERE counter_number = v_counter_number;

  IF NOT FOUND THEN
    -- Counter doesn't exist — create it
    INSERT INTO counters (counter_number, name, status, daily_capacity, current_daily_count, employee_id)
    VALUES (v_counter_number, 'Counter ' || v_counter_number, 'open', 20, 0, v_employee.id)
    RETURNING * INTO v_counter;
  ELSE
    -- Counter exists — assign this employee to it (overwrite any wrong assignment)
    UPDATE counters
    SET employee_id = v_employee.id
    WHERE id = v_counter.id
    RETURNING * INTO v_counter;
  END IF;

  RETURN json_build_object(
    'success', true,
    'counter', row_to_json(v_counter)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_employee_counter() TO authenticated;

-- ============================================================
-- 2. Fix generate_ticket: remove counter requirement
-- ============================================================
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
  -- Validate queue type
  IF p_queue_type NOT IN ('regular', 'priority') THEN
    RETURN json_build_object('error', 'Invalid queue type');
  END IF;

  -- Priority category is optional
  IF p_priority_category IS NOT NULL AND p_priority_category NOT IN ('senior_citizen', 'pwd', 'pregnant') THEN
    RETURN json_build_object('error', 'Invalid priority category');
  END IF;

  -- Generate ticket number
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

  -- Calculate position in the appropriate lane
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

  -- Get average service time from settings
  SELECT CAST(value AS int) INTO v_avg_service_time
  FROM settings WHERE key = 'average_service_time_minutes';
  IF v_avg_service_time IS NULL THEN
    v_avg_service_time := 5;
  END IF;

  v_estimated_wait := (v_position - 1) * v_avg_service_time;

  -- Generate ownership token
  v_ownership_token := encode(gen_random_bytes(32), 'hex');

  -- Insert the ticket — NO counter pre-assignment
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

-- Keep generate_ticket callable by anon (public customer portal)
GRANT EXECUTE ON FUNCTION public.generate_ticket(text, text, text, text, uuid, text) TO anon, authenticated;

-- ============================================================
-- 3. Data fix: correct counter assignments
-- ============================================================

-- Get the first employee's ID
DO $$
DECLARE
  v_first_employee_id uuid;
BEGIN
  SELECT id INTO v_first_employee_id
  FROM employees
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_first_employee_id IS NOT NULL THEN
    -- Remove this employee from counters 2 and 3
    UPDATE counters SET employee_id = NULL
    WHERE employee_id = v_first_employee_id AND counter_number != 1;

    -- Assign this employee to counter 1
    UPDATE counters SET employee_id = v_first_employee_id
    WHERE counter_number = 1;
  END IF;
END $$;
