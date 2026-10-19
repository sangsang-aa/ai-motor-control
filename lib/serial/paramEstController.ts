/**
 * 参数辨识串口控制器 —— Web Serial 实现(独立通道,不复用 Modbus)。
 *
 * 流程:连接 → 发命令 → startAcquisition(持续采集原始测量) → 空闲超时判定停止
 *       → 数据可用性判定(完整性+有效性) → 辨识 → 广播结果 / 「出现数据错误」。
 * 采集与辨识不同时进行。
 */

import { paramEstBus } from '../bus'
import { PARAM_EST_BAUD, IDLE_TIMEOUT_MS, BLOCK_FRAMES } from '../config'
import {
  createStreamParser,
  parseStream,
  encodeControl,
  encodeParam,
  bytesToHex,
  type StreamParserState
} from './mcbHostProtocol'
import { assessQuality } from '../analysis/quality'
import { estimateWithPrior, type PriorResults } from '../analysis/paramEstimation'
import type { ControlWord, PmTestId } from '../types'

export type AcquisitionPhase = 'disconnected' | 'ready' | 'acquiring' | 'done'

// ── 运行时状态 ────────────────────────────────────────────────────
let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let reading = false
let epoch = 0

let phase: AcquisitionPhase = 'disconnected'
let parser: StreamParserState = createStreamParser()
let samples: { a: number; b: number }[] = []
let frameCount = 0
let blockCount = 0
let byteCount = 0
let lastDataAt: number | null = null
let idleTimer: ReturnType<typeof setInterval> | null = null
let lastControl: ControlWord | null = null
/** 已得参数(供 Ld/Lq 用 Rs、Ke 用 Rs/Ld) */
let lastResults: PriorResults = {}

const XDS110_VENDOR = 0x0451
const XDS110_PRODUCT = 0xbef3

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export function isConnected(): boolean {
  return port !== null && port.readable !== null
}

export function getPhase(): AcquisitionPhase {
  return phase
}

export function getPortName(): string {
  if (!port) return ''
  const info = port.getInfo()
  const vid = info.usbVendorId?.toString(16).padStart(4, '0')
  const pid = info.usbProductId?.toString(16).padStart(4, '0')
  return vid && pid ? `USB:${vid}:${pid}` : 'Web Serial'
}

// ── 连接 / 断开 ───────────────────────────────────────────────────
export async function connect(baudRate: number = PARAM_EST_BAUD): Promise<{ ok: boolean; error?: string }> {
  if (!isWebSerialSupported()) {
    const error = '当前浏览器不支持 Web Serial(需 Chrome/Edge,且需 HTTPS 或 localhost)'
    paramEstBus.emit({ type: 'pe_error', message: error })
    return { ok: false, error }
  }
  if (port && port.readable) {
    const error = '已连接'
    paramEstBus.emit({ type: 'pe_error', message: error })
    return { ok: false, error }
  }

  try {
    const selected = await navigator.serial.requestPort()
    await selected.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      bufferSize: 4096,
      flowControl: 'none'
    })
    port = selected
    // XDS110 COM 驱动支持 DTR;失败时报告,不吞异常。非 XDS110 设备忽略。
    const isXds = selected.getInfo().usbVendorId === XDS110_VENDOR && selected.getInfo().usbProductId === XDS110_PRODUCT
    if (isXds) {
      try {
        await selected.setSignals({ dataTerminalReady: false })
      } catch (e) {
        await closePort(selected)
        return { ok: false, error: `设置 XDS110 DTR=false 失败: ${String(e instanceof Error ? e.message : e)}` }
      }
      await new Promise((r) => setTimeout(r, 100))
    }

    phase = 'ready'
    const myEpoch = ++epoch
    paramEstBus.emit({ type: 'pe_status', connected: true, port: getPortName(), baudRate })
    void readLoop(myEpoch)
    startIdleWatch()
    return { ok: true }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e)
    // 串口被占用时给出明确引导(方案 A 互斥)
    const friendly = /already open|in use|access|busy|占用/i.test(msg)
      ? `串口打开失败(可能已被主程序/桥接占用,同一 COM 口同时只能有一个连接): ${msg}`
      : `串口打开失败: ${msg}`
    paramEstBus.emit({ type: 'pe_error', message: friendly })
    return { ok: false, error: friendly }
  }
}

