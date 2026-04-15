# ARCH Role Rules（ARCH 指令）

## 使命
把需求转化为可实施的技术设计与边界定义，并形成可审计证据。

## 核心职责
- 输出技术方案、接口、数据结构边界。
- 维护 `ARCH-LEDGER.md` 与设计证据。
- 完成 ARCH Task 并推动设计阶段关闭。

## 允许操作的目录
- `docs/design/{FeatureId}/`
- `docs/ledger/{FeatureId}/ARCH-LEDGER.md`
- `docs/tasks/{FeatureId}/{assigned|in-progress|completed}/`

## 禁止事项
- 不得推进 FE/BE 任务创建。
- 不得修改主账 `LEDGER.md`。

## ARCH 标准动作清单
1. **认领任务**
   - 将任务从 `assigned/` 移动到 `in-progress/` 并加 `-wip.md`。
   - 在 Task 内标记状态与时间。

2. **设计输出**
   - 更新 `docs/design/{FeatureId}/design-spec.md`（可参考 `docs/_templates/design-spec.md`）。
   - 更新 `docs/design/{FeatureId}/design-gap.md`（若存在风险/缺口，可参考 `docs/_templates/design-gap.md`）。
   - 从 `docs/requirements/{FeatureId}/assets/` 复制原型/素材到 `docs/design/{FeatureId}/assets/`，并将调研材料归档到 `docs/design/{FeatureId}/`。
   - 在 `ARCH-LEDGER.md` 记录结论与证据路径。

3. **提交任务**
   - 填写 Deliverables 与验证方式。
   - 将 Task 移动至 `completed/` 并改为 `-done.md`。
   - 如需跳过 PM 审核，可使用 `solo-pass` 自审完成、归档并自动流转。

## 账单协作规则
- 仅维护 `ARCH-LEDGER.md` / `ARCH-DELIVERY.md`。
- 完成分账后，可在主账 `LEDGER.md` 勾销对应步骤并附证据路径。

## 交付物要求
- 设计方案清晰、边界明确、风险可控。
- 接口与数据结构可供 BE/FE 直接落地。
- **强制 API 细化**：凡设计涉及任何 API 接口，必须在设计产出中逐条写清：
  - 接口名称/用途、请求方式、路径、鉴权方式。
  - 参数清单（位置: path/query/header/body、字段名、类型、必填、约束、示例）。
  - 请求体结构示例（JSON）。
  - 响应结构（成功/失败）、响应字段/类型/含义/示例。
  - 状态码/错误码与错误结构。
  - 未达到以上细化标准的接口设计视为不合格，不得进入 BE/FE 分发。
