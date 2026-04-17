# ADR-2026-04-17：estimate accuracy 样本导出与云端留存

**Status:** Proposed  
**Date:** 2026-04-17  
**Deciders:** Product / ARCH / BE / FE

## Context

当前 estimate accuracy 已完成 P0 基线能力：
- 本地 `localStorage` 样本采集、收敛、聚合与可信度分级已可用
- 基金详情页已展示 estimate confidence panel
- `/accuracy` 已提供内部准确度看板、异常基金排查、分层说明

当前真实缺口也已经在 `PROJECT_STATUS.md` / `NEXT_STEPS.md` 中明确下调为 P1：
1. 样本导出
2. 云端同步
3. 跨设备留存

现状约束：
- 未登录态仍以 `localStorage` 为主，关键数据位于 `lib/storage/estimate-accuracy-storage.ts`
- 调整决策（`verification / watch / dismissed / validated / failed`）也仍保存在浏览器本地
- 现有 Supabase 体系已稳定承载 `watchlist_funds`、`fund_transactions`、`fund_sip_plans`、`fund_sip_executions`
- accuracy 看板中的 diagnostics / source model / strategy / simulation 大多是“从原始样本即时推导”，而不是独立事实表
- 当前 snapshot 时间字段同时兼容本地中国市场时间串（`YYYY-MM-DD HH:mm`）和绝对时间串（ISO）

因此，这个 ADR 需要解决的不是“再做一个分析系统”，而是：**在尽量少改现有代码与心智模型的前提下，让 accuracy 原始样本与人工决策具备可导出、可上云、可跨设备延续的能力。**

## Decision

采用 **“原始事实入云 + 导出按需派生 + 匿名态保持本地”** 的方案。

核心决策如下：
1. 新增 **2 张基础表**：
   - `fund_estimate_accuracy_snapshots`
   - `fund_estimate_adjustment_decisions`
2. **不在第一期持久化** diagnostics / source model / simulation / recommendation 这类派生结果；这些结果继续在读取或导出时由前端/服务端根据原始样本实时计算。
3. 未登录态继续使用 `localStorage`；登录态通过新的 cloud accuracy client 读写 Supabase。
4. 导出采用两种形态：
   - **JSON**：单文件、全量保真、适合备份/迁移
   - **CSV**：按主题拆成多文件，适合分析与运营
5. 第一阶段不新增 export job / 异步任务表；导出直接由当前设备拉取数据后生成文件即可。
6. 云端数据以 **用户级 + fundCode 级** 组织，而不是强绑定 `watchlist_funds.id`；这样可以避免“基金从自选删除后 accuracy 历史也被级联删除”的副作用，也更贴合现有 local snapshot 只有 `fundCode` / `fundName` 的事实。

## Options Considered

### Option A：继续只用 localStorage，补一个前端导出按钮

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | 最低 |
| Scalability | Low |
| Team familiarity | High |

**Pros:**
- 改动最小，几乎不碰现有同步体系
- 能最快满足“可导出”
- 不涉及 Supabase migration

**Cons:**
- 不能解决跨设备留存
- 登录态和未登录态行为继续割裂
- 导出只能依赖当前浏览器，历史容易丢
- 后续若再补云端，导出 schema 还要重做一次

### Option B：新增 accuracy 原始事实表 + 决策表，派生结果继续即时计算（推荐）

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | 可控 |
| Scalability | Medium |
| Team familiarity | Medium-High |

**Pros:**
- 直接复用现有 Supabase + RLS 模式
- 与当前 local snapshot / decision 模型高度贴合，迁移成本低
- 导出、云端同步、跨设备留存一次性打通
- 不把派生指标固化进表，避免 schema 很快过时

**Cons:**
- 需要新增一条独立的 accuracy 同步链路
- 时间字段需要做本地时间串到 UTC 的规范化转换
- `/accuracy` 和 detail panel 的读取入口需要抽象成统一 store

### Option C：把 accuracy 数据塞进 `watchlist_funds` 扩展字段或单个 user JSON blob

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low-Medium |
| Cost | 低 |
| Scalability | Low |
| Team familiarity | Medium |

