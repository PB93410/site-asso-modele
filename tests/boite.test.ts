import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lireImap,
  listerImap,
  messageImap,
  modeBoite,
  pageSequence,
  partieTexte,
  reglagesImap,
  repondreImap,
  texteDepuisHtml,
} from '../netlify/functions/_boite.mjs';

type Msg = { seq: number; uid: number; from: string; subject: string; texte: string; html?: boolean; refs?: string; messageId?: string };

/** Faux serveur IMAP : la boîte de réception, les drapeaux et le dossier Envoyés. */
function fauxImap(msgs: Msg[], { refuse = false } = {}) {
  const etat = { flags: new Map<number, string[]>(), envoyes: [] as string[], deconnecte: 0 };
  class Client {
    mailbox = { exists: msgs.length, uidValidity: 77 };
    constructor(public opts: Record<string, unknown>) {}
    async connect() {
      if (refuse) throw Object.assign(new Error('Command failed'), { authenticationFailed: true });
    }
    async getMailboxLock() {
      return { release() {} };
    }
    structure(m: Msg) {
      return m.html
        ? { childNodes: [{ type: 'text/html', part: '1' }, { type: 'application/pdf', part: '2', disposition: 'attachment' }] }
        : { childNodes: [{ type: 'text/plain', part: '1' }, { type: 'text/html', part: '2' }] };
    }
    env(m: Msg) {
      return { from: [{ name: m.from, address: `${m.from.toLowerCase()}@example.fr` }], subject: m.subject, date: new Date('2026-10-12T08:00:00Z'), messageId: m.messageId || `<${m.uid}@example.fr>`, to: [{ address: 'bureau@club.fr' }] };
    }
    async *fetch(plage: string) {
      const [a, b] = plage.split(':').map(Number);
      for (const m of msgs.filter((x) => x.seq >= a && x.seq <= b)) yield { seq: m.seq, uid: m.uid, envelope: this.env(m), bodyStructure: this.structure(m) };
    }
    async fetchOne(uid: string) {
      const m = msgs.find((x) => x.uid === Number(uid));
      if (!m) return false;
      return { uid: m.uid, envelope: this.env(m), bodyStructure: this.structure(m), headers: Buffer.from(m.refs ? `References: ${m.refs}\r\n` : '') };
    }
    async download(uid: string, part: string, opts: { maxBytes?: number }) {
      const m = msgs.find((x) => x.uid === Number(uid))!;
      expect(part).toBe('1');
      const t = opts.maxBytes ? m.texte.slice(0, opts.maxBytes) : m.texte;
      return { meta: {}, content: (async function* () { yield Buffer.from(t); })() };
    }
    async messageFlagsAdd(uid: string, flags: string[]) {
      etat.flags.set(Number(uid), flags);
    }
    async list() {
      return [{ path: 'INBOX' }, { path: 'Sent', specialUse: '\\Sent' }];
    }
    async append(path: string, brut: Buffer) {
      expect(path).toBe('Sent');
      etat.envoyes.push(brut.toString());
    }
    async logout() {
      etat.deconnecte += 1;
    }
  }
  return { Client, etat };
}

const ENV = { IMAP_HOST: 'ssl0.ovh.net', SMTP_USER: 'bureau@club.fr', SMTP_PASS: 'x', MAIL_ASSO: 'bureau@club.fr' };
const BOITE: Msg[] = Array.from({ length: 25 }, (_, i) => ({ seq: i + 1, uid: 100 + i, from: `Personne${i + 1}`, subject: `Sujet ${i + 1}`, texte: `Bonjour ${i + 1}` }));

