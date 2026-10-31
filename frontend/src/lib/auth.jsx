import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';

const AuthCtx = createContext(null);
export const homeFor = (role) => ({ EMPLOYEE: '/employee', MANAGER: '/manager', HR: '/hr' }[role] || '/');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const finish = useCallback((data) => { tokenStore.set(data.token); qc.clear(); setUser(data.user); return data.user; }, [qc]);
  const login = (email, password) => api.post('/auth/login', { email, password }).then((r) => finish(r.data));
  const register = (payload) => api.post('/auth/register', payload).then((r) => finish(r.data));
  const logout = () => { tokenStore.clear(); qc.clear(); setUser(null); };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
