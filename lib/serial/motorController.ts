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
  parseWriteMultiEcho,
  parseWriteSingleEcho,
  float32ToRegs,
  regsToFloat32
} from './modbus'
import { backendBus, hexBus } from '../bus'
import { DEFAULT_BAUD, RPM_LIMIT, BRIDGE_URL, WAVE_POLLING_ENABLED } from '../config'
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
// 每次连接分配一个代次。旧轮询在重连后不能继续向新端口发送请求。
let connectionEpoch = 0
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
const XACT_MAX_ATTEMPTS = 3
const XACT_RETRY_DELAY_MS = 20
// XDS110 虚拟串口在 open 后需要短暂稳定时间；DTR 必须关闭。
const DIRECT_PORT_SETTLE_MS = 100
const XDS110_USB_VENDOR_ID = 0x0451
const XDS110_USB_PRODUCT_ID = 0xbef3

async function prepareDirectPort(activePort: SerialPort): Promise<void> {
  // Chromium 默认启用 DTR/RTS。XDS110 COM4 驱动支持 DTR，但不声明支持 RTS，
  // 因此只清 DTR，保留 RTS 默认值；失败时不能静默继续使用未知线路状态。
  try {
    await activePort.setSignals({ dataTerminalReady: false })
  } catch (e) {
    throw new Error(`设置 XDS110 DTR=false 失败: ${String(e instanceof Error ? e.message : e)}`)
  }
  await new Promise((resolve) => setTimeout(resolve, DIRECT_PORT_SETTLE_MS))
}

function isXds110Port(candidate: SerialPort): boolean {
  const info = candidate.getInfo()
  return info.usbVendorId === XDS110_USB_VENDOR_ID && info.usbProductId === XDS110_USB_PRODUCT_ID
}

async function openDirectPort(candidate: SerialPort, baudRate: number): Promise<void> {
  await candidate.open({
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 4096,
    flowControl: 'none'
  })
  port = candidate
  bridgeUrl = null
  await prepareDirectPort(candidate)
  currentRpm = 0
  lastCurrent = 0
  currentOn = false
  await verifyModbusConnection()
}

async function transact(req: Uint8Array, respLen: number): Promise<Uint8Array> {
  const activePort = port
  if (!activePort || !activePort.writable || !activePort.readable) throw new Error('未连接串口')
  // 781250 baud 下 13 字节响应约 0.2ms 即可到达。必须先启动 read() 再写请求，
  // 仅提前持有 reader 锁并不等于底层已有挂起读取。
  const activeReader = activePort.readable.getReader()
  reader = activeReader
  let pendingRead = activeReader.read()
  const resp = new Uint8Array(respLen)
  let got = 0
  let attempt = 0
  let expectedLen = respLen
  try {
    while (attempt < XACT_MAX_ATTEMPTS && got < expectedLen) {
      attempt += 1
      hexBus.emit(req)
      const activeWriter = activePort.writable.getWriter()
      writer = activeWriter
      try {
        await activeWriter.write(req)
      } catch (e) {
        throw new Error(`串口写失败: ${String(e instanceof Error ? e.message : e)}`)
      } finally {
        try { activeWriter.releaseLock() } catch { /* 忽略 */ }
        if (writer === activeWriter) writer = null
      }

      const deadline = Date.now() + XACT_TIMEOUT
      let retryEmptyResponse = false
      while (got < expectedLen) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          if (got === 0 && attempt < XACT_MAX_ATTEMPTS) {
            retryEmptyResponse = true
            break
          }
          throw new Error(`读取超时(${XACT_TIMEOUT}ms): 期望 ${expectedLen} 字节,实收 ${got}`)
        }
        try {
          const { value, done } = await withTimeout(pendingRead, remaining)
          if (done || !value) throw new Error(`串口读取结束: 期望 ${expectedLen} 字节,实收 ${got}`)
          for (let i = 0; i < value.length && got < respLen; i++) resp[got++] = value[i]
          // Modbus 异常响应只有 5 字节，必须让上层解析出异常码而不是误报超时。
          if (got >= 2 && resp[1] === (req[1] | 0x80)) expectedLen = 5
          if (got < expectedLen) pendingRead = activeReader.read()
        } catch (e) {
          if (got === 0 && attempt < XACT_MAX_ATTEMPTS && isReadTimeout(e)) {
            retryEmptyResponse = true
            break
          }
          throw e
        }
      }
      if (retryEmptyResponse) {
        await new Promise((resolve) => setTimeout(resolve, XACT_RETRY_DELAY_MS))
      }
    }
    if (got !== expectedLen) throw new Error(`响应长度错误: 期望 ${expectedLen} 字节,实收 ${got}`)
  } catch (e) {
    // 最终失败才取消 pending read 并关闭端口；零字节超时会先在同一读取上重发。
    const txHex = bytesToHex(req)
    const rxHex = bytesToHex(resp.slice(0, got)) || '<none>'
    const message = `Modbus 事务失败: ${String(e instanceof Error ? e.message : e)}; 尝试 ${attempt}/${XACT_MAX_ATTEMPTS}; TX ${txHex}; RX(${got}) ${rxHex}`
    await closePort(activePort, message)
    throw new Error(message)
  } finally {
    try { activeReader.releaseLock() } catch { /* 已由 closePort 释放时忽略 */ }
    if (reader === activeReader) reader = null
  }
  hexBus.emit(resp.slice(0, got))
  return resp.slice(0, got)
}

