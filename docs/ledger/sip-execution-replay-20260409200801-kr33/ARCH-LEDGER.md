# ARCH-LEDGER

## 元信息
- FeatureId: sip-execution-replay-20260409200801-kr33
- Role: ARCH
- 创建日期: 2026-04-09
- 最近更新: 2026-04-09

## 设计事实记录
| LedgerId | Fact | Evidence | Status |
| --- | --- | --- | --- |
| AL1 | 历史设计文档与现有定投逻辑已阅读 | docs/design/sip-auto-nav-202604091610-a1b2/design-spec.md, lib/funds/sip-plans.ts | DONE |
| AL2 | execution record 最小模型已定义 | design-spec.md §3 | DONE |
| AL3 | 补单/漏单重放规则已定义 | design-spec.md §5 | DONE |
| AL4 | 删除后转 skipped 的状态迁移已定义 | design-spec.md §6 | DONE |
| AL5 | 同日多计划独立执行边界已定义 | design-spec.md §7 | DONE |
| AL6 | 云端持久化边界与风险已记录 | design-spec.md §8-10, design-gap.md | DONE |
| AL7 | 完整设计文档已输出 | docs/design/sip-execution-replay-20260409200801-kr33/design-spec.md | DONE |

## 关联 LedgerId
- AL1-AL7 完成 → LEDGER.md L1 (Design 完成)

## 变更记录
- 2026-04-09 创建 ARCH 分账
- 2026-04-09 完成 AL1-AL7，输出 execution record 最小模型与三类边界设计
