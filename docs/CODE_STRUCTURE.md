# MOTOTUNE Web 文件结构与功能文档

> **基线分支**：`feature/aimotor-v1`
> **功能基线**：`b90153e`（文件清理后的提交；本文档为后续 docs 提交）
> **技术栈**：Next.js 15 / React 19 / TypeScript / zustand / Tailwind v3
> **目标**：按“文件实际存储位置”说明每个文件的功能、代码结构、数据来源和对应测试，便于逐文件交接。
> **配套文档**：`docs/HANDOVER.md` 按功能讲解；本文按目录/文件讲解。

---

## 0. 阅读约定

- 行数仅作规模参考（基线时统计），改代码后会变化。
- `@/` 是仓库根别名（`tsconfig.json` 的 `paths`），例如 `@/lib/bus` → `lib/bus.ts`。
- 页面统一 `'use client'`；服务端只有 `/api/llm`、`/api/tekhsi` 两个 Node 路由。
- “测试”列只列直接相关测试；完整矩阵见第 13 节。
- `key` / `id` / `data-testid` 是跨文件契约，改动前先查第 14 节“修改入口”。

---

## 1. 目录总览

```text
.
├── app/                      Next.js App Router 页面 + 2 个 API 路由
├── components/               业务组件（chat / scope / net-scope / param-est / control / knowledge）
├── lib/                      纯逻辑、协议、store、设置、LLM、知识库、TekHSI
├── unit/                     Vitest 单测（13 个文件）
├── e2e/                      Playwright E2E（12 个 spec + 1 个串口 mock）
├── public/                   运行时静态资源（商标、电机图）
├── docs/                     协议/设计/测试/交接文档 + 界面参考图
├── .opencode/                项目级 AI 流程 skill
├── package.json              脚本与依赖
├── next.config.mjs           Next 配置（gRPC external）
├── tsconfig.json             TS 配置（@/*、strict）
├── tailwind.config.js        Tailwind 语义 token / 字体 / 动画
├── postcss.config.js         PostCSS
├── playwright.config.ts      E2E（3100 端口、串行）
├── vitest.config.ts          单测（jsdom、unit/**）
├── .env.example              服务端 LLM 配置示例（占位符）
└── .gitignore                忽略 env / .next / 测试产物等
```

---

## 2. 根目录文件

| 文件 | 行数 | 作用 | 关键内容 | 备注 |
|---|---:|---|---|---|
| `package.json` | 38 | 项目清单 | scripts：`dev/build/start/lint/test:unit/test:e2e/test:all`；依赖：Next 15、React 19、zustand、pdfjs、`@grpc/grpc-js`、`@grpc/proto-loader` | 没有单独 dev server 配置，端口由命令决定 |
| `package-lock.json` | 4358 | 依赖锁 | npm 自动生成 | 不要手改；升级依赖时一起提交 |
| `next.config.mjs` | 10 | Next 配置 | `serverExternalPackages: ['@grpc/grpc-js','@grpc/proto-loader']` | 防止 gRPC 打进浏览器 bundle |
| `tsconfig.json` | 21 | TS 配置 | `strict`、`target ES2022`、`moduleResolution bundler`、`paths: { '@/*': ['./*'] }` | 全部源码走 `@/` |
| `tailwind.config.js` | 99 | Tailwind 主题 | 语义色映射到 `--cx-*`；字体 Noto Sans SC / JetBrains Mono；动画 | 新增颜色优先走这里，不要硬编码旧深蓝 |
| `postcss.config.js` | 6 | PostCSS | `tailwindcss` + `autoprefixer` | — |
| `playwright.config.ts` | 29 | E2E 配置 | `testDir=./e2e`；`baseURL=3100`；`workers=1`；`webServer: next dev -p 3100` | 串行避免 dev 编译竞争 |
| `vitest.config.ts` | 16 | 单测配置 | `include: unit/**/*.spec.ts`；`environment: jsdom`；`@` alias | `tekhsiClient.spec.ts` 用 node 环境注释覆盖 |
| `.env.example` | 7 | 服务端 LLM 示例 | `LLM_BASE_URL` / `LLM_API_KEY`（空占位）/ `LLM_MODEL` | `.env.local` 不入库 |
| `.gitignore` | 27 | 忽略规则 | `.env*`、`.next/`、`node_modules/`、`test-results/`、`.omo/`、`.opencode/*`（skills 例外） | 本地配置不会上传 |
| `README.md` | 54 | 快速开始/功能清单 | 安装、LLM 配置、功能、架构、文档入口 | 面向使用者 |
| `AGENTS.md` | 153 | 项目知识库 | 重构目的、架构、数据流、协议、组件约束、测试、Git | 面向 AI/开发者 |
| `components/AGENTS.md` | 73 | 组件域知识 | 5 个组件域、WHERE TO LOOK、约定/反模式 | 改 UI 前先读 |
| `lib/AGENTS.md` | 65 | 逻辑域知识 | 协议/参数/控制器/LLM/知识库/store | 改逻辑前先读 |

---

## 3. `app/` — 路由与页面入口

### 3.1 页面

