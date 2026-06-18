from typing import List, Optional

from pydantic import BaseModel, Field


class NodeData(BaseModel):
    id: str
    label: str
    type: Optional[str] = "Planning"
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
    user_prompt: str = Field(..., min_length=1)
    project_id: Optional[int] = None
    canvas_id: Optional[int] = None
    title: Optional[str] = None
    profile: Optional[str] = "general"


class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=120)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: str = Field(..., min_length=3, max_length=120)
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = ""


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: str
    updated_at: str


class CanvasSave(BaseModel):
    project_id: int
    title: str = Field(..., min_length=1, max_length=120)
    prompt: str = ""
    summary: str
    nodes: List[NodeData]
    edges: List[EdgeData]


class CanvasOut(BaseModel):
    id: int
    project_id: int
    title: str
    prompt: str
    summary: str
    nodes: List[NodeData]
    edges: List[EdgeData]
    created_at: str
    updated_at: str


class VersionOut(BaseModel):
    id: int
    canvas_id: int
    version: int
    prompt: str
    summary: str
    nodes: List[NodeData]
    edges: List[EdgeData]
    created_at: str


class TemplateOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    prompt: str
    profile: str


class GenerateCanvasResponse(TopologyResponse):
    canvas: CanvasOut
    version: VersionOut


class RequestLogOut(BaseModel):
    id: int
    method: str
    path: str
    status_code: int
    duration_ms: int
    error: str
    created_at: str
