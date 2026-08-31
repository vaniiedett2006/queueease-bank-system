import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Employee } from '../types';

interface AuthContextValue {
  session: Session | null;
  employee: Employee | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadEmployee(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadEmployee(session.user.id);
      } else {
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadEmployee(authId: string) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (error) throw error;
      setEmployee(data as Employee);

      // Auto-assign counter for this employee (creates if missing, fixes wrong assignments)
      if (data) {
        await supabase.rpc('ensure_employee_counter');
      }
    } catch {
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshEmployee() {
    if (session) {
      await loadEmployee(session.user.id);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEmployee(null);
  }

  return (
    <AuthContext.Provider value={{ session, employee, loading, signOut, refreshEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
