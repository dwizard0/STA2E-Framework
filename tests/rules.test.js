// Rules-engine tests. Loads the rules.js section straight out of each page and checks it in Node.
//   node tests/rules.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const PAGES = [
  "src/STA2e/library/public/app.html",
  "src/STA2e-Remote/library/public/remote.html",
];

function loadRules(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const s = html.indexOf("/* ---- rules.js ---- */");
  const e = html.indexOf("/* ---- ", s + 10);
  if (s < 0 || e < 0) throw new Error(file + ": rules.js section not found");
  const mod = { exports: {} };
  new Function("module", "exports", html.slice(s, e))(mod, mod.exports);
  return mod.exports;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---- Reroute Power (p.185): every complication rolled on the task counts as two ----
const base = { difficulty: 2, compRange: 1, leader: { tn: 12, critMax: 1, dice: [5, 20] } };
test("no reroute: one complication from the leader's 20", (R) => {
  const ev = R.evaluateTask(Object.assign({}, base, { ship: { tn: 12, critMax: 3, dice: [9], rerouted: false } }));
  assert.strictEqual(ev.complications, 1);
});
test("reroute: ship die counts as a 1 and the leader's complication counts as two", (R) => {
  const ev = R.evaluateTask(Object.assign({}, base, { ship: { tn: 12, critMax: 3, dice: [1], rerouted: true } }));
  assert.strictEqual(ev.complications, 2);
  assert.strictEqual(ev.successes, 1 + 2);
});
test("reroute: an assistant's complication doubles too", (R) => {
  const ev = R.evaluateTask(Object.assign({}, base, {
    assists: [{ name: "A", tn: 10, critMax: 1, dice: [20] }],
    ship: { tn: 12, critMax: 3, dice: [1], rerouted: true },
  }));
  assert.strictEqual(ev.complications, 4);
});
test("reroute: no complications rolled stays 0", (R) => {
  const ev = R.evaluateTask({ difficulty: 1, compRange: 1, leader: { tn: 12, critMax: 1, dice: [3, 4] }, ship: { tn: 12, critMax: 3, dice: [1], rerouted: true } });
  assert.strictEqual(ev.complications, 0);
});

// ---- Shaken (p.308-309) ----
test("Shaken table: 1-6 Brace, 7-12 Losing Power, 13-18 Casualties, 19-20 Roll Again", (R) => {
  assert.deepStrictEqual([1, 6, 7, 12, 13, 18, 19, 20].map((d) => R.shakenFromD20(d).key),
    ["brace", "brace", "power", "power", "casualties", "casualties", "again", "again"]);
});
test("Shaken: a picked result matches the table", (R) => {
  ["brace", "power", "casualties"].forEach((k) => assert.strictEqual(R.shakenResult(k).key, k));
});
test("ship damage: crossing 50% shakes once; crossing 25% on the same attack is a breach instead", (R) => {
  const ship = { Structure: 9, Security: 3, Scale: 4, Shields: 16, ShieldsRaised: 1 };
  const max = R.shieldsMax(ship);
  const half = R.applyShipDamage(Object.assign({}, ship, { Shields: max }), { damage: Math.ceil(max * 0.6) + R.resistance(ship) });
  assert.strictEqual(half.shakenCount, 1);
  assert.strictEqual(half.breaches, 0);
  const deep = R.applyShipDamage(Object.assign({}, ship, { Shields: max }), { damage: max - 1 + R.resistance(ship) });
  assert.strictEqual(deep.shakenCount, 1);
  assert.strictEqual(deep.breaches, 1);
});
test("ship damage: Depleting can't cause Shaken (p.227)", (R) => {
  const ship = { Structure: 9, Security: 3, Scale: 4, Shields: 16, ShieldsRaised: 1 };
  const max = R.shieldsMax(ship);
  const out = R.applyShipDamage(Object.assign({}, ship, { Shields: max }), { damage: Math.ceil(max * 0.6) + R.resistance(ship), depleting: true });
  assert.strictEqual(out.shakenCount, 0);
});

// ---- Momentum pool (p.261) ----
test("Momentum cap is 6", (R) => {
  assert.strictEqual(R.MOMENTUM_CAP, 6);
});

let failed = 0, passed = 0;
for (const page of PAGES) {
  let R;
  try { R = loadRules(page); } catch (e) { console.log("FAIL " + page + ": " + e.message); failed++; continue; }
  for (const t of tests) {
    try { t.fn(R); passed++; console.log("PASS " + path.basename(page) + ": " + t.name); }
    catch (e) { failed++; console.log("FAIL " + path.basename(page) + ": " + t.name + "\n     " + e.message); }
  }
}
console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