async function closePort(expected: SerialPort | null): Promise<void> {
  if (!expected || port !== expected) return
  reading = false
  if (idleTimer) {
    clearInterval(idleTimer)
    idleTimer = null
  }
  const r = reader
  reader = null
  try {
    await r?.cancel()
  } catch {
    /* ignore */
  }
  try {
    r?.releaseLock()
  } catch {
    /* ignore */
  }
  port = null
  phase = 'disconnected'
  lastResults = {}
  try {
    await expected.close()
  } catch {
    /* ignore */
  }
  paramEstBus.emit({ type: 'pe_status', connected: false, port: '', baudRate: 0 })
}

export async function disconnect(): Promise<void> {
  epoch++
  const p = port
  await closePort(p)
}

// ── 读取循环 ──────────────────────────────────────────────────────
async function readLoop(myEpoch: number): Promise<void> {
  reading = true
  while (reading && epoch === myEpoch && port?.readable) {
    const r = port.readable.getReader()
    reader = r
    try {
      for (;;) {
        const { value, done } = await r.read()
        if (done) break
        if (value && value.length > 0) onBytes(value)
      }
    } catch (e) {
      if (epoch === myEpoch) {
        paramEstBus.emit({ type: 'pe_error', message: `串口读取失败: ${String(e instanceof Error ? e.message : e)}` })
      }
    } finally {
      try {
        r.releaseLock()
      } catch {
        /* ignore */
      }
      if (reader === r) reader = null
    }
  }
}

function onBytes(chunk: Uint8Array): void {
  byteCount += chunk.length
  lastDataAt = Date.now()
  if (phase !== 'acquiring') return // 非采集阶段:只收不缓存

  const out = parseStream(chunk, parser)
  for (const f of out.frames) samples.push({ a: f.a, b: f.b })
  frameCount += out.frames.length
  blockCount += out.completedBlocks

  if (frameCount > 0 && frameCount % 60 === 0) {
    paramEstBus.emit({ type: 'pe_progress', frames: frameCount, blocks: blockCount, bytes: byteCount })
  }
}

// ── 采集控制 ──────────────────────────────────────────────────────
export function startAcquisition(): void {
  parser = createStreamParser()
  samples = []
  frameCount = 0
  blockCount = 0
  byteCount = 0
  lastDataAt = null
  phase = 'acquiring'
  paramEstBus.emit({ type: 'pe_progress', frames: 0, blocks: 0, bytes: 0 })
}

function startIdleWatch(): void {
  if (idleTimer) clearInterval(idleTimer)
  idleTimer = setInterval(() => {
    // 采集阶段 + 已收到过数据 + 连续空闲 ≥ 阈值 → 判定停止
    if (phase === 'acquiring' && lastDataAt !== null && Date.now() - lastDataAt >= IDLE_TIMEOUT_MS) {
      finalize()
    }
  }, 30)
}

function finalize(): void {
  phase = 'done'

  // 供页面查看本次采集波形(降采样)
  const MAX_WAVE = 2000
  const step = Math.max(1, Math.ceil(samples.length / MAX_WAVE))
  const wa: number[] = []
  const wb: number[] = []
  for (let i = 0; i < samples.length; i += step) {
    wa.push(samples[i].a)
    wb.push(samples[i].b)
  }
  paramEstBus.emit({ type: 'pe_waveform', a: wa, b: wb })

  const quality = assessQuality(samples, frameCount, blockCount)

  if (!quality.ok) {
    // 不可用 → 抛弃数据 + 页面提示
    samples = []
    paramEstBus.emit({ type: 'pe_data_error', message: '出现数据错误', quality })
    return
  }

  const test = (lastControl?.test ?? 0) as PmTestId
  const result = estimateWithPrior(test, samples, { rBoard: 0, Rs: lastResults.Rs, Ld: lastResults.Ld })
  lastResults = { ...lastResults, ...result }

  paramEstBus.emit({ type: 'pe_result', result, quality })
}

// ── 命令下发 ──────────────────────────────────────────────────────
async function write(bytes: Uint8Array): Promise<void> {
  if (!port || !port.writable) throw new Error('未连接串口')
  const w = port.writable.getWriter()
  try {
    await w.write(bytes)
  } finally {
    try {
      w.releaseLock()
    } catch {
      /* ignore */
    }
  }
}

export async function sendControl(w: ControlWord): Promise<void> {
  lastControl = w
  await write(encodeControl(w))
}

export async function sendParam(index1based: number, value: number): Promise<void> {
  await write(encodeParam(index1based, value))
}

/** 清空已得参数(与页面「清空」一致) */
export function clearResults(): void {
  lastResults = {}
}

// 供测试/调试
export function __debugHex(bytes: Uint8Array): string {
  return bytesToHex(bytes)
}

export const BLOCK_SIZE = BLOCK_FRAMES
