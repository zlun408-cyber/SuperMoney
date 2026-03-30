# 工作日志

## 2026-03-25
- 做了：创建 `SuperFinance` 项目文件夹
- 做了：初始化进度管理文件
- 修改了：`PROJECT_STATUS.md`、`WORKLOG.md`、`NEXT_STEPS.md`
- 结论：项目已经具备最基础的进度留存能力
- 下一步：确认第一版功能范围

## 2026-03-25（需求设计阶段）
- 做了：明确第一阶段核心目标是“基金实时估值监控”
- 做了：确定以自选基金列表监控为主，同时支持单只基金查看
- 做了：确定添加方式为“输入代码 + 搜索名称”
- 做了：确定刷新频率为分钟级
- 做了：确定第一阶段先做持仓汇总录入，买入记录明细放到后续阶段
- 做了：确定第一阶段先不做登录，但后续保留升级空间
- 做了：确定采用方案 C，先做监控主线，再补增强功能
- 做了：输出设计文档 `docs/superpowers/specs/2026-03-25-fund-monitoring-design.md`
- 做了：输出实现计划 `docs/superpowers/plans/2026-03-25-fund-monitoring-mvp.md`
- 结论：第一阶段产品范围、页面结构、数据方案、错误处理和成功标准已明确
- 下一步：初始化项目脚手架并开始实现首页监控骨架

## 2026-03-25（实现阶段）
- 做了：初始化 Next.js + TypeScript + Tailwind CSS 项目骨架
- 做了：实现基金持仓盈亏计算逻辑，并补充单元测试
- 做了：实现自选基金本地存储与 watchlist 状态管理
- 做了：实现基金行情分钟级刷新 hook
- 做了：实现监控首页主界面，包括添加基金、编辑持仓、删除基金、手动刷新、状态提示
- 做了：实现基金详情页与详情卡片
- 做了：补充首页与详情页的空状态、错误状态测试
- 做了：修复生产构建所需的 client hook 标记问题
- 做了：执行 `npm run test`，19 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：第一阶段 MVP 雏形已完成，具备首页、详情页、本地存储、估值刷新与基础错误处理
- 下一步：决定如何处理当前开发分支，并准备下一阶段（真实数据源/搜索）

## 2026-03-26（真实数据源接入）
- 做了：定位 `scripts/check-fund-quote.ts` 真实运行失败的原因，确认旧网页抓取方案不稳定
- 做了：验证东方财富实时估值接口 `fundgz.1234567.com.cn/js/<code>.js` 可返回估值数据
- 做了：将 `lib/funds/data-source.ts` 改为解析 `jsonpgz(...)` 实时估值数据
- 做了：补充数据源单元测试与脚本直跑测试
- 做了：实现 `/api/funds/quote` 服务端转发，避免浏览器直连外部接口受限
- 做了：调整 TypeScript 配置，避免开发脚本影响正式构建
- 做了：执行 `npm run test`，30 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过
- 做了：真实运行 `node --experimental-strip-types scripts/check-fund-quote.ts`，成功拿到 `588350` 实时估值
- 结论：第一版真实基金估值数据源已经接通，当前主线可继续推进“基金名称搜索添加”
- 下一步：实现基金名称搜索添加能力

## 2026-03-26（基金搜索添加）
- 做了：确认搜索功能采用“代码/名称共用一个输入框 + 结果列表点击添加”的方案
- 做了：接入东方财富基金搜索接口，并封装 `lib/funds/search.ts`
- 做了：新增 `/api/funds/search` 服务端搜索接口，避免浏览器直连外部搜索源
- 做了：重写 `AddFundDialog`，支持搜索中、空结果、搜索失败、已在自选中提示
- 做了：补充搜索数据层测试和添加弹窗交互测试
- 做了：执行 `npm run test`，37 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：基金名称/代码搜索添加能力已完成，用户不再需要手动输入基金名称
- 下一步：打通首页到详情页的真实跳转交互

