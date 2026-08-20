# -*- coding: utf-8 -*-
"""Load data/events.manual.json + seats.manual.csv ke Postgres + Redis."""
import csv
import json
import os
import sys
from pathlib import Path

# allow import from project if needed — use psycopg via subprocess node is easier
# Use node load-manual-data WITHOUT generate-real-seats

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent

def main():
    gen = ROOT / "generate-real-seats.js"
    bak = ROOT / "generate-real-seats.js._disabled"
    disabled = False
    if gen.exists():
        if bak.exists():
            bak.unlink()
        gen.rename(bak)
        disabled = True
    try:
        env = os.environ.copy()
        env.setdefault("DATABASE_URL", "postgres://wtk:wtk@localhost:5432/wtk")
        env.setdefault("REDIS_URL", "redis://localhost:6379")
        import subprocess

        r = subprocess.run(
            ["node", "src/load-manual-data.js"],
            cwd=str(REPO),
            env=env,
        )
        sys.exit(r.returncode)
    finally:
        if disabled and bak.exists():
            bak.rename(gen)


if __name__ == "__main__":
    main()
