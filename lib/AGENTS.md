# lib/ — 核心逻辑域

**Generated:** 2026-09-04
**Branch:** web

## OVERVIEW
全部业务逻辑层(无 UI):串口协议、LLM 客户端、zustand 状态、设置/i18n、工具函数。**组件不可直接访问 `lib` 外部状态接口,统一经 store/bus。**

## STRUCTURE
```
lib/
├── types.ts              # 跨层类型(BackendEvent/LlmEvent/Session/Message/MotorStatus)
├── bus.ts                # 事件总线: backendBus(串口)/llmBus(LLM)/hexBus(原始字节)
├── config.ts             # 常量 DEFAULT_BAUD/RPM_LIMIT/COMMAND_CONFIRM_TIMEOUT
├── settings.ts           # localStorage 设置(语言/AI 供应商/baseUrl/apiKey/model)
├── i18n.ts               # 中/英字典 + useLangStore(响应式切换)
├── report.ts             # 报告导出(Blob 下载)
├── stats.ts              # 示波器通道统计
├── serial/
│   ├── modbus.ts         # Modbus 协议层: CRC16/01/03/05/06/0F/10 帧+float32 编解码+地址表 ADDR/FC
│   └── motorController.ts# Web Serial 适配: 串行事务队列 + 写命令 + 50ms 轮询遥测
├── llm/
│   ├── llmClient.ts      # SSE 解析 + abort(浏览器端)
│   └── tools.ts          # 工具定义 TOOLS + 系统提示词 SYSTEM_PROMPT(前后端共用)
└── stores/
    ├── sessionStore.ts   # 会话(localStorage mototune.sessions)
    ├── motorStore.ts     # 电机状态(applyEvent→serial_status/telemetry/error)
    ├── commandLockStore.ts # 命令锁状态机 idle→pending→executing→idle
    └── scopeStore.ts     # 示波器 Float32Array 缓冲 + applyFrame + 通道配置持久化
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 改串口协议/指令 | `serial/modbus.ts` + `serial/motorController.ts` | 地址表在 modbus.ts `ADDR`,协议文档 `docs/modbus_rtu_protocol.md` |
| 改 LLM 工具/提示词 | `llm/tools.ts` | 前后端共用,`app/api/llm/route.ts` 注入 |
| 加自定义事件 | `bus.ts` | 新增 bus 类型须同步 `types.ts` |
| 改状态管理 | `stores/*.ts` | zustand,持久化用 localStorage |
| 改设置/语言 | `settings.ts` + `i18n.ts` | 语言 key 在 `translations` 字典,需 zh/en 同步 |

## CONVENTIONS(区别于父)
- **Modbus 语义**:`set_speed`→写 `SPEED_SETPOINT`;`set_motor_state`→写 `COIL_MOTOR_EN`;`emergency_stop`→写 `COIL_EMERGENCY_STOP`;`write_pid_<REG>`→写保持寄存器(float32)
- **`motorController.transact`** 走串行事务队列(`enqueue`),防 Web Serial 读写竞争;`sendCommand` 与轮询遥测都经此
- **float32 编码**:`float32ToRegs`/`regsToFloat32`,big-endian 高字低地址
- **stores 持久化 key**:会话 `mototune.sessions`,示波器通道 `scope.*`,设置 `mototune.settings`

## ANTI-PATTERNS
- **不要绕过 `bus`/store 直接跨层传值** — 组件↔组件只经 store
- **不要在新代码里直接操作 `navigator.serial`** — 一律走 `motorController`
- **不要在 store 里 import 组件 / 反向依赖 UI**
