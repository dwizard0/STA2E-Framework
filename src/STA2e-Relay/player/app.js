/*
 * STA 2E Remote: player page.
 * Talks only to ../api.php. The GM's MapTool (STA2e Remote add-on) does the actual rolling and
 * checks that this connection is allowed to act as each character.
 */
(function () {
  "use strict";
  var API = "../api.php";
  var KEY = "sta2e-remote-token";
  var REQ_KEY = "sta2e-remote-request";
  var LOBBY_MS = 4000;
  var POLL_MS = 2000, POLL_HIDDEN_MS = 10000;
  var COST = [0, 1, 3, 6];   // total Momentum/Threat for 0-3 bought dice (1, then 2, then 3 each)

  var S = {
    token: "", name: "", gmOnline: false, snap: null, results: [], seen: {}, pending: {},
    charId: "", error: "", loaded: false,
    roll: { attr: "", dept: "", focus: "", difficulty: 1, buy: 0, pay: "momentum", perfect: false, useMods: true, label: "",
      compRange: 1, bonusDice: 0, bonusMomentum: 0, ship: false, shipSystem: "", shipDept: "" },
    lastRoll: null, chatText: "", showRef: false, spendReason: "", pick: {}, stressTarget: "",
    view: "sheet", actGroup: "Command", catalog: null, rerouteTo: "",
    lobby: { campaigns: null, open: "", pin: "", name: "", error: "", busy: false, req: null, reqStatus: "" }
  };

  /* ---------------- helpers ---------------- */
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function toast(msg, ok) {
    var old = document.querySelector(".toast"); if (old) old.remove();
    var el = h("div", { class: "toast" + (ok ? " ok" : "") }, msg);
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, ok ? 2500 : 6000);
  }
  function api(body) {
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
      .then(function (r) { return r.json(); });
  }
  var ERR = {
    badToken: "This link isn't valid any more. Ask your GM for a new one.",
    busy: "Slow down: several commands are still waiting for the GM's MapTool.",
    badCommand: "That isn't something this page can do."
  };

  /* ---------------- data ---------------- */
  function char() {
    var list = (S.snap && S.snap.characters) || [];
    var c = list.filter(function (x) { return x.id === S.charId; })[0] || list[0] || null;
    if (c && c.id !== S.charId) { S.charId = c.id; resetRoll(); }
    return c;
  }
  function resetRoll() {
    var r = S.roll;
    r.attr = ""; r.dept = ""; r.focus = ""; r.buy = 0; r.perfect = false; r.label = "";
    r.compRange = 1; r.bonusDice = 0; r.bonusMomentum = 0; r.shipDept = ""; r.extendedId = "";
  }

  var pollTimer = null;
  function poll() {
    clearTimeout(pollTimer);
    if (!S.token) return;
    api({ action: "player.state", token: S.token, catalogVersion: S.catalog ? S.catalog.version : "" }).then(function (res) {
      if (!res.ok) {
        S.error = ERR[res.error] || ("Server: " + res.error);
        if (res.error === "badToken") {
          forgetToken();
          S.lobby.error = "Your saved connection stopped working (the GM may have removed it). Pick your connection again.";
          render(); lobbyPoll(); return;
        }
      } else {
        S.error = "";
        S.name = res.name; S.gmOnline = !!res.gmOnline; S.snap = res.snapshot; S.loaded = true;
        if (res.catalog) S.catalog = res.catalog;
        handleResults(res.results || []);
      }
      render();
      pollTimer = setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    }).catch(function () {
      S.error = "Can't reach the server. Retrying…";
      render();
      pollTimer = setTimeout(poll, POLL_MS * 2);
    });
  }
  function handleResults(list) {
    S.results = list;
    list.forEach(function (r) {
      var done = r.status === "done" || r.status === "error" || r.status === "expired" || r.status === "cancelled";
      if (!done) return;
      var mine = S.pending[r.id];
      delete S.pending[r.id];
      if (S.seen[r.id]) return;
      S.seen[r.id] = 1;
      if (!mine) return;   // finished before this page loaded
      if (r.status !== "done") { toast(r.error || "The GM's MapTool couldn't do that."); return; }
      if (r.type === "roll" || r.type === "rollAction") { S.lastRoll = r.result; S.pick = {}; }
      else if (r.type === "stress") toast("Stress is now " + r.result.stress + " / " + r.result.stressMax, true);
      else if (r.type === "determination") toast("Determination spent (" + r.result.determination + " left)", true);
      else if (r.type === "chat") toast("Sent", true);
      else if (r.type === "action") toast(r.result.action + ": done", true);
    });
  }
  function send(cmd) {
    return api({ action: "player.command", token: S.token, cmd: cmd }).then(function (res) {
      if (!res.ok) { toast(ERR[res.error] || ("Server: " + res.error)); return; }
      S.pending[res.id] = cmd.type;
      S.seen[res.id] = 0;
      render();
      poll();
    }).catch(function () { toast("Can't reach the server."); });
  }
  function pendingCount(type) {
    return Object.keys(S.pending).filter(function (k) { return !type || S.pending[k] === type; }).length;
  }

  /* ---------------- lobby: pick a connection ---------------- */
  var lobbyTimer = null;
  function saveToken(t) {
    S.token = t;
    try { localStorage.setItem(KEY, t); } catch (e) { /* private mode: works until the tab closes */ }
  }
  function forgetToken() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    S.token = ""; S.snap = null; S.loaded = false; S.error = ""; S.lastRoll = null;
    clearTimeout(pollTimer);
  }
  function lobbyPoll() {
    clearTimeout(lobbyTimer);
    if (S.token) return;
    var L = S.lobby;
    var next = function () { lobbyTimer = setTimeout(lobbyPoll, L.req ? POLL_MS : LOBBY_MS); };
    var job = L.req ? api({ action: "lobby.poll", campaign: L.req.campaign, request: L.req.request, key: L.req.key }).then(function (res) {
      if (!res.ok) { L.req = null; L.reqStatus = ""; storeReq(null); L.error = "Your request expired. Ask again."; return; }
      if (res.status === "approved" && res.token) { L.req = null; storeReq(null); joined(res.token); return; }
      if (res.status === "denied") { L.req = null; storeReq(null); L.error = "The GM said no to that request."; }
      else if (res.status === "expired") { L.req = null; storeReq(null); L.error = "The GM didn't answer in time. Ask again."; }
      else L.reqStatus = res.status;
    }) : api({ action: "lobby.list" }).then(function (res) { L.campaigns = res.ok ? res.campaigns : []; });
    job.then(function () { if (!S.token) { render(); next(); } }).catch(function () { L.error = "Can't reach the server. Retrying…"; render(); next(); });
  }
  function storeReq(r) {
    try { if (r) localStorage.setItem(REQ_KEY, JSON.stringify(r)); else localStorage.removeItem(REQ_KEY); } catch (e) { /* ignore */ }
  }
  function joined(token) {
    var L = S.lobby;
    saveToken(token);
    L.open = ""; L.pin = ""; L.error = ""; L.busy = false;
    clearTimeout(lobbyTimer);
    toast("Connected", true);
    render();
    poll();
  }
  function joinWithPin(camp, c) {
    var L = S.lobby;
    if (!/^\d{4,8}$/.test(L.pin)) { toast("Enter the PIN your GM gave you."); return; }
    L.busy = true; render();
    api({ action: "lobby.join", campaign: camp.campaign, conn: c.id, pin: L.pin }).then(function (res) {
      L.busy = false;
      if (res.ok) { joined(res.token); return; }
      L.pin = "";
      L.error = res.error === "badPin" ? "Wrong PIN." + (res.left ? " " + res.left + " tries left before it locks for a while." : " It's locked for a while now; ask the GM to let you in instead.") :
        res.error === "pinLocked" ? "Too many wrong PINs. Try again in " + Math.ceil((res.retryIn || 600) / 60) + " min, or ask the GM to let you in." :
        res.error === "notOnline" ? "That game isn't running right now." : "Server: " + res.error;
      render();
    }).catch(function () { L.busy = false; toast("Can't reach the server."); render(); });
  }
  function askGm(camp, c) {
    var L = S.lobby;
    var name = L.name.trim();
    if (!name) { toast("Type your name so the GM knows who's asking."); return; }
    try { localStorage.setItem("sta2e-remote-name", name); } catch (e) { /* ignore */ }
    L.busy = true; render();
    api({ action: "lobby.request", campaign: camp.campaign, conn: c.id, name: name }).then(function (res) {
      L.busy = false;
      if (!res.ok) { L.error = res.error === "busy" ? "The GM has a lot of requests waiting. Try again in a minute." : res.error === "notOnline" ? "That game isn't running right now." : "Server: " + res.error; render(); return; }
      L.req = { campaign: camp.campaign, request: res.request, key: res.key, conn: c.name, game: camp.name };
      storeReq(L.req);
      L.reqStatus = "pending"; L.error = "";
      render(); lobbyPoll();
    }).catch(function () { L.busy = false; toast("Can't reach the server."); render(); });
  }

  function lobbyView() {
    var L = S.lobby;
    var main = h("main", null, h("section", { class: "card" }, h("h2", null, "STA 2E Remote"),
      h("p", { class: "sub" }, "Pick your connection to play your character from this device. Games appear here while the GM's MapTool is connected.")));
    if (L.error) main.appendChild(h("div", { class: "banner" }, L.error));
    if (L.req) {
      main.appendChild(h("section", { class: "card waiting" }, h("h3", null, "Waiting for the GM"),
        h("p", null, "You asked to join ", h("b", null, L.req.conn), " in ", h("b", null, L.req.game), ". This page opens your character as soon as the GM approves."),
        h("button", { class: "btn", onclick: function () { L.req = null; storeReq(null); render(); lobbyPoll(); } }, "Cancel")));
      return main;
    }
    if (L.campaigns === null) { main.appendChild(h("div", { class: "banner info" }, "Looking for games…")); return main; }
    if (!L.campaigns.length) { main.appendChild(h("div", { class: "banner info" }, "No games are running right now. Once the GM turns on the remote link in MapTool, the game shows up here.")); return main; }
    L.campaigns.forEach(function (camp) {
      var card = h("section", { class: "card" }, h("h3", null, camp.name));
      camp.connections.forEach(function (c) {
        var key = camp.campaign + "/" + c.id, open = L.open === key;
        var row = h("button", { class: "conn" + (open ? " open" : ""), onclick: function () { L.open = open ? "" : key; L.pin = ""; L.error = ""; render(); } },
          h("span", { class: "dot" + (c.online ? " on" : "") }),
          h("span", { class: "cn" }, h("b", null, c.name), c.characters.length ? h("span", { class: "sub" }, c.characters.join(", ")) : h("span", { class: "sub" }, "no character yet")),
          h("span", { class: "chev" }, open ? "▾" : "▸"));
        card.appendChild(row);
        if (!open) return;
        var box = h("div", { class: "joinbox" });
        if (c.hasPin) {
          var pin = h("input", { type: "password", inputmode: "numeric", autocomplete: "off", maxlength: 8, placeholder: "PIN", value: L.pin, class: "pin" });
          pin.addEventListener("input", function () { L.pin = pin.value.replace(/\D/g, ""); });
          pin.addEventListener("keydown", function (e) { if (e.key === "Enter") joinWithPin(camp, c); });
          box.appendChild(h("div", { class: "row" }, pin,
            h("button", { class: "btn primary", disabled: L.busy ? true : null, onclick: function () { joinWithPin(camp, c); } }, "Join")));
          box.appendChild(h("div", { class: "or" }, "or"));
        }
        var nm = h("input", { type: "text", placeholder: "Your name", value: L.name, maxlength: 40 });
        nm.addEventListener("input", function () { L.name = nm.value; });
        box.appendChild(h("div", { class: "row" }, nm,
          h("button", { class: "btn" + (c.hasPin ? "" : " primary"), disabled: L.busy ? true : null, onclick: function () { askGm(camp, c); } }, "Ask the GM")));
        card.appendChild(box);
      });
      main.appendChild(card);
    });
    return main;
  }

  /* ---------------- views ---------------- */
  function header() {
    var p = (S.snap && S.snap.pools) || { momentum: 0, threat: 0, momentumCap: 6 };
    var pips = h("span", { class: "pips" });
    for (var i = 0; i < (p.momentumCap || 6); i++) pips.appendChild(h("span", { class: "pip" + (i < p.momentum ? " on" : "") }));
    return h("header", null,
      h("div", { class: "brand" }, "STA 2E"),
      h("div", { class: "who" }, h("div", { class: "nm" }, S.name || "Remote"),
        h("div", { class: "gm" + (S.gmOnline ? " on" : "") }, S.gmOnline ? "GM connected" : "GM not connected")),
      h("div", { class: "pools" },
        h("div", { class: "pool mom" }, h("span", { class: "lbl" }, "Momentum"), pips, h("b", null, String(p.momentum))),
        h("div", { class: "pool thr" }, h("span", { class: "lbl" }, "Threat"), h("b", null, String(p.threat)))));
  }

  function charTabs(list) {
    if (list.length < 2) return null;
    return h("nav", { class: "tabs" }, list.map(function (c) {
      return h("button", { class: "tab" + (c.id === S.charId ? " on" : ""), onclick: function () { S.charId = c.id; resetRoll(); S.lastRoll = null; render(); } }, c.name);
    }));
  }

  function statusCard(c) {
    var card = h("section", { class: "card" });
    card.appendChild(h("div", { class: "title" }, h("h2", null, c.name),
      h("div", { class: "sub" }, [c.rank, c.species, c.role].filter(Boolean).join(" · "))));
    var flags = [];
    if (c.dying) flags.push(h("span", { class: "flag bad" }, "Dying"));
    else if (c.defeated) flags.push(h("span", { class: "flag bad" }, "Defeated"));
    if (c.stressMax > 0 && c.stress >= c.stressMax) flags.push(h("span", { class: "flag warn" }, "Fatigued" + (c.fatiguedAttr ? ": " + c.fatiguedAttr + " shut down" : "")));
    if (flags.length) card.appendChild(h("div", { class: "flags" }, flags));

    if (c.stressMax > 0) {
      var track = h("div", { class: "track" });
      for (var i = 0; i < c.stressMax; i++) track.appendChild(h("span", { class: "box" + (i < c.stress ? " on" : "") }));
      var busy = pendingCount("stress") > 0;
      card.appendChild(h("div", { class: "row" }, h("span", { class: "lbl" }, "Stress " + c.stress + " / " + c.stressMax), h("span", { class: "grow" }),
        h("button", { class: "btn", disabled: busy || c.stress <= 0 ? true : null, onclick: function () { send({ type: "stress", tokenId: c.id, delta: -1 }); } }, "− 1"),
        h("button", { class: "btn", disabled: busy || c.stress >= c.stressMax ? true : null, onclick: function () { send({ type: "stress", tokenId: c.id, delta: 1 }); } }, "+ 1")));
      card.appendChild(track);
    }
    if (c.kind === "Main") {
      var dp = h("span", { class: "pips gold" });
      for (var j = 0; j < 3; j++) dp.appendChild(h("span", { class: "pip" + (j < c.determination ? " on" : "") }));
      var reason = h("input", { type: "text", placeholder: "What for? (optional)", value: S.spendReason, maxlength: 80 });
      reason.addEventListener("input", function () { S.spendReason = reason.value; });
      card.appendChild(h("div", { class: "row" }, h("span", { class: "lbl" }, "Determination"), dp, h("span", { class: "grow" }),
        h("button", { class: "btn gold", disabled: c.determination < 1 || pendingCount("determination") ? true : null, onclick: function () {
          send({ type: "determination", tokenId: c.id, reason: S.spendReason }); S.spendReason = "";
        } }, "Spend 1")));
      if (c.determination > 0) card.appendChild(reason);
    }
    if (c.injuries && c.injuries.length) {
      card.appendChild(h("div", { class: "lbl" }, "Injuries" + (c.protection ? " · Protection " + c.protection : "")));
      card.appendChild(h("ul", { class: "inj" }, c.injuries.map(function (i) {
        return h("li", null, i.name + " (" + (i.kind === "deadly" ? "Deadly" : "Stun") + " " + i.severity + (i.treated ? ", treated" : "") + ")");
      })));
    }
    return card;
  }

  function tileGrid(names, values, selected, onPick, cls) {
    return h("div", { class: "grid " + cls }, names.map(function (n) {
      return h("button", { class: "tile" + (selected === n ? " sel" : ""), onclick: function () { onPick(n); } },
        h("span", { class: "n" }, n), h("span", { class: "v" }, String(values[n])));
    }));
  }

  function stepRow(label, value, min, max, onSet, note) {
    return h("div", { class: "row" }, h("span", { class: "lbl" }, label), note ? h("span", { class: "sub" }, note) : null, h("span", { class: "grow" }),
      h("div", { class: "stepper" },
        h("button", { class: "btn", disabled: value <= min ? true : null, onclick: function () { onSet(Math.max(min, value - 1)); render(); } }, "\u2212"),
        h("b", null, String(value)),
        h("button", { class: "btn", disabled: value >= max ? true : null, onclick: function () { onSet(Math.min(max, value + 1)); render(); } }, "+")));
  }

  function shipBlock(c, r, ship) {
    var box = h("div", { class: "shipbox" + (r.ship ? " on" : "") });
    box.appendChild(h("label", { class: "check" },
      h("input", { type: "checkbox", checked: r.ship, onchange: function (e) { r.ship = e.target.checked; render(); } }),
      "Ship assists: " + ship.name + " (one d20, System + Department, always counts as focused)"));
    if (!r.ship) return box;
    var systems = Object.keys(ship.systems);
    if (!r.shipSystem || ship.destroyed.indexOf(r.shipSystem) >= 0) r.shipSystem = ship.rerouted && ship.destroyed.indexOf(ship.rerouted) < 0 ? ship.rerouted :
      systems.filter(function (k) { return ship.destroyed.indexOf(k) < 0; })[0] || "";
    var dept = r.shipDept || r.dept || "Command";
    var sysSel = h("select", null, systems.map(function (k) {
      var dead = ship.destroyed.indexOf(k) >= 0;
      var o = h("option", { value: k, disabled: dead ? true : null }, k + " " + ship.systems[k] + (dead ? " (destroyed)" : k === ship.rerouted ? " (Reserve Power)" : ""));
      if (k === r.shipSystem) o.selected = true;
      return o;
    }));
    sysSel.addEventListener("change", function () { r.shipSystem = sysSel.value; render(); });
    var deptSel = h("select", null, Object.keys(ship.depts).map(function (k) {
      var o = h("option", { value: k }, k + " " + ship.depts[k]); if (k === dept) o.selected = true; return o;
    }));
    deptSel.addEventListener("change", function () { r.shipDept = deptSel.value; render(); });
    box.appendChild(h("div", { class: "row two" }, h("label", { class: "field" }, "System", sysSel), h("label", { class: "field" }, "Department", deptSel)));
    var tn = (ship.systems[r.shipSystem] || 0) + (ship.depts[dept] || 0);
    box.appendChild(h("div", { class: "sub" }, "Ship TN " + tn + ", crit 1\u2013" + Math.max(1, ship.depts[dept] || 0) +
      (r.shipSystem && r.shipSystem === ship.rerouted ? ". Reserve Power is routed here: the ship's die counts as a 1, but its complications count double." : ".")));
    return box;
  }

  function rollCard(c) {
    var r = S.roll, snap = S.snap;
    var card = h("section", { class: "card", id: "rollcard" }, h("h3", null, "Roll a task"));
    if (r.actionName) card.appendChild(h("div", { class: "actionnote" }, h("b", null, r.actionName),
      r.actionNote ? h("span", { class: "sub" }, " \u00b7 " + r.actionNote) : null,
      h("button", { class: "x", title: "Clear", onclick: function () { r.actionName = ""; r.actionNote = ""; render(); } }, "\u2715")));
    card.appendChild(tileGrid(snap.attributes, c.attrs, r.attr, function (n) { r.attr = n; render(); }, "attrs"));
    card.appendChild(tileGrid(snap.departments, c.depts, r.dept, function (n) { r.dept = n; render(); }, "depts"));

    var focusSel = h("select", null, [h("option", { value: "" }, "No focus")].concat((c.focuses || []).map(function (f) {
      var o = h("option", { value: f }, f); if (f === r.focus) o.selected = true; return o;
    })));
    focusSel.addEventListener("change", function () { r.focus = focusSel.value; render(); });
    card.appendChild(h("label", { class: "field" }, "Focus", focusSel));

    var diff = h("div", { class: "stepper" },
      h("button", { class: "btn", onclick: function () { r.difficulty = Math.max(0, r.difficulty - 1); render(); } }, "−"),
      h("b", null, String(r.difficulty)),
      h("button", { class: "btn", onclick: function () { r.difficulty = Math.min(5, r.difficulty + 1); render(); } }, "+"));
    card.appendChild(h("div", { class: "row" }, h("span", { class: "lbl" }, "Difficulty (from the GM)"), h("span", { class: "grow" }), diff));
    var xs = snap.extended || [];
    if (r.extendedId && !xs.some(function (x) { return x.id === r.extendedId; })) r.extendedId = "";
    if (xs.length) {
      var xsel = h("select", null, [h("option", { value: "" }, "\u2014 none \u2014")].concat(xs.map(function (x) {
        var o = h("option", { value: x.id }, x.name + " (" + x.progress + "/" + x.track + ", Diff " + x.difficulty + ")");
        if (x.id === r.extendedId) o.selected = true; return o;
      })));
      xsel.addEventListener("change", function () {
        r.extendedId = xsel.value;
        var x = xs.filter(function (y) { return y.id === r.extendedId; })[0];
        if (x) {
          r.difficulty = x.difficulty;
          if (x.shipSystem && snap.ship) { r.ship = true; r.shipSystem = x.shipSystem; }
        }
        render();
      });
      card.appendChild(h("label", { class: "field" }, "Toward extended task", xsel));
      var xcur = xs.filter(function (y) { return y.id === r.extendedId; })[0];
      if (xcur) card.appendChild(h("div", { class: "sub" }, "Resistance " + xcur.resistance + ". On a success, Done marks your department \u2212 Resistance (at least 1) on its track."));
    }
    var m = snap.mods || {};
    var modText = [];
    if (m.persistent) modText.push((m.persistent > 0 ? "+" : "") + m.persistent + (m.persistentReason ? " " + m.persistentReason : ""));
    if (m.oneTime) modText.push((m.oneTime > 0 ? "+" : "") + m.oneTime + (m.oneTimeReason ? " " + m.oneTimeReason : "") + " (next roll only)");
    if (modText.length) card.appendChild(h("label", { class: "check" }, h("input", { type: "checkbox", checked: r.useMods, onchange: function (e) { r.useMods = e.target.checked; } }),
      "Apply GM modifiers: " + modText.join(", ")));
    if (c.stressMax > 0 && c.stress >= c.stressMax) card.appendChild(h("div", { class: "note" }, "Fatigued: +1 Difficulty" + (c.fatiguedAttr ? ", and " + c.fatiguedAttr + " tasks automatically fail" : "") + "."));

    var pool = (snap.pools || {}).momentum || 0;
    card.appendChild(stepRow("Bonus dice", r.bonusDice, 0, 3, function (v) { r.bonusDice = v; if (r.buy > 3 - v) r.buy = 3 - v; }, "free: talents, advantages"));
    var room = 3 - r.bonusDice;   // no more than 5d20 in all
    if (r.buy > room) r.buy = room;
    var buyRow = h("div", { class: "seg" }, [0, 1, 2, 3].map(function (n) {
      return h("button", { class: "segbtn" + (r.buy === n ? " on" : ""), disabled: n > room ? true : null, onclick: function () { r.buy = n; render(); } }, n ? "+" + n + "d20" : "none");
    }));
    card.appendChild(h("div", { class: "lbl" }, "Buy dice"));
    card.appendChild(buyRow);
    if (r.buy) {
      var cost = COST[r.bonusDice + r.buy] - COST[r.bonusDice];   // free dice use up the cheaper slots (p.255)
      if (r.pay === "momentum" && cost > pool) r.pay = "threat";
      card.appendChild(h("div", { class: "seg small" },
        h("button", { class: "segbtn" + (r.pay === "momentum" ? " on" : ""), disabled: cost > pool ? true : null, onclick: function () { r.pay = "momentum"; render(); } }, "Pay " + cost + " Momentum"),
        h("button", { class: "segbtn" + (r.pay === "threat" ? " on" : ""), onclick: function () { r.pay = "threat"; render(); } }, "Give GM " + cost + " Threat")));
    }
    if (c.kind === "Main" && c.determination > 0) card.appendChild(h("label", { class: "check" },
      h("input", { type: "checkbox", checked: r.perfect, onchange: function (e) { r.perfect = e.target.checked; render(); } }),
      "Spend Determination: one die counts as a 1 (Perfect Opportunity)"));
    card.appendChild(stepRow("Complication range", r.compRange, 1, 5, function (v) { r.compRange = v; }, (21 - r.compRange) + "\u201320"));
    card.appendChild(stepRow("Bonus Momentum", r.bonusMomentum, 0, 9, function (v) { r.bonusMomentum = v; }, "on success: talents, weapons"));
    if (snap.ship) card.appendChild(shipBlock(c, r, snap.ship));
    var lbl = h("input", { type: "text", placeholder: "What are you trying to do? (optional)", value: r.label, maxlength: 80 });
    lbl.addEventListener("input", function () { r.label = lbl.value; });
    card.appendChild(lbl);

    if (openRoll()) {
      card.appendChild(h("div", { class: "banner info" }, "Finish the roll above first: spend or save its Momentum, then press Done."));
      return card;
    }
    var ready = r.attr && r.dept;
    var tn = ready ? c.attrs[r.attr] + c.depts[r.dept] : 0;
    var busy = pendingCount("roll") > 0;
    card.appendChild(h("button", { class: "btn primary big", disabled: !ready || busy || !S.gmOnline ? true : null, onclick: function () {
      send({ type: "roll", tokenId: c.id, attr: r.attr, dept: r.dept, focus: r.focus, difficulty: r.difficulty, buy: r.buy,
        pay: r.pay, perfect: r.perfect, useMods: r.useMods, label: r.label,
        compRange: r.compRange, bonusDice: r.bonusDice, bonusMomentum: r.bonusMomentum, extendedId: r.extendedId || "",
        ship: r.ship && snap.ship ? { id: snap.ship.id, system: r.shipSystem, dept: r.shipDept || r.dept } : null });
      r.perfect = false; r.buy = 0; r.label = ""; r.bonusDice = 0; r.bonusMomentum = 0; r.compRange = 1; r.extendedId = "";
    } }, busy ? "Rolling… waiting for the GM's MapTool" : !S.gmOnline ? "The GM's MapTool isn't connected" :
      ready ? "Roll " + (2 + r.bonusDice + r.buy) + "d20" + (r.ship && snap.ship ? " + ship" : "") + " · TN " + tn + (r.focus ? " · crit 1–" + c.depts[r.dept] : "") : "Pick an attribute and a department"));
    return card;
  }

  // The roll on screen: the open one the GM's MapTool is holding for us, or the last finished one.
  function openRoll() {
    var o = S.snap && S.snap.openRoll, l = S.lastRoll;
    if (l && o && l.rollId === o.rollId) return (l.v || 0) >= (o.v || 0) ? (l.open ? l : null) : o;
    if (l && l.open && !o && S.snap) return null;   // finished elsewhere (for example closed automatically)
    return o || (l && l.open ? l : null);
  }
  function shownRoll() {
    var o = openRoll();
    if (o) return o;
    return S.lastRoll && !S.lastRoll.open ? S.lastRoll : null;
  }
  function rollAct(x, action, extra) {
    var cmd = { type: "rollAction", rollId: x.rollId, action: action };
    Object.keys(extra || {}).forEach(function (k) { cmd[k] = extra[k]; });
    send(cmd);
  }
  function stat(label, value, cls) {
    return h("div", { class: "stat" + (cls ? " " + cls : "") }, h("span", { class: "k" }, label), h("b", null, String(value)));
  }
  function dieEl(d, extra, onclick) {
    var cls = "die" + (d.comp ? " comp" : d.successes === 2 ? " crit" : d.successes ? " hit" : "") + (extra || "");
    return onclick ? h("button", { class: cls, onclick: onclick }, String(d.value)) : h("span", { class: cls }, String(d.value));
  }

  function resultCard() {
    var x = shownRoll();
    if (!x) return null;
    var live = !!x.open;
    var busy = pendingCount("rollAction") > 0;
    var canPick = live && x.canReroll && !busy;
    var picks = Object.keys(S.pick).filter(function (k) { return S.pick[k]; }).map(Number);
    var card = h("section", { class: "card result " + (x.success ? "ok" : "bad") + (live ? " live" : "") });
    card.appendChild(h("div", { class: "row" },
      h("div", { class: "grow" }, h("b", null, x.name + ": " + x.attr + " + " + x.dept),
        h("div", { class: "sub" }, "TN " + x.tn + " \u00b7 crit 1\u2013" + x.critMax + (x.focus ? " (" + x.focus + ")" : "") + " \u00b7 " +
          x.diffParts.concat(x.compRange > 1 ? ["complications " + (21 - x.compRange) + "\u201320"] : [], x.bonusDice ? [x.bonusDice + " bonus d20"] : []).join(", "))),
      h("span", { class: "verdict " + (x.success ? "ok" : "bad") }, x.sac ? "SUCCESS AT COST" : x.success ? "SUCCESS" : "FAILURE"),
      live ? null : h("button", { class: "x", title: "Close", onclick: function () { S.lastRoll = null; render(); } }, "\u2715")));

    if (canPick) card.appendChild(h("div", { class: "sub" }, "Tap your dice to pick them for a re-roll."));
    card.appendChild(h("div", { class: "dice" }, x.dice.map(function (d, i) {
      return dieEl(d, S.pick[i] ? " pick" : "", canPick ? function () { S.pick[i] = !S.pick[i]; render(); } : null);
    })));
    if (x.ship) card.appendChild(h("div", { class: "shiproll" },
      h("span", { class: "sub" }, x.ship.name + (x.ship.rerouted ? " (Reserve Power)" : "") + (x.ship.counted ? "" : ": doesn't count, the leader scored no successes")),
      h("div", { class: "dice" }, x.ship.dice.map(function (d) { return dieEl(d, " ship"); }))));
    card.appendChild(h("div", { class: "stats" }, stat("Successes", x.successes), stat("Difficulty", x.difficulty),
      stat("Momentum", x.momentum, "mom"), stat("Complications", x.comps.length, x.comps.length ? "bad" : "")));
    if (x.shutdown) card.appendChild(h("div", { class: "note" }, "Fatigued: " + x.attr + " is shut down, so this task automatically fails."));
    if (x.extended) card.appendChild(extendedBox(x, live, busy));

    if (live && x.canReroll && picks.length) {
      var row = h("div", { class: "btnrow" });
      if (x.kind === "Main") row.appendChild(h("button", { class: "btn", disabled: busy || x.determination < 1 ? true : null,
        onclick: function () { rollAct(x, "reroll", { dice: picks, source: "determination" }); } }, "Re-roll " + picks.length + ": Moment of Inspiration (1 Determination)"));
      row.appendChild(h("button", { class: "btn", disabled: busy ? true : null,
        onclick: function () { rollAct(x, "reroll", { dice: picks, source: "free" }); } }, "Re-roll " + picks.length + ": free (Aim, talent, Targeting Solution)"));
      card.appendChild(row);
    }

    if (x.comps.length) {
      card.appendChild(h("div", { class: "lbl" }, "Complications"));
      x.comps.forEach(function (st, i) {
        card.appendChild(h("div", { class: "row" }, h("span", null, "Complication " + (i + 1) + (x.sac && i === x.comps.length - 1 ? " (cost of success)" : "")),
          h("span", { class: "grow" }),
          st === "bought" ? h("span", { class: "chip ok" }, "Avoided (+2 Threat)") :
            live ? h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { rollAct(x, "avoid", { index: i }); } }, "Add 2 Threat to avoid") :
              h("span", { class: "sub" }, "for the GM")));
      });
    }

    if (live && !x.success && !x.sac) card.appendChild(h("div", { class: "row" },
      h("span", { class: "sub grow" }, "Failed. If the GM offers it, you can Succeed at Cost: the task succeeds with one extra complication and no Momentum."),
      h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { rollAct(x, "sac"); } }, "Succeed at Cost")));

    if (live && x.spends && x.spends.length) {
      var avail = x.rollLeft + x.bonusLeft + x.pool;
      card.appendChild(h("div", { class: "lbl" }, "Spend Momentum"));
      card.appendChild(h("div", { class: "sub" }, "This roll: " + x.rollLeft + (x.bonusLeft ? " + " + x.bonusLeft + " bonus" : "") + " \u00b7 Group pool: " + x.pool));
      var sb = h("div", { class: "btnrow" });
      x.spends.forEach(function (sp) {
        if (sp.key === "stress") return;
        sb.appendChild(h("button", { class: "btn small", disabled: busy || sp.cost > avail ? true : null,
          onclick: function () { rollAct(x, "spend", { key: sp.key }); } }, sp.label + " (" + sp.cost + ")"));
      });
      card.appendChild(sb);
      var st = x.spends.filter(function (sp) { return sp.key === "stress"; })[0];
      // At most 3 Stress per character from one task (p.278). Older add-ons send only stressFixed, a total for the task.
      var hurt = (x.allies || []).filter(function (a) { return a.stress > 0 && (a.recovered || 0) < (st ? st.max : 3); });
      if (st && hurt.length && x.stressFixed < st.max) {
        if (!hurt.some(function (a) { return a.id === S.stressTarget; })) S.stressTarget = hurt[0].id;
        var sel = h("select", null, hurt.map(function (a) {
          var o = h("option", { value: a.id }, a.name + " (" + a.stress + "/" + a.stressMax + (a.recovered ? "; " + a.recovered + " of " + st.max + " from this task" : "") + ")");
          if (a.id === S.stressTarget) o.selected = true; return o;
        }));
        sel.addEventListener("change", function () { S.stressTarget = sel.value; });
        card.appendChild(h("div", { class: "row" }, sel, h("button", { class: "btn small", disabled: busy || st.cost > avail ? true : null,
          onclick: function () { rollAct(x, "spend", { key: "stress", target: S.stressTarget }); } }, st.label + " (" + st.cost + ")")));
      }
    }
    if (x.spentLog && x.spentLog.length) card.appendChild(h("div", { class: "sub" }, "Spent: " + x.spentLog.join(", ")));

    if (live) {
      card.appendChild(h("button", { class: "btn go big", disabled: busy ? true : null, onclick: function () { rollAct(x, "finish"); } },
        busy ? "Working\u2026" : doneLabel(x)));
    } else {
      if (x.banked || x.lost) card.appendChild(h("div", null, x.banked + " Momentum saved to the group pool" + (x.lost ? " (" + x.lost + " lost: pool is full)" : "") + "."));
      if (x.bonusLeft) card.appendChild(h("div", { class: "sub" }, x.bonusLeft + " bonus Momentum went unspent."));
    }
    return card;
  }

  /* ---------------- extended tasks ---------------- */
  function trackBar(track, progress, points) {
    var bar = h("div", { class: "xtrack" });
    for (var i = 1; i <= Math.max(1, track); i++) bar.appendChild(h("span", { class: "xbox" + (i <= progress ? " on" : "") + ((points || []).indexOf(i) >= 0 ? " bt" : "") }));
    return bar;
  }
  function marksNow(xt) { return xt && !xt.gone && typeof xt.impact === "number" ? Math.min(xt.impact, Math.max(0, xt.track - xt.progress)) : 0; }
  function doneLabel(x) {
    var parts = [];
    if (x.extended && x.success && !x.extended.gone) { var m = marksNow(x.extended); parts.push("mark " + m + " space" + (m === 1 ? "" : "s")); }
    if (x.rollLeft > 0) parts.push("save " + x.rollLeft + " Momentum");
    return parts.length ? "Done: " + parts.join(", ") : "Done";
  }
  function extendedBox(x, live, busy) {
    var xt = x.extended, res = xt.result;
    var box = h("div", { class: "xbox-card" },
      h("div", { class: "row" }, h("b", { class: "grow" }, "Extended task: " + xt.name),
        h("span", { class: "sub" }, (res && res.progress !== undefined ? res.progress : xt.progress) + " / " + xt.track)),
      trackBar(xt.track, res && res.progress !== undefined ? res.progress : xt.progress, xt.breakthroughs));
    if (res && res.marked !== undefined) {
      box.appendChild(h("div", null, "Marked " + res.marked + " space" + (res.marked === 1 ? "" : "s") + "."));
      (res.breakthroughs || []).forEach(function (b) { box.appendChild(h("div", { class: "note" }, b)); });
      if (res.complete) box.appendChild(h("div", { class: "chip ok" }, "Extended task complete"));
      return box;
    }
    if (res && res.skipped) { box.appendChild(h("div", { class: "sub" }, "No progress marked: the task was already complete or removed.")); return box; }
    if (xt.gone) { box.appendChild(h("div", { class: "sub" }, "The GM removed or finished this extended task.")); return box; }
    if (!x.success) { box.appendChild(h("div", { class: "sub" }, live ? "No progress unless the task succeeds (Succeed at Cost counts)." : "No progress: the task failed.")); return box; }
    if (!live) return box;
    box.appendChild(h("div", { class: "row" }, h("span", { class: "sub grow" }, (xt.parts || []).join(" \u00b7 ")),
      h("div", { class: "stat mom" }, h("span", { class: "k" }, "Impact"), h("b", null, String(xt.impact)))));
    if (xt.shipName) box.appendChild(h("label", { class: "check" },
      h("input", { type: "checkbox", checked: xt.useShip, disabled: busy ? true : null, onchange: function (e) { rollAct(x, "xship", { value: e.target.checked }); } }),
      "Use the ship's department (" + xt.shipName + " " + xt.shipDept + ") instead of yours (" + xt.charDept + ")"));
    box.appendChild(h("div", { class: "sub" }, "Spend 2 Momentum on Additional Progress for +1 Impact. Done marks the track."));
    return box;
  }

  /* ---------------- Actions view ---------------- */
  function viewTabs() {
    return h("nav", { class: "tabs views" },
      h("button", { class: "tab" + (S.view !== "actions" ? " on" : ""), onclick: function () { S.view = "sheet"; render(); } }, "Roll & sheet"),
      h("button", { class: "tab" + (S.view === "actions" ? " on" : ""), onclick: function () { S.view = "actions"; render(); window.scrollTo(0, 0); } }, "Actions"));
  }

  // Start a roll from an action: fill in the Roll card the way the STA 2E window does.
  function startAction(a) {
    var r = S.roll, ship = S.snap && S.snap.ship;
    resetRoll();
    r.attr = a.attr || ""; r.dept = a.dept || "";
    r.difficulty = typeof a.diff === "number" ? a.diff : 1;
    var notes = [];
    if (a.effect === "regainPower" && ship) { r.difficulty = Math.min(5, 1 + (ship.regainAttempts || 0)); notes.push("Difficulty 1 + " + (ship.regainAttempts || 0) + " earlier attempts"); }
    else if (a.effect === "regenShields" && ship && ship.shields <= 0) { r.difficulty = 3; notes.push("+1 Difficulty: shields are at 0"); }
    else if (a.effect === "shipAttack") r.difficulty = a.weaponKind === "torpedo" ? 3 : 2;
    else if (a.diffNote) notes.push("Difficulty " + a.diffNote);
    if (a.diff === null || a.diff === undefined) notes.push("the GM sets the Difficulty");
    if (a.ship && ship) { r.ship = true; r.shipSystem = a.ship.system; r.shipDept = a.ship.dept || a.dept || ""; }
    else r.ship = false;
    if (!a.attr) notes.push("pick the attribute");
    if (a.needs) notes.push("needs " + a.needs.join(" & "));
    if (a.threat) notes.push("+" + a.threat + " Threat");
    if (a.effect) notes.push("the GM applies the result in MapTool");
    r.label = a.name; r.actionName = a.name; r.actionNote = notes.join(", ");
    S.view = "sheet";
    render();
    var el = document.getElementById("rollcard");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function useAction(c, a, extra) {
    var cmd = { type: "action", tokenId: c.id, actionId: a.id };
    Object.keys(extra || {}).forEach(function (k) { cmd[k] = extra[k]; });
    send(cmd);
  }

  function actionMeta(a) {
    var meta = [];
    if (a.roll) {
      meta.push((a.attr || "Any attribute") + " + " + (a.dept || "any department"));
      if (a.mode === "opposed") meta.push("sets Difficulty (opposed)");
      else if (a.mode === "assist") meta.push("assist: 1d20");
      else meta.push("Difficulty " + (a.diffNote || (a.diff === null || a.diff === undefined ? "set by GM" : a.diff)));
      if (a.ship) meta.push("ship assists with " + a.ship.system + " + " + (a.ship.dept || a.dept));
    }
    if (a.needs) meta.push("needs " + a.needs.join(" & "));
    if (a.threat) meta.push("+" + a.threat + " Threat");
    if (a.cost && a.cost.momentum) meta.push(a.cost.momentum + " Momentum");
    return meta.join(" \u00b7 ");
  }

  function actionCard(c, a) {
    var ship = S.snap && S.snap.ship;
    var busy = pendingCount("action") > 0 || !S.gmOnline;
    var active = ship && a.effect && (ship.effects || []).some(function (e) { return e.key === a.effect; });
    var card = h("section", { class: "card action " + (a.type || "") },
      h("div", { class: "row" }, h("span", { class: "badge " + (a.type || "") }, a.type || ""), h("b", { class: "grow" }, a.name),
        active ? h("span", { class: "chip ok" }, "active") : null),
      actionMeta(a) ? h("div", { class: "sub" }, actionMeta(a)) : null,
      h("div", { class: "desc" }, a.desc));
    var row = h("div", { class: "btnrow" });
    if (a.roll && (!a.mode || a.mode === "task")) {
      row.appendChild(h("button", { class: "btn primary small", onclick: function () { startAction(a); } }, "Roll"));
    } else if (a.roll) {
      row.appendChild(h("span", { class: "sub grow" }, (a.mode === "assist" ? "Assists" : "Opposed rolls") + " are rolled in MapTool for now."));
      row.appendChild(h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { useAction(c, a, { announce: true }); } }, "Announce"));
    } else if (a.effect === "reroute") {
      if (!ship) row.appendChild(h("span", { class: "sub" }, "No active ship."));
      else if (!ship.reservePower) row.appendChild(h("span", { class: "sub" }, ship.name + " has no Reserve Power" + (ship.rerouted ? " (routed to " + ship.rerouted + ")" : "") + "."));
      else {
        var sys = (S.catalog.systems || Object.keys(ship.systems));
        if (sys.indexOf(S.rerouteTo) < 0) S.rerouteTo = sys[0];
        var sel = h("select", null, sys.map(function (k) { var o = h("option", { value: k }, k); if (k === S.rerouteTo) o.selected = true; return o; }));
        sel.addEventListener("change", function () { S.rerouteTo = sel.value; });
        row.appendChild(sel);
        row.appendChild(h("button", { class: "btn small primary", disabled: busy ? true : null, onclick: function () { useAction(c, a, { system: S.rerouteTo }); } }, "Reroute"));
      }
    } else if (a.effect === "prepareTactical") {
      if (!ship) row.appendChild(h("span", { class: "sub" }, "No active ship."));
      else {
        row.appendChild(h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { useAction(c, a, { option: ship.shieldsRaised ? "lowerShields" : "raiseShields" }); } },
          ship.shieldsRaised ? "Lower shields" : "Raise shields"));
        row.appendChild(h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { useAction(c, a, { option: ship.weaponsArmed ? "disarm" : "arm" }); } },
          ship.weaponsArmed ? "Disarm weapons" : "Arm weapons"));
      }
    } else {
      row.appendChild(h("button", { class: "btn small", disabled: busy ? true : null, onclick: function () { useAction(c, a); } }, a.effect ? "Use" : "Post to chat"));
    }
    card.appendChild(row);
    return card;
  }

  function actionsView(c) {
    var cat = S.catalog;
    if (!cat) return [h("div", { class: "banner info" }, "Loading the actions list from the GM's MapTool\u2026")];
    var groups = cat.groups.concat(cat.spendGroups || []);
    if (groups.indexOf(S.actGroup) < 0) S.actGroup = groups[0];
    var out = [h("nav", { class: "tabs wrap" }, groups.map(function (g) {
      return h("button", { class: "tab small" + (S.actGroup === g ? " on" : ""), onclick: function () { S.actGroup = g; render(); } }, g);
    }))];
    var ship = S.snap && S.snap.ship;
    if (ship && (ship.effects || []).length) out.push(h("div", { class: "sub" }, ship.name + ": " + ship.effects.map(function (e) { return e.label; }).join(", ")));
    if (S.actGroup === "Momentum Spends" || S.actGroup === "Threat Spends") {
      var list = S.actGroup === "Momentum Spends" ? cat.momentumSpends : cat.threatSpends;
      out.push(h("section", { class: "card" }, list.map(function (sp) {
        return h("div", { class: "spend" }, h("div", { class: "row" }, h("b", { class: "grow" }, sp.name), h("span", { class: "cost" }, sp.cost)),
          sp.tags ? h("div", { class: "sub" }, sp.tags) : null, h("div", { class: "desc" }, sp.desc));
      })));
      return out;
    }
    cat.actions.filter(function (a) { return a.group === S.actGroup; }).forEach(function (a) { out.push(actionCard(c, a)); });
    return out;
  }

  function chatCard(c) {
    var ta = h("textarea", { rows: 2, placeholder: "Say something in MapTool chat as " + c.name, maxlength: 400 }, S.chatText);
    ta.value = S.chatText;
    ta.addEventListener("input", function () { S.chatText = ta.value; });
    return h("section", { class: "card" }, h("h3", null, "Chat"), ta,
      h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn", disabled: !S.gmOnline ? true : null, onclick: function () {
        var t = S.chatText.trim(); if (!t) return;
        send({ type: "chat", tokenId: c.id, text: t }); S.chatText = ""; render();
      } }, "Send")));
  }

  function refCard(c) {
    var card = h("section", { class: "card" }, h("button", { class: "fold", onclick: function () { S.showRef = !S.showRef; render(); } },
      (S.showRef ? "▾ " : "▸ ") + "Values, focuses, talents, weapons"));
    if (!S.showRef) return card;
    function list(title, items) { return items && items.length ? [h("div", { class: "lbl" }, title), h("ul", null, items.map(function (i) { return h("li", null, i); }))] : null; }
    card.appendChild(h("div", null,
      list("Values", c.values), list("Focuses", c.focuses), list("Talents", c.talents), list("Traits", c.traits),
      list("Weapons", (c.weapons || []).map(function (w) {
        return w.name + " (" + w.type + ", " + (w.injury === "both" ? "Stun/Deadly" : w.injury) + " " + w.severity + (w.qualities.length ? "; " + w.qualities.join(", ") : "") + ")";
      }))));
    return card;
  }

  function render() {
    var app = document.getElementById("app");
    var ae = document.activeElement;
    // Don't redraw under someone who is typing.
    if (ae && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && (ae.type === "text" || ae.type === "password"))) && app.contains(ae)) { updatePoolsOnly(); return; }
    var y = window.scrollY;
    app.innerHTML = "";
    if (!S.token) { app.appendChild(lobbyView()); return; }
    app.appendChild(header());
    var main = h("main");
    if (S.error) main.appendChild(h("div", { class: "banner" }, S.error));
    var list = (S.snap && S.snap.characters) || [];
    if (!S.loaded) main.appendChild(h("div", { class: "banner info" }, "Connecting…"));
    else if (!S.snap) main.appendChild(h("div", { class: "banner info" }, "Waiting for the GM's MapTool to send your character sheet…"));
    else if (!list.length) main.appendChild(h("div", { class: "banner info" }, "The GM hasn't assigned you a character yet."));
    else {
      var c = char();
      add(main, charTabs(list));
      main.appendChild(viewTabs());
      if (S.view === "actions") {
        add(main, resultCard());
        actionsView(c).forEach(function (el) { main.appendChild(el); });
      } else {
        add(main, resultCard());
        main.appendChild(rollCard(c));
        main.appendChild(statusCard(c));
        main.appendChild(chatCard(c));
        main.appendChild(refCard(c));
      }
    }
    main.appendChild(h("footer", null, h("button", { class: "link", onclick: forget }, "Switch connection / forget this device")));
    app.appendChild(main);
    window.scrollTo(0, y);
  }
  function updatePoolsOnly() {
    var old = document.querySelector("header");
    if (old && S.snap) old.replaceWith(header());
  }
  function forget() {
    forgetToken();
    S.lobby.campaigns = null;
    render();
    lobbyPoll();
  }

  /* ---------------- start ---------------- */
  var m = /[#&]t=([A-Za-z0-9_.-]+)/.exec(location.hash);
  if (m) {
    saveToken(m[1]);
    history.replaceState(null, "", location.pathname + location.search);   // keep the secret out of the address bar
  } else {
    try { S.token = localStorage.getItem(KEY) || ""; } catch (e) { S.token = ""; }
  }
  try {
    S.lobby.name = localStorage.getItem("sta2e-remote-name") || "";
    var pend = JSON.parse(localStorage.getItem(REQ_KEY) || "null");
    if (pend && pend.request) { S.lobby.req = pend; S.lobby.reqStatus = "pending"; }
  } catch (e) { /* ignore */ }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { if (S.token) poll(); else lobbyPoll(); } });
  render();
  if (S.token) poll(); else lobbyPoll();
  window.STAPlayer = { S: S, render: render, poll: poll };
})();
