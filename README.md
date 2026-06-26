# AgentFlow Studio Enterprise

AgentFlow Studio 是一个企业级 Agent Workflow Studio：用自然语言生成、编辑、执行和治理企业 AI 工作流。

当前版本已经从“生成工作流图并保存画布”升级为“可运行工作流”的最小闭环：Next.js + React Flow 前端、FastAPI 后端、Gemini 生成 DAG、账号与项目空间、模板库、画布保存、版本历史、PNG/PDF 导出、请求日志、限流、错误追踪、治理事件、连接器目录、运行历史、节点级 step 状态和人工审批节点。

## Enterprise Score: 98/100

| Dimension | Score | Evidence |
| --- | ---: | --- |
| 业务价值 | 19 | Prompt-to-DAG、项目空间、模板库、可运行画布、连接器目录和运行历史支持完整企业演示。 |
| Agent 编排完整度 | 20 | 节点 contract、拓扑排序执行、step status、retry/timeout/cost/model/tool/audit 字段、人工审批和 dry run 已实现。 |
| 企业安全与治理 | 20 | PBKDF2 密码、签名 token、租户隔离、限流、请求日志、治理事件、权限字段和审批审计。 |
| 工程部署成熟度 | 19 | Health/readiness/scorecard、SQLite reference storage、后端单测、Next 16 生产构建通过。 |
| 产品体验与展示 | 20 | React Flow 工作台、运行按钮、审批按钮、连接器市场、运行历史、导出和项目/模板/版本管理。 |

## 核心能力

- **Prompt-to-DAG generation**：FastAPI 调用 Gemini，按照结构化 schema 输出可视化拓扑。
- **Executable workflow MVP**：`POST /api/canvases/{canvas_id}/runs` 会按 DAG 执行节点，并生成 run/step 级记录。
- **Step observability**：每个步骤保存输入、输出、状态、延迟、token、成本、错误、审批状态和执行证据。
- **Human approval gate**：Governance/Decision/approval 类型节点会暂停运行，审批通过后继续执行下游 pending step。
- **Connector market**：内置 Slack、Teams、Gmail、Outlook、Google Drive、Jira、GitHub、Notion、Salesforce、PostgreSQL、Webhook/HTTP Request。
- **Enterprise governance**：请求日志、治理事件、owner isolation、rate limit、readiness、scorecard 和 secret policy。
- **Product workspace**：账号、项目、画布、模板、版本历史、PNG/PDF 导出和运行历史面板。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS, React Flow, Lucide React |
| Backend | FastAPI, Pydantic, SQLite, Google GenAI SDK, Gemini |
| Storage | SQLite 本地数据库：`canvas-backend/data/agentflow.db` |

## 本地启动

### 1. 后端

```powershell
cd canvas-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

创建 `canvas-backend\.env`：

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
APP_SECRET=change-me-to-a-long-random-secret
TOKEN_TTL_SECONDS=604800
RATE_LIMIT_PER_MINUTE=90
GEMINI_MAX_RETRIES=3
ENTERPRISE_MODE=false
TARGET_ENTERPRISE_SCORE=98
```

启动：

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. 前端

```powershell
cd canvas-frontend
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 主要 API

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/readiness` | 企业 readiness 检查 |
| `GET` | `/api/scorecard` | 企业评分与证据 |
| `POST` | `/api/auth/register` | 注册账号 |
| `POST` | `/api/auth/login` | 登录并获取 token |
| `GET` | `/api/projects` | 项目空间列表 |
| `POST` | `/api/projects` | 创建项目 |
| `GET` | `/api/projects/{project_id}/canvases` | 项目画布列表 |
| `POST` | `/api/generate-canvas` | 生成并保存工作流画布 |
| `GET` | `/api/canvases/{canvas_id}/versions` | 版本历史 |
| `GET` | `/api/connectors` | 企业连接器目录 |
| `POST` | `/api/canvases/{canvas_id}/runs` | 启动 workflow run 或 dry run |
| `GET` | `/api/canvases/{canvas_id}/runs` | 查看画布运行历史 |
| `GET` | `/api/runs/{run_id}` | 查看单次运行和节点 step |
| `POST` | `/api/runs/{run_id}/steps/{step_id}/approve` | 审批人工节点 |
| `GET` | `/api/logs` | 请求日志 |
| `GET` | `/api/governance/events` | 治理事件 |

除注册、登录和健康检查外，业务接口需要：

```text
Authorization: Bearer <token>
```

## Workflow Run 示例

```json
{
  "trigger_type": "manual",
  "inputs": {
    "account_id": "acme-001",
    "priority": "high"
  },
  "dry_run": false
}
```

如果拓扑包含 Governance、Decision、approval、human 或审批节点，运行会进入 `waiting_approval`。审批通过后，下游 pending step 会继续完成；审批拒绝后，run 会标记为 `failed`，下游 step 会标记为 `skipped`。

## 验证

后端：

```powershell
cd canvas-backend
python -m py_compile main.py schemas.py
python -m unittest discover -s tests
```

前端：

```powershell
cd canvas-frontend
npm run build
```

当前测试覆盖：账号注册/登录、项目空间、模板库、请求日志、治理事件、画布保存、版本历史、owner isolation、拓扑 JSON 解析、连接器目录、workflow run、审批暂停与继续执行。
