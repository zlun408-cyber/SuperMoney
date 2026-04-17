# SuperFinance 项目索引

## 元信息
- Project: superfinance
- ProjectRoot: `/Users/zhanglun/Desktop/SuperFinance`
- 创建日期: 2026-04-09
- 状态: 开发中（estimate accuracy baseline 已落地，进入高阶 accuracy iteration）

## 项目概述
基金实时估值网站，以自选基金列表监控为核心，逐步升级到由交易记录驱动的持仓与收益展示，并通过 estimate accuracy baseline 追踪估值可信度。

## 技术栈
- **前端框架**: Next.js 16.2.1 (App Router) + TypeScript
- **样式方案**: Tailwind CSS
- **认证与存储**: Supabase (PostgreSQL + Auth)
- **测试**: Vitest (单元测试) + Playwright (E2E)
- **数据源**: 外部基金估值 API

## 重要运维/落地文档
- `docs/project/superfinance/docs/supabase-rollout-checklist.md`: Supabase SQL 执行与验收清单
- `docs/project/superfinance/docs/supabase-production-acceptance-runbook.md`: Supabase 线上落地最小执行 Runbook
- `docs/superpowers/specs/2026-04-17-estimate-accuracy-export-sync-adr.md`: estimate accuracy 样本导出与云端留存 ADR 草案

## 主要目录结构
```
SuperFinance/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 监控首页
│   ├── accuracy/          # 估值准确度内部看板
│   ├── layout.tsx         # 全局布局
│   ├── globals.css        # 全局样式
│   ├── fund/[code]/       # 基金详情页
│   └── api/funds/         # API 路由（quote/search/nav）
├── components/            # UI 组件
├── lib/                   # 业务逻辑层
│   ├── auth/             # 认证（auth-context.tsx, types.ts）
│   ├── storage/          # 本地存储（watchlist-storage.ts, estimate-accuracy-storage.ts）
│   ├── sync/             # 云端同步（cloud-watchlist.ts）
│   ├── funds/            # 基金核心逻辑
│   │   ├── types.ts      # 类型定义
│   │   ├── transactions.ts # 交易记录管理
│   │   ├── sip-plans.ts  # 定投计划
│   │   ├── data-source.ts # 数据源接入
│   │   ├── estimate-accuracy.ts # 估值准确度基线与可信度计算
│   │   └── search.ts     # 基金搜索
│   ├── calculations/     # 计算逻辑（profit-loss.ts）
│   ├── hooks/            # React Hooks（use-watchlist, use-fund-quotes）
│   └── supabase/         # Supabase 客户端
├── tests/                 # 测试文件
├── docs/superpowers/      # 设计文档与实现计划
│   ├── specs/            # 设计文档
│   └── plans/            # 实现计划
├── supabase/              # Supabase 建表 SQL
├── scripts/               # 脚本工具
└── PROJECT_STATUS.md      # 项目状态（独立状态文件）
```

## 核心业务模块
### 1. 监控首页（app/page.tsx）
- 自选基金列表展示
- 分钟级估值刷新
- 持仓盈亏计算
- 搜索添加基金

### 2. 基金详情页（app/fund/[code]/page.tsx）
- 单基金估值与涨跌展示
- 交易记录录入与列表
- 收益拆分卡片
- 定投计划管理

### 3. 交易记录系统（lib/funds/transactions.ts）
- 四类交易：买入、卖出、现金分红、红利再投资
- 支持 placed/effective 双日期结构
- FIFO 成本计算
- 来源标记（manual / sip_plan）

### 4. 定投计划（lib/funds/sip-plans.ts）
- 定投计划 CRUD
- 自动生成交易记录
- execution record（pending / generated / skipped）
- 云端持久化
- 状态管理（active/paused/ended）

### 5. 认证与同步（lib/auth/, lib/sync/）
- Supabase Auth 集成
- 登录态云端优先
- 未登录本地存储
- 冲突选择机制

### 6. 估值准确度（lib/funds/estimate-accuracy.ts, components/accuracy/）
- 本地 estimate accuracy snapshots 采集、收敛与聚合
- 基金详情页 estimate confidence panel 展示可信度、收敛样本与平均绝对误差
- `/accuracy` 内部看板按基金汇总总样本、已收敛样本与平均误差
- E2E 覆盖 localStorage 种数后的 dashboard 指标与 fund row 可见性

## 数据模型（核心类型）
见 `lib/funds/types.ts`:
- `FundTransaction`: 交易记录（支持新旧结构）
- `SipPlan`: 定投计划
- `TransactionLedgerSummary`: 账本汇总
- `FundQuote`: 基金估值
- `FundSearchResult`: 基金搜索结果
- `EstimateAccuracySnapshot` / `EstimateAccuracySummary`: 估值准确度样本与汇总

## 开发阶段
| 阶段 | 名称 | 状态 |
| --- | --- | --- |
| 第一阶段 | 监控主线 MVP | ✅ 完成 |
| 第二阶段 | 交易记录 + FIFO | ✅ 完成 |
| 第三阶段 | 登录与云同步 | ✅ 完成 |
| 第四阶段 | 交易账本可读性增强 | ✅ 基线完成 |
| Accuracy baseline | 估值准确度基线 / 可信度面板 / 准确度看板 | ✅ 完成，进入高阶迭代 |

## 关键约束
- 前端框架：必须使用 Next.js App Router
- 认证方案：必须使用 Supabase Auth
- 数据存储：云端 Supabase，本地 localStorage
- 计算逻辑：FIFO 成本计算优先
- 状态管理：React Hooks + Context

## 测试命令
- 单元测试：`npm run test`
- E2E 测试：`npm run test:e2e`
- 准确度看板聚焦 E2E：`npm exec -- playwright test tests/e2e/estimate-accuracy-dashboard.spec.ts`
- 构建：`npm run build`

## 环境变量
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 旧状态文件（迁移前）
- `PROJECT_STATUS.md`: 项目当前状态
- `WORKLOG.md`: 工作日志
- `NEXT_STEPS.md`: 下一步计划
- `SESSION_RESUME.md`: 会话恢复说明
