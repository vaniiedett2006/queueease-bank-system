-- Set a secure, immutable search_path on all SECURITY DEFINER functions
-- to prevent search_path hijacking attacks

ALTER FUNCTION public.auto_skip_no_show() SET search_path = public, pg_temp;
ALTER FUNCTION public.call_next_customer(p_counter_number integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_customer(p_ticket_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_own_ticket(p_ticket_id uuid, p_ownership_token text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_employee_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.complete_customer(p_ticket_id uuid, p_counter_number integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_own_account(p_password text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_ticket(p_customer_name text, p_customer_email text, p_queue_type text, p_priority_category text, p_service_id uuid, p_service_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_employee_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_queue_position(p_ticket_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.recall_customer(p_ticket_id uuid, p_counter_number integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_daily_counters() SET search_path = public, pg_temp;
ALTER FUNCTION public.skip_customer(p_ticket_id uuid, p_counter_number integer) SET search_path = public, pg_temp;
