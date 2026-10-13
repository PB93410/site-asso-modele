import { useState } from 'react';
import type { Dossier } from '../../src/lib/dossier.js';
import {
  CHAMPS_ADHERENTS,
  CHAMPS_PLANNING,
  creneauxDepuisLignes,
  detecterGenre,
  enTetesEtLignes,
  estExcel,
  fichesDepuisLignes,
  correspondanceAdherents,
  correspondancePlanning,
  integrerAdherents,
  integrerPlanning,
  tableauxDepuisOctets,
  type GenreTableau,
  type MappingColonnes,
} from '../../src/lib/import-existant.js';
import { Bouton, Champ, Choix, Encadre } from './ui';

type OngletLu = {
  nom: string;
  lignes: string[][];
  genre: GenreTableau;
  mapping: MappingColonnes;
};

export function ImportExistant({
  d,
  onDossier,
  variante = 'complet',
}: {
  d: Dossier;
  onDossier: (next: Dossier) => void;
  variante?: 'complet' | 'planning';
}) {
  const [onglets, setOnglets] = useState<OngletLu[]>([]);
  const [fichier, setFichier] = useState('');
  const [msg, setMsg] = useState('');
  const [ton, setTon] = useState<'info' | 'ok' | 'attention'>('info');
  const [remplacer, setRemplacer] = useState(!d.planning.length);

  async function ouvrir(file?: File) {
    if (!file) return;
    setMsg('');
    setOnglets([]);
    setFichier(file.name);
    if (/\.xls$/i.test(file.name) && !estExcel(file.name)) {
      setTon('attention');
      setMsg('L’ancien format Excel (.xls) n’est pas lu. Dans Excel : Fichier → Enregistrer sous → Classeur Excel (.xlsx) ou CSV.');
      return;
    }
    try {
      const octets = new Uint8Array(await file.arrayBuffer());
      const tabs = await tableauxDepuisOctets(octets, file.name);
      const lus: OngletLu[] = tabs
        .filter((t) => (t.lignes || []).some((l) => l.some((c) => String(c || '').trim())))
        .map((t) => {
          const { enTetes } = enTetesEtLignes(t.lignes);
          let genre = detecterGenre(enTetes);
          if (variante === 'planning' && genre !== 'planning') genre = 'planning';
          const mapping = genre === 'adherents' ? correspondanceAdherents(enTetes) : correspondancePlanning(enTetes);
          return { nom: t.nom, lignes: t.lignes, genre, mapping };
        });
      if (!lus.length) {
        setTon('attention');
        setMsg('Aucune ligne lisible dans ce fichier.');
        return;
      }
      setOnglets(lus);
    } catch (e) {
      setTon('attention');
      setMsg(e instanceof Error ? e.message : 'Fichier illisible.');
    }
  }

  function majOnglet(i: number, patch: Partial<OngletLu>) {
    setOnglets((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  function integrer(i: number) {
    const o = onglets[i];
    if (o.genre === 'adherents') {
      const fiches = fichesDepuisLignes(o.lignes, o.mapping);
      if (!fiches.length) {
        setTon('attention');
        setMsg('Aucune fiche avec un nom, un prénom, un mail ou un téléphone. Vérifiez la correspondance des colonnes.');
        return;
      }
      onDossier(integrerAdherents(d, fiches, fichier));
      setTon('ok');
      setMsg(
        `${fiches.length} adhérent(s) gardés dans le dossier. Ils iront dans l’espace bénévoles, pas sur le site public, et ne seront jamais mis dans le dépôt.`,
      );
      return;
    }
    const creneaux = creneauxDepuisLignes(o.lignes, o.mapping);
    if (!creneaux.length) {
      setTon('attention');
      setMsg('Aucun créneau lu. Indiquez au moins le jour, l’heure et le cours.');
      return;
    }
    onDossier(integrerPlanning(d, creneaux, { remplacer }));
    setTon('ok');
    setMsg(`${creneaux.length} créneau(x) ajouté(s) aux horaires. Les noms de cours inconnus ont été créés : relisez-les à l’étape « Cours et horaires ».`);
  }

  const nbAdh = d.adherentsImport?.fiches?.length || 0;

  return (
    <div className="space-y-4">
      <Champ
        label={variante === 'planning' ? 'Importer un planning (Excel ou CSV)' : 'Vous avez déjà un fichier ?'}
        aide={
          variante === 'planning'
            ? 'Un tableau avec le jour, l’heure, le cours et la salle. Vous vérifiez les colonnes avant d’intégrer.'
            : 'Planning de la semaine et/ou liste d’adhérents, en Excel (.xlsx) ou CSV. Vous vérifiez les colonnes, puis vous intégrez.'
        }
      >
        <input
          type="file"
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-[16px] file:min-h-[44px] file:mr-3 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-4 file:font-semibold"
          onChange={(e) => void ouvrir(e.target.files?.[0])}
        />
      </Champ>
      {nbAdh && variante === 'complet' ? (
        <p className="text-[15px] text-slate-700">
          {nbAdh} adhérent(s) déjà dans le dossier
          {d.adherentsImport.source ? ` (fichier « ${d.adherentsImport.source} »)` : ''}. Un nouvel import remplace cette liste.
        </p>
      ) : null}
      {msg ? <Encadre ton={ton}>{msg}</Encadre> : null}
      {onglets.map((o, i) => (
        <FeuilleClef
          key={`${o.nom}-${i}`}
          onglet={o}
          variante={variante}
          remplacer={remplacer}
          onRemplacer={setRemplacer}
          aDejaPlanning={d.planning.length > 0}
          onGenre={(genre) =>
            majOnglet(i, {
              genre,
              mapping: genre === 'adherents' ? correspondanceAdherents(enTetesEtLignes(o.lignes).enTetes) : correspondancePlanning(enTetesEtLignes(o.lignes).enTetes),
            })
          }
          onMapping={(mapping) => majOnglet(i, { mapping })}
          onIntegrer={() => integrer(i)}
        />
      ))}
    </div>
  );
}

function FeuilleClef({
  onglet,
  variante,
  remplacer,
  onRemplacer,
  aDejaPlanning,
  onGenre,
  onMapping,
  onIntegrer,
}: {
  onglet: OngletLu;
  variante: 'complet' | 'planning';
  remplacer: boolean;
  onRemplacer: (v: boolean) => void;
  aDejaPlanning: boolean;
  onGenre: (g: GenreTableau) => void;
  onMapping: (m: MappingColonnes) => void;
  onIntegrer: () => void;
}) {
  const { enTetes, corps } = enTetesEtLignes(onglet.lignes);
  const champs = onglet.genre === 'adherents' ? CHAMPS_ADHERENTS : CHAMPS_PLANNING;
  const options = [{ value: '', label: '— (ignorer)' }, ...enTetes.filter(Boolean).map((h) => ({ value: h, label: h }))];
  const apercu = corps.slice(0, 3);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <p className="font-semibold text-[16px]">{onglet.nom}</p>
      {variante === 'complet' ? (
        <Choix
          label="Ce tableau contient"
          value={onglet.genre === 'inconnu' ? 'planning' : onglet.genre}
          onChange={(v) => onGenre(v as GenreTableau)}
          options={[
            { value: 'planning', label: 'Le planning (jours, heures, cours)' },
            { value: 'adherents', label: 'La liste des adhérents' },
          ]}
        />
      ) : null}
      <div className="grid sm:grid-cols-2 gap-3">
        {champs.map((c) => (
          <Choix
            key={c.id}
            label={c.label}
            value={onglet.mapping[c.id] || ''}
            onChange={(v) => onMapping({ ...onglet.mapping, [c.id]: v })}
            options={options}
          />
        ))}
      </div>
      {apercu.length ? (
        <div className="overflow-x-auto">
          <p className="text-[14px] font-medium text-slate-600 mb-1">Aperçu (3 premières lignes)</p>
          <table className="text-[13px] border-collapse min-w-full">
            <thead>
              <tr>
                {enTetes.map((h) => (
                  <th key={h} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">
                    {h || '—'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apercu.map((l, i) => (
                <tr key={i}>
                  {enTetes.map((_, j) => (
                    <td key={j} className="border border-slate-200 px-2 py-1">
                      {String(l[j] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {onglet.genre !== 'adherents' && aDejaPlanning ? (
        <label className="flex items-start gap-3 text-[16px]">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5 accent-slate-800"
            checked={remplacer}
            onChange={(e) => onRemplacer(e.target.checked)}
          />
          <span>Remplacer les horaires déjà saisis (sinon, on ajoute à la suite)</span>
        </label>
      ) : null}
      {onglet.genre === 'adherents' ? (
        <Encadre ton="attention">
          Cette liste contient des noms. Elle reste dans ce navigateur et dans le dossier envoyé. Elle n’apparaît pas sur le site, et
          elle ne doit pas être copiée dans le dépôt du site.
        </Encadre>
      ) : null}
      <Bouton onClick={onIntegrer}>Intégrer ce tableau</Bouton>
    </div>
  );
}