## 2026-03-26（跳转与 E2E）
- 做了：将首页基金名称改为可点击链接，打通首页到详情页跳转
- 做了：定位并修复详情页在真实浏览器中错误调用 client hook 的问题，拆出 `FundDetailContent` 客户端组件
- 做了：新增 `playwright.config.ts`，接通 Playwright 本地启动配置
- 做了：新增 `tests/e2e/watchlist.spec.ts`，覆盖“搜索添加基金 → 刷新仍保留 → 进入详情页”主流程
- 做了：调整 `vitest.config.ts`，明确只运行项目测试并排除 `tests/e2e`
- 做了：执行 `npm run test`，37 个测试全部通过
- 做了：执行 `npm run test:e2e`，1 个端到端流程通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：第一阶段 MVP 主线已经具备单元测试、真实跳转和基础 E2E 流程
- 下一步：决定当前 `feature/bootstrap` 分支如何保留或合并，或开始规划第二阶段

## 2026-03-26（分支收尾）
- 做了：将 `feature/bootstrap` 本地合并回 `master`
- 做了：在合并后的 `master` 上重新执行 `npm run test`、`npm run test:e2e`、`npm run build`
- 做了：删除 `feature/bootstrap` 分支
- 做了：删除 `.worktrees/bootstrap` 残留目录
- 结论：第一阶段 MVP 成果已经正式回到 `master` 主线
- 下一步：规划第二阶段：买入记录明细录入


## 2026-03-27（第二阶段前半段）
- 做了：输出第二阶段设计文档 `docs/superpowers/specs/2026-03-26-trade-ledger-design.md`
- 做了：输出第二阶段实现计划 `docs/superpowers/plans/2026-03-26-trade-ledger-phase2.md`
- 做了：新增交易记录类型定义，支持买入、卖出、现金分红、红利再投资
- 做了：实现 FIFO 计算层，支持当前份额、当前成本、已实现收益、未实现收益、累计分红计算
- 做了：扩展本地存储与 `useWatchlist`，支持交易记录增删改
- 做了：在详情页加入“添加交易记录”弹层与交易记录列表
- 做了：让首页在有交易记录时优先显示交易推导结果
- 做了：让详情页汇总卡在有交易记录时优先显示交易推导结果
- 做了：新增 `tests/e2e/transaction-ledger.spec.ts`，覆盖“添加基金 → 添加买入 → 添加卖出 → 校验详情页与首页汇总”流程
- 做了：执行 `npm run test`，50 个测试全部通过
- 做了：执行 `npm run test:e2e`，2 个端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：第二阶段主线已经从“数据层”打通到“页面层”和“端到端流程”
- 下一步：决定是否继续补交易记录编辑/删除 UI，或进入本阶段提交收尾


## 2026-03-27（交易记录编辑 / 删除 UI）
- 做了：输出交易记录编辑/删除设计文档 `docs/superpowers/specs/2026-03-27-transaction-record-edit-delete-design.md`
- 做了：输出交易记录编辑/删除实现计划 `docs/superpowers/plans/2026-03-27-transaction-record-edit-delete.md`
- 做了：复用现有交易记录弹层，增加编辑模式、回填能力、保存修改能力
- 做了：在交易记录列表中加入“编辑”“删除”按钮，并补充更明确的按钮可访问名称
- 做了：详情页接入 `updateTransaction` / `removeTransaction`，支持删除确认和编辑态清理
- 做了：补充详情页测试，覆盖编辑保存、删除记录、删除最后一条后的空状态
- 做了：执行相关回归测试，32 个测试全部通过
- 做了：执行 `npm run test`，56 个测试全部通过
- 做了：执行 `npm run test:e2e`，2 个端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：第二阶段交易记录维护能力已补齐，用户现在可以新增、编辑、删除记录，并自动看到结果重算
- 下一步：决定是否继续补更细的错误提示 / 表单校验反馈，或先整理本轮增强提交


