import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { CreateAccountPage } from './pages/auth/CreateAccountPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { DashboardOverview } from './pages/dashboard/DashboardOverview';
import { QueueManagement } from './pages/dashboard/QueueManagement';
import { CounterManagement } from './pages/dashboard/CounterManagement';
import { ServiceManagement } from './pages/dashboard/ServiceManagement';
import { AnnouncementManagement } from './pages/dashboard/AnnouncementManagement';
import { QRCodePage } from './pages/dashboard/QRCodePage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { ActivityLogsPage } from './pages/dashboard/ActivityLogsPage';
import { MyAccountPage } from './pages/dashboard/MyAccountPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { RegularPortal } from './pages/customer/RegularPortal';
import { PriorityPortal } from './pages/customer/PriorityPortal';
import { NowServingScreen } from './pages/public/NowServingScreen';
import { LandingPage } from './pages/LandingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, employee, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="text-navy-700 font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!session || !employee) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/customer/regular" element={<RegularPortal />} />
      <Route path="/customer/priority" element={<PriorityPortal />} />
      <Route path="/serving" element={<NowServingScreen />} />

      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="queue" element={<QueueManagement />} />
        <Route path="counters" element={<CounterManagement />} />
        <Route path="services" element={<ServiceManagement />} />
        <Route path="announcements" element={<AnnouncementManagement />} />
        <Route path="qr-codes" element={<QRCodePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="logs" element={<ActivityLogsPage />} />
        <Route path="account" element={<MyAccountPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
