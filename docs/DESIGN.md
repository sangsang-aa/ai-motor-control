# DESIGN.md — MOTOTUNE 界面参考(Codex 亮/暗双主题)

**Reference:** Codex 桌面/网页 GUI(极简、发丝边框)。
**Goal:** MOTOTUNE(聊天 `/`、示波器 `/scope`、知识库 `/knowledge`、参数辨识 `/param-est`、手动控制 `/control`)统一为 Codex 视觉;**默认亮色,支持亮/暗切换**;功能与逻辑零改动,仅布局与样式。

## 1. Palette(tokens)

- **CSS 变量** `--cx-*`(`app/globals.css`):`:root, [data-theme="light"]` 为亮色,`[data-theme="dark"]` 覆盖为暗色。
- **Tailwind 语义 token**(`tailwind.config.js`)映射到同一套 `--cx-*`,因此亮/暗切换对示波器/知识库同样生效。
- 主题持久化在设置(`mototune.settings.theme`);`app/layout.tsx` 首屏脚本在绘制前设置 `data-theme`。

| Token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--cx-bg` / `bg.base` | `#f7f7f5` | `#0a0a0a` | 全局底色 |
| `--cx-bg-elev` / `bg.panel` | `#ffffff` | `#0f0f0f` | 侧栏 / 面板 |
| `--cx-surface` / `surface` | `#ffffff` | `#141414` | 输入框 / 卡片 |
| `--cx-surface-2` / `surface-light` | `#f3f3f1` | `#1a1a1a` | 次级面 |
| `--cx-hover` / `surface-lighter` | `#ececea` | `#1e1e1e` | hover |
| `--cx-border` / `line.DEFAULT` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.08)` | 发丝边框 |
| `--cx-border-2` / `line.bright` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.14)` | 强调边框 |
| `--cx-text` / `text-primary` | `#1a1a1a` | `#ececec` | 主文字 |
| `--cx-muted` / `text-secondary` | `#5f5f5f` | `#9a9a9a` | 次级 |
| `--cx-subtle` | `#8a8a8a` | `#6a6a6a` | 弱化 |
| `--cx-accent` / `accent` | `#1a1a1a` | `#e8e8e8` | 主操作 |
| `--cx-accent-fg` | `#ffffff` | `#0a0a0a` | 主操作文字 |
| `--cx-success` | `#1a7f37` | `#3fb950` | 连接指示 |
| `--cx-warning` | `#b54708` | `#febc2e` | 告警 |
| `--cx-danger` | `#d92d20` | `#ff5f57` | 危险 |

> 示波器:`--cx-chart-*`(背景 / 网格 / 文字)与 `--cx-ch1..8` 通道色按亮/暗分别调深/调亮;`autoColor(idx, theme)` 供 `input[type=color]` 等需要 hex 的场景使用。

## 2. Typography

- 正文字体 `Noto Sans SC`;数值 / 通道 / HEX 用 `JetBrains Mono`。
- 分组标题 11–12px `--cx-subtle`;侧栏项 13.5–14px;消息 14px / 1.65;问候语 26px `--cx-text`。

## 3. Layout Geometry

```
┌───────────────────────────────────────────────┐
│ sidebar(240px) │  main(flex-1)                  │
│ 品牌行(白徽章)  │  顶部条 44px:模型下拉(左)       │
│ 新建对话        │           串口状态/波特率(右)    │
│ 会话分组        │  ──────────────────            │
│ 工具分组        │  消息区 / 中央问候语             │
│ 用户行(底)      │  ──────────────────            │
│                │  底部大圆角输入框 + 工具行/发送   │
└───────────────────────────────────────────────┘
```

- 聊天两栏(侧栏固定 240px);示波器 = 状态头 + 波形/HEX 区 + 右侧通道面板(可拖拽 160–500px);知识库 = 左侧库列表 + 右侧文件区。

## 4. Component Anatomy

- **侧栏项**:icon + 文本,圆角 8px,hover `--cx-hover`,当前项 `rgba(255,255,255,0.06)` 背景;图标为内联 SVG。
- **按钮**:聊天 / 知识库复用 `.cx-btn`(`-primary` 近白底深字 / `-ghost` 描边 / `-danger` 红描边)。
- **输入框**:`.input-base` 与各页内联输入统一 `--cx-surface` + 发丝边框,聚焦只加深边框(无发光)。
- **消息**:用户 = 圆角 12px 气泡(`--cx-surface-2`);助手 = 无气泡纯文本;系统 = 弱化小字。
- **ConfirmCard**:`--cx-surface` 底 + 左侧 `--cx-warning` 边条。
- **EStop**:inline 红色胶囊,集成 Composer 工具行(非 fixed)。
- **图标**:无 emoji;统一内联 SVG / unicode 文本。

## 5. MOTOTUNE 功能映射

| 功能 | 位置 |
|---|---|
| Topbar(连接 / 波特率 / 模型) | 主区顶部条 44px |
| Sidebar 品牌 / 折叠 / 搜索 | 侧栏品牌行 |
| 会话列表 / 工具组 | 侧栏分组 |
| 欢迎语 | 主区中央问候语(未对话时) |
| Composer | 主区底部大圆角输入框 |
| 急停 / 复位 | Composer 工具行 |
| 锁链 / ConfirmCard | 消息区内 |
| 示波器 | `/scope`:头 + 波形/HEX + 通道面板 |
| 知识库 | `/knowledge`:建库 / 上传 / 删除 |

## 6. Constraints

- 保持 `next/link` 跨页导航(丢串口连接);弹窗 / 列表 `data-testid` 与 e2e 选择器不变。
- 无 emoji 作图标(用内联 SVG / unicode 文本);中文界面。
- 状态 / 逻辑(`lib/**`:store / bus / aimotor / llm)零改动 —— 仅布局与样式。
- 样式用 Tailwind v3 + 原始 CSS 类(见 `app/globals.css`);**不 @apply 自定义颜色**。新增颜色优先走 `--cx-*`(globals.css)或 Tailwind `colors`,别硬编码旧深蓝(`#0a1628` / `#00a8ff`)或旧青(`#2bb8a8`)。
