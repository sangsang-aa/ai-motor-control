import { describe, it, expect } from 'vitest'
import {
  AI_MOTOR_VERSION,
  PACKET,
  CMD,
  crc16,
  frame,
  command,
  Decoder,
  decodeSample,
  decodeModel,
  decodeConfig,
  decodeAck
} from '@/lib/serial/aimotor/protocol'

function samplePayload(): Uint8Array {
  const buf = new Uint8Array(60)
  const dv = new DataView(buf.buffer)
  dv.setUint32(0, 1234, true)
  dv.setUint16(4, 6, true)
  dv.setUint16(6, 3, true)
  dv.setUint16(8, 0x1ff, true)
  dv.setUint16(10, 2, true)
  for (let i = 0; i < 12; i++) dv.setFloat32(12 + i * 4, i + 0.5, true)
  return buf
}

describe('aimotor protocol — frame/crc', () => {
  it('CRC16/CCITT-FALSE 已知向量', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0x29b1)
  })

  it('command 帧头/长度/CRC 正确且可回解', () => {
    const bytes = command(0x1234, CMD.SET_PARAM, 6, 1, 1500)
    expect(bytes[0]).toBe(0xa5)
    expect(bytes[1]).toBe(0x5a)
    expect(bytes[2]).toBe(AI_MOTOR_VERSION)
    expect(bytes[3]).toBe(PACKET.COMMAND)
    expect(new DataView(bytes.buffer).getUint16(4, true)).toBe(8)
    expect(new DataView(bytes.buffer).getUint16(6, true)).toBe(0x1234)

    const packets = new Decoder().feed(bytes)
    expect(packets).toHaveLength(1)
    expect(packets[0].kind).toBe(PACKET.COMMAND)
    expect(packets[0].seq).toBe(0x1234)
    const dv = new DataView(packets[0].payload.buffer, packets[0].payload.byteOffset)
    expect(dv.getUint8(0)).toBe(CMD.SET_PARAM)
    expect(dv.getUint8(1)).toBe(6)
    expect(dv.getUint16(2, true)).toBe(1)
    expect(dv.getFloat32(4, true)).toBe(1500)
  })

  it('payload 超过 118 字节拒绝;非有限数拒绝', () => {
    expect(() => frame(PACKET.SAMPLE, 1, new Uint8Array(119))).toThrow()
    expect(() => command(1, CMD.HEARTBEAT, 0, 0, Number.NaN)).toThrow()
  })
})

describe('aimotor protocol — Decoder', () => {
  it('分片到达仍能解码', () => {
    const bytes = command(7, CMD.HELLO)
    const d = new Decoder()
    expect(d.feed(bytes.slice(0, 5))).toHaveLength(0)
    expect(d.feed(bytes.slice(5))).toHaveLength(1)
  })

  it('前置噪声可重同步', () => {
    const bytes = command(8, CMD.GET_CONFIG)
    const noisy = new Uint8Array(3 + bytes.length)
    noisy.set([0x00, 0x11, 0x22])
    noisy.set(bytes, 3)
    const packets = new Decoder().feed(noisy)
    expect(packets).toHaveLength(1)
    expect(packets[0].seq).toBe(8)
  })

  it('CRC 错误丢弃并计数,后续帧仍可解', () => {
    const bad = command(9, CMD.STOP)
    bad[bad.length - 1] ^= 0xff
    const d = new Decoder()
    expect(d.feed(bad)).toHaveLength(0)
    expect(d.errors).toBeGreaterThan(0)
    const good = command(10, CMD.HELLO)
    expect(d.feed(good)).toHaveLength(1)
  })
})

describe('aimotor protocol — decode payloads', () => {
  it('SAMPLE 60 字节', () => {
    const p = new Decoder().feed(frame(PACKET.SAMPLE, 1, samplePayload()))[0]
    const s = decodeSample(p)
    expect(s.tick).toBe(1234)
    expect(s.mode).toBe(6)
    expect(s.stage).toBe(3)
    expect(s.flags).toBe(0x1ff)
    expect(s.error).toBe(2)
    expect(s.reference).toBeCloseTo(0.5)
    expect(s.speed).toBeCloseTo(1.5)
    expect(s.if_speed).toBeCloseTo(11.5)
  })

  it('MODEL 76 字节', () => {
    const buf = new Uint8Array(76)
    const dv = new DataView(buf.buffer)
    for (let i = 0; i < 10; i++) dv.setFloat32(i * 4, i * 1.5, true)
    for (let i = 0; i < 8; i++) dv.setUint16(40 + i * 2, 100 + i, true)
    for (let i = 0; i < 5; i++) dv.setUint32(56 + i * 4, 1000 + i, true)
    const m = decodeModel(new Decoder().feed(frame(PACKET.MODEL, 2, buf))[0])
    expect(m.rs).toBe(0)
    expect(m.bus).toBeCloseTo(13.5)
    expect(m.pole_pairs).toBe(100)
    expect(m.ident_error).toBe(107)
    expect(m.revision).toBe(1000)
    expect(m.sci_errors).toBe(1004)
  })

  it('CONFIG 每记录 8 字节', () => {
    const buf = new Uint8Array(16)
    const dv = new DataView(buf.buffer)
    dv.setUint16(0, 1, true); dv.setUint8(2, 6); dv.setUint8(3, 0); dv.setFloat32(4, 1500, true)
    dv.setUint16(8, 41, true); dv.setUint8(10, 7); dv.setUint8(11, 1); dv.setFloat32(12, 5, true)
    const records = decodeConfig(new Decoder().feed(frame(PACKET.CONFIG, 3, buf))[0])
    expect(records).toEqual([
      { param: 1, mode: 6, integer: 0, value: 1500 },
      { param: 41, mode: 7, integer: 1, value: 5 }
    ])
  })

  it('ACK 8 字节', () => {
    const buf = new Uint8Array(8)
    const dv = new DataView(buf.buffer)
    dv.setUint8(0, CMD.HELLO); dv.setUint8(1, 0); dv.setUint16(2, 0, true); dv.setFloat32(4, 0, true)
    const a = decodeAck(new Decoder().feed(frame(PACKET.ACK, 4, buf))[0])
    expect(a.command).toBe(CMD.HELLO)
    expect(a.status).toBe(0)
  })
})
