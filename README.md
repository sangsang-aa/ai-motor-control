# MOTOTUNE — AI 电驱控制系统 (Web 版)

基于 Next.js 的电机控制 Web 应用:AI 对话控制 + Web Serial 直连电机 + SVG 示波器实时波形。

> **分支说明**:本分支 `web/` 是重构分支 — 从 Electron 桌面版重构为 Next.js Web 版,先写齐 Web 功能,之后封装 Electron 桌面版。桌面版见 `main`/`arm64` 分支。

## 快速开始

```bash
cp .env.example .env.local   # 填入 LLM API Key
npm install
npm run dev                  # http://localhost:3000
```

浏览器要求:**Chrome/Edge**(需支持 Web Serial),访问需 HTTPS 或 localhost。

## 功能

- AI 自然语言控制电机 (set_speed / set_motor_state / get_status)
- 指令人工确认机制 (30s 超时自动取消) + 急停按钮
- Web Serial 直连串口,协议: `'SS' + 600×[Ia, Speed] uint16 LE + 'EE'`(1500000 波特率)
- SVG 示波器实时波形 (多通道 + 暂停/HEX 切换 + 通道量程/偏移调节)
- 会话自动持久化 (localStorage) + HTML 报告导出
- 双页面:聊天 `/` + 示波器 `/scope`

## 架构

```
Next.js (纯客户端渲染, 唯一服务端 = /api/llm 代理)
  │
  ├── ChatApp (/)  ←── backendBus / llmBus ──→  ScopeApp (/scope)
  │                       │
  │        lib/serial/motorController.ts (Web Serial)
  │        lib/llm/llmClient.ts (SSE) → /api/llm → LLM (阿里云百炼兼容接口)
  │
  └── 4 个 zustand store: session / motor / commandLock / scope
```

- **串口**:浏览器 Web Serial API 直连硬件,协议层纯 TS(`lib/serial/protocol.ts`,从原 Python 后端移植)
- **LLM**:同源代理 `/api/llm` 保护 API key,SSE 流式,工具调用需人工确认
- **事件**:统一事件总线(`lib/bus.ts`),替代原 Electron 版 IPC 广播

详见 AGENTS.md(含重构目的与 Electron 封装路线)。
