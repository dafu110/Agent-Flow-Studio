

# ⚡ AI-Canvas平台 | 次世代企业架构与数字化战略拓扑推演平台

AI-Canvas是一款专为**企业高级管理咨询、数字化转型战略落地**设计的次世代**非线性拓扑推演大屏系统**。平台打破了传统文字报告的孤岛效应，利用大语言模型（LLM）的图解构能力，将模糊的组织战略诉求物理地图化为具备强依赖关系、高精细化桥梁、ROI投资回报率及风险评估矩阵的**大观数字架构图谱**。

---

## 🎨 平台全景窗览

*<img width="1872" height="800" alt="assets" src="https://github.com/user-attachments/assets/6a0f60fa-fc43-4f0e-9d1a-163fc006349b" />*
<img width="1611" height="895" alt="assets1" src="https://github.com/user-attachments/assets/8c23f607-d25d-4356-a02b-41ea0cfb9ad0" />

```text
[ 🪐 数字化战略输入 ] ──(LLM 非线性解构)──> [ 📊 动态拓扑推演大屏 ]

```

---

## 🏗️ 全栈大统一系统架构设计

本平台采用严格要求的前后端分离及**云端大模型代理（Backend Proxy）架构**，焊死了客户端密钥流失的潜在安全隐患：

```text
[ 前端自适应业务层 (Next.js 15) ]
       │ (1. 投递非线性战略构想 │ 零密钥暴露风险)
       ▼
[ 工业级全栈后端网关 (FastAPI) ] <── 加载本地安全策略 (.env 物理隔离)
       │ (2. 声明式 Pydantic 数据契约约束)
       ▼
[ LangChain 编排引擎 & 约束 AST 解析 ]
       │ (3. 双向状态流控制 & Gemini 3.5 高并发重试)
       ▼
[ 智能解构节点与非线性依赖拓扑流 (React Flow) ] ──> 渲染次世代空气感磨砂玻璃大屏

```

---

## ✨ 核心特性

* **💡 模糊战略精准解构**：输入碎片化的企业经营痛点或战略设想，AI 自动抽离底层组织架构依赖，解构生成清晰的拓扑节点。
* **👁️ 沉浸式数字大屏**：基于 React Flow 打造的次世代空气感磨砂玻璃大屏，支持动态连线、节点下钻及 ROI 风险热力图展示。
* **🔒 工业级安全网关**：FastAPI 构建的本地安全网关，全面代理大模型交互，提供声明式数据校验与零密钥泄露保障。
* **⚡ 高并发弹性编排**：基于 LangChain 编排引擎与双向状态流控制，无缝调度 Gemini 3.5 进行高质量、高确定性的逻辑推理。

---

## 📂 项目目录结构

```text
AI-Canvas-V1/
├── assets/             # 静态资源与平台全景预览截图
├── canvas-backend/     # 工业级后端网关 (FastAPI + LangChain + Gemini)
├── canvas-frontend/    # 次世代自适应前端大屏 (Next.js 15 + React Flow)
├── .gitignore          # 本地缓存与环境隔离忽略配置
└── README.md           # 项目主自述文件

```

---

## 🚀 快速启动

### 📥 1. 克隆与环境准备

```bash
git clone https://github.com/dafu110/AI-Canvas-V1.git
cd AI-Canvas-V1

```

### ⚙️ 2. 后端配置与启动 (FastAPI)

```bash
cd canvas-backend

# 创建并激活虚拟环境 (建议)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows 用户请执行此行

# 安装核心依赖
pip install -r requirements.txt

# 配置本地环境变量 (在 canvas-backend 根目录下新建 .env 文件)
# GEMINI_API_KEY=您的Gemini密钥

# 启动本地热重载网关
uvicorn main:app --reload --port 8000

```

### 💻 3. 前端配置与启动 (Next.js)

```bash
cd ../canvas-frontend

# 安装前端依赖
npm install

# 启动开发服务器
npm run dev -- -p 3000

```

打开浏览器访问 `http://localhost:3000` 即可体验完整的次世代战略推演平台。
