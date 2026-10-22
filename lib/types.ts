// Web 版跨层类型 — 从原 Electron 版 src/shared/types.ts 迁移(去掉 MotraApi/窗口相关)

import type { Sample, Model, ConfigRecord } from './serial/aimotor/protocol'

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

// ── AI-Motor v1 主串口事件 ────────────────────────────────────
export interface AiStatusEvent { type: 'ai_status'; connected: boolean; port: string; baudRate: number }
export interface AiSampleEvent { type: 'ai_sample'; sample: Sample }
export interface AiModelEvent { type: 'ai_model'; model: Model }
export interface AiConfigEvent { type: 'ai_config'; records: ConfigRecord[] }
export interface AiAckEvent { type: 'ai_ack'; command: number; status: number; param: number; value: number }
export interface AiErrorEvent { type: 'ai_error'; message: string }
export interface AiClosedEvent { type: 'ai_closed' }
export interface AiExecutedEvent { type: 'ai_executed'; action: string; result: string }
export type AiMotorEvent =
  | AiStatusEvent
  | AiSampleEvent
  | AiModelEvent
  | AiConfigEvent
  | AiAckEvent
  | AiErrorEvent
  | AiClosedEvent
  | AiExecutedEvent
