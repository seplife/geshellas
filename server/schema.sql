CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
  id VARCHAR(36) PRIMARY KEY,
  nom VARCHAR(255),
  prenoms VARCHAR(255),
  telephone VARCHAR(50),
  role ENUM('admin','gerant','reception','entretien') DEFAULT 'reception',
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chambres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(100),
  categorie VARCHAR(100),
  prix_nuit DECIMAL(12,2) NOT NULL,
  capacite INT DEFAULT 2,
  nombre_lits INT DEFAULT 1,
  etage INT DEFAULT 1,
  equipements TEXT,
  description TEXT,
  photo_url TEXT,
  statut ENUM('libre','occupee','reservee','nettoyage','maintenance') DEFAULT 'libre',
  panne_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prenoms VARCHAR(255),
  sexe ENUM('M','F'),
  date_naissance DATE,
  nationalite VARCHAR(100),
  profession VARCHAR(255),
  adresse TEXT,
  telephone VARCHAR(50) NOT NULL,
  whatsapp VARCHAR(50),
  email VARCHAR(255),
  type_piece VARCHAR(100),
  numero_piece VARCHAR(100),
  piece_photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sejours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(100) UNIQUE NOT NULL,
  client_id INT NOT NULL,
  chambre_id INT NOT NULL,
  date_entree DATE NOT NULL,
  heure_entree TIME NOT NULL,
  date_sortie_prevue DATE NOT NULL,
  heure_sortie_prevue TIME NOT NULL,
  date_sortie_reelle DATE,
  heure_sortie_reelle TIME,
  nb_personnes INT DEFAULT 1,
  statut ENUM('en_cours','termine','annule') DEFAULT 'en_cours',
  montant_total DECIMAL(12,2) NOT NULL,
  montant_paye DECIMAL(12,2) DEFAULT 0,
  solde DECIMAL(12,2) DEFAULT 0,
  cree_par VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (chambre_id) REFERENCES chambres(id),
  FOREIGN KEY (cree_par) REFERENCES users(id)
);

CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom_client TEXT NOT NULL,
  telephone VARCHAR(50),
  client_id INT,
  chambre_id INT NOT NULL,
  date_arrivee DATE NOT NULL,
  date_depart DATE NOT NULL,
  statut ENUM('en_attente','confirmee','annulee','client_arrive','client_absent') DEFAULT 'en_attente',
  montant DECIMAL(12,2) DEFAULT 0,
  avance DECIMAL(12,2) DEFAULT 0,
  cree_par VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (chambre_id) REFERENCES chambres(id),
  FOREIGN KEY (cree_par) REFERENCES users(id)
);

CREATE TABLE paiements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sejour_id INT,
  reservation_id INT,
  montant DECIMAL(12,2) NOT NULL,
  mode_paiement VARCHAR(100) NOT NULL,
  reference VARCHAR(255),
  date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  utilisateur_id VARCHAR(36),
  FOREIGN KEY (sejour_id) REFERENCES sejours(id),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  FOREIGN KEY (utilisateur_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(100),
  destinataire VARCHAR(255),
  message TEXT,
  statut ENUM('en_attente','envoyee','echec') DEFAULT 'en_attente',
  tentatives INT DEFAULT 0,
  erreur TEXT,
  reference_externe VARCHAR(255),
  sejour_id INT,
  date_envoi TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sejour_id) REFERENCES sejours(id)
);

CREATE TABLE parametres (
  cle VARCHAR(255) PRIMARY KEY,
  valeur TEXT
);

INSERT INTO parametres (cle, valeur) VALUES ('manager_whatsapp', '+2250779535795');
