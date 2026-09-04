# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-04
**Branch:** web

## HIERARCHY
- `lib/AGENTS.md` — 核心逻辑域(串口/LLM/store/设置)
- `components/AGENTS.md` — 业务组件域(chat/scope)

---

# AGENTS.md — MOTOTUNE (web 分支)

## ⚠️ 本分支的重构目的(最高优先级)

本分支 `web/` 是 **MOTOTUNE 从 Electron 桌面版 → Next.js Web 版的重构分支**,与 `main`(Electron x86)、`arm64` 分支并存。

**为什么重构**(与用户确认的决策,勿偏离):

1. **先写齐 Web 版基本功能,再封装 Electron 桌面版** — 这是本分支的最终路线:当前阶段只做 Web(Next.js),功能齐备后加 Electron 壳层打包为桌面应用。
2. **砍掉 Python 后端** — 串口协议层已用纯 TS 重写(`lib/serial/modbus.ts`,Modbus RTU),浏览器通过 **Web Serial API** 直连 DSP 下位机,不再需要 pyserial/numpy 子进程。
3. **LLM 走同源代理** — `/api/llm` 服务端代理保护 API key + 绕 CORS,key 只存 `.env.local`(不入库),浏览器永不接触。
4. **纯客户端渲染** — 页面全部 `'use client'`,禁止新增 SSR/Server Component 依赖(便于后续 Electron 封装,见下)。

**后续 Electron 封装路线(完成 Web 版后):**

- 方案 A(推荐):`next build` + `next start` 内置运行,窗口加载 localhost:3000
- 方案 B:`next export` 静态导出 + 主进程直接加载,但 `/api/llm` 代理需搬入 Electron 主进程
- 串口:新增 `ElectronSerialAdapter`(node-serialport via IPC),替换 `lib/serial/motorController.ts` 内的 Web Serial 实现 —— `SerialAdapter` 抽象是为此预留的,UI/store 层零改动

## 架构

```
Next.js (App Router, 纯客户端渲染)
├── app/
│   ├── page.tsx          → ChatApp(聊天主页, /)
│   ├── scope/page.tsx    → ScopeApp(示波器, /scope)
│   └── api/llm/route.ts  → LLM 代理(唯一服务端代码)
├── components/chat/      → Topbar/Sidebar/ChatPane/Composer/ConfirmCard/EStop/横幅
├── components/scope/     → ScopeChart/ChannelPanel/HexView/Pause/HexToggle
└── lib/
    ├── types.ts          → 跨层类型(与 Electron 版 src/shared/types.ts 同源)
    ├── bus.ts            → 事件总线:backendBus(串口事件)/llmBus(LLM 事件)/hexBus(原始字节)
    ├── serial/modbus.ts → Modbus RTU 协议层(CRC16/01/03/05/06/0F/10 帧 + float32 编解码 + 寄存器/线圈地址表)
    ├── serial/motorController.ts → Web Serial 适配 + 命令执行 + telemetry 事件
    ├── llm/llmClient.ts  → SSE 解析(浏览器端,从 Electron llmProxy 移植)
    ├── llm/tools.ts      → 工具定义 + 系统提示词(前后端共用)
    ├── report.ts         → 会话报告导出(Blob 下载,替代 Electron 文件系统版)
    └── stores/           → 4 个 zustand store(从 Electron 版迁移,持久化改 localStorage)
```

## 数据流

- **事件**:`motorController`(串口)→ `backendBus` → `ChatApp`/`ScopeApp` 订阅 → store。替代 Electron 的 `motor:event` 广播。
- **LLM**:Composer → `llmClient.sendMessage` → `llmBus` → `ChatApp` 统一处理(text 追加 / tool_call 锁链)。**无条件发 turn_end**(即使只有 tool_call,否则 inflight 锁死 — 从 Electron 版继承的坑)。
- **命令锁链**:`tool_call` → `lock.lock()` → `setPendingToolCall` → ChatPane `ConfirmCard` → 确认 → `motorController.sendCommand` → `executed` 事件 → `lock.unlock()`。30s 超时自动取消。`get_status` 免确认自动执行。
- **示波器**:telemetry 帧 → `ScopeApp` 交错 Ia/RPM → `scopeStore.applyFrame(payload, 2)` → `ScopeChart`(SVG rAF)。原始字节 → `hexBus` → `appendHex`。
- **持久化**:会话存 localStorage(`mototune.sessions`),示波器通道配置存 localStorage(`scope.*`)。

## 串口协议(Modbus RTU,与固件强绑定,见 docs/modbus_rtu_protocol.md)

- 保持寄存器(功能码 03/06/10):`SPEED_SETPOINT`(0x0000)、PID 双环参数(0x0100 SPD / 0x0110 CUR)、状态遥测(0x1000)
- 线圈(功能码 01/05/0F,独立地址空间):`COIL_MOTOR_EN`(0x0000)、`COIL_FAULT_RESET`(0x0001)、`COIL_EMERGENCY_STOP`(0x0002)
- float32 参数占 2 寄存器,big-endian(高字低地址);CRC-16/MODBUS
- 遥测由主站每 50ms 轮询 0x03 读回(无持续推送帧)→ 示波器数据源
- 波特率默认 1500000,可运行时动态调整
- 转速上限 6000 RPM(安全约束,超限 clamp)

## Web Serial 已知约束(坑)

- 仅 Chromium 系浏览器(Chrome/Edge);需 HTTPS 或 localhost
- `requestPort()` 必须在用户手势(点击)中调用 — 连接按钮不能走异步链
- 刷新页面后需重新授权选择设备;页面关闭即释放串口
- 浏览器不支持 Web Serial 时,Topbar 连接会 alert 提示

## 开发

```bash
cp .env.example .env.local   # 填入 LLM_API_KEY(⚠️ 必须编辑,不能直接用占位符,否则 /api/llm 返回 401)
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # 生产模式(需保留 /api/llm,不能 next export)
```

## 组件约束(从 Electron 版继承)

- 深色工业风:底色 `#0a1628`,强调色 `#00a8ff`(聊天)/ `#00a8ff` 示波器,告警 `#ff9500`,危险 `#ff3b30`
- 样式:Tailwind v3 + 原始 CSS 类(见 `app/globals.css`;**不 @apply 自定义颜色**,AGENTS.md 历史教训)
- 无 emoji;中文界面;EStop 按钮 `bottom:90px; right:20px`(fixed)
- 双页面用 `<a href="/scope">` 跳转,无窗口概念

## Git

- `web` 分支:本重构。`main`/`arm64` 分支:Electron 版(继续独立演进)
- `.env.local`、`next-env.d.ts` 不入库(gitignore)
- LLM 配置改动只改 `.env.local` + `.env.example`,不写死代码
