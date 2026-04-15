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