**Pros:**
- migration 数量少
- 初期接线看起来更快
- 与现有 watchlist/cloud 保存路径容易拼接

**Cons:**
- 大 JSON blob 不利于按 fund/filter/query/export
- 冲突合并粒度过粗，容易互相覆盖
- 难以做 CSV 多文件导出
- 后续如果要做运营/分析查询，几乎一定要拆回关系表

## Trade-off Analysis

推荐 **Option B**，原因是它同时满足四个目标：
- 对现有代码最友好：沿用 snapshot / decision 当前形状
- 对后续导出最友好：原始事实可直接映射 JSON/CSV
- 对跨设备最友好：登录态有独立云端真源
- 对后续演进最友好：保留派生逻辑在应用层，不过早冻结分析 schema

换句话说，**先把“事实层”做对，再把“分析层”继续保持可重算**，是这个阶段最稳妥的选择。

## Recommended Table Structure

### 1) `public.fund_estimate_accuracy_snapshots`

用途：持久化 accuracy 原始样本；它是导出、跨设备留存、后续重算 diagnostics 的唯一事实来源。

| Column | Type | Nullable | 说明 |
|--------|------|----------|------|
| `id` | `uuid` | No | 云端主键，默认 `gen_random_uuid()` |
| `user_id` | `uuid` | No | 关联 `auth.users(id)` |
| `snapshot_key` | `text` | No | 对齐本地 `EstimateAccuracySnapshot.id` |
| `fund_code` | `text` | No | 基金代码 |
| `fund_name` | `text` | No | 采样时基金名称快照 |
| `quote_updated_at` | `timestamptz` | No | 规范化后的估值时间 |
| `quote_updated_at_raw` | `text` | No | 原始时间串，保留原始语义 |
| `quote_time_semantics` | `text` | No | `china_local` / `absolute` |
| `trading_date` | `date` | No | 从估值时间派生的交易日 |
| `estimated_nav` | `numeric(18,6)` | No | 当时估值净值 |
| `final_nav` | `numeric(18,6)` | Yes | 收敛后的最终净值 |
| `absolute_error_rate` | `numeric(12,8)` | Yes | 绝对误差率 |
| `resolved_at` | `timestamptz` | Yes | 收敛时间 |
| `client_created_at` | `timestamptz` | No | 本地首次写入时间（规范化后） |
| `client_updated_at` | `timestamptz` | No | 本地最后更新时间（规范化后） |
| `created_at` | `timestamptz` | No | 云端入库时间，默认 `now()` |
| `updated_at` | `timestamptz` | No | 云端最后修改时间，默认 `now()` |

**约束与索引建议：**
- `unique (user_id, snapshot_key)`
- `check (quote_time_semantics in ('china_local', 'absolute'))`
- `check (absolute_error_rate is null or absolute_error_rate >= 0)`
- 索引：
  - `(user_id, fund_code, trading_date desc)`
  - `(user_id, quote_updated_at desc)`
  - `(user_id, resolved_at desc)` where `resolved_at is not null`

**为什么不用 `watchlist_funds.id` 作为强外键：**
- 当前 local snapshot 根本没有 `fundId`
- accuracy 历史的自然主键是 `fundCode + quoteUpdatedAt`
- 如果绑定 `watchlist_funds` 并级联删除，会让“取消自选”误伤 accuracy 历史

### 2) `public.fund_estimate_adjustment_decisions`

用途：持久化当前人工决策状态与决策历史；这是 `/accuracy` 运营动作的事实层。

| Column | Type | Nullable | 说明 |
|--------|------|----------|------|
| `id` | `uuid` | No | 云端主键，默认 `gen_random_uuid()` |
| `user_id` | `uuid` | No | 关联 `auth.users(id)` |
| `fund_code` | `text` | No | 基金代码 |
| `fund_name` | `text` | Yes | 最近一次写入时的基金名称 |
| `status` | `text` | No | `verification / watch / dismissed / validated / failed` |
| `decision_updated_at` | `timestamptz` | No | 当前决策状态最后更新时间 |
| `history` | `jsonb` | No | 历史状态数组，保持与当前本地结构一致 |
| `created_at` | `timestamptz` | No | 默认 `now()` |
| `updated_at` | `timestamptz` | No | 默认 `now()`，仅用于表行更新时间 |

