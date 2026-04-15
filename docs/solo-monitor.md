# Solo Pane Monitor - 让主控（我）能读写各 Pane 的输出（iTerm2 / tmux）

## 背景

在 AI Solo 架构中，OpenCode pane（PM/ARCH/BE/FE/QA）可以跑在 iTerm2 或 tmux 里，主控（我）默认无法直接看到 pane 内容。

本文档描述如何让每个 pane 的输出可被外部脚本读写。

---

## 当前支持

现有脚本已经支持双后端：

- `python3 docs/notify_and_read.py send <ROLE> "<指令>" --backend auto`
- `python3 docs/notify_and_read.py read <ROLE> 200 --backend auto`
- `python3 docs/notify_and_read.py send-and-read <ROLE> "<指令>" 200 --backend auto`
- `python3 docs/solo-pane-monitor.py watch --backend auto`
- `python3 docs/solo-pane-monitor.py read PM 200 --backend auto`
- `python3 docs/solo-pane-monitor.py status 100 --backend auto`

后端选择规则：

- `--backend auto`：当前在 tmux 中时优先使用 tmux，否则回退到 iTerm2
- `--backend tmux`：强制使用 tmux
- `--backend iterm2`：强制使用 iTerm2

tmux 下按 pane title 识别角色，建议使用：

- `PM-1`
- `ARCH-1`
- `BE-1`
- `FE-1`
- `QA-1`

---

## 方案一：直接用现有监控脚本

如果你已经使用本仓库的 `solo-onboard` / `solo-notify`，优先直接用现成脚本：

```bash
python3 docs/notify_and_read.py send PM "npm run build" --backend auto
python3 docs/notify_and_read.py read PM 120 --backend auto
python3 docs/notify_and_read.py send-and-read PM "npm test" 200 --backend auto

python3 docs/solo-pane-monitor.py read PM 120 --backend auto
python3 docs/solo-pane-monitor.py status 80 --backend auto
python3 docs/solo-pane-monitor.py watch --roles PM,ARCH,BE,FE,QA --interval 5 --backend auto
```

如果你用 tmux 且需要指定 session：

```bash
python3 docs/notify_and_read.py read PM 120 --backend tmux --tmux-session solo
python3 docs/solo-pane-monitor.py watch --backend tmux --tmux-session solo
```

---

## 方案二：script 命令重定向

macOS 内置 `script` 命令可以把终端所有输出记录到文件，同时不影响正常交互。

### 每个 Pane 启动命令

不再直接运行 `opencode`，改为：

```bash
script -q /tmp/sf-<ROLE>.log opencode
```

例如 PM pane：
```bash
script -q /tmp/sf-pm.log opencode
```

这不会改变任何交互行为，只是同时把输出复制到 `/tmp/sf-pm.log`。

---

### 启动脚本：solo-launch.sh

在项目根目录创建 `scripts/solo-launch.sh`：

```bash
#!/usr/bin/env bash
# scripts/solo-launch.sh
# 用法: solo-launch.sh <ROLE>
# 例如: solo-launch.sh PM

ROLE="${1:-}"
LOG_DIR="/tmp"

if [[ -z "${ROLE}" ]]; then
  echo "Usage: solo-launch.sh <ROLE> (PM|ARCH|BE|FE|QA)"
  exit 1
fi

LOG_FILE="${LOG_DIR}/sf-${ROLE}.log"
echo "[$(date)] Starting ${ROLE} pane" > "${LOG_FILE}"
script -q "${LOG_FILE}" opencode
```

然后在 iTerm2 里为每个 pane 设置启动命令（iTerm2 → Preferences → Profiles → General → Command → Run command）。

### 为什么用 `script`

- macOS 内置，无需安装额外工具
- 不影响 pane 交互行为
- 所有输出实时同步到文件

---

## 实现步骤

### 步骤 1：为每个 Pane 重新配置启动命令

在 iTerm2 中：
1. Preferences → Profiles
2. 为 PM/ARCH/BE/FE/QA 各建一个 Profile（或用默认 + 启动目录区分）
3. 每个 Profile 的 Command 设为：
   ```
   /path/to/ai-solo-template/scripts/solo-launch.sh PM
   ```
4. 以后每次打开该 pane，输出自动记录

### 步骤 2：我（主控）如何读取和写入

#### 读取 pane 输出

通过 `tail -f /tmp/sf-pm.log` 或定期 `tail` 读取新内容。

```python
# read_pane.py - 读取某个 pane 的日志
import tailer

with open(f"/tmp/sf-{role}.log") as f:
    lines = tailer.tail(f, 50)  # 最近 50 行
    return "\n".join(lines)
```

#### 写入指令到 pane

用现有的 `solo-notify.sh`，不动现有 pane：

```bash
./scripts/solo-notify.sh PM "npm run build"
```

**注意：** 写和读是两条独立路径：
- 写 → 通过 `solo-notify.sh` 发送指令到 pane
- 读 → 通过 tail `/tmp/sf-*.log` 读取 pane 输出

tmux 下如果不想依赖 `capture-pane`，也可以同样使用 `script` 做日志落盘。

---

## 局限与注意事项

1. **Pane 重启时 log 文件被覆盖**：每次打开 pane 会 `echo` 新时间戳，log 文件持续追加。如果需要独立，可以在启动时用日期时间戳区分。
2. **大文件处理**：`script` 持续追加，建议定期 truncate 或用 `logrotate`。
3. **时机问题**：发送指令后，需要等 pane 里的 OpenCode 执行完毕再读日志。等待时间取决于指令本身的耗时。

---

## 下一步

实现后，我（主控）就能形成完整的自动化闭环：

1. 读取各 pane 状态（tail 日志）
2. 分析输出内容，判断下一步
3. 通过 `solo-notify.sh` 向对应 pane 发指令
4. 重复直到任务完成

整个过程无需你在电脑前盯着。
