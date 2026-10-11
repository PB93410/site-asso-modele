import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { ASSO, PAIEMENTS_BUREAU, PAIEMENT_NOM, TARIF_LABEL, lieuAdresse, mapsUrl } from '../data/asso';

type Props = {
  /** « essai » : venir essayer ; « adhesion » : s’inscrire. */
  motif: 'essai' | 'adhesion';
};

const MESSAGES = {
  essai: 'Bonjour, je voudrais venir essayer un cours. Quel créneau me conseillez-vous ?',
  adhesion: 'Bonjour, je voudrais m’inscrire. Comment faire ?',
};

const btn =
  'flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full font-body font-semibold text-[16px]';

/**
 * Remplace un formulaire désactivé (asso.config.js → modules) :
 * appeler, écrire, ou venir sur place. Toujours une action claire.
 */
export default function ContactDirect({ motif }: Props) {
  const tel = ASSO.telephone.replace(/[^\d+]/g, '');
  const wa = ASSO.whatsapp ? `https://wa.me/${ASSO.whatsapp}?text=${encodeURIComponent(MESSAGES[motif])}` : '';
  const sujet = motif === 'essai' ? 'Essai d’un cours' : 'Inscription';
  return (
    <section className="space-y-5 rounded-2xl bg-white border border-black/10 p-5 md:p-8">
      <h2 className="font-display font-black text-[22px] text-brand-black">
        {motif === 'essai' ? 'Dites-nous quand vous venez' : 'Pour vous inscrire'}
      </h2>
      <p className="font-body text-[16px] text-brand-gray leading-relaxed">
        {motif === 'essai'
          ? 'Appelez ou écrivez-nous : on vous conseille un cours et un horaire.'
          : `Cotisation ${TARIF_LABEL} l’année. Venez en début de cours ou contactez le bureau.${
              PAIEMENTS_BUREAU ? ` Règlement au bureau : ${PAIEMENTS_BUREAU}.` : ''
            }`}
      </p>
      <div className="flex flex-col gap-3">
        {tel ? (
          <a href={`tel:${tel}`} className={`${btn} bg-orange-primary hover:bg-orange-hover text-white`}>
            <Phone size={18} aria-hidden="true" />
            Appeler le {ASSO.telephone}
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} bg-brand-olive hover:bg-brand-olive-hover text-white`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            Écrire sur WhatsApp
          </a>
        ) : null}
        {ASSO.email ? (
          <a
            href={`mailto:${ASSO.email}?subject=${encodeURIComponent(sujet)}`}
            className={`${btn} border border-black/15 text-brand-black hover:bg-black/[0.03]`}
          >
            <Mail size={18} aria-hidden="true" />
            {ASSO.email}
          </a>
        ) : null}
        {motif === 'adhesion' && ASSO.adhesion.paiementUrl ? (
          <a
            href={ASSO.adhesion.paiementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} border-2 border-orange-primary text-orange-primary hover:bg-orange-primary hover:text-white`}
          >
            Payer {TARIF_LABEL} sur {PAIEMENT_NOM} <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {ASSO.lieux.length ? (
        <ul className="font-body text-[15px] text-brand-gray space-y-2">
          {ASSO.lieux.map((l) => (
            <li key={l.id} className="flex gap-2">
              <MapPin size={18} className="shrink-0 mt-0.5 text-brand-olive" aria-hidden="true" />
              <span>
                <a href={mapsUrl(l)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-black underline underline-offset-2">
                  {l.nom}
                </a>{' '}
                — {lieuAdresse(l)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
