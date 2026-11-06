# MOTOTUNE Web 架构、作业流程与 Agent 开发规范

> **分支**：`docs/architecture-workflow-agent`（从 `feature/aimotor-v1` 切出）
> **功能基线**：`ab7bc89`
> **适用**：MOTOTUNE Web 版（Next.js 15 / React 19 / TypeScript）
> **分支内容**：本分支只包含本文档，不包含项目源码；文中引用的 `docs/*` 与源码路径指向主项目分支。
> **配套文档**：
> - `docs/HANDOVER.md`：按功能的全量交接
> - `docs/CODE_STRUCTURE.md`：按文件位置的代码结构
> - `docs/aimotor_protocol.md` / `docs/tekhsi.md`：两套通信协议
> - `docs/TESTING.md`：测试分层与验收

---

## 0. 文档定位

本文回答三个问题：

1. **架构设计**：系统由哪些层/模块组成，边界、数据流、状态与安全约束是什么。
2. **作业流程**：从需求到上线的标准步骤，分支/测试/提交/验收怎么做。
3. **Agent 开发要领**：AI Agent 在本仓库必须遵守的流程、规范、禁区与交付标准。

冲突时以代码和以下文档为准：`AGENTS.md`、`lib/AGENTS.md`、`components/AGENTS.md`、`lib/serial/aimotor/params.ts`、`lib/tekhsi/TekHighspeedServer.proto`。

---

## 1. 项目定位与边界

### 1.1 是什么

MOTOTUNE Web 版是电驱控制上位机：

- AI 聊天 + LLM 工具调用（自然语言控制电机）
- Web Serial 直连 TI C2000 F280025C（AI-Motor v1）
- 100Hz 串口示波器
- PMSM 参数辨识（mode7）
- 手动控制 + 30 条参数调控 + CSV
- 知识库（PDF/图片）注入 LLM
- Tektronix TekHSI 网口示波器（gRPC）
- 亮/暗双主题（默认亮）

### 1.2 明确不做

| 不做 | 原因 |
|---|---|
| 固件实现 | 固件不在本仓库；上位机与固件解耦 |
| Python 后端 | 串口协议已用纯 TS 重写 |
| Modbus/MCB 旧协议 | 已迁移到 AI-Motor v1 |
| 5kHz 波形帧 | 已改为 100Hz 快速遥测 |
| 桌面壳层（当前阶段） | 先把 Web 功能写齐，再封装 Electron |
| 真实硬件 CI | CI 用 mock；实板/实机单独验收 |

### 1.3 关键约束

| 约束 | 值/行为 |
|---|---|
| 浏览器 | Chrome/Edge（Web Serial 必需）；HTTPS 或 localhost |
| 串口 | 115200 8N1，无流控 |
| 转速上限 | ±6000 RPM（clamp） |
| 安全锁定参数 | 6/13/24/42/51/52，AI 禁止修改 |
| 命令确认 | 30s 超时自动取消 |
| 串口超时 | 5s 无数据判超时；ACK 实际 800ms × 2 重试 |
| TekHSI | 4/5/6 系 MSO，明文 gRPC `:5000`，仅模拟单帧 |
| 部署 | `next build && next start`，不能 `next export` |

---

## 2. 系统架构设计

### 2.1 系统上下文

```text
┌──────────────────────────────────────────────────────────────────┐
│ Browser (Chrome/Edge, localhost/HTTPS)                           │
│                                                                  │
│  Next.js Client Pages                                            │
│  /  /scope  /net-scope  /param-est  /control  /knowledge         │
│      │                                                           │
│      ├── Web Serial ──────────────► TI C2000 F280025C            │
│      │                               (AI-Motor v1, 115200 8N1)   │
│      │                                                           │
│      ├── localStorage / IndexedDB                                │
│      │                                                           │
│      └── same-origin HTTP                                        │
│             ├── POST /api/llm ─────► LLM upstream (SSE)          │
│             └── POST /api/tekhsi ──► gRPC :5000                  │
│                                      Tektronix TekHSI scope      │
└──────────────────────────────────────────────────────────────────┘

Next.js Node runtime（与浏览器同机运行）
  ├── /api/llm     保护/转发 LLM 请求，支持服务端 key
  └── /api/tekhsi  gRPC 客户端（浏览器不能直接开 TCP/gRPC）
```

