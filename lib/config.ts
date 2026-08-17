// 前端静态配置 — 迁移自原 config/motor_config.yaml(敏感 LLM 配置在 .env.local,由服务端代理读取)

/** 默认波特率(与固件 UserBaudRate 匹配;异常时可降级 115200 需重烧固件) */
export const DEFAULT_BAUD = 1500000

/** 转速上限(安全约束,超限拒绝) */
export const RPM_LIMIT = 6000

/** 电流告警阈值 (A) */
export const CURRENT_ALARM_THRESHOLD = 10.0

/** 指令确认超时(ms) — 与 Electron 版一致 */
export const COMMAND_CONFIRM_TIMEOUT = 30000
