# SuperFinance Supabase 执行与验收清单

## 元信息
- Project: superfinance
- 更新日期: 2026-04-24
- 适用范围:
  - 定投 execution record 云端落地
  - estimate accuracy 云端留存落地

## 本次 SQL 变更

### A. 定投 execution record（已落地）
- 执行文件: `supabase/stage3-auth-sync.sql`
- 新增表: `public.fund_sip_executions`
- 关键能力:
  - 持久化定投 execution record
  - 支持 `pending / generated / skipped`
  - 支持删除自动生成交易后的 `skipped` 状态保留
  - 支持登录态下 execution record 云端同步

### B. estimate accuracy 云端留存（本次新增验收）
- 执行文件: `supabase/accuracy-sync.sql`
- 新增表:
  - `public.fund_estimate_accuracy_snapshots`
  - `public.fund_estimate_adjustment_decisions`
- 关键能力:
  - 登录态下 estimate accuracy 样本云端留存
  - 登录态下修正决策云端留存
  - 支持本地 + 云端 merge 后回写云端
  - 缺表时允许前端走本地兼容降级路径

## 执行前检查
- [ ] 本地代码已更新到包含 `fund_sip_executions` 与 accuracy cloud retention 的版本
- [ ] 已完成本地验证：
  - [ ] `npm run test`
  - [ ] `npm run build`
  - [ ] `npm exec -- playwright test tests/e2e/auth-dialog-error.spec.ts tests/e2e/sip-execution-replay.spec.ts tests/e2e/sip-execution-cloud.spec.ts tests/e2e/nav-fallback-manual.spec.ts`
  - [ ] `npm exec -- playwright test tests/e2e/estimate-accuracy-dashboard.spec.ts`
- [ ] 目标环境已确认是正确的 Supabase project
- [ ] 已知本次变更主要影响：
  - 登录态 watchlist / 定投 / execution record 同步
  - 登录态 estimate accuracy 样本同步
  - 登录态 estimate adjustment 决策同步
  - 未登录或缺表时的本地兼容降级

## 执行步骤
1. 打开目标 Supabase 项目的 **SQL Editor**。
2. 复制 `supabase/stage3-auth-sync.sql` 全量内容执行（若之前尚未执行）。
3. 复制 `supabase/accuracy-sync.sql` 全量内容执行。
4. 确认 SQL 执行结果无报错。
5. 确认以下对象已存在：
   - `watchlist_funds`
   - `fund_transactions`
   - `fund_sip_plans`
   - `fund_sip_executions`
   - `fund_estimate_accuracy_snapshots`
   - `fund_estimate_adjustment_decisions`
6. 确认 accuracy 相关对象已创建：
   - 唯一约束:
     - `fund_estimate_accuracy_snapshots (user_id, snapshot_key)`
     - `fund_estimate_adjustment_decisions (user_id, fund_code)`
   - 索引:
     - `fund_estimate_accuracy_snapshots_user_fund_date_idx`
     - `fund_estimate_accuracy_snapshots_user_quote_updated_at_idx`
     - `fund_estimate_accuracy_snapshots_user_resolved_at_idx`
     - `fund_estimate_adjustment_decisions_user_status_idx`
     - `fund_estimate_adjustment_decisions_user_decision_updated_at_idx`
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
    'fund_sip_executions',
    'fund_estimate_accuracy_snapshots',
    'fund_estimate_adjustment_decisions'
  )
