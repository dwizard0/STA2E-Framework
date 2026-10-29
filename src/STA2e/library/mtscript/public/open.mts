[h: "Opens the STA 2E window. Optional argument: the tab to open, one of roll, actions, character, ship, gm."]
[h: tab = macro.args]
[h: "cachelib=false: load the current page, not a copy MapTool cached from an earlier version of the add-on."]
[h: html.frame5("STA 2E", "lib://net.wizardsgate.sta2e/app.html?cachelib=false", "title=Star Trek Adventures 2E; width=780; height=880; temporary=0; value=" + tab)]
