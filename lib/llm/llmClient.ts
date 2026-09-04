/**
 * LLM 流式客户端(浏览器端)— 解析逻辑从 Electron 版 src/main/llmProxy.ts 迁移。
 * 请求发往同源 /api/llm(服务端代理保护 API key + 绕 CORS),SSE 解析在浏览器完成。
 */

import type { Message, LlmEvent } from '../types'
import { loadSettings } from '../settings'

let controller: AbortController | null = null

/** 中断当前请求;由应用层负责把 interrupted 事件写入会话 */
export function abort(): void {
  if (controller) {
    controller.abort()
    controller = null
  }
}

export async function sendMessage(
  text: string,
  history: Message[],
  onEvent: (e: LlmEvent) => void
): Promise<void> {
  controller = new AbortController()
  const signal = controller.signal
  try {
    const cfg = loadSettings()
    const config = {
      baseUrl: cfg.baseUrl || undefined,
      apiKey: cfg.apiKey || undefined,
      model: cfg.model || undefined
    }
    const response = await fetch('/api/llm', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, history, config })
    })
    if (!response.ok) {
      const msg = await response.text().catch(() => '')
      onEvent({ type: 'error', message: msg || `API ${response.status}` })
      onEvent({ type: 'turn_end' })
      return
    }
    const reader = response.body?.getReader()
    if (!reader) {
      onEvent({ type: 'error', message: 'no stream' })
      onEvent({ type: 'turn_end' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const toolsAcc = new Map<number, { name: string; arguments: string }>()

    while (true) {
      let done = false
      let value: Uint8Array | undefined
      try {
        const r = await reader.read()
        done = r.done
        value = r.value
      } catch {
        break
      }
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t || !t.startsWith('data: ')) continue
        const d = t.slice(6).trim()
        if (d === '[DONE]') continue
        try {
          const c = JSON.parse(d)
          const delta = c.choices?.[0]?.delta
          if (!delta) continue
          if (delta.content) onEvent({ type: 'text', content: delta.content })
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolsAcc.has(tc.index)) toolsAcc.set(tc.index, { name: '', arguments: '' })
              const acc = toolsAcc.get(tc.index)!
              if (tc.function?.name) acc.name += tc.function.name
              if (tc.function?.arguments) acc.arguments += tc.function.arguments
            }
          }
        } catch {
          /* 忽略单行解析失败 */
        }
      }
    }
    // 关键:无条件发 turn_end(即使只有 tool_call),否则 inflight 锁死(AGENTS.md 记载的坑)
    onEvent({ type: 'turn_end' })
    for (const [, a] of toolsAcc) {
      try {
        onEvent({ type: 'tool_call', toolName: a.name, arguments: JSON.parse(a.arguments || '{}') })
      } catch {
        onEvent({ type: 'tool_call', toolName: a.name, arguments: {} })
      }
    }
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError') return // 静默中止(应用层已发 interrupted)
    onEvent({ type: 'error', message: String(e.message || e) })
    onEvent({ type: 'turn_end' })
  }
}
