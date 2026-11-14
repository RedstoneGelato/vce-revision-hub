// Run with: node tests/check.mjs  (checks typed-answer logic and every typed question in content/)
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { variant, parse, check } from "../numeric.js";

for (const [s, n] of [["1,200", 1200], ["$4,434.87", 4434.87], ["−3.5", -3.5], ["12.5%", 12.5], ["3/4", 0.75], ["24.9 L", 24.9], [" 7 ", 7]]) assert.equal(parse(s), n, s);
assert.ok(Number.isNaN(parse("")) && Number.isNaN(parse("abc")));
assert.ok(check(4434.87, 4434.8715, 2) && check(4434.8, 4434.8715, 2) && !check(4430, 4434.8715, 2));
assert.ok(check(0.33, 1 / 3, 2) && !check(0.3, 1 / 3, 2) && !check(NaN, 1));
assert.ok(check(1200, 1200, 0, 0) && !check(1201, 1200, 0, 0));
const seq = [0, 0.99, 0.5].values(), v = variant({ q: "[[a]] + [[b]] = [[=a+b|1]]", vars: { a: [1, 5, 1], b: { pick: [10, 20] } }, ans: "a+b" }, () => seq.next().value);
assert.deepEqual([v.q, v.ans], ["1 + 20 = 21.0", 21]);
assert.equal(variant({ q: "[[=x*1000|,0]]", vars: { x: [12, 12, 1] }, ans: "x" }).q, "12,000");

let n = 0;
for (const f of readdirSync("content").filter((f) => f !== "glossary.json")) {
  const d = JSON.parse(readFileSync(`content/${f}`, "utf8"));
  for (const a of d.aos) for (const t of a.topics) for (const q of t.qs.filter((q) => q.t === "n")) {
    n++;
    for (let i = 0; i < 200; i++) {
      const r = variant(q), text = [r.q, r.e, ...r.s].join(" ");
      assert.ok(Number.isFinite(r.ans), `${f} ${t.id}: answer not finite for "${q.q.slice(0, 50)}"`);
      assert.ok(!/\[\[|undefined|NaN|Infinity/.test(text), `${f} ${t.id}: unfilled template in "${text.slice(0, 80)}"`);
      assert.ok(check(parse(r.ans.toFixed(r.dp)), r.ans, r.dp), `${f} ${t.id}: the rounded answer must be accepted`);
    }
  }
}
console.log(`ok: typed-answer logic, and ${n} typed questions × 200 variants`);
