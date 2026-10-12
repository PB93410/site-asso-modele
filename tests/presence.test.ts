import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dejaPointe,
  identifiantPointage,
  inactifs,
  sessionId,
  signerPresence,
  statsPresences,
  verifierJetonPresence,
} from '../src/lib/presence.js';

process.env.DEMO = '1';

describe('présences — jetons et doublons', () => {
  const secret = 'demo-secret-non-confidentiel-0123456789abcdef';

  it('signe un QR pour un jour et le refuse le lendemain', () => {
    const sid = sessionId('Lundi', '13h30 – 14h30', 'Gym Douce');
    expect(sid).toMatch(/lundi/);
    const t = signerPresence(sid, '2026-10-12', secret);
    expect(verifierJetonPresence(sid, '2026-10-12', t, secret)).toBe(true);
    expect(verifierJetonPresence(sid, '2026-10-13', t, secret)).toBe(false);
    expect(verifierJetonPresence(sid, '2026-10-12', '0'.repeat(32), secret)).toBe(false);
  });

  it('empêche un second pointage le même jour', () => {
    const lignes = [{ DATE: '2026-10-12', SESSION: 'lundi-x', NUMERO: 'ASE-2627-002', MAIL: 'lucas.bernard@example.fr' }];
    expect(dejaPointe(lignes, '2026-10-12', 'lundi-x', 'ASE-2627-002', '')).toBe(true);
    expect(dejaPointe(lignes, '2026-10-12', 'lundi-x', '', 'lucas.bernard@example.fr')).toBe(true);
    expect(dejaPointe(lignes, '2026-10-13', 'lundi-x', 'ASE-2627-002', '')).toBe(false);
  });

  it('compte par cours et liste les inactifs', () => {
    const lignes = [
      { DATE: '2026-10-01', SESSION: 'a', COURS: 'Pilates', HORAIRE: '10h', NUMERO: '1', MAIL: 'a@x.fr' },
      { DATE: '2026-10-08', SESSION: 'a', COURS: 'Pilates', HORAIRE: '10h', NUMERO: '1', MAIL: 'a@x.fr' },
      { DATE: '2026-09-01', SESSION: 'b', COURS: 'Zumba', HORAIRE: '19h', NUMERO: '2', MAIL: 'b@x.fr' },
    ];
    const s = statsPresences(lignes);
    expect(s.total).toBe(3);
    expect(s.cours[0]).toMatchObject({ cours: 'Pilates', total: 2 });
    const absents = inactifs(
      [
        { prenom: 'Ada', nom: 'Lovelace', mail: 'a@x.fr', numero: '1', statut: 'À jour' },
        { prenom: 'Bob', nom: 'Martin', mail: 'b@x.fr', numero: '2', statut: 'À jour' },
        { prenom: 'Test', nom: 'X', mail: 't@x.fr', numero: '3', statut: 'À jour' },
        { prenom: 'Eve', nom: 'Arrêt', mail: 'e@x.fr', numero: '4', statut: 'Arrêt' },
      ],
      lignes,
      { semaines: 3, aujourdHui: '2026-10-12' },
    );
    expect(absents.map((p) => p.prenom)).toEqual(['Bob']);
    expect(identifiantPointage(' ase-1 ', '')).toBe('ASE-1');
  });
});

describe('présences — fonction démo', () => {
  type Handler = (event: Record<string, unknown>) => Promise<{ statusCode: number; body: string }>;
  let traiter: Handler;
  let auth: Record<string, string>;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock('../asso.derive.js', async (orig) => {
      const m = await orig<Record<string, unknown>>();
      return { ...m, MODULES: { ...(m.MODULES as object), presences: true, bureau: true, adhesion: true } };
    });
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
    traiter = (await import('../netlify/functions/presence.mjs')).traiter;
    const login = await (await import('../netlify/functions/bureau-auth.mjs')).traiter({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'demo' }),
    });
    auth = { authorization: `Bearer ${JSON.parse(login.body).token}` };
  }, 30_000);

  beforeEach(async () => {
    const { resetDemo } = await import('../netlify/functions/_demo.mjs');
    resetDemo();
  });

  const call = (event: Record<string, unknown>) =>
    traiter({ headers: { ...auth }, queryStringParameters: {}, ...event });

  it('le bureau obtient les séances du jour avec un QR signé', async () => {
    const r = await call({ httpMethod: 'GET', queryStringParameters: { action: 'sessions' } });
    expect(r.statusCode).toBe(200);
    const data = JSON.parse(r.body);
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions[0].url).toContain('/presence?s=');
    expect(data.sessions[0].token).toHaveLength(32);
  });

  it('pointe une fois, refuse le doublon, ignore un jeton d’un autre jour', async () => {
    const seances = JSON.parse((await call({ httpMethod: 'GET', queryStringParameters: { action: 'sessions' } })).body);
    const s = seances.sessions[0];
    const body = { action: 'checkin', session: s.id, token: s.token, numero: 'ASE-2627-002' };
    const un = await call({ httpMethod: 'POST', headers: { ...auth }, body: JSON.stringify(body) });
    expect(un.statusCode).toBe(200);
    expect(JSON.parse(un.body)).toMatchObject({ ok: true, deja: false });
    const deux = await call({ httpMethod: 'POST', headers: { ...auth }, body: JSON.stringify(body) });
    expect(JSON.parse(deux.body).deja).toBe(true);
    const faux = await call({
      httpMethod: 'POST',
      body: JSON.stringify({ action: 'checkin', session: s.id, token: 'a'.repeat(32), numero: 'ASE-2627-002' }),
    });
    expect(faux.statusCode).toBe(400);
  });

  it('liste les inactifs et prépare une relance en démo', async () => {
    const r = await call({ httpMethod: 'GET', queryStringParameters: { action: 'inactifs', semaines: '3' } });
    expect(r.statusCode).toBe(200);
    const personnes = JSON.parse(r.body).personnes;
    expect(Array.isArray(personnes)).toBe(true);
    const cible = personnes.find((p: { mail: string }) => p.mail);
    if (cible) {
      const rel = await call({
        httpMethod: 'POST',
        headers: { ...auth },
        body: JSON.stringify({ action: 'relance', personnes: [cible] }),
      });
      expect(rel.statusCode).toBe(200);
      expect(JSON.parse(rel.body).envois[0].ok).toBe(true);
    }
  });
});