function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join(' ')
}

function isReadTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('桥接/串口读取超时')
}

/** 给已启动的 reader.read() 加等待上限；最终失败时由 closePort 统一取消。 */
async function withTimeout(
  pendingRead: Promise<ReadableStreamReadResult<Uint8Array>>,
  ms: number
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      rej(new Error(`桥接/串口读取超时 ${ms}ms`))
    }, ms)
  })
  try {
    return await Promise.race([pendingRead, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

/**
 * 串口打开不等于控制板可通讯。连接前以只读遥测请求验证 Modbus RTU 链路，
 * 避免仅因浏览器取得 COM 句柄就向 UI 报告“已连接”。
 */
async function verifyModbusConnection(): Promise<void> {
  const resp = await transact(buildReadHoldingRegs(slave, ADDR.ACTUAL_SPEED, 4), 5 + 8)
  parseReadHolding(resp, slave, 4)
}

// ── 连接/断开 ─────────────────────────────────────────────────────
export async function connect(baudRate: number = DEFAULT_BAUD): Promise<{ ok: boolean; error?: string }> {
  if (!isWebSerialSupported()) {
    return { ok: false, error: '当前浏览器不支持 Web Serial(需 Chrome/Edge,且需 HTTPS 或 localhost)' }
  }
  if (port && port.readable) return { ok: false, error: '已连接' }
  try {
    const selected = await navigator.serial.requestPort({
      filters: [{ usbVendorId: XDS110_USB_VENDOR_ID, usbProductId: XDS110_USB_PRODUCT_ID }]
    })
    const granted = await navigator.serial.getPorts()
    // XDS110 同时暴露 Application/User UART(MI_00)和 Auxiliary Data(MI_03)，
    // Web Serial 的 getInfo() 对二者只返回相同 VID/PID。逐个只读探测，选择真正响应的接口。
    const candidates = Array.from(new Set([
      selected,
      ...granted.filter(isXds110Port)
    ]))
    const failures: string[] = []
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index]
      try {
        await openDirectPort(candidate, baudRate)
        backendBus.emit({ type: 'serial_status', connected: true, port: getPortName(), baudRate })
        startPolling()
        return { ok: true }
      } catch (e) {
        failures.push(`接口 ${index + 1}: ${String(e instanceof Error ? e.message : e)}`)
        if (port === candidate) await closePort(candidate)
        else {
          try { await candidate.close() } catch { /* open 失败或已关闭 */ }
        }
      }
    }
    return {
      ok: false,
      error: `已探测 ${candidates.length} 个已授权 XDS110 接口，均未收到 Modbus 从站 0x${slave.toString(16)} 的有效响应: ${failures.join(' | ')}`
    }
  } catch (e) {
    return {
      ok: false,
      error: `串口选择或打开失败: ${String(e instanceof Error ? e.message : e)}`
    }
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
    await verifyModbusConnection()
    backendBus.emit({ type: 'serial_status', connected: true, port: getPortName(), baudRate: 0 })
    startPolling()
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: `桥接已打开但未收到 Modbus 从站 0x${slave.toString(16)} 的有效响应: ${String(e instanceof Error ? e.message : e)}`
    }
  }
}

