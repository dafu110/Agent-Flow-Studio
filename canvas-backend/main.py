import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from schemas import TopologyResponse, UserPrompt

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

app = FastAPI(title="AI Topology Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    temperature=0.2,
    google_api_key=api_key,
    max_retries=5
)

parser = JsonOutputParser(pydantic_object=TopologyResponse)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", (
        "你是一个顶级的企业级数字化转型与企业架构（EA）咨询专家。\n"
        "请根据用户的战略变革诉求，将其解构为一套结构化的依赖关系拓扑图。\n"
        "你必须无条件输出符合以下 JSON 格式的数据，禁止包含任何 markdown 标记或常规文本：\n"
        "{format_instructions}"
    )),
    ("human", "{user_prompt}")
])

@app.post("/api/generate-canvas", response_model=TopologyResponse)
async def generate_canvas(payload: UserPrompt):
    if not api_key:
        raise HTTPException(status_code=500, detail="本地安全策略未检测到有效的 GOOGLE_API_KEY")
    try:
        chain = prompt_template | llm | parser
        return chain.invoke({
            "user_prompt": payload.user_prompt,
            "format_instructions": parser.get_format_instructions()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent 异常: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)