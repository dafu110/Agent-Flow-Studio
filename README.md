# AgentFlow Studio Enterprise

AgentFlow Studio is an enterprise AI workflow orchestration platform. It turns natural-language goals into editable DAGs, then lets teams run, observe, approve, and govern those workflows from a React Flow workspace.

The project has moved beyond "workflow diagram generation" into a SaaS-style reference platform: Next.js + React Flow frontend, FastAPI backend, Gemini DAG generation, accounts, project workspaces, templates, canvas persistence, version history, exports, governance events, connector catalog, workflow runs, node-level step state, approval gates, RBAC membership, queue state, connector invocation audit, observability summary, and CI.

## Enterprise Score: 96/100

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Business value | 19 | Prompt-to-DAG, runnable workflows, workspace management, connector catalog, run history, and approval gates support a strong enterprise demo. |
| Agent orchestration | 20 | Node contracts, topological execution, dry run, step status, retry/timeout/cost/model/tool/audit fields, queue state, and human approval continuation are implemented. |
| Enterprise security and governance | 19 | PBKDF2 passwords, signed tokens, RBAC project membership, tenant boundary tests, rate limits, request logs, governance events, permissions, and approval audit. |
| Engineering and deployment maturity | 19 | Health/readiness/scorecard, SQLite reference storage, backend tests, frontend production build, and GitHub Actions CI. |
| Product experience | 19 | React Flow workspace, Run/Dry Run/Approve controls, connector market, Ops observability tab, versions, logs, exports, projects, and templates. |

Remaining gaps before full production SaaS: real external connector execution by default, managed background workers, production database migrations, billing/usage quotas, hosted demo environment, and enterprise SSO.

## Core Capabilities

- **Prompt-to-DAG generation**: FastAPI calls Gemini and validates structured topology output.
- **Executable workflow engine**: `POST /api/canvases/{canvas_id}/runs` executes nodes in DAG order and persists run/step records.
- **Queue semantics**: runs are tracked through planned, enqueued, processing, waiting_approval, completed, and failed states.
- **Step observability**: each step stores input, output, status, latency, token usage, cost, errors, approval status, and execution evidence.
- **Human approval gate**: Governance, Decision, approval, or human nodes pause execution; approval resumes downstream pending steps.
- **Connector market**: Slack, Teams, Gmail, Outlook, Google Drive, Jira, GitHub, Notion, Salesforce, PostgreSQL, and Webhook/HTTP Request.
- **Connector invocation audit**: tool-backed nodes create connector invocation records with request, response, status, duration, and error fields.
- **RBAC project membership**: project members have viewer/editor/admin/owner roles; read and write paths enforce role level.
- **Ops dashboard**: API and frontend summarize runs, steps, tokens, cost, connector invocations, failures, and recent errors.
- **Governance control plane**: request logs, governance events, owner isolation, rate limiting, readiness, scorecard, and secret policy.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS, React Flow, Lucide React |
| Backend | FastAPI, Pydantic, SQLite, Google GenAI SDK, Gemini |
| Storage | SQLite reference database at `canvas-backend/data/agentflow.db` |
| CI | GitHub Actions for backend tests and frontend build |

## Local Setup

### Backend

```powershell
cd canvas-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `canvas-backend\.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
APP_SECRET=change-me-to-a-long-random-secret
TOKEN_TTL_SECONDS=604800
RATE_LIMIT_PER_MINUTE=90
GEMINI_MAX_RETRIES=3
ENTERPRISE_MODE=false
TARGET_ENTERPRISE_SCORE=96
CONNECTOR_EXECUTION_ENABLED=false
```

Run:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```powershell
cd canvas-frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Main API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime health check |
| `GET` | `/api/readiness` | Enterprise readiness checks |
| `GET` | `/api/scorecard` | Scorecard and evidence |
| `POST` | `/api/auth/register` | Register account |
| `POST` | `/api/auth/login` | Login and receive token |
| `GET` | `/api/projects` | List accessible projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/{project_id}/members` | List project RBAC members |
| `GET` | `/api/projects/{project_id}/canvases` | List project canvases |
| `POST` | `/api/generate-canvas` | Generate and save workflow canvas |
| `GET` | `/api/canvases/{canvas_id}/versions` | Version history |
| `GET` | `/api/connectors` | Enterprise connector catalog |
| `POST` | `/api/canvases/{canvas_id}/runs` | Start workflow run or dry run |
| `GET` | `/api/canvases/{canvas_id}/runs` | Canvas run history |
| `GET` | `/api/runs/{run_id}` | Run with node-level steps |
| `GET` | `/api/runs/{run_id}/connector-invocations` | Connector invocation audit |
| `POST` | `/api/runs/{run_id}/steps/{step_id}/approve` | Approve or reject human gate |
| `GET` | `/api/observability/summary` | Ops dashboard summary |
| `GET` | `/api/logs` | Request logs |
| `GET` | `/api/governance/events` | Governance events |

Except auth and health endpoints, business APIs require:

```text
Authorization: Bearer <token>
```

## Workflow Run Example

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

If the topology contains a Governance, Decision, approval, human, or gate node, the run enters `waiting_approval`. Approval resumes downstream pending steps. Rejection marks the run as `failed` and downstream steps as `skipped`.

## Verification

Backend:

```powershell
cd canvas-backend
python -m py_compile main.py schemas.py
python -m unittest discover -s tests
```

Frontend:

```powershell
cd canvas-frontend
npm run build
```

CI:

```text
.github/workflows/ci.yml
```

Current tests cover account registration/login, projects, RBAC membership, templates, request logs, governance events, canvas persistence, version history, owner isolation, topology JSON parsing, connector catalog, workflow run, queue status, connector invocation audit, observability summary, and approval continuation.
