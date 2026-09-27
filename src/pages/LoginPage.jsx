import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Field, Input } from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-display">
            H
          </div>
          <div className="text-2xl font-semibold font-display">Hellas Hôtel Manager</div>
          <div className="text-sm text-white/70 mt-1">Divo, Côte d'Ivoire</div>
        </div>

        <form onSubmit={submit} className="card rounded-2xl2 p-6 flex flex-col gap-4 shadow-pop">
          <Field label="Adresse e-mail" required>
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@hellas-hotel.ci"
            />
          </Field>
          <Field label="Mot de passe" required>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && (
            <div className="text-sm rounded-xl px-3 py-2 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full mt-1">
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <p className="text-center text-xs text-white/50 mt-5">
          Accès réservé au personnel de l'Hôtel Hellas.
        </p>
      </div>
    </div>
  );
}
