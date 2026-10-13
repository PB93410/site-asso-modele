import { useRef } from 'react';
import { MessageCircle, Sparkles, HelpCircle, UserPlus } from 'lucide-react';
import { WHATSAPP_TEMPLATES, waUrl } from '../data/siteData';
import { openWhatsApp } from '../lib/whatsapp';
import { WA_NOTICE } from './WhatsAppNotice';
import { ASSO, COURS_ESSAI_LABEL, ESSAIS_LABEL, TARIF_LABEL } from '../data/asso';

const intents = [
  {
    id: 'essai',
    title: 'Réserver un essai',
    description:
      `${ESSAIS_LABEL ? `${COURS_ESSAI_LABEL} gratuits, sans engagement. ` : ''}Indiquez le créneau qui vous intéresse.`,
    cta: 'WhatsApp — Essai gratuit',
    message: WHATSAPP_TEMPLATES.essai,
    Icon: Sparkles,
    iconWrap: 'bg-orange-primary/15 text-orange-primary',
    btn: 'bg-orange-primary',
  },
  {
    id: 'info',
    title: 'Poser une question',
    description:
      'Horaires, tarifs, lieux, niveau… une réponse rapide par message du lundi au samedi.',
    cta: 'WhatsApp — Question',
    message: WHATSAPP_TEMPLATES.question,
    Icon: HelpCircle,
    iconWrap: 'bg-brand-olive/15 text-brand-olive',
    btn: 'bg-brand-olive',
  },
  {
    id: 'inscription',
    title: 'S’inscrire / adhésion',
    description:
      `Informations sur l’adhésion ${TARIF_LABEL}/an (${ASSO.adhesion.inclus}) et les démarches.`,
    cta: 'WhatsApp — Inscription',
    message: WHATSAPP_TEMPLATES.inscription,
    Icon: UserPlus,
    iconWrap: 'bg-blue-600/15 text-blue-600',
    btn: 'bg-blue-600',
  },
] as const;

export default function ContactWhatsApp() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="rounded-panel border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle size={18} className="text-brand-olive" />
          <p className="font-display font-bold text-[18px] text-white">
            Contactez-nous sur WhatsApp
          </p>
        </div>
        <p className="font-body text-[14px] text-brand-gray leading-relaxed">
          Pas de formulaire sur le site : choisissez votre demande ci-dessous.
          Le message est déjà prérempli pour aller plus vite — vous n’avez plus
          qu’à compléter et envoyer. Un membre du bureau vous répond dès que possible.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {intents.map(({ id, title, description, cta, message, Icon, iconWrap, btn }) => {
          const url = waUrl(message);
          return (
            <button
              key={id}
              type="button"
              onClick={() => openWhatsApp(url, 'Ouverture de WhatsApp…')}
              className="text-left rounded-panel border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-orange-primary/35 hover:bg-white/[0.04] group"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconWrap}`}
              >
                <Icon size={20} />
              </div>
              <h3 className="font-display font-bold text-[17px] text-white mb-2">
                {title}
              </h3>
              <p className="font-body text-[13px] text-brand-gray leading-relaxed mb-5">
                {description}
              </p>
              <span
                className={`inline-flex items-center gap-2 font-body font-semibold text-[13px] text-white px-3.5 py-2 rounded-full transition-opacity group-hover:opacity-95 ${btn}`}
              >
                <MessageCircle size={14} />
                {cta}
              </span>
              <p className="font-body text-[10px] text-brand-gray/70 mt-3 leading-snug">
                {WA_NOTICE}
              </p>
            </button>
          );
        })}
      </div>

      <p className="font-body text-[12px] text-brand-gray/80 text-center pt-1">
        WhatsApp s’ouvre dans un nouvel onglet · Réponse du lundi au samedi · {WA_NOTICE}
      </p>
    </div>
  );
}
