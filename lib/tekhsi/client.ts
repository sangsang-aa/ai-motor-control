// TekHSI gRPC client (server-only). Speaks to a Tektronix 4/5/6 Series MSO
// over Ethernet (default host:5000, plaintext) and returns scaled waveforms.
//
// Sequence matches the official Python client:
//   Connect → RequestAvailableNames → [RequestNewSequence] → WaitForDataAccess
//   → per channel GetHeader + GetWaveform → FinishedWithDataAccess

import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  TekAcquireResult,
  TekChannel,
  TekConnectResult,
  TekStatus
} from './types'
import { decodeAnalog, decimate } from './decode'

const PROTO_PATH = path.join(process.cwd(), 'lib/tekhsi/TekHighspeedServer.proto')
const CHUNK_SIZE = 80_000
const MAX_RECEIVE = 64 * 1024 * 1024
const GLOBAL_KEY = '__mototuneTekHsiSession'

const CONNECT_STATUS: Record<number, string> = {
  0: '未指定状态',
  1: '成功',
  2: '未连接',
  3: '时序错误（请先 Connect）',
  4: '超时',
  5: '设备已被其他客户端占用',
  6: '未知错误'
}

const WFM_STATUS: Record<number, string> = {
  0: '未指定状态',
  1: '成功',
  2: '缺少通道名',
  3: '时序错误',
  4: '未连接',
  5: '波形类型不匹配',
  6: '帧索引无效'
}

interface Session {
  host: string
  port: number
  name: string
  connectClient: any
  nativeClient: any
  channels: string[]
  protocolVersion: number
  capabilities: number
}

interface SessionSlot {
  session: Session | null
}

let tekscope: any = null

function loadTekscope(): any {
  if (tekscope) return tekscope
  const definition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: Number,
    defaults: true,
    oneofs: true
  })
  const loaded: any = grpc.loadPackageDefinition(definition)
  tekscope = loaded.Tekscope
  return tekscope
}