| 文件 | 行数 | 路由 | 作用 | 关键结构 |
|---|---:|---|---|---|
| `app/layout.tsx` | 23 | 全局 | 根布局 + 首屏主题恢复 | `metadata`；`THEME_INIT` 脚本（`beforeInteractive`）读 `mototune.settings` 设置 `data-theme`，避免闪烁 |
| `app/page.tsx` | 9 | `/` | 聊天主页入口 | `export default` 返回 `<ChatApp />` |
| `app/scope/page.tsx` | 9 | `/scope` | 串口示波器入口 | `<ScopeApp />` |
| `app/net-scope/page.tsx` | 9 | `/net-scope` | 网口示波器入口 | `<NetScopeApp />` |
| `app/param-est/page.tsx` | 7 | `/param-est` | 参数辨识入口 | `<ParamEstApp />` |
| `app/control/page.tsx` | 9 | `/control` | 手动控制入口 | `<ControlApp />` |
| `app/knowledge/page.tsx` | 9 | `/knowledge` | 知识库入口 | `<KnowledgeApp />` |

> 页面文件只做“壳”，业务在 `components/`；不要在 page 里直接碰串口/API。

### 3.2 API 路由

#### `app/api/llm/route.ts`（109 行）

| 项 | 内容 |
|---|---|
| 方法 | `POST` |
| Runtime | `nodejs` / `force-dynamic` |
| 请求体 | `{ text, history, config?, systemPrompt?, knowledge? }` |
| 配置优先级 | `body.config` → `process.env.LLM_*`（设置面板优先） |
| 消息拼装 | system（会话提示词或默认 `SYSTEM_PROMPT`）→ 知识库文本 system → history → user（可带 `image_url`） |
| 图片降级 | 上游失败且带图 → 去图重试；成功则回 `X-Knowledge-Images-Dropped: 1` |
| 响应 | 直接透传上游 SSE（`text/event-stream`）；解析在 `lib/llm/llmClient.ts` |
| 错误 | 400 非法 body/空文本；500 未配置；502 上游异常 |

#### `app/api/tekhsi/route.ts`（71 行）

| 项 | 内容 |
|---|---|
| 方法 | `GET` 状态；`POST` 动作 |
| Runtime | `nodejs` / `force-dynamic` / `maxDuration=60` |
| `POST action` | `connect` / `disconnect` / `status` / `acquire` |
| 校验 | host 正则（IPv4/主机名）、port 1–65535、channels 1–8、maxPoints 1000–1000000 |
| 依赖 | `lib/tekhsi/client.ts`（gRPC） |
| 错误 | 400 参数错误；502 gRPC/连接错误 |

### 3.3 全局样式

#### `app/globals.css`（423 行）

| 区块 | 内容 |
|---|---|
| Tailwind 基础 | `@tailwind base/components/utilities` + 全局 reset |
| 主题 token | `:root, [data-theme="light"]` 与 `[data-theme="dark"]` 两套 `--cx-*` |
| Chat 重皮肤 | Topbar/Sidebar/消息/Composer/ConfirmCard/Banner |
| 通用组件 | `.cx-panel`、`.cx-btn-*`、`.input-base`、`.cx-menu` |
| 示波器 | scope 布局、通道面板、HEX |
| 动画 | 脉冲、滑入、倒计时等 |

> 约定：不 `@apply` 自定义颜色；新增颜色走 `tailwind.config.js` 或 `--cx-*`。

---

## 4. `components/` — 业务组件

### 4.1 `components/chat/`（13 个文件）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `ChatApp.tsx` | 106 | 聊天页壳 + 事件接线 | `aiMotorBus`/`llmBus` 订阅；`handleSend`；`Ctrl+C` 中断；设置/搜索弹窗；模块级 `pendingToolCall` |
| `ChatPane.tsx` | 82 | 消息列表 + 确认卡 | `sessionStore` 消息；`ConfirmCard`；30s 超时；`sendCommand`；滚动到底 |
| `Topbar.tsx` | 86 | 顶部条 | 串口连接/波特率（`AI_MOTOR_BAUD`）；mode/stage 状态；模型下拉（`useSettingsStore`） |
| `Sidebar.tsx` | 155 | 左侧栏 | 品牌、折叠、主题切换、会话列表（重命名/删除）、工具导航（scope/net-scope/param-est/control/knowledge）、导出报告、用户行（i18n `userLabel`） |
| `Composer.tsx` | 93 | 输入区 | 文本/Enter 发送；「+」对话设置；「工具」知识库；EStop；锁定态 |
| `ConfirmCard.tsx` | 64 | 工具确认卡 | 倒计时进度条；确认/忽略 |
| `ConversationSettingsPanel.tsx` | 53 | 会话级提示词 | `session.systemPrompt` 读写；overlay testid |
| `SettingsPanel.tsx` | 165 | 设置弹窗 | 语言/主题；两步：供应商列表 → Base URL/API Key/模型；`saveSettings` |
| `SearchDialog.tsx` | 74 | 会话搜索 | 关键词过滤；`search-result` 跳转 |
| `CommandLockBanner.tsx` | 16 | 锁状态提示 | `useCommandLock` |
| `DisconnectBanner.tsx` | 18 | 断线提示 | `motorStore.disconnectMessage` |
| `EStopButton.tsx` | 33 | 急停 | `sendCommand('emergency_stop')`；busy 态 |
| `ChatApp.tsx` 的 `setPendingToolCall/consumePendingToolCall` | — | 跨组件传递待确认工具 | 模块级变量，**非 zustand**；刷新即丢 |