**信任边界**

- 浏览器 → 下位机：Web Serial，受浏览器权限/用户手势限制。
- 浏览器 → Next Node：同源 HTTP；Node 路由可访问局域网设备。
- 浏览器 → LLM：只经 `/api/llm`；key 可能在浏览器 localStorage（设置面板）或服务端 `.env.local`。
- Node → 示波器：`/api/tekhsi` 可向用户输入的主机发 TCP；仅限本机/实验室网络。

### 2.2 分层架构

| 层 | 目录 | 职责 | 依赖规则 |
|---|---|---|---|
| L1 表现层 | `app/`、`components/` | 页面、布局、交互、SVG | 只经 store/bus/lib 取数；不直接开串口/gRPC |
| L2 应用状态 | `lib/stores/`、组件 hooks | zustand 状态、事件订阅、派生值 | 不 import 组件/UI |
| L3 领域逻辑 | `lib/serial/aimotor/`、`lib/llm/`、`lib/knowledge/`、`lib/tekhsi/` | 协议、参数、SSE、检索预算、gRPC | 纯逻辑尽量可单测；不碰 DOM |
| L4 基础设施 | `lib/bus.ts`、`lib/settings.ts`、`lib/types.ts`、`lib/config.ts` | 事件总线、设置、类型、常量、持久化 | 不依赖 UI |
| L5 运行时 | `app/api/*`、`next start` | LLM 代理、TekHSI gRPC 代理 | 仅 Node runtime；不打包进浏览器 |

**依赖方向**

```text
components → stores/hooks → lib 领域/基础设施
     │                         │
     └──── bus 事件 ←──────────┘
app/api → lib（server-only）
```

禁止反向依赖：

- `lib/` 不 import `components/` 或 `app/`。
- `stores/` 不 import React 组件。
- `components/` 不直接 `navigator.serial`、不直接 `@grpc/grpc-js`。
- 客户端组件不 import `lib/tekhsi/client.ts`（server-only）。

### 2.3 模块边界

| 领域 | 拥有 | 对外接口 | 不得越界 |
|---|---|---|---|
| Chat/LLM | 消息、工具调用、确认卡、会话 | `llmClient.sendMessage`、`llmBus`、`sessionStore` | 不直接写串口帧 |
| AI-Motor 串口 | 帧/CRC/参数/连接/心跳/遥测 | `controller.connect/sendCommand/sendManualParam`、`aiMotorBus` | UI 不直接 `navigator.serial` |
| 串口示波器 | 100Hz 缓冲、通道 view、HEX | `scopeStore`、`ScopeChart` | 不处理 LLM/知识库 |
| 参数辨识 | mode7 配置/阶段/结果 | `param-est/` + controller | 不复用 AI 锁逻辑 |
| 手动控制 | 30 参数/波形/CSV/日志 | `control/` + controller | 不改协议层常量 |
| 知识库 | IndexedDB、PDF/图片、预算 | `knowledgeStore`、`buildKnowledgePayload` | 不把大文本塞进会话消息 |
| TekHSI | proto/gRPC/解码/CSV | `/api/tekhsi`、`lib/tekhsi/*` | 不混入 `scopeStore` |
| 设置/主题 | localStorage、供应商、主题 token | `useSettingsStore`、`setTheme` | 组件不直接读 localStorage 作为响应式源 |

### 2.4 运行时与部署

```text
开发：npm run dev                → http://localhost:3000
E2E：npx playwright test         → 自动 next dev -p 3100
生产：npm run build && npm start  → 保留 /api/llm、/api/tekhsi
```

