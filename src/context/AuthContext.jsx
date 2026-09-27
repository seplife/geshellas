import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { fetchProfile, signIn, signOut } from "../services/auth.js";

const AuthContext = createContext(null);

/**
 * Session Supabase + profil applicatif. Un utilisateur authentifié mais sans
 * profil, ou dont le profil est désactivé, est déconnecté avec un message
 * explicite (auparavant il revenait silencieusement à l'écran de connexion).
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const loadedFor = useRef(null);

  const loadProfile = useCallback(async (userId) => {
    try {
      const p = await fetchProfile(userId);
      if (!p) {
        setAuthError("Ce compte n'a pas de profil dans l'application. Contactez un administrateur.");
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }
      if (!p.actif) {
        setAuthError("Ce compte est désactivé ou en attente d'activation par un administrateur.");
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }
      setAuthError("");
      setProfile(p);
    } catch (err) {
      setAuthError(err.message || "Impossible de charger votre profil.");
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange émet INITIAL_SESSION au démarrage : une seule source.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const uid = newSession?.user?.id ?? null;
      if (!uid) {
        loadedFor.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }
      if (loadedFor.current === uid) {
        setLoading(false);
        return;
      }
      loadedFor.current = uid;
      // Hors du callback : Supabase déconseille d'y attendre d'autres appels.
      setTimeout(() => {
        loadProfile(uid).finally(() => setLoading(false));
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const login = async (email, password) => {
    setAuthError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    await signOut();
    loadedFor.current = null;
    setProfile(null);
    setSession(null);
  };

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    authError,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.");
  return ctx;
}
