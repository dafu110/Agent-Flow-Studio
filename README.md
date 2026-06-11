# ⚡ AI-Canvas Platform | 次世代企业架构与数字化战略拓扑推演平台

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015.1-black?logo=next.dotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/AI%20Orchestration-LangChain-1C3C3C?logo=chainlink)](https://js.langchain.com/)
[![ReactFlow](https://img.shields.io/badge/Topology-React%20Flow-06b6d4)](https://reactflow.dev/)

AI-Canvas 是一款专为企业高级管理咨询、数字化转型战略落地设计的次世代**非线性拓扑推演大屏系统**。平台打破了传统文字报告的孤岛效应，利用大语言模型（LLM）的图谱解构能力，将模糊的组织战略诉求物理映射为具备强依赖链路、高精细化白皮书、ROI 投资回报率及风险评估矩阵的**大局观数字架构图谱**。

---

## 🎨 平台全景视窗预览
> 
<img width="1872" height="800" alt="assets" src="https://github.com/user-attachments/assets/fe152e53-2967-4a07-843e-f2f7589410ab" />



---

## 🏗️ 全栈大统一系统架构设计

本平台采用严苛的**前后端分离及云端大模型代理（Backend Proxy）架构**，焊死了客户端密钥泄露的潜在安全隐患：

```text
[ 前端自适应业务层 (Next.js 15) ] 
       │ (1. 投递非线性战略构想 - 零密钥暴露风险)
       ▼
[ 工业级全栈后端网关 (FastAPI) ] ◄─── 加载本地安全策略 (.env 物理隔离)
       │ (2. 声明式 Pydantic 数据契约约束)
       ▼
[ LangChain 编排引擎 & 约束 AST 解析 ]
       │ (3. 双向状态流控制 & Gemini 3.5 高并发重试)
       ▼
[ 智能解构节点与非线性依赖拓扑流 (React Flow) ] ──► 渲染次世代空气感磨砂玻璃大屏
