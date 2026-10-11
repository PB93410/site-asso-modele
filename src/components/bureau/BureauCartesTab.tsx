import { useState } from 'react';
import { CreditCard, Mail, MessageCircle } from 'lucide-react';
import { CARTE_VERSO_URL, SEASON_LABEL, SEASON_PREFIX } from '../../data/CONFIG';
import { formatTelFr, nationalFrTel } from '../../lib/bureauSearch';
import { ASSO } from '../../data/asso';

export type CarteAdherent = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  mail?: string;
  numero: string;
  statut: string;
  carte?: string;
};

type Props = {
  items: CarteAdherent[];
  loading: boolean;
  qPeople: string;
  onBack?: () => void;
  onMarquer?: (row: number) => Promise<string>;
  onEnvoyerMail?: (row: number, renvoyer: boolean) => Promise<{ carte: string; suivi: boolean }>;
  token?: string | null;
};

const NUMERO_RE = new RegExp(`^${SEASON_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{3}$`);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MSG_SUCCESS = 'C’est noté : carte envoyée.';
const MSG_WA_ASK = 'Dans WhatsApp, vérifiez le prénom puis appuyez sur Envoyer. La carte est partie ?';
const MSG_WA_NON = 'Rien n’est noté. Vous pourrez réessayer.';
const MSG_MAIL =
  'Carte envoyée par mail. La personne doit vérifier sa boîte, et les courriers indésirables.';
const MSG_MAIL_SUIVI = 'Le mail est parti. Le suivi n’a pas été noté sur la feuille.';
const MSG_CANCEL = 'Partage annulé. Rien n’est parti.';
const ERR_NUMERO = 'Numéro manquant';
const ERR_TEL = 'Téléphone manquant ou invalide';
const ERR_RIEN = 'E-mail et téléphone manquants';
const ERR_MAIL = 'E-mail invalide';
const ERR_IMAGE = 'Image de la carte introuvable';
const ERR_SUIVI = 'Le suivi n’a pas été noté. Réessayez.';
const ERR_MAIL_SEND = 'Le mail n’est pas parti. Réessayez.';

function msgCarte(prenom: string, numero: string) {
  return `Bonjour ${prenom || ''},
Voici ta carte d’adhérent ${ASSO.nom}, saison ${SEASON_LABEL} (${numero}).
Tu peux l’enregistrer dans le téléphone. Le QR au verso ouvre le site du club.
${ASSO.federation.sigle ? `Ce n’est pas la licence ${ASSO.federation.sigle}, c’est ta carte du club.` : 'C’est ta carte du club.'}
À bientôt en cours,
Le bureau`;
}

/** STATUT exact « À jour » (pas Essai / En attente). */
export function isAJourCarte(statut: string) {
  return String(statut || '').trim() === 'À jour';
}

export function isNumeroCarte(raw: string) {
  return NUMERO_RE.test(String(raw || '').trim());
}

export function isCarteMail(raw: string) {
  return EMAIL_RE.test(String(raw || '').trim());
}

/** Mobile FR 06/07 — 10 chiffres nationaux. Retourne digits wa.me (33…) ou null. */
export function mobileFrWaDigits(raw: string): string | null {
  const n = nationalFrTel(raw);
  if (n.length !== 10) return null;
  if (!n.startsWith('06') && !n.startsWith('07')) return null;
  return `33${n.slice(1)}`;
}

function blocage(item: CarteAdherent): string | null {
  if (!isAJourCarte(item.statut) || !isNumeroCarte(item.numero)) return ERR_NUMERO;
  if (isCarteMail(item.mail || '')) return null;
  if (mobileFrWaDigits(item.tel)) return null;
  if (String(item.mail || '').trim()) return ERR_MAIL;
  return ERR_RIEN;
}

/** Image du coffre, ou le message du serveur (ex. carte qui ne correspond pas à la fiche). */
async function fetchCartePng(
  row: number,
  numero: string,
  token?: string | null,
): Promise<{ file: File } | { error: string }> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/carte-image?numero=${encodeURIComponent(numero)}&row=${row}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: (data as { error?: string })?.error || ERR_IMAGE };
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) return { error: ERR_IMAGE };
  const type = blob.type || 'image/png';
  if (type && !type.startsWith('image/')) return { error: ERR_IMAGE };
  return { file: new File([blob], `${numero}.png`, { type: type || 'image/png' }) };
}

