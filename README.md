# AI 电驱控制系统

LLM 自然语言电机控制终端。通过 AI 对话用自然语言控制 TI F28069M 电机，实时多通道波形监控。

## 快速开始

```bash
# 1. 安装系统依赖
sudo apt install -y libnss3 libnspr4 libasound2t64 python3 python3-pip
sudo usermod -aG dialout $USER   # 串口权限，需重新登录

# 2. 安装项目依赖
npm install
pip install numpy pyserial

# 3. 配置 LLM API Key
#    编辑 config/llm_config.yaml → 填入阿里云百炼 API Key

# 4. 启动
./run.sh
```

## 界面布局

```
┌─ AI 电驱控制系统 ─ [端口] [波特率] [连接] ──── 转速 0 RPM  电流 0.00 A ─┐
├─────────┬─────────────────────────────────────────────────────────────────┤
│ Sidebar │ ChatPane                                                        │
│         │                                                                 │
│ + 新建  │ 💬 消息气泡 (用户右对齐 / AI 左对齐)                              │
│ 会话列表 │ ⚠ 指令确认卡片 [确认执行] [忽略] (30s 超时)                    │
│         │ ═ 锁定提示条 (存在待确认指令时)                                  │
│ 打开监控 │                                                                 │
│ 导出报告 │                                                                 │
│         ├─────────────────────────────────────────────────────────────────┤
│         │ [输入框]                                                  [发送] │
└─────────┴─────────────────────────────────────────────────────────────────┘
                                                              [急停] (右下角)
```

## 核心功能

### 手动串口连接
- 启动后不自动连接，由用户在 Topbar 手动操作
- 未连接时：可编辑端口和波特率（支持自由文本输入 + 预设建议列表）
- 连接后：端口和波特率锁定为只读，必须先断开再修改
- LLM 被禁止修改波特率

### 指令确认与锁定 (CommandLock)
- LLM 发起工具调用后，进入 `pending` 锁定状态
- 锁定期间：输入框禁用 + 顶部显示黄色提示条 + 无法发送新消息
- 点击"确认执行"→ 进入 `executing` → 后端执行完自动释放
- 点击"忽略"或 30 秒超时 → 立即释放
- 急停按钮强制清除所有锁定

### 全局中断 (Ctrl+C)
- 随时按 Ctrl+C 终止 LLM 流式生成和正在执行的电机操作
- 自动清除 inflight 状态和 commandLock

### 独立图表窗口
- 点击 Sidebar "打开监控窗口" → 弹出 1000×700 独立窗口
- 多通道选择：勾选 Ia / Speed / Ib / Ic / Voltage，每个通道独立子图
- 右侧控制面板可调整每个通道的 Y 轴量程 (min ~ max)
- 暂停/继续刷新按钮，暂停时后台数据继续接收
- 坐标轴完整显示（X 轴样本序号 + Y 轴数值 + 单位）
- 取消勾选通道后图表立即移除，重新勾选即时恢复

### 会话管理
- 自动持久化：每次消息变更 1 秒防抖写入 sessions.json
- 启动恢复：自动加载历史会话，空文件自动创建默认会话
- 重命名：hover 会话项 → 点击 ✎ 编辑标题

### 报告导出
- Sidebar "导出报告" → 生成 HTML 文件，包含统计数据和完整聊天记录

### Python 后端心跳
- 每 5 秒 ping → 3 秒内 pong，连续 2 次无响应自动杀进程重启

## 架构

```
Renderer (React) ←→ Preload (contextBridge) ←→ Main (Electron)
                                                   │ spawn
                                              Python Backend (多线程)
                                              ├─ 主线程 (stdin 监听)
                                              ├─ 串口线程 (独占 pyserial)
                                              └─ 工具线程 (指令执行 + 超时保护)
```

## 工具列表

| 工具 | 参数 | 说明 |
|---|---|---|
| `set_speed` | rpm: 0~6000 | 设置转速 |
| `set_motor_state` | on: true/false | 启动/停止 |
| `get_status` | — | 查询状态 (自动执行，无需确认) |

## FAQ

**启动报错 libnss3/libnspr4**
```bash
sudo apt install -y libnss3 libnspr4 libasound2t64
```

**串口权限不足**
```bash
sudo usermod -aG dialout $USER  # 重新登录生效
```

**构建报错 "Cannot find module esbuild"**
```bash
npm install  # 首次需要安装构建依赖
```

**ARM 平台部署**
参见 `ai_motor_control_arm/` 目录，config/README.txt 含 ARM 串口设备名对照。
