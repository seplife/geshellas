import React, { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Field, Input } from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import { Logo } from "../components/layout/Sidebar.jsx";

export default function LoginPage() {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Connexion impossible.");
      setLoading(false);
    }
  };

  const message = error || authError;

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

          <h2 className="text-2xl font-semibold text-brand-700 dark:text-brand-100 hidden lg:block">Connexion</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-6 hidden lg:block">
            Accès réservé au personnel de l'hôtel.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Adresse e-mail" required>
              <Input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@hellas-hotel.ci"
              />
            </Field>
            <Field label="Mot de passe" required>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
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
            {message && (
              <div role="alert" className="text-sm rounded-xl px-3 py-2.5 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {message}
              </div>
            )}
            <Button type="submit" icon={LogIn} loading={loading} disabled={!email || !password} className="w-full py-2.5 mt-1">
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
          <p className="text-center text-xs text-stone-400 mt-8">
            Mot de passe oublié ? Demandez à un administrateur de réinitialiser votre accès.
          </p>
        </div>
      </div>
    </div>
  );
}
