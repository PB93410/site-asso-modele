import type { ReactNode } from 'react';

/** Grands champs, libellés clairs, erreurs sous le champ : pensé pour des bénévoles. */

const champClass =
  'w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[17px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/30 focus:border-slate-700';

export function Champ({
  label,
  aide,
  erreur,
  facultatif,
  htmlFor,
  children,
}: {
  label: string;
  aide?: ReactNode;
  erreur?: string;
  facultatif?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[16px] font-semibold text-slate-900">
        {label}
        {facultatif ? <span className="font-normal text-slate-500"> (facultatif)</span> : null}
      </label>
      {children}
      {aide ? <p className="text-[14px] text-slate-600 leading-snug">{aide}</p> : null}
      {erreur ? (
        <p role="alert" className="text-[14px] font-medium text-red-700">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

let auto = 0;
const idAuto = () => `champ-${++auto}`;

export function Texte({
  label,
  value,
  onChange,
  aide,
  erreur,
  facultatif,
  type = 'text',
  placeholder,
  inputMode,
  autoComplete,
  list,
  id,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  aide?: ReactNode;
  erreur?: string;
  facultatif?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
  list?: string;
  id?: string;
}) {
  const fid = id || idAuto();
  return (
    <Champ label={label} aide={aide} erreur={erreur} facultatif={facultatif} htmlFor={fid}>
      <input
        id={fid}
        className={`${champClass} ${erreur ? 'border-red-600' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        list={list}
        aria-invalid={erreur ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Champ>
  );
}

export function ZoneTexte({
  label,
  value,
  onChange,
  aide,
  facultatif,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  aide?: ReactNode;
  facultatif?: boolean;
  rows?: number;
}) {
  const fid = idAuto();
  return (
    <Champ label={label} aide={aide} facultatif={facultatif} htmlFor={fid}>
      <textarea id={fid} rows={rows} className={champClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Champ>
  );
}

export function Choix({
  label,
  value,
  onChange,
  options,
  erreur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  erreur?: string;
}) {
  const fid = idAuto();
  return (
    <Champ label={label} erreur={erreur} htmlFor={fid}>
      <select id={fid} className={champClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Champ>
  );
}

export function Case({
  label,
  aide,
  checked,
  onChange,
}: {
  label: ReactNode;
  aide?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex gap-3 items-start rounded-xl border border-slate-200 bg-white p-4 cursor-pointer has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
      <input
        type="checkbox"
        className="mt-1 w-5 h-5 accent-slate-800 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[17px] font-semibold text-slate-900">{label}</span>
        {aide ? <span className="block text-[15px] text-slate-600 mt-0.5 leading-snug">{aide}</span> : null}
      </span>
    </label>
  );
}

const variantes = {
  principal: 'bg-slate-900 text-white hover:bg-slate-700',
  secondaire: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
  discret: 'text-slate-700 underline underline-offset-4 hover:text-slate-950 px-1',
  danger: 'text-red-700 underline underline-offset-4 hover:text-red-900 px-1',
};

export function Bouton({
  variante = 'principal',
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof variantes }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl px-5 text-[16px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Encadre({ ton = 'info', children }: { ton?: 'info' | 'ok' | 'attention'; children: ReactNode }) {
  const t = {
    info: 'bg-slate-100 border-slate-200 text-slate-800',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    attention: 'bg-amber-50 border-amber-200 text-amber-900',
  }[ton];
  return <div className={`rounded-xl border p-4 text-[15px] leading-relaxed ${t}`}>{children}</div>;
}
