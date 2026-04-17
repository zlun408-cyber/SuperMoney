# Accuracy Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接通 accuracy 登录态双路径读写：Auth 初始化时合并本地与云端 accuracy 数据，运行期通过统一 accuracy store 读写本地与云端。

**Architecture:** 保持 localStorage 作为前端同步缓存层，避免现有 dashboard/detail/hook 全部改成异步读取。新增 `accuracy-store` adapter 统一 snapshots / decisions 的 load/save/merge 语义；AuthProvider 在用户登录后初始化 store，把 local + cloud 合并后同时落本地和云端；业务组件只依赖 store，不直接碰具体 local/cloud 实现。

**Tech Stack:** TypeScript, React Context, Vitest, Supabase JS

---

### Task 1: Accuracy store adapter

**Files:**
- Create: `lib/accuracy/accuracy-store.ts`
- Test: `tests/lib/accuracy/accuracy-store.test.ts`

- [ ] Step 1: 写红测，覆盖 local store 行为、authenticated store 的 snapshot/decision merge、登录态写入双写语义
- [ ] Step 2: 跑红测确认失败原因是模块缺失
- [ ] Step 3: 写最小实现
- [ ] Step 4: 跑 adapter 测试确认变绿

### Task 2: Auth initialization integration

**Files:**
- Modify: `lib/auth/types.ts`
- Modify: `lib/auth/auth-context.tsx`
- Test: `tests/lib/auth/auth-context.test.tsx`

- [ ] Step 1: 写红测，覆盖 AuthProvider 登录后初始化 accuracy store、登出回退 local store
- [ ] Step 2: 跑红测确认失败原因是 context 未暴露 accuracyStore / 未初始化
- [ ] Step 3: 写最小实现
- [ ] Step 4: 跑 auth context 测试确认变绿

### Task 3: Route hook and views through accuracy store

**Files:**
- Modify: `lib/hooks/use-fund-quotes.ts`
- Modify: `components/fund/fund-detail-content.tsx`
- Modify: `components/accuracy/accuracy-dashboard.tsx`
- Modify: `app/page.tsx`
- Test: `tests/lib/hooks/use-fund-quotes.test.tsx`
- Test: `tests/components/fund/fund-detail-content.test.tsx`
- Test: `tests/components/accuracy/accuracy-dashboard.test.tsx`
- Test: `tests/app/home-page.test.tsx`

- [ ] Step 1: 写/扩展红测，覆盖 authenticated accuracy store 注入与读写路径
- [ ] Step 2: 跑红测确认失败原因是组件/Hook 仍直连 local storage
- [ ] Step 3: 写最小实现，把调用方切到 accuracyStore
- [ ] Step 4: 跑受影响测试确认变绿

### Task 4: Focused verification

**Files:**
- Verify only

- [ ] Step 1: 跑新增 adapter/auth/store tests
- [ ] Step 2: 跑受影响 hook/component 全量 tests
- [ ] Step 3: 跑 `npm test`
