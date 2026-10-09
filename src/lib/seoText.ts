// Titres et descriptions SEO de l'accueil, construits depuis asso.config.js.
// Aussi utilisés par index.html (plugin Vite) et scripts/postbuild-seo.mjs.
import ASSO from '../../asso.config.js';

const essais = ASSO.adhesion.essais;
const essaisTxt = essais > 0 ? `${essais} essai${essais > 1 ? 's' : ''} gratuit${essais > 1 ? 's' : ''}, ` : '';

export const HOME_TITLE = `${ASSO.nom} — ${ASSO.accroche} (${ASSO.codePostal})`;
export const HOME_DESCRIPTION = `${ASSO.accroche} à ${ASSO.ville} (${ASSO.codePostal}) : ${essaisTxt}${ASSO.adhesion.tarif} €/an, ${ASSO.adhesion.inclus}. Depuis ${ASSO.anneeCreation}.`;
