#!/usr/bin/env bash
# solo-launch.sh - 启动带日志记录的 pane
# 用法: solo-launch.sh <ROLE>
# 例如: solo-launch.sh PM
# 日志输出到: /tmp/sf-<ROLE>.log

ROLE="${1:-}"
LOG_DIR="/tmp"

if [[ -z "${ROLE}" ]]; then
  echo "Usage: solo-launch.sh <ROLE> (PM|ARCH|BE|FE|QA)"
  exit 1
fi

LOG_FILE="${LOG_DIR}/sf-${ROLE}.log"
echo "[$(date)] === Starting ${ROLE} pane ===" > "${LOG_FILE}"

# 使用 script 命令记录所有终端输出，同时运行 opencode
# -q: quiet 模式，不显示 script 本身信息
# opencode: 要执行的命令
script -q "${LOG_FILE}" opencode