# Maintaining the framework

1. Create a branch for the fix or feature.
2. Edit the files in `src/`. Existing bundled HTML contains the framework's application code; MTScript entry points are under `library/mtscript/`.
3. Update the relevant `library.json` version when preparing a release and record the changes in `CHANGELOG.md`.
4. Run `python tools/build.py`, followed by `python tools/build.py --check`.
5. Import the rebuilt files into a backup/test campaign. Check the changed behavior in MapTool, including relevant player and GM permissions. Package checks do not verify game rules or runtime behavior.
6. Commit source, packages, and documentation together. Open a pull request when review is useful.
7. For a release, create a GitHub release with a version tag and attach the three files from `dist/`. Mention the core and remote version numbers independently.

Bug reports should include the MapTool version, add-on version, steps to reproduce, expected result, actual result, and any error message. Remove private campaign information before sharing examples.

Do not commit campaign saves, player connection links, relay configuration secrets, or local GM connector pairing files.
