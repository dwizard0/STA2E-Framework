# STA2E Framework for MapTool

A Star Trek Adventures 2nd Edition framework for MapTool, by Dustin Freeman.

## Download and install

Download [STA2e.mtlib](dist/STA2e.mtlib) and [STA2e-TokenTypes.mtprops](dist/STA2e-TokenTypes.mtprops) using GitHub's **Download raw file** button. Import the token properties into your campaign and install the add-on library, then type `/sta` in MapTool chat.

See [INSTALL.md](INSTALL.md) for setup, character import, and upgrade instructions. Back up your campaign before upgrading.

The bundled documentation targets MapTool 1.13 or newer. The framework has also been used in the author's MapTool sessions; compatibility with every intervening release has not been verified.

## Features

- Task rolls, focuses, assists, opposed rolls, and Momentum/Threat spending.
- Character attributes, departments, talents, traits, Stress, injuries, and Determination.
- Starship systems, weapons, shields, breaches, damage, and repairs.
- Extended tasks and consequences.
- GM controls and character/starship imports from the [STA character builder](https://sta.bcholmes.org/), including its native MapTool token export. Foundry VTT JSON import remains available as an alternative.

## Optional remote play

[STA2e-Remote.mtlib](dist/STA2e-Remote.mtlib) lets players interact through a web page while the GM runs MapTool. Read the [remote add-on instructions](src/STA2e-Remote/README.md).

The remote add-on requires a separate `api.php` relay server. The relay implementation is not included in this repository. The supplied add-on has `https://wizardsgate.net/sta-remote/api.php` as its default server address; this is not a promise of public relay access. Configure a relay you are authorized to use.

## Source and maintenance

| Location | Purpose |
| --- | --- |
| `src/STA2e/` | Core add-on source (1.8.1) |
| `src/STA2e-Remote/` | Remote add-on source (0.6.3) |
| `src/STA2e-TokenTypes/` | Campaign property package source |
| `dist/` | Installable MapTool packages |
| `tools/build.py` | Package builder and source/package consistency check |
| `tools/sync_shared.py` | Copies the shared rules, action data and mock MapTool from the core page into the remote page and the preview |
| `tests/` | Rules tests (Node) and end-to-end tests of both pages (Playwright) |

Edit source under `src/`, run `python tools/sync_shared.py` and `python tools/build.py`, and commit both source and updated packages. `python tools/build.py --check` verifies that the packages match the source, and `npm test` runs the tests. GitHub runs all of these on every push and pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the maintenance workflow.

This initial repository contains the original framework and remote add-on. The experimental GM voice connector is maintained separately from this baseline.

## License and attribution

The original add-on manifests designate the license as **Personal use**. This repository preserves that designation and does not add an open-source license or grant additional rights. Star Trek and Star Trek Adventures names and third-party materials remain the property of their respective owners. This is an unofficial fan framework.
