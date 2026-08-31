import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { QueueHistoryEntry } from '../../types';
import { Download, Printer, BarChart3 } from 'lucide-react';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export function ReportsPage() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [week, setWeek] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [history, setHistory] = useState<QueueHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [period, date, week, month]);

  async function loadReport() {
    setLoading(true);
    let startDate: string;
    let endDate: string;

    if (period === 'daily') {
      startDate = date;
      endDate = date;
    } else if (period === 'weekly') {
      const weekDate = new Date(week);
      const day = weekDate.getDay();
      const monday = new Date(weekDate);
      monday.setDate(weekDate.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = monday.toISOString().split('T')[0];
      endDate = sunday.toISOString().split('T')[0];
    } else {
      startDate = `${month}-01`;
      const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      endDate = `${month}-${lastDay.toString().padStart(2, '0')}`;
    }

    const { data } = await supabase
      .from('queue_history')
      .select('*')
      .gte('completed_at', `${startDate}T00:00:00`)
      .lte('completed_at', `${endDate}T23:59:59`)
      .order('completed_at', { ascending: true });

    setHistory(data as QueueHistoryEntry[] || []);
    setLoading(false);
  }

  const totalServed = history.filter(h => h.status === 'served').length;
  const totalCancelled = history.filter(h => h.status === 'cancelled').length;
  const totalSkipped = history.filter(h => h.status === 'skipped').length;
  const totalPriority = history.filter(h => h.queue_type === 'priority').length;
  const totalRegular = history.filter(h => h.queue_type === 'regular').length;
  const waitTimes = history.filter(h => h.wait_minutes !== null).map(h => h.wait_minutes!);
  const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
  const longestWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

  // Most requested service
  const serviceCounts: Record<string, number> = {};
  history.forEach(h => {
    if (h.service_name) {
      serviceCounts[h.service_name] = (serviceCounts[h.service_name] || 0) + 1;
    }
  });
  const mostRequested = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];

  // Per-counter performance
  const counterStats: Record<number, { served: number; skipped: number; cancelled: number }> = {};
  history.forEach(h => {
    if (h.counter_number) {
      if (!counterStats[h.counter_number]) counterStats[h.counter_number] = { served: 0, skipped: 0, cancelled: 0 };
      if (h.status === 'served') counterStats[h.counter_number].served++;
      else if (h.status === 'skipped') counterStats[h.counter_number].skipped++;
      else if (h.status === 'cancelled') counterStats[h.counter_number].cancelled++;
    }
  });

  // Peak hours
  const hourCounts: Record<number, number> = {};
  history.forEach(h => {
    const hour = new Date(h.completed_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const maxHourCount = Math.max(...Object.values(hourCounts), 1);

  const stats = [
    { label: t('report.total_served'), value: totalServed, color: 'text-accent-600' },
    { label: t('report.total_cancelled'), value: totalCancelled, color: 'text-red-600' },
    { label: t('report.total_skipped'), value: totalSkipped, color: 'text-orange-600' },
    { label: t('report.total_priority'), value: totalPriority, color: 'text-accent-600' },
    { label: t('report.total_regular'), value: totalRegular, color: 'text-blue-600' },
    { label: t('report.avg_wait'), value: `${avgWait} ${t('common.minutes')}`, color: 'text-navy-700' },
    { label: t('report.longest_wait'), value: `${longestWait} ${t('common.minutes')}`, color: 'text-navy-700' },
    { label: t('report.most_requested'), value: mostRequested ? `${mostRequested[0]} (${mostRequested[1]})` : '—', color: 'text-navy-700' },
  ];

  function exportCSV() {
    const headers = ['Ticket', 'Customer', 'Email', 'Type', 'Priority Category', 'Service', 'Counter', 'Status', 'Employee', 'Registered', 'Completed', 'Wait (min)', 'Serve (min)'];
    const rows = history.map(h => [
      h.ticket_number, h.customer_name, h.customer_email || '', h.queue_type,
      h.priority_category || '', h.service_name || '',
      h.counter_number || '', h.status, h.employee_name || '',
      h.registered_at ? new Date(h.registered_at).toLocaleString() : '',
      new Date(h.completed_at).toLocaleString(),
      h.wait_minutes ?? '', h.serve_minutes ?? '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `queueease-report-${period}-${date || week || month}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <h1 className="text-2xl font-bold text-navy-700">{t('report.title')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('report.export_csv')}
          </button>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" />
            {t('report.print')}
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="card p-4 no-print">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  period === p ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-600'
                }`}
              >
                {t(`report.${p}`)}
              </button>
            ))}
          </div>
          {period === 'daily' && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field md:w-48" />
          )}
          {period === 'weekly' && (
            <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="input-field md:w-48" />
          )}
          {period === 'monthly' && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-field md:w-48" />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>
      ) : history.length === 0 ? (
        <div className="card p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">{t('report.no_data')}</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="card p-5">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Per-counter performance */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-navy-700 mb-4">{t('report.counter_perf')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('counter.number')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('report.total_served')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('report.total_skipped')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('report.total_cancelled')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(counterStats).sort((a, b) => Number(a[0]) - Number(b[0])).map(([num, stats]) => (
                    <tr key={num} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-navy-700">{t('counter.number')} {num}</td>
                      <td className="px-4 py-3 text-sm text-accent-600 font-semibold">{stats.served}</td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-semibold">{stats.skipped}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-semibold">{stats.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Peak hour heatmap */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-navy-700 mb-4">{t('report.heatmap')}</h2>
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 24 }, (_, hour) => {
                const count = hourCounts[hour] || 0;
                const intensity = count / maxHourCount;
                const bg = count === 0 ? 'bg-gray-100' :
                  intensity > 0.75 ? 'bg-red-500' :
                  intensity > 0.5 ? 'bg-orange-500' :
                  intensity > 0.25 ? 'bg-amber-400' :
                  'bg-accent-300';
                return (
                  <div key={hour} className="text-center">
                    <div className={`h-16 rounded-md ${bg} flex items-end justify-center pb-1 transition-all hover:scale-105 cursor-default`}>
                      {count > 0 && <span className="text-xs font-bold text-white">{count}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{hour}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed history table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.ticket')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.customer')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden md:table-cell">{t('queue.service')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.counter')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3">{t('queue.status')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('report.avg_wait')}</th>
                    <th className="text-left text-xs font-semibold text-navy-700 uppercase px-4 py-3 hidden lg:table-cell">{t('common.time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.slice(0, 50).map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          h.queue_type === 'priority' ? 'bg-accent-100 text-accent-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {h.ticket_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{h.service_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{h.counter_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`status-badge ${
                          h.status === 'served' ? 'bg-accent-100 text-accent-700' :
                          h.status === 'skipped' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {t(`queue.${h.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                        {h.wait_minutes !== null ? `${h.wait_minutes} ${t('common.minutes')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                        {new Date(h.completed_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
