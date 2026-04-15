# SPACE INDEX（规则索引）

用途：供 `/solo-start` 加载规则与上下文。除非明确需要，不要一次性加载全部模板文件。

## 建议加载顺序
1. `docs/framework/core_rules.md`（全局硬规则）
2. `docs/framework/<ROLE>.md`（角色规则）
3. `docs/tasks/README.md`（任务状态机）
4. 项目沉淀（按项目）：`docs/project/{project}/docs/*`
5. 仅在创建文件时加载对应模板：`docs/_templates/*.md`

## 规则与模板索引
### 命令说明
- `docs/solo-new-feature.md`
- `docs/solo-start.md`
- `docs/solo-pick.md`
- `docs/solo-pass.md`
- `docs/solo-notify.md`
- `docs/solo-auto-notify.md`
- `docs/solo-onboard.md`
- `docs/solo-config-init.md`
- `docs/solo-commands.md`

### 全局规则
- `docs/framework/core_rules.md`：统一约束与流程底线
- `docs/tasks/README.md`：任务流转规则（TODO/WIP/REVIEW/DONE）

### 角色规则
- `docs/framework/PM.md`：PM 指令
- `docs/framework/ARCH.md`：ARCH 指令
- `docs/framework/BE.md`：BE 指令
- `docs/framework/FE.md`：FE 指令
- `docs/framework/QA.md`：QA 指令

### 模板（只读，仅复制）
- `docs/_templates/PM_REQUIREMENTS.md`
- `docs/_templates/ARCH_TASK.md`
- `docs/_templates/BE_TASK.md`
- `docs/_templates/FE_TASK.md`
- `docs/_templates/QA_TASK.md`
- `docs/_templates/OP_TASK.md`
- `docs/_templates/BUG.md`
- `docs/_templates/LEDGER.md`
- `docs/_templates/DELIVERY.md`
- `docs/_templates/ROLE-DELIVERY.md`
- `docs/_templates/design-spec.md`
- `docs/_templates/design-gap.md`

### 项目沉淀（按项目）
- `docs/project/{project}/docs/framework.md`
- `docs/project/{project}/docs/bugs.md`
- `docs/project/{project}/docs/team.md`（项目团队配置）
- `docs/project/{project}/docs/team-members.md`（项目团队成员列表）
- `docs/project/{project}/docs/index.md`（项目索引，含项目目录标记）

### 兼容保留（旧路径）
- `docs/project/docs/framework.md`
- `docs/project/docs/bugs.md`
- `docs/project/docs/team.md`
- `docs/project/docs/team-members.md`
