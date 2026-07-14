# AGENTS.md — AI电驱控制系统

Electron 双窗口 + Python 多线程串口子进程。x86 (`main`) 与 ARM (`arm64`) 双分支。

## 构建

```bash
npm install              # 首次 / git pull 后
node build.mjs           # 4 入口: main + preload + renderer + motor
./run.sh                 # 一键
```

## 构建陷阱

- **不能用 `electron-vite`**：rollup native binary segfault。唯一构建：`node build.mjs`（纯 esbuild）。
- **`build.mjs` 是纯 JS**：不能有类型注解、`!` 非空断言 → SyntaxError。
- **Tailwind `@apply` 不认自定义颜色**：全部用原始 CSS，只用 `@apply` 标准 utility。
- **`package-lock.json` 损坏**：`npm install` 报 `Invalid Version` → `rm package-lock.json && npm install`。

## 架构

- **手动连接**：启动后不自动连串口。`motor:connect` / `motor:disconnect` 用户触发。连接后端口+波特率锁定。
- **波特率是 `<input>` + `<datalist>`**，不是 `<select>`。
- **pythonBridge**：emit 回调广播到两窗口。`motor:event` 是串口状态的唯一事实源。
- **config.ts 用 `yaml` 库 `parse()`**：手写解析器不剥 `#` 注释→崩溃。
- **`SerialLink` 只有 `send_command()`**，没有 `send()`。
- **Python 后端多线程**：主线程 + 串口线程 + 工具线程(Queue, 5s 超时)。心跳 ping/pong。

## CommandLock + ConfirmCard 链条（易出 bug）

1. `App.tsx` 收到 `tool_call` → `lock.lock()` → `setPendingToolCall()` → `notifyToolCall()`（触发 ChatPane 重渲染）
2. ChatPane `useEffect([toolCallVersion])` → `consumePendingToolCall()` → `setPt()` → 渲染 ConfirmCard
3. 点击确认 → `lock.setExecuting()` → `sendCommand`
4. IPC 返回 `executed` → App.tsx `onBackendEvent` → `lock.unlock()`
5. 点击忽略 / 30s 超时 / 急停 → 直接 `lock.unlock()`

**⚠️ 关键陷阱**：
- `setPendingToolCall` **必须先于**任何会改变消息列表的操作（否则 ChatPane 检测时 tool call 还在队列外，ConfirmCard 不渲染）
- `lock` 必须在 `useEffect` 依赖数组中，否则 `executed` 事件处理中拿到的是过期闭包
- 系统提示词：`"直接调用工具，不要先回复文字确认"` — 避免 AI 先闲聊再调 tool 导致 Composer 被锁

## IPC 易漏项

| 通道 | 说明 |
|---|---|
| `motor:connect(port,baud)` | 替代 `startBackend`/`reconnect` |
| `motor:disconnect` | 替代 `stopBackend` |
| `motor:executed`(Event) | 释放 CommandLock |
| `llm:interrupt` | Ctrl+C → abort LLM |
| `session:save` | 持久化同步 |

## 组件约束

- **无 emoji**：全部 CSS/HTML 实体替代。
- **EStop** `bottom:90px`。
- **所有颜色用原始 CSS**：`background:#00a8ff`。
- **ChartWindow**：1000×700 独立窗口，右侧面板(通道复选框+量程输入+暂停)，`ChartPanel` 独立 ECharts 生命周期。

## 双分支

```
ai_motor_control/       → GitHub main (x86)
ai_motor_control_arm/   → GitHub arm64 (ARM, libasound2 不是 libasound2)
```

两分支源码相同，差异仅在 `package.json` arch + ARM 串口设备名文档。

## Git 注意

- **`git pull` 覆盖未推送的新文件**（`CommandLockBanner.tsx`、`commandLockStore.ts` 等）→ 检查 + 手动恢复 + 立即 `git push`。
- **ARM 同步**：`rsync -a src/ python_backend/ config/` 从 x86 到 ARM，然后 `sed -i 's/libasound2/libasound2/g'`。

## 系统依赖

```bash
sudo apt install -y libnss3 libnspr4 libasound2   # x86, 24.04+
sudo apt install -y libnss3 libnspr4 libasound2      # ARM
sudo usermod -aG dialout $USER
```

## 测试

```bash
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py
python3 linux/tests/test_protocol.py
```
