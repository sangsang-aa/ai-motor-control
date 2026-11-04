# MOTOTUNE Web 交接文档

> **基线分支**：`feature/aimotor-v1`
> **功能基线提交**：`208e260`（本文档为后续 docs 提交；交接时本地领先 `origin` 2 个功能提交，尚未 push，本文档提交后再 +1）
> **技术栈**：Next.js 15 / React 19 / TypeScript / zustand / Tailwind v3
> **目标设备**：TI C2000 F280025C（AI-Motor v1 串口）+ Tektronix 4/5/6 系 MSO（TekHSI 网口）
> **浏览器**：Chrome / Edge（Web Serial 必需）
> **更新日期**：2026-11-03
>
> 按文件/目录组织的代码结构文档见 `docs/CODE_STRUCTURE.md`。

---

## 0. 交接速览（先看这一节）

### 0.1 这是什么

MOTOTUNE 的 **Web 版**：把原 Electron 桌面版重构为 Next.js Web 应用，保留聊天、示波器、知识库、设置，并新增：

- AI-Motor v1 串口直连（替换旧 Modbus/MCB）
- PMSM 参数辨识（mode7）
- 手动控制与 30 条参数调控（`/control`）
- 亮/暗双主题（默认亮）
- Tektronix TekHSI 网口示波器（`/net-scope`，gRPC）

### 0.2 五分钟启动

```bash
npm install
npm run dev                 # http://localhost:3000
```

生产：

```bash
npm run build
npm start                   # 必须 next start，不能 next export
```

测试：

```bash
npm run test:unit           # Vitest，73 个用例
npm run test:e2e            # Playwright，43 个用例（自动起 3100 端口）
npm run test:all
```

### 0.3 必须先确认的 5 件事

| 事项 | 要求 |
|---|---|
| 下位机固件 | F280025C 固件实现 **AI-Motor v1**（115200 8N1、A5 5A 帧、HELLO/心跳/ACK） |
| 参数表 | 固件 `host_parameters.inc` 与 `lib/serial/aimotor/params.ts` 的 30 条参数 ID/范围一致 |
| 浏览器 | Chrome/Edge；Web Serial 需要 HTTPS 或 localhost |
| LLM | 侧栏「设置」填 Base URL / API Key / 模型（推荐，存 localStorage） |
| 网口示波器 | Tektronix 4/5/6 系 MSO，启用 TekHSI，运行 Next 的机器能访问 `scope-ip:5000` |

### 0.4 不要做的事

- 不要 `next export`：`/api/llm` 与 `/api/tekhsi` 都是 Node 路由。
- 不要把 `/api/tekhsi` 暴露到公网：它会向用户输入的 `host:port` 发起 TCP（SSRF 风险）。
- 不要让 AI 修改安全锁定参数：`6/13/24/42/51/52`。
- 不要把 TekHSI 数据混进 AI-Motor 的 `scopeStore`：两者时间基/触发语义不同。
- 不要假设仓库里有固件：固件不在本仓库维护。

---

## 1. 项目定位与分支

### 1.1 重构路线

1. 先做齐 Web 版功能（当前阶段）。
2. 功能齐备后加 Electron 壳层，打包桌面版。

Electron 两条路线：

- **方案 A（推荐）**：`next build` + `next start` 内置运行，窗口加载 `localhost:3000`。
- **方案 B**：`next export` 静态导出；但 `/api/llm`、`/api/tekhsi` 需搬进 Electron 主进程。

串口封装时新增 `ElectronSerialAdapter`（node-serialport via IPC），替换 `lib/serial/aimotor/controller.ts` 的 Web Serial I/O；UI/store 不直接依赖串口实现。

### 1.2 分支

| 分支 | 内容 |
|---|---|
| `feature/aimotor-v1` | 当前主线：AI-Motor v1、控制页、主题、TekHSI 网口示波器 |
| `web` | 重构基线；不含本分支后续 AI-Motor/控制/主题/TekHSI 提交 |
| `main` / `arm64` | Electron 桌面版（独立演进） |

当前 `feature/aimotor-v1` 的最新提交（交接时）：

```
208e260 docs: TekHSI 网口示波器协议与使用说明
a5d684b feat(tekhsi): 网口示波器 — TekHSI gRPC 采集 + /net-scope
cfcbc9b docs: 手动页波形与示波器术语说明
d3338ad feat(control): 手动页对齐原界面 — 波形/卡片/日志 + 参数识别电机图 + 示波器术语
```

---

## 2. 环境、启动与配置

### 2.1 环境要求

- Node.js 20 LTS+（Next 15 要求 18.18+；建议 20/22）
- npm
- Chrome / Edge
- 串口驱动（USB-TTL）与 F280025C 板卡
- TekHSI 示波器（可选，仅 `/net-scope` 需要）

### 2.2 安装与运行

```bash
npm install
npm run dev                  # 开发，3000
npm run build && npm start   # 生产
```

Playwright 自己起 `next dev -p 3100`，不要手动占用 3100。

### 2.3 LLM 配置（二选一）

1. **设置面板（推荐）**：侧栏「设置」→ AI 供应商预设（阿里云百炼/OpenAI/DeepSeek/Kimi/GLM/自定义）→ Base URL / API Key / 模型 → 保存。配置存 `localStorage`，随 `/api/llm` 请求体传递。
2. **服务端 `.env.local`（可选 fallback）**：

```bash
cp .env.example .env.local
# 填 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
```

优先级：请求里的 `body.config` > 环境变量。`.env.local` 不入库。

### 2.4 依赖说明

| 依赖 | 用途 |
|---|---|
| `next` / `react` / `react-dom` | Web 框架 |
| `zustand` | 全局状态 |
| `pdfjs-dist` | 知识库 PDF 文本提取（legacy build） |
| `@grpc/grpc-js` / `@grpc/proto-loader` | TekHSI gRPC（仅 Node 路由） |
| `tailwindcss` / `postcss` / `autoprefixer` | 样式 |
| `vitest` / `jsdom` | 单测 |
| `@playwright/test` | E2E |

