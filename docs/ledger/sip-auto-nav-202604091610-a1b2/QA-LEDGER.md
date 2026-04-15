# QA LEDGER

## 元信息
- FeatureId: sip-auto-nav-202604091610-a1b2
- Owner: QA-1
- 创建日期: 2026-04-09
- 最近更新: 2026-04-09（复验）

## QA 验收记录
| LedgerId | Stage | Item | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| Q1 | QA | npm run test | PASSED | npm run test → 2 files, 11 tests passed | 单元测试已补齐，BUG-b7d2e9f8 已修复 |
| Q2 | QA | npm run build | PASSED | npm run build → 成功 | 无编译错误 |
| Q3 | QA | 历史净值 API 验证 | PASSED | nav-cache.ts 调用 fetchHistoricalNav；data-source.ts 新增历史净值抓取 | BUG-a49ec5f4 已修复 |
| Q4 | QA | 15点前后净值日期计算 | PASSED | tests/lib/hooks/use-auto-nav.test.ts 6 tests passed | before_1500 / after_1500 边界通过 |
| Q5 | QA | 净值获取失败降级提示 | PENDING | 需运行时验证 | UI 已实现，需测试实际场景 |

## 缺陷清单
| BugId | Severity | Description | Status | AssignedTo |
| --- | --- | --- | --- | --- |
| 2026-04-09-BUG-a49ec5f4 | P1 | 净值获取返回实时估算而非历史净值 | FIXED | BE-1 |
| 2026-04-09-BUG-b7d2e9f8 | P2 | 缺少单元测试 | FIXED | BE-1 |

## 缺陷修复任务
- 2026-04-09-BE-4c521fa9: docs/tasks/sip-auto-nav-202604091610-a1b2/completed/2026-04-09-BE-4c521fa9-done.md

## 变更记录
- 2026-04-09 QA-1 创建 QA-LEDGER，记录验收结果与缺陷
- 2026-04-09 QA-1 复验 BE 修复：历史净值 API 与单元测试问题已修复，测试与构建通过
