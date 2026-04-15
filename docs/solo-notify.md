---
description: Send messages (or commands) to the designated role through an iTerm2 session or tmux pane.
---
# /solo-notify 使用说明

> 目的：通过 iTerm2 会话或 tmux pane 向指定角色发送消息（或命令）。

## 快速开始
```bash
/solo-notify role=PM text="需要你查看设计缺口"
```

## 参数
- `role`（必填）：PM | ARCH | BE | FE | QA
- `text`（必填）：要发送的文本（建议用引号包裹）
- `feature_id`（可选）：显式指定 FeatureId；未提供则使用**当前会话**中正在进行的 FeatureId
- `project`（可选）：显式指定项目代号；未提供则使用**当前会话**中正在进行的 project
- `backend`（可选）：`auto|iterm2|tmux`，默认 `auto`
- `tmux_session`（可选）：显式指定 tmux session；仅 `tmux` 后端使用

## 默认行为
- 若未提供 `feature_id` / `project`，会自动使用当前会话中已确认的 FeatureId 与项目代号。
- 若 `text` 未显式包含 FeatureId 或 project 信息，会在消息开头追加：
  - `[feature_id=<FeatureId> project=<project>] `

## 执行方式
底层执行命令：
```bash
python docs/notify_role.py "{role}" "{text}"
```

如果使用脚本封装：
```bash
./scripts/solo-notify.sh PM "需要你查看设计缺口"
./scripts/solo-notify.sh PM "需要你查看设计缺口" --backend tmux
```

## 示例
```bash
/solo-notify role=PM text="需要你查看设计缺口"
/solo-notify role=PM feature_id=obs-download-test-20260128153045-a1b2 project=ai-solo text="请确认归档入口"
```

## 校验规则
- `role` 只允许：PM/ARCH/BE/FE/QA
- `text` 不能为空
- 无法解析当前会话 FeatureId / project 时，需先补全后再发送

## 输出结果
- 成功：打印 `Executed in <session>: <text>`
- 失败：打印错误信息（找不到会话或参数缺失）

## 注意事项
- `auto` 模式下：若当前运行在 tmux 中且 `tmux` 命令可用，则优先使用 tmux；否则尝试 iTerm2。
- iTerm2 后端需要本地安装 Python API：`pip install iterm2`。
- tmux 后端通过 pane title 识别角色，建议 pane title 使用 `PM-1`、`ARCH-1`、`BE-1`、`FE-1`、`QA-1`。
- iTerm2 会话名需包含角色关键字（不区分大小写）。
