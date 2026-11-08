// Hjælp til prøverne: bygger små PDF-filer i flere former (ikke en prøve selv). Ingen rigtige kalendere; alt er opdigtet.
import zlib from "zlib";
const lat = s => Buffer.from(s, "latin1");
export function ftekst(s){ return "(" + [...s].map(c => { const k = c.charCodeAt(0); return c === "(" || c === ")" || c === "\\" ? "\\" + c : k > 126 || k < 32 ? "\\" + k.toString(8).padStart(3, "0") : c; }).join("") + ")"; }
export function cmap(tegn){                                       // ToUnicode for en Identity-H-skrifttype: kode i rækkefølge fra 1
  const kort = new Map(); [...new Set(tegn)].forEach((c, i) => kort.set(c, i + 1));
  const h = n => n.toString(16).padStart(4, "0").toUpperCase(), u = c => h(c.charCodeAt(0));
  const poster = [...kort]; const stykker = [];
  for (let i = 0; i < poster.length; i += 90) stykker.push(`${Math.min(90, poster.length - i)} beginbfchar\n${poster.slice(i, i + 90).map(([c, k]) => `<${h(k)}> <${u(c)}>`).join("\n")}\nendbfchar`);
  return { kort, tekst: `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${stykker.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend` };
}
/** sider: [{ ind: "BT … ET", skrift: { F1: {type:"win"|"cid"|"diff", tegn?} } }]. Valg: flate, objstm, filter ("flate"|"hex"|"a85"|"ingen"), kryptere. */
export function bygPdf({ sider, flate = true, objstm = false, filter = null, krypteret = false, medKids = true }){
  const objs = []; const add = (dict, data = null) => { objs.push({ nr: objs.length + 1, dict, data }); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>"); add("PLADS");
  const sidenr = [];
  for (const s of sider){
    const fonter = {};
    for (const [navn, f] of Object.entries(s.skrift || { F1: { type: "win" } })){
      if (f.type === "win") fonter[navn] = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      else if (f.type === "diff") fonter[navn] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /X /Encoding << /Type /Encoding /Differences [ ${f.diff} ] >> >>`);
      else { const c = cmap(f.tegn); f.cm = c; const tu = add(`<< /Length ${c.tekst.length} >>`, lat(c.tekst)); fonter[navn] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /Y /Encoding /Identity-H /DescendantFonts [ 99 0 R ] /ToUnicode ${tu} 0 R >>`); }
    }
    const ind = lat(s.ind);
    const cnr = add("<< /Length 0 >>", ind);
    const res = `<< /Font << ${Object.entries(fonter).map(([n, nr]) => `/${n} ${nr} 0 R`).join(" ")} >> >>`;
    sidenr.push(add(`<< /Type /Page /Parent 2 0 R /Contents ${cnr} 0 R /Resources ${res} >>`));
  }
  objs[1].dict = medKids ? `<< /Type /Pages /Kids [ ${sidenr.map(n => n + " 0 R").join(" ")} ] /Count ${sidenr.length} >>` : "<< /Type /Pages >>";
  const kod = (data) => {
    if (filter === "ingen" || !flate && !filter) return { f: "", d: data };
    if (filter === "hex") return { f: "/Filter /ASCIIHexDecode", d: lat(data.toString("hex") + ">") };
    if (filter === "a85") return { f: "/Filter [ /ASCII85Decode /FlateDecode ]", d: lat(a85(zlib.deflateSync(data))) };
    return { f: "/Filter /FlateDecode", d: zlib.deflateSync(data) };
  };
  const dele = []; let ud = "%PDF-1.5\n%\xe2\xe3\xcf\xd3\n";
  const skriv = o => {
    if (o.data){ const k = kod(o.data); const d = o.dict.replace(/\/Length \d+/, "").replace(/<<\s*>>/, "<<>>"); const dict = d.replace(/>>\s*$/, `${k.f} /Length ${k.d.length} >>`); return Buffer.concat([lat(`${o.nr} 0 obj\n${dict}\nstream\n`), Buffer.from(k.d), lat("\nendstream\nendobj\n")]); }
    return lat(`${o.nr} 0 obj\n${o.dict}\nendobj\n`);
  };
  let pakker = objs.filter(o => !o.data);
  if (objstm){
    let kropp = "", hoved = "";
    for (const o of pakker){ hoved += `${o.nr} ${kropp.length} `; kropp += o.dict + "\n"; }
    const nr = objs.length + 1, strøm = lat(hoved + kropp), k = kod(strøm);
    dele.push(lat(ud), ...objs.filter(o => o.data).map(skriv), Buffer.concat([lat(`${nr} 0 obj\n<< /Type /ObjStm /N ${pakker.length} /First ${hoved.length} ${k.f} /Length ${k.d.length} >>\nstream\n`), Buffer.from(k.d), lat("\nendstream\nendobj\n")]));
  } else dele.push(lat(ud), ...objs.map(skriv));
  dele.push(lat(`trailer\n<< /Root 1 0 R /Size ${objs.length + 1}${krypteret ? " /Encrypt 9 0 R" : ""} >>\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(dele));
}
function a85(buf){
  let ud = "";
  for (let i = 0; i < buf.length; i += 4){
    const g = buf.subarray(i, i + 4), n = g.length; let v = 0; for (let k = 0; k < 4; k++) v = v * 256 + (g[k] || 0);
    if (n === 4 && v === 0){ ud += "z"; continue; }
    let s = ""; for (let k = 0; k < 5; k++){ s = String.fromCharCode(33 + (v % 85)) + s; v = Math.floor(v / 85); }
    ud += s.slice(0, n + 1);
  }
  return ud + "~>";
}
/** En enkel side: linjer af tekst fra toppen, én pr. 14 punkter. kolonner: [[x, "tekst"], …] pr. linje, ellers alt ved x = 50. */
export const simpelSide = (linjer, { fontnavn = "F1", enc = s => ftekst(s), tj = null } = {}) => {
  let ind = "BT\n/" + fontnavn + " 11 Tf\n"; let y = 800;
  for (const l of linjer){
    const dele = Array.isArray(l) ? l : [[50, l]];
    for (const [x, t] of dele) ind += `1 0 0 1 ${x} ${y} Tm\n${tj ? tj(t) : enc(t) + " Tj"}\n`;
    y -= 14;
  }
  return ind + "ET\n";
};
