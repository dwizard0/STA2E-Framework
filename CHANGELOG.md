# Changelog

## Core 1.4.1 (unreleased)

- The Momentum and Threat shown in the header and on the Spend Momentum card now stay current while a roll result is open. Before, they only updated after leaving the result.
- If a spend, bought die, complication buy-off, consequence or Avoid Injury looks unaffordable from the pools on screen, the window re-reads the pools and tries again before refusing. Before, an out-of-date display could refuse a spend the pool could cover.
- The GM tab's Momentum and Threat steppers change the pools by +1 / −1 instead of writing a total, so they don't undo a player's spend made a moment earlier.

## Core 1.4.0 / Remote 0.6.1

### Rules fixes
- Reroute Power: every complication rolled on the task now counts as two (Core p.185). Before, only the ship's die was doubled, and that die is always a 1, so nothing doubled.
- Phaser Arrays and torpedo salvos now ask for Area or Spread when firing (p.228-229). With Spread, Devastating Attack costs 1 Momentum and can be bought repeatedly, with one extra system hit for each (p.227). With Area there's a 1-Momentum extra-target spend.
- Ram no longer requires or spends Reserve Power (p.302).
- Raising lowered shields restores the total they had when lowered, not full shields (p.305). End Scene still restores shields to maximum (p.308).

### Multiplayer and permissions
- New `api/poolAdd` macro changes Momentum and Threat by an amount, reading the current pools in the same call. Rolls, Momentum spends, banking, complication buy-offs, opposed-task Momentum and End Scene use it, so players acting at the same time no longer overwrite each other. Costs are paid before the dice are rolled; if the pool has already been spent by someone else, the roll stops with a message.
- `api/tokenSet`: the GM and a token's owners can change anything. Other players can only change conflict-state properties (Injuries, Defeated, Stress, Shields, Breaches, Effects, Reserve Power) and can't rename or retype the token.
- `api/libSet`: players can write only banked assists, opposed rolls, extended-task progress, and clear the one-time Difficulty modifier. Momentum and Threat go through `api/poolAdd`. Only the GM can spend Threat.
- `api/tokenGet`: players only get tokens on maps they can see, and Notes are blank on tokens they don't own.
- The STA2e Remote add-on uses the same pool changes for its players' rolls, spends and banking.

- Token changes worked out from current values now re-read the token from MapTool first: applying attacks, damage, Regenerate Shields, Damage Control, repairs, First Aid and healing, Avoid Injury, rests, Stress recovery, Determination spends, Reserve Power and Regain Power, ship effects, breaches, and lowering or raising shields. Before, a player's window that hadn't been reloaded could write back old values, for example undoing damage the GM had just applied.

### Display
- The window re-reads the pools and the tokens it's showing every 6 seconds, so a change made from another client (damage applied by the GM, say) shows up without pressing ⟳. It skips this while a roll result is open or while you're typing.
- The window opens with `cachelib=false`, so after installing a new version, MapTool loads the new page rather than a cached copy of the old one.
- The add-on version is shown next to the STA 2E badge.
- Regenerate Shields is refused while shields are lowered (their maximum is 0), so Reserve Power isn't wasted.
- Apply cards remind you to buy +1 Damage, Devastating Attack, +1 Severity or +2 Shields before pressing Apply.

### Error handling
- `api/tokenSet` and `api/tokenGet` check that the token is still on the given map. If it has moved, been deleted, or its map was renamed since the window last loaded, the window now says "MapTool can't find … press ⟳" right away instead of timing out after 15 seconds.
- Apply Injury, Apply damage, the other Apply buttons and extended-task progress only show "Applied." after MapTool has saved the change. A failed save leaves the button available, and a second click while saving does nothing.

### Other
- Versions: core 1.4.0, remote 0.6.1 (the remote manifest said 0.4.0 while the docs said 0.6.0).
- Token types: new `ShieldsLowered` ship property. Re-importing `STA2e-TokenTypes.mtprops` is recommended but not required.
- `STA2e-preview.html` refreshed from the current app (it was still 1.2.0).

## Installation documentation update — 2026-10-18

- Made the character builder's native MapTool `.rptok` export the recommended import route.
- Documented token setup, refresh, permissions, and the separate Foundry JSON alternative.
- Updated the bundled add-on README and rebuilt its package; framework behavior and version remain unchanged.

## Initial GitHub import — 2026-10-18

- Imported the existing core framework 1.3.0, remote add-on 0.6.0, and token property package without changing their contents.
- Added editable package source, a reproducible package builder, and package consistency checks.
- Added installation and maintenance documentation.

Earlier development history was not available as Git commits in the supplied files.
