[h: "STA2e Remote API: read settings. Args: keys (list of names). GM only, because the settings hold the server key."]
[h: keys = json.get(macro.args, "keys")]
[h: out = "{}"]
[h, if(isGM() == 1), code: {
  [h, foreach(k, keys): out = json.set(out, k, getLibProperty(k, "lib:net.wizardsgate.sta2e.remote"))]
}]
[r: out]
