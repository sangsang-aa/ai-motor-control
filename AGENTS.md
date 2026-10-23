# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-04
**Base branch:** web

## HIERARCHY
- `lib/AGENTS.md` — 核心逻辑域(串口/LLM/store/设置)
- `components/AGENTS.md` — 业务组件域(chat/scope)
- `docs/` — 说明文档区块(DESIGN/TESTING/aimotor 协议/AI 调参记录/界面参考)

---

# AGENTS.md — MOTOTUNE (Web 线)

## ⚠️ 本分支的重构目的(最高优先级)

`web` 线是 **MOTOTUNE 从 Electron 桌面版 → Next.js Web 版的重构线**,与 `main`(Electron x86)、`arm64` 分支并存。其修复分支必须保持同样的 Web Serial 直连约束。

**为什么重构**(与用户确认的决策,勿偏离):

1. **先写齐 Web 版基本功能,再封装 Electron 桌面版** — 这是本分支的最终路线:当前阶段只做 Web(Next.js),功能齐备后加 Electron 壳层打包为桌面应用。
2. **砍掉 Python 后端** — 串口协议层已用纯 TS 重写(`lib/serial/aimotor/*`,AI-Motor v1),浏览器通过 **Web Serial API** 直连 DSP 下位机(当前为 **TI C2000 F280025C** 开发板),不再需要 pyserial/numpy 子进程。
3. **LLM 走同源代理** — `/api/llm` 服务端代理保护 API key + 绕 CORS,key 只存 `.env.local`(不入库),浏览器永不接触。
4. **纯客户端渲染** — 页面全部 `'use client'`,禁止新增 SSR/Server Component 依赖(便于后续 Electron 封装,见下)。

**后续 Electron 封装路线(完成 Web 版后):**

- 方案 A(推荐):`next build` + `next start` 内置运行,窗口加载 localhost:3000
- 方案 B:`next export` 静态导出 + 主进程直接加载,但 `/api/llm` 代理需搬入 Electron 主进程
- 串口:封装时新增 `ElectronSerialAdapter`(node-serialport via IPC)并先提取适配器接口，再替换 `lib/serial/aimotor/controller.ts` 的 Web Serial I/O；UI/store 层不得直接依赖具体串口实现

## 架构

```
Next.js (App Router, 纯客户端渲染)
├── app/
│   ├── page.tsx          → ChatApp(聊天主页, /)
│   ├── scope/page.tsx    → ScopeApp(示波器, /scope)
│   ├── knowledge/page.tsx→ KnowledgeApp(知识库, /knowledge)
│   ├── param-est/page.tsx→ ParamEstApp(PMSM 参数辨识 mode7, /param-est)
│   ├── control/page.tsx  → ControlApp(手动控制 + 参数调控, /control)
│   └── api/llm/route.ts  → LLM 代理(唯一服务端代码)
├── components/chat/      → ChatApp/Topbar/Sidebar/ChatPane/Composer/ConfirmCard/EStop/横幅 + SettingsPanel/SearchDialog/ConversationSettingsPanel
├── components/knowledge/ → KnowledgeApp(建库/上传)/KnowledgePicker(投送选择)
├── components/scope/     → ScopeApp(带"实时数据"区)/ScopeChart/ChannelPanel/HexView/Pause/HexToggle
├── components/param-est/ → ParamEstApp/ConnectionBar/TestControlPanel/EstimatedParamsPanel/DebugScope(mode7)
├── components/control/   → ControlApp/ControlBar/SpeedPanel/ParamGroups/LivePanel/ModelPanel/RecordingPanel
└── lib/
    ├── types.ts          → 跨层类型(LlmEvent/Session/Message/MotorStatus/KnowledgePayload + AiMotorEvent)
    ├── bus.ts            → 事件总线:llmBus(LLM)/hexBus(原始字节)/aiMotorBus(主串口)
    ├── config.ts         → 常量 COMMAND_CONFIRM_TIMEOUT
    ├── settings.ts       → localStorage 设置(语言/AI 供应商/baseUrl/apiKey/model)+ useSettingsStore(响应式,Topbar 模型联动)
    ├── i18n.ts           → 中/英字典 + useLangStore(响应式切换)
    ├── serial/aimotor/protocol.ts   → AI-Motor v1 帧/CRC/编解码(纯逻辑)
    ├── serial/aimotor/params.ts     → 允许参数表 + 安全锁 + 范围校验
    ├── serial/aimotor/controller.ts → Web Serial + HELLO/心跳/ACK 重试/STOP/100Hz 遥测
    ├── serial/aimotor/control.ts    → 参数分组 / paramMode / 安全标记
    ├── llm/llmClient.ts  → SSE 解析 + abort(浏览器端)
    ├── llm/tools.ts      → 工具定义 TOOLS + 系统提示词 SYSTEM_PROMPT(前后端共用)
    ├── knowledge/db.ts   → 知识库 IndexedDB(原生,无依赖);context.ts 汇总+预算;extract.ts pdfjs 文本/图片
    ├── report.ts         → 会话报告导出(Blob 下载)
    └── stores/           → session/motor/commandLock/scope/knowledge 5 个 zustand store(会话/设置持久化 localStorage;知识库存 IndexedDB)
```

