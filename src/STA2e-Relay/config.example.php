<?php
// STA2e Remote relay settings. Copy this file to config.php and fill it in.
// Keep config.php out of version control once you set a key.

// Anyone who knows this key can create a campaign link on this server.
// Set it to a long random string, and type the same string into the add-on's Setup box once.
// Leave it empty only on a private network.
const STA_CREATE_KEY = '';

// Where campaign data is kept. The folder must be writable by the web server and must not be
// served to browsers (the included data/.htaccess blocks it on Apache).
const STA_DATA_DIR = __DIR__ . '/data';

// Commands a player sends expire if the GM's MapTool hasn't picked them up in this many seconds.
const STA_COMMAND_TTL = 60;

// The GM's MapTool counts as online if it synced within this many seconds.
const STA_ONLINE_WINDOW = 30;

// Extra origin allowed to call the player API from a browser (for example your MT:Companion app
// if it is served from a different host). Same-origin pages always work. '' = none.
const STA_ALLOW_ORIGIN = '';
