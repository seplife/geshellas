import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken } from "../lib/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { id, email, role, nom, prenoms, actif }
  const [loading, setLoading] = useState(true);

  // Vérifie le token stocké au démarrage
  const checkStoredSession = useCallback(async () => {
    const token = localStorage.getItem("hellas-token");
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      // Token expiré ou invalide → on le supprime
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkStoredSession(); }, [checkStoredSession]);

  const login = async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (email, password, fullName) => {
    const data = await api.post("/auth/register", { email, password, full_name: fullName });
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      logout();
    }
  }, []);

  const value = {
    user,
    profile: user,          // alias pour compatibilité avec les composants existants
    session: user ? { user } : null,
    loading,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.");
  return ctx;
}