async function closePort(expectedPort: SerialPort | null = port, reason?: string): Promise<void> {
  if (!expectedPort || port !== expectedPort) return
  pollingActive = false
  connectionEpoch += 1
  const activeReader = reader
  const activeWriter = writer
  reader = null
  writer = null
  port = null
  try { await activeReader?.cancel() } catch { /* 忽略 */ }
  try { activeReader?.releaseLock() } catch { /* 忽略 */ }
  try { activeWriter?.releaseLock() } catch { /* 忽略 */ }
  try { await expectedPort.close() } catch { /* 忽略 */ }
  bridgeUrl = null
  currentRpm = 0
  lastCurrent = 0
  currentOn = false
  if (reason) backendBus.emit({ type: 'error', message: reason })
  backendBus.emit({ type: 'serial_status', connected: false, port: '' })
}

export async function disconnect(): Promise<void> {
  await closePort()
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

const WAVE_REGISTER_COUNT = 200
// XDS110 在 Web Serial 下读 255 字节极限帧容易丢尾；改用四个 105 字节响应。
const WAVE_READ_CHUNK_REGS = 50

// ── 5kHz 电流波形批次读:0x2200 状态 → 分块读取 → 确认消费 ──
async function readWaveFrame(): Promise<void> {
  // 1. 读 batch/status(0x2200 起 2 寄存器):batch=regs[0], newFlag=regs[1]&0x01
  const flagResp = await transact(buildReadHoldingRegs(slave, ADDR.WAVE_SEQ, 2), 5 + 4)
  const fregs = parseReadHolding(flagResp, slave, 2)
  const batch = fregs[0]
  const newFlag = fregs[1] & 0x01
  if (newFlag !== 1) return // 无新批次

  // 2. 分块读完 200 个寄存器。每 2 寄存器一个 float32(高字在前)。
  const regs: number[] = []
  for (let offset = 0; offset < WAVE_REGISTER_COUNT; offset += WAVE_READ_CHUNK_REGS) {
    const count = Math.min(WAVE_READ_CHUNK_REGS, WAVE_REGISTER_COUNT - offset)
    const response = await transact(
      buildReadHoldingRegs(slave, ADDR.CUR_WAVE_BUF + offset, count),
      5 + count * 2
    )
    regs.push(...parseReadHolding(response, slave, count))
  }

  const samples: number[] = []
  for (let i = 0; i < regs.length / 2; i++) samples.push(regsToFloat32(regs[i * 2], regs[i * 2 + 1]))

  // 3. 写 0 确认已完整消费冻结批次；回显不正确时不得当作成功。
  const ack = await transact(buildWriteSingleReg(slave, ADDR.WAVE_READY, 0), 8)
  parseWriteSingleEcho(ack, slave, 0x06, ADDR.WAVE_READY, 0)

  backendBus.emit({ type: 'wave_frame', batch, samples })
}

function isPollingSession(epoch: number): boolean {
  return pollingActive && connectionEpoch === epoch && port !== null && port.readable !== null
}

async function pollingLoop(epoch: number): Promise<void> {
  while (isPollingSession(epoch)) {
    try {
      await enqueue(async () => {
        if (!isPollingSession(epoch)) return
        await readTelemetry()
      })
    } catch (e) {
      if (isPollingSession(epoch)) {
        backendBus.emit({ type: 'error', message: `遥测读失败: ${String(e instanceof Error ? e.message : e)}` })
      }
    }
    await new Promise((r) => setTimeout(r, 50))
  }
}

// 100 点 @ 5kHz 每 20ms 产生一批。5ms 检查 ready 以尽量减少等待；
// XDS110 的多次 USB 往返仍可能漏批，显示层会按到达时间保留这些缺口。
const WAVE_STATUS_POLL_MS = 5

async function wavePollingLoop(epoch: number): Promise<void> {
  while (isPollingSession(epoch)) {
    try {
      await enqueue(async () => {
        if (!isPollingSession(epoch)) return
        await readWaveFrame()
      })
    } catch (e) {
      if (isPollingSession(epoch)) {
        backendBus.emit({ type: 'error', message: `波形读取失败: ${String(e instanceof Error ? e.message : e)}` })
      }
    }
    await new Promise((r) => setTimeout(r, WAVE_STATUS_POLL_MS))
  }
}

function startPolling(): void {
  pollingActive = true
  const epoch = ++connectionEpoch
  void pollingLoop(epoch)
  if (WAVE_POLLING_ENABLED) void wavePollingLoop(epoch)
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
    await enqueue(async () => {
      const resp = await transact(buildWriteSingleReg(slave, ADDR.SPEED_SETPOINT, rpm), 8)
      parseWriteSingleEcho(resp, slave, 0x06, ADDR.SPEED_SETPOINT, rpm)
    })
    const result = `OK rpm=${rpm}`
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  if (action === 'set_motor_state') {
    const on = !!payload.on
    currentOn = on
    await enqueue(async () => {
      const resp = await transact(buildWriteSingleCoil(slave, ADDR.COIL_MOTOR_EN, on), 8)
      parseWriteSingleEcho(resp, slave, 0x05, ADDR.COIL_MOTOR_EN, on ? 0xff00 : 0x0000)
    })
    const result = `OK motor_on=${on ? 1 : 0}`
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  if (action === 'emergency_stop') {
    await enqueue(async () => {
      const resp = await transact(buildWriteSingleCoil(slave, ADDR.COIL_EMERGENCY_STOP, true), 8)
      parseWriteSingleEcho(resp, slave, 0x05, ADDR.COIL_EMERGENCY_STOP, 0xff00)
    })
    const result = 'OK emergency_stop'
    backendBus.emit({ type: 'executed', action, result })
    return result
  }
  if (action === 'clear_emergency_stop') {
    // 复位:清除急停线圈(0x0002 = OFF),固件随之恢复转速设定
    await enqueue(async () => {
      const resp = await transact(buildWriteSingleCoil(slave, ADDR.COIL_EMERGENCY_STOP, false), 8)
      parseWriteSingleEcho(resp, slave, 0x05, ADDR.COIL_EMERGENCY_STOP, 0x0000)
    })
    // 固件"急停时清转速设定",复位后需重发上次转速(若之前有设定值)才能恢复
    let extra = ''
    if (currentRpm > 0) {
      await enqueue(async () => {
        const resp = await transact(buildWriteSingleReg(slave, ADDR.SPEED_SETPOINT, currentRpm), 8)
        parseWriteSingleEcho(resp, slave, 0x06, ADDR.SPEED_SETPOINT, currentRpm)
      })
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
    await enqueue(async () => {
      const resp = await transact(buildWriteMultiRegs(slave, addr, [hi, lo]), 8)
      parseWriteMultiEcho(resp, slave, 0x10, addr, 2)
    })
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
