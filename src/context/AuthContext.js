import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) setUser(JSON.parse(userData));
    } catch (e) {
      console.log('Error loading user', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone_number, password) => {
    const response = await client.post('/users/login/', { phone_number, password });
    const { user, tokens } = response.data;
    await AsyncStorage.setItem('access_token', tokens.access);
    await AsyncStorage.setItem('refresh_token', tokens.refresh);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (full_name, phone_number, password, user_type) => {
    // Step 1: Create the account on the server - if this fails, it's a real registration error
    const response = await client.post('/users/register/', {
      full_name, phone_number, password, user_type,
    });
    const { user, tokens } = response.data;
    // Step 2: Save locally - even if storage hiccups, the account was already created successfully,
    // so we don't want a storage error to look like a "registration failed" error to the user
    try {
      await AsyncStorage.setItem('access_token', tokens.access);
      await AsyncStorage.setItem('refresh_token', tokens.refresh);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } catch (storageErr) {
      console.log('Storage write error after successful registration:', storageErr.message);
    }
    setUser(user);
    return user;
  };

  const loginWithTokens = async (tokens, userData) => {
    await AsyncStorage.setItem('access_token', tokens.access);
    await AsyncStorage.setItem('refresh_token', tokens.refresh);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    console.log('[AUTH] Logout started');
    try {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');
      console.log('[AUTH] Storage cleared');
      setUser(null);
      console.log('[AUTH] User state set to null');
    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, loginWithTokens, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);