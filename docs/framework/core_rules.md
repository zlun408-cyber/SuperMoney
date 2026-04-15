# Core Rules（全局硬规则）

## 总原则
- 事实优先：所有结论必须可追溯到文件或明确的执行记录；不编造。
- 变更可追溯：任何任务状态与账单更新都必须写入对应文件。
- 单一权威：`docs/ledger/{FeatureId}/LEDGER.md` 是唯一主账。
- 模板只读：`docs/_templates/` 仅允许复制，不允许改写。
- 目录即状态：任务状态以目录与文件名后缀为准，Task 内容同步维护 `Status` 字段。

## 目录与权限
- 需求原文：`docs/requirements/{FeatureId}/`
- 设计输出：`docs/design/{FeatureId}/`
- 任务流转：`docs/tasks/{FeatureId}/{assigned|in-progress|completed|archived}/`
- 主账与分账：`docs/ledger/{FeatureId}/`
- 项目团队定义：`docs/project/{project}/docs/team.md`
## 需求输入与设计隔离
- 需求与原型输入统一放在 `docs/requirements/{FeatureId}/`。
- 原型 HTML / 设计素材放在 `docs/requirements/{FeatureId}/assets/`。
- ARCH 领取任务后需将关键输入与调研资料复制到 `docs/design/{FeatureId}/`（可包含 `assets/`），形成设计侧的物理隔离与证据留存。
- 若用户仅口述并提供外部 HTML 列表文件路径，PM 需在 `PM_REQUIREMENTS.md` 记录该路径；ARCH 领取后将列表文件与相关原型复制到 `docs/design/{FeatureId}/`。

## 文件命名硬规则
- Task 文件名必须含日期与角色：`YYYY-MM-DD-ROLE-<UUID>`
- WIP 必须带 `-wip.md` 后缀，仅存在于 `in-progress/`
- DONE 必须带 `-done.md` 后缀，仅存在于 `completed/`
- 归档去除状态后缀，仅存在于 `archived/`
## 状态权威
- Task 状态以目录与文件名后缀为主，Task 内容必须同步维护 `Status` 字段并记录变更时间。
## TaskId 与文件名映射
- `TaskId` = 任务文件基础名（不含 `-wip.md` / `-done.md` 后缀）。
- 例：`2026-01-29-BE-1a2b3c4d.md` → `TaskId=2026-01-29-BE-1a2b3c4d`。

## FeatureId 命名规则
- 统一格式：`<TaskNameSlug>-<YYYYMMDDHHmmss>-<Rand4>`
- `TaskNameSlug` 取自需求/PRD 的短名（可读、短、用 `-` 连接）
- `YYYYMMDDHHmmss` 使用日期到秒的时间戳读法（24 小时制）
- `Rand4` 为 4 位随机字符串（小写字母或数字）
- FeatureId 只能由 PM 生成一次，所有角色扫描/创建/流转都必须复用该 FeatureId

## 状态流转硬规则
- 只能在指定目录执行工作：`assigned/` 禁止实际执行。
- WIP 目录排他：同一 Task 只允许一个角色进行。
- 完成前必须补齐 Deliverables 与账单对账。
- 标准归档由 PM 执行：`completed/` → `archived/` 并去掉状态后缀。

## 角色边界
- 各角色只维护自己的分账（`*-LEDGER.md` / `*-DELIVERY.md`），不得修改他人分账。
- 主账 `LEDGER.md` 由 PM 负责维护，但各角色在**完成自身分账后**可以勾销对应步骤，并附上分账证据路径。
- 未完成设计阶段（LEDGER 勾选）不得创建 FE/BE 任务。
## 例外：快速流转
- `solo-pass` 允许在用户确认下，由当前角色执行“自审完成 + 自动归档 + 自动流转”。
- 仅可创建**下一角色**的任务，必须使用模板且写入 `assigned/`。

## 分账与执行计划规则
- `role-LEDGER.md` 仅由对应角色维护，用于记录本角色的事实与证据。
- `role-DELIVERY.md` 用于拆解分账步骤的执行计划，需体现依赖关系与顺序。
## LEDGER / DELIVERY 结构约定（最小规范）
- `LEDGER.md` 使用稳定 `LedgerId`（如 `L1/L2`）记录阶段性事实。
- `DELIVERY.md` / `role-DELIVERY.md` 使用 `StepId`（如 `D1/D2`）拆解执行步骤，并引用 `LedgerId`。
- 依赖关系：
  - `DependsOn` 引用 `StepId`（或 `LedgerId`），为空表示可并行。
  - 未满足依赖的步骤不得开始；满足依赖后可多任务并行。

## 项目范围（防止外部影响）
- 所有开发与文档动作只作用于当前仓库与当前项目目录。
- 禁止修改其它项目的 `docs/project/{other}/`。
- 禁止对仓库外部路径做任何写入或状态流转。
- 任一项目启动时必须先定义团队配置（是否启用 PM/ARCH/BE/FE/QA 与人数），并写入 `docs/project/{project}/docs/team.md`。
- PM 确认团队配置后，必须生成 `docs/project/{project}/docs/team-members.md` 作为成员清单。
## 缺陷沉淀路径约定
- QA 缺陷产出：`docs/bugs/{FeatureId}/`（面向本次 Feature 的缺陷证据）。
- 项目沉淀索引：`docs/project/{project}/docs/bugs.md`（由 PM 归档记录 Feature 与解决问题摘要）。

## 记录与时间
- 关键记录必须标注日期（ISO-8601：YYYY-MM-DD）。
- 如信息未知，标注 `TBD`，并在下一次推进中补齐。

## 输出格式建议
- 以清单驱动执行，明确可验收的 Deliverables。
- 涉及依赖的任务，先在 `DELIVERY.md` 明确顺序。
