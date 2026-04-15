import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT_TEMPLATE = """#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo \"Usage: solo-notify.sh <ROLE> <TEXT> [SOURCE_SESSION_NAME] [--backend <BACKEND>] [--tmux-session <SESSION>]\"
  echo \"ROLE: PM | ARCH | BE | FE | QA\"
}

role=\"${1:-}\"
text=\"${2:-}\"
source_session_name=\"${3:-}\"
backend=\"auto\"
tmux_session=\"\"

shift_count=0
if [[ $# -ge 3 && \"${3:-}\" != --* ]]; then
  shift_count=3
else
  shift_count=2
fi

shift \"${shift_count}\"

while [[ $# -gt 0 ]]; do
  case \"$1\" in
    --backend)
      backend=\"${2:-}\"
      shift 2
      ;;
    --tmux-session)
      tmux_session=\"${2:-}\"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo \"Unknown argument: $1\"
      usage
      exit 1
      ;;
  esac
done

if [[ -z \"${role}\" || -z \"${text}\" ]]; then
  usage
  exit 1
fi

case \"${role}\" in
  PM|ARCH|BE|FE|QA) ;;
  *)
    echo \"Error: role must be one of PM|ARCH|BE|FE|QA\"
    exit 1
    ;;
esac

root_dir=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"
notify_script=\"${root_dir}/docs/notify_role.py\"

if [[ ! -f \"${notify_script}\" ]]; then
  echo \"Error: notify_role.py not found at ${notify_script}\"
  exit 1
fi

args=(\"${role}\" \"${text}\")
if [[ -n \"${source_session_name}\" ]]; then
  args+=(\"${source_session_name}\")
fi
args+=(--backend \"${backend}\")
if [[ -n \"${tmux_session}\" ]]; then
  args+=(--tmux-session \"${tmux_session}\")
fi

python3 \"${notify_script}\" \"${args[@]}\"
"""


class SoloNotifyArgsTest(unittest.TestCase):
    def test_source_session_is_not_appended_to_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            scripts_dir = root / "scripts"
            docs_dir = root / "docs"
            scripts_dir.mkdir()
            docs_dir.mkdir()

            notify_script = docs_dir / "notify_role.py"
            notify_script.write_text(
                "import sys\nprint('|'.join(sys.argv[1:]))\n",
                encoding="utf-8",
            )

            solo_notify = scripts_dir / "solo-notify.sh"
            solo_notify.write_text(SCRIPT_TEMPLATE, encoding="utf-8")
            solo_notify.chmod(0o755)

            result = subprocess.run(
                ["bash", str(solo_notify), "ARCH", "hello world", "PM-1"],
                capture_output=True,
                text=True,
                check=True,
            )

            self.assertEqual(result.stdout.strip(), "ARCH|hello world|PM-1|--backend|auto")

    def test_backend_and_tmux_session_are_forwarded(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            scripts_dir = root / "scripts"
            docs_dir = root / "docs"
            scripts_dir.mkdir()
            docs_dir.mkdir()

            notify_script = docs_dir / "notify_role.py"
            notify_script.write_text(
                "import sys\nprint('|'.join(sys.argv[1:]))\n",
                encoding="utf-8",
            )

            solo_notify = scripts_dir / "solo-notify.sh"
            solo_notify.write_text(SCRIPT_TEMPLATE, encoding="utf-8")
            solo_notify.chmod(0o755)

            result = subprocess.run(
                [
                    "bash",
                    str(solo_notify),
                    "ARCH",
                    "hello world",
                    "PM-1",
                    "--backend",
                    "tmux",
                    "--tmux-session",
                    "solo",
                ],
                capture_output=True,
                text=True,
                check=True,
            )

            self.assertEqual(
                result.stdout.strip(),
                "ARCH|hello world|PM-1|--backend|tmux|--tmux-session|solo",
            )


if __name__ == "__main__":
    unittest.main()