order by table_name;
```

期望结果：返回 6 行。

### A2. accuracy snapshots 列校验
```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fund_estimate_accuracy_snapshots'
order by ordinal_position;
```

重点确认以下列存在：
- `id`
- `user_id`
- `snapshot_key`
- `fund_code`
- `fund_name`
- `quote_updated_at`
- `quote_updated_at_raw`
- `quote_time_semantics`
- `trading_date`
- `estimated_nav`
- `final_nav`
- `absolute_error_rate`
- `resolved_at`
- `client_created_at`
- `client_updated_at`
- `created_at`
- `updated_at`

### A3. accuracy decisions 列校验
```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fund_estimate_adjustment_decisions'
order by ordinal_position;
```

重点确认以下列存在：
- `id`
- `user_id`
- `fund_code`
- `fund_name`
- `status`
- `decision_updated_at`
- `history`
- `created_at`
- `updated_at`

### A4. accuracy 索引校验
```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'fund_estimate_accuracy_snapshots',
    'fund_estimate_adjustment_decisions'
  )
order by tablename, indexname;
```

至少应看到：
- `fund_estimate_accuracy_snapshots_pkey`
- 唯一约束生成的 `(user_id, snapshot_key)` 索引
- `fund_estimate_accuracy_snapshots_user_fund_date_idx`
- `fund_estimate_accuracy_snapshots_user_quote_updated_at_idx`
- `fund_estimate_accuracy_snapshots_user_resolved_at_idx`
- `fund_estimate_adjustment_decisions_pkey`
- 唯一约束生成的 `(user_id, fund_code)` 索引
- `fund_estimate_adjustment_decisions_user_status_idx`
- `fund_estimate_adjustment_decisions_user_decision_updated_at_idx`

### A5. accuracy Trigger 校验
```sql
select trigger_name, event_object_table, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'fund_estimate_accuracy_snapshots',
    'fund_estimate_adjustment_decisions'
  )
order by event_object_table, trigger_name;
```

期望结果：至少存在：
- `fund_estimate_accuracy_snapshots_set_updated_at`
- `fund_estimate_adjustment_decisions_set_updated_at`

### A6. accuracy Policy 校验
```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'fund_estimate_accuracy_snapshots',
    'fund_estimate_adjustment_decisions'
  )
order by tablename, policyname;
```

期望结果：每张表至少存在以下 4 条 policy：
- `*_select_own`
- `*_insert_own`
- `*_update_own`
- `*_delete_own`

## 登录态合并、import 与降级路径验收

### B1. 定投 execution record 验收（保留）
1. 打开项目并登录。
2. 添加一只基金并创建一个到期定投计划。
3. 等待页面自动生成定投交易。
4. 进入基金详情页，确认：
   - 交易记录中出现 `来源：定投计划`
   - 定投计划区显示 `最近一次已生成`
5. 删除这笔自动生成交易，确认：
   - 页面显示 `本次已跳过，不会自动补回`
   - 刷新页面后交易不会被自动补回

### B2. accuracy 登录态 merge 验收
1. 打开项目并登录。
2. 进入基金详情页和 `/accuracy`，确保已有 estimate accuracy 样本（若无，可先在本地跑导入 JSON）。
3. 在 `/accuracy` 确认：
   - 顶部“数据留存状态”显示 `云端同步`
   - 文案显示 `样本与决策已实时备份至云端`
4. 刷新页面，确认：
   - `/accuracy` 中样本统计、基金行、修正决策仍存在
   - 不出现重复样本计数
5. 重点确认以下行为断言：
   - 登录态初始化后，本地 + 云端样本为 merge 结果，而不是单向覆盖
   - 若云端当前为空，已有本地样本不会被清空
   - 同一用户同一 `snapshot_key` 不会因为 merge 或 reload 产生重复样本

### B3. accuracy import 后 mirror 验收
1. 在已登录状态进入 `/accuracy`。
2. 导入一份包含新增样本或新增决策的 accuracy JSON。
3. 确认页面提示导入成功，且 dashboard 统计与基金行即时刷新。
4. 刷新页面后再次确认：
   - 刚导入的样本与决策仍存在
   - 样本统计未重复累计
5. 在 Supabase SQL Editor 执行下方推荐查询，确认：
   - 新导入样本已出现在 `fund_estimate_accuracy_snapshots`
   - 新导入或更新后的决策已反映到 `fund_estimate_adjustment_decisions`
6. 重点确认以下行为断言：
   - import/apply 成功后，本地结果会 mirror 到 cloud
   - mirror 后 reload 仍以去重后的 merge 结果呈现

### B4. accuracy 降级路径验收
1. 退出登录后再次进入 `/accuracy``，确认：
   - 页面仍可正常读取本地样本
   - “数据留存状态”切换为 `仅本地`
