import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import type { Announcement } from '../../types';
import { Plus, Trash2, Megaphone } from 'lucide-react';

export function AnnouncementManagement() {
  const { t } = useLanguage();
  const { employee } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();
    const channel = supabase
      .channel('ann-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements(data as Announcement[] || []);
    setLoading(false);
  }

  async function handlePost() {
    if (!message.trim() || !employee) return;
    const { error } = await supabase
      .from('announcements')
      .insert({ message, created_by: employee.id });
    if (!error) {
      setMessage('');
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('announcements').delete().eq('id', id);
  }

  async function toggleActive(ann: Announcement) {
    await supabase.from('announcements').update({ is_active: !ann.is_active }).eq('id', ann.id);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-700">{t('ann.title')}</h1>

      {/* Post form */}
      <div className="card p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('ann.message')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('ann.placeholder')}
            className="input-field"
            onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
          />
          <button onClick={handlePost} disabled={!message.trim()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            {t('ann.post')}
          </button>
        </div>
      </div>

      {/* List */}
      {announcements.length === 0 ? (
        <div className="card p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">{t('ann.no_announcements')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="card p-4 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{ann.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(ann.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <button
                  onClick={() => toggleActive(ann)}
                  className={`status-badge ${ann.is_active ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {ann.is_active ? t('ann.active') : t('ann.inactive')}
                </button>
                <button
                  onClick={() => handleDelete(ann.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
