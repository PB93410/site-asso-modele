import { useState } from 'react';
import type { Dossier } from '../../src/lib/dossier.js';
import {
  CHAMPS_PLANNING,
  creneauxDepuisLignes,
  detecterGenre,
  enTetesEtLignes,
  estExcel,
  correspondancePlanning,
  integrerPlanning,
  tableauxDepuisOctets,
  type MappingColonnes,
} from '../../src/lib/import-existant.js';
import { Bouton, Champ, Choix, Encadre } from './ui';

type OngletLu = {
  nom: string;
  lignes: string[][];
  mapping: MappingColonnes;
};

/** Une liste d'adhérents ne passe pas par le questionnaire : ni gardée, ni affichée, ni envoyée. */
const LISTE_REFUSEE =
  'ressemble à une liste de personnes (noms, téléphones ou e-mails). Elle n’est pas reprise ici : ne l’envoyez pas avec le dossier. Gardez-la : une fois le site en place, votre référent la reprendra avec vous dans l’espace bénévoles.';

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
  const [msg, setMsg] = useState('');
  const [ton, setTon] = useState<'info' | 'ok' | 'attention'>('info');
  const [remplacer, setRemplacer] = useState(!d.planning.length);

  async function ouvrir(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setMsg('');
    setOnglets([]);
    if (/\.xls$/i.test(file.name) && !estExcel(file.name)) {
      setTon('attention');
      setMsg('L’ancien format Excel (.xls) n’est pas lu. Dans Excel : Fichier → Enregistrer sous → Classeur Excel (.xlsx) ou CSV.');
      return;
    }
    try {
      const octets = new Uint8Array(await file.arrayBuffer());
      const tabs = (await tableauxDepuisOctets(octets, file.name)).filter((t) =>
        (t.lignes || []).some((l) => l.some((c) => String(c || '').trim())),
      );
      const refuses: string[] = [];
      const lus: OngletLu[] = [];
      for (const t of tabs) {
        const { enTetes } = enTetesEtLignes(t.lignes);
        if (detecterGenre(enTetes) === 'adherents') refuses.push(t.nom);
        else lus.push({ nom: t.nom, lignes: t.lignes, mapping: correspondancePlanning(enTetes) });
      }
      if (refuses.length) {
        input.value = '';
        setTon('attention');
        setMsg(`${refuses.length > 1 ? `Les onglets « ${refuses.join(' », « ')} »` : `« ${refuses[0]} »`} ${LISTE_REFUSEE}`);
      } else if (!lus.length) {
        setTon('attention');
        setMsg('Aucune ligne lisible dans ce fichier.');
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

  return (
    <div className="space-y-4">
      <Champ
        label={variante === 'planning' ? 'Importer un planning (Excel ou CSV)' : 'Vous avez déjà votre planning dans un fichier ?'}
        aide="Un tableau avec le jour, l’heure, le cours et la salle, en Excel (.xlsx) ou CSV. Vous vérifiez les colonnes avant d’intégrer. Pas de liste d’adhérents ici."
      >
        <input
          type="file"
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-[16px] file:min-h-[44px] file:mr-3 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-4 file:font-semibold"
          onChange={(e) => void ouvrir(e.target)}
        />
      </Champ>
      {msg ? <Encadre ton={ton}>{msg}</Encadre> : null}
      {onglets.map((o, i) => (
        <FeuilleClef
          key={`${o.nom}-${i}`}
          onglet={o}
          remplacer={remplacer}
          onRemplacer={setRemplacer}
          aDejaPlanning={d.planning.length > 0}
          onMapping={(mapping) => majOnglet(i, { mapping })}
          onIntegrer={() => integrer(i)}
        />
      ))}
    </div>
  );
}

function FeuilleClef({
  onglet,
  remplacer,
  onRemplacer,
  aDejaPlanning,
  onMapping,
  onIntegrer,
}: {
  onglet: OngletLu;
  remplacer: boolean;
  onRemplacer: (v: boolean) => void;
  aDejaPlanning: boolean;
  onMapping: (m: MappingColonnes) => void;
  onIntegrer: () => void;
}) {
  const { enTetes, corps } = enTetesEtLignes(onglet.lignes);
  const options = [{ value: '', label: '— (ignorer)' }, ...enTetes.filter(Boolean).map((h) => ({ value: h, label: h }))];
  const apercu = corps.slice(0, 3);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <p className="font-semibold text-[16px]">{onglet.nom}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {CHAMPS_PLANNING.map((c) => (
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
      {aDejaPlanning ? (
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
      <Bouton onClick={onIntegrer}>Intégrer ce tableau</Bouton>
    </div>
  );
}
