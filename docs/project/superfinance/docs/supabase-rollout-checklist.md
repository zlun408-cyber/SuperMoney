# SuperFinance Supabase 执行与验收清单

## 元信息
- Project: superfinance
- 更新日期: 2026-04-10
- 适用范围: 定投 execution record 云端落地

## 本次 SQL 变更
- 执行文件: `supabase/stage3-auth-sync.sql`
- 新增表: `public.fund_sip_executions`
- 关键能力:
  - 持久化定投 execution record
  - 支持 `pending / generated / skipped`
  - 支持删除自动生成交易后的 `skipped` 状态保留
  - 支持登录态下 execution record 云端同步

## 执行前检查
- [ ] 本地代码已更新到包含 `fund_sip_executions` 的版本
- [ ] 已完成本地验证：
  - [ ] `npm run test`
  - [ ] `npm run build`
  - [ ] `npm exec -- playwright test tests/e2e/auth-dialog-error.spec.ts tests/e2e/sip-execution-replay.spec.ts tests/e2e/sip-execution-cloud.spec.ts tests/e2e/nav-fallback-manual.spec.ts`
- [ ] 目标环境已确认是正确的 Supabase project
- [ ] 已知本次变更主要影响：
  - 登录态 watchlist 同步
  - 定投执行记录持久化
  - 删除自动生成定投交易后的跳过重放语义

## 执行步骤
1. 打开目标 Supabase 项目的 **SQL Editor**。
2. 复制 `supabase/stage3-auth-sync.sql` 全量内容执行。
3. 确认 SQL 执行结果无报错。
4. 确认以下对象已存在：
   - `watchlist_funds`
   - `fund_transactions`
   - `fund_sip_plans`
   - `fund_sip_executions`
5. 确认 `fund_sip_executions` 上已创建：
   - 唯一约束: `(user_id, plan_id, execution_date)`
   - 索引: `user_id`、`fund_id`、`(user_id, status)`
   - `updated_at` trigger
   - RLS 与四类 policy（select / insert / update / delete）

## SQL 结构校验

### A1. 表存在性校验
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'watchlist_funds',
    'fund_transactions',
    'fund_sip_plans',
    'fund_sip_executions'
  )
order by table_name;
```

期望结果：返回 4 行。

### A2. 列与约束校验
```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fund_sip_executions'
order by ordinal_position;
```

重点确认以下列存在：
- `id`
- `user_id`
- `fund_id`
- `plan_id`
- `execution_date`
- `status`
- `transaction_id`
- `generated_at`
- `skipped_at`
- `skip_reason`
- `created_at`
- `updated_at`

### A3. 索引校验
```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'fund_sip_executions'
order by indexname;
```

至少应看到：
- `fund_sip_executions_pkey`
- 唯一约束生成的唯一索引
- `fund_sip_executions_user_id_idx`
- `fund_sip_executions_fund_id_idx`
- `fund_sip_executions_status_idx`

### A4. Trigger 校验
```sql
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'fund_sip_executions';
```

期望结果：存在 `fund_sip_executions_set_updated_at`。

### A5. Policy 校验
```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'fund_sip_executions'
order by policyname;
```

期望结果：至少存在以下 4 条 policy：
- `fund_sip_executions_select_own`
- `fund_sip_executions_insert_own`
- `fund_sip_executions_update_own`
- `fund_sip_executions_delete_own`

## 页面与数据验收

### B1. 结构验收
- `fund_sip_executions` 能正常查询
- `status` 仅允许:
  - `pending`
  - `generated`
  - `skipped`
- `skip_reason` 仅允许:
  - `deleted_generated_transaction`

### B2. 页面验收
1. 打开项目并登录。
2. 添加一只基金并创建一个到期定投计划。
3. 等待页面自动生成定投交易。
4. 进入基金详情页，确认：
   - 交易记录中出现 `来源：定投计划`
   - 定投计划区显示 `最近一次已生成`
5. 删除这笔自动生成交易，确认：
   - 页面显示 `本次已跳过，不会自动补回`
   - 刷新页面后交易不会被自动补回

### B3. 数据验收
- `fund_transactions` 中自动生成交易被删除后，不再存在对应记录
- `fund_sip_executions` 中对应执行记录被更新为:
  - `status = 'skipped'`
  - `transaction_id = null`
  - `skip_reason = 'deleted_generated_transaction'`

推荐查询：
```sql
select id, user_id, fund_id, plan_id, execution_date, status, transaction_id, skip_reason, updated_at
from public.fund_sip_executions
order by updated_at desc
limit 20;
```

```sql
select id, user_id, fund_id, type, trade_date, amount, shares, nav, created_at
from public.fund_transactions
order by created_at desc
limit 20;
```

## 本地验证命令
- 单元测试: `npm run test`
- 构建验证: `npm run build`
- E2E:
  - `npm exec -- playwright test tests/e2e/auth-dialog-error.spec.ts`
  - `npm exec -- playwright test tests/e2e/sip-execution-replay.spec.ts`
  - `npm exec -- playwright test tests/e2e/sip-execution-cloud.spec.ts`
  - `npm exec -- playwright test tests/e2e/nav-fallback-manual.spec.ts`

## 回滚与异常处理
- 如果 SQL 执行失败：
  - 不继续做页面验收
  - 先修复 SQL 报错，再重新执行
- 如果页面能生成定投交易，但 `fund_sip_executions` 无记录：
  - 优先检查 `fund_sip_executions` 表是否存在
  - 再检查 RLS policy 是否完整
  - 再检查前端环境是否连到了正确的 Supabase project
- 如果删除自动生成交易后刷新又被补回：
  - 先检查 `fund_sip_executions.status` 是否成功写成 `skipped`
  - 再检查对应 `transaction_id` 是否已清空
- 如果需要临时回退：
  - 前端可以继续工作在兼容路径上
  - 但登录态 execution record 云端持久化会缺失
  - 不建议只删除 `fund_sip_executions` 表而保留已上线前端代码

## 备注
- 如果 SQL 尚未执行，前端仍可在本地和兼容降级路径工作，但 execution record 不会完整持久化到云端。
- 当前没有“恢复 skipped execution”的 UI；这是本次设计约束，不是缺陷。
