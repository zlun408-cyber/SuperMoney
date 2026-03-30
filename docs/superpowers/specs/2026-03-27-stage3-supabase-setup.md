# 第三阶段 Supabase 落地说明

## 1. 目的
这份说明只解决一件事：

- 让当前已经接好的“登录 + 云同步代码”真正连上 Supabase

也就是说，现在代码侧已经具备：

- 登录 / 注册 / 退出入口
- 登录状态读取
- 云端 watchlist 读写
- 首次登录本地 / 云端冲突分流

还差的是：

- 你的 Supabase 项目
- 数据表
- 环境变量

## 2. 你需要准备什么
需要在 Supabase 控制台准备 3 样东西：

1. 一个项目
2. 三张表
3. 项目的 URL 和 anon key

## 3. 建表 SQL
项目里已经放好 SQL 文件：

- `supabase/stage3-auth-sync.sql`

使用方法：

1. 打开 Supabase 控制台
2. 进入 SQL Editor
3. 把 `supabase/stage3-auth-sync.sql` 全部执行

执行后会得到：

- `watchlist_funds`
- `fund_transactions`
- `fund_sip_plans`
- 对应索引
- `updated_at` 自动更新时间触发器
- RLS 安全策略

其中 `fund_sip_plans` 用来保存基金详情页里的定投计划，字段覆盖：

- 定投金额
- 执行周期（daily / weekly / monthly）
- 开始日期 / 结束日期
- 执行时间 / 执行时段
- 当前状态（active / paused / ended）
- 上次执行时间 / 下次执行时间

## 4. 环境变量
项目里已经放好示例文件：

- `.env.example`

你需要在项目根目录新建：

- `.env.local`

内容格式如下：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目地址
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：浏览器端公开 key

## 5. 认证设置建议
第三阶段当前只做最小闭环，建议这样配：

- 开启 Email 登录
- 暂时关闭必须邮箱验证

原因：

- 这样更容易先把注册 / 登录 / 同步主流程跑通
- 等后面主线稳定后，再补邮箱验证和忘记密码

## 6. 本地验证顺序
建议按这个顺序验证：

1. 先执行建表 SQL
2. 再创建 `.env.local`
3. 再启动项目
4. 注册一个测试账号
5. 添加一只基金
6. 退出后重新登录
7. 确认数据还在
8. 再尝试“本地有数据 + 云端有数据”的冲突场景

## 7. 当前已知边界
这次接线完成后，仍然有这些边界：

- 还没有忘记密码
- 还没有邮箱验证流程
- 还没有复杂冲突合并
- 还没有第三阶段专门的 E2E
- 定投计划的自动执行仍然是前端物化逻辑，不是数据库定时任务

## 8. 下一步建议
当 Supabase 真连通后，下一步建议是：

1. 做一次真实浏览器联调
2. 补第三阶段 E2E
3. 更新进度文件并整理提交
