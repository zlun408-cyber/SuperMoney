#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: solo-auto-notify.sh --role <ROLE> [--feature-id <FEATURE_ID>] [--project <PROJECT>] [--next <ROLES>] [--text <TEXT>] [--source-session <SESSION_NAME>] [--backend <BACKEND>] [--tmux-session <SESSION>]"
  echo "ROLE: PM | ARCH | BE | FE | QA"
  echo "ROLES format: PM,ARCH,BE,FE,QA"
}

role=""
feature_id=""
project=""
next_roles=""
text=""
source_session=""
backend="auto"
tmux_session=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role)
      role="${2:-}"
      shift 2
      ;;
    --feature-id)
      feature_id="${2:-}"
      shift 2
      ;;
    --project)
      project="${2:-}"
      shift 2
      ;;
    --next)
      next_roles="${2:-}"
      shift 2
      ;;
    --text)
      text="${2:-}"
      shift 2
      ;;
    --source-session)
      source_session="${2:-}"
      shift 2
      ;;
    --backend)
      backend="${2:-}"
      shift 2
      ;;
    --tmux-session)
      tmux_session="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${role}" ]]; then
  usage
  exit 1
fi

case "${role}" in
  PM|ARCH|BE|FE|QA) ;;
  *)
    echo "Error: --role must be one of PM|ARCH|BE|FE|QA"
    exit 1
    ;;
esac

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
py_script="${root_dir}/scripts/solo_auto_notify.py"

if [[ ! -f "${py_script}" ]]; then
  echo "Error: solo_auto_notify.py not found at ${py_script}"
  exit 1
fi

args=("${py_script}" --role "${role}")
if [[ -n "${feature_id}" ]]; then
  args+=(--feature-id "${feature_id}")
fi
if [[ -n "${project}" ]]; then
  args+=(--project "${project}")
fi
if [[ -n "${next_roles}" ]]; then
  args+=(--next "${next_roles}")
fi
if [[ -n "${text}" ]]; then
  args+=(--text "${text}")
fi
if [[ -n "${source_session}" ]]; then
  args+=(--source-session "${source_session}")
fi
if [[ -n "${backend}" ]]; then
  args+=(--backend "${backend}")
fi
if [[ -n "${tmux_session}" ]]; then
  args+=(--tmux-session "${tmux_session}")
fi

python3 "${args[@]}"
