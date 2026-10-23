# lib/ — 核心逻辑域

**Generated:** 2026-09-04
**Branch:** feature/aimotor-v1

## OVERVIEW
全部业务逻辑层(无 UI):AI-Motor v1 串口协议、LLM 客户端、zustand 状态、设置/i18n、工具函数。**组件不可直接访问 `lib` 外部状态接口,统一经 store/bus。**

## STRUCTURE
```
lib/
├── types.ts              # 跨层类型(LlmEvent/Session/Message/MotorStatus/KnowledgePayload + AiMotorEvent)
├── bus.ts                # 事件总线: aiMotorBus(主串口)/llmBus(LLM)/hexBus(原始字节)
├── config.ts             # 常量 COMMAND_CONFIRM_TIMEOUT
├── settings.ts           # localStorage 设置(语言/主题/AI 供应商/baseUrl/apiKey/model)
├── i18n.ts               # 中/英字典 + useLangStore(响应式切换)
├── report.ts             # 报告导出(Blob 下载)
├── stats.ts              # 示波器通道统计
├── serial/aimotor/
│   ├── protocol.ts       # A5 5A 帧 / CRC16-CCITT / 命令 / SAMPLE / MODEL / CONFIG 编解码
│   ├── params.ts         # 允许参数表 + 安全锁 + 范围/整数校验
│   ├── controller.ts     # Web Serial + HELLO/心跳/ACK 重试/STOP/100Hz 遥测 + 演示模式
│   └── control.ts        # 参数分组 / paramMode / 安全标记
├── llm/
│   ├── llmClient.ts      # SSE 解析 + abort(浏览器端)
│   └── tools.ts          # 工具定义 TOOLS + 系统提示词 SYSTEM_PROMPT(前后端共用)
└── stores/
    ├── sessionStore.ts   # 会话(localStorage mototune.sessions)
    ├── motorStore.ts     # 电机状态(AiMotorEvent → sample/model/config)
    ├── commandLockStore.ts # 命令锁状态机 idle→pending→executing→idle
    └── scopeStore.ts     # 示波器 Float32Array 缓冲 + appendAiSample + 通道配置持久化
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 改串口协议/帧 | `serial/aimotor/protocol.ts` | 帧/CRC/编解码;文档 `docs/aimotor_protocol.md` |
| 改参数/安全锁 | `serial/aimotor/params.ts` | 与固件 `host_parameters.inc` 对齐 |
| 改连接/重试/超时 | `serial/aimotor/controller.ts` | HELLO/心跳/单命令在途/STOP |
| 改 LLM 工具/提示词 | `llm/tools.ts` | 前后端共用,`app/api/llm/route.ts` 注入 |
| 加自定义事件 | `bus.ts` | 新增 bus 类型须同步 `types.ts` |
| 改状态管理 | `stores/*.ts` | zustand,持久化用 localStorage |
| 改设置/语言 | `settings.ts` + `i18n.ts` | 语言 key 在 `translations` 字典,需 zh/en 同步 |

## CONVENTIONS(区别于父)
- **AI-Motor 语义**:`set_speed`→`SET_PARAM(mode6/8,param1)`;`set_motor_state(true)`→`SET_MODE+ENABLE`,`false`→`STOP`;`emergency_stop`→`STOP`;`set_mode`→`SET_MODE`;`set_param`→允许参数表;`write_pid_<id>`→`SET_PARAM(id)`。
- **控制器**:HELLO 后才允许 ENABLE;100ms 心跳;单命令在途;丢 ACK 同 seq 重发 2 次;STOP 优先;5s 无数据超时。
- **安全锁**:AI 禁止修改 6 强拖上限 / 13 闭环 Iq / 24 Iq 范围 / 42 辨识电流 / 51 参数组 / 52 自动应用;人工辨识页用 `sendManualParam`。
- **转速上限 6000 RPM**(clamp)。
- **stores 持久化 key**:会话 `mototune.sessions`,示波器通道 `scope.*`,设置 `mototune.settings`。

## ANTI-PATTERNS
- **不要绕过 `bus`/store 直接跨层传值** — 组件↔组件只经 store
- **不要在新代码里直接操作 `navigator.serial`** — 一律走 `serial/aimotor/controller`
- **不要在 store 里 import 组件 / 反向依赖 UI**
