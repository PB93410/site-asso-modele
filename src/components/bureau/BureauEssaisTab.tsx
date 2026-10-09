import { useState } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { msgBureauEssai, resolveCreneau } from '../../lib/essaiMessages';
import { essaiYmdFromCreneau } from '../../lib/essaiDates';
import { formatEssaiDu } from '../../lib/essaisSemaine';
import { formatTelFr, telDedupeKey } from '../../lib/bureauSearch';
import { PersonNameButton } from './BureauPersonSheet';
import { isAVenir, isCountableEssai, isStrictAVenir } from '../../lib/essaiStatuts';
import { ASSO, NB_ESSAIS, SITE_URL } from '../../data/asso';

type EssaiItem = {
  source: 'forum' | 'essai';
  row: number;
  prenom: string;
  nom: string;
  tel: string;
  cours: string;
  creneau: string;
  statut: string;
  nEssai: number;
  dateDemande: string;
  notes?: string;
  sourceLead?: string;
  essaiPrevu?: string;
  adhesionStand?: string;
  dateEssai?: string;
  numEssai?: string;
  present?: string;
  dateRelance?: string;
  adhesion?: string;
  modePaiement?: string;
  remarque?: string;
};

type EssaisVue = 'nouveaux' | 'week' | 'person';
type PorteId = 'seance' | 'admin';
type Schedule = Parameters<typeof resolveCreneau>[0];

type PersonGroup = {
  key: string;
  items: EssaiItem[];
  head: EssaiItem;
  nMax: number;
  isAdherent: boolean;
};

type WeekDayGroup = {
  day: number;
  label: string;
  slots: { slot: string; items: EssaiItem[] }[];
};

type Props = {
  porte: PorteId;
  essaisVue: EssaisVue;
  setEssaisVue: (v: EssaisVue) => void;
  onBackAutre: () => void;
  onOpenAdhesions: () => void;
  qPeople: string;
  loading: boolean;
  busyRow: string | null;
  adhesionHitsOnEssai: number;
  essaiSearchHits: EssaiItem[];
  nouveauxEssais: EssaiItem[];
  aPointer: EssaiItem[];
  weekDayGroups: WeekDayGroup[];
  personGroups: PersonGroup[];
  essaiPool: EssaiItem[];
  adherentsAJour: Set<string>;
  schedule: Schedule;
  updateEssai: (item: EssaiItem, statut: string, notes?: string) => void;
  relanceEssaiViaWhatsApp: (item: EssaiItem) => void;
  hideCloreAdherent?: boolean;
  onOpenPerson: (tel: string, prenom: string) => void;
};

