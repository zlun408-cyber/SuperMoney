# React 企业级前端通用开发规范

## 1. 适用范围

- **角色**: 前端开发工程师 (FE)
- **技术栈基线**: React 18+ (Functional Components) + TypeScript + NPM

---

## 2. 通用架构原则

- **单一职责**: 组件聚焦单一功能。复杂页面遵循“容器组件 (Container) / 展示组件 (Presentational)”或“业务 Hook / 视图组件”拆分原则。
- **类型优先**: 所有 Props、State、Context、API 响应必须显式定义 TypeScript 类型。**严禁使用 `any`**。
- **声明式编程**: 优先通过数据驱动 UI 状态，避免直接操作 DOM。
- **单向数据流**: 状态下发通过 Props，状态变更通过回调函数或专门的状态管理库。

---

## 3. 目录与命名规范

推荐采用基于功能的模块化结构，提高代码内聚性：

```text
src/
  ├── api/           # 原始请求定义（按业务领域划分）
  ├── components/    # 全局公共组件（Button, Modal, Table 等）
  ├── constants/     # 全局常量、枚举、配置
  ├── hooks/         # 全局通用自定义 Hooks (如 useWindowSize)
  ├── store/         # 全局状态管理 (Zustand / Redux / Context)
  ├── utils/         # 纯工具函数（严禁包含业务词汇或 API 调用）
  └── pages/         # 路由页面
      └── OrderModule/
          ├── components/ # 页面私有组件
          ├── hooks/      # 页面私有业务逻辑 (useOrderList)
          ├── services/   # 数据转换/清洗逻辑 (DTO to VO)
          └── index.tsx   # 页面入口
```

### 命名细节：

- **组件/页面**: PascalCase，如 `OrderList.tsx`。
- **Hooks**: `use` 开头的小驼峰，如 `useAuth.ts`。
- **普通文件**: kebab-case（小写连字符），如 `date-formatter.ts`。
- **常量**: 全大写蛇形命名，如 `MAX_RETRY_COUNT`。

---

## 4. 组件与 Hooks 约束

- **函数式组件 (SFC)**: 必须使用函数组件，禁止新增 Class 组件。
- **Props 定义**: 必须使用 `interface` 或 `type` 显式声明，并对可选属性设置默认值。
- **逻辑抽离**: 页面或组件中的复杂业务逻辑（如表单校验、复杂计算、多个 Effect 组合）必须抽离为自定义 Hooks。
- **Effect 纯净性**: `useEffect` 必须明确声明依赖项。严禁在 Effect 中通过闭包直接修改外部变量，必须提供清理函数 (Cleanup) 处理副作用。
- **性能优化**: `useMemo` 与 `useCallback` 应在**性能瓶颈明确**或**作为其他 Hook 依赖项**时使用，避免过度封装。

---

## 5. 状态管理规范

- **状态分类**:
  - **局部状态 (Local State)**: 简单、不跨组件的状态使用 `useState/useReducer`。
  - **全局状态 (Global State)**: 跨多页面共享的状态（用户信息、全局配置）使用统一状态管理方案。
  - **服务器状态 (Server State)**: 接口数据建议使用请求库（如 React Query / SWR）管理缓存、Loading、Empty 和 Error 状态。
- **禁止状态冗余**: 能通过 Props 或现有 State 计算得出的派生属性，严禁存入新的 State。

---

## 6. API 与数据流

- **API 封装层**: 禁止在组件中直接写死 URL 或调用底层请求工具（如 axios）。所有请求必须定义在 API/Service 层。
- **数据映射 (DTO to VO)**:
  - 严禁在视图层直接消费后端原始响应对象（DTO）。
  - 应在 Service 层将 DTO 转换为前端视图模型（ViewModel/VO），处理默认值缺失、字段不一致等问题。
- **异步处理**: 异步操作必须完整覆盖 `Loading`（加载中）、`Empty`（空数据）、`Error`（错误）三种状态。

---

## 7. 样式规范

- **一致性**: 项目内必须统一种样式方案（如 CSS Modules / Tailwind CSS / CSS-in-JS）。
- **变量化**: 颜色、间距、字号等必须引用全局定义的变量，禁止硬编码颜色值。
- **动态样式**: 复杂动态样式优先使用 `clsx` 或 `classnames` 管理类名，禁止在模板中手动拼接复杂的字符串。

---

## 8. Review 质量红线 (Rejected)

1. **Any 滥用**: 无正当理由出现 `any` 类型。
2. **逻辑穿透**: 在 `utils` 中发现业务逻辑（如调用 API 或引入 Store）。
3. **模板臃肿**: JSX 模板中包含极其复杂的逻辑判断或过深的 `map` 嵌套。
4. **硬编码**: 魔法数字、API 路径或业务文案未提取至常量。
5. **副作用失控**: `useEffect` 缺少依赖项或未清理定时器/订阅。

---
