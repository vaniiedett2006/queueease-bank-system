export type QueueType = 'regular' | 'priority';
export type TicketStatus = 'waiting' | 'serving' | 'served' | 'skipped' | 'cancelled' | 'recalled';
export type CounterStatus = 'open' | 'busy' | 'closed' | 'lunch_break' | 'maintenance';
export type PriorityCategory = 'senior_citizen' | 'pwd' | 'pregnant';

export interface Employee {
  id: string;
  auth_id: string;
  full_name: string;
  username: string;
  email: string;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Counter {
  id: string;
  counter_number: number;
  name: string;
  status: CounterStatus;
  daily_capacity: number;
  current_daily_count: number;
  current_ticket_id: string | null;
  employee_id: string | null;
  created_at: string;
}

export interface QueueTicket {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string | null;
  queue_type: QueueType;
  priority_category: PriorityCategory | null;
  service_id: string | null;
  service_name: string | null;
  counter_id: string | null;
  counter_number: number | null;
  status: TicketStatus;
  ownership_token: string;
  position: number | null;
  estimated_wait_minutes: number;
  registered_at: string;
  called_at: string | null;
  served_at: string | null;
  skipped_at: string | null;
  cancelled_at: string | null;
  no_show_deadline: string | null;
  created_at: string;
}

export interface QueueHistoryEntry {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string | null;
  queue_type: QueueType;
  priority_category: PriorityCategory | null;
  service_id: string | null;
  service_name: string | null;
  counter_id: string | null;
  counter_number: number | null;
  status: TicketStatus;
  employee_id: string | null;
  employee_name: string | null;
  registered_at: string;
  called_at: string | null;
  served_at: string | null;
  completed_at: string;
  wait_minutes: number | null;
  serve_minutes: number | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  action: string;
  ticket_number: string | null;
  counter_number: number | null;
  details: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface DashboardStats {
  total_waiting: number;
  total_priority: number;
  total_regular: number;
  now_serving: number;
  served_today: number;
  avg_wait: number;
  available_counters: number;
}

export interface GenerateTicketResult {
  success?: boolean;
  error?: string;
  ticket_number?: string;
  ownership_token?: string;
  counter_number?: number;
  position?: number;
  estimated_wait?: number;
}
