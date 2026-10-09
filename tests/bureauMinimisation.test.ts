import { describe, expect, it } from 'vitest';
import { isInboxMessage } from '../netlify/functions/bureau-mail.mjs';
import { onlyEssaiPhones } from '../netlify/functions/essais-list.mjs';

describe('mail bureau : boîte de réception seulement', () => {
  it('accepte INBOX, refuse envoyés / archives / sans libellé', () => {
    expect(isInboxMessage({ labelIds: ['INBOX', 'UNREAD'] })).toBe(true);
    expect(isInboxMessage({ labelIds: ['SENT'] })).toBe(false);
    expect(isInboxMessage({ labelIds: [] })).toBe(false);
    expect(isInboxMessage({})).toBe(false);
  });
});

describe('essais-list : adhérents à jour limités aux téléphones des essais', () => {
  it('ne renvoie que les clés dont le téléphone est dans Essais', () => {
    const essaiTels = new Set(['612345678']);
    const out = onlyEssaiPhones(
      ['612345678', '698765432'],
      ['612345678|marie', '612345678|paul', '698765432|anne'],
      essaiTels,
    );
    expect(out.keys).toEqual(['612345678']);
    expect(out.aJourKeys).toEqual(['612345678|marie', '612345678|paul']);
  });
});
