// 前端静态配置 — 迁移自原 config/motor_config.yaml(敏感 LLM 配置在 .env.local,由服务端代理读取)

/** 默认波特率(当前控制板的 Modbus RTU 配置,8N1)。 */
export const DEFAULT_BAUD = 781250

/**
 * F280025C 固件提供 0x2000..0x20C7 波形缓冲和 0x2200/0x2201 帧状态。
 */
export const WAVE_POLLING_ENABLED = true

/** 本地串口桥地址(Windows 端 serial_bridge.py,桥接模式可同时查看通讯日志) */
export const BRIDGE_URL = 'ws://127.0.0.1:8765'

/** 转速上限(安全约束,超限拒绝) */
export const RPM_LIMIT = 6000

/** 电流告警阈值 (A) */
export const CURRENT_ALARM_THRESHOLD = 10.0

/** 指令确认超时(ms) — 与 Electron 版一致 */
export const COMMAND_CONFIRM_TIMEOUT = 30000
