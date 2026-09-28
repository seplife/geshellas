const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { sendToAll, getRecipients, buildCheckInMessage, buildCheckOutMessage } = require('../services/whatsapp');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const { statut } = req.query;
  try {
    let query = `
      SELECT s.*, c.numero as chambre_numero, cl.nom as client_nom, cl.prenoms as client_prenoms, cl.telephone as client_telephone
      FROM sejours s
      JOIN chambres c ON s.chambre_id = c.id
      JOIN clients cl ON s.client_id = cl.id
    `;
    const params = [];
    if (statut) {
      query += ' WHERE s.statut = ?';
      params.push(statut);
    }
    query += ' ORDER BY s.created_at DESC';
    
    const [sejours] = await pool.query(query, params);
    res.json(sejours);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séjours.' });
  }
});

router.post('/checkin', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { client, chambre_id, date_entree, heure_entree, date_sortie_prevue, heure_sortie_prevue, nb_personnes, avance, mode_paiement } = req.body;

    const [chambreCheck] = await connection.query('SELECT statut, prix_nuit FROM chambres WHERE id = ? FOR UPDATE', [chambre_id]);
    if (chambreCheck.length === 0) throw new Error('Chambre non trouvée');
    if (chambreCheck[0].statut !== 'libre') throw new Error('La chambre n\'est pas libre');

    const prix_nuit = chambreCheck[0].prix_nuit;

    const [clientRes] = await connection.query(
      `INSERT INTO clients (nom, prenoms, sexe, date_naissance, nationalite, profession, adresse, telephone, whatsapp, email, type_piece, numero_piece)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client.nom, client.prenoms, client.sexe, client.date_naissance, client.nationalite, client.profession, client.adresse, client.telephone, client.whatsapp, client.email, client.type_piece, client.numero_piece]
    );
    const clientId = clientRes.insertId;

    const dateEntree = new Date(date_entree);
    const dateSortie = new Date(date_sortie_prevue);
    const diffTime = Math.abs(dateSortie - dateEntree);
    let nuits = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (nuits === 0) nuits = 1;
    const montantTotal = nuits * prix_nuit;
    const numeroSejour = `SEJ-${Date.now()}`;
    const solde = montantTotal - (avance || 0);

    const [sejourRes] = await connection.query(
      `INSERT INTO sejours (numero, client_id, chambre_id, date_entree, heure_entree, date_sortie_prevue, heure_sortie_prevue, nb_personnes, montant_total, montant_paye, solde, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numeroSejour, clientId, chambre_id, date_entree, heure_entree, date_sortie_prevue, heure_sortie_prevue, nb_personnes, montantTotal, avance || 0, solde, req.user.id]
    );

    if (avance > 0) {
      await connection.query(
        'INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id) VALUES (?, ?, ?, ?)',
        [sejourRes.insertId, avance, mode_paiement, req.user.id]
      );
    }

    await connection.query('UPDATE chambres SET statut = ? WHERE id = ?', ['occupee', chambre_id]);

    await connection.commit();

    // Notification WhatsApp — envoi non-bloquant (fire-and-forget)
    setImmediate(async () => {
      try {
        const [chambresRows] = await pool.query('SELECT numero FROM chambres WHERE id = ?', [chambre_id]);
        const chambre = chambresRows[0] || { numero: String(chambre_id) };

        const [sejourRows] = await pool.query('SELECT * FROM sejours WHERE id = ?', [sejourRes.insertId]);
        const sejour = sejourRows[0] || {};

        const message = buildCheckInMessage({
          client: { nom: client.nom, prenoms: client.prenoms, telephone: client.telephone },
          chambre,
          sejour: {
            heure_entree,
            date_entree,
            date_sortie_prevue,
            montant_total: montantTotal,
          },
        });

        const recipients = getRecipients();
        if (recipients.length > 0) {
          await sendToAll(recipients, message);
        }
      } catch (notifErr) {
        console.error('[WhatsApp] Erreur lors de l\'envoi de la notification check-in :', notifErr);
      }
    });

    res.status(201).json({ message: 'Check-in réussi', sejour_id: sejourRes.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Erreur lors du check-in.' });
  } finally {
    connection.release();
  }
});

