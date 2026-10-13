/**
 * Carte Apple / Google Wallet (modules.wallet).
 * En démo : pkpass non signé + aperçu. En prod : certificats dans l’environnement.
 */

import { createHash } from 'node:crypto';
import { crc32, zipStore } from './zipStore.js';

export function prochainCours(planning, maintenant = new Date()) {
  const fr = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).format(maintenant);
  const nomJour = fr.charAt(0).toUpperCase() + fr.slice(1);
  const slots = (planning || []).filter((p) => String(p.day || p.jour || '') === nomJour);
  const pick = slots[0] || (planning || [])[0];
  if (!pick) return '';
  return `${pick.day || pick.jour} ${pick.time || pick.horaire} · ${pick.course || pick.cours}`;
}

export function champsPass({ asso, prenom, nom, numero, prochain, alerte }) {
  const nomComplet = [prenom, nom].filter(Boolean).join(' ');
  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.fr.asso.carte',
    serialNumber: String(numero || 'apercu'),
    teamIdentifier: process.env.APPLE_PASS_TEAM_ID || 'DEMO',
    organizationName: asso.nomCourt || asso.nom,
    description: `Carte ${asso.nomCourt || asso.nom}`,
    logoText: asso.nomCourt || asso.nom,
    foregroundColor: 'rgb(255,255,255)',
    backgroundColor: 'rgb(196,83,9)',
    generic: {
      primaryFields: [{ key: 'nom', label: 'Adhérent', value: nomComplet || 'Aperçu' }],
      secondaryFields: [{ key: 'numero', label: 'N°', value: String(numero || '—') }],
      auxiliaryFields: prochain
        ? [{ key: 'cours', label: 'Prochain cours', value: String(prochain) }]
        : [],
      backFields: [
        { key: 'asso', label: 'Association', value: asso.nom },
        ...(alerte ? [{ key: 'alerte', label: 'Dernière minute', value: String(alerte) }] : []),
      ],
    },
  };
}

function png1x1() {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f00f0005fe01fe7c4e4e4c0000000049454e44ae426082',
    'hex',
  );
}

export function fabriquerPkpass(pass, { signe = false } = {}) {
  const passJson = `${JSON.stringify(pass, null, 2)}\n`;
  const icon = png1x1();
  const files = [
    { name: 'pass.json', data: Buffer.from(passJson, 'utf8') },
    { name: 'icon.png', data: icon },
    { name: 'paula.r@example.org', data: icon },
    { name: 'logo.png', data: icon },
  ];
  const manifest = {};
  for (const f of files) manifest[f.name] = createHash('sha1').update(f.data).digest('hex');
  files.push({ name: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8') });
  if (signe) {
    files.push({ name: 'signature', data: Buffer.from('demo') });
  } else {
    files.push({ name: 'signature', data: Buffer.from('unsigned-demo') });
  }
  return zipStore(files);
}

export { crc32 };

export function googleSaveUrl(jwt) {
  if (!jwt) return '';
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
