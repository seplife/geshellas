export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.code === "23505") {
    return res.status(409).json({ error: "Cette valeur existe déjà (conflit d'unicité)." });
  }
  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Données invalides.", details: err.issues });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Erreur interne du serveur." });
}