## 数据流

- **事件**:`aimotor/controller`(主串口)→ `aiMotorBus` → `ChatApp`/`ScopeApp`/`ParamEstApp` 订阅 → store。
- **LLM**:Composer → `llmClient.sendMessage` → `llmBus` → `ChatApp` 统一处理(text 追加 / tool_call 锁链)。**无条件发 turn_end**(即使只有 tool_call,否则 inflight 锁死 — 从 Electron 版继承的坑)。
- **对话设置(会话级提示词)**:`session.systemPrompt`(Composer「+」→对话设置),发送时经 `sendMessage(...,systemPrompt)` 传给 `/api/llm` 覆盖默认 `SYSTEM_PROMPT`;随会话持久化/删除。
- **知识库接入 AI(投送一次,每轮自动带)**:`session.kbIds` 存已投送库 id(持久);`ChatApp.handleSend` 每次发送按 kbIds 从 IndexedDB 经 `buildKnowledgePayload` 现取现注入(**不把大文本/图片存进会话消息**)。PDF→文本(合计 ≤12000 字符截断);图片→多模态 `image_url`(≤4 张 ≤2MB)。上游不支持图片 → route **去图重试** + 回 `X-Knowledge-Images-Dropped:1` → 主界面提示"当前模型不支持图片";**无能力记忆**(换多模态模型后自动恢复)。
- **命令锁链**:`tool_call` → `lock.lock()` → `setPendingToolCall` → ChatPane `ConfirmCard` → 确认 → `aimotor/controller.sendCommand` → `ai_executed` 事件 → `lock.unlock()`。30s 超时自动取消。`get_status` 免确认自动执行。`set_motor_state`/`set_mode`/`set_param` 走 AI-Motor v1;AI 禁止修改安全锁定参数(6/13/24/42/51/52)。
- **示波器**:100Hz `SAMPLE` → `scopeStore.appendAiSample`(6 通道:Iu/Speed/Id/Iq/EMF/I-F)→ `ScopeChart`(SVG rAF)。原始字节 → `hexBus` → `appendHex`。
- **参数辨识**:`/param-est` 复用同一 AI-Motor 连接 → mode7(母线/极对数/最大测试电流 → `SET_MODE 7` → `ENABLE` → stage/error → 已应用模型 Rs/Ld/Lq/Ls);人工写参数走 `sendManualParam`,不受 AI 锁限制。
- **手动控制**:`/control` 对齐原上位机手动页:左「控制与参数」(mode/参数分组/速度正反转/启停)、右「3 卡片 + 状态 + 波形(速度/dq、三相)+ 暂停/清空/导出/连续记录 + 模型」、底部操作日志;波形订阅 `aiMotorBus` 100Hz 环形缓冲,SVG 自绘。
- **持久化**:会话存 localStorage(`mototune.sessions`),示波器通道配置存 localStorage(`scope.*`),设置存 localStorage(`mototune.settings`);**知识库文件存 IndexedDB**(`mototune.knowledge`,`kb`+`kbFile` store,不入 localStorage)。
- **设置响应式**:`useSettingsStore`(zustand)是设置唯一响应式源;`saveSettings`/`loadSettings` 都会写它。**组件订阅 store 而非直接读 localStorage**——否则改模型/供应商不刷新(曾 bug:Topbar 模型名残留 qwen)。
- **空消息防御**:`sessionStore.applyLlmEvent` 对空 content 的 text 不新建消息;`ChatApp` tool_call 时不再追加空 text——避免"空气泡"。新增消息给 content 若为空串直接跳过。

