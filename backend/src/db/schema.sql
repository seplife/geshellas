-- Schéma Hellas Hôtel Manager
-- Exécuté par src/db/migrate.js (idempotent grâce à IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS utilisateurs (
  id             SERIAL PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  prenoms        VARCHAR(100) NOT NULL,
  email          VARCHAR(150) UNIQUE NOT NULL,
  telephone      VARCHAR(30),
  role           VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'gerant', 'reception', 'entretien')),
  password_hash  TEXT NOT NULL,
  actif          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chambres (
  id             SERIAL PRIMARY KEY,
  numero         VARCHAR(20) UNIQUE NOT NULL,
  type           VARCHAR(50) NOT NULL,
  categorie      VARCHAR(50),
  prix_nuit      NUMERIC(12,2) NOT NULL,
  capacite       INTEGER NOT NULL DEFAULT 2,
  nombre_lits    INTEGER NOT NULL DEFAULT 1,
  etage          INTEGER NOT NULL DEFAULT 1,
  equipements    TEXT,
  description    TEXT,
  photo_url      TEXT,
  statut         VARCHAR(20) NOT NULL DEFAULT 'libre'
                 CHECK (statut IN ('libre', 'occupee', 'reservee', 'nettoyage', 'maintenance')),
  panne_note     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id             SERIAL PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  prenoms        VARCHAR(100) NOT NULL,
  sexe           VARCHAR(1) CHECK (sexe IN ('M', 'F')),
  date_naissance DATE,
  nationalite    VARCHAR(80),
  profession     VARCHAR(100),
  adresse        TEXT,
  telephone      VARCHAR(30) NOT NULL,
  whatsapp       VARCHAR(30),
  email          VARCHAR(150),
  type_piece     VARCHAR(30) NOT NULL,
  numero_piece   VARCHAR(60) NOT NULL,
  piece_photo_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_telephone ON clients (telephone);
CREATE INDEX IF NOT EXISTS idx_clients_numero_piece ON clients (numero_piece);

CREATE TABLE IF NOT EXISTS sejours (
  id                    SERIAL PRIMARY KEY,
  numero                VARCHAR(30) UNIQUE NOT NULL,
  client_id             INTEGER NOT NULL REFERENCES clients(id),
  chambre_id            INTEGER NOT NULL REFERENCES chambres(id),
  date_entree           DATE NOT NULL,
  heure_entree          TIME NOT NULL,
  date_sortie_prevue    DATE NOT NULL,
  heure_sortie_prevue   TIME NOT NULL,
  date_sortie_reelle    DATE,
  heure_sortie_reelle   TIME,
  nb_personnes          INTEGER NOT NULL DEFAULT 1,
  statut                VARCHAR(20) NOT NULL DEFAULT 'en_cours'
                        CHECK (statut IN ('en_cours', 'termine', 'annule')),
  montant_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_paye          NUMERIC(12,2) NOT NULL DEFAULT 0,
  solde                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  cree_par              INTEGER REFERENCES utilisateurs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sejours_statut ON sejours (statut);
CREATE INDEX IF NOT EXISTS idx_sejours_chambre ON sejours (chambre_id);

CREATE TABLE IF NOT EXISTS reservations (
  id             SERIAL PRIMARY KEY,
  nom_client     VARCHAR(150) NOT NULL,
  telephone      VARCHAR(30),
  client_id      INTEGER REFERENCES clients(id),
  chambre_id     INTEGER NOT NULL REFERENCES chambres(id),
  date_arrivee   DATE NOT NULL,
  date_depart    DATE NOT NULL,
  statut         VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                 CHECK (statut IN ('en_attente', 'confirmee', 'annulee', 'client_arrive', 'client_absent')),
  montant        NUMERIC(12,2) NOT NULL DEFAULT 0,
  avance         NUMERIC(12,2) NOT NULL DEFAULT 0,
  cree_par       INTEGER REFERENCES utilisateurs(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_chambre_dates ON reservations (chambre_id, date_arrivee, date_depart);

CREATE TABLE IF NOT EXISTS paiements (
  id              SERIAL PRIMARY KEY,
  sejour_id       INTEGER REFERENCES sejours(id),
  reservation_id  INTEGER REFERENCES reservations(id),
  montant         NUMERIC(12,2) NOT NULL,
  mode_paiement   VARCHAR(30) NOT NULL,
  reference       VARCHAR(60),
  date_paiement   TIMESTAMPTZ NOT NULL DEFAULT now(),
  utilisateur_id  INTEGER REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id             SERIAL PRIMARY KEY,
  type           VARCHAR(40) NOT NULL,
  destinataire   VARCHAR(30) NOT NULL,
  message        TEXT NOT NULL,
  statut         VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                 CHECK (statut IN ('en_attente', 'envoyee', 'echec')),
  tentatives     INTEGER NOT NULL DEFAULT 0,
  erreur         TEXT,
  reference_externe TEXT,
  date_envoi     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historique_statuts_chambres (
  id                 SERIAL PRIMARY KEY,
  chambre_id         INTEGER NOT NULL REFERENCES chambres(id),
  ancien_statut      VARCHAR(20),
  nouveau_statut     VARCHAR(20) NOT NULL,
  utilisateur_id     INTEGER REFERENCES utilisateurs(id),
  date_modification  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_activite (
  id             SERIAL PRIMARY KEY,
  utilisateur_id INTEGER REFERENCES utilisateurs(id),
  action         VARCHAR(80) NOT NULL,
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parametres (
  cle    VARCHAR(60) PRIMARY KEY,
  valeur TEXT
);
