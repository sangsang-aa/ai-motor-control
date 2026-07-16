# AGENTS.md — MOTOTUNE

Electron 双窗口 + Python 多线程串口子进程。x86 (`main`) / ARM (`arm64`) 双分支。示波器来自 `motra/scope-standalone`。

## 构建

```bash
npm install              # 首次 / git pull 后
node build.mjs           # 4 入口: main + preload + renderer + motor
./run.sh                 # 一键
```

## 构建陷阱

- **不能用 `electron-vite`**：rollup segfault。唯一构建：`node build.mjs`（esbuild）。
- **`build.mjs` 是纯 JS**：不能有类型注解/`!` 非空断言 → SyntaxError。
- **Tailwind `@apply` 不认自定义颜色**：全部原始 CSS，只用 `@apply` 标准 utility。
- **`package-lock.json` 损坏**：`npm install` 报 `Invalid Version` → `rm package-lock.json && npm install`。

## 架构

- **手动连接**：启动不自动连串口。`motor:connect` / `motor:disconnect` 用户触发。连接后端口+波特率锁定。
- **波特率是纯 `<input>` 文本**，无下拉。
- **pythonBridge**：emit 回调广播两窗口。`motor:event` 是串口状态唯一事实源。
- **config.ts 用 `yaml` 库 `parse()`**：手写解析器不剥 `#` 注释→崩溃。
- **`SerialLink` 只有 `send_command()`**，没有 `send()`。
- **Python 多线程**：主线程 + 串口线程 + 工具线程(Queue, 5s 超时)。心跳 ping/pong。

## 示波器（来自 motra/scope-standalone）

- **数据流**：`motorStore.rpmHistory/currentHistory` → 交错 `[Ia,Speed]` → `scopeStore.applyFrame(payload,2)` → ScopeChart SVG 渲染
- **scopeStore.ts**：632 行 Zustand store，导入处用 stub 类型替代了 `@shared` 引用（避免依赖 motra 项目）。核心接口：`buffers:Float32Array[]`、`applyFrame(payload,nChannels)`、`setChannelLabel()`
- **ChannelPanel**：右侧面板，通道 enable/bias/V-div 滑块 + 统计
- **HexView/PauseToggle/HexToggle**：从 motra 复制，用 inline 样式适配本主题
- **MotorWindow**：`showHex` 状态在 scopeStore 中；Pause/Hex 按钮在顶栏

## CommandLock + ConfirmCard 链条

1. `App.tsx` 收到 `tool_call` → `lock.lock()` → `setPendingToolCall()` → `notifyToolCall()`
2. ChatPane `useEffect([toolCallVersion])` → `consumePendingToolCall()` → `setPt()` → 渲染 ConfirmCard
3. 确认 → `lock.setExecuting()` → `sendCommand` → `executed` 事件 → `lock.unlock()`

**⚠️ 陷阱**：
- `setPendingToolCall` 必须先于任何消息变更（否则 ChatPane 检测不到，ConfirmCard 不弹）
- `lock` 必须在 useEffect 依赖中（否则 `executed` 处理拿到过期闭包）
- 系统提示词："直接调用工具，不要先回复文字确认"

## 组件约束

- **无 emoji**：CSS/HTML 实体替代。**EStop** `bottom:90px`。**颜色全用原始 CSS**。
- **Sidebar**：可拖拽宽度(160-400px)，右上角 ◀ 折叠为 36px 图标栏，工具栏分组在"新建会话"下方。
- **Topbar**：CSS 渐变文字 **MOTOTUNE** 品牌，端口/波特率前有标签，纯手动输入。

## 双分支

```
ai_motor_control/       → GitHub main (x86, libasound2t64)
ai_motor_control_arm/   → GitHub arm64 (ARM, libasound2)
```

ARM 差异：`package.json` arch + `libasound2` + 串口设备名文档，源码 `rsync -a` 同步后 `sed -i 's/libasound2t64/libasound2/g'`。

## Git 注意

- `git pull` 覆盖未推送文件 → 检查+恢复+立即 push
- ARM 同步：`rsync -a --exclude='.git' --exclude='node_modules' --exclude='out' x86/ arm/` → `sed -i` 修正库名

## 系统 & 测试

```bash
sudo apt install -y libnss3 libnspr4 libasound2t64  # x86
sudo apt install -y libnss3 libnspr4 libasound2     # ARM
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 python_backend/main.py
```
