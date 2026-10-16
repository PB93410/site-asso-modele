import { Shield, Cookie, Mail, FileText } from 'lucide-react';
import { ASSO, HAS_FEDERATION, MODULES, PAIEMENTS_BUREAU, PAIEMENT_NOM, SITE_URL } from '../data/asso';

const FED = ASSO.federation.sigle || ASSO.federation.nom || 'fédération';

type HeadingLevel = 'h1' | 'h2';

const titleClass =
  'font-display font-black text-brand-black leading-[1] tracking-[-0.5px] mb-10 text-title';

export function MentionsLegalesContent({ heading = 'h2' }: { heading?: HeadingLevel }) {
  const Title = heading;

  return (
    <section id="mentions-legales" className="bg-[#F8F7F4] section-padding">
      <div className="content-max-width">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
          TRANSPARENCE
        </p>
        <Title className={titleClass}>Mentions légales</Title>

        <div className="grid grid-cols-1 gap-8">
          <div className="legal-block rounded-2xl border border-black/[0.08] bg-white p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center">
                <FileText size={18} className="text-orange-primary" />
              </div>
              <h2 className="font-display font-bold text-[22px] text-brand-black">Éditeur et hébergeur</h2>
            </div>

            <div className="space-y-5 font-body text-[14px] text-brand-gray leading-relaxed">
              <div>
                <p className="font-medium text-brand-black mb-1">Éditeur du site</p>
                <p>
                  Association <strong className="text-brand-black">{ASSO.nom}</strong>
                  <br />
                  {ASSO.statut}
                  {ASSO.rna ? (
                    <>
                      <br />
                      RNA : {ASSO.rna}
                    </>
                  ) : null}
                  {ASSO.siret ? (
                    <>
                      <br />
                      SIRET : {ASSO.siret}
                    </>
                  ) : null}
                  <br />
                  Siège social : {ASSO.siege}
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Responsable de la publication</p>
                <p>
                  {ASSO.responsablePublication}
                  <br />
                  Contact :{' '}
                  <a
                    href={`mailto:${ASSO.email}`}
                    className="text-orange-primary hover:underline"
                  >
                    {ASSO.email}
                  </a>
                </p>
                <p className="font-medium text-brand-black mb-1 mt-3">Responsable du traitement</p>
                <p>
                  {ASSO.responsablePublication}.
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Hébergeur</p>
                <p>
                  <strong className="text-brand-black">Netlify, Inc.</strong>
                  <br />
                  2325 3rd Street, Suite 215, San Francisco, CA 94107, États-Unis
                  <br />
                  Site : <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer" className="text-orange-primary hover:underline">www.netlify.com</a>
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Délégué à la Protection des Données (DPD)</p>
                <p>
                  En l'absence de DPD désigné, le contact RGPD est la Présidente de l'association :
                  {' '}<a href={`mailto:${ASSO.email}`} className="text-orange-primary hover:underline">{ASSO.email}</a>
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Propriété intellectuelle</p>
                <p>
                  L&apos;ensemble du contenu de ce site (textes, logos, mise en page) est la propriété
                  de l&apos;association. Les photographies de personnes sont publiées avec leur
                  autorisation écrite ; toute réutilisation est interdite. Toute reproduction,
                  représentation ou diffusion, en tout ou partie, est interdite sans autorisation
                  préalable.
                </p>
              </div>
            </div>
          </div>

          <PratiqueReglementaireBlock />
        </div>
      </div>
    </section>
  );
}

