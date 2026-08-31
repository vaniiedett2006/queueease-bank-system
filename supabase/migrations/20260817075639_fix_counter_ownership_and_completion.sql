/*
# Fix counter ownership enforcement and queue completion logic

## Changes

### 1. Employee-specific counter enforcement
- `call_next_customer` now verifies the calling employee is assigned to the counter they are operating.
- `complete_customer` now verifies the calling employee is assigned to the counter.
- `skip_customer` now verifies the calling employee is assigned to the counter.
- `recall_customer` now verifies the calling employee is assigned to the counter.
- Employees can no longer call/complete/skip/recall tickets on counters they do not own.

### 2. Complete customer fix
- `complete_customer` now derives the counter from the ticket's counter_id/counter_number rather than trusting the client-supplied p_counter_number.
- This ensures the correct counter is freed and the count is updated accurately.
- The ticket's counter_number is set from the actual counter record, not the client.

### 3. Counter count fix
- `complete_customer` increments current_daily_count on the correct counter (from the ticket).
- Counter is set to 'open' and current_ticket_id cleared immediately.

### 4. Estimated wait uses average_service_time setting
- `get_queue_position` already reads `average_service_time_minutes` from settings.
- No change needed here, but confirmed it dynamically reads the setting.

### 5. Counter RLS tightened
- Revoke UPDATE from anon on counters table (only authenticated employees should update).
- Add counter-specific UPDATE policy: employees can only update their own assigned counter.
- Revoke DELETE and INSERT from anon on counters.

### Security
- All employee functions now check counter ownership via employee_id on the counters table.
- Counter status changes restricted to the assigned employee.
*/

