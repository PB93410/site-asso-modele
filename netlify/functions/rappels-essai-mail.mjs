/**
 * Mails de l'essai (modules.essaiMail) : chaque soir, le rappel de la veille et, après l'essai, un mot de
 * remerciement avec le lien « Adhérer en 1 minute », aux personnes qui ont laissé leur adresse en demandant un
 * essai. Règles : _essai-mails.mjs. Demande un envoi de mail configuré et BUREAU_SECRET (24 caractères ou plus).
 * ESSAI_MAILS = « apercu » : compte et journalise, n'envoie rien. Rien en démo. Aucun nom ni adresse dans les journaux.
 * Planification : config en bas.
 */

import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import {
  getAdherentsSheetId,
  getAdherentsTab,
  getEssaisSheetId,
  getEssaisTab,
  pickRow,
  readSheetAsObjects,
  telPersonKey,
  updateRowByHeaders,
} from './_bureau-lib.mjs';
import { DEMO } from './_demo.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { adherentsConnus, cleTel, jetonStopMail, lireMails, noteMail, planMails, purgerMails } from './_essai-mails.mjs';
import { signerLienAdhesion } from './_lien-adhesion.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';
import { lirePlanning } from './wallet.mjs';
import { msgApresCours, msgRappelVeille, resolveCreneau } from '../../src/lib/essaiMessages.ts';

export const MAX_PAR_PASSAGE = 30;

const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const dateSeule = (s) => /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s);

/** « oui », « apercu » (ESSAI_MAILS=apercu), ou '' (inactif). */
export function modeMailsEssai(env = process.env, modules = MODULES, demo = DEMO) {
  if (demo || !modules.essais || !modules.essaiMail) return '';
  if (String(env.BUREAU_SECRET || '').length < 24 || !modeEnvoi(env)) return '';
  return String(env.ESSAI_MAILS || '').trim().toLowerCase() === 'apercu' ? 'apercu' : 'oui';
}

/** Une ligne du tableau des essais, comme la liste du bureau la voit. */
export function essaiDeLigne(r) {
  const creneauBrut = pickRow(r, 'CRENEAU');
  const dateEssai = pickRow(r, 'Date essai');
  return {
    row: r._row,
    prenom: pickRow(r, 'PRENOM', 'Prénom', 'Prenom'),
    nom: pickRow(r, 'NOM', 'Nom'),
    tel: pickRow(r, 'TEL', 'Téléphone', 'Telephone', 'Tel'),
    cours: pickRow(r, 'COURS', 'Cours'),
    creneau: creneauBrut || (dateEssai && !dateSeule(dateEssai) ? dateEssai : ''),
    demandeLe: pickRow(r, 'DATE_DEMANDE', 'Demandé le'),
    statut: pickRow(r, 'STATUT', 'Statut') || 'À venir',
    notes: pickRow(r, 'NOTES', 'Remarque'),
  };
}

/** Le texte d'un mail : le message du bureau, plus un pied qui dit pourquoi et comment l'arrêter. */
export function texteMail({ type, essai, schedule, jeton, nFaits, desabo }) {
  const info = resolveCreneau(schedule, essai.cours, essai.creneau);
  const corps = type === 'veille' ? msgRappelVeille(essai.prenom, info) : msgApresCours(essai.prenom, info, nFaits, jeton);
  const nom = ASSO.nomCourt || ASSO.nom;
  return {
    sujet: type === 'veille' ? `Votre essai demain — ${nom}` : `Merci d’être venu(e) — ${nom}`,
    texte: `${corps}\n\n—\nVous recevez ce message parce que vous avez laissé votre adresse en demandant un essai (le rappel de la veille et un mot après l'essai, rien d'autre). Pour ne plus en recevoir : ${desabo}`,
  };
}

const handler = async (event) => {
  if (!MODULES.essaiMail) return { statusCode: 200, body: 'inactif' };
  brancherStockage(event);
  // La durée de conservation s'applique toujours, même quand les envois sont coupés : les adresses sont déjà recueillies.
  try {
    const purges = await purgerMails(ymdParis());
    if (purges) console.log('rappels-essai-mail', `adresses effacées (12 mois) ${purges}`);
  } catch (err) {
    console.error('rappels-essai-mail purge', err?.message || err);
  }
  const mode = modeMailsEssai();
  if (!mode) return { statusCode: 200, body: 'inactif' };
  const secret = process.env.BUREAU_SECRET;

  try {
    const ymd = ymdParis();
    const sheetId = getEssaisSheetId();
    const tab = getEssaisTab();
    const { headers, rows, colIndices } = await readSheetAsObjects(sheetId, `'${tab}'!A:Z`);
    const essais = rows.map(essaiDeLigne);
    const mails = await lireMails(essais, secret);
    // Les adhérents ne reçoivent ni rappel ni invitation à adhérer. Tableau illisible : on n'envoie rien.
    const adherents = adherentsConnus((await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`)).rows);
    const plan = planMails(essais, mails, ymd, secret, adherents).slice(0, MAX_PAR_PASSAGE);
    const nVeille = plan.filter((p) => p.type === 'veille').length;
    console.log('rappels-essai-mail', mode, `veille ${nVeille}`, `merci ${plan.length - nVeille}`);
    if (mode === 'apercu' || !plan.length) return { statusCode: 200, body: mode === 'apercu' ? 'aperçu' : 'rien à envoyer' };

    const notesHeader = headers.find((h) => ['notes', 'remarque', 'remarques'].includes(norm(h)));
    if (!notesHeader) throw new Error('colonne NOTES introuvable');
    const schedule = await lirePlanning();
    let envoyes = 0;
    for (const p of plan) {
      const cle = telPersonKey(p.essai.tel);
      const nFaits = essais.filter((e) => telPersonKey(e.tel) === cle && /venu|adherent|adhere/.test(norm(e.statut))).length || 1;
      const { sujet, texte } = texteMail({
        type: p.type,
        essai: p.essai,
        schedule,
        jeton: MODULES.adhesion ? signerLienAdhesion(p.essai.tel, secret) : '',
        nFaits,
        desabo: `${SITE_URL}/api/essai-mail-stop?t=${jetonStopMail(cleTel(p.essai.tel, secret), secret)}`,
      });
      await envoyerMail({ to: p.mail, subject: sujet, text: texte });
      envoyes += 1;
      // Noté tout de suite dans les notes de l'essai : si l'écriture échoue, on s'arrête (jamais de doublon en série).
      const note = noteMail(p.type, p.essaiYmd);
      await updateRowByHeaders(sheetId, tab, p.essai.row, { [notesHeader]: p.essai.notes ? `${p.essai.notes} | ${note}` : note }, headers, colIndices);
    }
    console.log('rappels-essai-mail', `envoyés ${envoyes}`);
    return { statusCode: 200, body: `envoyés ${envoyes}` };
  } catch (err) {
    console.error('rappels-essai-mail', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Chaque jour à 16 h (UTC), 17 h ou 18 h à Paris.
export const config = { schedule: '0 16 * * *' };
