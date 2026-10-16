import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../asso.derive.js', async (orig) => {
  const m = await orig<Record<string, unknown>>();
  return { ...m, MODULES: { ...(m.MODULES as object), essais: true, adhesion: true, essaiMail: true } };
});
delete process.env.DEMO;

const {
  adherentsConnus,
  cleDuJetonStopMail,
  cleEssai,
  cleTel,
  jetonStopMail,
  mailValide,
  mailsEnvoyes,
  minuteDemande,
  noteMail,
  planMails,
  prenomPourMail,
} = await import('../netlify/functions/_essai-mails.mjs');

const SECRET = 'secret-de-test-0123456789abcdef0123456789';
const MINUTE = '2026-10-10 10:00';
const ESSAI = (o: Record<string, unknown> = {}) => ({
  row: 5,
  prenom: 'Ada',
  nom: 'Exemple',
  tel: '06 00 00 00 01',
  cours: 'Zumba',
  creneau: '22/10/2026 · Zumba',
  demandeLe: MINUTE,
  statut: 'À venir',
  notes: '',
  ...o,
});
const adresses = (...essais: ReturnType<typeof ESSAI>[]) => new Map(essais.map((e, i) => [cleEssai(e, SECRET), `p${i}@exemple.fr`]));

/** Faux Netlify Blobs, avec list() et delete(). */
const stock = new Map<string, unknown>();
function simulerBlobs() {
  vi.doMock('@netlify/blobs', () => ({
    getStore: () => ({
      get: async (k: string) => stock.get(k) ?? null,
      setJSON: async (k: string, v: unknown) => void stock.set(k, v),
      list: async () => ({ blobs: [...stock.keys()].map((key) => ({ key })) }),
      delete: async (k: string) => void stock.delete(k),
    }),
  }));
}

describe('e-mail de l’essai — l’adresse et le prénom', () => {
  it('garde une adresse qui en a la forme, en minuscules ; refuse le reste', () => {
    expect(mailValide('  Ada@Exemple.FR ')).toBe('ada@exemple.fr');
    for (const mauvais of ['', 'ada', 'ada@', '@exemple.fr', 'a b@exemple.fr', 'ada@exemple', `${'x'.repeat(120)}@exemple.fr`]) {
      expect(mailValide(mauvais), mauvais).toBe('');
    }
  });

  it('seul un prénom fait de lettres est écrit dans un mail : pas de lien, de chiffre, de saut de ligne', () => {
    expect(prenomPourMail('Ada')).toBe('Ada');
    expect(prenomPourMail('  Jean-Pierre ')).toBe('Jean-Pierre');
    expect(prenomPourMail('Léa-Rose')).toBe('Léa-Rose');
    for (const piege of ['', 'Cliquez https://pirate.example', 'Ada\nBcc: x@y.z', 'Ada <b>', 'A1', 'Ada@exemple.fr', 'x'.repeat(60)]) {
      expect(prenomPourMail(piege), piege).toBe('');
    }
  });

  it('la clé du téléphone est une empreinte : jamais le numéro, la même quelle que soit la mise en forme', () => {
    const k = cleTel('06 00 00 00 01', SECRET);
    expect(k).toMatch(/^m-[0-9a-f]{24}$/);
    expect(k).not.toMatch(/0600/);
    expect(cleTel('+33 6 00 00 00 01', SECRET)).toBe(k);
    expect(cleTel('06 00 00 00 02', SECRET)).not.toBe(k);
    expect(cleTel('0612', SECRET)).toBe('');
    expect(cleTel('06 00 00 00 01', 'court')).toBe('');
  });
});

