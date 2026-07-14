import { BrowserWindow } from 'electron'
import type { Message, LlmEvent } from '../shared/types'
import { AppConfig } from './config'

export class LlmProxy {
  private win: BrowserWindow
  private controller: AbortController | null = null

  constructor(win: BrowserWindow) { this.win = win }

  abort(): void {
    if (this.controller) { this.controller.abort(); this.controller = null }
    this.emit({ type: 'interrupted' as any })
  }

  async sendMessage(text: string, history: Message[], cfg: AppConfig): Promise<void> {
    this.controller = new AbortController()
    const signal = this.controller.signal
    const systemPrompt = cfg.llm.systemPrompt || DEFAULT_PROMPT
    const messages = [{ role: 'system', content: systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }]

    try {
      const response = await fetch(cfg.llm.baseUrl + '/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.llm.apiKey}` },
        body: JSON.stringify({ model: cfg.llm.modelName, messages, tools: TOOLS, stream: true, stream_options: { include_usage: false } })
      })
      if (!response.ok) { this.emit({ type: 'error', message: `API ${response.status}` }); this.emit({ type: 'turn_end' }); return }
      const reader = response.body?.getReader()
      if (!reader) { this.emit({ type: 'error', message: 'no stream' }); this.emit({ type: 'turn_end' }); return }

      const decoder = new TextDecoder(); let buffer = ''
      const toolsAcc: Map<number, { name: string; arguments: string }> = new Map()
      let hasText = false

      while (true) {
        let done = false, value: Uint8Array | undefined
        try { const r = await reader.read(); done = r.done; value = r.value } catch { break }
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) {
          const t = line.trim(); if (!t || !t.startsWith('data: ')) continue
          const d = t.slice(6).trim(); if (d === '[DONE]') continue
          try {
            const c = JSON.parse(d); const delta = c.choices?.[0]?.delta; if (!delta) continue
            if (delta.content) { hasText = true; this.emit({ type: 'text', content: delta.content }) }
            if (delta.tool_calls) for (const tc of delta.tool_calls) {
              if (!toolsAcc.has(tc.index)) toolsAcc.set(tc.index, { name: '', arguments: '' })
              const a = toolsAcc.get(tc.index)!; if (tc.function?.name) a.name += tc.function.name
              if (tc.function?.arguments) a.arguments += tc.function.arguments
            }
          } catch { /* */ }
        }
      }
      if (hasText) this.emit({ type: 'turn_end' })
      for (const [, a] of toolsAcc) {
        try { this.emit({ type: 'tool_call', toolName: a.name, arguments: JSON.parse(a.arguments || '{}') }) }
        catch { this.emit({ type: 'tool_call', toolName: a.name, arguments: {} }) }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return // silent abort
      this.emit({ type: 'error', message: String(err.message || err) }); this.emit({ type: 'turn_end' })
    }
  }

  private emit(e: LlmEvent) { if (!this.win.isDestroyed()) this.win.webContents.send('llm:event', e) }
}

const TOOLS = [
  { type: 'function', function: { name: 'set_speed', description: '设置电机目标转速 0~6000 RPM', parameters: { type: 'object', properties: { rpm: { type: 'integer', minimum: 0, maximum: 6000 } }, required: ['rpm'] } } },
  { type: 'function', function: { name: 'set_motor_state', description: '启动或停止电机', parameters: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] } } },
  { type: 'function', function: { name: 'get_status', description: '获取电机状态', parameters: { type: 'object', properties: {} } } }
]
const DEFAULT_PROMPT = `你是电机控制助手。用户发出控制请求时，直接调用工具，不要先回复文字确认。规则：只用 set_speed/set_motor_state/get_status 三个工具，禁止代码输出，禁止修改波特率，转速 0~6000 RPM。中文。`
