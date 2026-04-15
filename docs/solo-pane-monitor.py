#!/usr/bin/env python3
"""
solo-pane-monitor.py - 读取并监控终端 pane 输出（iTerm2 / tmux）

用法（持续监控模式）:
    python3 solo-pane-monitor.py watch [--roles PM,ARCH,BE,FE,QA] [--interval 5] [--backend auto|iterm2|tmux] [--tmux-session SESSION]

用法（单次读取）:
    python3 solo-pane-monitor.py read <ROLE> [行数] [--backend auto|iterm2|tmux] [--tmux-session SESSION]

用法（读取全部角色状态）:
    python3 solo-pane-monitor.py status [行数] [--backend auto|iterm2|tmux] [--tmux-session SESSION]
"""

import argparse
import asyncio
import importlib
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from terminal_backend import (  # noqa: E402
    capture_tmux_pane,
    list_tmux_panes,
    locate_tmux_target_pane,
    resolve_backend,
    session_matches,
    tmux_current_context,
    tmux_display_name,
)


ROLES = ["PM", "ARCH", "BE", "FE", "QA"]
STATE_DIR = Path("/tmp/solo-pane-state")
STATE_DIR.mkdir(exist_ok=True)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Monitor role terminals")
    sub = parser.add_subparsers(dest="command", required=True)

    watch = sub.add_parser("watch")
    watch.add_argument("--roles", default="PM,ARCH,BE,FE,QA")
    watch.add_argument("--interval", type=int, default=5)
    watch.add_argument("--backend", default="auto")
    watch.add_argument("--tmux-session", default="")

    read = sub.add_parser("read")
    read.add_argument("role")
    read.add_argument("num_lines", nargs="?", type=int, default=200)
    read.add_argument("--backend", default="auto")
    read.add_argument("--tmux-session", default="")

    status = sub.add_parser("status")
    status.add_argument("num_lines", nargs="?", type=int, default=100)
    status.add_argument("--backend", default="auto")
    status.add_argument("--tmux-session", default="")

    return parser.parse_args(argv)


async def find_iterm2_session(app, role):
    for window in app.terminal_windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session_matches(session.name, role):
                    return session
    return None


async def read_iterm2_lines(iterm2, session, num_lines=200):
    async with iterm2.Transaction(session.connection):
        info = await session.async_get_line_info()
        start = max(info.overflow, info.total_lines - num_lines)
        lines = await session.async_get_contents(start, num_lines)
        return [line.string for line in lines]


def find_tmux_role_pane(role, tmux_session=""):
    context = tmux_current_context()
    session_name = tmux_session or context["session_name"]
    panes = list_tmux_panes(session_name=session_name)
    pane = locate_tmux_target_pane(
        panes,
        target_name=role,
        source_pane_title=context["pane_title"],
        current_role=context["pane_title"] or "PM-1",
        current_session_name=session_name,
    )
    return pane


async def read_all_iterm2_roles(iterm2, app, roles, num_lines):
    results = {}
    for role in roles:
        session = await find_iterm2_session(app, role)
        if session:
            results[role] = {
                "status": "found",
                "session_name": session.name,
                "lines": await read_iterm2_lines(iterm2, session, num_lines),
            }
        else:
            results[role] = {"status": "not_found", "lines": []}
    return results


def read_all_tmux_roles(roles, num_lines, tmux_session=""):
    results = {}
    for role in roles:
        pane = find_tmux_role_pane(role, tmux_session)
        if pane:
            results[role] = {
                "status": "found",
                "session_name": tmux_display_name(pane),
                "lines": capture_tmux_pane(pane["pane_id"], num_lines),
            }
        else:
            results[role] = {"status": "not_found", "lines": []}
    return results


def render_status(results, roles):
    output = []
    for role in roles:
        data = results[role]
        if data["status"] == "found":
            lines = data["lines"]
            session_name = data["session_name"]
            output.append(f"\n{'=' * 60}")
            output.append(f"【{role}】Session: {session_name}")
            output.append(f"{'=' * 60}")
            show_lines = lines[-30:] if len(lines) > 30 else lines
            output.append("\n".join(show_lines))
        else:
            output.append(f"\n{'=' * 60}")
            output.append(f"【{role}】未找到对应 Session")
            output.append(f"{'=' * 60}")
    return "\n".join(output)


async def write_watch_files_iterm2(iterm2, app, roles, interval):
    print(f"开始监控角色: {', '.join(roles)}，间隔 {interval} 秒")
    print(f"状态文件目录: {STATE_DIR}")
    print("按 Ctrl+C 停止\n")
    while True:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        for role in roles:
            session = await find_iterm2_session(app, role)
            state_file = STATE_DIR / f"{role}.txt"
            if session:
                lines = await read_iterm2_lines(iterm2, session, 100)
                content = f"# Updated: {timestamp}\n# Session: {session.name}\n" + "\n".join(lines)
            else:
                content = f"# Updated: {timestamp}\n# Status: Session not found\n"
            state_file.write_text(content)
        print(f"[{timestamp}] 已更新所有角色状态")
        await asyncio.sleep(interval)


def write_watch_files_tmux(roles, interval, tmux_session=""):
    print(f"开始监控角色: {', '.join(roles)}，间隔 {interval} 秒")
    print(f"状态文件目录: {STATE_DIR}")
    print("按 Ctrl+C 停止\n")
    while True:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        for role in roles:
            pane = find_tmux_role_pane(role, tmux_session)
            state_file = STATE_DIR / f"{role}.txt"
            if pane:
                lines = capture_tmux_pane(pane["pane_id"], 100)
                content = f"# Updated: {timestamp}\n# Session: {tmux_display_name(pane)}\n" + "\n".join(lines)
            else:
                content = f"# Updated: {timestamp}\n# Status: Session not found\n"
            state_file.write_text(content)
        print(f"[{timestamp}] 已更新所有角色状态")
        time.sleep(interval)


def main(argv=None):
    args = parse_args(argv)
    roles = [role.strip() for role in getattr(args, "roles", "PM,ARCH,BE,FE,QA").split(",") if role.strip()]
    backend = resolve_backend(getattr(args, "backend", "auto"))

    if backend == "tmux":
        if args.command == "watch":
            write_watch_files_tmux(roles, args.interval, args.tmux_session)
            return 0
        if args.command == "read":
            pane = find_tmux_role_pane(args.role, args.tmux_session)
            if not pane:
                print(f"[{args.role}] Session not found")
                return 1
            print(f"[{args.role}] {tmux_display_name(pane)}\n" + "\n".join(capture_tmux_pane(pane["pane_id"], args.num_lines)))
            return 0
        results = read_all_tmux_roles(ROLES, args.num_lines, args.tmux_session)
        print(render_status(results, ROLES))
        return 0

    iterm2 = importlib.import_module("iterm2")
    exit_code = 0

    async def _run(connection):
        nonlocal exit_code
        app = await iterm2.async_get_app(connection)
        if args.command == "watch":
            await write_watch_files_iterm2(iterm2, app, roles, args.interval)
            exit_code = 0
            return
        if args.command == "read":
            session = await find_iterm2_session(app, args.role)
            if not session:
                print(f"[{args.role}] Session not found")
                exit_code = 1
                return
            print(f"[{args.role}] {session.name}\n" + "\n".join(await read_iterm2_lines(iterm2, session, args.num_lines)))
            exit_code = 0
            return
        results = await read_all_iterm2_roles(iterm2, app, ROLES, args.num_lines)
        print(render_status(results, ROLES))
        exit_code = 0

    iterm2.run_until_complete(_run, retry=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
