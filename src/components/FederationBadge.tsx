import { ASSO, HAS_FEDERATION } from '../data/asso';

/** Badge d'affiliation fédérale (asso.config.js → federation). Rien si pas de fédération. */
export default function FederationBadge({ className = '' }: { className?: string }) {
  if (!HAS_FEDERATION) return null;
  const { nom, sigle, url, logo } = ASSO.federation;
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-center gap-4 py-6 px-4 ${className}`}
    >
      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0" title={nom}>
        <img
          src={logo}
          alt={`Logo ${nom}`}
          width="240"
          height="96"
          className="h-16 sm:h-20 w-auto max-w-[min(100%,320px)] object-contain"
          loading="lazy"
          decoding="async"
        />
      </a>
      <p className="font-body text-[13px] sm:text-[14px] text-brand-gray text-center sm:text-left leading-snug max-w-sm">
        Club affilié à la <strong className="text-brand-black">{sigle || nom}</strong>. {ASSO.adhesion.inclus[0]?.toUpperCase()}
        {ASSO.adhesion.inclus.slice(1)} dans la cotisation.
      </p>
    </div>
  );
}