**组合关系**

```text
ChatApp
├── Sidebar
├── Topbar
├── DisconnectBanner
├── ChatPane
│   └── ConfirmCard
└── Composer
    ├── ConversationSettingsPanel
    ├── KnowledgePicker
    └── EStopButton
```

**数据流**

```text
Composer → ChatApp.handleSend → llmClient.sendMessage → /api/llm → llmBus
llmBus tool_call → ChatApp → commandLock.lock → pendingToolCall → ChatPane.ConfirmCard
ConfirmCard 确认 → ChatPane → controller.sendCommand → aiMotorBus(ai_executed) → unlock
```

**测试**：`e2e/app.spec.ts`、`e2e/chat.spec.ts`、`e2e/tool-call.spec.ts`、`e2e/settings-search.spec.ts`。

### 4.2 `components/scope/`（串口示波器）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `ScopeApp.tsx` | 106 | 串口示波器页壳 | `aiMotorBus`→`applyEvent/appendAiSample`；`hexBus`→`appendHex`；`initAiChannels`；可拖通道面板宽；顶部实时 Iu/Speed |
| `ScopeChart.tsx` | 308 | SVG 波形 | `ResizeObserver`；rAF 重绘；`scopeStore` buffers/channels/n/span；网格 `line` + 波形 `path`；主题色 |
| `ChannelPanel.tsx` | 399 | 通道面板 | 每通道 enable/label/color/位置(div)/V/div/统计；`LimitInput` 范围；持久化 |
| `HexView.tsx` | 80 | 原始字节 | `hexBuf/hexFilled`；rAF 刷新 |
| `PauseToggle.tsx` | 13 | 暂停/继续 | `scopeStore.paused` |
| `HexToggle.tsx` | 13 | HEX 开关 | `scopeStore.showHex` |

**数据流**

```text
controller(100Hz SAMPLE) → aiMotorBus → ScopeApp → scopeStore.appendAiSample
scopeStore.buffers → ScopeChart(rAF) → SVG path
controller(bytes) → hexBus → ScopeApp → appendHex → HexView
```

**测试**：`e2e/serial-scope.spec.ts`、`unit/scopeStore.spec.ts`。

### 4.3 `components/net-scope/`（TekHSI 网口示波器）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `NetScopeApp.tsx` | 336 | 页面壳 + 布局 | 连接/通道/采集/导出；左栏连接+通道+采集，右栏波形；错误/空态 |
| `useTekHsi.ts` | 163 | 数据 hook | `POST /api/tekhsi`；connect/disconnect/acquire；1Hz 连续采集；busyRef 防重入；host/port localStorage |
| `NetScopeChart.tsx` | 164 | 单通道 SVG | 自动 y 范围；时间轴/触发线；最多约 2000 点绘制；`autoColor` |
| `NetScopeMeta.tsx` | 55 | 采集元数据 | 记录点数/解码点数/抽点/Δt/触发索引/y 缩放/单位 |

**数据流**

```text
NetScopeApp → useTekHsi → /api/tekhsi → lib/tekhsi/client.ts → gRPC :5000
                                      ← TekAcquireResult
NetScopeApp → NetScopeChart / NetScopeMeta / CSV
```

**测试**：`e2e/net-scope.spec.ts`（UI mock）、`e2e/tekhsi-api.spec.ts`（真实路由 + fake gRPC）、`unit/tekhsiDecode.spec.ts`、`unit/tekhsiClient.spec.ts`。

### 4.4 `components/param-est/`（mode7 参数辨识）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `ParamEstApp.tsx` | 35 | 页壳 | `aiMotorBus` 订阅；左连接/配置/调试，右结果 |
| `ConnectionBar.tsx` | 76 | 连接条 | 115200 连接/断开；mode/stage 显示 |
| `TestControlPanel.tsx` | 98 | mode7 配置 | 母线 40 / 极对数 41 / 最大测试电流 42；`sendManualParam`；`SET_MODE 7` + `ENABLE`；停止 |
| `EstimatedParamsPanel.tsx` | 77 | 结果 | 电机图 `paramest-motor`；阶段/错误；Rs/Ld/Lq/Ls |
| `DebugScope.tsx` | 40 | 调试卡 | Id/Iq/Speed/stage/error |

**流程**

```text
连接 → 填 40/41/42 → sendManualParam(mode7) → set_mode 7 → ENABLE
     → SAMPLE(stage/error) + MODEL(Rs/Ld/Lq/Ls) → 结果面板
```

**测试**：`e2e/param-est.spec.ts`。

