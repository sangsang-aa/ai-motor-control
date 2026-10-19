/**
 * MCB host-target 协议编解码 —— 纯函数(无 I/O),可单测。
 *
 * 与本样例(F28379D 参数辨识生成代码)一致:
 *  - 上位机→下位机: 8 字节 = 2×float32(小端)。word0=命令, word1=数值。
 *  - 下位机→上位机: 每帧 3×uint32(12 字节,小端),含 2×float32。
 *      帧0   : word0='SSSS', word1=a, word2=b
 *      中间帧: word0=a, word1=b, word2=0
 *      帧599 : word0=a, word1=b, word2='EEEE'
 */

import { FRAME_BYTES, HEAD_MARKER, TAIL_MARKER, CMD_CONTROL } from '../config'
import type { ControlWord } from '../types'

// ── 小端原语 ──────────────────────────────────────────────────────
export function float32ToLE(f: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setFloat32(0, f, true)
  return b
}

export function leToFloat32(b: Uint8Array, offset = 0): number {
  return new DataView(b.buffer, b.byteOffset + offset, 4).getFloat32(0, true)
}

export function u32ToLE(u: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, u >>> 0, true)
  return b
}

export function leToU32(b: Uint8Array, offset = 0): number {
  return new DataView(b.buffer, b.byteOffset + offset, 4).getUint32(0, true)
}

// ── 上位机 → 下位机 ───────────────────────────────────────────────
/** 命令帧:8 字节 = float32(cmd) + float32(value),小端 */
export function encodeCommand(cmd: number, value: number): Uint8Array {
  const out = new Uint8Array(8)
  out.set(float32ToLE(cmd), 0)
  out.set(float32ToLE(value), 4)
  return out
}

/** 由控制字对象打包为位域数值 */
export function buildControlWord(w: ControlWord): number {
  return (
    (w.enable ? 0x01 : 0) |
    (w.auto ? 0x02 : 0) |
    ((w.test & 0x0f) << 4) |
    ((w.debug & 0x1f) << 8)
  )
}

/** 位域数值解析为控制字对象 */
export function parseControlWord(v: number): ControlWord {
  return {
    enable: (v & 0x01) !== 0,
    auto: (v & 0x02) !== 0,
    test: ((v >> 4) & 0x0f) as ControlWord['test'],
    debug: (v >> 8) & 0x1f
  }
}

/** 控制帧(命令 22) */
export function encodeControl(w: ControlWord): Uint8Array {
  return encodeCommand(CMD_CONTROL, buildControlWord(w))
}

/** 配置器参数命令(命令 1..21) */
export function encodeParam(index1based: number, value: number): Uint8Array {
  if (index1based < 1 || index1based > 21) {
    throw new Error(`配置参数命令号越界: ${index1based}(应为 1..21)`)
  }
  return encodeCommand(index1based, value)
}

// ── 下位机 → 上位机:流式分帧 ─────────────────────────────────────
export type FrameMarker = 'head' | 'tail' | 'data'

export interface TargetFrame {
  a: number
  b: number
  marker: FrameMarker
}

export interface StreamParserState {
  buffer: Uint8Array
}

export interface ParseOutcome {
  frames: TargetFrame[]
  /** 本批解析中遇到的块尾('EEEE')个数 */
  completedBlocks: number
}

export function createStreamParser(): StreamParserState {
  return { buffer: new Uint8Array(0) }
}

/**
 * 追加一段串口字节并按 12 字节重组帧。未满一帧的残余字节保存在 state 中。
 */
export function parseStream(chunk: Uint8Array, state: StreamParserState): ParseOutcome {
  const buf = new Uint8Array(state.buffer.length + chunk.length)
  buf.set(state.buffer, 0)
  buf.set(chunk, state.buffer.length)

  const frames: TargetFrame[] = []
  let completedBlocks = 0
  let off = 0

  while (buf.length - off >= FRAME_BYTES) {
    const w0 = leToU32(buf, off)
    const w2 = leToU32(buf, off + 8)

    if (w0 === HEAD_MARKER) {
      frames.push({ a: leToFloat32(buf, off + 4), b: leToFloat32(buf, off + 8), marker: 'head' })
    } else if (w2 === TAIL_MARKER) {
      frames.push({ a: leToFloat32(buf, off), b: leToFloat32(buf, off + 4), marker: 'tail' })
      completedBlocks += 1
    } else {
      frames.push({ a: leToFloat32(buf, off), b: leToFloat32(buf, off + 4), marker: 'data' })
    }

    off += FRAME_BYTES
  }

  state.buffer = buf.slice(off)
  return { frames, completedBlocks }
}

// ── 工具 ──────────────────────────────────────────────────────────
export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (v) => v.toString(16).padStart(2, '0')).join(' ')
}
