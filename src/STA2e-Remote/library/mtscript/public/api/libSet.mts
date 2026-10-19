[h: "STA2e Remote API: write settings. Args: values (name to value). GM only."]
[h: vals = json.get(macro.args, "values")]
[h: ok = isGM()]
[h: keys = json.fields(vals, "json")]
[h, if(ok == 1), code: {
  [h, foreach(k, keys): setLibProperty(k, json.get(vals, k), "lib:net.wizardsgate.sta2e.remote")]
}]
[r: json.set("{}", "ok", ok)]
