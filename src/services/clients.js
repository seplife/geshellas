import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";

function isMissingRpc(error) {
  const msg = error?.message || "";
  return (
    error?.code === "PGRST202" ||
    error?.code === "42501" ||
    /schema cache|update_client|delete_client/i.test(msg)
  );
}

export async function listClients(q = "") {
  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const term = q.trim();
  if (term) {
    query = query.or(
      `nom.ilike.%${term}%,prenoms.ilike.%${term}%,telephone.ilike.%${term}%,numero_piece.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) raise(error);

  const { patches, deletedIds } = localStore.getClientOverrides();

  const remoteList = (data || [])
    .filter((c) => !deletedIds.includes(Number(c.id)))
    .map((c) => ({
      ...c,
      ...(patches[String(c.id)] || {}),
    }));

  const localClients = localStore
    .listClients(q)
    .filter(
      (lc) =>
        !deletedIds.includes(Number(lc.id)) &&
        !remoteList.some(
          (rc) =>
            Number(rc.id) === Number(lc.id) ||
            (rc.numero_piece &&
              rc.numero_piece === lc.numero_piece &&
              rc.nom === lc.nom)
        )
    );

  return [...localClients, ...remoteList];
}

export async function getClient(id) {
  const { patches, deletedIds } = localStore.getClientOverrides();
  if (deletedIds.includes(Number(id))) {
    throw new Error("Client introuvable.");
  }

  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (cErr) raise(cErr);

  if (!client) {
    // Repli sur client local (ex. passage enregistré en local)
    return localStore.getClient(id);
  }

  const { data: sejours, error: sErr } = await supabase
    .from("sejours")
    .select("*, chambres(numero)")
    .eq("client_id", id)
    .order("date_entree", { ascending: false });
  if (sErr) raise(sErr);

  const { deletedIds: deletedSejourIds } = localStore.getSejourOverrides();

  return {
    ...client,
    ...(patches[String(id)] || {}),
    sejours: (sejours || [])
      .filter((s) => !deletedSejourIds.includes(Number(s.id)))
      .map((s) => ({
        ...s,
        chambre_numero: s.chambres?.numero || "",
      })),
  };
}

export async function updateClient(id, patch) {
  const { data, error } = await supabase.rpc("update_client", {
    p_id: id,
    p_client: patch,
  });

  if (error) {
    if (isMissingRpc(error)) {
      return localStore.updateClient(id, patch);
    }
    raise(error);
  }
  localStore.updateClient(id, patch);
  return data;
}

export async function deleteClient(id) {
  const { error } = await supabase.rpc("delete_client", { p_id: id });

  if (error) {
    if (isMissingRpc(error)) {
      localStore.deleteClient(id);
      return;
    }
    raise(error);
  }
  localStore.deleteClient(id);
}
