# 基金详情页交易记录与定投计划重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the fund detail transaction area so that manual trades and SIP plans are modeled separately, trades support `15 点前 / 15 点后` business timing, buys are amount-driven, sells are share-driven, fees stay optional, and SIP plans can auto-generate editable buy records.

**Architecture:** Split the existing single transaction area into two layers: a trade ledger layer for actual posted records and a SIP plan layer for recurring strategy definitions. Introduce explicit fields for placed period and effective date, shift `nav` from a user-entered field to a system-confirmed field, and preserve FIFO profit calculation by feeding it normalized record data.

**Tech Stack:** Next.js, React, TypeScript, localStorage, Supabase sync path, Vitest, Testing Library

---

## Planned file changes

### Create
- `components/fund/sip-plan-list.tsx` — 定投计划列表与计划摘要
- `components/fund/add-sip-plan-dialog.tsx` — 新建/编辑定投计划弹层
- `lib/funds/sip-plans.ts` — 定投计划调度、下次执行时间、自动生成记录逻辑
- `tests/components/fund/add-sip-plan-dialog.test.tsx`
- `tests/lib/funds/sip-plans.test.ts`

### Modify
- `lib/funds/types.ts` — 重构交易记录类型，新增 placed/effective 字段与定投计划模型
- `lib/funds/transactions.ts` — 适配新交易结构并继续支撑 FIFO 计算
- `lib/storage/watchlist-storage.ts` — 存储定投计划与新交易结构
- `lib/sync/cloud-watchlist.ts` — 云端映射新字段并同步定投计划
- `lib/hooks/use-watchlist.ts` — 加入定投计划 CRUD 与自动生成记录调度入口
- `components/fund/add-transaction-dialog.tsx` — 改为买入金额/卖出份额/15 点前后/手续费选填模型
- `components/fund/transaction-list.tsx` — 展示下单时段、生效日、系统推导字段、记录来源
- `components/fund/fund-detail-content.tsx` — 插入定投计划区，组合交易记录与计划
- `tests/app/fund-detail-page.test.tsx`
- `tests/lib/hooks/use-watchlist.test.tsx`
- `PROJECT_STATUS.md`
- `WORKLOG.md`
- `NEXT_STEPS.md`
- `SESSION_RESUME.md`

### Reuse
- `components/fund/fund-detail-card.tsx`
- 现有认证与云同步入口

## Task 1: 重构交易与定投计划数据模型

**Files:**
- Modify: `lib/funds/types.ts`
- Modify: `lib/storage/watchlist-storage.ts`
- Test: `tests/lib/hooks/use-watchlist.test.tsx`

- [ ] **Step 1: 为新交易字段与定投计划模型写失败测试或类型驱动断言**
- [ ] **Step 2: 运行相关测试并确认当前模型无法满足新结构**
- [ ] **Step 3: 最小化修改交易类型、存储结构和默认迁移逻辑**
- [ ] **Step 4: 重新运行测试并确认通过**

## Task 2: 调整交易计算层以适配新口径

**Files:**
- Modify: `lib/funds/transactions.ts`
- Test: `tests/lib/funds/transactions.test.ts`

- [ ] **Step 1: 为买入金额驱动、卖出份额驱动、手续费选填写失败测试**
- [ ] **Step 2: 运行 `npx vitest run tests/lib/funds/transactions.test.ts` 并确认失败**
- [ ] **Step 3: 最小化调整计算层，保留 FIFO 主线**
- [ ] **Step 4: 重新运行同一测试并确认通过**

## Task 3: 重构交易录入表单

**Files:**
- Modify: `components/fund/add-transaction-dialog.tsx`
- Test: `tests/components/fund/add-transaction-dialog.test.tsx`

- [ ] **Step 1: 为买入金额输入、卖出份额输入、15 点前后选择、手续费选填写失败测试**
- [ ] **Step 2: 运行聚焦测试并确认失败**
- [ ] **Step 3: 最小化实现新交易表单**
- [ ] **Step 4: 重新运行聚焦测试并确认通过**

## Task 4: 重构交易记录展示

**Files:**
- Modify: `components/fund/transaction-list.tsx`
- Modify: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: 为下单时段、生效日、系统推导字段、来源标记写失败测试**
- [ ] **Step 2: 运行 `npx vitest run tests/app/fund-detail-page.test.tsx` 并确认失败**
- [ ] **Step 3: 最小化实现新的交易记录展示**
- [ ] **Step 4: 重新运行同一测试并确认通过**

## Task 5: 新增定投计划模型与 UI

**Files:**
- Create: `lib/funds/sip-plans.ts`
- Create: `components/fund/sip-plan-list.tsx`
- Create: `components/fund/add-sip-plan-dialog.tsx`
- Test: `tests/lib/funds/sip-plans.test.ts`
- Test: `tests/components/fund/add-sip-plan-dialog.test.tsx`

- [ ] **Step 1: 为计划创建、开始/结束日期、执行时间、状态切换写失败测试**
- [ ] **Step 2: 运行对应测试并确认失败**
- [ ] **Step 3: 最小化实现定投计划数据层与 UI**
- [ ] **Step 4: 重新运行测试并确认通过**

## Task 6: 接入定投计划自动生成交易记录

**Files:**
- Modify: `lib/hooks/use-watchlist.ts`
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/hooks/use-watchlist.test.tsx`

- [ ] **Step 1: 为自动生成买入记录、避免重复生成、允许后续修改写失败测试**
- [ ] **Step 2: 运行聚焦测试并确认失败**
- [ ] **Step 3: 最小化实现定投计划到交易记录的自动生成逻辑**
- [ ] **Step 4: 重新运行同一测试并确认通过**

## Task 7: 云端同步与旧数据迁移

**Files:**
- Modify: `lib/sync/cloud-watchlist.ts`
- Modify: `lib/storage/watchlist-storage.ts`
- Test: `tests/lib/sync/cloud-watchlist.test.ts`

- [ ] **Step 1: 为新交易字段、定投计划、旧数据默认迁移写失败测试**
- [ ] **Step 2: 运行 `npx vitest run tests/lib/sync/cloud-watchlist.test.ts` 并确认失败**
- [ ] **Step 3: 最小化实现同步映射与迁移兼容**
- [ ] **Step 4: 重新运行同一测试并确认通过**

## Task 8: 页面整合与回归验证

**Files:**
- Modify: `components/fund/fund-detail-content.tsx`
- Modify: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: 为交易记录区与定投计划区并存写失败测试**
- [ ] **Step 2: 运行详情页聚焦回归并确认失败**
- [ ] **Step 3: 最小化整合页面结构**
- [ ] **Step 4: 重新运行聚焦回归并确认通过**

## Task 9: 最终验证与文档同步

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: 运行 `npm run test`**
- [ ] **Step 2: 运行 `npm run test:e2e`**
- [ ] **Step 3: 运行 `npm run build`**
- [ ] **Step 4: 更新进度文件**
- [ ] **Step 5: 提交这一轮交易记录与定投计划重设计基线**