function slot(): SessionSlot {
  const g = globalThis as any
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { session: null }
  return g[GLOBAL_KEY] as SessionSlot
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function errorText(e: unknown): string {
  if (e && typeof e === 'object') {
    const any = e as any
    if (typeof any.details === 'string' && any.details) return any.details
    if (typeof any.message === 'string' && any.message) return any.message
  }
  return String(e)
}

function unary<T>(client: any, method: string, req: any, deadlineMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    client[method](req, { deadline: Date.now() + deadlineMs }, (err: any, res: T) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

function assertConnectStatus(reply: any, label: string) {
  if (!reply || reply.status !== 1) {
    const s = reply?.status
    throw new Error(`${label}失败：${CONNECT_STATUS[s] ?? `status=${s}`}`)
  }
}

export async function connect(host: string, port = 5000): Promise<TekConnectResult> {
  await disconnect()
  const pkg = loadTekscope()
  const address = `${host}:${port}`
  const options = { 'grpc.max_receive_message_length': MAX_RECEIVE }
  const connectClient = new pkg.Connect(address, grpc.credentials.createInsecure(), options)
  const nativeClient = new pkg.NativeData(address, grpc.credentials.createInsecure(), options)
  const name = `mototune-${randomUUID()}`

  try {
    const reply = await unary<any>(connectClient, 'Connect', { name }, 8000)
    assertConnectStatus(reply, '连接')
    const names = await unary<any>(connectClient, 'RequestAvailableNames', { name }, 8000)
    assertConnectStatus(names, '读取通道列表')
    const channels = (names.symbolnames ?? []).map((s: string) => String(s).toLowerCase())

    const session: Session = {
      host,
      port,
      name,
      connectClient,
      nativeClient,
      channels,
      protocolVersion: Number(reply.protocol_version ?? 0),
      capabilities: Number(reply.capabilities ?? 0)
    }
    slot().session = session
    return {
      host,
      port,
      protocolVersion: session.protocolVersion,
      capabilities: session.capabilities,
      channels
    }
  } catch (e) {
    try { connectClient.close() } catch {}
    try { nativeClient.close() } catch {}
    throw e
  }
}

export async function disconnect(): Promise<void> {
  const s = slot().session
  if (!s) return
  slot().session = null
  try {
    await unary<any>(s.connectClient, 'Disconnect', { name: s.name }, 3000)
  } catch {
    // Best effort: the scope may already be gone.
  }
  try { s.connectClient.close() } catch {}
  try { s.nativeClient.close() } catch {}
}

export function status(): TekStatus {
  const s = slot().session
  if (!s) return { connected: false }
  return {
    connected: true,
    host: s.host,
    port: s.port,
    protocolVersion: s.protocolVersion,
    capabilities: s.capabilities,
    channels: s.channels
  }
}

async function readChannel(session: Session, name: string, maxPoints: number): Promise<TekChannel> {
  const request = { sourcename: name, chunksize: CHUNK_SIZE }

  let header: any = null
  // Live scopes may grant data access slightly before the header is ready.
  for (let attempt = 0; attempt < 6; attempt++) {
    const reply = await unary<any>(session.nativeClient, 'GetHeader', request, 10_000)
    if (!reply || reply.status !== 1) {
      const st = reply?.status
      throw new Error(`读取 ${name} 波形头失败：${WFM_STATUS[st] ?? `status=${st}`}`)
    }
    const h = reply.headerordata?.header
    if (h && Number(h.noofsamples) > 0) {
      header = h
      break
    }
    await sleep(100)
  }
  if (!header) throw new Error(`${name} 尚未准备好数据（请确认示波器已采集）`)

  const wfmtype = Number(header.wfmtype)
  const sourcewidth = Number(header.sourcewidth)
  if (![1, 2, 3].includes(wfmtype)) {
    throw new Error(`${name} 不是模拟通道（wfmtype=${wfmtype}）`)
  }
  if (![1, 2, 4].includes(sourcewidth)) {
    throw new Error(`${name} 的采样宽度不支持（sourcewidth=${sourcewidth}）`)
  }
  if (Number(header.noofsamples) <= 0) {
    throw new Error(`${name} 没有采样点`)
  }
  if (!(Number(header.horizontalspacing) > 0)) {
    throw new Error(`${name} 的时基无效（horizontalspacing=${header.horizontalspacing}）`)
  }

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const call = session.nativeClient.GetWaveform(request, {
      deadline: Date.now() + 30_000
    })
    call.on('data', (msg: any) => {
      if (!msg || msg.status !== 1) {
        const st = msg?.status
        reject(new Error(`读取 ${name} 波形失败：${WFM_STATUS[st] ?? `status=${st}`}`))
        return
      }
      const data = msg.headerordata?.chunk?.data
      if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data))
    })
    call.on('end', resolve)
    call.on('error', reject)
  })

  const raw = Buffer.concat(chunks)
  if (raw.length === 0) throw new Error(`${name} 未返回采样数据`)
  const expected = Number(header.noofsamples) * sourcewidth
  const usable = expected > 0 && raw.length > expected ? raw.subarray(0, expected) : raw
  const scaled = decodeAnalog(
    usable,
    sourcewidth,
    Number(header.verticalspacing) || 0,
    Number(header.verticaloffset) || 0
  )
  const { values, stride } = decimate(scaled, maxPoints)

  return {
    name: String(header.sourcename || name),
    yUnits: String(header.verticalunits || ''),
    xUnits: String(header.horizontalUnits || 's'),
    dt: Number(header.horizontalspacing),
    triggerIndex: Number(header.horizontalzeroindex) || 0,
    ySpacing: Number(header.verticalspacing) || 0,
    yOffset: Number(header.verticaloffset) || 0,
    points: Number(header.noofsamples),
    samples: scaled.length,
    stride,
    y: values
  }
}

export async function acquire(
  names: string[],
  options: { maxPoints?: number; forceSequence?: boolean; waitTimeoutMs?: number } = {}
): Promise<TekAcquireResult> {
  const session = slot().session
  if (!session) throw new Error('未连接示波器')
  if (!names.length) throw new Error('请选择至少一个通道')

  const maxPoints = Math.max(1000, Math.min(1_000_000, options.maxPoints ?? 100_000))
  const waitTimeoutMs = Math.max(1000, options.waitTimeoutMs ?? 15_000)

  if (options.forceSequence) {
    const forced = await unary<any>(session.connectClient, 'RequestNewSequence', { name: session.name }, 8000)
    assertConnectStatus(forced, '请求新采集')
  }

  const granted = await unary<any>(
    session.connectClient,
    'WaitForDataAccess',
    { name: session.name },
    waitTimeoutMs
  )
  assertConnectStatus(granted, '等待数据访问')

  const result: TekAcquireResult = { capturedAt: Date.now(), channels: [], errors: [] }
  try {
    for (const name of names) {
      try {
        result.channels.push(await readChannel(session, name, maxPoints))
      } catch (e) {
        result.errors.push({ name, error: errorText(e) })
      }
    }
  } finally {
    try {
      await unary<any>(session.connectClient, 'FinishedWithDataAccess', { name: session.name }, 5000)
    } catch {
      // Releasing access is best effort; the next WaitForDataAccess can recover.
    }
  }
  return result
}
