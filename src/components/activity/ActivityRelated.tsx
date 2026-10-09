import { Link } from 'react-router-dom';
import { ACTIVITY_PAGES } from '../../data/activityPages';

type Props = {
  currentSlug: string;
};

export default function ActivityRelated({ currentSlug }: Props) {
  return (
    <section className="bg-[#F8F7F4] py-10">
      <div className="content-max-width">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-brand-gray mb-4 text-center">
          Tous nos cours
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ACTIVITY_PAGES.map((ap) => (
            <Link
              key={ap.slug}
              to={`/${ap.slug}`}
              className={`font-body text-[13px] px-4 py-2 rounded-full border transition-all ${
                ap.slug === currentSlug
                  ? 'bg-orange-primary text-white border-orange-primary'
                  : 'text-brand-black border-black/15 hover:border-black/30'
              }`}
            >
              {ap.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
