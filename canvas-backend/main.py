import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from schemas import (
    ApprovalAction,
    AuthResponse,
    CanvasOut,
    CanvasSave,
    ConnectorInvocationOut,
    ConnectorOut,
    EdgeData,
    GenerateCanvasResponse,
    NodeData,
    ObservabilitySummary,
    ProjectCreate,
    ProjectMemberOut,
    ProjectOut,
    RequestLogOut,
    TemplateOut,
    TopologyResponse,
    UserCreate,
    UserLogin,
    UserOut,
    UserPrompt,
    VersionOut,
    StepRunOut,
    WorkflowRunCreate,
    WorkflowRunOut,
)

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
app_secret = os.getenv("APP_SECRET", "agentflow-dev-secret-change-me")
token_ttl_seconds = int(os.getenv("TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60)))
rate_limit_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "90"))
gemini_max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
enterprise_mode = os.getenv("ENTERPRISE_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
connector_execution_enabled = os.getenv("CONNECTOR_EXECUTION_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "agentflow.db"

AGENT_PROFILES: dict[str, str] = {
    "general": "通用工作流架构师：适合业务、学习、科研、项目管理和个人目标拆解。",
    "product": "产品交付架构师：强调用户价值、需求澄清、研发协同、测试验收、发布和增长复盘。",
    "operations": "运营增长架构师：强调人群洞察、触达策略、自动化执行、指标监控和活动复盘。",
    "research": "研究项目架构师：强调问题定义、文献综述、实验设计、数据分析、论文写作和同行反馈。",
    "learning": "学习教练架构师：强调目标拆解、资料筛选、刻意练习、阶段测验和成果展示。",
}

BUILTIN_TEMPLATES = [
    (
        "产品上线计划",
        "Product",
        "从需求澄清到灰度发布的产品交付拓扑。",
        "为一个 SaaS 新功能上线制定 agent 工作流：从用户需求澄清、竞品调研、方案设计、研发协作、测试验收、灰度发布到复盘增长。",
        "product",
    ),
    (
        "会员增长活动",
        "Operations",
        "适合线上运营活动和增长实验。",
        "为一次线上会员增长活动设计 agent 编排：包含人群洞察、权益设计、内容投放、自动化触达、数据监控、风险控制和复盘。",
        "operations",
    ),
    (
        "30 天学习计划",
        "Learning",
        "把学习目标拆成日常行动、练习和验收。",
        "为 30 天掌握数据分析基础设计学习 agent：包含目标拆解、资料筛选、每日练习、项目实战、复盘测试和成果展示。",
        "learning",
    ),
    (
        "科研课题推进",
        "Research",
        "面向科研问题定义、实验设计和论文产出。",
        "为一个科研课题推进设计 agent 工作流：包含问题定义、文献综述、实验设计、数据采集、分析验证、论文写作和同行反馈。",
        "research",
    ),
]

CONNECTOR_CATALOG: list[dict[str, Any]] = [
    {
        "id": "slack",
        "name": "Slack",
        "category": "Collaboration",
        "description": "Send channel messages, collect approvals, and notify workflow owners.",
        "auth_type": "oauth2",
        "triggers": ["message_posted", "approval_response"],
        "actions": ["send_message", "create_approval_request", "upload_file"],
        "required_scopes": ["chat:write", "channels:read"],
        "risk_level": "medium",
    },
    {
        "id": "teams",
        "name": "Microsoft Teams",
        "category": "Collaboration",
        "description": "Post adaptive cards and route human approval tasks.",
        "auth_type": "oauth2",
        "triggers": ["card_submitted", "channel_message"],
        "actions": ["post_card", "send_message"],
        "required_scopes": ["ChannelMessage.Send"],
        "risk_level": "medium",
    },
    {
        "id": "gmail",
        "name": "Gmail",
        "category": "Email",
        "description": "Read labeled mail, draft responses, and send approved outreach.",
        "auth_type": "oauth2",
        "triggers": ["new_email", "label_applied"],
        "actions": ["draft_email", "send_email", "apply_label"],
        "required_scopes": ["gmail.modify"],
        "risk_level": "high",
    },
    {
        "id": "outlook",
        "name": "Outlook",
        "category": "Email",
        "description": "Create drafts, send messages, and coordinate calendar follow-ups.",
        "auth_type": "oauth2",
        "triggers": ["new_mail", "calendar_event"],
        "actions": ["create_draft", "send_mail", "create_event"],
        "required_scopes": ["Mail.Send", "Calendars.ReadWrite"],
        "risk_level": "high",
    },
    {
        "id": "google_drive",
        "name": "Google Drive",
        "category": "Knowledge",
        "description": "Search documents, attach artifacts, and persist generated files.",
        "auth_type": "oauth2",
        "triggers": ["file_created", "file_updated"],
        "actions": ["search_files", "read_file", "write_file"],
        "required_scopes": ["drive.file"],
        "risk_level": "medium",
    },
    {
        "id": "jira",
        "name": "Jira",
        "category": "Work Management",
        "description": "Create issues, update status, and link workflow execution evidence.",
        "auth_type": "api_token",
        "triggers": ["issue_updated", "sprint_started"],
        "actions": ["create_issue", "transition_issue", "add_comment"],
        "required_scopes": ["write:jira-work"],
        "risk_level": "medium",
    },
    {
        "id": "github",
        "name": "GitHub",
        "category": "Developer",
        "description": "Open issues, comment on pull requests, and dispatch CI workflows.",
        "auth_type": "github_app",
        "triggers": ["pull_request", "workflow_run"],
        "actions": ["create_issue", "comment_pr", "dispatch_workflow"],
        "required_scopes": ["issues:write", "pull_requests:write", "actions:write"],
        "risk_level": "high",
    },
    {
        "id": "notion",
        "name": "Notion",
        "category": "Knowledge",
        "description": "Read workspace pages and write execution summaries to databases.",
        "auth_type": "oauth2",
        "triggers": ["page_updated", "database_item_created"],
        "actions": ["query_database", "create_page", "update_page"],
        "required_scopes": ["read_content", "update_content"],
        "risk_level": "medium",
    },
    {
        "id": "salesforce",
        "name": "Salesforce",
        "category": "CRM",
        "description": "Read accounts, update opportunities, and write governed sales notes.",
        "auth_type": "oauth2",
        "triggers": ["lead_created", "opportunity_updated"],
        "actions": ["query_records", "update_record", "create_task"],
        "required_scopes": ["api", "refresh_token"],
        "risk_level": "high",
    },
    {
        "id": "postgres",
        "name": "PostgreSQL",
        "category": "Database",
        "description": "Run approved SQL reads and write structured workflow outputs.",
        "auth_type": "secret",
        "triggers": ["schedule", "webhook"],
        "actions": ["select", "insert", "update"],
        "required_scopes": ["database:read", "database:write"],
        "risk_level": "high",
    },
    {
        "id": "webhook",
        "name": "Webhook / HTTP Request",
        "category": "Integration",
        "description": "Trigger workflows from external systems and call governed HTTP APIs.",
        "auth_type": "api_key",
        "triggers": ["incoming_webhook", "schedule"],
        "actions": ["http_get", "http_post", "http_patch"],
        "required_scopes": ["endpoint:invoke"],
        "risk_level": "medium",
    },
]

SYSTEM_PROMPT = """
你是 AgentFlow Orchestrator，一个面向生产场景的通用工作流架构 agent。
你的任务是把用户输入的业务、产品、运营、学习、科研、创作、项目管理或组织协作目标，拆解成一张可执行的 agent 工作流拓扑。

输出要求：
1. 使用中文。
2. 根据用户输入识别真实领域，不要默认成企业数字化转型。
3. summary 用 2-4 句话说明整体执行策略、关键路径和落地优先级。
4. nodes 输出 5-10 个节点，每个节点代表一个可执行能力、流程阶段、决策点、数据来源、工具模块或治理动作。
5. edges 只允许引用 nodes 中存在的 id，表达真实依赖，不要制造无意义连线。
6. node.type 只能从以下类型中选择：Input、Research、Planning、Execution、Automation、Review、Decision、Governance、Risk。
7. description 必须具体说明该节点要做什么、产出什么、为什么重要。
8. 输出必须严格符合 JSON 结构，不要包含 markdown、代码块或额外解释。
"""

app = FastAPI(title="AgentFlow Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db() -> Any:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now_ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def enterprise_warnings() -> list[str]:
    warnings: list[str] = []
    if enterprise_mode and app_secret == "agentflow-dev-secret-change-me":
        warnings.append("APP_SECRET must be changed before enterprise deployment.")
    if rate_limit_per_minute <= 0:
        warnings.append("RATE_LIMIT_PER_MINUTE should be enabled.")
    if token_ttl_seconds <= 0:
        warnings.append("TOKEN_TTL_SECONDS must be positive.")
    if gemini_max_retries <= 0:
        warnings.append("GEMINI_MAX_RETRIES should be positive.")
    return warnings


def readiness_payload() -> dict[str, Any]:
    checks = [
        {"id": "database", "ok": DB_PATH.exists(), "detail": str(DB_PATH)},
        {"id": "templates", "ok": True, "detail": "Builtin templates are inserted during startup."},
        {"id": "connectors", "ok": len(CONNECTOR_CATALOG) >= 10, "detail": f"{len(CONNECTOR_CATALOG)} enterprise connector definitions"},
        {"id": "execution_engine", "ok": True, "detail": "Workflow runs, step runs, dry run, and approval continuation are enabled."},
        {"id": "rbac", "ok": True, "detail": "Project membership roles enforce viewer/editor/admin/owner boundaries."},
        {"id": "workflow_queue", "ok": True, "detail": "Runs are tracked through queue and worker-style processing states."},
        {"id": "connector_audit", "ok": True, "detail": f"Connector execution enabled: {connector_execution_enabled}; invocation audit is persisted."},
        {"id": "rate_limit", "ok": rate_limit_per_minute > 0, "detail": f"{rate_limit_per_minute}/min"},
        {"id": "token_ttl", "ok": token_ttl_seconds > 0, "detail": f"{token_ttl_seconds}s"},
        {"id": "secret_policy", "ok": (not enterprise_mode) or app_secret != "agentflow-dev-secret-change-me", "detail": "APP_SECRET must be unique in enterprise mode."},
        {"id": "model_provider", "ok": True, "detail": f"Gemini model: {gemini_model}; key configured: {bool(api_key)}"},
    ]
    warnings = enterprise_warnings()
    ready = all(item["ok"] for item in checks) and not warnings
    return {"ready": ready, "warnings": warnings, "checks": checks}


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="请输入有效邮箱。")
    return email


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return salt, digest.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    _, actual_hash = hash_password(password, salt)
    return hmac.compare_digest(actual_hash, expected_hash)


def sign_token(user_id: int) -> str:
    expires_at = int(time.time()) + token_ttl_seconds
    payload = f"{user_id}:{expires_at}"
    signature = hmac.new(app_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode("utf-8")).decode("utf-8")


def verify_token(token: str) -> int:
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        user_id, expires_at, signature = decoded.split(":", 2)
        payload = f"{user_id}:{expires_at}"
        expected = hmac.new(app_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("bad signature")
        if int(expires_at) < int(time.time()):
            raise ValueError("expired")
        return int(user_id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录。") from exc


def get_current_user(authorization: Optional[str] = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="请先登录。")

    user_id = verify_token(authorization.split(" ", 1)[1].strip())
    with db() as conn:
        user = conn.execute("SELECT id, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="账号不存在或已失效。")
    return user


def row_to_user(row: sqlite3.Row) -> UserOut:
    return UserOut(id=row["id"], email=row["email"], created_at=row["created_at"])


def row_to_project(row: sqlite3.Row) -> ProjectOut:
    return ProjectOut(
        id=row["id"],
        name=row["name"],
        description=row["description"] or "",
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def row_to_canvas(row: sqlite3.Row) -> CanvasOut:
    return CanvasOut(
        id=row["id"],
        project_id=row["project_id"],
        title=row["title"],
        prompt=row["prompt"] or "",
        summary=row["summary"],
        nodes=[NodeData(**item) for item in json.loads(row["nodes_json"])],
        edges=[EdgeData(**item) for item in json.loads(row["edges_json"])],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def row_to_version(row: sqlite3.Row) -> VersionOut:
    return VersionOut(
        id=row["id"],
        canvas_id=row["canvas_id"],
        version=row["version"],
        prompt=row["prompt"] or "",
        summary=row["summary"],
        nodes=[NodeData(**item) for item in json.loads(row["nodes_json"])],
        edges=[EdgeData(**item) for item in json.loads(row["edges_json"])],
        created_at=row["created_at"],
    )


def safe_json_loads(raw: Optional[str], fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return fallback


def row_to_step_run(row: sqlite3.Row) -> StepRunOut:
    return StepRunOut(
        id=row["id"],
        run_id=row["run_id"],
        node_id=row["node_id"],
        label=row["label"],
        type=row["type"],
        status=row["status"],
        attempt=row["attempt"],
        latency_ms=row["latency_ms"],
        token_usage=row["token_usage"],
        cost_usd=row["cost_usd"],
        input=safe_json_loads(row["input_json"], {}),
        output=safe_json_loads(row["output_json"], {}),
        error=row["error"] or "",
        approval_required=bool(row["approval_required"]),
        approval_status=row["approval_status"] or "",
        started_at=row["started_at"],
        finished_at=row["finished_at"],
    )


def row_to_workflow_run(row: sqlite3.Row, steps: Optional[list[StepRunOut]] = None, queue_status: str = "") -> WorkflowRunOut:
    return WorkflowRunOut(
        id=row["id"],
        canvas_id=row["canvas_id"],
        status=row["status"],
        trigger_type=row["trigger_type"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        duration_ms=row["duration_ms"],
        total_tokens=row["total_tokens"],
        total_cost_usd=row["total_cost_usd"],
        queue_status=queue_status,
        inputs=safe_json_loads(row["input_json"], {}),
        error=row["error"] or "",
        steps=steps or [],
    )


def row_to_connector_invocation(row: sqlite3.Row) -> ConnectorInvocationOut:
    return ConnectorInvocationOut(
        id=row["id"],
        run_id=row["run_id"],
        step_id=row["step_id"],
        connector_id=row["connector_id"],
        status=row["status"],
        duration_ms=row["duration_ms"],
        request=safe_json_loads(row["request_json"], {}),
        response=safe_json_loads(row["response_json"], {}),
        error=row["error"] or "",
        created_at=row["created_at"],
    )


def topology_to_json(canvas: TopologyResponse) -> tuple[str, str]:
    nodes = [node.model_dump() if hasattr(node, "model_dump") else node.dict() for node in canvas.nodes]
    edges = [edge.model_dump() if hasattr(edge, "model_dump") else edge.dict() for edge in canvas.edges]
    return json.dumps(nodes, ensure_ascii=False), json.dumps(edges, ensure_ascii=False)


def assert_project_owner(conn: sqlite3.Connection, project_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在。")
    return row


def assert_canvas_owner(conn: sqlite3.Connection, canvas_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT c.* FROM canvases c JOIN projects p ON p.id = c.project_id WHERE c.id = ? AND p.user_id = ?",
        (canvas_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="画布不存在。")
    return row


ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3, "owner": 4}


def role_allows(actual_role: str, required_role: str) -> bool:
    return ROLE_RANK.get(actual_role, 0) >= ROLE_RANK.get(required_role, 0)


def assert_project_access(conn: sqlite3.Connection, project_id: int, user_id: int, required_role: str = "viewer") -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT p.*, pm.role AS member_role
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE p.id = ? AND pm.user_id = ?
        """,
        (project_id, user_id),
    ).fetchone()
    if not row:
        owner_project = conn.execute("SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)).fetchone()
        if owner_project:
            conn.execute(
                "INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
                (project_id, user_id, owner_project["created_at"]),
            )
            row = conn.execute(
                """
                SELECT p.*, pm.role AS member_role
                FROM projects p
                JOIN project_members pm ON pm.project_id = p.id
                WHERE p.id = ? AND pm.user_id = ?
                """,
                (project_id, user_id),
            ).fetchone()
    if not row or not role_allows(row["member_role"], required_role):
        raise HTTPException(status_code=404, detail="Project not found or access denied.")
    return row


def assert_project_owner(conn: sqlite3.Connection, project_id: int, user_id: int) -> sqlite3.Row:
    return assert_project_access(conn, project_id, user_id, "editor")


def assert_canvas_owner(conn: sqlite3.Connection, canvas_id: int, user_id: int, required_role: str = "viewer") -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT c.*
        FROM canvases c
        JOIN project_members pm ON pm.project_id = c.project_id
        WHERE c.id = ? AND pm.user_id = ?
        """,
        (canvas_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Canvas not found or access denied.")
    assert_project_access(conn, row["project_id"], user_id, required_role)
    return row


def create_version(conn: sqlite3.Connection, canvas_id: int, prompt: str, canvas: TopologyResponse) -> VersionOut:
    nodes_json, edges_json = topology_to_json(canvas)
    row = conn.execute("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM canvas_versions WHERE canvas_id = ?", (canvas_id,)).fetchone()
    version = int(row["next_version"])
    created_at = now_ts()
    cur = conn.execute(
        """
        INSERT INTO canvas_versions (canvas_id, version, prompt, summary, nodes_json, edges_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (canvas_id, version, prompt, canvas.summary, nodes_json, edges_json, created_at),
    )
    version_row = conn.execute("SELECT * FROM canvas_versions WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row_to_version(version_row)


def save_canvas_record(
    conn: sqlite3.Connection,
    user_id: int,
    project_id: int,
    title: str,
    prompt: str,
    canvas: TopologyResponse,
    canvas_id: Optional[int] = None,
) -> tuple[CanvasOut, VersionOut]:
    assert_project_owner(conn, project_id, user_id)
    nodes_json, edges_json = topology_to_json(canvas)
    timestamp = now_ts()

    if canvas_id:
        assert_canvas_owner(conn, canvas_id, user_id, "editor")
        conn.execute(
            """
            UPDATE canvases
            SET project_id = ?, title = ?, prompt = ?, summary = ?, nodes_json = ?, edges_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (project_id, title, prompt, canvas.summary, nodes_json, edges_json, timestamp, canvas_id),
        )
        saved_id = canvas_id
    else:
        cur = conn.execute(
            """
            INSERT INTO canvases (project_id, title, prompt, summary, nodes_json, edges_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, title, prompt, canvas.summary, nodes_json, edges_json, timestamp, timestamp),
        )
        saved_id = cur.lastrowid

    version = create_version(conn, saved_id, prompt, canvas)
    canvas_row = conn.execute("SELECT * FROM canvases WHERE id = ?", (saved_id,)).fetchone()
    return row_to_canvas(canvas_row), version


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS project_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TEXT NOT NULL,
                UNIQUE(project_id, user_id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS canvases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                prompt TEXT DEFAULT '',
                summary TEXT NOT NULL,
                nodes_json TEXT NOT NULL,
                edges_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS canvas_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                canvas_id INTEGER NOT NULL,
                version INTEGER NOT NULL,
                prompt TEXT DEFAULT '',
                summary TEXT NOT NULL,
                nodes_json TEXT NOT NULL,
                edges_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(canvas_id) REFERENCES canvases(id)
            );

            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                prompt TEXT NOT NULL,
                profile TEXT NOT NULL,
                is_builtin INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS request_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                error TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS governance_events (
                event_id TEXT PRIMARY KEY,
                user_id INTEGER,
                event_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                event_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workflow_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                canvas_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                input_json TEXT NOT NULL,
                error TEXT DEFAULT '',
                total_tokens INTEGER NOT NULL DEFAULT 0,
                total_cost_usd REAL NOT NULL DEFAULT 0,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                FOREIGN KEY(canvas_id) REFERENCES canvases(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS workflow_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL UNIQUE,
                status TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 100,
                enqueued_at TEXT NOT NULL,
                dequeued_at TEXT,
                completed_at TEXT,
                FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
            );

            CREATE TABLE IF NOT EXISTS workflow_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                node_id TEXT NOT NULL,
                label TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                attempt INTEGER NOT NULL DEFAULT 1,
                latency_ms INTEGER NOT NULL DEFAULT 0,
                token_usage INTEGER NOT NULL DEFAULT 0,
                cost_usd REAL NOT NULL DEFAULT 0,
                input_json TEXT NOT NULL DEFAULT '{}',
                output_json TEXT NOT NULL DEFAULT '{}',
                error TEXT DEFAULT '',
                approval_required INTEGER NOT NULL DEFAULT 0,
                approval_status TEXT DEFAULT '',
                started_at TEXT NOT NULL,
                finished_at TEXT,
                FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
            );

            CREATE TABLE IF NOT EXISTS connector_invocations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                step_id INTEGER,
                connector_id TEXT NOT NULL,
                status TEXT NOT NULL,
                request_json TEXT NOT NULL DEFAULT '{}',
                response_json TEXT NOT NULL DEFAULT '{}',
                duration_ms INTEGER NOT NULL DEFAULT 0,
                error TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(run_id) REFERENCES workflow_runs(id),
                FOREIGN KEY(step_id) REFERENCES workflow_steps(id)
            );
            """
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at)
            SELECT id, user_id, 'owner', created_at FROM projects
            """
        )
        for name, category, description, prompt, profile in BUILTIN_TEMPLATES:
            conn.execute(
                """
                INSERT OR IGNORE INTO templates (name, category, description, prompt, profile, is_builtin)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (name, category, description, prompt, profile),
            )


rate_buckets: dict[str, deque[float]] = defaultdict(deque)


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        key = f"{request.client.host if request.client else 'unknown'}:{request.url.path}"
        now = time.time()
        bucket = rate_buckets[key]
        while bucket and bucket[0] < now - 60:
            bucket.popleft()
        if len(bucket) >= rate_limit_per_minute:
            return JSONResponse(status_code=429, content={"detail": "请求过于频繁，请稍后再试。"})
        bucket.append(now)

        started = time.perf_counter()
        status_code = 500
        error = ""
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            error = str(exc)
            raise
        finally:
            duration_ms = int((time.perf_counter() - started) * 1000)
            user_id = None
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                try:
                    user_id = verify_token(auth.split(" ", 1)[1].strip())
                except Exception:
                    user_id = None
            try:
                with db() as conn:
                    conn.execute(
                        """
                        INSERT INTO request_logs (user_id, method, path, status_code, duration_ms, error, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (user_id, request.method, request.url.path, status_code, duration_ms, error[:500], now_ts()),
                    )
            except Exception:
                pass


def write_governance_event(event_type: str, payload: dict[str, Any], user_id: Optional[int] = None) -> dict[str, Any]:
    event = {
        "event_id": secrets.token_hex(8),
        "event_type": event_type,
        "user_id": user_id,
        "created_at": now_ts(),
        "payload": payload,
    }
    with db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO governance_events (event_id, user_id, event_type, created_at, event_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                event["event_id"],
                user_id,
                event_type,
                event["created_at"],
                json.dumps(event, ensure_ascii=False, default=str),
            ),
        )
    return event


def list_governance_events(user_id: Optional[int], limit: int = 50) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT event_json
            FROM governance_events
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [json.loads(row["event_json"]) for row in rows]


def topological_nodes(nodes: list[NodeData], edges: list[EdgeData]) -> list[NodeData]:
    by_id = {node.id: node for node in nodes}
    indegree = {node.id: 0 for node in nodes}
    outgoing: dict[str, list[str]] = {node.id: [] for node in nodes}
    for edge in edges:
        if edge.source in by_id and edge.target in by_id:
            outgoing[edge.source].append(edge.target)
            indegree[edge.target] += 1

    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    ordered: list[NodeData] = []
    while queue:
        node_id = queue.popleft()
        ordered.append(by_id[node_id])
        for target in outgoing[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    if len(ordered) != len(nodes):
        seen = {node.id for node in ordered}
        ordered.extend([node for node in nodes if node.id not in seen])
    return ordered


def node_payload(node: NodeData) -> dict[str, Any]:
    if hasattr(node, "model_dump"):
        return node.model_dump()
    return node.dict()


def is_approval_node(node: NodeData) -> bool:
    marker = f"{node.type or ''} {node.label} {node.description or ''}".lower()
    return any(term in marker for term in ["approval", "approve", "human", "gate", "审批", "人工"]) or (node.type or "").lower() in {
        "decision",
        "governance",
    }


def simulated_step_output(node: NodeData, trigger_type: str, approved_note: str = "") -> dict[str, Any]:
    return {
        "node_id": node.id,
        "label": node.label,
        "status": "completed",
        "tool": node.tool or "built-in executor",
        "model": node.model or gemini_model,
        "artifact": f"{node.label} execution evidence",
        "trigger_type": trigger_type,
        "approved_note": approved_note,
        "schema": {
            "input": node.input_schema,
            "output": node.output_schema or {"result": "string", "evidence": "object"},
        },
    }


def estimate_step_usage(node: NodeData, ordinal: int) -> tuple[int, int, float]:
    base = len(node.label) + len(node.description or "")
    token_usage = max(80, min(2000, base * 3 + 40 + ordinal * 7))
    latency_ms = min(node.timeout_seconds * 1000, 180 + ordinal * 65 + base * 2)
    cost_usd = round(float(node.cost_estimate_usd or 0) + token_usage * 0.000002, 6)
    return token_usage, latency_ms, cost_usd


def insert_step(
    conn: sqlite3.Connection,
    run_id: int,
    node: NodeData,
    status: str,
    ordinal: int,
    step_input: dict[str, Any],
    step_output: Optional[dict[str, Any]] = None,
    approval_required: bool = False,
    approval_status: str = "",
) -> int:
    token_usage, latency_ms, cost_usd = estimate_step_usage(node, ordinal)
    finished_at = None if status in {"pending", "waiting_approval"} else now_ts()
    cur = conn.execute(
        """
        INSERT INTO workflow_steps (
            run_id, node_id, label, type, status, attempt, latency_ms, token_usage, cost_usd,
            input_json, output_json, error, approval_required, approval_status, started_at, finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)
        """,
        (
            run_id,
            node.id,
            node.label,
            node.type or "Planning",
            status,
            1,
            0 if status == "pending" else latency_ms,
            0 if status == "pending" else token_usage,
            0 if status == "pending" else cost_usd,
            json.dumps(step_input, ensure_ascii=False),
            json.dumps(step_output or {}, ensure_ascii=False),
            1 if approval_required else 0,
            approval_status,
            now_ts(),
            finished_at,
        ),
    )
    return int(cur.lastrowid)


def connector_ids() -> set[str]:
    return {item["id"] for item in CONNECTOR_CATALOG}


def record_connector_invocation(
    conn: sqlite3.Connection,
    run_id: int,
    step_id: Optional[int],
    node: NodeData,
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
    status: str = "simulated",
    error: str = "",
) -> None:
    connector_id = (node.tool or "").strip().lower()
    if not connector_id:
        return
    if connector_id not in connector_ids():
        connector_id = "custom"
    conn.execute(
        """
        INSERT INTO connector_invocations (
            run_id, step_id, connector_id, status, request_json, response_json, duration_ms, error, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            step_id,
            connector_id,
            status,
            json.dumps(request_payload, ensure_ascii=False),
            json.dumps(response_payload, ensure_ascii=False),
            int(response_payload.get("duration_ms", 0) or 0),
            error,
            now_ts(),
        ),
    )


def finalize_run_totals(conn: sqlite3.Connection, run_id: int, status: str, finished: bool, error: str = "") -> sqlite3.Row:
    aggregate = conn.execute(
        "SELECT COALESCE(SUM(token_usage), 0) AS tokens, COALESCE(SUM(cost_usd), 0) AS cost FROM workflow_steps WHERE run_id = ?",
        (run_id,),
    ).fetchone()
    run = conn.execute("SELECT * FROM workflow_runs WHERE id = ?", (run_id,)).fetchone()
    finished_at = now_ts() if finished else None
    duration_ms = int((time.time() - time.mktime(time.strptime(run["started_at"], "%Y-%m-%dT%H:%M:%SZ"))) * 1000)
    conn.execute(
        """
        UPDATE workflow_runs
        SET status = ?, finished_at = ?, duration_ms = ?, total_tokens = ?, total_cost_usd = ?, error = ?
        WHERE id = ?
        """,
        (status, finished_at, max(0, duration_ms), aggregate["tokens"], aggregate["cost"], error, run_id),
    )
    return conn.execute("SELECT * FROM workflow_runs WHERE id = ?", (run_id,)).fetchone()


def run_with_steps(conn: sqlite3.Connection, run_row: sqlite3.Row) -> WorkflowRunOut:
    rows = conn.execute("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY id", (run_row["id"],)).fetchall()
    queue = conn.execute("SELECT status FROM workflow_queue WHERE run_id = ?", (run_row["id"],)).fetchone()
    return row_to_workflow_run(run_row, [row_to_step_run(row) for row in rows], queue["status"] if queue else "")


def create_workflow_run(conn: sqlite3.Connection, user_id: int, canvas_row: sqlite3.Row, payload: WorkflowRunCreate) -> WorkflowRunOut:
    canvas = row_to_canvas(canvas_row)
    started_at = now_ts()
    cur = conn.execute(
        """
        INSERT INTO workflow_runs (canvas_id, user_id, status, trigger_type, input_json, started_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            canvas.id,
            user_id,
            "planned" if payload.dry_run else "running",
            payload.trigger_type,
            json.dumps(payload.inputs, ensure_ascii=False),
            started_at,
        ),
    )
    run_id = cur.lastrowid
    conn.execute(
        "INSERT OR REPLACE INTO workflow_queue (run_id, status, priority, enqueued_at) VALUES (?, ?, ?, ?)",
        (run_id, "planned" if payload.dry_run else "enqueued", 100, started_at),
    )
    if not payload.dry_run:
        conn.execute(
            "UPDATE workflow_queue SET status = 'processing', dequeued_at = ? WHERE run_id = ?",
            (now_ts(), run_id),
        )
    ordered_nodes = topological_nodes(canvas.nodes, canvas.edges)
    waiting_for_approval = False

    for index, node in enumerate(ordered_nodes, start=1):
        step_input = {
            "run_inputs": payload.inputs,
            "node_contract": node_payload(node),
            "upstream": [edge.source for edge in canvas.edges if edge.target == node.id],
        }
        if payload.dry_run:
            step_id = insert_step(conn, run_id, node, "planned", index, step_input, {"planned": True})
            record_connector_invocation(conn, run_id, step_id, node, step_input, {"planned": True}, status="planned")
            continue
        if waiting_for_approval:
            insert_step(conn, run_id, node, "pending", index, step_input)
            continue
        if is_approval_node(node):
            insert_step(
                conn,
                run_id,
                node,
                "waiting_approval",
                index,
                step_input,
                {
                    "approval_request": f"Review and approve node '{node.label}' before downstream execution.",
                    "policy": node.audit_policy,
                },
                approval_required=True,
                approval_status="pending",
            )
            waiting_for_approval = True
            continue
        step_output = simulated_step_output(node, payload.trigger_type)
        step_id = insert_step(conn, run_id, node, "completed", index, step_input, step_output)
        record_connector_invocation(conn, run_id, step_id, node, step_input, step_output)

    status = "planned" if payload.dry_run else ("waiting_approval" if waiting_for_approval else "completed")
    conn.execute(
        "UPDATE workflow_queue SET status = ?, completed_at = ? WHERE run_id = ?",
        (status, None if status == "waiting_approval" else now_ts(), run_id),
    )
    run_row = finalize_run_totals(conn, run_id, status, finished=(status in {"planned", "completed"}))
    return run_with_steps(conn, run_row)


def assert_run_owner(conn: sqlite3.Connection, run_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM workflow_runs WHERE id = ? AND user_id = ?", (run_id, user_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Workflow run not found.")
    return row


def approve_workflow_step(
    conn: sqlite3.Connection,
    run_id: int,
    step_id: int,
    user_id: int,
    payload: ApprovalAction,
) -> WorkflowRunOut:
    run = assert_run_owner(conn, run_id, user_id)
    step = conn.execute(
        "SELECT * FROM workflow_steps WHERE id = ? AND run_id = ? AND status = 'waiting_approval'",
        (step_id, run_id),
    ).fetchone()
    if not step:
        raise HTTPException(status_code=404, detail="Pending approval step not found.")

    finished_at = now_ts()
    if not payload.approved:
        conn.execute(
            """
            UPDATE workflow_steps
            SET status = 'rejected', approval_status = 'rejected', output_json = ?, finished_at = ?
            WHERE id = ?
            """,
            (json.dumps({"approved": False, "note": payload.note}, ensure_ascii=False), finished_at, step_id),
        )
        conn.execute("UPDATE workflow_steps SET status = 'skipped', finished_at = ? WHERE run_id = ? AND status = 'pending'", (finished_at, run_id))
        conn.execute("UPDATE workflow_queue SET status = 'failed', completed_at = ? WHERE run_id = ?", (finished_at, run_id))
        run_row = finalize_run_totals(conn, run_id, "failed", finished=True, error="Human approval rejected.")
        return run_with_steps(conn, run_row)

    conn.execute(
        """
        UPDATE workflow_steps
        SET status = 'completed', approval_status = 'approved', output_json = ?, finished_at = ?
        WHERE id = ?
        """,
        (json.dumps({"approved": True, "note": payload.note, "approved_by": user_id}, ensure_ascii=False), finished_at, step_id),
    )

    pending_rows = conn.execute("SELECT * FROM workflow_steps WHERE run_id = ? AND status = 'pending' ORDER BY id", (run_id,)).fetchall()
    for index, pending in enumerate(pending_rows, start=1):
        pending_input = safe_json_loads(pending["input_json"], {})
        contract = pending_input.get("node_contract", {})
        node = NodeData(**contract) if contract else NodeData(id=pending["node_id"], label=pending["label"], type=pending["type"])
        token_usage, latency_ms, cost_usd = estimate_step_usage(node, index)
        step_output = simulated_step_output(node, run["trigger_type"], payload.note)
        conn.execute(
            """
            UPDATE workflow_steps
            SET status = 'completed', latency_ms = ?, token_usage = ?, cost_usd = ?, output_json = ?, finished_at = ?
            WHERE id = ?
            """,
            (
                latency_ms,
                token_usage,
                cost_usd,
                json.dumps(step_output, ensure_ascii=False),
                now_ts(),
                pending["id"],
            ),
        )
        record_connector_invocation(conn, run_id, pending["id"], node, pending_input, step_output)

    conn.execute("UPDATE workflow_queue SET status = 'completed', completed_at = ? WHERE run_id = ?", (now_ts(), run_id))
    run_row = finalize_run_totals(conn, run_id, "completed", finished=True)
    return run_with_steps(conn, run_row)


def observability_summary(conn: sqlite3.Connection, user_id: int) -> ObservabilitySummary:
    run_rows = conn.execute(
        """
        SELECT status, COUNT(*) AS count
        FROM workflow_runs
        WHERE user_id = ?
        GROUP BY status
        """,
        (user_id,),
    ).fetchall()
    run_counts = {row["status"]: row["count"] for row in run_rows}
    totals = conn.execute(
        """
        SELECT
            COUNT(*) AS total_runs,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd,
            COALESCE(AVG(duration_ms), 0) AS avg_duration_ms
        FROM workflow_runs
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    step_rows = conn.execute(
        """
        SELECT ws.status, COUNT(*) AS count
        FROM workflow_steps ws
        JOIN workflow_runs wr ON wr.id = ws.run_id
        WHERE wr.user_id = ?
        GROUP BY ws.status
        """,
        (user_id,),
    ).fetchall()
    step_counts = {row["status"]: row["count"] for row in step_rows}
    connector_stats = conn.execute(
        """
        SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN ci.status = 'failed' THEN 1 ELSE 0 END), 0) AS failures
        FROM connector_invocations ci
        JOIN workflow_runs wr ON wr.id = ci.run_id
        WHERE wr.user_id = ?
        """,
        (user_id,),
    ).fetchone()
    errors = conn.execute(
        """
        SELECT id, method, path, status_code, error, created_at
        FROM request_logs
        WHERE (user_id = ? OR user_id IS NULL) AND status_code >= 400
        ORDER BY id DESC
        LIMIT 10
        """,
        (user_id,),
    ).fetchall()
    total_steps = sum(step_counts.values())
    return ObservabilitySummary(
        total_runs=totals["total_runs"],
        active_runs=run_counts.get("running", 0) + run_counts.get("waiting_approval", 0),
        failed_runs=run_counts.get("failed", 0),
        completed_runs=run_counts.get("completed", 0),
        waiting_approval_runs=run_counts.get("waiting_approval", 0),
        total_steps=total_steps,
        total_tokens=totals["total_tokens"],
        total_cost_usd=totals["total_cost_usd"],
        avg_duration_ms=totals["avg_duration_ms"],
        connector_invocations=connector_stats["total"],
        connector_failures=connector_stats["failures"],
        recent_errors=[dict(row) for row in errors],
        run_status_counts=run_counts,
        step_status_counts=step_counts,
    )


app.add_middleware(ObservabilityMiddleware)


def parse_topology_response(content: str) -> TopologyResponse:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        if hasattr(TopologyResponse, "model_validate_json"):
            return TopologyResponse.model_validate_json(cleaned)
        return TopologyResponse.parse_raw(cleaned)
    except Exception as exc:
        try:
            data = json.loads(cleaned)
            if hasattr(TopologyResponse, "model_validate"):
                return TopologyResponse.model_validate(data)
            return TopologyResponse.parse_obj(data)
        except Exception as parse_exc:
            raise ValueError(f"Gemini 返回内容不是有效的 TopologyResponse: {parse_exc}") from exc


async def call_gemini_canvas_agent(user_prompt: str, profile: str = "general") -> TopologyResponse:
    if not api_key:
        raise HTTPException(status_code=500, detail="未检测到 GEMINI_API_KEY，请在后端 .env 中配置。")

    profile_note = AGENT_PROFILES.get(profile or "general", AGENT_PROFILES["general"])
    client = genai.Client(api_key=api_key)
    prompt = f"场景目标：{user_prompt}\n\nAgent profile：{profile_note}"
    last_error: Optional[Exception] = None

    for attempt in range(gemini_max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.25,
                    response_mime_type="application/json",
                    response_schema=TopologyResponse,
                ),
            )
            content = getattr(response, "text", None)
            if not content:
                raise ValueError("Gemini 返回为空，请调整输入或检查模型配置。")
            return parse_topology_response(content)
        except Exception as exc:
            last_error = exc
            if attempt < gemini_max_retries - 1:
                await asyncio.sleep(0.5 * (attempt + 1))

    raise HTTPException(status_code=502, detail=f"Gemini 生成失败: {last_error}")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "provider": "gemini",
        "model": gemini_model,
        "has_api_key": bool(api_key),
        "database": str(DB_PATH),
        "enterprise_mode": enterprise_mode,
        "rate_limit_per_minute": rate_limit_per_minute,
    }


@app.get("/api/readiness")
async def readiness_check():
    payload = readiness_payload()
    return JSONResponse(status_code=200 if payload["ready"] else 503, content=payload)


@app.post("/api/auth/register", response_model=AuthResponse)
async def register(payload: UserCreate):
    email = normalize_email(payload.email)
    salt, password_hash = hash_password(payload.password)
    created_at = now_ts()
    with db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (email, password_hash, salt, created_at),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="该邮箱已注册。") from exc
        user_id = cur.lastrowid
        timestamp = now_ts()
        conn.execute(
            "INSERT INTO projects (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, "默认项目", "AgentFlow Studio 默认项目空间", timestamp, timestamp),
        )
        user = conn.execute("SELECT id, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    write_governance_event("auth.register", {"email": email}, user_id)
    return AuthResponse(token=sign_token(user_id), user=row_to_user(user))


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    email = normalize_email(payload.email)
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not verify_password(payload.password, user["salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误。")
    write_governance_event("auth.login", {"email": email}, user["id"])
    return AuthResponse(token=sign_token(user["id"]), user=row_to_user(user))


@app.get("/api/me", response_model=UserOut)
async def me(user: sqlite3.Row = Depends(get_current_user)):
    return row_to_user(user)


@app.get("/api/projects", response_model=list[ProjectOut])
async def list_projects(user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at)
            SELECT id, user_id, 'owner', created_at FROM projects WHERE user_id = ?
            """,
            (user["id"],),
        )
        rows = conn.execute(
            """
            SELECT p.*
            FROM projects p
            JOIN project_members pm ON pm.project_id = p.id
            WHERE pm.user_id = ?
            ORDER BY p.updated_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [row_to_project(row) for row in rows]


@app.post("/api/projects", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, user: sqlite3.Row = Depends(get_current_user)):
    timestamp = now_ts()
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO projects (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user["id"], payload.name.strip(), payload.description or "", timestamp, timestamp),
        )
        conn.execute(
            "INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
            (cur.lastrowid, user["id"], timestamp),
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (cur.lastrowid,)).fetchone()
    write_governance_event("project.created", {"project_id": row["id"], "name": row["name"]}, user["id"])
    return row_to_project(row)


@app.get("/api/projects/{project_id}/members", response_model=list[ProjectMemberOut])
async def list_project_members(project_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        assert_project_access(conn, project_id, user["id"], "viewer")
        rows = conn.execute(
            """
            SELECT pm.project_id, pm.user_id, u.email, pm.role, pm.created_at
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            WHERE pm.project_id = ?
            ORDER BY pm.role DESC, u.email
            """,
            (project_id,),
        ).fetchall()
    return [
        ProjectMemberOut(
            project_id=row["project_id"],
            user_id=row["user_id"],
            email=row["email"],
            role=row["role"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@app.get("/api/projects/{project_id}/canvases", response_model=list[CanvasOut])
async def list_canvases(project_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        assert_project_access(conn, project_id, user["id"], "viewer")
        rows = conn.execute("SELECT * FROM canvases WHERE project_id = ? ORDER BY updated_at DESC", (project_id,)).fetchall()
    return [row_to_canvas(row) for row in rows]


@app.post("/api/canvases", response_model=CanvasOut)
async def save_canvas(payload: CanvasSave, user: sqlite3.Row = Depends(get_current_user)):
    canvas = TopologyResponse(summary=payload.summary, nodes=payload.nodes, edges=payload.edges)
    with db() as conn:
        saved, _ = save_canvas_record(conn, user["id"], payload.project_id, payload.title, payload.prompt, canvas)
    write_governance_event("canvas.saved", {"canvas_id": saved.id, "project_id": payload.project_id, "title": saved.title}, user["id"])
    return saved


@app.get("/api/canvases/{canvas_id}", response_model=CanvasOut)
async def get_canvas(canvas_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        row = assert_canvas_owner(conn, canvas_id, user["id"])
    return row_to_canvas(row)


@app.get("/api/canvases/{canvas_id}/versions", response_model=list[VersionOut])
async def list_versions(canvas_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        assert_canvas_owner(conn, canvas_id, user["id"])
        rows = conn.execute("SELECT * FROM canvas_versions WHERE canvas_id = ? ORDER BY version DESC", (canvas_id,)).fetchall()
    return [row_to_version(row) for row in rows]


@app.get("/api/templates", response_model=list[TemplateOut])
async def list_templates(user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute("SELECT * FROM templates ORDER BY category, name").fetchall()
    return [
        TemplateOut(
            id=row["id"],
            name=row["name"],
            category=row["category"],
            description=row["description"],
            prompt=row["prompt"],
            profile=row["profile"],
        )
        for row in rows
    ]


@app.get("/api/connectors", response_model=list[ConnectorOut])
async def list_connectors(user: sqlite3.Row = Depends(get_current_user)):
    return [ConnectorOut(**item) for item in CONNECTOR_CATALOG]


@app.post("/api/canvases/{canvas_id}/runs", response_model=WorkflowRunOut)
async def start_canvas_run(canvas_id: int, payload: WorkflowRunCreate, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        canvas_row = assert_canvas_owner(conn, canvas_id, user["id"], "editor")
        run = create_workflow_run(conn, user["id"], canvas_row, payload)
    write_governance_event(
        "workflow.run.started",
        {"canvas_id": canvas_id, "run_id": run.id, "status": run.status, "trigger_type": payload.trigger_type},
        user["id"],
    )
    return run


@app.get("/api/canvases/{canvas_id}/runs", response_model=list[WorkflowRunOut])
async def list_canvas_runs(canvas_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        assert_canvas_owner(conn, canvas_id, user["id"])
        rows = conn.execute(
            "SELECT * FROM workflow_runs WHERE canvas_id = ? AND user_id = ? ORDER BY id DESC LIMIT 25",
            (canvas_id, user["id"]),
        ).fetchall()
        return [run_with_steps(conn, row) for row in rows]


@app.get("/api/runs/{run_id}", response_model=WorkflowRunOut)
async def get_workflow_run(run_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        run_row = assert_run_owner(conn, run_id, user["id"])
        return run_with_steps(conn, run_row)


@app.get("/api/runs/{run_id}/connector-invocations", response_model=list[ConnectorInvocationOut])
async def list_run_connector_invocations(run_id: int, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        assert_run_owner(conn, run_id, user["id"])
        rows = conn.execute(
            "SELECT * FROM connector_invocations WHERE run_id = ? ORDER BY id",
            (run_id,),
        ).fetchall()
    return [row_to_connector_invocation(row) for row in rows]


@app.post("/api/runs/{run_id}/steps/{step_id}/approve", response_model=WorkflowRunOut)
async def approve_step(run_id: int, step_id: int, payload: ApprovalAction, user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        run = approve_workflow_step(conn, run_id, step_id, user["id"], payload)
    write_governance_event(
        "workflow.step.approved" if payload.approved else "workflow.step.rejected",
        {"run_id": run_id, "step_id": step_id, "status": run.status, "note": payload.note},
        user["id"],
    )
    return run


@app.get("/api/observability/summary", response_model=ObservabilitySummary)
async def get_observability_summary(user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        return observability_summary(conn, user["id"])


@app.get("/api/logs", response_model=list[RequestLogOut])
async def list_logs(user: sqlite3.Row = Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM request_logs
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY id DESC
            LIMIT 100
            """,
            (user["id"],),
        ).fetchall()
    return [
        RequestLogOut(
            id=row["id"],
            method=row["method"],
            path=row["path"],
            status_code=row["status_code"],
            duration_ms=row["duration_ms"],
            error=row["error"] or "",
            created_at=row["created_at"],
        )
        for row in rows
    ]


@app.get("/api/governance/events")
async def governance_events(limit: int = 50, user: sqlite3.Row = Depends(get_current_user)):
    bounded_limit = max(1, min(limit, 200))
    return {"events": list_governance_events(user["id"], bounded_limit)}


@app.post("/api/generate-canvas", response_model=GenerateCanvasResponse)
async def generate_canvas(payload: UserPrompt, user: sqlite3.Row = Depends(get_current_user)):
    if not payload.user_prompt.strip():
        raise HTTPException(status_code=400, detail="请输入要拆解的场景目标。")

    with db() as conn:
        project_id = payload.project_id
        if project_id is None:
            row = conn.execute("SELECT * FROM projects WHERE user_id = ? ORDER BY id LIMIT 1", (user["id"],)).fetchone()
            if not row:
                timestamp = now_ts()
                cur = conn.execute(
                    "INSERT INTO projects (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (user["id"], "默认项目", "AgentFlow Studio 默认项目空间", timestamp, timestamp),
                )
                project_id = cur.lastrowid
            else:
                project_id = row["id"]
        assert_project_owner(conn, project_id, user["id"])

    topology = await call_gemini_canvas_agent(payload.user_prompt, payload.profile or "general")
    title = (payload.title or payload.user_prompt.strip().replace("\n", " ")[:48] or "Untitled Canvas").strip()

    with db() as conn:
        saved, version = save_canvas_record(
            conn,
            user["id"],
            project_id,
            title,
            payload.user_prompt,
            topology,
            payload.canvas_id,
        )
    write_governance_event(
        "canvas.generated",
        {"canvas_id": saved.id, "project_id": project_id, "version": version.version, "model": gemini_model},
        user["id"],
    )
    return GenerateCanvasResponse(
        summary=topology.summary,
        nodes=topology.nodes,
        edges=topology.edges,
        canvas=saved,
        version=version,
    )


if __name__ == "__main__":
    import uvicorn

    init_db()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
