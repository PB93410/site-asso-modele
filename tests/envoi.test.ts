import { afterEach, describe, expect, it, vi } from 'vitest';
import { adresseAsso, envoyerMail, messageBrevo, messageBrut, messageSmtp, modeEnvoi } from '../netlify/functions/_envoi.mjs';

describe('choix du fournisseur de mail', () => {
  it('prend le premier configuré : SMTP, puis Brevo, puis Gmail', () => {
    expect(modeEnvoi({}, false)).toBe(null);
    expect(modeEnvoi({ GOOGLE_REFRESH_TOKEN: 'x' }, false)).toBe('gmail');
    expect(modeEnvoi({ GOOGLE_REFRESH_TOKEN: 'x', BREVO_API_KEY: 'k' }, false)).toBe('brevo');
    expect(modeEnvoi({ GOOGLE_REFRESH_TOKEN: 'x', BREVO_API_KEY: 'k', SMTP_HOST: 'ssl0.ovh.net' }, false)).toBe('smtp');
  });

  it('MAIL_ENVOI force le choix, « aucun » coupe l’envoi', () => {
    expect(modeEnvoi({ SMTP_HOST: 'h', MAIL_ENVOI: 'Gmail' }, false)).toBe('gmail');
    expect(modeEnvoi({ SMTP_HOST: 'h', MAIL_ENVOI: 'aucun' }, false)).toBe(null);
  });

  it('en démo, rien ne part pour de vrai', () => {
    expect(modeEnvoi({ SMTP_HOST: 'h' }, true)).toBe('demo');
  });

  it('adresse de l’asso : MAIL_ASSO, sinon ASSO_GMAIL, sinon la config', () => {
    expect(adresseAsso({ MAIL_ASSO: 'bureau@club.fr', ASSO_GMAIL: 'club@gmail.com' })).toBe('bureau@club.fr');
    expect(adresseAsso({ ASSO_GMAIL: 'club@gmail.com' })).toBe('club@gmail.com');
    expect(adresseAsso({})).toMatch(/@/);
  });
});

describe('messages d’erreur pour le bureau', () => {
  it('SMTP : identifiants, serveur, adresse', () => {
    expect(messageSmtp({ code: 'EAUTH', responseCode: 535 })).toMatch(/mot de passe/);
    expect(messageSmtp({ code: 'ETIMEDOUT' })).toMatch(/SMTP_HOST/);
    expect(messageSmtp({ code: 'EENVELOPE', responseCode: 553 })).toMatch(/expéditeur/);
  });

  it('Brevo : clé, expéditeur, quota', () => {
    expect(messageBrevo(401)).toMatch(/BREVO_API_KEY/);
    expect(messageBrevo(400, '{"message":"sender is not valid"}')).toMatch(/Expéditeurs/);
    expect(messageBrevo(429)).toMatch(/Quota/);
  });
});

describe('envoi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sans fournisseur : erreur lisible, rien n’est tenté', async () => {
    await expect(envoyerMail({ to: 'a@b.fr', subject: 's', text: 't' }, { MAIL_ENVOI: 'aucun' })).rejects.toMatchObject({
      lisible: true,
      message: expect.stringMatching(/DOC-MAIL/),
    });
  });

  it('Brevo : expéditeur = adresse de l’asso, réponse au prospect, pièces jointes en base64', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.stubGlobal('fetch', fetch);
    const env = { BREVO_API_KEY: 'cle-test', MAIL_ASSO: 'bureau@club.fr' };
    const res = await envoyerMail(
      {
        to: 'bureau@club.fr',
        replyTo: 'marie@example.fr',
        subject: '[ESSAI] Marie',
        text: 'Bonjour',
        attachments: [{ filename: 'carte.png', content: Buffer.from('png') }],
      },
      env,
    );
    expect(res.mode).toBe('brevo');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('cle-test');
    const body = JSON.parse(init.body);
    expect(body.sender.email).toBe('bureau@club.fr');
    expect(body.replyTo.email).toBe('marie@example.fr');
    expect(body.to).toEqual([{ email: 'bureau@club.fr' }]);
    expect(body.attachment).toEqual([{ name: 'carte.png', content: Buffer.from('png').toString('base64') }]);
  });

  it('Brevo refuse : le message dit quoi faire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }));
    await expect(envoyerMail({ to: 'a@b.fr', subject: 's', text: 't' }, { BREVO_API_KEY: 'mauvaise' })).rejects.toMatchObject({
      lisible: true,
      message: expect.stringMatching(/Clé Brevo/),
    });
  });

  it('réponse vers une adresse invalide : on répond à l’asso', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.stubGlobal('fetch', fetch);
    await envoyerMail({ to: 'a@b.fr', replyTo: 'pas une adresse', subject: 's', text: 't' }, { BREVO_API_KEY: 'k', MAIL_ASSO: 'bureau@club.fr' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).replyTo.email).toBe('bureau@club.fr');
  });

  it('message complet : sujet accentué encodé, texte en UTF-8', async () => {
    const mime = (await messageBrut({ from: 'a@b.fr', to: 'c@d.fr', subject: 'Votre carte d’adhérent', text: 'Été' })).toString();
    expect(mime).toMatch(/^Subject: =\?UTF-8\?/m);
    expect(mime).toMatch(/charset=utf-8/i);
  });
});
