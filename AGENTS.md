# AI电驱控制系统 — AGENTS.md

Electron 双窗口桌面应用 (主窗口 + 独立监控窗口) + Python 串口子进程。

## 构建 & 运行

```bash
npm install                     # 安装依赖
./run.sh                        # 一键：检查依赖 → 构建 → 启动
# 或分步：
node build.mjs                  # 构建（四个入口：main + preload + 2 个 renderer）
./node_modules/electron/dist/electron .  # 启动
```

**`build.mjs` 是关键构建入口**。不使用 `electron-vite dev`——本机 rollup native binary segfault（`bus error`）。全部改用 esbuild bundle，Tailwind CSS 通过 `npx tailwindcss` CLI 编译。

## 架构

```
主窗口 (AI Motor Control)          监控窗口 (Motor Monitor) — 独立 BrowserWindow
├── Topbar [串口] [波特率] [连接]    ├── 状态栏
├── Sidebar ──电机监控──▶ 打开窗口    ├── ECharts 转速曲线
├── ChatPane + ConfirmCard           └── ECharts 电流曲线
└── Composer + EStop

src/main/index.ts     → 创建两个 BrowserWindow + 生命周期
src/main/ipc.ts       → IPC handlers + 广播 motor:event 到两个窗口
src/main/pythonBridge.ts → spawn Python 子进程 + stdin/stdout JSON Lines
                            构造函数接受 emit 回调（广播到多窗口），不直接持有 BrowserWindow
src/renderer/motor.html → 监控窗口入口
src/renderer/index.html → 主窗口入口
```

## 构建细节（Agent 必须知道）

- **两个 renderer 入口**：`renderer.js`（主窗口）+ `motor.js`（监控窗口）。`copyHtml()` 负责替换 HTML 中的 script 引用。
- **build.mjs 是纯 JS**（不是 TS）。`.mjs` 中不能有类型注解、`!` 非空断言——这些都会导致 SyntaxError。
- **Tailwind 不能用 `@apply` 引用自定义颜色**：`@apply bg-bg-input` 在 Tailwind v3 `@apply` 中不识别嵌套自定义颜色。全部用原始 CSS 属性代替 `@apply`，只对标准 utility class 用 `@apply`。
- **权限问题**：`tailwindcss`、`electron-vite` 等 `node_modules/.bin/` 下的 symlink 目标可能缺少执行权限，需 `chmod +x`。
- **需要 `libasound2t64`**（Ubuntu 24.04+ 改名），不是 `libasound2`。
- **`conc/` 目录**：报告输出目录，`python_backend/report.py` 会自动创建。

## IPC 通道

| 通道 | 方向 | 用途 |
|---|---|---|
| `motor:startBackend` | Invoke | 启动 Python 后端 |
| `motor:stopBackend` | Invoke | 停止后端 |
| `motor:reconnect(port,baud)` | Invoke | 用新端口/波特率重连 |
| `motor:sendCommand(action,payload)` | Invoke | 下发硬件指令 |
| `motor:requestStatus` | Invoke | 查询连接状态 |
| `motor:openWindow` | Invoke | 打开监控窗口 |
| `motor:event` | Event | 遥测/串口状态（广播到两个窗口） |
| `llm:sendMessage(text,history)` | Invoke | 发送 LLM 消息 |
| `llm:event` | Event | LLM 流式事件 |
| `llm:listSessions` / `:deleteSession` | Invoke | 会话管理 |
| `export:generateReport` | Invoke | 导出 HTML 报告 |

## Python 后端

```bash
# 子进程启动参数（从 motor_config.yaml 读取）
python3 python_backend/main.py --port /dev/ttyUSB0 --baud 150000 --rpm-limit 6000
```

JSON Lines over stdin/stdout。`pythonBridge.ts` 的 `sendCommand()` 用 `stdout.on('data')` 侦听响应——与 readline 接口可能存在竞争（readline 也消费 stdout），但通常先到先得。

**配置读取**：主进程 `config.ts` 用 `yaml` 库的 `parse()` 解析 YAML，**不要手写解析器**——手写版本不处理行内 `#` 注释，导致 `baud_rate` 值变成 `"150000          # 注释..."`。

`SerialLink` 只有 `send_command(speed, motor_on)` 方法，**没有 `send()`**。工具执行时必须调 `send_command()`。

## 组件约束

- **无 emoji**：系统没有 emoji 字体，所有 emoji 已替换为 CSS 样式（彩色圆点）或 HTML 实体（`&#9888;`）。
- **Tailwind 颜色全用原始 CSS**：`btn-primary { background:#00a8ff; }` 而非 `@apply bg-accent`。只有标准 utility（`flex`、`rounded-lg`、`text-sm`）用 `@apply`。
- **EStop 按钮位置**：`bottom:90px`（高于 Composer，不与发送按钮重叠）。
- **get_status 自动执行**：`App.tsx` 的 LLM 事件处理中，`get_status` 工具调 `sendCommand()` 直发，不弹确认卡。

## 测试

```bash
# Python 后端独立测试（无硬件）
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py

# 原 mcb_host 协议测试
python3 linux/tests/test_protocol.py
```

无前端测试套件——GUI 需要完整 Electron 环境启动才能验证。

## 系统依赖

```bash
sudo apt install -y libnss3 libnspr4 libasound2t64  # Ubuntu 24.04+
sudo usermod -aG dialout $USER                        # 串口权限
```

`config/llm_config.yaml` 需手动填入阿里云百炼 API Key。无 API Key 时 GUI 正常显示，LLM 对话报错。
