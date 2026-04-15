#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: solo-notify.sh <ROLE> <TEXT> [SOURCE_SESSION_NAME] [--backend <BACKEND>] [--tmux-session <SESSION>]"
  echo "ROLE: PM | ARCH | BE | FE | QA"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

role="${1:-}"
text="${2:-}"
source_session_name="${3:-}"
backend="auto"
tmux_session=""

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

if [[ $# -ge 3 && "${3:-}" != --* ]]; then
  shift 3
else
  source_session_name=""
  shift 2
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      backend="${2:-}"
      shift 2
      ;;
    --tmux-session)
      tmux_session="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${role}" || -z "${text}" ]]; then
  usage
  exit 1
fi

case "${role}" in
  PM|ARCH|BE|FE|QA) ;;
  *)
    echo "Error: role must be one of PM|ARCH|BE|FE|QA"
    exit 1
    ;;
esac

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
notify_script="${root_dir}/docs/notify_role.py"

if [[ ! -f "${notify_script}" ]]; then
  echo "Error: notify_role.py not found at ${notify_script}"
  exit 1
fi

args=("${role}" "${text}")
if [[ -n "${source_session_name}" ]]; then
  args+=("${source_session_name}")
fi
args+=(--backend "${backend}")
if [[ -n "${tmux_session}" ]]; then
  args+=(--tmux-session "${tmux_session}")
fi

python3 "${notify_script}" "${args[@]}"