**约束与索引建议：**
- `unique (user_id, fund_code)`
- `check (status in ('verification', 'watch', 'dismissed', 'validated', 'failed'))`
- `check (jsonb_typeof(history) = 'array')`
- 索引：
  - `(user_id, status)`
  - `(user_id, decision_updated_at desc)`

**为什么 history 先放在 jsonb，而不是单独拆表：**
- 当前本地模型就是 `history[]`
- 第一阶段的主要目标是导出 / 上云 / 跨设备，而不是复杂审计查询
- 若未来需要按历史状态做大量查询，再拆 `decision_history` 表更稳

### 3) 延后项：不在 v1 建 summary / diagnostics 表

以下内容继续按需重算，不在 v1 持久化：
- `EstimateAccuracySummary`
- diagnostics / abnormal investigation
- source model / strategy
- adjustment simulation
- validation summary

**理由：**
- 这些都是从 snapshot 派生的“分析层”
- 一旦固化进表，阈值或算法调整后需要整批回算
- 当前用户规模与数据量还不值得引入 materialized view / batch recompute 复杂度

## JSON Export Schema Design

推荐导出格式：**单个 JSON 文件**，适合完整备份、迁移与调试。

### 顶层结构

```json
{
  "schemaVersion": "accuracy-export/v1",
  "exportedAt": "2026-04-17T12:00:00.000Z",
  "source": {
    "app": "SuperFinance",
    "mode": "local|cloud",
    "userId": "optional"
  },
  "filters": {
    "fundCodes": ["000001"],
    "includeDerived": true
  },
  "snapshots": [],
  "fundSummaries": [],
  "diagnostics": [],
  "adjustmentDecisions": []
}
```

### `snapshots[]` 字段

| Field | 说明 |
|-------|------|
| `snapshotKey` | 本地样本唯一键 |
| `fundCode` | 基金代码 |
| `fundName` | 基金名称 |
| `quoteUpdatedAt` | 原始时间串 |
| `quoteUpdatedAtUtc` | 规范化后的 UTC 时间 |
| `quoteTimeSemantics` | `china_local` / `absolute` |
| `tradingDate` | 交易日 |
| `estimatedNav` | 估值净值 |
| `finalNav` | 最终净值，可空 |
| `absoluteErrorRate` | 绝对误差率，可空 |
| `resolvedAt` | 收敛时间，可空 |
| `createdAt` | 原始 createdAt |
| `updatedAt` | 原始 updatedAt |
| `resolved` | 是否已收敛 |

### `fundSummaries[]` 字段（派生）

| Field | 说明 |
|-------|------|
| `fundCode` | 基金代码 |
| `fundName` | 基金名称 |
| `sampleCount` | 总样本数 |
| `resolvedSampleCount` | 已收敛样本数 |
| `resolvedTradingDayCount` | 已覆盖交易日数 |
| `highErrorResolvedSampleCount` | 高误差已收敛样本数 |
| `averageAbsoluteErrorRate` | 平均绝对误差率 |
| `latestQuoteUpdatedAt` | 最近估值时间 |
| `latestResolvedAt` | 最近收敛时间 |
| `confidenceLevel` | `high / medium / low / unknown` |

### `diagnostics[]` 字段（派生）

| Field | 说明 |
|-------|------|
| `fundCode` | 基金代码 |
| `fundName` | 基金名称 |
| `sampleCount` | 总样本数 |
| `computableSampleCount` | 可计算样本数 |
| `averageAbsoluteErrorRate` | 平均绝对误差率 |
| `averageSignedErrorRate` | 平均有符号误差率 |
| `overestimatedCount` | 偏高次数 |
| `underestimatedCount` | 偏低次数 |
| `diagnosis` | `持续偏高 / 持续偏低 / 波动偏差 / 样本不足` |
| `priorityScore` | 排查优先级 |
| `worstTradingDate` | 最差交易日 |
| `worstAbsoluteErrorRate` | 最差绝对误差率 |