### 4.5 `components/control/`（手动控制）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `ControlApp.tsx` | 43 | 页壳 + 布局 | `aiMotorBus` 订阅；左参数/速度，右卡片/波形/记录/模型，底部日志 |
| `ControlBar.tsx` | 132 | 顶部控制 | 连接/断开/演示；mode 5/6/7/8；启动/停止；状态 |
| `ControlSignals.tsx` | 39 | 3 个实时卡片 | 估速/Iq/反电势 + mode/stage/flags/error |
| `ControlWaveforms.tsx` | 181 | 波形 | 速度/dq、三相 tab；暂停/清空/导出当前 CSV；`MiniPlot` SVG |
| `useSampleHistory.ts` | 40 | 100Hz 环形缓冲 | 订阅 `ai_sample`；MAX 1100；100ms tick 重绘；pause/clear |
| `ParamGroups.tsx` | 148 | 30 条参数 | 分组 tab；读取/写入；安全参数二次确认；回读 CONFIG |
| `SpeedPanel.tsx` | 57 | 调速 | 目标 RPM；正转/反转/减速 0；给定/实测 |
| `RecordingPanel.tsx` | 75 | 连续 CSV | 100Hz 记录；上限 100k 行；停止下载 |
| `ModelPanel.tsx` | 50 | 模型 | Rs/Ld/Lq/Ls/status/save 等 |
| `ControlLog.tsx` | 40 | 操作日志 | `ai_executed/ai_error/ai_status/ai_closed` 最近 50 条 |

**测试**：`e2e/control.spec.ts`、`unit/aimotorControl.spec.ts`。

### 4.6 `components/knowledge/`（知识库）

| 文件 | 行数 | 作用 | 关键结构/数据 |
|---|---:|---|---|
| `KnowledgeApp.tsx` | 150 | 知识库页 | 创建/删除库；上传/删除文件；`knowledgeStore`；IndexedDB 不可用提示 |
| `KnowledgePicker.tsx` | 86 | Composer 投送弹窗 | 勾选库；投送/清空；写 `session.kbIds` |

**测试**：`e2e/knowledge.spec.ts`、`e2e/knowledge-ai.spec.ts`、`unit/knowledge.spec.ts`、`unit/knowledgeContext.spec.ts`。

---

## 5. `lib/` — 逻辑层

### 5.1 根模块

| 文件 | 行数 | 作用 | 关键导出/结构 |
|---|---:|---|---|
| `lib/types.ts` | 76 | 跨层类型 | `Session/Message/KnowledgePayload/MotorStatus/CommandLock`；`LlmEvent`；`AiMotorEvent` |
| `lib/bus.ts` | 29 | 类型安全事件总线 | `llmBus`、`hexBus`、`aiMotorBus`；`Emitter.on` 返回退订函数 |
| `lib/config.ts` | 4 | 前端常量 | `COMMAND_CONFIRM_TIMEOUT=30000` |
| `lib/i18n.ts` | 143 | 中/英字典 | `translations`、`useLangStore`、`t(lang,key)`；`userLabel` 等 |
| `lib/settings.ts` | 132 | 设置 | `Settings`、`PROVIDER_PRESETS`、`DEFAULT_SETTINGS`、`useSettingsStore`、`load/save/applyTheme` |
| `lib/report.ts` | 74 | 会话报告 | `generateReport(session)`：HTML + Blob 下载；**仍是旧深色配色** |
| `lib/stats.ts` | 29 | 通道统计 | `computeStats(buf,n,filled)` → min/max/mean/rms |

### 5.2 `lib/serial/aimotor/`（AI-Motor v1）

| 文件 | 行数 | 作用 | 关键结构 |
|---|---:|---|---|
| `protocol.ts` | 330 | 帧/CRC/编解码 | `AI_MOTOR_BAUD=115200`；`PACKET/CMD/ACK_STATUS/MODE_LABEL/STAGE_LABEL/IDENT_*`；`Packet/Sample/Model/ConfigRecord/Ack`；`crc16/frame/command`；`Decoder`；`decodeSample/Model/Config/Ack` |
| `params.ts` | 110 | 30 条参数 + 安全 | `ParamDef`；`AIMOTOR_PARAMS`；`getParam/paramsForMode/globalParams`；`AI_LOCKED_PARAM_IDS={6,13,24,42,51,52}`；`validateParamValue/validateAiParam`；`COMMAND_RPM_SAFETY_LIMIT=6000`、`clampCommandRpm` |
| `controller.ts` | 591 | Web Serial + 会话 | 模块级 port/reader/writer/handshake/pending；`connect/disconnect`；`request`（800ms，重试 2 次）；`readLoop`；`startTimers`（100ms 心跳/5s 看门狗）；demo 模式；`sendManualParam`；`sendCommand` 动作映射 |
| `control.ts` | 29 | 参数分组 | `PARAM_GROUP_ORDER`；`groupParams`；`paramMode`；`isSafetyParam` |

**controller 内部结构**

