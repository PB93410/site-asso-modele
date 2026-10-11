/**
 * Images préparées dans le navigateur, sans envoi à un serveur :
 * logo réduit à 512 px, photo recadrée au format du site, couleur tirée du logo.
 */

export function lireFichier(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Fichier illisible'));
    r.readAsDataURL(file);
  });
}

function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

function toile(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Navigateur trop ancien');
  return { c, ctx };
}

const ACCEPTES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Logo : SVG gardé tel quel (s'il est léger), sinon PNG de 512 px maximum. */
export async function preparerLogo(file: File): Promise<string> {
  if (!ACCEPTES.includes(file.type)) throw new Error('Choisissez une image PNG, JPEG, WebP ou SVG.');
  if (file.type === 'image/svg+xml') {
    if (file.size > 300_000) throw new Error('Ce SVG est trop lourd (300 Ko maximum).');
    return lireFichier(file);
  }
  const img = await chargerImage(await lireFichier(file));
  const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const { c, ctx } = toile(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/** Photo d'accueil : recadrée au centre en 1344 × 768, WebP (JPEG si le navigateur ne sait pas). */
export async function preparerPhoto(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choisissez une photo JPEG, PNG ou WebP.');
  }
  const img = await chargerImage(await lireFichier(file));
  const W = 1344;
  const H = 768;
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  const { c, ctx } = toile(W, H);
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const webp = c.toDataURL('image/webp', 0.82);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85);
}

/** Couleur la plus présente du logo, hors blanc, noir, gris et transparent. */
export async function couleurDuLogo(dataUrl: string): Promise<string | null> {
  const img = await chargerImage(dataUrl);
  const { ctx } = toile(64, 64);
  ctx.drawImage(img, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;
  const cases = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (s < 0.25 || l < 0.08 || l > 0.92) continue;
    let hue = 0;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    const cle = Math.round(((hue * 60 + 360) % 360) / 15);
    const c = cases.get(cle) || { n: 0, r: 0, g: 0, b: 0 };
    c.n += 1;
    c.r += r;
    c.g += g;
    c.b += b;
    cases.set(cle, c);
  }
  const top = [...cases.values()].sort((x, y) => y.n - x.n)[0];
  if (!top || top.n < 20) return null;
  const hex = (v: number) => Math.round(v / top.n).toString(16).padStart(2, '0');
  return `#${hex(top.r)}${hex(top.g)}${hex(top.b)}`.toUpperCase();
}
