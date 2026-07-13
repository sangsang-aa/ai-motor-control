# AI 电驱控制系统

LLM 自然语言电机控制终端。通过聊天界面与 AI 对话，用自然语言控制 TI F28069M LaunchPad 电机，实时监控转速与电流波形。

## 系统要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Linux (Ubuntu 22.04+) 或 Windows 10+ |
| Node.js | >= 18.x |
| Python | >= 3.10 |
| 串口权限 | 用户需加入 `dialout` 组 |
| 显示 | X11 或 Wayland（GUI 需要） |

## 快速开始

### 1. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y libnss3 libnspr4 libasound2t64 python3 python3-pip

# 串口权限
sudo usermod -aG dialout $USER
# 注销重新登录生效
```

### 2. 安装项目依赖

```bash
cd ai_motor_control

# Node.js 依赖
npm install

# Python 依赖
pip install numpy pyserial
```

### 3. 配置 LLM API

编辑 `config/llm_config.yaml`，填入阿里云百炼 API Key：

```yaml
base_url: "https://ws-4re9lk3au8wwdleg.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
api_key: "sk-xxxxxxxxxxxxxxxx"       # ← 改为你的真实 Key
model_name: "qwen-plus"
```

### 4. 构建并启动

```bash
node build.mjs                       # 构建
./node_modules/electron/dist/electron .   # 启动
```

> **网络问题？** 如果 `npm install` 超过 5 分钟，试试换国内镜像源：
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

---

## 界面说明

```
┌──────────────────────────────────────────────────────┐
│ Topbar  [连接状态]  [实时 RPM]  [电流]  [报告]          │
├──────────┬───────────────────────────┬───────────────┤
│ Sidebar  │  ChatPane                 │  MotorPanel   │
│          │                           │  (可开关)      │
│ + 新建   │  👋 欢迎使用               │               │
│ 历史会话  │                           │  ╱‾‾‾╲ 转速    │
│          │  [用户气泡]                │ ╱    ╲        │
│ 📊 监控  │  [AI 气泡]                 │╱      ╲ 电流   │
│          │  [确认卡片]                │               │
│          ├───────────────────────────┤               │
│          │ [输入框]           [发送]  │               │
├──────────┴───────────────────────────┴───────────────┤
│                                          [🛑 急停]    │
└──────────────────────────────────────────────────────┘
```

### 主要功能

**AI 对话控制电机**
- 在输入框输入自然语言指令，如"把转速提高到 3000 转"
- AI 会调用工具并展示确认卡片
- 点击「✅ 确认执行」下发硬件指令，或「忽略」取消

**急停按钮**
- 右下角红色🛑按钮，随时点击立即停机（转速归零 + 电机停止）
- 无需 LLM 确认，直接生效

**串口连接**
- Topbar 显示连接状态：🟢 已连接 / 🔴 未连接
- 未连接时显示提示："抱歉，没有检测到设备，请检查设备的连接情况！"
- 连接后 3 秒自动重试

**电机监控面板**
- 点击侧栏「📊 电机监控」开关右侧面板
- 实时显示转速波形 (0-6000 RPM) 和相电流波形
- 关闭后停止渲染，节省性能

**会话管理**
- 点击「+ 新建会话」开始新对话
- 所有会话自动保存，重启后恢复

**报告导出**
- Topbar 右侧「报告」按钮导出当前会话的 HTML 报告
- 包含统计信息（消息数、会话时长）和完整聊天记录

---

## AI 能做什么

| 工具 | 用途 | 示例 | 需确认 |
|---|---|---|---|
| `set_speed` | 设置转速 0~6000 RPM | "把转速调到三千转" | ✅ |
| `set_motor_state` | 启动/停止电机 | "启动电机" | ✅ |
| `get_status` | 查询当前状态 | "现在转速多少" | - (自动) |

AI 不会执行操作，需要你在确认卡片上点击确认后才会下发至硬件。确认卡片 30 秒超时自动取消。

---

## 配置文件

**LLM 配置** `config/llm_config.yaml`:
```yaml
base_url: "https://..."        # API 地址（默认阿里云百炼）
api_key: "sk-..."              # API Key
model_name: "qwen-plus"        # 模型名称
system_prompt: |               # AI 行为约束（一般无需改动）
  你是一个电机控制助手...
```

**电机配置** `config/motor_config.yaml`:
```yaml
port: "/dev/ttyUSB0"           # 串口设备路径
baud_rate: 150000              # 波特率
rpm_limit: 6000                # 转速上限
current_alarm_threshold: 10.0  # 电流告警阈值 (A)
```

---

## 测试（无硬件）

无需连接电机硬件即可测试界面和 AI 对话：

1. 填写 API Key 后启动程序
2. Topbar 显示"未连接"（正常）
3. 在聊天框输入"把转速调到 3000"
4. AI 返回确认卡片，点击确认后会显示 `[模拟] 转速已设置为 3000 RPM（未连接硬件）`

Python 后端单独测试：

```bash
cd python_backend
echo '{"type":"command","action":"set_speed","payload":{"rpm":3000}}' | python3 main.py
```

---

## 常见问题

**Q: 启动时报 `error while loading shared libraries: libnss3.so`**
```bash
sudo apt install -y libnss3 libnspr4 libasound2t64
```

**Q: 串口连接失败**
```bash
# 检查串口设备
ls /dev/ttyUSB* /dev/ttyACM*
# 检查权限
groups $USER | grep dialout
# 若不在 dialout 组
sudo usermod -aG dialout $USER  # 然后重新登录
```

**Q: 修改波特率后需要同步硬件**
波特率改变后，需要重新烧录目标板固件使 `UserBaudRate` 匹配。

**Q: 要打包成便携版**
```bash
npx electron-builder --dir
# 输出在 release/ 目录
```

**Q: 可以换其他 LLM 吗**
可以，支持任何 OpenAI 兼容 API。改 `config/llm_config.yaml` 中的 `base_url` 即可（如 DeepSeek、本地 vLLM 等）。
