"""Builds prepermint/static/css/app.css from prepermint/styles/app.css with the standalone Tailwind CLI.

    uv run python scripts/build_css.py

The output is committed (Vercel's Python build has no CSS step), and CI fails when it is out of date.
"""

import sys
from pathlib import Path

from pytailwindcss import run

# Same Tailwind as the Next.js app (package.json), so both builds produce the same utilities.
TAILWIND_VERSION = "v4.3.3"

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "prepermint" / "styles" / "app.css"
OUTPUT = ROOT / "prepermint" / "static" / "css" / "app.css"


def main() -> int:
    run(["-i", str(SOURCE), "-o", str(OUTPUT), "--minify"], cwd=ROOT, auto_install=True, version=TAILWIND_VERSION)
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
