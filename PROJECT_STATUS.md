# 基金实时估值网站 - 当前状态

## 项目目标
做一个可以查看基金实时估值的网站，并以自选基金列表监控为核心，逐步升级到由交易记录驱动的持仓与收益展示。

## 当前进度
- 已完成：创建项目目录与进度记录文件
- 已完成：确定第一阶段产品范围与设计方案（方案 C）
- 已完成：写出第一阶段设计文档与实现计划文档
- 已完成：初始化 Next.js + TypeScript + Tailwind 项目骨架
- 已完成：基金持仓盈亏计算逻辑
- 已完成：自选基金本地存储与状态管理
- 已完成：基金行情分钟级刷新逻辑
- 已完成：监控首页主界面
- 已完成：基金详情页
- 已完成：第一版真实基金估值数据源接入
- 已完成：基金名称/代码搜索添加能力
- 已完成：首页到详情页真实跳转交互
- 已完成：Playwright E2E 基础流程
- 已完成：空状态与错误处理验证
- 已完成：`feature/bootstrap` 已合并回 `master`
- 已完成：第二阶段设计文档与实现计划文档
- 已完成：交易记录数据结构与 FIFO 计算层
- 已完成：交易记录本地存储与 watchlist CRUD 扩展
- 已完成：详情页交易记录录入与列表展示
- 已完成：首页优先显示交易记录推导汇总
- 已完成：交易流水端到端主流程验证
- 已完成：交易记录编辑 / 删除 UI
- 已完成：交易记录字段错误提示与卖出超额业务提示
- 已完成：第三阶段设计文档与实现计划文档
- 已完成：Supabase 云端观察列表读写帮助层
- 已完成：登录 / 注册 / 退出入口基础 UI
- 已完成：已登录走云端、未登录走本地的 watchlist 路径分流
- 已完成：首次登录本地 / 云端冲突选择基础逻辑
- 已完成：真实 Supabase 认证状态接入
- 已完成：Supabase 环境变量示例与建表 SQL
- 已完成：真实浏览器注册 / 登录 / 刷新恢复 / 冲突弹窗联调
- 已完成：登录后禁用手工持仓编辑，统一收口到交易记录驱动
- 已完成：第三阶段核心登录与云同步 E2E
- 已完成：第四阶段设计文档与实现计划文档
- 已完成：详情页收益拆分卡片增强
- 已完成：交易记录列表信息增强（净值 / 手续费 / 备注 / 类型标签）
- 已完成：详情页账本说明文案增强（总收益口径 / 分红说明）
- 已完成：详情页账本卡片分组展示（持仓概览 / 收益拆分）
- 已完成：交易记录行追加账本影响提示（买入后持仓 / 卖出后剩余份额与本次已实现收益 / 分红影响）
- 已完成：交易记录列表排序切换（最新在前 / 最早在前）
- 已完成：交易记录列表类型筛选（全部 / 买入 / 卖出 / 只看分红）
- 已完成：交易记录按日期分组展示（账本时间线）
- 已完成：当前代码通过 `npm run test`
- 已完成：当前代码通过 `npm run build`
- 已完成：当前代码通过聚焦回归测试
- 已完成：`npm run test:e2e` 的第三阶段联动验证（含冲突选择）

## 当前主线
- 当前正在推进：第四阶段“交易账本可读性增强”
- 当前完成到：详情页收益拆分卡片增强、交易记录列表信息增强、账本说明文案增强、账本卡片分组展示、交易记录账本影响提示、交易记录排序切换、交易记录类型筛选、交易记录按日期分组展示、页面层回归验证
- 下一步：整理第四阶段这一轮账本可读性增强提交，或再补更细的视觉 polish

## 关键决策
- 项目目录名：`SuperFinance`
- 使用独立文件记录项目状态，避免窗口关闭后丢失进度
- 第一阶段采用方案 C：先做监控主线，再补增强功能
- 第一阶段先不做登录，用户数据保存在浏览器本地
- 第二阶段采用“完整交易记录 + FIFO”方案
- 第二阶段支持四类记录：买入、卖出、现金分红、红利再投资
- 首页与详情页在有交易记录时，优先使用交易记录推导结果
- 交易记录编辑复用现有弹层，不新增独立编辑页面
- 交易记录删除先使用浏览器确认框，保持实现简单稳定
- 错误提示采用“字段级 + 业务级”双层方式，但只在点击保存时触发
- 第三阶段采用 Supabase 作为认证与云端存储方案
- 第三阶段云端结构采用两张表：`watchlist_funds`、`fund_transactions`
- 首次登录如本地和云端都有数据，不自动合并，必须让用户二选一
- 本地落地时使用 `.env.local` 提供 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 第四阶段采用“轻量双增强”方案：先增强收益拆分卡片，再增强交易记录列表可读性
- 推荐技术方向：Next.js + TypeScript + Tailwind CSS + localStorage
- 当前主分支：`master`
- 当前开发目录：项目主目录 `/Users/zhanglun/Desktop/SuperFinance`

## 阻塞问题
- 暂无硬阻塞
- `npm run build` 在沙箱内会因 Next.js Turbopack 端口绑定限制失败，需在沙箱外验证
- 下一步主要是整理第四阶段增强提交，或规划下一块主线增强

## 重要文件
- `PROJECT_STATUS.md`：项目当前状态
- `WORKLOG.md`：按日期记录工作过程
- `NEXT_STEPS.md`：接下来要做的事
- `SESSION_RESUME.md`：下次恢复会话的说明
- `docs/superpowers/specs/2026-03-25-fund-monitoring-design.md`：第一阶段设计文档
- `docs/superpowers/plans/2026-03-25-fund-monitoring-mvp.md`：第一阶段实现计划
- `docs/superpowers/specs/2026-03-26-trade-ledger-design.md`：第二阶段设计文档
- `docs/superpowers/plans/2026-03-26-trade-ledger-phase2.md`：第二阶段实现计划
- `docs/superpowers/specs/2026-03-27-transaction-record-edit-delete-design.md`：交易记录编辑/删除设计文档
- `docs/superpowers/plans/2026-03-27-transaction-record-edit-delete.md`：交易记录编辑/删除实现计划
- `docs/superpowers/specs/2026-03-27-transaction-validation-feedback-design.md`：交易记录错误提示设计文档
- `docs/superpowers/plans/2026-03-27-transaction-validation-feedback.md`：交易记录错误提示实现计划
- `docs/superpowers/specs/2026-03-27-stage3-auth-sync-design.md`：第三阶段登录与云同步设计文档
- `docs/superpowers/plans/2026-03-27-stage3-auth-sync.md`：第三阶段登录与云同步实现计划
- `docs/superpowers/specs/2026-03-27-stage3-supabase-setup.md`：第三阶段 Supabase 落地说明
- `docs/superpowers/specs/2026-03-27-stage4-ledger-readability-design.md`：第四阶段交易账本可读性增强设计文档
- `docs/superpowers/plans/2026-03-27-stage4-ledger-readability.md`：第四阶段交易账本可读性增强实现计划
