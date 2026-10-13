/**
 * Lecture d’un classeur .xlsx dans le navigateur et dans Node, sans dépendance.
 * Décompression : DecompressionStream (Node 22 et navigateurs récents).
 * Même logique que scripts/_xlsx-lire.mjs (valeurs calculées, pas les formules).
 */

async function inflateBrut(data) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Ce navigateur ne lit pas les fichiers Excel. Enregistrez-le en CSV.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const copie = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const out = await new Response(new Blob([copie]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(out);
}

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

const decoder = new TextDecoder('utf-8');

async function dezipper(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let fin = b.length - 22;
  while (fin >= 0 && u32(b, fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx).');
  const n = u16(b, fin + 10);
  let p = u32(b, fin + 16);
  const fichiers = new Map();
  for (let i = 0; i < n; i += 1) {
    if (u32(b, p) !== 0x02014b50) throw new Error('Classeur Excel abîmé.');
    const methode = u16(b, p + 10);
    const taille = u32(b, p + 20);
    const lnom = u16(b, p + 28);
    const lextra = u16(b, p + 30);
    const lcomm = u16(b, p + 32);
    const local = u32(b, p + 42);
    const nom = decoder.decode(b.subarray(p + 46, p + 46 + lnom));
    const debut = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const brut = b.subarray(debut, debut + taille);
    const contenu = methode === 8 ? await inflateBrut(brut) : brut;
    fichiers.set(nom, decoder.decode(contenu));
    p += 46 + lnom + lextra + lcomm;
  }
  return fichiers;
}

const texte = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

const tousLesT = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => texte(m[1])).join('');
const attr = (balise, nom) => new RegExp(`\\s${nom}="([^"]*)"`).exec(balise)?.[1];

function colonne(ref) {
  const lettres = /^[A-Z]+/.exec(ref)?.[0] || 'A';
  let n = 0;
  for (const ch of lettres) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** @returns {Promise<{ nom: string, lignes: string[][] }[]>} */
export async function lireXlsxPortable(buf) {
  const f = await dezipper(buf);
  const lire = (nom) => f.get(nom) || '';
  const partages = [...lire('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => tousLesT(m[1]));
  const liens = new Map(
    [...lire('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]),
  );
  const onglets = [];
  for (const m of lire('xl/workbook.xml').matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nom = texte(attr(m[0], 'name') || '');
    const cible = String(liens.get(attr(m[0], 'r:id')) || '').replace(/^\/?(xl\/)?/, '');
    const xml = lire(`xl/${cible}`);
    const lignes = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const num = Number(attr(r[1], 'r')) || lignes.length + 1;
      const ligne = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = attr(c[1], 't');
        const corps = c[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
        let val = '';
        if (type === 's') val = partages[Number(v)] ?? '';
        else if (type === 'inlineStr') val = tousLesT(corps);
        else if (v !== undefined) val = texte(v);
        const col = colonne(attr(c[1], 'r') || '');
        while (ligne.length < col) ligne.push('');
        ligne[col] = val;
      }
      while (lignes.length < num - 1) lignes.push([]);
      lignes[num - 1] = ligne;
    }
    onglets.push({ nom, lignes });
  }
  return onglets;
}
