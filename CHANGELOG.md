# Changelog

## Core 1.8.1

- A Notable NPC that has already avoided an Injury this scene no longer gets Avoid buttons, on the hit card or the Character tab. A new hit on it Defeats at once, as the rules say (p.347). Before, the buttons showed and were refused when clicked.
- The hit card no longer reads "(Spend 4 Threat (once per scene).)".

## Core 1.8.0 (unreleased)

### Avoid Injury is offered to the target (p.292)
- When an attack hits a character who can avoid the Injury, the hit **waits for their choice** instead of Defeating them at once. A red card appears at the top of the STA 2E window for whoever controls that character, on any tab, within about 6 seconds. It reads "*Name* is hit", with **Avoid: take N Stress** and **Accept the Injury**. Notable and Major NPCs get **Avoid (N Threat)** on the GM's window.
- Until they choose, the character isn't Defeated. The Injury shows "Hit: avoid or accept" on the Character tab, and its Avoid button still works there.
- **Accept** marks the character Defeated. **Avoid** removes the Injury, takes the Stress (or Threat), and leaves the character as they were before the hit.
- The GM sees every waiting choice and can answer for a player who's away.
- The hit card says who chooses and where.
- Hits that can't be avoided (Minor NPCs, supporting characters with no Values, a full Stress track) Defeat at once, as before.
- New `api/hits` macro keeps the waiting hits in shared data.

### Out-of-date windows
- A window left open across an update now warns: "This window is out of date. It's running STA 2E X but Y is installed…". It checks the new `api/version` macro every few seconds. An old window caused lost assists in testing.
- `api/libSet` no longer lets players write banked assists or extended tasks. The current window uses `api/assists` and `api/extendedPatch` for those, so only an out-of-date window would still use the old whole-list write, and it's now refused.

### Development
- `tools/sync_shared.py` also keeps `api/version.mts` and the page's version in step with `library.json`; `--check` fails if they differ.
- End-to-end tests for the waiting hit: avoid, accept, the GM's view, the NPC Threat choice and players not seeing it. Also tests for the version warning and the libSet refusal.

## Core 1.7.2 (unreleased)

- **Done** on a successful extended-task roll now marks the progress if "Mark N spaces" wasn't pressed. Before, Done banked the Momentum and the progress was lost. Spend Momentum on Additional Progress before pressing Done.
- The 6-second refresh no longer stalls in MapTool after a dropdown was used: MapTool's browser could keep the dropdown "focused" after a redraw, so the window thought the player was still typing and skipped every refresh. It now pauses only for a field that's still on the page while the window has focus.

## Core 1.7.1 (unreleased)

- The window's 6-second refresh now redraws when banked assists, opposed rolls or extended tasks change on another client. Before, only Momentum, Threat, settings and on-screen tokens did, so the GM tab's Pending list needed ⟳.

## Core 1.7.0 / Remote 0.6.3 (unreleased)

### Character rules
- **Recover Stress** (p.278): at most 3 Stress per task, counted across every purchase. Before, applying the recovered Stress reset the count, so more could be bought. The spend card shows how many of the 3 are used.
- **Avoid Injury** (p.292): avoiding an Injury also prevents being Defeated by it. The character goes back to how they were before the hit, even if they still have an older Injury. Before, any remaining Injury left them Defeated. New Injuries record whether the character was already Defeated. Injuries from before this version keep the old behavior.
- **Supporting characters with no Values** (p.291, p.347) are Defeated outright by a successful attack, like Minor NPCs, and get no Injury to avoid. Before, they got an Injury record.
- **Succeed at Cost** (p.259) is the GM's call:
  - The GM always gets the button.
  - Players get it for Warp and Regain Power, whose rules allow it.
  - Players get it on any failed task when the GM ticks **Players may choose Succeed at Cost** on the GM tab. An open result picks the change up within a few seconds.
  - Otherwise the result says to ask the GM.
  - Remote players follow the same setting.

### Tests
- End-to-end tests for each change: the Stress cap across purchases, Avoid Injury with an older Injury, Supporting with no Values, and Succeed at Cost for players, for Regain Power and for remote players.

## Core 1.6.0

### Multiplayer
- **Banked assists** go through a new `api/assists` macro that adds or removes individual assists, reading the current list in the same call. Before, each assist roll and each task that used assists rewrote the whole list, so two players banking at once lost one assist. A task could also wipe an assist banked after the window loaded.
- **Extended tasks**: marking progress re-reads the track first and saves through a new `api/extendedPatch` macro that changes only that task. Progress marked by two players stacks, and a change the GM makes to another task at the same time is kept. Players can change only progress (progress, done, the breakthrough bonus and the log). Creating, deleting and editing tasks stay with the GM.
- **Opposed tasks** (p.256): the reactive roll has an **Against** choice. When it names the attacker, only that roller picks up the Difficulty; other rollers see that it's waiting. "Whoever rolls next" keeps the old behavior. The GM tab shows who it's against.
- **End Scene** also clears banked assists.

### Tests
- End-to-end tests for each change: assists banked and used while another player banks, the opposed target, extended progress marked meanwhile, the player field limit, and End Scene.

## Core 1.5.0

### Ship combat rules
- **Shaken** (p.308-309): for a player ship, the commanding officer now picks the result. The damage leaves a "Shaken: pick a result" effect, and the Ship tab offers Brace for Impact!, Losing Power!, Casualties and Minor Damage, or Roll d20. A roll of 19-20 rolls again. Before, the result was rolled at random and a 19-20 just said "Roll Again". Several Shaken results from one attack stack up to be picked one at a time.
- Shaken results now take effect:
  - **Brace for Impact!** adds an effect, and the Roll tab warns when someone aboard tries a major action.
  - **Losing Power!** removes Reserve Power and makes the next Regain Power +1 Difficulty. The penalty is used up by that attempt.
  - **Casualties** tells the GM to add a complication.
- NPC ships always Brace for Impact, and that's now applied as an effect instead of only described.
- **Dampening** (p.227): a hit from a Dampening weapon removes the target's Reserve Power. The Ship tab's Incoming damage tool has a Dampening box for GM attacks.
- **Cumbersome** (p.227): attacking with a Cumbersome ship weapon adds +1 to the Difficulty. Before, this was only shown as text. A Cumbersome torpedo can't be fired as a salvo, so the salvo box is disabled for it.

### Tests
- New rules tests for the Shaken table and the 50%/25% thresholds, and end-to-end tests for each change above.

## Remote 0.6.2 (unreleased)

- The remote page's action list is in step with the core page again: Ram no longer lists Reserve Power and a Prepare minor action as requirements, and Reroute Power's description matches the core rule fix.

### Development
- Tests are now in the repository: `tests/rules.test.js` checks the rules engine in both pages, and `tests/e2e.test.js` drives both pages in Chromium against the built-in mock MapTool. Run them with `npm test`.
- `tools/sync_shared.py` copies the shared rules, action data and mock MapTool from the core page into the remote page and refreshes `STA2e-preview.html`. `--check` reports a copy that has drifted.
- GitHub runs the sync check, the package check and the tests on every push and pull request.

## Core 1.4.1

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
