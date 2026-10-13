/** Mes cours (séances à venir, agenda .ics) et droit à l'image depuis l'espace adhérent. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { coursDeNotes, finMinutes, heureParis, seances } from '../src/lib/mesCours';

vi.mock('@netlify/blobs', async () => (await import('./fauxBlobs')).fauxBlobs().module);
const boite: { to: string; subject: string; text: string }[] = [];
vi.mock('../netlify/functions/_envoi.mjs', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  modeEnvoi: () => 'smtp',
  envoyerMail: async (m: { to: string; subject: string; text: string }) => {
    boite.push(m);
  },
}));

const PLANNING = [
  { day: 'Lundi', time: '13h30 – 14h30', course: 'Gym Douce', location: 'Salle des fêtes' },
  { day: 'Mardi', time: '18h30 – 19h30', course: 'Pilates', location: 'Gymnase' },
  { day: 'Jeudi', time: '18h30', course: 'Pilates', location: 'Gymnase', note: 'Annulé ce trimestre' },
];
const SAISON = {
  reprise: '2026-09-07',
  fin: '2027-07-04',
  pauses: [{ libelle: 'vacances de la Toussaint', du: '2026-10-18', reprise: '2026-11-02' }],
};

describe('mes cours — séances', () => {
  it('horaires, notes d’inscription', () => {
    expect(finMinutes('13h30 – 14h30')).toBe(870);
    expect(finMinutes('18h30')).toBe(1170);
    expect(coursDeNotes('Cours: Pilates, Gym Douce | Liste d’attente n° 2')).toEqual(['Pilates', 'Gym Douce']);
    expect(coursDeNotes('Cours: Non précisé')).toEqual([]);
  });

  it('séances des cours suivis, sans les vacances, ni les créneaux annulés', () => {
    const s = seances(PLANNING, ['Pilates', 'Gym Douce'], { du: '2026-10-12', jours: 28, saison: SAISON });
    expect(s.map((x) => `${x.ymd} ${x.creneau.course}`)).toEqual([
      '2026-10-12 Gym Douce',
      '2026-10-13 Pilates',
      '2026-11-02 Gym Douce',
      '2026-11-03 Pilates',
    ]);
    // 11 novembre (mercredi) : pas concerné ; lundi de Pâques sauté.
    expect(seances(PLANNING, ['Gym Douce'], { du: '2027-03-29', jours: 1, saison: SAISON })).toEqual([]);
  });

  it('heure de Paris, été comme hiver', () => {
    expect(heureParis('2026-10-13', 1110)).toBe('2026-10-13T18:30:00+02:00');
    expect(heureParis('2026-11-03', 1110)).toBe('2026-11-03T18:30:00+01:00');
  });
});

type Reponse = { statusCode: number; body: string; headers?: Record<string, string> };
const call = async (name: string, event: Record<string, unknown>): Promise<Reponse> =>
  (await import(`../netlify/functions/${name}.mjs`)).traiter({ headers: {}, queryStringParameters: {}, ...event });
const SECRET = 'secret-de-test-assez-long-0123456789';

describe('mes cours — espace', { timeout: 20_000 }, () => {
  const env0 = { ...process.env };
  let cookie = '';
  let numero = '';
  beforeAll(async () => {
    process.env.STOCKAGE = 'netlify';
    delete process.env.DEMO;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.BUREAU_SECRET = SECRET;
    const insc = await call('adhesion', {
      httpMethod: 'POST',
      body: JSON.stringify({
        prenom: 'Bea', nom: 'Agenda', telephone: '0600000074', email: 'bea@exemple.fr', date_naissance: '01/02/1960',
        mode_paiement: 'Virement', droit_image: 'Oui', qs_sport: 'Oui', cours: 'Pilates',
      }),
    });
    expect(insc.statusCode, insc.body).toBe(200);
    const { marquerAdhesionPayee } = await import('../netlify/functions/_paiement.mjs');
    numero = (await marquerAdhesionPayee(JSON.parse(insc.body).reference)).numero as string;
    const { signerSession } = await import('../src/lib/espace.js');
    cookie = `espace=${signerSession('bea@exemple.fr', SECRET)}`;
  });
  afterAll(() => {
    process.env = env0;
  });

  const moi = async () => JSON.parse((await call('espace', { httpMethod: 'GET', headers: { cookie }, queryStringParameters: { action: 'moi' } })).body);
  const poster = (corps: Record<string, unknown>) => call('espace', { httpMethod: 'POST', headers: { cookie }, body: JSON.stringify(corps) });

  it('cours de l’inscription par défaut, puis ceux choisis ; agenda signé', async () => {
    const f = (await moi()).fiches[0];
    expect(f.mesCours).toEqual({ cours: ['Pilates'], choisis: false });
    expect(f.droitImage).toBe('Oui');
    expect(f.agenda).toMatch(new RegExp(`/api/espace\\?action=ics&cle=${numero}&t=[0-9a-f]{32}$`));
    expect(f.agenda).not.toContain('bea');

    const r = await poster({ action: 'mes-cours', cle: numero, cours: ['Zumba', 'Pilates', 'Cours inventé'] });
    expect(JSON.parse(r.body).cours).toEqual(['Zumba', 'Pilates']);
    expect((await moi()).fiches[0].mesCours).toEqual({ cours: ['Zumba', 'Pilates'], choisis: true });

    const ics = await call('espace', { httpMethod: 'GET', queryStringParameters: Object.fromEntries(new URL(f.agenda).searchParams) });
    expect(ics.statusCode).toBe(200);
    expect(ics.headers?.['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(ics.body).toContain('BEGIN:VCALENDAR');
    expect(ics.body).toMatch(/SUMMARY:(Zumba|Pilates)/);
    expect(ics.body).not.toContain('bea@exemple.fr');

    const faux = await call('espace', { httpMethod: 'GET', queryStringParameters: { action: 'ics', cle: numero, t: '0'.repeat(32) } });
    expect(faux.statusCode).toBe(404);
  });

  it('droit à l’image : la fiche change, le bureau est prévenu', async () => {
    boite.length = 0;
    const r = await poster({ action: 'droit-image', cle: numero, valeur: 'Non' });
    expect(r.statusCode, r.body).toBe(200);
    expect((await moi()).fiches[0].droitImage).toBe('Non');
    expect(boite).toHaveLength(1);
    expect(boite[0].subject).toContain('« Non »');
    expect((await poster({ action: 'droit-image', cle: numero, valeur: 'Peut-être' })).statusCode).toBe(400);
  });
});