- 页面全部 `'use client'`；服务端只有两个 Node 路由。
- `next.config.mjs` 用 `serverExternalPackages` 排除 gRPC，避免浏览器 bundle。
- 不能 `next export`：两个 API 路由需要 Node。
- Electron 路线：
  - A（推荐）：内置 `next start`，窗口加载 localhost。
  - B：静态导出，但 `/api/llm`、`/api/tekhsi` 搬进主进程。
  - 串口：未来提取 `SerialAdapter`，再替换 Web Serial I/O；UI/store 不依赖具体实现。

### 2.5 事件与状态架构

**事件总线（`lib/bus.ts`）**

| Bus | 生产者 | 消费者 | 事件 |
|---|---|---|---|
| `aiMotorBus` | `lib/serial/aimotor/controller.ts` | ChatApp/ScopeApp/ParamEstApp/ControlApp/ChatPane | status/sample/model/config/ack/error/closed/executed |
| `llmBus` | `lib/llm/llmClient.ts` | ChatApp | text/tool_call/turn_end/error/interrupted |
| `hexBus` | controller 原始字节 | ScopeApp → HexView | `Uint8Array` |

**Stores**

| Store | 拥有 | 持久化 |
|---|---|---|
| `sessionStore` | 会话、消息、systemPrompt、kbIds、inflight | `mototune.sessions` / `.order` |
| `motorStore` | 连接、mode/stage、sample/model/config、历史 | 无 |
| `commandLockStore` | idle→pending→executing | 无 |
| `scopeStore` | 6 通道 buffer/view、HEX | `scope.channels` + `scope.schemaVersion` |
| `knowledgeStore` | 库/文件/当前库 | IndexedDB `mototune.knowledge` |

**关键不变量**

1. 串口 HELLO 成功前禁止 ENABLE。
2. 单命令在途；同 seq 重试；STOP 优先。
3. AI 只能改允许参数；6/13/24/42/51/52 永久锁定。
4. 人工改安全参数必须二次确认。
5. 转速 ±6000 RPM。
6. tool_call（除 `get_status`）必须确认；30s 超时解锁。
7. LLM 每轮**无条件**发 `turn_end`。
8. 空 content 的 text 不新建消息。
9. 设置唯一响应式源是 `useSettingsStore`。
10. TekHSI 时序：Connect → AvailableNames → WaitForDataAccess → GetHeader/GetWaveform → Finished。
11. TekHSI 数据不写入 AI-Motor `scopeStore`。
12. 知识库大文本/图片不写入会话消息。

### 2.6 数据架构

| 数据 | 存储 | 生命周期 |
|---|---|---|
| 会话/消息/提示词/kbIds | localStorage | 持久；删除会话即删 |
| 设置/主题/供应商/模型 | localStorage | 持久 |
| 示波器通道 view | localStorage | 持久（schema v4） |
| 知识库文件 | IndexedDB `mototune.knowledge` | 持久；删除库/文件即删 |
| 串口样本 | `scopeStore` Float32Array | 内存；断开重置 |
| 参数辨识结果 | `motorStore.model` | 内存；来自 MODEL 帧 |
| TekHSI 采集结果 | 组件本地 state | 内存；重新采集覆盖 |
| 报告 | 浏览器下载 HTML | 临时文件 |

### 2.7 安全架构

| 层 | 机制 |
|---|---|
| LLM key | 设置面板存 localStorage；或服务端 `.env.local`；不写进代码/仓库 |
| 指令 | tool_call → ConfirmCard → 30s 超时（`get_status` 免确认） |
| AI 参数 | 安全锁 + 范围校验；人工走 `sendManualParam` |
| 串口 | HELLO/心跳/MCU 500ms 看门狗/STOP 优先 |
| 电机 | 6000 RPM clamp；急停 |
| 网口 | host 校验；仅实验室；不要公网暴露（SSRF） |
| Git | `.env.local`、`.next`、测试产物不入库 |

### 2.8 可测试性架构

