#!/usr/bin/env python3
import argparse
import random
import re
import string
import subprocess
from datetime import datetime
from pathlib import Path


def run_git(root: Path, args: list[str], check: bool = True):
    return subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=check,
    )


def resolve_workspace_root(start: Path):
    for candidate in [start, *start.parents]:
        if (candidate / "docs" / "SPACE_INDEX.md").exists():
            return candidate
    raise FileNotFoundError("Cannot locate workspace root containing docs/SPACE_INDEX.md")


def slugify(value: str):
    lowered = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return normalized or "feature"


def generate_feature_id(short_name: str):
    slug = slugify(short_name)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    rand4 = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    return f"{slug}-{ts}-{rand4}"


def ensure_ignore_worktree_root(repo_root: Path, worktree_root: Path):
    try:
        rel = worktree_root.relative_to(repo_root)
    except ValueError:
        return

    pattern = f"/{rel.as_posix().rstrip('/')}/"
    exclude_path = repo_root / ".git" / "info" / "exclude"
    exclude_path.parent.mkdir(parents=True, exist_ok=True)
    existing = exclude_path.read_text(encoding="utf-8") if exclude_path.exists() else ""
    if pattern not in existing.splitlines():
        content = existing.rstrip("\n")
        if content:
            content += "\n"
        content += pattern + "\n"
        exclude_path.write_text(content, encoding="utf-8")


