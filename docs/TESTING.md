# TESTING — MOTOTUNE Web 版测试文档

本文件定义 MOTOTUNE Web 版(`web` 分支)的**回归测试基线**。后续**任何功能新增或修复,必须保证本文所有测试样例通过**,否则视为回归。

## 测试分层

| 层 | 工具 | 目录 | 覆盖 |
|---|---|---|---|
| 单元测试 | Vitest | `unit/` | AI-Motor 帧/CRC/参数校验、LLM SSE 解析、会话/示波器/命令锁 store、知识库(纯逻辑) |
| E2E 测试 | Playwright | `e2e/` | 页面渲染/交互、对话、tool calling、AI-Motor 串口/握手、100Hz 示波器、mode7 辨识 |

## 运行方式

```bash
npm install
npx playwright install chromium   # 首次(下载浏览器)

npm run test:unit        # 只跑单元测试 (vitest run unit/)
npm run test:e2e         # 只跑 E2E (playwright test)
npm run test:all         # 全部(单元 + E2E)
npm test                 # 单元测试
```

> E2E 通过 `playwright.config.ts` 的 `webServer` 自动启动 `next dev -p 3100`,无需手动开启服务。
> 测试结束会自动关闭。

## 测试样例与验收标准(对应需求 1–6)

### 1. 网页界面正常启动、渲染;按钮可正常按动(拖拽调整界面大小)

> Web 版"窗口"即浏览器窗口,系统级最小化/放大由浏览器负责。应用内可交互元素(按钮、拖拽手柄)由 E2E 验证。

**文件**: `e2e/app.spec.ts`

| 用例 | 验收标准 |
|---|---|
| 页面正常启动并渲染核心元素 | `/` 渲染 Topbar/侧栏/品牌图/Composer/欢迎语 |
| Topbar 交互 | 波特率输入可编辑;连接按钮可点 |
| 侧栏折叠/展开 | 点击折叠/展开按钮切换 |
| 侧栏固定窄宽 | 侧栏宽度 230–250px(无拖拽) |
| 新建会话 | 点击后会话列表出现新会话 |
| 示波器页渲染 | `/scope` 页面正常加载 |
| Codex 外壳渲染 | `/` 根节点 `data-ui="codex"`,body 底色 `#0a0a0a` |
| Codex 外壳覆盖 | `/scope`、`/knowledge` 根节点 `data-ui="codex"` |

### 2. 主页面对话无卡死、无错误回答

**文件**: `e2e/chat.spec.ts`(LLM 用 `page.route` mock,不调真实 API)

| 用例 | 验收标准 |
|---|---|
| 正常流式回复 | 发送消息后出现流式气泡,最终含完整回复;无 `⚠` error 气泡;无 loading 卡死(think-dots 消失) |
| 错误处理 | LLM 返回 500 时显示错误文案,而非伪造成功 |
| 顶栏状态 | telemetry 驱动顶栏转速/电流显示 |

### 3. tool 正常 calling

**文件**: `e2e/tool-call.spec.ts`(mock LLM 返回纯 `tool_call`)

| 用例 | 验收标准 |
|---|---|
| tool_call → 确认卡 | 出现 ConfirmCard,显示"设置转速: X RPM";点忽略后卡片消失、lock 解除 |
| 确认后写串口 | 注入 `fakeAiMotorSerial`,点确认后收到 `SET_PARAM(mode6, param1, 3000)`;结果气泡 `OK rpm=3000` |
| 启动/安全锁 | `set_motor_state(true)` → `SET_MODE + ENABLE`;`set_param(24,10)` 被安全锁拒绝且不下发 |

### 4. 串口能正常识别

**文件**: `e2e/serial-scope.spec.ts`(`fakeAiMotorSerial`)

| 用例 | 验收标准 |
|---|---|
| 连接识别 | 点击"连接串口"后顶栏显示"已连接"+ 设备名(`USB:0451:BEF3`);open 选项 115200/8N1 |
| telemetry 更新 | 连接后 100Hz SAMPLE → 转速/电流非零 |

### 4.1 串口可靠性与自愈(补充基线)

**文件**: `e2e/serial-recovery.spec.ts`(`fakeAiMotorSerial`,不碰真实硬件)