`next.config.mjs` 已配置：

```js
serverExternalPackages: ['@grpc/grpc-js', '@grpc/proto-loader']
```

避免 gRPC 被打进浏览器 bundle。

---

## 3. 页面与模块地图

### 3.1 页面

| 路径 | 页面 | 作用 |
|---|---|---|
| `/` | `ChatApp` | 聊天、LLM 工具调用、串口连接、报告导出 |
| `/scope` | `ScopeApp` | AI-Motor 100Hz 实时示波器（串口） |
| `/net-scope` | `NetScopeApp` | Tektronix TekHSI 网口示波器（gRPC） |
| `/param-est` | `ParamEstApp` | PMSM 参数辨识（mode7） |
| `/control` | `ControlApp` | 手动控制 + 30 条参数调控 + 波形/CSV/演示 |
| `/knowledge` | `KnowledgeApp` | 知识库建库/上传/删除（IndexedDB） |

### 3.2 服务端路由

| 路由 | 作用 | Runtime |
|---|---|---|
| `/api/llm` | LLM 代理：保护 key、绕 CORS、注入 tools/system prompt、图片去图重试 | Node |
| `/api/tekhsi` | TekHSI gRPC 代理：connect/acquire/disconnect/status | Node |

### 3.3 目录

```text
app/
  page.tsx / scope / net-scope / knowledge / param-est / control
  api/llm/route.ts
  api/tekhsi/route.ts
  layout.tsx / globals.css
components/
  chat/       聊天、Topbar、Sidebar、ConfirmCard、EStop、设置、搜索、对话设置
  scope/      AI-Motor 示波器（ScopeApp/ScopeChart/ChannelPanel/HexView）
  net-scope/  TekHSI 网口示波器（NetScopeApp/Chart/Meta/useTekHsi）
  param-est/  mode7 辨识 UI
  control/    手动控制（ControlBar/Signals/Waveforms/ParamGroups/...）
  knowledge/  知识库 UI
lib/
  serial/aimotor/  AI-Motor v1 协议/参数/控制器/参数分组
  tekhsi/          TekHSI proto/gRPC/解码/CSV/类型
  llm/             SSE 客户端 + 工具定义/系统提示词
  knowledge/       IndexedDB/PDF/上下文预算
  stores/          session/motor/commandLock/scope/knowledge
  bus.ts / types.ts / settings.ts / i18n.ts / report.ts / config.ts
unit/              13 个 Vitest 文件
e2e/               12 个 Playwright 文件 + mock 串口
docs/              协议、测试、设计、交接
```

---

## 4. 功能详解

### 4.1 聊天与 LLM（`/`）

**入口**：侧栏「新建对话」→ Composer 输入。

**数据流**

```
Composer
  → ChatApp.handleSend
  → llmClient.sendMessage
  → POST /api/llm（携带 config/history/systemPrompt/knowledge）
  → 上游 OpenAI 兼容 /chat/completions（SSE）
  → llmBus
  → ChatApp / sessionStore
```

**工具（`lib/llm/tools.ts`）**

| 工具 | 作用 |
|---|---|
| `set_speed(rpm)` | 目标转速 0~6000 RPM；实际为 `SET_PARAM(mode6/8, param1)` |
| `set_motor_state(on)` | `true`：`SET_MODE` + `ENABLE`；`false`：`STOP` |
| `set_mode(mode)` | 仅 5/6/7/8；运行中切换会被下位机拒绝 |
| `set_param(param, value, mode?)` | 允许参数表；安全锁定参数拒绝 |
| `get_status()` | 免确认，读取 mode/stage/转速/电流/模型 |

**确认与锁链**

- `tool_call` → `commandLock.lock()` → `ConfirmCard` → 用户确认 → `sendCommand` → `ai_executed` → `unlock()`。
- `get_status` 自动执行，其余必须确认。
- 30 秒未确认自动取消（`COMMAND_CONFIRM_TIMEOUT=30000`）。
- 锁未释放时 Composer 禁用；`Ctrl+C` 可中断 LLM 并解锁。
- EStop（Composer 工具行红色胶囊）→ `emergency_stop` → `STOP`。

**对话设置**

- Composer「+」→「对话设置」→ `session.systemPrompt`。
- 随会话持久化；发送时覆盖默认 `SYSTEM_PROMPT`。

**报告导出**

- 侧栏「导出报告」或工具组按钮 → `lib/report.ts` 生成 HTML 并下载。
- 内容：会话标题、消息数、用户消息数、时长、逐条消息。
- **已知问题**：报告 HTML 仍是旧深色配色（`#0a1628/#00a8ff`），与当前亮/暗主题不一致，后续可统一。

**测试**：`e2e/chat.spec.ts`、`e2e/tool-call.spec.ts`、`e2e/settings-search.spec.ts`。

---

### 4.2 AI-Motor v1 串口

**入口**：Topbar「连接串口」/ `/control` / `/param-est` 的连接按钮。

**核心文件**

| 文件 | 作用 |
|---|---|
| `lib/serial/aimotor/protocol.ts` | 帧/CRC/命令/解码/模式标签 |
| `lib/serial/aimotor/params.ts` | 30 条参数表/安全锁/范围校验/6000 clamp |
| `lib/serial/aimotor/controller.ts` | Web Serial、HELLO、心跳、ACK 重试、STOP、100Hz 遥测、演示模式 |
| `lib/serial/aimotor/control.ts` | 参数分组 / paramMode / 安全标记 |

**连接流程**

1. 用户点击连接 → `navigator.serial.requestPort()`（必须在用户手势中）。
2. `open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })`。
3. 尝试 `DTR=false`，等待 100ms（适配器不支持则忽略）。
4. 启动读循环 → 发 `HELLO`（1200ms 超时）。
5. HELLO ACK 成功 → `handshake=true` → 发 `GET_CONFIG` → 启动心跳/看门狗。
6. 失败：`disconnect()` 释放 reader/writer/port，返回错误文案。