| 层 | 测试方式 |
|---|---|
| 纯逻辑（protocol/params/decode/context/stores） | Vitest 单测，jsdom/node |
| 浏览器 UI/交互 | Playwright + mock LLM/API |
| Web Serial | `e2e/mockAiMotorSerial.ts` 注入 fake `navigator.serial` |
| TekHSI | fake gRPC server + 真实 `/api/tekhsi`；UI 用 `page.route` |
| 知识库 | 真实 IndexedDB + 内存文件 |
| 实板/实机 | 人工验收清单，不能由 mock 替代 |

### 2.9 关键架构决策（ADR）

| # | 决策 | 理由/后果 |
|---|---|---|
| ADR-01 | 先 Web，后 Electron | 当前只做 Next.js；壳层后加 |
| ADR-02 | 删除 Python 后端，纯 TS 串口 | 浏览器 Web Serial 直连；无 pyserial/numpy |
| ADR-03 | AI-Motor v1 替换 Modbus | 帧/CRC/参数/遥测统一；需固件对齐 |
| ADR-04 | LLM 同源代理 | 绕 CORS、支持服务端 key；页面不直连上游 |
| ADR-05 | TekHSI 走 Node gRPC 代理 | 浏览器不能开 TCP/gRPC；proto 在仓库内 |
| ADR-06 | 页面客户端渲染 + 两个 Node 路由 | 便于 Electron 方案 A；不能静态导出 |
| ADR-07 | `--cx-*` 双主题 token | 全站亮/暗切换；禁止旧深蓝/青 |
| ADR-08 | bus + zustand，而非 prop drilling | 串口/LLM 事件跨页共享 |
| ADR-09 | 硬件全部 mock 进 CI | 稳定、可重复；实机另验收 |
| ADR-10 | 文档分层 | HANDOVER 功能 / CODE_STRUCTURE 文件 / 本文架构流程 |

---

## 3. 作业流程

### 3.1 分支模型

| 分支 | 用途 |
|---|---|
| `main` / `arm64` | Electron 桌面版（独立演进） |
| `web` | Next.js 重构基线 |
| `feature/aimotor-v1` | AI-Motor/控制/主题/TekHSI 功能集成 |
| `docs/*` | 文档/规范；本文所在分支 |
| `feat/*` / `fix/*` / `chore/*` | 新功能/修复/杂项 |

规则：

- 新功能从当前集成分支切出，完成后 PR。
- 不直接往 `main` 推。
- 文档/实验可单独分支，避免污染功能分支。
- 共享分支禁止 force push（除非明确批准）。

### 3.2 标准功能流程（7 步）

```text
0. 阅读/侦察（只读）
   ↓
1. 提案（逻辑、文件、测试、风险）
   ↓
2. 等待明确批准
   ↓
3. 实现（严格 scope lock）
   ↓
4. 验证（tsc + unit + e2e + build）
   ↓
5. 汇报证据
   ↓
6. 提交 / push / PR
```

#### 0）阅读/侦察

至少读：

- `AGENTS.md`
- 对应域：`lib/AGENTS.md` 或 `components/AGENTS.md`
- `docs/HANDOVER.md`、`docs/CODE_STRUCTURE.md`
- 协议：`docs/aimotor_protocol.md` / `docs/tekhsi.md`
- `docs/TESTING.md`
- 现有同类实现与测试

只读命令：`git status`、`git log`、`rg`、`sed`、跑测试（不改文件）。

#### 1）提案模板

```markdown
## 功能提案：<一句话>

**需求原文**：<复述，不改意思>

**模块归属**：<页面/组件/lib/协议/测试>

**逻辑**：
1. ...
2. ...

**改动文件**：
- ...

**测试**：
- 单测：...
- E2E：...
- 手工/实机：...

**风险/兼容**：...

**不做**：...
```

#### 2）批准

只有用户明确说“批准 / 可以 / 继续 / 开始 / OK / go”才算批准。沉默、模糊同意不算。

#### 3）实现

- 只改提案列出的文件。
- 不顺手重构、不换风格、不加依赖（除非提案批准）。
- 发现必须动其它模块 → 停止，出《干涉报告》，重新批准。