describe('e-mail de l’essai — une adresse = une demande', () => {
  it('la clé d’une demande dépend du téléphone et de la minute de la demande, pas du créneau', () => {
    const base = cleEssai(ESSAI(), SECRET);
    expect(base).toMatch(/^m-[0-9a-f]{24}$/);
    expect(cleEssai(ESSAI({ creneau: '' }), SECRET)).toBe(base);
    expect(cleEssai(ESSAI({ creneau: '29/10/2026 · Pilates' }), SECRET)).toBe(base);
    expect(cleEssai(ESSAI({ tel: '+33600000001' }), SECRET)).toBe(base);
    expect(cleEssai(ESSAI({ demandeLe: '2026-10-10 10:01' }), SECRET)).not.toBe(base);
    expect(cleEssai(ESSAI({ tel: '06 00 00 00 02' }), SECRET)).not.toBe(base);
    expect(cleEssai(ESSAI({ demandeLe: '' }), SECRET)).toBe('');
  });

  it('la minute se lit telle que le site l’écrit, ou telle que Google Sheets l’affiche', () => {
    expect(minuteDemande('2026-10-10T10:00:33')).toBe(MINUTE);
    expect(minuteDemande("'2026-10-10 10:00:33")).toBe(MINUTE);
    expect(minuteDemande('10/10/2026 10:00:33')).toBe(MINUTE);
    expect(minuteDemande('10/10/2026 9:05:00')).toBe('2026-10-10 09:05');
    expect(minuteDemande('hier')).toBe('');
  });

  it('saisir le numéro d’un tiers ne détourne pas ses rappels : sa demande garde sa propre adresse', () => {
    const victime = ESSAI({ prenom: 'Ada', demandeLe: '2026-10-10 10:00' });
    const attaquant = ESSAI({ prenom: 'Eve', nom: 'Autre', demandeLe: '2026-10-12 17:42' }); // même numéro, autre demande
    const mails = new Map([
      [cleEssai(victime, SECRET), 'ada@exemple.fr'],
      [cleEssai(attaquant, SECRET), 'eve@exemple.fr'],
    ]);
    const plan = planMails([victime, attaquant], mails, '2026-10-21', SECRET);
    expect(plan.map((p: { essai: { prenom: string }; mail: string }) => [p.essai.prenom, p.mail]).sort()).toEqual([
      ['Ada', 'ada@exemple.fr'],
      ['Eve', 'eve@exemple.fr'],
    ]);
  });
});

describe('e-mail de l’essai — qui reçoit quel mail', () => {
  it('la veille : l’essai de demain, avec une adresse', () => {
    const e = ESSAI();
    const p = planMails([e], adresses(e), '2026-10-21', SECRET);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ type: 'veille', mail: 'p0@exemple.fr', essaiYmd: '2026-10-22' });
    const autreJour = ESSAI({ creneau: '25/10/2026 · Zumba' });
    expect(planMails([autreJour], adresses(autreJour), '2026-10-21', SECRET)).toEqual([]);
    const annule = ESSAI({ statut: 'Annulé' });
    expect(planMails([annule], adresses(annule), '2026-10-21', SECRET)).toEqual([]);
  });

  it('après l’essai : un mot pour ceux qui sont venus, pas avant, pas trop tard', () => {
    const venu = ESSAI({ statut: 'Venu', creneau: '20/10/2026 · Zumba' });
    expect(planMails([venu], adresses(venu), '2026-10-21', SECRET).map((p: { type: string }) => p.type)).toEqual(['merci']);
    const vieux = ESSAI({ statut: 'Venu', creneau: '10/10/2026 · Zumba' });
    expect(planMails([vieux], adresses(vieux), '2026-10-21', SECRET)).toEqual([]);
    const absent = ESSAI({ statut: 'Absent', creneau: '20/10/2026 · Zumba' });
    expect(planMails([absent], adresses(absent), '2026-10-21', SECRET)).toEqual([]);
  });

  it('sans adresse pour cette demande : aucun mail, même si le numéro est connu ailleurs', () => {
    const e = ESSAI();
    expect(planMails([e], new Map(), '2026-10-21', SECRET)).toEqual([]);
    expect(planMails([ESSAI({ demandeLe: '2026-10-11 09:00' })], adresses(e), '2026-10-21', SECRET)).toEqual([]);
  });

  it('un prénom piégé n’est jamais écrit dans un mail : la demande est ignorée', () => {
    const piege = ESSAI({ prenom: 'Gagnez 500 € sur https://pirate.example' });
    expect(planMails([piege], adresses(piege), '2026-10-21', SECRET)).toEqual([]);
  });

  it('une même adresse ne reçoit qu’un mail de chaque sorte par passage, même avec plusieurs demandes', () => {
    const a = ESSAI({ row: 5, tel: '06 00 00 00 01', demandeLe: '2026-10-10 10:00' });
    const b = ESSAI({ row: 6, tel: '06 00 00 00 02', demandeLe: '2026-10-10 10:01' });
    const mails = new Map([
      [cleEssai(a, SECRET), 'victime@exemple.fr'],
      [cleEssai(b, SECRET), 'victime@exemple.fr'],
    ]);
    expect(planMails([a, b], mails, '2026-10-21', SECRET)).toHaveLength(1);
  });

  it('jamais deux fois : un mail déjà noté, ou le même rappel déjà noté par le bureau, ne repart pas', () => {
    expect(noteMail('veille', '2026-10-22')).toBe('Mail veille essai 22/10/2026');
    expect(mailsEnvoyes('Mail veille essai 22/10/2026 | Mail merci essai 23/10/2026', 'veille')).toEqual(['22/10/2026']);
    const note = ESSAI({ notes: 'Mail veille essai 22/10/2026' });
    expect(planMails([note], adresses(note), '2026-10-21', SECRET)).toEqual([]);
    const bureau = ESSAI({ notes: 'Rappel veille essai 22/10/2026' });
    expect(planMails([bureau], adresses(bureau), '2026-10-21', SECRET)).toEqual([]);
  });
});

