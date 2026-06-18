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
  ClipboardList,
  Compass,
  Cpu,
  Download,
  FileText,
  GitBranch,
  History,
  Loader2,
  LogOut,
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

type VersionRecord = {
  id: number;
  canvas_id: number;
  version: number;
  prompt: string;
  summary: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  created_at: string;
};

type TemplateRecord = {
  id: number;
  name: string;
  category: string;
  description: string;
  prompt: string;
  profile: string;
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

type ErrorState = {
  title: string;
  body: string;
  action: string;
};

type AgentNodeData = {
  label: React.ReactNode;
  rawDetails: CanvasNode;
} & Record<string, unknown>;

type AgentNode = Node<AgentNodeData, 'agentNode'>;

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
  input: { accent: 'text-sky-600', bg: 'bg-sky-50 border-sky-100', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  research: { accent: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', icon: <Search className="h-3.5 w-3.5" /> },
  planning: { accent: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100', icon: <Compass className="h-3.5 w-3.5" /> },
  execution: { accent: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: <Activity className="h-3.5 w-3.5" /> },
  automation: { accent: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: <Cpu className="h-3.5 w-3.5" /> },
  review: { accent: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  decision: { accent: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: <GitBranch className="h-3.5 w-3.5" /> },
  governance: { accent: 'text-slate-700', bg: 'bg-slate-100 border-slate-200', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  risk: { accent: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const getTone = (type?: string) => typeTone[(type ?? '').toLowerCase()] ?? typeTone.planning;

const createNodes = (items: CanvasNode[]): AgentNode[] => {
  return items.map((node, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const safeType = node.type ?? 'Planning';
    const tone = getTone(safeType);

    return {
      id: String(node.id || `node-${index}`).trim(),
      type: 'agentNode',
      position: { x: col * 360 + (row % 2 === 0 ? 0 : 88), y: row * 210 },
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
            <div className="text-[15px] font-black leading-snug text-slate-950">{node.label || '未命名节点'}</div>
            <p className="mt-2 max-h-[58px] overflow-hidden text-[12px] font-semibold leading-relaxed text-slate-500">
              {node.description || '等待 agent 补全节点说明。'}
            </p>
          </div>
        ),
      },
      style: { width: 278, height: 144 },
    };
  });
};

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
      style: { stroke: '#38bdf8', strokeWidth: 1.7, strokeDasharray: '6 6' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#38bdf8' },
    }))
    .filter((edge) => validIds.has(edge.source) && validIds.has(edge.target));
};

function AgentNodeCard({ data, selected }: NodeProps<AgentNode>) {
  return (
    <div
      className={`agent-node-shell h-[144px] w-[278px] rounded-[8px] border bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition duration-300 ${
        selected ? 'border-cyan-400 shadow-[0_18px_42px_rgba(8,145,178,0.22)]' : 'border-slate-200/90'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-slate-400" />
      {data.label}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-cyan-500" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-white !bg-cyan-500" />
    </div>
  );
}

const formatError = (message: string): ErrorState => {
  const lower = message.toLowerCase();
  if (lower.includes('401') || lower.includes('登录')) {
    return { title: '登录已失效', body: '请重新登录后继续使用项目空间。', action: message };
  }
  if (lower.includes('api_key') || lower.includes('api key') || lower.includes('key')) {
    return { title: 'Gemini Key 未配置', body: '后端没有检测到可用的 GEMINI_API_KEY。', action: '在 canvas-backend/.env 中配置 GEMINI_API_KEY 后重启后端。' };
  }
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('resource exhausted')) {
    return { title: 'Gemini 配额不足', body: '当前 Gemini API Key 已达到限额或项目计费不可用。', action: '检查 Google AI Studio / Google Cloud 的 API 配额与计费状态。' };
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return { title: '后端连接异常', body: '前端暂时无法连接 FastAPI 服务。', action: '确认后端运行在 http://localhost:8000。' };
  }
  return { title: '请求失败', body: '当前操作未完成。', action: message };
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) => {
  let line = '';
  let lineCount = 0;
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = test;
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
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [profile, setProfile] = useState('general');

  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState('登录后选择项目，输入目标或使用模板，AgentFlow 会生成并自动保存工作流画布。');
  const [activeCanvas, setActiveCanvas] = useState<CanvasRecord | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState<'insight' | 'versions' | 'logs'>('insight');
  const [status, setStatus] = useState('等待登录');
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [loading, setLoading] = useState(false);

  const hasCanvas = nodes.length > 0;

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  };

  const applyCanvas = (canvas: CanvasRecord | VersionRecord) => {
    const nextNodes = createNodes(canvas.nodes);
    const nextEdges = createEdges(canvas.edges, nextNodes);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSummary(canvas.summary);
    setSelectedNodeDetails(null);
    setErrorState(null);
    setStatus(`已载入 ${nextNodes.length} 个节点 / ${nextEdges.length} 条链路`);
  };

  const loadWorkspace = async () => {
    const [projectRows, templateRows, logRows] = await Promise.all([
      apiFetch<Project[]>('/api/projects'),
      apiFetch<TemplateRecord[]>('/api/templates'),
      apiFetch<RequestLog[]>('/api/logs'),
    ]);
    setProjects(projectRows);
    setTemplates(templateRows);
    setLogs(logRows);
    const nextProjectId = projectId ?? projectRows[0]?.id ?? null;
    setProjectId(nextProjectId);
    if (nextProjectId) {
      const canvasRows = await apiFetch<CanvasRecord[]>(`/api/projects/${nextProjectId}/canvases`);
      setCanvases(canvasRows);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(tokenKey);
    if (!saved) return;
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch<User>('/api/me')
      .then((me) => {
        setUser(me);
        setStatus('项目空间已连接');
      })
      .then(loadWorkspace)
      .catch(() => {
        window.localStorage.removeItem(tokenKey);
        setToken('');
        setUser(null);
        setStatus('等待登录');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAuth = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const result = await fetch(`${apiBaseUrl}/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.detail || '认证失败');
      window.localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setUser(data.user);
      setStatus('项目空间已连接');
    } catch (error) {
      setErrorState(formatError(error instanceof Error ? error.message : '认证失败'));
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
    setLogs([]);
    setNodes([]);
    setEdges([]);
    setActiveCanvas(null);
    setStatus('等待登录');
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
    const canvasRows = await apiFetch<CanvasRecord[]>(`/api/projects/${id}/canvases`);
    setCanvases(canvasRows);
  };

  const generateCanvas = async () => {
    if (!prompt.trim() || !projectId) return;
    setLoading(true);
    setErrorState(null);
    setStatus('AgentFlow Orchestrator 正在生成...');
    try {
      const data = await apiFetch<GenerateCanvasResponse>('/api/generate-canvas', {
        method: 'POST',
        body: JSON.stringify({
          user_prompt: prompt,
          project_id: projectId,
          canvas_id: activeCanvas?.id,
          title: prompt.trim().slice(0, 48),
          profile,
        }),
      });
      setActiveCanvas(data.canvas);
      applyCanvas(data.canvas);
      setVersions([data.version, ...versions]);
      const canvasRows = await apiFetch<CanvasRecord[]>(`/api/projects/${projectId}/canvases`);
      setCanvases(canvasRows);
      const logRows = await apiFetch<RequestLog[]>('/api/logs');
      setLogs(logRows);
    } catch (error) {
      const nextError = formatError(error instanceof Error ? error.message : '生成失败');
      setErrorState(nextError);
      setStatus(nextError.title);
    } finally {
      setLoading(false);
    }
  };

  const openCanvas = async (canvas: CanvasRecord) => {
    setActiveCanvas(canvas);
    setPrompt(canvas.prompt);
    applyCanvas(canvas);
    const versionRows = await apiFetch<VersionRecord[]>(`/api/canvases/${canvas.id}/versions`);
    setVersions(versionRows);
  };

  const applyTemplate = (template: TemplateRecord) => {
    setPrompt(template.prompt);
    setProfile(template.profile);
    setStatus(`已应用模板：${template.name}`);
  };

  const exportPng = () => {
    if (!hasCanvas) return;
    const canvas = document.createElement('canvas');
    const width = 1280;
    const height = Math.max(720, Math.ceil(nodes.length / 3) * 230 + 120);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([6, 6]);
    edges.forEach((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      if (!source || !target) return;
      ctx.beginPath();
      ctx.moveTo(source.position.x + 139, source.position.y + 72);
      ctx.lineTo(target.position.x + 139, target.position.y + 72);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    nodes.forEach((node) => {
      const raw = node.data.rawDetails;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.roundRect(node.position.x, node.position.y, 278, 144, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0891b2';
      ctx.font = '700 11px Arial';
      ctx.fillText((raw.type || 'Planning').toUpperCase(), node.position.x + 18, node.position.y + 30);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 16px Arial';
      wrapText(ctx, raw.label, node.position.x + 18, node.position.y + 62, 236, 20, 2);
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px Arial';
      wrapText(ctx, raw.description || '', node.position.x + 18, node.position.y + 98, 236, 16, 3);
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
        h1{font-size:24px;margin-bottom:8px}
        .summary{color:#475569;line-height:1.7;margin-bottom:24px}
        .node{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:10px 0}
        .type{font-size:11px;color:#0891b2;font-weight:800;text-transform:uppercase}
        .label{font-size:16px;font-weight:800;margin:6px 0}
        .desc{color:#475569;line-height:1.6}
      </style></head><body>
      <h1>${activeCanvas?.title || 'AgentFlow Canvas'}</h1>
      <div class="summary">${summary}</div>
      ${nodeList.map((node) => `<div class="node"><div class="type">${node.type || 'Planning'}</div><div class="label">${node.label}</div><div class="desc">${node.description || ''}</div></div>`).join('')}
      </body></html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  if (!user) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#f6f8fb] px-4 text-slate-900">
        <div className="w-full max-w-md rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-cyan-100 bg-cyan-50 text-cyan-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black">AgentFlow Studio</h1>
              <p className="text-xs font-semibold text-slate-500">登录后进入项目空间</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-[8px] bg-slate-100 p-1 text-sm font-black">
            <button onClick={() => setAuthMode('login')} className={`rounded-md py-2 ${authMode === 'login' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>登录</button>
            <button onClick={() => setAuthMode('register')} className={`rounded-md py-2 ${authMode === 'register' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>注册</button>
          </div>
          <div className="mt-4 space-y-3">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" className="h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码，至少 6 位" type="password" className="h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            <button onClick={handleAuth} disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-950 text-sm font-black text-white transition hover:bg-cyan-700 disabled:bg-slate-300">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {authMode === 'login' ? '进入工作台' : '创建账号'}
            </button>
          </div>
          {errorState && <p className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{errorState.action}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-[#f6f8fb] text-slate-900 antialiased md:flex-row">
      <aside className="z-20 flex h-[60dvh] shrink-0 flex-col border-b border-slate-200/80 bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:h-full md:w-[430px] md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-100 bg-cyan-50 text-cyan-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black tracking-wide text-slate-950">AgentFlow Studio</h1>
                <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-rose-600" aria-label="退出登录">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Projects', value: projects.length, icon: <Boxes className="h-4 w-4" /> },
              { label: 'Canvases', value: canvases.length, icon: <Route className="h-4 w-4" /> },
              { label: 'Versions', value: versions.length, icon: <History className="h-4 w-4" /> },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-slate-400">{metric.icon}</div>
                <div className="font-mono text-lg font-black text-slate-950">{metric.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{metric.label}</div>
              </div>
            ))}
          </div>

          <section className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">项目空间</div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="新项目名称" className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-400" />
              <button onClick={createProject} className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-2">
              {projects.map((project) => (
                <button key={project.id} onClick={() => selectProject(project.id)} className={`rounded-md border px-3 py-2 text-left text-xs font-bold transition ${projectId === project.id ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:border-cyan-200'}`}>
                  {project.name}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="prompt" className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">场景目标</label>
              <select value={profile} onChange={(event) => setProfile(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600">
                {profiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <textarea id="prompt" className="h-28 w-full resize-none rounded-[8px] border border-slate-200 bg-white p-3 text-sm font-semibold leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" placeholder="输入任意业务、学习、科研、运营、产品、创作或项目管理目标..." value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <button type="button" onClick={generateCanvas} disabled={loading || !prompt.trim() || !projectId} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              生成并保存画布
            </button>
          </section>

          <section className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">模板库</div>
            <div className="grid gap-2">
              {templates.map((template) => (
                <button key={template.id} onClick={() => applyTemplate(template)} className="rounded-md border border-slate-200 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50">
                  <div className="text-xs font-black text-slate-900">{template.name}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{template.category} · {template.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">画布</div>
            <div className="grid gap-2">
              {canvases.length === 0 && <p className="text-xs font-semibold text-slate-400">当前项目还没有保存的画布。</p>}
              {canvases.map((canvas) => (
                <button key={canvas.id} onClick={() => openCanvas(canvas)} className={`rounded-md border p-3 text-left transition ${activeCanvas?.id === canvas.id ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 hover:border-cyan-200'}`}>
                  <div className="text-xs font-black text-slate-900">{canvas.title}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{canvas.updated_at}</div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_rgba(14,165,233,0.12)] ${errorState ? 'bg-amber-500' : hasCanvas ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="truncate">{status}</span>
          </div>
        </div>
      </aside>

      <section className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f9_48%,#f8fafc_100%)]" />
        <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px]" />

        {hasCanvas ? (
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => setSelectedNodeDetails(node.data.rawDetails)} onPaneClick={() => setSelectedNodeDetails(null)} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.25} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
            <Background color="#d7e3ec" gap={28} size={1} />
            <Controls className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-lg [&_button]:border-slate-100 [&_button]:bg-white [&_svg]:fill-slate-500" />
            <Panel position="top-center" className="!m-4">
              <div className="flex items-center gap-2 rounded-[8px] border border-white/80 bg-white/90 px-3 py-2 text-xs font-black text-slate-600 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <button onClick={exportPng} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-cyan-700 hover:bg-cyan-50"><Download className="h-3.5 w-3.5" /> PNG</button>
                <button onClick={exportPdf} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-cyan-700 hover:bg-cyan-50"><FileText className="h-3.5 w-3.5" /> PDF</button>
                <span className="h-4 w-px bg-slate-200" />
                <span>{nodes.length} nodes</span>
                <span>{edges.length} paths</span>
              </div>
            </Panel>
          </ReactFlow>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <div className="max-w-xl rounded-[8px] border border-white/80 bg-white/88 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-100 bg-cyan-50 text-cyan-700"><Route className="h-6 w-6" /></div>
              <h2 className="mt-4 text-xl font-black text-slate-950">项目空间已就绪</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">选择模板或输入目标，AgentFlow Orchestrator 会生成并保存可执行拓扑。版本历史、日志和导出能力会随画布自动启用。</p>
            </div>
          </div>
        )}

        <aside className="absolute right-4 top-20 z-10 hidden w-80 rounded-[8px] border border-white/80 bg-white/90 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:block">
          <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-slate-100 p-1">
            {[
              ['insight', '洞察'],
              ['versions', '版本'],
              ['logs', '日志'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as 'insight' | 'versions' | 'logs')} className={`rounded-md py-2 text-xs font-black ${activeTab === key ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-3 max-h-[56vh] overflow-y-auto text-sm font-semibold leading-relaxed text-slate-600">
            {errorState ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <div className="font-black">{errorState.title}</div>
                <p className="mt-1">{errorState.body}</p>
                <p className="mt-2 text-xs font-bold">{errorState.action}</p>
              </div>
            ) : activeTab === 'insight' ? (
              selectedNodeDetails ? <><h3 className="font-black text-slate-950">{selectedNodeDetails.label}</h3><p className="mt-2">{selectedNodeDetails.description}</p></> : summary
            ) : activeTab === 'versions' ? (
              <div className="grid gap-2">
                {versions.map((version) => (
                  <button key={version.id} onClick={() => applyCanvas(version)} className="rounded-md border border-slate-200 p-2 text-left hover:border-cyan-200">
                    <div className="font-black text-slate-900">v{version.version}</div>
                    <div className="text-xs text-slate-400">{version.created_at}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid gap-2">
                {logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-2">
                    <div className="font-mono text-xs text-slate-500">{log.method} {log.path}</div>
                    <div className="mt-1 text-xs text-slate-400">{log.status_code} · {log.duration_ms}ms</div>
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
