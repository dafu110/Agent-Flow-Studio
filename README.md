# AgentFlow Studio

AgentFlow Studio 是一个基于 Gemini 的通用智能体工作流编排项目。用户输入业务、学习、科研、运营、产品、创作或项目管理目标，后端 **AgentFlow Orchestrator** 会拆解为结构化节点和依赖链路，前端用 React Flow 渲染成可交互执行拓扑。

当前版本已经具备可投入使用的最小产品闭环：用户登录、项目空间、模板库、画布保存、版本历史、PNG/PDF 导出、请求日志、限流、错误追踪和 Gemini 重试。

## 核心能力

- **账号与项目空间**：注册/登录后进入个人项目空间，每个项目可保存多张画布。
- **Gemini Agent 编排**：FastAPI + Google GenAI SDK 调用 Gemini，按稳定 schema 输出工作流拓扑。
- **模板库与 Agent Profile**：内置产品、运营、学习、科研模板，并支持不同场景 profile。
- **画布持久化**：生成结果自动保存到 SQLite；再次生成会写入新版本。
- **版本历史**：每次保存都产生版本，可在前端回看并载入。
- **导出能力**：前端支持 PNG 下载和 PDF 打印导出。
- **工程治理**：后端提供健康检查、请求日志、限流、重试和错误返回。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 15, React 19, Tailwind CSS, React Flow, Lucide React |
| Backend | FastAPI, Pydantic, SQLite, Google GenAI SDK, Gemini |
| Storage | SQLite 本地数据库 `canvas-backend/data/agentflow.db` |

## 目录结构

```text
AI-Canvas-V1/
  canvas-frontend/     AgentFlow Studio 前端工作台
  canvas-backend/      AgentFlow Orchestrator API
  assets/              项目素材与文档
```

## 本地启动

### 1. 配置后端环境

```powershell
cd canvas-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

编辑 `canvas-backend\.env`：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash
APP_SECRET=请改成足够长的随机字符串
TOKEN_TTL_SECONDS=604800
RATE_LIMIT_PER_MINUTE=90
GEMINI_MAX_RETRIES=3
```

### 2. 启动后端

```powershell
cd canvas-backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

健康检查：

```text
GET http://localhost:8000/api/health
```

### 3. 启动前端

```powershell
cd C:\Users\lenovo\Desktop\PY\AI-Canvas-V1\canvas-frontend
npm.cmd run dev
```

打开：

```text
http://localhost:3000
```

## 主要 API

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册账号 |
| `POST` | `/api/auth/login` | 登录并获取 token |
| `GET` | `/api/projects` | 获取项目空间 |
| `POST` | `/api/projects` | 创建项目 |
| `GET` | `/api/projects/{project_id}/canvases` | 获取项目画布 |
| `POST` | `/api/generate-canvas` | 调用 Gemini 生成并保存画布 |
| `GET` | `/api/canvases/{canvas_id}/versions` | 获取版本历史 |
| `GET` | `/api/templates` | 获取内置模板 |
| `GET` | `/api/logs` | 获取最近请求日志 |

除注册、登录和健康检查外，其余接口需要：

```text
Authorization: Bearer <token>
```

## 后端验证

```powershell
cd canvas-backend
python -m py_compile main.py schemas.py
python -m unittest discover -s tests
```

当前后端测试覆盖账号注册/登录、项目空间、模板库、请求日志、画布保存、版本历史、项目所有权隔离和 Gemini 拓扑 JSON 解析。仓库不再提交 `Lib/`、`Scripts/`、`pyvenv.cfg` 等虚拟环境文件，依赖通过 `canvas-backend/requirements.txt` 复现。

## 生成画布请求

```json
{
  "user_prompt": "为一次线上会员增长活动设计 agent 编排：包含人群洞察、权益设计、内容投放、自动化触达、数据监控、风险控制和复盘。",
  "project_id": 1,
  "profile": "operations"
}
```
