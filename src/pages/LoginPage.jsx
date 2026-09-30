import React, { useState } from "react";
import { Eye, EyeOff, LogIn, UserPlus, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Field, Input } from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import { Logo } from "../components/layout/Sidebar.jsx";

export default function LoginPage() {
  const { login, register, authError } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"

  const [nom, setNom] = useState("");
  const [prenoms, setPrenoms] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (mode === "register") {
      if (!nom.trim() || !prenoms.trim()) {
        setError("Veuillez renseigner votre nom et vos prénoms.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Veuillez saisir une adresse e-mail valide.");
        return;
      }
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }

      setLoading(true);
      try {
        const res = await register({
          nom: nom.trim(),
          prenoms: prenoms.trim(),
          telephone: telephone.trim(),
          email: email.trim(),
          password,
        });
        setLoading(false);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setSuccessMsg(
          res?.message || "Compte créé avec succès. Vous pouvez maintenant vous connecter."
        );
      } catch (err) {
        setError(err.message || "Impossible de créer le compte.");
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || "Connexion impossible.");
      setLoading(false);
    }
  };

  const message = error || authError;
  const isRegister = mode === "register";
  const canSubmit = isRegister
    ? Boolean(nom.trim() && prenoms.trim() && email.trim() && password && confirmPassword)
    : Boolean(email.trim() && password);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="font-display text-lg font-semibold">Hellas Hôtel</div>
            <div className="text-xs text-white/60">Divo · Côte d'Ivoire</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight max-w-md">
            La gestion de l'hôtel, en temps réel.
          </h1>
          <p className="text-white/70 mt-4 max-w-md">
            Chambres, réservations, séjours, encaissements et alertes WhatsApp au gérant, depuis un seul écran.
          </p>
        </div>
        <div className="text-xs text-white/40">© {new Date().getFullYear()} Hôtel Hellas</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <Logo size="lg" />
            <div className="text-2xl font-semibold font-display mt-3 text-brand-700 dark:text-brand-100">Hellas Hôtel Manager</div>
            <div className="text-sm text-stone-500 dark:text-stone-400 mt-1">Divo · Côte d'Ivoire</div>
          </div>

          {/* Sélecteur d'onglets Connexion / Inscription */}
          <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-stone-100 dark:bg-stone-800">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`py-2 text-sm font-medium rounded-lg transition ${
                !isRegister
                  ? "bg-white dark:bg-stone-900 text-brand-700 dark:text-brand-100 shadow-sm"
                  : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`py-2 text-sm font-medium rounded-lg transition ${
                isRegister
                  ? "bg-white dark:bg-stone-900 text-brand-700 dark:text-brand-100 shadow-sm"
                  : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              Créer un compte
            </button>
          </div>

          <h2 className="text-2xl font-semibold text-brand-700 dark:text-brand-100 hidden lg:block">
            {isRegister ? "Créer un compte" : "Connexion"}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-6 hidden lg:block">
            {isRegister
              ? "Inscrivez-vous pour créer votre compte avant de vous connecter."
              : "Connectez-vous avec votre compte pour accéder à l'application."}
          </p>

          {successMsg && !isRegister && (
            <div
              role="status"
              className="flex items-start gap-2.5 text-sm rounded-xl px-3.5 py-3 mb-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nom" required>
                    <Input
                      type="text"
                      required
                      autoFocus
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Kouassi"
                    />
                  </Field>
                  <Field label="Prénoms" required>
                    <Input
                      type="text"
                      required
                      value={prenoms}
                      onChange={(e) => setPrenoms(e.target.value)}
                      placeholder="Jean"
                    />
                  </Field>
                </div>
                <Field label="Téléphone">
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="07 00 00 00 00"
                  />
                </Field>
              </>
            )}

            <Field label="Adresse e-mail" required>
              <Input
                type="email"
                required
                autoFocus={!isRegister}
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@hellas-hotel.ci"
              />
            </Field>

            <Field
              label="Mot de passe"
              required
              hint={isRegister ? "Minimum 6 caractères." : undefined}
            >
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {isRegister && (
              <Field label="Confirmer le mot de passe" required>
                <Input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
            )}

            {message && (
              <div role="alert" className="text-sm rounded-xl px-3 py-2.5 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {message}
              </div>
            )}

            <Button
              type="submit"
              icon={isRegister ? UserPlus : LogIn}
              loading={loading}
              disabled={!canSubmit}
              className="w-full py-2.5 mt-1"
            >
              {isRegister
                ? loading
                  ? "Création du compte…"
                  : "S'inscrire"
                : loading
                ? "Connexion…"
                : "Se connecter"}
            </Button>
          </form>

          <p className="text-center text-sm text-stone-500 dark:text-stone-400 mt-6">
            {isRegister ? (
              <>
                Vous avez déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  Se connecter
                </button>
              </>
            ) : (
              <>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  Créer un compte
                </button>
              </>
            )}
          </p>

          {!isRegister && (
            <p className="text-center text-xs text-stone-400 mt-4">
              Mot de passe oublié ? Demandez à un administrateur de réinitialiser votre accès.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

