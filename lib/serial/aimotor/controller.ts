// AI-Motor v1 主串口控制器 — Web Serial + HELLO/心跳/ACK 重试/STOP 优先/5s 超时。
// 事件经 aiMotorBus 广播;UI 不直接接触串口细节。

import { aiMotorBus, hexBus } from '@/lib/bus'
import {
  AI_MOTOR_BAUD,
  PACKET,
  CMD,
  ACK_STATUS,
  Decoder,
  command,
  decodeAck,
  decodeConfig,
  decodeModel,
  decodeSample,
  type Ack,
  type CommandId,
  type Model,
  type Packet,
  type Sample
} from './protocol'
import { clampCommandRpm, getParam, validateAiParam, validateParamValue } from './params'

const ACK_TIMEOUT_MS = 800
const HELLO_TIMEOUT_MS = 1200
const HEARTBEAT_MS = 100
const DATA_TIMEOUT_MS = 5000
const SETTLE_MS = 100

let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
let reading = false
let connected = false
let handshake = false
let portName = ''
let baud = AI_MOTOR_BAUD
let seq = 0
let lastPacketAt = 0
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let watchdogTimer: ReturnType<typeof setInterval> | null = null
let activeMode = 6
let lastSample: Sample | null = null
let lastModel: Model | null = null
let config = new Map<string, number>()

interface PendingCommand {
  seq: number
  cmd: number
  timer: ReturnType<typeof setTimeout> | null
  retries: number
  bytes: Uint8Array
  resolve: (a: Ack) => void
  reject: (e: Error) => void
}

let pending: PendingCommand | null = null

function nextSeq(): number {
  seq = (seq + 1) & 0xffff
  return seq
}

function portLabel(p: SerialPort): string {
  try {
    const info = p.getInfo?.()
    if (info?.usbVendorId != null && info?.usbProductId != null) {
      const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')
      const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0')
      return `USB:${vid}:${pid}`
    }
  } catch {
    /* ignore */
  }
  return 'serial'
}

function emitStatus(): void {
  aiMotorBus.emit({ type: 'ai_status', connected, port: portName, baudRate: baud })
}

async function writeRaw(bytes: Uint8Array): Promise<void> {
  if (!writer) throw new Error('未连接串口')
  await writer.write(bytes)
}

function handlePacket(p: Packet): void {
  lastPacketAt = Date.now()
  if (p.kind === PACKET.ACK) {
    const ack = decodeAck(p)
    if (pending && pending.seq === p.seq && pending.cmd === ack.command) {
      const pnd = pending
      pending = null
      if (pnd.timer) clearTimeout(pnd.timer)
      pnd.resolve(ack)
    }
    aiMotorBus.emit({ type: 'ai_ack', command: ack.command, status: ack.status, param: ack.param, value: ack.value })
  } else if (p.kind === PACKET.SAMPLE) {
    const sample = decodeSample(p)
    lastSample = sample
    if (sample.mode) activeMode = sample.mode
    aiMotorBus.emit({ type: 'ai_sample', sample })
  } else if (p.kind === PACKET.MODEL) {
    lastModel = decodeModel(p)
    aiMotorBus.emit({ type: 'ai_model', model: lastModel })
  } else if (p.kind === PACKET.CONFIG) {
    const records = decodeConfig(p)
    for (const r of records) config.set(`${r.mode}:${r.param}`, r.value)
    aiMotorBus.emit({ type: 'ai_config', records })
  }
}

function request(cmd: CommandId, mode = 0, param = 0, value = 0, timeoutMs = ACK_TIMEOUT_MS): Promise<Ack> {
  if (!writer) return Promise.reject(new Error('未连接串口'))
  if (!handshake && cmd !== CMD.HELLO && cmd !== CMD.STOP) return Promise.reject(new Error('尚未握手'))
  if (pending) return Promise.reject(new Error('上一条命令尚未确认'))
  const s = nextSeq()
  const bytes = command(s, cmd, mode, param, value)
  return new Promise<Ack>((resolve, reject) => {
    const pnd: PendingCommand = { seq: s, cmd, timer: null, retries: 0, bytes, resolve, reject }
    pending = pnd
    const arm = () => {
      pnd.timer = setTimeout(() => {
        if (pending !== pnd) return
        if (pnd.retries < 2) {
          pnd.retries++
          void writeRaw(pnd.bytes).catch(() => {})
          arm()
        } else {
          pending = null
          reject(new Error(`命令未确认 (cmd=${cmd})`))
        }
      }, timeoutMs)
    }
    arm()
    void writeRaw(bytes).catch((e: unknown) => {
      if (pending === pnd) {
        pending = null
        if (pnd.timer) clearTimeout(pnd.timer)
      }
      reject(e instanceof Error ? e : new Error(String(e)))
    })
  })
}

