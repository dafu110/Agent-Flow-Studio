from typing import Any, List, Optional

from pydantic import BaseModel, Field


class NodeData(BaseModel):
    id: str
    label: str
    type: Optional[str] = "Planning"
    description: Optional[str] = ""
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)
    tool: Optional[str] = ""
    model: Optional[str] = ""
    cost_estimate_usd: float = 0.0
    timeout_seconds: int = Field(default=120, ge=1, le=3600)
    retry_policy: dict[str, Any] = Field(default_factory=lambda: {"max_retries": 2, "backoff_seconds": 2})
    audit_policy: str = "standard"


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


class ConnectorOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    auth_type: str
    triggers: List[str]
    actions: List[str]
    required_scopes: List[str]
    risk_level: str


class WorkflowRunCreate(BaseModel):
    trigger_type: str = Field(default="manual", max_length=40)
    inputs: dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


class StepRunOut(BaseModel):
    id: int
    run_id: int
    node_id: str
    label: str
    type: str
    status: str
    attempt: int
    latency_ms: int
    token_usage: int
    cost_usd: float
    input: dict[str, Any]
    output: dict[str, Any]
    error: str
    approval_required: bool
    approval_status: str
    started_at: str
    finished_at: Optional[str] = None


class WorkflowRunOut(BaseModel):
    id: int
    canvas_id: int
    status: str
    trigger_type: str
    started_at: str
    finished_at: Optional[str] = None
    duration_ms: int
    total_tokens: int
    total_cost_usd: float
    inputs: dict[str, Any]
    error: str
    steps: List[StepRunOut] = Field(default_factory=list)


class ApprovalAction(BaseModel):
    approved: bool = True
    note: str = Field(default="", max_length=500)
