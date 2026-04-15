---
description: Merge solo command instructions into OpenCode config JSON files.
---
# /solo-config-init 使用说明

> 目的：把 AI Solo command 指令文档合并到 OpenCode 的配置 JSON，并保存为合并版本。

## 快速开始
```bash
./scripts/solo-config-init.sh --all-default
```

## 参数
- `--all-default`：更新 `opencode.json` 与 `.opencode/opencode.json`。
- `--config <path>`：指定要更新的配置文件路径（可重复）。
- `--global-config <path>`：指定开发机真实 OpenCode 配置文件路径（如 `~/.config/opencode/opencode.json` 或 `~/.config/opencode/config.json`）。
- `--skip-global`：仅更新仓库内配置，不更新开发机真实配置。

## 默认合并的指令
- `docs/SPACE_INDEX.md`
- `docs/framework/core_rules.md`
- `docs/solo-commands.md`
- `docs/solo-new-feature.md`
- `docs/solo-start.md`
- `docs/solo-pick.md`
- `docs/solo-pass.md`
- `docs/solo-notify.md`
- `docs/solo-auto-notify.md`
- `docs/solo-onboard.md`
- `docs/solo-config-init.md`

## 行为说明
- 解析原始 JSON。
- 仅对 `instructions` 进行去重合并（保留原顺序，补齐缺失项）。
- 生成并保存最终 JSON（其它字段保持不变）。
- 默认会同步更新开发机真实配置（自动探测路径，或由 `--global-config` 显式指定）。
