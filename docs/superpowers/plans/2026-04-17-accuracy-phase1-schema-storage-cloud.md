# Accuracy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 estimate accuracy Phase 1：新增 Supabase schema、抽离 adjustment decision storage、补齐 cloud-accuracy.ts 接口与映射。

**Architecture:** 保持 accuracy 领域“原始事实 + 规则计算”分层不变。先把本地 decision 存储从 policy 计算文件中解耦，再新增独立 cloud-accuracy client，最后补一个独立的 `supabase/accuracy-sync.sql` migration，与现有 stage3 四表解耦。

**Tech Stack:** TypeScript, Vitest, Supabase JS, PostgreSQL SQL migration

---

### Task 1: Decision storage abstraction

**Files:**
- Create: `lib/storage/estimate-adjustment-storage.ts`
- Modify: `lib/funds/estimate-adjustment-policy.ts`
- Test: `tests/lib/storage/estimate-adjustment-storage.test.ts`

- [ ] Step 1: 写 `estimate-adjustment-storage` 红测，覆盖 load/save、legacy normalize、异常 payload 过滤、事件派发
- [ ] Step 2: 跑红测确认失败原因是模块/函数缺失
- [ ] Step 3: 写最小实现并把 policy 中的 storage 常量/加载逻辑抽走
- [ ] Step 4: 重新跑 storage 与 policy 相关测试，确认变绿

### Task 2: Cloud accuracy client

**Files:**
- Create: `lib/sync/cloud-accuracy.ts`
- Test: `tests/lib/sync/cloud-accuracy.test.ts`

- [ ] Step 1: 写 `cloud-accuracy` 红测，覆盖 snapshots / decisions 的 list/upsert 映射与缺表兼容
- [ ] Step 2: 跑红测确认失败原因是模块/函数缺失
- [ ] Step 3: 写最小实现
- [ ] Step 4: 跑 cloud-accuracy 相关测试确认变绿

### Task 3: Accuracy schema migration

**Files:**
- Create: `supabase/accuracy-sync.sql`
- Test: `tests/supabase/accuracy-sync-sql.test.ts`

- [ ] Step 1: 写 SQL 结构红测，覆盖两张表、约束、索引、RLS policy、trigger 名称
- [ ] Step 2: 跑红测确认失败原因是 migration 文件缺失
- [ ] Step 3: 写最小 SQL migration
- [ ] Step 4: 跑 SQL 结构测试确认变绿

### Task 4: Focused verification

**Files:**
- Verify only

- [ ] Step 1: 运行本轮新增/修改的 focused tests
- [ ] Step 2: 运行 `npm test` 或至少覆盖受影响测试集合
- [ ] Step 3: 记录实际完成项与剩余未集成项
