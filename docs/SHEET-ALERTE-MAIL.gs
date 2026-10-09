/**
 * ASE — alerte mail Adhérents (présentation lisible)
 *
 * Remplace un relevé du type « [ASE] 1 nouvelle demande » en un seul bloc.
 *
 * Installation (référent, 5 min) :
 * 1. Ouvrir le Google Sheet Adhérents (compte contact@exemple-asso.fr)
 * 2. Extensions → Apps Script
 * 3. Effacer le code existant s’il produit l’ancien relevé, coller CE fichier
 * 4. Adapter SHEET_TAB et éventuellement les index de colonnes (voir ci-dessous)
 * 5. Enregistrer → Déclencheurs → Ajouter : « À la modification » (onEdit / onChange)
 *    ou « Basé sur le temps » toutes les heures si vous préférez un digest
 * 6. Autoriser le compte asso
 *
 * Ne pas coller de secrets ici. Destinataire = boîte asso.
 */

var TO_EMAIL = 'contact@exemple-asso.fr';
var BUREAU_URL = 'https://www.exemple-asso.fr/bureau';
/** Nom exact de l’onglet Adhérents */
var SHEET_TAB = 'Saison AAAA-AAAA';

/**
 * Index de colonnes (1 = A). À aligner sur votre en-tête réel.
 * Laissez 0 si la colonne n’existe pas.
 */
var COL = {
  prenom: 2,
  nom: 3,
  tel: 4,
  mode: 8,
  statut: 9,
};

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_TAB) return;
    var row = e.range.getRow();
    if (row < 2) return;
    // Ne mailer que si une cellule « identité » change (évite le bruit)
    var col = e.range.getColumn();
    if (col !== COL.prenom && col !== COL.nom && col !== COL.tel && col !== COL.statut && col !== COL.mode) {
      return;
    }
    sendAdhesionAlertForRow_(sheet, row);
  } catch (err) {
    // Pas de log de données perso
    console.error('ASE alert mail failed');
  }
}

function sendAdhesionAlertForRow_(sheet, row) {
  var prenom = cell_(sheet, row, COL.prenom);
  var nom = cell_(sheet, row, COL.nom);
  var telRaw = cell_(sheet, row, COL.tel);
  var mode = cell_(sheet, row, COL.mode) || 'non précisé';
  var statut = cell_(sheet, row, COL.statut) || 'En attente';
  var name = (prenom + ' ' + nom).replace(/\s+/g, ' ').trim() || 'Sans nom';
  var telFr = formatFrPhone_(telRaw);
  var wa = waDigits_(telRaw);

  var subject = '[ASE] Adhésion — ' + name;
  var body = [
    'Adhésion — nouvelle ligne',
    '',
    name,
    telFr ? 'Tél. ' + telFr : null,
    'Paiement : ' + mode,
    'Statut : ' + statut,
    'Ligne Sheet : ' + row,
    '',
    'À faire',
    '1. Ouvrir le bureau : ' + BUREAU_URL,
    '2. Retrouver la personne → cocher quand l’argent est reçu',
    wa ? '3. WhatsApp : https://wa.me/' + wa : '3. WhatsApp : numéro manquant',
    '',
    'Ne pas recréer une ligne : le Sheet est le registre.',
  ]
    .filter(function (x) {
      return x !== null;
    })
    .join('\n');

  MailApp.sendEmail({
    to: TO_EMAIL,
    subject: subject,
    body: body,
  });
}

function cell_(sheet, row, col) {
  if (!col || col < 1) return '';
  return String(sheet.getRange(row, col).getDisplayValue() || '').trim();
}

function formatFrPhone_(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.indexOf('33') === 0 && d.length >= 11) d = '0' + d.slice(2);
  if (d.length === 10 && d.charAt(0) === '0') {
    return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  return String(raw || '').trim();
}

function waDigits_(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.charAt(0) === '0' && d.length === 10) d = '33' + d.slice(1);
  if (d.indexOf('33') === 0 && d.length >= 11) return d;
  return '';
}
