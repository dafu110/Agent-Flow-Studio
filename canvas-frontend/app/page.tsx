'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Download,
  FileText,
  GitBranch,
  History,
  Layers3,
  Loader2,
  LockKeyhole,
  LogOut,
  Play,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

type CanvasNode = {
  id: string;
  label: string;
  type?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  permissions?: string[];
  tool?: string;
  model?: string;
  cost_estimate_usd?: number;
  timeout_seconds?: number;
  retry_policy?: Record<string, unknown>;
  audit_policy?: string;
};

type CanvasEdge = {
  source: string;
  target: string;
  label?: string;
};

type Project = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type CanvasRecord = {
  id: number;
  project_id: number;
  title: string;
  prompt: string;
  summary: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  created_at: string;
  updated_at: string;
};

type VersionRecord = CanvasRecord & {
  canvas_id: number;
  version: number;
};

type TemplateRecord = {
  id: number;
  name: string;
  category: string;
  description: string;
  prompt: string;
  profile: string;
};

type Connector = {
  id: string;
  name: string;
  category: string;
  description: string;
  auth_type: string;
  triggers: string[];
  actions: string[];
  required_scopes: string[];
  risk_level: string;
};

type StepRun = {
  id: number;
  run_id: number;
  node_id: string;
  label: string;
  type: string;
  status: string;
  attempt: number;
  latency_ms: number;
  token_usage: number;
  cost_usd: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string;
  approval_required: boolean;
  approval_status: string;
  started_at: string;
  finished_at?: string | null;
};

type WorkflowRun = {
  id: number;
  canvas_id: number;
  status: string;
  trigger_type: string;
  started_at: string;
  finished_at?: string | null;
  duration_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  queue_status: string;
  inputs: Record<string, unknown>;
  error: string;
  steps: StepRun[];
};

type RequestLog = {
  id: number;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  error: string;
  created_at: string;
};

type User = {
  id: number;
  email: string;
  created_at: string;
};

type GenerateCanvasResponse = {
  summary: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  canvas: CanvasRecord;
  version: VersionRecord;
};

type ObservabilitySummary = {
  total_runs: number;
  active_runs: number;
  failed_runs: number;
  completed_runs: number;
  waiting_approval_runs: number;
  total_steps: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_duration_ms: number;
  connector_invocations: number;
  connector_failures: number;
  recent_errors: Array<Record<string, unknown>>;
  run_status_counts: Record<string, number>;
  step_status_counts: Record<string, number>;
};

type AgentNodeData = {
  label: React.ReactNode;
  rawDetails: CanvasNode;
} & Record<string, unknown>;

type AgentNode = Node<AgentNodeData, 'agentNode'>;
type RightTab = 'inspect' | 'runs' | 'ops' | 'versions' | 'logs';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const tokenKey = 'agentflow_token';

const profiles = [
  { id: 'general', label: 'General' },
  { id: 'product', label: 'Product' },
  { id: 'operations', label: 'Growth' },
  { id: 'research', label: 'Research' },
  { id: 'learning', label: 'Learning' },
];

