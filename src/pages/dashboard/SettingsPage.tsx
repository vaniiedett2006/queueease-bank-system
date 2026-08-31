import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { Setting } from '../../types';
import { Save, Settings as SettingsIcon } from 'lucide-react';

export function SettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*');
    const map: Record<string, string> = {};
    (data as Setting[] || []).forEach(s => { map[s.key] = s.value; });
    setSettings(map);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updates = Object.entries(settings).map(([key, value]) =>
        supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
      );
      await Promise.all(updates);
      setMessage(t('settings.saved'));
    } catch (err) {
      setMessage('Error: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>;
  }

  const fields = [
    { key: 'branch_name', label: t('settings.branch_name'), type: 'text' },
    { key: 'timezone', label: t('settings.timezone'), type: 'text' },
    { key: 'no_show_timeout_minutes', label: t('settings.no_show_timeout'), type: 'number' },
    { key: 'average_service_time_minutes', label: t('settings.avg_service_time'), type: 'number' },
    { key: 'business_hours_start', label: t('settings.business_hours_start'), type: 'time' },
    { key: 'business_hours_end', label: t('settings.business_hours_end'), type: 'time' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        {t('settings.title')}
      </h1>

      {message && (
        <div className="bg-accent-50 border border-accent-200 text-accent-700 rounded-lg px-4 py-3 text-sm animate-fade-in">
          {message}
        </div>
      )}

      <div className="card p-6 space-y-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{field.label}</label>
            <input
              type={field.type}
              value={settings[field.key] || ''}
              onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
              className="input-field"
            />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}