function parisYmdNow() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function dateDemandeYmd(raw: string) {
  const s = String(raw || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!fr) return '';
  const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
  return `${y}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
}

function formatDemandeFr(raw: string) {
  const ymd = dateDemandeYmd(raw);
  if (!ymd) return '';
  const today = parisYmdNow();
  if (ymd === today) return 'aujourd’hui';
  const yest = addDaysYmd(today, -1);
  if (ymd === yest) return 'hier';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function looksLikeDateOnly(raw: string) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true;
  return false;
}

/** Retire un préfixe JJ/MM/AAAA ou ISO collé devant le créneau. */
function stripLeadingDateToken(raw: string) {
  let s = String(raw || '').trim();
  s = s.replace(/^\d{4}-\d{2}-\d{2}(?:[T ][\d:]+)?\s*[·•\-|—–]?\s*/i, '');
  s = s.replace(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*[·•\-|—–]?\s*/i, '');
  s = s.replace(/^[—–\-·•|]+\s*/, '').trim();
  return s;
}

function essaiSlotLabel(item: EssaiItem) {
  const fromCreneau = stripLeadingDateToken(item.creneau || '');
  if (fromCreneau && !looksLikeDateOnly(fromCreneau)) return fromCreneau;
  const fromCours = stripLeadingDateToken(item.cours || '');
  if (fromCours && !looksLikeDateOnly(fromCours)) return fromCours;
  return 'Sans créneau';
}

/** Une date courte FR + créneau + statut — jamais JJ/MM/AAAA à côté. */
function essaiPersonLineLabel(item: EssaiItem) {
  const date = formatDemandeFr(item.dateDemande);
  const slot = essaiSlotLabel(item);
  const statut = (item.statut || 'À venir').trim();
  return [date, slot, statut].filter(Boolean).join(' · ');
}

function countEssaisForTel(pool: EssaiItem[], tel: string) {
  const key = telDedupeKey(tel);
  if (!key) return 1;
  return pool.filter((i) => telDedupeKey(i.tel) === key && isCountableEssai(i.statut)).length;
}

function hasCreneauSlot(item: EssaiItem) {
  return essaiSlotLabel(item) !== 'Sans créneau';
}

/** N = NB_ESSAIS − lignes À venir|Venu|Relancé du même TEL (min 0). */
function restantsForTel(pool: EssaiItem[], tel: string) {
  const key = telDedupeKey(tel);
  if (!key) return NB_ESSAIS;
  return Math.max(0, NB_ESSAIS - countEssaisForTel(pool, tel));
}

function msgResteEssais(prenom: string, restants: number) {
  const n = Math.max(0, restants);
  const mot = n <= 1 ? 'essai gratuit' : 'essais gratuits';
  return `Bonjour ${prenom || ''},
Il vous reste ${n} ${mot}.
Réservez le prochain ici : ${SITE_URL}/essai
${ASSO.nom}`;
}

/** WhatsApp : CRENEAU → confirmation ; Sans créneau → « reste N » + /essai. Pas de changement de STATUT. */
function waTextForEssai(item: EssaiItem, pool: EssaiItem[], schedule: Schedule): string | null {
  if (hasCreneauSlot(item)) {
    return msgBureauEssai(item.prenom, resolveCreneau(schedule, item.cours, item.creneau));
  }
  const n = restantsForTel(pool, item.tel);
  if (n <= 0) return null;
  return msgResteEssais(item.prenom, n);
}

function pickWaEssaiLine(items: EssaiItem[]): EssaiItem | null {
  const withSlot = items.find((i) => isAVenir(i.statut) && hasCreneauSlot(i));
  if (withSlot) return withSlot;
  return items.find((i) => isAVenir(i.statut) && !hasCreneauSlot(i)) || null;
}

function normalizeFrPhone(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length < 9) return null;
  if (d.startsWith('33') && d.length >= 11) return d;
  if (d.startsWith('0') && d.length >= 10) return '33' + d.slice(1);
  if (d.length === 9) return '33' + d;
  return d;
}

function waUrl(tel: string, text: string): string | null {
  const n = normalizeFrPhone(tel);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function CloreEssai({
  item,
  disabled,
  updateEssai,
  hideAdherent,
}: {
  item: EssaiItem;
  disabled: boolean;
  updateEssai: (item: EssaiItem, statut: string, notes?: string) => void;
  hideAdherent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const choices: Array<'Adhérent' | 'Annulé' | 'Pas intéressé'> = hideAdherent
    ? ['Annulé', 'Pas intéressé']
    : ['Adhérent', 'Annulé', 'Pas intéressé'];
  function choose(choice: 'Adhérent' | 'Annulé' | 'Pas intéressé') {
    const label = choice === 'Pas intéressé' ? 'Pas intéressé (annulé)' : choice;
    if (!window.confirm(`Clore cet essai : ${label} ?`)) return;
    setOpen(false);
    if (choice === 'Pas intéressé') updateEssai(item, 'Annulé', 'Pas intéressé');
    else updateEssai(item, choice);
  }
  return (
    <div className="basis-full max-[700px]:col-span-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-11 min-h-[44px] px-1 text-sm text-slate-500 underline underline-offset-2 disabled:opacity-60"
      >
        Clore
      </button>
      {open ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => choose(choice)}
              className="h-11 min-h-[44px] px-3 rounded-xl border border-[#E8E6E1] bg-white text-brand-black font-semibold text-sm disabled:opacity-60"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function essaiNLabel(n: number) {
  if (n >= 4) return `Essai ${n} — au-delà de 3`;
  return `Essai ${n}/3`;
}

function EssaiLineCard({
  item,
  isBusy,
  updateEssai,
  hideRelance,
  restants,
  personN,
  schedule,
  pool,
  relanceOnWhatsApp,
  onWhatsAppRelance,
  essaiDu,
  allowClose,
  hideCloreAdherent,
  onOpenPerson,
}: {
  item: EssaiItem;
  isBusy: boolean;
  updateEssai: (item: EssaiItem, statut: string, notes?: string) => void;
  hideRelance?: boolean;
  restants: number;
  personN: number;
  schedule: Schedule;
  pool: EssaiItem[];
  /** Vue Nouveaux : WA sur À venir → Relancé (pas Venu / Absent). */
  relanceOnWhatsApp?: boolean;
  onWhatsAppRelance?: (item: EssaiItem) => void;
  essaiDu?: string;
  allowClose?: boolean;
  hideCloreAdherent?: boolean;
  onOpenPerson: (tel: string, prenom: string) => void;
}) {
  const telLabel = formatTelFr(item.tel);
  const waBody = hideRelance ? null : waTextForEssai(item, pool, schedule);
  const wa = telLabel && waBody ? waUrl(item.tel, waBody) : null;
  const sansCreneau = !hasCreneauSlot(item);
  const showWa = Boolean(wa && (!sansCreneau || restants > 0));
  const slot = essaiSlotLabel(item);
  const aVenir = isAVenir(item.statut);
  const strictAVenir = isStrictAVenir(item.statut);
  return (
    <article className="rounded-2xl bg-white border border-[#E8E6E1] border-l-[4px] border-l-orange-primary px-4 py-3 space-y-1.5">
      <h3 className="font-semibold text-base text-brand-black leading-snug">
        <PersonNameButton prenom={item.prenom} nom={item.nom} tel={item.tel} onOpen={onOpenPerson} />
      </h3>
      {essaiDu ? <p className="text-sm text-slate-600">{essaiDu}</p> : null}
      <p className="text-base text-brand-gray">
        {[slot, essaiNLabel(personN), telLabel].filter(Boolean).join(' · ')}
      </p>
      {item.statut && !aVenir ? (
        <p className="text-sm text-brand-gray">{item.statut}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-0.5 max-[700px]:grid max-[700px]:grid-cols-2">
        {showWa ? (
          <a
            href={wa!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (relanceOnWhatsApp && strictAVenir) onWhatsAppRelance?.(item);
            }}
            className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#25D366] bg-transparent text-[#25D366] font-semibold text-sm max-[700px]:w-full"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            WhatsApp
          </a>
        ) : null}
        {aVenir ? (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => updateEssai(item, 'Venu')}
              className="h-11 min-h-[44px] px-3 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60 max-[700px]:w-full"
            >
              {isBusy ? '…' : 'Venu'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => updateEssai(item, 'Absent')}
              className="h-11 min-h-[44px] px-3 rounded-xl border border-[#E8E6E1] bg-white text-brand-black font-semibold text-sm disabled:opacity-60 max-[700px]:w-full"
            >
              Absent
            </button>
            {strictAVenir && sansCreneau ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => updateEssai(item, 'Relancé')}
                className="h-11 min-h-[44px] px-3 rounded-xl border border-orange-primary/40 bg-white text-orange-primary font-semibold text-sm disabled:opacity-60 max-[700px]:w-full max-[700px]:col-span-2"
              >
                Relancé
              </button>
            ) : null}
          </>
        ) : null}
        {allowClose ? (
          <CloreEssai
            item={item}
            disabled={isBusy}
            updateEssai={updateEssai}
            hideAdherent={hideCloreAdherent}
          />
        ) : null}
      </div>
    </article>
  );
}

export default function BureauEssaisTab({
  porte,
  essaisVue,
  setEssaisVue,
  onBackAutre,
  onOpenAdhesions,
  qPeople,
  loading,
  busyRow,
  adhesionHitsOnEssai,
  essaiSearchHits,
  nouveauxEssais,
  aPointer,
  weekDayGroups,
  personGroups,
  essaiPool,
  adherentsAJour,
  schedule,
  updateEssai,
  relanceEssaiViaWhatsApp,
  hideCloreAdherent,
  onOpenPerson,
}: Props) {
  return (
    <div className="space-y-5">
      {porte === 'admin' ? (
        <button
          type="button"
          onClick={onBackAutre}
          className="text-sm font-semibold text-brand-olive"
        >
          ← Autre
        </button>
      ) : null}
      <div>
        <h2 className="font-display font-bold text-lg">Essais</h2>
        <p className="text-sm text-slate-600 mt-1">
          Une ligne = un créneau. Badge : à venir. Recherche en haut.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setEssaisVue('nouveaux')}
          className={`flex-1 min-w-[6.5rem] min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold ${
            essaisVue === 'nouveaux'
              ? 'bg-brand-olive text-white border-brand-olive'
              : 'bg-white text-brand-black border-[#E8E6E1]'
          }`}
        >
          Nouveaux
        </button>
        <button
          type="button"
          onClick={() => setEssaisVue('week')}
          className={`flex-1 min-w-[6.5rem] min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold ${
            essaisVue === 'week'
              ? 'bg-brand-olive text-white border-brand-olive'
              : 'bg-white text-brand-black border-[#E8E6E1]'
          }`}
        >
          Cette semaine
        </button>
        <button
          type="button"
          onClick={() => setEssaisVue('person')}
          className={`flex-1 min-w-[6.5rem] min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold ${
            essaisVue === 'person'
              ? 'bg-brand-olive text-white border-brand-olive'
              : 'bg-white text-brand-black border-[#E8E6E1]'
          }`}
        >
          Par personne
        </button>
      </div>
      {porte === 'admin' && qPeople && adhesionHitsOnEssai > 0 ? (
        <button
          type="button"
          onClick={onOpenAdhesions}
          className="text-sm text-emerald-800 underline underline-offset-2"
        >
          Aussi dans Adhésion ({adhesionHitsOnEssai})
        </button>
      ) : null}
      {qPeople ? (
        essaiSearchHits.length === 0 && !loading ? (
          <div className="rounded-2xl bg-[#F8F7F4] border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
            <p className="font-medium">Personne avec ce nom ou ce numéro</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-display font-bold text-base text-slate-800">
              Résultat ({essaiSearchHits.length})
            </h3>
            {essaiSearchHits.map((item) => {
              const key = `${item.source}-${item.row}`;
              const telKey = telDedupeKey(item.tel);
              return (
                <EssaiLineCard
                  key={key}
                  item={item}
                  isBusy={busyRow === key}
                  updateEssai={updateEssai}
                  hideRelance={Boolean(telKey && adherentsAJour.has(telKey))}
                  restants={restantsForTel(essaiPool, item.tel)}
                  personN={countEssaisForTel(essaiPool, item.tel)}
                  schedule={schedule}
                  pool={essaiPool}
                  onOpenPerson={onOpenPerson}
                />
              );
            })}
          </div>
        )
      ) : essaisVue === 'nouveaux' ? (
        <>
          {nouveauxEssais.length === 0 && !loading ? (
            <div className="rounded-2xl bg-[#F8F7F4] border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">Aucune nouvelle demande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nouveauxEssais.map((item) => {
                const key = `${item.source}-${item.row}`;
                const telKey = telDedupeKey(item.tel);
                return (
                  <EssaiLineCard
                    key={key}
                    item={item}
                    isBusy={busyRow === key}
                    updateEssai={updateEssai}
                    hideRelance={Boolean(telKey && adherentsAJour.has(telKey))}
                    restants={restantsForTel(essaiPool, item.tel)}
                    personN={countEssaisForTel(essaiPool, item.tel)}
                    schedule={schedule}
                    pool={essaiPool}
                    relanceOnWhatsApp
                    onWhatsAppRelance={relanceEssaiViaWhatsApp}
                    onOpenPerson={onOpenPerson}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : essaisVue === 'week' ? (
        <>
          {aPointer.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-base text-slate-800">
                À pointer · {aPointer.length}
              </h3>
              {aPointer.map((item) => {
                const key = `${item.source}-${item.row}`;
                const telKey = telDedupeKey(item.tel);
                const ymd = essaiYmdFromCreneau(item.creneau || '');
                return (
                  <EssaiLineCard
                    key={key}
                    item={item}
                    isBusy={busyRow === key}
                    updateEssai={updateEssai}
                    hideRelance={Boolean(telKey && adherentsAJour.has(telKey))}
                    restants={restantsForTel(essaiPool, item.tel)}
                    personN={countEssaisForTel(essaiPool, item.tel)}
                    schedule={schedule}
                    pool={essaiPool}
                    essaiDu={formatEssaiDu(ymd)}
                    allowClose
                    hideCloreAdherent={hideCloreAdherent}
                    onOpenPerson={onOpenPerson}
                  />
                );
              })}
            </div>
          ) : null}
          {weekDayGroups.length === 0 && aPointer.length === 0 && !loading ? (
            <div className="rounded-2xl bg-[#F8F7F4] border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">Aucun essai cette semaine</p>
            </div>
          ) : null}
          {weekDayGroups.map((dayGroup) => (
            <div key={dayGroup.day} className="space-y-3">
              <h3 className="font-display font-bold text-base text-slate-800">{dayGroup.label}</h3>
              {dayGroup.slots.map((slotGroup) => (
                <div key={slotGroup.slot} className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">{slotGroup.slot}</p>
                  {slotGroup.items.map((item) => {
                    const key = `${item.source}-${item.row}`;
                    const telKey = telDedupeKey(item.tel);
                    return (
                      <EssaiLineCard
                        key={key}
                        item={item}
                        isBusy={busyRow === key}
                        updateEssai={updateEssai}
                        hideRelance={Boolean(telKey && adherentsAJour.has(telKey))}
                        restants={restantsForTel(essaiPool, item.tel)}
                        personN={countEssaisForTel(essaiPool, item.tel)}
                        schedule={schedule}
                        pool={essaiPool}
                        allowClose
                        hideCloreAdherent={hideCloreAdherent}
                        onOpenPerson={onOpenPerson}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          {personGroups.length === 0 && !loading ? (
            <div className="rounded-2xl bg-[#F8F7F4] border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">Aucune demande d’essai</p>
            </div>
          ) : null}
          {personGroups.map((group) => {
            const telLabel = formatTelFr(group.head.tel);
            const waLine = pickWaEssaiLine(group.items);
            const waBody =
              !group.isAdherent && waLine ? waTextForEssai(waLine, essaiPool, schedule) : null;
            const sansCreneau = waLine ? !hasCreneauSlot(waLine) : false;
            const restants = restantsForTel(essaiPool, group.head.tel);
            const wa =
              waBody && telLabel && (!sansCreneau || restants > 0)
                ? waUrl(group.head.tel, waBody)
                : null;
            return (
              <article
                key={group.key}
                className="rounded-2xl bg-white border border-[#E8E6E1] border-l-[4px] border-l-orange-primary px-4 py-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-brand-black leading-snug">
                    <PersonNameButton
                      prenom={group.head.prenom}
                      nom={group.head.nom}
                      tel={group.head.tel}
                      onOpen={onOpenPerson}
                    />
                  </h3>
                  {group.isAdherent ? (
                    <span className="text-xs font-semibold rounded-full bg-brand-olive text-white px-2 py-1">
                      Adhérent
                    </span>
                  ) : null}
                </div>
                <p className="text-base text-brand-gray">
                  {[telLabel || 'Tél. manquant', essaiNLabel(group.nMax)].join(' · ')}
                </p>
                <ul className="text-sm text-brand-gray space-y-2">
                  {group.items.map((line) => {
                    const key = `${line.source}-${line.row}`;
                    const aVenir = isAVenir(line.statut);
                    const strictAVenir = isStrictAVenir(line.statut);
                    const sansCreneauLine = !hasCreneauSlot(line);
                    return (
                      <li key={key} className="space-y-1.5">
                        <p>{essaiPersonLineLabel(line)}</p>
                        {aVenir ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyRow === key}
                              onClick={() => updateEssai(line, 'Venu')}
                              className="h-11 min-h-[44px] px-3 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60"
                            >
                              {busyRow === key ? '…' : 'Venu'}
                            </button>
                            <button
                              type="button"
                              disabled={busyRow === key}
                              onClick={() => updateEssai(line, 'Absent')}
                              className="h-11 min-h-[44px] px-3 rounded-xl border border-[#E8E6E1] bg-white text-brand-black font-semibold text-sm disabled:opacity-60"
                            >
                              Absent
                            </button>
                            {strictAVenir && sansCreneauLine ? (
                              <button
                                type="button"
                                disabled={busyRow === key}
                                onClick={() => updateEssai(line, 'Relancé')}
                                className="h-11 min-h-[44px] px-3 rounded-xl border border-orange-primary/40 bg-white text-orange-primary font-semibold text-sm disabled:opacity-60"
                              >
                                Relancé
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        <CloreEssai
                          item={line}
                          disabled={busyRow === key}
                          updateEssai={updateEssai}
                          hideAdherent={hideCloreAdherent}
                        />
                      </li>
                    );
                  })}
                </ul>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#25D366] bg-transparent text-[#25D366] font-semibold text-sm"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </article>
            );
          })}
        </>
      )}
    </div>
  );
}
