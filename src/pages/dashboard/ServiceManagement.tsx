import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import type { Service } from '../../types';
import { Plus, Pencil, ToggleLeft, ToggleRight, ArrowUp, ArrowDown } from 'lucide-react';

export function ServiceManagement() {
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
    const channel = supabase
      .channel('service-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => loadServices())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadServices() {
    const { data } = await supabase.from('services').select('*').order('display_order', { ascending: true });
    setServices(data as Service[] || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editing) {
      const { error } = await supabase
        .from('services')
        .update({ name, description })
        .eq('id', editing.id);
      if (error) {
        setMessage('Error: ' + error.message);
      } else {
        setMessage('Service updated');
        setEditing(null);
        setName('');
        setDescription('');
      }
    } else {
      const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.display_order)) : 0;
      const { error } = await supabase
        .from('services')
        .insert({ name, description, display_order: maxOrder + 1 });
      if (error) {
        setMessage('Error: ' + error.message);
      } else {
        setMessage('Service added');
        setShowAdd(false);
        setName('');
        setDescription('');
      }
    }
  }

  async function toggleActive(service: Service) {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id);
    if (error) setMessage('Error: ' + error.message);
  }

  async function moveOrder(service: Service, direction: 'up' | 'down') {
    const sorted = [...services].sort((a, b) => a.display_order - b.display_order);
    const index = sorted.findIndex(s => s.id === service.id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const swapService = sorted[swapIndex];

    await supabase.from('services').update({ display_order: swapService.display_order }).eq('id', service.id);
    await supabase.from('services').update({ display_order: service.display_order }).eq('id', swapService.id);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500 animate-pulse">{t('common.loading')}</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-700">{t('service.title')}</h1>
        <button onClick={() => { setShowAdd(true); setEditing(null); setName(''); setDescription(''); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('service.add')}
        </button>
      </div>

      {message && (
        <div className="bg-navy-50 border border-navy-200 text-navy-700 rounded-lg px-4 py-3 text-sm animate-fade-in">
          {message}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        {t('service.cannot_delete')}
      </div>

      {(showAdd || editing) && (
        <div className="card p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-navy-700 mb-4">
            {editing ? t('service.edit') : t('service.add')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('service.name')}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Deposit" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('service.description')}</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Optional description" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary">{t('service.save')}</button>
              <button onClick={() => { setShowAdd(false); setEditing(null); setName(''); setDescription(''); }} className="btn-secondary">
                {t('service.cancel_edit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="divide-y divide-gray-100">
          {services.map((service, index) => (
            <div key={service.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveOrder(service, 'up')}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-navy-700 disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveOrder(service, 'down')}
                    disabled={index === services.length - 1}
                    className="text-gray-400 hover:text-navy-700 disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{service.name}</p>
                  {service.description && (
                    <p className="text-sm text-gray-500 truncate">{service.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`status-badge ${service.is_active ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.is_active ? t('service.active') : t('service.inactive')}
                </span>
                <button
                  onClick={() => toggleActive(service)}
                  className="text-gray-500 hover:text-navy-700"
                  title={service.is_active ? t('service.disable') : t('service.enable')}
                >
                  {service.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button
                  onClick={() => { setEditing(service); setShowAdd(false); setName(service.name); setDescription(service.description || ''); }}
                  className="text-navy-600 hover:text-navy-800"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
