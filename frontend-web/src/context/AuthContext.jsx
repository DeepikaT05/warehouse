import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const saved = localStorage.getItem('vaniki_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  // Only block the UI when there is no cached user to show.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('vaniki_token')) && !readStoredUser());

  const logout = useCallback(() => {
    localStorage.removeItem('vaniki_token');
    localStorage.removeItem('vaniki_user');
    setUser(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('vaniki_token')) {
      setLoading(false);
      return;
    }

    // Revalidate in the background. A network blip or a 500 must not sign the
    // user out - only the server saying the session is invalid (401/403) does.
    api.get('/auth/me')
      .then(res => {
        if (res.data.success) {
          setUser(res.data.user);
          localStorage.setItem('vaniki_user', JSON.stringify(res.data.user));
        }
      })
      .catch(err => {
        const status = err.response?.status;
        if (status === 401 || status === 403) logout();
      })
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (!res.data.success) throw new Error(res.data.message || 'Login failed');
    localStorage.setItem('vaniki_token', res.data.token);
    localStorage.setItem('vaniki_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('vaniki_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, updateUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
