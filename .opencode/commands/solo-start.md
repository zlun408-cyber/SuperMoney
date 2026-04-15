---
description: Initialize the single-player multi-character collaboration space and rule loading, ensuring that the correct context is entered.
---
# /solo-start

目标：初始化单人多角色协作空间与规则加载，确保 PM/ARCH/BE/FE/QA 进入正确上下文。

## 需要的参数（可选）
- role：PM | ARCH | BE | FE | QA。默认使用 PM。
- feature_id：已有需求时填写；未提供则自动扫描/复用或由 PM 生成。
- prd_path：PRD 路径（本地路径或文档链接）。
- design_assets：原型/HTML 设计图路径。
- project：项目代号，对应 `docs/project/{project}/docs`。
- project_path：存量项目根目录（仅用于生成沉淀索引，不复制源码）。
- team：项目团队配置（可选），建议格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`。
- extra_roles：附加预加载角色（可选，逗号分隔），例如 `ARCH,BE`。

## 执行步骤（严格按顺序）
1. 读取规则索引：`docs/SPACE_INDEX.md`
2. 读取全局规则：`docs/framework/core_rules.md`
3. 读取角色规则：`docs/framework/<ROLE>.md`
   - 默认只加载 PM；若需其它角色，在对话中说明或通过 `extra_roles` 指定。
4. 读取任务流转：`docs/tasks/README.md`
5. 项目沉淀加载：
   - 若提供 `project`：加载 `docs/project/{project}/docs/*`
   - 若未提供 `project`：
     - 先识别项目候选：
       - 旧路径：`docs/project/docs`（即使为空也算一个候选，需提示迁移）
       - 项目目录：`docs/project/<name>/docs` 存在即算一个候选
       - 项目根：`docs/project/<name>/` 存在但缺少 `docs/` 也算候选（提示可初始化）
      - 若候选仅 1 个，自动选择该项目
      - 若候选多个，要求用户选择
      - 若无候选，提示是否新项目并要求提供 `project`
    - 校验项目团队定义：读取 `docs/project/{project}/docs/team.md`（兼容 `docs/project/docs/team.md`）；缺失则提示先补齐团队角色与人数。
    - PM 确认团队后，自动生成 `docs/project/{project}/docs/team-members.md` 团队成员列表。
6. 需求扫描与状态提示（PM 优先）：
   - 直接匹配需求文件：
     - `docs/requirements/*/PM_REQUIREMENTS.md`
     - 兼容：`docs/requirements/*/PM_REQUIREMENT.md`
   - 以需求文件父目录作为 FeatureId
   - 若无需求：询问需求地址或口述
   - 若存在需求：
     - 检查是否已有对应 `docs/ledger/{FeatureId}/LEDGER.md`
     - 若无 LEDGER：提示“需求未进入流转，是否开始？”
     - 若有 LEDGER：输出当前阶段状态并请求确认是否继续
7. 如提供或识别到 `feature_id`，加载：
   - `docs/ledger/{FeatureId}/LEDGER.md`
   - `docs/ledger/{FeatureId}/DELIVERY.md`
   - `docs/requirements/{FeatureId}/PM_REQUIREMENTS.md`
   - `docs/design/{FeatureId}/design-spec.md`（若存在）

## 项目沉淀初始化规则
- 若 `docs/project/{project}/docs` 为空：
  - 先询问是否为新项目。
  - 若用户给出存量项目并提供 `project_path`：
    - 扫描目录结构与关键文件（仅总结，不复制源码）。
    - 生成 `docs/project/{project}/docs/index.md`，包含：
      - ProjectRoot: `<project_path>`
      - 主要目录与模块摘要
      - 关键技术栈与约束
    - 若缺少 `framework.md` / `bugs.md` / `team.md` / `team-members.md`，创建占位文件。
  - 若用户确认新项目：
    - 创建 `docs/project/{project}/docs/index.md` 标记项目目录（空或 `TBD`）。
    - 创建 `framework.md` / `bugs.md` / `team.md` / `team-members.md` 占位。

## 输出要求
- 列出已加载文件清单
- 明确当前角色可执行动作与禁止事项
- 给出下一步 1-3 条建议
- 如缺少必要输入，直接提出需要补充的字段
- PM 场景下，给出需求状态与是否启动的确认问题

## 注意
- 未经明确授权，不自动创建/修改文件。
- 模板目录仅在用户要求创建任务时使用。
- FeatureId 只能由 PM 生成一次，其它角色必须复用。
- 所有动作不得影响仓库外部状态流转。
