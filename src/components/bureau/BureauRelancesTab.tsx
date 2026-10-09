import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveRowKey, relanceHref } from '../../data/bureauRelances';
import { bureauFetch } from '../../lib/bureauApi';
import { CLUB_PHONE_DISPLAY } from '../../data/CONFIG';
import { useScheduleFromSheet } from '../../hooks/useSheetData';
import { buildPersonSheet, personSheetKey } from '../../lib/personSheet';
import BureauPersonSheet, { PersonNameButton } from './BureauPersonSheet';
import {
  appendRelanceNote,
  classifyRelances,
  type AdherentInput,
  type EssaiInput,
  type LiveRelanceCard,
  type RelancesQueue,
} from '../../lib/bureauRelancesQueue';
import { ASSO, TARIF_LABEL } from '../../data/asso';

type FicheAdherent = AdherentInput & {
  mail?: string;
  montant?: string;
  datePaiement?: string;
  numero?: string;
  carte?: string;
  notes?: string;
  row?: number;
};

type Props = {
  essais: EssaiInput[];
  adhesions: AdherentInput[];
  adherentsAJour: string[];
  essaisSheetUrl?: string;
  loading?: boolean;
  error?: string;
  ready?: boolean;
  reload: () => void | Promise<void>;
  onMarked?: (card: LiveRelanceCard) => void;
  onOpenPerson?: (tel: string, prenom: string) => void;
  embedded?: boolean;
};

function rowKey(r: LiveRelanceCard) {
  return liveRowKey(r.prio, r.tel);
}

function displayName(r: LiveRelanceCard) {
  return [r.prenom, r.nom].filter(Boolean).join(' ');
}

function formatCopyStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jjMm(ymd: string) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}`;
}

function parisTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildBilanText(queue: RelancesQueue) {
  const lines: string[] = [
    `Relances ${ASSO.nomCourt} — bilan téléphone asso`,
    `Date copie : ${formatCopyStamp()}`,
    'Source : file live Essais × Adhérents',
  ];

  const sections: { title: string; rows: LiveRelanceCard[] }[] = [
    { title: `P1 Conversion ${TARIF_LABEL}`, rows: queue.p1 },
    { title: 'P2 Plus tard', rows: queue.p2 },
  ];

  for (const sec of sections) {
    lines.push(`${sec.title} : ${sec.rows.length}`);
    for (const r of sec.rows) {
      lines.push(`- ${displayName(r)}`);
    }
  }

  lines.push(`Skip : ${queue.skip.length} (pas dans ce bilan)`);
  lines.push('Ceci n’est pas le registre. Venu / À jour se coche dans Essais ou la Sheet.');
  return lines.join('\n');
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fallback below */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function RelanceTable({
  rows,
  todayYmd,
  markingKey,
  onSent,
  onOpenPerson,
}: {
  rows: LiveRelanceCard[];
  todayYmd: string;
  markingKey: string;
  onSent: (card: LiveRelanceCard) => void;
  onOpenPerson: (tel: string, prenom: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-brand-gray rounded-xl border border-black/10 bg-white px-4 py-5">
        Personne dans cette file pour le moment.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-black/10 rounded-xl border border-black/10 bg-white overflow-hidden">
      {rows.map((r) => {
        const k = rowKey(r);
        const href = relanceHref(r);
        const notedToday = Boolean(r.lastRelanceYmd) && r.lastRelanceYmd === todayYmd;
        const when = r.prio === 'P1'
          ? `venu·e il y a ${r.daysSinceEssai} j`
          : `essai il y a ${r.daysSinceEssai} j`;
        const last = r.relanceCount > 0 && r.lastRelanceMsg
          ? `dernière relance ${r.lastRelanceMsg} le ${jjMm(r.lastRelanceYmd)}`
          : '';
        const meta = [
          r.cours,
          r.tel,
          r.statutEssais,
          r.dateLabel ? `essai ${r.dateLabel}` : '',
          when,
          last,
          r.present && !r.statutEssais.toLowerCase().includes('présent')
            ? `Présent ${r.present}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={k} className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-lg text-brand-black">
                  <PersonNameButton
                    prenom={r.prenom}
                    nom={r.nom}
                    tel={r.tel}
                    onOpen={onOpenPerson}
                    className="font-display text-lg font-bold text-brand-black text-left hover:underline"
                  />
                </p>
                <p className="text-sm text-brand-gray">{meta}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[48px] px-5 rounded-full bg-[#25D366] text-white font-semibold text-[15px]"
                  >
                    WhatsApp
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={notedToday || markingKey === k}
                  onClick={() => onSent(r)}
                  className="inline-flex items-center justify-center min-h-[48px] px-4 rounded-full border border-black/15 font-semibold text-[15px] disabled:opacity-60"
                >
                  {notedToday ? 'Message envoyé' : 'Message envoyé ?'}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function BureauRelancesTab({
  essais,
  adhesions,
  adherentsAJour,
  essaisSheetUrl = '',
  loading = false,
  error = '',
  ready = true,
  reload,
  onMarked,
  onOpenPerson,
  embedded = false,
}: Props) {
  const openPerson = onOpenPerson ?? (() => {});
  const [copied, setCopied] = useState(false);
  const [markingKey, setMarkingKey] = useState('');
  const [markError, setMarkError] = useState('');
  const todayYmd = parisTodayYmd();
  const queue = useMemo(
    () => (ready ? classifyRelances(essais, adhesions, adherentsAJour) : null),
    [ready, essais, adhesions, adherentsAJour],
  );

  const markSent = async (card: LiveRelanceCard) => {
    const ok = window.confirm(
      `Noter dans la Sheet que le message ${card.message} a été envoyé ?`,
    );
    if (!ok) return;
    setMarkingKey(rowKey(card));
    setMarkError('');
    try {
      await bureauFetch('/api/essai-update', {
        method: 'POST',
        body: JSON.stringify({
          source: 'essai',
          row: card.row,
          tel: card.tel,
          relanceMsg: card.message,
        }),
      });
      onMarked?.(card);
    } catch (err: unknown) {
      setMarkError(err instanceof Error ? err.message : 'Impossible d’enregistrer. Réessayez dans un instant.');
    } finally {
      setMarkingKey('');
    }
  };

  const copyBilan = async () => {
    if (!queue) return;
    try {
      await copyText(buildBilanText(queue));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const counts = {
    p1: queue?.p1.length ?? 0,
    p2: queue?.p2.length ?? 0,
    skip: queue?.skip.length ?? 0,
  };
  const shownError = markError || error;

  const body = (
    <>
      <div className="rounded-xl border border-orange-primary/40 bg-white px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-brand-black">Deux outils, pas le même geste</p>
        <ul className="text-sm text-brand-black leading-relaxed list-disc pl-5 space-y-1.5">
          <li>
            <strong>Ici</strong> : envoyer le WhatsApp (P1 conversion, P2 rappel à 7 jours).
            « Message envoyé » note le message dans la Sheet, pour tout le bureau.
          </li>
          <li>
            <strong>Onglet Essais</strong> : Venu / Absent / Relancé — ça écrit la Sheet.
          </li>
          <li>
            <strong>À payer</strong> : les {TARIF_LABEL} reçus — « J’ai reçu l’argent ».
          </li>
        </ul>
        <p className="text-sm text-brand-gray">
          Skip = déjà à jour dans Adhérents. Ne pas relancer.
        </p>
        <p className="text-sm font-semibold text-brand-black">
          P1 {counts.p1} · P2 {counts.p2} · Skip {counts.skip}
        </p>
        {loading ? (
          <p className="text-sm text-brand-gray">Chargement du registre…</p>
        ) : null}
        {shownError ? (
          <p className="text-sm text-brand-black rounded-lg bg-brand-cream border border-black/10 px-3 py-2">
            {shownError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {embedded ? null : (
            <>
              <Link
                to="/bureau?porte=admin&tab=essais"
                className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full bg-brand-olive text-white font-semibold text-[15px]"
              >
                Onglet Essais
              </Link>
              <Link
                to="/bureau?porte=admin&tab=adhesions"
                className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-brand-black font-semibold text-[15px] text-brand-black bg-white"
              >
                À payer
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => void copyBilan()}
            disabled={!queue}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-brand-black font-semibold text-[15px] text-brand-black bg-white disabled:opacity-50"
          >
            Copier le bilan
          </button>
          {copied ? (
            <span className="text-sm font-semibold text-brand-olive">Bilan copié</span>
          ) : null}
        </div>
        {essaisSheetUrl ? (
          <p className="text-sm text-brand-gray">
            <a
              href={essaisSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-brand-black"
            >
              Sheet Essais
            </a>
          </p>
        ) : null}
      </div>

      <p className="text-sm text-brand-gray leading-relaxed">
        Envoi manuel depuis le {CLUB_PHONE_DISPLAY}. Un bouton = un fil. Pas d’envoi groupé.
        File recalculée à chaque ouverture (À jour dans Adhérents = Skip).
      </p>

      {queue ? (
        <>
          <section className="space-y-3">
            <h1 className="font-display font-black text-2xl">
              P1 — Conversion {TARIF_LABEL} · {counts.p1} restant{counts.p1 > 1 ? 's' : ''}
            </h1>
            <p className="text-sm text-brand-gray">
              Après un cours (Venu dans Essais). Message B. Si elle paie : onglet À payer.
            </p>
            <RelanceTable
              rows={queue.p1}
              todayYmd={todayYmd}
              markingKey={markingKey}
              onSent={(card) => void markSent(card)}
              onOpenPerson={openPerson}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-black text-2xl">
              P2 — Plus tard · {counts.p2} restant{counts.p2 > 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-brand-gray">
              Pas venu : Absent, essai depuis 3 jours, ou relance depuis 7 jours. Message C.
            </p>
            <RelanceTable
              rows={queue.p2}
              todayYmd={todayYmd}
              markingKey={markingKey}
              onSent={(card) => void markSent(card)}
              onOpenPerson={openPerson}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-black text-2xl">Skip — ne pas relancer</h2>
            <ul className="rounded-xl border border-black/10 bg-white divide-y divide-black/10">
              {queue.skip.length === 0 ? (
                <li className="p-4 text-sm text-brand-gray">Personne en skip.</li>
              ) : (
                queue.skip.map((s) => (
                  <li key={rowKey(s)} className="p-4">
                    <p className="font-semibold">
                      <PersonNameButton prenom={s.prenom} nom={s.nom} tel={s.tel} onOpen={openPerson} />
                    </p>
                    <p className="text-sm text-brand-gray">
                      {[
                        s.statutAdherents
                          ? `${s.statutAdherents}${s.modeAdherents ? ` · ${s.modeAdherents}` : ''}`
                          : '',
                        s.skipReason,
                        s.tel,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-10">{body}</div>;
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-black">
      <header className="bg-brand-black text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to="/bureau" className="text-sm font-semibold text-white/80 hover:text-white">
            ← Bureau
          </Link>
          <p className="font-display font-bold">Relances</p>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="text-sm font-semibold text-white/80 hover:text-white disabled:opacity-50 min-h-[44px] px-2"
          >
            Actualiser
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">{body}</main>
    </div>
  );
}

export function BureauRelancesAutonome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [essaisSheetUrl, setEssaisSheetUrl] = useState('');
  const [adherentsSheetUrl, setAdherentsSheetUrl] = useState('');
  const [essais, setEssais] = useState<EssaiInput[]>([]);
  const [adhesions, setAdhesions] = useState<FicheAdherent[]>([]);
  const [adherentsAJour, setAdherentsAJour] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [personKey, setPersonKey] = useState<string | null>(null);
  const [personBusy, setPersonBusy] = useState(false);
  const { schedule } = useScheduleFromSheet();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [essRes, adhRes] = await Promise.allSettled([
      bureauFetch<{
        essais?: EssaiInput[];
        adherentsAJour?: string[];
        essaisSheetUrl?: string;
        adherentsSheetUrl?: string;
      }>('/api/essais-list'),
      bureauFetch<{
        items?: FicheAdherent[];
        all?: FicheAdherent[];
      }>('/api/adhesions-pending'),
    ]);

    let essaisOk: EssaiInput[] | null = null;
    let adhAll: FicheAdherent[] | null = null;
    let aJour: string[] = [];
    let essErr = '';
    let adhErr = '';
    let sheetUrl = '';

    if (essRes.status === 'fulfilled') {
      essaisOk = essRes.value.essais || [];
      aJour = essRes.value.adherentsAJour || [];
      sheetUrl = essRes.value.essaisSheetUrl || '';
      setAdherentsSheetUrl(essRes.value.adherentsSheetUrl || '');
    } else {
      const err = essRes.reason;
      essErr = err instanceof Error ? err.message : 'Erreur essais';
    }
    if (adhRes.status === 'fulfilled') {
      adhAll = adhRes.value.all || adhRes.value.items || [];
    } else {
      const err = adhRes.reason;
      adhErr = err instanceof Error ? err.message : 'Erreur adhésions';
    }

    setEssaisSheetUrl(sheetUrl);
    setAdherentsAJour(aJour);
    if (essaisOk && adhAll) {
      setEssais(essaisOk);
      setAdhesions(adhAll);
      setReady(true);
      setError('');
    } else if (!essaisOk && !adhAll) {
      setEssais([]);
      setAdhesions([]);
      setReady(false);
      setError('Le registre Google ne répond pas. Réessayez avec Actualiser.');
    } else {
      setEssais(essaisOk || []);
      setAdhesions(adhAll || []);
      setReady(true);
      setError(essErr || adhErr ? 'Une feuille ne répond pas. File partielle — Actualiser.' : '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const personSheet = useMemo(
    () => (personKey ? buildPersonSheet(personKey, essais, adhesions) : null),
    [personKey, essais, adhesions],
  );

  function patchEssaiRow(row: number, patch: Partial<EssaiInput>) {
    setEssais((prev) => prev.map((rowItem) => (rowItem.row === row ? { ...rowItem, ...patch } : rowItem)));
  }

  async function updatePersonEssai(item: EssaiInput, statut: string, notes?: string) {
    const prevStatut = item.statut;
    const prevNotes = item.notes;
    const nextNotes = notes ? (item.notes ? `${item.notes} | ${notes}` : notes) : item.notes;
    setPersonBusy(true);
    patchEssaiRow(Number(item.row), { statut, ...(notes ? { notes: nextNotes } : {}) });
    try {
      await bureauFetch('/api/essai-update', {
        method: 'POST',
        body: JSON.stringify({
          source: 'essai',
          row: item.row,
          tel: item.tel,
          statut,
          ...(notes ? { notes } : {}),
        }),
      });
    } catch (err: unknown) {
      patchEssaiRow(Number(item.row), { statut: prevStatut, notes: prevNotes });
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer.');
    } finally {
      setPersonBusy(false);
    }
  }

  return (
    <>
    <BureauRelancesTab
      essais={essais}
      adhesions={adhesions}
      adherentsAJour={adherentsAJour}
      essaisSheetUrl={essaisSheetUrl}
      loading={loading}
      error={error}
      ready={ready}
      reload={load}
      onMarked={(card) => {
        setEssais((prev) =>
          prev.map((e) => {
            if (e.row !== card.row) return e;
            return {
              ...e,
              statut: e.statut === 'Venu' ? e.statut : 'Relancé',
              notes: appendRelanceNote(e.notes, card.message),
            };
          }),
        );
      }}
      onOpenPerson={(tel, prenom) => {
        const key = personSheetKey(tel, prenom);
        if (key) setPersonKey(key);
      }}
    />
    {personSheet ? (
      <BureauPersonSheet
        sheet={personSheet}
        seance={false}
        busy={personBusy}
        schedule={schedule}
        essaisSheetUrl={essaisSheetUrl}
        adherentsSheetUrl={adherentsSheetUrl}
        onClose={() => setPersonKey(null)}
        onVenu={(essai) => void updatePersonEssai(essai, 'Venu')}
        onAbsent={(essai) => void updatePersonEssai(essai, 'Absent')}
        onClore={(essai, statut, notes) => void updatePersonEssai(essai, statut, notes)}
        onPaid={(item) => {
          setPersonBusy(true);
          void bureauFetch<{ numero?: string }>('/api/adhesion-validate', {
            method: 'POST',
            body: JSON.stringify({
              row: item.row,
              tel: item.tel,
              statut: 'À jour',
              expectedStatut: item.statut,
            }),
          })
            .then((data) => {
              const numero = String(data.numero || '').trim();
              setAdhesions((prev) =>
                prev.map((row) =>
                  row.row === item.row
                    ? { ...row, statut: 'À jour', ...(numero ? { numero } : {}) }
                    : row,
                ),
              );
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Impossible d’enregistrer.');
            })
            .finally(() => setPersonBusy(false));
        }}
        onWhatsAppConfirm={(essai) => void updatePersonEssai(essai, 'Confirmé')}
      />
    ) : null}
    </>
  );
}
