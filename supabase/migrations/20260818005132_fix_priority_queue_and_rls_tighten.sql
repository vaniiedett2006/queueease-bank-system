/*
# Fix Priority Queue Generation and Tighten RLS

1. generate_ticket changes
   - Remove the requirement for p_priority_category when queue type is 'priority'.
   - Priority lane customers no longer need to disclose their category (PWD, Senior, Pregnant).
   - The function now accepts NULL priority_category for both queue types.

2. cancel_customer changes
   - Add counter ownership enforcement: only the employee assigned to the
     ticket's counter can cancel a ticket via this function.

3. RLS tightening
   - Revoke INSERT/UPDATE/DELETE from anon on employees, activity_logs,
     queue_history, services, settings, counters tables.
   - Keep anon SELECT where public read is needed (announcements, queues,
     counters, services, settings).
   - Fix queues_auth_update policy: restrict UPDATE to authenticated employees
     who own the counter assigned to the ticket (or to the customer via
     ownership_token for cancel_own_ticket flow handled by the RPC).

4. Notes
   - No data is deleted or modified — only function definitions and policies change.
   - Existing queue records, employee accounts, and counters are preserved.
*/

-- ============================================================
-- 1. Fix generate_ticket: remove priority_category requirement
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
  v_counter_id uuid;
  v_counter_number int;
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

  -- Priority category is now OPTIONAL for priority queue — no longer required.
  -- If provided, validate it; if NULL, accept it (privacy: no disclosure needed).
  IF p_priority_category IS NOT NULL AND p_priority_category NOT IN ('senior_citizen', 'pwd', 'pregnant') THEN
    RETURN json_build_object('error', 'Invalid priority category');
  END IF;

  -- Check if there's an available counter
  SELECT id, counter_number INTO v_counter_id, v_counter_number
  FROM counters
  WHERE status = 'open'
  AND current_daily_count < daily_capacity
  ORDER BY counter_number ASC
  LIMIT 1;

  IF v_counter_id IS NULL THEN
    RETURN json_build_object('error', 'All counters are currently full. Please try again later.');
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

  -- Calculate position
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

  -- Estimated wait: position in queue * avg service time
  v_estimated_wait := (v_position - 1) * v_avg_service_time;

  -- Generate ownership token
  v_ownership_token := encode(gen_random_bytes(32), 'hex');

  -- Insert the ticket
  INSERT INTO queues (
    ticket_number, customer_name, customer_email, queue_type,
    priority_category, service_id, service_name,
    counter_id, counter_number, status, ownership_token,
    position, estimated_wait_minutes
  ) VALUES (
    v_ticket_number, p_customer_name, p_customer_email, p_queue_type,
    p_priority_category, p_service_id, p_service_name,
    v_counter_id, v_counter_number, 'waiting', v_ownership_token,
    v_position, v_estimated_wait
  );

  RETURN json_build_object(
    'success', true,
    'ticket_number', v_ticket_number,
    'ownership_token', v_ownership_token,
    'counter_number', v_counter_number,
    'position', v_position,
    'estimated_wait', v_estimated_wait
  );
END;
$function$;

-- ============================================================
-- 2. Fix cancel_customer: enforce counter ownership
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_customer(p_ticket_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket RECORD;
  v_employee_id uuid;
  v_counter_employee_id uuid;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM queues WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('waiting', 'serving', 'recalled') THEN
    RETURN json_build_object('error', 'Ticket cannot be cancelled in current status');
  END IF;

  -- Get the current authenticated employee
  SELECT id INTO v_employee_id
  FROM employees WHERE auth_id = auth.uid();

  IF v_employee_id IS NULL THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- If ticket is assigned to a counter, verify the employee owns that counter
  IF v_ticket.counter_id IS NOT NULL THEN
    SELECT employee_id INTO v_counter_employee_id
    FROM counters WHERE id = v_ticket.counter_id;

    IF v_counter_employee_id IS NULL OR v_counter_employee_id != v_employee_id THEN
      RETURN json_build_object('error', 'You can only cancel tickets at your own counter');
    END IF;
  END IF;

  -- Cancel the ticket
  UPDATE queues
  SET status = 'cancelled',
      cancelled_at = now()
  WHERE id = p_ticket_id;

  -- Log the action
  INSERT INTO activity_logs (employee_id, action, ticket_number, counter_number, details)
  SELECT v_employee_id, 'cancel', v_ticket.ticket_number, v_ticket.counter_number, 'Ticket cancelled by employee';

  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================
-- 3. Tighten RLS: revoke dangerous anon grants
-- ============================================================

-- Revoke anon write access on employees (only authenticated should manage)
REVOKE INSERT, UPDATE, DELETE ON employees FROM anon;

-- Revoke anon write access on activity_logs
REVOKE INSERT, UPDATE, DELETE ON activity_logs FROM anon;

-- Revoke anon write access on queue_history
REVOKE INSERT, UPDATE, DELETE ON queue_history FROM anon;

-- Revoke anon write access on services
REVOKE INSERT, UPDATE, DELETE ON services FROM anon;

-- Revoke anon write access on settings
REVOKE INSERT, UPDATE, DELETE ON settings FROM anon;

-- Revoke anon write access on counters (keep SELECT for public display)
REVOKE INSERT, UPDATE, DELETE ON counters FROM anon;

-- Revoke anon DELETE on queues (keep SELECT + INSERT for public ticket generation)
REVOKE DELETE ON queues FROM anon;

-- Revoke anon UPDATE on queues
REVOKE UPDATE ON queues FROM anon;

-- ============================================================
-- 4. Fix queues_auth_update: restrict to own counter's tickets
-- ============================================================
DROP POLICY IF EXISTS "queues_auth_update" ON queues;
CREATE POLICY "queues_auth_update"
  ON queues FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM counters c
      WHERE c.employee_id = (
        SELECT e.id FROM employees e WHERE e.auth_id = auth.uid()
      )
      AND (
        c.id = queues.counter_id
        OR queues.counter_id IS NULL
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM counters c
      WHERE c.employee_id = (
        SELECT e.id FROM employees e WHERE e.auth_id = auth.uid()
      )
      AND (
        c.id = queues.counter_id
        OR queues.counter_id IS NULL
      )
    )
  );

-- ============================================================
-- 5. Add missing RLS policies for activity_logs and queue_history writes
-- ============================================================

-- activity_logs: authenticated can insert (for logging employee actions)
DROP POLICY IF EXISTS "activity_logs_auth_insert" ON activity_logs;
CREATE POLICY "activity_logs_auth_insert"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- queue_history: authenticated can insert (for completed transactions)
DROP POLICY IF EXISTS "queue_history_auth_insert" ON queue_history;
CREATE POLICY "queue_history_auth_insert"
  ON queue_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
