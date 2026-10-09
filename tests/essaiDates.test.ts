import { afterEach, describe, expect, it, vi } from 'vitest';
import { creneauLabel } from '../netlify/functions/_bureau-lib.mjs';
import { buildDateEssaiCell as buildDateEssaiCellServer } from '../netlify/functions/_essai-dates.mjs';
import { buildEssaiMailBody, buildEssaiMailSubject } from '../netlify/functions/_essai-mail.mjs';
import { buildEssaiCreneau } from '../netlify/functions/essai.mjs';
import { SCHEDULE } from '../src/data/siteData';
import { buildDateEssaiCell, essaiYmdFromCreneau, formatEssaiDateLabel } from '../src/lib/essaiDates';
import { msgBureauEssai, resolveCreneau } from '../src/lib/essaiMessages';

describe('date réelle dans CRENEAU', () => {
  it('essaiYmdFromCreneau lit une date en tête et ignore un créneau ancien', () => {
    expect(essaiYmdFromCreneau('13/10/2026 · Lundi 13h30 · Gym Douce')).toBe('2026-10-13');
    expect(essaiYmdFromCreneau('Lundi 13h30 · Gym Douce')).toBe('');
  });

  it('cours + créneau commence par une date', () => {
    const dated = buildDateEssaiCell('Gym Douce', 'lundi 13h30');
    const built = buildEssaiCreneau('Gym Douce', 'lundi 13h30', 'Lundi 13h30 · Gym Douce');
    expect(dated).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
    expect(built).toBe(`${dated} · Gym Douce`);
  });

  it('sans créneau, identique à creneauLabel', () => {
    expect(buildEssaiCreneau('Gym Douce', '', 'Lundi 13h30 · Gym Douce')).toBe(
      creneauLabel('Gym Douce', '', 'Lundi 13h30 · Gym Douce'),
    );
    expect(buildEssaiCreneau('Gym Douce', '', '')).toBe(creneauLabel('Gym Douce', '', ''));
  });

  it('un CRENEAU daté retrouve la salle et la date complète', () => {
    const cell = '12/10/2026 · Lundi 13h30 · Gym Douce';
    const label = 'lundi 12 octobre 2026 à 13h30';
    const info = resolveCreneau(SCHEDULE, 'Gym Douce', cell);
    expect(info.salle).toBe(SCHEDULE.find((s) => s.course === 'Gym Douce')?.location);
    expect(info.course).toBe('Gym Douce');
    expect(info.dayTime).toBe(label);
    const msg = msgBureauEssai('Marie', info);
    expect(msg).toContain(`essai Gym Douce : ${label}`);
    expect(msg).not.toContain('Lundi 13h30');
  });

  it('libellé daté : jour long et heure, sans répéter le jour ni le cours', () => {
    expect(formatEssaiDateLabel('12/10/2026 · Lundi 13h30 · Gym Douce')).toBe(
      'lundi 12 octobre 2026 à 13h30',
    );
    expect(formatEssaiDateLabel('Lundi 13h30 · Gym Douce')).toBe('Lundi 13h30 · Gym Douce');
  });

  it('le mail [ESSAI] garde le cours à part du libellé', () => {
    const label = 'lundi 12 octobre 2026 à 13h30';
    const subject = buildEssaiMailSubject({
      prenom: 'Marie',
      nom: 'Dupont',
      cours: 'Gym Douce',
      creneau: label,
    });
    const body = buildEssaiMailBody({
      prenom: 'Marie',
      nom: 'Dupont',
      telephone: '0612345678',
      cours: 'Gym Douce',
      creneau: label,
      nEssai: 1,
    });
    expect(subject.startsWith('[ESSAI]')).toBe(true);
    expect(subject).toContain(`Gym Douce · ${label}`);
    expect(subject).not.toContain('Lundi 13h30');
    expect(body).toContain(`Gym Douce · ${label}`);
  });

  it('cours du jour déjà passé : semaine suivante', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T21:00:00+02:00'));
    expect(buildDateEssaiCell('Cardio & Gym', 'mercredi 20h45')).toBe('14/10/2026 · Mercredi 20h45');
    expect(buildDateEssaiCellServer('Cardio & Gym', 'mercredi 20h45')).toBe('14/10/2026 · Mercredi 20h45');

    vi.setSystemTime(new Date('2026-10-07T10:00:00+02:00'));
    expect(buildDateEssaiCell('Cardio & Gym', 'mercredi 20h45')).toBe('07/10/2026 · Mercredi 20h45');
    expect(buildDateEssaiCellServer('Cardio & Gym', 'mercredi 20h45')).toBe('07/10/2026 · Mercredi 20h45');
  });
});

afterEach(() => {
  vi.useRealTimers();
});
