# Design Spec: 定投 execution record 与交易重放边界

## 元信息
- FeatureId: sip-execution-replay-20260409200801-kr33
- 创建日期: 2026-04-09
- Owner: ARCH

## 1. 设计目标
- 为定投计划引入最小 execution record 模型，明确执行事实，不再依赖交易结果反推是否已执行。
- 覆盖补单/漏单重放、删除自动生成交易后 skipped、同日多计划独立执行三类核心边界。
- 将 Supabase 持久化纳入本次主路径，但保持模型最小，不扩展为完整审计系统。

## 2. 现状与问题
- 当前 `lib/funds/sip-plans.ts` 只通过 `source = 'sip_plan' + sourcePlanId + placedDate` 判断是否已生成交易。
- 该方案能做基础幂等，但无法稳定表达三类状态：应执行未生成、已生成后被用户删除、显式跳过后不补回。
- 现有 `fund_sip_plans` 已持久化调度游标 `lastExecutedAt / nextExecutionAt`，但缺少执行事实层。

## 3. execution record 最小模型

### 3.1 核心原则
- 调度事实与交易结果分层：`sipPlans` 负责下一次何时执行，`execution records` 负责某次执行是否发生，`transactions` 负责生成后的交易结果。
- 唯一执行键固定为 `planId + executionDate`。
- 状态只保留 `pending / generated / skipped` 三种，不引入更多中间态。

### 3.2 数据结构
```ts
type SipExecutionStatus = 'pending' | 'generated' | 'skipped';

interface SipExecutionRecord {
  id: string;
  planId: string;
  fundId: string;
  executionDate: string; // YYYY-MM-DD
  status: SipExecutionStatus;
  transactionId?: string;
  generatedAt?: string;
  skippedAt?: string;
  skipReason?: 'deleted_generated_transaction';
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 字段语义
- `planId`: 对应 `SipPlan.id`。
- `fundId`: 与现有云端 `fund_sip_plans.fund_id`、`fund_transactions.fund_id` 对齐，避免新增跨表映射复杂度。
- `executionDate`: 本次定投应执行日期，不含时间，仅表达业务日。
- `status`:
  - `pending`: 应执行但尚未成功生成交易，允许后续重放。
  - `generated`: 已成功生成自动交易，不允许重复生成。
  - `skipped`: 显式跳过，不允许自动补回。
- `transactionId`: 仅在 `generated` 时关联对应自动生成交易。
- `skipReason`: 本次最小仅定义 `deleted_generated_transaction`，用于表达“用户删除自动生成交易后不补回”。

### 3.4 状态迁移
```text
missing -> pending
pending -> generated
generated -> skipped   (用户删除对应自动生成交易)
pending -> pending     (依赖失败/净值缺失，下次继续重放)
skipped -> skipped     (后续重放保持跳过)
generated -> generated (幂等重放不重复生成)
```

## 4. 与现有模型关系

### 4.1 与 sipPlans 的关系
- `SipPlan.lastExecutedAt / nextExecutionAt` 继续作为调度游标使用，不承载执行结论。
- materialize 逻辑推进游标时，必须同时检查并维护 execution record。
- 同一执行日的事实以 execution record 为准，而不是以是否存在交易为准。

### 4.2 与 transactions 的关系
- 自动生成交易仍保持 `source = 'sip_plan'` 与 `sourcePlanId = planId` 语义不变。
- execution record 是事实层，transactions 是结果层。
- `generated` 通过 `transactionId` 关联具体交易；删除交易时需反向更新对应 execution record。
- 手动交易 `source = 'manual'` 不参与 execution record 状态迁移，也不影响独立计划的执行事实。

## 5. 补单 / 漏单重放规则

### 5.1 触发时机
- 每次运行定投 materialize 逻辑时执行重放判定。
- 每次从本地或 Supabase 加载计划后，可执行一次 reconciliation，补齐缺失 execution record。

### 5.2 判定流程
1. 对每个 plan 按时间游标遍历所有“应执行且已到期”的 executionDate。
2. 对于每个 `planId + executionDate`：
   - 若 execution record 不存在，先创建 `pending`。
   - 若状态为 `pending` 且无 `transactionId`，允许尝试生成交易。
   - 若状态为 `generated`，直接跳过，不重复生成。
   - 若状态为 `skipped`，直接跳过，不补回。

### 5.3 成功/失败处理
- 成功生成自动交易：`pending -> generated`，写入 `transactionId` 与 `generatedAt`。
- 因净值缺失、外部依赖失败、瞬时异常导致本次无法生成：保持 `pending`，下次重放继续尝试。
- 不允许因依赖失败自动转为 `skipped`，避免把系统失败误判为用户选择。

### 5.4 业务语义
- “漏单”定义为：某执行日存在或应补建 `pending`，但尚未成功生成交易。
- “补单”定义为：后续重放将该 `pending` 推进为 `generated`。
- 因此，补单/漏单不再依赖交易扫描推断，而是依赖 execution record 的显式状态。

## 6. 删除后 skipped 规则

### 6.1 触发条件
- 用户删除一笔 `source = 'sip_plan'` 的自动生成交易。
- 系统可通过 `transactionId` 或 `sourcePlanId + executionDate` 找到对应 execution record。

### 6.2 状态迁移
- 若对应 execution record 当前为 `generated`：
  - 更新为 `skipped`
  - 清空 `transactionId`
  - 写入 `skippedAt`
  - 写入 `skipReason = 'deleted_generated_transaction'`

### 6.3 强制结论
- `skipped` 后续不自动补回。
- 本次 Feature 不设计“恢复 skipped”为 pending/generate 的 UI 或运维入口。
- 若未来需要恢复，必须作为新 Feature 明确设计人工恢复语义。

## 7. 同日多计划独立执行边界

### 7.1 冲突定义
- 冲突键只使用 `planId + executionDate`。
- 不使用“同基金 + 同日只允许一笔”作为冲突原则。

### 7.2 设计结论
- 同一基金、同一天、同金额、同频率，只要 `planId` 不同，就必须独立生成 execution record。
- 每个计划拥有自己的 `pending / generated / skipped` 状态，不互相覆盖、不共享 execution record。
- 前端可做展示聚合，但底层执行事实、删除行为、重放结果都必须按计划维度独立处理。

## 8. Supabase 持久化方案

### 8.1 持久化结论
- 本次将 execution record 纳入 Supabase 主路径持久化。
- 本地存储与云端存储使用同一逻辑模型，避免双语义分叉。

### 8.2 建议表结构
表名：`fund_sip_executions`

字段建议：
- `id` uuid / text
- `user_id`
- `fund_id`
- `plan_id`
- `execution_date` date
- `status` text check in (`pending`, `generated`, `skipped`)
- `transaction_id` nullable
- `generated_at` timestamptz nullable
- `skipped_at` timestamptz nullable
- `skip_reason` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

唯一约束：
- unique(`user_id`, `plan_id`, `execution_date`)

索引建议：
- index(`user_id`, `fund_id`)
- index(`user_id`, `status`)

### 8.3 与现有同步边界
- `cloud-watchlist.ts` 需新增 `listSipExecutions` / `replaceSipExecutions` 或等价增量接口。
- 同步顺序建议：funds -> sipPlans -> executionRecords -> transactions，保证 execution record 先于交易结果可被解析。
- 若云端表暂时不存在，BE 实现阶段可采用兼容降级，但 ARCH 设计主路径仍以“Supabase 已纳入”定义。

## 9. 接口与实现边界

### 9.1 领域接口建议
```ts
interface EnsureSipExecutionRecordInput {
  planId: string;
  fundId: string;
  executionDate: string;
}

