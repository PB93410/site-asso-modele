import { useState } from 'react';
import { Plus } from 'lucide-react';
import { faqs, type FaqItem } from '../data/faqData';
import { buildSiteFaqSchema } from '../lib/schema';
import { ASSO } from '../data/asso';

function AccordionItem({
  question,
  answer,
  popular,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  popular?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-brand-olive/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 md:py-6 text-left group min-h-[48px]"
        aria-expanded={isOpen}
      >
        <span className="font-body font-medium text-[16px] md:text-[17px] text-brand-black pr-4 flex items-center gap-2 flex-wrap leading-snug">
          {question}
          {popular && (
            <span className="inline-block font-mono text-[9px] tracking-wider uppercase bg-brand-olive text-white px-2 py-0.5 rounded-full">
              Populaire
            </span>
          )}
        </span>
        <Plus
          size={22}
          className={`text-brand-gray shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : 'group-hover:rotate-90'}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="font-body text-[16px] md:text-[17px] text-brand-gray leading-relaxed pb-6">{answer}</p>
      </div>
    </div>
  );
}

type Props = {
  /** JSON-LD FAQPage — uniquement sur /faq (pas en extrait accueil). */
  withSchema?: boolean;
};

export default function FAQSection({ withSchema = true }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqSchema = buildSiteFaqSchema();

  return (
    <section id="faq" className="bg-brand-olive-soft/60 section-padding">
      {withSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}
      <div className="content-max-width max-w-[800px] mx-auto">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-brand-olive mb-3">FAQ</p>
        <h1
          className="font-display font-black text-brand-black leading-[1] tracking-[-0.5px] mb-10 text-title"
        >
          Questions fréquentes à {ASSO.ville}
        </h1>

        <div>
          {faqs.map((faq: FaqItem, i: number) => (
            <div key={faq.question} className="faq-item">
              <AccordionItem
                question={faq.question}
                answer={faq.answer}
                popular={faq.popular}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { faqs };