**可靠性**

- 心跳：100ms。
- 单命令在途；ACK 超时 800ms，同 seq 重发最多 2 次。
- STOP 优先；断开时尽力发 STOP。
- 5s 无有效下位机数据 → 判超时。
- MCU 端 500ms 心跳看门狗撤销远程使能。

**演示模式**

- `/control`「演示模式」→ controller 本地产生 100Hz SAMPLE/100ms MODEL，不碰硬件。
- 用于无板卡时验收 UI、波形、CSV、参数写入流程。

**测试**：`unit/aimotorProtocol.spec.ts`、`unit/aimotorParams.spec.ts`、`unit/aimotorStore.spec.ts`、`e2e/serial-recovery.spec.ts`、`e2e/serial-scope.spec.ts`、`e2e/control.spec.ts`、`e2e/param-est.spec.ts`。

---

### 4.3 串口示波器（`/scope`）

**数据源**：100Hz `SAMPLE`（不是 5kHz 波形帧）。

**通道（6 个）**

| # | 名称 | 单位 | 默认 |
|---|---|---|---|
| 0 | Iu | A | 开 |
| 1 | Speed | rpm | 开 |
| 2 | Id | A | 关 |
| 3 | Iq | A | 关 |
| 4 | EMF | V | 关 |
| 5 | I/F | rpm | 关 |

**功能**