export function ConfidentialiteContent({ heading = 'h2' }: { heading?: HeadingLevel }) {
  const Title = heading;

  return (
    <section id="confidentialite" className="bg-[#F8F7F4] section-padding">
      <div className="content-max-width">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">
          RGPD
        </p>
        <Title className={titleClass}>Politique de confidentialité</Title>
        <p className="font-body text-[13px] text-brand-gray -mt-6 mb-8">
          Dernière mise à jour : 12 octobre 2026
        </p>

        <div className="grid grid-cols-1 gap-8">
          <div className="legal-block rounded-2xl border border-black/[0.08] bg-white p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center">
                <Shield size={18} className="text-orange-primary" />
              </div>
              <h2 className="font-display font-bold text-[22px] text-brand-black">
                Traitements de données
              </h2>
            </div>

            <div className="space-y-5 font-body text-[14px] text-brand-gray leading-relaxed">
              <div>
                <p className="font-medium text-brand-black mb-1">Données collectées</p>
                <p>
                  Le site <strong className="text-brand-black">{SITE_URL.replace(/^https?:\/\//, '')}</strong>{' '}
                  est principalement une vitrine. Les échanges se font surtout par WhatsApp, téléphone
                  ou email, à votre initiative. Deux formulaires envoient les données vers le{' '}
                  <strong className="text-brand-black">Google Sheet du bureau</strong> (via une fonction
                  Netlify), pas vers un paiement en ligne.
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong className="text-brand-black">Formulaire /essai</strong> : prénom, nom, téléphone,
                    email (facultatif), cours et date souhaités. Finalité : organiser l&apos;essai et
                    d&apos;éventuelles relances jusqu&apos;à la fin de la saison. Conservé dans le
                    tableur Google du bureau. Un bip interne (ntfy)
                    prévient le bureau : prénom, cours et date, <em>sans le numéro de téléphone</em>.
                    Le téléphone n&apos;est lu que dans le tableur ou /bureau. Le formulaire affiche
                    une phrase d&apos;information (pas une case « consentement ») : base légale art.
                    6.1.b. Pas de tracking publicitaire.
                    {MODULES.parrainage ? (
                      <>
                        {' '}
                        Une demande venue du lien d&apos;invitation d&apos;un adhérent est notée « Parrainage » :
                        le lien est le même pour tous, rien n&apos;indique qui a invité.
                      </>
                    ) : null}
                  </li>
                  {MODULES.sondageEssai ? (
                    <li>
                      <strong className="text-brand-black">Sondage après l&apos;essai</strong> (/sondage-essai) :
                      trois réponses anonymes (intention d&apos;adhérer, ce qui retient, une idée), la date, aucun nom,
                      téléphone ni adresse. Finalité : améliorer l&apos;accueil. Effacées après 12 mois.
                    </li>
                  ) : null}
                  <li>
                    <strong className="text-brand-black">Formulaire /inscription</strong> : identité
                    (prénom, nom), téléphone, email (facultatif), date de naissance, adresse, mode de
                    paiement prévu (sans encaissement en ligne), droit à l&apos;image, indication
                    QS-SPORT, cours envisagés et message éventuel. Voir le détail ci-dessous.
                  </li>
                  <li>
                    <strong className="text-brand-black">Liens WhatsApp</strong> : en cliquant sur un lien
                    WhatsApp, vous êtes redirigé vers WhatsApp (Meta Platforms, Inc.). Votre numéro et
                    message sont alors traités par Meta. Base légale : exécution de mesures précontractuelles à votre demande (art. 6.1.b RGPD).
                  </li>
                  <li>
                    <strong className="text-brand-black">Préférences d&apos;affichage</strong> : thème clair/sombre
                    stocké localement dans votre navigateur (localStorage). Pas de cookie publicitaire
                    ni analytics.
                  </li>
                  <li id="presences">
                    <strong className="text-brand-black">Pointage par QR (/presence)</strong> — si la
                    fonction est activée : numéro d&apos;adhérent ou e-mail, date, cours et heure.
                    Finalité : savoir qui était à la séance. Base : intérêt légitime de l&apos;association
                    (organisation des cours, art. 6.1.f) et exécution de l&apos;adhésion (art. 6.1.b).
                    Pas de géolocalisation. Un seul enregistrement par personne, par séance et par jour.
                  </li>
                  <li id="alertes">
                    <strong className="text-brand-black">Alertes de cours (/alertes)</strong> — si la
                    fonction est activée : e-mail, case de consentement, éventuellement un identifiant
                    de notification du navigateur. Finalité : prévenir d&apos;une annulation ou d&apos;un
                    changement. Base : consentement (art. 6.1.a), retirable à tout moment (lien dans
                    chaque mail, page /alertes/desabo).
                  </li>
                  <li>
                    <strong className="text-brand-black">Quiz « Quel cours pour moi ? »</strong> — les
                    réponses restent dans votre navigateur le temps de la page. Rien n&apos;est envoyé
                    ni enregistré.
                  </li>
                  <li id="liste-attente">
                    <strong className="text-brand-black">Liste d&apos;attente</strong> — si la fonction
                    est activée et que le cours est complet : prénom, nom, téléphone, e-mail, cours
                    demandé, rang et lien pour accepter une place. Finalité : proposer la première
                    place libérée. Base : mesures précontractuelles à votre demande (art. 6.1.b).
                    Conservation : jusqu&apos;à acceptation, expiration du délai, ou fin de saison.
                    Le lien personnel n&apos;est pas indexé.
                  </li>
                  <li id="wallet">
                    <strong className="text-brand-black">Carte Wallet</strong> — si la fonction est
                    activée : le bureau peut fabriquer une carte Apple Wallet (.pkpass) ou un lien
                    Google Wallet à partir de la fiche (nom, numéro, prochain cours, éventuellement
                    une alerte de dernière minute). Destinataires : Apple ou Google, selon le
                    téléphone. Base : exécution de l&apos;adhésion (art. 6.1.b).
                  </li>
                  <li id="financement">
                    <strong className="text-brand-black">Aides à la cotisation</strong> — si la
                    fonction est activée : indication Pass&apos;Sport, montant de chèques ANCV et
                    aide comité d&apos;entreprise, reste à payer. Noté sur la fiche d&apos;adhésion
                    pour le bureau. Aucun paiement n&apos;est prélevé ici. Base : exécution de
                    l&apos;adhésion (art. 6.1.b).
                  </li>
                  <li id="rapport">
                    <strong className="text-brand-black">Rapport annuel</strong> — si la fonction est
                    activée : totaux (adhérents, essais, présences, âges, communes) pour l&apos;AG
                    et les demandes de subvention. Aucun nom n&apos;apparaît dans le PDF ou le CSV.
                    Base : intérêt légitime (art. 6.1.f) et obligations associatives.
                  </li>
                  <li id="attestations">
                    <strong className="text-brand-black">Attestations PDF (/attestations)</strong> — si
                    la fonction est activée : numéro d&apos;adhérent et e-mail pour télécharger
                    l&apos;attestation d&apos;adhésion, le reçu fiscal (seulement si l&apos;association
                    est déclarée éligible) et l&apos;attestation comité d&apos;entreprise. Un lien
                    personnel peut être envoyé par mail (valable 7 jours). Le PDF est fabriqué à la
                    demande, rien n&apos;est stocké. Base : exécution de l&apos;adhésion (art. 6.1.b).
                  </li>
                  <li id="espace-adherent">
                    <strong className="text-brand-black">Espace adhérent (/espace)</strong> — si la fonction
                    est activée : vous indiquez l&apos;e-mail de votre fiche et recevez un code à usage
                    unique (valable 15 minutes ; un lien donné par le bureau, 72 heures). Le site ne garde
                    que l&apos;empreinte du code, jamais le code ni l&apos;adresse en clair. Une fois connecté,
                    un cookie de session strictement nécessaire (signé, non lisible par la page, limité à
                    l&apos;espace) garde l&apos;appareil connecté 90 jours au plus ; « Me déconnecter »
                    l&apos;efface. Vous y consultez votre fiche, votre carte, ce qu&apos;il reste à payer, vos
                    attestations et vos présences, téléchargez toutes vos données (droit d&apos;accès) et
                    signalez un changement, transmis par mail au bureau qui corrige la fiche. Vous pouvez
                    y indiquer les cours que vous suivez (gardés par le site, sous une clé qui ne contient
                    pas votre adresse, pour afficher vos prochaines séances) et abonner l&apos;agenda de
                    votre téléphone à vos cours (lien personnel signé, sans votre e-mail). Vous pouvez
                    aussi y changer votre réponse pour les photos : votre fiche est mise à jour et le
                    bureau est prévenu par mail. De juin à
                    septembre, vous pouvez vous y réinscrire pour la saison suivante : votre fiche est
                    reprise, vous corrigez vos coordonnées et répondez aux questions de la saison ; une
                    nouvelle fiche est créée pour cette saison, conservée comme les autres. Base :
                    exécution de l&apos;adhésion (art. 6.1.b).
                  </li>
                  <li id="paiement-en-ligne">
                    <strong className="text-brand-black">Paiement en ligne ({PAIEMENT_NOM})</strong> — si le
                    paiement intégré est activé : après la demande d&apos;inscription, le site crée le
                    paiement chez {PAIEMENT_NOM} avec le montant à régler, le prénom, le nom, l&apos;e-mail
                    et une référence de demande. {PAIEMENT_NOM} prévient le site du paiement ; le site le
                    revérifie auprès de {PAIEMENT_NOM} avant de passer la fiche « À jour ». Les données de
                    carte bancaire sont saisies chez {PAIEMENT_NOM}, jamais sur ce site. Destinataire :{' '}
                    {PAIEMENT_NOM}. Base : exécution de l&apos;adhésion (art. 6.1.b). Conservation : celle de
                    la fiche d&apos;adhérent.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Données traitées dans le cadre de l&apos;activité</p>
                <p>
                  L&apos;association traite des données pour gérer les adhésions et le contact avec les
                  adhérents et prospects :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-2">
                  <li>
                    <strong className="text-brand-black">Formulaire d&apos;inscription (/inscription)</strong>{' '}
                    — enregistre une <strong className="text-brand-black">demande d&apos;inscription</strong>.
                    Il <strong className="text-brand-black">ne prélève aucun paiement lui-même</strong> (chèque,
                    {PAIEMENTS_BUREAU} au bureau ; carte via {PAIEMENT_NOM} ensuite). Les données sont
                    envoyées à une <strong className="text-brand-black">fonction Netlify</strong> qui
                    les écrit dans le <strong className="text-brand-black">Google Sheet</strong> du
                    bureau (compte Gmail de l&apos;association) — c&apos;est le{' '}
                    <strong className="text-brand-black">seul registre</strong>. Un e-mail de
                    notification part vers{' '}
                    <a href={`mailto:${ASSO.email}`} className="text-orange-primary hover:underline">
                      {ASSO.email}
                    </a>
                    {' '}(via Netlify, à archiver : ce n&apos;est pas un second tableau). Finalité : traiter la demande et
                    finaliser l&apos;encaissement. Base légale : mesures précontractuelles /
                    exécution du contrat d&apos;adhésion (art. 6.1.b RGPD). Le droit à l&apos;image
                    (Oui / Non) relève du consentement (art. 6.1.a), révocable. L&apos;association reste{' '}
                    <strong className="text-brand-black">responsable du traitement</strong>.
                  </li>
                  <li>
                    <strong className="text-brand-black">Demandes d&apos;essai et stand forum des associations</strong> —
                    écrites dans le même tableur Google. Un bip interne (ntfy)
                    signale une nouvelle ligne au bureau, sans le numéro de téléphone. Base légale :
                    mesures précontractuelles (art. 6.1.b).
                  </li>
                  <li>
                    <strong className="text-brand-black">Adhésions ({PAIEMENT_NOM})</strong> — l&apos;inscription et le
                    paiement par carte se font sur la plateforme tierce{' '}
                    <strong className="text-brand-black">{PAIEMENT_NOM}</strong> (lien externe depuis ce site). {PAIEMENT_NOM}
                    traite vos données pour le compte de l&apos;association (sous-traitant / prestataire
                    technique). L&apos;association{' '}
                    <strong className="text-brand-black">{ASSO.nom}</strong> reste{' '}
                    <strong className="text-brand-black">responsable du traitement</strong> des données
                    d&apos;adhésion. Données typiques : identité, coordonnées, date de naissance, contact
                    d&apos;urgence, informations de paiement gérées par {PAIEMENT_NOM}. Base légale :{' '}
                    <strong className="text-brand-black">exécution du contrat d&apos;adhésion</strong> (art.
                    6.1.b RGPD). Politique {PAIEMENT_NOM} :{' '}
                    <a
                      href={ASSO.adhesion.paiementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:underline"
                    >
                      site de {PAIEMENT_NOM}
                    </a>
                    .
                  </li>
                  <li>
                    <strong className="text-brand-black">Licence {FED}</strong> — vos coordonnées sont
                    transmises à la fédération pour l&apos;établissement de la licence et de la couverture
                    d&apos;assurance. Base légale : exécution du contrat d&apos;adhésion (art. 6.1.b) et
                    obligations liées à la pratique fédérale.
                  </li>
                  <li>
                    <strong className="text-brand-black">Attestation de santé</strong> — vous remplissez le
                    questionnaire QS-SPORT chez vous et ne remettez qu&apos;une attestation sur
                    l&apos;honneur. L&apos;association ne conserve aucune réponse. Un éventuel certificat
                    médical est conservé pendant la durée de l&apos;adhésion puis détruit.
                  </li>
                  <li>
                    <strong className="text-brand-black">Communication</strong> — les échanges par
                    WhatsApp Business (ligne de l&apos;association) et par email sont conservés
                    jusqu&apos;à la fin de la saison, puis effacés. Base légale : mesures
                    précontractuelles ou intérêt légitime (suivi associatif).
                  </li>
                  <li>
                    <strong className="text-brand-black">Photographies</strong> — publiées uniquement
                    avec autorisation (Oui / Non à l&apos;inscription, ou écrit), révocable à tout
                    moment (base : consentement, art. 6.1.a). Supports : site de l&apos;association,
                    page <strong className="text-brand-black">Facebook</strong> et compte{' '}
                    <strong className="text-brand-black">Instagram</strong> de l&apos;asso (Meta
                    Platforms, Inc.). Un « Non » ou un retrait vaut pour les publications futures ;
                    pour une photo déjà en ligne, écrivez au bureau.
                  </li>
                </ul>
                <p className="mt-3">
                  <strong className="text-brand-black">Responsable du traitement :</strong>{' '}
                  {ASSO.responsablePublication}. Pour exercer vos droits :{' '}
                  <a href={`mailto:${ASSO.email}`} className="text-orange-primary hover:underline">
                    {ASSO.email}
                  </a>
                  {' '}(réponse sous 1 mois maximum).
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Finalité et durée de conservation</p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full min-w-[520px] text-[13px] border border-black/[0.08] rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-black/[0.03]">
                        <th className="text-left text-brand-gray font-medium p-2 border-b border-black/[0.08]">Donnée</th>
                        <th className="text-left text-brand-gray font-medium p-2 border-b border-black/[0.08]">Finalité</th>
                        <th className="text-left text-brand-gray font-medium p-2 border-b border-black/[0.08]">Durée</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Dossier adhérent ({PAIEMENT_NOM} / registre bureau)</td>
                        <td className="p-2">Gestion de l&apos;adhésion et de la saison</td>
                        <td className="p-2">Saison en cours + 3 ans après la dernière adhésion</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">
                          Registre des numéros d&apos;adhérent (si le registre est tenu dans un tableur Google) :
                          numéro et empreinte chiffrée du téléphone et du prénom, rien de lisible
                        </td>
                        <td className="p-2">Vérifier chaque matin que chaque numéro reste sur la fiche de la bonne personne</td>
                        <td className="p-2">Saison en cours ; effacé avec la fiche sur demande</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">
                          Rappels de réinscription (si l&apos;association les envoie) : empreinte chiffrée de
                          l&apos;e-mail, nombre de rappels envoyés, désinscription
                        </td>
                        <td className="p-2">Au plus trois rappels en juin et en septembre ; lien pour ne plus les recevoir dans chaque mail</td>
                        <td className="p-2">Saison en cours</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Demandes /essai (prénom, nom, tél., email facultatif, créneau)</td>
                        <td className="p-2">Organisation de l&apos;essai et relances dans la saison</td>
                        <td className="p-2">Jusqu&apos;à la fin de la saison 2026-2027, puis suppression (sauf adhésion)</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Demandes /inscription (Google Sheet ; e-mail bureau)</td>
                        <td className="p-2">Suivi de la demande hors paiement en ligne</td>
                        <td className="p-2">Saison + 3 ans si adhésion ; 12 mois si la demande n&apos;aboutit pas</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Alerte interne ntfy (prénom, cours, date)</td>
                        <td className="p-2">Prévenir le bureau qu&apos;une ligne essai est arrivée</td>
                        <td className="p-2">Message éphémère chez le prestataire ; le dossier reste le tableur</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Pièces comptables / paiements</td>
                        <td className="p-2">Obligations légales et comptables</td>
                        <td className="p-2">10 ans</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Licence fédérale</td>
                        <td className="p-2">Licence et assurance {FED}</td>
                        <td className="p-2">Durée de la saison + conservation fédérale applicable</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Messages WhatsApp Business / email</td>
                        <td className="p-2">Réponse aux demandes, suivi associatif</td>
                        <td className="p-2">Jusqu&apos;à la fin de la saison, puis suppression</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Certificat médical (si fourni)</td>
                        <td className="p-2">Sécurité de la pratique</td>
                        <td className="p-2">Durée de l&apos;adhésion, puis destruction</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Photographies (droit à l&apos;image)</td>
                        <td className="p-2">Communication (site, Facebook, Instagram)</td>
                        <td className="p-2">Jusqu&apos;au retrait du consentement ou fin d&apos;usage</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Thème d&apos;affichage (localStorage)</td>
                        <td className="p-2">Mode clair / sombre</td>
                        <td className="p-2">Jusqu&apos;à suppression par l&apos;utilisateur</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Pointages QR (n° ou e-mail, cours, date, heure)</td>
                        <td className="p-2">Présence aux séances, relance si longue absence</td>
                        <td className="p-2">Jusqu&apos;à la fin de la saison, puis suppression</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Abonnement alertes (e-mail, consentement, notification)</td>
                        <td className="p-2">Prévenir d&apos;une annulation ou d&apos;un changement</td>
                        <td className="p-2">Jusqu&apos;au retrait, ou 2 ans sans envoi</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Liste d&apos;attente (identité, contact, cours, lien)</td>
                        <td className="p-2">Proposer une place quand un cours se libère</td>
                        <td className="p-2">Jusqu&apos;à acceptation, expiration, ou fin de saison</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Carte Wallet (nom, n°, prochain cours)</td>
                        <td className="p-2">Ajouter la carte adhérent au téléphone</td>
                        <td className="p-2">Durée de l&apos;adhésion ; la carte reste sur l&apos;appareil</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Aides (Pass&apos;Sport, ANCV, comité d&apos;entreprise)</td>
                        <td className="p-2">Calculer le reste à payer, suivi par le bureau</td>
                        <td className="p-2">Durée de l&apos;adhésion, puis suppression avec la fiche</td>
                      </tr>
                      <tr className="border-b border-black/[0.06]">
                        <td className="p-2">Rapport annuel (totaux, âges, communes — sans noms)</td>
                        <td className="p-2">AG et demandes de subvention</td>
                        <td className="p-2">Selon les obligations associatives et de subvention</td>
                      </tr>
                      <tr>
                        <td className="p-2">Attestations (n°, e-mail, lien personnel, PDF à la volée)</td>
                        <td className="p-2">Justificatif d&apos;adhésion, reçu fiscal, employeur / CE</td>
                        <td className="p-2">Pas de copie conservée ; le lien expire après 7 jours</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Destinataires des données</p>
                <p>
                  Selon les cas : <strong className="text-brand-black">Netlify</strong> (hébergement,
                  fonctions qui écrivent dans le tableur, et e-mail de notification pour
                  /inscription), <strong className="text-brand-black">Google</strong>{' '}
                  (Gmail et Google Sheets : essais, stand forum des associations, registre adhérents),{' '}
                  <strong className="text-brand-black">ntfy.sh</strong> (bip interne, sans téléphone),{' '}
                  <strong className="text-brand-black">{PAIEMENT_NOM}</strong> (adhésion et paiement
                  carte), <strong className="text-brand-black">{FED}</strong> (licence et
                  assurance), <strong className="text-brand-black">Meta</strong> (WhatsApp si vous
                  utilisez ce canal ; Facebook et Instagram lorsque des photos de groupe sont
                  publiées avec votre accord), et l&apos;association (bureau) pour la gestion
                  quotidienne.
                  Aucune donnée n&apos;est vendue ni cédée à des fins commerciales. Le site
                  s&apos;adresse à des personnes de 16 ans et plus. Entre 16 et 17 ans,
                  l&apos;adhésion est validée par un responsable légal.
                </p>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Transferts hors Union Européenne</p>
                <p>
                  Les données suivantes peuvent être transférées hors UE. Ces transferts
                  reposent, selon le prestataire, sur des clauses contractuelles types de la
                  Commission européenne et/ou sur le Data Privacy Framework UE–États-Unis
                  lorsqu&apos;il est applicable :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong className="text-brand-black">WhatsApp (Meta Platforms, Inc., USA)</strong> :
                    lorsque vous cliquez sur un lien WhatsApp. Base légale : exécution de mesures
                    précontractuelles à votre demande (art. 6.1.b RGPD).
                  </li>
                  <li>
                    <strong className="text-brand-black">Facebook et Instagram (Meta Platforms, Inc., USA)</strong>{' '}
                    : lorsque l&apos;association publie une photo de groupe avec votre accord
                    (droit à l&apos;image). Base légale : consentement (art. 6.1.a), révocable.
                  </li>
                  <li>
                    <strong className="text-brand-black">{PAIEMENT_NOM}</strong> : plateforme d&apos;adhésion et de
                    paiement (lien externe). Les données d&apos;inscription sont traitées selon la
                    politique de {PAIEMENT_NOM} ; l&apos;association reste responsable du traitement. Voir{' '}
                    <a
                      href={ASSO.adhesion.paiementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:underline"
                    >
                      site de {PAIEMENT_NOM}
                    </a>
                    .
                  </li>
                  <li>
                    <strong className="text-brand-black">Google Fonts</strong> :
                    non utilisées (polices système uniquement, aucune requête vers Google).
                  </li>
                  <li>
                    <strong className="text-brand-black">Hébergement et fonctions (Netlify, Inc., USA)</strong> :
                    pages du site et fonctions /api/essai, /api/adhesion (écriture Google Sheet).
                    Des logs techniques (ex. adresse IP) peuvent être traités par l&apos;hébergeur.
                    Un e-mail de notification de /inscription peut transiter par Netlify (à
                    archiver ; le registre reste le tableur).
                  </li>
                  <li>
                    <strong className="text-brand-black">Google LLC (Sheets / Gmail)</strong> :
                    registre essais (y compris stand forum des associations) et registre adhérents. Hors UE possible,
                    via le compte Gmail de l&apos;association.
                  </li>
                  <li>
                    <strong className="text-brand-black">ntfy.sh</strong> : notification interne au
                    bureau (prénom, cours, date d&apos;essai, lien /bureau). Pas de numéro de
                    téléphone. Service tiers ; conservation courte côté prestataire.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-brand-black mb-1">Vos droits (RGPD)</p>
                <p>
                  Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
                  des droits suivants :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Droit d'accès à vos données</li>
                  <li>Droit de rectification</li>
                  <li>Droit à l'effacement (« droit à l'oubli »)</li>
                  <li>Droit à la limitation du traitement</li>
                  <li>Droit d'opposition</li>
                  <li>Droit à la portabilité des données</li>
                  <li>Droit de retirer votre consentement à tout moment</li>
                </ul>
                <p className="mt-2">
                  Pour exercer ces droits, contactez :{' '}
                  <a
                    href={`mailto:${ASSO.email}`}
                    className="text-orange-primary hover:underline"
                  >
                    {ASSO.email}
                  </a>
                  {' '}— Réponse sous 1 mois maximum.
                </p>
                <p className="mt-2">
                  En l&apos;absence de réponse satisfaisante, vous pouvez saisir la CNIL :
                  <a
                    href="https://www.cnil.fr/fr/plaintes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-primary hover:underline ml-1"
                  >
                    cnil.fr/fr/plaintes
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div id="cookies" className="legal-block rounded-2xl border border-black/[0.08] bg-white p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center">
                <Cookie size={18} className="text-orange-primary" />
              </div>
              <h3 className="font-display font-bold text-[22px] text-brand-black">
                Cookies et traceurs
              </h3>
            </div>

            <div className="font-body text-[14px] text-brand-gray leading-relaxed space-y-4">
              <p>
                Ce site <strong className="text-brand-black">n&apos;utilise pas de cookies
                publicitaires ni d&apos;outils d&apos;analytics</strong> (pas de Google Analytics,
                pas de pixel publicitaire). Aucun bandeau de consentement n&apos;est donc affiché
                pour ces usages. L&apos;hébergeur (Netlify) peut poser, dans certains contextes,
                des cookies techniques de fonctionnement ; ce ne sont pas des cookies de mesure
                d&apos;audience ni de publicité.
              </p>
              <p>
                Le seul stockage géré par le site est le{' '}
                <strong className="text-brand-black">localStorage</strong> du navigateur pour
                mémoriser le thème d&apos;affichage (clair / sombre). Selon la CNIL, ce stockage
                technique sous le contrôle de l&apos;utilisateur ne nécessite pas de consentement
                préalable.
              </p>
              <p>
                L&apos;association <strong className="text-brand-black">ne vend pas vos données</strong> et
                n&apos;effectue aucun profilage commercial. Les liens vers WhatsApp, Google Maps ou {PAIEMENT_NOM}
                ouvrent des services tiers uniquement après un clic de votre part.
              </p>
              <p>
                L&apos;hébergement est assuré par <strong className="text-brand-black">Netlify, Inc.</strong> (États-Unis) :
                des logs techniques (adresse IP) peuvent être traités par l&apos;hébergeur dans le cadre du
                fonctionnement du site, conformément à sa politique de confidentialité.
              </p>
            </div>
          </div>

          <div className="legal-block rounded-2xl border border-black/[0.08] bg-white p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-primary/10 flex items-center justify-center shrink-0">
                <Mail size={20} className="text-orange-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-display font-bold text-[18px] text-brand-black">
                  Contact pour les questions de confidentialité
                </h4>
                <p className="font-body text-[14px] text-brand-gray mt-1">
                  Pour toute question relative à la protection de vos données personnelles, à l'exercice
                  de vos droits RGPD, ou pour signaler un problème de confidentialité :
                </p>
                <div className="flex flex-wrap gap-4 mt-3">
                  <a
                    href={`mailto:${ASSO.email}`}
                    className="inline-flex items-center gap-2 font-body font-medium text-[14px] text-orange-primary hover:underline"
                  >
                    <Mail size={14} />
                    {ASSO.email}
                  </a>
                  <span className="font-body text-[14px] text-brand-gray">
                    {ASSO.responsablePublication}
                  </span>
                </div>
                <p className="font-body text-[12px] text-brand-gray/60 mt-3">
                  En l&apos;absence de réponse satisfaisante sous 1 mois, vous pouvez saisir la CNIL :
                  <a
                    href="https://www.cnil.fr/fr/plaintes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-primary hover:underline ml-1"
                  >
                    cnil.fr/fr/plaintes
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PratiqueReglementaireBlock() {
  return (
    <div className="legal-block rounded-2xl border border-black/[0.08] bg-white p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-primary/10 flex items-center justify-center">
          <Shield size={18} className="text-orange-primary" />
        </div>
        <h2 className="font-display font-bold text-[22px] text-brand-black">
          Informations pratiques et réglementaires
        </h2>
      </div>

      <div className="font-body text-[14px] text-brand-gray leading-relaxed space-y-5">
        <div>
          <h3 className="font-display font-bold text-[16px] text-brand-black mb-2">Assurance</h3>
          <p>
            <strong className="text-brand-black">Assurance responsabilité civile.</strong>{' '}
            L&apos;association est assurée en responsabilité civile
            {ASSO.assureur ? <> auprès de <strong className="text-brand-black">{ASSO.assureur}</strong></> : null}.
            {HAS_FEDERATION ? (
              <>
                {' '}Chaque adhérent bénéficie en outre de la couverture d&apos;assurance fédérale incluse
                dans sa licence <strong className="text-brand-black">{FED}</strong>.
              </>
            ) : null} Il est recommandé de vérifier
            votre propre garantie individuelle accident. Le détail des contrats est disponible
            sur demande.
          </p>
        </div>

        <div>
          <h3 className="font-display font-bold text-[16px] text-brand-black mb-2">
            Questionnaire de santé
          </h3>
          <p>
            <strong className="text-brand-black">Certificat médical et questionnaire de santé.</strong>{' '}
            Depuis 2022, le certificat médical n&apos;est plus obligatoire pour la pratique sportive
            de loisir non compétitive. L&apos;association demande à chaque adhérent de remplir le
            questionnaire de santé <strong className="text-brand-black">QS-SPORT</strong> (Cerfa
            n°&nbsp;<strong className="text-brand-black">15699*01</strong>) au moment de l&apos;inscription.
            Si une réponse au questionnaire est positive, un certificat médical de non
            contre-indication est requis.
          </p>
        </div>

        <div>
          <h3 className="font-display font-bold text-[16px] text-brand-black mb-2">Mineurs</h3>
          <p>
            <strong className="text-brand-black">Âge minimum 16 ans.</strong> L&apos;association
            n&apos;accepte pas les inscriptions de mineurs de moins de 16 ans. À partir de 16 ans,
            l&apos;adhésion est possible avec une autorisation parentale écrite, signée par le
            représentant légal, à remettre au moment de l&apos;inscription. Le représentant légal
            doit également fournir un numéro de téléphone joignable pendant les cours.
          </p>
        </div>

        <div>
          <h3 className="font-display font-bold text-[16px] text-brand-black mb-2">
            Règlement intérieur
          </h3>
          <p>
            <strong className="text-brand-black">Règlement intérieur.</strong> Le règlement intérieur
            de l&apos;association est remis à chaque adhérent lors de son inscription et disponible
            sur demande à{' '}
            <a
              href={`mailto:${ASSO.email}`}
              className="text-orange-primary hover:underline"
            >
              {ASSO.email}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
