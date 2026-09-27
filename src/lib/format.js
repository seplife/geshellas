const pad = (n) => String(n).padStart(2, "0");

export function fmtFCFA(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;
}

/** Montant compact pour les axes (ex. 125 k). */
export function fmtShortFCFA(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (v >= 1000) return `${Math.round(v / 1000)} k`;
  return String(Math.round(v));
}

/** Date locale au format AAAA-MM-JJ (et non UTC comme toISOString). */
export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Interprète « AAAA-MM-JJ » comme une date locale (évite le décalage UTC). */
function parseDate(d) {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

export function fmtDate(d) {
  const date = parseDate(d);
  return date ? date.toLocaleDateString("fr-FR") : "—";
}

export function fmtDateShort(d) {
  const date = parseDate(d);
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—";
}

export function fmtWeekday(d) {
  const date = parseDate(d);
  return date ? date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "") : "";
}

export function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

/** « 14:05:33.123 » → « 14:05 ». */
export function fmtTime(t) {
  return t ? String(t).slice(0, 5) : "";
}

export function nightsBetween(d1, d2) {
  const a = parseDate(d1);
  const b = parseDate(d2);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
}

export function fullName(p) {
  return [p?.nom, p?.prenoms].filter(Boolean).join(" ");
}
