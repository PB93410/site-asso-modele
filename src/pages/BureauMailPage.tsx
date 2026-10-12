/**
 * /bureau/mail — lire + répondre dans le fil (boîte de l’asso en IMAP, ou Gmail API, via Netlify)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import BureauAuthGate, { BureauSeanceReserve, getBureauToken } from '../components/BureauAuthGate';
import { bureauFetch } from '../lib/bureauApi';
import { matchSheetPerson, type MatchHow } from '../lib/mailMatch';
import { ASSO, PAIEMENT_NOM } from '../data/asso';

type MailItem = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

type MailDetail = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  messageId: string;
  references: string;
};

type MailFilter = 'a-traiter' | 'adhesions' | 'essais' | 'enligne' | 'autre';

type SheetPerson = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  mail: string;
  mode: string;
  statut: string;
  dateDemande: string;
};

type ParsedMail = {
  item: MailItem;
  kind: 'adhesion' | 'essai' | 'enligne' | 'personne' | 'autre';
  name: string;
  payment: string;
  channel: string;
  status: string;
  phone: string;
  paiementValidated: boolean;
  pending: boolean;
  ts: number;
  parisDay: string;
};

type MailFolder = {
  id: string;
  title: string;
  kind: ParsedMail['kind'];
  messages: ParsedMail[];
  primary: ParsedMail;
  payment: string;
  channel: string;
  status: string;
  phone: string;
  sheetRow: number | null;
  sheetUrl: string;
  sheetStatut: string;
  sheetDate: string;
  paiementValidated: boolean;
  aTraiter: boolean;
  matchHow: MatchHow;
};

const TZ = 'Europe/Paris';
const FILTERS: { id: MailFilter; label: string }[] = [
  { id: 'a-traiter', label: 'À traiter' },
  { id: 'adhesions', label: 'Adhésions' },
  { id: 'essais', label: 'Essais' },
  { id: 'enligne', label: PAIEMENT_NOM },
  { id: 'autre', label: 'Autre' },
];

function fold(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Préfixe des mails envoyés par le site : « [ASE] … » (asso.config.js → sigle). */
const MAIL_TAG = `[${ASSO.sigle.toLowerCase()}]`;
/** Plateforme de paiement en ligne (asso.config.js → adhesion.paiementNom), en minuscules. */
const PAY_KEY = fold(PAIEMENT_NOM).replace(/\s+/g, '') || 'paiement en ligne';
const escRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAY_WORD_RE = new RegExp(`\\b${escRe(PAY_KEY)}\\b`, 'i');
const CARTE_LABEL = `Carte · ${PAIEMENT_NOM}`;
const ORG_RE = new RegExp(
  `${escRe(PAY_KEY)}|netlify|icloud|insideapple|apple|google|noreply|no-reply|formulaire|${escRe(fold(ASSO.nom))}|${escRe(fold(ASSO.ville))}`,
);

/** Relevé Sheet groupé : « [ASE] 2 nouvelles demandes » / « relevé ». */
function isTagDigestSubject(subject: string) {
  const s = fold(subject);
  if (!s.includes(MAIL_TAG)) return false;
  return /nouvelle[s]?\s+demande/.test(s) || /\breleve\b/.test(s);
}

/** Alerte fiche adhésion : « [ASE] Adhésion — Prénom NOM ». */
function isTagAdhesionSubject(subject: string) {
  const s = fold(subject);
  return s.includes(MAIL_TAG) && /\badhesion\b/.test(s);
}

