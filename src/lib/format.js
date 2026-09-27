export function fmtFCFA(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

export function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

export function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString("fr-FR") : "—";
}

export function nightsBetween(d1, d2) {
  const diff = Math.round((new Date(d2) - new Date(d1)) / 86400000);
  return Math.max(1, diff);
}