## 2026-03-27（交易记录错误提示与校验反馈）
- 做了：输出交易记录错误提示设计文档 `docs/superpowers/specs/2026-03-27-transaction-validation-feedback-design.md`
- 做了：输出交易记录错误提示实现计划 `docs/superpowers/plans/2026-03-27-transaction-validation-feedback.md`
- 做了：给交易记录表单增加字段级错误提示，覆盖日期、金额、净值、份额
- 做了：补充卖出超额的业务错误提示，保存前会阻止非法卖出
- 做了：处理编辑卖出时排除当前记录的校验口径，避免把自己重复算进去
- 做了：补充“先卖后买”场景的错误测试，避免业务校验漏判
- 做了：执行相关回归测试，32 个测试全部通过
- 做了：执行 `npm run test`，67 个测试全部通过
- 做了：执行 `npm run test:e2e`，2 个端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：交易记录表单现在会给出更明确的字段错误和卖出超额提示，基础录入体验更稳
- 下一步：决定是否继续补更细的交互 polish，或先整理本轮增强提交

## 2026-03-27（第三阶段前半段：登录与云同步基础）
- 做了：输出第三阶段设计文档 `docs/superpowers/specs/2026-03-27-stage3-auth-sync-design.md`
- 做了：输出第三阶段实现计划 `docs/superpowers/plans/2026-03-27-stage3-auth-sync.md`
- 做了：新增 `lib/sync/cloud-watchlist.ts`，打通 watchlist 与云端两张表之间的转换与保存
- 做了：新增 `lib/supabase/client.ts`，预留浏览器端 Supabase 环境入口
- 做了：新增登录 / 注册 / 退出入口基础 UI，并挂到全局布局
- 做了：让 `useWatchlist` 支持未登录走本地、已登录走云端
- 做了：新增首次登录冲突处理底层逻辑，支持“使用云端数据 / 使用本地数据”
- 做了：新增冲突选择弹窗组件 `components/auth/sync-conflict-dialog.tsx`
- 做了：执行聚焦回归测试，33 个测试全部通过
- 做了：执行 `npm run test`，81 个测试全部通过
- 做了：定位生产构建报错，修复 `app/layout.tsx` 向客户端组件直接传函数的问题
- 做了：执行 `npm run build`，生产构建通过
- 结论：第三阶段前 4 个任务已经打通到可验证状态，底层云同步路径和冲突选择逻辑已经就位
- 下一步：接入真实 Supabase SDK 与认证状态，把登录结果和冲突弹窗真正连到页面流程

## 2026-03-27（第三阶段后半段：真实 Supabase 接线）
- 做了：安装 `@supabase/supabase-js`
- 做了：新增 `lib/auth/auth-context.tsx` 与 `lib/auth/types.ts`，接入真实登录态
- 做了：让 `AuthEntry` / `HomePage` 读取真实认证状态
- 做了：把冲突弹窗真正挂到首页登录后的同步流程
- 做了：新增 `.env.example`
- 做了：新增 `supabase/stage3-auth-sync.sql`
- 做了：新增落地说明 `docs/superpowers/specs/2026-03-27-stage3-supabase-setup.md`
- 做了：完成真实浏览器联调，验证注册、登录、刷新恢复、冲突弹窗出现
- 做了：新增“登录后禁用手工持仓编辑”的限制，统一引导到交易记录驱动
- 做了：执行 `npm run test`，83 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过
- 结论：第三阶段主线已经完成真实联调，登录与云同步闭环已基本跑通
- 下一步：决定是否补第三阶段 E2E，还是先整理本轮提交

## 2026-03-27（第三阶段 E2E）
- 做了：新增 `tests/e2e/auth-sync.spec.ts`
- 做了：用固定测试账号验证“登录 → 添加基金 → 刷新保留 → 退出再登录恢复”主流程
- 做了：修正 E2E 中注册自动登录假设与刷新误清空登录态的问题
- 结论：第三阶段最核心的“登录后数据不丢”已经有自动化验证
- 下一步：视情况补“冲突选择”E2E，或结束本轮阶段收尾

