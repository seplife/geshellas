import { supabase, raise } from "../lib/supabaseClient.js";
import { localStore } from "../lib/localStore.js";
import { getRoomClimatisation, getPassageHoraire } from "../constants.js";
import { MONTH_NAMES, nightsBetween } from "../lib/format.js";

const pad = (n) => String(n).padStart(2, "0");

function getLocalYearMonth(isoOrDateStr) {
  if (!isoOrDateStr) return null;
  const str = String(isoOrDateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return { year: y, month: m, day: d, dateStr: str };
  }
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return null;
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  return {
    year,
    month,
    day,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
  };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export async function getMonthlyFinancialReport({ year, month } = {}) {
  const now = new Date();
  const targetYear = Number(year) || now.getFullYear();
  const targetMonth = Number(month) || now.getMonth() + 1;

  // Plage de lecture : depuis décembre de l'année N-1 (pour l'évolution mensuelle de janvier) jusqu'à fin d'année N
  const startIso = new Date(targetYear - 1, 11, 1).toISOString();
  const endIso = new Date(targetYear + 1, 0, 1).toISOString();

  const [payRes, stayRes, roomRes] = await Promise.all([
    supabase
      .from("paiements")
      .select("*, sejours(id, numero, chambre_id, client_id, montant_total, chambres(id, numero, type, categorie, equipements), clients(nom, prenoms)), reservations(id, nom_client, chambre_id, chambres(id, numero, type))")
      .gte("date_paiement", startIso)
      .lt("date_paiement", endIso)
      .order("date_paiement", { ascending: false }),
    supabase
      .from("sejours")
      .select("*, clients(nom, prenoms), chambres(id, numero, type, categorie, equipements, prix_nuit)")
      .gte("date_entree", `${targetYear - 1}-12-01`)
      .lte("date_entree", `${targetYear}-12-31`)
      .order("date_entree", { ascending: false }),
    supabase.from("chambres").select("*").order("numero", { ascending: true }),
  ]);

  if (payRes.error) raise(payRes.error);
  if (stayRes.error) raise(stayRes.error);
  if (roomRes.error) raise(roomRes.error);

  const rooms = (roomRes.data || []).map((r) => ({
    ...r,
    climatisation: getRoomClimatisation(r),
    prix_passage_heure: getPassageHoraire(r),
  }));
  const roomMap = new Map(rooms.map((r) => [Number(r.id), r]));

  // Séjours (Supabase + localStore)
  const remoteStays = (stayRes.data || []).map((s) => {
    const room = roomMap.get(Number(s.chambre_id)) || s.chambres;
    const isPassage = s.type_sejour === "passage" || String(s.numero || "").startsWith("PAS-");
    const clim = s.type_climatisation || getRoomClimatisation(room);
    const tarif = isPassage ? Number(s.tarif_horaire) || getPassageHoraire(clim) : null;
    const duree = isPassage
      ? Number(s.duree_heures) || Math.max(1, Math.round(Number(s.montant_total || 0) / (tarif || 2500)))
      : null;
    return {
      ...s,
      type_sejour: isPassage ? "passage" : "nuitee",
      type_climatisation: isPassage ? clim : null,
      tarif_horaire: tarif,
      duree_heures: duree,
      chambre_numero: room?.numero || s.chambres?.numero || "",
      client_nom: s.clients?.nom || (isPassage ? "Client" : ""),
      client_prenoms: s.clients?.prenoms || (isPassage ? "de passage" : ""),
    };
  });

  const localStays = localStore
    .listStays()
    .filter((ls) => ls.local_only && !remoteStays.some((rs) => rs.numero === ls.numero));
  const allStays = [...localStays, ...remoteStays];
  const stayMap = new Map(allStays.map((s) => [Number(s.id), s]));

  // Paiements (Supabase + localStore)
  const remotePayments = (payRes.data || []).map((p) => {
    const sejour = p.sejours || stayMap.get(Number(p.sejour_id));
    const resa = p.reservations;
    const room =
      roomMap.get(Number(sejour?.chambre_id || resa?.chambre_id)) ||
      sejour?.chambres ||
      resa?.chambres;

    const isPassage =
      sejour?.type_sejour === "passage" ||
      String(sejour?.numero || "").startsWith("PAS-") ||
      /passage/i.test(p.reference || "");

    const clim = isPassage
      ? sejour?.type_climatisation ||
        (/ventil/i.test(p.reference || "") ? "ventilee" : getRoomClimatisation(room))
      : null;

    const clientLabel = sejour?.clients
      ? `${sejour.clients.nom} ${sejour.clients.prenoms}`.trim()
      : sejour?.client_nom
        ? `${sejour.client_nom} ${sejour.client_prenoms || ""}`.trim()
        : resa?.nom_client || (isPassage ? "Client de passage" : "");

    const chambreNumero = room?.numero || sejour?.chambre_numero || "";
    const origine = sejour?.numero
      ? `${isPassage ? "Passage" : "Séjour"} ${sejour.numero}`
      : resa
        ? "Réservation"
        : "Paiement";

    return {
      ...p,
      type_sejour: isPassage ? "passage" : sejour ? "nuitee" : resa ? "reservation" : "autre",
      type_climatisation: clim,
      chambre_id: Number(sejour?.chambre_id || resa?.chambre_id || room?.id || 0) || null,
      chambre_numero: chambreNumero,
      client_label: clientLabel,
      origine,
      parsedDate: getLocalYearMonth(p.date_paiement),
    };
  });

  const localPayments = localStore
    .listPayments()
    .filter((lp) => lp.local_only)
    .map((lp) => {
      const sejour = localStays.find((s) => Number(s.id) === Number(lp.sejour_id));
      const clim =
        lp.type_climatisation ||
        sejour?.type_climatisation ||
        (/ventil/i.test(lp.reference || "") ? "ventilee" : "climatisee");
      return {
        ...lp,
        chambre_id: Number(sejour?.chambre_id || 0) || null,
        type_climatisation: lp.type_sejour === "passage" ? clim : null,
        parsedDate: getLocalYearMonth(lp.date_paiement),
      };
    });

  const allPayments = [...localPayments, ...remotePayments].sort((a, b) =>
    String(b.date_paiement || "").localeCompare(String(a.date_paiement || ""))
  );

  // Agrégation annuelle (les 12 mois de targetYear)
  const annualMonths = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const mPayments = allPayments.filter(
      (p) => p.parsedDate?.year === targetYear && p.parsedDate?.month === m
    );
    const mStays = allStays.filter((s) => {
      const d = getLocalYearMonth(s.date_entree);
      return d?.year === targetYear && d?.month === m && s.statut !== "annule";
    });

    let total = 0;
    let nuitees = 0;
    let passages = 0;
    let passagesVentilee = 0;
    let passagesClimatisee = 0;
    let reservations = 0;

    for (const p of mPayments) {
      const val = Number(p.montant) || 0;
      total += val;
      if (p.type_sejour === "passage") {
        passages += val;
        if (p.type_climatisation === "ventilee") passagesVentilee += val;
        else passagesClimatisee += val;
      } else if (p.type_sejour === "reservation") {
        reservations += val;
      } else {
        nuitees += val;
      }
    }

    const stayNuitees = mStays.filter((s) => s.type_sejour !== "passage");
    const stayPassages = mStays.filter((s) => s.type_sejour === "passage");
    const heuresPassages = stayPassages.reduce((acc, s) => acc + (Number(s.duree_heures) || 1), 0);

    return {
      month: m,
      label: MONTH_NAMES[idx],
      shortLabel: MONTH_NAMES[idx].slice(0, 4),
      total,
      recettes_nuitees: nuitees,
      recettes_passages: passages,
      recettes_passages_ventilee: passagesVentilee,
      recettes_passages_climatisee: passagesClimatisee,
      recettes_reservations: reservations,
      nb_paiements: mPayments.length,
      nb_sejours: stayNuitees.length,
      nb_passages: stayPassages.length,
      heures_passages: heuresPassages,
    };
  });

  // Mois précédent pour le calcul de croissance
  const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
  const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
  const prevMonthPayments = allPayments.filter(
    (p) => p.parsedDate?.year === prevYear && p.parsedDate?.month === prevMonth
  );
  const prevMonthTotal = prevMonthPayments.reduce((a, p) => a + (Number(p.montant) || 0), 0);

  // Détail du mois sélectionné
  const monthPayments = allPayments.filter(
    (p) => p.parsedDate?.year === targetYear && p.parsedDate?.month === targetMonth
  );
  const monthStays = allStays.filter((s) => {
    const d = getLocalYearMonth(s.date_entree);
    return d?.year === targetYear && d?.month === targetMonth && s.statut !== "annule";
  });

  const currentSummary = annualMonths[targetMonth - 1];
  const totalRecettes = currentSummary.total;
  const evolutionPct =
    prevMonthTotal > 0
      ? Math.round(((totalRecettes - prevMonthTotal) / prevMonthTotal) * 100)
      : null;

  // Ventilation par jour du mois
  const nbDays = daysInMonth(targetYear, targetMonth);
  const parJour = Array.from({ length: nbDays }, (_, idx) => {
    const dayNum = idx + 1;
    const dateStr = `${targetYear}-${pad(targetMonth)}-${pad(dayNum)}`;
    const dayPays = monthPayments.filter((p) => p.parsedDate?.dateStr === dateStr);
    let total = 0;
    let nuitees = 0;
    let passages = 0;
    for (const p of dayPays) {
      const v = Number(p.montant) || 0;
      total += v;
      if (p.type_sejour === "passage") passages += v;
      else nuitees += v;
    }
    return {
      jour: dateStr,
      dayNum,
      total,
      nuitees,
      passages,
    };
  });

  // Ventilation par mode de paiement
  const modeMap = {};
  for (const p of monthPayments) {
    const mode = p.mode_paiement || "Espèces";
    if (!modeMap[mode]) modeMap[mode] = { mode, montant: 0, count: 0 };
    modeMap[mode].montant += Number(p.montant) || 0;
    modeMap[mode].count += 1;
  }
  const parMode = Object.values(modeMap)
    .sort((a, b) => b.montant - a.montant)
    .map((m) => ({
      ...m,
      pct: totalRecettes > 0 ? Math.round((m.montant / totalRecettes) * 100) : 0,
    }));

  // Ventilation par chambre
  const parChambre = rooms
    .map((r) => {
      const rPays = monthPayments.filter(
        (p) => Number(p.chambre_id) === Number(r.id) || p.chambre_numero === r.numero
      );
      const rStays = monthStays.filter(
        (s) => Number(s.chambre_id) === Number(r.id) || s.chambre_numero === r.numero
      );
      const rNuitees = rStays.filter((s) => s.type_sejour !== "passage");
      const rPassages = rStays.filter((s) => s.type_sejour === "passage");
      const recettes = rPays.reduce((a, p) => a + (Number(p.montant) || 0), 0);
      const recettesPassages = rPays
        .filter((p) => p.type_sejour === "passage")
        .reduce((a, p) => a + (Number(p.montant) || 0), 0);
      const recettesNuitees = recettes - recettesPassages;
      const heuresPassages = rPassages.reduce((a, s) => a + (Number(s.duree_heures) || 1), 0);
      const nuitsVendues = rNuitees.reduce(
        (a, s) => a + nightsBetween(s.date_entree, s.date_sortie_reelle || s.date_sortie_prevue),
        0
      );
      return {
        id: r.id,
        numero: r.numero,
        type: r.type,
        climatisation: r.climatisation,
        prix_nuit: r.prix_nuit,
        prix_passage_heure: r.prix_passage_heure,
        nb_sejours: rNuitees.length,
        nuits_vendues: nuitsVendues,
        nb_passages: rPassages.length,
        heures_passages: heuresPassages,
        recettes_nuitees: recettesNuitees,
        recettes_passages: recettesPassages,
        recettes,
      };
    })
    .sort((a, b) => b.recettes - a.recettes);

  const monthNuiteeStays = monthStays.filter((s) => s.type_sejour !== "passage");
  const monthPassageStays = monthStays.filter((s) => s.type_sejour === "passage");
  const nbNuitsVendues = monthNuiteeStays.reduce(
    (a, s) => a + nightsBetween(s.date_entree, s.date_sortie_reelle || s.date_sortie_prevue),
    0
  );
  const impayesMois = monthStays.reduce((a, s) => a + Math.max(0, Number(s.solde || 0)), 0);

  return {
    year: targetYear,
    month: targetMonth,
    annualMonths,
    annualTotal: annualMonths.reduce((a, m) => a + m.total, 0),
    annualNuitees: annualMonths.reduce((a, m) => a + m.recettes_nuitees, 0),
    annualPassages: annualMonths.reduce((a, m) => a + m.recettes_passages, 0),
    annualReservations: annualMonths.reduce((a, m) => a + m.recettes_reservations, 0),
    selectedMonth: {
      year: targetYear,
      month: targetMonth,
      label: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
      total_recettes: totalRecettes,
      prev_month_recettes: prevMonthTotal,
      evolution_pct: evolutionPct,
      recettes_nuitees: currentSummary.recettes_nuitees,
      recettes_passages: currentSummary.recettes_passages,
      recettes_passages_ventilee: currentSummary.recettes_passages_ventilee,
      recettes_passages_climatisee: currentSummary.recettes_passages_climatisee,
      recettes_reservations: currentSummary.recettes_reservations,
      nb_paiements: monthPayments.length,
      nb_sejours_nuitee: monthNuiteeStays.length,
      nb_nuits_vendues: nbNuitsVendues,
      nb_passages: monthPassageStays.length,
      nb_passages_ventilee: monthPassageStays.filter((s) => s.type_climatisation === "ventilee").length,
      nb_passages_climatisee: monthPassageStays.filter((s) => s.type_climatisation !== "ventilee").length,
      heures_passages: currentSummary.heures_passages,
      impayes_mois: impayesMois,
      moyenne_journaliere: nbDays > 0 ? Math.round(totalRecettes / nbDays) : 0,
      par_jour: parJour,
      par_mode: parMode,
      par_chambre: parChambre,
      paiements: monthPayments,
    },
  };
}