describe('boîte mail IMAP — réglages', () => {
  it('IMAP si IMAP_HOST, Gmail si connecté, rien sinon', () => {
    expect(modeBoite({}, false)).toBe(null);
    expect(modeBoite({ GOOGLE_REFRESH_TOKEN: 't' }, false)).toBe('gmail');
    expect(modeBoite({ GOOGLE_REFRESH_TOKEN: 't', IMAP_HOST: 'h' }, false)).toBe('imap');
    expect(modeBoite({ IMAP_HOST: 'h', MAIL_BOITE: 'gmail' }, false)).toBe('gmail');
    expect(modeBoite({}, true)).toBe('gmail');
  });

  it('reprend les identifiants du SMTP, port 993 chiffré par défaut', () => {
    expect(reglagesImap(ENV)).toEqual({ host: 'ssl0.ovh.net', port: 993, secure: true, auth: { user: 'bureau@club.fr', pass: 'x' } });
    expect(reglagesImap({ ...ENV, IMAP_PORT: '143', IMAP_USER: 'u', IMAP_PASS: 'p' }).secure).toBe(false);
  });

  it('pages de 20, des plus récents aux plus anciens', () => {
    expect(pageSequence(25, undefined)).toEqual({ plage: '6:25', suivante: '5' });
    expect(pageSequence(25, '5')).toEqual({ plage: '1:5', suivante: null });
    expect(pageSequence(0, undefined)).toBe(null);
  });

  it('trouve le texte, pas la pièce jointe', () => {
    expect(partieTexte({ childNodes: [{ type: 'text/html', part: '1.2' }, { type: 'text/plain', part: '1.1' }] })).toEqual({ part: '1.1', html: false });
    expect(partieTexte({ childNodes: [{ type: 'text/plain', part: '2', disposition: 'attachment' }, { type: 'text/html', part: '1' }] })).toEqual({ part: '1', html: true });
    expect(partieTexte({ type: 'image/png' })).toBe(null);
    expect(texteDepuisHtml('<p>Bonjour&nbsp;Marie</p><br>À <b>bientôt</b> &amp; merci')).toBe('Bonjour Marie\n\nÀ bientôt & merci');
  });

  it('messages clairs pour le bureau', () => {
    expect(messageImap({ authenticationFailed: true })).toMatch(/mot de passe/);
    expect(messageImap({ code: 'ENOTFOUND' })).toMatch(/IMAP_HOST/);
  });
});

describe('boîte mail IMAP — lecture et réponse', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('liste la boîte, avec un aperçu, et referme la connexion', async () => {
    const { Client, etat } = fauxImap(BOITE);
    const page = await listerImap({}, ENV, Client);
    expect(page.messages).toHaveLength(20);
    expect(page.messages[0]).toMatchObject({ id: '77.124', from: 'Personne25 <personne25@example.fr>', subject: 'Sujet 25', snippet: 'Bonjour 25' });
    expect(page.nextPageToken).toBe('5');
    const suite = await listerImap({ pageToken: '5' }, ENV, Client);
    expect(suite.messages.map((m: { subject: string }) => m.subject)).toEqual(['Sujet 5', 'Sujet 4', 'Sujet 3', 'Sujet 2', 'Sujet 1']);
    expect(etat.deconnecte).toBe(2);
  });

  it('lit un message HTML en texte ; un ancien identifiant est refusé', async () => {
    const { Client } = fauxImap([{ seq: 1, uid: 5, from: 'Marie', subject: 'Question', texte: '<p>Le cours du <b>lundi</b> ?</p>', html: true }]);
    const m = await lireImap('77.5', ENV, Client);
    expect(m.text).toBe('Le cours du lundi ?');
    await expect(lireImap('12.5', ENV, Client)).rejects.toMatchObject({ code: 404 });
  });

  it('répond dans le fil, marque « répondu », range la copie dans Envoyés', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.stubGlobal('fetch', fetch);
    const { Client, etat } = fauxImap([{ seq: 1, uid: 9, from: 'Marie', subject: 'Question', texte: 'Bonjour', messageId: '<m9@example.fr>', refs: '<m1@example.fr>' }]);
    await repondreImap('77.9', 'Oui, venez lundi.', { ...ENV, MAIL_ENVOI: 'brevo', BREVO_API_KEY: 'k' }, Client);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.to).toEqual([{ email: 'marie@example.fr' }]);
    expect(body.subject).toBe('Re: Question');
    expect(body.headers).toEqual({ 'In-Reply-To': '<m9@example.fr>', References: '<m1@example.fr> <m9@example.fr>' });
    expect(etat.flags.get(9)).toEqual(['\\Answered']);
    expect(etat.envoyes[0]).toMatch(/^In-Reply-To: <m9@example\.fr>/m);
    expect(etat.envoyes[0]).toContain('Oui, venez lundi.');
  });

  it('mauvais mot de passe : message clair, pas de plantage', async () => {
    const { Client } = fauxImap(BOITE, { refuse: true });
    await expect(listerImap({}, ENV, Client)).rejects.toMatchObject({ lisible: true, message: expect.stringMatching(/IMAP_USER/) });
  });

  it('sans réglage : la boîte n’est pas branchée', async () => {
    const { Client } = fauxImap(BOITE);
    await expect(listerImap({}, {}, Client)).rejects.toMatchObject({ code: 503 });
  });
});
