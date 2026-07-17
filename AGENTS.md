# AGENTS.md — MOTOTUNE

Electron 双窗口 + Python 多线程串口子进程。x86 (`main`) / ARM (`arm64`) 双分支。示波器来自 `motra/scope-standalone`。

## 构建

```bash
npm install              # 首次 / git pull 后
node build.mjs           # 4 入口: main + preload + renderer + motor
./run.sh                 # 一键
```

## 构建陷阱

- **不能用 `electron-vite`**：rollup segfault。`node build.mjs`（esbuild）。
- **`build.mjs` 是纯 JS**：不能有类型注解/`!` → SyntaxError。
- **Tailwind `@apply` 不认自定义颜色**：全部原始 CSS。
- **`package-lock.json` 损坏**：`Invalid Version` → `rm package-lock.json && npm install`。

## 架构关键点

- **手动连接**：`motor:connect`/`motor:disconnect`。连接后端口+波特率锁定。波特率纯 `<input>` 文本。
- **pythonBridge**：emit 回调广播两窗口。`motor:event` 是状态唯一事实源。
- **`SerialLink` 只有 `send_command()`**，没有 `send()`。
- **`llmProxy` 无条件发 `turn_end`**：即使 LLM 只返回 tool_call 也要发，否则 inflight 锁死。
- **pythonBridge.sendCommand 竞态**：listener 和 setTimeout 可能竞态调 `removeListener`，必须用 `resolved` 标志防重复。
- **Python 多线程**：串口线程 `get_nowait()` 循环排空所有帧 + 工具线程(Queue, 5s 超时) + 心跳 ping/pong。
- **config.ts 用 `yaml` 库**：手写解析器不剥 `#` 注释→崩溃。

## 示波器

- **数据流**：MotorWindow 订阅 `motor:event telemetry` → `seriesRpm/seriesIa` 交错 → `scopeStore.applyFrame()` → ScopeChart SVG。不使用 rpmHistory/currentHistory（截断导致不刷新）。
- **scopeStore.ts**：stub 类型替代 `@shared` 引用。核心：`applyFrame(payload,nChannels)`、`setChannelLabel()`。
- ChannelPanel/HexView/PauseToggle/HexToggle 从 motra 复制，inline 样式适配。

## CommandLock 链条

1. `tool_call` → `lock.lock()` → `setPendingToolCall()` → `notifyToolCall()`
2. ChatPane `useEffect([toolCallVersion])` → ConfirmCard
3. 确认 → `lock.setExecuting()` → `sendCommand` → `executed` → `lock.unlock()`

⚠️ **陷阱**：`setPendingToolCall` 必须先于消息变更（否则 ChatPane 检测不到）。`lock` 必须在 useEffect 依赖中。系统提示词："直接调用工具，不要先回复文字确认"。

**恢复**：30s 自动清零 inflight/lock + Composer 红色"取消"按钮手动恢复。

## 组件约束

- **无 emoji**。EStop `bottom:90px`。颜色全用原始 CSS。
- **Sidebar**：可拖拽(160-400px)，◀ 折叠 36px，工具栏分组。"新建会话"首条消息自动命名。
- **Topbar**：CSS 渐变 MOTOTUNE，端口/波特率前有标签。

## 双分支

```
ai_motor_control/       → GitHub main (x86, libasound2t64)
ai_motor_control_arm/   → GitHub arm64 (ARM, libasound2)
```

ARM 同步：`rsync -a --exclude='.git' --exclude='node_modules' --exclude='out' x86/ arm/` → `sed -i 's/libasound2t64/libasound2/g'`。

## Git

- `git pull` 覆盖未推送文件 → 检查+恢复+push
- ARM 差异仅 `package.json` arch + 库名 + 串口设备文档。

## 测试

```bash
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py
```
