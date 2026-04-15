---
description: Initialize a new feature with dedicated git worktree and branch.
---
# /solo-new-feature 使用说明

> 目的：初始化新需求，并为该需求创建独立 `git worktree` + 功能分支，确保该 Feature 的改动只在对应分支提交，最终合并到 `main`。

## 快速开始
```bash
/solo-new-feature project=ai-solo-template short_name=billing-tree
```

## 参数
- `project`（必填）：项目代号。
- `short_name`（必填）：需求短名（用于生成 FeatureId 的 slug）。
- `feature_id`（可选）：手动指定 FeatureId；未提供则自动生成 `<TaskNameSlug>-<YYYYMMDDHHmmss>-<Rand4>`。
- `branch`（可选）：手动指定分支名；未提供默认 `feature/<FeatureId>`。
- `base_branch`（可选）：分支基线，默认 `main`。
- `prd_path`（可选）：需求来源/PRD 路径，写入 `PM_REQUIREMENTS.md`。
- `worktree_root`（可选）：worktree 根目录，默认 `.solo/worktrees`。
- `no_ledger`（可选）：仅初始化需求文件，不初始化 `LEDGER.md` / `DELIVERY.md`。

## 执行步骤
1. 校验参数与 git 仓库状态（基线分支存在）。
2. 生成 `FeatureId` 与分支名（若未显式提供）。
3. 创建分支并创建独立 worktree：
   - `git worktree add -b <branch> <worktree_path> <base_branch>`
4. 在该 worktree 内初始化需求目录与文档：
   - `docs/requirements/{FeatureId}/PM_REQUIREMENTS.md`
   - `docs/requirements/{FeatureId}/assets/`
   - `docs/ledger/{FeatureId}/LEDGER.md`（默认）
   - `docs/ledger/{FeatureId}/DELIVERY.md`（默认）
5. 在 `PM_REQUIREMENTS.md` 元信息写入 `GitWorktree` 字段。

## 推荐命令
```bash
./scripts/solo-new-feature.sh \
  --project "ai-solo-template" \
  --short-name "billing-tree" \
  --prd-path "docs/prd/billing-tree.md"
```

## 完成后分支策略
- 该 Feature 相关改动全部在对应 worktree 的功能分支提交。
- Feature 完成并通过验收后，将该分支合并到 `main`。

## 注意事项
- 本命令会执行 `git worktree add` 与分支创建（有本地 git 状态副作用）。
- 若 `feature_id` 或目标文件已存在，会报错并停止，避免覆盖。
- 若 `worktree_root` 在仓库内，会自动写入 `.git/info/exclude` 以避免噪音。