def write_pm_requirements(path: Path, feature_id: str, short_name: str, prd_path: str, git_worktree: str):
    today = datetime.now().strftime("%Y-%m-%d")
    lines = [
        "# PM Requirement",
        "",
        "## 元信息",
        f"- FeatureId: {feature_id}",
        f"- ShortName: {short_name}",
        "- Owner: PM",
        "- Status: Draft",
        f"- PRD/来源路径: {prd_path}",
        f"- GitWorktree: {git_worktree}",
        f"- 创建日期: {today}",
        "",
        "## 背景与目标",
        "- 背景:",
        "- 业务目标:",
        "- 成功指标:",
        "",
        "## 范围定义",
        "- Scope:",
        "- Out of Scope:",
        "",
        "## 用户故事",
        "1.",
        "2.",
        "",
        "## 需求明细",
        "- 功能点:",
        "- 非功能要求（性能/安全/兼容等）:",
        "",
        "## 验收标准（AC）",
        "- AC-1:",
        "- AC-2:",
        "",
        "## 设计输入需求",
        "- 必须输出的设计结论:",
        "- 依赖或约束:",
        f"- 原型/素材路径: docs/requirements/{feature_id}/assets/",
        "- HTML 列表文件路径（可口述/外部）: TBD",
        "",
        "## 依赖与风险",
        "- 依赖:",
        "- 风险:",
        "",
        "## 未决问题（TBD）",
        "- Q1:",
        "- Q2:",
        "",
        "## 变更记录",
        f"- {today} 初始化需求。",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_ledger(path: Path, feature_id: str, short_name: str):
    today = datetime.now().strftime("%Y-%m-%d")
    lines = [
        "# LEDGER",
        "",
        "## 元信息",
        f"- FeatureId: {feature_id}",
        f"- ShortName: {short_name}",
        "- Owner: PM",
        f"- 创建日期: {today}",
        f"- 最近更新: {today}",
        "- 当前阶段: Draft",
        "",
        "## 阶段检查点",
        "- [ ] Design 完成（证据: <docs/design/...>）",
        "- [ ] Dev 完成（证据: <代码变更/Deliverables>）",
        "- [ ] QA 完成（证据: <docs/bugs/.../ 或测试报告>）",
        "- [ ] Done 归档（证据: <归档路径>）",
        "",
        "## Ledger Items",
        "> 规则：每条记录一个稳定 LedgerId（如 L1/L2），供 DELIVERY/Task 引用；只更新状态与证据，不改 ID。",
        "| LedgerId | ParentId | Stage | Item | Owner | DependsOn | Status | Evidence |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        "| L1 | - | Design | <设计阶段总目标> | ARCH | - | TODO | <docs/design/...> |",
        "| L1.1 | L1 | Design | <设计产出 A> | ARCH | - | TODO | <docs/design/...> |",
        "| L2 | - | Dev | <开发阶段总目标> | BE/FE | L1 | TODO | <代码/文档路径> |",
        "| L2.1 | L2 | Dev | <接口实现> | BE | L1.1 | TODO | <代码/文档路径> |",
        "| L2.2 | L2 | Dev | <前端实现> | FE | L1.1 | TODO | <代码/文档路径> |",
        "| L3 | - | QA | <验收与缺陷归档> | QA | L2.1,L2.2 | TODO | <docs/bugs/...> |",
        "",
        "## 变更记录",
        f"- {today} 初始化主账。",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_delivery(path: Path, feature_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    lines = [
        "# DELIVERY",
        "",
        "## 元信息",
        f"- FeatureId: {feature_id}",
        "- Owner: PM",
        f"- 创建日期: {today}",
        f"- 最近更新: {today}",
        f"- 关联主账: docs/ledger/{feature_id}/LEDGER.md",
        "",
        "## 执行原则",
        "- StepId 使用 D1/D2... 且稳定不变。",
        "- LedgerRef 引用 LEDGER 的 LedgerId。",
        "- ParentId 用于表达树形父子关系；根节点使用 `-`。",
        "- DependsOn 引用 StepId；为空表示可并行。",
        "",
        "## 执行计划（跨角色）",
        "| StepId | ParentId | LedgerRef | Role | TaskId | DependsOn | Status | Notes |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        "| D1 | - | L1 | ARCH | <TaskId> | - | TODO | <设计阶段总任务> |",
        "| D1.1 | D1 | L1.1 | ARCH | <TaskId> | - | TODO | <设计子任务 A> |",
        "| D2 | - | L2 | BE/FE | <TaskId> | D1 | TODO | <开发阶段总任务> |",
        "| D2.1 | D2 | L2.1 | BE | <TaskId> | D1.1 | TODO | <接口实现> |",
        "| D2.2 | D2 | L2.2 | FE | <TaskId> | D1.1 | TODO | <前端实现> |",
        "| D3 | - | L3 | QA | <TaskId> | D2.1,D2.2 | TODO | <验收/缺陷归档> |",
        "",
        "## 变更记录",
        f"- {today} 初始化执行计划。",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Initialize feature docs + git worktree/branch")
    parser.add_argument("--project", required=True, help="Project key")
    parser.add_argument("--short-name", required=True, help="Feature short name for FeatureId slug")
    parser.add_argument("--feature-id", default="", help="Optional explicit FeatureId")
    parser.add_argument("--branch", default="", help="Optional explicit branch name")
    parser.add_argument("--base-branch", default="main", help="Base branch for new feature branch")
    parser.add_argument("--prd-path", default="TBD", help="PRD path to write into PM_REQUIREMENTS")
    parser.add_argument("--worktree-root", default=".solo/worktrees", help="Worktree root directory")
    parser.add_argument("--no-ledger", action="store_true", help="Skip ledger/delivery initialization")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    workspace_root = resolve_workspace_root(script_dir)

    feature_id = args.feature_id.strip() or generate_feature_id(args.short_name)
    branch = args.branch.strip() or f"feature/{feature_id}"
    short_name = slugify(args.short_name)

    worktree_root = Path(args.worktree_root).expanduser()
    if not worktree_root.is_absolute():
        worktree_root = (workspace_root / worktree_root).resolve()
    worktree_path = (worktree_root / feature_id).resolve()

    run_git(workspace_root, ["rev-parse", "--is-inside-work-tree"])

    local_base = run_git(workspace_root, ["show-ref", "--verify", f"refs/heads/{args.base_branch}"], check=False)
    if local_base.returncode == 0:
        start_point = args.base_branch
    else:
        remote_base = run_git(
            workspace_root,
            ["show-ref", "--verify", f"refs/remotes/origin/{args.base_branch}"],
            check=False,
        )
        if remote_base.returncode != 0:
            raise ValueError(f"Base branch not found: {args.base_branch} (or origin/{args.base_branch})")
        start_point = f"origin/{args.base_branch}"

    worktree_path.parent.mkdir(parents=True, exist_ok=True)
    ensure_ignore_worktree_root(workspace_root, worktree_root)

    branch_exists = run_git(workspace_root, ["show-ref", "--verify", f"refs/heads/{branch}"], check=False).returncode == 0

    if worktree_path.exists() and any(worktree_path.iterdir()):
        raise ValueError(f"Worktree path is not empty: {worktree_path}")

    if branch_exists:
        run_git(workspace_root, ["worktree", "add", str(worktree_path), branch])
    else:
        run_git(workspace_root, ["worktree", "add", "-b", branch, str(worktree_path), start_point])

    requirements_dir = worktree_path / "docs" / "requirements" / feature_id
    requirements_dir.mkdir(parents=True, exist_ok=True)
    (requirements_dir / "assets").mkdir(parents=True, exist_ok=True)

    git_worktree_ref = (
        str(worktree_path.relative_to(workspace_root))
        if workspace_root in worktree_path.parents
        else str(worktree_path)
    )

    pm_req_path = requirements_dir / "PM_REQUIREMENTS.md"
    if pm_req_path.exists():
        raise ValueError(f"Requirement file already exists: {pm_req_path}")
    write_pm_requirements(pm_req_path, feature_id, short_name, args.prd_path, git_worktree_ref)

    created = [pm_req_path, requirements_dir / "assets"]

    if not args.no_ledger:
        ledger_dir = worktree_path / "docs" / "ledger" / feature_id
        ledger_dir.mkdir(parents=True, exist_ok=True)
        ledger_path = ledger_dir / "LEDGER.md"
        delivery_path = ledger_dir / "DELIVERY.md"
        if not ledger_path.exists():
            write_ledger(ledger_path, feature_id, short_name)
            created.append(ledger_path)
        if not delivery_path.exists():
            write_delivery(delivery_path, feature_id)
            created.append(delivery_path)

    print(f"FeatureId: {feature_id}")
    print(f"Branch: {branch}")
    print(f"Worktree: {worktree_path}")
    print("Created files:")
    for path in created:
        print(f"- {path}")
    print(f"Next: cd {worktree_path} && /solo-start role=PM project={args.project} feature_id={feature_id}")


if __name__ == "__main__":
    main()
