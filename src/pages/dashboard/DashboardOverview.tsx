import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { DashboardStats, QueueTicket, Counter } from '../../types';
import { Users, Crown, User, Monitor, CheckCircle, Clock, Store } from 'lucide-react';

export function DashboardOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<QueueTicket[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [counterActiveCounts, setCounterActiveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRecentTickets();
    loadCounters();

    // Realtime subscriptions
    const queueChannel = supabase
      .channel('dashboard-queues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        loadStats();
        loadRecentTickets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_history' }, () => {
        loadStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, () => {
        loadCounters();
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, []);

  async function loadStats() {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (!error && data) {
        setStats(data as DashboardStats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentTickets() {
    try {
      const { data } = await supabase
        .from('queues')
        .select('*')
        .in('status', ['waiting', 'serving', 'recalled'])
        .order('registered_at', { ascending: false })
        .limit(10);
      setRecentTickets(data as QueueTicket[] || []);
    } catch {
      // silent
    }
  }

  async function loadCounters() {
    try {
      const { data } = await supabase
        .from('counters')
        .select('*')
        .order('counter_number', { ascending: true });
      const countersData = data as Counter[] || [];
      setCounters(countersData);

      // Fetch active queue count per counter
      const counts: Record<string, number> = {};
      await Promise.all(countersData.map(async (c) => {
        const { count } = await supabase
          .from('queues')
          .select('*', { count: 'exact', head: true })
          .eq('counter_id', c.id)
          .in('status', ['waiting', 'serving', 'recalled']);
        counts[c.id] = count || 0;
      }));
      setCounterActiveCounts(counts);
    } catch {
      // silent
    }
  }

  const cards = [
    { label: t('dash.total_waiting'), value: stats?.total_waiting ?? 0, icon: Users, color: 'bg-navy-700' },
    { label: t('dash.total_priority'), value: stats?.total_priority ?? 0, icon: Crown, color: 'bg-accent-600' },
    { label: t('dash.total_regular'), value: stats?.total_regular ?? 0, icon: User, color: 'bg-blue-500' },
    { label: t('dash.now_serving'), value: stats?.now_serving ?? 0, icon: Monitor, color: 'bg-amber-500' },
    { label: t('dash.served_today'), value: stats?.served_today ?? 0, icon: CheckCircle, color: 'bg-accent-500' },
    { label: t('dash.avg_wait'), value: `${stats?.avg_wait ?? 0} ${t('dash.minutes')}`, icon: Clock, color: 'bg-purple-500' },
    { label: t('dash.available_counters'), value: stats?.available_counters ?? 0, icon: Store, color: 'bg-teal-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 animate-pulse">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-700">{t('dash.title')}</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="card p-5 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent tickets + counters */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy-700 mb-4">
            {t('queue.waiting')} ({recentTickets.length})
          </h2>
          {recentTickets.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">{t('queue.no_waiting')}</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      ticket.queue_type === 'priority'
                        ? 'bg-accent-100 text-accent-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ticket.ticket_number}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-32">
                      {ticket.customer_name}
                    </span>
                  </div>
                  <span className={`status-badge ${
                    ticket.status === 'serving' ? 'bg-amber-100 text-amber-700' :
                    ticket.status === 'recalled' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {t(`queue.${ticket.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counter status */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy-700 mb-4">
            {t('counter.title')}
          </h2>
          <div className="space-y-2">
            {counters.map((counter) => (
              <div
                key={counter.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-navy-700">
                    {t('counter.number')} {counter.counter_number}
                  </span>
                  <span className="text-xs text-blue-600 font-semibold">
                    {t('counter.active_queue')}: {counterActiveCounts[counter.id] ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">
                    {t('counter.daily_count')}: {counter.current_daily_count}/{counter.daily_capacity}
                  </span>
                </div>
                <span className={`status-badge ${
                  counter.status === 'open' ? 'bg-accent-100 text-accent-700' :
                  counter.status === 'busy' ? 'bg-amber-100 text-amber-700' :
                  counter.status === 'closed' ? 'bg-red-100 text-red-700' :
                  counter.status === 'lunch_break' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {t(`counter.${counter.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