2. 若目标环境暂未执行 `accuracy-sync.sql`，登录态下也不应出现页面崩溃；应退回兼容路径并可继续本地工作。
3. 若云端写入暂时失败，也应满足：
   - dashboard 不崩溃
   - 已有本地样本与决策仍可继续查看
   - 本地导入/分析路径不被阻断

### B5. accuracy 云端数据验收
推荐查询：
```sql
select
  user_id,
  snapshot_key,
  fund_code,
  fund_name,
  trading_date,
  quote_updated_at_raw,
  quote_time_semantics,
  final_nav,
  absolute_error_rate,
  resolved_at,
  updated_at
from public.fund_estimate_accuracy_snapshots
order by updated_at desc
limit 20;
```

```sql
select
  user_id,
  fund_code,
  fund_name,
  status,
  decision_updated_at,
  jsonb_array_length(history) as history_count,
  updated_at
from public.fund_estimate_adjustment_decisions
order by updated_at desc
limit 20;
```

重点确认：
- 登录态导入或已有本地样本后，云端出现对应 `fund_estimate_accuracy_snapshots` 行
- 同一用户同一 `snapshot_key` 不会重复插入多行
- 同一用户同一 `fund_code` 仅保留一条最新决策记录，`history` 为累计数组
- 不同用户之间互不可见

## 本地验证命令
- 单元测试: `npm run test`
- 构建验证: `npm run build`
- 聚焦 accuracy 回归:
  - `npm test -- tests/lib/accuracy/accuracy-store.test.ts tests/lib/sync/cloud-accuracy.test.ts tests/supabase/accuracy-sync-sql.test.ts tests/components/accuracy/accuracy-import-dialog.test.tsx tests/components/accuracy/accuracy-dashboard.test.tsx tests/components/accuracy/accuracy-dashboard-import.test.tsx`
- E2E:
  - `npm exec -- playwright test tests/e2e/auth-dialog-error.spec.ts`
  - `npm exec -- playwright test tests/e2e/sip-execution-replay.spec.ts`
  - `npm exec -- playwright test tests/e2e/sip-execution-cloud.spec.ts`
  - `npm exec -- playwright test tests/e2e/nav-fallback-manual.spec.ts`
  - `npm exec -- playwright test tests/e2e/estimate-accuracy-dashboard.spec.ts`

## 回滚与异常处理
- 如果 SQL 执行失败：
  - 不继续做页面验收
  - 先修复 SQL 报错，再重新执行
- 如果 accuracy 登录态页面报错或样本未上云：
  - 先检查 `fund_estimate_accuracy_snapshots` / `fund_estimate_adjustment_decisions` 表是否存在
  - 再检查 RLS policy 是否完整
  - 再检查前端环境是否连到了正确的 Supabase project
- 如果 `/accuracy` 页面显示数据异常减少：
  - 先核对本地 localStorage 是否仍有样本
  - 再核对 remote empty 是否错误覆盖 local（当前实现理论上不会）
  - 再检查云端是否出现重复或脏记录
- 如果需要临时回退：
  - 未登录和本地路径仍可继续工作
  - 登录态 accuracy 云端留存会退回本地兼容模式
  - 不建议删除 accuracy 表后继续宣称“已支持云端留存”

## 备注
- 若 `accuracy-sync.sql` 尚未执行，前端仍可在本地模式工作；已登录用户也应保持兼容降级，不应丢失本地数据。
- accuracy 当前已具备：JSON 导入、JSON/CSV 导出、登录态云端留存基础链路；本清单的目标是完成目标环境 SQL 落地与验收闭环。
