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
import { DEFAULT_BAUD, RPM_LIMIT, BRIDGE_URL } from '../config'
import { BridgePort } from './bridge'

// ── 运行时状态 ────────────────────────────────────────────────────
let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let writer: WritableStreamDefaultWriter | null = null
let slave = DEFAULT_SLAVE
let pollingActive = false
let currentRpm = 0
let lastCurrent = 0
let currentOn = false
/** 桥接模式时记录了 ws 地址,便于 getPortName 显示 */
let bridgeUrl: string | null = null

export function isConnected(): boolean {
  return port !== null && port.readable !== null
}

export function getPortName(): string {
  if (!port) return ''
  if (bridgeUrl) return `Bridge(${bridgeUrl.replace(/^ws:\/\//, '')})`
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

// ── 单次事务:写请求 → 读固定长度响应(带超时,防桥接/从站响应缺失时队列死锁) ──
const XACT_TIMEOUT = 500 // ms

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
  // 等待从站响应(带超时;超时抛错,避免 respLen 读不到时永久卡住队列)
  await new Promise((r) => setTimeout(r, 4))
  const resp = new Uint8Array(respLen)
  reader = port.readable.getReader()
  let got = 0
  try {
    const deadline = Date.now() + XACT_TIMEOUT
    while (got < respLen) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error(`读取超时(${XACT_TIMEOUT}ms): 期望 ${respLen} 字节,实收 ${got}`)
      const { value, done } = await withTimeout(reader.read(), remaining)
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

/** 给 Promise 包一层超时,超时抛错(不取消底层,仅释放调用方等待) */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`桥接/串口读取超时 ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer!)
  }
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

/**
 * 桥接模式连接:浏览器不直接开串口,改连本地 serial_bridge.py(WebSocket)。
 * 桥接服务独占 COM 并将每帧通讯打印到控制台 —— 支持"上位机测试 + tools 监控并行"。
 */
export async function connectBridge(url: string = BRIDGE_URL): Promise<{ ok: boolean; error?: string }> {
  if (port && port.readable) return { ok: false, error: '已连接' }
  try {
    const p = await BridgePort.open(url)
    port = p as unknown as SerialPort
    bridgeUrl = url
    currentRpm = 0
    lastCurrent = 0
    currentOn = false
    backendBus.emit({ type: 'serial_status', connected: true, port: getPortName(), baudRate: 0 })
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
  bridgeUrl = null
  currentRpm = 0
  lastCurrent = 0
  currentOn = false
  backendBus.emit({ type: 'serial_status', connected: false, port: '' })
}

// ── 遥测轮询(50ms):单值转速/电流,用于顶栏/实时数据 ──────────────
async function readTelemetry(): Promise<void> {
  const stResp = await transact(buildReadHoldingRegs(slave, ADDR.ACTUAL_SPEED, 4), 5 + 8)
  const sregs = parseReadHolding(stResp, slave, 4)
  const rpm = regsToFloat32(sregs[0], sregs[1])
  const current = regsToFloat32(sregs[2], sregs[3])
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

// ── 5kHz 电流波形批次读(10Hz):0x2200 状态 → 分两段读(125+75)→ batch 校验 → 清标志 ──
async function readWaveFrame(): Promise<void> {
  // 1. 读 batch/status(0x2200 起 2 寄存器):batch=regs[0], newFlag=regs[1]&0x01
  const flagResp = await transact(buildReadHoldingRegs(slave, ADDR.WAVE_SEQ, 2), 5 + 4)
  const fregs = parseReadHolding(flagResp, slave, 2)
  const batch = fregs[0]
  const newFlag = fregs[1] & 0x01
  if (newFlag !== 1) return // 无新批次

  // 2. 分两段读数据:0x2000×125 + 0x207D×75(Modbus 单帧≤125)。每 2 寄存器一个 float32(高字在前)
  const r1 = parseReadHolding(await transact(buildReadHoldingRegs(slave, ADDR.CUR_WAVE_BUF, 125), 5 + 250), slave, 125)
  const r2 = parseReadHolding(await transact(buildReadHoldingRegs(slave, ADDR.CUR_WAVE_BUF + 125, 75), 5 + 150), slave, 75)
  const regs = [...r1, ...r2]

  const samples: number[] = []
  for (let i = 0; i < regs.length / 2; i++) samples.push(regsToFloat32(regs[i * 2], regs[i * 2 + 1]))

  // 3. 清就绪标志(0x2201 = 0);若固件自动清位,此写亦可为 0 确认
  try { await transact(buildWriteSingleReg(slave, ADDR.WAVE_READY, 0), 8) } catch { /* 忽略 */ }

  backendBus.emit({ type: 'wave_frame', batch, samples })
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

// 波形批次轮询(10Hz):与遥测都走 enqueue 串行化,不与轮询并发出帧
async function wavePollingLoop(): Promise<void> {
  while (port && port.readable && pollingActive) {
    try {
      await enqueue(readWaveFrame)
    } catch {
      // 波形读失败忽略,下一轮重试
    }
    await new Promise((r) => setTimeout(r, 100))
  }
}

function startPolling(): void {
  pollingActive = true
  pollingLoop()
  wavePollingLoop()
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
  if (action === 'clear_emergency_stop') {
    // 复位:清除急停线圈(0x0002 = OFF),固件随之恢复转速设定
    await enqueue(() => transact(buildWriteSingleCoil(slave, ADDR.COIL_EMERGENCY_STOP, false), 8))
    // 固件"急停时清转速设定",复位后需重发上次转速(若之前有设定值)才能恢复
    let extra = ''
    if (currentRpm > 0) {
      await enqueue(() => transact(buildWriteSingleReg(slave, ADDR.SPEED_SETPOINT, currentRpm), 8))
      extra = `, restored rpm=${currentRpm}`
    }
    const result = `OK emergency_stop cleared${extra}`
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
