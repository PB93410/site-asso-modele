import { useRef } from 'react';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { SITE_CONFIG, WHATSAPP_TEMPLATES, waUrl } from '../data/siteData';
import { ASSO, TEL_INTL } from '../data/asso';

export default function ContactSection() {
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <section id="contact" className="bg-brand-black section-padding !py-10 md:!py-12">
      <div className="content-max-width">
        <div ref={headerRef} className="text-center mb-8">
          <h2 className="font-display font-black text-white leading-[1.05] text-title">
            Une question&nbsp;?
          </h2>
          <p className="font-body text-[16px] text-white/60 mt-4 max-w-[520px] mx-auto">
            Le {ASSO.telephone}{ASSO.whatsapp ? ', WhatsApp' : ''}, ou le formulaire d'essai.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <a
            href={`mailto:${ASSO.email}`}
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-all duration-300 hover:border-orange-primary/30 hover:bg-white/[0.04]"
          >
            <div className="w-12 h-12 rounded-full bg-orange-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-primary/20 transition-colors">
              <Mail size={22} className="text-orange-primary" />
            </div>
            <h3 className="font-display font-bold text-[16px] text-white mb-0.5">Email</h3>
            <p className="font-body text-[12px] text-brand-gray mb-2">Réponse sous 48h</p>
            <span className="font-body text-[13px] text-orange-primary hover:underline break-all">
              {ASSO.email}
            </span>
          </a>

          <a
            href={`tel:${TEL_INTL}`}
            data-analytics="CTA-Contact-Appeler"
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-all duration-300 hover:border-brand-olive/40 hover:bg-white/[0.04]"
          >
            <div className="w-12 h-12 rounded-full bg-brand-olive/15 flex items-center justify-center mx-auto mb-3">
              <Phone size={22} className="text-brand-olive" />
            </div>
            <h3 className="font-display font-bold text-[16px] text-white mb-0.5">Téléphone</h3>
            <p className="font-body text-[12px] text-brand-gray mb-3">Lun – Sam · on décroche</p>
            <span className="font-body text-[13px] text-brand-olive hover:underline">
              {ASSO.telephone}
            </span>
          </a>

          <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-all duration-300 hover:border-brand-olive/40 hover:bg-white/[0.04]">
            <div className="w-12 h-12 rounded-full bg-brand-olive/15 flex items-center justify-center mx-auto mb-3">
              <MessageCircle size={22} className="text-brand-olive" />
            </div>
            <h3 className="font-display font-bold text-[16px] text-white mb-0.5">WhatsApp</h3>
            <p className="font-body text-[12px] text-brand-gray mb-2">Réponse rapide</p>
            <a
              href={waUrl(WHATSAPP_TEMPLATES.generic)}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics="CTA-Contact-WhatsApp"
              className="font-body text-[13px] text-brand-olive hover:underline"
            >
              Écrire sur WhatsApp
            </a>
            <p className="font-body text-[12px] text-brand-gray mt-2">
              Vous quittez le site vers WhatsApp (Meta).
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h4 className="font-display font-bold text-[15px] text-white mb-0.5">
              Retrouvez-nous aussi
            </h4>
            <p className="font-body text-[12px] text-brand-gray">
              Avis et horaires sur Google Maps. Photos des cours sur Instagram.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(`${ASSO.nom} ${ASSO.ville}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Voir la fiche ${ASSO.nom} sur Google Maps`}
              className="font-body font-medium text-[13px] text-brand-black bg-white hover:bg-orange-light px-5 py-2.5 rounded-full transition-colors"
            >
              Google Maps
            </a>
            {SITE_CONFIG.instagramUrl ? (
              <a
                href={SITE_CONFIG.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Compte Instagram ${ASSO.nom}`}
                className="font-body font-medium text-[13px] text-white border border-white/25 hover:bg-white/10 px-5 py-2.5 rounded-full transition-colors"
              >
                Instagram
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
