/**
 * Modbus RTU 协议层单测(modbus.ts)— 验证 CRC16、帧构建/解析、float32 编解码、
 * 地址常量与 docs/modbus_rtu_protocol.md 对齐。
 */
import { describe, it, expect } from 'vitest'
import {
  crc16,
  ADDR,
  FC,
  buildReadHoldingRegs,
  buildWriteSingleReg,
  buildWriteMultiRegs,
  buildWriteSingleCoil,
  parseReadHolding,
  float32ToRegs,
  regsToFloat32
} from '@/lib/serial/modbus'

describe('CRC16-Modbus', () => {
  it('matches known Modbus CRC vectors', () => {
    // 标准验证: 01 03 00 00 00 0A -> CRC 0xCDC5 (低字节 C5,高字节 CD)
    const req = Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x0a])
    const crc = crc16(req)
    expect(crc & 0xff).toBe(0xc5)
    expect((crc >> 8) & 0xff).toBe(0xcd)
  })
  it('CRC of empty is the init value 0xFFFF', () => {
    expect(crc16(new Uint8Array(0))).toBe(0xffff)
  })
})

describe('float32 <-> 2 u16 (big-endian)', () => {
  it('encodes 1.5 as 0x3FC0 / 0x0000', () => {
    const [hi, lo] = float32ToRegs(1.5)
    expect(hi).toBe(0x3fc0)
    expect(lo).toBe(0x0000)
  })
  it('round-trips a value', () => {
    const f = 12345.678
    const [hi, lo] = float32ToRegs(f)
    expect(regsToFloat32(hi, lo)).toBeCloseTo(f, 3)
  })
  it('encodes negative and zero', () => {
    const [h1, l1] = float32ToRegs(-2.5)
    expect(regsToFloat32(h1, l1)).toBeCloseTo(-2.5, 3)
    const [h0, l0] = float32ToRegs(0)
    expect(regsToFloat32(h0, l0)).toBe(0)
  })
})

describe('modbus request frame building', () => {
  it('builds read holding regs frame (0x03)', () => {
    const f = buildReadHoldingRegs(1, 0x1000, 4)
    expect(Array.from(f.slice(0, 6))).toEqual([1, 0x03, 0x10, 0x00, 0x00, 0x04])
    expect(f.length).toBe(8)
  })
  it('builds write single reg frame (0x06)', () => {
    const f = buildWriteSingleReg(1, 0x0000, 3000)
    expect(Array.from(f.slice(0, 6))).toEqual([1, 0x06, 0x00, 0x00, 0x0b, 0xb8])
    expect(f.length).toBe(8)
  })
  it('builds write single coil frame (0x05)', () => {
    const f = buildWriteSingleCoil(1, 0x0000, true)
    expect(Array.from(f.slice(0, 6))).toEqual([1, 0x05, 0x00, 0x00, 0xff, 0x00])
  })
  it('builds write multi regs frame (0x10) for a float32', () => {
    const [hi, lo] = float32ToRegs(1.5)
    const f = buildWriteMultiRegs(1, 0x0100, [hi, lo])
    //  01 10 01 00 00 02 04 3F C0 00 00 <CRC>
    expect(Array.from(f.slice(0, 11))).toEqual([1, 0x10, 0x01, 0x00, 0x00, 0x02, 0x04, 0x3f, 0xc0, 0x00, 0x00])
  })
})

describe('response parsing', () => {
  function buildResp(pdu: number[]): Uint8Array {
    const body = Uint8Array.from(pdu)
    const crc = crc16(body)
    return Uint8Array.from([...body, crc & 0xff, (crc >> 8) & 0xff])
  }

  it('parses 0x03 read holding response', () => {
    // slave1, func3, byteCount 8, 4 regs (1.5f + 2.0f)
    const hi1 = 0x3fc0, lo1 = 0x0000, hi2 = 0x4000, lo2 = 0
    const resp = buildResp([1, 0x03, 8, hi1 >> 8, hi1 & 0xff, lo1 >> 8, lo1 & 0xff, hi2 >> 8, hi2 & 0xff, lo2 >> 8, lo2 & 0xff])
    const regs = parseReadHolding(resp, 1, 4)
    expect(regs.length).toBe(4)
    expect(regsToFloat32(regs[0], regs[1])).toBeCloseTo(1.5, 3)
    expect(regsToFloat32(regs[2], regs[3])).toBeCloseTo(2.0, 3)
  })
  it('rejects wrong slave', () => {
    const resp = buildResp([2, 0x03, 2, 0, 0])
    expect(() => parseReadHolding(resp, 1, 1)).toThrow()
  })
  it('rejects wrong CRC', () => {
    const resp = buildResp([1, 0x03, 2, 0, 0])
    resp[resp.length - 1] ^= 0xff
    expect(() => parseReadHolding(resp, 1, 1)).toThrow()
  })
  it('throws on modbus exception code', () => {
    const resp = buildResp([1, 0x83, 0x02])
    expect(() => parseReadHolding(resp, 1, 1)).toThrow(/异常码/)
  })
})

describe('address table aligned with protocol doc', () => {
  it('PID SPD base and CUR base', () => {
    expect(ADDR.PID_SPD_KP).toBe(0x0100)
    expect(ADDR.PID_CUR_KP).toBe(0x0110)
    expect(ADDR.ACTUAL_SPEED).toBe(0x1000)
    expect(ADDR.COIL_MOTOR_EN).toBe(0x0000)
    expect(ADDR.COIL_EMERGENCY_STOP).toBe(0x0002)
  })
})
