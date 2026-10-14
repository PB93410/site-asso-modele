import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { versV2 } from '../netlify/functions/_v2.mjs';

const fonctions = fs.readdirSync('netlify/functions').filter((n) => n.endsWith('.mjs') && !n.startsWith('_'));

describe('fonctions Netlify v2 (lecture forte de Netlify Blobs)', () => {
  it.each(fonctions)('%s : export par défaut v2, pas d’export nommé « handler »', (f) => {
    const src = fs.readFileSync(`netlify/functions/${f}`, 'utf8');
    // Un export nommé « handler » ferait passer la fonction en v1 (Lambda), où la lecture forte échoue.
    expect(src).not.toMatch(/export\s+(async\s+function|const|let|function)\s+handler\b/);
    expect(src).not.toMatch(/export\s*\{[^}]*\bas\s+handler\b/);
    expect(src).toMatch(/export default versV2\(handler\);/);
  });

  it('aucun store en lecture forte hors du stockage du bureau (v2 obligatoire)', () => {
    for (const f of fs.readdirSync('netlify/functions').filter((n) => n.startsWith('_'))) {
      const src = fs.readFileSync(`netlify/functions/${f}`, 'utf8');
      if (/consistency:\s*'strong'/.test(src)) expect(['_stockage.mjs', '_login-guard.mjs', '_cartes-journal.mjs', '_paiement.mjs', '_registre-numeros.mjs']).toContain(f);
    }
  });

  it('traduit requête et réponse sans rien perdre', async () => {
    let recu: Record<string, unknown> = {};
    const fn = versV2(async (event: Record<string, unknown>) => {
      recu = event;
      return { statusCode: 201, headers: { 'Content-Type': 'application/json', 'X-Test': 'oui' }, body: JSON.stringify({ ok: true }) };
    });
    const res = await fn(
      new Request('https://club.fr/api/bureau/agenda/abc?from=2026-11-01&to=2026-11-30', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer t', Origin: 'https://club.fr' },
        body: '{"title":"AG"}',
      }),
      { ip: '203.0.113.9' },
    );
    expect(recu).toMatchObject({
      httpMethod: 'PATCH',
      path: '/api/bureau/agenda/abc',
      queryStringParameters: { from: '2026-11-01', to: '2026-11-30' },
      body: '{"title":"AG"}',
      headers: { authorization: 'Bearer t', origin: 'https://club.fr', 'x-nf-client-connection-ip': '203.0.113.9' },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('x-test')).toBe('oui');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('fichier binaire (base64) et réponse vide', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const bin = await versV2(async () => ({ statusCode: 200, headers: { 'Content-Type': 'image/png' }, body: png.toString('base64'), isBase64Encoded: true }))(new Request('https://club.fr/x'), {});
    expect(Buffer.from(await bin.arrayBuffer())).toEqual(png);
    const vide = await versV2(async () => ({ statusCode: 204, headers: {}, body: '' }))(new Request('https://club.fr/x', { method: 'OPTIONS' }), {});
    expect(vide.status).toBe(204);
  });
});