- `ScopeChart`：SVG + rAF 重绘；网格 `line` + 波形 `path`。
- 通道面板：启用/显示名/颜色/**位置**（垂直位置，div）/**V/div**（电压每格）/统计。
- 暂停/继续；HEX 原始字节视图（`hexBus`）。
- 通道配置持久化到 `scope.channels`（schema 版本 `scope.schemaVersion`，当前 v4）。

**注意**

- 暂停只停止刷新缓冲，不停止串口读取。
- 通道面板的「位置」「V/div」是真实示波器术语：Vertical Position / Volts per Division。

**测试**：`e2e/serial-scope.spec.ts`、`unit/scopeStore.spec.ts`。

---

### 4.4 PMSM 参数辨识（`/param-est`，mode7）

**流程**

1. 连接串口（115200）。
2. 填母线电压（param 40）、极对数（param 41）、最大测试电流（param 42）。
3. 「下发配置」→ `sendManualParam(40/41/42, mode7)`（绕过 AI 锁，但仍做范围校验）。
4. 「开始辨识」→ `SET_MODE 7` → `ENABLE`。
5. 订阅 100Hz SAMPLE 的 `stage/error`，显示阶段/失败原因。
6. 订阅 100ms MODEL，显示设备已应用模型 `Rs/Ld/Lq/Ls`。
7. 「停止」→ `STOP`。

**文件**

- `ParamEstApp`：页壳 + `aiMotorBus` 订阅。
- `TestControlPanel`：配置/开始/停止。
- `EstimatedParamsPanel`：阶段/错误/Rs/Ld/Lq/Ls + 电机图片 `public/motor-product.png`。
- `DebugScope`：Id/Iq/Speed/stage 实时。

**错误码**（`IDENT_ERROR_LABEL`）：1 输入错误、2 过流、3 ADC 异常、4 不够安静、5 直流未稳定、6 Rs 无效、7 注入信号弱、8 复阻抗不合格、9 重复性不合格。

**测试**：`e2e/param-est.spec.ts`。

---

### 4.5 手动控制与参数调控（`/control`）

**布局（对齐原上位机手动页）**

- 左栏「控制与参数」：mode 5/6/7/8、连接/演示、启动/停止、30 条参数分组、目标转速 + 正转/反转/减速至 0。
- 右栏：3 个实时卡片（实际估速/Iq 实测/反电势）、状态、波形、CSV 记录、模型。
- 底部：操作日志。

**参数**

- 30 条参数按组展示：启动与速度、速度环、交接与停车、对齐、辨识、全局。
- 回读：`GET_CONFIG` → `ai_config` → 显示「已回读 N 条」。
- 写入：`sendManualParam`（人工路径，不受 AI 锁限制，仍校验范围）。
- **安全锁定参数**（6/13/24/42/51/52）：手动修改需 `confirm()` 二次确认；AI 仍禁止修改。
- param 13（闭环最大 Iq）的上限跟随 param 24（`max_parameter_id=24`）。
- 转速上限 6000 RPM（`clampCommandRpm`）。

**波形**

- 「速度 / dq 电流」：速度（给定/估速）+ dq（Id/Iq/Iq给定）。
- 「三相电流」：iu/iv/iw。
- 100Hz 环形缓冲（最近约 11 秒）；暂停/继续、清空、导出当前波形 CSV。
- 固定采样颜色（`#f59e0b/#3b82f6/#22c55e`）。

**CSV 记录**

- 「开始记录」→ 订阅 100Hz SAMPLE；「停止并下载」→ CSV。
- 列：`tick,mode,stage,flags,error,reference,speed,id_ref,id,iq_ref,iq,iu,iv,iw,angle,emf,if_speed`。
- 上限 100000 行。

**测试**：`e2e/control.spec.ts`、`unit/aimotorControl.spec.ts`。

---

### 4.6 知识库（`/knowledge`）

**存储**：IndexedDB `mototune.knowledge`（DB v1），store：`kb`、`kbFile`（索引 `kbId`）。

**功能**

- 创建/删除知识库；上传/删除文件。
- 支持 PDF / 图片；单文件 ≤ 10MB。
- PDF → `pdfjs-dist` 提取文本；图片 → dataURL。
- 投送：Composer「工具 ▾」→「知识库」→ `KnowledgePicker`；`session.kbIds` 持久化。
- 每次发送时 `buildKnowledgePayload(kbIds)` 现取现注入，不把大文本/图片存进会话消息。
- 预算：文本合计 ≤ 12000 字符；图片 ≤ 4 张且每张 ≤ 2MB。
- 上游不支持图片 → `/api/llm` 去图重试，回 `X-Knowledge-Images-Dropped:1`，前端提示「当前模型不支持图片」；不记忆能力，换多模态模型后自动恢复。

**测试**：`unit/knowledge.spec.ts`、`unit/knowledgeContext.spec.ts`、`e2e/knowledge.spec.ts`、`e2e/knowledge-ai.spec.ts`。

---

### 4.7 设置与主题

**设置项**

| 项 | 说明 |
|---|---|
| 语言 | 中/英，`useLangStore` 响应式 |
| 主题 | 亮/暗，默认亮 |
| AI 供应商 | 预设：阿里云百炼/百炼专属/OpenAI/DeepSeek/Kimi/GLM/自定义 |
| Base URL / API Key / 模型 | 存 `localStorage`，随请求传给 `/api/llm` |

**持久化**

- key：`mototune.settings`。
- `useSettingsStore` 是设置唯一响应式源；`saveSettings`/`loadSettings` 都会写它。
- 主题切换入口：侧栏品牌行按钮 + 设置面板；`app/layout.tsx` 首屏脚本避免闪烁。
- 主题 token：`--cx-*` 两套值；亮色底 `#f7f7f5`，暗色底 `#0a0a0a`。
- **不要硬编码旧深蓝/旧青**；新增颜色走 `tailwind.config.js` 或 `--cx-*`。

**测试**：`unit/settings.spec.ts`、`e2e/app.spec.ts`、`e2e/settings-search.spec.ts`。

---

### 4.8 网口示波器（`/net-scope`，TekHSI）

**入口**：侧栏「网口示波器」。

**链路**

```
浏览器 /net-scope
  ↕ 同源 HTTP (POST /api/tekhsi)
Next.js Node 路由
  ↕ gRPC :5000（明文）
Tektronix 4/5/6 系 MSO（TekHSI）
```

**协议**

- proto：`lib/tekhsi/TekHighspeedServer.proto`（package `Tekscope`），字段号从官方 Python 包序列化描述符还原。
- 服务：
  - `Connect`：`Connect/Disconnect/RequestNewSequence/RequestAvailableNames/WaitForDataAccess/FinishedWithDataAccess`
  - `NativeData`：`GetHeader/GetWaveform(stream)`
  - `NormalizedData`：本实现未用
- 采集时序：

```text
Connect {name}
RequestAvailableNames {name}
[RequestNewSequence {name}]        // 可选
WaitForDataAccess {name}
  for each channel:
    GetHeader {sourcename, chunksize=80000}
    GetWaveform {sourcename, chunksize=80000}
FinishedWithDataAccess {name}
```

**解码**（与官方 `tm_data_types` 一致）

| sourcewidth | dtype |
|---|---|
| 1 | int8 |
| 2 | int16 little-endian |
| 4 | float32 little-endian |

```text
y[i] = raw[i] * verticalspacing + verticaloffset
x[i] = (i - horizontalzeroindex) * horizontalspacing
```

- `wfmtype` 1/2/3（ANALOG_8/16/FLOAT）支持；数字/IQ 返回错误。
- 默认最多 100000 点/通道；超过按 `ceil(N/maxPoints)` 抽点，UI 显示 `×N`，CSV 时间轴按原索引。

**HTTP 契约**

```jsonc
// connect
{ "action": "connect", "host": "192.168.0.1", "port": 5000 }
// acquire
{ "action": "acquire", "channels": ["ch1","ch2"], "forceSequence": false, "maxPoints": 100000 }
// disconnect
{ "action": "disconnect" }
```

`GET /api/tekhsi` → 连接状态。

**UI**

- 连接/断开、通道勾选、单次采集、连续采集（1 Hz）、强制新采集、CSV 长格式导出。
- 每通道独立 SVG 波形 + 时间轴/触发线/单位。
- 元数据：记录点数、解码点数、抽点、Δt、触发索引、y 缩放、单位。

**限制**

- 仅模拟通道单帧；数字/IQ/FastFrame 不支持。
- 仅明文 `:5000`；TLS/Mode 3 未做。
- 不做 SCPI 控制（时基/触发/垂直档位）。
- 连续采集是 1 Hz 轮询，不是内部高速流。

**测试**：`unit/tekhsiDecode.spec.ts`、`unit/tekhsiClient.spec.ts`、`e2e/net-scope.spec.ts`、`e2e/tekhsi-api.spec.ts`。

**详细文档**：`docs/tekhsi.md`。

---

## 5. 协议参考

### 5.1 AI-Motor v1 帧

```text
A5 5A | version:u8=1 | type:u8 | len:u16LE | seq:u16LE | payload | CRC16:u16LE
```

- CRC16/CCITT-FALSE：初值 `FFFF`，多项式 `1021`，无反射、无末尾异或。
- 计算范围：`version` 到 payload 末尾（不含 `A5 5A` 与 CRC）。
- 浮点 IEEE-754 binary32 小端；整数无符号小端。
- 最大帧 128 wire 字节，数据区 ≤ 118。

### 5.2 消息类型

| type | 名称 | payload |
|---|---|---|
| `0x01` | 命令 | 8B：`command:u8 mode:u8 param:u16LE value:f32LE` |
| `0x81` | ACK | 8B：`command:u8 status:u8 param:u16LE value:f32LE` |
| `0x80` | 快速遥测 | 60B：`tick:u32 mode:u16 stage:u16 flags:u16 error:u16` + 12×f32 |
| `0x82` | 模型/诊断 | 76B：10×f32 + 8×u16 + 5×u32 |
| `0x83` | 配置回读 | 每记录 8B：`param:u16 mode:u8 integer:u8 value:f32` |

### 5.3 命令

| command | 名称 | 说明 |
|---|---|---|
| 0 | HEARTBEAT | 100ms，不回 ACK |
| 1 | STOP | 立即撤销使能/进入 mode5 |
| 2 | SET_MODE | 仅 5/6/7/8；运行中切换被拒绝 |
| 3 | SET_PARAM | `mode=0` 全局；6/8 启动实例；7 辨识 |
| 4 | ENABLE | 必须先 HELLO |
| 5 | GET_CONFIG | 请求全部允许参数 |
| 6 | HELLO | 建立会话 |

### 5.4 ACK 状态

`0` 成功、`1` 未知命令、`2` 模式不匹配、`3` 未知参数、`4` 超限/非数、`5` 运行中禁止、`6` 模型/HFI 未就绪、`7` 忙、`8` 未握手、`9` 通信超时。

### 5.5 模式/阶段

| mode | 名称 |
|---|---|
| 5 | 停止 / 空闲 |
| 6 | HFI → I/f → 速度环 |
| 7 | 电机参数辨识 |
| 8 | Id 对齐 → I/f → 速度环 |

普通阶段：0 停止、1 HFI 初始定位、2 I/f 强拖、3 速度闭环、4 制动、5 停车等待、6 零速空闲、7 启动失败、8 角度交接、9 Id 对齐。

mode7 阶段：0 空闲、1 静态检查、2 对齐、3 Rs 低电流、4 Rs 高电流、5 d 轴预注入、6 Ld 测量、7 q 轴预注入、8 Lq 测量、9 完成、10 失败。

### 5.6 快速遥测 12×f32

`reference_rpm, measured_rpm, id_applied_a, id_measured_a, iq_applied_a, iq_measured_a, iu, iv, iw, angle_rad, emf_magnitude_v, if_speed_rpm`

mode7：`reference/speed/angle/iq_ref/if_speed=0`，`id_ref=dc_target`，`error=MotorIdentError`。

`flags` 位：0 enable、1 active、2 injection、3 BEMF valid、4 速度环锁存、5 电气模型可用、6 原生 HFI 可用、7 远程所有权、8 通信超时曾停机。

### 5.7 TekHSI

见 4.8 与 `docs/tekhsi.md`。

---

## 6. 状态、事件与持久化

### 6.1 事件总线（`lib/bus.ts`）

| Bus | 事件 | 消费者 |
|---|---|---|
| `aiMotorBus` | `ai_status/ai_sample/ai_model/ai_config/ai_ack/ai_error/ai_closed/ai_executed` | ChatApp、ScopeApp、ParamEstApp、ControlApp、ChatPane |
| `llmBus` | `text/tool_call/turn_end/error/interrupted` | ChatApp |
| `hexBus` | `Uint8Array` | ScopeApp → HexView |

### 6.2 Zustand stores

| Store | 内容 | 持久化 |
|---|---|---|
| `sessionStore` | 会话、消息、`systemPrompt`、`kbIds` | `mototune.sessions` / `mototune.sessions.order` |
| `motorStore` | connected/status/mode/stage/sample/model/config/reference/iq | 无 |
| `commandLockStore` | idle → pending → executing | 无 |
| `scopeStore` | 6 通道配置、Float32Array 缓冲、HEX | `scope.channels`（含 schema 版本） |
| `knowledgeStore` | 知识库列表/当前库/文件 | IndexedDB `mototune.knowledge` |

### 6.3 关键 localStorage key

- `mototune.sessions`、`mototune.sessions.order`
- `mototune.settings`（语言/主题/AI 配置）
- `scope.channels`、`scope.schemaVersion`
- `mototune.tekhsi.host`、`mototune.tekhsi.port`（网口示波器地址）

### 6.4 空消息防御

- `sessionStore.applyLlmEvent` 对空 content 的 `text` 不新建消息。
- `ChatApp` 在 `tool_call` 时不再追加空 text，避免“空气泡”。

---

## 7. 安全设计

| 机制 | 行为 |
|---|---|
| AI 参数锁 | AI 禁止修改 6/13/24/42/51/52 |
| 人工二次确认 | `/control` 修改安全参数需 `confirm()` |
| 转速上限 | `clampCommandRpm` 限制 ±6000 RPM |
| 命令确认 | tool_call 必须人工确认，30s 超时取消 |
| 急停 | EStop / `emergency_stop` → STOP |
| 串口握手 | HELLO 成功后才允许 ENABLE |
| 心跳/看门狗 | 上位机 100ms；MCU 500ms 超时撤销使能 |
| 超时 | 5s 无数据判超时；ACK 800ms×2 重试 |
| STOP 优先 | 断开/急停优先发 STOP |
| TekHSI 网络 | `/api/tekhsi` 仅建议本机/实验室；host 格式校验；不要公网暴露 |

---

## 8. 测试与验收

### 8.1 命令

```bash
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run build
```

当前基线：

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 errors |
| Vitest | 13 files / 73 tests passed |
| Playwright | 12 files / 43 tests passed |
| `next build` | 成功；`/api/llm`、`/api/tekhsi` 为动态路由 |

### 8.2 单测覆盖

| 文件 | 覆盖 |
|---|---|
| `aimotorProtocol.spec.ts` | 帧/CRC/解码 |
| `aimotorParams.spec.ts` | 参数范围/安全锁/6000 clamp |
| `aimotorStore.spec.ts` | 事件→store |
| `aimotorControl.spec.ts` | 参数分组/paramMode/安全标记 |
| `commandLockStore.spec.ts` | 锁状态机 |
| `llmClient.spec.ts` | SSE 解析/abort |
| `sessionStore.spec.ts` | 会话 CRUD/消息落库 |
| `scopeStore.spec.ts` | 通道/缓冲 |
| `knowledge.spec.ts` / `knowledgeContext.spec.ts` | IndexedDB/预算/上下文 |
| `settings.spec.ts` | 设置/主题 |
| `tekhsiDecode.spec.ts` | int8/int16/float32/缩放/抽点/CSV |
| `tekhsiClient.spec.ts` | fake gRPC server 完整时序 |

### 8.3 E2E 覆盖

| 文件 | 覆盖 |
|---|---|
| `app.spec.ts` | 启动/侧栏/主题/页面 |
| `chat.spec.ts` | 流式/错误/持久化/重命名 |
| `tool-call.spec.ts` | ConfirmCard/串口写入/安全锁 |
| `serial-scope.spec.ts` | 串口识别/100Hz/暂停/术语 |
| `serial-recovery.spec.ts` | HELLO ACK 丢失/无响应 |
| `param-est.spec.ts` | mode7 成功/失败/图片 |
| `control.spec.ts` | 连接/模式/调参/波形/CSV/演示 |
| `knowledge.spec.ts` / `knowledge-ai.spec.ts` | 建库/上传/投送/图片降级 |
| `settings-search.spec.ts` | 设置/搜索/模型响应式/对话设置 |
| `net-scope.spec.ts` | 网口示波器 UI mock |
| `tekhsi-api.spec.ts` | 真实 `/api/tekhsi` + fake gRPC server |

### 8.4 Mock 策略

- LLM：`page.route('**/api/llm')` 返回固定 SSE。
- AI-Motor 串口：`e2e/mockAiMotorSerial.ts` 的 `fakeAiMotorSerial()` 注入 fake `navigator.serial`（HELLO/ACK/10ms SAMPLE/100ms MODEL/CONFIG）。
- TekHSI UI：`page.route('**/api/tekhsi')` 返回固定 JSON。
- TekHSI 路由：测试进程起 fake gRPC server，Next 路由真实连接。
- 知识库：真实 IndexedDB（`setInputFiles` 注入 PNG）。

