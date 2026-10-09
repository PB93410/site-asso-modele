/**
 * Alerte bureau (pas le contact) via ntfy si BUREAU_NTFY_TOPIC est posé.
 * L’essai s’enregistre même si l’alerte échoue.
 */
import { ASSO, SITE_URL } from '../../asso.derive.js';

export async function notifyBureauNewLead(payload) {
  const prenom = payload.prenom || '';
  const cours = payload.cours || 'créneau à définir';
  const when = payload.when || 'sans date';
  const source = payload.source || 'site';
  /** Pas de téléphone : le détail reste dans le Sheet /bureau. */
  const text = `Nouvel essai (${source}) : ${prenom} · ${cours} · ${when}\nOuvrir : ${SITE_URL}/bureau`;

  const ntfy = process.env.BUREAU_NTFY_TOPIC;
  if (!ntfy) return { sent: false };

  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(ntfy)}`, {
      method: 'POST',
      headers: {
        Title: `Essai ${ASSO.nomCourt}`,
        Click: `${SITE_URL}/bureau`,
      },
      body: text,
    });
    return { sent: Boolean(res && res.ok !== false) };
  } catch (err) {
    console.error('notify ntfy:', err?.message || err);
    return { sent: false };
  }
}