### `adjustmentDecisions[]` 字段

| Field | 说明 |
|-------|------|
| `fundCode` | 基金代码 |
| `fundName` | 基金名称 |
| `status` | 当前状态 |
| `updatedAt` | 当前状态更新时间 |
| `history` | 历史状态数组 |

**导出原则：**
- JSON 保留“原始 + 派生”两层信息
- `includeDerived = false` 时，只导出 `snapshots` 与 `adjustmentDecisions`
- `source model / simulation / strategy` 先不进入 v1 export schema，避免把实验性分析结构固化

## CSV Export Schema Design

CSV 不适合嵌套结构，因此推荐导出为 **一个 zip 包 + 多个 CSV 文件**。

### 1) `accuracy_snapshots.csv`

| Column |
|--------|
| `snapshot_key` |
| `fund_code` |
| `fund_name` |
| `quote_updated_at_raw` |
| `quote_updated_at_utc` |
| `quote_time_semantics` |
| `trading_date` |
| `estimated_nav` |
| `final_nav` |
| `absolute_error_rate` |
| `resolved_at` |
| `created_at` |
| `updated_at` |
| `resolved` |

### 2) `accuracy_fund_summaries.csv`

| Column |
|--------|
| `fund_code` |
| `fund_name` |
| `sample_count` |
| `resolved_sample_count` |
| `resolved_trading_day_count` |
| `high_error_resolved_sample_count` |
| `average_absolute_error_rate` |
| `latest_quote_updated_at` |
| `latest_resolved_at` |
| `confidence_level` |

### 3) `accuracy_diagnostics.csv`

| Column |
|--------|
| `fund_code` |
| `fund_name` |
| `sample_count` |
| `computable_sample_count` |
| `average_absolute_error_rate` |
| `average_signed_error_rate` |
| `overestimated_count` |
| `underestimated_count` |
| `diagnosis` |
| `priority_score` |
| `worst_trading_date` |
| `worst_absolute_error_rate` |

### 4) `accuracy_adjustment_decisions.csv`

| Column |
|--------|
| `fund_code` |
| `fund_name` |
| `status` |
| `updated_at` |
| `history_count` |

### 5) `accuracy_adjustment_decision_history.csv`

| Column |
|--------|
| `fund_code` |
| `status` |
| `updated_at` |
| `sequence` |

**CSV 设计原则：**
- 单文件 CSV 只承载扁平数据
- 嵌套 history 强制拆到独立 CSV
- fund summary / diagnostics 作为“面向分析”的便捷产物导出，不要求在数据库里单独存表

## Minimal Retrofit Plan

### A. 数据访问层最小改造

1. 新增 `lib/sync/cloud-accuracy.ts`
   - 提供 `listSnapshots / upsertSnapshots`
   - 提供 `listAdjustmentDecisions / replaceAdjustmentDecisions` 或 `upsertAdjustmentDecisions`
2. 新增 `lib/storage/estimate-adjustment-storage.ts`
   - 把当前 decision 的 localStorage 读写从 `estimate-adjustment-policy.ts` 中抽出
   - 让 policy 文件只保留“规则计算”，不直接负责存储
3. 保留 `lib/storage/estimate-accuracy-storage.ts`
   - 未登录继续使用
   - 增加序列化/反序列化帮助函数，统一做时间规范化

### B. 统一 store 入口

新增一个轻量 adapter（例如 `lib/accuracy/accuracy-store.ts`）：
- `loadSnapshots()`
- `saveSnapshots()` / `upsertSnapshots()`
- `loadDecisions()`
- `saveDecision()`
- `exportAccuracyBundle()`

这样可以让：
- `lib/hooks/use-fund-quotes.ts`
- `components/fund/fund-detail-content.tsx`
- `components/accuracy/accuracy-dashboard.tsx`

都不再直接耦合 `localStorage`。

### C. 登录态同步最小策略

推荐同步语义：
- **snapshot**：按 `snapshotKey` merge，沿用现有 `mergeEstimateSnapshots` 规则
  - 已收敛覆盖未收敛
  - 同状态取 `updatedAt` 更新者
