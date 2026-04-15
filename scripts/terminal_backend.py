#!/usr/bin/env python3
import importlib.util
import os
import shutil
import subprocess


ROLE_ORDER = ["PM", "ARCH", "BE", "FE", "QA"]


def session_matches(session_name: str, needle: str):
    return needle.lower() in (session_name or "").lower()


def iterm2_available():
    return importlib.util.find_spec("iterm2") is not None


def tmux_available(which_fn=shutil.which):
    return bool(which_fn("tmux"))


def resolve_backend(
    requested: str,
    env=None,
    which_fn=shutil.which,
    iterm2_available_fn=iterm2_available,
):
    env = env or os.environ
    requested = (requested or "auto").strip().lower()
    if requested not in {"auto", "iterm2", "tmux"}:
        raise ValueError("--backend must be one of auto|iterm2|tmux")

    has_tmux = tmux_available(which_fn=which_fn)
    inside_tmux = bool(env.get("TMUX"))
    has_iterm2 = iterm2_available_fn()

    if requested == "tmux":
        if not has_tmux:
            raise RuntimeError("tmux backend requested but tmux is not installed")
        return "tmux"

    if requested == "iterm2":
        if not has_iterm2:
            raise RuntimeError("iTerm2 backend requested but Python package 'iterm2' is unavailable")
        return "iterm2"

    if inside_tmux and has_tmux:
        return "tmux"
    if has_iterm2:
        return "iterm2"

    raise RuntimeError("No supported terminal backend found. Install tmux or pip install iterm2.")


def run_tmux(args, capture_output=True, text=True, check=True):
    return subprocess.run(
        ["tmux", *args],
        capture_output=capture_output,
        text=text,
        check=check,
    )


def parse_tmux_panes(raw: str):
    panes = []
    for line in (raw or "").splitlines():
        pane_id, pane_title, window_id, session_name = (line.split("\t") + ["", "", "", ""])[:4]
        panes.append(
            {
                "pane_id": pane_id,
                "pane_title": pane_title,
                "window_id": window_id,
                "session_name": session_name,
            }
        )
    return panes


def parse_tmux_capture(raw: str):
    return (raw or "").splitlines()


def tmux_display_name(pane: dict):
    return pane.get("pane_title") or pane.get("pane_id") or "(unknown)"


def list_tmux_panes(session_name: str = "", run_fn=run_tmux):
    args = ["list-panes", "-a", "-F", "#{pane_id}\t#{pane_title}\t#{window_id}\t#{session_name}"]
    if session_name:
        args[1:1] = ["-t", session_name]
    result = run_fn(args)
    return parse_tmux_panes(result.stdout)


def tmux_current_context(run_fn=run_tmux):
    result = run_fn(["display-message", "-p", "#{session_name}\t#{window_id}\t#{pane_id}\t#{pane_title}"])
    parts = (result.stdout.strip().split("\t") + ["", "", "", ""])[:4]
    return {
        "session_name": parts[0],
        "window_id": parts[1],
        "pane_id": parts[2],
        "pane_title": parts[3],
    }


def locate_tmux_target_pane(
    panes,
    target_name: str,
    source_pane_title: str = "",
    current_role: str = "PM-1",
    current_session_name: str = "",
):
    scoped_panes = []

    def window_for_title(title: str):
        if not title:
            return ""
        for pane in panes:
            if session_matches(pane.get("pane_title", ""), title):
                return pane.get("window_id", "")
        return ""

    preferred_window = window_for_title(source_pane_title) or window_for_title(current_role)
    if preferred_window:
        scoped_panes = [pane for pane in panes if pane.get("window_id") == preferred_window]
        for pane in scoped_panes:
            if session_matches(pane.get("pane_title", ""), target_name):
                return pane

    if current_session_name:
        scoped_panes = [pane for pane in panes if pane.get("session_name") == current_session_name]
        for pane in scoped_panes:
            if session_matches(pane.get("pane_title", ""), target_name):
                return pane

    for pane in panes:
        if session_matches(pane.get("pane_title", ""), target_name):
            return pane
    return None


def send_tmux_text(target_pane_id: str, text: str, run_fn=run_tmux):
    clean_text = (text or "").rstrip()
    run_fn(["send-keys", "-t", target_pane_id, clean_text])
    run_fn(["send-keys", "-t", target_pane_id, "Enter"])
    return clean_text


def capture_tmux_pane(target_pane_id: str, num_lines: int = 200, run_fn=run_tmux):
    result = run_fn(["capture-pane", "-p", "-t", target_pane_id, f"-S-{num_lines}"])
    return parse_tmux_capture(result.stdout)


def set_tmux_pane_title(target_pane_id: str, title: str, run_fn=run_tmux):
    run_fn(["select-pane", "-t", target_pane_id, "-T", title])


def split_tmux_pane(target: str, run_fn=run_tmux):
    result = run_fn(["split-window", "-v", "-t", target, "-P", "-F", "#{pane_id}"])
    return result.stdout.strip()


def select_tmux_layout(target: str, layout: str = "tiled", run_fn=run_tmux):
    run_fn(["select-layout", "-t", target, layout])


def compute_missing_pane_titles(existing_titles, team: dict, role_order=None):
    role_order = role_order or ROLE_ORDER
    existing = {title.strip() for title in existing_titles if (title or "").strip()}
    missing = []
    for role in role_order:
        for index in range(1, team.get(role, 0) + 1):
            title = f"{role}-{index}"
            if title not in existing:
                missing.append(title)
    return missing
