# STA2e Remote relay and player page

The server side of remote play. The GM's MapTool (the STA2e Remote add-on) and the players'
browsers never talk to each other directly: players queue commands here, the add-on collects them,
runs them in MapTool, and posts back the results and a snapshot of each player's characters.

- `api.php`: the relay. Every request is a POST with a JSON body `{"action": "..."}`.
- `player/`: the page players open from their join link (or pick a game from the lobby).
- `data/`: one file per campaign. Must be writable by the web server and not served to browsers
  (`data/.htaccess` blocks it on Apache; each file also starts with an exit line).

## Install

1. Copy this folder to a PHP 8 web server, for example as `https://example.org/sta-remote/`.
2. Copy `config.example.php` to `config.php` and set `STA_CREATE_KEY` to a long random string.
3. In MapTool, open the STA2e Remote window, enter `https://example.org/sta-remote/api.php` and the
   create key, and connect. Allow external macro access in MapTool's preferences.

## Keys and links

- Creating a campaign returns a **GM key**. The add-on stores it in the campaign's add-on data so
  that it works on any computer that opens the campaign. MapTool sends add-on data to every client,
  so a player could read it from chat. **New GM key** in the Remote window (`gm.rotateKey`) issues a
  new one; the old key stops working at once.
- Each connection has a **join link**. **New link** (`gm.newLink`) replaces it; the old link stops
  working. Devices the GM approved from the lobby keep working unless `signOutDevices` is set.

## Versions

`ping` reports the relay's version.

- 1: the original relay.
- 2: adds `gm.rotateKey` and `gm.newLink` (STA2e Remote 0.7.0).
