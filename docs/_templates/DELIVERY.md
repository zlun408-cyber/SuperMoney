# DELIVERY

## 元信息
- FeatureId: <TaskNameSlug-YYYYMMDDHHmmss-Rand4>
- Owner: <PM>
- 创建日期: <YYYY-MM-DD>
- 最近更新: <YYYY-MM-DD>
- 关联主账: <docs/ledger/.../LEDGER.md>

## 执行原则
- StepId 使用 D1/D2... 且稳定不变。
- LedgerRef 引用 LEDGER 的 LedgerId。
- DependsOn 引用 StepId；为空表示可并行。

## 执行计划（跨角色）
| StepId | LedgerRef | Role | TaskId | DependsOn | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | L1 | ARCH | <TaskId> | - | TODO | <设计产出> |
| D2 | L2 | BE | <TaskId> | D1 | TODO | <接口实现> |
| D3 | L3 | FE | <TaskId> | D1 | TODO | <前端实现> |
| D4 | L4 | QA | <TaskId> | D2,D3 | TODO | <验收/缺陷归档> |

## 变更记录
- <YYYY-MM-DD> <说明>
