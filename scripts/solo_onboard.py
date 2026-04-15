#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
import re
import shlex
from datetime import date
from pathlib import Path

from terminal_backend import (
    compute_missing_pane_titles,
    list_tmux_panes,
    resolve_backend,
    select_tmux_layout,
    send_tmux_text,
    set_tmux_pane_title,
    split_tmux_pane,
    tmux_current_context,
)

ALLOWED_ROLES = ["PM", "ARCH", "BE", "FE", "QA"]
DEV_ROLES = ["BE", "FE"]
AGENT_MAP = {
    "PM": "pm",
    "ARCH": "arch",
    "BE": "be",
    "FE": "fe",
    "QA": "qa",
}


def parse_member_language_map(raw: str):
    if not raw:
        return {}

    member_languages = {}
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    for part in parts:
        if ":" not in part:
            raise ValueError(f"invalid language map item: {part}")
        member_id, language = [x.strip() for x in part.split(":", 1)]
        member_id = member_id.upper()
        language = language.lower()
        if not re.match(r"^(BE|FE)-[1-9][0-9]*$", member_id):
            raise ValueError(
                f"unsupported member in language map: {member_id} (use BE-1:golang,FE-1:vue)"
            )
        if not re.match(r"^[a-z0-9][a-z0-9_-]*$", language):
            raise ValueError(f"invalid language for {member_id}: {language}")
        member_languages[member_id] = language
    return member_languages


def parse_model_map(raw: str):
    if not raw:
        return {}

    role_models = {}
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    for part in parts:
        if ":" not in part:
            raise ValueError(f"invalid model map item: {part}")
        role, model = [x.strip() for x in part.split(":", 1)]
        role = role.upper()
        if role not in ALLOWED_ROLES:
            raise ValueError(f"unsupported role in model map: {role}")
        if not model:
            raise ValueError(f"empty model for role: {role}")
        role_models[role] = model
    return role_models


def normalize_role_models(role_models: dict):
    normalized = dict(role_models)

    pm_model = (
        normalized.get("PM")
        or os.getenv("SOLO_PM_MODEL")
        or os.getenv("OPENCODE_MODEL")
        or detect_model_from_state()
    )
    if pm_model:
        normalized.setdefault("PM", pm_model)
        for role in ALLOWED_ROLES:
            normalized.setdefault(role, pm_model)

    return normalized


def detect_model_from_state():
    state_path = Path.home() / ".local" / "state" / "opencode" / "model.json"
    if not state_path.exists():
        return ""

    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return ""

    recent = data.get("recent")
    if not isinstance(recent, list) or not recent:
        return ""

    first = recent[0]
    if not isinstance(first, dict):
        return ""

    provider = (first.get("providerID") or "").strip()
    model = (first.get("modelID") or "").strip()
    if not model:
        return ""
    if "/" in model:
        return model
    if provider:
        return f"{provider}/{model}"
    return model


def parse_team(raw: str):
    team = {role: 0 for role in ALLOWED_ROLES}
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        raise ValueError("team is empty")

    for part in parts:
        if ":" not in part:
            raise ValueError(f"invalid team item: {part}")
        role, count = [x.strip().upper() for x in part.split(":", 1)]
        if role not in ALLOWED_ROLES:
            raise ValueError(f"unsupported role: {role}")
        if not count.isdigit():
            raise ValueError(f"invalid headcount for {role}: {count}")
        team[role] = int(count)
    return team


def resolve_workspace_root(start: Path):
    matches = []
    for candidate in [start, *start.parents]:
        if (candidate / "docs" / "SPACE_INDEX.md").exists():
            matches.append(candidate)
    if matches:
        return matches[-1]
    raise FileNotFoundError("Cannot locate workspace root containing docs/SPACE_INDEX.md")


def ensure_project_docs(root: Path, project: str):
    project_docs = root / "docs" / "project" / project / "docs"
    project_docs.mkdir(parents=True, exist_ok=True)
    return project_docs


