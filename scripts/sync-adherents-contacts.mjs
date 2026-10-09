/**
 * Adhérents → Google Contacts (compte asso) + export WhatsApp.
 *
 * Prérequis : People API activée + GOOGLE_REFRESH_TOKEN avec scope contacts
 * (reconnecter via /bureau/connexion-google après déploiement du scope).
 *
 * Usage :
 *   node scripts/sync-adherents-contacts.mjs              # dry-run plan
 *   node scripts/sync-adherents-contacts.mjs --whatsapp    # CSV + vCard locaux (Adhérents + Essais)
 *   node scripts/sync-adherents-contacts.mjs --apply       # sync Contacts
 *   node scripts/sync-adherents-contacts.mjs --apply --whatsapp
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { ASSO } from '../asso.derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const WHATSAPP = process.argv.includes('--whatsapp');
const GROUP_NAME = `${ASSO.sigle} Adhérents`;
const OUT_DIR = path.join(ROOT, 'tmp');

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function netlifyEnv(name) {
  const r = spawnSync('npx', ['--yes', 'netlify-cli', 'env:get', name], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: 120_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (name.endsWith('_JSON') || name.endsWith('_TOKEN')) {
    const i = out.indexOf(name.endsWith('_JSON') ? '{' : '1//');
    if (name.endsWith('_JSON')) {
      const j = out.lastIndexOf('}');
      if (i >= 0 && j > i) return out.slice(i, j + 1);
    } else if (i >= 0) {
      return out
        .slice(i)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)[0];
    }
  }
  return (
    out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('npm ') && !l.toLowerCase().includes('warn'))
      .at(-1) || ''
  );
}

function loadEnv() {
  parseDotEnv(path.join(ROOT, '.env'));
  parseDotEnv(path.join(ROOT, '.env.local'));
  for (const key of [
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_SHEET_ID',
    'GOOGLE_SHEET_NAME',
    'GOOGLE_SHEET_ESSAIS_ID',
    'GOOGLE_SHEET_ESSAIS_NAME',
    'GOOGLE_SUIVI_SHEET_ID',
    'GOOGLE_SUIVI_SHEET_NAME',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_OAUTH_REDIRECT_URI',
    'SITE_ORIGIN',
  ]) {
    if (process.env[key] && !/no value set/i.test(process.env[key])) continue;
    const val = netlifyEnv(key);
    if (val && !/no value set/i.test(val)) process.env[key] = val;
  }
}

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIntlFr(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('33') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = d.slice(1);
  if (d.length > 9) d = d.slice(-9);
  if (d.length !== 9) return '';
  return `+33${d}`;
}

function telKey(raw) {
  const intl = toIntlFr(raw);
  return intl ? intl.replace(/\D/g, '').slice(-9) : '';
}

function csvEscape(s) {
  const t = String(s || '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function vcfEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

async function ensureContactGroup(people) {
  let pageToken = '';
  do {
    const res = await people.contactGroups.list({
      pageSize: 100,
      pageToken: pageToken || undefined,
    });
    for (const g of res.data.contactGroups || []) {
      if (g.name === GROUP_NAME && g.resourceName) return g.resourceName;
    }
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);

  if (!APPLY) return `dry-run:${GROUP_NAME}`;

  const created = await people.contactGroups.create({
    requestBody: { contactGroup: { name: GROUP_NAME } },
  });
  const name = created.data.resourceName;
  if (!name) throw new Error('Création du groupe Contacts échouée');
  console.log(`Groupe créé : ${GROUP_NAME}`);
  return name;
}

async function listAllConnections(people) {
  const all = [];
  let pageToken = '';
  do {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: 'names,phoneNumbers,emailAddresses,memberships,metadata,biographies',
      pageSize: 200,
      pageToken: pageToken || undefined,
    });
    for (const p of res.data.connections || []) all.push(p);
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);
  return all;
}

function indexByTel(connections) {
  const map = new Map();
  for (const p of connections) {
    for (const ph of p.phoneNumbers || []) {
      const k = telKey(ph.value || '');
      if (k) map.set(k, p);
    }
  }
  return map;
}

function buildPersonBody(row, groupResourceName) {
  const body = {
    names: [
      {
        givenName: row.prenom,
        familyName: row.nom,
      },
    ],
    phoneNumbers: [{ value: row.telIntl, type: 'mobile' }],
  };
  if (row.mail) {
    body.emailAddresses = [{ value: row.mail, type: 'home' }];
  }
  const note = [row.statut, row.mode].filter(Boolean).join(' · ');
  if (note) {
    body.biographies = [{ value: `${ASSO.sigle} · ${note}`, contentType: 'TEXT_PLAIN' }];
  }
  if (groupResourceName && !String(groupResourceName).startsWith('dry-run:')) {
    body.memberships = [
      {
        contactGroupMembership: {
          contactGroupResourceName: groupResourceName,
        },
      },
    ];
  }
  return body;
}

function needsUpdate(existing, row) {
  const name = existing.names?.[0] || {};
  const given = String(name.givenName || '').trim();
  const family = String(name.familyName || '').trim();
  const phones = (existing.phoneNumbers || []).map((p) => toIntlFr(p.value || ''));
  const mails = (existing.emailAddresses || []).map((e) => fold(e.value || ''));
  if (given !== row.prenom || family !== row.nom) return true;
  if (!phones.includes(row.telIntl)) return true;
  if (row.mail && !mails.includes(fold(row.mail))) return true;
  return false;
}

async function main() {
  loadEnv();
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON manquant (lecture Sheet)');
  }

  const {
    getSheets,
    getAdherentsSheetId,
    getAdherentsTab,
    getEssaisSheetId,
    getEssaisTab,
    isTestPrenom,
    pickRow,
    readSheetAsObjects,
  } = await import('../netlify/functions/_bureau-lib.mjs');

  const sheets = await getSheets();
  const spreadsheetId = getAdherentsSheetId();
  const tab = getAdherentsTab();

  console.log(`Adhérents « ${tab} » → Contacts / WhatsApp`);
  console.log(`Modes : ${APPLY ? 'APPLY Contacts' : 'dry-run Contacts'}${WHATSAPP ? ' + export WhatsApp' : ''}`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const grid = res.data.values || [];
  if (grid.length < 2) {
    console.log('Aucune ligne.');
    return;
  }

  const headers = grid[0].map((h) => String(h || '').trim());
  const idx = (names) =>
    headers.findIndex((h) => names.map(fold).includes(fold(h)));

  const iNom = idx(['NOM', 'Nom']);
  const iPrenom = idx(['PRENOM', 'Prénom', 'Prenom']);
  const iTel = idx(['TEL', 'Téléphone', 'Telephone', 'Tel']);
  const iMail = idx(['MAIL', 'Email', 'E-mail', 'Mail']);
  const iStatut = idx(['STATUT', 'Statut']);
  const iMode = idx(['MODE', 'Mode']);

  if (iTel < 0) throw new Error('Colonne TEL introuvable');

  const rows = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] || [];
    const prenom = String(line[iPrenom] ?? '').trim();
    const nom = String(line[iNom] ?? '').trim();
    const telRaw = String(line[iTel] ?? '').trim();
    if (isTestPrenom(prenom, nom)) continue;
    const telIntl = toIntlFr(telRaw);
    if (!telIntl) continue;
    rows.push({
      prenom,
      nom,
      telIntl,
      telKey: telKey(telIntl),
      mail: iMail >= 0 ? String(line[iMail] ?? '').trim() : '',
      statut: iStatut >= 0 ? String(line[iStatut] ?? '').trim() : '',
      mode: iMode >= 0 ? String(line[iMode] ?? '').trim() : '',
      display: [prenom, nom].filter(Boolean).join(' ') || telIntl,
    });
  }

  // Une fiche par tél (dernière ligne gagne)
  const byTel = new Map();
  for (const row of rows) byTel.set(row.telKey, row);
  const unique = [...byTel.values()].sort((a, b) =>
    fold(a.display).localeCompare(fold(b.display), 'fr'),
  );

  console.log(`${rows.length} lignes Sheet → ${unique.length} contacts uniques (tél)`);

  if (WHATSAPP) {
    const essais = await readSheetAsObjects(getEssaisSheetId(), `'${getEssaisTab()}'!A:Z`);
    let essaisAjoutes = 0;
    let essaisDeja = 0;
    for (const line of essais.rows) {
      const prenom = pickRow(line, 'PRENOM', 'Prénom', 'Prenom');
      const nom = pickRow(line, 'NOM', 'Nom');
      if (isTestPrenom(prenom, nom)) continue;
      const telIntl = toIntlFr(pickRow(line, 'TEL', 'Téléphone', 'Telephone', 'Tel'));
      const key = telKey(telIntl);
      if (!key) continue;
      const statut = pickRow(line, 'STATUT', 'Statut');
      const cours = pickRow(line, 'COURS', 'Cours') || pickRow(line, 'CRENEAU');
      const noteEssai = ['Essai', statut, cours].filter(Boolean).join(' · ');
      const prev = byTel.get(key);
      if (prev) {
        essaisDeja += 1;
        if (prev.noteEssai !== noteEssai) prev.noteEssai = noteEssai;
        continue;
      }
      essaisAjoutes += 1;
      byTel.set(key, {
        prenom,
        nom,
        telIntl,
        telKey: key,
        mail: '',
        statut,
        mode: '',
        noteEssai,
        display: [prenom, nom].filter(Boolean).join(' ') || telIntl,
      });
    }
    const contacts = [...byTel.values()]
      .filter((row) => /^\+33[67]/.test(row.telIntl))
      .sort((a, b) => fold(a.display).localeCompare(fold(b.display), 'fr'));
    const fixes = [...byTel.values()].length - contacts.length;
    console.log(
      `Essais : ${essaisAjoutes} numéros en plus, ${essaisDeja} déjà dans Adhérents. ${fixes} numéro(s) ignoré(s) (pas un mobile).`,
    );

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const csvPath = path.join(OUT_DIR, 'adherents-whatsapp.csv');
    const vcfPath = path.join(OUT_DIR, 'adherents-whatsapp.vcf');
    const csvLines = ['First Name,Last Name,E-mail,Numéro de téléphone,Notes'];
    const vcfParts = [];
    for (const row of contacts) {
      const note = [row.statut, row.mode, row.noteEssai].filter(Boolean).join(' · ');
      csvLines.push(
        [
          csvEscape(row.prenom),
          csvEscape(row.nom),
          csvEscape(row.mail),
          csvEscape(row.telIntl.replace(/^(\+33)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6')),
          csvEscape(note ? `${ASSO.sigle} · ${note}` : ''),
        ].join(','),
      );
      vcfParts.push(
        [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${vcfEscape(row.nom)};${vcfEscape(row.prenom)};;;`,
          `FN:${vcfEscape(row.display)}`,
          `TEL;TYPE=CELL:${row.telIntl}`,
          row.mail ? `EMAIL;TYPE=INTERNET:${vcfEscape(row.mail)}` : '',
          note ? `NOTE:${vcfEscape(`${ASSO.sigle} · ${note}`)}` : '',
          'END:VCARD',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8');
    fs.writeFileSync(vcfPath, `${vcfParts.join('\n')}\n`, 'utf8');
    console.log(`WhatsApp : ${contacts.length} contacts\n  ${csvPath}\n  ${vcfPath}`);
    console.log(
      'Import : Google Contacts (CSV) ou partage .vcf → téléphone avec WhatsApp. Noms affichés si le compte Google est synchronisé sur le téléphone asso.',
    );
  }

  // Export WhatsApp seul : pas besoin d’OAuth Contacts.
  if (WHATSAPP && !APPLY) {
    console.log('\nSync Contacts non demandée (dry-run WhatsApp seul). Pour Contacts : --apply après reconnexion OAuth.');
    return;
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log(
      '\nPas de GOOGLE_CLIENT_ID / SECRET / REFRESH_TOKEN — sync Contacts impossible pour l’instant.',
    );
    console.log(
      'Après déploiement du scope contacts : /bureau/connexion-google → coller le nouveau token Netlify.',
    );
    if (!WHATSAPP) {
      console.log('Astuce : relancer avec --whatsapp pour l’export CSV/vCard sans OAuth Contacts.');
    }
    return;
  }

  const { getUserGoogleAuth, googleErrorMessage } = await import(
    '../netlify/functions/_google-user.mjs'
  );

  let people;
  try {
    const auth = getUserGoogleAuth();
    people = google.people({ version: 'v1', auth });
  } catch (err) {
    throw new Error(googleErrorMessage(err));
  }

  let groupResourceName;
  let existingByTel = new Map();
  try {
    groupResourceName = await ensureContactGroup(people);
    if (APPLY || !String(groupResourceName).startsWith('dry-run:')) {
      const connections = await listAllConnections(people);
      existingByTel = indexByTel(connections);
      console.log(`Contacts existants indexés : ${existingByTel.size} tél`);
    }
  } catch (err) {
    const msg = String(err?.message || err);
    if (/insufficient|ACCESS_TOKEN_SCOPE|people\.googleapis|Not Requested|403/i.test(msg)) {
      console.error(
        '\nScope Contacts manquant ou People API inactive.\n' +
          '1) Google Cloud → activer « People API »\n' +
          '2) Retirer l’accès de l’appli sur myaccount.google.com/permissions (compte asso)\n' +
          '3) /bureau/connexion-google → nouveau GOOGLE_REFRESH_TOKEN → Netlify → redéployer\n',
      );
    }
    throw new Error(googleErrorMessage(err) || msg);
  }

  let create = 0;
  let update = 0;
  let skip = 0;

  for (const row of unique) {
    const existing = existingByTel.get(row.telKey);
    if (!existing) {
      create += 1;
      console.log(`  + ${row.display} · ${row.telIntl}`);
      if (APPLY) {
        await people.people.createContact({
          requestBody: buildPersonBody(row, groupResourceName),
        });
      }
      continue;
    }
    if (needsUpdate(existing, row)) {
      update += 1;
      console.log(`  ~ ${row.display} · ${row.telIntl}`);
      if (APPLY) {
        const body = buildPersonBody(row, groupResourceName);
        await people.people.updateContact({
          resourceName: existing.resourceName,
          updatePersonFields: 'names,phoneNumbers,emailAddresses,biographies,memberships',
          requestBody: {
            etag: existing.etag,
            ...body,
          },
        });
      }
      continue;
    }
    skip += 1;
  }

  console.log(
    `\nRésumé Contacts : ${create} à créer, ${update} à maj, ${skip} déjà ok` +
      (APPLY ? ' — écrit.' : ' — dry-run (relancer --apply).'),
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
