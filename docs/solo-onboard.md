---
description: PM confirms team composition, generates team member list, and bootstraps role sessions.
---
# /solo-onboard 使用说明

> 目的：当 PM 确认团队角色与人数后，自动生成项目团队成员列表，并可自动打开 iTerm2 会话或 tmux pane 进入对应角色。

## 快速开始
```bash
/solo-onboard project=ai-solo-template team="PM:1,ARCH:1,BE:2,FE:2,QA:1"
```

## 参数
- `project`（必填）：项目代号。
- `team`（可选）：角色与人数配置，格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`；若项目下已有 `team.md` 则优先加载该文件。
- `feature_id`（可选，兼容保留）：onboard 不依赖 feature。
- `languages`（可选）：成员级语种映射，格式 `BE-1:golang,FE-1:vue`。
- `models`（可选）：按角色指定模型，格式 `PM:provider/model,ARCH:provider/model,BE:provider/model,FE:provider/model,QA:provider/model`。
- `backend`（可选）：`auto|iterm2|tmux`，默认 `auto`。
- `tmux_session`（可选）：显式指定 tmux session；仅 `tmux` 后端使用。
- `open_iterm`（兼容保留）：`true/false`，默认 `true`；底层实际表示是否跳过终端启动。

## 执行流程
1. 校验参数：角色只允许 `PM/ARCH/BE/FE/QA`，人数为非负整数。
2. 计算成员语种：`ARCH` 不绑定语种；`BE` 默认 `golang`；`FE` 默认 `vue`；可由 `--languages` 按成员覆盖。
3. 自动加载代码规范：按成员语种绑定 `docs/coding-standards/{language}.md`。
4. 若规范文件不存在：自动生成占位规范并写入 `docs/coding-standards/`。
5. 写入团队配置：更新 `docs/project/{project}/docs/team.md`。
6. 生成团队成员列表：输出 `docs/project/{project}/docs/team-members.md`。
7. 若 `open_iterm=true`：
   - iTerm2 后端：自动打开 iTerm2 会话并按角色重命名（例如 `PM-1`、`BE-2`）。
   - tmux 后端：自动创建或复用 tmux pane，并设置 pane title（例如 `PM-1`、`BE-2`）。
   - 在每个角色终端中启动 OpenCode，并注入对应角色的 `/solo-start`。

## 输出要求
- 输出团队配置解析结果。
- 输出生成文件路径。
- 输出会话启动结果（成功/失败）。

## 注意事项
- 该命令以 PM 为入口，不替代 PM 对团队配置的最终确认责任。
- `auto` 模式下：若当前运行在 tmux 中且 `tmux` 命令可用，则优先使用 tmux；否则尝试 iTerm2。
- 若本地缺少 iTerm2 Python API（`iterm2`），iTerm2 后端无法打开会话。
- 未提供 `models` 时默认继承 PM 模型；若仅指定 PM 模型，其它角色自动沿用 PM 模型。
- 项目已存在 `team.md` 时优先加载该文件；仅在 `team.md` 缺失时要求传 `team`。
- 语种按成员绑定，不按角色绑定；ARCH 不需要语种。
- 会话启动时会在 `/solo-start` 后追加“加载对应代码规范”的提示。
- 自动启动 OpenCode 使用 `opencode` 命令；如需自定义可通过环境变量 `OPENCODE_LAUNCH_CMD` 覆盖。