describe('e-mail de l’essai — les adhérents ne reçoivent rien', () => {
  const essai = ESSAI();
  const mails = adresses(essai);
  const fiches = (...f: Record<string, string>[]) => adherentsConnus(f);
  const jour = '2026-10-21';

  it('À jour ou En attente (demande d’adhésion faite) : exclu ; autre statut : pas exclu', () => {
    const base = { PRENOM: 'Ada', NOM: 'Exemple', TEL: '0600000001' };
    expect(planMails([essai], mails, jour, SECRET, fiches({ ...base, STATUT: 'À jour' }))).toHaveLength(0);
    expect(planMails([essai], mails, jour, SECRET, fiches({ ...base, STATUT: 'En attente' }))).toHaveLength(0);
    expect(planMails([essai], mails, jour, SECRET, fiches({ ...base, STATUT: 'Annulé' }))).toHaveLength(1);
    expect(planMails([essai], mails, jour, SECRET)).toHaveLength(1);
  });

  it('même numéro mais autre prénom : l’essai reste servi ; autre numéro mais même nom : exclu', () => {
    expect(planMails([essai], mails, jour, SECRET, fiches({ PRENOM: 'Léo', NOM: 'Autre', TEL: '0600000001', STATUT: 'À jour' }))).toHaveLength(1);
    expect(planMails([essai], mails, jour, SECRET, fiches({ PRENOM: 'Ada', NOM: 'Exemple', TEL: '0611111111', STATUT: 'À jour' }))).toHaveLength(0);
  });
});

