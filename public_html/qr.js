// qr.js — QR-kode i ren JavaScript, uden eksterne tjenester. Bruges af gaest-wifi.html.
//
// Byte-tilstand (UTF-8), version 1 til 40, fejlretning L/M/Q/H og automatisk valg af maske. Følger ISO/IEC 18004 og er
// skrevet efter samme fremgangsmåde som Nayuki's «QR Code generator» (MIT), som er den mest gennemgåede korte udgave.
// Koden her er afprøvet ved at afkode de tegnede billeder med OpenCV, for alle versioner til 25 og alle fire fejlretningsniveauer.

const ECC_CW = {   // fejlretningsord pr. blok, pr. version (index 0 er ubrugt)
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const ECC_BLOCKS = {   // antal blokke, pr. version
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

function rawDataModules(ver){
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2){
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver, ecl) => Math.floor(rawDataModules(ver) / 8) - ECC_CW[ecl][ver] * ECC_BLOCKS[ecl][ver];

// ── Reed–Solomon over GF(256), polynomium 0x11D ──
function gfMul(x, y){
  let z = 0;
  for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z & 0xFF;
}
function rsDivisor(degree){
  const r = new Array(degree - 1).fill(0); r.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++){
    for (let j = 0; j < r.length; j++){ r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor){
  const r = divisor.map(() => 0);
  for (const b of data){
    const f = b ^ r.shift(); r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

function addEccAndInterleave(data, ver, ecl){
  const nb = ECC_BLOCKS[ecl][ver], eccLen = ECC_CW[ecl][ver], raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
  const blocks = [], div = rsDivisor(eccLen);
  for (let i = 0, k = 0; i < nb; i++){
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++){
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
  }
  return out;
}

function alignPositions(ver){
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = ver * 4 + 10; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
];

function penalty(m, size){
  let p = 0, dark = 0;
  const lines = [];
  for (let y = 0; y < size; y++) lines.push(m[y]);
  for (let x = 0; x < size; x++) lines.push(m.map(r => r[x]));
  for (const l of lines){                                           // N1: rækker af 5 eller flere ens
    let run = 1;
    for (let i = 1; i <= size; i++){
      if (i < size && l[i] === l[i - 1]) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    // N3: 1:1:3:1:1-mønster med fire lyse moduler på den ene side (uden for symbolet regnes som lyst)
    const pl = "0000" + l.map(v => v ? 1 : 0).join("") + "0000";
    for (let i = 0; i + 11 <= pl.length; i++){
      const w = pl.slice(i, i + 11);
      if (w === "10111010000" || w === "00001011101") p += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++){   // N2: 2×2 blokke
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  for (const r of m) for (const v of r) if (v) dark++;               // N4: balance
  const total = size * size, k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return p + Math.max(0, k) * 10;
}

/**
 * Tegner en QR-kode. Returnerer { version, size, ecl, mask, modules } hvor modules[y][x] er true for mørk.
 * Kaster en fejl, hvis teksten ikke kan være i en QR-kode med det valgte niveau.
 */
export function qrMatrix(text, ecl = "M", minVersion = 1, tvingMaske = -1){
  if (!ECC_CW[ecl]) throw new Error("Ukendt fejlretningsniveau: " + ecl);
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = Math.max(1, minVersion), used = 0;
  for (;; ver++){
    if (ver > 40) throw new Error("Teksten er for lang til en QR-kode (" + bytes.length + " byte).");
    used = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (used <= dataCodewords(ver, ecl) * 8) break;
  }
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = dataCodewords(ver, ecl) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => { data[i >>> 3] |= b << (7 - (i & 7)); });
  const all = addEccAndInterleave(data, ver, ecl);

  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };

  for (let i = 0; i < size; i++){ setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }          // tidsstriber
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPositions(ver);
  ap.forEach((ax, i) => ap.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formatBits = mask => {
    const d = FORMAT_BITS[ecl] << 3 | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = (d << 10 | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, getBit(b, i));
    setF(8, 7, getBit(b, 6)); setF(8, 8, getBit(b, 7)); setF(7, 8, getBit(b, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, getBit(b, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, getBit(b, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, getBit(b, i));
    setF(8, size - 8, true);
  };
  formatBits(0);
  if (ver >= 7){
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const b = ver << 12 | rem;
    for (let i = 0; i < 18; i++){
      const c = getBit(b, i), a = size - 11 + i % 3, k = Math.floor(i / 3);
      setF(a, k, c); setF(k, a, c);
    }
  }
  // data i zigzag
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++){
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < all.length * 8){ m[y][x] = getBit(all[bi >>> 3], 7 - (bi & 7)); bi++; }
    }
  }
  const apply = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x]; };
  let best = 0, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++){
    if (tvingMaske >= 0 && mask !== tvingMaske) continue;
    apply(mask); formatBits(mask);
    const p = penalty(m, size);
    if (p < bestP){ bestP = p; best = mask; }
    apply(mask);
  }
  apply(best); formatBits(best);
  return { version: ver, size, ecl, mask: best, modules: m };
}

/** SVG med lys kant (stilzone) på 4 moduler. Mørkt og lyst er farver (standard sort på hvid, som kameraer bedst kan læse). */
export function qrSvg(text, { ecl = "M", kant = 4, moerk = "#000000", lys = "#ffffff", titel = "QR-kode" } = {}){
  const q = qrMatrix(text, ecl), n = q.size + kant * 2, d = [];
  for (let y = 0; y < q.size; y++){
    let x = 0;
    while (x < q.size){
      if (!q.modules[y][x]){ x++; continue; }
      let l = 1; while (x + l < q.size && q.modules[y][x + l]) l++;
      d.push(`M${x + kant} ${y + kant}h${l}v1h-${l}z`);
      x += l;
    }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${esc(titel)}"><rect width="${n}" height="${n}" fill="${esc(lys)}"/><path d="${d.join("")}" fill="${esc(moerk)}"/></svg>`;
}
