# Design Spec: 定投去重边界与净值自动获取

## 元信息
- FeatureId: sip-auto-nav-202604091610-a1b2
- 创建日期: 2026-04-09
- Owner: ARCH

---

## 一、定投去重边界方案

### 1.1 问题定义
定投计划自动生成交易时，需防止重复生成同一执行日期的交易。

### 1.2 去重机制现状（代码分析）

**现有逻辑 (`lib/funds/sip-plans.ts:67-79`)：**
```typescript
function hasGeneratedTransactionForExecution(
  transactions: FundTransaction[],
  planId: string,
  placedDate: string,
) {
  return transactions.some(
    (transaction) =>
      'sourcePlanId' in transaction &&
      transaction.source === 'sip_plan' &&
      transaction.sourcePlanId === planId &&
      transaction.placedDate === placedDate,
  );
}
```

**去重键：** `source === 'sip_plan' + sourcePlanId + placedDate`

### 1.3 去重边界场景枚举

| 场景 | 去重键有效性 | 边界说明 |
|------|-------------|----------|
| 单计划单日期正常执行 | ✅ 有效 | 唯一性保证 |
| 同一计划同一天多次触发 materialize | ✅ 有效 | 事务幂等 |
| 用户手动在同一天手动买入同一基金 | ⚠️ 不冲突 | 手动交易 `source='manual'`，与定投生成交易分开 |
| 用户修改计划执行时间后同一天重新执行 | ✅ 有效 | `placedDate` 不变，仍幂等 |
| 用户删除已生成的交易后重新执行 | ⚠️ 需确认 | 若删除后重新 materialize，会再次生成（符合预期） |
| 同一天同一基金有多个定投计划 | ✅ 有效 | 不同 `planId`，生成不同交易 |

### 1.4 去重边界结论

**结论：现有去重逻辑已覆盖核心场景，无需额外修改。**

**边界定义：**
- 去重键：`{ source: 'sip_plan', sourcePlanId: string, placedDate: string }`
- 幂等保证：同一输入多次调用 `materializeSipPlans` 不产生重复交易
- 不影响手动交易：`source='manual'` 的交易不参与定投去重判断

---

## 二、净值自动获取方案

### 2.1 问题定义
定投执行或手动买入时，需自动获取当日净值作为 `confirmedNav`。

### 2.2 净值数据源现状（代码分析）

**数据源接口 (`lib/funds/data-source.ts`)：**
```typescript
export interface FundDataSource {
  getNav(fundCode: string, date: string): Promise<number | null>;
  searchFunds(query: string): Promise<FundSearchResult[]>;
}
```

**现有实现：**
- `MockFundDataSource`：模拟数据源，用于测试
- 实际数据源需对接外部 API（如天天基金、蛋卷基金）

### 2.3 净值获取时机

| 场景 | 触发时机 | 净值日期 |
|------|---------|---------|
| 定投自动执行 | `materializeSipPlans` 调用时 | `placedDate` 对应交易日净值 |
| 手动买入表单提交 | 表单提交前 | 用户选择日期对应净值 |
| 交易日非交易日判断 | 净值获取失败时 | 需回退至最近交易日 |

### 2.4 净值缓存策略

**问题：外部 API 请求有延迟与限制，需缓存优化。**

**策略设计：**

| 层级 | 缓存位置 | TTL | 失效场景 |
|------|---------|-----|---------|
| L1: 内存缓存 | 应用内存 Map | 5 分钟 | 页面刷新、应用重启 |
| L2: 本地存储 | localStorage | 24 小时 | 用户手动清除、净值更新日（次日 00:00） |
| L3: 远程缓存 | Supabase 表 | 30 天 | API 数据源更新 |

**缓存键：** `{ fundCode: string, date: string }`

**缓存失效判断：**
- 若缓存日期 ≠ 当日，且当日为交易日，需重新获取
- 非交易日（周末/节假日）净值 = 最近交易日净值

### 2.5 净值获取流程

```
用户触发交易 → 检查 L1 缓存 → 检查 L2 缓存 → 调用外部 API
                ↓ 有缓存          ↓ 有缓存        ↓
              直接使用          直接使用        写入 L1/L2 → 返回
                                              ↓ 失败
                                          回退至最近交易日净值
```

### 2.6 API 限制与降级

| API | 频率限制 | 降级策略 |
|-----|---------|---------|
| 天天基金 API | 约 100 次/分钟 | 超限后使用缓存或提示用户手动输入 |
| 蛋卷基金 API | 未公开 | 同上 |

---

## 三、接口与数据结构定义

### 3.1 定投去重接口（无需新增）

现有 `materializeSipPlans` 已内置去重，BE 无需额外接口。

### 3.2 净值缓存接口

**新增数据结构：**

```typescript
interface NavCacheEntry {
  fundCode: string;
  date: string;        // YYYY-MM-DD
  nav: number;
  updatedAt: string;   // ISO timestamp
  source: 'api' | 'cache' | 'manual';
}
```

**新增 API 接口：**

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取净值 | GET | `/api/funds/nav` | 自动获取并缓存净值 |
| 批量获取净值 | POST | `/api/funds/nav/batch` | 批量获取多基金净值 |

**接口定义：GET /api/funds/nav**

- **请求参数：**
  - `fundCode` (query, string, 必填): 基金代码，如 `000001`
  - `date` (query, string, 必填): 日期 YYYY-MM-DD

- **响应结构：**
```json
{
  "success": true,
  "data": {
    "fundCode": "000001",
    "date": "2026-04-09",
    "nav": 1.2345,
    "source": "api",
    "updatedAt": "2026-04-09T16:00:00.000Z"
  }
}
```

- **错误响应：**
```json
{
  "success": false,
  "error": {
    "code": "NAV_NOT_FOUND",
    "message": "净值未找到，请手动输入"
  }
}
```

---

## 四、风险与缺口

### 4.1 风险清单

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 外部 API 不可用 | 无法自动获取净值 | 提示用户手动输入，使用缓存兜底 |
| 非交易日判断缺失 | 获取到错误净值 | 需交易日历服务或硬编码节假日 |
| 缓存过期未清理 | 显示旧净值 | L2 缓存 TTL 限制，定期清理 |
| 多数据源不一致 | 净值差异 | 固定单一数据源，记录数据来源 |

### 4.2 设计缺口

| 缺口 | 优先级 | 建议处理 |
|------|--------|---------|
| 交易日历服务缺失 | P1 | 建议后续引入交易日历 API 或硬编码中国 A 股交易日 |
| 实际外部 API 对接未完成 | P1 | 需 BE 对接天天基金/蛋卷基金 API |
| Supabase 净值缓存表未创建 | P2 | 需创建 `nav_cache` 表 |

---

## 五、交付物清单

- [x] 定投去重边界场景枚举与结论
- [x] 净值自动获取时机与缓存策略
- [x] 接口与数据结构定义
- [x] 风险与缺口记录

---

## 六、变更记录

- 2026-04-09 ARCH 创建设计文档