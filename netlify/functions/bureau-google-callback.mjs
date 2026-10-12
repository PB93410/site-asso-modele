/**
 * GET /api/bureau/google/callback
 * Échange code → refresh_token. Page HTML pour le référent (pas de log du token).
 */

import { createOAuth2Client, verifyGoogleOAuthState, ASSO_GMAIL } from './_google-user.mjs';
import { moduleOff } from './_bureau-lib.mjs';
import { versV2 } from './_v2.mjs';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #F8F7F4; color: #111110; margin: 0; padding: 1.5rem; line-height: 1.5; }
    .box { max-width: 40rem; margin: 0 auto; background: #fff; border: 1px solid rgba(0,0,0,.1); border-radius: 1rem; padding: 1.25rem 1.5rem; }
    h1 { font-size: 1.35rem; margin: 0 0 .75rem; }
    code, textarea { font-family: ui-monospace, monospace; font-size: .85rem; }
    textarea { width: 100%; min-height: 6rem; box-sizing: border-box; padding: .75rem; border-radius: .75rem; border: 1px solid #ccc; }
    .ok { color: #166534; }
    .err { color: #b91c1c; }
    a { color: #C45309; font-weight: 600; }
    ol { padding-left: 1.25rem; }
    li { margin: .4rem 0; }
  </style>
</head>
<body><div class="box">${bodyHtml}</div></body>
</html>`;
}

async function handler(event) {
  const off = moduleOff('mail');
  if (off) return off;
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: htmlPage('Erreur', '<p class="err">Méthode non autorisée.</p>'),
    };
  }

  const params = event.queryStringParameters || {};
  const code = params.code;
  const state = params.state;
  const oauthError = params.error;

  if (oauthError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: htmlPage(
        'Autorisation refusée',
        `<h1>Autorisation refusée</h1><p class="err">Google a renvoyé : ${escapeHtml(oauthError)}</p>
         <p><a href="/bureau/connexion-google">Réessayer</a> · <a href="/bureau?tab=more">Retour Autre</a></p>`,
      ),
    };
  }

  if (!verifyGoogleOAuthState(state)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: htmlPage(
        'Lien expiré',
        `<h1>Lien expiré ou invalide</h1>
         <p>Recommencez depuis le bureau (session ouverte).</p>
         <p><a href="/bureau/connexion-google">Reconnecter Google</a></p>`,
      ),
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: htmlPage('Erreur', '<p class="err">Code Google manquant.</p>'),
    };
  }

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    const refresh = tokens.refresh_token || '';

    if (!refresh) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        body: htmlPage(
          'Pas de refresh token',
          `<h1>Pas de nouveau refresh token</h1>
           <p>Google n’a pas renvoyé de <code>refresh_token</code> (souvent déjà autorisé avant).</p>
           <ol>
             <li>Ouvrez <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">les accès tiers</a> du compte <strong>${ASSO_GMAIL}</strong>.</li>
             <li>Retirez l’accès à l’appli de l’association.</li>
             <li>Revenez sur <a href="/bureau/connexion-google">Connecter Google</a> et réautorisez.</li>
           </ol>
           <p><a href="/bureau?tab=more">Retour Autre</a></p>`,
        ),
      };
    }

    // Ne pas console.log(refresh)
    const escaped = escapeHtml(refresh);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private' },
      body: htmlPage(
        'Refresh token Google',
        `<h1 class="ok">Compte asso autorisé</h1>
         <p>Copiez le refresh token dans Netlify → Environment variables → <strong>GOOGLE_REFRESH_TOKEN</strong>, puis redéployez.</p>
         <p><label for="rt">GOOGLE_REFRESH_TOKEN</label></p>
         <textarea id="rt" readonly>${escaped}</textarea>
         <ol>
           <li>Netlify → Site → Environment variables</li>
           <li>Créer ou mettre à jour <code>GOOGLE_REFRESH_TOKEN</code> (scopes : Gmail + Calendar + Contacts)</li>
           <li>Vérifier aussi <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_CALENDAR_ID</code></li>
           <li>Redéployer le site</li>
           <li>Tester <a href="/bureau/mail">Mail</a>, <a href="/bureau/agenda">Agenda</a>, puis sync Contacts (script)</li>
         </ol>
         <p>Ne partagez pas ce jeton (WhatsApp, mail, capture d’écran publique).</p>
         <p><a href="/bureau?tab=more">Retour Autre</a></p>
         <script>
           const el = document.getElementById('rt');
           el.focus(); el.select();
         </script>`,
      ),
    };
  } catch (err) {
    console.error('bureau-google-callback', err?.message || err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: htmlPage(
        'Échec',
        `<h1 class="err">Échange du code impossible</h1>
         <p>Vérifiez Client ID / Secret et l’URI de redirection dans Google Cloud.</p>
         <p><a href="/bureau/connexion-google">Réessayer</a></p>`,
      ),
    };
  }
}

// Fonction v2 (lecture forte de Netlify Blobs) : voir _v2.mjs.
export { handler as traiter };
export default versV2(handler);
