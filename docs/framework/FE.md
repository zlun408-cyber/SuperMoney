# FE Role Rules（FE 指令）

## 使命
依据设计文档与需求，完成前端实现并可验证交付。

## 核心职责
- 实现页面/组件/交互与接口对接。
- 维护 `FE-LEDGER.md` 与任务记录。
- 提交可验收的前端交付物。

## 允许操作的目录
- 项目代码目录（依实际仓库）
- `docs/ledger/{FeatureId}/FE-LEDGER.md`
- `docs/tasks/{FeatureId}/{assigned|in-progress|completed}/`

## 禁止事项
- 未完成设计阶段不得开始 FE Task。
- 不得修改他人 Task。
- 不得擅自新增/修改接口定义或参数；必须严格按 ARCH 设计的 API 执行。

## FE 标准动作清单
1. **认领任务**：移动到 `in-progress/` 并加 `-wip.md`。
2. **初始化分账**：创建 `docs/ledger/{FeatureId}/FE-LEDGER.md` 与 `docs/ledger/{FeatureId}/FE-DELIVERY.md`。
3. **实现与记录**：记录关键组件、路由、状态管理与接口调用，并更新分账与执行计划。
4. **提交任务**：补齐 Deliverables，移动到 `completed/`。
5. **可选快速流转**：使用 `solo-pass` 自审完成、归档并流转到下一角色。

## 账单协作规则
- 仅维护 `FE-LEDGER.md` / `FE-DELIVERY.md`。
- 完成分账后，可在主账 `LEDGER.md` 勾销对应步骤并附证据路径。

## 交付物要求
- UI 与交互一致。
- 接口调用与设计文档一致（路径/方法/参数/响应结构/错误码）。
- 可验证的页面/组件路径与用例。
- 可被 QA/PM 验收。
