# AGENTS.md — AI电驱控制系统

Electron 双窗口 + Python 多线程串口子进程。x86 与 ARM 双架构独立维护。

## 构建

```bash
npm install              # 首次 / git pull 后
node build.mjs           # 4 入口: main + preload + renderer + motor
./run.sh                 # 一键: 依赖检查 → 构建 → 启动
```

## 构建陷阱

- **不能用 `electron-vite`**：rollup native binary segfault (`bus error`)。唯一构建方式：`node build.mjs`（纯 esbuild bundle）。
- **`build.mjs` 是纯 JS 不是 TS**：不能有类型注解、`!` 非空断言 → SyntaxError。
- **Tailwind `@apply` 不认自定义颜色**：`@apply bg-bg-input` 失败。自定义颜色全用原始 CSS，只用 `@apply` 标准 utility。
- **`npx tailwindcss` 权限**：`node_modules/.bin/` symlink 目标可能缺 `chmod +x`。
- **双 renderer 入口**：`renderer.js`→主窗口、`motor.js`→监控窗口。
- **`package-lock.json` 可能损坏**：`npm install` 报 `Invalid Version` → `rm package-lock.json && npm install`。

## 架构要点

- **手动连接（非自动）**：启动后不自动连接串口。`motor:connect(port,baud)` / `motor:disconnect` 由用户手动触发。连接后端口+波特率锁定。
- **波特率是自由文本输入 + datalist**，不是 `<select>`。用户可输入任意数值。
- **pythonBridge**：构造函数接受 emit 回调（不直接持有 BrowserWindow），`ipc.ts` 的 `broadcast()` 向两个窗口推送 `motor:event`。`motor:event` 是串口状态的**唯一事实源**。
- **config.ts 用 `yaml` 库的 `parse()`**：手写解析器不剥 `#` 注释→`150000  # 注释` 当值传给 Python `--baud`→崩溃。
- **`SerialLink` 只有 `send_command(speed, motor_on)`**，没有 `send()`。`tools.py` 必须调 `send_command()`。
- **Python 后端多线程**：主线程(stdin 监听) + 串口线程(独占 pyserial) + 工具线程(Queue 通信, 5s 超时)。心跳每 5s ping/pong，2 次无响应自动重启。

## CommandLock 指令锁（防竞态）

- 三态：`idle` → `pending`(LLM 发起 toolCall) → `executing`(用户确认) → `idle`(完成/超时/忽略)
- 锁定期间：Composer 禁用+遮罩；新 LLM 消息被拦截；顶部黄色 CommandLockBanner
- 释放条件：执行完成(`motor:executed` 事件)、忽略、30s 超时、急停
- 锁在 `commandLockStore.ts`，ChatPane/App.tsx/Composer 均引用

## IPC 通道（新增易漏项）

| 通道 | 替代 |
|---|---|
| `motor:connect(port,baud)` | 替代旧的 `startBackend`/`reconnect` |
| `motor:disconnect` | 替代旧的 `stopBackend` |
| `motor:executed`(Event) | 指令执行完成→释放 CommandLock |
| `motor:event {type:'chart_closed'}` | 监控窗口关闭→主窗口同步 |
| `llm:interrupt` | Ctrl+C → abort LLM + 清串口队列 |

## 组件约束

- **无 emoji**：系统无 emoji 字体，全部替换为 CSS/HTML 实体。
- **EStop** `bottom:90px`（高于 Composer）。
- **所有颜色用原始 CSS**：`background:#00a8ff`，不用 `@apply bg-accent`。
- **ChartWindow**：1000×700 独立窗口，右侧控制面板(可滚动)含通道复选框 + 每通道量程输入框 + 暂停按钮。`ChartPanel` 组件独立管理 ECharts 生命周期。

## 双架构

```
ai_motor_control/          → GitHub main 分支 (x86)
ai_motor_control_arm/      → GitHub arm64 分支 (ARM)
```

ARM 版源码相同，仅 `package.json` `arch: arm64` + `config/README.txt` 补充 ARM 串口设备名。

## 系统依赖

```bash
sudo apt install -y libnss3 libnspr4 libasound2t64   # Ubuntu 24.04+，不是 libasound2
sudo usermod -aG dialout $USER
```

## 测试 & 打包

```bash
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py
python3 linux/tests/test_protocol.py
./package.sh   # → ai_motor_control_portable_YYYYMMDD.tar.gz
```

## Git 注意

`git pull` 可能覆盖未推送的本地新文件（如 `CommandLockBanner.tsx`、`commandLockStore.ts`）。pull 后若报 `Cannot find module` → 检查文件是否被覆盖，手动恢复后 `git push`。