describe('e-mail de l’essai — la fonction planifiée', () => {
  const mails: { to: string; subject: string; text: string }[] = [];
  const maj: { row: number; updates: Record<string, string> }[] = [];
  const ADHERENTS: Record<string, string>[] = [];
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    delete process.env.ESSAI_MAILS;
  });

  const HEADERS = ['DATE_DEMANDE', 'NOM', 'PRENOM', 'TEL', 'CRENEAU', 'COURS', 'STATUT', 'NOTES'];
  const ligne = (row: number, prenom: string, tel: string, notes = '') => ({
    _row: row,
    DATE_DEMANDE: '2026-10-10T10:00:12',
    NOM: 'Exemple',
    PRENOM: prenom,
    TEL: tel,
    CRENEAU: '22/10/2026 · Zumba',
    COURS: 'Zumba',
    STATUT: 'À venir',
    NOTES: notes,
  });
  const LIGNES = [
    ligne(5, 'Ada', '+33600000001', 'Forum'),
    ligne(6, 'Bob', '+33600000002'),
    ligne(7, 'Gagnez 500 € sur https://pirate.example', '+33600000003'),
  ];

  async function charger(mode: string) {
    vi.resetModules();
    stock.clear();
    ADHERENTS.length = 0;
    mails.length = 0;
    maj.length = 0;
    if (mode) process.env.ESSAI_MAILS = mode;
    Object.assign(process.env, { BUREAU_SECRET: SECRET, SMTP_HOST: 'h' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T18:00:00+02:00'));
    // Ada et la ligne piégée ont laissé une adresse ; Bob non.
    stock.set(cleEssai({ tel: '+33600000001', demandeLe: MINUTE }, SECRET), { mail: 'ada@exemple.fr', le: '2026-10-10', p: cleTel('+33600000001', SECRET) });
    stock.set(cleEssai({ tel: '+33600000003', demandeLe: MINUTE }, SECRET), { mail: 'pirate@exemple.fr', le: '2026-10-10', p: cleTel('+33600000003', SECRET) });
    simulerBlobs();
    vi.doMock('../netlify/functions/_envoi.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      envoyerMail: async (m: { to: string; subject: string; text: string }) => void mails.push(m),
    }));
    vi.doMock('../netlify/functions/wallet.mjs', () => ({
      lirePlanning: async () => [{ day: 'Jeudi', time: '19h30 – 20h30', course: 'Zumba', location: 'Gymnase municipal', note: '' }],
    }));
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getEssaisSheetId: () => 'ess',
      getEssaisTab: () => 'Essais',
      getAdherentsSheetId: () => 'adh',
      getAdherentsTab: () => 'Saison',
      readSheetAsObjects: async (id: string) =>
        id === 'adh'
          ? { headers: ['PRENOM', 'NOM', 'TEL', 'STATUT'], rows: ADHERENTS, colIndices: [0, 1, 2, 3] }
          : { headers: HEADERS, rows: LIGNES, colIndices: HEADERS.map((_, i) => i) },
      updateRowByHeaders: async (_id: string, _tab: string, row: number, updates: Record<string, string>) => void maj.push({ row, updates }),
    }));
    return (await import('../netlify/functions/rappels-essai-mail.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }

  it('aperçu : compte sans rien envoyer ni noter', async () => {
    const traiter = await charger('apercu');
    expect((await traiter({ headers: {} })).body).toBe('aperçu');
    expect(mails).toHaveLength(0);
    expect(maj).toHaveLength(0);
  }, { timeout: 20_000 });

  it('envoie le rappel à la seule personne qui a laissé une adresse et un prénom sûr, le note, et ne le renvoie pas', async () => {
    const traiter = await charger('');
    expect((await traiter({ headers: {} })).body).toBe('envoyés 1');
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('ada@exemple.fr');
    expect(mails[0].text).toContain('Bonjour Ada,');
    expect(mails[0].text).toContain('demain');
    expect(mails[0].text).toMatch(/Pour ne plus en recevoir : https:\/\/\S+\/api\/essai-mail-stop\?t=m-[0-9a-f]{24}\./);
    expect(mails[0].text).not.toContain('ada@exemple');
    expect(JSON.stringify(mails)).not.toContain('pirate');
    expect(maj).toEqual([{ row: 5, updates: { NOTES: 'Forum | Mail veille essai 22/10/2026' } }]);
    LIGNES[0].NOTES = 'Forum | Mail veille essai 22/10/2026';
    expect((await traiter({ headers: {} })).body).toBe('rien à envoyer');
    expect(mails).toHaveLength(1);
    LIGNES[0].NOTES = 'Forum';
  }, { timeout: 20_000 });

  it('ne rien envoyer à une personne déjà adhérente, même sous un autre numéro', async () => {
    const traiter = await charger('');
    ADHERENTS.push({ PRENOM: 'ada', NOM: 'EXEMPLE', TEL: '+33699999999', STATUT: 'À jour' });
    expect((await traiter({ headers: {} })).body).toBe('rien à envoyer');
    expect(mails).toHaveLength(0);
  }, { timeout: 20_000 });
});

