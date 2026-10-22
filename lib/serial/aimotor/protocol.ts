// AI-Motor v1 线协议 — 纯编解码(无串口/无 UI 依赖),供 controller 与测试共用。

export const AI_MOTOR_VERSION = 1
export const AI_MOTOR_BAUD = 115200

export const PACKET = { COMMAND: 0x01, SAMPLE: 0x80, ACK: 0x81, MODEL: 0x82, CONFIG: 0x83 } as const
export type PacketKind = (typeof PACKET)[keyof typeof PACKET]

export const CMD = {
  HEARTBEAT: 0,
  STOP: 1,
  SET_MODE: 2,
  SET_PARAM: 3,
  ENABLE: 4,
  GET_CONFIG: 5,
  HELLO: 6
} as const
export type CommandId = (typeof CMD)[keyof typeof CMD]

export const ACK_STATUS: Record<number, string> = {
  0: '已确认',
  1: '未知命令',
  2: '模式不匹配',
  3: '未知参数',
  4: '参数超限或非数',
  5: '运行中禁止此操作',
  6: '电机模型/HFI 条件未就绪',
  7: '下位机忙',
  8: '尚未握手',
  9: '通信超时，已撤销远程使能'
}

export const MODE_LABEL: Record<number, string> = {
  5: '停止 / 空闲',
  6: 'HFI → I/f → 速度环',
  7: '电机参数辨识',
  8: 'Id 对齐 → I/f → 速度环'
}

export const STAGE_LABEL: Record<number, string> = {
  0: '停止', 1: 'HFI 初始定位', 2: 'I/f 强拖', 3: '速度闭环', 4: '制动',
  5: '停车等待', 6: '零速空闲', 7: '启动失败', 8: '角度交接', 9: 'Id 对齐'
}

export const IDENT_STAGE_LABEL: Record<number, string> = {
  0: '空闲', 1: '静态检查', 2: '对齐', 3: 'Rs 低电流', 4: 'Rs 高电流',
  5: 'd 轴预注入', 6: 'Ld 测量', 7: 'q 轴预注入', 8: 'Lq 测量', 9: '完成', 10: '失败'
}

export const IDENT_ERROR_LABEL: Record<number, string> = {
  0: '正常', 1: '输入错误', 2: '过流', 3: 'ADC 异常', 4: '不够安静',
  5: '直流未稳定', 6: 'Rs 无效', 7: '注入信号弱', 8: '复阻抗不合格', 9: '重复性不合格'
}

export const SAMPLE_NAMES = [
  'reference', 'speed', 'id_ref', 'id', 'iq_ref', 'iq',
  'iu', 'iv', 'iw', 'angle', 'emf', 'if_speed'
] as const

export const MODEL_NAMES = [
  'rs', 'ld', 'lq', 'ls', 'bandwidth', 'kp_d', 'ki_d', 'kp_q', 'ki_q', 'bus',
  'pole_pairs', 'status', 'hfi_status', 'select', 'applied', 'save_status',
  'saved_valid', 'ident_error', 'revision', 'rx_frames', 'crc_errors',
  'dropped_samples', 'sci_errors'
] as const

export interface Packet {
  kind: PacketKind
  seq: number
  payload: Uint8Array
}

export interface Sample {
  tick: number
  mode: number
  stage: number
  flags: number
  error: number
  reference: number
  speed: number
  id_ref: number
  id: number
  iq_ref: number
  iq: number
  iu: number
  iv: number
  iw: number
  angle: number
  emf: number
  if_speed: number
}

export interface Model {
  rs: number
  ld: number
  lq: number
  ls: number
  bandwidth: number
  kp_d: number
  ki_d: number
  kp_q: number
  ki_q: number
  bus: number
  pole_pairs: number
  status: number
  hfi_status: number
  select: number
  applied: number
  save_status: number
  saved_valid: number
  ident_error: number
  revision: number
  rx_frames: number
  crc_errors: number
  dropped_samples: number
  sci_errors: number
}

export interface ConfigRecord {
  param: number
  mode: number
  integer: number
  value: number
}

export interface Ack {
  command: number
  status: number
  param: number
  value: number
}

const EXPECTED_LENGTH: Record<number, number> = {
  [PACKET.COMMAND]: 8,
  [PACKET.ACK]: 8,
  [PACKET.SAMPLE]: 60,
  [PACKET.MODEL]: 76
}