```text
connect()
  requestPort → open(115200 8N1) → DTR=false → readLoop
  → HELLO(1200ms) → GET_CONFIG → startTimers
request(cmd,...)
  pending 单命令在途 → 写帧 → ACK 等待(800ms) → 同 seq 重试 2 次
readLoop()
  Decoder → SAMPLE/MODEL/CONFIG/ACK → aiMotorBus
startTimers()
  heartbeat 100ms + watchdog 5s
sendCommand(action)
  set_speed/set_motor_state/set_mode/set_param/emergency_stop/clear_emergency_stop/write_pid_<id>
```

**测试**：`unit/aimotorProtocol.spec.ts`、`unit/aimotorParams.spec.ts`、`unit/aimotorControl.spec.ts`、`unit/aimotorStore.spec.ts`、`e2e/serial-recovery.spec.ts`、`e2e/serial-scope.spec.ts`、`e2e/tool-call.spec.ts`、`e2e/control.spec.ts`、`e2e/param-est.spec.ts`。

### 5.3 `lib/tekhsi/`（TekHSI gRPC）

| 文件 | 行数 | 作用 | 关键结构 |
|---|---:|---|---|
| `TekHighspeedServer.proto` | 182 | gRPC schema | package `Tekscope`；`Connect/NormalizedData/NativeData`；消息/枚举与官方描述符一致 |
| `types.ts` | 52 | 共享类型 | `TekChannel/TekAcquireResult/TekConnectResult/TekStatus/TekApiError` |
| `decode.ts` | 75 | 纯解码 | `decodeAnalog`（int8/int16/float32 LE + y=kx+b）；`decimate`；`timeAt`；`formatTime/formatValue` |
| `csv.ts` | 32 | CSV | `toLongCsv`（channel,time_s,value）；`downloadText` |
| `client.ts` | 299 | gRPC 采集（server-only） | 全局 session；`connect/disconnect/status/acquire`；`readChannel`；`Connect→RequestAvailableNames→WaitForDataAccess→GetHeader→GetWaveform→FinishedWithDataAccess`；错误映射 |

**测试**：`unit/tekhsiDecode.spec.ts`、`unit/tekhsiClient.spec.ts`（node 环境 + fake gRPC）、`e2e/tekhsi-api.spec.ts`。

### 5.4 `lib/llm/`

| 文件 | 行数 | 作用 | 关键结构 |
|---|---:|---|---|
| `tools.ts` | 92 | 工具定义/提示词 | `ToolDef`；`TOOLS`（set_speed/set_motor_state/set_mode/set_param/get_status）；`SYSTEM_PROMPT` |
| `llmClient.ts` | 113 | 浏览器 SSE | `sendMessage(text,history,onEvent,systemPrompt,knowledge)`；`abort()`；解析 `data:` 行、tool_calls 聚合、图片降级提示 |

**测试**：`unit/llmClient.spec.ts`、`e2e/chat.spec.ts`、`e2e/tool-call.spec.ts`。

### 5.5 `lib/knowledge/`

| 文件 | 行数 | 作用 | 关键结构 |
|---|---:|---|---|
| `db.ts` | 137 | IndexedDB | DB `mototune.knowledge` v1；`kb`/`kbFile`；`classifyFile/isAllowedFile`（PDF/图片 ≤10MB）；`list/create/delete Kb`、`add/list/delete File` |
| `extract.ts` | 32 | 文件解析 | `extractPdfText`（pdfjs legacy 动态 import）；`blobToDataUrl` |
| `context.ts` | 75 | 上下文预算 | `MAX_TEXT_CHARS=12000`、`MAX_IMAGES=4`、`MAX_IMAGE_BYTES=2MB`；`truncateText`、`selectImages`、`buildKnowledgePayload(kbIds)` |

**测试**：`unit/knowledge.spec.ts`、`unit/knowledgeContext.spec.ts`、`e2e/knowledge.spec.ts`、`e2e/knowledge-ai.spec.ts`。

### 5.6 `lib/stores/`

| 文件 | 行数 | 作用 | 状态/动作 |
|---|---:|---|---|
| `sessionStore.ts` | 228 | 会话 | `sessions/order/currentId/inflight`；`hydrate/create/delete/rename/select/pushUserMessage/applyLlmEvent/setInflight/setSystemPrompt/setKbIds/pushSystemMessage`；持久化 `mototune.sessions` + `.order` |
| `motorStore.ts` | 109 | 电机状态 | `status/rpmHistory/currentHistory/connected/disconnectMessage/toolCallVersion/mode/stage/flags/errorCode/reference/id/iq/model/config/lastSample`；`applyEvent/updateStatus/notifyToolCall` |
| `commandLockStore.ts` | 22 | 命令锁 | `status: idle→pending→executing`；`lock/setExecuting/unlock` |
| `scopeStore.ts` | 706 | 示波器 | 6 通道配置/buffers/filled/hex；`initAiChannels/appendAiSample/appendHex`；通道 view；持久化 `scope.channels` + `scope.schemaVersion`；**保留旧串口字段 ports/cfg/status（当前页面未用）** |
| `knowledgeStore.ts` | 91 | 知识库 UI 状态 | `kbs/currentKbId/files/unsupported`；`refresh/create/delete/select/addFiles/removeFile` |

**持久化 key**