## 串口协议(AI-Motor v1,见 docs/aimotor_protocol.md)

- 物理:SCI-A,**115200 8N1**,无流控;Web Serial 直连(TI C2000 F280025C)。
- 帧:`A5 5A | ver=1 | type | len:u16LE | seq:u16LE | payload | CRC16/CCITT-FALSE`;浮点/整数**小端**。
- 类型:`01` 命令、`81` ACK、`80` 快速遥测(60B/10ms)、`82` 模型/诊断(76B/100ms)、`83` 配置回读。
- 命令:`0` 心跳、`1` STOP、`2` SET_MODE、`3` SET_PARAM、`4` ENABLE、`5` GET_CONFIG、`6` HELLO。
- mode:`5` 停止/空闲、`6` HFI→I/f→速度环、`7` 参数辨识、`8` Id对齐→I/f→速度环。
- 安全:HELLO 后才允许 ENABLE;100ms 心跳、单命令在途、300ms×2 重试、STOP 优先、5s 无数据超时;MCU 500ms 看门狗。
- 参数:`lib/serial/aimotor/params.ts`(与参数表/固件 `host_parameters.inc` 对齐);AI 锁定 6 强拖上限 / 13 闭环 Iq / 24 Iq 范围 / 42 辨识电流 / 51 参数组 / 52 自动应用。
- 转速上限 **6000 RPM**(clamp);目标板卡 TI C2000 F280025C;上位机与固件解耦,固件不在本仓库维护。
- 端口打开后尝试 `DTR=false` 并等待 100ms;USB-TTL 适配器不支持时忽略,不阻塞连接。

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
- **知识库仅客户端**:PDF 文本用 `pdfjs-dist`(legacy build,`lib/knowledge/extract.ts` 动态 import + `new URL(worker, import.meta.url)`);文件存浏览器 **IndexedDB**。二者在服务端(`/api/llm`)不可用——内容由客户端解析后随请求体传给代理。
- **Next dev 已知坑**:改代码时 `Fast Refresh` 触发整页 reload;若 reload 窗口期访问 `/api/llm`,会命中 `route.js` ENOENT → `POST /api/llm 500` / `Loading chunk ... failed`。症状是"输入请求 → 强制刷新 → 再输入报错"。**修复**:kill 所有 next 进程 → `rm -rf .next` → 重启 dev → 立即连续 curl `/api/llm` 触发编译。**根治**:稳定阶段用 `npm run build && npm start`(生产一次性生成所有 route.js,无按需编译问题)。

## 组件约束(Codex 亮/暗双主题,见 docs/DESIGN.md)

