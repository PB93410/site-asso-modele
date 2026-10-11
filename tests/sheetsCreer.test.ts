import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import ASSO from '../asso.config.js';
import { majEnv, planClasseurs } from '../scripts/_sheets-creer.mjs';
import { connexion, creerClasseur } from '../scripts/sheets-creer.mjs';

const SITE = { planning: [['day', 'time', 'course', 'location', 'note'], ['Lundi', '10h00 – 11h00', 'Yoga', 'Salle', '']], evenements: [['date']] };
const TOUS = { essais: true, adhesion: true, bureau: true };

describe('npm run sheets:creer — plan', () => {
  it('trois classeurs avec le bureau, colonnes NUMERO et CARTE après DATE_DEMANDE', () => {
    const p = planClasseurs(ASSO, TOUS, SITE);
    expect(p.map((c) => c.cle)).toEqual(['GOOGLE_SHEET_ESSAIS_ID', 'GOOGLE_SHEET_ID', 'GOOGLE_SITE_SHEET_ID']);
    const adh = p[1].onglets[0];
    expect(adh.titre).toBe(`Saison ${ASSO.saison.label}`);
    expect(adh.lignes[0].slice(17)).toEqual(['DATE_DEMANDE', 'NUMERO', 'CARTE']);
    expect(p[2].onglets.map((o) => o.titre)).toEqual(['PLANNING', 'EVENEMENTS']);
    expect(p[2].onglets[0].lignes).toHaveLength(2);
  });

  it('seulement ce que demandent les fonctions activées', () => {
    expect(planClasseurs(ASSO, { essais: true, adhesion: false, bureau: false }, SITE).map((c) => c.cle)).toEqual(['GOOGLE_SHEET_ESSAIS_ID']);
    expect(planClasseurs(ASSO, { essais: false, adhesion: false, bureau: false }, SITE)).toEqual([]);
  });

  it('respecte les noms d’onglets personnalisés', () => {
    const p = planClasseurs(ASSO, TOUS, SITE, { GOOGLE_SHEET_ESSAIS_NAME: 'Demandes' });
    expect(p[0].onglets[0].titre).toBe('Demandes');
  });
});

describe('npm run sheets:creer — .env', () => {
  it('remplace une ligne existante ou commentée, ajoute le reste, garde les autres', () => {
    const avant = '# Google\nGOOGLE_SERVICE_ACCOUNT_JSON={"a":1}\n# GOOGLE_SHEET_ID=\nBUREAU_PASSWORD=x\n';
    const apres = majEnv(avant, { GOOGLE_SHEET_ID: 'abc', GOOGLE_SITE_SHEET_ID: 'def' });
    expect(apres).toBe(
      '# Google\nGOOGLE_SERVICE_ACCOUNT_JSON={"a":1}\nGOOGLE_SHEET_ID=abc\nBUREAU_PASSWORD=x\n\n# Classeurs créés par npm run sheets:creer\nGOOGLE_SITE_SHEET_ID=def\n',
    );
  });
});

describe('npm run sheets:creer — Google', () => {
  it('crée le classeur, écrit les en-têtes, partage avec le compte de service', async () => {
    const create = vi.fn(async () => ({ data: { spreadsheetId: 'ID1', spreadsheetUrl: 'https://docs.google.com/x' } }));
    const batchUpdate = vi.fn(async () => ({}));
    const permissions = vi.fn(async () => ({}));
    const [c] = planClasseurs(ASSO, { essais: true, adhesion: false, bureau: false }, SITE);
    const r = await creerClasseur(
      { spreadsheets: { create, values: { batchUpdate } } },
      { permissions: { create: permissions } },
      c,
      'site@projet.iam.gserviceaccount.com',
    );
    expect(r.id).toBe('ID1');
    expect(create.mock.calls[0][0].requestBody.sheets[0].properties).toMatchObject({ title: 'Essais', gridProperties: { frozenRowCount: 1 } });
    expect(batchUpdate.mock.calls[0][0].requestBody.data[0]).toMatchObject({ range: "'Essais'!A1" });
    expect(permissions.mock.calls[0][0]).toMatchObject({
      fileId: 'ID1',
      sendNotificationEmail: false,
      requestBody: { role: 'writer', emailAddress: 'site@projet.iam.gserviceaccount.com' },
    });
  });

  it('connexion : la page locale reçoit le code, vérifie l’état, et récupère le jeton', async () => {
    let etat = '';
    const getToken = vi.fn(async () => ({ tokens: { access_token: 't' } }));
    class OAuth2 {
      generateAuthUrl(o: { state: string; scope: string[] }) {
        etat = o.state;
        expect(o.scope).toEqual(['https://www.googleapis.com/auth/drive.file']);
        return 'https://accounts.google.com/o/oauth2/auth?x=1';
      }
      getToken = getToken;
      setCredentials = vi.fn();
    }
    const port = 53990;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const attente = connexion({ auth: { OAuth2 } }, 'id', 'secret', { navigateur: false, port });
    await new Promise((r) => setTimeout(r, 100));
    const page = await new Promise<string>((resolve) => {
      http.get(`http://localhost:${port}/oauth2callback?code=CODE&state=${etat}`, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(b));
      });
    });
    await attente;
    log.mockRestore();
    expect(page).toContain('C’est bon');
    expect(getToken).toHaveBeenCalledWith('CODE');
  });
});
