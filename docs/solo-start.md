---
description: Initialize the single-player multi-character collaboration space and rule loading, ensuring that the correct context is entered.
---
# /solo-start 使用说明

> 目的：初始化单人多角色协作空间与规则加载，确保进入正确上下文。

## 快速开始
```bash
/solo-start
```

## 参数
- `role`（可选）：PM | ARCH | BE | FE | QA。默认 `PM`。
- `feature_id`（可选）：已有需求时填写；未提供则自动扫描/复用或由 PM 生成。
- `prd_path`（可选）：PRD 路径（本地路径或文档链接）。
- `design_assets`（可选）：原型/HTML 设计图路径，或 HTML 列表文件路径（建议存放到 `docs/requirements/{FeatureId}/assets/`）。
- `project`（可选）：项目代号，对应 `docs/project/{project}/docs`。
- `project_path`（可选）：存量项目根目录（仅用于生成沉淀索引，不复制源码）。
- `team`（可选）：项目团队配置，建议格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`。
- `extra_roles`（可选）：需要预加载的附加角色（逗号分隔），例如 `ARCH,BE`。

## 典型用法
```bash
/solo-start
/solo-start project=global-kit project_path=docs/project/global-kit
/solo-start project=ai-solo feature_id=obs-download-test-20260128153045-a1b2 prd_path=/path/to/prd.md
```

## 执行流程（按顺序）
1. 读取规则索引：`docs/SPACE_INDEX.md`
2. 读取全局规则：`docs/framework/core_rules.md`
3. 读取角色规则：`docs/framework/<ROLE>.md`
   - 默认仅加载 PM 规则；若需要加载其它角色，在对话中明确说明或通过 `extra_roles` 指定。
4. 读取任务流转：`docs/tasks/README.md`
5. 加载项目沉淀：
    - 若提供 `project`：加载 `docs/project/{project}/docs/*`
   - 若未提供：
     - 识别项目候选：
       - 旧路径 `docs/project/docs`
       - `docs/project/<name>/docs`
       - `docs/project/<name>/`（缺少 docs 视为候选）
      - 仅 1 个候选则自动选择
      - 多个候选要求选择
      - 无候选提示是否新项目并要求 `project`
   - 校验项目团队定义：读取 `docs/project/{project}/docs/team.md`（兼容 `docs/project/docs/team.md`）；缺失则提示先补齐团队角色与人数。
   - PM 确认团队后，自动生成 `docs/project/{project}/docs/team-members.md` 团队成员列表。
6. PM 需求检查（体验增强）：
   - 直接匹配需求文件：
     - `docs/requirements/*/PM_REQUIREMENTS.md`
     - 兼容：`docs/requirements/*/PM_REQUIREMENT.md`
   - 以需求文件父目录作为 FeatureId
   - 若无需求：询问需求地址或口述
   - 若存在需求：
     - 检查是否已有 `docs/ledger/{FeatureId}/LEDGER.md`
     - 无 LEDGER：提示是否开始该需求
     - 有 LEDGER：输出阶段状态并请求确认是否继续
7. 若提供或识别到 `feature_id`：加载
   - `docs/ledger/{FeatureId}/LEDGER.md`
   - `docs/ledger/{FeatureId}/DELIVERY.md`
   - `docs/requirements/{FeatureId}/PM_REQUIREMENTS.md`
   - `docs/design/{FeatureId}/design-spec.md`（若存在）

## 项目沉淀初始化规则
当 `docs/project/{project}/docs` 为空：
- 先询问是否新项目。
- 若用户指定存量项目并提供 `project_path`：
  - 扫描目录结构与关键文件（只生成摘要，不复制源码）。
  - 生成 `docs/project/{project}/docs/index.md`（含 ProjectRoot、模块摘要、技术栈约束）。
  - 若缺少 `framework.md` / `bugs.md` / `team.md` / `team-members.md`，创建占位文件。
- 若用户确认新项目：
  - 创建 `docs/project/{project}/docs/index.md`（可先写 `TBD`）。
  - 创建 `framework.md` / `bugs.md` / `team.md` / `team-members.md` 占位文件。

## 输出要求
- 列出已加载文件清单
- 明确当前角色可执行动作与禁止事项
- 给出下一步 1-3 条建议
- PM 场景下给出需求状态与是否启动的确认问题

## 注意事项
- 未经明确授权，不自动创建/修改文件。
- 模板目录仅在用户要求创建任务时使用。
- FeatureId 只能由 PM 生成一次，其他角色必须复用。
- 所有动作不得影响仓库外部状态流转。
