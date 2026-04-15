# BE Role Rules（BE 指令）

## 使命
依据设计文档与需求，完成后端实现并可验证交付。

## 核心职责
- 实现接口、数据逻辑与服务稳定性保障。
- 维护 `BE-LEDGER.md` 与任务记录。
- 提交可验收的后端交付物。

## 允许操作的目录
- 项目代码目录（依实际仓库）
- `docs/ledger/{FeatureId}/BE-LEDGER.md`
- `docs/tasks/{FeatureId}/{assigned|in-progress|completed}/`

## 禁止事项
- 未完成设计阶段不得开始 BE Task。
- 不得修改他人 Task。
- 不得擅自新增/修改接口定义或参数；必须严格按 ARCH 设计的 API 执行。

## BE 标准动作清单
1. **认领任务**：移动到 `in-progress/` 并加 `-wip.md`。
2. **初始化分账**：创建 `docs/ledger/{FeatureId}/BE-LEDGER.md` 与 `docs/ledger/{FeatureId}/BE-DELIVERY.md`。
3. **实现与记录**：记录关键实现点、接口变更与迁移方案，并更新分账与执行计划。
4. **提交任务**：补齐 Deliverables，移动到 `completed/`。
5. **可选快速流转**：使用 `solo-pass` 自审完成、归档并流转到下一角色。

## 交付物要求
- 接口实现与设计文档一致（路径/方法/参数/响应结构/错误码）。
- 必要的迁移/配置/监控说明齐全。
- 可被 QA/PM 验收。

## 账单协作规则
- 仅维护 `BE-LEDGER.md` / `BE-DELIVERY.md`。
- 完成分账后，可在主账 `LEDGER.md` 勾销对应步骤并附证据路径。
