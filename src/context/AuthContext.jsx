import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, raise } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur lecture profil:", error);
      setAuthError(error.message);
      return null;
    }

    const resolved = data || {
      id: authUser.id,
      nom: authUser.user_metadata?.nom || authUser.email?.split("@")[0] || "",
      prenoms: authUser.user_metadata?.prenoms || "",
      telephone: authUser.user_metadata?.telephone || null,
      role: "reception",
      actif: true,
    };

    if (resolved.actif === false) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      const msg = "Ce compte est désactivé. Demandez à un administrateur de l'activer.";
      setAuthError(msg);
      throw new Error(msg);
    }

    const fullProfile = { ...resolved, email: authUser.email };
    setProfile(fullProfile);
    setAuthError("");
    return fullProfile;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        try {
          await fetchProfile(initialSession.user);
        } catch {
          /* géré dans fetchProfile */
        }
      }
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        try {
          await fetchProfile(newSession.user);
        } catch {
          /* géré dans fetchProfile */
        }
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email, password) => {
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) raise(error);
    const prof = await fetchProfile(data.user);
    setSession(data.session);
    return { session: data.session, user: prof };
  };

  const register = async (emailOrPayload, password, fullName) => {
    setAuthError("");
    let email;
    let pwd;
    let nom = "";
    let prenoms = "";
    let telephone = null;

    if (typeof emailOrPayload === "object" && emailOrPayload !== null) {
      email = emailOrPayload.email;
      pwd = emailOrPayload.password;
      nom = emailOrPayload.nom || "";
      prenoms = emailOrPayload.prenoms || "";
      telephone = emailOrPayload.telephone || null;
    } else {
      email = emailOrPayload;
      pwd = password;
      const parts = (fullName || "").trim().split(/\s+/);
      nom = parts[0] || "";
      prenoms = parts.slice(1).join(" ");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pwd,
      options: {
        data: {
          nom,
          prenoms,
          telephone,
          role: "reception",
        },
      },
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw new Error("Un compte existe déjà avec cette adresse e-mail.");
      }
      raise(error);
    }

    // Supabase renvoie un user avec identities = [] si l'email existe déjà (selon config)
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("Un compte existe déjà avec cette adresse e-mail.");
    }

    // L'utilisateur doit d'abord créer son compte puis se connecter explicitement :
    // si Supabase a ouvert une session automatiquement à l'inscription, on la ferme.
    if (data?.session) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    }

    return {
      message: "Compte créé avec succès. Vous pouvez maintenant vous connecter.",
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfile(session.user);
    }
  }, [session, fetchProfile]);

  const value = {
    user: profile,
    profile,
    session,
    loading,
    authError,
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