router.post('/checkout/:id', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { montant_supplementaire, mode_paiement } = req.body;

    const [sejours] = await connection.query('SELECT chambre_id, statut FROM sejours WHERE id = ? FOR UPDATE', [id]);
    if (sejours.length === 0) throw new Error('Séjour non trouvé');
    const sejour = sejours[0];

    if (sejour.statut !== 'en_cours') throw new Error('Ce séjour n\'est pas en cours');

    if (montant_supplementaire > 0) {
      await connection.query(
        'INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id) VALUES (?, ?, ?, ?)',
        [id, montant_supplementaire, mode_paiement, req.user.id]
      );
      await connection.query(
        'UPDATE sejours SET montant_paye = montant_paye + ?, solde = solde - ? WHERE id = ?',
        [montant_supplementaire, montant_supplementaire, id]
      );
    }

    await connection.query(
      'UPDATE sejours SET statut = ?, date_sortie_reelle = CURDATE(), heure_sortie_reelle = CURTIME() WHERE id = ?',
      ['termine', id]
    );

    await connection.query('UPDATE chambres SET statut = ? WHERE id = ?', ['nettoyage', sejour.chambre_id]);

    await connection.commit();

    // Notification WhatsApp — envoi non-bloquant (fire-and-forget)
    const chambreIdForNotif = sejour.chambre_id;
    const sejourIdForNotif = id;
    setImmediate(async () => {
      try {
        const [sejourRows] = await pool.query(`
          SELECT s.*, c.nom as client_nom, c.prenoms as client_prenoms, c.telephone as client_telephone,
                 ch.numero as chambre_numero
          FROM sejours s
          JOIN clients c ON s.client_id = c.id
          JOIN chambres ch ON s.chambre_id = ch.id
          WHERE s.id = ?
        `, [sejourIdForNotif]);

        if (sejourRows.length > 0) {
          const row = sejourRows[0];
          const message = buildCheckOutMessage({
            client: { nom: row.client_nom, prenoms: row.client_prenoms },
            chambre: { numero: row.chambre_numero },
            sejour: {
              heure_sortie_reelle: row.heure_sortie_reelle,
              date_sortie_reelle: row.date_sortie_reelle,
              montant_total: row.montant_total,
              montant_paye: row.montant_paye,
              solde: row.solde,
            },
          });

          const recipients = getRecipients();
          if (recipients.length > 0) {
            await sendToAll(recipients, message);
          }
        }
      } catch (notifErr) {
        console.error('[WhatsApp] Erreur lors de l\'envoi de la notification check-out :', notifErr);
      }
    });

    res.json({ message: 'Checkout réussi' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Erreur lors du checkout.' });
  } finally {
    connection.release();
  }
});

router.post('/extend/:id', auth, requireRole('admin', 'reception'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { nouvelle_date_sortie, nouvelle_heure_sortie, paiement_supplementaire, mode_paiement } = req.body;

    const [sejours] = await connection.query(`
      SELECT s.*, c.prix_nuit 
      FROM sejours s JOIN chambres c ON s.chambre_id = c.id 
      WHERE s.id = ? FOR UPDATE
    `, [id]);

    if (sejours.length === 0) throw new Error('Séjour non trouvé');
    const sejour = sejours[0];

    const dateEntree = new Date(sejour.date_entree);
    const dateSortie = new Date(nouvelle_date_sortie);
    const diffTime = Math.abs(dateSortie - dateEntree);
    let nuits = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (nuits === 0) nuits = 1;
    
    const nouveauMontantTotal = nuits * sejour.prix_nuit;
    
    if (paiement_supplementaire > 0) {
      await connection.query(
        'INSERT INTO paiements (sejour_id, montant, mode_paiement, utilisateur_id) VALUES (?, ?, ?, ?)',
        [id, paiement_supplementaire, mode_paiement, req.user.id]
      );
    }

    await connection.query(
      `UPDATE sejours 
       SET date_sortie_prevue = ?, heure_sortie_prevue = ?, montant_total = ?, montant_paye = montant_paye + ?, solde = ? - (montant_paye + ?)
       WHERE id = ?`,
      [nouvelle_date_sortie, nouvelle_heure_sortie, nouveauMontantTotal, paiement_supplementaire || 0, nouveauMontantTotal, paiement_supplementaire || 0, id]
    );

    await connection.commit();
    res.json({ message: 'Séjour prolongé avec succès' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Erreur lors de la prolongation.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
