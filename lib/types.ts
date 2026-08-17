// Web 版跨层类型 — 从原 Electron 版 src/shared/types.ts 迁移(去掉 MotraApi/窗口相关)

export type SessionStatus = 'idle' | 'running' | 'error'
export type LockStatus = 'idle' | 'pending' | 'executing'

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: SessionStatus
  messages: Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: number
  streaming?: boolean
}

export interface MotorStatus {
  connected: boolean
  port: string
  baudRate: number
  rpm: number
  currentIa: number
  alarmInfo: string
}

export interface CommandLock {
  sessionId: string
  toolCallId: string
  status: LockStatus
  lockedAt: number
}

// ── LLM 流式事件(与 Electron 版 llmProxy 输出一致) ─────────────
export interface LlmStreamDelta { type: 'text'; content: string }
export interface LlmToolCall { type: 'tool_call'; toolName: string; arguments: Record<string, unknown> }
export interface LlmTurnEnd { type: 'turn_end' }
export interface LlmError { type: 'error'; message: string }
export interface LlmInterrupted { type: 'interrupted' }
export type LlmEvent = LlmStreamDelta | LlmToolCall | LlmTurnEnd | LlmError | LlmInterrupted

// ── 后端(串口控制器)事件 — 与原 pythonBridge 广播的 motor:event 一致 ──
export interface BackendStarted { type: 'started'; version: string }
export interface SerialStatus { type: 'serial_status'; connected: boolean; port: string; baudRate?: number }
export interface TelemetryData {
  type: 'telemetry'
  rpm: number
  current: number
  seriesRpm: number[]
  seriesIa: number[]
  channels?: Record<string, number[]>
}
export interface BackendError { type: 'error'; message: string }
export interface BackendInterrupted { type: 'interrupted' }
export interface BackendExecuted { type: 'executed'; action: string; result: string }
export interface BackendPong { type: 'pong' }
export type BackendEvent =
  | BackendStarted
  | SerialStatus
  | TelemetryData
  | BackendError
  | BackendInterrupted
  | BackendExecuted
  | BackendPong