| key | 内容 |
|---|---|
| `mototune.sessions` / `mototune.sessions.order` | 会话与顺序 |
| `mototune.settings` | 语言/主题/供应商/Base URL/API Key/模型 |
| `scope.channels` / `scope.schemaVersion` | 示波器通道 view |
| `mototune.tekhsi.host` / `mototune.tekhsi.port` | 网口示波器地址 |
| IndexedDB `mototune.knowledge` | 知识库与文件 |

---

## 6. `unit/` — 单元测试（13 个文件）

| 文件 | 行数 | 覆盖目标 | 主要 describe |
|---|---:|---|---|
| `aimotorProtocol.spec.ts` | 137 | `lib/serial/aimotor/protocol.ts` | frame/crc、Decoder、decode payloads |
| `aimotorParams.spec.ts` | 78 | `params.ts` | 参数表、范围、安全锁、6000 clamp |
| `aimotorControl.spec.ts` | 25 | `control.ts` | 参数分组/paramMode/安全标记 |
| `aimotorStore.spec.ts` | 103 | `motorStore` + scope 100Hz | 事件映射、缓冲 |
| `commandLockStore.spec.ts` | 75 | `commandLockStore` | idle→pending→executing→idle |
| `sessionStore.spec.ts` | 134 | `sessionStore` | CRUD、systemPrompt、kbIds |
| `scopeStore.spec.ts` | 31 | `scopeStore` | 通道配置/持久化 |
| `settings.spec.ts` | 38 | `settings.ts` | 供应商预设/默认值 |
| `knowledge.spec.ts` | 32 | `knowledge/db.ts` | 文件分类/大小限制 |
| `knowledgeContext.spec.ts` | 35 | `knowledge/context.ts` | 文本预算/图片筛选 |
| `llmClient.spec.ts` | 80 | `llm/llmClient.ts` | 文本流/tool call/图片降级 |
| `tekhsiDecode.spec.ts` | 88 | `tekhsi/decode.ts` + `csv.ts` | int8/int16/float32、缩放、抽点、CSV |
| `tekhsiClient.spec.ts` | 116 | `tekhsi/client.ts` | fake gRPC 完整时序（`@vitest-environment node`） |

运行：

```bash
npm run test:unit
npx vitest run unit/tekhsiClient.spec.ts
```

---

## 7. `e2e/` — 端到端测试（12 个 spec + 1 个 mock）

| 文件 | 行数 | 场景 | Mock/依赖 |
|---|---:|---|---|
| `app.spec.ts` | 100 | 启动/侧栏/主题/页面 | 真实 Next |
| `chat.spec.ts` | 88 | 流式/错误/持久化/重命名 | `page.route('/api/llm')` |
| `tool-call.spec.ts` | 100 | 确认卡/串口写入/安全锁 | LLM mock + `fakeAiMotorSerial` |
| `serial-scope.spec.ts` | 58 | 串口识别/100Hz/SVG/暂停/术语 | `fakeAiMotorSerial` |
| `serial-recovery.spec.ts` | 33 | HELLO ACK 丢失/无响应 | `fakeAiMotorSerial` 选项 |
| `param-est.spec.ts` | 43 | mode7 成功/失败/图片 | `fakeAiMotorSerial` |
| `control.spec.ts` | 111 | 模式/启停/调参/波形/CSV/演示 | `fakeAiMotorSerial` |
| `knowledge.spec.ts` | 45 | 建库/上传/刷新/删除 | 真实 IndexedDB |
| `knowledge-ai.spec.ts` | 72 | 投送自动携带/清空 | LLM mock + IndexedDB |
| `settings-search.spec.ts` | 104 | 设置/搜索/模型响应式/对话设置 | 真实 Next |
| `net-scope.spec.ts` | 140 | 网口示波器 UI/连续/CSV/错误 | `page.route('/api/tekhsi')` |
| `tekhsi-api.spec.ts` | 104 | 真实 `/api/tekhsi` + fake gRPC | `@grpc/grpc-js` fake server |
| `mockAiMotorSerial.ts` | 197 | 串口从站 mock | `fakeAiMotorSerial(opts)`：HELLO/ACK/SAMPLE/MODEL/CONFIG |

> `playwright.config.ts` 自动起 `next dev -p 3100`；测试禁止真调 LLM/真串口/真示波器。

---

## 8. `public/` — 运行时静态资源

| 文件 | 大小/尺寸 | 用途 | 引用 |
|---|---:|---|---|
| `public/trademark_image.png` | 158KB / 585×527 | FluxPilot 图标 | `components/chat/Sidebar.tsx` 品牌徽章 |
| `public/trademark.png` | 164KB / 1259×299 | FluxPilot 文字标 | `Sidebar.tsx` |
| `public/motor-product.png` | 1.7MB / 1349×1166 | 电机实物图 | `components/param-est/EstimatedParamsPanel.tsx` |

---

## 9. `docs/` — 文档与参考资源

