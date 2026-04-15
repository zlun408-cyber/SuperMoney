#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: solo-config-init.sh [--all-default] [--config <path>]... [--global-config <path>] [--skip-global]"
  echo "Example: solo-config-init.sh --all-default"
  echo "Example: solo-config-init.sh --config opencode.json --config .opencode/opencode.json"
  echo "Example: solo-config-init.sh --all-default --global-config ~/.config/opencode/config.json"
}

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
py_script="${root_dir}/scripts/solo_config_init.py"

if [[ ! -f "${py_script}" ]]; then
  echo "Error: solo_config_init.py not found at ${py_script}"
  exit 1
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

python3 "${py_script}" "$@"