function versoFileName() {
  return `${SEASON_PREFIX.replace(/-$/, '')}-verso.png`;
}

async function fetchVersoFile(): Promise<File | null> {
  try {
    const res = await fetch(CARTE_VERSO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return new File([blob], versoFileName(), { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BureauCartesTab({
  items,
  loading,
  qPeople,
  onBack,
  onMarquer,
  onEnvoyerMail,
  token,
}: Props) {
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [confirmRow, setConfirmRow] = useState<number | null>(null);
  const [waAskRow, setWaAskRow] = useState<number | null>(null);
  const [rowInfo, setRowInfo] = useState<Record<number, { kind: 'ok' | 'cancel' | 'err'; text: string }>>(
    {},
  );

  async function envoyerCarte(item: CarteAdherent) {
    const telDigits = mobileFrWaDigits(item.tel);
    if (!telDigits) {
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'err', text: ERR_TEL } }));
      return;
    }

    const numero = String(item.numero || '').trim();
    setBusyRow(item.row);
    setRowInfo((prev) => {
      const next = { ...prev };
      delete next[item.row];
      return next;
    });

    const text = msgCarte(item.prenom, numero);
    let loaded: { file: File } | { error: string };
    try {
      loaded = await fetchCartePng(item.row, numero, token);
    } catch {
      loaded = { error: ERR_IMAGE };
    }

    if ('error' in loaded) {
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'err', text: loaded.error } }));
      setBusyRow(null);
      return;
    }
    const file = loaded.file;

    const recto = new File([file], `${numero}-recto.png`, { type: file.type || 'image/png' });
    const verso = await fetchVersoFile();
    const title = `Carte ${numero}`;

    async function tryShare(files: File[]) {
      const shareData: ShareData = { files, text, title };
      if (typeof navigator.canShare !== 'function') return 'no' as const;
      try {
        if (!navigator.canShare(shareData)) return 'no' as const;
        await navigator.share(shareData);
        return 'ok' as const;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return 'cancel' as const;
        return 'no' as const;
      }
    }

    let shared = 'no' as 'no' | 'ok' | 'cancel';
    if (verso) shared = await tryShare([recto, verso]);
    if (shared === 'cancel') {
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'cancel', text: MSG_CANCEL } }));
      setBusyRow(null);
      return;
    }
    if (shared !== 'ok') shared = await tryShare([recto]);
    if (shared === 'cancel') {
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'cancel', text: MSG_CANCEL } }));
      setBusyRow(null);
      return;
    }

    if (shared !== 'ok') {
      downloadFile(recto);
      if (verso) downloadFile(verso);
      window.open(`https://wa.me/${telDigits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }

    // Noté seulement quand le bénévole confirme que le message est parti.
    setWaAskRow(item.row);
    setBusyRow(null);
  }

  async function confirmerWhatsApp(item: CarteAdherent) {
    setBusyRow(item.row);
    try {
      if (onMarquer) await onMarquer(item.row);
      setWaAskRow(null);
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'ok', text: MSG_SUCCESS } }));
    } catch {
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'err', text: ERR_SUIVI } }));
    }
    setBusyRow(null);
  }

  function pasEnvoyeWhatsApp(item: CarteAdherent) {
    setWaAskRow(null);
    setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'cancel', text: MSG_WA_NON } }));
  }

  function ouvrirMail(item: CarteAdherent) {
    setRowInfo((prev) => {
      const next = { ...prev };
      delete next[item.row];
      return next;
    });
    setConfirmRow(item.row);
  }

  async function envoyerMail(item: CarteAdherent) {
    setBusyRow(item.row);
    setRowInfo((prev) => {
      const next = { ...prev };
      delete next[item.row];
      return next;
    });

    setConfirmRow(null);
    try {
      const result = await onEnvoyerMail?.(item.row, Boolean(String(item.carte || '').trim()));
      if (!result) throw new Error(ERR_MAIL_SEND);
      setRowInfo((prev) => ({
        ...prev,
        [item.row]: { kind: result.suivi ? 'ok' : 'err', text: result.suivi ? MSG_MAIL : MSG_MAIL_SUIVI },
      }));
    } catch (err) {
      const text = err instanceof Error && err.message ? err.message : ERR_MAIL_SEND;
      setRowInfo((prev) => ({ ...prev, [item.row]: { kind: 'err', text } }));
    }
    setBusyRow(null);
  }

  return (
    <div className="space-y-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm font-semibold text-brand-olive">
          ← Autre
        </button>
      ) : null}
      <h2 className="font-display font-bold text-lg">Cartes adhérents</h2>
      <p className="text-base text-brand-gray">
        Une personne à la fois. S’il y a un e-mail, la carte part par mail. Sinon, WhatsApp.
        La carte est fabriquée à l’envoi, à partir de la fiche.
      </p>
      {items.length === 0 && !loading ? (
        <div className="rounded-2xl bg-brand-cream border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
          <CreditCard className="w-10 h-10 mx-auto mb-2" aria-hidden="true" />
          <p className="font-medium text-base">
            {qPeople ? 'Personne avec ce nom ou ce numéro' : 'Aucun adhérent À jour pour l’instant'}
          </p>
        </div>
      ) : null}
      {items.map((item) => {
        const numero = String(item.numero || '').trim();
        const mail = String(item.mail || '').trim();
        const telLabel = formatTelFr(item.tel);
        const parMail = isCarteMail(mail);
        const blocked = blocage(item);
        const isBusy = busyRow === item.row;
        const info = rowInfo[item.row];
        const confirming = confirmRow === item.row;
        const waAsking = waAskRow === item.row;
        const deja = String(item.carte || '').trim();
        const underError = blocked || (info?.kind === 'err' ? info.text : null);
        return (
          <article
            key={item.row}
            className="rounded-2xl bg-white border border-[#E8E6E1] px-4 py-3 space-y-1.5"
          >
            <h3 className="font-semibold text-base text-brand-black leading-snug">
              {item.nom} {item.prenom}
            </h3>
            <p className="text-base text-brand-gray">
              {numero || '—'}
              {telLabel ? ` · ${telLabel}` : ''}
            </p>
            {mail ? <p className="text-sm text-brand-gray break-all">{mail}</p> : null}
            {String(item.carte || '').trim() ? (
              <p className="text-sm text-brand-olive">Prête le {String(item.carte).trim()}</p>
            ) : null}
            {parMail && confirming ? (
              <div className="space-y-2">
                <p className="text-sm text-brand-black">
                  {deja
                    ? `Carte déjà partie le ${deja}. La renvoyer à cette adresse ?`
                    : 'Envoyer la carte à cette adresse ?'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void envoyerMail(item)}
                    className="inline-flex items-center justify-center gap-2 h-11 min-h-[44px] px-4 rounded-xl bg-orange-primary text-white font-semibold text-sm disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {isBusy ? 'Envoi…' : deja ? 'Renvoyer' : 'Confirmer'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmRow(null)}
                    className="inline-flex items-center justify-center h-11 min-h-[44px] px-4 rounded-xl border border-[#E8E6E1] text-brand-black font-semibold text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}
            {parMail && !confirming ? (
              <button
                type="button"
                disabled={Boolean(blocked) || isBusy}
                onClick={() => void ouvrirMail(item)}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-11 min-h-[44px] px-4 rounded-xl bg-orange-primary text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                {deja ? 'Renvoyer par mail' : 'Envoyer par mail'}
              </button>
            ) : null}
            {!parMail && waAsking ? (
              <div className="space-y-2">
                <p className="text-sm text-brand-black">{MSG_WA_ASK}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void confirmerWhatsApp(item)}
                    className="inline-flex items-center justify-center h-11 min-h-[44px] px-4 rounded-xl bg-orange-primary text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {isBusy ? 'Enregistrement…' : 'Oui, c’est parti'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => pasEnvoyeWhatsApp(item)}
                    className="inline-flex items-center justify-center h-11 min-h-[44px] px-4 rounded-xl border border-[#E8E6E1] text-brand-black font-semibold text-sm"
                  >
                    Non
                  </button>
                </div>
              </div>
            ) : null}
            {!parMail && !waAsking ? (
              <button
                type="button"
                disabled={Boolean(blocked) || isBusy}
                onClick={() => void envoyerCarte(item)}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-11 min-h-[44px] px-4 rounded-xl border-2 border-[#25D366] text-[#25D366] bg-transparent font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {isBusy ? 'Préparation…' : deja ? 'Renvoyer la carte' : 'Envoyer la carte'}
              </button>
            ) : null}
            {underError ? <p className="text-sm text-orange-primary">{underError}</p> : null}
            {info?.kind === 'ok' ? <p className="text-sm text-brand-olive">{info.text}</p> : null}
            {info?.kind === 'cancel' ? <p className="text-sm text-brand-gray">{info.text}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
