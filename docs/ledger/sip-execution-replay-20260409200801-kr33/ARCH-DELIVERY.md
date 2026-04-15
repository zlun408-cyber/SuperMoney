# ARCH-DELIVERY

## 元信息
- FeatureId: sip-execution-replay-20260409200801-kr33
- Role: ARCH
- 创建日期: 2026-04-09
- 最近更新: 2026-04-09

## 执行计划
| StepId | Task | DependsOn | Status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | 阅读历史设计文档与现有定投逻辑 | - | TODO | docs/design/sip-auto-nav-202604091610-a1b2/design-spec.md, lib/funds/sip-plans.ts |
| A2 | 定义 execution record 最小模型 | A1 | TODO | design-spec.md |
| A3 | 定义补单/漏单重放规则 | A2 | TODO | design-spec.md |
| A4 | 定义删除自动生成交易后的 skipped 规则 | A2 | TODO | design-spec.md |
| A5 | 定义同日多计划独立执行边界 | A2 | TODO | design-spec.md |
| A6 | 记录云端持久化边界与风险缺口 | A3,A4,A5 | TODO | design-gap.md（如有） |
| A7 | 输出完整设计文档 | A6 | TODO | docs/design/sip-execution-replay-20260409200801-kr33/design-spec.md |
| A8 | 更新 ARCH-LEDGER | A7 | TODO | docs/ledger/sip-execution-replay-20260409200801-kr33/ARCH-LEDGER.md |

## LedgerId 映射
- A1-A7 完成 → LEDGER.md L1 (Design 完成)

## 说明
- 本次仅设计最小 execution record：`pending / generated / skipped`
- 删除自动生成交易视为显式跳过，不设计自动补回
- 同日多计划按 `planId + executionDate` 独立表达执行事实
