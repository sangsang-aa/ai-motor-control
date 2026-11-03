import { describe, it, expect } from 'vitest'
import { decodeAnalog, decimate, timeAt, formatTime, formatValue } from '@/lib/tekhsi/decode'
import { toLongCsv } from '@/lib/tekhsi/csv'
import type { TekChannel } from '@/lib/tekhsi/types'

function i16(values: number[]): Uint8Array {
  const buf = new ArrayBuffer(values.length * 2)
  const view = new DataView(buf)
  values.forEach((v, i) => view.setInt16(i * 2, v, true))
  return new Uint8Array(buf)
}

function f32(values: number[]): Uint8Array {
  const buf = new ArrayBuffer(values.length * 4)
  const view = new DataView(buf)
  values.forEach((v, i) => view.setFloat32(i * 4, v, true))
  return new Uint8Array(buf)
}

describe('TekHSI decode', () => {
  it('decodes int8 with y = raw * spacing + offset', () => {
    const data = new Uint8Array(new Int8Array([0, 1, -1, 127]).buffer)
    expect(decodeAnalog(data, 1, 0.5, 1)).toEqual([1, 1.5, 0.5, 64.5])
  })

  it('decodes int16 (little-endian) with scaling', () => {
    expect(decodeAnalog(i16([0, 100, -100, 200]), 2, 0.5, -1)).toEqual([-1, 49, -51, 99])
  })

  it('decodes float32 (little-endian) with scaling', () => {
    const out = decodeAnalog(f32([0, 1.5, -2.25]), 4, 2, 0.5)
    expect(out).toEqual([0.5, 3.5, -4])
  })

  it('rejects unsupported source widths', () => {
    expect(() => decodeAnalog(new Uint8Array(3), 3, 1, 0)).toThrow(/sourcewidth/)
  })

  it('decimates to maxPoints with a stride', () => {
    const values = Array.from({ length: 10 }, (_, i) => i)
    expect(decimate(values, 10)).toEqual({ values, stride: 1 })
    expect(decimate(values, 3)).toEqual({ values: [0, 4, 8], stride: 4 })
  })

  it('computes trigger-relative time', () => {
    expect(timeAt(0, 1e-6, 5)).toBeCloseTo(-5e-6, 12)
    expect(timeAt(5, 1e-6, 5)).toBe(0)
    expect(timeAt(6, 1e-6, 5)).toBeCloseTo(1e-6, 12)
  })

  it('formats time/value labels', () => {
    expect(formatTime(1e-9)).toContain('ns')
    expect(formatTime(1e-6)).toContain('µs')
    expect(formatTime(1e-3)).toContain('ms')
    expect(formatTime(1)).toContain('s')
    expect(formatValue(0)).toBe('0')
    expect(formatValue(1500)).toContain('k')
  })
})

describe('TekHSI CSV', () => {
  it('writes long-format rows using stride/trigger/dt', () => {
    const channels: TekChannel[] = [
      {
        name: 'ch1',
        yUnits: 'V',
        xUnits: 's',
        dt: 1e-6,
        triggerIndex: 1,
        ySpacing: 0.1,
        yOffset: 0,
        points: 4,
        samples: 4,
        stride: 2,
        y: [1.5, 2.5]
      }
    ]
    const csv = toLongCsv(channels)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('channel,time_s,value')
    expect(lines[1]).toContain('ch1,')
    // index 0 → (0 - 1) * 1e-6; index 2 → (2 - 1) * 1e-6
    expect(lines[1]).toContain('-0.000001')
    expect(lines[2]).toContain('0.000001')
    expect(lines[1].endsWith(',1.5')).toBe(true)
    expect(lines[2].endsWith(',2.5')).toBe(true)
  })
})