const typeTone: Record<string, { accent: string; bg: string; icon: React.ReactNode }> = {
  input: { accent: 'text-sky-600', bg: 'bg-sky-50 border-sky-100', icon: <FileText className="h-3.5 w-3.5" /> },
  research: { accent: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', icon: <Search className="h-3.5 w-3.5" /> },
  planning: { accent: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100', icon: <Route className="h-3.5 w-3.5" /> },
  execution: { accent: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: <Activity className="h-3.5 w-3.5" /> },
  automation: { accent: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: <DatabaseZap className="h-3.5 w-3.5" /> },
  review: { accent: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  decision: { accent: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: <GitBranch className="h-3.5 w-3.5" /> },
  governance: { accent: 'text-slate-700', bg: 'bg-slate-100 border-slate-200', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  risk: { accent: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const getTone = (type?: string) => typeTone[(type ?? '').toLowerCase()] ?? typeTone.planning;

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized.includes('wait')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized.includes('fail') || normalized.includes('reject')) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized.includes('pending') || normalized.includes('planned')) return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-cyan-200 bg-cyan-50 text-cyan-700';
};

const formatStatusLabel = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const kpiTone = (index: number) =>
  [
    'from-cyan-50 to-white border-cyan-100 text-cyan-700',
    'from-slate-50 to-white border-slate-200 text-slate-700',
    'from-emerald-50 to-white border-emerald-100 text-emerald-700',
    'from-violet-50 to-white border-violet-100 text-violet-700',
  ][index % 4];

const createNodes = (items: CanvasNode[]): AgentNode[] =>
  items.map((node, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const safeType = node.type || 'Planning';
    const tone = getTone(safeType);

    return {
      id: String(node.id || `node-${index}`).trim(),
      type: 'agentNode',
      position: { x: col * 360 + (row % 2 === 0 ? 0 : 88), y: row * 218 },
      data: {
        rawDetails: { ...node, id: String(node.id || `node-${index}`).trim(), type: safeType },
        label: (
          <div className="h-full w-full">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={`inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tone.bg} ${tone.accent}`}>
                {tone.icon}
                <span className="truncate">{safeType}</span>
              </div>
              <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-300">#{index + 1}</span>
            </div>
            <div className="text-[15px] font-black leading-snug text-slate-950">{node.label || 'Untitled node'}</div>
            <p className="mt-2 max-h-[50px] overflow-hidden text-[12px] font-semibold leading-relaxed text-slate-500">{node.description || 'No node description yet.'}</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
              <span>{node.tool || 'built-in'}</span>
              <span>{node.timeout_seconds || 120}s</span>
            </div>
          </div>
        ),
      },
      style: { width: 286, height: 158 },
    };
  });

const createEdges = (items: CanvasEdge[], nodes: AgentNode[]): Edge[] => {
  const validIds = new Set(nodes.map((node) => node.id));
  return items
    .map((edge, index) => ({
      id: `edge-${edge.source}-${edge.target}-${index}`,
      source: String(edge.source).trim(),
      target: String(edge.target).trim(),
      type: 'smoothstep',
      animated: true,
      label: edge.label,
      style: { stroke: '#0891b2', strokeWidth: 1.8, strokeDasharray: '6 6' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#0891b2' },
    }))
    .filter((edge) => validIds.has(edge.source) && validIds.has(edge.target));
};

function AgentNodeCard({ data, selected }: NodeProps<AgentNode>) {
  return (
    <div className={`agent-node-shell h-[158px] w-[286px] rounded-[8px] border bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition duration-300 ${selected ? 'border-cyan-400 shadow-[0_18px_42px_rgba(8,145,178,0.22)]' : 'border-slate-200/90'}`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      {data.label}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-cyan-500" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-white !bg-cyan-500" />
    </div>
  );
}

const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) => {
  let line = '';
  let lineCount = 0;
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y);
};

export default function CanvasPage() {
  const nodeTypes = useMemo(() => ({ agentNode: AgentNodeCard }), []);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [canvases, setCanvases] = useState<CanvasRecord[]>([]);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [observability, setObservability] = useState<ObservabilitySummary | null>(null);
  const [profile, setProfile] = useState('general');
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState('Select a project or template to generate an executable workflow.');
  const [activeCanvas, setActiveCanvas] = useState<CanvasRecord | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>('inspect');
  const [status, setStatus] = useState('Waiting for sign in');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasCanvas = nodes.length > 0;
  const latestRun = runs[0];
  const waitingStep = latestRun?.steps.find((step) => step.status === 'waiting_approval');

  const apiFetch = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  };

  const applyCanvas = (canvas: CanvasRecord | VersionRecord) => {
    const nextNodes = createNodes(canvas.nodes);
    setNodes(nextNodes);
    setEdges(createEdges(canvas.edges, nextNodes));
    setSummary(canvas.summary);
    setSelectedNodeDetails(null);
    setStatus(`Loaded ${canvas.nodes.length} nodes and ${canvas.edges.length} paths`);
  };

  const refreshRuns = async (canvasId = activeCanvas?.id) => {
    if (!canvasId) return;
    const rows = await apiFetch<WorkflowRun[]>(`/api/canvases/${canvasId}/runs`);
    setRuns(rows);
  };

  const refreshObservability = async () => {
    setObservability(await apiFetch<ObservabilitySummary>('/api/observability/summary'));
  };

  const loadWorkspace = async () => {
    const [projectRows, templateRows, connectorRows, logRows, observabilityRows] = await Promise.all([
      apiFetch<Project[]>('/api/projects'),
      apiFetch<TemplateRecord[]>('/api/templates'),
      apiFetch<Connector[]>('/api/connectors'),
      apiFetch<RequestLog[]>('/api/logs'),
      apiFetch<ObservabilitySummary>('/api/observability/summary'),
    ]);
    setProjects(projectRows);
    setTemplates(templateRows);
    setConnectors(connectorRows);
    setLogs(logRows);
    setObservability(observabilityRows);
    const nextProjectId = projectId ?? projectRows[0]?.id ?? null;
    setProjectId(nextProjectId);
    if (nextProjectId) {
      setCanvases(await apiFetch<CanvasRecord[]>(`/api/projects/${nextProjectId}/canvases`));
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(tokenKey);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch<User>('/api/me')
      .then((me) => {
        setUser(me);
        setStatus('Workspace connected');
      })
      .then(loadWorkspace)
      .catch(() => {
        window.localStorage.removeItem(tokenKey);
        setToken('');
        setUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Authentication failed');
      window.localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setUser(data.user);
      setStatus('Workspace connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(tokenKey);
    setToken('');
    setUser(null);
    setProjects([]);
    setCanvases([]);
    setVersions([]);
    setRuns([]);
    setNodes([]);
    setEdges([]);
    setActiveCanvas(null);
    setStatus('Waiting for sign in');
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await apiFetch<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: newProjectName.trim(), description: '' }),
    });
    setNewProjectName('');
    setProjects((items) => [project, ...items]);
    setProjectId(project.id);
    setCanvases([]);
  };

  const selectProject = async (id: number) => {
    setProjectId(id);
    setActiveCanvas(null);
    setVersions([]);
    setRuns([]);
    setCanvases(await apiFetch<CanvasRecord[]>(`/api/projects/${id}/canvases`));
  };

  const generateCanvas = async () => {
    if (!prompt.trim() || !projectId) return;
    setLoading(true);
    setError('');
    setStatus('Generating workflow topology');
    try {
      const data = await apiFetch<GenerateCanvasResponse>('/api/generate-canvas', {
        method: 'POST',
        body: JSON.stringify({
          user_prompt: prompt,
          project_id: projectId,
          canvas_id: activeCanvas?.id,
          title: prompt.trim().slice(0, 72),
          profile,
        }),
      });
      setActiveCanvas(data.canvas);
      applyCanvas(data.canvas);
      setVersions([data.version, ...versions]);
      setCanvases(await apiFetch<CanvasRecord[]>(`/api/projects/${projectId}/canvases`));
      setLogs(await apiFetch<RequestLog[]>('/api/logs'));
      await refreshRuns(data.canvas.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const openCanvas = async (canvas: CanvasRecord) => {
    setActiveCanvas(canvas);
    setPrompt(canvas.prompt);
    applyCanvas(canvas);
    setVersions(await apiFetch<VersionRecord[]>(`/api/canvases/${canvas.id}/versions`));
    await refreshRuns(canvas.id);
  };

  const runCanvas = async (dryRun = false) => {
    if (!activeCanvas) return;
    setLoading(true);
    setError('');
    setStatus(dryRun ? 'Planning run' : 'Running workflow');
    try {
      const run = await apiFetch<WorkflowRun>(`/api/canvases/${activeCanvas.id}/runs`, {
        method: 'POST',
        body: JSON.stringify({
          trigger_type: dryRun ? 'dry_run' : 'manual',
          dry_run: dryRun,
          inputs: { prompt, canvas_title: activeCanvas.title },
        }),
      });
      setRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
      await refreshObservability();
      setActiveTab('runs');
      setStatus(`Run #${run.id}: ${run.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Run failed';
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const approveWaitingStep = async (approved: boolean) => {
    if (!latestRun || !waitingStep) return;
    setLoading(true);
    try {
      const run = await apiFetch<WorkflowRun>(`/api/runs/${latestRun.id}/steps/${waitingStep.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved, note: approved ? 'Approved in AgentFlow Studio' : 'Rejected in AgentFlow Studio' }),
      });
      setRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
      await refreshObservability();
      setStatus(`Run #${run.id}: ${run.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed';
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: TemplateRecord) => {
    setPrompt(template.prompt);
    setProfile(template.profile);
    setStatus(`Template applied: ${template.name}`);
  };

  const exportPng = () => {
    if (!hasCanvas) return;
    const canvas = document.createElement('canvas');
    const width = 1280;
    const height = Math.max(760, Math.ceil(nodes.length / 3) * 240 + 140);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#0891b2';
    ctx.setLineDash([6, 6]);
    edges.forEach((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      if (!source || !target) return;
      ctx.beginPath();
      ctx.moveTo(source.position.x + 143, source.position.y + 79);
      ctx.lineTo(target.position.x + 143, target.position.y + 79);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    nodes.forEach((node) => {
      const raw = node.data.rawDetails;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.roundRect(node.position.x, node.position.y, 286, 158, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0891b2';
      ctx.font = '700 11px Arial';
      ctx.fillText((raw.type || 'Planning').toUpperCase(), node.position.x + 18, node.position.y + 30);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 16px Arial';
      wrapText(ctx, raw.label, node.position.x + 18, node.position.y + 64, 246, 20, 2);
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px Arial';
      wrapText(ctx, raw.description || '', node.position.x + 18, node.position.y + 100, 246, 16, 3);
    });
    const link = document.createElement('a');
    link.download = `${activeCanvas?.title || 'agentflow-canvas'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportPdf = () => {
    const printable = window.open('', '_blank');
    if (!printable) return;
    const nodeList = nodes.map((node) => node.data.rawDetails);
    printable.document.write(`
      <html><head><title>${activeCanvas?.title || 'AgentFlow Canvas'}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}
        h1{font-size:24px;margin-bottom:8px}.summary{color:#475569;line-height:1.7;margin-bottom:24px}
        .node{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:10px 0}
        .type{font-size:11px;color:#0891b2;font-weight:800;text-transform:uppercase}
        .label{font-size:16px;font-weight:800;margin:6px 0}.desc{color:#475569;line-height:1.6}
      </style></head><body>
      <h1>${activeCanvas?.title || 'AgentFlow Canvas'}</h1><div class="summary">${summary}</div>
      ${nodeList.map((node) => `<div class="node"><div class="type">${node.type || 'Planning'}</div><div class="label">${node.label}</div><div class="desc">${node.description || ''}</div></div>`).join('')}
      </body></html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  if (!user) {
    return (
      <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[#f6f8fb] px-4 text-slate-900">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#edf8fb_48%,#f8fafc_100%)]" />
        <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative w-full max-w-[1160px] overflow-hidden rounded-[24px] border border-white/80 bg-white/85 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col justify-between border-b border-slate-100 px-8 py-8 md:border-b-0 md:border-r md:px-10 md:py-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  AgentFlow Studio
                </div>
                <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Enterprise AI workflow orchestration, built for real operations.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500 md:text-[15px]">Generate DAGs, run workflows, approve human gates, observe execution, and export delivery-ready artifacts from one workspace.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Runs', 'queue + approvals'],
                    ['Connectors', 'catalog + audit'],
                    ['Exports', 'PNG + PDF'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-[18px] border border-slate-200 bg-white/90 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{title}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">FastAPI</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">React Flow</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Gemini</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Docker Compose</span>
              </div>
            </div>

            <div className="px-8 py-8 md:px-10 md:py-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-cyan-100 bg-cyan-50 text-cyan-700"><LockKeyhole className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Sign in</h2>
                  <p className="text-xs font-semibold text-slate-500">Use the workspace to create and run workflows.</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-[16px] bg-slate-100 p-1 text-sm font-black">
                <button onClick={() => setAuthMode('login')} className={`rounded-[12px] py-2.5 ${authMode === 'login' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>Login</button>
                <button onClick={() => setAuthMode('register')} className={`rounded-[12px] py-2.5 ${authMode === 'register' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>Register</button>
              </div>
              <div className="mt-4 space-y-3">
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
                <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
                <button onClick={handleAuth} disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-slate-950 text-sm font-black text-white transition hover:bg-cyan-700 disabled:bg-slate-300">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  {authMode === 'login' ? 'Enter workspace' : 'Create account'}
                </button>
              </div>
              {error && <p className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{error}</p>}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#f6f8fb] text-slate-900 antialiased md:flex-row">
      <aside className="z-20 flex h-[62dvh] shrink-0 flex-col border-b border-slate-200/80 bg-white/92 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:h-full md:w-[430px] md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-cyan-100 bg-cyan-50 text-cyan-600 shadow-sm"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black tracking-wide text-slate-950">AgentFlow Studio</h1>
                <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-rose-600" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section className="rounded-[18px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Workspace</div>
                <div className="mt-1 text-lg font-black text-slate-950">{projects.length} projects</div>
                <div className="text-xs font-semibold text-slate-500">{canvases.length} canvases, {runs.length} runs</div>
              </div>
              <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Connected</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: 'Projects', value: projects.length, icon: <Boxes className="h-4 w-4" /> },
                { label: 'Canvases', value: canvases.length, icon: <Route className="h-4 w-4" /> },
                { label: 'Runs', value: runs.length, icon: <Play className="h-4 w-4" /> },
                { label: 'Connectors', value: connectors.length, icon: <DatabaseZap className="h-4 w-4" /> },
              ].map((metric, index) => (
                <div key={metric.label} className={`rounded-[16px] border bg-gradient-to-br p-3 shadow-sm ${kpiTone(index)}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-slate-400">{metric.icon}</div>
                    <div className="font-mono text-xl font-black text-slate-950">{metric.value}</div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Projects</div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Workspace</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="New project" className="h-10 rounded-[12px] border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-400" />
              <button onClick={createProject} className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-slate-950 text-white" aria-label="Create project"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-2">
              {projects.map((project) => (
                <button key={project.id} onClick={() => selectProject(project.id)} className={`rounded-[14px] border px-3 py-2.5 text-left text-xs font-bold transition ${projectId === project.id ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:border-cyan-200 hover:bg-slate-50'}`}>{project.name}</button>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="prompt" className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Prompt</label>
              <select value={profile} onChange={(event) => setProfile(event.target.value)} className="h-8 rounded-[10px] border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600">
                {profiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <textarea id="prompt" className="h-28 w-full resize-none rounded-[14px] border border-slate-200 bg-white p-3 text-sm font-semibold leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" placeholder="Describe the workflow goal..." value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <button type="button" onClick={generateCanvas} disabled={loading || !prompt.trim() || !projectId} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-slate-950 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              Generate and Save
            </button>
          </section>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Templates</div>
            <div className="grid gap-2">
              {templates.map((template) => (
                <button key={template.id} onClick={() => applyTemplate(template)} className="rounded-[14px] border border-slate-200 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50">
                  <div className="text-xs font-black text-slate-900">{template.name}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{template.category} / {template.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Canvases</div>
            <div className="grid gap-2">
              {canvases.map((canvas) => (
                <button key={canvas.id} onClick={() => openCanvas(canvas)} className={`rounded-[14px] border p-3 text-left transition ${activeCanvas?.id === canvas.id ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 hover:border-cyan-200 hover:bg-slate-50'}`}>
                  <div className="text-xs font-black text-slate-900">{canvas.title}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{canvas.updated_at}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Connectors</div>
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Catalog</div>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {connectors.map((connector) => (
                <div key={connector.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-slate-900">{connector.name}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${connector.risk_level === 'high' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-500'}`}>{connector.risk_level}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{connector.category} / {connector.auth_type}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_rgba(14,165,233,0.12)] ${error ? 'bg-amber-500' : latestRun?.status === 'completed' ? 'bg-emerald-500' : hasCanvas ? 'bg-cyan-500' : 'bg-slate-300'}`} />
            <span className="truncate">{status}</span>
          </div>
        </div>
      </aside>

      <section className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f9_48%,#f8fafc_100%)]" />
        <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="absolute left-4 right-4 top-4 z-10 rounded-[20px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                  <Layers3 className="h-3.5 w-3.5" />
                  Workspace
                </span>
                {activeCanvas ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{activeCanvas.title}</span> : null}
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{user.email}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-lg font-black text-slate-950">{activeCanvas?.title || 'Canvas workspace'}</h2>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${latestRun ? statusClass(latestRun.status) : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{latestRun ? latestRun.status : 'idle'}</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{activeCanvas?.summary || summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => runCanvas(false)} disabled={!activeCanvas || loading} className="inline-flex items-center gap-1 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><Play className="h-3.5 w-3.5" /> Run</button>
              <button onClick={() => runCanvas(true)} disabled={!activeCanvas || loading} className="inline-flex items-center gap-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Dry Run</button>
              {waitingStep && <button onClick={() => approveWaitingStep(true)} disabled={loading} className="inline-flex items-center gap-1 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"><ShieldCheck className="h-3.5 w-3.5" /> Approve</button>}
              <button onClick={exportPng} className="inline-flex items-center gap-1 rounded-[12px] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700"><Download className="h-3.5 w-3.5" /> PNG</button>
              <button onClick={exportPdf} className="inline-flex items-center gap-1 rounded-[12px] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700"><FileText className="h-3.5 w-3.5" /> PDF</button>
            </div>
          </div>
        </div>

        {hasCanvas ? (
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => setSelectedNodeDetails(node.data.rawDetails)} onPaneClick={() => setSelectedNodeDetails(null)} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.25} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
            <Background color="#d7e3ec" gap={28} size={1} />
            <Controls className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-lg [&_button]:border-slate-100 [&_button]:bg-white [&_svg]:fill-slate-500" />
            <Panel position="top-center" className="!m-4">
              <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-white/80 bg-white/90 px-3 py-2 text-xs font-black text-slate-600 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{nodes.length} nodes</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{edges.length} paths</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{runs.length} runs</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{connectors.length} connectors</span>
              </div>
            </Panel>
          </ReactFlow>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center px-6 pt-20">
            <div className="max-w-2xl rounded-[24px] border border-white/80 bg-white/90 p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-cyan-100 bg-cyan-50 text-cyan-700"><Layers3 className="h-7 w-7" /></div>
              <h2 className="mt-5 text-2xl font-black text-slate-950">Select a project and generate a workflow</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">{summary}</p>
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                {[
                  ['Prompt to DAG', 'Describe the goal and generate a structured workflow.'],
                  ['Approval gate', 'Pause human decisions before sensitive actions.'],
                  ['Run history', 'Observe steps, logs, and connector invocations.'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{title}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-700">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <aside className="absolute right-4 top-28 z-10 hidden w-96 rounded-[18px] border border-white/80 bg-white/92 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:block">
          <div className="grid grid-cols-5 gap-1 rounded-[14px] bg-slate-100 p-1">
            {[
              ['inspect', 'Inspect'],
              ['runs', 'Runs'],
              ['ops', 'Ops'],
              ['versions', 'Versions'],
              ['logs', 'Logs'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as RightTab)} className={`rounded-[10px] py-2 text-xs font-black ${activeTab === key ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-3 max-h-[62vh] overflow-y-auto text-sm font-semibold leading-relaxed text-slate-600">
            {error ? <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-amber-900">{error}</div> : null}
            {!error && activeTab === 'inspect' && (
              selectedNodeDetails ? (
                <div>
                  <h3 className="font-black text-slate-950">{selectedNodeDetails.label}</h3>
                  <p className="mt-2">{selectedNodeDetails.description}</p>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="rounded-md border border-slate-200 p-2">Tool: {selectedNodeDetails.tool || 'built-in executor'}</div>
                    <div className="rounded-md border border-slate-200 p-2">Permissions: {(selectedNodeDetails.permissions || []).join(', ') || 'none'}</div>
                    <div className="rounded-md border border-slate-200 p-2">Audit: {selectedNodeDetails.audit_policy || 'standard'}</div>
                  </div>
                </div>
              ) : summary
            )}
            {!error && activeTab === 'runs' && (
              <div className="grid gap-3">
                {runs.map((run) => (
                  <div key={run.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-slate-950">Run #{run.id}</div>
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${statusClass(run.status)}`}>{run.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{run.trigger_type} / {run.total_tokens} tokens / ${run.total_cost_usd.toFixed(4)}</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">Queue: {run.queue_status || 'inline'}</div>
                    <div className="mt-3 grid gap-2">
                      {run.steps.map((step) => (
                        <div key={step.id} className="rounded-md border border-slate-200 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-800">{step.label}</span>
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black uppercase ${statusClass(step.status)}`}>{step.status}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">{step.latency_ms}ms / {step.token_usage} tokens / ${step.cost_usd.toFixed(4)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!error && activeTab === 'ops' && (
              <div className="grid gap-3">
                {observability ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Runs', observability.total_runs],
                        ['Active', observability.active_runs],
                        ['Steps', observability.total_steps],
                        ['Tokens', observability.total_tokens],
                        ['Cost', `$${observability.total_cost_usd.toFixed(4)}`],
                        ['Connectors', observability.connector_invocations],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</div>
                          <div className="mt-1 font-mono text-lg font-black text-slate-950">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <div className="text-xs font-black text-slate-900">Run Status</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(observability.run_status_counts).map(([key, value]) => (
                          <span key={key} className={`rounded border px-2 py-1 text-[10px] font-black uppercase ${statusClass(key)}`}>{key}: {value}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3">
                      <div className="text-xs font-black text-slate-900">Recent Errors</div>
                      <div className="mt-2 grid gap-2">
                        {observability.recent_errors.length === 0 && <div className="text-xs text-slate-400">No recent API errors.</div>}
                        {observability.recent_errors.slice(0, 5).map((item) => (
                          <div key={String(item.id)} className="rounded border border-slate-200 p-2 text-[11px] text-slate-500">
                            {String(item.status_code)} / {String(item.path)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-slate-200 p-3 text-xs text-slate-400">Observability data is loading.</div>
                )}
              </div>
            )}
            {!error && activeTab === 'versions' && (
              <div className="grid gap-2">
                {versions.map((version) => (
                  <button key={version.id} onClick={() => applyCanvas(version)} className="rounded-md border border-slate-200 p-2 text-left hover:border-cyan-200">
                    <div className="font-black text-slate-900">v{version.version}</div>
                    <div className="text-xs text-slate-400">{version.created_at}</div>
                  </button>
                ))}
              </div>
            )}
            {!error && activeTab === 'logs' && (
              <div className="grid gap-2">
                {logs.slice(0, 24).map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-2">
                    <div className="font-mono text-xs text-slate-500">{log.method} {log.path}</div>
                    <div className="mt-1 text-xs text-slate-400">{log.status_code} / {log.duration_ms}ms</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
