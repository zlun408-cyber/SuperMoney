# Design Gap: 定投 execution record 与交易重放边界

## 元信息
- FeatureId: sip-execution-replay-20260409200801-kr33
- 创建日期: 2026-04-09
- Owner: ARCH

## 缺口清单

### G1: Supabase execution table 尚不存在
- 优先级: P1
- 描述: execution record 主路径要求云端持久化，但当前仅存在 `fund_sip_plans` 与 `fund_transactions` 相关同步结构。
- 影响: 若无新表，云端无法稳定表达 `pending / generated / skipped`。
- 建议: BE 阶段新增 `fund_sip_executions` 表与迁移脚本。

### G2: 删除自动交易的统一服务边界未固化
- 优先级: P1
- 描述: 若删除入口分散，容易漏掉 execution record 的 `generated -> skipped` 回写。
- 影响: 被删除交易可能在后续重放中被错误补回。
- 建议: BE/FE 阶段统一删除入口，强制联动 execution record 更新。

### G3: skipped 的前端展示策略未定义
- 优先级: P2
- 描述: 本次 feature 不做恢复 UI，但仍需定义是否展示“已跳过”的历史痕迹。
- 影响: 用户可能无法理解为何删除后不再自动补回。
- 建议: FE 阶段至少补充删除后提示文案，必要时显示执行历史状态。

## 风险提示
- 本次模型必须保持最小，避免把 execution record 演化为审计系统。
- 若后续引入多端并发编辑，需要单独设计 execution record 冲突合并策略。

## 变更记录
- 2026-04-09 ARCH 创建缺口文档
