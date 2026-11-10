import { describe, expect, it } from 'vitest';
import {
  erreurReglages,
  lireLignesReglages,
  lignesReglages,
  normaliserReglages,
} from '../netlify/functions/_reglages.mjs';
import { colonneDecalee, ADHERENTS_HEADERS, ESSAIS_HEADERS } from '../netlify/functions/_bureau-lib.mjs';

describe('réglages tarif / fin des essais', () => {
  it('refuse un tarif nul ou une date mal formée', () => {
    expect(erreurReglages({ tarif: 0, finEssais: '' })).toMatch(/entier/);
    expect(erreurReglages({ tarif: 140, finEssais: '20/10/2026' })).toMatch(/AAAA-MM-JJ/);
    expect(erreurReglages({ tarif: 140, finEssais: '2026-10-20' })).toBeNull();
    expect(erreurReglages({ tarif: 140, finEssais: '' })).toBeNull();
  });

  it('lit TARIF et FIN_ESSAIS même si les colonnes sont inversées', () => {
    const lu = lireLignesReglages([
      ['FIN_ESSAIS', 'TARIF'],
      ['2026-10-20', '140'],
    ]);
    expect(lu).toEqual({ ok: true, reglages: { tarif: 140, finEssais: '2026-10-20' } });
  });

  it('si les en-têtes ont bougé : on ne prend pas les valeurs', () => {
    expect(lireLignesReglages([['PRIX', 'DATE'], ['140', '2026-10-20']]).ok).toBe(false);
    expect(lireLignesReglages([]).raison).toBe('vide');
    expect(lireLignesReglages([[]]).raison).toBe('vide');
  });

  it('réécrit l’onglet dans l’ordre canonique', () => {
    expect(lignesReglages(normaliserReglages({ tarif: 90, finEssais: '2026-12-01' }))).toEqual([
      ['TARIF', 'FIN_ESSAIS'],
      ['90', '2026-12-01'],
    ]);
  });
});

describe('garde-fou colonnes Essais / Adhérents', () => {
  it('accepte le préfixe attendu, y compris une colonne ajoutée à la fin', () => {
    expect(colonneDecalee(ESSAIS_HEADERS, ESSAIS_HEADERS)).toBeNull();
    expect(colonneDecalee([...ADHERENTS_HEADERS, 'NUMERO', 'CARTE'], ADHERENTS_HEADERS)).toBeNull();
  });

  it('signale la première colonne manquante ou décalée', () => {
    const permut = [...ESSAIS_HEADERS];
    [permut[0], permut[1]] = [permut[1], permut[0]];
    expect(colonneDecalee(permut, ESSAIS_HEADERS)).toBe(ESSAIS_HEADERS[0]);
    expect(colonneDecalee(['PRENOM'], ADHERENTS_HEADERS)).toBe(ADHERENTS_HEADERS[0]);
  });
});
