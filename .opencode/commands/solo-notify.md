---
description: Send messages (or commands) to the designated role through an iTerm2 session.
---
# /solo-notify

目标：调用本地脚本将消息发送到指定角色的 iTerm2 会话。

## 需要的参数（必填/可选）
- role（必填）：PM | ARCH | BE | FE | QA
- text（必填）：要发送的文本（建议用引号包裹）
- feature_id（可选）：显式指定 FeatureId。未提供则使用**当前会话**中正在进行的 FeatureId。
- project（可选）：显式指定项目代号。未提供则使用**当前会话**中正在进行的 project。

## 执行步骤（严格按顺序）
1. 校验参数合法性（role 必须在允许列表内，text 不能为空）。
2. 解析 FeatureId / project：
   - 若提供 `feature_id`，以其为准；
   - 否则使用当前会话已确认的 FeatureId；
   - 若无法解析 FeatureId，先向用户追问补全，不发送通知。
   - project 同理：若未提供，使用当前会话已确认的 project；无法解析则追问补全。
3. 规范化消息内容：
   - 若 `text` 未显式包含 FeatureId 或 project 信息，则在开头追加：
     - `[feature_id=<FeatureId> project=<project>] `
4. 运行命令：
   - `./scripts/solo-notify.sh "<ROLE>" "<TEXT>"`
5. 输出脚本结果。

## 注意
- 需要本地 iTerm2 Python API 环境可用。
- 会话名需包含角色关键字（不区分大小写）。
