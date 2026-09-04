/**
 * Modbus RTU 协议层 — 与 docs/modbus_rtu_protocol.md 对齐。
 * 纯帧编解码(无 I/O),可单测。提供:
 *  - CRC16 (0xA001, init 0xFFFF)
 *  - 功能码 01/03/05/06/0F/10 请求帧构建
 *  - 响应帧解析(地址/功能码/CRC 校验)
 *  - float32 <-> 2 个 u16 寄存器(big-endian,高字低地址)
 *  - 寄存器/线圈地址常量表
 */

// ── 地址常量表(与协议文档一致) ──────────────────────────────────
export const ADDR = {
  // 全局控制 HR
  SPEED_SETPOINT: 0x0000,
  CONTROL_MODE: 0x0001,
  // PID 速度环 SPD
  PID_SPD_KP: 0x0100,
  PID_SPD_KI: 0x0102,
  PID_SPD_KD: 0x0104,
  PID_SPD_KD_N: 0x0106,
  PID_SPD_KI_UPLIM: 0x0108,
  PID_SPD_KI_LOWLIM: 0x010A,
  PID_SPD_KI_OUT_LIM: 0x010C,
  PID_SPD_OUT_LIM: 0x010E,
  // PID 电流环 CUR
  PID_CUR_KP: 0x0110,
  PID_CUR_KI: 0x0112,
  PID_CUR_KD: 0x0114,
  PID_CUR_KD_N: 0x0116,
  PID_CUR_KI_UPLIM: 0x0118,
  PID_CUR_KI_LOWLIM: 0x011A,
  PID_CUR_KI_OUT_LIM: 0x011C,
  PID_CUR_OUT_LIM: 0x011E,
  // 状态/遥测 HR(读预留)
  ACTUAL_SPEED: 0x1000,
  ACTUAL_CURRENT: 0x1002,
  FAULT_CODE: 0x1004,
  STATUS_FLAGS: 0x1005,
  // Coil(独立地址空间)
  COIL_MOTOR_EN: 0x0000,
  COIL_FAULT_RESET: 0x0001,
  COIL_EMERGENCY_STOP: 0x0002
} as const

export const FC = {
  READ_COILS: 0x01,
  READ_HOLDING: 0x03,
  WRITE_SINGLE_COIL: 0x05,
  WRITE_SINGLE_REG: 0x06,
  WRITE_MULTI_COILS: 0x0f,
  WRITE_MULTI_REGS: 0x10
} as const

export const DEFAULT_SLAVE = 0x01

// ── CRC-16/MODBUS ─────────────────────────────────────────────────
export function crc16(data: Uint8Array): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xa001
      else crc >>= 1
    }
  }
  return crc & 0xffff
}

/** 帧组帧:payload(MBAP 去 CRC)+ CRC 低字节在前 */
function frame(payload: number[]): Uint8Array {
  const body = Uint8Array.from(payload)
  const crc = crc16(body)
  const out = new Uint8Array(payload.length + 2)
  out.set(body, 0)
  out[payload.length] = crc & 0xff
  out[payload.length + 1] = (crc >> 8) & 0xff
  return out
}

// ── 请求帧构建 ────────────────────────────────────────────────────
export function buildReadHoldingRegs(slave: number, addr: number, count: number): Uint8Array {
  return frame([slave, FC.READ_HOLDING, (addr >> 8) & 0xff, addr & 0xff, (count >> 8) & 0xff, count & 0xff])
}

export function buildReadCoils(slave: number, addr: number, count: number): Uint8Array {
  return frame([slave, FC.READ_COILS, (addr >> 8) & 0xff, addr & 0xff, (count >> 8) & 0xff, count & 0xff])
}

export function buildWriteSingleReg(slave: number, addr: number, value: number): Uint8Array {
  return frame([slave, FC.WRITE_SINGLE_REG, (addr >> 8) & 0xff, addr & 0xff, (value >> 8) & 0xff, value & 0xff])
}

export function buildWriteSingleCoil(slave: number, addr: number, on: boolean): Uint8Array {
  const v = on ? 0xff00 : 0x0000
  return frame([slave, FC.WRITE_SINGLE_COIL, (addr >> 8) & 0xff, addr & 0xff, (v >> 8) & 0xff, v & 0xff])
}

