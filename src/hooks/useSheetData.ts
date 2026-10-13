import { useState, useEffect, useRef } from 'react';
import * as siteData from '../data/siteData';
import { SHEET_CSV, GOOGLE_SHEET_URL } from '../data/CONFIG';
import { eventKey, isPastEvent } from '../lib/events';

function sheetUrl(kind: keyof typeof SHEET_CSV): string {
  const specific = (SHEET_CSV?.[kind] || '').trim();
  if (specific) return specific;
  const base = (GOOGLE_SHEET_URL || '').trim();
  if (!base) return '';
  const gidMap = { coachs: 0, evenements: 1, planning: 3 } as const;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}gid=${gidMap[kind]}`;
}

function withCacheBust(url: string): string {
  if (!url) return url;
  if (url.startsWith('/') && !url.startsWith('/api/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}`;
}

async function fetchCsv(url: string): Promise<string> {
  const response = await fetch(withCacheBust(url), {
    method: 'GET',
    cache: 'no-store',
    mode: 'cors',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — vérifiez la publication CSV`);
  }
  let text = await response.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const head = text.slice(0, 400).toLowerCase();
  if (
    head.includes('<!doctype') ||
    head.includes('<html') ||
    head.includes('<head') ||
    head.includes('content-security-policy')
  ) {
    throw new Error(
      'Réponse HTML au lieu de CSV (proxy ou publication Sheet). Vérifier /api/sheet/planning'
    );
  }
  return text;
}

function useSheetResource<T>(
  kind: keyof typeof SHEET_CSV,
  fallback: T[],
  parse: (csv: string) => T[]
) {
  const [data, setData] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(false);
  const [fromSheet, setFromSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fonction de lecture fixe par ressource : gardée hors des dépendances, sans recharger.
  const parseRef = useRef(parse);
  useEffect(() => {
    parseRef.current = parse;
  });

  useEffect(() => {
    const url = sheetUrl(kind);
    if (!url) {
      console.info(`[SheetData] ${kind}: aucune URL dans CONFIG (données locales)`);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        console.info(`[SheetData] ${kind}: chargement…`, url.slice(0, 80) + '…');
        const csv = await fetchCsv(url);
        const parsed = parseRef.current(csv);
        if (cancelled) return;
        if (parsed.length > 0) {
          setData(parsed);
          setFromSheet(true);
          console.info(`[SheetData] ${kind}: OK — ${parsed.length} ligne(s)`);
        } else {
          const msg = 'CSV vide ou colonnes non reconnues (vérifier la ligne d’en-tête)';
          setError(msg);
          console.warn(`[SheetData] ${kind}: ${msg}`);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.warn(`[SheetData] ${kind}:`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { data, loading, fromSheet, error };
}

export function useCoachsFromSheet() {
  return {
    coachs: siteData.COACHS,
    loading: false,
    fromSheet: false,
    error: null as string | null,
  };
}

export function useEventsFromSheet() {
  const { data, loading, fromSheet, error } = useSheetResource(
    'evenements',
    siteData.EVENTS,
    parseEventCSV
  );
  const localByTitle = new Map(
    siteData.EVENTS.map((e) => [eventKey(e.title), e])
  );
  const titles = new Set<string>();
  const merged = data.map((e) => {
    const key = eventKey(e.title);
    titles.add(key);
    const local = localByTitle.get(key);
    if (!local) return e;
    return {
      ...e,
      logo: e.logo || local.logo,
      link: e.link || local.link,
      image: e.image || local.image,
      type: e.type || local.type,
    };
  });
  for (const local of siteData.EVENTS) {
    const key = eventKey(local.title);
    if (key && !titles.has(key)) {
      merged.unshift(local);
      titles.add(key);
    }
  }
  return { events: merged.filter((e) => !isPastEvent(e)), loading, fromSheet, error };
}

export { isPastEvent };

function dedupeSchedule(rows: siteData.ScheduleRow[]) {
  const seen = new Set<string>();
  const out: siteData.ScheduleRow[] = [];
  for (const row of rows) {
    const k = `${(row.day || '').toLowerCase()}|${(row.time || '').toLowerCase()}|${(row.course || '').toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

export function useScheduleFromSheet() {
  const { data, loading, fromSheet, error } = useSheetResource(
    'planning',
    siteData.SCHEDULE,
    parseScheduleCSV
  );
  const localByCourse = new Map(
    siteData.SCHEDULE.filter((s) => s.note).map((s) => [
      `${(s.day || '').toLowerCase()}|${(s.course || '').toLowerCase()}`,
      s.note,
    ])
  );
  const cleaned = data;
  const schedule = fromSheet
    ? cleaned
    : cleaned.map((row) => {
        if (row.note) return row;
        const key = `${(row.day || '').toLowerCase()}|${(row.course || '').toLowerCase()}`;
        const note = localByCourse.get(key);
        return note ? { ...row, note } : row;
      });
  return { schedule: dedupeSchedule(schedule), loading, fromSheet, error };
}

function splitLines(csv: string): string[] {
  return csv
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let s = line;
      if (s.startsWith('"') && s.endsWith('"') && s.includes(',')) {
        const inner = s.slice(1, -1);
        if (!inner.includes('","')) {
          s = inner.replace(/""/g, '"');
        }
      }
      return s;
    });
}

function detectSep(headerLine: string): ',' | ';' {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi > comma ? ';' : ',';
}

function parseCSVLine(line: string, sep: ',' | ';' = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  let cols = result.map((c) => c.trim());
  if (cols.length === 1 && cols[0].includes(sep)) {
    cols = cols[0].split(sep).map((c) => c.trim());
  }
  return cols;
}

function inferEventType(title: string, explicit?: string): siteData.Event['type'] {
  const t = (explicit || '').toLowerCase().trim();
  if (t === 'administratif' || t === 'festif' || t === 'sportif' || t === 'caritatif' || t === 'sortie') {
    return t;
  }
  const titleL = (title || '').toLowerCase();
  if (titleL.includes('téléthon') || titleL.includes('telethon')) return 'caritatif';
  if (titleL.includes('party') || titleL.includes('noël') || titleL.includes('noel') || titleL.includes('fête') || titleL.includes('fete')) return 'festif';
  if (titleL.includes('stage')) return 'sportif';
  if (titleL.includes('sortie') || titleL.includes('voyage')) return 'sortie';
  if (titleL.includes('forum') || titleL.includes('inscription')) return 'administratif';
  return 'administratif';
}

export function parseEventCSV(csv: string): siteData.Event[] {
  const lines = splitLines(csv);
  if (lines.length < 2) return [];
  const sep = detectSep(lines[0]);
  const result: siteData.Event[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], sep);
    if (!cols[3] && !cols[0]) continue;
    const title = cols[3] || '';
    const image = cols[8] || undefined;
    const logo: string | undefined = undefined;
    result.push({
      id: String(i),
      date: cols[0] || '',
      month: cols[1] || '',
      year: cols[2] || '',
      title,
      description: cols[4] || '',
      time: cols[5] || '',
      location: cols[6] || '',
      highlight: (cols[7] || '').toLowerCase() === 'true',
      image,
      logo,
      type: inferEventType(title, cols[9]),
      link: undefined,
    });
  }
  return result;
}