| 文件 | 行数 | 内容 | 状态 |
|---|---:|---|---|
| `docs/HANDOVER.md` | 897 | 按功能的全量交接：环境/功能/协议/测试/检查清单/参数表 | 当前；与本文互补 |
| `docs/aimotor_protocol.md` | 81 | AI-Motor v1 帧/命令/模式/安全/参数 | 当前 |
| `docs/tekhsi.md` | 160 | TekHSI gRPC/时序/解码/API/限制/实机验收 | 当前 |
| `docs/TESTING.md` | 168 | 测试分层、用例、Mock、验收标准 | 当前 |
| `docs/DESIGN.md` | 83 | Codex 亮/暗主题 token/布局/组件映射 | 当前 |
| `docs/ai_tuning_log.md` | 115 | AI 参数调优记录 | **过期**：仍按 Modbus 设备码/`lib/serial/modbus.ts` 编写，与 AI-Motor v1 不一致；交接时不要照此调参 |
| `docs/界面样式.png` | — | 界面参考截图（1919×1125） | 参考图，不参与构建 |

---

## 10. `.opencode/` — 项目级 AI 流程

| 文件 | 行数 | 作用 |
|---|---:|---|
| `.opencode/skills/ai-coding-guard/SKILL.md` | 284 | 项目级编码流程：只读侦察 → 提案 → 批准 → 实现 → 测试；模块隔离/测试矩阵/安全约束。已清理本机绝对路径，默认波特率修正为 115200 |

---

## 11. 跨文件数据流

### 11.1 聊天 / LLM

```text
Composer
  → ChatApp.handleSend
  → lib/llm/llmClient.sendMessage
  → app/api/llm/route.ts
  → 上游 OpenAI 兼容 /chat/completions (SSE)
  → llmBus
  → ChatApp → sessionStore / ChatPane
```

### 11.2 AI-Motor 串口

```text
Topbar/ControlBar/ConnectionBar
  → controller.connect (Web Serial)
  → HELLO → GET_CONFIG → 100ms heartbeat
  → readLoop → aiMotorBus
  → motorStore / scopeStore / ChatApp / ParamEstApp / ControlApp
```

### 11.3 串口示波器

```text
aiMotorBus(ai_sample) → ScopeApp → scopeStore.appendAiSample
scopeStore.buffers → ScopeChart(rAF) → SVG path
hexBus → ScopeApp → appendHex → HexView
```

### 11.4 参数辨识

```text
TestControlPanel → sendManualParam(40/41/42, mode7)
                → sendCommand(set_mode 7) → sendCommand(set_motor_state true)
                → aiMotorBus(SAMPLE/MODEL) → motorStore → EstimatedParamsPanel
```

### 11.5 手动控制

```text
ControlBar/ParamGroups/SpeedPanel → controller.sendCommand/sendManualParam
aiMotorBus → motorStore + useSampleHistory → ControlSignals/ControlWaveforms/ModelPanel/ControlLog
RecordingPanel → aiMotorBus(ai_sample) → CSV
```

### 11.6 网口示波器

```text
NetScopeApp → useTekHsi → POST /api/tekhsi
  → lib/tekhsi/client.ts → gRPC :5000 (Connect/NativeData)
  → TekAcquireResult → NetScopeChart/NetScopeMeta/CSV
```

### 11.7 知识库

```text
KnowledgeApp → knowledgeStore → lib/knowledge/db.ts (IndexedDB)
KnowledgePicker → session.kbIds
ChatApp.handleSend → buildKnowledgePayload → /api/llm → 上游
```

---

## 12. 文件 → 测试矩阵

| 源码文件 | 单测 | E2E |
|---|---|---|
| `lib/serial/aimotor/protocol.ts` | `aimotorProtocol` | `serial-scope`、`serial-recovery` |
| `lib/serial/aimotor/params.ts` | `aimotorParams`、`aimotorControl` | `control`、`tool-call` |
| `lib/serial/aimotor/controller.ts` | —（通过 store/protocol 间接） | `serial-recovery`、`serial-scope`、`tool-call`、`control`、`param-est` |
| `lib/serial/aimotor/control.ts` | `aimotorControl` | `control` |
| `lib/stores/motorStore.ts` | `aimotorStore` | `serial-scope`、`control`、`param-est` |
| `lib/stores/scopeStore.ts` | `scopeStore`、`aimotorStore` | `serial-scope`、`app` |
| `lib/stores/sessionStore.ts` | `sessionStore` | `chat`、`settings-search` |
| `lib/stores/commandLockStore.ts` | `commandLockStore` | `tool-call` |
| `lib/stores/knowledgeStore.ts` | —（db/context 单测） | `knowledge`、`knowledge-ai` |
| `lib/settings.ts` | `settings` | `app`、`settings-search` |
| `lib/i18n.ts` | — | `settings-search`、`app` |
| `lib/llm/llmClient.ts` | `llmClient` | `chat` |
| `lib/llm/tools.ts` | — | `tool-call` |
| `lib/knowledge/db.ts` | `knowledge` | `knowledge` |
| `lib/knowledge/context.ts` | `knowledgeContext` | `knowledge-ai` |
| `lib/report.ts` | — | 手动 |
| `lib/stats.ts` | — | 通过 `ChannelPanel` |
| `lib/tekhsi/decode.ts` / `csv.ts` | `tekhsiDecode` | `net-scope` |
| `lib/tekhsi/client.ts` | `tekhsiClient` | `tekhsi-api` |
| `app/api/llm/route.ts` | — | `chat`、`knowledge-ai`（mock 上游） |
| `app/api/tekhsi/route.ts` | — | `tekhsi-api`（真实路由） |
| `components/chat/*` | — | `app`、`chat`、`tool-call`、`settings-search` |
| `components/scope/*` | — | `serial-scope` |
| `components/net-scope/*` | — | `net-scope` |
| `components/param-est/*` | — | `param-est` |
| `components/control/*` | — | `control` |
| `components/knowledge/*` | — | `knowledge`、`knowledge-ai` |

