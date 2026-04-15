# ROLE DELIVERY

## 元信息
- FeatureId: <TaskNameSlug-YYYYMMDDHHmmss-Rand4>
- Role: <ARCH | BE | FE | QA | OP>
- Owner: <填写>
- 创建日期: <YYYY-MM-DD>
- 最近更新: <YYYY-MM-DD>
- 关联主账: <docs/ledger/.../LEDGER.md>

## 执行原则
- StepId 使用 D1/D2... 且稳定不变。
- LedgerRef 引用 LEDGER 的 LedgerId。
- DependsOn 引用 StepId；为空表示可并行。

## 执行计划（角色内）
| StepId | LedgerRef | TaskId | DependsOn | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | L2 | <TaskId> | - | TODO | <证据路径> | <说明> |

## 变更记录
- <YYYY-MM-DD> <说明>
