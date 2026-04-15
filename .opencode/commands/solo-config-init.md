---
description: Merge solo command instructions into OpenCode config JSON files.
---
# /solo-config-init

目标：将 AI Solo 相关指令文档合并写入 OpenCode 配置文件（JSON 解析 + 合并保存）。

## 参数
- `config`（可选，可多次）：指定要更新的配置文件路径。
- `all_default`（可选）：是否更新默认配置文件（`opencode.json` 与 `.opencode/opencode.json`），默认 true。
- `global_config`（可选）：开发机真实 OpenCode 配置路径。
- `skip_global`（可选）：跳过开发机真实配置更新。

## 执行步骤
1. 运行脚本：
   - `./scripts/solo-config-init.sh --all-default`
2. 脚本解析原始 JSON，合并 `instructions`，去重并保留已有配置。
3. 同步保存仓库内配置与开发机真实配置文件。

## 注意
- 不会覆盖其它字段，只更新/补充 `instructions`。
- JSON 非法时会报错并停止。
