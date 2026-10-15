import { Check, Copy, ChevronDown } from 'lucide-react';
import { BUREAU_MESSAGES } from '../data/bureauMessages';

import BureauSheetLinks from './BureauSheetLinks';
import { ASSO, PAIEMENT_NOM, SITE_URL, TARIF_LABEL } from '../data/asso';

type Props = {
  ntfyUrl: string;
  essaisSheetUrl: string;
  adherentsSheetUrl: string;
  copiedId: string | null;
  copyMessage: (id: string, body: string) => void;
};

export default function BureauAide({
  ntfyUrl,
  essaisSheetUrl,
  adherentsSheetUrl,
  copiedId,
  copyMessage,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-2xl text-brand-black">Mode d’emploi</h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Tout se fait ici. Vous n’ouvrez pas Excel. WhatsApp s’ouvre tout seul quand
            vous appuyez sur un bouton vert.
          </p>
        </div>
        <button
          type="button"
          data-print-hide
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm shrink-0"
        >
          Imprimer
        </button>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] divide-y divide-black/[0.06] overflow-hidden">
      <details className="group px-4 sm:px-5 py-1" open>
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>En une minute</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>
            Quelqu’un veut essayer → QR ci-dessous, ou formulaire{' '}
            <a className="underline font-medium" href={`${SITE_URL}/essai`}>
              /essai
            </a>
            .
          </li>
          <li>
            Rappeler une personne → onglet <strong>Essais</strong> (trois listes) ou{' '}
            <strong>Relances WhatsApp</strong>.
          </li>
          <li>
            L’argent des {TARIF_LABEL} est dans la caisse ({PAIEMENT_NOM}, chèque…) → onglet{' '}
            <strong>À payer</strong> → « J’ai reçu l’argent ».
          </li>
          <li>
            Tableau complet ou la boîte Gmail → <strong>Autre</strong>.
          </li>
        </ul>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Ouvrir l’espace</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5 leading-relaxed">
          <li>
            Allez sur{' '}
            <a className="underline font-medium" href={`${SITE_URL}/bureau`}>
              {SITE_URL.replace(/^https?:\/\//, '')}/bureau
            </a>
          </li>
          <li>Mot de passe du bureau (le même pour tout le monde) → Entrer.</li>
          <li>Gardez le téléphone chargé. En cas de liste vide : Actualiser (en haut).</li>
        </ol>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Les onglets</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <dl className="text-sm text-slate-700 space-y-2 leading-relaxed">
          <div>
            <dt className="font-semibold text-slate-900">Accueil</dt>
            <dd>Ce qu’il reste à faire aujourd’hui. Recherche en haut. Lien Relances.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">À payer</dt>
            <dd>Inscriptions en attente des {TARIF_LABEL}. Recherche en haut.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Essais</dt>
            <dd>À confirmer, rappel la veille, après le cours.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Relances</dt>
            <dd>
              File WhatsApp P1 (conversion {TARIF_LABEL}) et P2 (rappel à 7 jours). « Fait » =
              ce téléphone seulement — cocher aussi la Sheet si besoin.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Autre</dt>
            <dd>Horaires, événements, aide, tableaux, mail.</dd>
          </div>
        </dl>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Au gymnase (saisie sur place)</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5 leading-relaxed">
          <li>
            <strong>Idéal :</strong> la personne scanne le QR et remplit l’essai toute
            seule (créneau + salle tout de suite).
          </li>
          <li>
            Sinon : ouvrez le formulaire /essai sur le téléphone du bureau et remplissez-le
            avec la personne. Ensuite le bouton WhatsApp.
          </li>
        </ol>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Demandes d’essai — les trois listes</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          Chaque fiche a un bouton vert WhatsApp (le texte est déjà écrit) et, si besoin,
          Appeler.
        </p>
        <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5 leading-relaxed">
          <li>
            <strong>À confirmer</strong> — « Confirmer ». La personne passe ensuite dans
            Cours prévu.
          </li>
          <li>
            <strong>Cours prévu — rappel la veille</strong> — « La veille ». Quand elle
            est venue : « Est venu(e) ».
          </li>
          <li>
            <strong>Après le cours</strong> — « Après le cours » (adhésion). Ou « 2e essai »
            / « 3e essai » : elle revient dans Cours prévu.
          </li>
        </ul>
        <p className="text-sm text-slate-700 leading-relaxed">
          Pour classer : <strong>A adhéré</strong>, <strong>Ne veut plus</strong>,{' '}
          <strong>Plus tard</strong>. La fiche sort alors des listes à traiter.
          Pour retrouver quelqu’un : barre <strong>Rechercher</strong> (prénom, nom ou
          téléphone), y compris les fiches déjà classées.
        </p>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Quand les {TARIF_LABEL} arrivent</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5 leading-relaxed">
          <li>Onglet À payer.</li>
          <li>
            « J’ai reçu l’argent » → date → n° de chèque si besoin → « Oui, c’est payé ».
            Coche trop tôt : cherchez la personne, puis **Annuler le paiement**.
          </li>
          <li>
            Paiement en ligne ({PAIEMENT_NOM}) : si le paiement en ligne est branché sur le site, rien
            à faire, la fiche passe à jour toute seule (mail « Paiement reçu »). Sinon, même geste, une
            fois le paiement vu sur la plateforme ou sur le compte. Virement : retrouvez la référence de
            la demande (ex. {ASSO.sigle}-K7M4QP) sur le relevé. Ne cochez pas avant d’avoir l’argent.
          </li>
          <li>
            Relance douce : bouton « Rappeler pour payer » (WhatsApp), ou page Relances.
          </li>
        </ol>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Horaires et événements du site</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          Choisissez, puis Enregistrer. Une confirmation s’affiche. Le site public se met
          à jour tout seul (quelques minutes). Pas besoin du référent. En cas de doute,
          n’enregistrez pas.
        </p>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Bip sur le téléphone (une fois)</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5 leading-relaxed">
          <li>Installez l’appli <strong>ntfy</strong> (magasin d’applications).</li>
          <li>
            Revenez ici connecté, puis ouvrez le lien « Ouvrir le canal d’alerte »
            ci-dessous.
          </li>
        </ol>
        <p className="text-sm text-slate-600 leading-relaxed">
          Le bip indique un prénom, un cours et une date — pas le numéro de téléphone.
          Sans l’appli, rien ne sonne : regardez Demande essai de temps en temps.
        </p>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Boîte mail (5 minutes par jour)</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          Compte <strong>{ASSO.email}</strong> — pages <strong>Mail</strong> et{' '}
          <strong>Agenda</strong> dans Autre (dans le bureau, sans ouvrir Gmail). Les essais
          n’arrivent <em>pas</em> par mail (ils sont dans Essais).
        </p>
        <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>
            <strong>{PAIEMENT_NOM} / paiement reçu</strong> → Adhésion → « J’ai reçu l’argent », puis
            archiver le mail.
          </li>
          <li>
            <strong>Netlify / formulaire inscription</strong> → fiche lisible dans Gmail.
            Déjà dans Adhérents (seul registre). Ne pas recréer une ligne. Archiver.
          </li>
          <li>
            <strong>Quelqu’un écrit pour un essai</strong> → renvoyer le lien /essai ou le numéro de l’asso.
          </li>
          <li>
            <strong>Mairie, fédération, « effacer mes données »</strong> → président / référent.
          </li>
          <li>
            <strong>Spam, iPhone gagné, DHL</strong> → Spam. Ne pas cliquer.
          </li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed">
          Après l’action : Archiver (ne pas laisser 80 non-lus). Répondre seulement depuis
          cette adresse, jamais depuis une boîte perso. Textes mail : plus bas, « Copier ».
        </p>
      </div>
      </details>

      <details className="group px-4 sm:px-5 py-1">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-3 min-h-[56px] font-semibold text-brand-black">
          <span>Si ça coince</span>
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-2 pb-4">
        <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>Liste vide alors qu’il devrait y avoir du monde → Actualiser.</li>
          <li>
            « Le registre Google ne répond pas » → Internet, puis Actualiser. Ce n’est
            pas une liste vide : les données n’ont pas pu être lues.
          </li>
          <li>« Session terminée » → Quitter, puis le mot de passe à nouveau.</li>
          <li>WhatsApp ne s’ouvre pas → numéro manquant ou mal saisi. Appeler à la place.</li>
          <li>Une erreur bizarre → Internet, puis Actualiser. Sinon le référent.</li>
        </ul>
      </div>
      </details>

      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] p-4 sm:p-5 space-y-3">
        <h3 className="font-semibold text-brand-black">QR essai — à afficher</h3>
        <p className="text-sm text-slate-600">
          Scanne → {SITE_URL}/essai. Déposez votre QR code dans public/assets/qr-essai.png.
        </p>
        <img
          src="/assets/qr-essai.png"
          alt={`QR code essai ${ASSO.nom}`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          width={220}
          height={220}
          className="w-[220px] h-[220px] bg-white"
        />
        <a
          href="/assets/qr-essai.png"
          download="qr-essai.png"
          className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm"
        >
          Télécharger le QR
        </a>
        <a
          href="/bureau/affiche"
          className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm"
        >
          Affiche planning A4 à imprimer
        </a>
        {ntfyUrl ? (
          <p className="text-sm text-slate-700">
            Abonnement ntfy :{' '}
            <a
              href={ntfyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-olive underline font-medium break-all"
            >
              Ouvrir le canal d’alerte
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Canal ntfy : Actualiser après connexion, ou demander le lien au référent.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-display font-bold text-xl text-brand-black px-1">Textes à copier</h3>
        <p className="text-sm text-slate-500 px-1 leading-relaxed">
          Les trois premiers : réponses depuis {ASSO.email}. Pour une personne
          précise, préférez les boutons verts des fiches (prénom et créneau déjà dedans).
        </p>
        <div className="space-y-3">
          {BUREAU_MESSAGES.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-black">{m.title}</p>
                  <p className="text-xs text-slate-500">{m.when}</p>
                </div>
                <button
                  type="button"
                  data-print-hide
                  onClick={() => copyMessage(m.id, m.body)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold px-3 py-2.5 text-sm min-h-[44px]"
                >
                  {copiedId === m.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedId === m.id ? 'Copié' : 'Copier'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-body text-sm text-slate-600 bg-brand-cream rounded-xl p-3 max-h-40 overflow-y-auto">
                {m.body}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <BureauSheetLinks
        essaisUrl={essaisSheetUrl}
        adherentsUrl={adherentsSheetUrl}
        variant="card"
      />
    </div>
  );
}
