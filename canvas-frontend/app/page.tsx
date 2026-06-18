'use client';

import React, { useMemo, useState } from 'react';
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
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Compass,
  Cpu,
  FileText,
  GitBranch,
  Loader2,
  Network,
  Play,
  RefreshCw,
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

type TopologyResponse = {
  summary: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
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

const scenarioPrompts = [
  {
    label: '产品上线',
    prompt: '为一个 SaaS 新功能上线制定 agent 工作流：从用户需求澄清、竞品调研、方案设计、研发协作、测试验收、灰度发布到复盘增长。',
  },
  {
    label: '学习计划',
    prompt: '为 30 天掌握数据分析基础设计学习 agent：包含目标拆解、资料筛选、每日练习、项目实战、复盘测试和成果展示。',
  },
  {
    label: '运营活动',
    prompt: '为一次线上会员增长活动设计 agent 编排：包含人群洞察、权益设计、内容投放、自动化触达、数据监控、风险控制和复盘。',
  },
  {
    label: '科研项目',
    prompt: '为一个科研课题推进设计 agent 工作流：包含问题定义、文献综述、实验设计、数据采集、分析验证、论文写作和同行反馈。',
  },
];

const typeTone: Record<string, { accent: string; bg: string; icon: React.ReactNode }> = {
  input: {
    accent: 'text-sky-600',
    bg: 'bg-sky-50 border-sky-100',
    icon: <ClipboardList className="h-3.5 w-3.5" />,
  },
  research: {
    accent: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-100',
    icon: <Search className="h-3.5 w-3.5" />,
  },
  planning: {
    accent: 'text-cyan-700',
    bg: 'bg-cyan-50 border-cyan-100',
    icon: <Compass className="h-3.5 w-3.5" />,
  },
  execution: {
    accent: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
    icon: <Activity className="h-3.5 w-3.5" />,
  },
  automation: {
    accent: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
    icon: <Cpu className="h-3.5 w-3.5" />,
  },
  review: {
    accent: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  decision: {
    accent: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-100',
    icon: <GitBranch className="h-3.5 w-3.5" />,
  },
  governance: {
    accent: 'text-slate-700',
    bg: 'bg-slate-100 border-slate-200',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  risk: {
    accent: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-100',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
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
      position: {
        x: col * 360 + (row % 2 === 0 ? 0 : 88),
        y: row * 210,
      },
      data: {
        rawDetails: {
          ...node,
          id: String(node.id || `node-${index}`).trim(),
          type: safeType,
        },
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
      style: {
        width: 278,
        height: 144,
      },
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
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: '#38bdf8',
      },
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

  if (lower.includes('api_key') || lower.includes('api key') || lower.includes('key')) {
    return {
      title: 'Gemini Key 未配置',
      body: '后端没有检测到可用的 GEMINI_API_KEY，因此无法调用 Gemini。',
      action: '在 canvas-backend/.env 中配置 GEMINI_API_KEY 后重启后端。',
    };
  }

  if (lower.includes('quota') || lower.includes('billing') || lower.includes('resource exhausted')) {
    return {
      title: 'Gemini 配额不足',
      body: '当前 Gemini API Key 已达到限额或项目计费不可用。',
      action: '检查 Google AI Studio / Google Cloud 的 API 配额与计费状态。',
    };
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return {
      title: '后端连接异常',
      body: '前端暂时无法连接 FastAPI 服务。',
      action: '确认后端运行在 http://localhost:8000，并检查 NEXT_PUBLIC_API_BASE_URL。',
    };
  }

  return {
    title: '生成请求失败',
    body: 'Agent 生成链路暂时不可用。',
    action: message,
  };
};

export default function CanvasPage() {
  const nodeTypes = useMemo(() => ({ agentNode: AgentNodeCard }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('输入任意场景目标后，AgentFlow Orchestrator 会生成一张可执行的 agent 工作流拓扑。');
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ops' | 'risk'>('overview');
  const [status, setStatus] = useState('等待输入场景');
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const hasCanvas = nodes.length > 0;

  const applyCanvas = (canvas: TopologyResponse) => {
    const nextNodes = createNodes(canvas.nodes);
    const nextEdges = createEdges(canvas.edges, nextNodes);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSummary(canvas.summary);
    setSelectedNodeDetails(null);
    setErrorState(null);
    setStatus(`已生成 ${nextNodes.length} 个节点 / ${nextEdges.length} 条链路`);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setPrompt('');
    setSelectedNodeDetails(null);
    setErrorState(null);
    setSummary('输入任意场景目标后，AgentFlow Orchestrator 会生成一张可执行的 agent 工作流拓扑。');
    setStatus('等待输入场景');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setSelectedNodeDetails(null);
    setErrorState(null);
    setStatus('Gemini agent 正在拆解场景...');

    try {
      const response = await fetch(`${apiBaseUrl}/api/generate-canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_prompt: prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '后端服务返回异常');
      }

      const data = (await response.json()) as TopologyResponse;
      if (!data?.summary || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error('Agent 返回的数据结构不完整');
      }

      applyCanvas(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知异常';
      const nextError = formatError(message);
      setErrorState(nextError);
      setStatus(nextError.title);
    } finally {
      setLoading(false);
    }
  };

  const metricTiles = [
    { label: 'Nodes', value: nodes.length.toString(), icon: <BrainCircuit className="h-4 w-4" /> },
    { label: 'Paths', value: edges.length.toString(), icon: <Network className="h-4 w-4" /> },
    { label: 'Mode', value: 'General', icon: <Boxes className="h-4 w-4" /> },
  ];

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-[#f6f8fb] text-slate-900 antialiased md:flex-row">
      <aside className="z-20 flex h-[56dvh] shrink-0 flex-col border-b border-slate-200/80 bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:h-full md:w-[400px] md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-100 bg-cyan-50 text-cyan-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black tracking-wide text-slate-950">AgentFlow Studio</h1>
                <p className="truncate text-xs font-semibold text-slate-500">通用场景智能体编排台</p>
              </div>
            </div>
            <div className="rounded-md border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
              Gemini
            </div>
          </div>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            {metricTiles.map((metric) => (
              <div key={metric.label} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-slate-400">{metric.icon}</div>
                <div className="font-mono text-lg font-black text-slate-950">{metric.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{metric.label}</div>
              </div>
            ))}
          </div>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="prompt" className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                场景目标
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                清空
              </button>
            </div>

            <div className="mb-2 grid grid-cols-2 gap-2">
              {scenarioPrompts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setPrompt(item.prompt)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <textarea
              id="prompt"
              className="h-32 w-full resize-none rounded-[8px] border border-slate-200 bg-white p-3 text-sm font-semibold leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              placeholder="输入任意业务、学习、科研、运营、产品、创作或项目管理目标..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)] transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              生成 AgentFlow 拓扑
            </button>
          </section>

          <section className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-slate-100 p-1">
              {[
                ['overview', '洞察'],
                ['ops', '执行'],
                ['risk', '风险'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as 'overview' | 'ops' | 'risk')}
                  className={`rounded-md py-2 text-xs font-black transition ${
                    activeTab === key ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-[184px] rounded-[8px] border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                {errorState ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : selectedNodeDetails ? <Cpu className="h-3.5 w-3.5 text-cyan-600" /> : <FileText className="h-3.5 w-3.5 text-cyan-600" />}
                {errorState ? 'Service Notice' : selectedNodeDetails ? 'Node Intelligence' : 'Workspace Insight'}
              </div>

              {errorState && !selectedNodeDetails ? (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                  <div className="font-black">{errorState.title}</div>
                  <p className="mt-1 font-semibold">{errorState.body}</p>
                  <p className="mt-2 text-xs font-bold text-amber-700">{errorState.action}</p>
                </div>
              ) : activeTab === 'overview' ? (
                <div className="whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-600">
                  {selectedNodeDetails ? (
                    <>
                      <h2 className="mb-2 text-base font-black text-slate-950">{selectedNodeDetails.label}</h2>
                      <p>{selectedNodeDetails.description}</p>
                    </>
                  ) : (
                    summary
                  )}
                </div>
              ) : null}

              {activeTab === 'ops' && !errorState && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-500">工作节点</span>
                    <span className="font-mono font-black text-slate-950">{nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-500">依赖链路</span>
                    <span className="font-mono font-black text-cyan-700">{edges.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500">建议节奏</span>
                    <span className="font-mono font-black text-emerald-600">{hasCanvas ? '分阶段执行' : '待生成'}</span>
                  </div>
                </div>
              )}

              {activeTab === 'risk' && !errorState && (
                <div className="space-y-3 text-sm font-semibold leading-relaxed text-slate-600">
                  <p>{hasCanvas ? '优先检查输入是否清晰、关键依赖是否闭环、评审节点是否足够靠前。' : '生成拓扑后，这里会用于审查依赖缺口、执行风险和治理动作。'}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['目标', '依赖', '反馈'].map((item) => (
                      <div key={item} className="rounded-md border border-slate-200 bg-white p-2 text-center">
                        <div className="font-mono text-sm font-black text-slate-700">{hasCanvas ? 'OK' : '-'}</div>
                        <div className="text-[10px] font-black text-slate-500">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNodeDetails(node.data.rawDetails)}
            onPaneClick={() => setSelectedNodeDetails(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d7e3ec" gap={28} size={1} />
            <Controls className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-lg [&_button]:border-slate-100 [&_button]:bg-white [&_svg]:fill-slate-500" />
            <Panel position="top-center" className="!m-4">
              <div className="flex items-center gap-3 rounded-[8px] border border-white/80 bg-white/90 px-4 py-2 text-xs font-black text-slate-600 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <span className="flex items-center gap-2 text-cyan-700">
                  <Play className="h-3.5 w-3.5 fill-cyan-600" />
                  AgentFlow Canvas
                </span>
                <span className="h-4 w-px bg-slate-200" />
                <span>{nodes.length} nodes</span>
                <span>{edges.length} paths</span>
              </div>
            </Panel>
          </ReactFlow>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <div className="max-w-xl rounded-[8px] border border-white/80 bg-white/88 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-100 bg-cyan-50 text-cyan-700">
                <Route className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-black text-slate-950">从空画布开始编排任何场景</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
                输入一个目标，AgentFlow Orchestrator 会把它拆成可执行节点、依赖关系和风险检查点。这里不会预加载示例，生成结果完全来自你的场景。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-black text-slate-500 sm:grid-cols-4">
                {scenarioPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPrompt(item.prompt)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
