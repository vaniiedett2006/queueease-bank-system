/*
# Revoke anon EXECUTE on employee-only functions

1. Security changes
   - Revoke EXECUTE from anon on: update_own_counter_status, get_my_counter,
     call_next_customer, complete_customer, skip_customer, recall_customer,
     cancel_customer, reset_daily_counters, delete_own_account,
     get_dashboard_stats, get_employee_profile, check_employee_count,
     auto_skip_no_show.
   - Keep anon EXECUTE on: generate_ticket, get_queue_position,
     cancel_own_ticket (these are needed by public customer portals).
   - Grant EXECUTE to authenticated on all of the above.

2. Notes
   - No data is modified or deleted.
   - Customer-facing functions remain publicly callable.
   - Employee/admin functions now require authentication.
*/

REVOKE EXECUTE ON FUNCTION public.update_own_counter_status(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_counter() FROM anon;
REVOKE EXECUTE ON FUNCTION public.call_next_customer(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_customer(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.skip_customer(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recall_customer(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_customer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_daily_counters() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_account(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_employee_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_skip_no_show() FROM anon;

GRANT EXECUTE ON FUNCTION public.update_own_counter_status(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_counter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.call_next_customer(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_customer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_customer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recall_customer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_daily_counters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_employee_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_skip_no_show() TO authenticated;

-- Ensure customer-facing functions remain callable by anon
GRANT EXECUTE ON FUNCTION public.generate_ticket(text, text, text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_queue_position(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_ticket(uuid, text) TO anon, authenticated;
