import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import mobileApi, { saveSession, loadSession, clearSession, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // A 401 anywhere in the app drops straight back to the login screen.
    setUnauthorizedHandler(() => setUser(null));

    (async () => {
      const { token, user: storedUser } = await loadSession();
      if (token && storedUser) {
        // Show the cached user immediately, then confirm the token in the background
        // so a warehouse operator is not blocked by a slow network on app start.
        setUser(storedUser);
        mobileApi.get('/auth/me')
          .then(res => {
            if (res.data?.success) {
              setUser(res.data.user);
              saveSession(token, res.data.user);
            }
          })
          .catch(() => { /* 401 is handled by the interceptor; other errors keep the cached session */ });
      }
      setBooting(false);
    })();
  }, []);

  const value = useMemo(() => ({
    user,
    booting,
    isAdmin: user?.role === 'admin',
    login: async (username, password) => {
      const res = await mobileApi.post('/auth/login', { username, password });
      if (!res.data?.success) throw new Error(res.data?.message || 'Login failed.');
      await saveSession(res.data.token, res.data.user);
      setUser(res.data.user);
      return res.data.user;
    },
    logout: async () => {
      await clearSession();
      setUser(null);
    }
  }), [user, booting]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
