---
description: When the FeatureId/project information is not provided, the system will automatically locate the executable tasks or requirements entry for the current role.
---
# /solo-pick 使用说明

> 目的：当未提供 FeatureId/项目信息时，自动为当前角色定位可执行任务或需求入口。

## 快速开始
```bash
/solo-pick
```

## 参数
- `role`（可选）：PM | ARCH | BE | FE | QA。默认当前主代理角色。
- `project`（可选）：项目代号，优先过滤对应项目。
- `auto_claim`（可选）：true/false，默认 false。

## 识别规则
- **PM 优先看需求**：直接匹配需求文件。
  - `docs/requirements/*/PM_REQUIREMENTS.md`（兼容 `PM_REQUIREMENT.md`）。
  - 以需求文件父目录作为 FeatureId。
  - 若有对应 `LEDGER.md`：展示阶段状态并询问是否继续推进。
  - 若无 `LEDGER.md`：提示是否开始该需求。
  - 多个需求会列出清单让你选择。
- **非 PM 或 PM 跳过需求**：扫描任务目录。
  - `docs/tasks/*/assigned/` + `docs/tasks/*/in-progress/`
  - 过滤 Task 元信息中的 `Role` == 当前角色
  - 若存在执行中任务，提示优先继续
  - 展示 `docs/ledger/{FeatureId}/LEDGER.md` 的阶段状态（若存在）

## 输出结果
- 0 个任务：提示补充 `feature_id` 或 `project`。
- 1 个任务：输出任务路径与建议动作。
- 多个任务：列清单并请用户选择。

## 自动认领
仅在 `auto_claim=true` 且用户确认后执行：
- 文件移动到 `in-progress/`
- 文件改名为 `-wip.md`
- Task 内记录状态变更并同步更新 `Status` 字段

## 注意
- 未授权不修改文件。
- FeatureId 只能由 PM 生成一次，其他角色必须复用。
