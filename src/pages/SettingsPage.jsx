import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Field, Input } from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { Skeleton } from "../components/ui/Spinner.jsx";

const PHONE_RE = /^\+\d{8,15}$/;

export default function SettingsPage({ settings, error, onRetry, onSave, submitting }) {
  const [number, setNumber] = useState("");

  useEffect(() => {
    if (settings) setNumber(settings.manager_whatsapp || "");
  }, [settings]);

  const clean = number.replace(/[\s.-]/g, "");
  const invalid = clean && !PHONE_RE.test(clean);

  return (
    <div className="flex flex-col gap-5 max-w-xl animate-fade-in">
      <PageHeader title="Paramètres" subtitle="Configuration des notifications WhatsApp." />
      {error && <ErrorState message={error} onRetry={onRetry} />}
      {!settings ? (
        !error && <Skeleton className="h-40" />
      ) : (
        <form
          className="card p-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ manager_whatsapp: clean });
          }}
        >
          <Field
            label="Numéro WhatsApp du gérant"
            required
            hint="Format international, ex. +2250700000000"
            error={invalid ? "Numéro invalide : commencez par + suivi de l'indicatif pays." : null}
          >
            <Input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="+225…" />
          </Field>
          <Button type="submit" icon={Save} loading={submitting} disabled={!clean || invalid} className="self-start">
            Enregistrer
          </Button>
        </form>
      )}
      <div className="text-xs rounded-xl p-3 bg-brand-50 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100 leading-relaxed">
        Les identifiants de l'API WhatsApp Business (token, phone_number_id) sont des secrets de l'Edge Function
        <code className="mx-1">notify</code> dans Supabase — jamais dans l'application.
      </div>
    </div>
  );
}
