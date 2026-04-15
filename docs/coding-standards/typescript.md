# TypeScript 代码规范

## 元信息
- Language: TypeScript
- 适用角色: BE-1, FE-1, QA-1
- 更新日期: 2026-04-09

## 基础规则
1. 使用 TypeScript 严格模式（strict: true）
2. 所有函数参数与返回值必须有类型标注
3. 禁止使用 any，优先使用 unknown 或具体类型
4. 优先使用 interface 定义对象类型，type 用于联合/交叉类型
5. 使用 ES6+ 语法（async/await、箭头函数、解构）

## Next.js App Router 规则
1. 页面组件必须导出为默认函数（export default）
2. 服务端组件优先，客户端组件显式标记 'use client'
3. 使用 Server Actions 处理表单提交（避免 API Routes）
4. 动态路由使用 [param] 语法，类型标注 Params 接口

## React 规则
1. 使用函数组件 + Hooks，禁止 Class 组件
2. 自定义 Hook 以 use 前缀命名
3. Props 必须定义 interface 并导出
4. 状态管理优先使用 Context + Hooks，避免 Redux
5. 组件命名使用 PascalCase，文件名使用 PascalCase.tsx

## 样式规则
1. 使用 Tailwind CSS，避免自定义 CSS（除 globals.css）
2. 类名顺序：布局 -> 间距 -> 尺寸 -> 字体 -> 颜色 -> 其他
3. 复用样式提取为组件，避免重复类名串

## 测试规则
1. 单元测试使用 Vitest，文件名 *.test.ts / *.test.tsx
2. E2E 测试使用 Playwright，文件名 *.spec.ts
3. 测试覆盖核心业务逻辑（计算、存储、同步）
4. Mock 外部依赖（Supabase、API）

## Supabase 规则
1. 使用 @supabase/supabase-js 客户端
2. 查询优先使用 supabase.from().select() 语法
3. Auth 状态通过 useSupabase Hook 管理
4. 环境变量命名：NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## 文件组织
```
lib/
  ├── funds/        # 基金核心逻辑
  │   ├── types.ts  # 类型定义
  │   ├── *.ts      # 业务函数
  ├── auth/         # 认证逻辑
  ├── sync/         # 同步逻辑
  ├── hooks/        # React Hooks
  └── calculations/ # 计算函数
```

## 错误处理
1. 使用 try/catch 包裹 async 函数
2. 业务错误使用自定义 Error 类
3. UI 错误使用 Toast / Alert 组件展示
4. 避免静默失败，必须记录日志或展示错误

## 注释规则
1. 公共函数必须有 JSDoc 注释（描述、参数、返回值）
2. 复杂逻辑必须有行内注释说明意图
3. TODO 注释必须标注日期与责任人
4. 避免无用注释（如重复代码逻辑）

## 禁止事项
❌ 禁止 console.log（开发完成后删除）
❌ 禁止未处理的 Promise rejection
❌ 禁止硬编码环境变量值
❌ 禁止未类型化的 Props
❌ 禁止直接修改 state（必须使用 setState）