#### 4）验证

```bash
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run build
```

**注意**：不要并行跑 `next build` 和 Playwright；两者会争 `.next`，造成假失败。按顺序跑，必要时 `rm -rf .next`。

#### 5）汇报

必须给证据：改了什么、测试命令、通过数量、构建结果、未验证项（尤其实板/实机）。

#### 6）提交

- 原子提交；一个提交只做一件事。
- 提交信息：`feat/fix/docs/chore(scope): 摘要`。
- 只 stage 目标文件；提交前 `git status`。
- 不提交 `.env.local`、`.next`、`test-results`、密钥。

### 3.3 Bugfix 流程

```text
复现 → 定位模块 → 写失败回归测试 → 最小修复 → 全量验证 → 汇报
```

- 禁止“先改再猜”。
- 禁止顺手重构。
- 硬件相关：mock 复现 + 实板复测。
- 修复后保留回归测试，不删除/skip 失败用例。

### 3.4 协议变更流程

1. 改 `docs/aimotor_protocol.md` 或 `docs/tekhsi.md`（先定语义）。
2. 改 `lib/serial/aimotor/protocol.ts` / `params.ts` 或 `lib/tekhsi/*`。
3. 同步 `e2e/mockAiMotorSerial.ts` 或 fake gRPC server。
4. 更新单测/E2E。
5. 更新 controller/store/UI。
6. 与固件 `host_parameters.inc` / 示波器 proto 对齐。
7. 实板/实机验收。

### 3.5 UI/主题变更流程

- 先读 `docs/DESIGN.md`。
- 只用 `--cx-*` / Tailwind 语义 token；禁止旧深蓝/旧青。
- 亮/暗两套都检查。
- 中/英文案同步（`lib/i18n.ts`）。
- 保留/新增 `data-testid`，更新 E2E 选择器。
- 无 emoji 图标，用内联 SVG/unicode。
- 检查侧栏折叠态/展开态。

### 3.6 硬件验收流程

**AI-Motor**

- [ ] 115200 连接 + 设备名。
- [ ] 100Hz 遥测持续刷新。
- [ ] HELLO/心跳/ACK 重试/5s 超时。
- [ ] mode6/8 启停/调速；STOP 优先。
- [ ] mode7 辨识与结果。
- [ ] 安全参数 AI 拒绝；人工二次确认。
- [ ] 参数表与固件一致。

**TekHSI**

- [ ] 4/5/6 系 MSO + TekHSI 开启。
- [ ] `:5000` 可达。
- [ ] 通道名/波形/触发/单位正确。
- [ ] 连续采集/断开不泄漏。
- [ ] CSV 正确。

> 浏览器 mock 通过 ≠ 实机通过。验收记录要写设备型号/IP/固件版本。

### 3.7 文档流程

| 变更 | 更新 |
|---|---|
| 新功能/流程 | `docs/HANDOVER.md` |
| 新文件/目录/导出 | `docs/CODE_STRUCTURE.md` |
| 测试用例/验收 | `docs/TESTING.md` |
| 串口协议/参数 | `docs/aimotor_protocol.md` |
| TekHSI | `docs/tekhsi.md` |
| 架构/流程/Agent 规范 | 本文 |
| 目录树/架构 | `AGENTS.md`、`lib/AGENTS.md`、`components/AGENTS.md` |

### 3.8 发布/构建流程

```bash
npm install
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run build
npm start
```

- 必须 `next start`；不能 `next export`。
- 生产环境可保留 `.env.local` 作为服务端 LLM 配置。
- 发布前确认 `/api/llm`、`/api/tekhsi` 都在。
- 版本/分支/提交记录写入发布说明。

### 3.9 回滚/事故流程

1. 先 STOP/EStop，断开设备。
2. 保留日志/截图/参数快照。
3. 回滚代码：`git revert` 优先；共享分支不用 `reset --hard`/force push。
4. 复现 + 回归测试。
5. 重新验收。

### 3.10 Git 约定

