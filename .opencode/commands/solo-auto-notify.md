---
description: Automatically notify the next role(s) to start work.
---
# /solo-auto-notify

目标：当前角色完成后，自动通知下一角色开始任务。

## 参数
- role（必填）：当前角色，PM | ARCH | BE | FE | QA
- project（可选）：项目代号；提供后会读取 `docs/project/{project}/docs/team.md` 自动过滤禁用角色
- feature_id（可选）：FeatureId，会追加到通知上下文
- next（可选）：手动指定下一角色，逗号分隔（如 `BE,QA`）
- text（可选）：自定义通知内容

## 执行步骤
1. 校验参数与角色合法性。
2. 执行命令：
   - `./scripts/solo-auto-notify.sh --role "<role>" [--project "<project>"] [--feature-id "<feature_id>"] [--next "<next>"] [--text "<text>"]`
3. 输出发送结果与最终通知角色清单。

## 默认路由
- `PM -> ARCH`
- `ARCH -> BE/FE`（按 team 启用情况过滤）
- `BE -> QA`
- `FE -> QA`
- `QA -> PM`

## 注意
- 本命令只负责通知，不修改任务状态文件。
- 若需要自动归档和流转，请使用 `/solo-pass`。
