import { afterEach, describe, expect, it, vi } from 'vitest';
import { compterAPurger, messagePurge, rappelPurgeActif } from '../netlify/functions/rappel-purge.mjs';

const ESSAIS = [
  ['PRENOM', 'NOM', 'TEL', 'STATUT', 'CRENEAU', 'Date essai'],
  ['Ada', 'Exemple', '0600000001', 'Venu', '', '10/09/2025'], // plus de 12 mois, pas adhérente : à purger
  ['Bob', 'Exemple', '0600000002', 'Relancé', '', '10/05/2026'], // récent : gardé
  ['Cy', 'Exemple', '0600000003', 'Adhérent', '', '15/09/2025'], // ancien mais adhérent à jour : gardé
  ['Di', 'Exemple', '0600000004', 'Relancé', '12/08/2025 · Jeudi 19h30', ''], // créneau daté ancien : à purger
];
const ADHERENTS = [
  ['PRENOM', 'NOM', 'TEL', 'STATUT'],
  ['Cy', 'Exemple', '0600000003', 'À jour'],
];

describe('rappel de purge RGPD — le compte', () => {
  it('compte les essais de plus de 12 mois qui ne mènent à aucun adhérent à jour', () => {
    expect(compterAPurger(ESSAIS, ADHERENTS, '2026-10-15')).toEqual({ n: 2, avant: '2025-10-15', plusAncien: '2025-08-12' });
  });

  it('rien à purger : zéro', () => {
    expect(compterAPurger(ESSAIS.slice(0, 1), ADHERENTS, '2026-10-15').n).toBe(0);
    expect(compterAPurger([], [], '2026-10-15').n).toBe(0);
  });
});

describe('rappel de purge RGPD — le mail', () => {
  it('dit combien, depuis quand, et la commande à lancer, sans aucune donnée personnelle', () => {
    const { sujet, texte } = messagePurge({ n: 2, avant: '2025-10-15', plusAncien: '2025-08-12' }, 'ASE');
    expect(sujet).toBe('[ASE] RGPD : 2 anciens essais à supprimer');
    expect(texte).toContain('2 lignes du tableau des essais ont plus de 12 mois (avant le 15/10/2025, la plus ancienne date du 12/08/2025)');
    expect(texte).toContain('node scripts/archive-saison.mjs --avant 2025-10-15');
    expect(texte).toContain('--avant 2025-10-15 --apply');
    expect(texte).toContain('rien ne se supprime tout seul');
    expect(texte).not.toMatch(/Ada|Exemple|0600/);
  });

  it('accord au singulier', () => {
    const { sujet, texte } = messagePurge({ n: 1, avant: '2025-10-15', plusAncien: '' }, 'ASE');
    expect(sujet).toBe('[ASE] RGPD : 1 ancien essai à supprimer');
    expect(texte).toContain('1 ligne du tableau des essais a plus de 12 mois (avant le 15/10/2025)');
  });
});

describe('rappel de purge RGPD — quand il tourne', () => {
  const google = { STOCKAGE: 'google', SMTP_HOST: 'h' };
  it('stockage Google, module essais et envoi de mail : actif', () => {
    expect(rappelPurgeActif(google, { essais: true })).toBe(true);
  });
  it('éteint sans module essais, avec le stockage Netlify, sans envoi, ou avec PURGE_RAPPEL=non', () => {
    expect(rappelPurgeActif(google, { essais: false })).toBe(false);
    expect(rappelPurgeActif({ ...google, STOCKAGE: 'netlify' }, { essais: true })).toBe(false);
    expect(rappelPurgeActif({ STOCKAGE: 'google' }, { essais: true })).toBe(false);
    expect(rappelPurgeActif({ ...google, PURGE_RAPPEL: 'non' }, { essais: true })).toBe(false);
  });
});

describe('rappel de purge RGPD — la fonction planifiée', () => {
  const mails: { to: string; subject: string; text: string }[] = [];
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    delete process.env.PURGE_RAPPEL;
  });

  async function charger(essais: string[][], adherents: string[][]) {
    vi.resetModules();
    mails.length = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+02:00'));
    vi.doMock('../netlify/functions/_bureau-lib.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      getAdherentsSheetId: () => 'adh',
      getEssaisSheetId: () => 'ess',
      readSheetValues: async (id: string) => (id === 'ess' ? essais : adherents),
    }));
    vi.doMock('../netlify/functions/_envoi.mjs', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      envoyerMail: async (m: { to: string; subject: string; text: string }) => void mails.push(m),
    }));
    Object.assign(process.env, { STOCKAGE: 'google', GOOGLE_SERVICE_ACCOUNT_JSON: '{}', SMTP_HOST: 'h', MAIL_ASSO: 'asso@exemple.test' });
    delete process.env.DEMO;
    return (await import('../netlify/functions/rappel-purge.mjs')).traiter as () => Promise<{ statusCode: number; body: string }>;
  }

  it('envoie un seul rappel à la boîte de l’asso quand il y a des essais à purger', async () => {
    const traiter = await charger(ESSAIS, ADHERENTS);
    expect((await traiter()).body).toBe('rappel envoyé');
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('asso@exemple.test');
    expect(mails[0].text).not.toMatch(/Ada|0600/);
  }, { timeout: 20_000 });

  it('rien à purger : aucun mail', async () => {
    const traiter = await charger(ESSAIS.slice(0, 1), ADHERENTS);
    expect((await traiter()).body).toBe('rien à purger');
    expect(mails).toHaveLength(0);
  }, { timeout: 20_000 });

  it('coupé par PURGE_RAPPEL=non : aucun mail', async () => {
    const traiter = await charger(ESSAIS, ADHERENTS);
    process.env.PURGE_RAPPEL = 'non';
    expect((await traiter()).body).toBe('inactif');
    expect(mails).toHaveLength(0);
  }, { timeout: 20_000 });
});
