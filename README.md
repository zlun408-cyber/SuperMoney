# SuperFinance - 基金实时估值监控

基于 Next.js 的基金自选监控工具，分钟级查看基金估值、持仓与估算盈亏。

## 功能特性

- **自选基金列表** - 添加/管理关注的基金，分钟级刷新估值数据
- **交易记录管理** - 记录买卖交易，自动计算持仓成本与收益
- **定投计划 (SIP)** - 支持定投计划管理，自动计算定投份额
- **估值准确度看板** - 查看基金估值与实际净值偏差分析
- **数据同步** - 登录后支持云端同步，换设备也能继续使用

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Hooks
- **数据存储**: Supabase (云端同步) + LocalStorage (本地)
- **测试**: Vitest + Playwright

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# E2E 测试
npm run test:e2e
```

## 一键部署

默认部署到当前生产服务器，并用 PM2 重启 `superfinance`：

```bash
npm run deploy
```

脚本会自动执行：

1. 本地生产构建校验：`npm run build`
2. 同步代码到服务器：`/opt/superfinance`
3. 服务器安装依赖：`npm ci`
4. 服务器生产构建：`npm run build`
5. 精简生产依赖：`npm prune --omit=dev`
6. 重启 PM2 服务：`superfinance`
7. 检查公开域名：`https://www.cofundonline.com/`

可选配置：

```bash
# 部署前额外跑测试
RUN_TESTS=1 npm run deploy

# 首次部署新服务器时，把本地 .env.local 一起同步过去
SYNC_ENV=1 npm run deploy

# 修改目标服务器或域名
DEPLOY_HOST=124.243.149.183 \
DEPLOY_USER=root \
DEPLOY_DIR=/opt/superfinance \
SSH_KEY=/Users/zhanglun/Downloads/demo-zhanglun.pem \
HEALTH_URL=https://www.cofundonline.com/ \
npm run deploy
```

默认不会同步 `.env.local`，避免覆盖服务器环境配置；如果服务器缺少 `.env.local`，脚本会提示使用 `SYNC_ENV=1` 执行一次。

## 项目结构

```
app/                  # Next.js App Router 页面
  accuracy/           # 估值准确度看板
  api/                # API 路由
  fund/               # 基金详情页
components/           # React 组件
  accuracy/           # 估值相关组件
  auth/               # 认证组件
  fund/               # 基金相关组件
  watchlist/          # 自选列表组件
lib/
  funds/              # 基金核心逻辑
  hooks/              # React Hooks
  storage/            # 存储层
  sync/               # 同步逻辑
  supabase/           # Supabase 配置
tests/                # 测试文件
  app/                # 页面测试
  components/         # 组件测试
  e2e/                # 端到端测试
  lib/                # 工具函数测试
```

## 许可证

Private - 仅供个人使用