describe('e-mail de l’essai — la demande d’essai le range', () => {
  const lignes: unknown[][] = [];
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  async function charger() {
    vi.resetModules();
    stock.clear();
    lignes.length = 0;
    process.env.BUREAU_SECRET = SECRET;
    process.env.STOCKAGE = 'netlify';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T10:00:00+02:00'));
    simulerBlobs();
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getEssaisSheetId: () => 'ess',
      getEssaisTab: () => 'Essais',
      readSheetAsObjects: async () => ({ headers: ['DATE_DEMANDE', 'NOM', 'PRENOM', 'TEL', 'CRENEAU', 'COURS', 'STATUT', 'N_ESSAI', 'SOURCE', 'NOTES'], rows: [] }),
      appendRow: async (_i: string, _t: string, row: unknown[]) => void lignes.push(row),
    }));
    vi.doMock('../netlify/functions/_essai-mail.mjs', () => ({ sendEssaiNotification: async () => ({ sent: true }) }));
    vi.doMock('../netlify/functions/_notify-bureau.mjs', () => ({ notifyBureauNewLead: async () => {} }));
    return (await import('../netlify/functions/essai.mjs')).traiter as (e: unknown) => Promise<{ statusCode: number; body: string }>;
  }
  const demande = (corps: Record<string, unknown>) => ({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': `ip-${Math.random()}` },
    body: JSON.stringify({ prenom: 'Ada', nom: 'Exemple', telephone: '06 00 00 00 01', ...corps }),
  });

  it('une adresse valable est rangée à part, liée à la demande ; la ligne de l’essai ne la contient pas', async () => {
    const traiter = await charger();
    expect((await traiter(demande({ email: 'Ada@Exemple.FR' }))).statusCode).toBe(200);
    const minute = minuteDemande(String((lignes[0] as string[])[0]));
    expect(minute).toBe(MINUTE);
    const cle = cleEssai({ tel: '06 00 00 00 01', demandeLe: minute }, SECRET);
    expect(stock.get(cle)).toMatchObject({ mail: 'ada@exemple.fr', le: '2026-10-10', p: cleTel('06 00 00 00 01', SECRET) });
    expect(JSON.stringify(lignes)).not.toMatch(/ada@exemple/i);
  }, { timeout: 20_000 });

  it('une adresse mal formée ne bloque pas l’essai et n’est pas rangée ; sans adresse, rien n’est rangé', async () => {
    const traiter = await charger();
    expect((await traiter(demande({ email: 'pas-une-adresse' }))).statusCode).toBe(200);
    expect(stock.size).toBe(0);
    expect((await traiter(demande({ creneau: 'autre' }))).statusCode).toBe(200);
    expect(stock.size).toBe(0);
    expect(lignes).toHaveLength(2);
  }, { timeout: 20_000 });

  it('une seconde demande avec le numéro d’un tiers et une autre adresse ne change pas l’adresse de la première', async () => {
    const traiter = await charger();
    await traiter(demande({ email: 'ada@exemple.fr' }));
    vi.setSystemTime(new Date('2026-10-12T17:42:00+02:00'));
    await traiter(demande({ prenom: 'Eve', email: 'eve@exemple.fr' }));
    const adressesRangees = [...stock.values()].map((v) => (v as { mail: string }).mail).sort();
    expect(adressesRangees).toEqual(['ada@exemple.fr', 'eve@exemple.fr']);
    expect(stock.size).toBe(2);
  }, { timeout: 20_000 });
});