- 分支：`feat/<topic>`、`fix/<topic>`、`docs/<topic>`、`chore/<topic>`。
- 提交：`feat(scope): ...`、`fix(scope): ...`、`docs: ...`。
- 一个提交一个主题；不混入格式化/无关改动。
- push 前：`git status`、`git diff --check`、测试通过。
- 新分支首次 push：`git push -u origin <branch>`。
- 不提交密钥/本地配置/构建产物。
- 不擅自 force push 共享分支。

---

## 4. Agent 开发要领

### 4.1 铁律（Hard Rules）

| # | 规则 | 含义 |
|---|---|---|
| H1 | 无批准不落笔 | 用户明确批准前，禁止 edit/write/删除/改配置 |
| H2 | 先讲逻辑再写 | 功能/bug 先提案，讲清逻辑，等批准 |
| H3 | 模块隔离 | 一次只改“拥有该职责”的模块 |
| H4 | 功能必有测试 | 没有对应测试不算完成 |
| H5 | 干涉先报告 | 牵动其它模块先出《干涉报告》 |
| H6 | 不破基线 | 不删除/skip 失败测试来“变绿” |
| H7 | 安全约束 | 6000 RPM、115200、AI 锁、key 不入代码 |
| H8 | 只读先行 | 不读代码不臆测；先侦察 |

违反 H1/H5 是最严重错误。

### 4.2 开工前阅读顺序

1. `AGENTS.md`
2. `lib/AGENTS.md` 或 `components/AGENTS.md`
3. `docs/HANDOVER.md` / `docs/CODE_STRUCTURE.md`
4. 协议文档（按需）
5. `docs/TESTING.md`
6. 现有实现 + 现有测试
7. 相关 `git log`

侦察命令：

```bash
git status && git branch --show-current
git log --oneline -10
rg -n "<关键字>" lib components app unit e2e
npx vitest run unit/<相关>.spec.ts
```

### 4.3 提案与干涉报告

**提案**：见 3.2 模板，必须包含需求原文、模块归属、逻辑、文件、测试、风险、不做。

**干涉报告模板**：

```markdown
## 干涉报告

**原任务**：...
**发现**：完成 A 需要改 B 的 <文件/接口/行为>
**影响**：...
**建议**：...
**需要批准的文件**：...
```

未批准前不得改 B。

### 4.4 实现阶段规范

- **Scope lock**：只改提案文件；多改一个 = 违反 H5。
- **最小 diff**：不重构、不美化、不顺手优化。
- **沿用模式**：命名/目录/store/bus/样式 token 跟现有代码一致。
- **不新增依赖**：除非提案批准。
- **不留垃圾**：无 `console.log`、注释死代码、TODO 占位。
- **类型安全**：避免 `any`/`@ts-ignore`/`@ts-expect-error`。
- **错误处理**：硬件/网络错误要可读；UI 有错误态。
- **i18n**：中文/英文同步。
- **测试选择器**：新增/修改 `data-testid` 要更新 E2E。

### 4.5 代码规范

| 领域 | 规范 |
|---|---|
| TypeScript | `strict`；`@/` 别名；避免 `any` |
| React | 页面/组件 `'use client'`；组件只经 store/bus 取数 |
| 串口 | 只经 `lib/serial/aimotor/controller.ts` |
| TekHSI | `lib/tekhsi/client.ts` 仅 server；客户端只用 types/csv/decode |
| 样式 | `--cx-*` / Tailwind 语义 token；不 `@apply` 自定义颜色 |
| 主题 | 默认亮；亮/暗都要检查；首屏脚本防闪烁 |
| 图标 | 内联 SVG/unicode；无 emoji |
| 文案 | 中文界面；i18n 字典 zh/en 同步 |
| 注释 | 简洁中文；解释“为什么”，不复述代码 |
| 测试 | 纯逻辑 unit；UI/transport e2e；硬件 mock |

### 4.6 测试策略