- 亮/暗双主题(默认亮):`--cx-*` 在 `:root, [data-theme="light"]` 与 `[data-theme="dark"]` 两套值;亮色底 `#f7f7f5`、暗色底 `#0a0a0a`,主操作 `--cx-accent`(亮=近黑/暗=近白)。Tailwind 语义 token 映射到同一套变量,切换对全站生效。别硬编码旧深蓝(`#0a1628`/`#00a8ff`)或旧青(`#2bb8a8`)。
- 主题切换入口:侧栏品牌行按钮 + 设置面板;持久化 `mototune.settings.theme`;`app/layout.tsx` 首屏脚本避免闪烁。
- 样式:Tailwind v3 + 原始 CSS 类(见 `app/globals.css`);**不 @apply 自定义颜色**(历史教训)。新增颜色/通道样式走 `tailwind.config.js` 的 colors(已含 `text-primary`/`text-secondary`/`surface`/`surface-lighter` 等)。
- 品牌:侧栏顶部白色徽章 FluxPilot 商标(`public/trademark_image.png` 图标 + `public/trademark.png` 文字)。图标+文字组合,白底图放白色徽章上,勿用 mix-blend(深底会变暗)。
- EStop 为 inline 红色胶囊,集成在 Composer 工具行(发送钮旁),非 fixed。
- 聊天↔示波器导航用 `next/link`(整页刷新会丢串口连接)。
- 弹窗 `SettingsPanel`/`SearchDialog` overlay 有 `data-testid`,`SearchDialog` 结果按钮 `data-testid="search-result"`(供 e2e 区分弹窗与侧栏同文本项)。
- 知识库入口:侧栏工具组 `/knowledge`(展开+折叠态,内联 SVG 图标);Composer「工具 ▾」→「知识库」→ `KnowledgePicker`(投送/清空)。关键元素 `data-testid`:`kb-name-input`/`kb-create`/`kb-item`/`file-input`/`file-item`/`kb-pick-item`/`kb-deliver`/`kb-clear`。
- 无 emoji 作图标(用 SVG / unicode 文本);中文界面。

## 测试

```bash
npx playwright test                                  # E2E(自动起 next dev 于 3100 端口)
npx playwright test e2e/app.spec.ts -g "折叠"        # 单文件/单用例
npx vitest run unit/aimotorProtocol.spec.ts          # 单测单个文件
npm run test:all                                     # 单测 + E2E 全量
```

- **单测(Vitest)**:`unit/`(aimotorProtocol/aimotorParams/aimotorStore/llmClient/sessionStore/scopeStore/commandLockStore/knowledge/knowledgeContext/settings),jsdom 环境。
- **E2E(Playwright)**:`playwright.config.ts` 用 `webServer` 起 `next dev -p 3100`;`baseURL=http://localhost:3100`。**必须 mock 但勿碰真实 LLM/串口**:LLM 用 `page.route('**/api/llm')`,串口用 `e2e/mockAiMotorSerial.ts` 的 `fakeAiMotorSerial()`(AI-Motor v1 从站:HELLO/ACK/10ms SAMPLE/100ms MODEL/CONFIG)。`dropFirstAck`/`noHelloAckCount` 用于握手重试与重连测试。知识库用真实 IndexedDB(`setInputFiles` 注入内存 PNG)。
- **通信改动的最低覆盖**:改帧/CRC/解码时更新 `unit/aimotorProtocol.spec.ts`；改握手/重试/超时逻辑时更新 `e2e/serial-recovery.spec.ts`；保留 `serial-scope.spec.ts`、`tool-call.spec.ts`、`param-est.spec.ts` 的直连模拟覆盖。浏览器 mock 不能替代实板验收。
- **约定**:改布局后检查 e2e 选择器(发送钮 `.composer-send`、侧栏项 `.sb-item`、折叠 title、"新建对话"按钮);侧栏已无拖拽调宽(Codex 固定宽 240px)。
- Playwright 用 Chromium headless;环境里有 Next dev overlay 可能拦截点击,弹窗/折叠按钮定位用 `dispatchEvent('click')` 或 `data-testid` 更稳。

## Git

- `web` 分支:本重构。`main`/`arm64` 分支:Electron 版(继续独立演进)
- `.env.local`、`next-env.d.ts` 不入库(gitignore)
- LLM 配置改动只改 `.env.local` + `.env.example`,不写死代码
