# Maintaining the framework

1. Create a branch for the fix or feature.
2. Edit the files in `src/`. Existing bundled HTML contains the framework's application code; MTScript entry points are under `library/mtscript/`. The core page (`src/STA2e/library/public/app.html`) is the source for the shared `rules.js`, `data.js` and `mock.js` sections: edit them there, not in the remote page.
3. Update the relevant `library.json` version when preparing a release and record the changes in `CHANGELOG.md`.
4. Run `python tools/sync_shared.py` (copies the shared sections into the remote page and refreshes `STA2e-preview.html`), then `python tools/build.py`, then `python tools/build.py --check`.
5. Run the tests: `npm install` and `npx playwright install chromium` once, then `npm test`. `tests/rules.test.js` checks the rules engine in both pages; `tests/e2e.test.js` drives both pages in Chromium against the built-in mock MapTool. Add a test with each fix.
6. Import the rebuilt files into a backup/test campaign. Check the changed behavior in MapTool, including relevant player and GM permissions. The mock MapTool emulates the API macros' permission checks but doesn't run the MTScript itself.
7. Commit source, packages, and documentation together. Open a pull request when review is useful.
8. For a release, create a GitHub release with a version tag and attach the three files from `dist/`. Mention the core and remote version numbers independently.

Bug reports should include the MapTool version, add-on version, steps to reproduce, expected result, actual result, and any error message. Remove private campaign information before sharing examples.

Do not commit campaign saves, player connection links, relay configuration secrets, or local GM connector pairing files.