**浏览器 mock 不能替代实板/实机验收。**

### 8.5 实机验收

**AI-Motor**

- [ ] 连接后 Topbar 显示已连接 + 设备名，115200 8N1。
- [ ] 100Hz SAMPLE 持续刷新，转速/电流非零。
- [ ] HELLO/心跳/ACK 重试正常；拔线 5s 内报超时。
- [ ] mode6/8 启动、调速、停止；STOP 优先。
- [ ] mode7 辨识：配置 40/41/42 → SET_MODE 7 → ENABLE → stage/error → Rs/Ld/Lq/Ls。
- [ ] 安全参数 AI 拒绝；人工二次确认后可写。
- [ ] 参数回读与固件 `host_parameters.inc` 一致。

**TekHSI**

- [ ] 4/5/6 系 MSO，TekHSI 已启用。
- [ ] 运行 Next 的机器能 `ping` 示波器，`5000` 可达。
- [ ] 连接后显示真实通道名。
- [ ] 单次采集波形与示波器屏幕幅值/时间轴/触发一致。
- [ ] 连续采集 10 帧无泄漏/超时；断开后示波器继续正常采集。
- [ ] CSV 时间轴/单位正确。

---

## 9. 已知限制与坑

| 问题 | 说明/处理 |
|---|---|
| Web Serial 仅 Chromium | Chrome/Edge；HTTPS 或 localhost；`requestPort()` 必须在用户手势 |
| 刷新丢串口 | 浏览器安全限制，刷新后需重新授权/连接 |
| 固件不在仓库 | AI-Motor v1 需 F280025C 固件实现；参数表需与 `host_parameters.inc` 对齐 |
| 实际波特率偏差 | 固件 LSPCLK/BRR 可能导致实际略低于 115200；上位机按 115200 配置 |
| Next dev route ENOENT | Fast Refresh 期间访问 `/api/llm` 可能 500；`rm -rf .next` 重启，稳定阶段用 `next build && next start` |
| 不能 `next export` | `/api/llm`、`/api/tekhsi` 需要 Node |
| `/api/tekhsi` SSRF | 仅本机/实验室；host 校验；不要公网暴露 |
| TekHSI 仅模拟单帧 | 数字/IQ/FastFrame 未实现 |
| TekHSI 明文 | 仅 `:5000` 明文；TLS/Mode 3 未实现 |
| TekHSI 连续 1Hz | 轮询，不是内部高速流 |
| 大记录 | 默认 10 万点/通道，超出抽点；CSV 为抽点后数据（时间轴按原索引） |
| 报告旧配色 | `lib/report.ts` 仍用旧深色 `#0a1628/#00a8ff`，与主题不一致 |
| 电机图片体积 | `public/motor-product.png` 约 1.7MB；后续可压 WebP |
| 参数表维护 | 改固件参数必须同步 `params.ts`、`docs/aimotor_protocol.md`、测试 |
| ACK 重试间隔文档不一致 | `docs/aimotor_protocol.md`/`AGENTS.md` 写 300ms×2；实际 `controller.ts` 为 800ms×2，以代码为准，后续统一 |
| `app/api/llm/route.ts` 注释 | 注释仍写“唯一保留的服务端能力”；实际已有 `/api/tekhsi`，阅读时注意 |

