# Vue 3 企业级前端通用开发规范

## 1. 适用范围

- **角色**: 前端开发工程师 (FE)
- **技术栈基线**: Vue 3 (Composition API) + TypeScript + Vite + NPM

---

## 2. 总体工程原则

为了保证代码的可维护性和单向数据流，严格执行以下依赖方向及职责：

- **依赖方向**: `Views (页面) -> Components (组件) -> API Service (接口) -> Utils (工具) -> Store (状态)`。
  - _禁止反向依赖_：例如 `utils` 不允许引入 `store`，`components` 不允许直接调用 `views` 的方法。
- **职责边界**:
  - **Views (页面层)**: 最薄的一层。负责响应路由参数、组合业务逻辑（Composables）、管理页面级状态。
  - **Components (组件层)**: 只负责 UI 展示与交互。`Props` 入，`Emits` 出。
  - **Composables (逻辑层)**: 提取可复用的业务逻辑、副作用处理。
  - **API Service (数据层)**: 唯一出口，执行请求拦截、响应脱壳及类型定义。
  - **Store (状态层)**: 仅存放**跨页面**、**全局级**的状态。
  - **Utils (工具层)**: 纯函数，处理时间、字符串等，严禁包含任何业务词汇。

---

## 3. 目录级规范

推荐采用基于功能的模块化结构，避免逻辑堆积在入口文件。

```text
src/
  ├── api/           # 接口声明（按业务领域/领域模型拆分文件）
  ├── assets/        # 静态资源（图片、全局样式）
  ├── components/    # 公共组件（跨页面复用的 UI）
  ├── composables/   # 全局逻辑 Hooks
  ├── store/         # 全局状态管理 (Pinia)
  ├── utils/         # 纯工具函数（严禁包含业务逻辑）
  └── views/         # 页面（按功能模块组织）
      └── UserProfile/
          ├── components/ # 页面私有组件
          ├── hooks/      # 页面私有逻辑
          └── index.vue   # 页面入口
```

---

## 4. 编码实践规范

### 4.1 脚本编写 (Setup)

- **统一使用 `<script setup>`**: 禁止使用 Options API。
- **TypeScript 强约束**: 禁止使用 `any`。所有 Props、Emits 及响应式对象必须显式定义类型或接口。

### 4.2 组件设计

- **Props 显式声明**: 必须带 `type` 和 `default` (或 `required`)。
- **业务无关性**: 通用组件层 (`src/components/`) 不包含具体业务流程判断（如权限分支、路由跳转）。

```ts
// 推荐示例
interface Props {
  loading?: boolean;
  itemList: string[];
}
const props = withDefaults(defineProps<Props>(), {
  loading: false,
  itemList: () => [],
});
```

### 4.3 API 数据交互

- **统一出口**: 禁止在 `.vue` 或 `composables` 中直接使用 `axios/fetch`。
- **类型化响应**: 接口定义应包含请求体与响应体的 TypeScript interface。

### 4.5 样式处理

- **规范方案**: 推荐使用局部作用域样式装饰 (`<style scoped>`)。
- **变量管理**: 复杂样式应提取为 SCSS/CSS 变量。
- **命名规范**: 遵循语义化命名，禁止拼音或无意义缩写。

---

## 5. 错误处理与日志

- **用户感知**: 前端异步操作必须包含统一的用户提示（Message/Toast）。
- **防御性编程**: 对后端返回数据、第三方库调用需做空值保护。
- **日志标准**: 开发环境必须保留 `console.error` 以便调试，生产环境严禁泄露敏感逻辑。

---

## 6. Review 质量红线 (Rejected)

1. **Any 滥用**: 无正当理由出现 `any` 类型。
2. **逻辑穿透**: 在 `utils` 中发现业务逻辑（如调用 API 或引入 Store）。
3. **结构臃肿**: 单个 `.vue` 文件逻辑（Script 部分）超过 500 行（应拆分为 Composables 或子组件）。
4. **硬编码**: 魔法数字或魔术字符串未提取为 Constants。
5. **接口散乱**: 未通过统一的 API 模块调用接口。

---
