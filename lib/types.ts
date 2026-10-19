// Web 版跨层类型 — 从原 Electron 版 src/shared/types.ts 迁移(去掉 MotraApi/窗口相关)

import type { ConfigParamName } from './config'

export type SessionStatus = 'idle' | 'running' | 'error'
export type LockStatus = 'idle' | 'pending' | 'executing'

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: SessionStatus
  messages: Message[]
  /** 会话级自定义提示词(对话设置);随会话持久化/删除,仅作用于本会话 */
  systemPrompt?: string
  /** 已投送的知识库 id 列表;每次发送自动注入其内容(随会话删除,不存大文本) */
  kbIds?: string[]
}

/** 发往 LLM 的知识库内容(PDF 文本 + 图片 dataURL) */
export interface KnowledgePayload {
  texts: { name: string; text: string }[]
  images: { name: string; dataUrl: string }[]
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
/** 5kHz 电流波形批次(下位机攒 100 点,上位机分两段读到) */
export interface WaveFrame { type: 'wave_frame'; batch: number; samples: number[] }
export type BackendEvent =
  | BackendStarted
  | SerialStatus
  | TelemetryData
  | BackendError
  | BackendInterrupted
  | BackendExecuted
  | BackendPong
  | WaveFrame

// ── PMSM 参数辨识(独立模块,通讯不复用 Modbus)──────────────────
export type TestMethod = 'manual' | 'auto'

/** 测试编号(与下位机一致):0 停止,1 Rs,2 Ld,3 Lq,4 Mech */
export type PmTestId = 0 | 1 | 2 | 3 | 4

export const PM_TEST_LABEL: Record<PmTestId, string> = {
  0: '停止',
  1: 'Rs 相电阻',
  2: 'Ld d轴电感',
  3: 'Lq q轴电感',
  4: 'Mech (Ke,J,B)'
}

/** 控制字(命令 22) */
export interface ControlWord {
  /** bit0 启动/停止 */
  enable: boolean
  /** bit1 手动/自动 */
  auto: boolean
  /** bit4-7 测试号 */
  test: PmTestId
  /** bit8-12 调试通道号 */
  debug: number
}

/** 辨识结果 */
export interface ParamEstResult {
  Rs: number
  Ld: number
  Lq: number
  Ke: number
  J: number
  B: number
}

/** 配置器参数值(命令 1..21) */
export type ParamEstConfig = Partial<Record<ConfigParamName, number>>

/** 数据可用性报告 */
export interface DataQualityReport {
  ok: boolean
  /** 完整性:帧结构/长度/无 NaN */
  complete: boolean
  /** 有效性:数值非全零/非饱和/在量程内 */
  valid: boolean
  frames: number
  blocks: number
  reason?: string
}

/** 参数辨识事件(独立总线 paramEstBus,不并入 backendBus) */
export type ParamEstEvent =
  | { type: 'pe_status'; connected: boolean; port: string; baudRate: number }
  | { type: 'pe_progress'; frames: number; blocks: number; bytes: number }
  | { type: 'pe_waveform'; a: number[]; b: number[] }
  | { type: 'pe_result'; result: Partial<ParamEstResult>; quality: DataQualityReport }
  | { type: 'pe_data_error'; message: string; quality?: DataQualityReport }
  | { type: 'pe_error'; message: string }
