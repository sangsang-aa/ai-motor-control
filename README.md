# MOTOTUNE — AI 电驱控制系统 (Web 版)

基于 Next.js 的电机控制 Web 应用:AI 对话控制 + Web Serial 直连电机 + SVG 示波器实时波形。

> **分支说明**:本分支 `web/` 是重构分支 — 从 Electron 桌面版重构为 Next.js Web 版,先写齐 Web 功能,之后封装 Electron 桌面版。桌面版见 `main`/`arm64` 分支。

## 快速开始

```bash
npm install
npm run dev                  # http://localhost:3000
```

**配置 LLM(二选一,推荐方式一):**
1. **设置面板(推荐,无需 .env):** 启动后点击侧栏「设置」→ 在「AI 供应商」选预设(或自定义),填入 Base URL / API Key / 模型 → 保存。配置存本机 localStorage,刷新保留。
2. **服务端 `.env.local`(可选 fallback):** `cp .env.example .env.local` 并填入真实 `LLM_API_KEY`(配合对应的 `LLM_BASE_URL`)——仅当未在设置面板配置时生效。

浏览器要求:**Chrome/Edge**(需支持 Web Serial),访问需 HTTPS 或 localhost。

## 功能

- AI 自然语言控制电机 (set_speed / set_motor_state / set_mode / set_param / get_status)
- 指令人工确认机制 (30s 超时自动取消) + 急停按钮
- Web Serial 直连串口,协议: **AI-Motor v1**(TI C2000 F280025C,115200 8N1;mode5/6/7/8 + 参数表 + 100Hz 遥测)
- PMSM 参数辨识 `/param-est`(复用主串口 **mode7**;母线/极对数/最大测试电流 → Rs/Ld/Lq/Ls)
- 亮/暗主题切换(默认亮色,侧栏/设置切换,持久化)
- 手动控制 `/control`(对齐原上位机手动页:模式/启停/调速/参数分组/速度与 dq/三相波形/CSV/演示)
- SVG 示波器实时波形 (100Hz 多通道 + 暂停/HEX 切换 + 通道量程/偏移调节)
- 会话自动持久化 (localStorage) + HTML 报告导出
- 双页面:聊天 `/` + 示波器 `/scope`

## 架构

```
Next.js (纯客户端渲染, 唯一服务端 = /api/llm 代理)
  │
  ├── ChatApp (/)  ←── aiMotorBus / llmBus ──→  ScopeApp (/scope) / ParamEstApp (/param-est)
  │                       │
  │        lib/serial/aimotor/controller.ts (Web Serial · AI-Motor v1)
  │        lib/llm/llmClient.ts (SSE) → /api/llm → LLM (阿里云百炼兼容接口)
  │
  └── 5 个 zustand store: session / motor / commandLock / scope / knowledge
```

- **串口**:浏览器 Web Serial API 直连 DSP 下位机(当前为 TI C2000 F280025C),协议层纯 TS(`lib/serial/aimotor/*`,AI-Motor v1)
- **参数辨识**:`/param-est` 复用同一串口的 mode7(母线/极对数/最大测试电流 → Rs/Ld/Lq/Ls);协议细节见 `docs/aimotor_protocol.md`
- **LLM**:同源代理 `/api/llm` 保护 API key,SSE 流式,工具调用需人工确认
- **事件**:统一事件总线(`lib/bus.ts`),替代原 Electron 版 IPC 广播

详见 AGENTS.md(含重构目的与 Electron 封装路线)。
