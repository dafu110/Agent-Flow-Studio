# AgentFlow Studio Enterprise

AgentFlow Studio is a Gemini-powered agent workflow orchestration studio. It turns a plain-language goal into a governed workflow canvas, then lets teams run, approve, observe, version, and export that workflow from a visual Pipeline Builder.

## Preview

| Login | Workflow Canvas | Run History and Export |
| --- | --- | --- |
| ![Login screen](docs/screenshots/01-login.png) | ![Workflow canvas](docs/screenshots/02-workflow-canvas.png) | ![Run history and export controls](docs/screenshots/03-run-history-export.png) |

## Why It Exists

Most agent demos stop at prompt generation. AgentFlow Studio shows the next layer: a practical control plane for turning generated agent steps into a repeatable, auditable workflow.

The project combines:

- **Prompt-to-workflow generation**: FastAPI calls Gemini and validates structured topology output with Pydantic.
- **Closed-loop Pipeline Builder**: React Flow renders connected agent blocks, approval gates, run history, and audit feedback.
- **Governed execution**: Workflow runs persist node-level step status, token/cost estimates, queue state, and approval pauses.
- **Enterprise operating layer**: Authentication, workspaces, RBAC membership, templates, versions, request logs, readiness checks, connector catalog, governance events, and observability summary.
- **Portable setup**: Docker Compose runs frontend and backend together without machine-specific paths.

## Quick Start

### 1. Create Backend Configuration

```bash
cp canvas-backend/.env.example canvas-backend/.env
```

Set `GEMINI_API_KEY` in `canvas-backend/.env` if you want live prompt-to-workflow generation. The rest of the app, including auth, saved canvases, runs, approvals, logs, and exports, works without a Gemini key.

### 2. Start The App

```bash
docker compose up --build
```

Open the frontend:

```text
http://localhost:3000
```

Check backend health:

```text
http://localhost:8000/api/health
```

## Product Flow

1. Register or log in.
2. Choose a workspace and optionally start from a template.
3. Describe a workflow goal, such as a product launch, revenue operation, learning plan, or research project.
4. Generate or open a workflow canvas.
5. Review connected blocks, dependencies, tools, permissions, and audit policy.
6. Validate or publish a run.
7. Approve human-gated steps.
8. Inspect run history, connector audit, logs, versions, and exports.

## Feature Map

| Area | What Is Included |
| --- | --- |
| Identity | Register, login, bearer token auth, token TTL |
| Workspaces | Projects, project members, owner/editor/viewer/admin role checks |
| Canvas | Prompt-to-DAG generation, saved canvases, versions, React Flow rendering |
| Templates | Built-in prompt templates for product, operations, research, and learning workflows |
| Execution | Workflow runs, dry runs, step records, queue status, approval continuation |
| Governance | Human approval gates, governance events, request logs, readiness checks |
| Connectors | Slack, Teams, Gmail, Outlook, Google Drive, Jira, GitHub, Notion, Salesforce, PostgreSQL, Webhook/HTTP |
| Observability | Run counts, step counts, token/cost estimates, connector invocation audit, recent errors |
| Export | PNG canvas export and printable PDF summary |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS, React Flow, Lucide React |
| Backend | FastAPI, Pydantic, SQLite, Google GenAI SDK, Gemini |
| Storage | SQLite reference database at `canvas-backend/data/agentflow.db` |
| CI | GitHub Actions for backend compile/tests, frontend lint, and frontend build |

## Local Development

Run the backend and frontend in separate terminals.

### Backend

```bash
cd canvas-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

PowerShell activation on Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Frontend

```bash
cd canvas-frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Configuration

Backend variables live in `canvas-backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
APP_SECRET=change-me-to-a-long-random-secret
TOKEN_TTL_SECONDS=604800
RATE_LIMIT_PER_MINUTE=90
GEMINI_MAX_RETRIES=3
ENTERPRISE_MODE=false
CONNECTOR_EXECUTION_ENABLED=false
```

Frontend variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## API Overview

Business APIs require:

```text
Authorization: Bearer <token>
```

### System And Auth

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime health check |
| `GET` | `/api/readiness` | Readiness checks |
| `POST` | `/api/auth/register` | Register account |
| `POST` | `/api/auth/login` | Login and receive token |
| `GET` | `/api/me` | Current user |

### Projects And Canvas

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects` | List accessible projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/{project_id}/members` | List project RBAC members |
| `GET` | `/api/projects/{project_id}/canvases` | List project canvases |
| `POST` | `/api/canvases` | Save a workflow canvas |
| `GET` | `/api/canvases/{canvas_id}` | Load a workflow canvas |
| `GET` | `/api/canvases/{canvas_id}/versions` | Version history |
| `POST` | `/api/generate-canvas` | Generate and save workflow canvas |
| `GET` | `/api/templates` | Built-in templates |

### Runs, Governance, And Ops

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/connectors` | Connector catalog |
| `POST` | `/api/canvases/{canvas_id}/runs` | Start workflow run or dry run |
| `GET` | `/api/canvases/{canvas_id}/runs` | Canvas run history |
| `GET` | `/api/runs/{run_id}` | Run with node-level steps |
| `GET` | `/api/runs/{run_id}/connector-invocations` | Connector invocation audit |
| `POST` | `/api/runs/{run_id}/steps/{step_id}/approve` | Approve or reject human gate |
| `GET` | `/api/observability/summary` | Ops dashboard summary |
| `GET` | `/api/logs` | Request logs |
| `GET` | `/api/governance/events` | Governance events |

## Deployment

### Option A: Vercel + Render

1. Deploy `canvas-backend` to Render as a Python web service.
2. Set the Render start command:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

3. Add backend environment variables in Render.
4. Deploy `canvas-frontend` to Vercel.
5. Set `NEXT_PUBLIC_API_BASE_URL` in Vercel to the Render backend URL.
6. Add the deployed frontend origin to your production CORS policy before public launch.

### Option B: Railway

1. Create two Railway services from the same repository.
2. Set service roots to `canvas-backend` and `canvas-frontend`.
3. Backend start command:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

4. Frontend build/start:

```bash
npm ci
npm run build
npm run start -- --hostname 0.0.0.0 --port $PORT
```

5. Set `NEXT_PUBLIC_API_BASE_URL` to the backend public URL.

### Option C: Single VM With Docker Compose

1. Copy the repository to the server.
2. Create `canvas-backend/.env`.
3. Run:

```bash
docker compose up --build -d
```

4. Put a reverse proxy such as Nginx or Caddy in front of ports `3000` and `8000`.

## Verification

Backend:

```bash
cd canvas-backend
python -m py_compile main.py schemas.py
python -m unittest discover -s tests
```

Frontend:

```bash
cd canvas-frontend
npm run lint
npm run build
```

CI:

```text
.github/workflows/ci.yml
```

Current tests cover account registration/login, projects, RBAC membership, templates, request logs, governance events, canvas persistence, version history, owner isolation, topology JSON parsing, connector catalog, workflow run, queue status, connector invocation audit, observability summary, and approval continuation.
