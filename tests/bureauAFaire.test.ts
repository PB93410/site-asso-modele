import { afterEach, describe, expect, it, vi } from 'vitest';
import { estRole, lireRole, ordonnerActions, retenirRole, ROLE_PAR_DEFAUT } from '../src/lib/bureauAFaire';

const actions = ['pointer', 'confirmer', 'encaisser', 'relances', 'cartes'].map((cle) => ({ cle }));
const ordre = (role: Parameters<typeof ordonnerActions>[1]) => ordonnerActions(actions, role).map((a) => a.cle);

describe('accueil du bureau — ordre selon le rôle', () => {
  it('trésorerie : l’argent et les cartes d’abord', () => {
    expect(ordre('tresorerie')).toEqual(['encaisser', 'cartes', 'pointer', 'confirmer', 'relances']);
  });
  it('présidence : les nouvelles demandes et les relances d’abord', () => {
    expect(ordre('presidence')).toEqual(['confirmer', 'relances', 'encaisser', 'cartes', 'pointer']);
  });
  it('bénévole : la séance d’abord (pointer, confirmer)', () => {
    expect(ordre('benevole')).toEqual(['pointer', 'confirmer', 'relances', 'encaisser', 'cartes']);
  });
  it('ne cache rien : même nombre d’actions, action inconnue en dernier', () => {
    const avecInconnue = [...actions, { cle: 'autre' }];
    expect(ordonnerActions(avecInconnue, 'tresorerie')).toHaveLength(6);
    expect(ordonnerActions(avecInconnue, 'tresorerie').at(-1)?.cle).toBe('autre');
  });
});

describe('accueil du bureau — rôle retenu sur le téléphone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('relit le rôle retenu, sinon le rôle par défaut', () => {
    const memo = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => memo.get(k) ?? null, setItem: (k: string, v: string) => void memo.set(k, v) } });
    expect(lireRole()).toBe(ROLE_PAR_DEFAUT);
    retenirRole('tresorerie');
    expect(lireRole()).toBe('tresorerie');
    memo.set('bureau-role', 'pirate');
    expect(lireRole()).toBe(ROLE_PAR_DEFAUT);
  });

  it('stockage bloqué (navigation privée) : ne plante pas', () => {
    const boom = () => {
      throw new Error('bloqué');
    };
    vi.stubGlobal('window', { localStorage: { getItem: boom, setItem: boom } });
    expect(lireRole()).toBe(ROLE_PAR_DEFAUT);
    expect(() => retenirRole('presidence')).not.toThrow();
    expect(estRole('presidence')).toBe(true);
  });
});
