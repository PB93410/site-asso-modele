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
import { ChevronDown, MessageCircle } from 'lucide-react';
import { EnTete, Initiales, Segments, Vide } from './ui';
import { bouton, carte } from './styles';

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
    return <Vide icone={MessageCircle} titre="Personne dans cette file" aide="Revenez après les prochains cours." />;
  }
  return (
    <ul className={`${carte} divide-y divide-black/[0.06] overflow-hidden`}>
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
          <li key={k} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Initiales prenom={r.prenom} nom={r.nom} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base text-brand-black leading-snug">
                  <PersonNameButton prenom={r.prenom} nom={r.nom} tel={r.tel} onOpen={onOpenPerson} />
                </p>
                <p className="text-sm text-slate-500">{meta}</p>
                {r.tel ? <p className="text-sm text-slate-500 tabular-nums">{r.tel}</p> : null}
              </div>
              {notedToday ? (
                <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-900">Envoyé</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={bouton.whatsapp}>
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                disabled={notedToday || markingKey === k}
                onClick={() => onSent(r)}
                className={`${bouton.secondaire} ${href ? '' : 'col-span-2'}`}
              >
                {notedToday ? 'Noté' : 'J’ai envoyé'}
              </button>
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
  const [file, setFile] = useState<'p1' | 'p2' | 'skip'>('p1');
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
      <EnTete
        titre="Relances"
        aide={<>Un WhatsApp à la fois, depuis le {CLUB_PHONE_DISPLAY}. Puis « J’ai envoyé » : tout le bureau le voit.</>}
      />

      <Segments
        label="Files de relance"
        valeur={file}
        onChange={setFile}
        options={[
          { id: 'p1', label: 'Après cours', compte: counts.p1 },
          { id: 'p2', label: 'Plus tard', compte: counts.p2 },
          { id: 'skip', label: 'Adhérents', compte: counts.skip },
        ]}
      />

      {loading && !queue ? <p className="text-sm text-slate-500 px-1">Chargement…</p> : null}
      {shownError ? (
        <p role="alert" className="text-sm text-red-800 bg-red-50 ring-1 ring-red-100 rounded-2xl px-4 py-3">
          {shownError}
        </p>
      ) : null}

      {queue && file === 'p1' ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-500 px-1">
            Venu·e à un cours : proposer l’adhésion ({TARIF_LABEL}). Si la personne paie : À payer.
          </p>
          <RelanceTable rows={queue.p1} todayYmd={todayYmd} markingKey={markingKey} onSent={(card) => void markSent(card)} onOpenPerson={openPerson} />
        </section>
      ) : null}
      {queue && file === 'p2' ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-500 px-1">Pas venu·e : absent, essai depuis 3 jours, ou relance depuis 7 jours.</p>
          <RelanceTable rows={queue.p2} todayYmd={todayYmd} markingKey={markingKey} onSent={(card) => void markSent(card)} onOpenPerson={openPerson} />
        </section>
      ) : null}
      {queue && file === 'skip' ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-500 px-1">À jour dans Adhérents : ne pas relancer.</p>
          {queue.skip.length === 0 ? (
            <Vide titre="Personne ici" />
          ) : (
            <ul className={`${carte} divide-y divide-black/[0.06] overflow-hidden`}>
              {queue.skip.map((sk) => (
                <li key={rowKey(sk)} className="p-4 flex items-start gap-3">
                  <Initiales prenom={sk.prenom} nom={sk.nom} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-black">
                      <PersonNameButton prenom={sk.prenom} nom={sk.nom} tel={sk.tel} onOpen={openPerson} />
                    </p>
                    <p className="text-sm text-slate-500">
                      {[sk.statutAdherents ? `${sk.statutAdherents}${sk.modeAdherents ? ` · ${sk.modeAdherents}` : ''}` : '', sk.skipReason, sk.tel]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <details className={`${carte} px-4 py-3 group`}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between min-h-[40px] text-sm font-semibold text-brand-black">
          Aide et bilan
          <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1.5">
          <li>
            <strong>Ici</strong> : le WhatsApp de relance. « J’ai envoyé » le note pour tout le bureau.
          </li>
          <li>
            <strong>Essais</strong> : Venu, Absent, Relancé.
          </li>
          <li>
            <strong>À payer</strong> : les {TARIF_LABEL} reçus, « J’ai reçu l’argent ».
          </li>
          <li>Un bouton = une conversation. Pas d’envoi groupé. La liste est recalculée à chaque ouverture.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-3">
          <button type="button" onClick={() => void copyBilan()} disabled={!queue} className={bouton.secondaire}>
            {copied ? 'Bilan copié' : 'Copier le bilan'}
          </button>
          {embedded ? null : (
            <>
              <Link to="/bureau?porte=admin&tab=essais" className={bouton.secondaire}>
                Essais
              </Link>
              <Link to="/bureau?porte=admin&tab=adhesions" className={bouton.secondaire}>
                À payer
              </Link>
            </>
          )}
          {essaisSheetUrl ? (
            <a href={essaisSheetUrl} target="_blank" rel="noopener noreferrer" className={bouton.secondaire}>
              Tableau Essais
            </a>
          ) : null}
        </div>
      </details>
    </>
  );

  if (embedded) {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-black">
      <header className="sticky top-0 z-30 bg-brand-cream/90 backdrop-blur border-b border-black/[0.06] px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to="/bureau" className="inline-flex items-center min-h-[44px] px-2 -ml-2 rounded-xl text-sm font-semibold text-brand-olive hover:bg-brand-olive-soft">
            ← Bureau
          </Link>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className={`${bouton.secondaire} px-3`}
          >
            Actualiser
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">{body}</main>
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
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
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
