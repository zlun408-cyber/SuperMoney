# ARCH-DELIVERY

## 元信息
- FeatureId: sip-auto-nav-202604091610-a1b2
- Role: ARCH
- 创建日期: 2026-04-09
- 最近更新: 2026-04-09

## 执行计划
| StepId | Task | DependsOn | Status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | 阅读历史设计文档与现有代码 | - | TODO | docs/design/stage4-ledger-readability-20260409160729-abc1/ |
| A2 | 定投去重边界场景枚举 | A1 | TODO | 设计文档章节 |
| A3 | 定投去重方案设计 | A2 | TODO | design-spec.md |
| A4 | 净值自动获取时机设计 | A1 | TODO | 设计文档章节 |
| A5 | 净值缓存策略设计 | A4 | TODO | 设计文档章节 |
| A6 | 风险与缺口记录 | A3,A5 | TODO | design-gap.md（如有） |
| A7 | 输出完整设计文档 | A3,A5,A6 | TODO | docs/design/sip-auto-nav-202604091610-a1b2/design-spec.md |
| A8 | 更新 ARCH-LEDGER | A7 | TODO | docs/ledger/sip-auto-nav-202604091610-a1b2/ARCH-LEDGER.md |

## LedgerId 映射
- A1-A7 完成 → LEDGER.md L1 (Design 完成)

## 说明
- 需重点阅读 lib/funds/sip-plans.ts 现有逻辑，理解 lastExecutedAt / nextExecutionAt 机制
- 需重点阅读 lib/funds/data-source.ts，理解净值获取 API 与缓存现状
- 净值自动获取需考虑交易日 15 点前后净值公布时机（可能当日净值尚未公布）