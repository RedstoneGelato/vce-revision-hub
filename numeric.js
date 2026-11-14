// Typed-answer questions ("t": "n") with fresh numbers each attempt.
// Templates: [[a]] inserts variable a; [[=expr|2]] inserts a calculated value to 2 decimal places; [[=expr|,0]] adds thousands separators.
// Expressions are JavaScript over the variables; they come only from this site's own content files.
const MATH = ["sin", "cos", "tan", "exp", "log", "sqrt", "abs", "PI", "E", "round", "min", "max"];
const fmt = (x, d, comma) => (d == null && !comma ? String(+(+x).toFixed(10)) : (+x).toLocaleString("en-AU", { minimumFractionDigits: +(d ?? 0), maximumFractionDigits: +(d ?? 10), useGrouping: !!comma }));

// vars: {a: [min, max, step]} picks from a grid; {a: {pick: [...]}} picks from a list.
export function variant(q, rnd = Math.random) {
  const v = {};
  for (const [k, spec] of Object.entries(q.vars || {})) {
    if (spec.pick) v[k] = spec.pick[Math.floor(rnd() * spec.pick.length)];
    else { const [lo, hi, st] = spec; v[k] = +(lo + st * Math.floor(rnd() * (Math.round((hi - lo) / st) + 1))).toFixed(10); }
  }
  const names = MATH.filter((m) => !(m in v)); // a variable named like a Math constant (E) wins
  const ev = (e) => new Function(...Object.keys(v), `const {${names}}=Math; return (${e});`)(...Object.values(v));
  const fill = (s) => s && s.replace(/\[\[(=?)([^\]|]+)(?:\|(,?)(\d*))?\]\]/g, (_, calc, e, comma, d) => fmt(calc ? ev(e) : v[e.trim()], d === "" ? null : d, comma));
  return { q: fill(q.q), e: fill(q.e || ""), s: (q.s || []).map(fill), ans: ev(q.ans), dp: q.dp ?? 2, unit: q.unit || "" };
}

// Accepts "1,200", "$1200", "−3.5", "12.5%", "3/4" and trailing units such as "mL".
export function parse(text) {
  const s = String(text).trim().replace(/[−–]/g, "-").replace(/[$,\s%]/g, "").replace(/[a-zA-Zµ°⁻¹²³]+$/, "");
  const f = s.match(/^(-?\d*\.?\d+)\/(\d*\.?\d+)$/);
  return s === "" ? NaN : f ? +f[1] / +f[2] : Number(s);
}

// Right if within half a unit of the requested decimal places, or within rel (default 0.1%) to allow for rounding during working.
export const check = (x, ans, dp = 2, rel = 0.001) => Number.isFinite(x) && Math.abs(x - ans) <= Math.max(0.5 * 10 ** -dp, Math.abs(ans) * rel) + 1e-9;
