// Lesson figures, drawn in code so they stay sharp and follow the light/dark theme.
// Types: mind map, function plot, table, flow chart, network graph, and hand-drawn SVG.
// SVG labels use plain Unicode (x², π): KaTeX cannot typeset inside <svg>.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const wrap = (s, n) => String(s).split(" ").reduce((out, w) => {
  const last = out[out.length - 1];
  if (last && (last + " " + w).length > n) out.push(w); else out[out.length - 1] = last ? last + " " + w : w;
  return out;
}, [""]);
const node = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
const frame = (inner, cap, cls = "") => node(`<figure class="fig ${cls}">${inner}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`);
let uid = 0;

// Mind map: wide screens get a two-sided SVG; narrow screens get the same content as an outline (see .mm-list in CSS).
export function mindmap(title, branches) {
  const W = 900, BW = 260, LH = 19, half = Math.ceil(branches.length / 2);
  const boxes = branches.map(([h, leaves], i) => {
    const lines = [...wrap(h, 26).map((l) => [l, 1]), ...leaves.flatMap((x) => wrap("• " + x, 31).map((l, j) => [l, 0, j > 0]))];
    return { lines, h: 18 + lines.length * LH, side: i < half ? 0 : 1 };
  });
  const col = (s) => boxes.filter((b) => b.side === s), colH = (s) => col(s).reduce((a, b) => a + b.h + 16, -16);
  const H = Math.max(colH(0), colH(1), 160) + 40, cx = W / 2, cy = H / 2, tl = wrap(title, 20);
  for (const s of [0, 1]) { let y = (H - colH(s)) / 2; for (const b of col(s)) { b.x = s ? W - 20 - BW : 20; b.y = y; y += b.h + 16; } }
  const links = boxes.map((b) => { const sx = cx + (b.side ? 115 : -115), ex = b.side ? b.x : b.x + BW, ey = b.y + b.h / 2;
    return `<path class="mm-link" d="M${sx},${cy} C${(sx + ex) / 2},${cy} ${(sx + ex) / 2},${ey} ${ex},${ey}"/>`; }).join("");
  const cards = boxes.map((b) => `<rect class="mm-box" x="${b.x}" y="${b.y}" width="${BW}" height="${b.h}" rx="10"/><text>${b.lines.map(([l, head, indent], i) =>
    `<tspan x="${b.x + (indent ? 24 : 12)}" y="${b.y + 22 + i * LH}"${head ? ' class="mm-h"' : ""}>${esc(l)}</tspan>`).join("")}</text>`).join("");
  const centre = `<ellipse class="mm-centre" cx="${cx}" cy="${cy}" rx="125" ry="${24 + tl.length * 11}"/><text class="mm-title" text-anchor="middle">${tl.map((l, i) =>
    `<tspan x="${cx}" y="${cy + 6 + (i - (tl.length - 1) / 2) * 21}">${esc(l)}</tspan>`).join("")}</text>`;
  const svg = `<svg class="mm-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">${links}${centre}${cards}</svg>`;
  const list = `<ul class="mm-list" aria-label="Mind map: ${esc(title)}">${branches.map(([h, l]) => `<li><b>${esc(h)}</b><ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></li>`).join("")}</ul>`;
  return frame(svg + list, "", "mindmap");
}