-- ============================================================
-- 1. Update call_next_customer to enforce counter ownership
-- ============================================================
CREATE OR REPLACE FUNCTION public.call_next_customer(p_counter_number integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket RECORD;
  v_employee RECORD;
  v_counter RECORD;
  v_no_show_timeout int;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_counter FROM counters WHERE counter_number = p_counter_number;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Counter not found');
  END IF;

  -- Enforce: employee must be assigned to this counter
  IF v_counter.employee_id IS NULL OR v_counter.employee_id != v_employee.id THEN
    RETURN json_build_object('error', 'You are not assigned to this counter');
  END IF;

  IF v_counter.current_daily_count >= v_counter.daily_capacity THEN
    RETURN json_build_object('error', 'Counter has reached daily capacity');
  END IF;

  -- Priority-first: try priority queue first
  SELECT * INTO v_ticket
  FROM queues
  WHERE status = 'waiting'
    AND queue_type = 'priority'
    AND DATE(registered_at) = CURRENT_DATE
  ORDER BY registered_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_ticket
    FROM queues
    WHERE status = 'waiting'
      AND queue_type = 'regular'
      AND DATE(registered_at) = CURRENT_DATE
    ORDER BY registered_at ASC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No customers waiting');
  END IF;

  SELECT CAST(value AS int) INTO v_no_show_timeout
  FROM settings WHERE key = 'no_show_timeout_minutes';
  IF v_no_show_timeout IS NULL THEN v_no_show_timeout := 2; END IF;

  UPDATE queues SET
    status = 'serving',
    called_at = now(),
    counter_id = v_counter.id,
    counter_number = v_counter.counter_number,
    no_show_deadline = now() + (v_no_show_timeout || ' minutes')::interval
  WHERE id = v_ticket.id;

  UPDATE counters SET
    status = 'busy',
    current_ticket_id = v_ticket.id
  WHERE id = v_counter.id;

  INSERT INTO activity_logs (employee_id, employee_name, action, ticket_number, counter_number, details)
  VALUES (v_employee.id, v_employee.full_name, 'call_next', v_ticket.ticket_number, v_counter.counter_number,
    'Called ' || v_ticket.ticket_number || ' to Counter ' || v_counter.counter_number);

  SELECT * INTO v_ticket FROM queues WHERE id = v_ticket.id;

  RETURN json_build_object('success', true, 'ticket', v_ticket);
END;
$function$;

-- ============================================================
-- 2. Update complete_customer to derive counter from ticket
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_customer(p_ticket_id uuid, p_counter_number integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket RECORD;
  v_employee RECORD;
  v_counter RECORD;
  v_wait_minutes int;
  v_serve_minutes int;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_ticket FROM queues WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('serving', 'recalled') THEN
    RETURN json_build_object('error', 'Ticket is not being served');
  END IF;

  -- Derive counter from the ticket, not the client
  IF v_ticket.counter_id IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE id = v_ticket.counter_id;
  ELSIF v_ticket.counter_number IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE counter_number = v_ticket.counter_number;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Counter not found for this ticket');
  END IF;

  -- Enforce: employee must be assigned to this counter
  IF v_counter.employee_id IS NULL OR v_counter.employee_id != v_employee.id THEN
    RETURN json_build_object('error', 'You are not assigned to this counter');
  END IF;

  v_wait_minutes := CASE
    WHEN v_ticket.called_at IS NOT NULL AND v_ticket.registered_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (v_ticket.called_at - v_ticket.registered_at))::int / 60
    ELSE 0
  END;

  v_serve_minutes := CASE
    WHEN v_ticket.called_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (now() - v_ticket.called_at))::int / 60
    ELSE 0
  END;

  INSERT INTO queue_history (
    ticket_number, customer_name, customer_email, queue_type,
    priority_category, service_id, service_name,
    counter_id, counter_number, status, employee_id, employee_name,
    registered_at, called_at, served_at, completed_at,
    wait_minutes, serve_minutes
  ) VALUES (
    v_ticket.ticket_number, v_ticket.customer_name, v_ticket.customer_email,
    v_ticket.queue_type, v_ticket.priority_category,
    v_ticket.service_id, v_ticket.service_name,
    v_ticket.counter_id, v_ticket.counter_number, 'served',
    v_employee.id, v_employee.full_name,
    v_ticket.registered_at, v_ticket.called_at, now(), now(),
    v_wait_minutes, v_serve_minutes
  );

  -- Mark ticket as served immediately
  UPDATE queues SET
    status = 'served',
    served_at = now(),
    no_show_deadline = NULL
  WHERE id = p_ticket_id;

  -- Free the counter immediately
  UPDATE counters SET
    status = 'open',
    current_ticket_id = NULL,
    current_daily_count = current_daily_count + 1
  WHERE id = v_counter.id;

  INSERT INTO activity_logs (employee_id, employee_name, action, ticket_number, counter_number, details)
  VALUES (v_employee.id, v_employee.full_name, 'complete', v_ticket.ticket_number, v_counter.counter_number,
    'Completed ' || v_ticket.ticket_number);

  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================
