import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Initiales } from './ui';
import { phoneToWa, relanceHref } from '../../data/bureauRelances';
import { adhesionNeedsMoney, formatTelFr } from '../../lib/bureauSearch';
import { essaiYmdFromCreneau } from '../../lib/essaiDates';
import { msgBureauEssai, resolveCreneau } from '../../lib/essaiMessages';
import {
  type PersonAdherent,
  type PersonEssai,
  type PersonSheet,
} from '../../lib/personSheet';
import { foldStatut, isStrictAVenir, isTerminalEssai } from '../../lib/essaiStatuts';
import { formatEssaiDu } from '../../lib/essaisSemaine';

type Schedule = Parameters<typeof resolveCreneau>[0];

type Props<E extends PersonEssai, A extends PersonAdherent> = {
  sheet: PersonSheet<E, A>;
  seance: boolean;
  busy: boolean;
  schedule: Schedule;
  essaisSheetUrl?: string;
  adherentsSheetUrl?: string;
  onClose: () => void;
  onVenu: (essai: E) => void;
  onAbsent: (essai: E) => void;
  onClore: (essai: E, statut: string, notes?: string) => void;
  onPaid: (adherent: A) => void;
  onWhatsAppConfirm?: (essai: E) => void;
};

function sheetRangeUrl(base: string, row: number) {
  if (!base || !row) return '';
  const clean = base.split('#')[0];
  return `${clean}#gid=0&range=A${row}`;
}

function nLabel(n: number) {
  if (n >= 4) return `Essai ${n} — au-delà de 3`;
  return `${n > 0 ? n : 1}/3`;
}

function frFromYmd(ymd: string) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function lineWhen(essai: PersonEssai) {
  const ymd = essaiYmdFromCreneau(String(essai.creneau || ''));
  if (ymd) return formatEssaiDu(ymd);
  return String(essai.creneau || essai.cours || '').trim() || 'Sans créneau';
}

function essaiLineKey(essai: PersonEssai) {
  return `${essai.source || 'essai'}-${essai.row}`;
}

/** Clos : pas de Venu / Absent / Clore. Relancé et Confirmé restent actionnables. */
function isClosedEssaiLine(statut: string | undefined) {
  const s = foldStatut(String(statut || ''));
  return isTerminalEssai(String(statut || '')) || s === 'venu' || s === 'absent';
}

function waActionHref<E extends PersonEssai>(sheet: PersonSheet<E>, schedule: Schedule) {
  const essai = sheet.actionEssai || sheet.essais[0];
  if (sheet.whatsapp === 'confirmation') {
    const n = phoneToWa(sheet.tel);
    if (!n) return '';
    const text = msgBureauEssai(
      sheet.prenom,
      resolveCreneau(schedule, String(essai?.cours || ''), String(essai?.creneau || '')),
    );
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }
  return relanceHref({
    prenom: sheet.prenom,
    tel: sheet.tel,
    cours: String(essai?.cours || ''),
    message: sheet.whatsapp,
  });
}

export function PersonNameButton({
  prenom,
  nom,
  tel,
  onOpen,
  className,
}: {
  prenom: string;
  nom: string;
  tel: string;
  onOpen: (tel: string, prenom: string) => void;
  className?: string;
}) {
  const label = [prenom, nom].filter(Boolean).join(' ') || 'Sans nom';
  return (
    <button
      type="button"
      onClick={() => onOpen(tel, prenom)}
      className={className || 'font-semibold text-base text-brand-black text-left hover:underline'}
    >
      {label}
    </button>
  );
}

