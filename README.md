# MOTOTUNE

基于 Electron 的双窗口电机控制桌面应用，支持 AI 对话控制 + SVG 示波器实时波形。

## 最新修复 (2026-07-17)

### 对话系统
- **空对话框修复**：AI 回复工具调用时不再出现空内容气泡
- **卡死恢复**：30 秒自动检测 inflight/lock 卡死并清除 + 红色"取消"按钮手动恢复
- **无串口号死修复**：未连接串口时 AI 对话不再卡在加载状态
- **LLM 仅返回 tool_call 时 inflight 锁死修复**：turn_end 无条件发送
- **sendCommand 竞态修复**：listener 与 setTimeout 竞态调用 removeListener 导致监听器损坏

### 示波器
- **图像不刷新修复**：MotorWindow 直接从 telemetry 事件喂数据，绕过历史数组截断
- **串口帧丢弃修复**：Python 后端串口线程改为 get_nowait() 循环排空所有帧
- **横轴时间刻度** + **纵轴量程标签** 已添加
- **刷新率提升**：去除 30fps 节流 → ~60fps
- ChannelPanel Unicode 显示错误修复

### 串口
- **断开误报修复**：手动断开串口后不再弹出"未连接"错误横幅
- **断开清零**：断开时自动清零转速和电流显示

### 界面
- Sidebar 可拖拽宽度 + 折叠按钮
- 会话自动命名（首条消息前 30 字符为标题）
- MOTOTUNE 品牌 CSS 渐变文字

## 快速开始

```bash
sudo apt install -y libnss3 libnspr4 libasound2t64
npm install && pip install numpy pyserial
# 编辑 config/llm_config.yaml → 填入 API Key
./run.sh
```

## 主要功能

- AI 自然语言控制电机 (set_speed / set_motor_state / get_status)
- 指令人工确认机制 (30s 超时自动取消)
- SVG 示波器实时波形 (多通道 + 暂停/HEX 切换)
- 手动串口连接 + 波特率自由输入
- 会话自动持久化 + HTML 报告导出
- Ctrl+C 全局中断
