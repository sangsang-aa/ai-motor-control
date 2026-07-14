# AGENTS.md — AI电驱控制系统

Electron 双窗口 + Python 串口子进程。

## 构建

```bash
npm install              # 首次
node build.mjs           # 构建 4 个入口: main + preload + 2 renderer
./run.sh                 # 一键启动（含依赖检查）
```

## 构建陷阱

- **不能用 `electron-vite`**：本机 rollup native binary segfault（`bus error`）。唯一构建方式：`node build.mjs`（纯 esbuild）。
- **`build.mjs` 是纯 JS 不是 TS**：不能有类型注解（`:string`）、`!` 非空断言——全部 SyntaxError。
- **双 renderer 入口**：`renderer.js`→主窗口、`motor.js`→监控窗口。`copyHtml()` 负责替换 HTML 中 script 引用路径。
- **`npx tailwindcss` 权限**：`node_modules/.bin/` 下 symlink 目标可能缺执行权限，需 `chmod +x`。
- **Tailwind `@apply` 不认自定义颜色**：`@apply bg-bg-input` 在 Tailwind v3 中失败。自定义颜色全用原始 CSS（`background:#0d1f35`），只用 `@apply` 标准 utility（`flex`、`text-sm`、`rounded-lg`）。

## 架构关键点

- **双窗口**：`index.ts` 创建主窗口 + `openMotorWindow()` 创建独立监控窗口。IPC 中 `motor:event` 广播到两个窗口。
- **pythonBridge** 构造函数接受 emit 回调函数（不直接持有 BrowserWindow），以便广播到多窗口。
- **config.ts 用 `yaml` 库的 `parse()`**——手写 YAML 解析器不剥 `#` 行内注释，会把 `150000  # 注释` 当成值传给 Python `--baud` 导致崩溃。
- **`SerialLink` 只有 `send_command(speed, motor_on)`**，没有 `send()`。`tools.py` 必须用 `link.send_command()`。

## 持久化与中断

- **防抖自动保存**：`sessionManager.touch()` 延迟 1s 写盘。前端 `sessionStore.saveToDisk()` 在每次消息变更后触发。
- **启动恢复**：`SessionManager.ensureDefault()` 文件为空时自动创建空白会话。
- **Ctrl+C 中断链路**：`App.tsx` keydown → `llm:interrupt` IPC → `llmProxy.abort()`（AbortController 取消 HTTP 流）+ `pythonBridge.interrupt()`（写 `{"type":"interrupt"}` 到 Python stdin）。
- **get_status 自动执行**：`App.tsx` 收到 `tool_call` 事件时直接 `sendCommand()`，不弹确认卡。

## IPC 新增通道（易漏）

| 通道 | 用途 |
|---|---|
| `motor:reconnect(port,baud)` | stop + start 后端换端口 |
| `motor:openWindow` / `:closeWindow` | 监控弹窗 |
| `llm:interrupt` | 中断 LLM |
| `llm:renameSession(id,title)` | 重命名 |
| `session:save(session)` | 持久化同步 |

`motor:event` 广播到主窗口和监控窗口；监控窗口关闭时 `index.ts` 发 `chart_closed` 事件。

## 组件约束

- **无 emoji**：系统无 emoji 字体。所有 emoji 已替换为 CSS 圆点/颜色/HTML 实体。
- **EStop 按钮** `bottom:90px`（高于 Composer 避免与发送按钮重叠）。
- **Tailwind 颜色全用原始 CSS**：`background:#00a8ff` 而非 `@apply bg-accent`。
- **`report` 按钮在 Sidebar** 不在 Topbar。Sidebar 还支持 hover 重命名（✎）和删除（✕）。

## 系统依赖

```bash
sudo apt install -y libnss3 libnspr4 libasound2   # ← 24.04+ 改名，不是 libasound2
sudo usermod -aG dialout $USER
```

## 测试

```bash
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py
python3 linux/tests/test_protocol.py
```

## 打包

```bash
./package.sh   # → ai_motor_control_portable_YYYYMMDD.tar.gz
```

压缩包含 `out/` 构建产物 + 源码 + Electron 运行时，不含 `node_modules`（需 `npm install` 后重建）。
