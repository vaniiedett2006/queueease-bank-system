-- Revoke EXECUTE from PUBLIC (which includes anon) on employee-only functions
-- PostgreSQL grants EXECUTE to PUBLIC by default, so we must revoke that too

REVOKE EXECUTE ON FUNCTION public.auto_skip_no_show() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.call_next_customer(p_counter_number integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_customer(p_ticket_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_customer(p_ticket_id uuid, p_counter_number integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_own_account(p_password text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employee_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recall_customer(p_ticket_id uuid, p_counter_number integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_daily_counters() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.skip_customer(p_ticket_id uuid, p_counter_number integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_employee_count() FROM PUBLIC;

-- Re-grant EXECUTE to authenticated role only (for logged-in employees)
GRANT EXECUTE ON FUNCTION public.auto_skip_no_show() TO authenticated;
GRANT EXECUTE ON FUNCTION public.call_next_customer(p_counter_number integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_customer(p_ticket_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_customer(p_ticket_id uuid, p_counter_number integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(p_password text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recall_customer(p_ticket_id uuid, p_counter_number integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_daily_counters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_customer(p_ticket_id uuid, p_counter_number integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_employee_count() TO authenticated;
