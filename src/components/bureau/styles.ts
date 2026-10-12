/** Classes communes du bureau (cartes, boutons). Couleur d’accent : brand-olive. */
/** Carte : fond blanc, filet très léger. */
export const carte = 'rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)]';

export const bouton = {
  principal:
    'inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60',
  secondaire:
    'inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm disabled:opacity-60',
  whatsapp:
    'inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-4 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#128C4B] font-semibold text-sm',
  discret: 'inline-flex items-center h-11 min-h-[44px] px-1 text-sm text-slate-500 underline underline-offset-2 disabled:opacity-60',
};
