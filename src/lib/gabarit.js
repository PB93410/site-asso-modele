/**
 * Textes à trous des fichiers contenu/*.json, remplis avec la configuration :
 *
 *   {tarif}                     → « 140 € »
 *   {?federation| et la licence {federation}}
 *                               → le texte après « | » seulement si la valeur existe
 *
 * Les accolades peuvent s'imbriquer. Une clé inconnue est laissée telle quelle.
 */

/** Valeurs disponibles dans les textes, calculées depuis asso.config.js. */
export function valeursTexte(asso, nbCours = 0) {
  const essais = Number(asso.adhesion?.essais) || 0;
  const lieux = (asso.lieux || []).map((l) => l.nom);
  return {
    nom: asso.nom,
    nomCourt: asso.nomCourt,
    ville: asso.ville,
    codePostal: asso.codePostal,
    tarif: `${asso.adhesion?.tarif} €`,
    essais: essais > 0 ? String(essais) : '',
    coursEssai: `${essais} cours d’essai`,
    nbCours: nbCours > 0 ? String(nbCours) : '',
    lieux: lieux.join(' et '),
    lieu1: lieux[0] || '',
    lieu2: lieux[1] || lieux[0] || '',
    communes: (asso.communesVoisines || []).join(', '),
    federation: asso.federation?.nom || '',
    federationSigle: asso.federation?.sigle || '',
    telephone: asso.telephone,
    email: asso.email,
  };
}

/** Fin de l'accolade ouverte en `debut` (accolades imbriquées), ou -1. */
function fermeture(s, debut) {
  let n = 0;
  for (let i = debut; i < s.length; i += 1) {
    if (s[i] === '{') n += 1;
    else if (s[i] === '}') {
      n -= 1;
      if (n === 0) return i;
    }
  }
  return -1;
}

export function remplir(texte, valeurs) {
  const s = String(texte ?? '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const j = s.indexOf('{', i);
    if (j < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, j);
    const k = fermeture(s, j);
    if (k < 0) {
      out += s.slice(j);
      break;
    }
    const dedans = s.slice(j + 1, k);
    const cond = dedans.match(/^\?(\w+)\|([\s\S]*)$/);
    if (cond) {
      if (valeurs[cond[1]]) out += remplir(cond[2], valeurs);
    } else if (/^\w+$/.test(dedans) && dedans in valeurs) {
      out += valeurs[dedans];
    } else {
      out += `{${remplir(dedans, valeurs)}}`;
    }
    i = k + 1;
  }
  return out;
}
