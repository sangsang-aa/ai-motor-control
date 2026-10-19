import { describe, it, expect } from 'vitest'
import { assessQuality } from '@/lib/analysis/quality'

const samples = (n: number) => Array.from({ length: n }, (_, i) => ({ a: Math.sin(i) + 1, b: Math.cos(i) + 1 }))

describe('数据可用性判定', () => {
  it('完整且有效 → ok', () => {
    const r = assessQuality(samples(600), 600, 1)
    expect(r.complete).toBe(true)
    expect(r.valid).toBe(true)
    expect(r.ok).toBe(true)
    expect(r.reason).toBeUndefined()
  })

  it('无数据 → 完整性不合格', () => {
    const r = assessQuality([], 0, 0)
    expect(r.complete).toBe(false)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('未收到')
  })

  it('完整块不足 → 完整性不合格', () => {
    const r = assessQuality(samples(600), 600, 0)
    expect(r.complete).toBe(false)
    expect(r.ok).toBe(false)
  })

  it('含 NaN → 完整性不合格', () => {
    const s = samples(10)
    s[3].a = NaN
    const r = assessQuality(s, 10, 1)
    expect(r.complete).toBe(false)
    expect(r.reason).toContain('NaN')
  })

  it('全为零 → 有效性不合格', () => {
    const z = Array.from({ length: 600 }, () => ({ a: 0, b: 0 }))
    const r = assessQuality(z, 600, 1)
    expect(r.complete).toBe(true)
    expect(r.valid).toBe(false)
    expect(r.ok).toBe(false)
  })

  it('饱和(超量程)→ 有效性不合格', () => {
    const r = assessQuality(samples(600), 600, 1, { maxAbs: 1 })
    expect(r.valid).toBe(false)
    expect(r.ok).toBe(false)
  })
})
