import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { QueueTicket, Counter, Announcement } from '../../types';
import { Logo } from '../../components/Logo';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Megaphone, Store, Users } from 'lucide-react';

export function NowServingScreen() {
  const { t } = useLanguage();
  const [servingTickets, setServingTickets] = useState<QueueTicket[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [branchName, setBranchName] = useState('QueueEase Bank Branch');
  const [lastTicketNumber, setLastTicketNumber] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('now-serving-screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, () => loadCounters())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncement())
      .subscribe();

    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(clockInterval);
    };
  }, []);

  async function loadData() {
    loadServing();
    loadCounters();
    loadAnnouncement();
    loadWaitingCount();
    loadSettings();
  }

  async function loadServing() {
    const { data } = await supabase
      .from('queues')
      .select('*')
      .in('status', ['serving', 'recalled'])
      .order('called_at', { ascending: true });
    const tickets = data as QueueTicket[] || [];
    setServingTickets(tickets);

    if (tickets.length > 0) {
      const latest = tickets[tickets.length - 1];
      if (latest.ticket_number !== lastTicketNumber) {
        setLastTicketNumber(latest.ticket_number);
        setFlash(true);
        setTimeout(() => setFlash(false), 1000);
      }
    }
  }

  async function loadCounters() {
    const { data } = await supabase.from('counters').select('*').order('counter_number', { ascending: true });
    setCounters(data as Counter[] || []);
  }

  async function loadAnnouncement() {
    const { data } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setAnnouncement(data as Announcement || null);
  }

  async function loadWaitingCount() {
    const { count } = await supabase.from('queues').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
    setWaitingCount(count || 0);
  }

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('key', 'branch_name').maybeSingle();
    if (data) setBranchName((data as any).value);
  }

  const statusColors: Record<string, string> = {
    open: 'bg-accent-500',
    busy: 'bg-amber-500',
    closed: 'bg-red-500',
    lunch_break: 'bg-orange-500',
    maintenance: 'bg-gray-500',
  };

  return (
    <div className="min-h-screen qe-bg text-navy-900 relative overflow-hidden">
      <div className="qe-waves">
        <svg className="wave-tl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-50 100 Q 25 50 100 100 T 250 100 L 250 -50 L -50 -50 Z" fill="#03045e"/>
          <path d="M-50 120 Q 25 80 100 120 T 250 120 L 250 -50 L -50 -50 Z" fill="#0a2472" opacity="0.6"/>
        </svg>
        <svg className="wave-br" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-50 100 Q 25 50 100 100 T 250 100 L 250 -50 L -50 -50 Z" fill="#03045e"/>
          <path d="M-50 120 Q 25 80 100 120 T 250 120 L 250 -50 L -50 -50 Z" fill="#0a2472" opacity="0.6"/>
        </svg>
      </div>

      <header className="relative z-10 bg-navy-700 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="lg" variant="light" />
          <div className="flex items-center gap-6">
            <div className="text-right text-white">
              <p className="text-2xl font-bold tabular-nums">
                {currentTime.toLocaleTimeString()}
              </p>
              <p className="text-sm text-navy-200">
                {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <p className="text-center text-navy-600 text-lg mb-6">{branchName}</p>

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold text-navy-700 tracking-wider mb-2">
            {t('serving.title')}
          </h1>
        </div>

        {servingTickets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl text-gray-400">{t('serving.no_one_serving')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {servingTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`bg-white text-navy-900 rounded-2xl p-8 shadow-xl text-center border border-gray-100 transition-all ${
                  flash && ticket.ticket_number === lastTicketNumber ? 'scale-105 ring-4 ring-accent-400' : ''
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    ticket.queue_type === 'priority' ? 'bg-accent-100 text-accent-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {ticket.queue_type === 'priority' ? t('customer.priority_badge') : t('customer.regular_badge')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">{t('serving.title')}</p>
                <p className="text-7xl font-extrabold mb-4 tracking-tight">{ticket.ticket_number}</p>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 uppercase tracking-wider">{t('serving.counter')}</p>
                  <p className="text-4xl font-bold text-navy-700">{ticket.counter_number}</p>
                  <p className="text-lg text-gray-700 mt-2">{ticket.customer_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-navy-700 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5" />
              {t('serving.counter_status')}
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {counters.map(c => {
                const isFull = c.current_daily_count >= c.daily_capacity;
                return (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{t('counter.number')}</p>
                    <p className="text-2xl font-bold text-navy-700 mb-1">{c.counter_number}</p>
                    <p className="text-xs text-gray-500 mb-2">{c.current_daily_count}/{c.daily_capacity}</p>
                    <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
                      isFull ? 'bg-red-500' : statusColors[c.status]
                    }`}>
                      {isFull ? t('counter.full') : t(`counter.${c.status}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-navy-700 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('serving.queue_info')}
              </h2>
              <p className="text-4xl font-extrabold text-accent-600">{waitingCount}</p>
              <p className="text-sm text-gray-500">{t('serving.waiting')}</p>
            </div>

            {announcement && (
              <div className="bg-accent-50 border border-accent-200 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-accent-700 mb-2 flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  {t('serving.announcement')}
                </h2>
                <p className="text-sm text-gray-700">{announcement.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
