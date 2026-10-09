import { Link } from 'react-router-dom';
import { ACTIVITY_PAGES } from '../../data/activityPages';

const INTENTS: { label: string; courses: string[] }[] = [
  { label: 'Vous voulez aussi bouger en musique ?', courses: ['Zumba', 'Cardio & Gym'] },
  { label: 'Vous voulez aussi vous renforcer ?', courses: ['Renforcement Musculaire', 'Pilates'] },
  { label: 'Vous voulez aussi vous détendre ?', courses: ['Stretching', 'Pilates'] },
  { label: 'Vous voulez aussi reprendre en douceur ?', courses: ['Gym Douce', 'Stretching', 'Pilates'] },
];

type Props = { currentName: string };

export default function ActivityIntentLinks({ currentName }: Props) {
  const lines = INTENTS.map((intent) => {
    if (!intent.courses.includes(currentName)) return null;
    const others = intent.courses
      .filter((name) => name !== currentName)
      .map((name) => ACTIVITY_PAGES.find((p) => p.name === name))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (others.length === 0) return null;
    return { label: intent.label, others };
  }).filter((x): x is { label: string; others: typeof ACTIVITY_PAGES } => Boolean(x));

  if (lines.length === 0) return null;

  return (
    <section className="bg-[#F8F7F4] py-10 md:py-12" aria-labelledby="intentions-titre">
      <div className="content-max-width max-w-[720px]">
        <p
          id="intentions-titre"
          className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3"
        >
          Autres cours
        </p>
        <h2 className="font-display font-black text-[22px] md:text-[26px] text-brand-black mb-5">
          Vous cherchez aussi à…
        </h2>
        <ul className="space-y-4">
          {lines.map((line) => (
            <li key={line.label}>
              <p className="font-body text-[15px] text-brand-gray mb-2">{line.label}</p>
              <div className="flex flex-wrap gap-2">
                {line.others.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/${p.slug}`}
                    className="inline-flex items-center min-h-[44px] px-4 rounded-full bg-white border border-black/10 font-body font-semibold text-[14px] text-brand-black hover:border-orange-primary/40"
                  >
                    {p.name} →
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