---

## 10. 交接检查清单

### 10.1 代码与环境

- [ ] 当前分支 `feature/aimotor-v1`，工作区干净。
- [ ] `npm install` 成功；Node 20+。
- [ ] `npx tsc --noEmit` 0 errors。
- [ ] `npm run test:unit` 73 passed。
- [ ] `npm run test:e2e` 43 passed。
- [ ] `npm run build` 成功。
- [ ] `.env.local` 已配置，或设置面板已填 LLM。
- [ ] Chrome/Edge 可用；localhost/HTTPS。

### 10.2 设备

- [ ] F280025C 固件实现 AI-Motor v1。
- [ ] 参数表与固件一致。
- [ ] USB-TTL 驱动/串口权限正常。
- [ ] 示波器 4/5/6 系 MSO，TekHSI 开启，`:5000` 可达。

### 10.3 功能逐项

- [ ] `/` 聊天流式、工具确认、急停、报告导出。
- [ ] `/scope` 100Hz 波形、6 通道、暂停/HEX、位置/V/div。
- [ ] `/param-est` mode7 成功/失败路径、电机图片。
- [ ] `/control` 模式/启停/调速/参数/波形/CSV/演示/日志。
- [ ] `/knowledge` 建库/上传/投送/图片降级。
- [ ] `/net-scope` 连接/通道/采集/连续/CSV/错误。
- [ ] 设置/主题/语言/模型切换持久化。

