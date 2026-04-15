# LEDGER

## 元信息
- FeatureId: <TaskNameSlug-YYYYMMDDHHmmss-Rand4>
- ShortName: <填写>
- Owner: <PM>
- 创建日期: <YYYY-MM-DD>
- 最近更新: <YYYY-MM-DD>
- 当前阶段: Draft | Design | Dev | QA | Done

## 阶段检查点
- [ ] Design 完成（证据: <docs/design/...>）
- [ ] Dev 完成（证据: <代码变更/Deliverables>）
- [ ] QA 完成（证据: <docs/bugs/.../ 或测试报告>）
- [ ] Done 归档（证据: <归档路径>）

## Ledger Items
> 规则：每条记录一个稳定 LedgerId（如 L1/L2），供 DELIVERY/Task 引用；只更新状态与证据，不改 ID。
| LedgerId | Stage | Item | Owner | DependsOn | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Design | <设计产出> | ARCH | - | TODO | <docs/design/...> |
| L2 | Dev | <接口实现> | BE | L1 | TODO | <代码/文档路径> |
| L3 | Dev | <前端实现> | FE | L1 | TODO | <代码/文档路径> |
| L4 | QA | <验收与缺陷归档> | QA | L2,L3 | TODO | <docs/bugs/...> |

## 变更记录
- <YYYY-MM-DD> <说明>