async function readLoop(r: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  const decoder = new Decoder()
  try {
    while (reading) {
      const { value, done } = await r.read()
      if (done) break
      if (value && value.length) {
        hexBus.emit(value)
        for (const packet of decoder.feed(value)) handlePacket(packet)
      }
    }
  } catch (e) {
    if (reading) aiMotorBus.emit({ type: 'ai_error', message: (e as Error)?.message ?? String(e) })
  }
}

function stopTimers(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (watchdogTimer) clearInterval(watchdogTimer)
  heartbeatTimer = null
  watchdogTimer = null
}

function startTimers(): void {
  stopTimers()
  lastPacketAt = Date.now()
  heartbeatTimer = setInterval(() => {
    if (!handshake || !writer) return
    void writeRaw(command(nextSeq(), CMD.HEARTBEAT)).catch(() => {})
  }, HEARTBEAT_MS)
  watchdogTimer = setInterval(() => {
    if (connected && Date.now() - lastPacketAt > DATA_TIMEOUT_MS) {
      aiMotorBus.emit({ type: 'ai_error', message: '下位机数据超时；禁止自动恢复启动' })
      void disconnect()
    }
  }, 500)
}

export async function connect(baudRate: number = AI_MOTOR_BAUD): Promise<{ ok: boolean; error?: string }> {
  if (connected || port) return { ok: true }
  if (!navigator.serial) return { ok: false, error: '当前浏览器不支持 Web Serial（请用 Chrome/Edge）' }
  let p: SerialPort
  try {
    p = await navigator.serial.requestPort()
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) }
  }
  try {
    await p.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096, flowControl: 'none' })
    port = p
    baud = baudRate
    portName = portLabel(p)
    try {
      await p.setSignals({ dataTerminalReady: false })
    } catch {
      /* USB-TTL 适配器可能不支持 DTR */
    }
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    if (!p.readable || !p.writable) throw new Error('串口不可读写')
    reader = p.readable.getReader()
    writer = p.writable.getWriter()
    reading = true
    handshake = false
    void readLoop(reader)
    let ack: Ack
    try {
      ack = await request(CMD.HELLO, 0, 0, 0, HELLO_TIMEOUT_MS)
    } catch (e) {
      throw new Error(`握手失败: ${(e as Error).message}`)
    }
    if (ack.status !== 0) throw new Error(`握手失败: ${ACK_STATUS[ack.status] ?? ack.status}`)
    handshake = true
    connected = true
    emitStatus()
    void writeRaw(command(nextSeq(), CMD.GET_CONFIG)).catch(() => {})
    startTimers()
    return { ok: true }
  } catch (e) {
    await disconnect()
    return { ok: false, error: (e as Error)?.message ?? String(e) }
  }
}

export async function disconnect(): Promise<void> {
  reading = false
  stopTimers()
  if (pending) {
    if (pending.timer) clearTimeout(pending.timer)
    pending.reject(new Error('连接已关闭'))
    pending = null
  }
  if (writer && handshake) {
    try {
      await writer.write(command(nextSeq(), CMD.STOP))
    } catch {
      /* ignore */
    }
  }
  try {
    await reader?.cancel()
  } catch {
    /* ignore */
  }
  try {
    reader?.releaseLock()
  } catch {
    /* ignore */
  }
  try {
    writer?.releaseLock()
  } catch {
    /* ignore */
  }
  try {
    if (port) await port.close()
  } catch {
    /* ignore */
  }
  reader = null
  writer = null
  port = null
  connected = false
  handshake = false
  aiMotorBus.emit({ type: 'ai_closed' })
  emitStatus()
}

export function isWebSerialSupported(): boolean {
  return !!navigator.serial
}

export function isConnected(): boolean {
  return connected
}

export function getPortName(): string {
  return portName
}

export function getLastSample(): Sample | null {
  return lastSample
}

export function getLastModel(): Model | null {
  return lastModel
}

export function getConfigValue(mode: number, param: number): number | undefined {
  return config.get(`${mode}:${param}`)
}