## 2026-03-27（第四阶段：交易账本可读性增强）
- 做了：输出第四阶段设计文档 `docs/superpowers/specs/2026-03-27-stage4-ledger-readability-design.md`
- 做了：输出第四阶段实现计划 `docs/superpowers/plans/2026-03-27-stage4-ledger-readability.md`
- 做了：增强详情页汇总卡片，在有交易记录时展示当前份额、当前成本、平均成本、未实现收益、已实现收益、累计分红、总收益
- 做了：补充详情页测试，覆盖收益拆分卡片的可读展示
- 做了：增强交易记录列表，补充净值、手续费、备注和类型标签展示
- 做了：补充详情页测试，覆盖对账用的交易行信息展示
- 做了：增强详情页账本说明区，明确“总收益 = 已实现收益 + 未实现收益”以及“累计分红已计入已实现收益”
- 做了：增强详情页账本卡片结构，把有交易记录时的汇总拆成“持仓概览”和“收益拆分”两组
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，21 个测试全部通过
- 做了：执行 `npm run test`，86 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过
- 做了：补充详情页测试，覆盖账本说明文案展示
- 做了：补充详情页测试，覆盖账本卡片分组展示
- 做了：再次执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，23 个测试全部通过
- 结论：第四阶段当前已完成“收益拆分卡片 + 交易记录列表 + 账本说明文案 + 卡片分组展示”四块增强，详情页更接近可直接对账的账本页面
- 下一步：继续补更细的详情页可读性增强，或整理这一小轮新增可读性增强提交

## 2026-03-28（第四阶段：交易记录账本影响提示）
- 做了：为详情页交易记录补充“这笔之后发生了什么”的账本提示文案
- 做了：买入记录显示买入后持仓，卖出记录显示卖出后剩余份额与本次已实现收益
- 做了：现金分红显示分红入账与累计分红，红利再投资显示再投后持仓与累计分红
- 做了：补充详情页测试，覆盖买入 / 卖出 / 现金分红 / 红利再投资四类影响提示
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，25 个测试全部通过
- 做了：执行 `npm run test`，90 个测试全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段详情页进一步接近“可读账本”，用户现在能直接看到每笔交易后持仓或收益发生了什么变化
- 下一步：整理第四阶段这一轮可读性增强提交，或继续补第三阶段“冲突选择”E2E

