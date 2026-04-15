import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import terminal_backend  # noqa: E402


class BackendSelectionTest(unittest.TestCase):
    def test_auto_prefers_tmux_inside_tmux(self):
        backend = terminal_backend.resolve_backend(
            "auto",
            env={"TMUX": "/tmp/tmux-1000/default,123,0"},
            which_fn=lambda cmd: "/usr/bin/tmux" if cmd == "tmux" else None,
            iterm2_available_fn=lambda: True,
        )
        self.assertEqual(backend, "tmux")

    def test_auto_falls_back_to_iterm2(self):
        backend = terminal_backend.resolve_backend(
            "auto",
            env={},
            which_fn=lambda cmd: None,
            iterm2_available_fn=lambda: True,
        )
        self.assertEqual(backend, "iterm2")

    def test_explicit_tmux_requires_binary(self):
        with self.assertRaisesRegex(RuntimeError, "tmux"):
            terminal_backend.resolve_backend(
                "tmux",
                env={},
                which_fn=lambda cmd: None,
                iterm2_available_fn=lambda: False,
            )


class TmuxPaneRoutingTest(unittest.TestCase):
    def test_prefers_source_window_first(self):
        panes = [
            {"pane_id": "%1", "pane_title": "PM-1", "window_id": "@1", "session_name": "solo"},
            {"pane_id": "%2", "pane_title": "ARCH-1", "window_id": "@1", "session_name": "solo"},
            {"pane_id": "%3", "pane_title": "PM-1", "window_id": "@2", "session_name": "solo"},
            {"pane_id": "%4", "pane_title": "ARCH-1", "window_id": "@2", "session_name": "solo"},
        ]
        target = terminal_backend.locate_tmux_target_pane(
            panes,
            target_name="ARCH",
            source_pane_title="PM-1",
            current_role="PM-1",
            current_session_name="solo",
        )
        self.assertEqual(target["pane_id"], "%2")

    def test_falls_back_to_current_session_when_current_window_missing_target(self):
        panes = [
            {"pane_id": "%1", "pane_title": "PM-1", "window_id": "@1", "session_name": "solo"},
            {"pane_id": "%2", "pane_title": "FE-1", "window_id": "@1", "session_name": "solo"},
            {"pane_id": "%3", "pane_title": "ARCH-1", "window_id": "@2", "session_name": "solo"},
        ]
        target = terminal_backend.locate_tmux_target_pane(
            panes,
            target_name="ARCH",
            source_pane_title="PM-1",
            current_role="PM-1",
            current_session_name="solo",
        )
        self.assertEqual(target["pane_id"], "%3")


class TmuxOnboardPlanningTest(unittest.TestCase):
    def test_collects_missing_titles_in_role_order(self):
        team = {"PM": 1, "ARCH": 1, "BE": 2, "FE": 1, "QA": 1}
        missing = terminal_backend.compute_missing_pane_titles(
            existing_titles=["PM-1", "BE-1"],
            team=team,
            role_order=["PM", "ARCH", "BE", "FE", "QA"],
        )
        self.assertEqual(missing, ["ARCH-1", "BE-2", "FE-1", "QA-1"])


class TmuxCaptureTest(unittest.TestCase):
    def test_capture_output_splits_into_lines(self):
        lines = terminal_backend.parse_tmux_capture("line1\nline2\nline3\n")
        self.assertEqual(lines, ["line1", "line2", "line3"])

    def test_display_name_falls_back_to_pane_id(self):
        pane = {"pane_id": "%7", "pane_title": "", "window_id": "@1", "session_name": "solo"}
        self.assertEqual(terminal_backend.tmux_display_name(pane), "%7")


if __name__ == "__main__":
    unittest.main()
