#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: solo-new-feature.sh --project <PROJECT> --short-name <SHORT_NAME> [--feature-id <FEATURE_ID>] [--branch <BRANCH>] [--base-branch <BASE>] [--prd-path <PATH>] [--worktree-root <PATH>] [--no-ledger]"
}

project=""
short_name=""
feature_id=""
branch=""
base_branch="main"
prd_path="TBD"
worktree_root=".solo/worktrees"
no_ledger="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      project="${2:-}"
      shift 2
      ;;
    --short-name)
      short_name="${2:-}"
      shift 2
      ;;
    --feature-id)
      feature_id="${2:-}"
      shift 2
      ;;
    --branch)
      branch="${2:-}"
      shift 2
      ;;
    --base-branch)
      base_branch="${2:-}"
      shift 2
      ;;
    --prd-path)
      prd_path="${2:-}"
      shift 2
      ;;
    --worktree-root)
      worktree_root="${2:-}"
      shift 2
      ;;
    --no-ledger)
      no_ledger="true"
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

if [[ -z "${project}" || -z "${short_name}" ]]; then
  usage
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
py_script="${root_dir}/scripts/solo_new_feature.py"

if [[ ! -f "${py_script}" ]]; then
  echo "Error: solo_new_feature.py not found at ${py_script}"
  exit 1
fi

args=("${py_script}" --project "${project}" --short-name "${short_name}" --base-branch "${base_branch}" --prd-path "${prd_path}" --worktree-root "${worktree_root}")

if [[ -n "${feature_id}" ]]; then
  args+=(--feature-id "${feature_id}")
fi
if [[ -n "${branch}" ]]; then
  args+=(--branch "${branch}")
fi
if [[ "${no_ledger}" == "true" ]]; then
  args+=(--no-ledger)
fi

python3 "${args[@]}"