-- 3. Update skip_customer to enforce counter ownership
-- ============================================================
CREATE OR REPLACE FUNCTION public.skip_customer(p_ticket_id uuid, p_counter_number integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket RECORD;
  v_employee RECORD;
  v_counter RECORD;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_ticket FROM queues WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('serving', 'recalled') THEN
    RETURN json_build_object('error', 'Ticket is not being served');
  END IF;

  -- Derive counter from ticket
  IF v_ticket.counter_id IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE id = v_ticket.counter_id;
  ELSIF v_ticket.counter_number IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE counter_number = v_ticket.counter_number;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Counter not found');
  END IF;

  -- Enforce ownership
  IF v_counter.employee_id IS NULL OR v_counter.employee_id != v_employee.id THEN
    RETURN json_build_object('error', 'You are not assigned to this counter');
  END IF;

  UPDATE queues SET
    status = 'skipped',
    skipped_at = now(),
    no_show_deadline = NULL
  WHERE id = p_ticket_id;

  UPDATE counters SET
    status = 'open',
    current_ticket_id = NULL
  WHERE id = v_counter.id;

  INSERT INTO activity_logs (employee_id, employee_name, action, ticket_number, counter_number, details)
  VALUES (v_employee.id, v_employee.full_name, 'skip', v_ticket.ticket_number, v_counter.counter_number,
    'Skipped ' || v_ticket.ticket_number);

  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================
-- 4. Update recall_customer to enforce counter ownership
-- ============================================================
CREATE OR REPLACE FUNCTION public.recall_customer(p_ticket_id uuid, p_counter_number integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket RECORD;
  v_employee RECORD;
  v_counter RECORD;
  v_no_show_timeout int;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_ticket FROM queues WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('skipped', 'waiting') THEN
    RETURN json_build_object('error', 'Only skipped or waiting tickets can be recalled');
  END IF;

  -- Derive counter from ticket
  IF v_ticket.counter_id IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE id = v_ticket.counter_id;
  ELSIF v_ticket.counter_number IS NOT NULL THEN
    SELECT * INTO v_counter FROM counters WHERE counter_number = v_ticket.counter_number;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Counter not found');
  END IF;

  -- Enforce ownership
  IF v_counter.employee_id IS NULL OR v_counter.employee_id != v_employee.id THEN
    RETURN json_build_object('error', 'You are not assigned to this counter');
  END IF;

  SELECT CAST(value AS int) INTO v_no_show_timeout
  FROM settings WHERE key = 'no_show_timeout_minutes';
  IF v_no_show_timeout IS NULL THEN v_no_show_timeout := 2; END IF;

  UPDATE queues SET
    status = 'serving',
    called_at = now(),
    no_show_deadline = now() + (v_no_show_timeout || ' minutes')::interval
  WHERE id = p_ticket_id;

  UPDATE counters SET
    status = 'busy',
    current_ticket_id = p_ticket_id
  WHERE id = v_counter.id;

  INSERT INTO activity_logs (employee_id, employee_name, action, ticket_number, counter_number, details)
  VALUES (v_employee.id, v_employee.full_name, 'recall', v_ticket.ticket_number, v_counter.counter_number,
    'Recalled ' || v_ticket.ticket_number);

  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================
-- 5. Add function to update own counter status
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_own_counter_status(p_counter_number integer, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee RECORD;
  v_counter RECORD;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_counter FROM counters WHERE counter_number = p_counter_number;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Counter not found');
  END IF;

  IF v_counter.employee_id IS NULL OR v_counter.employee_id != v_employee.id THEN
    RETURN json_build_object('error', 'You are not assigned to this counter');
  END IF;

  IF p_status NOT IN ('open', 'busy', 'closed', 'lunch_break', 'maintenance') THEN
    RETURN json_build_object('error', 'Invalid status');
  END IF;

  UPDATE counters SET status = p_status WHERE id = v_counter.id;

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_own_counter_status(integer, text) TO authenticated;

-- ============================================================
-- 6. Add function to get employee's assigned counter
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_counter()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee RECORD;
  v_counter RECORD;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_counter FROM counters WHERE employee_id = v_employee.id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No counter assigned');
  END IF;

  RETURN json_build_object('success', true, 'counter', row_to_json(v_counter));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_counter() TO authenticated;

-- ============================================================
-- 7. Tighten counters RLS: restrict UPDATE to own counter only
-- ============================================================
REVOKE UPDATE ON counters FROM anon;
REVOKE INSERT ON counters FROM anon;
REVOKE DELETE ON counters FROM anon;

DROP POLICY IF EXISTS "counters_auth_update" ON counters;
CREATE POLICY "counters_update_own_counter"
ON counters FOR UPDATE
TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_id = auth.uid()))
WITH CHECK (employee_id = (SELECT id FROM employees WHERE auth_id = auth.uid()));

-- ============================================================
-- 8. Tighten queues: revoke UPDATE from anon (customers should use cancel_own_ticket RPC)
-- ============================================================
REVOKE UPDATE ON queues FROM anon;
