# AI 电驱控制系统

基于 Electron 的双窗口桌面应用，通过自然语言对话控制 TI F28069M 电机，支持多通道实时波形监控。

## 系统要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Ubuntu 22.04+ / Debian 12+ |
| Node.js | >= 18.x |
| Python | >= 3.10 |
| 显示 | X11 或 Wayland |
| 串口 | 用户需在 `dialout` 组 |

## 快速开始

```bash
# 1. 系统依赖
sudo apt install -y libnss3 libnspr4 libasound2 python3 python3-pip
sudo usermod -aG dialout $USER   # 串口权限，重新登录生效

# 2. 项目依赖
npm install
pip install numpy pyserial

# 3. 配置 LLM
#    编辑 config/llm_config.yaml → 填入阿里云百炼 API Key

# 4. 启动
./run.sh
```

## 界面

```
┌─ AI 电驱控制系统 ─ [/dev/ttyUSB0] [150000] [连接] ── 转速 0 RPM  电流 0.00 A ─┐
├────────┬───────────────────────────────────────────────────────────────────────┤
│Sidebar │ ChatPane                                                              │
│        │                                                                       │
│ + 新建 │ 💬 用户消息 (右对齐) / AI 消息 (左对齐)                                 │
│ 会话   │ ⚠ 确认卡片 [确认执行] [忽略] (30秒超时)                                │
│ 列表   │ ═ 锁定提示 (存在待确认指令时禁止输入)                                  │
│        │                                                                       │
│ 打开   ├───────────────────────────────────────────────────────────────────────┤
│ 监控   │ [输入消息...]                                          [发送]          │
│ 导出   │                                                                       │
│ 报告   │                                                          [急停]        │
└────────┴───────────────────────────────────────────────────────────────────────┘
```

## 核心功能

### 串口连接（手动控制）
- 启动后不自动连接，用户手动操作
- **未连接时**：可自由编辑端口和波特率（支持手动输入任意数值 + 预设下拉建议）
- **连接后**：端口和波特率锁定为只读，必须先断开再修改
- LLM 被禁止修改波特率

### 指令确认与锁定 (CommandLock)
- LLM 发起 `set_speed` / `set_motor_state` 后进入锁定状态
- **锁定期间**：输入框禁用 + 顶部显示黄色提示条 + 无法发送新消息
- 点击「确认执行」→ 指令下发 → 后端返回 `executed` 事件 → 自动解锁
- 点击「忽略」或 30 秒超时 → 立即解锁
- 急停按钮强制清除所有锁定

### 全局中断
- `Ctrl + C` 随时终止 LLM 流式生成和正在执行的电机操作
- 同时清除 inflight 状态和 commandLock

### AI 工具

| 工具 | 参数 | 说明 |
|---|---|---|
| `set_speed` | `rpm`: 0 ~ 6000 | 设置目标转速，需确认 |
| `set_motor_state` | `on`: true / false | 启动或停止电机，需确认 |
| `get_status` | — | 查询当前状态，自动执行无需确认 |

### 独立图表窗口
- 点击 Sidebar「打开监控窗口」→ 弹出 **1000 × 700** 独立窗口
- **多通道选择**：勾选 Ia / Speed / Ib / Ic / Voltage，每个通道独立子图
- **右侧控制面板**：可滚动，包含：
  - 通道复选框（带颜色标记）
  - 每个通道 Y 轴量程调节（min ~ max 自由输入）
  - 暂停/继续刷新按钮（暂停后后台仍接收数据）
  - 连接状态 + 实时数据面板
- 坐标轴完整显示（X 轴样本序号 + Y 轴数值 + 单位标签）

### 会话管理
- **自动持久化**：每次消息变更 1 秒防抖写入 `sessions.json`
- **启动恢复**：自动加载历史会话；首次使用自动创建默认会话
- **重命名**：hover 会话项 → 点击 ✎ → 输入新标题
- **删除**：hover 会话项 → 点击 ✕ → 确认删除

### 报告导出
- Sidebar「导出报告」→ 生成自包含 HTML 文件，包含统计数据、聊天记录

### Python 后端心跳
- 每 5 秒 ping → 3 秒内需 pong
- 连续 2 次无响应 → 自动杀进程并重启，提示"后台服务已恢复"

## 多线程架构

```
Renderer (React SPA) ←→ Preload (contextBridge) ←→ Main Process (Electron)
                                                        │ spawn
                                                   Python Backend
                                                   ├─ 主线程 (stdin 监听 & 派发)
                                                   ├─ 串口工作线程 (独占 pyserial)
                                                   └─ 工具执行线程 (Queue 通信, 5s 超时)
```

## 目录结构

```
ai_motor_control/
├── src/                  # TypeScript 源码
│   ├── main/             # 主进程 (IPC, PythonBridge, LLM, Sessions)
│   ├── preload/          # contextBridge
│   ├── shared/           # 跨进程类型定义
│   └── renderer/         # React UI (组件 + 图表窗口 + Zustand stores)
├── python_backend/       # Python 串口后端 (JSON Lines stdin/stdout)
├── config/               # YAML 配置模板
├── linux/                # 原 mcb_host 协议参考
├── build.mjs             # esbuild 构建脚本
├── run.sh                # 一键启动脚本
├── package.sh            # 打包脚本
└── ai_motor_control_arm/ # ARM64 版本 (独立目录)
```

## 构建

```bash
# 仅构建
node build.mjs

# 一键构建 + 启动
./run.sh

# 打包为分发压缩包
./package.sh
```

## ARM 平台部署

ARM 版本存放于 `ai_motor_control_arm/`，源码与 x86 相同，仅打包配置不同（`arch: arm64`）。

```bash
cd ai_motor_control_arm
npm install                          # 安装 ARM 版 Electron
node build.mjs                       # 构建
./run.sh                             # 启动
```

ARM 串口设备名可能不同于 x86：`/dev/ttyAMA0`（树莓派）、`/dev/ttyTHS0`（Jetson）、`/dev/ttyS0`（SoC 原生）。

## 常见问题

| 问题 | 解决 |
|---|---|
| `libnss3.so: cannot open` | `sudo apt install -y libnss3 libnspr4 libasound2` |
| `Permission denied /dev/ttyUSB0` | `sudo usermod -aG dialout $USER`，重新登录 |
| `Cannot find module 'esbuild'` | `npm install`（每次 git pull 后可能需要） |
| npm `Invalid Version` 错误 | `rm package-lock.json && npm install` |
| API 连接失败 | 检查 `config/llm_config.yaml` 中的 `api_key` |
| 图表窗口无数据显示 | 先连接串口，确保 `motor:event` 广播正常 |
