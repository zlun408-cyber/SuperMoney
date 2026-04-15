---
description: PM creates team roster and boots role sessions in iTerm2.
---
# /solo-onboard

目标：PM 确认团队角色与人数后，自动生成项目团队成员清单，并自动打开 iTerm2 会话进入对应角色。

## 参数
- project（必填）：项目代号
- team（可选）：团队配置，格式 `PM:1,ARCH:1,BE:1,FE:1,QA:1`；当项目下已有 `team.md` 时自动加载该文件
- feature_id（可选，兼容保留）：onboard 不依赖 feature
- models（可选）：按角色指定模型，格式 `PM:provider/model,ARCH:provider/model,BE:provider/model,FE:provider/model,QA:provider/model`
- open_iterm（可选）：true/false，默认 true

## 执行步骤
1. 校验参数与角色合法性。
2. 执行命令：
   - `./scripts/solo-onboard.sh --project "<project>" --team "<team>" [--feature-id "<feature_id>"] [--models "<models>"] [--no-open-iterm]`
3. 输出团队文件路径与会话启动结果。

## 注意
- 项目已存在 `team.md` 时优先加载该文件；仅在 `team.md` 不存在时才要求传 `team`。
- 角色只允许 PM/ARCH/BE/FE/QA。
- 未提供 `models` 时，默认继承 PM 模型；若只提供 PM 模型，其它角色自动沿用 PM 模型。
- `open_iterm=false` 时仅生成团队文件。
