#!/usr/bin/env python3
"""
Refresh the dashboard when NYC Open Data source datasets change.

The script checks the current Socrata row-update timestamps for the arrest and
crash datasets. If either source changed since the last successful refresh, it
reruns:

1. clean.ipynb
2. Phase2.ipynb
3. build_dashboard_data.py

Refresh state is stored in ../data/refresh_state.json so future runs can detect
whether upstream datasets changed.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / ".." / "data"
STATE_PATH = DATA_DIR / "refresh_state.json"
DATASETS = {
    "arrests": {
        "id": "uip8-fykc",
        "name": "NYPD Arrest Data (Year-to-Date)",
    },
    "crashes": {
        "id": "h9gi-nx95",
        "name": "Motor Vehicle Collisions - Crashes",
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def write_state(state: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def fetch_dataset_status(dataset_id: str) -> dict:
    params = urllib.parse.urlencode(
        {
            "$select": "max(:updated_at) as updated_at, count(*) as row_count",
        }
    )
    url = f"https://data.cityofnewyork.us/resource/{dataset_id}.json?{params}"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.load(response)

    if not payload or not isinstance(payload, list):
        raise RuntimeError(f"Unexpected response for dataset {dataset_id}")

    row = payload[0]
    return {
        "updated_at": row.get("updated_at"),
        "row_count": int(row.get("row_count", 0)),
    }


def collect_source_statuses() -> dict:
    statuses = {}
    for key, dataset in DATASETS.items():
        live = fetch_dataset_status(dataset["id"])
        statuses[key] = {
            "id": dataset["id"],
            "name": dataset["name"],
            "updated_at": live["updated_at"],
            "row_count": live["row_count"],
        }
    return statuses


def has_source_updates(previous_sources: dict, current_sources: dict) -> bool:
    if not previous_sources:
        return True

    for key, current in current_sources.items():
        previous = previous_sources.get(key, {})
        if current.get("updated_at") != previous.get("updated_at"):
            return True
        if current.get("row_count") != previous.get("row_count"):
            return True
    return False


def run_notebook(notebook_name: str) -> None:
    notebook = ROOT / notebook_name
    with tempfile.TemporaryDirectory(prefix=f"{notebook.stem}-exec-") as tmpdir:
        cmd = [
            "jupyter",
            "nbconvert",
            "--to",
            "notebook",
            "--execute",
            "--output",
            f"{notebook.stem}-executed",
            "--output-dir",
            tmpdir,
            str(notebook),
        ]
        subprocess.run(cmd, cwd=ROOT, check=True)


def run_script(script_name: str) -> None:
    subprocess.run([sys.executable, script_name], cwd=ROOT, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh the NYPD dashboard when source datasets change."
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only report whether new source data is available.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rerun the pipeline even if the source timestamps did not change.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    state = load_state()
    previous_sources = state.get("sources", {})
    current_sources = collect_source_statuses()
    checked_at = utc_now_iso()
    updates_found = has_source_updates(previous_sources, current_sources)

    print("Source dataset status:")
    for key, meta in current_sources.items():
        print(
            f"  - {meta['name']} ({meta['id']}): "
            f"updated_at={meta['updated_at']} row_count={meta['row_count']}"
        )

    if args.check_only:
        print("Updates available." if updates_found else "No source updates detected.")
        write_state(
            {
                **state,
                "checked_at": checked_at,
                "sources": current_sources,
            }
        )
        return 0

    if not updates_found and not args.force:
        print("No source updates detected. Skipping notebook and dashboard rebuild.")
        write_state(
            {
                **state,
                "checked_at": checked_at,
                "sources": current_sources,
                "last_refresh": {
                    **state.get("last_refresh", {}),
                    "checked_at": checked_at,
                    "status": "skipped",
                    "reason": "no-source-change",
                },
            }
        )
        return 0

    reason = "forced" if args.force else "source-updated"
    refresh_meta = {
        "started_at": checked_at,
        "status": "running",
        "reason": reason,
        "steps": [
            "clean.ipynb",
            "Phase2.ipynb",
            "build_dashboard_data.py",
        ],
    }
    write_state(
        {
            **state,
            "checked_at": checked_at,
            "sources": current_sources,
            "last_refresh": refresh_meta,
        }
    )

    try:
        print("Running clean.ipynb ...")
        run_notebook("clean.ipynb")
        print("Running Phase2.ipynb ...")
        run_notebook("Phase2.ipynb")
        print("Building docs/data.js ...")
        run_script("build_dashboard_data.py")
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        refresh_meta["finished_at"] = utc_now_iso()
        refresh_meta["status"] = "failed"
        refresh_meta["error"] = str(exc)
        write_state(
            {
                **state,
                "checked_at": checked_at,
                "sources": current_sources,
                "last_refresh": refresh_meta,
            }
        )
        raise SystemExit(1) from exc

    refresh_meta["finished_at"] = utc_now_iso()
    refresh_meta["status"] = "success"
    write_state(
        {
            **state,
            "checked_at": checked_at,
            "sources": current_sources,
            "last_refresh": refresh_meta,
        }
    )
    print("Dashboard refresh complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
