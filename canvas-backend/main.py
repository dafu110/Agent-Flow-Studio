import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

from schemas import TopologyResponse, UserPrompt

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

app = FastAPI(title="AgentFlow Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """
你是 AgentFlow Orchestrator，一个面向生产场景的通用工作流架构 agent。你负责把用户输入的任何业务、产品、运营、学习、科研、创作、项目管理或组织协作目标，拆解成一张可执行的 agent 工作流拓扑。

输出要求：
1. 使用中文。
2. 不要假设用户一定是企业数字化转型场景；必须根据用户输入识别真实领域。
3. summary 用 2-4 句话说明整体执行策略、关键路径和落地优先级。
4. nodes 输出 5-10 个节点，每个节点代表一个可执行能力、流程阶段、决策点、数据来源、工具模块或治理动作。
5. edges 只允许引用 nodes 中存在的 id，表达真实依赖，不要制造无意义连线。
6. node.type 只能从以下类型中选择：Input、Research、Planning、Execution、Automation、Review、Decision、Governance、Risk。
7. description 必须具体说明该节点要做什么、产出什么、为什么重要。
8. 输出必须严格符合 JSON 结构，不要包含 markdown、代码块或额外解释。

JSON 结构：
{
  "summary": "整体策略摘要",
  "nodes": [
    {
      "id": "stable_snake_case_id",
      "label": "节点名称",
      "type": "Planning",
      "description": "节点要做什么、产出什么、为什么重要"
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "依赖说明"
    }
  ]
}
"""


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


async def call_gemini_canvas_agent(user_prompt: str) -> TopologyResponse:
    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=gemini_model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.25,
            response_mime_type="application/json",
            response_schema=TopologyResponse,
        ),
    )

    content = getattr(response, "text", None)
    if not content:
        raise HTTPException(status_code=502, detail="Gemini 返回为空，请调整输入或检查模型配置。")

    return parse_topology_response(content)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "provider": "gemini",
        "model": gemini_model,
        "has_api_key": bool(api_key),
    }


@app.post("/api/generate-canvas", response_model=TopologyResponse)
async def generate_canvas(payload: UserPrompt):
    if not api_key:
        raise HTTPException(status_code=500, detail="未检测到 GEMINI_API_KEY，请在后端 .env 中配置。")

    if not payload.user_prompt.strip():
        raise HTTPException(status_code=400, detail="请输入要拆解的场景目标。")

    try:
        return await call_gemini_canvas_agent(payload.user_prompt)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini Agent 生成异常: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
