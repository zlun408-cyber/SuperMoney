# SuperFinance Supabase 线上落地验收 Runbook

## 元信息
- Project: superfinance
- 场景: 登录态 watchlist / transaction / sip / sip execution 云端落地验收
- 依赖 SQL: `supabase/stage3-auth-sync.sql`
- 配套清单: `docs/project/superfinance/docs/supabase-rollout-checklist.md`

## 目标
- 把 `stage3-auth-sync.sql` 正式执行到目标 Supabase project
- 确认 4 张核心表、索引、trigger、RLS policy 都齐
- 确认登录态下定投 execution record 可写入云端
- 确认删除自动生成交易后，`skipped` 语义成立且刷新不重放

## 完成标准
- SQL 执行成功且无报错
- `watchlist_funds`、`fund_transactions`、`fund_sip_plans`、`fund_sip_executions` 全部存在
- `fund_sip_executions` 的唯一约束、索引、trigger、RLS policy 完整
- 登录态 smoke test 通过
- 删除自动生成交易后，数据库中 execution record 进入 `skipped`

## 执行前准备
- 本地代码已更新到当前 `master`
- 本地已完成基础验证：
  - `npm run test`
  - `npm run build`
- 已确认目标 Supabase project 无误
- 已准备一个可登录账号用于验收

## Step 1. 执行 SQL
1. 打开目标 Supabase 项目的 SQL Editor。
2. 复制并执行 `supabase/stage3-auth-sync.sql` 全量内容。
3. 记录执行结果截图或成功提示。

如果这一步失败：
- 立即停止后续页面验收
- 先修复 SQL 报错，再重新执行

## Step 2. 校验数据库结构
执行以下 SQL，逐项确认结果。

### 2.1 表存在性
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

期望：返回 4 行。

### 2.2 `fund_sip_executions` 列
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fund_sip_executions'
order by ordinal_position;
```

重点确认存在：
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

### 2.3 索引
```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'fund_sip_executions'
order by indexname;
```

至少确认存在：
- 主键索引
- 唯一索引：`(user_id, plan_id, execution_date)`
- `fund_sip_executions_user_id_idx`
- `fund_sip_executions_fund_id_idx`
- `fund_sip_executions_status_idx`

### 2.4 Trigger
```sql
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'fund_sip_executions';
```

期望：存在 `fund_sip_executions_set_updated_at`。

### 2.5 RLS Policy
```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'fund_sip_executions'
order by policyname;
```

至少确认存在：
- `fund_sip_executions_select_own`
- `fund_sip_executions_insert_own`
- `fund_sip_executions_update_own`
- `fund_sip_executions_delete_own`

## Step 3. 登录态 Smoke Test
按顺序执行，不跳步。

1. 登录系统
2. 新增一只基金
3. 创建一个“已经到期应执行”的定投计划
4. 等待系统自动生成交易
5. 进入基金详情页，确认：
   - 交易记录中出现 `来源：定投计划`
   - 定投计划区显示“最近一次已生成”
6. 删除这笔自动生成交易
7. 确认页面出现“本次已跳过，不会自动补回”
8. 刷新页面
9. 确认该交易没有被重新自动补回

## Step 4. 数据验收
在 SQL Editor 查询最近 execution record：

```sql
select id, user_id, fund_id, plan_id, execution_date, status, transaction_id, skip_reason, updated_at
from public.fund_sip_executions
order by updated_at desc
limit 20;
```

删除自动生成交易后，目标记录必须满足：
- `status = 'skipped'`
- `transaction_id is null`
- `skip_reason = 'deleted_generated_transaction'`

可同时辅助检查交易表：

```sql
select id, user_id, fund_id, type, trade_date, amount, shares, nav, created_at
from public.fund_transactions
order by created_at desc
limit 20;
```

## 一票否决项
出现任一情况，本次验收直接判失败：
- SQL 执行报错
- `fund_sip_executions` 表不存在
- `fund_sip_executions` 缺索引、trigger 或 RLS policy
- 页面能生成定投交易，但数据库无对应 execution record
- 删除自动生成交易后刷新，交易又被补回

## 失败时排查顺序
1. 先查 SQL 是否完整执行
2. 再查当前环境是否真的是目标 Supabase project
3. 再查 `fund_sip_executions` 表结构 / policy / trigger
4. 最后再查前端登录态与环境变量

## 验收完成后的收尾动作
- 勾选 `docs/project/superfinance/docs/supabase-rollout-checklist.md`
- 在 `WORKLOG.md` 记录：
  - 执行日期
  - 目标环境
  - SQL 是否成功
  - smoke test 是否通过
  - 是否发现异常

