#!/usr/bin/env python3
import argparse
import asyncio
import importlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from terminal_backend import locate_tmux_target_pane, resolve_backend, list_tmux_panes, send_tmux_text  # noqa: E402
from terminal_backend import session_matches, tmux_current_context  # noqa: E402


def locate_target_session(windows, target_name, source_session_name=None, current_role="PM-1"):
    current_window_sessions = []
    if source_session_name:
        for window in windows:
            sessions = []
            for tab in window.tabs:
                sessions.extend(tab.sessions)
            if any(session_matches(session.name, source_session_name) for session in sessions):
                current_window_sessions = sessions
                break

    for window in windows:
        if current_window_sessions:
            break
        sessions = []
        for tab in window.tabs:
            sessions.extend(tab.sessions)
        if any(session_matches(session.name, current_role) for session in sessions):
            current_window_sessions = sessions
            break

    search_pool = current_window_sessions or [session for window in windows for tab in window.tabs for session in tab.sessions]
    for session in search_pool:
        if session_matches(session.name, target_name):
            return session
    return None


async def _notify_iterm2(connection, args):
    iterm2 = importlib.import_module("iterm2")
    app = await iterm2.async_get_app(connection)
    target_session = locate_target_session(
        app.terminal_windows,
        args.target_name,
        source_session_name=args.source_session_name,
    )

    if not target_session:
        print(f"Error: Could not find session named '{args.target_name}'")
        return 1

    clean_command = args.command_text.rstrip()
    await target_session.async_send_text(clean_command)
    await asyncio.sleep(0.05)
    await target_session.async_send_text("\r")
    print(f"Executed in {target_session.name}: {clean_command}")
    return 0


def notify_iterm2(args):
    iterm2 = importlib.import_module("iterm2")
    exit_code = 0

    async def _run(connection):
        nonlocal exit_code
        exit_code = await _notify_iterm2(connection, args)

    iterm2.run_until_complete(_run, retry=True)
    return exit_code


def notify_tmux(args):
    backend_context = tmux_current_context()
    session_name = args.tmux_session or backend_context["session_name"]
    panes = list_tmux_panes(session_name=session_name)
    target_pane = locate_tmux_target_pane(
        panes,
        target_name=args.target_name,
        source_pane_title=args.source_session_name or backend_context["pane_title"],
        current_role=backend_context["pane_title"] or "PM-1",
        current_session_name=session_name,
    )

    if not target_pane:
        print(f"Error: Could not find tmux pane named '{args.target_name}'")
        return 1

    clean_command = send_tmux_text(target_pane["pane_id"], args.command_text)
    print(f"Executed in {target_pane['pane_title'] or target_pane['pane_id']}: {clean_command}")
    return 0


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Send a command to a role session")
    parser.add_argument("target_name")
    parser.add_argument("command_text")
    parser.add_argument("source_session_name", nargs="?")
    parser.add_argument("--backend", default="auto")
    parser.add_argument("--tmux-session", default="")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    backend = resolve_backend(args.backend)
    if backend == "tmux":
        return notify_tmux(args)
    return notify_iterm2(args)


if __name__ == "__main__":
    raise SystemExit(main())
