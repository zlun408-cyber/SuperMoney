#!/usr/bin/env python3
"""
notify_and_read.py - 终端读写双用脚本（iTerm2 / tmux）

用法:
  python3 notify_and_read.py send <ROLE> "<指令>" [--backend auto|iterm2|tmux] [--tmux-session SESSION]
  python3 notify_and_read.py read <ROLE> [行数=200] [--backend auto|iterm2|tmux] [--tmux-session SESSION]
  python3 notify_and_read.py send-and-read <ROLE> "<指令>" [行数=200] [--backend auto|iterm2|tmux] [--tmux-session SESSION]
"""

import argparse
import asyncio
import importlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from terminal_backend import (  # noqa: E402
    capture_tmux_pane,
    list_tmux_panes,
    locate_tmux_target_pane,
    resolve_backend,
    send_tmux_text,
    session_matches,
    tmux_current_context,
    tmux_display_name,
)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Send commands to and read from role terminals")
    parser.add_argument("action", choices=["send", "read", "send-and-read"])
    parser.add_argument("role")
    parser.add_argument("payload", nargs="?")
    parser.add_argument("extra", nargs="?")
    parser.add_argument("--backend", default="auto")
    parser.add_argument("--tmux-session", default="")
    return parser.parse_args(argv)


def resolve_read_count(args):
    if args.action == "read":
        return int(args.payload) if args.payload else 200
    if args.action == "send-and-read":
        return int(args.extra) if args.extra else 200
    return 200


async def find_iterm2_session(app, target_name):
    for window in app.terminal_windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session_matches(session.name, target_name):
                    return session
    return None


async def send_iterm2_command(session, command_text):
    clean = command_text.rstrip()
    await session.async_send_text(clean)
    await asyncio.sleep(0.05)
    await session.async_send_text("\r")
    return clean


async def read_iterm2_output(iterm2, session, num_lines=200):
    async with iterm2.Transaction(session.connection):
        info = await session.async_get_line_info()
        start = max(info.overflow, info.total_lines - num_lines)
        lines = await session.async_get_contents(start, num_lines)
        return [line.string for line in lines]


async def run_iterm2(connection, args):
    iterm2 = importlib.import_module("iterm2")
    app = await iterm2.async_get_app(connection)
    session = await find_iterm2_session(app, args.role)
    if not session:
        print(f"Error: Could not find session '{args.role}'")
        return 1

    if args.action == "send":
        if not args.payload:
            print("Usage: notify_and_read.py send <ROLE> <指令>")
            return 1
        clean = await send_iterm2_command(session, args.payload)
        print(f"Sent to {session.name}: {clean}")
        return 0

    if args.action == "read":
        print("\n".join(await read_iterm2_output(iterm2, session, resolve_read_count(args))))
        return 0

    if not args.payload:
        print("Usage: notify_and_read.py send-and-read <ROLE> <指令> [行数]")
        return 1
    await send_iterm2_command(session, args.payload)
    await asyncio.sleep(3)
    print("\n".join(await read_iterm2_output(iterm2, session, resolve_read_count(args))))
    return 0


def find_tmux_pane(args):
    context = tmux_current_context()
    session_name = args.tmux_session or context["session_name"]
    panes = list_tmux_panes(session_name=session_name)
    return locate_tmux_target_pane(
        panes,
        target_name=args.role,
        current_role=context["pane_title"] or "PM-1",
        source_pane_title=context["pane_title"],
        current_session_name=session_name,
    )


def run_tmux(args):
    pane = find_tmux_pane(args)
    if not pane:
        print(f"Error: Could not find pane '{args.role}'")
        return 1

    if args.action == "send":
        if not args.payload:
            print("Usage: notify_and_read.py send <ROLE> <指令>")
            return 1
        clean = send_tmux_text(pane["pane_id"], args.payload)
        print(f"Sent to {tmux_display_name(pane)}: {clean}")
        return 0

    if args.action == "read":
        print("\n".join(capture_tmux_pane(pane["pane_id"], resolve_read_count(args))))
        return 0

    if not args.payload:
        print("Usage: notify_and_read.py send-and-read <ROLE> <指令> [行数]")
        return 1
    send_tmux_text(pane["pane_id"], args.payload)
    import time
    time.sleep(3)
    print("\n".join(capture_tmux_pane(pane["pane_id"], resolve_read_count(args))))
    return 0


def main(argv=None):
    args = parse_args(argv)
    backend = resolve_backend(args.backend)
    if backend == "tmux":
        return run_tmux(args)

    iterm2 = importlib.import_module("iterm2")
    exit_code = 0

    async def _run(connection):
        nonlocal exit_code
        exit_code = await run_iterm2(connection, args)

    iterm2.run_until_complete(_run, retry=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
