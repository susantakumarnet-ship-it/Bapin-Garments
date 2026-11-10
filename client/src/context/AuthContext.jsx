import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('bg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bg:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = async (identifier, password) => {
    const { user } = await api('/auth/login', { method: 'POST', body: { identifier, password } });
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  const can = (perm) => Boolean(user?.permissions?.includes(perm));

  return <AuthContext.Provider value={{ user, checking, login, logout, can, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
