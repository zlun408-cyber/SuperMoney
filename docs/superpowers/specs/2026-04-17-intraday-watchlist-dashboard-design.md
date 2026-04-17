# 2026-04-17 Intraday Watchlist Dashboard Design

**Status:** Approved in chat  
**Date:** 2026-04-17  
**Scope:** 原始 P1：分钟走势图 dashboard（首页内嵌概览 + 详情页完整图）

## 1. Context

项目最初的核心需求有三条：
1. 基金实时估值要尽量精准
2. 要有清晰的 dashboard 呈现，尤其是持仓基金的分钟级估值走势图
3. 提供对话助手，结合市场情况和持仓给出操作建议

其中第 1 条已经形成一条独立 accuracy 主线，并已完成 baseline、详情页可信度面板、`/accuracy` 看板、异常基金排查、云端/导出等能力闭环。当前最大的产品缺口不再是继续扩展 accuracy 内部运营能力，而是：**用户仍无法在主界面里快速看清持仓基金的日内走势。**

因此，当前阶段应从 accuracy 子线切回原始业务 P1，补齐“首页可扫、详情可看”的分钟走势图体验。

## 2. Goal

在不新增独立走势图页面的前提下，把日内走势直接嵌入现有主流程：
- 首页 watchlist：每只基金在名称附近看到趋势提示，并在表格内看到迷你分钟走势图
- 详情页：在现有详情内容中看到今日分钟走势图的展开版
- 数据语义：优先落地“本产品采集到的当日分钟估值曲线”，而不是第一期就强接完整分钟历史接口

## 3. Non-goals

本期明确不做：
- 独立 dashboard 新页面
- 多日切换（5 日 / 30 日 / 自定义区间）
- 持仓组合总走势
- 技术指标（均线、成交量、MACD 等）
- 分钟图云端同步
- AI 助手与走势图联动分析
- 新接外部完整分时历史接口

## 4. Product Decision

采用 **“当日 intraday 本地采样 + 首页迷你图 + 详情页展开图”** 的方案。

### Why this approach

相比“只做会话内临时曲线”，本方案在刷新页面后仍可恢复当天已采样走势，更接近用户对“今日分时图”的直觉；相比“先接完整分钟历史接口”，本方案无需引入新的高风险外部依赖，可以更快把核心体验交付出来。

## 5. User Experience

### 5.1 首页 watchlist

在现有 `WatchlistTable` 中新增两类走势信息：

1. **基金名附近的趋势提示**
   - 趋势标签：`上行 / 回落 / 横盘 / 波动`
   - 今日摘要：例如 `今日 +0.82%`

2. **单独一列分钟走势图**
   - 每只基金展示一张迷你 sparkline
   - 范围固定为“今日开盘至今”
   - 不依赖跳转详情页才能看到

这样用户扫列表时，可以同时获取：
- 基金身份
- 当日趋势方向
- 小图形态
- 当前估值 / 持仓 / 估算盈亏

### 5.2 详情页

在现有基金详情页中新增“今日走势”卡片，放在估值核心信息附近，而不是新开页面。

卡片包含：
- 今日分钟走势图大图
- 当前估值
- 今日最高 / 最低
- 开盘至今涨跌
- 最近更新时间

空状态下应提示：
> 今日分钟走势尚未积累，保持页面打开并等待盘中刷新后会逐步生成。

## 6. Data Semantics

第一期分钟走势图的数据语义不是“交易所级完整分时历史”，而是：

> **本产品在当日运行过程中采集到的分钟估值点，并在页面刷新后尽量恢复。**

这意味着：
- 若用户当天一早就打开产品，可逐步形成较完整的当日曲线
- 若用户较晚打开产品，前半段曲线可能缺失
- 这仍然优于“只有当前一个数值，没有任何走势感知”

## 7. Data Model

建议新增类型：

```ts
interface EstimateIntradayPoint {
  fundCode: string;
  fundName: string;
  tradingDate: string;   // YYYY-MM-DD
  minuteKey: string;     // YYYY-MM-DD HH:mm
  estimatedNav: number;
  changeRate: number;
  updatedAt: string;
  capturedAt: string;    // ISO
}
```

### Field semantics

- `fundCode`：基金代码
- `fundName`：基金名称
- `tradingDate`：交易日，作为当日过滤依据
- `minuteKey`：分钟粒度唯一键；同一基金同一分钟只保留一个点
- `estimatedNav`：该分钟估值净值
- `changeRate`：该分钟涨跌幅
- `updatedAt`：行情源返回的更新时间
- `capturedAt`：前端实际采集时间

## 8. Storage Design

新增本地存储，例如：

```ts
super-finance-estimate-intraday
```

建议结构：

```ts
Record<string, EstimateIntradayPoint[]>
```

即按 `fundCode` 分组存储分钟点。

### Retention rule

第一期仅保留：
- 当前交易日的数据
- 每只基金最多约一个交易日的分钟点（量级约 300）

### Write rule

