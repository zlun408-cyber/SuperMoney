# Task 流转规则

## 目录即状态
- `assigned/`：待认领（禁止执行）
- `in-progress/`：执行中（排他）
- `completed/`：待验收
- `archived/`：已归档

## 文件名规则
- 基础名：`YYYY-MM-DD-ROLE-<UUID>.md`
- WIP：追加 `-wip.md`，仅在 `in-progress/`
- DONE：追加 `-done.md`，仅在 `completed/`
## 状态来源
- Task 状态以目录与文件名后缀为主，Task 内容必须同步维护 `Status` 字段并记录变更时间。

## 标准流转
1. 认领：`assigned/` → `in-progress/` 并改为 `-wip.md`
2. 提交：`in-progress/` → `completed/` 并改为 `-done.md`
3. 验收通过：`completed/` → `archived/` 并去掉状态后缀（由 PM 执行）
4. 验收不通过：`completed/` → `in-progress/`
## 可选快速流转
- 通过 `solo-pass` 自审完成并自动归档后流转到下一角色（需用户确认）。

## 强制动作
- 物理移动文件 + 改名 + Task 内记录状态变更，并同步更新 `Status` 字段。
- BE/FE 进入 `in-progress/` 时必须创建对应的 `*-LEDGER.md` 与 `*-DELIVERY.md`（位于 `docs/ledger/{FeatureId}/`）。
- QA 认领必须移动到 `in-progress/` 并加 `-wip.md`，提交必须移动到 `completed/` 并加 `-done.md`。