- **decision**：按 `fundCode` merge
  - 当前状态取 `updatedAt` 更新者
  - `history` 通过 `(status, updatedAt)` 去重合并

这样可以避免额外引入一套 accuracy 专属冲突弹窗。

### D. 导出最小落地

1. `/accuracy` 页面先加按钮：
   - 导出 JSON
   - 导出 CSV（zip）
2. 默认导出当前用户全量 accuracy 数据
3. 二期再考虑：按基金筛选、按日期范围筛选、仅导出异常基金

### E. Supabase 改造边界

- 新增独立 migration 文件，**不要继续把 accuracy SQL 混进 `stage3-auth-sync.sql`**
- 推荐文件名：`supabase/accuracy-sync.sql`
- 保持与现有四张业务表解耦，降低上线风险

## Phased Task Breakdown

### Phase 1：Schema 与存储抽象（最小闭环）

**目标：** 先把“可上云的事实层”建起来，但不改 `/accuracy` 的分析逻辑。

任务：
1. 新增 `fund_estimate_accuracy_snapshots` SQL
2. 新增 `fund_estimate_adjustment_decisions` SQL
3. 抽出 `estimate-adjustment-storage.ts`
4. 增加 snapshot / decision 的 cloud DTO 与 mapper
5. 为时间规范化、merge 规则补单测

**完成标准：**
- 本地与云端都能读写 snapshot / decision
- 不影响当前 dashboard 统计逻辑

### Phase 2：登录态云端留存与跨设备读写

**目标：** 登录后 accuracy 数据以云端为准，并支持跨设备延续。

任务：
1. 新增 `cloud-accuracy.ts`
2. 在 auth 初始化路径接入 accuracy load/save
3. `use-fund-quotes.ts` 改为写统一 accuracy store
4. `/accuracy` 和 detail panel 改为从统一 store 读取
5. 增加“本地有数据、云端为空/非空”的 merge 测试

**完成标准：**
- A 设备采样后，B 设备登录可看到相同 accuracy 数据
- 已有本地样本不会因登录态切换被覆盖丢失

### Phase 3：导出能力

**目标：** 把“运营可拿走、用户可备份”的能力补齐。

任务：
1. 新增 JSON export builder
2. 新增 CSV export builder
3. CSV zip 打包
4. `/accuracy` 导出入口 UI
5. 单测校验导出列顺序、空值语义、history 展平规则

**完成标准：**
- 可从 `/accuracy` 一键导出 JSON
- 可导出多文件 CSV zip
- 导出内容与 dashboard 指标一致

### Phase 4：可选增强（不纳入最小改造）

任务候选：
- 按基金 / 时间窗口导出
- 只导出异常基金
- 服务端生成临时下载链接
- materialized view / summary cache
- decision history 独立拆表

## Consequences

### Positive
- accuracy 原始样本第一次具备真正的“可恢复性”与“可迁移性”
- 登录态与未登录态的数据心智更统一
- 导出 schema 与云端 schema 基本同构，后续维护成本低
- diagnostics 等派生逻辑仍然可灵活迭代，不会被表结构绑死

### Negative
- 需要新增一条 accuracy 专属同步链路
- 时间规范化处理会比 watchlist/transactions 更复杂
- `/accuracy` 与 detail panel 需要做一层 store 解耦

### Revisit Triggers
- 单用户 snapshot 规模显著增长，导致 `/accuracy` 首屏计算变慢
- 需要按决策历史做复杂查询/审计
- 需要服务端报表或团队级汇总

出现以上情况时，再评估：
- materialized view
- background export job
- `decision_history` 子表
- 服务端聚合 API

## Action Items

1. [ ] 新建 `supabase/accuracy-sync.sql`
2. [ ] 新增 `lib/sync/cloud-accuracy.ts`
3. [ ] 抽出 `lib/storage/estimate-adjustment-storage.ts`
4. [ ] 增加统一 `accuracy-store` adapter
5. [ ] 接通登录态 accuracy 云端留存
6. [ ] 落地 `/accuracy` JSON / CSV 导出按钮
7. [ ] 补齐 unit + E2E 覆盖
