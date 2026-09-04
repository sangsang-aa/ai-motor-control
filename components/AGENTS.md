# components/ — 业务组件域

**Generated:** 2026-09-04
**Branch:** web

## OVERVIEW
React 组件层,分 `chat/`(聊天主界面)与 `scope/`(示波器)两个独立域。**组件只经 store + bus 读数据,不经 window.api/直接串口。**

## STRUCTURE
```
components/
├── chat/        # 聊天主界面(dominated by ChatApp)
│   ├── ChatApp.tsx        # 主界面: 事件接线(backendBus/llmBus)+ 弹窗管理(设置/搜索)
│   ├── Topbar.tsx         # 串口连接/波特率 + 转速电流显示
│   ├── Sidebar.tsx        # 标题/功能栏/会话列表/折叠+拖拽;发 onOpenSettings/Search 回调
│   ├── ChatPane.tsx       # 消息列表 + ConfirmCard + tool_call 锁链消费
│   ├── Composer.tsx       # 输入框 + 锁定态遮罩
│   ├── ConfirmCard.tsx    # tool_call 确认卡(30s 倒计时)
│   ├── CommandLockBanner.tsx / DisconnectBanner.tsx / EStopButton.tsx
│   ├── SettingsPanel.tsx  # 设置弹窗(语言/AI 供应商/API)
│   └── SearchDialog.tsx   # 搜索对话弹窗(关键词过滤 + 跳转)
└── scope/       # 示波器页(dominated by ScopeApp)
    ├── ScopeApp.tsx       # 订阅 backendBus telemetry → scopeStore.applyFrame
    ├── ScopeChart.tsx     # SVG 波形(rAF),网格 line + 波形 path
    ├── ChannelPanel.tsx   # 每通道 enable/label/bias/V-div/色 + 统计
    ├── HexView.tsx        # 原始字节 HEX 视图
    └── PauseToggle.tsx / HexToggle.tsx
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 改聊天布局 | `chat/ChatApp.tsx` | 此处挂弹窗与 Sidebar 回调 |
| 改示波器数据源 | `scope/ScopeApp.tsx` | telemetry→applyFrame 交错逻辑在此 |
| 改消息/确认 | `chat/ChatPane.tsx` + `chat/ConfirmCard.tsx` | tool_call 锁链 |
| 改设置/搜索 | `chat/SettingsPanel.tsx` + `chat/SearchDialog.tsx` | 弹窗,overlay 有 data-testid |

## CONVENTIONS(区别于父)
- **聊天→示波器用 `next/link`**(Sidebar/ScopeApp 内),整页刷新会丢串口连接状态
- **测试定位**:弹窗 overlay 有 `data-testid="search-overlay"`/`search-result`,供 e2e 区分弹窗与侧栏同文本项
- **侧栏标题**:MOTOTUNE 在侧栏顶部,宽不足用省略号;隐藏按钮(◀)与搜索按钮(🔍)在标题右侧
- **ScopeApp 订阅**:telemetry 单点(50ms 轮询)→ `applyFrame(payload, 2)`,与父文档"600 点帧"已不同

## ANTI-PATTERNS
- **不要用原生 `<a href>` 跨 chat/scope 导航** — 会整页刷新(必须 `next/link`)
- **不要直接 import `lib/serial/motorController` 之外的串口细节** — 组件只调 `sendCommand`/`connect`
- **不要绕过 bus 直接订阅 store 事件** — 统一 `backendBus.on`/`llmBus.on`
