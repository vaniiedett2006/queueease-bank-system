import { useState, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { User, Lock, Trash2, AlertCircle } from 'lucide-react';

export function MyAccountPage() {
  const { employee, signOut, refreshEmployee } = useAuth();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(employee?.full_name || '');
  const [username, setUsername] = useState(employee?.username || '');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!employee) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ full_name: fullName, username })
        .eq('id', employee.id);
      if (error) throw error;
      await refreshEmployee();
      setMessage({ type: 'success', text: t('account.update_success') });
      setEditing(false);
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (!employee) return;
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMsg({ type: 'error', text: t('auth.password_weak') });
      return;
    }
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: employee.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordMsg({ type: 'error', text: t('account.wrong_password') });
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setPasswordMsg({ type: 'success', text: t('account.password_success') });
      setCurrentPassword('');
      setNewPassword('');
      setShowPassword(false);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: (err as Error).message });
    }
  }

  async function handleDeleteAccount() {
    setDeleteMsg(null);
    if (!employee) return;
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: employee.email,
        password: deletePassword,
      });
      if (verifyError) {
        setDeleteMsg(t('account.wrong_password'));
        return;
      }
      const { data, error } = await supabase.rpc('delete_own_account', {
        p_password: deletePassword,
      });
      if (error) throw error;
      const result = data as { error?: string; success?: boolean };
      if (result?.error) {
        setDeleteMsg(result.error);
        return;
      }
      await signOut();
      window.location.href = '/login';
    } catch (err) {
      setDeleteMsg((err as Error).message);
    }
  }

  if (!employee) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-navy-700">{t('account.title')}</h1>

      {/* Profile info */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-navy-700 flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{employee.full_name}</h2>
            <p className="text-sm text-gray-500">@{employee.username}</p>
            <p className="text-sm text-gray-500">{employee.email}</p>
          </div>
        </div>

        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm mb-4 animate-fade-in ${
            message.type === 'success' ? 'bg-accent-50 border border-accent-200 text-accent-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('auth.full_name')}</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('auth.username')}</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="input-field" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">{t('account.save')}</button>
              <button type="button" onClick={() => { setEditing(false); setFullName(employee.full_name); setUsername(employee.username); }} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2">
            <User className="w-4 h-4" />
            {t('account.edit_profile')}
          </button>
        )}
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-navy-700 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t('account.change_password')}
        </h3>
        {passwordMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm mb-4 animate-fade-in ${
            passwordMsg.type === 'success' ? 'bg-accent-50 border border-accent-200 text-accent-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {passwordMsg.text}
          </div>
        )}
        {showPassword ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('account.current_password')}</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('account.new_password')}</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="input-field" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">{t('account.save')}</button>
              <button type="button" onClick={() => { setShowPassword(false); setCurrentPassword(''); setNewPassword(''); }} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowPassword(true)} className="btn-secondary flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t('account.change_password')}
          </button>
        )}
      </div>

      {/* Delete account */}
      <div className="card p-6 border-red-200">
        <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          {t('account.delete_account')}
        </h3>
        {deleteMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 animate-fade-in">
            {deleteMsg}
          </div>
        )}
        {showDelete ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('account.delete_confirm')}</span>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('account.current_password')}</label>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="input-field" placeholder={t('auth.password')} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleDeleteAccount} disabled={!deletePassword} className="btn-danger flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                {t('account.delete')}
              </button>
              <button onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteMsg(null); }} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {t('account.delete_account')}
          </button>
        )}
      </div>
    </div>
  );
}