| 改动 | 必跑 |
|---|---|
| 帧/CRC/解码 | `unit/aimotorProtocol.spec.ts` |
| 参数/安全锁 | `unit/aimotorParams.spec.ts`、`unit/aimotorControl.spec.ts` |
| 握手/重试/超时 | `e2e/serial-recovery.spec.ts`、`e2e/serial-scope.spec.ts` |
| 串口 UI/遥测 | `e2e/serial-scope.spec.ts` |
| LLM SSE/tool | `unit/llmClient.spec.ts`、`e2e/chat.spec.ts`、`e2e/tool-call.spec.ts` |
| store | 对应 `unit/*Store.spec.ts` |
| 知识库 | `unit/knowledge*`、`e2e/knowledge*` |
| TekHSI 解码/时序 | `unit/tekhsiDecode.spec.ts`、`unit/tekhsiClient.spec.ts` |
| TekHSI 路由 | `e2e/tekhsi-api.spec.ts` |
| TekHSI UI | `e2e/net-scope.spec.ts` |
| 设置/主题 | `unit/settings.spec.ts`、`e2e/app.spec.ts`、`e2e/settings-search.spec.ts` |
| 布局 | 对应 E2E + 亮/暗检查 |

规则：

- 先写/改测试，再改实现（bugfix 尤其）。
- 不删除/skip 失败测试。
- mock 不能替代实板/实机验收。
- 报告要写命令和通过数。

### 4.7 安全规范

- AI 禁止改 6/13/24/42/51/52。
- 人工改安全参数必须 `confirm()`。
- 转速 ±6000 RPM，不得绕过。
- key 只放设置面板 localStorage 或 `.env.local`；不写进代码/日志/提交。
- `.env.local` 已被 `.gitignore` 忽略；`.env.example` 只放占位符。
- TekHSI 的 host/port 校验；不要公网暴露 `/api/tekhsi`。
- 发生异常先 STOP/EStop，再排查。

### 4.8 Git 规范

- 新功能/修复/文档用独立分支。
- 提交前 `git status`、`git diff --check`。
- 只 stage 目标文件。
- 不提交 `.env.local`、`.next`、`test-results`、`node_modules`。
- 提交信息用 `feat/fix/docs/chore(scope): 摘要`。
- 用户未明确要求不要 push；要求 push 时用 `git push -u origin <branch>`。
- 不擅自 force push/改写历史。

### 4.9 常见坑

| 坑 | 现象/处理 |
|---|---|
| `.next` 竞争 | build 与 Playwright 并行 → 假失败；顺序执行，必要时 `rm -rf .next` |
| Next dev reload | 访问 `/api/llm` 偶发 500/ENOENT；重启 dev，稳定阶段用 build+start |
| Web Serial | 必须用户手势；刷新需重新授权；仅 Chromium |
| ACK 重试 | 文档写 300ms×2，实际 `controller.ts` 是 800ms×2；以代码为准 |
| `turn_end` | 每轮必须发，即使只有 tool_call，否则 inflight 锁死 |
| 空消息 | 空 content text 不新建气泡 |
| 设置不刷新 | 组件订阅 `useSettingsStore`，不要直接读 localStorage |
| 旧配色 | 不要硬编码 `#0a1628/#00a8ff/#2bb8a8` |
| 报告配色 | `lib/report.ts` 仍是旧深色，后续统一 |
| TekHSI | 仅模拟单帧/明文 :5000；数字/IQ/FastFrame 未实现 |
| 调参文档 | `docs/ai_tuning_log.md` 仍是旧 Modbus，不要照此调参 |
| `scopeStore` 旧字段 | `ports/cfg/status` 是历史字段，不要基于它扩展 |
| `.env.example` | 已入库但只有占位符；`.env.local` 才是真实配置 |

### 4.10 Agent 交付清单

**开工前**

- [ ] 读 AGENTS + 对应域 + 相关文档
- [ ] `git status` 干净/确认当前分支
- [ ] 找到现有同类实现和测试
- [ ] 提案 + 明确批准

**实现中**

