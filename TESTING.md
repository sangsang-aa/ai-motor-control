# TESTING — MOTOTUNE Web 版测试文档

本文件定义 MOTOTUNE Web 版(`web` 分支)的**回归测试基线**。后续**任何功能新增或修复,必须保证本文所有测试样例通过**,否则视为回归。

## 测试分层

| 层 | 工具 | 目录 | 覆盖 |
|---|---|---|---|
| 单元测试 | Vitest | `unit/` | 协议层、LLM SSE 解析、会话 store、示波器 store(纯逻辑,不依赖浏览器) |
| E2E 测试 | Playwright | `e2e/` | 页面渲染/交互、对话、tool calling、串口识别、示波器波形(真实 Chromium) |

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
| 页面正常启动并渲染 | `/` 渲染 Topbar/侧栏/Composer/欢迎语;`/scope` 渲染示波器头/连接状态 |
| 按钮可点击 | Topbar 连接按钮可点、波特率输入可编辑 |
| 侧栏折叠/展开 | 点击 ◀ 收起、☰ 展开 |
| 侧栏拖拽调整宽度 | 拖拽手柄后侧栏宽度变化 |
| 新建会话 | 点击后会话列表出现新会话 |
| 示波器页渲染 | `/scope` 页面正常加载 |

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
| 确认后写串口 | 注入 fake serial,点确认后串口收到 `set_speed(3000,on=1)` 编码字节 `[b8,0b,01,00]`;结果气泡 `OK rpm=3000 on=1` |

### 4. 串口能正常识别

**文件**: `e2e/serial-scope.spec.ts`(fake `navigator.serial`)

| 用例 | 验收标准 |
|---|---|
| 连接识别 | 点击"连接串口"后顶栏显示"已连接"+ 设备名(`USB:2345:6789`) |
| telemetry 更新 | 连接后转速非零(收到帧) |

### 5. 示波器接收串口数据、模拟数据输入、输出正常波形

**文件**: `e2e/serial-scope.spec.ts` + `e2e/mockSerial.ts`
`mockSerial.ts` 把 `navigator.serial` 模拟为 **Modbus RTU 从站**(内置 `ACTUAL_SPEED=2000`、`ACTUAL_CURRENT=3.0` 的 float32 寄存器),上位机每 50ms 轮询 `0x03` 读遥测 → telemetry → scopeStore → SVG。

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

## Mock 方案(测试不依赖真实硬件/真实 LLM)

- **LLM**:Playwright `page.route('**/api/llm')` 拦截,返回固定 SSE 流(text / tool_call / error)。见 `e2e/chat.spec.ts`、`e2e/tool-call.spec.ts`。
- **串口**:`e2e/mockSerial.ts` 的 `fakeSerialInitScript()` 注入 fake `navigator.serial`(用 `Object.defineProperty` 覆盖 Chromium 只读 getter)。fake 端口模拟 **Modbus 从站**(处理功能码 `01/03/05/06/10`,内含 CRC 校验),收到写入请求即生成对应响应:
  - `writable` 把请求字节记录到 `window.__sfWrites`(供断言 `sendCommand` 的 Modbus 帧)
  - `readable` 收到请求后 enqueue 响应(供轮询 `0x03` 读遥测)
  - `getInfo()` 返回 `usbVendorId:0x2345, usbProductId:0x6789`(用于设备名断言)
- **协议层**:单测直接测 `lib/serial/modbus.ts`(CRC16、帧构建/解析、float32 编解码),与 `docs/modbus_rtu_protocol.md` 对齐。

## 关键约定(防止回归)

- `set_speed` → 写 `SPEED_SETPOINT` 保持寄存器(0x06/0x10);结果文本 `OK rpm=<rpm>`
- `set_motor_state` → 写 `COIL_MOTOR_EN`(0x05);`emergency_stop` → 写 `COIL_EMERGENCY_STOP`
- PID 参数(`write_pid_<REG>`)→ 写保持寄存器(float32,2 寄存器,big-endian)
- LLM 无条件发 `turn_end`(即使只有 tool_call,否则 inflight 锁死)
- 单测中 `createSession` 生成唯一 id(计数器),避免同毫秒撞 id
- `scopeStore.applyFrame` 在 buffer 数与通道数不匹配时重建并继续(不丢首帧)

## CI 建议(可选)

在 GitHub Action 里加:checkout → `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:all`。任何 push/PR 触发,保证功能不回归。