interface SipExecutionRepository {
  findByPlanAndDate(planId: string, executionDate: string): Promise<SipExecutionRecord | null>;
  ensurePending(input: EnsureSipExecutionRecordInput): Promise<SipExecutionRecord>;
  markGenerated(id: string, transactionId: string, generatedAt: string): Promise<void>;
  markSkipped(id: string, skippedAt: string, reason: 'deleted_generated_transaction'): Promise<void>;
}
```

### 9.2 实现约束
- 现有 `materializeSipPlans` 需要扩展为“先处理 execution record，再处理交易生成”。
- 删除自动交易的入口必须补齐 execution record 反向更新。
- 不要求本次设计复杂后台审计、批量修复或 skipped 恢复入口。

## 10. 风险与缺口

### 10.1 风险
| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| execution record 与 transactions 更新非原子 | 可能出现 generated 与 transaction 丢失不一致 | BE 阶段优先同事务或同批次提交，并为 reconciliation 保留修复逻辑 |
| Supabase 新表引入同步复杂度 | 多端状态同步难度上升 | 保持最小字段、统一唯一键、避免设计额外状态 |
| 删除路径遗漏 execution record 更新 | 会导致被删交易被重新补回 | 强制删除入口统一走带 execution record 回写的 service |

### 10.2 缺口
| 缺口 | 优先级 | 建议处理 |
| --- | --- | --- |
| 缺少现成 execution 表与迁移脚本 | P1 | BE 实现阶段补充 Supabase migration |
| 本地存储结构尚未包含 execution record | P1 | BE/FE 在存储模型中增加对应字段与同步逻辑 |
| 尚未定义 skipped 的用户提示文案 | P2 | FE 阶段补充删除后的提示与历史展示策略 |

## 11. 验收映射
- AC-1: 已定义 execution record 最小字段、唯一键、状态迁移。
- AC-2: 已定义补单/漏单重放规则与触发条件。
- AC-3: 已定义删除自动生成交易后转 `skipped`，且不自动补回。
- AC-4: 已定义同日多计划按 `planId + executionDate` 独立执行。
- AC-5: 已输出数据结构、持久化边界、实现接口建议，可直接支撑后续 BE/FE/QA 拆分。

## 12. 变更记录
- 2026-04-09 ARCH 创建设计文档，明确 execution record 最小模型与三类边界规则