- [ ] 只改提案文件
- [ ] 沿用现有模式
- [ ] 不新增依赖/不顺手重构
- [ ] 错误处理/i18n/testid 同步

**交付前**

- [ ] `tsc --noEmit` 0
- [ ] `test:unit` 通过
- [ ] `test:e2e` 通过
- [ ] `build` 通过
- [ ] `git diff --check`
- [ ] 未提交密钥/本地配置/构建产物
- [ ] 汇报：改动、测试、未验证项

### 4.11 给 Agent 的任务单模板

```markdown
## 任务
<目标>

## 范围
- 允许改：...
- 不允许改：...

## 验收
- 行为：...
- 测试：...
- 文档：...

## 约束
- 遵守 ai-coding-guard：先提案，批准后实现
- 分支：...
- 是否 push：是/否
```

---

## 5. 附录

### 5.1 常用命令

```bash
# 开发/构建
npm install
npm run dev
npm run build && npm start

# 类型/单测/E2E/全量
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run test:all

# 单文件
npx vitest run unit/aimotorProtocol.spec.ts
npx playwright test e2e/control.spec.ts -g "波形"

# Git
git status
git diff --check
git checkout -b docs/<topic>
git push -u origin docs/<topic>
```

### 5.2 页面/路由速查

| 路径 | 组件 | 说明 |
|---|---|---|
| `/` | `ChatApp` | 聊天/LLM/串口连接 |
| `/scope` | `ScopeApp` | 100Hz 串口示波器 |
| `/net-scope` | `NetScopeApp` | TekHSI 网口示波器 |
| `/param-est` | `ParamEstApp` | mode7 辨识 |
| `/control` | `ControlApp` | 手动控制/参数/波形/CSV |
| `/knowledge` | `KnowledgeApp` | 知识库 |
| `/api/llm` | Node | LLM 代理 |
| `/api/tekhsi` | Node | TekHSI gRPC 代理 |

### 5.3 Store/持久化速查

| key | 内容 |
|---|---|
| `mototune.sessions` / `.order` | 会话 |
| `mototune.settings` | 语言/主题/供应商/key/model |
| `scope.channels` / `scope.schemaVersion` | 示波器 view |
| `mototune.tekhsi.host` / `.port` | 网口示波器地址 |
| `mototune.knowledge`（IndexedDB） | 知识库/文件 |

### 5.4 安全锁定参数

`6` 强拖上限、`13` 闭环最大 Iq、`24` Iq 范围上限、`42` 辨识最大测试电流、`51` 参数组、`52` 自动应用。

### 5.5 文档地图

| 文档 | 用途 |
|---|---|
| `AGENTS.md` | 项目知识库/架构/约束 |
| `lib/AGENTS.md` | 逻辑域规范 |
| `components/AGENTS.md` | 组件域规范 |
| `docs/HANDOVER.md` | 按功能交接 |
| `docs/CODE_STRUCTURE.md` | 按文件结构 |
| `docs/aimotor_protocol.md` | AI-Motor v1 |
| `docs/tekhsi.md` | TekHSI |
| `docs/TESTING.md` | 测试 |
| `docs/DESIGN.md` | 主题/布局 |
| 本文 | 架构/流程/Agent |

### 5.6 术语

| 术语 | 含义 |
|---|---|
| AI-Motor v1 | 当前串口协议，115200 8N1，A5 5A 帧 |
| mode5/6/7/8 | 停止/速度环/辨识/Id 对齐启动 |
| TekHSI | Tektronix High-Speed Interface，gRPC :5000 |
| tool_call | LLM 请求调用电机工具 |
| command lock | 工具调用确认/执行锁 |
| scopeStore | 串口示波器 6 通道缓冲 |
| `--cx-*` | 亮/暗主题 CSS 变量 |
| DoD | Definition of Done，交付标准 |

---

> 维护：架构/流程/Agent 规范变更时更新本文；文件级变更同步 `docs/CODE_STRUCTURE.md`；功能/协议变更同步 `docs/HANDOVER.md` 与协议文档。
