/**
 * Fonctions Netlify « v2 » autour des handlers au format Lambda (event → { statusCode, headers, body }).
 *
 * Pourquoi : en v1 (Lambda), Netlify Blobs n'offre pas la lecture « forte » (toujours à jour) ;
 * en v2 si. Les données du bureau (_stockage.mjs) en ont besoin : une écriture doit se voir
 * tout de suite, et les écritures protégées (version) relisent la dernière version.
 *
 * Chaque fonction garde son handler (exporté sous le nom `traiter`, pour les tests et le
 * serveur de développement) et exporte par défaut versV2(handler). Pas d'export nommé
 * `handler` : sinon Netlify la traite en v1.
 */

/** Requête Web → event au format Lambda. */
export async function versEvent(req, context = {}) {
  const url = new URL(req.url);
  const headers = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  if (context.ip && !headers['x-nf-client-connection-ip']) headers['x-nf-client-connection-ip'] = context.ip;
  const sansCorps = req.method === 'GET' || req.method === 'HEAD';
  return {
    httpMethod: req.method,
    path: url.pathname,
    rawUrl: req.url,
    rawQuery: url.search.slice(1),
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: sansCorps ? '' : await req.text(),
    isBase64Encoded: false,
  };
}

/** Réponse au format Lambda → Response. */
export function versResponse(out) {
  const status = Number(out?.statusCode) || 200;
  const headers = new Headers();
  for (const [k, v] of Object.entries(out?.headers || {})) if (v !== undefined && v !== null) headers.set(k, String(v));
  for (const [k, vals] of Object.entries(out?.multiValueHeaders || {})) for (const v of vals || []) headers.append(k, String(v));
  const vide = status === 204 || status === 304;
  const corps = vide ? null : out?.isBase64Encoded ? Buffer.from(String(out.body || ''), 'base64') : (out?.body ?? '');
  return new Response(corps, { status, headers });
}

export function versV2(handler) {
  return async (req, context) => versResponse(await handler(await versEvent(req, context), context));
}
