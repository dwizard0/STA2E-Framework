#!/usr/bin/env python3
"""Keep the shared code in step.

The core page (src/STA2e/library/public/app.html) is the source. This copies its
rules.js, data.js and mock.js sections into the remote page, and the whole page to
STA2e-preview.html. Sections are delimited by /* ---- name ---- */ comments.

    python tools/sync_shared.py          # update the copies
    python tools/sync_shared.py --check  # exit 1 if a copy differs
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "src/STA2e/library/public/app.html"
REMOTE = ROOT / "src/STA2e-Remote/library/public/remote.html"
PREVIEW = ROOT / "STA2e-preview.html"
SHARED = ["rules.js", "data.js", "mock.js"]


def bounds(text, name):
    start = text.index("/* ---- " + name + " ---- */")
    end = text.index("/* ---- ", start + 10)
    return start, end


def main():
    check = "--check" in sys.argv[1:]
    app = APP.read_text(encoding="utf-8")
    remote = REMOTE.read_text(encoding="utf-8")
    synced = remote
    for name in SHARED:
        sa, ea = bounds(app, name)
        sr, er = bounds(synced, name)
        synced = synced[:sr] + app[sa:ea] + synced[er:]
    preview = PREVIEW.read_text(encoding="utf-8") if PREVIEW.exists() else ""

    problems = []
    if synced != remote:
        problems.append("remote.html: shared sections (%s) differ from app.html" % ", ".join(SHARED))
    if preview != app:
        problems.append("STA2e-preview.html differs from app.html")

    if check:
        for p in problems:
            print("FAIL " + p)
        if problems:
            print("Run: python tools/sync_shared.py")
            return 1
        print("PASS shared code in step (%s, preview)" % ", ".join(SHARED))
        return 0

    if synced != remote:
        REMOTE.write_text(synced, encoding="utf-8")
        print("updated remote.html")
    if preview != app:
        PREVIEW.write_text(app, encoding="utf-8")
        print("updated STA2e-preview.html")
    if not problems:
        print("already in step")
    return 0


if __name__ == "__main__":
    sys.exit(main())
