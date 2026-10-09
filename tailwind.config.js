import ASSO from './asso.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Couleurs de l'association : asso.config.js → couleurs.
        // Les noms « orange-* » / « brand-olive » sont historiques : ils désignent
        // la couleur principale et la couleur secondaire, quelle que soit leur teinte.
        'orange-primary': ASSO.couleurs.primaire,
        'orange-hover': ASSO.couleurs.primaireHover,
        // Alias historique des hover:bg-orange-mid → même valeur sombre
        'orange-mid': ASSO.couleurs.primaireHover,
        // Réservé dégradés événementiels (forum, badges rentrée) — pas les boutons
        'orange-bright': '#EA580C',
        'orange-light': '#FFF4EB',
        'orange-soft': '#FDEAD7',
        'brand-black': '#111110',
        // Contraste P1 — #4A4843 ≈ 7:1 sur crème (lisibilité seniors)
        'brand-gray': '#4A4843',
        'brand-gray-light': '#E8E6E1',
        'brand-cream': '#F8F7F4',
        // Secondaire calme — planning, FAQ, liens secondaires (pas les CTA)
        'brand-olive': ASSO.couleurs.secondaire,
        'brand-olive-hover': ASSO.couleurs.secondaireHover,
        'brand-olive-soft': '#E8EDE4',
        // WhatsApp (CTA verts)
        whatsapp: {
          DEFAULT: '#25D366',
          from: '#25D366',
          to: '#128C7E',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.25rem, 8vw, 4.25rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        title: ['clamp(1.75rem, 5vw, 2.75rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        subtitle: ['clamp(1.25rem, 3vw, 1.75rem)', { lineHeight: '1.15' }],
        lead: ['clamp(1rem, 2vw, 1.125rem)', { lineHeight: '1.5' }],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        card: '1rem',
        panel: '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
        md: '0 4px 16px rgba(0, 0, 0, 0.08)',
        lg: '0 12px 40px rgba(0, 0, 0, 0.12)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)',
      },
      maxWidth: {
        content: '72rem',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};