---

## 13. 修改入口（按文件）

| 要改什么 | 先看/改这些文件 | 必跑测试 |
|---|---|---|
| 串口帧/CRC/解码 | `lib/serial/aimotor/protocol.ts` | `unit/aimotorProtocol` |
| 参数/安全锁/6000 | `lib/serial/aimotor/params.ts`、`control.ts` | `unit/aimotorParams`、`unit/aimotorControl` |
| 连接/重试/心跳 | `lib/serial/aimotor/controller.ts` | `e2e/serial-recovery`、`e2e/serial-scope` |
| LLM 工具/提示词 | `lib/llm/tools.ts`、`app/api/llm/route.ts` | `e2e/tool-call`、`e2e/chat` |
| LLM SSE/中断 | `lib/llm/llmClient.ts` | `unit/llmClient` |
| 聊天布局/确认卡 | `components/chat/*` | `e2e/app`、`e2e/chat`、`e2e/tool-call` |
| 设置/主题 | `lib/settings.ts`、`lib/i18n.ts`、`app/globals.css`、`app/layout.tsx` | `unit/settings`、`e2e/app`、`e2e/settings-search` |
| 串口示波器 | `components/scope/*`、`lib/stores/scopeStore.ts` | `e2e/serial-scope`、`unit/scopeStore` |
| 参数辨识 | `components/param-est/*` | `e2e/param-est` |
| 手动控制 | `components/control/*` | `e2e/control` |
| 知识库 | `lib/knowledge/*`、`components/knowledge/*`、`lib/stores/knowledgeStore.ts` | `unit/knowledge`、`unit/knowledgeContext`、`e2e/knowledge`、`e2e/knowledge-ai` |
| TekHSI 协议 | `lib/tekhsi/TekHighspeedServer.proto` | `unit/tekhsiClient` |
| TekHSI 采集 | `lib/tekhsi/client.ts` | `unit/tekhsiClient`、`e2e/tekhsi-api` |
| TekHSI 解码/CSV | `lib/tekhsi/decode.ts`、`csv.ts` | `unit/tekhsiDecode`、`e2e/net-scope` |
| TekHSI UI | `components/net-scope/*` | `e2e/net-scope` |
| 页面入口 | `app/*/page.tsx` | 对应 E2E |
| 测试 mock | `e2e/mockAiMotorSerial.ts` | 全部串口相关 E2E |

---

## 14. 过期/风险文件与注意事项

| 文件 | 问题 | 交接建议 |
|---|---|---|
| `docs/ai_tuning_log.md` | 仍按 **Modbus 设备码**/`lib/serial/modbus.ts` 编写，与当前 AI-Motor v1 不一致 | 不要照此调参；后续按 `params.ts` 重写或归档 |
| `lib/report.ts` | 报告 HTML 仍用旧深色配色（`#0a1628/#00a8ff`），与亮/暗主题不一致 | 后续统一主题 token |
| `lib/stores/scopeStore.ts` | 保留旧串口字段 `ports/cfg/status`，当前页面主要用 `buffers/channels` | 不要基于旧字段扩展；如需清理另开任务 |
| `docs/HANDOVER.md` | 按功能组织，和本文按文件组织互补 | 改功能/协议后两份都检查 |
| `docs/界面样式.png` | 参考截图，不参与构建 | 仅设计参考 |
| `.env.example` | 只有占位符；真实 key 在本地 `.env.local`（不入库） | 不要提交 `.env.local` |
| `scopeStore` schema | `scope.schemaVersion` 当前 v4 | 改通道字段时同步升版本并处理迁移 |
| `AGENTS.md` / `components/AGENTS.md` / `lib/AGENTS.md` | 规则/架构说明，可能与代码短暂不同步 | 改架构时同步更新 |

---

## 15. 文档维护规则

新增/移动/删除文件时，至少同步：

1. 本文对应目录表（文件、行数、职责、关键导出）。
2. 第 12 节“文件 → 测试矩阵”。
3. 第 13 节“修改入口”。
4. `AGENTS.md` / `lib/AGENTS.md` / `components/AGENTS.md` 的架构树。
5. 如有新协议/参数，更新 `docs/aimotor_protocol.md` / `docs/tekhsi.md`。

> 以代码为准：冲突时优先检查 `git ls-files`、`lib/serial/aimotor/params.ts`、`lib/tekhsi/TekHighspeedServer.proto`。