function parseScheduleCSV(csv: string): siteData.ScheduleRow[] {
  const lines = splitLines(csv);
  if (lines.length < 2) return [];
  const sep = detectSep(lines[0]);
  const result: siteData.ScheduleRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/[<>]|doctype|content-security|meta charset/i.test(line)) continue;
    const cols = parseCSVLine(line, sep);
    if (!cols[0] && !cols[2]) continue;
    if (cols[0]?.toLowerCase() === 'day' || cols[0]?.toLowerCase() === 'jour') continue;
    const day = (cols[0] || '').toLowerCase();
    if (day && !/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(day)) continue;
    const rawNote = cols[4] || '';
    result.push({
      day: cols[0] || '',
      time: cols[1] || '',
      course: cols[2] || '',
      location: cols[3] || '',
      note: rawNote,
    });
  }
  return dedupeSchedule(result);
}

export function exportCoachCSV(): string {
  let csv = 'name,specialties,bio,image\n';
  siteData.COACHS.forEach((c) => {
    csv += `"${c.name}","${c.specialties.join(';')}","${c.bio.replace(/"/g, '""')}","${c.image}"\n`;
  });
  return csv;
}

export function exportEventCSV(): string {
  let csv = 'date,month,year,title,description,time,location,highlight,image,type\n';
  siteData.EVENTS.forEach((e) => {
    csv += `"${e.date}","${e.month}","${e.year}","${e.title}","${(e.description || '').replace(/"/g, '""')}","${e.time}","${e.location}","${e.highlight ? 'true' : ''}","${e.image || ''}","${e.type || 'administratif'}"\n`;
  });
  return csv;
}

export function exportScheduleCSV(): string {
  let csv = 'day,time,course,location,note\n';
  siteData.SCHEDULE.forEach((s) => {
    csv += `"${s.day}","${s.time}","${s.course}","${s.location}","${s.note}"\n`;
  });
  return csv;
}
