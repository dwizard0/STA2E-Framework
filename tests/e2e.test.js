// End-to-end tests: drives the core and remote pages in Chromium against their built-in mock MapTool.
//   node tests/e2e.test.js
// Needs Playwright with Chromium (npm install, then npx playwright install chromium).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const appPath = path.join(ROOT, "src/STA2e/library/public/app.html");
const remotePath = path.join(ROOT, "src/STA2e-Remote/library/public/remote.html");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "src/STA2e/library.json"), "utf8")).version;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.resolve(appPath));
  await page.waitForFunction(() => window.App && !App.S.loading && App.S.order.length > 0);
  const results = await page.evaluate(async (VERSION) => {
    const A = App, S = A.S, M = MockBackend, out = [];
    const ok = (cond, name) => out.push((cond ? "PASS " : "FAIL ") + name);
    const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(r => setTimeout(r, 20)); } return true; };
    const lastChat = () => (M.log[M.log.length - 1] || {}).html || "";
    const btn = (re) => [...document.querySelectorAll("button")].find(b => re.test(b.textContent));

    // ---- 1. Pools: pay before rolling, bank as a delta ----
    M.lib.Momentum = 2; M.lib.Threat = 6; await A.refreshPools();
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1, buy: [1, 0, 0] });
    window.MockDice = [1, 2, 3];
    await A.doRoll();
    ok(M.lib.Momentum === 1, "buying a die takes 1 Momentum from the pool before rolling (pool " + M.lib.Momentum + ")");
    ok(S.r.result && S.r.result.momentumRoll === 3, "roll generated 3 Momentum");
    A.finishRoll(); await until(() => !S.r.result);
    ok(M.lib.Momentum === 4, "3 leftover Momentum banked (pool " + M.lib.Momentum + ")");
    ok(/3 Momentum saved/.test(lastChat()), "outcome card reports what was banked");

    M.lib.Momentum = 5; await A.refreshPools();
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1 });
    window.MockDice = [1, 2]; await A.doRoll();
    A.finishRoll(); await until(() => !S.r.result);
    ok(M.lib.Momentum === 6 && /1 Momentum saved.*1 lost/.test(lastChat()), "banking past 6 reports the lost Momentum (" + lastChat().replace(/<[^>]+>/g, "").slice(-60) + ")");

    // ---- 2. Stale cache: someone else spent the pool; the roll stops instead of overwriting ----
    M.lib.Momentum = 0; S.lib.Momentum = 6;
    const logLen = M.log.length;
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1, buy: [1, 0, 0] });
    window.MockDice = [1, 2, 3];
    try { await A.doRoll(); } catch (e) { }
    ok(M.lib.Momentum === 0 && M.log.length === logLen && !S.r.result, "stale pool: roll refused, nothing rolled or overwritten");
    ok(S.lib.Momentum === 0, "client pool corrected from the macro's answer");
    ok(/Not enough Momentum/.test((document.querySelector(".toast") || {}).textContent || ""), "player sees why");
    // Stale result open: the window thinks 2 + 0 is enough, the macro refuses, the header shows the real pool.
    M.lib.Momentum = 2; await A.refreshPools();
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 2 }); window.MockDice = [3, 4]; await A.doRoll();
    M.lib.Momentum = 0;
    try { await A.spend("Create Trait", 2); } catch (e) { }
    ok(/in the group pool \(Momentum 0/.test((document.querySelector(".toast") || {}).textContent || ""), "open result, pool emptied meanwhile: the macro refuses the spend");
    ok(/MOMENTUM\s*0/i.test(document.querySelector(".pool.mom").textContent.replace(/\s+/g, " ")) && !S.r.result.spentLog.length, "header redrawn with the real pool (0), nothing recorded as spent");
    S.r.result = null;

    // ---- 2b. Display behind the pool (someone added Momentum): re-read before refusing ----
    M.lib.Momentum = 2; S.lib.Momentum = 0;
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 2 }); window.MockDice = [3, 4]; await A.doRoll();
    ok(S.r.result && S.r.result.rollLeft === 0, "result open with no Momentum from the roll");
    await A.spend("Create Trait", 2);
    ok(M.lib.Momentum === 0 && S.r.result.spentLog.join() === "Create Trait (2)", "stale-low display: spend re-reads the pool and goes through (pool " + M.lib.Momentum + ", log " + S.r.result.spentLog.join() + ")");
    S.lib.Momentum = 0; M.lib.Momentum = 0;
    await A.spend("Create Trait", 2);
    ok(/Not enough Momentum for Create Trait/.test((document.querySelector(".toast") || {}).textContent || "") && S.r.result.spentLog.length === 1, "really short: still refused after re-reading");
    // The 6-second refresh keeps the header and the spend card current while the result stays open.
    M.lib.Momentum = 3;
    const seenPool = await until(() => /MOMENTUM\s*3/i.test(document.querySelector(".pool.mom").textContent.replace(/\s+/g, " ")), 7500);
    ok(seenPool && S.r.result, "open result: header shows Momentum 3 from the background refresh, result still open");
    ok(/Group pool: 3/.test(document.body.textContent), "open result: Spend Momentum card shows Group pool: 3");
    S.r.result = null;
    M.lib.Momentum = 1; S.lib.Momentum = 0;
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1, buy: [1, 0, 0] }); window.MockDice = [1, 2, 3];
    await A.doRoll();
    ok(S.r.result && M.lib.Momentum === 0, "stale-low display: buying a die re-reads the pool and rolls (pool " + M.lib.Momentum + ")");
    S.r.result = null;
    // GM steppers change the pool by one, not to the total on screen.
    M.lib.Momentum = 0; S.lib.Momentum = 2; S.tab = "gm"; A.render();
    const poolsCard = [...document.querySelectorAll(".card")].find(c => /^Pools/.test(c.querySelector("h3").textContent));
    const plus = [...poolsCard.querySelectorAll("button")].find(b => b.textContent.trim() === "+");
    plus.click(); await until(() => M.lib.Momentum !== 0);
    ok(M.lib.Momentum === 1, "GM + on a stale Momentum display adds 1 (pool " + M.lib.Momentum + ")");
    S.tab = "roll"; A.render();

    // ---- 3. Player permissions ----
    M.ctx.isGM = false; M.tokens.npc1.props.Notes = "GM secret: is a changeling";
    await A.reload();
    let r = await A.api("libSet", { values: { Threat: 0, Settings: { x: 1 } } });
    ok(r.ok === 0 && r.refused.join() === "Threat,Settings" && M.lib.Threat === 6, "player can't write Threat or Settings");
    r = await A.api("libSet", { values: { DiffOneTime: { value: 3, reason: "x" } } });
    ok(r.ok === 0, "player can't set a one-time modifier");
    r = await A.api("libSet", { values: { DiffOneTime: { value: 0, reason: "" }, Opposed: {} } });
    ok(r.ok === 1, "player can clear the one-time modifier and set opposed rolls");
    r = await A.api("tokenSet", { id: "npc1", map: "Bridge", props: { Daring: 20 }, name: "Renamed", type: "Basic" });
    ok(r.ok === 0 && M.tokens.npc1.props.Daring === 11 && M.tokens.npc1.name === "Jem'Hadar Soldier" && M.tokens.npc1.type === "STA2e Character", "player can't change an NPC's stats, name or type");
    r = await A.api("tokenSet", { id: "npc1", map: "Bridge", props: { Injuries: "[]", Defeated: 1, StressText: "" } });
    ok(r.ok === 1, "player can still apply an Injury to an NPC");
    r = await A.api("tokenSet", { id: "pc1", map: "Bridge", props: { Daring: 10 } });
    ok(r.ok === 1, "owner can edit their own character");
    let threw = ""; try { await A.addPools(0, -1); } catch (e) { threw = e.message; }
    ok(/Only the GM/.test(threw) && M.lib.Threat === 6, "player can't spend Threat");
    await A.addPools(0, 2); ok(M.lib.Threat === 8, "player can add Threat");
    ok(A.tok("npc1").p.Notes === "", "NPC Notes hidden from players");
    S.tab = "character"; S.charId = "npc1"; A.render();
    ok(!/changeling/.test(document.body.textContent), "Character tab doesn't show NPC Notes to players");
    M.ctx.isGM = true; await A.reload();
    ok(A.tok("npc1").p.Notes.indexOf("changeling") >= 0, "GM still sees NPC Notes");
    M.tokens.npc1.props.Daring = 11;

    // ---- 4. Phaser Arrays: Spread choice, repeatable Devastating Attack ----
    M.lib.Momentum = 0; M.lib.Threat = 6; await A.refreshPools();
    const fire = A.actionById("tac_fire_energy");
    A.newRoll("pc1"); A.startAction(fire); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "ship2"; S.r.atk.weapon = "Phaser Arrays"; S.tab = "roll"; A.render();
    ok(/Area or Spread/.test(document.body.textContent), "Arrays show the Area-or-Spread choice");
    window.MockDice = [1, 1, 1]; await A.doRoll();
    ok(S.r.result && S.r.result.success, "attack hits");
    let dev = btn(/^Devastating Attack/);
    ok(dev && /\(1\)$/.test(dev.textContent), "Spread: Devastating Attack costs 1 (" + (dev && dev.textContent) + ")");
    dev.click(); await until(() => S.r.result.extra.devastating === 1);
    dev = btn(/^Devastating Attack/);
    ok(dev && !dev.disabled && /#2/.test(dev.textContent), "Spread: Devastating Attack can be bought again");
    dev.click(); await until(() => S.r.result.extra.devastating === 2);
    window.MockDice = [12, 5, 4, 15];
    await A.applyShipAttack();
    const card = lastChat();
    ok(/Devastating Attack 1:/.test(card) && /Devastating Attack 2:/.test(card), "two Devastating hits applied");
    ok(/Spread/.test(card), "attack card names the Spread choice");
    A.finishRoll(); await until(() => !S.r.result);

    A.newRoll("pc1"); A.startAction(fire); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "ship2"; S.r.atk.weapon = "Phaser Arrays"; S.r.atk.aos = "area";
    window.MockDice = [1, 1, 1]; await A.doRoll();
    dev = btn(/^Devastating Attack/);
    ok(dev && /\(2\)$/.test(dev.textContent), "Area: Devastating Attack costs 2");
    ok(!!btn(/^Extra target \(Area\)/), "Area: extra-target spend offered");
    dev.click(); await until(() => S.r.result.extra.devastating === 1);
    ok(btn(/^Devastating Attack/).disabled, "without Spread it can only be bought once");
    S.r.result = null;

    // ---- 5. Ram doesn't need Reserve Power ----
    const ship = A.tok("ship1");
    await A.saveToken(ship, { ReservePower: 0 });
    A.newRoll("pc1"); A.startAction(A.actionById("helm_ram")); S.r.atk.target = "ship2";
    window.MockDice = [1, 2, 3]; await A.doRoll();
    ok(S.r.result && !!S.r.result.ev, "Ram rolls without Reserve Power");
    ok(Number(M.tokens.ship1.props.ReservePower) === 0, "Ram doesn't touch Reserve Power");
    S.r.result = null;

    // ---- 6. Shields: lowering and raising keeps the damaged total ----
    await A.saveToken(ship, { Shields: 10, ShieldsRaised: 1, ReservePower: 1 });
    S.tab = "ship"; S.shipId = "ship1"; A.render();
    const box = () => [...document.querySelectorAll("label")].find(l => /Shields raised/.test(l.textContent)).querySelector("input");
    box().click(); await until(() => Number(M.tokens.ship1.props.ShieldsRaised) === 0);
    ok(Number(M.tokens.ship1.props.Shields) === 0 && Number(M.tokens.ship1.props.ShieldsLowered) === 10, "lowered: shields 0, total 10 kept");
    await until(() => !box().checked || true); A.render();
    box().click(); await until(() => Number(M.tokens.ship1.props.ShieldsRaised) === 1);
    ok(Number(M.tokens.ship1.props.Shields) === 10, "raised: back to 10, not full 16 (got " + M.tokens.ship1.props.Shields + ")");
    S.tab = "gm"; A.render(); btn(/^End scene$/).click();
    await until(() => Number(M.tokens.ship1.props.Shields) === 16);
    ok(Number(M.tokens.ship1.props.Shields) === 16 && M.tokens.ship1.props.ShieldsLowered === "", "new scene: shields to max (" + M.tokens.ship1.props.Shields + ")");

    // ---- 7. Reroute: all complications on the task double ----
    await A.saveToken(ship, { ReroutedSystem: "Sensors" });
    A.newRoll("pc1"); A.startAction(A.actionById("sen_sweep")); S.r.baseDiff = 1;
    window.MockDice = [3, 20]; await A.doRoll();
    ok(S.r.result.comps.length === 2, "rerouted Sensors: leader's one 20 counts as two complications (" + S.r.result.comps.length + ")");
    S.r.result = null;

    // ---- 8. Token moved since the window loaded: clear error, Apply stays available ----
    M.ctx.isGM = false; await A.reload();
    A.newRoll("pc1"); A.startAction(A.actionById("pc_ranged")); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "npc1"; S.r.atk.injury = "stun";
    window.MockDice = [1, 2]; await A.doRoll();
    M.tokens.npc1.map = "Other";            // moved after the window loaded
    const injBefore = String(M.tokens.npc1.props.Injuries || "[]");
    try { await A.applyPersonalAttack(); } catch (e) { }
    const toast = (document.querySelector(".toast") || {}).textContent || "";
    ok(/can't find Jem'Hadar Soldier on map/.test(toast), "moved token: clear message instead of a 15 s timeout (" + toast.slice(0, 60) + ")");
    ok(!S.r.result.applied && !!btn(/^Apply Injury$/), "moved token: result not marked Applied, button still there");
    ok(String(M.tokens.npc1.props.Injuries || "[]") === injBefore, "moved token: nothing written");
    await A.reload();                       // ⟳ picks up the new map
    const res8 = S.r.result;
    ok(!!res8 && !res8.applied, "after reload the open result is still unapplied");
    const p1 = A.applyPersonalAttack(), p2 = A.applyPersonalAttack();   // double click
    await p1; await p2;
    const inj = JSON.parse(M.tokens.npc1.props.Injuries || "[]");
    ok(res8.applied && inj.length === 1, "after reload: injury applied once, despite a double click (" + inj.length + ")");
    ok(/Applied\./.test(document.body.textContent), "card shows Applied. only after the save");
    M.tokens.npc1.map = "Bridge"; M.tokens.npc1.props.Injuries = "[]"; M.tokens.npc1.props.Defeated = 0;
    M.ctx.isGM = true; await A.reload(); S.r.result = null;

    // ---- 9. Stale token data: someone else changed the token after this window loaded ----
    M.tokens.ship1.props.Shields = 16; M.tokens.ship1.props.ReservePower = 1; M.tokens.ship1.props.Breaches = "{}";
    M.ctx.isGM = false; await A.reload();
    M.tokens.ship1.props.Shields = 5;       // the GM's window applied damage; this window still thinks 16
    A.newRoll("pc1"); A.startAction(A.actionById("ops_regen")); window.MockDice = [1, 2, 3]; await A.doRoll();
    await A.applySimpleEffect();
    ok(Number(M.tokens.ship1.props.Shields) === 9, "Regenerate Shields works from the current 5 shields: 5 + Engineering 4 = 9 (got " + M.tokens.ship1.props.Shields + ")");
    ok(/regains 4 shields \(9\/16\)/.test(lastChat()), "card reports the real gain (" + lastChat().replace(/<[^>]+>/g, "").slice(-45) + ")");
    ok(M.tokens.ship1.props.ShieldsText === "9 / 16", "hover-sheet text matches (" + M.tokens.ship1.props.ShieldsText + ")");
    S.r.result = null;

    M.tokens.npc1.props.Injuries = JSON.stringify([{ id: "gm1", name: "GM's earlier hit", severity: 2, kind: "stun", treated: false }]);
    A.newRoll("pc1"); A.startAction(A.actionById("pc_ranged")); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "npc1"; window.MockDice = [1, 2]; await A.doRoll();
    await A.applyPersonalAttack();
    const inj9 = JSON.parse(M.tokens.npc1.props.Injuries);
    ok(inj9.length === 2 && inj9[0].id === "gm1", "attack adds to the Injuries the GM applied meanwhile (" + inj9.length + ")");
    S.r.result = null;

    M.ctx.isGM = true; await A.reload();
    const sh = A.tok("ship1");
    M.tokens.ship1.props.Breaches = JSON.stringify({ Sensors: { count: 2, patched: false } });   // another client added breaches
    S.tab = "ship"; S.shipId = "ship1"; A.render();            // window still shows 0 on Sensors
    const row = [...document.querySelectorAll("tr")].find(tr => /^Sensors/.test(tr.textContent));
    row.querySelector(".stepper button:last-child").click();
    await until(() => (JSON.parse(M.tokens.ship1.props.Breaches || "{}").Sensors || {}).count === 3);
    ok((JSON.parse(M.tokens.ship1.props.Breaches).Sensors || {}).count === 3, "breach + adds one to the current count (2 -> 3), not 0 -> 1");
    M.tokens.npc1.props.Injuries = "[]"; M.tokens.npc1.props.Defeated = 0; M.tokens.ship1.props.Breaches = "{}"; M.tokens.ship1.props.Shields = 16;
    await A.reload(); S.tab = "roll";

    // ---- 10. Version shown; regenerate refused while shields are lowered; on-screen tokens refresh by themselves ----
    ok(document.querySelector(".brand").textContent.replace(/\s+/g, "").endsWith(VERSION), "header shows the add-on version " + VERSION + " (" + document.querySelector(".brand").textContent + ")");
    M.tokens.ship1.props.ShieldsRaised = 0; M.tokens.ship1.props.Shields = 0; M.tokens.ship1.props.ReservePower = 1; await A.reload();
    A.newRoll("pc1"); A.startAction(A.actionById("ops_regen")); window.MockDice = [1, 2, 3]; await A.doRoll();
    ok(!S.r.result && /shields are lowered/.test((document.querySelector(".toast") || {}).textContent || ""), "Regenerate Shields refused while shields are lowered");
    ok(Number(M.tokens.ship1.props.ReservePower) === 1, "...and Reserve Power isn't spent");
    M.tokens.ship1.props.ShieldsRaised = 1; M.tokens.ship1.props.Shields = 16; await A.reload();
    S.tab = "ship"; S.shipId = "ship1"; A.render();
    M.tokens.ship1.props.Shields = 7;       // another client damages the ship; this window does nothing
    const seen = await until(() => /Shields 7 \/ 16/.test(document.body.textContent), 9000);
    ok(seen, "Ship tab shows another client's change within a few seconds, without pressing reload");
    M.tokens.ship1.props.Shields = 16; await A.reload(); S.tab = "roll";

    // ---- 11. Ship combat: Shaken picked by the commanding officer, Losing Power, Brace, Dampening, Cumbersome ----
    const effects = (id) => JSON.parse(M.tokens[id].props.Effects || "[]");
    const hasEff = (id, key) => effects(id).some(e => e.key === key);
    // Incoming damage that takes the players' ship from full to between 25% and 50%: one Shaken result.
    async function incomingTo(id, extra) {
      await A.reload();
      const s = A.tok(id), mx = R.shieldsMax(s.p), fin = Math.ceil(mx * 0.6);
      M.tokens[id].props.Shields = mx; await A.reload();
      S.dmgTool = Object.assign({ damage: fin + R.resistance(A.tok(id).p), piercing: false, depleting: false, highYield: false, comps: 0, system: "Structure" }, extra || {});
      S.tab = "ship"; S.shipId = id; A.render();
      const before = M.log.length;
      const card = [...document.querySelectorAll(".card")].find(c => /^Incoming damage/.test((c.querySelector("h3") || {}).textContent || ""));
      [...card.querySelectorAll("button")].find(b => b.textContent === "Apply").click();
      await until(() => M.log.length > before);
    }
    const R = window.Rules;
    M.ctx.isGM = true; M.tokens.ship1.props.Effects = "[]"; M.tokens.ship2.props.Effects = "[]";
    M.tokens.ship1.props.ReservePower = 1; M.tokens.ship1.props.RegainAttempts = 0;
    await incomingTo("ship1");
    ok(effects("ship1").some(e => e.key === "shaken" && Number(e.count) === 1), "PC ship shaken: a Shaken result is left for the commanding officer (" + M.tokens.ship1.props.Effects + ")");
    ok(/commanding officer picks a result/.test(lastChat()), "damage card says the commanding officer picks");
    A.render();
    const shakenCard = () => [...document.querySelectorAll(".card")].find(c => /^Shaken/.test((c.querySelector("h3") || {}).textContent || ""));
    ok(!!shakenCard(), "Ship tab shows the Shaken card");
    [...shakenCard().querySelectorAll("button")].find(b => b.textContent === "Losing Power!").click();
    await until(() => !hasEff("ship1", "shaken"));
    ok(!hasEff("ship1", "shaken") && hasEff("ship1", "losingPower") && Number(M.tokens.ship1.props.ReservePower) === 0, "Losing Power: Reserve Power lost, Losing Power effect added, nothing left to pick");
    ok(/Losing Power!/.test(lastChat()), "chat card reports the pick");
    A.newRoll("pc1"); A.startAction(A.actionById("ops_regain"));
    ok(S.r.baseDiff === 2 && /Losing Power/.test(S.r.diffNote), "next Regain Power is +1 Difficulty (" + S.r.baseDiff + ", " + S.r.diffNote + ")");
    window.MockDice = [1, 1, 1]; await A.doRoll();
    await until(() => !hasEff("ship1", "losingPower"));
    ok(!hasEff("ship1", "losingPower") && Number(M.tokens.ship1.props.RegainAttempts) === 1, "the Regain Power attempt uses up the Losing Power penalty");
    S.r.result = null;

    await incomingTo("ship1");
    A.render();
    window.MockDice = [19, 20, 3];
    [...shakenCard().querySelectorAll("button")].find(b => b.textContent === "Roll d20").click();
    await until(() => !hasEff("ship1", "shaken"));
    ok(hasEff("ship1", "brace") && /d20: 19, 20, 3/.test(lastChat()), "Roll d20: 19 and 20 roll again, 3 is Brace for Impact (" + lastChat().replace(/<[^>]+>/g, "").slice(-60) + ")");
    A.newRoll("pc1"); A.startAction(A.actionById("tac_trait")); S.tab = "roll"; A.render();
    ok(/Brace for Impact on U\.S\.S\. Veritas: no major action/.test(document.body.textContent), "major action from aboard a braced ship shows the Brace for Impact notice");

    await incomingTo("ship2");
    ok(hasEff("ship2", "brace") && !hasEff("ship2", "shaken") && /NPC ships always brace/.test(lastChat()), "NPC ship shaken: Brace for Impact applied, no pick");

    M.tokens.ship1.props.Effects = "[]"; M.tokens.ship1.props.ReservePower = 1;
    await incomingTo("ship1", { dampening: true, damage: 1 });
    ok(Number(M.tokens.ship1.props.ReservePower) === 0 && /Dampening/.test(lastChat()), "incoming Dampening damage drains Reserve Power");

    // Positron torpedoes: Calibration, Cumbersome, Dampening.
    M.tokens.ship1.props.ShipWeapons = JSON.stringify([{ kind: "torpedo", type: "Positron", name: "Positron Torpedoes" }]);
    M.tokens.ship1.props.Effects = "[]"; M.tokens.ship2.props.Effects = "[]"; M.tokens.ship2.props.ReservePower = 1;
    M.lib.Momentum = 0; M.lib.Threat = 6; await A.reload();
    A.newRoll("pc1"); A.startAction(A.actionById("tac_fire_torpedo")); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "ship2"; S.r.atk.salvo = true; S.tab = "roll"; A.render();
    const salvoBox = [...document.querySelectorAll("label")].find(l => /^Salvo/.test(l.textContent));
    ok(salvoBox && salvoBox.querySelector("input").disabled && !S.r.atk.salvo, "Cumbersome torpedo: salvo box disabled and cleared (" + (salvoBox && salvoBox.textContent) + ")");
    ok(/\+1 Cumbersome/.test(document.body.textContent), "Cumbersome shows in the Difficulty");
    window.MockDice = [1, 1, 1]; await A.doRoll();
    ok(S.r.result && S.r.result.difficulty === 4, "Cumbersome torpedo attack is Difficulty 3 + 1 = " + (S.r.result && S.r.result.difficulty));
    ok(M.lib.Threat === 7, "single torpedo adds 1 Threat, not a salvo's 3 (Threat " + M.lib.Threat + ")");
    window.MockDice = [12];
    await A.applyShipAttack();
    ok(Number(M.tokens.ship2.props.ReservePower) === 0 && /Dampening: Klingon Bird-of-Prey loses its Reserve Power/.test(lastChat()), "Dampening torpedo hit drains the target's Reserve Power");
    S.r.result = null;
    M.tokens.ship1.props.ShipWeapons = JSON.stringify([{ kind: "energy", type: "Phaser", delivery: "Arrays", name: "Phaser Arrays" }, { kind: "torpedo", type: "Photon", name: "Photon Torpedoes" }]);
    ["ship1", "ship2"].forEach(id => { const p = M.tokens[id].props; p.Effects = "[]"; p.ReservePower = 1; p.RegainAttempts = 0; p.Breaches = "{}"; });
    M.tokens.ship1.props.Shields = 16; await A.reload(); S.tab = "roll";

    // ---- 12. Shared data: assists, opposed target, extended progress, End Scene ----
    M.ctx.isGM = false; M.lib.Opposed = null; await A.reload();
    // Another player banked an assist for Vale a moment ago; this window hasn't seen it.
    M.lib.Assists = { pc1: [{ id: "other", fromId: "npc1", fromName: "Someone", attr: "Control", dept: "Command", tn: 10, critMax: 1, dice: [5], at: 1 }] };
    S.lib.Assists = {};
    A.newRoll("pc2"); Object.assign(S.r, { mode: "assist", attr: "Control", dept: "Medicine", targets: ["pc1"] });
    window.MockDice = [4]; await A.doRoll();
    ok(M.lib.Assists.pc1 && M.lib.Assists.pc1.length === 2 && M.lib.Assists.pc1[0].id === "other", "banking an assist keeps one another player banked meanwhile (" + (M.lib.Assists.pc1 || []).length + " banked)");
    S.r.result = null;
    M.lib.Momentum = 3; await A.refreshPools();
    M.lib.Assists.pc1.push({ id: "late", fromId: "pc2", fromName: "Dr. Yilil", attr: "Control", dept: "Medicine", tn: 10, critMax: 1, dice: [6], at: 2 });
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1 });
    window.MockDice = [1, 2]; await A.doRoll();
    ok(S.r.result && S.r.result.assists.length === 2, "task uses the 2 assists this window knew about");
    ok(M.lib.Assists.pc1 && M.lib.Assists.pc1.length === 1 && M.lib.Assists.pc1[0].id === "late", "using assists removes only those, keeping one banked meanwhile");
    A.finishRoll(); await until(() => !S.r.result);

    A.newRoll("pc2"); Object.assign(S.r, { mode: "opposed", attr: "Control", dept: "Medicine", opposeId: "npc1" }); S.tab = "roll"; A.render();
    ok(/Against/.test(document.body.textContent), "opposed roll asks who it's against");
    window.MockDice = [1, 2]; await A.doRoll();
    ok(M.lib.Opposed && M.lib.Opposed.forId === "npc1" && M.lib.Opposed.forName === "Jem'Hadar Soldier", "opposed Difficulty stored against the Jem'Hadar");
    S.r.result = null;
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1 }); A.render();
    ok(/is waiting for Jem'Hadar Soldier/.test(document.body.textContent) && !/Opposed: Dr\. Yilil/.test(document.body.textContent), "another roller doesn't pick it up");
    A.newRoll("npc1"); Object.assign(S.r, { attr: "Control", dept: "Security" }); A.render();
    ok(/Opposed: Dr\. Yilil set Difficulty/.test(document.body.textContent), "the named attacker picks it up");

    M.ctx.isGM = true;
    M.lib.Extended = { list: [
      { id: "x1", kind: "task", name: "Repair the core", track: 10, progress: 0, difficulty: 1, resistance: 0, breakthroughs: false, log: [] },
      { id: "x2", kind: "task", name: "Decode", track: 8, progress: 0, difficulty: 1, resistance: 0, breakthroughs: false, log: [] }] };
    M.ctx.isGM = false; await A.reload();
    M.lib.Extended.list[0].progress = 3; M.lib.Extended.list[1].name = "Decode the signal";   // meanwhile, elsewhere
    A.startExtended("x1"); Object.assign(S.r, { tokenId: "pc1", attr: "Control", dept: "Engineering" });
    window.MockDice = [1, 2]; await A.doRoll();
    const mark = btn(/^Mark \d+ space/);
    const n = mark ? Number(mark.textContent.match(/\d+/)[0]) : 0;
    mark && mark.click(); await until(() => M.lib.Extended.list[0].progress !== 3);
    ok(n > 0 && M.lib.Extended.list[0].progress === Math.min(10, 3 + n), "marking progress adds to what others marked meanwhile (3 + " + n + " = " + M.lib.Extended.list[0].progress + ")");
    ok(M.lib.Extended.list[1].name === "Decode the signal", "a change to another task made meanwhile is kept");
    r = await A.api("extendedPatch", { id: "x1", patch: { difficulty: 0 } });
    ok(r.ok === 0 && r.refused.join() === "difficulty" && M.lib.Extended.list[0].difficulty === 1, "player can't change a task's Difficulty through extendedPatch");
    S.r.result = null;

    M.ctx.isGM = true; await A.reload();
    M.lib.Assists = { pc1: [{ id: "old", fromId: "pc2", fromName: "Dr. Yilil", tn: 10, critMax: 1, dice: [3], at: 3 }] }; await A.refreshPools();
    S.tab = "gm"; A.render();
    btn(/^End scene$/).click(); await until(() => !Object.keys(M.lib.Assists || {}).length);
    ok(!Object.keys(M.lib.Assists || {}).length && !(M.lib.Opposed && M.lib.Opposed.value !== undefined), "End Scene clears banked assists and the opposed Difficulty");
    // Another client banks an assist; the GM tab's Pending list shows it without pressing reload.
    S.tab = "gm"; A.render();
    M.lib.Assists = { pc1: [{ id: "bg", fromId: "pc2", fromName: "Dr. Yilil", tn: 10, critMax: 1, dice: [4], at: 4 }] };
    const pendingSeen = await until(() => /Dr\. Yilil \u2192 Lt\. Jordan Vale|Dr\. Yilil.*Jordan Vale/.test(document.body.textContent), 9000);
    ok(pendingSeen, "GM tab shows an assist banked on another client within a few seconds");
    M.lib.Extended = { list: [] }; M.lib.Assists = {}; M.lib.Opposed = null;
    ["ship1", "ship2"].forEach(id => { M.tokens[id].props.Effects = "[]"; });
    await A.reload(); S.tab = "roll";

    // ---- 13. Characters: Recover Stress cap, Avoid Injury and Defeated, Supporting without Values, Succeed at Cost ----
    const pick = (sel, value) => { sel.value = value; sel.dispatchEvent(new Event("change", { bubbles: true })); };
    M.lib.Momentum = 6; M.tokens.pc2.props.Stress = 5; await A.reload();
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 1 }); S.tab = "roll"; A.render();
    window.MockDice = [1, 2]; await A.doRoll();
    for (let i = 1; i <= 2; i++) { btn(/^Recover 1 Stress/).click(); await until(() => S.r.result.extra.stressBought === i); }
    const stressSel = [...document.querySelectorAll("select")].find(x => [...x.options].some(o => o.value === "pc2"));
    pick(stressSel, "pc2"); await until(() => Number(M.tokens.pc2.props.Stress) === 3);
    ok(Number(M.tokens.pc2.props.Stress) === 3, "2 Stress recovered for Dr. Yilil (5 -> " + M.tokens.pc2.props.Stress + ")");
    ok(!btn(/^Recover 1 Stress/).disabled, "a third can still be bought");
    btn(/^Recover 1 Stress/).click(); await until(() => S.r.result.extra.stressBought === 3);
    ok(btn(/^Recover 1 Stress/).disabled && /3 of 3/.test(document.body.textContent), "after 3 in total on this task, Recover Stress can't be bought again");
    A.finishRoll(); await until(() => !S.r.result);

    // Dr. Yilil had an older, treated Injury and was back on her feet; a new hit is avoided: she isn't Defeated.
    M.tokens.pc2.props.Stress = 0; M.tokens.pc2.props.Defeated = 0;
    M.tokens.pc2.props.Injuries = JSON.stringify([{ id: "old1", name: "Old burn", severity: 1, kind: "stun", treated: true }]);
    M.lib.Threat = 6; await A.reload();
    A.newRoll("npc1"); A.startAction(A.actionById("pc_ranged")); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "pc2"; window.MockDice = [1, 2]; await A.doRoll();
    await A.applyPersonalAttack();
    const injP = JSON.parse(M.tokens.pc2.props.Injuries);
    ok(injP.length === 2 && injP[1].prevDefeated === 0 && Number(M.tokens.pc2.props.Defeated) === 1, "the hit records that she wasn't Defeated before it");
    S.r.result = null; S.tab = "character"; S.charId = "pc2"; A.render();
    const newRow = [...document.querySelectorAll("tr")].find(tr => /Plasma Rifle wound/.test(tr.textContent));
    [...newRow.querySelectorAll("button")].find(b => /^Avoid \(/.test(b.textContent)).click();
    await until(() => JSON.parse(M.tokens.pc2.props.Injuries).length === 1);
    ok(Number(M.tokens.pc2.props.Defeated) === 0 && JSON.parse(M.tokens.pc2.props.Injuries)[0].id === "old1", "avoiding the new Injury leaves her not Defeated, with the old one kept");
    M.tokens.pc2.props.Injuries = "[]"; M.tokens.pc2.props.Stress = 0; M.tokens.pc2.props.Defeated = 0;

    // A supporting character with no Values is Defeated outright.
    M.tokens.npc1.props.Kind = "Supporting"; M.tokens.npc1.props.Values = "[]"; M.tokens.npc1.props.Injuries = "[]"; M.tokens.npc1.props.Defeated = 0; await A.reload();
    A.newRoll("pc1"); A.startAction(A.actionById("pc_ranged")); Object.assign(S.r, { attr: "Control", dept: "Security" });
    S.r.atk.target = "npc1"; window.MockDice = [1, 2]; await A.doRoll();
    await A.applyPersonalAttack();
    ok(Number(M.tokens.npc1.props.Defeated) === 1 && JSON.parse(M.tokens.npc1.props.Injuries).length === 0 && /no Values can't Avoid Injury/.test(lastChat()), "Supporting with no Values: Defeated, no Injury record to avoid");
    S.r.result = null;
    M.tokens.npc1.props.Kind = "Notable NPC"; M.tokens.npc1.props.Defeated = 0; M.tokens.npc1.props.Injuries = "[]";

    // Succeed at Cost: the GM's call for players, except where the action allows it.
    M.ctx.isGM = false; M.lib.Settings = {}; await A.reload();
    A.newRoll("pc1"); Object.assign(S.r, { attr: "Control", dept: "Engineering", baseDiff: 5 }); S.tab = "roll"; A.render();
    window.MockDice = [15, 16]; await A.doRoll();
    ok(S.r.result && !S.r.result.success && !btn(/^Succeed at Cost$/) && /the GM's call/.test(document.body.textContent), "player's failed task: no Succeed at Cost button, says it's the GM's call");
    M.lib.Settings = { sacPlayers: true };
    const offered = await until(() => !!btn(/^Succeed at Cost$/), 7500);
    ok(offered && S.r.result, "GM turns on the setting: the button appears on the open result within a few seconds");
    btn(/^Succeed at Cost$/).click(); await until(() => S.r.result.sac);
    ok(S.r.result.sac && S.r.result.success, "player succeeds at cost");
    S.r.result = null; M.lib.Settings = {}; await A.refreshPools();
    M.tokens.ship1.props.ReservePower = 0; await A.reload();
    A.newRoll("pc1"); A.startAction(A.actionById("ops_regain")); S.r.baseDiff = 5; A.render();
    window.MockDice = [15, 16, 17]; await A.doRoll();
    ok(S.r.result && !S.r.result.success && !!btn(/^Succeed at Cost$/), "Regain Power allows Succeed at Cost without the setting");
    S.r.result = null; M.ctx.isGM = true; M.tokens.ship1.props.ReservePower = 1; M.tokens.ship1.props.RegainAttempts = 0;
    await A.reload(); S.tab = "roll";
    return out;
  }, VERSION);
  results.forEach(l => console.log(l));

  // Remote window: player rolls pay and bank through poolAdd
  const p2 = await browser.newPage();
  p2.on("pageerror", e => errors.push("remote pageerror: " + e.message));
  p2.on("console", m => { if (m.type() === "error") errors.push("remote console: " + m.text()); });
  await p2.goto("file://" + path.resolve(remotePath));
  await p2.waitForFunction(() => window.App && App.X && !App.S.loading && App.S.order.length > 0);
  const r2 = await p2.evaluate(async () => {
    const A = App, X = A.X, M = MockBackend, out = [];
    const ok = (c, n) => out.push((c ? "PASS " : "FAIL ") + "remote: " + n);
    X.assign = { c1: { tokens: [{ id: "pc1", map: "Bridge" }] } }; X.conns = [{ id: "c1", name: "Ann" }];
    M.lib.Momentum = 3; M.lib.Threat = 6;
    window.MockDice = [1, 2, 3];
    const v = await A.remoteRunners.roll("c1", { tokenId: "pc1", attr: "Control", dept: "Engineering", difficulty: 1, buy: 1 });
    ok(M.lib.Momentum === 2, "bought die paid from pool (" + M.lib.Momentum + ")");
    ok(v.momentum === 3, "roll made 3 Momentum");
    await A.remoteRunners.rollAction("c1", { rollId: v.rollId, action: "spend", key: "info" });
    ok(M.lib.Momentum === 2, "spend taken from the roll's own Momentum first");
    const f = await A.remoteRunners.rollAction("c1", { rollId: v.rollId, action: "finish" });
    ok(M.lib.Momentum === 4 && f.banked === 2, "2 leftover banked as a delta (pool " + M.lib.Momentum + ")");
    M.lib.Momentum = 0;
    let err = ""; try { await A.remoteRunners.roll("c1", { tokenId: "pc1", attr: "Control", dept: "Engineering", difficulty: 1, buy: 1 }); } catch (e) { err = e.message; }
    ok(/Not enough Momentum/.test(err) && M.lib.Momentum === 0, "refuses when the pool is empty");
    M.lib.Settings = {}; M.lib.Momentum = 2;
    window.MockDice = [15, 16];
    const fl = await A.remoteRunners.roll("c1", { tokenId: "pc1", attr: "Control", dept: "Engineering", difficulty: 5 });
    err = ""; try { await A.remoteRunners.rollAction("c1", { rollId: fl.rollId, action: "sac" }); } catch (e) { err = e.message; }
    ok(/GM's call/.test(err), "Succeed at Cost refused for a remote player unless the GM allows it");
    M.lib.Settings = { sacPlayers: true };
    const sc = await A.remoteRunners.rollAction("c1", { rollId: fl.rollId, action: "sac" });
    ok(sc && sc.sac, "allowed once the GM turns it on");
    M.lib.Settings = {};
    return out;
  });
  r2.forEach(l => console.log(l));
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
  await browser.close();
  const all = results.concat(r2);
  const failed = all.filter(l => !l.startsWith("PASS")).length;
  console.log((all.length - failed) + " passed, " + failed + " failed" + (errors.length ? ", " + errors.length + " page errors" : ""));
  process.exit(failed || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