def ensure_project_base_files(project_docs: Path, project: str):
    index_path = project_docs / "index.md"
    if not index_path.exists():
        index_path.write_text(
            "\n".join(
                [
                    "# 项目索引（初始化）",
                    "",
                    f"- Project: {project}",
                    "- ProjectRoot: TBD",
                    "- 初始化日期: TBD",
                    "- 主要目录与模块摘要: TBD",
                    "- 关键技术栈与约束: TBD",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    framework_path = project_docs / "framework.md"
    if not framework_path.exists():
        framework_path.write_text(
            "# 项目框架沉淀（占位）\n\n- 这里存放存量项目的架构/规范/接口索引。\n",
            encoding="utf-8",
        )

    bugs_path = project_docs / "bugs.md"
    if not bugs_path.exists():
        bugs_path.write_text(
            "# 项目缺陷沉淀（占位）\n\n- 这里维护历史缺陷与回归经验。\n",
            encoding="utf-8",
        )


def load_team_md(project_docs: Path):
    path = project_docs / "team.md"
    if not path.exists():
        return None

    text = path.read_text(encoding="utf-8")
    team = {role: 0 for role in ALLOWED_ROLES}
    matched = 0

    pattern = re.compile(r"^\|\s*(PM|ARCH|BE|FE|QA)\s*\|\s*(true|false)\s*\|\s*([0-9]+)\s*\|", re.IGNORECASE)
    for line in text.splitlines():
        m = pattern.match(line.strip())
        if not m:
            continue
        role = m.group(1).upper()
        count = int(m.group(3))
        team[role] = count
        matched += 1

    if matched == 0:
        raise ValueError(f"team.md exists but contains no valid team rows: {path}")

    return team


def resolve_member_languages(team: dict, from_arg: dict):
    member_languages = {}
    for role in DEV_ROLES:
        default_language = "golang" if role == "BE" else "vue"
        for i in range(1, team.get(role, 0) + 1):
            member_id = f"{role}-{i}"
            member_languages[member_id] = from_arg.get(member_id, default_language)
    return member_languages


def ensure_coding_standards(root: Path, member_languages: dict):
    standards_dir = root / "docs" / "coding-standards"
    standards_dir.mkdir(parents=True, exist_ok=True)

    ensured = []
    for member_id in sorted(member_languages.keys()):
        role = member_id.split("-", 1)[0]
        language = member_languages.get(member_id)
        if not language:
            continue
        path = standards_dir / f"{language}.md"
        if path.exists():
            continue
        title = language.upper()
        lines = [
            f"# {title} 使用规范",
            "",
            "## 适用范围",
            f"- 角色: {role}",
            f"- 成员: {member_id}",
            f"- 语种: {language}",
            "",
            "## 代码规范",
            "- TBD",
            "",
            "## 测试与质量门禁",
            "- TBD",
            "",
            "## 交付物",
            "- TBD",
            "",
            "## 变更记录",
            f"- {date.today().isoformat()} 初始化占位规范（由 /solo-onboard 自动生成）。",
            "",
        ]
        path.write_text("\n".join(lines), encoding="utf-8")
        ensured.append(path)
    return ensured


def write_team_md(project_docs: Path, project: str, team: dict):
    today = date.today().isoformat()
    lines = [
        "# 项目团队配置",
        "",
        "## 元信息",
        f"- Project: {project}",
        f"- 更新日期: {today}",
        "",
        "## 团队开关与人数",
        "| Role | Enabled | Headcount | Notes |",
        "| --- | --- | --- | --- |",
    ]

    for role in ALLOWED_ROLES:
        count = team[role]
        enabled = "true" if count > 0 else "false"
        note = ""
        if role == "PM" and count > 0:
            note = "默认主代理"
        elif count == 0:
            note = "未启用"
        lines.append(f"| {role} | {enabled} | {count} | {note} |")

    lines.extend(
        [
            "",
            "## 说明",
            "- 项目启动时以本文件为角色流转与任务分发基线。",
            "- 若调整角色开关或人数，需同步记录更新日期。",
            "- 语种按成员绑定：ARCH 不绑定语种，BE 默认 golang，FE 默认 vue。",
            "",
        ]
    )

    path = project_docs / "team.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_team_members_md(
    project_docs: Path,
    project: str,
    team: dict,
    feature_id: str,
    member_languages: dict,
):
    today = date.today().isoformat()
    lines = [
        "# 项目团队成员列表",
        "",
        "## 元信息",
        f"- Project: {project}",
        f"- 更新日期: {today}",
        f"- FeatureId: {feature_id or 'N/A（onboard 与 feature 无关）'}",
        "",
        "## 成员清单",
        "| MemberId | Role | Agent | SessionName | Language | CodingStandard | AutoStart |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    for role in ALLOWED_ROLES:
        for i in range(1, team[role] + 1):
            member_id = f"{role}-{i}"
            agent = AGENT_MAP[role]
            session = f"{role}-{i}"
            language = member_languages.get(member_id, "-")
            standard = (
                f"docs/coding-standards/{language}.md" if language != "-" else "-"
            )
            lines.append(
                f"| {member_id} | {role} | {agent} | {session} | {language} | {standard} | true |"
            )

    lines.append("")
    path = project_docs / "team-members.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _bootstrap_commands(
    root: Path,
    project: str,
    role: str,
    feature_id: str,
    role_models: dict,
    member_languages: dict,
    member_id: str,
):
    agent = AGENT_MAP[role]
    launcher = os.getenv("OPENCODE_LAUNCH_CMD", "opencode")
    cd_cmd = f'cd "{root}"'

    start_cmd = f"/solo-start role={role} project={project}"
    language = member_languages.get(member_id)
    if language:
        standard = f"docs/coding-standards/{language}.md"
        start_cmd = start_cmd + "\n" + f"请先加载代码规范：{standard}"

    model = role_models.get(role)
    model_arg = f" --model {shlex.quote(model)}" if model else ""
    open_cmd = f"{launcher} --agent {agent}{model_arg} --prompt {shlex.quote(start_cmd)}"
    return cd_cmd, open_cmd


def open_iterm_sessions(
    root: Path,
    team: dict,
    project: str,
    feature_id: str,
    role_models: dict,
    member_languages: dict,
):
    import importlib

    iterm2 = importlib.import_module("iterm2")

    def _normalize_session_id(raw: str):
        if not raw:
            return ""
        raw = raw.strip()
        if ":" in raw:
            return raw.split(":", 1)[1]
        return raw

    def _resolve_target_tab(app):
        target_session_id = _normalize_session_id(
            os.getenv("TERM_SESSION_ID") or os.getenv("ITERM_SESSION_ID") or ""
        )

        if target_session_id:
            for win in getattr(app, "windows", []) or []:
                for tab in getattr(win, "tabs", []) or []:
                    for sess in getattr(tab, "all_sessions", []) or []:
                        if getattr(sess, "session_id", "") == target_session_id:
                            return win, tab

        win = app.current_window
        if win is None:
            win = None
            tab = None
        else:
            tab = win.current_tab
        return win, tab

    async def _run(connection):
        app = await iterm2.async_get_app(connection)
        window, tab = _resolve_target_tab(app)
        if window is None or tab is None:
            window = await iterm2.Window.async_create(connection)
            tab = window.current_tab
            reuse_base_for_first = True
        else:
            reuse_base_for_first = False

        created = []
        skipped = []

        existing_sessions = []
        all_sessions = getattr(tab, "all_sessions", None)
        if all_sessions is not None:
            existing_sessions = list(all_sessions)
        else:
            tab_sessions = getattr(tab, "sessions", None)
            if tab_sessions is not None:
                existing_sessions = list(tab_sessions)

        existing_names = [
            (getattr(s, "name", "") or "").strip()
            for s in existing_sessions
            if (getattr(s, "name", "") or "").strip()
        ]
        existing_member_ids = set()
        for name in existing_names:
            m = re.match(r"^((?:PM|ARCH|BE|FE|QA)-[0-9]+)\b", name)
            if m:
                existing_member_ids.add(m.group(1))

        split_from = tab.current_session
        first = True
        for role in ALLOWED_ROLES:
            for i in range(1, team[role] + 1):
                session_name = f"{role}-{i}"
                member_id = session_name
                if session_name in existing_member_ids or any(
                    name == session_name or name.startswith(session_name + " ")
                    for name in existing_names
                ):
                    skipped.append(session_name)
                    continue

                if first and reuse_base_for_first:
                    session = split_from
                    first = False
                else:
                    session = await split_from.async_split_pane(vertical=True)
                    split_from = session
                    first = False

                await session.async_set_name(session_name)
                await asyncio.sleep(0.05)
                cd_cmd, open_cmd = _bootstrap_commands(
                    root,
                    project,
                    role,
                    feature_id,
                    role_models,
                    member_languages,
                    member_id,
                )
                await session.async_send_text(cd_cmd + "\n")
                await asyncio.sleep(0.05)
                await session.async_send_text(open_cmd + "\n")
                created.append(session_name)
                existing_names.append(session_name)
                existing_member_ids.add(session_name)

        print("Opened sessions: " + (", ".join(created) if created else "(none)"))
        if skipped:
            print("Skipped existing sessions: " + ", ".join(skipped))

    iterm2.run_until_complete(_run, retry=True)


def open_tmux_sessions(
    root: Path,
    team: dict,
    project: str,
    feature_id: str,
    role_models: dict,
    member_languages: dict,
    tmux_session_name: str = "",
):
    context = tmux_current_context()
    session_name = tmux_session_name or context["session_name"]
    panes = list_tmux_panes(session_name=session_name)

    if tmux_session_name and tmux_session_name != context["session_name"] and panes:
        target_window_id = panes[0]["window_id"]
        base_pane_id = panes[0]["pane_id"]
    else:
        target_window_id = context["window_id"]
        base_pane_id = context["pane_id"]

    target_window_panes = [pane for pane in panes if pane.get("window_id") == target_window_id]
    existing_titles = [pane.get("pane_title", "").strip() for pane in target_window_panes if pane.get("pane_title", "").strip()]
    missing_titles = compute_missing_pane_titles(existing_titles, team, role_order=ALLOWED_ROLES)

    if not missing_titles:
        print("Opened sessions: (none)")
        return

    created = []
    reusable_base = not existing_titles and base_pane_id

    for index, session_name_title in enumerate(missing_titles):
        role, seq = session_name_title.split("-", 1)
        member_id = f"{role}-{seq}"
        cd_cmd, open_cmd = _bootstrap_commands(
            root,
            project,
            role,
            feature_id,
            role_models,
            member_languages,
            member_id,
        )

        if index == 0 and reusable_base:
            pane_id = base_pane_id
        else:
            pane_id = split_tmux_pane(base_pane_id)
            select_tmux_layout(target_window_id)
            base_pane_id = pane_id

        set_tmux_pane_title(pane_id, session_name_title)
        send_tmux_text(pane_id, cd_cmd)
        send_tmux_text(pane_id, open_cmd)
        created.append(session_name_title)

    print("Opened sessions: " + ", ".join(created))


def main():
    parser = argparse.ArgumentParser(description="Generate team roster and bootstrap role sessions")
    parser.add_argument("--project", required=True)
    parser.add_argument("--team", default="", help="PM:1,ARCH:1,BE:1,FE:1,QA:1")
    parser.add_argument("--feature-id", default="")
    parser.add_argument(
        "--languages",
        default=os.getenv("SOLO_ROLE_LANGUAGES", ""),
        help="Optional per-member language map, e.g. BE-1:golang,FE-1:vue",
    )
    parser.add_argument(
        "--model-map",
        "--models",
        dest="model_map",
        default=os.getenv("SOLO_MODEL_MAP", ""),
        help="Optional per-role model map, e.g. PM:provider/model,ARCH:provider/model",
    )
    parser.add_argument("--backend", default="auto", help="Terminal backend: auto|iterm2|tmux")
    parser.add_argument("--tmux-session", default="", help="Optional tmux session name override")
    parser.add_argument("--no-open-iterm", action="store_true")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    workspace_root = resolve_workspace_root(script_dir)
    project_docs = ensure_project_docs(workspace_root, args.project)
    team_from_file = load_team_md(project_docs)
    if team_from_file is not None:
        team = team_from_file
        print(f"Loaded existing team.md: {project_docs / 'team.md'}")
    else:
        if not args.team:
            raise ValueError("--team is required when team.md does not exist")
        team = parse_team(args.team)

    member_languages = resolve_member_languages(
        team,
        parse_member_language_map(args.languages),
    )

    role_models = normalize_role_models(parse_model_map(args.model_map))
    ensured_standards = ensure_coding_standards(workspace_root, member_languages)
    ensure_project_base_files(project_docs, args.project)
    team_path = project_docs / "team.md"
    if team_from_file is None:
        team_path = write_team_md(project_docs, args.project, team)
    else:
        team_path = write_team_md(project_docs, args.project, team)
    members_path = write_team_members_md(
        project_docs,
        args.project,
        team,
        args.feature_id,
        member_languages,
    )

    print(f"Updated: {team_path}")
    print(f"Generated: {members_path}")
    if ensured_standards:
        for path in ensured_standards:
            print(f"Generated coding standard: {path}")

    if args.no_open_iterm:
        print("Skip terminal bootstrap (--no-open-iterm)")
        return

    try:
        backend = resolve_backend(args.backend)
        if backend == "tmux":
            open_tmux_sessions(
                workspace_root,
                team,
                args.project,
                args.feature_id,
                role_models,
                member_languages,
                args.tmux_session.strip(),
            )
        else:
            open_iterm_sessions(
                workspace_root,
                team,
                args.project,
                args.feature_id,
                role_models,
                member_languages,
            )
    except ModuleNotFoundError:
        print("iterm2 module not found. Run: pip install iterm2")
    except Exception as exc:
        print(f"Terminal bootstrap failed: {exc}")


if __name__ == "__main__":
    main()
