import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { QueueTicket, Counter, Announcement, Service } from '../../types';
import { Logo } from '../../components/Logo';
import { LanguageToggle } from '../../components/LanguageToggle';
import {
  Ticket, Store, Clock, Users, Megaphone, XCircle, CheckCircle,
  AlertCircle, Bell, Vibrate, Download
} from 'lucide-react';

interface CustomerPortalProps {
  portalType: 'regular' | 'priority';
}

export function CustomerPortal({ portalType }: CustomerPortalProps) {
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [nowServing, setNowServing] = useState<QueueTicket[]>([]);
  const [position, setPosition] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(0);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notifiedTicketId, setNotifiedTicketId] = useState<string | null>(null);
  const ticketCardRef = useRef<HTMLDivElement>(null);

  const isPriority = portalType === 'priority';
  const accentColor = isPriority ? 'accent' : 'blue';
  const portalTitle = isPriority ? t('customer.priority_portal') : t('customer.regular_portal');
  const joinLabel = isPriority ? t('customer.join_priority') : t('customer.join_queue');
  const badgeText = isPriority ? t('customer.priority_badge') : t('customer.regular_badge');

  useEffect(() => {
    const stored = localStorage.getItem('queueease-ticket');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        loadTicket(data.id, data.ownership_token);
      } catch { /* ignore */ }
    }
    loadServices();
    loadCounters();
    loadAnnouncement();
    loadNowServing();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`customer-${portalType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        loadNowServing();
        if (ticket) {
          checkTicketUpdate(ticket.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, () => loadCounters())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncement())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        if (ticket) checkTicketUpdate(ticket.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticket]);

  useEffect(() => {
    if (!ticket || !['waiting', 'serving', 'recalled'].includes(ticket.status)) return;
    const interval = setInterval(() => {
      checkTicketUpdate(ticket.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [ticket]);

  async function loadServices() {
    const { data } = await supabase.from('services').select('*').eq('is_active', true).order('display_order', { ascending: true });
    setServices(data as Service[] || []);
  }

  async function loadCounters() {
    const { data } = await supabase.from('counters').select('*').order('counter_number', { ascending: true });
    setCounters(data as Counter[] || []);
  }

  async function loadAnnouncement() {
    const { data } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setAnnouncement(data as Announcement || null);
  }

  async function loadNowServing() {
    const { data } = await supabase.from('queues').select('*').in('status', ['serving', 'recalled']).order('called_at', { ascending: false }).limit(5);
    setNowServing(data as QueueTicket[] || []);
  }

  async function loadTicket(ticketId: string, _token: string) {
    const { data } = await supabase.from('queues').select('*').eq('id', ticketId).maybeSingle();
    if (data) {
      setTicket(data as QueueTicket);
      checkTicketUpdate(ticketId);
    } else {
      localStorage.removeItem('queueease-ticket');
    }
  }

  function playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playTone(880, now, 0.15);
      playTone(880, now + 0.2, 0.15);
      playTone(1100, now + 0.4, 0.3);
    } catch {
      // Sound not available - visual notification still works
    }
  }

  const checkTicketUpdate = useCallback(async (ticketId: string) => {
    const { data } = await supabase.rpc('get_queue_position', { p_ticket_id: ticketId });
    if (data) {
      const result = data as { status?: string; position?: number; estimated_wait?: number };
      setPosition(result.position || 0);
      setEstimatedWait(result.estimated_wait || 0);

      const { data: latest } = await supabase.from('queues').select('*').eq('id', ticketId).maybeSingle();
      if (latest) {
        const latestTicket = latest as QueueTicket;
        setTicket(latestTicket);
        if (latestTicket.status === 'serving' && notifiedTicketId !== ticketId) {
          setShowNotification(true);
          setNotifiedTicketId(ticketId);
          playNotificationSound();
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
          setTimeout(() => setShowNotification(false), 15000);
        }
      }
    }
  }, [notifiedTicketId]);

  async function handleJoinQueue(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError(t('customer.name_required')); return; }
    if (!selectedService) { setError(t('customer.service_required')); return; }

    setLoading(true);
    try {
      let serviceId: string | null = selectedService;
      let serviceName: string | null = null;

      if (selectedService === 'other') {
        serviceId = null;
        serviceName = 'Other';
      } else {
        const service = services.find(s => s.id === selectedService);
        serviceName = service?.name || null;
      }

      const { data, error: rpcError } = await supabase.rpc('generate_ticket', {
        p_customer_name: fullName,
        p_customer_email: email || null,
        p_queue_type: portalType,
        p_priority_category: null,
        p_service_id: serviceId,
        p_service_name: serviceName,
      });

      if (rpcError) throw rpcError;
      const result = data as { error?: string; success?: boolean; ticket_number?: string; ownership_token?: string; position?: number; estimated_wait?: number };

      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        const { data: ticketData } = await supabase
          .from('queues')
          .select('*')
          .eq('ticket_number', result.ticket_number)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ticketData) {
          const newTicket = ticketData as QueueTicket;
          setTicket(newTicket);
          setPosition(result.position || 0);
          setEstimatedWait(result.estimated_wait || 0);
          localStorage.setItem('queueease-ticket', JSON.stringify({
            id: newTicket.id,
            ownership_token: result.ownership_token,
          }));
        }
      }
    } catch {
      setError(t('customer.registration_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelTicket() {
    if (!ticket) return;
    if (!confirm(t('customer.cancel_confirm'))) return;
    try {
      const stored = localStorage.getItem('queueease-ticket');
      if (!stored) return;
      const { ownership_token } = JSON.parse(stored);
      const { data, error: rpcError } = await supabase.rpc('cancel_own_ticket', {
        p_ticket_id: ticket.id,
        p_ownership_token: ownership_token,
      });
      if (rpcError) throw rpcError;
      const result = data as { error?: string; success?: boolean };
      if (result?.error) {
        setError(result.error);
      } else {
        setTicket(null);
        localStorage.removeItem('queueease-ticket');
      }
    } catch {
      setError(t('customer.cancel_failed'));
    }
  }

  function handleNewTicket() {
    setTicket(null);
    setFullName('');
    setEmail('');
    setSelectedService('');
    setPosition(0);
    setEstimatedWait(0);
    setNotifiedTicketId(null);
    localStorage.removeItem('queueease-ticket');
  }

  async function handleDownloadTicket() {
    if (!ticket || !ticketCardRef.current) return;
    try {
      const canvas = await renderTicketImage();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `QueueEase-Ticket-${ticket.ticket_number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Download failed silently
    }
  }

  async function renderTicketImage(): Promise<HTMLCanvasElement | null> {
    if (!ticket) return null;
    const canvas = document.createElement('canvas');
    const w = 600;
    const h = 800;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Load logo image
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/queueease-logo.png';
    await new Promise((resolve) => { logoImg.onload = resolve; logoImg.onerror = resolve; });

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Top navy bar
    ctx.fillStyle = '#03045e';
    ctx.fillRect(0, 0, w, 120);

    // Logo
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, 30, 25, 70, 70);
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText('QueueEase', 115, 55);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#a0aec0';
    ctx.fillText('Queue Management System', 115, 80);

    // Badge
    const badgeY = 160;
    const badgeText = isPriority ? 'PRIORITY' : 'REGULAR';
    const badgeColor = isPriority ? '#10b981' : '#3b82f6';
    ctx.fillStyle = badgeColor;
    ctx.fillRect(w / 2 - 80, badgeY, 160, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, w / 2, badgeY + 24);
    ctx.textAlign = 'left';

    // Ticket number
    ctx.fillStyle = '#03045e';
    ctx.font = 'bold 72px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ticket.ticket_number, w / 2, 290);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 330);
    ctx.lineTo(w - 60, 330);
    ctx.stroke();

    // Info rows
    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#6b7280';
    const rows: [string, string][] = [
      ['Customer:', ticket.customer_name || '—'],
      ['Service:', ticket.service_name || '—'],
      ['Lane:', isPriority ? 'Priority' : 'Regular'],
      ['Counter:', ticket.counter_number ? String(ticket.counter_number) : '—'],
      ['Position:', String(position)],
      ['Est. Wait:', `${estimatedWait} minutes`],
      ['Status:', ticket.status],
    ];
    let y = 380;
    for (const [label, value] of rows) {
      ctx.fillStyle = '#6b7280';
      ctx.fillText(label, 60, y);
      ctx.fillStyle = '#03045e';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(value, 250, y);
      ctx.font = '16px Inter, sans-serif';
      y += 42;
    }

    // Footer
    ctx.fillStyle = '#03045e';
    ctx.fillRect(0, h - 60, w, 60);
    ctx.fillStyle = '#a0aec0';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QueueEase Queue Management System', w / 2, h - 25);

    return canvas;
  }

  const approxCallTime = new Date(Date.now() + estimatedWait * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const statusColors: Record<string, string> = {
    waiting: 'bg-gray-100 text-gray-700',
    serving: 'bg-amber-100 text-amber-700',
    served: 'bg-accent-100 text-accent-700',
    skipped: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
    recalled: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="min-h-screen qe-bg relative">
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

      <header className={`relative z-10 ${isPriority ? 'bg-accent-700' : 'bg-navy-700'} text-white shadow-md`}>
        <div className="relative max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" variant="light" />
          <LanguageToggle />
        </div>
      </header>

      <div className="relative max-w-4xl mx-auto px-4 py-6 z-10">
        <h1 className={`text-xl font-bold ${isPriority ? 'text-accent-700' : 'text-navy-700'} mb-4`}>
          {portalTitle}
        </h1>

        {announcement && (
          <div className={`${isPriority ? 'bg-accent-50 border-accent-200' : 'bg-navy-50 border-navy-200'} border rounded-lg px-4 py-3 mb-4 flex items-start gap-3 animate-fade-in`}>
            <Megaphone className={`w-5 h-5 ${isPriority ? 'text-accent-600' : 'text-navy-600'} shrink-0 mt-0.5`} />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">{t('customer.announcement')}</p>
              <p className="text-sm text-gray-700">{announcement.message}</p>
            </div>
          </div>
        )}

        {showNotification && ticket && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-amber-500 text-white rounded-xl p-4 shadow-xl animate-slide-up flex items-center gap-3">
            <Bell className="w-6 h-6 shrink-0 animate-bounce" />
            <div className="flex-1">
              <p className="font-bold text-lg">{t('customer.being_served')}</p>
              <p className="text-sm">{t('customer.go_to_counter')} {ticket.counter_number}</p>
            </div>
            <button onClick={() => setShowNotification(false)} className="p-1 hover:bg-amber-600 rounded">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {ticket ? (
          <div className="space-y-4">
            <div ref={ticketCardRef} className="card p-6 text-center animate-slide-up">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPriority ? 'bg-accent-100 text-accent-700' : 'bg-blue-100 text-blue-700'}`}>
                  {badgeText}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-2">{t('customer.your_ticket')}</p>
              <div className={`text-6xl font-extrabold ${isPriority ? 'text-accent-700' : 'text-navy-700'} mb-2`}>
                {ticket.ticket_number}
              </div>

              <p className="text-sm text-gray-600 mb-1">{t('customer.queue_number')}: <span className="font-bold">{ticket.ticket_number}</span></p>
              <p className="text-sm text-gray-600 mb-1">{t('customer.assigned_counter')}: <span className="font-bold">{ticket.counter_number || '—'}</span></p>
              <p className="text-sm text-gray-600 mb-1">{t('customer.your_position')}: <span className="font-bold">{position}</span></p>
              <p className="text-sm text-gray-600 mb-1">{t('customer.estimated_wait')}: <span className="font-bold">{estimatedWait} {t('common.minutes')}</span></p>
              <p className="text-sm text-gray-600 mb-4">{t('customer.approx_call_time')}: <span className="font-bold">{approxCallTime}</span></p>

              <div className={`inline-block status-badge ${statusColors[ticket.status]} mb-4`}>
                {t(`queue.${ticket.status}`)}
              </div>

              {ticket.status === 'serving' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-700 font-bold text-lg">{t('customer.being_served')}</p>
                  <p className="text-amber-600 text-sm">{t('customer.go_to_counter')} {ticket.counter_number}</p>
                </div>
              )}
              {ticket.status === 'served' && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-4 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent-600" />
                  <p className="text-accent-700 font-semibold">{t('customer.transaction_complete')}</p>
                </div>
              )}
              {ticket.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700 font-semibold">{t('customer.ticket_cancelled')}</p>
                </div>
              )}
              {ticket.status === 'skipped' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <p className="text-orange-700 font-semibold">{t('customer.ticket_skipped')}</p>
                </div>
              )}

              {estimatedWait > 0 && ticket.status === 'waiting' && (
                <p className="text-xs text-gray-400 italic mb-4">{t('customer.estimate_disclaimer')}</p>
              )}

              <div className="flex flex-wrap gap-2 justify-center mb-4">
                <button onClick={handleDownloadTicket} className="btn-secondary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {t('customer.save_ticket')}
                </button>
                {(ticket.status === 'waiting' || ticket.status === 'serving') && (
                  <button onClick={handleCancelTicket} className="btn-danger flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {t('customer.cancel_ticket')}
                  </button>
                )}
                {(ticket.status === 'served' || ticket.status === 'cancelled' || ticket.status === 'skipped') && (
                  <button onClick={handleNewTicket} className="btn-primary">
                    {t('customer.back_to_join')}
                  </button>
                )}
              </div>
            </div>

            <NowServingCard tickets={nowServing} t={t} />
            <CounterAvailabilityCard counters={counters} t={t} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card p-6 animate-fade-in">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleJoinQueue} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('customer.full_name')}</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="input-field" placeholder="Juan Dela Cruz" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('customer.email')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="juan@example.com (optional)" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('customer.select_service')}</label>
                  <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} required className="input-field">
                    <option value="">-- {t('customer.select_service')} --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="other">{t('customer.other_service')}</option>
                  </select>
                </div>

                <button type="submit" disabled={loading} className={`btn-primary w-full ${isPriority ? '!bg-accent-600 hover:!bg-accent-700' : ''}`}>
                  {loading ? t('common.loading') : joinLabel}
                </button>
              </form>
            </div>

            <NowServingCard tickets={nowServing} t={t} />
            <CounterAvailabilityCard counters={counters} t={t} />
          </div>
        )}
      </div>
    </div>
  );
}

function NowServingCard({ tickets, t }: { tickets: QueueTicket[]; t: (k: string) => string }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-navy-700 mb-3 flex items-center gap-2">
        <Ticket className="w-4 h-4" />
        {t('customer.now_serving')}
      </h3>
      {tickets.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{t('serving.no_one_serving')}</p>
      ) : (
        <div className="space-y-2">
          {tickets.map(tkt => (
            <div key={tkt.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tkt.queue_type === 'priority' ? 'bg-accent-100 text-accent-700' : 'bg-blue-100 text-blue-700'}`}>
                  {tkt.ticket_number}
                </span>
                <span className="text-sm text-gray-600 truncate max-w-32">{tkt.customer_name}</span>
              </div>
              <span className="text-sm font-bold text-navy-700">{t('serving.counter')} {tkt.counter_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CounterAvailabilityCard({ counters, t }: { counters: Counter[]; t: (k: string) => string }) {
  const statusColors: Record<string, string> = {
    open: 'bg-accent-100 text-accent-700',
    busy: 'bg-amber-100 text-amber-700',
    closed: 'bg-red-100 text-red-700',
    lunch_break: 'bg-orange-100 text-orange-700',
    maintenance: 'bg-gray-200 text-gray-700',
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-navy-700 mb-3 flex items-center gap-2">
        <Store className="w-4 h-4" />
        {t('customer.counter_availability')}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {counters.map(c => {
          const isFull = c.current_daily_count >= c.daily_capacity;
          return (
            <div key={c.id} className="p-2 rounded-lg bg-gray-50 text-center">
              <p className="text-xs font-bold text-navy-700">{t('counter.number')} {c.counter_number}</p>
              <p className="text-xs text-gray-500">{c.current_daily_count}/{c.daily_capacity}</p>
              <span className={`status-badge text-[10px] ${statusColors[c.status]}`}>
                {isFull ? t('counter.full') : t(`counter.${c.status}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
