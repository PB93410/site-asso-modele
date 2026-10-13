/** Accueil du bureau : cartes « en un coup d'œil ». Logique pure, testée. */

export type ApercuCible =
  | { tab: 'adhesions' | 'essais' }
  | { href: string };

export type ApercuCarte = {
  id: 'essais' | 'paiements' | 'coursPleins' | 'presences' | 'adherents';
  label: string;
  aide: string;
  /** null = donnée pas encore chargée. */
  compte: number | null;
  cible: ApercuCible;
  /** Mise en avant (quelque chose à faire). */
  urgent: boolean;
};

type Ligne = { STATUT?: string; COURS?: string; TYPE?: string; CRENEAU?: string };

/** Cours (ou créneaux) avec au moins une personne en file : complets ou presque. */
export function coursPresquePleins(files: Ligne[]): string[] {
  const set = new Map<string, string>();
  for (const l of files || []) {
    const statut = String(l.STATUT || '').trim();
    if (statut !== 'attente' && statut !== 'notifie') continue;
    const cours = String(l.COURS || '').trim();
    if (!cours) continue;
    const libelle = l.CRENEAU ? `${cours} (${String(l.CRENEAU).trim()})` : cours;
    set.set(libelle.toLowerCase(), libelle);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Adhérents à jour, hors lignes de test, sans doublon nom+prénom. */
export function adherentsTotal(items: { prenom: string; nom: string; statut: string }[]): number {
  const vus = new Set<string>();
  for (const i of items || []) {
    if (String(i.statut || '').trim() !== 'À jour') continue;
    if (/^test$/i.test(String(i.prenom || '').trim()) || /^test$/i.test(String(i.nom || '').trim())) continue;
    vus.add(`${String(i.prenom).trim().toLowerCase()}|${String(i.nom).trim().toLowerCase()}`);
  }
  return vus.size;
}

function pluriel(n: number, un: string, plusieurs: string) {
  return n > 1 ? plusieurs : un;
}

export function cartesApercu(
  donnees: {
    essaisARappeler: number | null;
    paiementsEnAttente: number | null;
    coursPleins: string[] | null;
    presencesSemaine: number | null;
    adherents: number | null;
  },
  modules: { listeAttente?: boolean; presences?: boolean },
): ApercuCarte[] {
  const n = (v: number | null) => (v === null ? 0 : v);
  const cartes: ApercuCarte[] = [
    {
      id: 'essais',
      label: 'Essais à rappeler',
      aide: n(donnees.essaisARappeler)
        ? pluriel(n(donnees.essaisARappeler), 'Une demande d’essai à rappeler', 'Demandes d’essai à rappeler')
        : 'Aucune demande en attente',
      compte: donnees.essaisARappeler,
      cible: { tab: 'essais' },
      urgent: n(donnees.essaisARappeler) > 0,
    },
    {
      id: 'paiements',
      label: 'Paiements en attente',
      aide: n(donnees.paiementsEnAttente) ? 'À encaisser ou à pointer' : 'Tout est encaissé',
      compte: donnees.paiementsEnAttente,
      cible: { tab: 'adhesions' },
      urgent: n(donnees.paiementsEnAttente) > 0,
    },
  ];
  if (modules.listeAttente) {
    const c = donnees.coursPleins;
    cartes.push({
      id: 'coursPleins',
      label: 'Cours presque pleins',
      aide: c && c.length ? c.slice(0, 2).join(', ') + (c.length > 2 ? '…' : '') : 'Aucune file d’attente',
      compte: c === null ? null : c.length,
      cible: { href: '/bureau/liste-attente' },
      urgent: Boolean(c && c.length),
    });
  }
  if (modules.presences) {
    cartes.push({
      id: 'presences',
      label: 'Présences de la semaine',
      aide: 'Pointages depuis lundi',
      compte: donnees.presencesSemaine,
      cible: { href: '/bureau/presences' },
      urgent: false,
    });
  }
  cartes.push({
    id: 'adherents',
    label: 'Adhérents',
    aide: 'À jour de cotisation',
    compte: donnees.adherents,
    cible: { tab: 'adhesions' },
    urgent: false,
  });
  return cartes;
}

/** Lundi et dimanche de la semaine d'un jour AAAA-MM-JJ. */
export function semaineYmd(ymd: string): { lundi: string; dimanche: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const jour = (new Date(t).getUTCDay() + 6) % 7; // lundi = 0
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { lundi: iso(t - jour * 86400000), dimanche: iso(t + (6 - jour) * 86400000) };
}
