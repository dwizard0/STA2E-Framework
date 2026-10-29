# Star Trek Adventures 2E for MapTool

A MapTool 1.13+ add-on for Star Trek Adventures 2nd Edition.

Open it by typing `/sta` in chat, or from a macro button containing:

    [h, macro("open@lib:net.wizardsgate.sta2e"): ""]

The argument can be `roll`, `actions`, `character`, `ship` or `gm` to open a specific tab.

## Tabs
- **Roll**: attribute/department tiles, focus, Difficulty with GM modifiers, complication range, buy up to three d20s with Momentum or Threat (1/2/3), Determination (Perfect Opportunity before, Moment of Inspiration after), ship assist die (Reserve Power reroute counts as a 1), banked assists, opposed rolls, Succeed at Cost, complication buy-off, Momentum spends, then apply the result (injuries, ship damage, shields, breaches, repairs).
- **Actions**: every 2E station action, personal conflict, social and repair action with its rules text; Roll or Use.
- **Character**: Stress track, Fatigue, Determination, Injuries (Stun/Deadly, Protection, Avoid Injury, treat, heal), focuses, values, talents, traits, weapons, notes. **Import…** reads a character from the STA character builder (sta.bcholmes.org). Tokens from the builder's MapTool export are set up automatically, and clicking a talent or trait shows its text.
- **Ship**: shields bar with the 50%/25% breakpoints, Resistance, Reserve Power and reroute, effects, systems/departments, breaches, incoming damage, weapons with computed damage, class, traits, talents, notes. **Import…** reads a starship from the builder.
- **Extended**: extended tasks with progress tracks and breakthroughs, and extended consequences with trouble tracks and setbacks.
- **GM**: Momentum/Threat, Start Mission, End Scene, difficulty modifiers, pending assists/opposed rolls, settings.

Token data lives on tokens with the **STA2e Character** and **STA2e Ship** property types (import `STA2e-TokenTypes.mtprops`).
Shared data (Momentum, Threat, banked assists, modifiers) is stored in the add-on's data store.

Players can edit the tokens they own, and apply the results of their actions (Injuries, Stress, ship damage, shields and power) to other tokens through the window. Only the GM can spend Threat or change settings and modifiers. Players don't see the Notes of tokens they don't own.

Hovering over an STA2e token shows the **STA 2E Character** / **STA 2E Starship** stat sheet.

## Importing from the character builder
The recommended route is the builder's native **MapTool** export for this framework. Use **2nd Edition** in the [builder](https://sta.bcholmes.org/), create or open your character or starship, and save its `.rptok` export. Install this add-on and import `STA2e-TokenTypes.mtprops` before dragging the token onto the map. Open `/sta` (or press **⟳** if it is already open); the framework recognizes and sets up builder tokens you can edit. Review the Character or Ship tab and save the campaign. For NPC ships, set the crew quality; for the players' ship, choose **Make active ship**.

Do not select a `.rptok` file in the **Import…** JSON dialog: place it on the map instead.

**Alternative: Foundry VTT JSON.** Export the character or starship for **Foundry VTT**. In the add-on, select the destination token, press **Import…** on the Character or Ship tab, choose the `.json` file (or paste its contents), check the preview and press **Import**. A plain token is converted to the STA2e type. Roll20 and Fantasy Grounds exports are not supported by this JSON importer.