---

## 11. 后续路线

1. **Electron 封装**
   - 方案 A：`next build` + `next start` 内置；保留 `/api/llm`、`/api/tekhsi`。
   - 提取 `SerialAdapter` 接口，新增 `ElectronSerialAdapter`。
   - 网口示波器 gRPC 留在主进程/Node 路由。
2. **TekHSI 增强**
   - TLS / Mode 3 认证。
   - SCPI 仪器控制（时基/触发/垂直档位）。
   - 数字通道 / IQ / FastFrame。
   - 更高速的连续采集（非 1Hz 轮询）。
3. **UI/文档**
   - 报告 HTML 亮/暗主题统一。
   - 电机图片压缩。
   - 参数表与固件自动对齐检查。
4. **测试**
   - 增加真实串口/真实 TekHSI 的 nightly 验收。
   - 控制页/参数辨识页的更多边界用例。

---

## 附录 A：30 条参数表

> 来源：`lib/serial/aimotor/params.ts`；必须与固件 `host_parameters.inc` 对齐。
> 锁定 = AI 禁止修改（人工修改需二次确认）。

| ID | key | 名称 | 范围 | 默认 | 组 | modes | 锁定 |
|---|---|---|---|---|---|---|---|
| 1 | `command_rpm` | 目标转速 | -10000..10000 rpm | 1500 | 启动与速度 | 6/8 | |
| 2 | `startup_iq_a` | 启动 Iq 幅值 | 0.01..5 A | 0.8 | 启动与速度 | 6/8 | |
| 5 | `handoff_rpm` | 接管转速 | 100..5000 rpm | 800 | 启动与速度 | 6/8 | |
| 6 | `if_max_rpm` | 强拖速度上限 | 100..5000 rpm | 1000 | 启动与速度 | 6/8 | ✅ |
| 7 | `if_slew_rpm_per_s` | 强拖加速度 | 1..5000 rpm/s | 200 | 启动与速度 | 6/8 | |
| 8 | `speed.slew_rpm_per_s` | 闭环加速度 | 1..30000 rpm/s | 4000 | 速度环 | 6/8 | |
| 9 | `speed.decel_rpm_per_s` | 闭环减速度 | 1..30000 rpm/s | 10000 | 速度环 | 6/8 | |
| 10 | `current_slew_a_per_s` | 开环启动 Iq 斜率 | 0..1000 A/s | 1 | 启动与速度 | 6/8 | |
| 11 | `speed.kp` | 速度 Kp | 1e-6..1 A/rpm | 0.004 | 速度环 | 6/8 | |
| 12 | `speed.ki` | 速度 Ki | 1e-6..10 A/(rpm·s) | 0.04 | 速度环 | 6/8 | |
| 24 | `speed.iq_range_max_a` | 闭环 Iq 范围上限 | 0.01..50 A | 3 | 速度环 | 6/8 | ✅ |
| 13 | `speed.iq_limit_a` | 闭环最大 Iq（在线） | 0.01..50 A（上限跟随 24） | 3 | 速度环 | 6/8 | ✅ |
| 14 | `speed.speed_filter_hz` | 速度滤波 | 1..200 Hz | 50 | 速度环 | 6/8 | |
| 15 | `bemf.min_emf_v` | 反电势有效门槛 | 0.001..5 V | 0.2 | 交接与停车 | 6/8 | |
| 16 | `blend_time_ms` | 角度过渡时间 | 1..1000 ms | 50 | 交接与停车 | 6/8 | |
| 17 | `handoff_stable_ms` | 接管稳定时间 | 1..1000 ms | 10 | 交接与停车 | 6/8 | |
| 18 | `handoff_speed_tolerance_rpm` | 接管速度差容许 | 1..1000 rpm | 80 | 交接与停车 | 6/8 | |
| 19 | `stop_settle_ms` | 停车等待 | 1..10000 ms | 200 | 交接与停车 | 6/8 | |
| 20 | `stop_quiet_ms` | 停车安静时间 | 10..10000 ms | 100 | 交接与停车 | 6/8 | |
| 21 | `stop_emf_v` | 停车电势门槛 | 0.001..5 V | 0.1 | 交接与停车 | 6/8 | |
| 22 | `stop_current_a` | 停车电流门槛 | 0.01..5 A | 0.25 | 交接与停车 | 6/8 | |
| 3 | `alignment_id_a` | Id 对齐电流 | 0.01..5 A | 2 | 对齐 | 8 | |
| 4 | `alignment_time_s` | Id 对齐时间 | 0.001..60 s | 2 | 对齐 | 8 | |
| 23 | `if_enable` | I/f 启动（0/1） | 0..1 | 1 | 启动与速度 | 6 | |
| 40 | `bus_voltage_v` | 辨识母线电压 | 1..200 V | 24 | 辨识 | 7 | |
| 41 | `pole_pairs` | 极对数 | 1..50 | 5 | 辨识 | 7 | |
| 42 | `max_test_current_a` | 最大测试相电流峰值 | 0.1..20 A | 5 | 辨识 | 7 | ✅ |
| 50 | `phf_voltage_v` | HFI 注入峰值 | 0.01..5 V | 0.8 | 全局 | 0 | |
| 51 | `select` | 参数组（0=旧/1=最新） | 0..1 | 1 | 全局 | 0 | ✅ |
| 52 | `auto_apply_ident` | 辨识后自动应用（0/1） | 0..1 | 1 | 全局 | 0 | ✅ |

