#!/usr/bin/env python3
import argparse
import re
import subprocess
import sys
from pathlib import Path

ALLOWED_ROLES = ["PM", "ARCH", "BE", "FE", "QA"]
DEFAULT_NEXT = {
    "PM": ["ARCH"],
    "ARCH": ["BE", "FE"],
    "BE": ["QA"],
    "FE": ["QA"],
    "QA": ["PM"],
}


def resolve_workspace_root(start: Path):
    matches = []
    for candidate in [start, *start.parents]:
        if (candidate / "docs" / "SPACE_INDEX.md").exists():
            matches.append(candidate)
    if matches:
        return matches[-1]
    raise FileNotFoundError("Cannot locate workspace root containing docs/SPACE_INDEX.md")


def parse_next_roles(raw: str):
    roles = []
    for part in [x.strip().upper() for x in raw.split(",") if x.strip()]:
        if part not in ALLOWED_ROLES:
            raise ValueError(f"unsupported role: {part}")
        if part not in roles:
            roles.append(part)
    return roles


def load_team_enabled_roles(workspace_root: Path, project: str):
    if not project:
        return set(ALLOWED_ROLES)

    path = workspace_root / "docs" / "project" / project / "docs" / "team.md"
    if not path.exists():
        return set(ALLOWED_ROLES)

    enabled = set()
    pattern = re.compile(
        r"^\|\s*(PM|ARCH|BE|FE|QA)\s*\|\s*(true|false)\s*\|\s*([0-9]+)\s*\|",
        re.IGNORECASE,
    )

    for line in path.read_text(encoding="utf-8").splitlines():
        m = pattern.match(line.strip())
        if not m:
            continue
        role = m.group(1).upper()
        is_enabled = m.group(2).lower() == "true"
        headcount = int(m.group(3))
        if is_enabled and headcount > 0:
            enabled.add(role)

    return enabled if enabled else set(ALLOWED_ROLES)


def build_text(role: str, feature_id: str, project: str, text: str):
    context = []
    if feature_id:
        context.append(f"feature_id={feature_id}")
    if project:
        context.append(f"project={project}")
    prefix = f"[{' '.join(context)}] " if context else ""
    body = text or f"{role} 已完成当前步骤，请开始你的任务。"
    return prefix + body


def notify(
    workspace_root: Path,
    target_role: str,
    message: str,
    source_session_name: str,
    backend: str,
    tmux_session: str,
):
    cmd = ["bash", str(workspace_root / "scripts" / "solo-notify.sh"), target_role, message]
    if source_session_name:
        cmd.append(source_session_name)
    cmd.extend(["--backend", backend])
    if tmux_session:
        cmd.extend(["--tmux-session", tmux_session])
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = (result.stdout or "").strip() or (result.stderr or "").strip()
    return result.returncode, output


def main():
    parser = argparse.ArgumentParser(description="Auto notify next role(s) in solo workflow")
    parser.add_argument("--role", required=True, help="Current role: PM|ARCH|BE|FE|QA")
    parser.add_argument("--feature-id", default="")
    parser.add_argument("--project", default="")
    parser.add_argument("--next", default="", help="Override next role(s), comma-separated")
    parser.add_argument("--text", default="", help="Notification text")
    parser.add_argument("--source-session", default="", help="Source PM session name used to locate the current window")
    parser.add_argument("--backend", default="auto", help="Terminal backend: auto|iterm2|tmux")
    parser.add_argument("--tmux-session", default="", help="Optional tmux session name override")
    args = parser.parse_args()

    role = args.role.strip().upper()
    if role not in ALLOWED_ROLES:
        raise ValueError("--role must be one of PM|ARCH|BE|FE|QA")

    workspace_root = resolve_workspace_root(Path(__file__).resolve().parent)
    enabled_roles = load_team_enabled_roles(workspace_root, args.project.strip())

    if args.next.strip():
        targets = parse_next_roles(args.next)
    else:
        targets = [r for r in DEFAULT_NEXT[role] if r in enabled_roles]

    if not targets:
        print("No target roles to notify (all next roles disabled or filtered).")
        return

    message = build_text(role, args.feature_id.strip(), args.project.strip(), args.text.strip())
    failures = []
    for target in targets:
        code, output = notify(
            workspace_root,
            target,
            message,
            args.source_session.strip(),
            args.backend.strip() or "auto",
            args.tmux_session.strip(),
        )
        if code != 0:
            failures.append((target, output))
        else:
            print(output)

    print("Notified roles: " + ", ".join(targets))
    if failures:
        for target, output in failures:
            print(f"Failed {target}: {output}")
        sys.exit(1)


if __name__ == "__main__":
    main()
