import { describe, expect, it } from 'vitest';
import ASSO from '../asso.config.js';
import { remplir, valeursTexte } from '../src/lib/gabarit.js';
import { contenuDepuisDossier, erreursDossier, imagesDossier } from '../src/lib/dossier.js';
import { verifierContenu } from '../scripts/_verifier.mjs';
import { ACTIVITIES, COACHS, EVENTS, SCHEDULE } from '../src/data/siteData';
import { ACTIVITY_PAGES } from '../src/data/activityPages';
import { faqs } from '../src/data/faqData';
import exemple from '../scripts/dossier-exemple.json';
import cours from '../contenu/cours.json';
import coachs from '../contenu/coachs.json';
import faq from '../contenu/faq.json';
import planning from '../contenu/planning.json';
import evenements from '../contenu/evenements.json';

const V = valeursTexte(ASSO, 6);

describe('textes à trous', () => {
  it('remplit les valeurs et les parties conditionnelles, même imbriquées', () => {
    expect(remplir('{tarif} à {ville}', V)).toBe(`${ASSO.adhesion.tarif} € à ${ASSO.ville}`);
    expect(remplir('A{?federation| et {federation}{?federationSigle| ({federationSigle})}}.', V)).toBe(
      `A et ${ASSO.federation.nom} (${ASSO.federation.sigle}).`,
    );
    expect(remplir('A{?federation| B}.', { ...V, federation: '' })).toBe('A.');
    expect(remplir('{inconnu} reste', V)).toBe('{inconnu} reste');
  });
});

describe('site construit depuis contenu/', () => {
  it('cours, pages, animateurs, FAQ, planning, événements', () => {
    expect(ACTIVITIES.map((a) => a.name)).toEqual(cours.map((c) => c.nom));
    expect(ACTIVITY_PAGES).toHaveLength(cours.length);
    expect(COACHS.map((c) => c.name)).toEqual(coachs.map((c) => c.nom));
    expect(faqs).toHaveLength(faq.length);
    expect(SCHEDULE).toHaveLength(planning.length);
    expect(EVENTS).toHaveLength(evenements.length);
  });

  it('aucun texte à trou ne reste visible', () => {
    const textes = [...faqs.flatMap((f) => [f.question, f.answer]), ...SCHEDULE.map((s) => s.location), ...EVENTS.map((e) => e.location)];
    expect(textes.filter((t) => /\{[^}]*\}/.test(t))).toEqual([]);
  });

  it('les contenus du modèle sont cohérents (npm run verifier)', () => {
    const r = verifierContenu({ cours, coachs, faq, planning, evenements }, V);
    expect(r.filter((x) => x.niveau === 'erreur')).toEqual([]);
  });

  it('verifier repère un planning ou un texte incohérent', () => {
    const r = verifierContenu(
      { cours, coachs, faq: [{ question: 'Prix ?', reponse: '{prix}' }], planning: [{ jour: 'Lundi', horaire: '', cours: 'Boxe', lieu: '' }], evenements: [] },
      V,
    );
    const textes = r.filter((x) => x.niveau === 'erreur').map((x) => x.texte);
    expect(textes.some((t) => t.includes('« Boxe »'))).toBe(true);
    expect(textes.some((t) => t.includes('{prix}'))).toBe(true);
  });
});

describe('dossier → contenu/', () => {
  it('cours avec niveau, animateur déduit, illustration par cours', () => {
    const c = contenuDepuisDossier(exemple);
    expect(c.cours[0]).toMatchObject({ nom: 'Gym douce', niveau: 'Reprise en douceur', animateur: 'Hélène', image: '/assets/act-gym-douce.svg' });
    expect(c.cours[1].animateur).toBe('Marc');
    expect(c.cours[2].resume).toBe('Sortie d’une heure trente, bâtons prêtés');
    expect(c.coachs.map((x) => x.image)).toEqual(['/assets/coach-1.svg', '/assets/coach-2.svg']);
    expect(c.evenements).toEqual([]);
    expect(c.faq?.[2].reponse).toContain('{tarif}');
  });

  it('pas de FAQ dans le dossier = celle du modèle gardée', () => {
    expect(contenuDepuisDossier({ ...exemple, faq: [] }).faq).toBeNull();
  });

  it('une photo d’animateur n’est publiée qu’avec son accord', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const sans = { ...exemple, coachs: [{ prenom: 'Lou', cours: [], bio: '', photo: png, accord: false }] };
    expect(erreursDossier(sans).map((e) => e.etape)).toContain('animateurs');
    expect(imagesDossier(sans).map((i) => i.chemin)).not.toContain('assets/coach-lou.png');
    const avec = { ...sans, coachs: [{ ...sans.coachs[0], accord: true }] };
    expect(imagesDossier(avec).map((i) => i.chemin)).toContain('assets/coach-lou.png');
    expect(contenuDepuisDossier(avec).coachs[0].image).toBe('/assets/coach-lou.png');
  });
});