export function getStatus(): string {
  if (!lastSample) return connected ? '已连接，等待遥测…' : '未连接'
  const s = lastSample
  const parts = [
    `mode=${s.mode}`,
    `stage=${s.stage}`,
    `rpm=${s.speed.toFixed(0)}`,
    `ref=${s.reference.toFixed(0)}`,
    `id=${s.id.toFixed(2)}`,
    `iq=${s.iq.toFixed(2)}`,
    `flags=${s.flags}`,
    `err=${s.error}`
  ]
  if (lastModel) {
    parts.push(
      `Rs=${lastModel.rs.toFixed(4)}`,
      `Ld=${(lastModel.ld * 1e6).toFixed(1)}uH`,
      `Lq=${(lastModel.lq * 1e6).toFixed(1)}uH`
    )
  }
  return parts.join(' ')
}

export async function sendManualParam(id: number, value: number, mode = 7): Promise<string> {
  const def = getParam(id)
  if (!def) throw new Error(`未知参数 ID: ${id}`)
  const lookup = (pid: number) => getConfigValue(mode, pid) ?? getConfigValue(0, pid)
  const check = validateParamValue(def, value, lookup)
  if (!check.ok) throw new Error(check.reason)
  const ack = await request(CMD.SET_PARAM, mode, id, value)
  if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
  return `OK ${def.key}=${value} (mode ${mode})`
}

async function stopAndReport(action: string, result: string): Promise<string> {  const ack = await request(CMD.STOP)
  if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
  activeMode = 5
  aiMotorBus.emit({ type: 'ai_executed', action, result })
  return result
}

export async function sendCommand(action: string, payload: Record<string, unknown>): Promise<string> {
  if (action === 'set_speed') {
    const rpm = clampCommandRpm(Math.round(Number(payload.rpm) || 0))
    const mode = activeMode === 6 || activeMode === 8 ? activeMode : 6
    const ack = await request(CMD.SET_PARAM, mode, 1, rpm)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    const result = `OK rpm=${rpm}`
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  if (action === 'set_motor_state') {
    if (!payload.on) return stopAndReport(action, 'OK motor_on=0')
    const mode = activeMode === 7 || activeMode === 8 ? activeMode : 6
    let ack = await request(CMD.SET_MODE, mode)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    ack = await request(CMD.ENABLE, mode)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    activeMode = mode
    const result = `OK motor_on=1 mode=${mode}`
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  if (action === 'emergency_stop') return stopAndReport(action, 'OK emergency_stop')

  if (action === 'set_mode') {
    const mode = Number(payload.mode)
    if (![5, 6, 7, 8].includes(mode)) throw new Error('模式只允许 5/6/7/8')
    const ack = await request(CMD.SET_MODE, mode)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    activeMode = mode
    const result = `OK mode=${mode}`
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  if (action === 'set_param') {
    const id = Number(payload.param)
    const value = Number(payload.value)
    const def = getParam(id)
    if (!def) throw new Error(`未知参数 ID: ${id}`)
    const rawMode = payload.mode === undefined ? undefined : Number(payload.mode)
    const mode = rawMode !== undefined && [0, 6, 7, 8].includes(rawMode)
      ? rawMode
      : def.modes.includes(activeMode) ? activeMode : def.modes[0] ?? 0
    const lookup = (pid: number) => getConfigValue(mode, pid) ?? getConfigValue(0, pid)
    const check = validateAiParam(id, value, lookup)
    if (!check.ok) throw new Error(check.reason)
    const ack = await request(CMD.SET_PARAM, mode, id, value)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    const result = `OK ${def.key}=${value} (mode ${mode})`
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  if (action === 'clear_emergency_stop') {
    await stopAndReport(action, 'OK stop')
    const ack = await request(CMD.SET_MODE, 5)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    const result = 'OK emergency_stop cleared'
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  const pid = action.match(/^write_pid_(\d+)$/)
  if (pid) {
    const id = Number(pid[1])
    const def = getParam(id)
    if (!def) throw new Error(`未知参数: ${id}`)
    const value = Number(payload.value)
    if (!Number.isFinite(value)) throw new Error('参数值必须为有效数字')
    const mode = activeMode === 6 || activeMode === 8 ? activeMode : 6
    const lookup = (pid: number) => getConfigValue(mode, pid) ?? getConfigValue(0, pid)
    const check = validateAiParam(id, value, lookup)
    if (!check.ok) throw new Error(check.reason)
    const ack = await request(CMD.SET_PARAM, mode, id, value)
    if (ack.status !== 0) throw new Error(ACK_STATUS[ack.status] ?? `status ${ack.status}`)
    const result = `OK ${def.key}=${value}`
    aiMotorBus.emit({ type: 'ai_executed', action, result })
    return result
  }

  throw new Error(`未知指令: ${action}`)
}
