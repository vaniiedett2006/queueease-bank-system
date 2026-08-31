import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import type { QueueTicket, Counter } from '../../types';
import {
  Phone, CheckCircle, SkipForward, RotateCcw, XCircle, Search, Clock
} from 'lucide-react';

export function QueueManagement() {
  const { t } = useLanguage();
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [myCounter, setMyCounter] = useState<Counter | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<QueueTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTickets = useCallback(async () => {
    let query = supabase.from('queues').select('*').order('registered_at', { ascending: false });

    if (filterStatus === 'active') {
      query = query.in('status', ['waiting', 'serving', 'recalled']);
    } else if (filterStatus === 'waiting') {
      query = query.eq('status', 'waiting');
    } else if (filterStatus === 'serving') {
      query = query.in('status', ['serving', 'recalled']);
    } else if (filterStatus === 'completed') {
      query = query.in('status', ['served', 'skipped', 'cancelled']);
    }

    if (filterType !== 'all') {
      query = query.eq('queue_type', filterType);
    }

    if (searchQuery.trim()) {
      query = query.or(`ticket_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`);
    }

    const { data } = await query.limit(50);
    setTickets(data as QueueTicket[] || []);
  }, [filterStatus, filterType, searchQuery]);

  const loadMyCounter = useCallback(async () => {
    if (!employee) return;
    // Auto-assign counter before loading
    await supabase.rpc('ensure_employee_counter');
    const { data } = await supabase
      .from('counters')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle();
    setMyCounter(data as Counter || null);
  }, [employee]);

  useEffect(() => {
    loadTickets();
    loadMyCounter();

    const channel = supabase
      .channel('queue-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        loadTickets();
        loadMyCounter();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, () => {
        loadMyCounter();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets, loadMyCounter]);

  async function handleCallNext() {
    if (!myCounter) {
      setMessage({ type: 'error', text: t('counter.no_assignment') });
      return;
    }
    setActionLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc('call_next_customer', {
        p_counter_number: myCounter.counter_number,
      });
      if (error) throw error;
      const result = data as { error?: string; success?: boolean; ticket?: QueueTicket };
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
      } else if (result?.ticket) {
        setSelectedTicket(result.ticket);
        setMessage({ type: 'success', text: `${t('queue.call_next')}: ${result.ticket.ticket_number}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAction(action: 'complete' | 'skip' | 'recall' | 'cancel') {
    if (!selectedTicket) return;
    setActionLoading(true);
    setMessage(null);
    try {
      let result;
      if (action === 'complete') {
        const { data, error } = await supabase.rpc('complete_customer', {
          p_ticket_id: selectedTicket.id,
        });
        result = { data, error };
      } else if (action === 'skip') {
        const { data, error } = await supabase.rpc('skip_customer', {
          p_ticket_id: selectedTicket.id,
        });
        result = { data, error };
      } else if (action === 'recall') {
        const { data, error } = await supabase.rpc('recall_customer', {
          p_ticket_id: selectedTicket.id,
        });
        result = { data, error };
      } else {
        const { data, error } = await supabase.rpc('cancel_customer', {
          p_ticket_id: selectedTicket.id,
        });
        result = { data, error };
      }

      if (result.error) throw result.error;
      const res = result.data as { error?: string; success?: boolean };
      if (res?.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: `${t(`queue.${action}`)}: ${selectedTicket.ticket_number}` });
        setSelectedTicket(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    waiting: 'bg-gray-100 text-gray-700',
    serving: 'bg-amber-100 text-amber-700',
    served: 'bg-accent-100 text-accent-700',
    skipped: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
    recalled: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-700">{t('queue.title')}</h1>

      {/* Counter info + action buttons */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t('queue.counter')}
            </label>
            <div className="input-field min-w-40 flex items-center justify-center font-bold text-navy-700 bg-gray-50">
              {myCounter ? `${t('counter.number')} ${myCounter.counter_number}` : t('counter.no_assignment')}
            </div>
            {myCounter && (
              <p className="text-xs text-gray-500 mt-1">
                {t('counter.daily_count')}: {myCounter.current_daily_count}/{myCounter.daily_capacity} — {t(`counter.${myCounter.status}`)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCallNext}
              disabled={actionLoading || !myCounter || myCounter.status === 'closed' || myCounter.status === 'maintenance' || myCounter.current_daily_count >= myCounter.daily_capacity}
              className="btn-primary flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              {t('queue.call_next')}
            </button>
            <button
              onClick={() => handleAction('complete')}
              disabled={actionLoading || !selectedTicket || !['serving', 'recalled'].includes(selectedTicket.status)}
              className="btn-success flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {t('queue.complete')}
            </button>
            <button
              onClick={() => handleAction('skip')}
              disabled={actionLoading || !selectedTicket || !['serving', 'recalled'].includes(selectedTicket.status)}
              className="btn-warning flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              {t('queue.skip')}
            </button>
            <button
              onClick={() => handleAction('recall')}
              disabled={actionLoading || !selectedTicket || selectedTicket.status !== 'skipped'}
              className="btn-secondary flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('queue.recall')}
            </button>
            <button
              onClick={() => handleAction('cancel')}
              disabled={actionLoading || !selectedTicket || !['waiting', 'serving', 'recalled'].includes(selectedTicket.status)}
              className="btn-danger flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {t('queue.cancel')}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm animate-fade-in ${
            message.type === 'success'
              ? 'bg-accent-50 border border-accent-200 text-accent-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Selected ticket details */}
      {selectedTicket && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1.5 rounded-lg text-lg font-bold ${
                  selectedTicket.queue_type === 'priority'
                    ? 'bg-accent-100 text-accent-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedTicket.ticket_number}
                </span>
                <span className={`status-badge ${statusColors[selectedTicket.status]}`}>
                  {t(`queue.${selectedTicket.status}`)}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{selectedTicket.customer_name}</p>
              <p className="text-sm text-gray-500">{selectedTicket.customer_email}</p>
              <p className="text-sm text-gray-600 mt-1">
                {t('queue.service')}: <span className="font-medium">{selectedTicket.service_name || '—'}</span>
              </p>
              {selectedTicket.counter_number && (
                <p className="text-sm text-gray-600">
                  {t('queue.counter')}: <span className="font-medium">{selectedTicket.counter_number}</span>
                </p>
              )}
            </div>
            {selectedTicket.no_show_deadline && selectedTicket.status === 'serving' && (
              <NoShowTimer deadline={selectedTicket.no_show_deadline} />
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('queue.search')}
              className="input-field pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field md:w-40"
          >
            <option value="all">{t('queue.all')}</option>
            <option value="regular">{t('queue.regular')}</option>
            <option value="priority">{t('queue.priority')}</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field md:w-40"
          >
            <option value="active">{t('queue.waiting')} + {t('queue.serving')}</option>
            <option value="waiting">{t('queue.waiting')}</option>
            <option value="serving">{t('queue.serving')}</option>
            <option value="completed">{t('queue.served')}/{t('queue.skipped')}/{t('queue.cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Queue table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-50">
              <tr>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.ticket')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.customer')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden md:table-cell">{t('queue.service')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('queue.type')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.counter')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.status')}</th>
                <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('queue.wait_time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {t('queue.no_waiting')}
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const waitMin = ticket.registered_at
                    ? Math.floor((Date.now() - new Date(ticket.registered_at).getTime()) / 60000)
                    : 0;
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`cursor-pointer transition-colors ${
                        selectedTicket?.id === ticket.id
                          ? 'bg-navy-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          ticket.queue_type === 'priority'
                            ? 'bg-accent-100 text-accent-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ticket.ticket_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {ticket.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        {ticket.service_name || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs font-medium ${
                          ticket.queue_type === 'priority' ? 'text-accent-600' : 'text-blue-600'
                        }`}>
                          {t(`queue.${ticket.queue_type}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {ticket.counter_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`status-badge ${statusColors[ticket.status]}`}>
                          {t(`queue.${ticket.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                        {waitMin} {t('dash.minutes')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NoShowTimer({ deadline }: { deadline: string }) {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000);
      setRemaining(Math.max(0, diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      remaining < 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>
      <Clock className="w-4 h-4" />
      <span className="text-sm font-semibold">
        {t('queue.no_show_timer')}: {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
