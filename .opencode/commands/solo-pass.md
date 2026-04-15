---
description: After the user passes the self-check, the PM review is skipped and the current task is automatically archived and transferred to the next role.
---
# /solo-pass

目标：在用户自检通过后，跳过 PM 审核，自动完成当前任务归档并流转到下一角色。

## 需要的参数（必填/可选）
- feature_id（必填）：当前 FeatureId
- task_path（必填）：当前任务路径（可在 `assigned/` / `in-progress/` / `completed/`）
- role（可选）：PM | ARCH | BE | FE | QA（默认当前角色）
- project（可选）：项目代号（用于 QA 归档索引）
- next（可选）：指定下一角色

## 执行步骤（严格按顺序）
1. 读取命令说明：`docs/solo-pass.md`
2. 校验参数与角色合法性，缺失则追问补全。
3. 按 `docs/solo-pass.md` 的自检清单要求用户明确确认。
4. 在用户确认后执行：
   - 归档任务（移动至 `archived/` 并去后缀）
   - 更新任务内状态记录
   - 更新 `LEDGER.md` / `DELIVERY.md` / `role-DELIVERY.md`
5. 依据规则自动创建下一角色任务（如满足前置条件）。
6. 输出本次归档与流转结果，并给出下一步建议。

## 注意
- 未经用户明确确认不得修改文件或执行流转。
- 只创建**下一角色**任务，且必须从模板复制。
