# AI Solo Template

本项目是一个“提示词驱动的单人多角色协作模板”，把传统团队（PM/ARCH/BE/FE/QA）虚拟化为一组 AI 角色。开发者作为 Orchestrator，通过标准化 SOP 文件与命令，把需求、设计、实现、验收串成可追踪的闭环。

核心理念：
- 角色分工明确：每个角色只维护自己的分账与交付记录。
- 事实可追溯：所有结论必须有文件证据与路径。
- 目录即状态：任务流转只通过目录与文件名后缀体现。
- 单一权威：主账 LEDGER 为事实中心，DELIVERY 为执行计划。

## 目录概览
- 需求：`docs/requirements/{FeatureId}/`
- 设计：`docs/design/{FeatureId}/`
- 任务流转：`docs/tasks/{FeatureId}/{assigned|in-progress|completed|archived}/`
- 账单：`docs/ledger/{FeatureId}/`
- 缺陷：`docs/bugs/{FeatureId}/`（QA 证据）
- 项目沉淀：`docs/project/{project}/docs/`（含团队配置与归档索引）
- 代码规范：`docs/coding-standards/{language}.md`（按成员语种加载）

## 全景图说明（补充）
```
docs/_templates/                  # 各种模板（只读，仅复制）
├── PM_REQUIREMENTS.md            # 需求模板
├── ARCH_TASK.md                  # 技术调研任务模板
├── BE_TASK.md                    # 后端执行任务模板
├── FE_TASK.md                    # 前端执行任务模板
├── QA_TASK.md                    # 测试执行任务模板
├── OP_TASK.md                    # 运维执行任务模板
├── LEDGER.md                     # 主账模板
├── DELIVERY.md                   # 执行计划模板
├── ROLE-DELIVERY.md              # 角色执行计划模板
├── design-spec.md                # 设计规格模板
└── design-gap.md                 # 设计缺口模板

docs/requirements/{FeatureId}/    # 原始需求（PM）
├── PM_REQUIREMENTS.md
└── assets/                        # 原型/素材

docs/ledger/{FeatureId}/
├── LEDGER.md                     # 主账（唯一权威）
├── DELIVERY.md                   # 执行计划（标记依赖与顺序）
├── REQUIREMENT.md
├── PM-LEDGER.md                  # PM 私人账
└── ARCH-LEDGER.md                # ARCH 私人账（设计/技术证据）

docs/design/{FeatureId}/          # ARCH 设计目录
├── design-spec.md
├── design-gap.md
├── ARCH-LEDGER.md
└── assets/                        # 设计素材/原型拷贝

docs/tasks/{FeatureId}/
├── assigned/                      # 待认领任务（TODO）
├── in-progress/                   # 执行中（WIP，排他）
├── completed/                     # 已提交（REVIEW）
├── archived/                      # 已归档（DONE）
├── dashboard/                     # 汇总视图（只读，非状态源）
├── logs/                          # 操作日志
└── README.md                      # task 流转规则

docs/framework/                    # 角色规则与硬约束
├── core_rules.md
├── ARCH.md
├── BE.md
├── FE.md
├── PM.md
└── QA.md

docs/bugs/{FeatureId}/
└── {FeatureId}-{date}-bugs.md     # QA 缺陷证据

docs/project/{project}/docs/       # 项目沉淀（推荐新路径）
├── index.md                       # 项目索引
├── team.md                        # 项目团队配置（角色开关与人数）
├── framework.md                   # 架构/规范索引
└── bugs.md                        # 缺陷索引

docs/SPACE_INDEX.md                # 规则与模板索引（/solo-start 加载入口）
docs/solo-*.md                     # 命令说明
.opencode/commands/                # OpenCode 自定义命令
docs/notify_role.py                # 终端通知脚本（iTerm2 / tmux）
scripts/solo-notify.sh             # 通知脚本封装
```

## 自定义命令（OpenCode）
OpenCode 的自定义命令放在：
```
.opencode/commands/
```
已提供命令：
- `/solo-start` 初始化规则与项目上下文
- `/solo-pick` 自动定位可执行任务
- `/solo-pass` 角色自审归档 + 自动流转
- `/solo-notify` 发送消息到指定角色会话
- `/solo-auto-notify` 按默认路由自动通知下一角色
- `/solo-onboard` 生成团队成员列表并拉起角色会话
- `/solo-config-init` 合并并更新 OpenCode 配置指令

## 团队初始化与语种规则
- 语种按成员绑定，不按角色绑定。
- ARCH 不绑定语种。
- BE 默认 `golang`，FE 默认 `vue`。
- 如需覆盖默认值，可在 onboard 时传参：`--languages "BE-1:java,FE-1:vue"`。
- onboard 会为 BE/FE 成员绑定 `docs/coding-standards/{language}.md`，若文件不存在会自动生成占位规范。

## 终端协作与通知（iTerm2 / tmux）
本项目支持通过 iTerm2 或 tmux 模拟多角色运行，并用脚本发送消息：
```
python docs/notify_role.py "{role}" "{text}"
```
后端选择规则：
- `--backend auto`：若当前运行在 tmux 中，则优先使用 tmux；否则回退到 iTerm2。
- `--backend tmux`：强制使用 tmux。
- `--backend iterm2`：强制使用 iTerm2。

本地依赖（按后端选择）：
```
pip install iterm2
tmux
```
封装命令：
```
./scripts/solo-notify.sh PM "需要你查看设计缺口" --backend auto
./scripts/solo-onboard.sh --project ai-solo-template --team "PM:1,ARCH:1,BE:1,FE:1,QA:1" --languages "BE-1:golang,FE-1:vue" --backend auto
./scripts/solo-auto-notify.sh --role "ARCH" --project "ai-solo-template" --feature-id "<FeatureId>" --backend auto
./scripts/solo-config-init.sh --all-default
```

## 从需求到交付的标准流程
1. **PM 创建需求**
   - 生成 FeatureId，创建 `PM_REQUIREMENTS.md`。
   - 需求与原型 HTML 放入：
     - `docs/requirements/{FeatureId}/`
     - `docs/requirements/{FeatureId}/assets/`
   - 初始化 `LEDGER.md` 与 `DELIVERY.md`。

2. **ARCH 设计**
   - 领取任务后，将原型与素材复制到：
     - `docs/design/{FeatureId}/assets/`
   - 输出设计文档：
     - `docs/design/{FeatureId}/design-spec.md`
     - `docs/design/{FeatureId}/design-gap.md`

3. **BE/FE 实现**
   - 依据 `design-spec.md` 与设计 assets 实施。
   - 更新各自 `role-LEDGER.md` 与 `role-DELIVERY.md`。

4. **QA 验收**
   - 缺陷写入 `docs/bugs/{FeatureId}/`。
   - PM 在项目沉淀里记录缺陷索引。

5. **归档**
   - 任务进入 `archived/`，LEDGER/DELIVERY 标记完成。

## 快速使用步骤
1. 打开 OpenCode，执行 `/solo-start`。
2. PM 创建需求与输入材料（需求文档、HTML 原型）。
3. ARCH 领取设计任务，完成设计归档。
4. PM 分发 FE/BE 任务，完成实现。
5. QA 归档缺陷与验收。
6. 可选：使用 `/solo-pass` 跳过 PM 审核自审流转。
7. 多角色协作时，用 `/solo-notify` 发送消息给目标角色。

## 规则索引
规则入口：`docs/SPACE_INDEX.md`  
角色规则：`docs/framework/*.md`  
任务流转：`docs/tasks/README.md`
