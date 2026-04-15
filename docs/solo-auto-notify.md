---
description: Automatically notify the next role(s) to start work.
---
# /solo-auto-notify 使用说明

> 目的：当前角色完成步骤后，自动通知下一角色开始任务。

## 快速开始
```bash
/solo-auto-notify role=ARCH project=ai-solo-template feature_id=xxx
```

## 参数
- `role`（必填）：当前角色，PM | ARCH | BE | FE | QA
- `project`（可选）：项目代号；提供后会读取 `docs/project/{project}/docs/team.md`，自动跳过禁用角色
- `feature_id`（可选）：FeatureId，用于追加通知上下文
- `next`（可选）：手动指定下一角色，逗号分隔（如 `BE,QA`）
- `text`（可选）：自定义通知文案；未提供时使用默认文案
- `backend`（可选）：`auto|iterm2|tmux`，默认 `auto`
- `tmux_session`（可选）：显式指定 tmux session；仅 `tmux` 后端使用

## 默认路由
- `PM -> ARCH`
- `ARCH -> BE/FE`（按 team 启用情况过滤）
- `BE -> QA`
- `FE -> QA`
- `QA -> PM`

## 执行方式
```bash
./scripts/solo-auto-notify.sh --role "<ROLE>" [--project "<project>"] [--feature-id "<feature_id>"] [--next "<roles>"] [--text "<text>"]
./scripts/solo-auto-notify.sh --role "<ROLE>" --project "<project>" --feature-id "<feature_id>" --backend tmux [--tmux-session "<session>"]
```

## 输出结果
- 成功：打印每个目标角色的执行结果（来自 `solo-notify.sh`）
- 汇总：打印 `Notified roles: ...`
- 失败：若任一角色发送失败，打印失败项并返回非 0

## 注意事项
- 本命令只负责通知，不创建/流转任务文件。
- 若需自动归档并流转任务，请使用 `/solo-pass`。
- `auto` 模式下：若当前运行在 tmux 中且 `tmux` 命令可用，则优先使用 tmux；否则尝试 iTerm2。
- iTerm2 后端依赖 iTerm2 Python API（`pip install iterm2`）。
- tmux 后端依赖可识别的 pane title。
