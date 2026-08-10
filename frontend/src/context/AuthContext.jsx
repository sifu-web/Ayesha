import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
const DEFAULT_TIMEOUT_MINUTES = 15;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef(null);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);

  const logout = useCallback(async (silent = false) => {
    try {
      if (!silent) await api.post('/auth/logout');
    } catch {
      /* already logged out server-side, ignore */
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      logout(true);
    }, timeoutMinutesRef.current * 60 * 1000);
  }, [logout]);

  useEffect(() => {
    if (!user) return undefined;

    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetInactivityTimer));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetInactivityTimer]);

  // By design, this app never auto-restores a previous session. Every time
  // the site is opened or reloaded — whether the last login was a password,
  // an admin account, or a (one-time or timed) access key — the person must
  // land on the login screen and authenticate again. So on mount we always
  // clear any leftover session cookie rather than checking it, regardless of
  // whether it would still be considered valid.
  useEffect(() => {
    (async () => {
      try {
        await api.post('/auth/clear-session');
      } catch {
        /* nothing to clear / already gone, ignore */
      } finally {
        setUser(null);
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    timeoutMinutesRef.current = data.inactivityLogoutMinutes || DEFAULT_TIMEOUT_MINUTES;
    setUser(data.user);
    return data.user;
  };

  const loginWithKey = async (key) => {
    const { data } = await api.post('/auth/key-login', { key });
    timeoutMinutesRef.current = data.inactivityLogoutMinutes || DEFAULT_TIMEOUT_MINUTES;
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isKeyUser: user?.role === 'keyuser',
    login,
    loginWithKey,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
