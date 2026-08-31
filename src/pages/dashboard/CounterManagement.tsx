import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import type { Counter, CounterStatus } from '../../types';
import { RotateCcw } from 'lucide-react';

export function CounterManagement() {
  const { t } = useLanguage();
  const { employee } = useAuth();
  const [counter, setCounter] = useState<Counter | null>(null);
  const [activeQueueCount, setActiveQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadMyCounter();
    const channel = supabase
      .channel('counter-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, () => loadMyCounter())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => loadMyCounter())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadMyCounter() {
    if (!employee) return;
    // Auto-assign counter before loading
    await supabase.rpc('ensure_employee_counter');
    const { data } = await supabase
      .from('counters')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle();
    const c = data as Counter || null;
    setCounter(c);
    setLoading(false);

    if (c) {
      const { count } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('counter_id', c.id)
        .in('status', ['waiting', 'serving', 'recalled']);
      setActiveQueueCount(count || 0);
    }
  }

  async function updateStatus(status: CounterStatus) {
    if (!counter) return;
    const { error } = await supabase.rpc('update_own_counter_status', {
      p_counter_number: counter.counter_number,
      p_status: status,
    });
    if (error) {
      setMessage('Error updating counter status');
    } else {
      setMessage(`${t('counter.status')}: ${t(`counter.${status}`)}`);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleReset() {
    if (!confirm(t('counter.reset_confirm'))) return;
    const { error } = await supabase.rpc('reset_daily_counters');
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('Counter reset successfully');
      setTimeout(() => setMessage(null), 3000);
    }
  }

  const statusColors: Record<string, string> = {
    open: 'bg-accent-100 text-accent-700',
    busy: 'bg-amber-100 text-amber-700',
    closed: 'bg-red-100 text-red-700',
    lunch_break: 'bg-orange-100 text-orange-700',
    maintenance: 'bg-gray-200 text-gray-700',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>;
  }

  if (!counter) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-navy-700">{t('counter.title')}</h1>
        <div className="card p-8 text-center">
          <p className="text-gray-500">{t('counter.no_assignment')}</p>
        </div>
      </div>
    );
  }

  const isFull = counter.current_daily_count >= counter.daily_capacity;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-700">{t('counter.title')}</h1>
        <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          {t('counter.reset_all')}
        </button>
      </div>

      {message && (
        <div className="bg-navy-50 border border-navy-200 text-navy-700 rounded-lg px-4 py-3 text-sm animate-fade-in">
          {message}
        </div>
      )}

      <div className="card p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-navy-700">
            {t('counter.number')} {counter.counter_number}
          </h3>
          <span className={`status-badge text-base px-4 py-2 ${statusColors[counter.status]}`}>
            {t(`counter.${counter.status}`)}
          </span>
        </div>

        {/* Active queue count — separate from daily transactions */}
        <div className="mb-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-700">{t('counter.active_queue')}</span>
            <span className="text-3xl font-extrabold text-blue-700">{activeQueueCount}</span>
          </div>
        </div>

        {/* Daily transactions — completed/served count */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('counter.daily_count')}</span>
            <span className={`text-2xl font-bold ${isFull ? 'text-red-600' : 'text-navy-700'}`}>
              {counter.current_daily_count} / {counter.daily_capacity}
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isFull ? 'bg-red-500' : counter.current_daily_count > 15 ? 'bg-amber-500' : 'bg-accent-500'
              }`}
              style={{ width: `${(counter.current_daily_count / counter.daily_capacity) * 100}%` }}
            />
          </div>
          {isFull && (
            <p className="text-xs text-red-600 font-semibold mt-2">{t('counter.full')}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase">
            {t('counter.status')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {(['open', 'busy', 'maintenance', 'closed'] as CounterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  counter.status === status
                    ? 'bg-navy-700 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(`counter.${status}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