在 `useFundQuotes` 每次成功拿到 quote 后：
1. 转换为 `EstimateIntradayPoint`
2. 依据 `fundCode + tradingDate + minuteKey` 去重
3. 同一分钟重复刷新时覆盖为最新值
4. 清掉非当前交易日的数据
5. 落入 localStorage

### Read rule

- 首页：按基金读取今日点位，生成趋势 badge 与迷你图
- 详情页：读取当前基金的今日全部点位，生成大图与统计摘要

## 9. Architecture

### 9.1 New domain layer

建议新增一个轻量 intraday 领域层，分成三部分：

1. **类型定义**
   - 放在 `lib/funds/types.ts`
   - 定义 `EstimateIntradayPoint`

2. **存储层**
   - 新增 `lib/storage/estimate-intraday-storage.ts`
   - 负责 load / save / upsert / same-minute dedupe / current-trading-date pruning

3. **派生 helper**
   - 新增 `lib/funds/estimate-intraday.ts`
   - 负责：
     - 今日点位过滤
     - 趋势分类（上行 / 回落 / 横盘 / 波动）
     - 统计摘要（最高 / 最低 / 最新 / 当日涨跌）
     - sparkline / chart 所需的归一化点位

### 9.2 Existing hook integration

复用当前 `useFundQuotes` 作为采样入口：
- 继续负责分钟级拉取实时估值
- 在 quote 成功加载后，顺手把 quote 写进 intraday store
- 保持 intraday 采样为附属能力，不能影响主 quote 加载路径

### 9.3 UI component split

建议新增组件：

#### `components/watchlist/fund-trend-badge.tsx`
- 展示趋势标签与“今日 +/-x.xx%”摘要

#### `components/watchlist/fund-intraday-sparkline.tsx`
- 首页表格中的迷你走势图
- 极简 SVG 实现，不引入重型图表库

#### `components/fund/fund-intraday-chart.tsx`
- 详情页完整走势图
- 复用同一份 intraday points，只是在视觉和统计上更完整

## 10. Trend Classification

第一期趋势标签只做产品层面的轻量分类，不做技术分析：
- 最后一点明显高于第一点：`上行`
- 最后一点明显低于第一点：`回落`
- 振幅很小：`横盘`
- 中间波动较大但方向不明显：`波动`

这套规则只用于快速扫盘，不作为投资建议。

## 11. Error Handling and Edge Cases

### No points
- 首页：显示 `暂无走势`
- 详情页：显示空状态提示

### Single point only
- 不强行画趋势曲线
- 显示单点或短横线
- badge 可退化为 `数据积累中`

### Refresh failure
- 保留已采样曲线
- 不因一次刷新失败而清空 intraday 数据

### Cross-trading-day
- 默认只展示当前交易日
- 切日时自动丢弃旧日点位

### Malformed point
- 忽略非法点
- 不影响主页面渲染

## 12. Testing Strategy

坚持 TDD，分四阶段推进。

### Phase 1：intraday 数据层
目标：先把“当日分钟点可采集、可恢复”做出来。

测试重点：
- storage 的 load / save
- 按 `minuteKey` 去重覆盖
- 非当前交易日裁剪
- helper 的趋势判定、最高/最低、摘要生成
- `useFundQuotes` 成功拉取后写入 intraday store

### Phase 2：首页列表内嵌走势
目标：用户不进详情页，也能直接扫到每只基金的走势。

测试重点：
- trend badge 文案与样式
- sparkline 有点位 / 无点位 / 单点场景
- `WatchlistTable` 新增走势图列
- 基金名附近显示趋势提示与今日摘要

### Phase 3：详情页完整图
目标：首页看概览，详情页看展开版。

测试重点：
- 详情图组件的空状态 / 单点 / 多点场景
- 当前值、最高、最低、今日涨跌、最近更新时间
- 接入 detail page 后正确渲染

### Phase 4：E2E
目标：验证真实主流程里用户确实能看到走势。

测试重点：
- 首页每只基金行显示趋势提示和分钟图
- 详情页显示今日走势卡片
- 页面刷新后当天已采样点仍存在

## 13. Rollout Recommendation

建议按以下顺序落地：
1. intraday 数据层
2. 首页内嵌走势
3. 详情页完整图
4. E2E 验证

只要完成 1-3，就已经形成一个完整可感知的 P1 MVP。

## 14. Future Extensions

后续若效果确认成立，再考虑：
- 分钟图云端同步
- 多日走势
- 组合总走势
- 完整外部分钟历史接口
- 与对话助手联动的走势解读能力

## 15. Decision Summary

本期采用：
- **首页内嵌 + 详情展开**，不新增独立走势图页面
- **今日开盘至今** 作为默认时间范围
- **本地 intraday 采样恢复** 作为第一版数据语义
- **轻量 SVG 组件** 作为图形呈现方式

这条方案在交付速度、实现风险与用户感知价值之间最平衡，适合作为当前阶段的原始 P1 主线。
