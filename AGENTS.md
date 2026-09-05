# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-04
**Branch:** web

## HIERARCHY
- `lib/AGENTS.md` — 核心逻辑域(串口/LLM/store/设置)
- `components/AGENTS.md` — 业务组件域(chat/scope)
- `docs/` — 说明文档区块(DESIGN/TESTING/modbus 协议/AI 调参记录/界面参考)

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
├── components/chat/      → ChatApp/Topbar/Sidebar/ChatPane/Composer/ConfirmCard/EStop/横幅 + SettingsPanel/SearchDialog
├── components/scope/     → ScopeApp(带"实时数据"区)/ScopeChart/ChannelPanel/HexView/Pause/HexToggle
└── lib/
    ├── types.ts          → 跨层类型(BackendEvent/LlmEvent/Session/Message/MotorStatus)
    ├── bus.ts            → 事件总线:backendBus(串口)/llmBus(LLM)/hexBus(原始字节)
    ├── config.ts         → 常量 DEFAULT_BAUD/RPM_LIMIT/COMMAND_CONFIRM_TIMEOUT
    ├── settings.ts       → localStorage 设置(语言/AI 供应商/baseUrl/apiKey/model)
    ├── i18n.ts           → 中/英字典 + useLangStore(响应式切换)
    ├── serial/modbus.ts → Modbus RTU 协议层(CRC16/01/03/05/06/0F/10 帧 + float32 编解码 + 地址表 ADDR/FC)
    ├── serial/motorController.ts → Web Serial 适配 + 串行事务队列 + 写命令 + 50ms 轮询遥测
    ├── llm/llmClient.ts  → SSE 解析 + abort(浏览器端)
    ├── llm/tools.ts      → 工具定义 TOOLS + 系统提示词 SYSTEM_PROMPT(前后端共用)
    ├── report.ts         → 会话报告导出(Blob 下载)
    └── stores/           → session/motor/commandLock/scope 4 个 zustand store(持久化改 localStorage)
```

## 数据流

- **事件**:`motorController`(串口)→ `backendBus` → `ChatApp`/`ScopeApp` 订阅 → store。替代 Electron 的 `motor:event` 广播。
- **LLM**:Composer → `llmClient.sendMessage` → `llmBus` → `ChatApp` 统一处理(text 追加 / tool_call 锁链)。**无条件发 turn_end**(即使只有 tool_call,否则 inflight 锁死 — 从 Electron 版继承的坑)。
- **命令锁链**:`tool_call` → `lock.lock()` → `setPendingToolCall` → ChatPane `ConfirmCard` → 确认 → `motorController.sendCommand` → `executed` 事件 → `lock.unlock()`。30s 超时自动取消。`get_status` 免确认自动执行。`set_motor_state`/`sendCommand` 走 Modbus,`write_pid_<REG>` 写保存寄存器(供 AI 自调整)。
- **示波器**:telemetry 轮询 → `ScopeApp` 交错 Ia/RPM → `scopeStore.applyFrame(payload, 2)` → `ScopeChart`(SVG rAF)。波形区上方"实时数据"条遍历 `channels` 显示当前值(通道名跟随 `label||name`,即 ChannelPanel 命名)。原始字节 → `hexBus` → `appendHex`。
- **持久化**:会话存 localStorage(`mototune.sessions`),示波器通道配置存 localStorage(`scope.*`),设置存 localStorage(`mototune.settings`)。

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
npm install
npm run dev                  # 开发:http://localhost:3000
npm run build && npm start   # 生产(需保留 /api/llm,不能 next export)
npm run test:unit / test:e2e / test:all   # 测试(playwright 起 3100,非 3000)
```

- **LLM 配置推荐走设置面板**(侧栏「设置」→ AI 供应商/Base URL/API Key/模型,存 localStorage),**无需 .env.local**。`/api/llm` 优先用请求带的 `body.config`(设置),env 仅作可选回退。
- `.env.local`/`.env.example` 不入库;若用服务端默认配置(如生产),复制 `.env.example` => `.env.local` 填真实值。LLM 配置改动只改这两个文件,不写死代码。
- `next.config.mjs` 说明:Web 版需 `/api/llm`,不能 `next export`(封装 Electron 时再定 A/B 方案)。

## 组件约束(Altior 近黑,见 docs/DESIGN.md)

- 近黑主题:底色 `#0d0d0d`,侧栏 `#121212`,强调青 `#2bb8a8`(主)/ `#2f6bff`(蓝),告警 `#ff9500`,危险 `#ff3b30`。tokens 定义在 `tailwind.config.js`,别硬编码旧深蓝(`#0a1628`/`#00a8ff`)。
- 样式:Tailwind v3 + 原始 CSS 类(见 `app/globals.css`);**不 @apply 自定义颜色**(历史教训)。新增颜色/通道样式走 `tailwind.config.js` 的 colors(已含 `text-primary`/`text-secondary`/`surface`/`surface-lighter` 等)。
- 品牌:侧栏顶部白色徽章 FluxPilot 商标(`public/trademark_image.png` 图标 + `public/trademark.png` 文字)。图标+文字组合,白底图放白色徽章上,勿用 mix-blend(深底会变暗)。
- EStop 为 inline 红色胶囊,集成在 Composer 工具行(发送钮旁),非 fixed。
- 聊天↔示波器导航用 `next/link`(整页刷新会丢串口连接)。
- 弹窗 `SettingsPanel`/`SearchDialog` overlay 有 `data-testid`,`SearchDialog` 结果按钮 `data-testid="search-result"`(供 e2e 区分弹窗与侧栏同文本项)。
- 无 emoji 作图标(用 SVG / unicode 文本);中文界面。

## 测试

```bash
npx playwright test                                  # E2E(自动起 next dev 于 3100 端口)
npx playwright test e2e/app.spec.ts -g "折叠"        # 单文件/单用例
npx vitest run unit/modbus.spec.ts                   # 单测单个文件
npm run test:all                                     # 单测 + E2E 全量
```

- **单测(Vitest)**:`unit/`(modbus/llmClient/sessionStore/scopeStore),jsdom 环境。
- **E2E(Playwright)**:`playwright.config.ts` 用 `webServer` 起 `next dev -p 3100`;`baseURL=http://localhost:3100`。**必须 mock 但勿碰真实 LLM/串口**:LLM 用 `page.route('**/api/llm')`,串口用 `e2e/mockSerial.ts` 的 `fakeSerialInitScript()`(Modbus 从站)。
- **约定**:改布局后检查 e2e 选择器(发送钮 `.composer-send`、侧栏项 `.sb-item`、折叠 title、"新建对话"按钮);侧栏已无拖拽调宽(Altior 固定宽)。
- Playwright 用 Chromium headless;环境里有 Next dev overlay 可能拦截点击,弹窗/折叠按钮定位用 `dispatchEvent('click')` 或 `data-testid` 更稳。

## Git

- `web` 分支:本重构。`main`/`arm64` 分支:Electron 版(继续独立演进)
- `.env.local`、`next-env.d.ts` 不入库(gitignore)
- LLM 配置改动只改 `.env.local` + `.env.example`,不写死代码
