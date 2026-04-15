# tmux Backend Compatibility Design

## Goal

Add a terminal backend abstraction so the solo workflow supports both iTerm2 and tmux for:

- session bootstrap via `solo-onboard`
- targeted role messaging via `solo-notify`
- routed notifications via `solo-auto-notify`

The existing iTerm2 flow must keep working.

## Requirements

- Support `--backend auto|iterm2|tmux` across notify and onboard entrypoints.
- In `auto` mode, prefer tmux when running inside tmux and the `tmux` binary is available; otherwise fall back to iTerm2 when the Python API is installed.
- For tmux, treat each role as one pane and identify panes by title such as `PM-1`, `ARCH-1`, `BE-1`, `FE-1`, `QA-1`.
- Preserve current role naming and current routing behavior as much as possible.

## Approach

Create a shared Python backend module under `scripts/` that exposes:

- backend detection helpers
- tmux pane discovery and pane creation helpers
- iTerm2 capability checks

`docs/notify_role.py` becomes the single notify dispatcher:

- iTerm2 branch keeps the existing session search logic
- tmux branch resolves the target pane in the current window first, then falls back to the current session
- sending uses `tmux send-keys`

`scripts/solo_onboard.py` gains a tmux bootstrap path:

- reuse the current tmux window when available
- create missing panes with `split-window`
- set pane titles with `select-pane -T`
- send the same `cd` and `opencode` commands used by iTerm2

Shell wrappers forward the optional backend/session arguments without breaking current call sites.

## tmux Scope Rules

- Prefer the current tmux window when locating panes.
- If the source pane title is provided, search that pane's window first.
- If no match is found, fall back to panes in the current tmux session.
- Use pane title matching, not pane id persistence, so the workflow stays human-readable.

## Risks

- Pane title support depends on tmux being configured normally; matching therefore needs a fallback to pane id metadata from `list-panes`.
- Automatic layout may vary by tmux version, so onboarding should focus on correctness over a fixed visual layout.
- The repo has light test coverage, so the new backend helpers need direct unit tests around routing and command construction.

## Testing Strategy

- Unit test backend auto-detection behavior.
- Unit test tmux pane selection logic.
- Unit test shell wrapper argument forwarding for backend options.
- Run the existing tests plus the new ones with `python3 -m unittest`.
