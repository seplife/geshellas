import React, { useState } from "react";
import { Field, Input } from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";

export default function SettingsPage({ settings, onSave }) {
  const [number, setNumber] = useState(settings.manager_whatsapp || "");

  return (
    <div className="flex flex-col gap-4 max-w-md animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-brand-700 dark:text-brand-100">Paramètres</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Configuration des notifications.</p>
      </div>
      <div className="card rounded-2xl p-5 flex flex-col gap-4">
        <Field label="Numéro WhatsApp du gérant" required hint="Format international, ex. +2250700000000">
          <Input value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Button onClick={() => onSave({ manager_whatsapp: number })} className="self-start">
          Enregistrer
        </Button>
      </div>
      <div className="text-xs rounded-xl p-3 bg-brand-50 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">
        Les identifiants de l'API WhatsApp Business (token, phone_number_id) se configurent en tant que
        secrets Supabase de l'Edge Function <code>notify</code> — jamais ici ni dans le code du frontend.
      </div>
    </div>
  );
}