// Function plot. Expressions are JavaScript using x and Math names; they come only from this site's own content files.
function plot(d) {
  const W = 540, H = 360, P = 40, [x0, x1] = d.x, [y0, y1] = d.y, id = "c" + ++uid;
  const X = (x) => P + ((x - x0) / (x1 - x0)) * (W - 2 * P), Y = (y) => H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P);
  const fn = (e) => new Function("x", `const {sin,cos,tan,exp,log,sqrt,abs,PI,E}=Math; return (${e});`);
  const step = (lo, hi) => [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((s) => (hi - lo) / s <= 10) || (hi - lo) / 10;
  const sx = d.xstep || step(x0, x1), sy = d.ystep || step(y0, y1), fmt = (v) => +v.toFixed(4);
  const xl = (v) => (d.xpi ? (({ 0: "0", 1: "π" })[fmt(v / Math.PI)] ?? `${fmt(v / Math.PI)}π`) : fmt(v));
  let g = "", o = "";
  for (let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx) {
    g += `<line class="grid" x1="${X(v)}" y1="${P}" x2="${X(v)}" y2="${H - P}"/>`;
    if (Math.abs(v) > 1e-9) o += `<text class="tick" x="${X(v)}" y="${Y(Math.min(Math.max(0, y0), y1)) + 16}" text-anchor="middle">${xl(v)}</text>`;
  }
  for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) {
    g += `<line class="grid" x1="${P}" y1="${Y(v)}" x2="${W - P}" y2="${Y(v)}"/>`;
    if (Math.abs(v) > 1e-9) o += `<text class="tick" x="${X(Math.min(Math.max(0, x0), x1)) - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const ax = Y(Math.min(Math.max(0, y0), y1)), ay = X(Math.min(Math.max(0, x0), x1));
  g += `<line class="axis" x1="${P}" y1="${ax}" x2="${W - P}" y2="${ax}"/><line class="axis" x1="${ay}" y1="${P}" x2="${ay}" y2="${H - P}"/>`;
  if (d.xl) o += `<text class="axl" x="${W - P}" y="${ax - 8}" text-anchor="end">${esc(d.xl)}</text>`;
  if (d.yl) o += `<text class="axl" x="${ay + 8}" y="${P - 10}">${esc(d.yl)}</text>`;
  const curve = (f, a = x0, b = x1) => { let path = "", pen = false, prev;
    for (let i = 0; i <= 400; i++) { const x = a + ((b - a) * i) / 400, y = f(x);
      if (!isFinite(y) || (pen && Math.abs(y - prev) > (y1 - y0))) { pen = false; prev = y; continue; }
      path += `${pen ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`; pen = true; prev = y; }
    return path; };
  const fs = (d.fns || []).map((o) => ({ ...o, f: fn(o.f) }));
  for (const s of d.shade || []) { const f = fs[s.f].f, h = s.g != null ? fs[s.g].f : () => 0, n = 120, xs = Array.from({ length: n + 1 }, (_, i) => s.from + ((s.to - s.from) * i) / n);
    g += `<polygon class="shade" points="${[...xs.map((x) => `${X(x)},${Y(f(x))}`), ...xs.reverse().map((x) => `${X(x)},${Y(h(x))}`)].join(" ")}"/>`; }
  for (const [x, h] of d.bars || []) { const w = (d.bw || 0.7) / 2; g += `<rect class="col" x="${X(x - w)}" y="${Y(Math.max(h, 0))}" width="${X(x + w) - X(x - w)}" height="${Math.abs(Y(h) - Y(0))}"/>`; }
  for (const [ax, ay, bx, by] of d.segs || []) g += `<line class="dash" x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}"/>`;
  for (const a of d.dash || []) g += a.x != null ? `<line class="dash" x1="${X(a.x)}" y1="${P}" x2="${X(a.x)}" y2="${H - P}"/>` : `<line class="dash" x1="${P}" y1="${Y(a.y)}" x2="${W - P}" y2="${Y(a.y)}"/>`;
  fs.forEach((o, i) => { g += `<path class="curve s${i % 3}" d="${curve(o.f, ...(o.dom || []))}"/>`; });
  (d.lines || []).forEach((l, i) => { g += `<polyline class="curve s${(fs.length + i) % 3}" points="${l.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}"/>`; });
  for (const [x, y] of d.dots || []) g += `<circle class="dot" cx="${X(x)}" cy="${Y(y)}" r="3.5"/>`;
  for (const [x, y, t, dx = 8, dy = -8] of d.pts || []) o += `<circle class="pt" cx="${X(x)}" cy="${Y(y)}" r="4.5"/><text class="lbl" x="${X(x) + dx}" y="${Y(y) + dy}"${dx < 0 ? ' text-anchor="end"' : ""}>${esc(t)}</text>`;
  const key = [...fs, ...(d.lines || [])].map((o, i) => o.label ? `<tspan class="k${i % 3}" x="${W - P - 4}" dy="${i ? 18 : 0}">${esc(o.label)}</tspan>` : "").join("");
  if (key) o += `<text class="lbl" x="${W - P - 4}" y="${P + 14}" text-anchor="end">${key}</text>`;
  return frame(`<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.alt || d.cap || "Graph")}"><clipPath id="${id}"><rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}"/></clipPath><g clip-path="url(#${id})">${g}</g>${o}</svg>`, d.cap);
}

// Network graph: nodes on a 0–100 grid; edges [a, b, weight]; hl lists highlighted edges as "AB".
function graph(d) {
  const W = 520, H = 320, X = (v) => 30 + v * 4.6, Y = (v) => 30 + v * 2.6, at = (k) => d.nodes[k], hl = new Set(d.hl || []), id = "a" + ++uid;
  const edges = (d.edges || []).map(([a, b, w]) => { const [ax, ay] = at(a), [bx, by] = at(b), on = hl.has(a + b) || hl.has(b + a);
    const mx = (X(ax) + X(bx)) / 2, my = (Y(ay) + Y(by)) / 2;
    return `<line class="edge${on ? " on" : ""}" x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}"${d.dir ? ` marker-end="url(#${id})"` : ""}/>` +
      (w != null ? `<rect class="wbg" x="${mx - 5 - 4 * String(w).length}" y="${my - 11}" width="${10 + 8 * String(w).length}" height="20" rx="5"/><text class="lbl" x="${mx}" y="${my + 4}" text-anchor="middle">${esc(w)}</text>` : ""); }).join("");
  const nodes = Object.entries(d.nodes).map(([k, [x, y]]) => `<circle class="vtx" cx="${X(x)}" cy="${Y(y)}" r="17"/><text class="vlbl" x="${X(x)}" y="${Y(y) + 5}" text-anchor="middle">${esc(k)}</text>`).join("");
  const defs = d.dir ? `<defs><marker id="${id}" viewBox="0 0 10 10" refX="27" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow" d="M0,0L10,5L0,10z"/></marker></defs>` : "";
  return frame(`<svg class="net" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.alt || d.cap || "Network")}">${defs}${edges}${nodes}</svg>`, d.cap);
}

const table = (d) => frame(`<div class="fig-table"><table>${d.head ? `<thead><tr>${d.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${d.rows.map((r) =>
  `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`, d.cap);
const flow = (d) => frame(`<ol class="flow${d.down ? " down" : ""}">${d.steps.map((s) => Array.isArray(s) ? `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>` : `<li><b>${esc(s)}</b></li>`).join("")}</ol>`, d.cap);
// Hand-drawn SVG from this site's own content files; style hooks: .s (line), .a (accent line), .fa (accent fill), .fp (panel fill), .t (text).
const svg = (d) => frame(`<svg class="draw" viewBox="${d.vb || "0 0 540 300"}" role="img" aria-label="${esc(d.alt || d.cap)}">${d.svg}</svg>`, d.cap);

export const figure = (d) => ({ plot, graph, table, flow, svg })[d.t](d);
