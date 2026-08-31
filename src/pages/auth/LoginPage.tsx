import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Logo } from '../../components/Logo';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Lock } from 'lucide-react';

export function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(t('auth.invalid_credentials'));
      } else {
        navigate('/dashboard');
      }
    } catch {
      setError(t('auth.login_failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen qe-bg flex flex-col">
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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="lg" variant="light" />
          <LanguageToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="card w-full max-w-md p-8 shadow-xl animate-slide-up">
          <div className="text-center mb-8">
            <img src="/queueease-logo.png" alt="QueueEase" className="h-20 w-20 rounded-2xl object-contain mx-auto mb-4 shadow-lg" />
            <h1 className="text-2xl font-bold text-navy-700">{t('auth.login_title')}</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="employee@bank.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? t('common.loading') : t('auth.login_button')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {t('auth.no_account')}{' '}
            <Link to="/create-account" className="text-navy-600 font-semibold hover:text-navy-800">
              {t('auth.create_here')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
