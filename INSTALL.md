# STA 2E for MapTool: install

Built for MapTool 1.13 or newer. Earlier development checks used MapTool 1.18's source code and a browser with a simulated MapTool; compatibility with every MapTool release has not been verified.

## 1. Add the token types (once per campaign)
1. **Edit → Campaign Properties → Token Properties** tab.
2. Click **Import** (bottom of the dialog), choose `STA2e-TokenTypes.mtprops`, then **OK**.
3. You now have **STA2e Character** and **STA2e Ship**. Your existing `Basic` and `Ship` types are untouched (MapTool merges imports).

## 2. Add the add-on
Drag `STA2e.mtlib` onto the map, or **File → Add On Libraries… → Add**.
The GM gets a chat message when it's installed.

## 3. Open it
- Type **`/sta`** in chat, or
- Make a campaign macro button containing:
  `[h, macro("open@lib:net.wizardsgate.sta2e"): ""]`
  (put `"roll"`, `"actions"`, `"character"`, `"ship"` or `"gm"` in the quotes to open a specific tab)

## 4. Set up tokens
- **Existing 1E tokens:** select the token, open the **Character** tab, press **Reload**, then **Make it an STA2e Character**. Attributes and disciplines carry over (disciplines become 2E departments). Ships use the **Ship** tab the same way.
- **New tokens:** set the token's property type to **STA2e Character** or **STA2e Ship** in Edit Token.
- NPCs: set **Kind** on the Character tab (Minor, Notable or Major NPC; the injury and Stress rules differ). NPC ships: set **NPC crew quality** on the Ship tab.

### Importing from the character builder: MapTool tokens (recommended)

1. Install the add-on and import `STA2e-TokenTypes.mtprops` first (steps 1–2 above).
2. In the [STA character builder](https://sta.bcholmes.org/), use **2nd Edition**, then create or open your character or starship.
3. Use the builder's **MapTool** export option for this framework and save the `.rptok` token file.
4. Drag the `.rptok` file onto your MapTool map.
5. As the GM (or a player with permission to edit the token), open `/sta`. If the window is already open, press **⟳** to reload the tokens. The framework recognizes the builder export and sets it up when loaded.
6. Select the imported character or ship in the framework and review its stats, weapons, talents, and traits. For an NPC ship, set **NPC crew quality** on the Ship tab. For the players' ship, choose **Make active ship**.
7. Save the campaign to keep the imported token and its setup.

The native token export does not go through the framework's **Import… → Choose File** JSON dialog. Drag it onto the map instead. If the token is not recognized as an STA2e token, check that the campaign has the property types installed and that the token's property type is **STA2e Character** or **STA2e Ship**, then reload the framework.

### Alternative: Foundry VTT JSON import

Use this route if you have an existing Foundry VTT JSON export or want to import its data onto an existing token.

1. In the builder (https://sta.bcholmes.org), open the character or starship and choose **Export → Foundry VTT**. You get a .json file.
2. In MapTool, select the token that should become that character or ship, open `/sta`, and go to the **Character** or **Ship** tab.
3. Press **Import…**, then **Choose File** (or paste the file's contents into the box and press **Preview**).
4. Check the preview. Set **Kind** (PC, Supporting or NPC) or the ship's **Crew** (player ship or NPC crew quality). Untick **Rename the token** to keep its current name.
5. Press **Import**. A plain token (Basic, or your 1E types) is converted to STA2e Character or STA2e Ship.

What comes across: attributes, departments, species, rank, role, values, focuses, talents, traits, Determination, Stress (a bonus is added if the builder's maximum is above Fitness), Protection 2 for Durability, and weapons (Stun/Deadly, severity, size, qualities). For ships: systems, departments, Scale, class, registry, traits, talents, weapons (type, delivery system and qualities), and the builder's Resistance and Shields (differences from the formula go into the Resistance/Shields bonus). Background details (upbringing, environment, career, equipment, mission profile, refits) and a link back to the builder go into **Notes**. Importing again replaces that block and keeps anything you wrote above it.

For the **Import…** JSON dialog, use the Foundry VTT export. Roll20 and Fantasy Grounds exports are not supported by that importer. This restriction does not apply to the native MapTool token export described above.

## Updating from 1.3 or 1.4
Drag the new `STA2e.mtlib` onto the map (and the new `STA2e-Remote.mtlib`, if you use it). Then close any open STA 2E window on every client and open it again with `/sta`; the version next to the STA 2E badge should read 1.6.0. Importing `STA2e-TokenTypes.mtprops` again is recommended: it adds the ship's **Shields when lowered** field to the Edit Token dialog. The add-on works without it.

## Updating from 1.1
Drag the new `STA2e.mtlib` onto the map. You don't need to import the token types again.

## Updating from 1.0 (or first install): hover stat sheet
1. Drag the new `STA2e.mtlib` onto the map. It replaces the old add-on and keeps your Momentum, Threat and extended tasks.
2. **Import `STA2e-TokenTypes.mtprops` again** (step 1). This adds the display fields the hover sheet reads and sets **STA 2E Character** / **STA 2E Starship** as the stat sheet for the two token types. Your token values are kept.
3. Open the STA 2E window once (`/sta`). It fills in the display fields (Stress, injuries, shields, breaches…) on every token you can edit.
4. Hover over a token. If you still see MapTool's plain sheet, set it by hand: **Campaign Properties → Token Properties →** pick the type **→ Stat Sheet: STA 2E Character** (or STA 2E Starship).

The sheet updates whenever something changes through the STA 2E window. If you edit a token in MapTool's Edit Token dialog, press ⟳ in the window to refresh its sheet.

## 5. Start playing (GM)
1. **Ship tab → Make active ship** for the players' ship.
2. **GM tab → Start mission** sets Threat to 2 per PC, Momentum to 0, and everyone's Determination to 1.
3. **End scene** removes 1 Momentum and resets ship shields and Reserve Power.
4. **Extended tab**: create extended tasks (progress track, Difficulty, Resistance, breakthroughs) or consequences (trouble track, Impact, setbacks; can be hidden from players). **Roll toward this** sends a player to the Roll tab. After a success they press **Mark N spaces**. Impact is their department (or the ship's, if it assisted), minus Resistance, plus Additional Progress bought with Momentum.

## Who can change what
- The GM can change everything.
- Players can edit the characters and ships they own.
- Through the STA 2E window, players can also apply the results of their actions to other tokens: an Injury they inflict, Stress an ally recovers, damage, shields and Reserve Power on a ship. They can't change another token's ratings, talents, name or type.
- Players can spend and save Momentum and add Threat, bank and use assists, and mark progress on extended tasks. Only the GM can spend Threat, change the GM tab settings, the active ship, Difficulty modifiers, or anything else about an extended task.
- Players don't see the Notes of tokens they don't own.

If the window says **"Only the GM or the token's owner can change …"**, press ⟳: the window was showing out-of-date data, or the token's owner needs to be set in Edit Token.

## Where things are stored
- Character and ship data is stored in token properties, so it saves with the campaign.
- Momentum, Threat, banked assists, difficulty modifiers and opposed Difficulties are stored in the add-on's data store, which syncs to every client.
- The Momentum/Threat header refreshes every few seconds. Press ⟳ to refresh token data after someone else edits a token.

## If something goes wrong
If the window shows **"Couldn't talk to MapTool: …"**, copy that message; it's the exact MTScript error.
`STA2e-preview.html` opens in any web browser with sample characters, so you can try the interface without MapTool.
