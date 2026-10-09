import { formatTelFr } from '../../lib/bureauSearch';
import { PersonNameButton } from './BureauPersonSheet';

type AdhesionItem = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  statut: string;
};

type Props = {
  todayLabel: string;
  qPeople: string;
  loading: boolean;
  adhesionList: AdhesionItem[];
  aPointer: number;
  aConfirmer: number;
  aEncaisser: number;
  relanceP1: number;
  relanceP2: number;
  onPointer: () => void;
  onConfirmer: () => void;
  onEncaisser: () => void;
  onRelances: () => void;
  onOpenPerson: (tel: string, prenom: string) => void;
};

function DayTile({
  count,
  label,
  onClick,
  wide,
}: {
  count: number;
  label: string;
  onClick: () => void;
  wide?: boolean;
}) {
  const empty = count === 0;
  const className = `rounded-2xl border p-4 text-left min-h-[88px] ${wide ? 'col-span-2' : ''} ${
    empty
      ? 'bg-[#F3F1EC] border-black/5 text-brand-gray'
      : 'bg-white border-black/10'
  }`;
  const inner = (
    <>
      <p className={`text-3xl font-display font-bold ${empty ? 'text-brand-gray' : 'text-brand-olive'}`}>
        {count}
      </p>
      <p className="text-base mt-1">{label}</p>
    </>
  );
  if (empty) {
    return (
      <div className={className} aria-disabled="true">
        {inner}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default function BureauTodayTab({
  todayLabel,
  qPeople,
  loading,
  adhesionList,
  aPointer,
  aConfirmer,
  aEncaisser,
  relanceP1,
  relanceP2,
  onPointer,
  onConfirmer,
  onEncaisser,
  onRelances,
  onOpenPerson,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-xl text-brand-black capitalize">{todayLabel}</h2>
        <p className="text-base text-brand-gray mt-1">À faire aujourd’hui.</p>
      </div>
      {qPeople ? (
        <div className="space-y-2">
          <p className="text-base font-medium text-brand-black">Recherche</p>
          {adhesionList.length === 0 && !loading ? (
            <p className="text-base text-brand-gray rounded-2xl bg-white border border-black/10 px-4 py-6 text-center">
              Personne avec ce nom ou ce numéro
            </p>
          ) : null}
          {adhesionList.map((item) => (
            <div
              key={`adh-${item.row}`}
              className="w-full text-left rounded-2xl bg-white border border-black/10 p-4 min-h-[48px]"
            >
              <p className="font-semibold text-base text-brand-black">
                <PersonNameButton prenom={item.prenom} nom={item.nom} tel={item.tel} onOpen={onOpenPerson} />
              </p>
              <p className="text-base text-brand-gray">
                Adhésion · {item.statut || 'en attente'}
                {formatTelFr(item.tel) ? ` · ${formatTelFr(item.tel)}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <DayTile count={aPointer} label="À pointer" onClick={onPointer} />
          <DayTile count={aConfirmer} label="À confirmer" onClick={onConfirmer} />
          <DayTile count={aEncaisser} label="À encaisser" onClick={onEncaisser} />
          <DayTile count={relanceP1} label="Relances P1" onClick={onRelances} />
          <DayTile count={relanceP2} label="Relances P2" onClick={onRelances} wide />
        </div>
      )}
    </div>
  );
}