整数参数：23、41、51、52。

---

## 附录 B：关键 `data-testid`

| 页面 | testid |
|---|---|
| 全局 | `theme-toggle` |
| 设置/搜索 | `settings-provider-item`、`settings-base-url`、`settings-api-key`、`settings-model`、`settings-save`、`search-overlay`、`search-result` |
| `/scope` | `realtime-current`、`realtime-speed` |
| `/param-est` | `pe-connect`、`pe-bus`、`pe-pole-pairs`、`pe-max-current`、`pe-send-config`、`pe-start`、`pe-stop`、`pe-stage`、`pe-error`、`paramest-motor`、`res-Rs/Ld/Lq/Ls` |
| `/control` | `ctl-connect`、`ctl-demo`、`ctl-enable`、`ctl-stop`、`mode-5..8`、`target-rpm`、`apply-speed`、`speed-forward/reverse/zero`、`param-11`、`apply-group`、`reload-config`、`config-count`、`wave-tab-overview/phase`、`wave-speed/dq/phase`、`wave-pause`、`wave-clear`、`export-wave-csv`、`rec-start`、`rec-stop`、`rec-count`、`control-log` |
| `/net-scope` | `net-host`、`net-port`、`net-connect`、`net-disconnect`、`net-status`、`net-channel-<name>`、`net-acquire`、`net-continuous`、`net-force`、`net-export`、`net-error`、`net-empty`、`net-chart-<name>`、`net-meta` |
| 知识库/投送 | `kb-name-input`、`kb-create`、`kb-item`、`kb-delete`、`file-input`、`file-upload`、`file-item`、`file-delete`；Composer 投送：`kb-pick-item`、`kb-deliver`、`kb-clear` |

---

## 附录 C：关键文件改动入口

| 要改什么 | 改哪里 |
|---|---|
| 串口帧/CRC/解码 | `lib/serial/aimotor/protocol.ts` + `unit/aimotorProtocol.spec.ts` |
| 参数/安全锁 | `lib/serial/aimotor/params.ts` + `unit/aimotorParams.spec.ts` |
| 串口连接/重试/心跳 | `lib/serial/aimotor/controller.ts` + `e2e/serial-recovery.spec.ts` |
| 参数分组/模式 | `lib/serial/aimotor/control.ts` + `unit/aimotorControl.spec.ts` |
| LLM 工具/提示词 | `lib/llm/tools.ts` + `app/api/llm/route.ts` |
| LLM SSE 解析 | `lib/llm/llmClient.ts` + `unit/llmClient.spec.ts` |
| 聊天/确认/锁 | `components/chat/*` + `e2e/tool-call.spec.ts` |
| 串口示波器 | `components/scope/*` + `lib/stores/scopeStore.ts` |
| 参数辨识 | `components/param-est/*` + `e2e/param-est.spec.ts` |
| 手动控制 | `components/control/*` + `e2e/control.spec.ts` |
| 知识库 | `lib/knowledge/*` + `components/knowledge/*` |
| 设置/主题 | `lib/settings.ts` + `app/globals.css` + `app/layout.tsx` |
| TekHSI 协议 | `lib/tekhsi/TekHighspeedServer.proto` |
| TekHSI 采集/时序 | `lib/tekhsi/client.ts` + `unit/tekhsiClient.spec.ts` |
| TekHSI 解码 | `lib/tekhsi/decode.ts` + `unit/tekhsiDecode.spec.ts` |
| TekHSI API | `app/api/tekhsi/route.ts` + `e2e/tekhsi-api.spec.ts` |
| TekHSI UI | `components/net-scope/*` + `e2e/net-scope.spec.ts` |

---

## 附录 D：排障速查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 连接按钮无反应 | 浏览器不支持 Web Serial / 非用户手势 | 用 Chrome/Edge；localhost/HTTPS；直接点击 |
| 握手失败 | 固件未实现 AI-Motor v1 / 波特率不符 / 未上电 | 查固件、115200 8N1、HELLO ACK |
| 连接后无遥测 | 下位机未发 SAMPLE / 5s 超时 | 查固件 100Hz 遥测、串口线 |
| AI 工具被拒绝 | 安全锁定参数 / 范围越界 / 未连接 | 查 6/13/24/42/51/52；参数表 |
| LLM 500 | 未配置 key / Next dev reload | 设置面板填 key；`rm -rf .next` 重启 |
| 知识库图片不生效 | 模型不支持视觉 | 看「当前模型不支持图片」提示；换多模态模型 |
| TekHSI 连接超时 | IP/端口错、TekHSI 未开、防火墙 | `ping`；确认 `:5000`；示波器启用 TekHSI |
| TekHSI 通道为空 | 示波器无采集数据/通道类型不支持 | 先让示波器采集；只选模拟通道 |
| `Cannot find module @grpc/grpc-js` | 依赖未装/未 external | `npm install`；检查 `next.config.mjs` |
| `next export` 失败 | Node 路由 | 改用 `next build && next start` |
| 参数写入被拒 | 13 超过 24 / 运行中写非 live / 越界 | 先调 24；停止后写；查范围 |
| 转速超 6000 | clamp | 设计限制，不可绕过 |

---

## 附录 E：协议/实现文档索引

- `docs/aimotor_protocol.md` — AI-Motor v1 串口协议
- `docs/tekhsi.md` — TekHSI 网口示波器
- `docs/TESTING.md` — 测试分层与用例
- `docs/DESIGN.md` — 界面/主题参考
- `AGENTS.md` — 项目总览与开发约定
- `lib/AGENTS.md` — 核心逻辑域
- `components/AGENTS.md` — 组件域

---

> 维护建议：改协议/参数/页面/测试后，同步更新本文档对应章节；参数表以 `lib/serial/aimotor/params.ts` 为准，TekHSI 以 `lib/tekhsi/TekHighspeedServer.proto` 为准。