/** Corps / snippet d’un relevé essais (souvent hors sujet). */
function hasEssaiDigestText(subject: string, snippet: string) {
  const hay = fold(`${subject}\n${snippet}`);
  return /demande[s]?\s+d['’`]?\s*essai/.test(hay) || /\bdemandes?\s+d\s+essai\b/.test(hay);
}

function hasAdhesionDigestText(subject: string, snippet: string) {
  const hay = fold(`${subject}\n${snippet}`);
  if (isTagAdhesionSubject(subject)) return true;
  return /\bdemande[s]?\s+d['’`]?\s*adhesion\b/.test(hay) || /\badhesion\s*[—–-]/.test(hay);
}

function looksLikeEssaiMail(subject: string, snippet: string) {
  if (hasEssaiDigestText(subject, snippet)) return true;
  if (isTagAdhesionSubject(subject)) return false;
  if (isTagDigestSubject(subject) && !hasAdhesionDigestText(subject, snippet)) return true;
  const hay = fold(`${subject}\n${snippet}`);
  return /\bessai\b/.test(hay) && !PAY_WORD_RE.test(hay);
}

function parseFrom(from: string) {
  const s = String(from || '').trim();
  const m = s.match(/^(.*)<([^>]+)>$/);
  if (m) {
    return { name: m[1].replace(/"/g, '').trim(), email: m[2].trim().toLowerCase() };
  }
  if (/^[^\s@]+@[^\s@]+$/.test(s)) return { name: '', email: s.toLowerCase() };
  return { name: s, email: '' };
}

function parseMailDate(rfc: string): Date | null {
  const d = new Date(rfc);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parisYmd(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parisHm(d: Date) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const min = parts.find((p) => p.type === 'minute')?.value || '00';
  return min === '00' ? `${h}h` : `${h}h${min}`;
}

function yesterdayYmd(todayYmd: string) {
  const [y, m, d] = todayYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function formatListDate(rfc: string, todayYmd: string) {
  const d = parseMailDate(rfc);
  if (!d) return rfc;
  const day = parisYmd(d);
  const hm = parisHm(d);
  if (day === todayYmd) return `aujourd’hui · ${hm}`;
  if (day === yesterdayYmd(todayYmd)) return `hier · ${hm}`;
  const long = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return `${long} · ${hm}`;
}

function parseFrSheetDate(raw: string): Date | null {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  return null;
}

function formatDemandeDate(raw: string, todayYmd: string) {
  const d = parseFrSheetDate(raw);
  if (!d) return String(raw || '').trim();
  const day = parisYmd(d);
  if (day === todayYmd) return 'aujourd’hui';
  if (day === yesterdayYmd(todayYmd)) return 'hier';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

function extractEmails(text: string) {
  return (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((e) => e.toLowerCase());
}

function extractPhone(text: string) {
  const wa = text.match(/wa\.me\/(33\d{8,})/i);
  if (wa) {
    const d = wa[1];
    return `0${d.slice(2)}`;
  }
  const m = text.match(/(?:tél\.?|tel\.?|whatsapp)\s*[:\s]*((?:\+33|0)[\d\s.]{8,})/i);
  if (m) return m[1];
  const loose = text.match(/(?:^|\s)(0[67](?:[\s.]?\d{2}){4})(?:\s|$)/);
  return loose ? loose[1] : '';
}

function phoneWaHref(tel: string, prenom: string) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) d = `33${d.slice(1)}`;
  if (!(d.startsWith('33') && d.length >= 11)) return '';
  const text = `Bonjour ${prenom || ''},\n${ASSO.nom} — votre demande est bien reçue.\nDites-nous ce qui vous arrange.\nÀ bientôt !`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function isOrgLabel(s: string) {
  const t = fold(s);
  return (
    !t ||
    ORG_RE.test(t)
  );
}

function capitalizeWord(w: string) {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function formatMemberTitle(raw: string) {
  const parts = String(raw || '')
    .replace(/[«»"]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return capitalizeWord(parts[0]);
  const nom = parts[parts.length - 1].toUpperCase();
  const prenom = parts.slice(0, -1).map(capitalizeWord).join(' ');
  return `${prenom} ${nom}`;
}

function extractNameFromMail(item: MailItem, fromName: string) {
  const sub = item.subject || '';
  const snip = item.snippet || '';
  const blob = `${sub}\n${snip}`;
  const tagged = sub.match(new RegExp(`\\[${escRe(ASSO.sigle)}\\]\\s*Adhésion\\s*[—–-]\\s*(.+)$`, 'i'));
  if (tagged && !isOrgLabel(tagged[1])) return tagged[1].trim();
  const adh = sub.match(/Adhésion\s*[—–-]\s*(.+)$/i);
  if (adh && !/nouvelle/i.test(adh[1]) && !isOrgLabel(adh[1])) return adh[1].trim();
  const essai = sub.match(/Essai\s*[—–-]\s*(.+)$/i);
  if (essai && !isOrgLabel(essai[1])) return essai[1].trim();
  const prenom = blob.match(/pr[ée]nom\s*[:\-–]\s*([^\n,;]+)/i);
  const nom = blob.match(/(?:^|\n|\s)nom\s*[:\-–]\s*([^\n,;]+)/i);
  if (prenom && nom) {
    const full = `${prenom[1].trim()} ${nom[1].trim()}`;
    if (!isOrgLabel(full)) return full;
  }
  const labeled = blob.match(
    /(?:adhérent[e]?|membre|pour|nom|prénom|prenom|name)\s*[:\-–]\s*([A-ZÀ-ÿ][\wÀ-ÿ' -]{2,50})/i,
  );
  if (labeled && !isOrgLabel(labeled[1])) return labeled[1].trim();
  const line = snip.match(/Adhésion[^\n]*\n+\s*([A-ZÀ-ÿ][\wÀ-ÿ' -]{2,60})/i);
  if (line && !isOrgLabel(line[1])) return line[1].trim();
  const identite = snip.match(
    /\b([A-ZÀ-ÿ][a-zà-ÿ'’\-]+)\s+([A-ZÀ-ÿ]{2,}(?:-[A-ZÀ-ÿ]{2,})?)\b/,
  );
  if (identite) {
    const guess = `${identite[1]} ${identite[2]}`;
    if (!isOrgLabel(guess)) return guess;
  }
  if (fromName && !/@/.test(fromName) && !isOrgLabel(fromName)) return fromName;
  return '';
}

function extractPayment(text: string) {
  const t = fold(text);
  if (t.includes(PAY_KEY) || t.includes('carte')) return CARTE_LABEL;
  if (t.includes('cheque')) return 'Chèque';
  if (t.includes('espece')) return 'Espèces';
  if (t.includes('ancv')) return 'ANCV';
  const p = text.match(/Paiement\s*:\s*([^\n.]+)/i);
  if (p) return formatPaymentLabel(p[1]);
  return '';
}

function formatPaymentLabel(raw: string) {
  const t = fold(raw);
  if (t.includes(PAY_KEY) || t.includes('carte')) return CARTE_LABEL;
  if (t.includes('cheque')) return 'Chèque';
  if (t.includes('espece')) return 'Espèces';
  if (t.includes('ancv')) return 'ANCV';
  return String(raw || '').trim();
}

function isPaiementValidated(text: string) {
  const t = fold(text);
  return t.includes('valid') || t.includes('confirme') || t.includes('paiement recu') || t.includes('reussi');
}

function isAutreMail(item: MailItem, email: string, fromName: string) {
  const hay = fold(`${item.from} ${item.subject} ${item.snippet} ${email} ${fromName}`);
  if (hay.includes('netlify') || hay.includes(MAIL_TAG) || hay.includes(PAY_KEY)) {
    return false;
  }
  if (/insideapple|icloud|appleid|email\.apple\.com/.test(hay)) return true;
  if (/me\.com|mac\.com/.test(email)) return true;
  if (
    /mailchimp|sendinblue|brevo|sarbacane|mailjet|sendgrid|newsletter|desabonn|unsubscribe|promo|publicite/.test(
      hay,
    )
  ) {
    return true;
  }
  if (/noreply|no-reply|ne-pas-repondre|notifications@|marketing@/.test(email) && !hay.includes('google')) {
    return true;
  }
  return false;
}

function isGenericFolderTitle(title: string) {
  const t = fold(title);
  return t === 'adhesion' || t.startsWith('adhesion ·') || t === 'message' || t === 'essai';
}

/** Formulaire Netlify « Nouvelle Adhesion » sans fiche utile (pas de nom). */
function isEmptyNetlifyAdhesion(folder: MailFolder) {
  if (folder.kind !== 'adhesion' && !folder.messages.some((m) => m.kind === 'adhesion')) return false;
  const fromNetlify = folder.messages.some((m) =>
    /netlify|form submission/i.test(`${m.item.subject}\n${m.item.from}\n${m.channel}`),
  );
  if (!fromNetlify) return false;
  const t = fold(folder.title);
  return (
    isGenericFolderTitle(folder.title) ||
    t === 'nouvelle adhesion' ||
    /^nouvelle\s+adhesion/.test(t)
  );
}

function paymentFamily(raw: string) {
  const t = fold(raw);
  if (t.includes(PAY_KEY) || t.includes('carte')) return 'enligne';
  if (t.includes('cheque')) return 'cheque';
  if (t.includes('espece')) return 'espece';
  if (t.includes('ancv')) return 'ancv';
  return t;
}

function isAdhesionFolder(f: MailFolder) {
  return (
    f.kind === 'adhesion' ||
    f.kind === 'enligne' ||
    f.messages.some((m) => m.kind === 'adhesion' || m.kind === 'enligne')
  );
}

function samePaymentFamily(a: MailFolder, b: MailFolder) {
  const fa = paymentFamily(a.payment) || (a.paiementValidated ? 'enligne' : '');
  const fb = paymentFamily(b.payment) || (b.paiementValidated ? 'enligne' : '');
  if (!fa || !fb) return false;
  return fa === fb;
}

function sameSlot30(a: MailFolder, b: MailFolder) {
  if (!a.primary.ts || !b.primary.ts) return false;
  return Math.abs(a.primary.ts - b.primary.ts) <= 30 * 60 * 1000;
}

function namedFuseTarget(anon: MailFolder, pool: MailFolder[]): MailFolder | null {
  if (anon.kind === 'autre' || !isGenericFolderTitle(anon.title) || !isAdhesionFolder(anon)) return null;
  const named = pool.filter(
    (f) =>
      f !== anon &&
      f.kind !== 'autre' &&
      !isGenericFolderTitle(f.title) &&
      isAdhesionFolder(f) &&
      f.primary.parisDay === anon.primary.parisDay,
  );
  const bySlot = named.filter((f) => sameSlot30(anon, f));
  if (bySlot.length === 1) return bySlot[0];
  if (bySlot.length > 1) return null;
  const byPay = named.filter((f) => samePaymentFamily(anon, f));
  if (byPay.length === 1) return byPay[0];
  return null;
}

function personGroupKey(p: ParsedMail, people: SheetPerson[]) {
  const emails = extractEmails(`${p.item.from} ${p.item.snippet} ${p.item.subject}`);
  const { person } = matchSheetPerson(p.name, emails, p.phone, people);
  if (person) return `sheet:${person.row}`;
  const n = fold(p.name);
  if (n && !isOrgLabel(p.name)) return `name:${n}`;
  if (p.item.threadId && (p.kind === 'enligne' || p.kind === 'adhesion' || p.kind === 'essai')) {
    return `thread:${p.item.threadId}`;
  }
  return `id:${p.item.id}`;
}

function isSheetEnAttente(statut: string) {
  return fold(statut) === 'en attente';
}

function classify(item: MailItem): ParsedMail {
  const { name: fromName, email } = parseFrom(item.from);
  const blob = `${item.subject}\n${item.snippet}\n${item.from}`;
  const hay = fold(blob);
  const d = parseMailDate(item.date);
  const ts = d ? d.getTime() : 0;
  const parisDay = d ? parisYmd(d) : '';

  if (isAutreMail(item, email, fromName)) {
    return {
      item,
      kind: 'autre',
      name: /icloud|insideapple|apple/.test(hay) ? 'iCloud' : fromName || 'Newsletter',
      payment: '',
      channel: /icloud|insideapple|apple/.test(hay) ? 'iCloud' : 'Newsletter',
      status: '',
      phone: '',
      paiementValidated: false,
      pending: false,
      ts,
      parisDay,
    };
  }

  const enLigne = hay.includes(PAY_KEY) || email.includes(PAY_KEY);
  const tagAdhesion = isTagAdhesionSubject(item.subject);
  const tagDigest = isTagDigestSubject(item.subject);
  const essaiText = hasEssaiDigestText(item.subject, item.snippet);
  const adhesionText = hasAdhesionDigestText(item.subject, item.snippet);
  const adhesion =
    tagAdhesion ||
    hay.includes('form submission') ||
    hay.includes('netlify') ||
    (/\badhesion\b/.test(hay) && !tagDigest);
  const essai =
    !enLigne &&
    (essaiText ||
      looksLikeEssaiMail(item.subject, item.snippet) ||
      (tagDigest && !adhesionText && !tagAdhesion));
  const name = extractNameFromMail(item, fromName);
  const payment = extractPayment(blob);
  const phone = extractPhone(blob);
  const validated = enLigne && isPaiementValidated(blob);
  const pendingDemande =
    /en attente/.test(hay) ||
    tagDigest ||
    tagAdhesion ||
    hay.includes('netlify') ||
    hay.includes('form submission') ||
    essai;

  let kind: ParsedMail['kind'] = 'personne';
  let channel = 'Mail';
  if (enLigne) {
    kind = 'enligne';
    channel = PAIEMENT_NOM;
  } else if (tagAdhesion) {
    kind = 'adhesion';
    channel = 'Alerte Sheet';
  } else if (essai && adhesionText && !essaiText) {
    kind = 'adhesion';
    channel = hay.includes('netlify') || hay.includes('form submission') ? 'Formulaire' : 'Alerte Sheet';
  } else if (essai) {
    kind = 'essai';
    channel = tagDigest || hay.includes(MAIL_TAG) ? 'Alerte Sheet' : hay.includes('netlify') ? 'Formulaire' : 'Mail';
  } else if (adhesion) {
    kind = 'adhesion';
    channel = hay.includes(MAIL_TAG)
      ? 'Alerte Sheet'
      : hay.includes('netlify') || hay.includes('form submission')
        ? 'Formulaire'
        : 'Mail';
  } else if (hay.includes(MAIL_TAG)) {
    kind = tagDigest ? 'essai' : 'adhesion';
    channel = 'Alerte Sheet';
  }

  return {
    item,
    kind,
    name,
    payment: enLigne ? CARTE_LABEL : payment,
    channel,
    status: pendingDemande ? 'En attente' : '',
    phone,
    paiementValidated: validated,
    pending: pendingDemande,
    ts,
    parisDay,
  };
}

function sheetRangeUrl(base: string, row: number) {
  if (!base || !row) return '';
  const clean = base.split('#')[0];
  return `${clean}#gid=0&range=A${row}`;
}

function pickPrimary(messages: ParsedMail[]) {
  const ranked = [...messages].sort((a, b) => {
    const score = (p: ParsedMail) => {
      if (p.kind === 'essai' && (isTagDigestSubject(p.item.subject) || hasEssaiDigestText(p.item.subject, p.item.snippet))) {
        return 4;
      }
      if (p.kind === 'adhesion' && isTagAdhesionSubject(p.item.subject)) return 3;
      if (p.kind === 'adhesion' && /netlify|form submission/i.test(`${p.item.subject} ${p.item.from}`)) return 3;
      if (p.kind === 'adhesion') return 2;
      if (p.kind === 'essai') return 2;
      if (p.kind === 'enligne') return 1;
      return 0;
    };
    const d = score(b) - score(a);
    return d !== 0 ? d : b.ts - a.ts;
  });
  return ranked[0];
}

function buildFolders(items: MailItem[], people: SheetPerson[], sheetUrl: string, _todayYmd: string): MailFolder[] {
  const parsed = items.map(classify);
  const folders: MailFolder[] = [];

  function makeFolder(group: ParsedMail[]): MailFolder {
    const primary = pickPrimary(group);
    const emails = group.flatMap((g) => extractEmails(`${g.item.from} ${g.item.snippet} ${g.item.subject}`));
    const rawName =
      group
        .map((g) => g.name)
        .filter((n) => n && !isOrgLabel(n))
        .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0] || '';
    const groupPhone = group.map((g) => g.phone).find(Boolean) || '';
    const { person, how: matchHow } = matchSheetPerson(rawName, emails, groupPhone, people);
    let title = '';
    const hasEssaiMsg = group.some((g) => g.kind === 'essai');
    const hasAdhesionMsg = group.some((g) => g.kind === 'adhesion');
    const hasPaiementMsg = group.some((g) => g.kind === 'enligne');
    const folderKind: ParsedMail['kind'] = hasPaiementMsg
      ? 'enligne'
      : hasEssaiMsg && !hasAdhesionMsg
        ? 'essai'
        : hasAdhesionMsg && !hasEssaiMsg
          ? 'adhesion'
          : hasEssaiMsg && hasAdhesionMsg
            ? primary.kind === 'essai' ||
              isTagDigestSubject(primary.item.subject) ||
              hasEssaiDigestText(primary.item.subject, primary.item.snippet)
              ? 'essai'
              : 'adhesion'
            : primary.kind;

    if (primary.kind === 'autre') {
      title = /icloud|insideapple|apple/i.test(`${primary.item.from} ${primary.name}`)
        ? 'iCloud'
        : rawName || primary.name || 'Newsletter';
    } else if (folderKind === 'essai') {
      const digest =
        isTagDigestSubject(primary.item.subject) ||
        hasEssaiDigestText(primary.item.subject, primary.item.snippet);
      const named = formatMemberTitle(person ? `${person.prenom} ${person.nom}` : rawName);
      if (digest) {
        const oneName =
          named && !/nouvelle|releve|demande|essai/i.test(fold(named)) ? named.split(/\s+/)[0] : '';
        title = oneName ? `Essai — ${capitalizeWord(oneName)}` : 'Essais — relevé';
      } else {
        title = named ? `Essai — ${named}` : 'Essai';
      }
    } else {
      const named = formatMemberTitle(person ? `${person.prenom} ${person.nom}` : rawName);
      title = named || 'Adhésion';
    }
    const phone = person?.tel || groupPhone;
    const paiementOk = group.some((g) => g.paiementValidated);
    const payment = formatPaymentLabel(
      person?.mode || group.map((g) => g.payment).find(Boolean) || (paiementOk ? CARTE_LABEL : ''),
    );
    const sheetWaiting = person ? isSheetEnAttente(person.statut) : false;
    const pending =
      primary.kind !== 'autre' &&
      (folderKind === 'essai' ||
        sheetWaiting ||
        (!person &&
          (group.some((g) => g.pending) ||
            group.some((g) => g.kind === 'essai' || g.kind === 'adhesion') ||
            paiementOk)));
    // À traiter = paiements seulement (adhésion / paiement en ligne encore En attente). Essais → filtre Essais.
    const aTraiter =
      primary.kind !== 'autre' &&
      (folderKind === 'adhesion' || folderKind === 'enligne') &&
      (person
        ? sheetWaiting && fold(person.prenom) !== 'test'
        : Boolean(pending));
    const row = folderKind === 'essai' ? null : person?.row || null;
    return {
      id: group
        .map((g) => g.item.id)
        .sort()
        .join('+'),
      title,
      kind: folderKind,
      messages: [...group].sort((a, b) => b.ts - a.ts),
      primary,
      payment: folderKind === 'essai' ? '' : payment,
      channel: paiementOk ? PAIEMENT_NOM : primary.channel,
      status: pending || folderKind === 'essai' ? 'En attente' : '',
      phone: folderKind === 'essai' ? groupPhone : phone,
      sheetRow: row,
      sheetUrl: row ? sheetRangeUrl(sheetUrl, row) : '',
      sheetStatut: folderKind === 'essai' ? '' : person?.statut || '',
      sheetDate: folderKind === 'essai' ? '' : person?.dateDemande || '',
      paiementValidated: paiementOk,
      aTraiter,
      matchHow,
    };
  }

  const buckets = new Map<string, ParsedMail[]>();
  for (const p of parsed) {
    const key = p.kind === 'autre' ? `autre:${p.item.id}` : personGroupKey(p, people);
    const list = buckets.get(key) || [];
    list.push(p);
    buckets.set(key, list);
  }
  for (const group of buckets.values()) {
    folders.push(makeFolder(group));
  }

  const out: MailFolder[] = [];
  for (const f of folders) {
    if (f.kind === 'autre' || isGenericFolderTitle(f.title)) {
      out.push(f);
      continue;
    }
    const key = fold(f.title);
    const i = out.findIndex((o) => o.kind !== 'autre' && !isGenericFolderTitle(o.title) && fold(o.title) === key);
    if (i >= 0) {
      out[i] = makeFolder([...out[i].messages, ...f.messages]);
    } else {
      out.push(f);
    }
  }
  const fused: MailFolder[] = [...out];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < fused.length; i++) {
      const anon = fused[i];
      const named = namedFuseTarget(anon, fused);
      if (!named) continue;
      const rivals = fused.filter((f) => namedFuseTarget(f, fused) === named);
      if (rivals.length !== 1) continue;
      const ni = fused.indexOf(named);
      const merged = makeFolder([...named.messages, ...anon.messages]);
      fused.splice(Math.max(i, ni), 1);
      fused.splice(Math.min(i, ni), 1, merged);
      changed = true;
      break;
    }
  }
  fused.sort((a, b) => b.primary.ts - a.primary.ts);
  return fused;
}

function badgeClass(label: string) {
  const s = fold(label);
  if (s.includes(PAY_KEY)) return 'bg-brand-olive-soft text-brand-olive';
  if (s.includes('attente')) return 'bg-orange-primary/10 text-orange-primary';
  return 'bg-brand-cream text-brand-gray border border-brand-gray-light';
}

export default function BureauMailPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<MailItem[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [selected, setSelected] = useState<MailDetail | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<MailFolder | null>(null);
  const [filter, setFilter] = useState<MailFilter>(() => {
    const f = searchParams.get('filter');
    if (f === 'a-traiter' || f === 'adhesions' || f === 'essais' || f === 'enligne' || f === 'autre') {
      return f;
    }
    return 'adhesions';
  });
  const [people, setPeople] = useState<SheetPerson[]>([]);
  const [adherentsSheetUrl, setAdherentsSheetUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [confirmFolder, setConfirmFolder] = useState<MailFolder | null>(null);
  const todayYmd = useMemo(() => parisYmd(new Date()), []);

  const loadList = useCallback(async (pageToken?: string) => {
    const q = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const data = await bureauFetch<{ messages: MailItem[]; nextPageToken: string | null }>(
      `/api/bureau/mail/list${q}`,
    );
    return data;
  }, []);

  const loadSheet = useCallback(async () => {
    try {
      const data = await bureauFetch<{
        all?: SheetPerson[];
        items?: SheetPerson[];
        adherentsSheetUrl?: string;
      }>('/api/adhesions-pending');
      setPeople(data.all || data.items || []);
      setAdherentsSheetUrl(data.adherentsSheetUrl || '');
    } catch {
      /* la liste mail reste utilisable sans le Sheet */
    }
  }, []);

  useEffect(() => {
    if (!getBureauToken()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [data] = await Promise.all([loadList(), loadSheet()]);
        if (cancelled) return;
        setMessages(data.messages || []);
        setNextPage(data.nextPageToken);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList, loadSheet]);

  const folders = useMemo(
    () => buildFolders(messages, people, adherentsSheetUrl, todayYmd),
    [messages, people, adherentsSheetUrl, todayYmd],
  );

  const visibleFolders = useMemo(() => {
    const list = folders.filter((f) => {
      if (isEmptyNetlifyAdhesion(f)) return false;
      if (filter === 'a-traiter') return f.aTraiter && f.kind !== 'autre';
      if (filter === 'adhesions') {
        if (f.kind === 'essai') return false;
        if (f.messages.every((m) => m.kind === 'essai')) return false;
        return f.kind === 'adhesion' || f.messages.some((m) => m.kind === 'adhesion');
      }
      if (filter === 'essais') {
        return (
          f.kind === 'essai' ||
          f.messages.some((m) => m.kind === 'essai') ||
          f.messages.some((m) => looksLikeEssaiMail(m.item.subject, m.item.snippet)) ||
          f.messages.some(
            (m) =>
              isTagDigestSubject(m.item.subject) &&
              !isTagAdhesionSubject(m.item.subject) &&
              !hasAdhesionDigestText(m.item.subject, m.item.snippet),
          )
        );
      }
      if (filter === 'enligne') return f.paiementValidated || f.kind === 'enligne' || PAY_WORD_RE.test(f.channel + f.payment);
      if (filter === 'autre') return f.kind === 'autre';
      return true;
    });
    if (filter !== 'a-traiter') return list;
    const rank = (f: MailFolder) => {
      const named = !isGenericFolderTitle(f.title);
      if (named && f.status === 'En attente') return 1;
      if (named) return 3;
      return 4;
    };
    return [...list].sort((a, b) => {
      const d = rank(a) - rank(b);
      return d !== 0 ? d : b.primary.ts - a.primary.ts;
    });
  }, [folders, filter]);

  async function openMessage(id: string, folder?: MailFolder) {
    setDetailLoading(true);
    setError('');
    setSentOk(false);
    setReply('');
    setSelectedFolder(folder || null);
    try {
      const data = await bureauFetch<MailDetail>(`/api/bureau/mail/${encodeURIComponent(id)}`);
      setSelected(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setSending(true);
    setError('');
    setSentOk(false);
    try {
      await bureauFetch(`/api/bureau/mail/${encodeURIComponent(selected.id)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: reply }),
      });
      setSentOk(true);
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  async function markAJour(folder: MailFolder) {
    if (!folder.sheetRow) return;
    setMarkingId(folder.id);
    setError('');
    try {
      await bureauFetch('/api/adhesion-validate', {
        method: 'POST',
        body: JSON.stringify({
          row: folder.sheetRow,
          tel: folder.phone,
          statut: 'À jour',
          expectedStatut: folder.sheetStatut || undefined,
        }),
      });
      setConfirmFolder(null);
      setPeople((prev) =>
        prev.map((p) => (p.row === folder.sheetRow ? { ...p, statut: 'À jour' } : p)),
      );
      await loadSheet();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible d’enregistrer. Réessayez dans un instant.',
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function loadMore() {
    if (!nextPage) return;
    setLoadingMore(true);
    try {
      const data = await loadList(nextPage);
      setMessages((prev) => [...prev, ...(data.messages || [])]);
      setNextPage(data.nextPageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoadingMore(false);
    }
  }

  function renderFolderCard(folder: MailFolder) {
    const n = folder.messages.length;
    const isAutre = folder.kind === 'autre';
    const prenom = folder.title.split(' ')[0] || '';
    const wa = !isAutre ? phoneWaHref(folder.phone, prenom) : '';
    const showEnAttente = folder.status === 'En attente';
    const showPaiementMail = Boolean(folder.paiementValidated) && !isAutre;
    const pay = fold(folder.payment);
    const sheetWaiting = isSheetEnAttente(folder.sheetStatut);
    const canMark =
      !isAutre && (folder.matchHow === 'email' || folder.matchHow === 'tel') && sheetWaiting;
    const showVerify = !isAutre && folder.kind !== 'essai' && !canMark && (showEnAttente || sheetWaiting);
    const summary = showEnAttente
      ? pay.includes('cheque') || pay.includes('espece') || pay.includes('ancv')
        ? 'Chèque / espèce à encaisser'
        : 'À rappeler'
      : '';
    const meta = [
      !isAutre ? folder.payment : '',
      folder.sheetDate
        ? formatDemandeDate(folder.sheetDate, todayYmd)
        : formatListDate(folder.primary.item.date, todayYmd),
      n > 1 ? `${n} messages` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const bar = showEnAttente ? 'border-l-orange-primary' : 'border-l-brand-olive';
    return (
      <li key={folder.id}>
        <article
          className={`rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] border-l-[4px] ${bar} px-4 py-3 space-y-1.5`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {showEnAttente ? (
              <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${badgeClass('En attente')}`}>
                En attente
              </span>
            ) : null}
            {showPaiementMail ? (
              <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${badgeClass(`Mail ${PAIEMENT_NOM}`)}`}>
                Mail {PAIEMENT_NOM}
              </span>
            ) : null}
            {showVerify ? (
              <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${badgeClass('À vérifier')}`}>
                À vérifier
              </span>
            ) : null}
          </div>
          <h2 className="font-semibold text-base text-brand-black leading-snug">{folder.title}</h2>
          {summary ? <p className="text-sm text-brand-gray">{summary}</p> : null}
          <p className="text-sm text-brand-gray">{meta}</p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5 max-[700px]:grid max-[700px]:grid-cols-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#25D366] bg-white text-[#25D366] font-semibold text-sm max-[700px]:w-full"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                WhatsApp
              </a>
            ) : null}
            {!isAutre && folder.sheetUrl && !showVerify ? (
              <a
                href={folder.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold text-sm max-[700px]:w-full"
              >
                Ouvrir la feuille
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            ) : null}
            {canMark ? (
              <button
                type="button"
                disabled={markingId === folder.id}
                onClick={() => {
                  setError('');
                  setConfirmFolder(folder);
                }}
                className="h-11 min-h-[44px] px-3 rounded-xl border border-brand-olive bg-white font-semibold text-sm text-brand-black disabled:opacity-60 max-[700px]:w-full"
              >
                Marquer à jour
              </button>
            ) : null}
            {showVerify && folder.sheetUrl ? (
              <a
                href={folder.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold text-sm max-[700px]:w-full"
              >
                Ouvrir la fiche
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            ) : null}
            {showVerify ? (
              <Link
                to="/bureau?porte=admin&tab=adhesions"
                className="inline-flex items-center justify-center h-11 min-h-[44px] px-3 rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold text-sm max-[700px]:w-full"
              >
                À payer
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void openMessage(folder.primary.item.id, folder)}
              className="h-11 min-h-[44px] px-3 rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold text-sm text-brand-gray max-[700px]:w-full"
            >
              Voir le fil
            </button>
          </div>
        </article>
      </li>
    );
  }

  return (
    <BureauAuthGate title="Bureau" subtitle="Boîte mail de l’association">
      <BureauSeanceReserve>
      <div className="min-h-screen bg-brand-cream text-brand-black" data-bureau-root>
        <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-brand-cream/90 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-nowrap">
            <Link
              to="/bureau?tab=more"
              className="text-sm font-semibold text-brand-olive min-h-[44px] inline-flex items-center shrink-0"
            >
              ← Autre
            </Link>
            {!selected ? (
              <button
                type="button"
                className="min-h-[44px] px-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-black shrink-0"
                onClick={() => {
                  setLoading(true);
                  setError('');
                  void Promise.all([loadList(), loadSheet()])
                    .then(([data]) => {
                      setMessages(data.messages || []);
                      setNextPage(data.nextPageToken);
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
                    .finally(() => setLoading(false));
                }}
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Actualiser
              </button>
            ) : (
              <button
                type="button"
                className="text-sm font-semibold text-brand-olive min-h-[44px] shrink-0"
                onClick={() => {
                  setSelected(null);
                  setSelectedFolder(null);
                }}
              >
                ← Liste
              </button>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {!selected && !detailLoading ? (
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-olive-soft flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-brand-olive" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-2xl leading-tight">Mail</h1>
                <p className="text-sm text-brand-gray mt-0.5">D’abord les demandes, les pubs en bas</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 space-y-2" role="alert">
              <p>{error}</p>
              {/GOOGLE_REFRESH_TOKEN|connecter|expir/i.test(error) ? (
                <Link to="/bureau/connexion-google" className="font-semibold underline text-brand-olive">
                  Connecter le compte asso
                </Link>
              ) : null}
            </div>
          ) : null}

          {selected || detailLoading ? (
            <div className="space-y-4">
              {detailLoading ? (
                <p className="text-brand-gray">Chargement du message…</p>
              ) : selected ? (
                <>
                  {selectedFolder && selectedFolder.messages.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedFolder.messages.map((m) => (
                        <button
                          key={m.item.id}
                          type="button"
                          onClick={() => void openMessage(m.item.id, selectedFolder)}
                          className={`min-h-[44px] px-3 rounded-xl text-sm font-semibold border ${
                            m.item.id === selected.id
                              ? 'bg-brand-olive text-white border-brand-olive'
                              : 'bg-white border-brand-gray-light'
                          }`}
                        >
                          {m.kind === 'enligne' ? PAIEMENT_NOM : m.kind === 'essai' ? 'Essai' : 'Demande'}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <article className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] p-4 space-y-3">
                    <h2 className="font-display font-bold text-lg leading-snug">{selected.subject}</h2>
                    <p className="text-sm text-brand-gray">
                      <span className="font-semibold text-brand-black">De :</span> {selected.from}
                    </p>
                    <p className="text-sm text-brand-gray">{formatListDate(selected.date, todayYmd)}</p>
                    <pre className="whitespace-pre-wrap font-body text-base text-brand-black leading-relaxed pt-3 border-t border-black/[0.06]">
                      {selected.text || '(Message sans texte lisible)'}
                    </pre>
                  </article>

                  {sentOk ? (
                    <p className="rounded-xl bg-brand-olive-soft text-brand-black text-sm font-semibold px-4 py-3">
                      Réponse envoyée.
                    </p>
                  ) : null}

                  <div className="space-y-3">
                    <label htmlFor="mail-reply" className="block font-semibold text-base">
                      Répondre
                    </label>
                    <textarea
                      id="mail-reply"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl ring-1 ring-black/10 bg-white px-4 py-3 text-base min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-olive"
                      placeholder="Votre réponse au nom de l’association…"
                    />
                    <button
                      type="button"
                      disabled={sending || !reply.trim()}
                      onClick={() => void sendReply()}
                      className="w-full min-h-[48px] rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-base disabled:opacity-50"
                    >
                      {sending ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Filtrer les messages"
                className="flex flex-wrap gap-1 rounded-2xl bg-black/[0.04] p-1"
              >
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(f.id)}
                      className={`min-h-[44px] px-3 rounded-xl text-sm font-semibold ${
                        active ? 'bg-white text-brand-black shadow-sm ring-1 ring-black/5' : 'text-slate-600 hover:text-brand-black'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {loading ? (
                <p className="text-brand-gray py-8 text-center">Chargement des messages…</p>
              ) : visibleFolders.length === 0 ? (
                <p className="text-brand-gray py-8 text-center text-base">Aucun message dans ce filtre</p>
              ) : (
                <ul className="space-y-2">{visibleFolders.map(renderFolderCard)}</ul>
              )}

              {nextPage ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="w-full min-h-[48px] rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold"
                >
                  {loadingMore ? 'Chargement…' : 'Messages suivants'}
                </button>
              ) : null}
            </>
          )}
        </main>

        {confirmFolder ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/40">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mail-mark-title"
              className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-xl"
            >
              <p id="mail-mark-title" className="font-semibold text-base text-brand-black leading-snug">
                Passer {confirmFolder.title} à jour sur la feuille Adhérents ?
              </p>
              <p className="text-sm text-brand-gray leading-snug">
                Avez-vous vu le paiement sur le relevé (ou reçu le chèque / les espèces) ?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={markingId === confirmFolder.id}
                  onClick={() => setConfirmFolder(null)}
                  className="flex-1 h-11 min-h-[44px] px-3 rounded-xl ring-1 ring-black/10 bg-white hover:bg-black/[0.03] font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={markingId === confirmFolder.id}
                  onClick={() => void markAJour(confirmFolder)}
                  className="flex-1 h-11 min-h-[44px] px-3 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60"
                >
                  {markingId === confirmFolder.id ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </BureauSeanceReserve>
    </BureauAuthGate>
  );
}
