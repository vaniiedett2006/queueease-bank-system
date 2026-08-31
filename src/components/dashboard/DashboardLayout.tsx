import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import { Logo } from '../Logo';
import { LanguageToggle } from '../LanguageToggle';
import {
  LayoutDashboard, ListOrdered, Store, Tag, Megaphone,
  QrCode, BarChart3, FileText, User, Settings, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';

export function DashboardLayout() {
  const { employee, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.overview'), end: true },
    { to: '/dashboard/queue', icon: ListOrdered, label: t('nav.queue_management') },
    { to: '/dashboard/counters', icon: Store, label: t('nav.counters') },
    { to: '/dashboard/services', icon: Tag, label: t('nav.services') },
    { to: '/dashboard/announcements', icon: Megaphone, label: t('nav.announcements') },
    { to: '/dashboard/qr-codes', icon: QrCode, label: t('nav.qr_codes') },
    { to: '/dashboard/reports', icon: BarChart3, label: t('nav.reports') },
    { to: '/dashboard/logs', icon: FileText, label: t('nav.activity_logs') },
    { to: '/dashboard/account', icon: User, label: t('nav.my_account') },
    { to: '/dashboard/settings', icon: Settings, label: t('nav.settings') },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen qe-bg flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50 w-64 h-screen bg-navy-700 text-white flex flex-col transition-transform duration-300`}
      >
        <div className="p-4 border-b border-navy-600">
          <Logo size="sm" variant="light" />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-navy-700'
                    : 'text-navy-100 hover:bg-navy-600'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-navy-600">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-navy-300 font-medium">{employee?.full_name}</p>
            <p className="text-xs text-navy-400 truncate">@{employee?.username}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-100 hover:bg-red-600 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="relative overflow-hidden bg-navy-700 text-white shadow-md">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cpath d='M10 30 L40 10 L70 30 L70 70 L10 70 Z' fill='none' stroke='white' stroke-width='1'/%3E%3Cpath d='M20 35 L40 22 L60 35' fill='none' stroke='white' stroke-width='1'/%3E%3Crect x='25' y='40' width='6' height='20' fill='none' stroke='white' stroke-width='0.5'/%3E%3Crect x='37' y='40' width='6' height='20' fill='none' stroke='white' stroke-width='0.5'/%3E%3Crect x='49' y='40' width='6' height='20' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: '200px',
            }}
          />
          <div className="relative px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-navy-600 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="hidden lg:block">
              <p className="text-sm text-navy-200">
                {t('brand.tagline')}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <LanguageToggle />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 watermark-admin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
