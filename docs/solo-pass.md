---
description: After the user passes self-check, skip PM review, archive current task, and transfer to next role.
---
# /solo-pass 使用说明

> 目的：在用户自检通过后，跳过 PM 审核，自动完成当前任务并归档，并**代替 PM 继续分发下一角色任务**。

## 快速开始
```bash
/solo-pass
```

## 参数
- `role`（可选）：PM | ARCH | BE | FE | QA。默认当前主代理角色。
- `feature_id`（必填）：当前 FeatureId。
- `task_path`（必填）：当前任务文件路径（可在 `assigned/` / `in-progress/` / `completed/`）。
- `project`（可选）：项目代号，用于通知 PM 归档索引。
- `next`（可选）：指定下一角色，默认按标准流水线（ARCH -> BE/FE -> QA -> PM）。

## 自检清单（必须通过）
- Deliverables 完整（任务内清单已填写）。
- 角色分账已更新（`role-LEDGER.md` / `role-DELIVERY.md`）。
- 证据路径存在（设计/代码/测试/缺陷路径可访问）。
- 依赖条件满足（`DependsOn` 对应步骤已完成）。

## 执行流程
1. 读取规则索引与核心规则：
   - `docs/SPACE_INDEX.md`
   - `docs/framework/core_rules.md`
2. 加载当前角色规则与任务流转规则：
   - `docs/framework/<ROLE>.md`
   - `docs/tasks/README.md`
3. 校验当前任务：
   - `task_path` 必须位于 `docs/tasks/{FeatureId}/` 下的有效状态目录（支持任意状态迁移到 `completed/`）。
   - TaskId 必须等于文件基础名（无 `-done.md` 后缀）。
4. 自检通过后，执行“自审完成并归档”:
   - 先将任务移动到 `docs/tasks/{FeatureId}/completed/` 并改为 `-done.md`。
   - 再移动到 `docs/tasks/{FeatureId}/archived/` 并去掉状态后缀。
   - 在任务内记录状态变更（日期 + `solo-pass`），并同步更新 `Status` 字段。
5. 更新账单与执行计划：
   - 在 `role-LEDGER.md` 与 `role-DELIVERY.md` 标记**全部步骤完成**。
   - 在 `LEDGER.md` 勾销**本角色对应步骤**并附证据路径（允许角色在完成分账后勾销）。
   - 在 `DELIVERY.md` 将对应 StepId 标记为 DONE。
6. 自动流转到下一角色（默认流水线，**必须执行**，代替 PM 分发职责）：
   - ARCH：创建 BE/FE Task 到 `assigned/`，并在 `DELIVERY.md` 填写 TaskId。
   - BE/FE：若 BE 与 FE 均已完成，创建 QA Task 到 `assigned/`。
   - QA：通知 PM 执行项目沉淀更新；如提供 `project`，提醒 PM 更新 `docs/project/{project}/docs/bugs.md`。

## 自动流转细则
- **ARCH -> BE/FE**
  - 前提：`docs/design/{FeatureId}/design-spec.md` 已存在。
  - 动作：从模板创建 BE/FE Task（可多个实例），放入 `docs/tasks/{FeatureId}/assigned/`。
- **BE/FE -> QA**
  - 前提：所有 BE 与 FE 任务已完成（`completed/` 或 `archived/`）。
  - 动作：从模板创建 QA Task 到 `assigned/`，更新 `DELIVERY.md`。
- **QA -> PM 沉淀/收尾**
  - 前提：缺陷已写入 `docs/bugs/{FeatureId}/`。
  - 动作：通知 PM 更新项目沉淀；如提供 `project`，提醒 PM 在 `docs/project/{project}/docs/bugs.md` 追加摘要索引。

## 输出要求
- 列出本次完成的任务路径与变更记录。
- 明确是否已触发下一角色任务，若未触发说明原因。
- 给出下一步建议（1-3 条）。

## 注意事项
- 未经用户明确确认不得执行 `solo-pass`。
- 不修改 `docs/_templates/`。
- 不跨项目写入任何路径。
