/**
 * Modbus RTU 电机控制器 — Web Serial 实现(浏览器直连 DSP 从站)。
 * 请求-响应模式:写操作(寄存器/线圈)与 50ms 轮询遥测(0x03 读)通过串行事务队列交错,
 * 避免 Web Serial 读写竞争。遥测结果经 backendBus 广播(示波器数据源)。
 */

import {
  ADDR,
  DEFAULT_SLAVE,
  buildReadHoldingRegs,
  buildWriteSingleReg,
  buildWriteMultiRegs,
  buildWriteSingleCoil,
  parseReadHolding,
  float32ToRegs,
  regsToFloat32
} from './modbus'
import { backendBus, hexBus } from '../bus'
import { DEFAULT_BAUD, RPM_LIMIT } from '../config'

// ── 运行时状态 ────────────────────────────────────────────────────
let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let writer: WritableStreamDefaultWriter | null = null
let slave = DEFAULT_SLAVE
let pollingActive = false
let currentRpm = 0
let lastCurrent = 0
let currentOn = false

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

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ── 串行事务队列(防止读写竞争) ─────────────────────────────────
let txQueue: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = txQueue.then(fn)
  txQueue = run.catch(() => {})
  return run
}

// ── 单次事务:写请求 → 读固定长度响应 ────────────────────────────
async function transact(req: Uint8Array, respLen: number): Promise<Uint8Array> {
  if (!port || !port.writable || !port.readable) throw new Error('未连接串口')
  hexBus.emit(req)
  writer = port.writable.getWriter()
  try {
    await writer.write(req)
  } catch (e) {
    throw new Error(`写失败: ${String(e instanceof Error ? e.message : e)}`)
  } finally {
    try { writer.releaseLock() } catch { /* 忽略 */ }
    writer = null
  }
  // 等待从站响应
  await new Promise((r) => setTimeout(r, 4))
  const resp = new Uint8Array(respLen)
  reader = port.readable.getReader()
  let got = 0
  try {
    while (got < respLen) {
      const { value, done } = await reader.read()
      if (done || !value) break
      for (let i = 0; i < value.length && got < respLen; i++) resp[got++] = value[i]
    }
  } finally {
    try { reader.releaseLock() } catch { /* 忽略 */ }
    reader = null
  }
  hexBus.emit(resp.slice(0, got))
  return resp.slice(0, got)
}

// ── 连接/断开 ─────────────────────────────────────────────────────
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
    lastCurrent = 0
    currentOn = false
    backendBus.emit({ type: 'serial_status', connected: true, port: getPortName(), baudRate })
    startPolling()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) }
  }
}

export async function disconnect(): Promise<void> {
  pollingActive = false
  try { await reader?.cancel() } catch { /* 忽略 */ }
  try { writer?.releaseLock() } catch { /* 忽略 */ }
  reader = null
  writer = null
  const p = port
  port = null
  if (p) {
    try { await p.close() } catch { /* 忽略 */ }
  }
  currentRpm = 0
  lastCurrent = 0
  currentOn = false
  backendBus.emit({ type: 'serial_status', connected: false, port: '' })
}

// ── 遥测轮询(50ms 读 0x03) ───────────────────────────────────────
async function readTelemetry(): Promise<void> {
  const resp = await transact(buildReadHoldingRegs(slave, ADDR.ACTUAL_SPEED, 4), 5 + 8)
  const regs = parseReadHolding(resp, slave, 4)
  const rpm = regsToFloat32(regs[0], regs[1])
  const current = regsToFloat32(regs[2], regs[3])
  currentRpm = rpm
  lastCurrent = current
  backendBus.emit({
    type: 'telemetry',
    rpm,
    current,
    seriesRpm: [rpm],
    seriesIa: [current]
  })
}

async function pollingLoop(): Promise<void> {
  while (port && port.readable && pollingActive) {
    try {
      await enqueue(readTelemetry)
    } catch (e) {
      backendBus.emit({ type: 'error', message: `遥测读失败: ${String(e instanceof Error ? e.message : e)}` })
    }
    await new Promise((r) => setTimeout(r, 50))
  }
}

function startPolling(): void {
  pollingActive = true
  pollingLoop()
}

// ── 命令执行(写寄存器/线圈) ─────────────────────────────────────
/**
 * 执行电机指令。语义对齐协议文档:
 *  set_speed → 写 SPEED_SETPOINT(u16); set_motor_state → 写 COIL_MOTOR_EN;
 *  emergency_stop → 写 COIL_EMERGENCY_STOP; write_pid_* → 写保持寄存器(float32)。
 * 成功广播 executed 事件,驱动 CommandLock 解锁。
 */
export async function sendCommand(
  action: string,
  payload: Record<string, unknown>
): Promise<string> {
  if (!port || !port.writable) throw new Error('未连接串口')
  if (action === 'set_speed') {
    const rpm = Math.max(0, Math.min(RPM_LIMIT, Math.round(Number(payload.rpm) || 0)))
    currentRpm = rpm
    await enqueue(() =>
      transact(buildWriteSingleReg(slave, ADDR.SPEED_SETPOINT, rpm), 8)
    )
    const result = `OK rpm=${rpm}`
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  if (action === 'set_motor_state') {
    const on = !!payload.on
    currentOn = on
    await enqueue(() => transact(buildWriteSingleCoil(slave, ADDR.COIL_MOTOR_EN, on), 8))
    const result = `OK motor_on=${on ? 1 : 0}`
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  if (action === 'emergency_stop') {
    await enqueue(() => transact(buildWriteSingleCoil(slave, ADDR.COIL_EMERGENCY_STOP, true), 8))
    const result = 'OK emergency_stop'
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  // write_pid_<REG>:payload = { value:number } 写单个 float32 寄存器
  const pidMatch = action.match(/^write_pid_(.+)$/)
  if (pidMatch) {
    const regName = pidMatch[1]
    const addr = (ADDR as Record<string, number>)[regName]
    if (addr === undefined) throw new Error(`未知 PID 地址: ${regName}`)
    const f = Number(payload.value)
    if (!Number.isFinite(f)) throw new Error('PID 值必须为有效数字')
    const [hi, lo] = float32ToRegs(f)
    await enqueue(() => transact(buildWriteMultiRegs(slave, addr, [hi, lo]), 8))
    const result = `OK ${regName}=${f}`
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  throw new Error(`未知指令: ${action}`)
}

/** 获取当前状态快照(来自最近一次遥测轮询) */
export function getStatus(): string {
  return `rpm=${currentRpm.toFixed(0)} current=${lastCurrent.toFixed(2)} on=${currentOn ? 1 : 0}`
}