export default function BureauPersonSheet<E extends PersonEssai, A extends PersonAdherent>({
  sheet,
  seance,
  busy,
  schedule,
  essaisSheetUrl = '',
  adherentsSheetUrl = '',
  onClose,
  onVenu,
  onAbsent,
  onClore,
  onPaid,
  onWhatsAppConfirm,
}: Props<E, A>) {
  const [cloreKey, setCloreKey] = useState<string | null>(null);
  const action = sheet.actionEssai;
  const telLabel = formatTelFr(sheet.tel);
  const chat = phoneToWa(sheet.tel);
  const waHref = waActionHref(sheet, schedule);
  const adherent = sheet.adherent;
  const essaiSheetRow = sheet.essais[0]?.row;
  const sheetHref = !seance
    ? adherent?.row
      ? sheetRangeUrl(adherentsSheetUrl, Number(adherent.row))
      : essaiSheetRow
        ? sheetRangeUrl(essaisSheetUrl, Number(essaiSheetRow))
        : ''
    : '';
  const choices: Array<'Adhérent' | 'Annulé' | 'Pas intéressé'> = seance
    ? ['Annulé', 'Pas intéressé']
    : ['Adhérent', 'Annulé', 'Pas intéressé'];

  useEffect(() => {
    setCloreKey(null);
  }, [sheet.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function chooseClore(essai: E, choice: 'Adhérent' | 'Annulé' | 'Pas intéressé') {
    const label = choice === 'Pas intéressé' ? 'Pas intéressé (annulé)' : choice;
    if (!window.confirm(`Clore cet essai : ${label} ?`)) return;
    setCloreKey(null);
    if (choice === 'Pas intéressé') onClore(essai, 'Annulé', 'Pas intéressé');
    else onClore(essai, choice);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <button type="button" aria-label="Fermer la fiche" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-sheet-title"
        className="relative flex h-full w-full flex-col bg-brand-cream md:max-w-md md:shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-black/[0.06] bg-white px-4 py-4">
          <Initiales prenom={sheet.prenom} nom={sheet.nom} />
          <div className="flex-1 min-w-0">
            <h2 id="person-sheet-title" className="font-display text-xl font-bold text-brand-black leading-tight">
              {[sheet.prenom, sheet.nom].filter(Boolean).join(' ') || 'Fiche'}
            </h2>
            {telLabel ? (
              chat ? (
                <a href={`https://wa.me/${chat}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-olive underline underline-offset-2 tabular-nums">
                  {telLabel}
                </a>
              ) : (
                <p className="text-sm text-slate-500 tabular-nums">{telLabel}</p>
              )
            ) : null}
            {!seance && sheet.mail ? (
              <a href={`mailto:${sheet.mail}`} className="block text-sm text-brand-olive underline underline-offset-2 break-all">
                {sheet.mail}
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-xl hover:bg-black/[0.05] text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {!seance ? (
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Adhérent</h3>
              {adherent ? (
                <p className="text-sm text-slate-600 rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3">
                  {[
                    adherent.statut,
                    adherent.mode,
                    adherent.montant,
                    adherent.datePaiement,
                    adherent.numero,
                    adherent.carte,
                  ]
                    .map((bit) => String(bit || '').trim())
                    .filter(Boolean)
                    .join(' · ') || 'Fiche sans détail'}
                </p>
              ) : (
                <p className="text-sm text-slate-600 rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3">Pas de fiche adhérent.</p>
              )}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Essais</h3>
            {sheet.essais.length === 0 ? (
              <p className="text-sm text-slate-600 rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3">Aucun essai pour cette personne.</p>
            ) : (
              <ul className="space-y-2">
                {sheet.essais.map((essai) => {
                  const n = Number(essai.nEssai) > 0 ? Number(essai.nEssai) : sheet.nCountable;
                  const lineKey = essaiLineKey(essai);
                  const open = !isClosedEssaiLine(essai.statut);
                  return (
                    <li key={lineKey} className="rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3 text-sm text-brand-black space-y-2">
                      <p>{[lineWhen(essai), String(essai.statut || 'À venir').trim(), nLabel(n)].join(' · ')}</p>
                      {open ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onVenu(essai)}
                              className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60"
                            >
                              Venu
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onAbsent(essai)}
                              className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm disabled:opacity-60"
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setCloreKey((key) => (key === lineKey ? null : lineKey))}
                              className="h-11 min-h-[44px] px-1 text-sm text-slate-500 underline underline-offset-2 disabled:opacity-60"
                            >
                              Clore
                            </button>
                          </div>
                          {cloreKey === lineKey ? (
                            <div className="flex flex-wrap gap-2">
                              {choices.map((choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => chooseClore(essai, choice)}
                                  className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm disabled:opacity-60"
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Relances</h3>
            {sheet.relances.length === 0 ? (
              <p className="text-sm text-slate-600 rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3">Aucune relance notée.</p>
            ) : (
              <ul className="space-y-1 text-base text-brand-gray">
                {sheet.relances.map((relance, index) => (
                  <li key={`${relance.msg}-${relance.ymd}-${index}`}>
                    Message {relance.msg} · {frFromYmd(relance.ymd)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Notes</h3>
            {sheet.notesEssais.length === 0 && (seance || sheet.notesAdherents.length === 0) ? (
              <p className="text-sm text-slate-600 rounded-2xl bg-white ring-1 ring-black/[0.06] px-4 py-3">Pas de note.</p>
            ) : (
              <div className="space-y-2 text-base text-brand-black whitespace-pre-wrap">
                {sheet.notesEssais.map((note, index) => (
                  <p key={`essai-${index}`}>{note}</p>
                ))}
                {!seance
                  ? sheet.notesAdherents.map((note, index) => (
                      <p key={`adh-${index}`}>{note}</p>
                    ))
                  : null}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-black/[0.06] bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (action && sheet.whatsapp === 'confirmation' && isStrictAVenir(String(action.statut || ''))) {
                  onWhatsAppConfirm?.(action);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#128C4B] font-semibold text-sm"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          ) : null}
          {!seance && adherent && adhesionNeedsMoney(String(adherent.statut || '')) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPaid(adherent)}
              className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60"
            >
              J’ai reçu l’argent
            </button>
          ) : null}
          {sheetHref ? (
            <a
              href={sheetHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm disabled:opacity-60"
            >
              Ouvrir dans le Sheet
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
