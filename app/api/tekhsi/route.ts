import { NextRequest, NextResponse } from 'next/server'
import { acquire, connect, disconnect, errorText, status } from '@/lib/tekhsi/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HOST_RE =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
const CHANNEL_RE = /^[a-zA-Z0-9_.-]{1,64}$/

function bad(message: string, code = 400) {
  return NextResponse.json({ error: message }, { status: code })
}

export async function GET() {
  return NextResponse.json(status())
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return bad('请求体不是合法 JSON')
  }

  const action = body?.action
  try {
    if (action === 'connect') {
      const host = String(body?.host ?? '').trim()
      const port = Number(body?.port ?? 5000)
      if (!HOST_RE.test(host)) return bad('示波器地址不合法（填 IP 或主机名）')
      if (!Number.isInteger(port) || port < 1 || port > 65535) return bad('端口必须是 1-65535')
      const result = await connect(host, port)
      return NextResponse.json(result)
    }

    if (action === 'disconnect') {
      await disconnect()
      return NextResponse.json({ ok: true })
    }

    if (action === 'status') {
      return NextResponse.json(status())
    }

    if (action === 'acquire') {
      const channels: unknown = body?.channels
      if (!Array.isArray(channels) || channels.length === 0 || channels.length > 8) {
        return bad('channels 必须是 1-8 个通道名')
      }
      for (const c of channels) {
        if (typeof c !== 'string' || !CHANNEL_RE.test(c)) return bad(`通道名不合法: ${String(c)}`)
      }
      const maxPoints = body?.maxPoints === undefined ? undefined : Number(body.maxPoints)
      if (maxPoints !== undefined && (!Number.isInteger(maxPoints) || maxPoints < 1000 || maxPoints > 1_000_000)) {
        return bad('maxPoints 必须是 1000-1000000 的整数')
      }
      const result = await acquire(channels as string[], {
        maxPoints,
        forceSequence: Boolean(body?.forceSequence)
      })
      return NextResponse.json(result)
    }

    return bad(`未知 action: ${String(action)}`)
  } catch (e) {
    return bad(errorText(e), 502)
  }
}
