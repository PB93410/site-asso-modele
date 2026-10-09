import { describe, expect, it } from 'vitest';
import { eventIsoDates, eventKey } from '../src/lib/events';
import { buildEventsSchema } from '../src/lib/schema';
import type { Event } from '../src/data/siteData';

const ev = (over: Partial<Event>): Event => ({
  id: 'x',
  date: '15',
  month: 'NOV',
  year: '2026',
  title: 'Portes ouvertes',
  description: '',
  time: '10h00',
  location: 'Gymnase municipal',
  ...over,
});

describe('dates ISO des événements', () => {
  it('heure + fuseau de Paris (hiver / été)', () => {
    expect(eventIsoDates(ev({}))?.startDate).toBe('2026-11-15T10:00:00+01:00');
    expect(eventIsoDates(ev({ month: 'JUIN', date: '20' }))?.startDate).toBe('2026-06-20T10:00:00+02:00');
  });

  it('plage de jours et d’heures', () => {
    const d = eventIsoDates(ev({ date: '4-5', month: 'DÉC', time: '09h00 – 19h00' }));
    expect(d).toEqual({ startDate: '2026-12-04T09:00:00+01:00', endDate: '2026-12-05T19:00:00+01:00' });
  });

  it('sans heure : jour seul', () => {
    expect(eventIsoDates(ev({ time: 'Selon planning' }))).toEqual({ startDate: '2026-11-15', endDate: '2026-11-15' });
  });
});

describe('eventKey', () => {
  it('même événement malgré apostrophe, accents et espaces', () => {
    expect(eventKey('Repas de fin d’année')).toBe(eventKey("repas de  fin d'annee "));
  });
});

describe('buildEventsSchema', () => {
  const now = new Date(2026, 9, 8);

  it('garde les événements à venir avec lieu et organisateur', () => {
    const s = buildEventsSchema([ev({})], now);
    const node = s?.['@graph'][0] as Record<string, unknown>;
    expect(node['@type']).toBe('Event');
    expect((node.location as { name: string }).name).toBe('Gymnase municipal');
    expect(node.organizer).toBeTruthy();
  });

  it('écarte les événements passés et sans date ; null si rien à publier', () => {
    expect(buildEventsSchema([ev({ month: 'SEPT', date: '6' }), ev({ date: '' })], now)).toBeNull();
  });
});
