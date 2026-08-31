import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { LanguageToggle } from '../components/LanguageToggle';
import { useLanguage } from '../lib/LanguageContext';
import { ArrowRight, Building2, Users, Monitor, Smartphone, QrCode, Bell } from 'lucide-react';

export function LandingPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen qe-bg">
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
          <Logo size="md" variant="light" />
          <LanguageToggle />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-navy-700 mb-4">
            {t('brand.name')}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            {t('brand.tagline')}
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Link
              to="/login"
              className="card p-8 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-navy-700 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-navy-700 mb-2">
                {t('nav.overview')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('auth.login')} → {t('nav.queue_management')}, {t('nav.counters')}, {t('nav.reports')}
              </p>
              <div className="flex items-center gap-2 text-navy-600 font-semibold text-sm group-hover:gap-3 transition-all">
                {t('auth.login')}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              to="/customer/regular"
              className="card p-8 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-navy-700 mb-2">
                {t('customer.regular_portal')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('customer.join_queue')}
              </p>
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                {t('customer.join_queue')}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              to="/customer/priority"
              className="card p-8 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-accent-500 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-navy-700 mb-2">
                {t('customer.priority_portal')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('customer.join_priority')}
              </p>
              <div className="flex items-center gap-2 text-accent-600 font-semibold text-sm group-hover:gap-3 transition-all">
                {t('customer.join_priority')}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            <Link
              to="/serving"
              className="inline-flex items-center gap-2 text-navy-600 hover:text-navy-800 transition-colors"
            >
              <Monitor className="w-5 h-5" />
              {t('serving.title')}
            </Link>
            <Link
              to="/create-account"
              className="inline-flex items-center gap-2 text-navy-600 hover:text-navy-800 transition-colors"
            >
              <Building2 className="w-5 h-5" />
              {t('auth.create_account')}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-navy-700">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <Smartphone className="w-8 h-8 text-navy-200 mx-auto mb-2" />
              <p className="text-sm text-navy-100 font-medium">Mobile Optimized</p>
            </div>
            <div className="text-center">
              <QrCode className="w-8 h-8 text-navy-200 mx-auto mb-2" />
              <p className="text-sm text-navy-100 font-medium">QR Code Access</p>
            </div>
            <div className="text-center">
              <Bell className="w-8 h-8 text-navy-200 mx-auto mb-2" />
              <p className="text-sm text-navy-100 font-medium">Real-time Updates</p>
            </div>
            <div className="text-center">
              <Monitor className="w-8 h-8 text-navy-200 mx-auto mb-2" />
              <p className="text-sm text-navy-100 font-medium">Public Display</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
