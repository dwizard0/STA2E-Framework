# STA2e Remote

Lets players act as their Star Trek Adventures 2E characters from a web page (phone, tablet or laptop) while the game runs in MapTool.

Needs the **Star Trek Adventures 2E** add-on (net.wizardsgate.sta2e) in the same campaign, and the relay server (`api.php`, in [src/STA2e-Relay](../STA2e-Relay/README.md)) installed on a web server.

- The GM types **/staremote** to open the link window.
- One **connection** per player. The GM assigns characters to it and sends the player the connection's link.
- From the link, the player can roll tasks (attribute + department, focus, Difficulty, complication range, free bonus dice, extra dice for Momentum or Threat, bonus Momentum on success, Perfect Opportunity, and an assist die from the group's active ship including Reserve Power), change their Stress, spend Determination and chat as their character.
- Every command runs in the GM's MapTool through the STA 2E add-on, and only for characters assigned to that connection. Rolls show in MapTool chat like any other roll, and Momentum, Threat and one-time Difficulty modifiers are updated the same way.
- The link window must be open on the GM's MapTool, with **Link on**, while players use their pages.
- MapTool's **Enable External Macro Access** preference must be on (the add-on uses REST.post to reach the server).
- The server's GM key and the players' links are kept in the campaign, so the remote link works from any computer that opens it. MapTool sends that data to every client, so a player could read them from chat. **New GM key** (on the server card) and **New link** (on each connection) replace them; the old ones stop working at once. Both need relay version 2.