## 2026-03-28（第三阶段：冲突选择 E2E）
- 做了：重写 `tests/e2e/auth-sync.spec.ts`，去掉对固定 Supabase 测试账号的依赖
- 做了：在 Playwright 中 mock Supabase auth/rest 请求，让登录恢复与冲突选择流程可稳定端到端验证
- 做了：新增“本地和云端都有数据时，登录后出现冲突选择框，并可选择使用云端数据”E2E
- 做了：顺手修正 `tests/e2e/transaction-ledger.spec.ts` 对第四阶段新账本文案的旧断言，避免全量 E2E 被历史文案漂移阻塞
- 做了：执行 `npx playwright test tests/e2e/auth-sync.spec.ts`，2 条第三阶段 E2E 全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run test`，90 个单测全部通过
- 结论：第三阶段“登录恢复 + 冲突选择”现在都有稳定自动化 E2E 覆盖，且不依赖外部固定账号
- 下一步：整理本轮测试增强提交，或继续规划下一块主线功能

## 2026-03-28（第四阶段：交易记录排序切换）
- 做了：为详情页交易记录列表增加“最新在前 / 最早在前”排序切换，默认最新在前
- 做了：保持账本影响提示仍基于正序交易快照计算，避免排序影响收益口径
- 做了：补充详情页测试，覆盖默认倒序展示和切换回正序展示
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，27 个测试全部通过
- 做了：执行 `npm run test`，92 个测试全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段详情页在交易记录变多后更容易阅读，用户可以按查看习惯切换时间顺序
- 下一步：继续补第四阶段下一块可读性增强（如交易记录时间线/筛选），或整理这一轮增强提交

## 2026-03-28（第四阶段：交易记录类型筛选）
- 做了：为详情页交易记录列表增加“全部 / 买入 / 卖出 / 只看分红”筛选
- 做了：分红筛选同时覆盖现金分红和红利再投资，方便用户对账分红相关流水
- 做了：补充详情页测试，覆盖筛选后只显示分红记录
- 做了：顺手修正 `tests/e2e/transaction-ledger.spec.ts`，避免新筛选按钮与旧断言文案冲突
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，28 个测试全部通过
- 做了：执行 `npm run test`，93 个测试全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段详情页现在可以快速聚焦买入、卖出或分红记录，账本可读性进一步提升
- 下一步：继续补第四阶段下一块可读性增强（如账本时间线），或整理这一轮增强提交

## 2026-03-28（第四阶段：账本时间线分组）
- 做了：为详情页交易记录按交易日期分组展示，让流水更像按天展开的账本时间线
- 做了：补充详情页测试，覆盖日期标题展示与同日多条记录的分组顺序
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，29 个测试全部通过
- 做了：执行 `npm run test`，94 个测试全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段详情页已经具备分组时间线、排序、筛选、影响提示等多层账本可读性增强，交易记录更接近可直接对账的账本视图
- 下一步：整理第四阶段这一轮账本可读性增强提交，或再补更细的视觉 polish

## 2026-03-28（第四阶段：工具栏状态摘要与筛选空状态）
- 做了：先补详情页失败测试，覆盖工具栏状态摘要和筛选后空状态提示
- 做了：为交易记录列表增加“当前显示：筛选条件 · 排序方式 · 条数”的摘要文案
- 做了：在筛选结果为 0 条时增加空状态提示，引导用户切回“全部”查看完整账本
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，24 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，31 个测试全部通过
- 做了：执行 `npm run test`，96 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段交易记录工具栏现在会明确告诉用户当前看的是哪一类记录、按什么顺序、共有多少条；筛选到空结果时也不会像页面坏掉
- 下一步：整理第四阶段这一轮账本可读性增强提交，或继续补更细的账本交互 polish

## 2026-03-28（第四阶段：筛选空状态一键恢复）
- 做了：先补详情页失败测试，覆盖从“无结果筛选”直接切回“全部”的交互
- 做了：在筛选空状态卡片里增加“切回全部”按钮，减少用户来回点顶部筛选器
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：筛选到空结果时，用户现在可以直接一键回到完整账本，不需要再抬手找顶部筛选器
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-30（第四阶段：筛选空状态显示当前筛选）
- 做了：先补详情页断言，要求筛选空状态明确显示“当前筛选：卖出”标签
- 做了：在交易记录筛选空状态卡片中加入当前筛选胶囊标签，避免用户只看到空结果却不知道自己筛了什么
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 结论：筛选空状态现在会把当前筛选条件显式露出，账本上下文更完整
- 下一步：继续补第四阶段更细的账本交互 polish，优先修正倒序场景下“当日第 N 笔”的语义

## 2026-03-30（第四阶段：同日交易序号语义修正）
- 做了：先补详情页失败测试，要求默认“最新在前”时，同日多笔交易仍按真实发生顺序显示“当日第 1/2/3 笔”
- 做了：把同日序号从“当前展示下标”改为“正序账本中的日内序号”，避免倒序查看时语义颠倒
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，26 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，33 个测试全部通过
- 结论：用户在默认倒序查看账本时，看到的“当日第 N 笔”终于和真实账本顺序一致了
- 下一步：继续补第四阶段更细的账本交互 polish，优先看交易分组标题是否需要补排序方向提示

## 2026-03-30（第四阶段：日期分组标题追加日内排序提示）
- 做了：先补详情页失败测试，要求日期分组标题跟随排序切换显示“日内最新在前 / 日内最早在前”
- 做了：在日期分组标题中加入日内排序提示，减少用户把工具栏排序和分组标题分开理解的成本
- 做了：同步更新原有时间线分组测试，避免旧标题断言阻塞回归
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，27 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，34 个测试全部通过
- 做了：执行 `npm run test`，99 个单测全部通过
- 结论：日期分组标题现在不仅告诉用户是哪一天、几笔，还会明确说明这一天内部是按什么顺序展示
- 下一步：继续补第四阶段更细的账本交互 polish，优先考虑快速定位能力或关键记录高亮

## 2026-03-30（认证修复：无效 refresh token 容错）
- 做了：根据浏览器报错 `Invalid Refresh Token: Refresh Token Not Found` 回查认证初始化链路
- 做了：确认 `AuthProvider` 在 `getSession()` reject 时没有兜底，开发环境会直接打出页面级 overlay
- 做了：先补认证测试，覆盖 `getSession()` 直接 reject 时仍能回退到未登录态
- 做了：在认证初始化里补 `try/catch`，并在失败时执行一次登出清理，避免坏 token 持续污染会话恢复
- 做了：执行 `npx vitest run tests/components/auth/auth-entry.test.tsx`，3 个测试全部通过
- 做了：执行认证组件聚焦回归，8 个测试全部通过
- 做了：执行 `npm run test`，100 个单测全部通过
- 结论：浏览器里残留坏掉的 Supabase refresh token 时，页面现在会稳定回退到未登录态，不再直接炸出开发报错页
- 下一步：回到第四阶段主线，继续补账本交互可读性增强

## 2026-03-28（第四阶段：日期分组笔数摘要）
- 做了：先补详情页失败测试，覆盖日期时间线标题里的“当日几笔”摘要
- 做了：让每个日期分组标题显示为“YYYY-MM-DD · N 笔”，扫读账本时更容易快速判断当天流水密度
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：第四阶段账本时间线现在不仅按天分组，还会告诉用户每天有几笔交易，浏览密集账本时更顺手
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：同日交易序号提示）
- 做了：先补详情页失败测试，覆盖同一天内多条交易的组内序号显示
- 做了：为同日多笔记录增加“当日第 N 笔”提示，帮助用户在同一天多条买卖/分红流水里快速定位先后顺序
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：同日多笔交易现在具备更明确的组内顺序提示，账本更接近真实流水视图
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：交易主数值高亮）
- 做了：先补详情页失败测试，覆盖交易行里的金额 / 份额主数值高亮展示
- 做了：把交易日期与金额 / 份额拆成两段展示，并把金额 / 份额提升为更醒目的主信息
- 做了：修正 `tests/e2e/transaction-ledger.spec.ts` 对旧行文案的断言，让 E2E 匹配新的交易行结构
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 结论：交易记录现在会把金额 / 份额作为主信息突出展示，用户扫账本时更容易先抓到关键数字
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：交易次要信息条收紧）
- 做了：先补详情页失败测试，覆盖净值 / 手续费 / 备注的紧凑信息条展示
- 做了：把净值、手续费、备注改成圆角信息条，减少长列表里次要信息的视觉噪音
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：交易行的次要信息现在更紧凑，主次层次更清楚，长账本列表更耐看
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：关键账本影响提示高亮）
- 做了：先补详情页失败测试，覆盖卖出 / 分红影响提示的高亮样式
- 做了：把卖出、现金分红、红利再投资的影响提示改成对应颜色的信息条，让收益相关记录更容易被扫到
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：账本里最关键的收益影响提示现在更醒目，用户更容易快速扫到“卖出赚了多少 / 分红累计多少”
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：买入影响提示样式统一）
- 做了：补充详情页测试，确认买入影响提示也使用统一的高亮信息条样式
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：四类交易的账本影响提示现在都采用统一的信息条样式，页面视觉规则更一致
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：日期分组标题视觉强化）
- 做了：先补详情页失败测试，覆盖日期分组标题的强化样式
- 做了：把日期分组标题改成更明显的圆角信息条，时间线分组更容易扫读
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：账本时间线的日期分组现在更显眼，长列表里更容易快速锁定某一天的流水
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交

## 2026-03-28（第四阶段：工具栏摘要辅助标签化）
- 做了：先补详情页失败测试，覆盖工具栏摘要的辅助标签样式
- 做了：把“当前显示：筛选 / 排序 / 条数”摘要改成更弱视觉权重的圆角标签，避免与交易主内容抢焦点
- 做了：执行 `npx vitest run tests/app/fund-detail-page.test.tsx`，25 个测试全部通过
- 做了：执行聚焦回归测试 `npx vitest run tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx`，32 个测试全部通过
- 做了：执行 `npm run test`，97 个单测全部通过
- 做了：执行 `npm run test:e2e`，4 条端到端流程全部通过
- 做了：执行 `npm run build`，生产构建通过（需在沙箱外运行）
- 结论：工具栏摘要现在更像“状态提示”而不是主内容，页面视觉中心更集中在账本记录本身
- 下一步：继续补第四阶段更细的账本交互 polish，或在合适节点整理这一轮提交
