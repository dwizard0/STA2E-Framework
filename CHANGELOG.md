# Changelog

## Unreleased

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

### Other
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