| 用例 | 验收标准 |
|---|---|
| 首个 ACK 丢失自动重试 | `dropFirstAck` → 同 seq 重发,不误报断线 |
| HELLO 连续无响应 | 握手失败提示,释放 reader,可重新连接 |

### 5. 示波器接收串口数据、模拟数据输入、输出正常波形

**文件**: `e2e/serial-scope.spec.ts` + `e2e/mockAiMotorSerial.ts`
`mockAiMotorSerial.ts` 把 `navigator.serial` 模拟为 **AI-Motor v1 从站**:HELLO 后每 10ms 发 `SAMPLE`、每 100ms 发 `MODEL`,`SAMPLE` → `scopeStore.appendAiSample`(100Hz)→ SVG。

| 用例 | 验收标准 |
|---|---|
| 波形渲染 | 聊天页连接串口后客户端导航到 `/scope`,SVG 出现波形 `path`(网格是 line,波形是 path);通道标签 `Speed (RPM)` 可见 |
| 暂停逻辑 | 点击暂停切换到"继续",暂停时不刷新缓冲 |

### 6. 对话能正常记录

**文件**: `e2e/chat.spec.ts`(测试点 2 同文件)、`unit/sessionStore.spec.ts`

| 用例 | 验收标准 |
|---|---|
| localStorage 持久化 | 发送消息后 `localStorage['mototune.sessions']` 有记录,标题自动命名自首条消息 |
| 刷新恢复 | 刷新后侧栏仍保留该会话 |
| 会话 CRUD | 创建/删除/重命名/切换正确(单测) |
| 消息类型 | 流式追加/error/interrupted 正确落库(单测) |

### 7. PMSM 参数辨识(/param-est,mode7)

**文件**: `e2e/param-est.spec.ts`、`unit/{aimotorProtocol,aimotorParams,aimotorStore}.spec.ts`

| 用例 | 验收标准 |
|---|---|
| 侧栏入口 | 聊天侧栏 `/param-est` 可进入 |
| 连接 → 配置 → 启动 | 115200 连接;`SET_PARAM 40/41/42` → `SET_MODE 7` → `ENABLE` |
| 结果显示 | 已应用模型 Rs/Ld/Lq/Ls 显示 |
| 失败原因 | mode7 error → 显示「重复性不合格」 |
| 协议/参数单测 | 帧/CRC/解码、参数范围/安全锁、store 映射 |

## Mock 方案(测试不依赖真实硬件/真实 LLM)

- **LLM**:Playwright `page.route('**/api/llm')` 拦截,返回固定 SSE 流(text / tool_call / error)。见 `e2e/chat.spec.ts`、`e2e/tool-call.spec.ts`。
- **串口**:`e2e/mockAiMotorSerial.ts` 的 `fakeAiMotorSerial()` 注入 fake `navigator.serial`(AI-Motor v1 从站):
  - 解析 `0x01` 命令,回 `0x81 ACK`(HEARTBEAT 不回)
  - HELLO 后每 10ms 发 `0x80` 遥测、每 100ms 发 `0x82` 模型;`GET_CONFIG` 回 `0x83`
  - 写入记录到 `window.__aiWrites`,`decodeAiCommands()` 供断言
  - 选项:`dropFirstAck`(首包丢失)、`noHelloAckCount`(握手失败)、`silent`、`mode7Error`
- **协议层**:单测 `lib/serial/aimotor/{protocol,params}.ts`(CRC/帧/解码/参数校验),与 `docs/aimotor_protocol.md` 对齐。

## 关键约定(防止回归)

- `set_speed` → `SET_PARAM(mode 6/8, param 1)`;`set_motor_state(true)` → `SET_MODE + ENABLE`;`emergency_stop` → `STOP`
- `set_mode` 仅 5/6/7/8;`set_param` 走允许参数表,AI 锁定 6/13/24/42/51/52
- 转速上限 6000 RPM;HELLO 后才允许 ENABLE;5s 无数据判超时
- LLM 无条件发 `turn_end`(即使只有 tool_call,否则 inflight 锁死)
- 单测中 `createSession` 生成唯一 id(计数器),避免同毫秒撞 id
- `scopeStore.applyFrame` 在 buffer 数与通道数不匹配时重建并继续(不丢首帧)

## CI 建议(可选)

在 GitHub Action 里加:checkout → `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:all`。任何 push/PR 触发,保证功能不回归。
