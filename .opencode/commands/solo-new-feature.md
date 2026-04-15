---
description: Initialize feature docs with dedicated git worktree and branch.
---
# /solo-new-feature

目标：初始化需求，并为每个需求创建独立 git worktree 与功能分支，确保该 Feature 的改动只在对应分支提交，完成后合并到 main。

## 参数
- project（必填）：项目代号
- short_name（必填）：需求短名（用于生成 FeatureId）
- feature_id（可选）：手动指定 FeatureId
- branch（可选）：手动指定分支名（默认 `feature/<FeatureId>`）
- base_branch（可选）：基线分支（默认 `main`）
- prd_path（可选）：PRD 路径
- worktree_root（可选）：worktree 根目录（默认 `.solo/worktrees`）
- no_ledger（可选）：是否跳过初始化 `LEDGER.md` / `DELIVERY.md`

## 执行步骤
1. 校验参数与基线分支存在性。
2. 执行命令：
   - `./scripts/solo-new-feature.sh --project "<project>" --short-name "<short_name>" [--feature-id "<feature_id>"] [--branch "<branch>"] [--base-branch "<base_branch>"] [--prd-path "<prd_path>"] [--worktree-root "<worktree_root>"] [--no-ledger]`
3. 输出 FeatureId、分支名、worktree 路径与初始化文件列表。

## 注意
- 每个 Feature 必须绑定唯一 worktree 和分支。
- 该 Feature 相关提交只在该分支进行，验收后再合并到 `main`。
