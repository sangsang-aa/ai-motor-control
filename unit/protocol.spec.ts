/**
 * 串口协议层单测 — 验证 TS 移植(protocol.ts)与 python 版(mcb_host/protocol.py)行为一致。
 * 覆盖:encodeCommand(与 python doctest 逐字节一致)、decodePayload、FrameAssembler(重同步/signed/部分帧续传)。
 * 对应测试点:串口能正常识别 + 示波器能解析串口数据。
 */
import { describe, it, expect } from 'vitest'
import {
  encodeCommand,
  decodePayload,
  FrameAssembler,
  RX_CHANNELS,
} from '@/lib/serial/protocol'

describe('encodeCommand —— 与 python doctest 一致', () => {
  it('encodes [3000, 0] as b8 0b 00 00', () => {
    const out = encodeCommand([3000, 0])
    expect(Array.from(out)).toEqual([0xb8, 0x0b, 0x00, 0x00])
  })

  it('encodes [-100, 1] as 9c ff 01 00 (负值按 uint16 掩码,与 python 版一致)', () => {
    const out = encodeCommand([-100, 1])
    expect(Array.from(out)).toEqual([0x9c, 0xff, 0x01, 0x00])
  })

  it('throws on wrong value count', () => {
    expect(() => encodeCommand([3000])).toThrow()
  })
})

describe('decodePayload', () => {
  it('decodes unsigned channel (Ia counts) correctly', () => {
    // 造一个 payload:2 对,2 通道。[1000, 65000];全部按 uint16 无符号
    const payload = new Uint8Array([0xe8, 0x03, 0x18, 0xfd])
    const chs = decodePayload(payload, RX_CHANNELS)
    // ch0 = 1000 (无符号); ch1 = 0xfd18 = 64792 -> signed int16 => 64792 - 65536 = -744
    expect(chs[0][0]).toBe(1000)
    expect(chs[1][0]).toBe(0xfd18 >= 0x8000 ? 0xfd18 - 0x10000 : 0xfd18)
  })
})

describe('FrameAssembler', () => {
  const makeFrame = (rows: number[][]): Uint8Array => FrameAssembler.buildFrame(rows)

  it('assembles frames from a clean stream', () => {
    // 600 对,[1000, -250]
    const rows = Array.from({ length: 600 }, () => [1000, -250])
    const frame = makeFrame(rows)
    const asm = new FrameAssembler(RX_CHANNELS)
    const frames = asm.feed(frame)
    expect(frames.length).toBe(1)
    expect(frames[0][0].length).toBe(600)
    expect(frames[0][0][0]).toBe(1000)
    expect(frames[0][1][0]).toBe(-250) // signed 解码
  })

  it('resyncs across garbage bytes', () => {
    const rows = Array.from({ length: 600 }, () => [42, 100])
    const frame = makeFrame(rows)
    // 帧前后加垃圾字节
    const stream = new Uint8Array([0xde, 0xad, ...frame, 0xbe, 0xef, ...frame])
    const asm = new FrameAssembler(RX_CHANNELS)
    const frames = asm.feed(stream)
    expect(frames.length).toBe(2)
    expect(frames[0][0][0]).toBe(42)
    expect(asm.dropped).toBe(0)
  })

  it('handles partial frames across feeds', () => {
    const rows = Array.from({ length: 600 }, () => [7, 8])
    const frame = makeFrame(rows)
    const asm = new FrameAssembler(RX_CHANNELS)
    const mid = frame.length
    const f1 = asm.feed(frame.slice(0, Math.floor(mid * 0.4)))
    const f2 = asm.feed(frame.slice(Math.floor(mid * 0.4)))
    expect(f1.length).toBe(0)
    expect(f2.length).toBe(1)
  })

  it('drops garbled frames and resyncs', () => {
    // 一个坏帧(数据长度不符)+ 一个好帧
    const bad = new Uint8Array([0x53, 0x53, 1, 0, 0x45, 0x45]) // 长度不符
    const rows = Array.from({ length: 600 }, () => [9, 9])
    const good = makeFrame(rows)
    const asm = new FrameAssembler(RX_CHANNELS)
    const frames = asm.feed(new Uint8Array([...bad, ...good]))
    expect(frames.length).toBe(1)
    expect(asm.dropped).toBeGreaterThanOrEqual(1)
  })

  it('multi-frame output yields correct channel columns', () => {
    const a = Array.from({ length: 600 }, () => [1, 2])
    const b = Array.from({ length: 600 }, () => [3, 4])
    const asm = new FrameAssembler(RX_CHANNELS)
    const frames = asm.feed(new Uint8Array([...build(a), ...build(b)]))
    expect(frames.length).toBe(2)
    expect(frames[0][0][0]).toBe(1)
    expect(frames[1][0][0]).toBe(3)
  })
})

function build(rows: number[][]): Uint8Array {
  return FrameAssembler.buildFrame(rows)
}
