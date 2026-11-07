import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, loginUser, registerUser, logoutUser, clearSession } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    const token = localStorage.getItem('dummr_access_token');
    const savedUser = localStorage.getItem('dummr_user');

    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        clearSession();
      }
    }

    if (token) {
      try {
        const userProfile = await getCurrentUser();
        const normalized = {
          ...userProfile,
          role: String(userProfile.role || 'client').toLowerCase(),
          avatar: (userProfile.name || userProfile.email || 'ME').substring(0, 2).toUpperCase(),
        };
        setCurrentUser(normalized);
        localStorage.setItem('dummr_user', JSON.stringify(normalized));
      } catch (err) {
        // If getCurrentUser fails and refresh failed
        setCurrentUser(null);
        clearSession();
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initAuth();

    const handleUnauthorized = () => {
      setCurrentUser(null);
    };

    window.addEventListener('dummr_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('dummr_unauthorized', handleUnauthorized);
    };
  }, [initAuth]);

  const login = async ({ username, password }) => {
    const authResult = await loginUser({ username, password });
    if (!authResult?.access_token) {
      throw new Error('Authentication failed.');
    }
    localStorage.setItem('dummr_access_token', authResult.access_token);
    if (authResult.refresh_token) {
      localStorage.setItem('dummr_refresh_token', authResult.refresh_token);
    }
    const profile = await getCurrentUser(authResult.access_token);
    const normalized = {
      ...profile,
      role: String(profile.role || 'client').toLowerCase(),
      avatar: (profile.name || profile.email || 'ME').substring(0, 2).toUpperCase(),
    };
    setCurrentUser(normalized);
    localStorage.setItem('dummr_user', JSON.stringify(normalized));
    return normalized;
  };

  const register = async (userData) => {
    await registerUser(userData);
    return login({
      username: userData.username || userData.email,
      password: userData.password,
    });
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const isProvider = currentUser?.role === 'provider';
  const isClient = currentUser?.role === 'client';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isProvider,
        isClient,
        login,
        register,
        logout,
        refreshUser: initAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
