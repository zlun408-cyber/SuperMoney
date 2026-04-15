---
description: When the FeatureId/project information is not provided, the system will automatically locate the executable tasks or requirements entry for the current role.
---
# /solo-pick

目标：在未提供 FeatureId / 项目信息时，为当前角色自动定位可执行任务或需求入口。

## 需要的参数（可选）
- role：PM | ARCH | BE | FE | QA。默认使用当前主代理角色。
- project：项目代号（用于优先过滤）。
- auto_claim：true/false，默认 false（是否自动认领任务）。

## 执行步骤（严格按顺序）
1. 读取规则索引与角色规则：
   - `docs/SPACE_INDEX.md`
   - `docs/framework/core_rules.md`
   - `docs/framework/<ROLE>.md`
   - `docs/tasks/README.md`
2. 若角色为 PM，先扫描需求（优先级高于任务）：
   - 直接匹配需求文件：
     - `docs/requirements/*/PM_REQUIREMENTS.md`
     - 兼容：`docs/requirements/*/PM_REQUIREMENT.md`
   - 以需求文件父目录作为 FeatureId
   - 对每个 FeatureId：
     - 检查 `docs/ledger/{FeatureId}/LEDGER.md` 是否存在
     - 若不存在：提示“需求未进入流转，是否开始？”
     - 若存在：读取阶段状态并提示是否继续推进
   - 若存在多个需求：列出 FeatureId/ShortName 让用户选择
   - 若无任何需求：提示用户提供需求地址/口述
3. 非 PM 或 PM 选择跳过需求时，扫描任务：
   - 待认领目录：`docs/tasks/*/assigned/`
   - 执行中目录：`docs/tasks/*/in-progress/`
   - 过滤条件：Task 元信息 `Role` == <ROLE>
   - 若发现执行中任务，优先建议继续该任务
4. 任务状态补全：
   - 读取对应 `docs/ledger/{FeatureId}/LEDGER.md`（若存在）
   - 提取阶段状态并用于展示
5. 项目过滤（如提供 project）：
   - 仅保留对应 `docs/project/{project}/docs/index.md` 标记的任务
6. 结果处理：
   - 若仅 1 个任务：输出任务路径与建议动作
   - 若多于 1 个任务：列出清单，请用户选择
   - 若为 0 个任务：提示用户提供 `feature_id` 或 `project`

## 自动认领规则
- 仅当 `auto_claim=true` 且用户明确授权时执行：
  - 将任务从 `assigned/` 移动至 `in-progress/`
  - 文件名追加 `-wip.md`
  - 在 Task 内记录状态变更并同步更新 `Status` 字段

## 输出要求
- 输出匹配任务列表（含 FeatureId、TaskId、路径）
- 给出下一步 1-3 条建议
- 明确是否需要用户确认/授权

## 注意
- 未经明确授权，不自动创建/修改文件。
- FeatureId 只能由 PM 生成一次，其它角色必须复用。
- 所有动作不得影响仓库外部状态流转。
