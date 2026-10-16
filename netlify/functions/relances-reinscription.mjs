/**
 * Relances de réinscription : chaque lundi de juin et de septembre, un mail aux adhérents à jour qui n'ont
 * pas encore gardé leur place. Règles : _relances-reinscription.mjs. Demande les modules adhesion et espace,
 * un envoi de mail configuré et BUREAU_SECRET (24 caractères ou plus). Rien en démo.
 *
 * Éteint par défaut. REINSCRIPTION_RELANCES = « apercu » : compte et journalise, n'envoie rien ;
 * « oui » : envoie. Toute autre valeur, ou rien : inactif. Aucun nom ni adresse dans les journaux.
 * Planification : config en bas.
 */

import { getStore } from '@netlify/blobs';
import { ASSO, MODULES, SITE_URL } from '../../asso.derive.js';
import { ongletSaison, periodeReinscription } from '../../src/lib/reinscription.js';
import { getAdherentsSheetId, getAdherentsTab, readSheetAsObjects } from './_bureau-lib.mjs';
import { DEMO } from './_demo.mjs';
import { envoyerMail, modeEnvoi } from './_envoi.mjs';
import { STORE, choisirDestinataires, fenetreEnvoi, jetonStop, messageRelance } from './_relances-reinscription.mjs';
import { brancherStockage } from './_stockage.mjs';
import { versV2 } from './_v2.mjs';

const ymdParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

/** « oui », « apercu », ou '' (inactif). */
export function modeRelances(env = process.env, modules = MODULES, demo = DEMO) {
  const mode = String(env.REINSCRIPTION_RELANCES || '').trim().toLowerCase();
  if (mode !== 'oui' && mode !== 'apercu') return '';
  if (demo || !modules.adhesion || !modules.espace) return '';
  if (String(env.BUREAU_SECRET || '').length < 24 || !modeEnvoi(env)) return '';
  return mode;
}

const handler = async (event) => {
  const mode = modeRelances();
  if (!mode) return { statusCode: 200, body: 'inactif' };
  brancherStockage(event);
  const secret = process.env.BUREAU_SECRET;
  try {
    const label = ASSO.saison.label;
    const ymd = ymdParis();
    const p = periodeReinscription(label, new Date(), process.env.REINSCRIPTION);
    if (!p.ouverte || !fenetreEnvoi(label, ymd)) return { statusCode: 200, body: 'hors période' };

    const { rows: fiches } = await readSheetAsObjects(getAdherentsSheetId(), `'${getAdherentsTab()}'!A:Z`);
    const suivante = await readSheetAsObjects(getAdherentsSheetId(), `'${ongletSaison(p.suivante)}'!A:Z`)
      .then((r) => r.rows)
      .catch(() => []);
    const store = getStore({ name: STORE, consistency: 'strong' });
    const cle = `saison-${label}`;
    const etats = (await store.get(cle, { type: 'json' }).catch(() => null)) || {};

    const aEnvoyer = choisirDestinataires({ fiches, suivante, etats, ymd, secret });
    const parNumero = [1, 2, 3].map((n) => aEnvoyer.filter((d) => d.numero === n).length);
    console.log('relances-reinscription', mode, `à envoyer ${aEnvoyer.length}`, `mails 1/2/3 : ${parNumero.join('/')}`);
    if (mode === 'apercu' || !aEnvoyer.length) return { statusCode: 200, body: mode === 'apercu' ? 'aperçu' : 'rien à envoyer' };

    let envoyes = 0;
    try {
      for (const d of aEnvoyer) {
        const { sujet, texte } = messageRelance({
          prenoms: d.prenoms,
          numero: d.numero,
          saison: p.suivante,
          lien: `${SITE_URL}/espace`,
          desabo: `${SITE_URL}/api/reinscription-stop?t=${jetonStop(d.cle, label, secret)}`,
          nom: ASSO.nom,
        });
        await envoyerMail({ to: d.mail, subject: sujet, text: texte });
        etats[d.cle] = { ...etats[d.cle], n: d.numero, dernier: ymd };
        envoyes += 1;
      }
    } finally {
      // Ce qui est parti est noté, même si un envoi échoue en cours de route : jamais de doublon au passage suivant.
      if (envoyes) await store.setJSON(cle, etats);
    }
    console.log('relances-reinscription', `envoyés ${envoyes}`);
    return { statusCode: 200, body: `envoyés ${envoyes}` };
  } catch (err) {
    console.error('relances-reinscription', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};

// Fonction v2 : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);

// Chaque lundi à 7 h (UTC) ; la fonction ne fait rien hors de juin et de septembre.
export const config = { schedule: '0 7 * * 1' };
