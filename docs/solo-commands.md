# Solo Commands 快速说明

面向协作者的上手说明，覆盖 `/solo-new-feature`、`/solo-start`、`/solo-pick`、`/solo-pass`、`/solo-notify`、`/solo-auto-notify`、`/solo-onboard`、`/solo-config-init`。

## /solo-new-feature
用途：初始化新需求并创建独立 git worktree + 功能分支。

参数：
- `project`（必填）：项目代号
- `short_name`（必填）：需求短名（用于生成 FeatureId）
- `feature_id`（可选）：手动指定 FeatureId
- `branch`（可选）：手动指定分支名（默认 `feature/<FeatureId>`）
- `base_branch`（可选）：基线分支（默认 `main`）
- `prd_path`（可选）：PRD 路径
- `worktree_root`（可选）：worktree 根目录（默认 `.solo/worktrees`）
- `no_ledger`（可选）：是否跳过初始化 `LEDGER.md` / `DELIVERY.md`

示例：
```
/solo-new-feature project=ai-solo-template short_name=billing-tree prd_path=docs/prd/billing-tree.md
```

## /solo-start
用途：初始化角色上下文与项目资料加载。

参数：
- `role`（可选）：PM | ARCH | BE | FE | QA（默认 PM）
- `feature_id`（可选）：已有需求时填写；否则自动扫描或由 PM 生成
- `prd_path`（可选）：PRD 路径（本地路径或文档链接）
- `design_assets`（可选）：原型/HTML 设计图路径，或 HTML 列表文件路径（建议存放到 `docs/requirements/{FeatureId}/assets/`）
- `project`（可选）：项目代号，对应 `docs/project/{project}/docs`
- `project_path`（可选）：存量项目根目录（仅生成索引，不复制源码）
- `team`（可选）：项目团队配置，建议格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`
- `extra_roles`（可选）：附加预加载角色（逗号分隔），例如 `ARCH,BE`

示例：
```
/solo-start
/solo-start role=ARCH feature_id=obs-download-test-20260128153045-a1b2
/solo-start project=ai-solo project_path=docs/project/ai-solo
```

## /solo-pick
用途：未提供 FeatureId 时自动定位可执行任务或需求入口。

参数：
- `role`（可选）：PM | ARCH | BE | FE | QA
- `project`（可选）：项目代号（优先过滤）
- `auto_claim`（可选）：true/false，是否自动认领

示例：
```
/solo-pick
/solo-pick role=BE auto_claim=true
```

## /solo-pass
用途：角色自检通过后，跳过 PM 审核，完成任务归档并自动流转到下一角色。

参数：
- `feature_id`（必填）：当前 FeatureId
- `task_path`（必填）：当前任务文件路径（可在 `assigned/` / `in-progress/` / `completed/`）
- `role`（可选）：PM | ARCH | BE | FE | QA
- `project`（可选）：项目代号（用于通知 PM 归档索引）
- `next`（可选）：指定下一角色

示例：
```
/solo-pass feature_id=obs-download-test-20260128153045-a1b2 \
task_path=docs/tasks/obs-download-test-20260128153045-a1b2/completed/2026-01-29-ARCH-1a2b3c4d-done.md
```

## /solo-notify
用途：通过 iTerm2 会话或 tmux pane 向指定角色发送消息（或命令）。

参数：
- `role`（必填）：PM | ARCH | BE | FE | QA
- `text`（必填）：要发送的文本（建议用引号包裹）
- `feature_id`（可选）：显式指定 FeatureId；未提供则使用当前会话中的 FeatureId
- `project`（可选）：显式指定项目代号；未提供则使用当前会话中的 project
- `backend`（可选）：`auto|iterm2|tmux`
- `tmux_session`（可选）：tmux session 名称（仅 `tmux` 后端使用）

前置依赖：
- iTerm2 后端：`pip install iterm2`
- tmux 后端：本机已安装 `tmux`

示例：
```
/solo-notify role=PM text="需要你查看设计缺口"
/solo-notify role=PM text="需要你查看设计缺口" backend=tmux
```

## /solo-auto-notify
用途：当前角色完成后，按默认流转自动通知下一角色开始任务。

参数：
- `role`（必填）：当前角色（PM | ARCH | BE | FE | QA）
- `project`（可选）：项目代号；提供后按 `team.md` 过滤禁用角色
- `feature_id`（可选）：FeatureId（会追加到通知上下文）
- `next`（可选）：手动指定下一角色（逗号分隔）
- `text`（可选）：自定义通知文案
- `backend`（可选）：`auto|iterm2|tmux`
- `tmux_session`（可选）：tmux session 名称（仅 `tmux` 后端使用）

示例：
```
/solo-auto-notify role=ARCH project=ai-solo-template feature_id=obs-download-test-20260128153045-a1b2
/solo-auto-notify role=ARCH project=ai-solo-template feature_id=obs-download-test-20260128153045-a1b2 backend=tmux
```

## 进一步阅读
- 详细流程：`docs/solo-new-feature.md`、`docs/solo-start.md`、`docs/solo-pick.md`、`docs/solo-pass.md`、`docs/solo-notify.md`、`docs/solo-auto-notify.md`、`docs/solo-onboard.md`、`docs/solo-config-init.md`

## /solo-config-init
用途：解析并合并 OpenCode 配置 JSON，自动补齐 AI Solo 指令 `instructions`。

参数：
- `all_default`（可选）：更新默认配置（`opencode.json` + `.opencode/opencode.json`）
- `config`（可选）：指定配置文件路径，可重复
- `global_config`（可选）：开发机真实配置路径（如 `~/.config/opencode/opencode.json`）
- `skip_global`（可选）：仅更新仓库内配置

示例：
```
/solo-config-init all_default=true
```

## /solo-onboard
用途：PM 在确认团队角色与人数后，一键生成团队成员清单并拉起 iTerm2 会话或 tmux pane 自动进入对应角色。

参数：
- `project`（必填）：项目代号
- `team`（必填）：团队配置，格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`
- `feature_id`（可选）：若提供则自动在会话中注入
- `languages`（可选）：成员级语种映射，格式 `BE-1:golang,FE-1:vue`
- `models`（可选）：按角色指定模型，格式 `PM:provider/model,ARCH:provider/model,BE:provider/model,FE:provider/model,QA:provider/model`
- `backend`（可选）：`auto|iterm2|tmux`
- `tmux_session`（可选）：tmux session 名称（仅 `tmux` 后端使用）
- `open_iterm`（可选）：true/false，默认 true；兼容保留，实际表示是否跳过终端启动

示例：
```
/solo-onboard project=ai-solo-template team="PM:1,ARCH:1,BE:2,FE:2,QA:1" languages="BE-1:golang,BE-2:java,FE-1:vue,FE-2:vue" feature_id=solo-workspace-20260307103000-a1b2
/solo-onboard project=ai-solo-template team="PM:1,ARCH:1,BE:1,FE:1,QA:1" backend=tmux
```
