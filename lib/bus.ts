// 简单类型安全事件总线 — 替代 Electron 版的 window.api.onBackendEvent/onLlmEvent

type Listener<T> = (e: T) => void

class Emitter<T> {
  private listeners = new Set<Listener<T>>()

  on(cb: Listener<T>): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  emit(e: T): void {
    for (const cb of this.listeners) {
      try { cb(e) } catch { /* 单个订阅者异常不影响其他 */ }
    }
  }
}

import type { AiMotorEvent, LlmEvent } from './types'

/** LLM 流式事件(替代 Electron 的 llm:event 广播) */
export const llmBus = new Emitter<LlmEvent>()

/** 原始串口字节(示波器 HEX 视图用) */
export const hexBus = new Emitter<Uint8Array>()

/** AI-Motor v1 主串口事件 */
export const aiMotorBus = new Emitter<AiMotorEvent>()
