import unittest


def session_matches(session_name, needle):
    return needle.lower() in session_name.lower()


def locate_target_session(windows, target_name, source_session_name=None, current_role="PM"):
    current_window_sessions = []
    if source_session_name:
        for window in windows:
            session_names = [session for tab in window for session in tab]
            if any(session_matches(session, source_session_name) for session in session_names):
                current_window_sessions = session_names
                break

    if not current_window_sessions:
        for window in windows:
            session_names = [session for tab in window for session in tab]
            if any(session_matches(session, current_role) for session in session_names):
                current_window_sessions = session_names
                break

    search_pool = current_window_sessions or [session for window in windows for tab in window for session in tab]
    for session_name in search_pool:
        if session_matches(session_name, target_name):
            return session_name
    return None


class NotifyRoleWindowScopeTest(unittest.TestCase):
    def test_prefers_target_in_pm_window(self):
        windows = [
            [["PM (node)", "ARCH (node)", "FE (node)"]],
            [["PM-1 (.opencode)", "ARCH-1 (.opencode)", "FE-1 (.opencode)"]],
        ]

        self.assertEqual(locate_target_session(windows, "ARCH", current_role="PM-1"), "ARCH-1 (.opencode)")

    def test_prefers_target_in_source_pm_window(self):
        windows = [
            [["PM (node)", "ARCH (node)", "FE (node)"]],
            [["PM-1 (.opencode)", "ARCH-1 (.opencode)", "FE-1 (.opencode)"]],
        ]

        self.assertEqual(
            locate_target_session(windows, "ARCH", source_session_name="PM (node)", current_role="PM-1"),
            "ARCH (node)",
        )

    def test_falls_back_to_global_search_when_pm_window_missing(self):
        windows = [
            [["ARCH (node)", "FE (node)"]],
            [["ARCH-1 (.opencode)", "FE-1 (.opencode)"]],
        ]

        self.assertEqual(locate_target_session(windows, "ARCH-1", current_role="PM-1"), "ARCH-1 (.opencode)")


if __name__ == "__main__":
    unittest.main()