export function buildWriteMultiRegs(slave: number, addr: number, values: number[]): Uint8Array {
  const payload: number[] = [
    slave,
    FC.WRITE_MULTI_REGS,
    (addr >> 8) & 0xff,
    addr & 0xff,
    (values.length >> 8) & 0xff,
    values.length & 0xff,
    (values.length * 2) & 0xff
  ]
  for (const v of values) payload.push((v >> 8) & 0xff, v & 0xff)
  return frame(payload)
}

export function buildWriteMultiCoils(slave: number, addr: number, states: boolean[]): Uint8Array {
  const nBytes = Math.ceil(states.length / 8)
  const data = new Uint8Array(nBytes)
  for (let i = 0; i < states.length; i++) {
    if (states[i]) data[i >> 3] |= 1 << (i & 7) // LSB 优先
  }
  const payload: number[] = [
    slave,
    FC.WRITE_MULTI_COILS,
    (addr >> 8) & 0xff,
    addr & 0xff,
    (states.length >> 8) & 0xff,
    states.length & 0xff,
    nBytes
  ]
  for (let i = 0; i < nBytes; i++) payload.push(data[i])
  return frame(payload)
}

// ── 响应帧解析 ────────────────────────────────────────────────────
/** 校验:从站地址/功能码/CRC。返回剥离 CRC 的 PDU 字节,失败抛错。 */
export function validateResponse(resp: Uint8Array, slave: number, func: number): Uint8Array {
  if (resp.length < 5) throw new Error('响应过短')
  if (resp[0] !== slave) throw new Error(`从站地址不匹配: got ${resp[0]}`)
  if (resp[1] !== func) {
    // Modbus 异常响应:func | 0x80,后带 1 字节异常码
    if (resp[1] === (func | 0x80)) {
      const code = resp[2] ?? 0
      throw new Error(`Modbus 异常码 0x${code.toString(16)}`)
    }
    throw new Error(`功能码不匹配: got 0x${resp[1].toString(16)}`)
  }
  const body = resp.slice(0, resp.length - 2)
  const crcCalc = crc16(body)
  const crcRecv = (resp[resp.length - 2] & 0xff) | ((resp[resp.length - 1] & 0xff) << 8)
  if (crcCalc !== crcRecv) throw new Error('CRC 校验失败')
  return body.slice(2) // 去掉 slave + func
}

/** 解析 03 读保持寄存器响应,返回 u16 数组(数量 = 请求 count) */
export function parseReadHolding(resp: Uint8Array, slave: number, count: number): number[] {
  const pdu = validateResponse(resp, slave, FC.READ_HOLDING)
  const byteCount = pdu[0]
  const n = byteCount / 2
  if (n < count) throw new Error(`寄存器数量不足: ${n} < ${count}`)
  const regs: number[] = []
  for (let i = 0; i < count; i++) {
    regs.push((pdu[1 + i * 2] << 8) | pdu[1 + i * 2 + 1])
  }
  return regs
}

/** 解析 01 读线圈响应,返回 boolean 数组 */
export function parseReadCoils(resp: Uint8Array, slave: number, count: number): boolean[] {
  const pdu = validateResponse(resp, slave, FC.READ_COILS)
  const byteCount = pdu[0]
  const out: boolean[] = []
  for (let i = 0; i < count; i++) {
    const byte = pdu[1 + (i >> 3)]
    out.push(((byte >> (i & 7)) & 1) === 1)
  }
  return out
}

/** 06/05/10/0F 写响应是否回显成功(地址+值一致) */
export function parseWriteEcho(resp: Uint8Array, slave: number, func: number): boolean {
  validateResponse(resp, slave, func)
  return true
}

// ── float32 <-> 2 u16 ─────────────────────────────────────────────
/** float32 拆成 2 个 u16(big-endian:返回 [高字, 低字]) */
export function float32ToRegs(f: number): [number, number] {
  const buf = new DataView(new ArrayBuffer(4))
  buf.setFloat32(0, f, false) // big-endian
  return [buf.getUint16(0, false), buf.getUint16(2, false)]
}

/** 2 个 u16(高字在前)还原 float32 */
export function regsToFloat32(hi: number, lo: number): number {
  const buf = new DataView(new ArrayBuffer(4))
  buf.setUint16(0, hi & 0xffff, false)
  buf.setUint16(2, lo & 0xffff, false)
  return buf.getFloat32(0, false)
}
