# PM_REQUIREMENTS

## 元信息
- FeatureId: sip-execution-replay-20260409200801-kr33
- 短名: 定投执行记录与交易重放边界
- Owner: PM
- Status: Design-Pending
- PRD/来源路径: docs/requirements/stage4-ledger-readability-20260409160729-abc1/PM_REQUIREMENTS.md#L42, NEXT_STEPS.md:44
- 创建日期: 2026-04-09

## 背景与目标
- 背景: 现有定投计划已支持自动生成交易记录与基础去重，但对补单/漏单重放、删除已生成交易后的再生成、同日多计划并发执行的边界仍缺乏稳定语义。
- 业务目标: 为定投计划引入最小执行记录模型，明确“应执行 / 已生成 / 用户跳过”的状态边界，避免重复生成与错误补回。
- 成功指标: 三类目标场景的规则可被明确设计、实现后可被 QA 稳定验证，不再依赖交易结果反推执行事实。

## 范围定义
- Scope:
  - 定义定投 execution record 的最小数据模型与状态机
  - 覆盖补单/漏单重放规则
  - 覆盖用户删除自动生成交易后的状态迁移与不补回规则
  - 覆盖同日多计划冲突下的独立执行边界
  - 明确定投执行记录与现有 `sipPlans`、`transactions`、云端同步的关系
- Out of Scope:
  - 恢复 UI / 手工重新激活某次 skipped 执行
  - 复杂审计后台或批量运维工具
  - 更广义的多端冲突与登录切换一致性治理

## 用户故事
1. 作为用户，我希望系统能补回因为异常漏掉的应执行定投，而不是静默丢失。
2. 作为用户，我删除一笔定投自动生成交易后，系统不应在下次重放时偷偷再生成。
3. 作为用户，我在同一天配置多个定投计划时，系统应独立处理每个计划，不互相覆盖或误判冲突。

## 需求明细
- 功能点:
  - execution record 最小模型：`pending / generated / skipped`
  - 唯一执行键建议覆盖 `planId + executionDate`
  - `pending` 且缺少关联交易时允许补放
  - 自动生成交易被用户删除后，记录转为 `skipped`
  - `skipped` 状态后续不自动补回
  - 同日多个计划按计划维度独立生成，不以“同基金同日仅一笔”为冲突原则
- 非功能要求（性能/安全/兼容等）:
  - 必须兼容现有 `sip_plan` 自动生成链路
  - 不得破坏已存在的 `source = sip_plan` 交易语义
  - 设计必须考虑本地与 Supabase 持久化边界

## 验收标准（AC）
- AC-1: ARCH 明确定义 execution record 的最小字段、唯一键与状态迁移图
- AC-2: ARCH 明确补单/漏单重放的判定规则与触发条件
- AC-3: ARCH 明确用户删除自动生成交易后的处理规则，且结论为“不自动补回”
- AC-4: ARCH 明确同日多计划场景下的独立执行规则与冲突定义
- AC-5: 设计可直接支撑后续 BE/FE/QA 任务拆分

## 设计输入需求
- 必须输出的设计结论:
  - execution record 数据结构
  - execution record 与 transactions/sipPlans 的关系
  - 三类边界场景的状态迁移规则
  - 是否纳入云端持久化与如何兼容现有 Supabase 结构
  - 风险与缺口说明
- 依赖或约束:
  - 复用现有 `lib/funds/sip-plans.ts` 自动生成逻辑
  - 复用现有 `source = sip_plan` 交易模型
  - 与 `sip-auto-nav-202604091610-a1b2` 完成后的净值自动获取链路兼容
- 原型/素材路径: docs/requirements/sip-execution-replay-20260409200801-kr33/assets/
- HTML 列表文件路径（可口述/外部）: N/A

## 依赖与风险
- 依赖:
  - `docs/design/sip-auto-nav-202604091610-a1b2/design-spec.md`
  - `lib/funds/sip-plans.ts`
  - `lib/funds/types.ts`
  - `lib/sync/cloud-watchlist.ts`
- 风险:
  - 若 execution record 设计过重，会引入超出本次 Feature 的同步复杂度
  - 若继续依赖交易结果推断执行事实，仍会重复出现边界不清问题

## 未决问题（TBD）
- Q1: execution record 是否在本次就进入 Supabase 持久化，还是先本地模型落地再扩展云端？
- Q2: 同日多个计划若金额/频率相同，是否需要额外的人类可读冲突提示？

## 变更记录
- 2026-04-09 创建 Feature，聚焦定投计划交易生成边界
