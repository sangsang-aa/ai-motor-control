/**
 * LLM 代理(服务端)— 唯一保留的服务端能力。
 *
 * 职责:保护 API key(不暴露给浏览器)+ 绕 CORS + 注入 tools/system_prompt。
 * 配置:env LLM_BASE_URL / LLM_API_KEY / LLM_MODEL(见 .env.example)。
 *
 * 封装 Electron 时(见 AGENTS.md):此代理逻辑可整体搬入主进程,或继续 next start 运行。
 */
import { NextRequest } from 'next/server'
import { TOOLS, SYSTEM_PROMPT } from '@/lib/llm/tools'
import type { Message, KnowledgePayload } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let text: string
  let history: Message[]
  let cfg: { baseUrl?: string; apiKey?: string; model?: string } = {}
  let systemPrompt: string | undefined
  let knowledge: KnowledgePayload | undefined
  try {
    const body = await req.json()
    text = String(body.text ?? '')
    history = Array.isArray(body.history) ? body.history : []
    cfg = body.config && typeof body.config === 'object' ? body.config : {}
    systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : undefined
    knowledge = body.knowledge && typeof body.knowledge === 'object' ? (body.knowledge as KnowledgePayload) : undefined
  } catch {
    return new Response('invalid body', { status: 400 })
  }
  if (!text.trim()) return new Response('empty text', { status: 400 })

  // 设置面板配置优先(用户填的 baseUrl/apiKey/model),env 仅作可选回退。
  // 无 .env.local 也可用:用户在设置面板填入 AI 供应商信息即可,key 存 localStorage 随请求传递。
  const baseUrl = cfg.baseUrl || process.env.LLM_BASE_URL || ''
  const apiKey = cfg.apiKey || process.env.LLM_API_KEY || ''
  const model = cfg.model || process.env.LLM_MODEL || ''
  if (!baseUrl || !apiKey) {
    return new Response('LLM 未配置: 请在设置的"AI 供应商"中填入 API Key(或配置服务端 .env.local)', { status: 500 })
  }

  const kbText = knowledge?.texts?.length
    ? '【知识库】\n' + knowledge.texts.map((t) => `### ${t.name}\n${t.text}`).join('\n\n')
    : ''
  const kbImages = knowledge?.images ?? []

  const baseMessages: { role: string; content: unknown }[] = [
    { role: 'system', content: systemPrompt?.trim() || SYSTEM_PROMPT },
    ...(kbText ? [{ role: 'system', content: kbText }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content }))
  ]
  const textOnlyMessages = [...baseMessages, { role: 'user', content: text }]
  const withImagesMessages = kbImages.length
    ? [
        ...baseMessages,
        {
          role: 'user',
          content: [
            { type: 'text', text },
            ...kbImages.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
          ]
        }
      ]
    : textOnlyMessages

  const callUpstream = (msgs: unknown[]) =>
    fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: msgs,
        tools: TOOLS,
        stream: true,
        stream_options: { include_usage: false }
      })
    })

  try {
    let upstream = await callUpstream(withImagesMessages)
    let imagesDropped = false
    if ((!upstream.ok || !upstream.body) && kbImages.length > 0) {
      // 上游不支持图片 → 去图重试(仅文本知识库),并告知客户端已忽略图片
      upstream = await callUpstream(textOnlyMessages)
      imagesDropped = upstream.ok
    }
    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '')
      return new Response(`upstream ${upstream.status}: ${errText}`, { status: upstream.status })
    }
    // SSE 透传 — 解析在浏览器端(llmClient.ts)
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...(imagesDropped ? { 'X-Knowledge-Images-Dropped': '1' } : {})
      }
    })
  } catch (e) {
    return new Response(`upstream error: ${String(e instanceof Error ? e.message : e)}`, { status: 502 })
  }
}
