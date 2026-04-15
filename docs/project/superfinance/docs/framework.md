# SuperFinance 技术框架沉淀

## 元信息
- Project: superfinance
- 更新日期: 2026-04-09

## 架构模式
- **前端架构**: Next.js App Router（服务端渲染优先）
- **状态管理**: React Context + Custom Hooks
- **数据流**: 
  - 未登录：localStorage -> Hooks -> UI
  - 已登录：Supabase -> Hooks -> UI

## 设计文档索引
见 `docs/superpowers/`:
- `specs/2026-03-25-fund-monitoring-design.md`: 第一阶段设计
- `plans/2026-03-25-fund-monitoring-mvp.md`: 第一阶段实现计划
- `specs/2026-03-26-trade-ledger-design.md`: 第二阶段设计
- `plans/2026-03-26-trade-ledger-phase2.md`: 第二阶段实现计划
- `specs/2026-03-27-transaction-record-edit-delete-design.md`: 交易记录编辑删除设计
- `plans/2026-03-27-transaction-record-edit-delete.md`: 交易记录编辑删除实现
- `specs/2026-03-27-transaction-validation-feedback-design.md`: 交易记录错误提示设计
- `plans/2026-03-27-transaction-validation-feedback.md`: 交易记录错误提示实现
- `specs/2026-03-27-stage3-auth-sync-design.md`: 第三阶段登录与云同步设计
- `plans/2026-03-27-stage3-auth-sync.md`: 第三阶段登录与云同步实现
- `specs/2026-03-27-stage3-supabase-setup.md`: 第三阶段 Supabase 落地说明
- `specs/2026-03-27-stage4-ledger-readability-design.md`: 第四阶段设计
- `plans/2026-03-27-stage4-ledger-readability.md`: 第四阶段实现计划

## Supabase 表结构
### watchlist_funds
- 用户自选基金列表

### fund_transactions
- 交易记录表
- 支持 placed/effective 双日期
- 支持 source 字段（manual / sip_plan）

### fund_sip_plans
- 定投计划表
- 状态字段（active / paused / ended）

### fund_sip_executions
- 定投执行记录表
- 状态字段（pending / generated / skipped）
- 支持删除自动生成交易后的 skipped 语义

## 业务规则
### 交易记录规则
- 四类交易：buy, sell, cash_dividend, reinvest_dividend
- 买入/卖出支持 placed/effective 双日期
- 15 点前后交易决定当日或次日确认
- FIFO 成本计算逻辑

### 定投规则
- 定投自动生成交易记录（source = sip_plan）
- execution record 为执行事实层（pending / generated / skipped）
- 结束日期超过自动标记 ended
- paused 状态不自动生成
- 去重边界待补齐

### 认证与同步规则
- 登录态云端优先，未登录本地优先
- 首次登录冲突需用户选择（不自动合并）
- 登录后禁用手工持仓编辑

## 待优化项
1. skipped execution 的恢复入口（如未来需要）
2. 交易表单去手填净值（自动获取净值）
3. 定投计划更多边界场景

## 落地与验收
- Supabase SQL 执行与验收说明：`docs/project/superfinance/docs/supabase-rollout-checklist.md`
