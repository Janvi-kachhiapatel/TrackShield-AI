import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import api from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Attempt login against the backend. Returns false on any failure. */
  login: (empId: string, role?: string) => Promise<boolean>;
  logout: () => void;
  /** Switch the active demo session by re-authenticating (demo credentials). */
  switchUser: (empId: string) => Promise<void>;
  /** Try a known demo credential pair; resolves false if it fails. */
  loginDemo: (empId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('railway_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Refresh session from the server when a signed token exists.
    // No token -> no automatic privileged login. The user must authenticate.
    const token = localStorage.getItem('railway_token');
    if (!token) {
      setUser(null);
      localStorage.removeItem('railway_user');
      return;
    }
    api.get<User>('/auth/me')
      .then(res => {
        setUser(res.data);
        localStorage.setItem('railway_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // Token invalid/expired or backend offline: clear session.
        localStorage.removeItem('railway_token');
        localStorage.removeItem('railway_user');
        setUser(null);
      });
  }, []);

  /**
   * Demo credential convention: empId prefix + "123" (e.g. elec001/elec123).
   * Kept only for the sandbox demo — the backend remains the authority and
   * rejects anything it does not recognize. Real deployments replace this
   * with a proper password form.
   */
  const DEMO_PASSWORDS: Record<string, string> = {
    hod001: 'hod123',
    elec001: 'elec123',
    sig001: 'sig123',
    civil001: 'civil123',
    tel001: 'tel123',
    mech001: 'mech123',
    admin001: 'admin123',
  };

  const loginDemo = async (empId: string): Promise<boolean> => {
    const password = DEMO_PASSWORDS[empId.toLowerCase()];
    if (!password) return false;
    try {
      const res = await api.post('/auth/login', { emp_id: empId, password });
      const userData: User = res.data.user;
      setUser(userData);
      localStorage.setItem('railway_token', res.data.access_token);
      localStorage.setItem('railway_user', JSON.stringify(userData));
      return true;
    } catch {
      return false;
    }
  };

  const login = async (empId: string, _role?: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Delegate entirely to the demo credential map. If the backend is
      // unreachable or rejects the pair, login FAILS — there is no
      // client-side fabrication of a privileged session.
      return await loginDemo(empId);
    } finally {
      setLoading(false);
    }
  };

  const switchUser = async (empId: string) => {
    const ok = await loginDemo(empId);
    if (!ok) {
      throw new Error(`Demo switch to ${empId} failed — backend did not accept the credentials.`);
    }
  };

  const logout = () => {
    localStorage.removeItem('railway_token');
    localStorage.removeItem('railway_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchUser, loginDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
