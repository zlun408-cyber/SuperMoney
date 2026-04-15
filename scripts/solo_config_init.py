#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from pathlib import Path


DEFAULT_INSTRUCTIONS = [
    "docs/SPACE_INDEX.md",
    "docs/framework/core_rules.md",
    "docs/solo-commands.md",
    "docs/solo-new-feature.md",
    "docs/solo-start.md",
    "docs/solo-pick.md",
    "docs/solo-pass.md",
    "docs/solo-notify.md",
    "docs/solo-auto-notify.md",
    "docs/solo-onboard.md",
    "docs/solo-config-init.md",
]

LEGACY_REWRITE = {
    "docs/onboard.md": "docs/solo-onboard.md",
    "docs/solo-init.md": "docs/solo-config-init.md",
}


def load_json(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def merge_instructions(existing):
    merged = []
    seen = set()

    for item in existing:
        item = LEGACY_REWRITE.get(item, item)
        if item not in seen:
            merged.append(item)
            seen.add(item)

    for item in DEFAULT_INSTRUCTIONS:
        if item not in seen:
            merged.append(item)
            seen.add(item)

    return merged


def update_config(path: Path):
    data = load_json(path)
    existing = data.get("instructions", [])
    if not isinstance(existing, list):
        raise ValueError(f"Invalid instructions field in {path}")

    data["instructions"] = merge_instructions(existing)

    if "$schema" not in data:
        data["$schema"] = "https://opencode.ai/config.json"

    path.parent.mkdir(parents=True, exist_ok=True)

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def sync_global_commands(root: Path, global_config_path: Path):
    src_dir = root / ".opencode" / "commands"
    if not src_dir.exists():
        return []

    dst_dir = global_config_path.parent / "commands"
    dst_dir.mkdir(parents=True, exist_ok=True)

    synced = []
    for src_file in src_dir.glob("*.md"):
        dst_file = dst_dir / src_file.name
        src_resolved = src_file.resolve()

        if dst_file.exists() or dst_file.is_symlink():
            if dst_file.is_dir() and not dst_file.is_symlink():
                shutil.rmtree(dst_file)
            else:
                dst_file.unlink()

        try:
            dst_file.symlink_to(src_resolved)
            synced.append(f"{dst_file} -> {src_resolved}")
        except OSError:
            shutil.copyfile(src_resolved, dst_file)
            synced.append(f"{dst_file} (copied)")

    legacy_file = dst_dir / "solo-init.md"
    if legacy_file.exists():
        legacy_file.unlink()
    return synced


def detect_global_config_path() -> Path:
    env_path = os.getenv("OPENCODE_CONFIG_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    candidates = [
        Path("~/.config/opencode/opencode.json").expanduser(),
        Path("~/.config/opencode/config.json").expanduser(),
        Path("~/.opencode/opencode.json").expanduser(),
        Path("~/.opencode/config.json").expanduser(),
        Path("~/Library/Application Support/opencode/config.json").expanduser(),
        Path("~/Library/Application Support/opencode/opencode.json").expanduser(),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    return candidates[0].resolve()


def main():
    parser = argparse.ArgumentParser(description="Initialize and merge OpenCode config instructions")
    parser.add_argument("--config", action="append", help="Path to config json, can pass multiple times")
    parser.add_argument("--all-default", action="store_true", help="Update opencode.json and .opencode/opencode.json")
    parser.add_argument("--global-config", default="", help="Absolute path to real machine OpenCode config.json")
    parser.add_argument("--skip-global", action="store_true", help="Do not update global machine config")
    parser.add_argument("--skip-command-sync", action="store_true", help="Do not sync command markdown files to global commands dir")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    targets = []

    if args.all_default or not args.config:
        targets.extend([
            root / "opencode.json",
            root / ".opencode" / "opencode.json",
        ])

    if args.config:
        for item in args.config:
            targets.append((root / item).resolve())

    if not args.skip_global:
        if args.global_config:
            targets.append(Path(args.global_config).expanduser().resolve())
        else:
            targets.append(detect_global_config_path())

    unique_targets = []
    seen = set()
    for t in targets:
        key = str(t)
        if key not in seen:
            seen.add(key)
            unique_targets.append(t)

    for target in unique_targets:
        updated = update_config(target)
        print(f"Updated config: {updated}")

    if not args.skip_global and not args.skip_command_sync:
        global_target = None
        if args.global_config:
            global_target = Path(args.global_config).expanduser().resolve()
        else:
            global_target = detect_global_config_path()
        synced_files = sync_global_commands(root, global_target)
        if synced_files:
            print("Synced commands:")
            for item in synced_files:
                print(f"- {item}")


if __name__ == "__main__":
    main()
