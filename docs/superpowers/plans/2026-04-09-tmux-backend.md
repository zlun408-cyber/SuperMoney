# tmux Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared terminal backend layer so `solo-onboard`, `solo-notify`, and `solo-auto-notify` work with either iTerm2 or tmux.

**Architecture:** Introduce a shared Python helper module for backend detection and tmux process orchestration, then update existing notify/onboard scripts to call that module while preserving the existing iTerm2 path. Keep shell entrypoints backward-compatible by only adding optional arguments.

**Tech Stack:** Python 3, bash, tmux CLI, iTerm2 Python API, `unittest`

---

### Task 1: Add failing backend tests

**Files:**
- Create: `tests/test_terminal_backend.py`
- Modify: `tests/test_solo_notify_args.py`
- Test: `tests/test_terminal_backend.py`

- [ ] **Step 1: Write the failing tests**

```python
class BackendSelectionTest(unittest.TestCase):
    def test_auto_prefers_tmux_inside_tmux(self):
        ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tests.test_terminal_backend tests.test_solo_notify_args -v`
Expected: FAIL because backend helpers and new CLI forwarding do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create shared backend helpers and update shell wrapper parsing only enough to satisfy the new tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_terminal_backend tests.test_solo_notify_args -v`
Expected: PASS

### Task 2: Add tmux notify support

**Files:**
- Create: `scripts/terminal_backend.py`
- Modify: `docs/notify_role.py`
- Modify: `scripts/solo-notify.sh`
- Modify: `scripts/solo_auto_notify.py`
- Modify: `scripts/solo-auto-notify.sh`
- Test: `tests/test_terminal_backend.py`

- [ ] **Step 1: Write the failing tests**

Add tests for tmux pane lookup priority and notify command construction.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tests.test_terminal_backend -v`
Expected: FAIL because tmux lookup/send logic is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Implement `auto`, `iterm2`, and `tmux` notify dispatch with optional source pane and tmux session forwarding.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_terminal_backend -v`
Expected: PASS

### Task 3: Add tmux onboard support

**Files:**
- Modify: `scripts/solo_onboard.py`
- Modify: `scripts/solo-onboard.sh`
- Test: `tests/test_terminal_backend.py`

- [ ] **Step 1: Write the failing tests**

Add tests for tmux onboarding command generation and backend selection.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tests.test_terminal_backend -v`
Expected: FAIL because tmux onboarding helpers are missing.

- [ ] **Step 3: Write minimal implementation**

Add a tmux bootstrap path that reuses the current window, creates missing panes, titles them, and sends the role bootstrap commands.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_terminal_backend -v`
Expected: PASS

### Task 4: Update docs and verify end-to-end behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/solo-notify.md`
- Modify: `docs/solo-auto-notify.md`
- Modify: `docs/solo-onboard.md`
- Modify: `docs/solo-commands.md`

- [ ] **Step 1: Update docs**

Document `--backend`, tmux support, auto-detection rules, and usage examples.

- [ ] **Step 2: Run verification**

Run: `python3 -m unittest tests.test_notify_role_window_scope tests.test_solo_notify_args tests.test_terminal_backend -v`
Expected: PASS

- [ ] **Step 3: Sanity-check CLI help**

Run: `bash scripts/solo-notify.sh --help`, `bash scripts/solo-auto-notify.sh --help`, `bash scripts/solo-onboard.sh --help`
Expected: usage text includes new backend options.
