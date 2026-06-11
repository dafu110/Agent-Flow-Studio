from pydantic import BaseModel
from typing import List, Optional

class NodeData(BaseModel):
    id: str
    label: str
    type: Optional[str] = "PROCESS"
    description: Optional[str] = ""

class EdgeData(BaseModel):
    source: str
    target: str
    label: Optional[str] = ""

class TopologyResponse(BaseModel):
    summary: str
    nodes: List[NodeData]
    edges: List[EdgeData]

class UserPrompt(BaseModel):
    user_prompt: str