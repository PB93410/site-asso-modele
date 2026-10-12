/**
 * Sauvegarde du lundi matin (stockage Netlify) : toutes les données du bureau en Excel,
 * envoyées à la boîte de l'asso. Le Drive ne fait plus de copie : c'est cette pièce jointe.
 * Rien avec Google Sheets (les classeurs ont déjà leur historique), ni en démo.
 * Pour couper : SAUVEGARDE_MAIL=non. Planification : netlify.toml.
 */

import { ASSO, MODULES } from '../../asso.derive.js';
import { adresseAsso, envoyerMail, modeEnvoi } from './_envoi.mjs';
import { classeurBureau, nomFichierExport } from './_export.mjs';
import { brancherStockage, surNetlify } from './_stockage.mjs';
import { XLSX_TYPE } from './_xlsx.mjs';

export function sauvegardeActive(env = process.env) {
  if (/^(non|0|false)$/i.test(String(env.SAUVEGARDE_MAIL || '').trim())) return false;
  if (!MODULES.essais && !MODULES.adhesion && !MODULES.bureau) return false;
  return surNetlify(env) && Boolean(modeEnvoi(env));
}

export async function envoyerSauvegarde(now = new Date()) {
  const nom = nomFichierExport('sauvegarde', now);
  await envoyerMail({
    to: adresseAsso(),
    subject: `[${ASSO.sigle}] Sauvegarde du site — ${nom.replace(/^.*-(\d{4}-\d{2}-\d{2})\.xlsx$/, '$1')}`,
    text: [
      'Bonjour,',
      '',
      `Voici la sauvegarde de la semaine : adhérents, essais, horaires et événements du site ${ASSO.nom}, en un fichier Excel.`,
      'Gardez ce mail : en cas de souci, le référent peut tout remettre à partir de ce fichier.',
      'Il contient des données personnelles : ne le transférez pas en dehors du bureau.',
      '',
      'Le site',
    ].join('\n'),
    attachments: [{ filename: nom, content: await classeurBureau(), contentType: XLSX_TYPE }],
  });
  return nom;
}

export const handler = async (event) => {
  if (!sauvegardeActive()) return { statusCode: 200, body: 'sauvegarde inactive' };
  brancherStockage(event);
  try {
    const nom = await envoyerSauvegarde();
    console.log('sauvegarde envoyée', nom);
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('sauvegarde', err?.message || err);
    return { statusCode: 500, body: 'échec' };
  }
};
