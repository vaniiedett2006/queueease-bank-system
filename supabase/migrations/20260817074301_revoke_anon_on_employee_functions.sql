-- Revoke EXECUTE from anon role on employee-only SECURITY DEFINER functions
-- These functions are for the employee dashboard only, not the public customer portals

REVOKE EXECUTE ON FUNCTION public.auto_skip_no_show() FROM anon;
REVOKE EXECUTE ON FUNCTION public.call_next_customer(p_counter_number integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_customer(p_ticket_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_customer(p_ticket_id uuid, p_counter_number integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_account(p_password text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recall_customer(p_ticket_id uuid, p_counter_number integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_daily_counters() FROM anon;
REVOKE EXECUTE ON FUNCTION public.skip_customer(p_ticket_id uuid, p_counter_number integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_employee_count() FROM anon;