export function crc16(data: Uint8Array): number {
  let crc = 0xffff
  for (const byte of data) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

export function frame(kind: PacketKind, seq: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  if (payload.length > 118) throw new Error('payload too long')
  const size = payload.length + 10
  const out = new Uint8Array(size)
  out[0] = 0xa5
  out[1] = 0x5a
  out[2] = AI_MOTOR_VERSION
  out[3] = kind
  out[4] = payload.length & 0xff
  out[5] = (payload.length >> 8) & 0xff
  out[6] = seq & 0xff
  out[7] = (seq >> 8) & 0xff
  out.set(payload, 8)
  const crc = crc16(out.subarray(2, size - 2))
  out[size - 2] = crc & 0xff
  out[size - 1] = (crc >> 8) & 0xff
  return out
}

export function command(seq: number, cmd: CommandId, mode = 0, param = 0, value = 0): Uint8Array {
  if (!Number.isFinite(value)) throw new Error('参数必须为有限数')
  const payload = new Uint8Array(8)
  const dv = new DataView(payload.buffer)
  dv.setUint8(0, cmd)
  dv.setUint8(1, mode)
  dv.setUint16(2, param, true)
  dv.setFloat32(4, value, true)
  return frame(PACKET.COMMAND, seq, payload)
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function findSync(buf: Uint8Array): number {
  for (let i = 0; i + 1 < buf.length; i++) {
    if (buf[i] === 0xa5 && buf[i + 1] === 0x5a) return i
  }
  return -1
}

export class Decoder {
  private buffer: Uint8Array = new Uint8Array(0)
  errors = 0

  feed(chunk: Uint8Array): Packet[] {
    this.buffer = concat(this.buffer, chunk)
    const out: Packet[] = []
    for (;;) {
      const sync = findSync(this.buffer)
      if (sync < 0) {
        const tail = this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === 0xa5
          ? this.buffer.slice(this.buffer.length - 1)
          : new Uint8Array(0)
        this.buffer = tail
        break
      }
      if (sync > 0) this.buffer = this.buffer.slice(sync)
      if (this.buffer.length < 8) break

      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength)
      const version = view.getUint8(2)
      const kind = view.getUint8(3)
      const length = view.getUint16(4, true)
      const seq = view.getUint16(6, true)
      const expected = EXPECTED_LENGTH[kind]
      const lengthOk = expected !== undefined
        ? length === expected
        : kind === PACKET.CONFIG && length > 0 && length % 8 === 0

      if (version !== AI_MOTOR_VERSION || length > 118 || !lengthOk) {
        this.errors++
        this.buffer = this.buffer.slice(1)
        continue
      }

      const size = length + 10
      if (this.buffer.length < size) break
      const crcGot = view.getUint16(size - 2, true)
      if (crc16(this.buffer.subarray(2, size - 2)) !== crcGot) {
        this.errors++
        this.buffer = this.buffer.slice(1)
        continue
      }

      out.push({ kind: kind as PacketKind, seq, payload: this.buffer.slice(8, size - 2) })
      this.buffer = this.buffer.slice(size)
    }
    return out
  }
}

function payloadView(p: Packet, expected: number): DataView {
  if (p.payload.length !== expected) {
    throw new Error(`payload length ${p.payload.length} != ${expected}`)
  }
  return new DataView(p.payload.buffer, p.payload.byteOffset, p.payload.byteLength)
}

export function decodeSample(p: Packet): Sample {
  const dv = payloadView(p, 60)
  return {
    tick: dv.getUint32(0, true),
    mode: dv.getUint16(4, true),
    stage: dv.getUint16(6, true),
    flags: dv.getUint16(8, true),
    error: dv.getUint16(10, true),
    reference: dv.getFloat32(12, true),
    speed: dv.getFloat32(16, true),
    id_ref: dv.getFloat32(20, true),
    id: dv.getFloat32(24, true),
    iq_ref: dv.getFloat32(28, true),
    iq: dv.getFloat32(32, true),
    iu: dv.getFloat32(36, true),
    iv: dv.getFloat32(40, true),
    iw: dv.getFloat32(44, true),
    angle: dv.getFloat32(48, true),
    emf: dv.getFloat32(52, true),
    if_speed: dv.getFloat32(56, true)
  }
}

export function decodeModel(p: Packet): Model {
  const dv = payloadView(p, 76)
  return {
    rs: dv.getFloat32(0, true),
    ld: dv.getFloat32(4, true),
    lq: dv.getFloat32(8, true),
    ls: dv.getFloat32(12, true),
    bandwidth: dv.getFloat32(16, true),
    kp_d: dv.getFloat32(20, true),
    ki_d: dv.getFloat32(24, true),
    kp_q: dv.getFloat32(28, true),
    ki_q: dv.getFloat32(32, true),
    bus: dv.getFloat32(36, true),
    pole_pairs: dv.getUint16(40, true),
    status: dv.getUint16(42, true),
    hfi_status: dv.getUint16(44, true),
    select: dv.getUint16(46, true),
    applied: dv.getUint16(48, true),
    save_status: dv.getUint16(50, true),
    saved_valid: dv.getUint16(52, true),
    ident_error: dv.getUint16(54, true),
    revision: dv.getUint32(56, true),
    rx_frames: dv.getUint32(60, true),
    crc_errors: dv.getUint32(64, true),
    dropped_samples: dv.getUint32(68, true),
    sci_errors: dv.getUint32(72, true)
  }
}

export function decodeConfig(p: Packet): ConfigRecord[] {
  if (p.payload.length === 0 || p.payload.length % 8 !== 0) {
    throw new Error('invalid config payload')
  }
  const out: ConfigRecord[] = []
  const dv = new DataView(p.payload.buffer, p.payload.byteOffset, p.payload.byteLength)
  for (let offset = 0; offset < p.payload.length; offset += 8) {
    out.push({
      param: dv.getUint16(offset, true),
      mode: dv.getUint8(offset + 2),
      integer: dv.getUint8(offset + 3),
      value: dv.getFloat32(offset + 4, true)
    })
  }
  return out
}

export function decodeAck(p: Packet): Ack {
  const dv = payloadView(p, 8)
  return {
    command: dv.getUint8(0),
    status: dv.getUint8(1),
    param: dv.getUint16(2, true),
    value: dv.getFloat32(4, true)
  }
}
