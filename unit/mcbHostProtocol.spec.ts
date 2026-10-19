import { describe, it, expect } from 'vitest'
import {
  float32ToLE,
  leToFloat32,
  u32ToLE,
  leToU32,
  encodeCommand,
  encodeParam,
  encodeControl,
  buildControlWord,
  parseControlWord,
  createStreamParser,
  parseStream
} from '@/lib/serial/mcbHostProtocol'
import { HEAD_MARKER, TAIL_MARKER, BLOCK_FRAMES } from '@/lib/config'
import type { ControlWord } from '@/lib/types'

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) {
    out.set(a, o)
    o += a.length
  }
  return out
}
const headFrame = (a: number, b: number) => concat(u32ToLE(HEAD_MARKER), float32ToLE(a), float32ToLE(b))
const dataFrame = (a: number, b: number) => concat(float32ToLE(a), float32ToLE(b), u32ToLE(0))
const tailFrame = (a: number, b: number) => concat(float32ToLE(a), float32ToLE(b), u32ToLE(TAIL_MARKER))

/** 构造一块:1 头 + (BLOCK_FRAMES-2) 数据 + 1 尾 */
function buildBlock(): Uint8Array {
  const frames: Uint8Array[] = [headFrame(1000, 0.5)]
  for (let i = 1; i <= BLOCK_FRAMES - 2; i++) frames.push(dataFrame(1000 + i, i * 0.001))
  frames.push(tailFrame(1000 + BLOCK_FRAMES - 1, (BLOCK_FRAMES - 1) * 0.001))
  return concat(...frames)
}

describe('小端原语', () => {
  it('float32 小端往返', () => {
    const b = float32ToLE(3.14159)
    // 小端:低字节在前
    expect(leToFloat32(b, 0)).toBeCloseTo(3.14159, 5)
  })

  it('uint32 小端往返', () => {
    expect(leToU32(u32ToLE(0x53535353), 0)).toBe(0x53535353)
    // 0x53535353 小端字节 = 53 53 53 53
    expect(Array.from(u32ToLE(HEAD_MARKER))).toEqual([0x53, 0x53, 0x53, 0x53])
    expect(Array.from(u32ToLE(TAIL_MARKER))).toEqual([0x45, 0x45, 0x45, 0x45])
  })
})

describe('命令编码', () => {
  it('encodeCommand = 2×float32 小端,共 8 字节', () => {
    const f = encodeCommand(22, 0)
    expect(f.length).toBe(8)
    expect(leToFloat32(f, 0)).toBe(22)
    expect(leToFloat32(f, 4)).toBe(0)
  })

  it('encodeParam 越界抛错', () => {
    expect(() => encodeParam(0, 1)).toThrow()
    expect(() => encodeParam(22, 1)).toThrow()
    expect(encodeParam(1, 5).length).toBe(8)
    expect(leToFloat32(encodeParam(1, 5), 0)).toBe(1)
  })

  it('控制字位域 build/parse 往返', () => {
    const w: ControlWord = { enable: true, auto: false, test: 3, debug: 7 }
    const v = buildControlWord(w)
    expect(v & 0x01).toBe(1)
    expect((v >> 4) & 0x0f).toBe(3)
    expect((v >> 8) & 0x1f).toBe(7)
    expect(parseControlWord(v)).toEqual(w)
  })

  it('encodeControl 命令号为 22', () => {
    const f = encodeControl({ enable: true, auto: true, test: 1, debug: 0 })
    expect(leToFloat32(f, 0)).toBe(22)
  })
})

describe('流式分帧', () => {
  it('整块解析:块尾计数 1,帧数 600,首帧 head 尾帧 tail', () => {
    const block = buildBlock()
    const st = createStreamParser()
    const { frames, completedBlocks } = parseStream(block, st)
    expect(completedBlocks).toBe(1)
    expect(frames.length).toBe(BLOCK_FRAMES)
    expect(frames[0].marker).toBe('head')
    expect(frames[0].a).toBeCloseTo(1000, 3)
    expect(frames[BLOCK_FRAMES - 1].marker).toBe('tail')
  })

  it('分块到达(按 7 字节切)结果一致', () => {
    const block = buildBlock()
    const st = createStreamParser()
    let frames = 0
    let blocks = 0
    for (let i = 0; i < block.length; i += 7) {
      const out = parseStream(block.slice(i, i + 7), st)
      frames += out.frames.length
      blocks += out.completedBlocks
    }
    expect(blocks).toBe(1)
    expect(frames).toBe(BLOCK_FRAMES)
    expect(st.buffer.length).toBe(0)
  })

  it('半个帧保持缓冲,不误解析', () => {
    const st = createStreamParser()
    const out = parseStream(new Uint8Array([1, 2, 3, 4, 5]), st)
    expect(out.frames.length).toBe(0)
    expect(st.buffer.length).toBe(5)
  })
})
