#!/usr/bin/env python3
"""Backup and restore Music Assistant provider config entries."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def extract_entries(settings: dict, domain: str) -> dict[str, dict]:
    providers = settings.get("providers", {})
    if not isinstance(providers, dict):
        return {}
    return {
        instance_id: value
        for instance_id, value in providers.items()
        if isinstance(value, dict) and value.get("domain") == domain
    }


def cmd_backup(settings_path: Path, backup_path: Path, domain: str) -> int:
    settings = load_json(settings_path)
    entries = extract_entries(settings, domain)
    if not entries:
        print("no_provider_entries")
        return 0

    backup_payload = {"domain": domain, "entries": entries}
    if backup_path.exists():
        current_backup = load_json(backup_path)
        if current_backup == backup_payload:
            print("unchanged")
            return 0

    write_json(backup_path, backup_payload)
    print("backed_up")
    return 0


def cmd_restore(settings_path: Path, backup_path: Path, domain: str) -> int:
    if not backup_path.exists():
        print("no_backup_entries")
        return 0

    backup_payload = load_json(backup_path)
    backup_entries = backup_payload.get("entries", {})
    if not isinstance(backup_entries, dict) or not backup_entries:
        print("no_backup_entries")
        return 0

    settings = load_json(settings_path)
    if extract_entries(settings, domain):
        print("already_present")
        return 0

    providers = settings.setdefault("providers", {})
    if not isinstance(providers, dict):
        settings["providers"] = {}
        providers = settings["providers"]
    providers.update(backup_entries)
    write_json(settings_path, settings)
    print("restored")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("backup", "restore"))
    parser.add_argument("--settings", required=True)
    parser.add_argument("--backup", required=True)
    parser.add_argument("--domain", required=True)
    args = parser.parse_args()

    settings_path = Path(args.settings)
    backup_path = Path(args.backup)

    if args.command == "backup":
        return cmd_backup(settings_path, backup_path, args.domain)
    if args.command == "restore":
        return cmd_restore(settings_path, backup_path, args.domain)
    return 1


if __name__ == "__main__":
    sys.exit(main())