describe('e-mail de l’essai — désinscription et durée de conservation', () => {
  afterEach(() => vi.resetModules());

  it('le jeton de désinscription ne contient aucune adresse et ne se falsifie pas', () => {
    const cle = cleTel('06 00 00 00 01', SECRET);
    const j = jetonStopMail(cle, SECRET);
    expect(j).not.toMatch(/ada|exemple|0600/);
    expect(cleDuJetonStopMail(j, SECRET)).toBe(cle);
    expect(cleDuJetonStopMail(`${cle}.${'x'.repeat(22)}`, SECRET)).toBe('');
    expect(cleDuJetonStopMail(j, `${SECRET}x`)).toBe('');
    expect(cleDuJetonStopMail('n-importe-quoi.abc', SECRET)).toBe('');
    expect(cleDuJetonStopMail('', SECRET)).toBe('');
  });

  it('se désinscrire efface toutes les adresses de ce téléphone et garde les autres ; une demande plus récente fonctionne', async () => {
    vi.resetModules();
    stock.clear();
    simulerBlobs();
    const m = await import('../netlify/functions/_essai-mails.mjs');
    const d1 = { tel: '06 00 00 00 01', demandeLe: '2026-10-10 10:00' };
    const d2 = { tel: '06 00 00 00 01', demandeLe: '2026-10-11 11:00' };
    const autre = { tel: '06 00 00 00 02', demandeLe: '2026-10-10 10:00' };
    await m.ecrireMail(d1, 'ada@exemple.fr', '2026-10-10', SECRET);
    await m.ecrireMail(d2, 'ada2@exemple.fr', '2026-10-11', SECRET);
    await m.ecrireMail(autre, 'bob@exemple.fr', '2026-10-10', SECRET);
    expect((await m.lireMails([d1, d2, autre], SECRET)).size).toBe(3);

    await m.arreterMail(m.cleTel('06 00 00 00 01', SECRET), '2026-10-12');
    const apres = await m.lireMails([d1, d2, autre], SECRET);
    expect([...apres.values()]).toEqual(['bob@exemple.fr']);
    expect(JSON.stringify([...stock.values()])).not.toContain('ada@exemple');
    expect(JSON.stringify([...stock.values()])).not.toContain('ada2@exemple');

    // Nouvelle demande de la personne après son « stop » : c'est une nouvelle volonté, elle fonctionne.
    const d3 = { tel: '06 00 00 00 01', demandeLe: '2026-10-20 09:00' };
    await m.ecrireMail(d3, 'ada@exemple.fr', '2026-10-20', SECRET);
    expect([...(await m.lireMails([d3], SECRET)).values()]).toEqual(['ada@exemple.fr']);
  }, { timeout: 20_000 });

  it('la purge efface les adresses de plus de 12 mois, garde les récentes, ignore ce qui n’est pas une entrée', async () => {
    vi.resetModules();
    stock.clear();
    simulerBlobs();
    const m = await import('../netlify/functions/_essai-mails.mjs');
    const vieille = m.cleEssai({ tel: '06 00 00 00 01', demandeLe: '2025-10-10 10:00' }, SECRET);
    const recente = m.cleEssai({ tel: '06 00 00 00 02', demandeLe: '2025-10-22 10:00' }, SECRET);
    stock.set(vieille, { mail: 'a@exemple.fr', le: '2025-10-10' });
    stock.set(recente, { mail: 'b@exemple.fr', le: '2025-10-22' });
    stock.set('autre-chose', { le: '2020-01-01' });
    expect(await m.purgerMails('2026-10-21')).toBe(1);
    expect(stock.has(vieille)).toBe(false);
    expect(stock.has(recente)).toBe(true);
    expect(stock.has('autre-chose')).toBe(true);
  }, { timeout: 20_000 });

  it('la page de désinscription efface l’adresse avec un lien valide, refuse un faux', async () => {
    vi.resetModules();
    stock.clear();
    process.env.BUREAU_SECRET = SECRET;
    simulerBlobs();
    const { traiter } = await import('../netlify/functions/essai-mail-stop.mjs');
    const m = await import('../netlify/functions/_essai-mails.mjs');
    const d = { tel: '06 00 00 00 01', demandeLe: '2026-10-10 10:00' };
    await m.ecrireMail(d, 'ada@exemple.fr', '2026-10-10', SECRET);
    const cle = m.cleTel(d.tel, SECRET);
    const ok = await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: m.jetonStopMail(cle, SECRET) } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).not.toMatch(/ada|exemple|0600/);
    expect(stock.get(cle)).toMatchObject({ stop: true });
    expect(JSON.stringify([...stock.values()])).not.toContain('ada@exemple');
    stock.clear();
    expect((await traiter({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: `${cle}.${'a'.repeat(22)}` } })).statusCode).toBe(404);
    expect(stock.size).toBe(0);
  }, { timeout: 20_000 });
});
