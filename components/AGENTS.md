# components/ — 业务组件域

**Generated:** 2026-09-04
**Branch:** fix/web-serial-reliability

## OVERVIEW
React 组件层,分 `chat/`(聊天主界面)、`scope/`(示波器)、`param-est/`(PMSM mode7 辨识)、`control/`(手动控制与参数调控)四个独立域。**组件只经 store + bus 读数据,不经 window.api/直接串口。**

## STRUCTURE
```
components/
├── chat/        # 聊天主界面(dominated by ChatApp)
│   ├── ChatApp.tsx        # 主界面: 事件接线(aiMotorBus/llmBus)+ 弹窗管理(设置/搜索)
│   ├── Topbar.tsx         # 串口连接/波特率 + 转速电流显示
│   ├── Sidebar.tsx        # 标题/功能栏/会话列表/折叠+拖拽;发 onOpenSettings/Search 回调
│   ├── ChatPane.tsx       # 消息列表 + ConfirmCard + tool_call 锁链消费
│   ├── Composer.tsx       # 输入框 + 锁定态遮罩
│   ├── ConfirmCard.tsx    # tool_call 确认卡(30s 倒计时)
│   ├── CommandLockBanner.tsx / DisconnectBanner.tsx / EStopButton.tsx
│   ├── SettingsPanel.tsx  # 设置弹窗(语言/AI 供应商/API)
│   └── SearchDialog.tsx   # 搜索对话弹窗(关键词过滤 + 跳转)
├── scope/       # 示波器页(dominated by ScopeApp)
│   ├── ScopeApp.tsx       # ai_sample(100Hz)→ appendAiSample;顶部数字来自 motorStore
│   ├── ScopeChart.tsx     # SVG 波形(rAF),网格 line + 波形 path
│   ├── ChannelPanel.tsx   # 每通道 enable/label/bias/V-div/色 + 统计
│   ├── HexView.tsx        # 原始字节 HEX 视图
│   └── PauseToggle.tsx / HexToggle.tsx
├── param-est/   # PMSM 参数辨识(mode7)
    ├── ParamEstApp.tsx    # 页壳 + aiMotorBus 订阅
    ├── ConnectionBar.tsx  # 复用主控制器连接/状态
    ├── TestControlPanel.tsx # 母线/极对数/最大测试电流 → 配置/开始/停止
    ├── EstimatedParamsPanel.tsx # Rs/Ld/Lq/Ls + ident stage/error
    └── DebugScope.tsx     # 实时 Id/Iq/Speed/stage
└── control/     # 手动控制与参数调控
    ├── ControlApp.tsx     # 页壳 + aiMotorBus 订阅
    ├── ControlBar.tsx     # 连接/演示/mode/启停
    ├── SpeedPanel.tsx     # 目标转速 + 给定/实测
    ├── ParamGroups.tsx    # 30 条参数分组、回读、二次确认
    ├── LivePanel.tsx      # 12 个实时量
    ├── ModelPanel.tsx     # 已应用模型/保存状态
    └── RecordingPanel.tsx # 100Hz CSV 记录下载
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 改聊天布局 | `chat/ChatApp.tsx` | 此处挂弹窗与 Sidebar 回调 |
| 改示波器数据源 | `scope/ScopeApp.tsx` | `ai_sample` → `appendAiSample`(100Hz) |
| 改参数辨识 | `param-est/` | mode7 配置/启停/结果;复用 `aiMotorBus` |
| 改手动控制/调参 | `control/` | mode/启停/调速/参数分组/CSV;复用 `aiMotorBus` |
| 改消息/确认 | `chat/ChatPane.tsx` + `chat/ConfirmCard.tsx` | tool_call 锁链 |
| 改设置/搜索 | `chat/SettingsPanel.tsx` + `chat/SearchDialog.tsx` | 弹窗,overlay 有 data-testid |

## CONVENTIONS(区别于父)
- **聊天→示波器用 `next/link`**(Sidebar/ScopeApp 内),整页刷新会丢串口连接状态
- **测试定位**:弹窗 overlay 有 `data-testid="search-overlay"`/`search-result`,供 e2e 区分弹窗与侧栏同文本项
- **侧栏品牌**:顶部白色徽章 FluxPilot 商标(图标 `trademark_image.png` + 文字 `trademark.png`);侧栏为 Codex 固定宽(240px,无拖拽调宽),折叠/搜索按钮为内联 SVG 图标、位于品牌行右侧
- **ScopeApp 订阅**:`ai_sample`(100Hz)→ `scopeStore.appendAiSample`(6 通道 Iu/Speed/Id/Iq/EMF/I-F);顶部数字来自 `motorStore`。`/param-est` 复用同一 `aiMotorBus`(mode7)。

## ANTI-PATTERNS
- **不要用原生 `<a href>` 跨 chat/scope 导航** — 会整页刷新(必须 `next/link`)
- **不要直接 import `lib/serial/aimotor/controller` 之外的串口细节** — 组件只调 `sendCommand`/`connect`
- **不要绕过 bus 直接订阅 store 事件** — 统一 `aiMotorBus.on`/`llmBus.on`
