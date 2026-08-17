/**
 * mcb_open_loop_control 串口协议的纯 TS 移植(无 I/O,可单测)。
 * 源:python_backend/mcb_host/protocol.py + config.py(已随 Electron 版删除,此文件为唯一权威)。
 *
 * 线上格式:
 *   TX (PC -> target): 2x uint16 little-endian,无帧头: [speed_rpm, motor_on]。
 *   RX (target -> PC): 'SS'(0x53 0x53) + nominal_pairs*[ch1, ch2, ...] uint16 LE + 'EE'(0x45 0x45)。
 */

// ── 通道/字段/帧配置(与 python config.py 一一对应) ────────────────
export interface RxChannel {
  name: string
  signed: boolean
  scale: number
  offset: number
  unit: string
}

export interface FrameCfg {
  start: number[]
  end: number[]
  nominalPairs: number
  pairTolerance: number
  maxBuffer: number
}

/** 默认双通道:Ia(ADC counts,无符号)+ Speed(RPM,有符号 int16) */
export const RX_CHANNELS: RxChannel[] = [
  { name: 'Ia (ADC counts)', signed: false, scale: 1, offset: 0, unit: 'counts' },
  { name: 'Speed (RPM)', signed: true, scale: 1, offset: 0, unit: 'rpm' }
]

/** 命令顺序与 host Mux 一致:in:1 = speed, in:2 = motor on/off */
export const TX_FIELDS = ['speed_rpm', 'motor_on'] as const

export const FRAME: FrameCfg = {
  start: [0x53, 0x53], // 'SS'
  end: [0x45, 0x45], // 'EE'
  nominalPairs: 600,
  pairTolerance: 4,
  maxBuffer: 1 << 20
}

// ── TX:编码命令 ─────────────────────────────────────────────────
/** 打包命令值为线上字节:每个值 round 后按 uint16 LE 打包(负值/溢出按位掩码,与 python 版一致)。 */
export function encodeCommand(values: number[]): Uint8Array {
  if (values.length !== TX_FIELDS.length) {
    throw new Error(`expected ${TX_FIELDS.length} values, got ${values.length}`)
  }
  const out = new Uint8Array(values.length * 2)
  for (let i = 0; i < values.length; i++) {
    const u = Math.round(values[i]) & 0xffff
    out[i * 2] = u & 0xff
    out[i * 2 + 1] = (u >> 8) & 0xff
  }
  return out
}

// ── RX:解码 payload ─────────────────────────────────────────────
/**
 * 解码一帧 payload 为每通道一列的 Float64Array 数组。
 * payload 长度必须是 2*n_channels 的倍数;工程值 = raw * scale + offset(signed 通道先按 int16 解释)。
 */
export function decodePayload(payload: Uint8Array, channels: RxChannel[] = RX_CHANNELS): Float64Array[] {
  const nch = channels.length
  const pairs = payload.length / (2 * nch)
  const out: Float64Array[] = []
  for (let c = 0; c < nch; c++) {
    const ch = channels[c]
    const col = new Float64Array(pairs)
    for (let p = 0; p < pairs; p++) {
      const lo = payload[(p * nch + c) * 2]
      const hi = payload[(p * nch + c) * 2 + 1]
      let raw = (hi << 8) | lo
      if (ch.signed && raw >= 0x8000) raw -= 0x10000 // int16
      col[p] = raw * ch.scale + ch.offset
    }
    out.push(col)
  }
  return out
}

// ── FrameAssembler:字节流 -> 帧 ─────────────────────────────────
/** 有状态字节流解码器:锁定 'SS'/'EE' 帧,垃圾自动重同步。feed 后返回本次完成的帧。 */
export class FrameAssembler {
  private channels: RxChannel[]
  private frame: FrameCfg
  private nch: number
  private buf: number[] = []
  dropped = 0 // 丢弃/损坏帧计数(诊断)

  constructor(channels: RxChannel[] = RX_CHANNELS, frame: FrameCfg = FRAME) {
    this.channels = channels
    this.frame = frame
    this.nch = channels.length
  }

  private payloadOk(payload: number[]): boolean {
    const stride = 2 * this.nch
    if (payload.length === 0 || payload.length % stride !== 0) return false
    const pairs = payload.length / stride
    return Math.abs(pairs - this.frame.nominalPairs) <= this.frame.pairTolerance
  }

  feed(chunk: Uint8Array): Float64Array[][] {
    const frames: Float64Array[][] = []
    if (chunk.length > 0) {
      for (let i = 0; i < chunk.length; i++) this.buf.push(chunk[i])
    }
    const { start, end } = this.frame
    while (true) {
      // 找 start
      let s = -1
      for (let i = 0; i + start.length <= this.buf.length; i++) {
        if (start.every((b, k) => this.buf[i + k] === b)) { s = i; break }
      }
      if (s < 0) {
        // 无 start:只保留可能的部分标记尾部
        if (this.buf.length > start.length) this.buf.splice(0, this.buf.length - start.length)
        break
      }
      // 丢弃 start 之前的垃圾
      if (s > 0) { this.buf.splice(0, s); s = 0 }
      // 找 end(start 之后)
      let e = -1
      for (let i = s + start.length; i + end.length <= this.buf.length; i++) {
        if (end.every((b, k) => this.buf[i + k] === b)) { e = i; break }
      }
      if (e < 0) break // 帧不完整,等更多字节
      const payload = this.buf.slice(s + start.length, e)
      if (this.payloadOk(payload)) {
        frames.push(decodePayload(Uint8Array.from(payload), this.channels))
        this.buf.splice(0, e + end.length) // 消费整帧
      } else {
        // 坏帧(如数据字恰为标记):跳过该 start,从下一个候选重同步
        this.dropped += 1
        this.buf.splice(0, start.length)
      }
      if (this.buf.length > this.frame.maxBuffer) {
        // 失控缓冲:只保留尾部
        this.buf.splice(0, this.buf.length - 2 * this.frame.nominalPairs * this.nch)
      }
    }
    return frames
  }

  /** 帧组装逆操作(测试/mock 用) */
  static buildFrame(samples: number[][]): Uint8Array {
    const frame = FRAME
    const body: number[] = []
    for (const row of samples) {
      for (const v of row) {
        const u = v & 0xffff
        body.push(u & 0xff, (u >> 8) & 0xff)
      }
    }
    return Uint8Array.from([...frame.start, ...body, ...frame.end])
  }
}
