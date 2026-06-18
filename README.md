# AgentFlow Studio

AgentFlow Studio 是一个基于 Gemini 的通用智能体工作流编排项目。用户输入任意业务、学习、科研、运营、产品、创作或项目管理目标，后端 **AgentFlow Orchestrator** 会将目标拆解成结构化节点和依赖链路，前端用 React Flow 渲染成可交互的执行拓扑。

项目打开后默认是空画布，不预加载示例拓扑。所有节点都来自用户输入和 Gemini 生成结果，更适合作为可投入使用的成熟 agent 产品底座。

## 项目能力

- **通用场景拆解**：不绑定单一行业，可覆盖产品上线、运营活动、学习计划、科研项目、内容生产、团队协作等任务。
- **AgentFlow Orchestrator**：FastAPI + Google GenAI SDK 调用 Gemini，并要求模型输出稳定的结构化 JSON。
- **可执行拓扑画布**：节点代表能力、阶段、决策、风险或治理动作；连线代表真实依赖关系。
- **成熟运行状态**：提供健康检查、错误提示、空画布状态、节点详情、执行视角和风险视角。
- **可扩展架构**：前后端分离，后端 API 输出稳定 schema，便于后续接入登录、项目保存、模板库和多人协作。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 15, React 19, Tailwind CSS, React Flow, Lucide React |
| Backend | FastAPI, Pydantic, Google GenAI SDK, Gemini |
| Visualization | Custom React Flow nodes, animated smoothstep edges |

## 目录结构

```text
AI-Canvas-V1/
  canvas-frontend/     Next.js AgentFlow Studio 工作台
  canvas-backend/      FastAPI AgentFlow Orchestrator 服务
  assets/              项目素材与文档
```

## 本地启动

### 1. 配置 Gemini API Key

```powershell
cd C:\Users\lenovo\Desktop\PY\AI-Canvas-V1\canvas-backend
copy .env.example .env
```

编辑 `canvas-backend\.env`：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash
```

### 2. 启动后端

```powershell
cd C:\Users\lenovo\Desktop\PY\AI-Canvas-V1\canvas-backend
.\Scripts\activate
python main.py
```

后端地址：

```text
http://localhost:8000
```

健康检查：

```text
GET http://localhost:8000/api/health
```

### 3. 启动前端

另开一个 PowerShell：

```powershell
cd C:\Users\lenovo\Desktop\PY\AI-Canvas-V1\canvas-frontend
npm.cmd run dev
```

打开：

```text
http://localhost:3000
```

## 后端 API

```text
POST http://localhost:8000/api/generate-canvas
```

请求体：

```json
{
  "user_prompt": "为一次线上会员增长活动设计 agent 编排：包含人群洞察、权益设计、内容投放、自动化触达、数据监控、风险控制和复盘。"
}
```

响应结构：

```json
{
  "summary": "整体策略摘要",
  "nodes": [
    {
      "id": "audience_research",
      "label": "人群洞察",
      "type": "Research",
      "description": "识别目标用户、增长机会和关键假设。"
    }
  ],
  "edges": [
    {
      "source": "audience_research",
      "target": "campaign_planning",
      "label": "洞察输入活动方案"
    }
  ]
}
```

## 可投入使用的下一步

- 接入数据库保存画布。
- 增加用户登录和项目空间。
- 增加模板库、版本历史和导出 PNG/PDF。
- 为不同场景增加专属 system prompt 或 agent profile。
- 增加后端重试、请求日志、限流和错误追踪。
