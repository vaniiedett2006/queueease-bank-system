import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { ActivityLog } from '../../types';
import { FileText } from 'lucide-react';

export function ActivityLogsPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
    const channel = supabase
      .channel('activity-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => loadLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadLogs() {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data as ActivityLog[] || []);
    setLoading(false);
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.action === filter);

  const actionColors: Record<string, string> = {
    call_next: 'bg-navy-100 text-navy-700',
    complete: 'bg-accent-100 text-accent-700',
    skip: 'bg-orange-100 text-orange-700',
    recall: 'bg-purple-100 text-purple-700',
    cancel: 'bg-red-100 text-red-700',
    daily_reset: 'bg-amber-100 text-amber-700',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-700">{t('log.title')}</h1>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${filter === 'all' ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {t('queue.all')}
          </button>
          {['call_next', 'complete', 'skip', 'recall', 'cancel', 'daily_reset'].map(action => (
            <button
              key={action}
              onClick={() => setFilter(action)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filter === action ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t(`log.action_${action}`)}
            </button>
          ))}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">{t('log.no_logs')}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-navy-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('log.time')}</th>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('log.employee')}</th>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('log.action')}</th>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden md:table-cell">{t('queue.ticket')}</th>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('queue.counter')}</th>
                  <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('log.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {log.employee_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {t(`log.action_${log.action}`) || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {log.ticket_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {log.counter_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
