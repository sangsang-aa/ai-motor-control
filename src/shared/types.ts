export type SessionStatus = 'idle' | 'running' | 'exited' | 'error'
export interface Session { id: string; title: string; createdAt: number; updatedAt: number; status: SessionStatus; messages: Message[] }
export interface Message { id: string; role: 'user' | 'assistant' | 'system'; content: string; ts: number; streaming?: boolean }
export interface MotorStatus { connected: boolean; port: string; baudRate: number; rpm: number; currentIa: number; alarmInfo: string }

export interface LlmStreamDelta { type: 'text'; content: string }
export interface LlmToolCall { type: 'tool_call'; toolName: string; arguments: Record<string, unknown> }
export interface LlmTurnEnd { type: 'turn_end' }
export interface LlmError { type: 'error'; message: string }
export interface LlmInterrupted { type: 'interrupted' }
export type LlmEvent = LlmStreamDelta | LlmToolCall | LlmTurnEnd | LlmError | LlmInterrupted

export interface BackendStarted { type: 'started'; version: string }
export interface SerialStatus { type: 'serial_status'; connected: boolean; port: string }
export interface TelemetryData { type: 'telemetry'; rpm: number; current: number; seriesRpm: number[]; seriesIa: number[] }
export interface BackendError { type: 'error'; message: string }
export interface BackendInterrupted { type: 'interrupted' }
export interface ChartClosed { type: 'chart_closed' }
export type BackendEvent = BackendStarted | SerialStatus | TelemetryData | BackendError | BackendInterrupted | ChartClosed

export interface MotraApi {
  startBackend: () => Promise<void>
  stopBackend: () => Promise<void>
  reconnect: (port: string, baud: number) => Promise<void>
  sendCommand: (action: string, payload: Record<string, unknown>) => Promise<string>
  requestStatus: () => Promise<MotorStatus>
  openMotorWindow: () => Promise<void>
  closeMotorWindow: () => Promise<void>
  sendMessage: (text: string, history: Message[]) => Promise<void>
  interrupt: () => Promise<void>
  listSessions: () => Promise<Session[]>
  deleteSession: (id: string) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  saveSession: (session: Session) => Promise<void>
  generateReport: () => Promise<string>
  onBackendEvent: (cb: (event: BackendEvent) => void) => () => void
  onLlmEvent: (cb: (event: LlmEvent) => void) => () => void
}
