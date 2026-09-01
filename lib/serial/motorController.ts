/**
 * 串口电机控制器 — Web Serial 实现(浏览器直连硬件)。
 *
 * 架构决策(见 AGENTS.md):SerialAdapter 接口抽象,Web 版用 Web Serial API;
 * 后续封装 Electron 时加 ElectronSerialAdapter(node-serialport via IPC)实现即可,
 * UI/store 层无感知。
 */

import { encodeCommand, FrameAssembler, RX_CHANNELS } from './protocol'
import { backendBus, hexBus } from '../bus'
import { DEFAULT_BAUD, RPM_LIMIT } from '../config'

// ── 运行时状态 ────────────────────────────────────────────────────
let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let writer: WritableStreamDefaultWriter | null = null
let readLoopActive = false
let currentRpm = 0
let currentOn = false
let lastCurrent = 0

export function isConnected(): boolean {
  return port !== null && port.readable !== null
}

export function getPortName(): string {
  if (!port) return ''
  const info = port.getInfo()
  const vid = info.usbVendorId?.toString(16).padStart(4, '0')
  const pid = info.usbProductId?.toString(16).padStart(4, '0')
  return vid && pid ? `USB:${vid}:${pid}` : 'Web Serial'
}

/** 检查当前浏览器是否支持 Web Serial */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ── 连接/断开 ─────────────────────────────────────────────────────
/**
 * 连接串口。必须在用户手势(点击)中调用 — Web Serial 要求 requestPort() 由手势触发。
 * 成功后自动启动读循环,telemetry/error 通过 backendBus 广播。
 */
export async function connect(baudRate: number = DEFAULT_BAUD): Promise<{ ok: boolean; error?: string }> {
  if (!isWebSerialSupported()) {
    return { ok: false, error: '当前浏览器不支持 Web Serial(需 Chrome/Edge,且需 HTTPS 或 localhost)' }
  }
  if (port && port.readable) return { ok: false, error: '已连接' }
  try {
    const p = await navigator.serial.requestPort()
    await p.open({ baudRate })
    port = p
    currentRpm = 0
    currentOn = false
    lastCurrent = 0
    backendBus.emit({ type: 'serial_status', connected: true, port: getPortName(), baudRate })
    startReadLoop()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) }
  }
}

/** 断开串口:取消读循环、关闭读写流。断开时清零状态。 */
export async function disconnect(): Promise<void> {
  readLoopActive = false
  try { await reader?.cancel() } catch { /* 忽略 */ }
  reader = null
  try { writer?.releaseLock() } catch { /* 忽略 */ }
  writer = null
  const p = port
  port = null
  if (p) {
    try { await p.close() } catch { /* 忽略 */ }
  }
  currentRpm = 0
  currentOn = false
  lastCurrent = 0
  backendBus.emit({ type: 'serial_status', connected: false, port: '' })
}

// ── 读循环:串口字节流 -> 帧 -> telemetry 事件 ────────────────────
async function startReadLoop(): Promise<void> {
  if (!port || readLoopActive) return
  readLoopActive = true
  const assembler = new FrameAssembler(RX_CHANNELS)
  while (port && port.readable && readLoopActive) {
    reader = port.readable.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value || value.length === 0) continue
        // 原始字节 -> HEX 视图
        hexBus.emit(value)
        // 字节流 -> 帧
        const frames = assembler.feed(value)
        for (const frame of frames) {
          // frame: Float64Array[] 每通道一列(600 点)
          const ia = frame[0]
          const rpm = frame[1]
          if (!ia || !rpm || ia.length === 0) continue
          const lastIa = ia[ia.length - 1]
          const lastRpm = rpm[rpm.length - 1]
          currentRpm = lastRpm
          lastCurrent = lastIa
          backendBus.emit({
            type: 'telemetry',
            rpm: lastRpm,
            current: lastIa,
            seriesRpm: Array.from(rpm),
            seriesIa: Array.from(ia)
          })
        }
      }
    } catch (e) {
      backendBus.emit({ type: 'error', message: String(e instanceof Error ? e.message : e) })
      break
    } finally {
      try { reader.releaseLock() } catch { /* 忽略 */ }
    }
  }
  readLoopActive = false
  // 流结束(设备拔出/取消):若仍视为连接,标记断开
  if (port && readLoopActive === false) {
    // 手动断开走 disconnect(),此处只处理异常断流
    if (port.readable === null) {
      backendBus.emit({ type: 'serial_status', connected: false, port: '' })
    }
  }
}

// ── 命令执行 ─────────────────────────────────────────────────────
/**
 * 执行电机指令,返回结果字符串。
 * 与 Electron 版语义一致:set_speed 同时置 motor_on=1(host Mux 行为);
 * 成功写串口后广播 executed 事件(驱动 CommandLock 解锁)。
 */
export async function sendCommand(
  action: string,
  payload: Record<string, unknown>
): Promise<string> {
  if (!port || !port.writable) throw new Error('未连接串口')
  let bytes: Uint8Array
  if (action === 'set_speed') {
    const rpm = Math.max(0, Math.min(RPM_LIMIT, Math.round(Number(payload.rpm) || 0)))
    currentRpm = rpm
    currentOn = true // 与 python 版 set_speed -> send_command(rpm, on=1) 一致
    bytes = encodeCommand([currentRpm, 1])
  } else if (action === 'set_motor_state') {
    const on = payload.on ? 1 : 0
    currentOn = !!payload.on
    bytes = encodeCommand([currentRpm, on])
  } else {
    throw new Error(`未知指令: ${action}`)
  }
  writer = port.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    try { writer.releaseLock() } catch { /* 忽略 */ }
    writer = null
  }
  const result = `OK rpm=${currentRpm} on=${currentOn ? 1 : 0}`
  backendBus.emit({ type: 'executed', action, result })
  return result
}

/** 获取当前状态快照(与 python 版 get_status 语义一致) */
export function getStatus(): string {
  return `rpm=${currentRpm.toFixed(0)} current=${lastCurrent.toFixed(2)}`
}
