#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: solo-onboard.sh --project <PROJECT> [--team <TEAM>] [--languages <LANGUAGES>] [--feature-id <FEATURE_ID>] [--models <MODELS>] [--backend <BACKEND>] [--tmux-session <SESSION>] [--no-open-iterm]"
  echo "TEAM format: PM:1,ARCH:1,BE:1,FE:1,QA:1"
  echo "LANGUAGES format: BE-1:golang,FE-1:vue"
  echo "MODELS format: PM:provider/model,ARCH:provider/model"
}

project=""
team=""
feature_id=""
languages=""
models=""
backend="auto"
tmux_session=""
no_open_iterm="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      project="${2:-}"
      shift 2
      ;;
    --team)
      team="${2:-}"
      shift 2
      ;;
    --feature-id)
      feature_id="${2:-}"
      shift 2
      ;;
    --languages)
      languages="${2:-}"
      shift 2
      ;;
    --model-map|--models)
      models="${2:-}"
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
    --no-open-iterm)
      no_open_iterm="true"
      shift
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

if [[ -z "${project}" ]]; then
  usage
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
py_script="${root_dir}/scripts/solo_onboard.py"

if [[ ! -f "${py_script}" ]]; then
  echo "Error: solo_onboard.py not found at ${py_script}"
  exit 1
fi

args=("${py_script}" --project "${project}")
if [[ -n "${team}" ]]; then
  args+=(--team "${team}")
fi
if [[ -n "${feature_id}" ]]; then
  args+=(--feature-id "${feature_id}")
fi
if [[ -n "${languages}" ]]; then
  args+=(--languages "${languages}")
fi

# If models are not explicitly provided, inherit from current shell model env.
# This keeps newly opened role sessions aligned with the current window model.
if [[ -z "${models}" ]]; then
  if [[ -n "${OPENCODE_MODEL:-}" ]]; then
    models="PM:${OPENCODE_MODEL}"
  fi
fi

if [[ -n "${models}" ]]; then
  args+=(--models "${models}")
fi
if [[ -n "${backend}" ]]; then
  args+=(--backend "${backend}")
fi
if [[ -n "${tmux_session}" ]]; then
  args+=(--tmux-session "${tmux_session}")
fi
if [[ "${no_open_iterm}" == "true" ]]; then
  args+=(--no-open-iterm)
fi

python3 "${args[@]}"
