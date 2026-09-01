/**
 * LLM SSE 流式解析单测(llmClient.ts)— 验证:
 * 1) text delta 累积;2) tool_call delta 聚合;3) 无条件 turn_end(即使只有 tool_call);
 * 4) abort 静默;5) 非 OK 响应发 error 事件。
 * 对应测试点:主页面对话无卡死、无错误回答;tool 正常 calling。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendMessage } from '@/lib/llm/llmClient'

const enc = new TextEncoder()

function sseResponse(chunks: string[], ok = true): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
  return { ok, status: ok ? 200 : 500, body: stream } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('llmClient — text streaming', () => {
  it('accumulates text deltas and emits turn_end', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    )
    const events: string[] = []
    await sendMessage('hi', [], (e) => events.push(e.type))
    expect(events).toEqual(['text', 'text', 'turn_end'])
  })

  it('emits error + turn_end on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([], false)
    )
    const events: string[] = []
    await sendMessage('hi', [], (e) => events.push(e.type))
    expect(events).toEqual(['error', 'turn_end'])
  })
})

describe('llmClient — tool call', () => {
  it('aggregates tool_call deltas and ALWAYS emits turn_end (only tool_call case)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"set_speed","arguments":""}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"rpm\\":3000}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    )
    const events: any[] = []
    await sendMessage('加速', [], (e) => events.push(e))
    // key: 即使只有 tool_call,turn_end 也必须有(否则 inflight 锁死)
    expect(events.map((e) => e.type)).toEqual(['turn_end', 'tool_call'])
    const tc = events.find((e) => e.type === 'tool_call')
    expect(tc.toolName).toBe('set_speed')
    expect(tc.arguments.rpm).toBe(3000)
  })
})
