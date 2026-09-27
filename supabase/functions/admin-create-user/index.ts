// Edge Function "admin-create-user"
// La création d'un compte avec mot de passe requiert l'API d'administration
// Supabase Auth (clé service_role) — impossible à faire en sécurité depuis le
// frontend. Cette fonction vérifie que l'appelant est bien un administrateur
// actif avant de créer le compte.
//
// Body attendu : { nom, prenoms, email, telephone?, role, password }

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

type Role = "admin" | "gerant" | "reception" | "entretien";

interface AdminCreateUserBody {
  nom: string;
  prenoms: string;
  email: string;
  telephone?: string | null;
  role: Role;
  password: string;
}

interface UserProfile {
  role: string;
  actif: boolean;
}

const ROLES: Role[] = ["admin", "gerant", "reception", "entretien"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const caller = supabaseAsCaller(authHeader);
    const {
      data: { user },
      error: authErr,
    } = await caller.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Authentification requise." }, 401);

    const db = supabaseAdmin();
    const { data: profile } = await db.from("profiles").select("role, actif").eq("id", user.id).single();
    if (!profile || profile.role !== "admin" || !profile.actif) {
      return jsonResponse({ error: "Accès non autorisé pour ce rôle." }, 403);
    }

    const body = await req.json();
    if (!body.nom || !body.prenoms || !body.email || !body.role || !body.password) {
      return jsonResponse({ error: "Champs requis manquants (nom, prenoms, email, role, password)." }, 400);
    }
    if (!ROLES.includes(body.role)) {
      return jsonResponse({ error: "Rôle invalide." }, 400);
    }
    if (String(body.password).length < 8) {
      return jsonResponse({ error: "Le mot de passe doit contenir au moins 8 caractères." }, 400);
    }

    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        nom: body.nom,
        prenoms: body.prenoms,
        telephone: body.telephone || null,
      },
      // Le rôle est placé dans app_metadata (modifiable uniquement avec la clé
      // service_role) : c'est la seule source lue par le trigger
      // handle_new_user, ce qui empêche un visiteur de s'auto-attribuer un rôle.
      app_metadata: { role: body.role },
    });
    if (createErr) {
      const msg = /already (been )?registered|already exists/i.test(createErr.message)
        ? "Un compte existe déjà avec cette adresse e-mail."
        : createErr.message;
      return jsonResponse({ error: msg }, 400);
    }

    return jsonResponse({
      id: created.user?.id,
      email: created.user?.email,
      nom: body.nom,
      prenoms: body.prenoms,
      role: body.role,
    }, 201);
  } catch (err) {
    console.error("Erreur admin-create-user:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur interne." }, 500);
  }
});
