# DESIGN.md — MOTOTUNE 界面参考(Altior 风格)

**Reference:** `界面样式.png` — 现代深色 AI 助手界面(Altior/DeepSeek 风格)。
**Goal:** 将 MOTOTUNE(电机控制 + AI 对话)重构为该排版,功能不变,布局/色彩/组件形态仿照参考图。

## 1. Palette(tokens)
| Token | Value | 用途 |
|---|---|---|
| bg-root | `#0d0d0d` | 主区背景(近黑) |
| bg-sidebar | `#121212` | 侧栏背景 |
| surface-raised | `#1c1c1c` | 输入框容器 / 卡片 |
| hover | `#1f1f1f` | 侧栏项 hover |
| border | `#2a2a2a` | 细边框(输入框容器) |
| text-primary | `#ececec` | 主文字 |
| text-secondary | `#9aa0a6` | 次级(分组标题/占位) |
| text-tertiary | `#6b7075` | 弱化 |
| brand | `#2bb8a8` | 品牌(MOTOTUNE 强调) |
| accent-blue | `#2f6bff` | 深度思考 pill / 发送按钮 |
| user-avatar | `#f59e0b` | 头像橙点(参考图) |

> 深色近黑底 + 青/蓝点缀,取代原 `#0a1628`/`#00a8ff` 蓝黑系。

## 2. Typography
- 正文字体沿用 `Noto Sans SC`;数值用 `JetBrains Mono`。
- 分组标题:12px,`text-tertiary`,normal weight。
- 侧栏项:14px,`text-secondary`;hover/active `text-primary`。
- 中央问候语:24px,`text-primary`。

## 3. Layout Geometry
```
┌─────────────────────────────────────────────────────┐
│ sidebar(240px) │  main(flex-1)                        │
│ 品牌行          │  顶部:模型下拉(左) + 串口状态(右)     │
│ 开启新对话按钮    │  ───────────────────────            │
│ 分组: 会话        │   中央: 问候语(垂直居中)             │
│ 分组: 工具        │   消息列表(聊天后)                   │
│ ┄┄┄┄┄          │  ───────────────────────            │
│ 用户行(底部)     │   大输入框容器(圆角,底部工具行+发送)   │
└─────────────────────────────────────────────────────┘
```

## 4. Component Anatomy
- **侧栏项**:icon + 文本,行高 38px,hover 圆角(6px)背景;当前项左侧色条。
- **"开启新对话"按钮**:全宽圆角胶囊,`surface-raised` 背景,左箭头图标。
- **顶部条**:左=模型/语言下拉;右=连接状态 + RPM/电流(实时)。
- **输入框容器**:大圆角(16px)细边框,内部:顶部占位文字 + 多行 textarea + 底部工具行
  (`+` 圆钮、`工具 ▾` pill、`深度思考` 蓝pill)+ 右侧圆形发送按钮(蓝底上箭头)。
- **发送按钮**:圆形(36px),`accent-blue` 底,白箭头。

## 5. MOTOTUNE 功能映射
| 原功能 | 新位置 |
|---|---|
| Topbar(连接/波特率/转速电流) | 主区顶部条(串口状态 + RPM/电流;波特率在连接时输入) |
| Sidebar 标题/折叠 | 侧栏品牌行 + 开启新对话 |
| 会话列表 | 侧栏"会话"分组 |
| 工具(示波器/导出/设置/搜索) | 侧栏"工具"分组 |
| 欢迎语 | 主区中央问候语(未对话时) |
| Composer | 主区底部大圆角输入框 |
| 急停 | 保留 fixed 右下(语义不变) |
| 锁链/ConfirmCard | 消息区内,不变 |

## 6. Constraints
- 保持 `next/link` 跨页导航(丢串口连接)。弹窗 `data-testid` 不变。
- 无 emoji 作图标(用 SVG/Lucide 风格)。
- 状态/逻辑(store/bus/modbus)零改动 —— 仅布局/样式。
