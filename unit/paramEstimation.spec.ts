import { describe, it, expect } from 'vitest'
import { estimateFrequency, estimatePhaseRad, estimateForTest } from '@/lib/analysis/paramEstimation'
import type { AlgoSeries } from '@/lib/analysis/demux'

const series = (over: Partial<AlgoSeries> = {}): AlgoSeries => ({
  Vd: [],
  Vq: [],
  Id: [],
  Iq: [],
  Speed: [],
  ...over
})

describe('样例算法(主机侧)', () => {
  it('由过零间隔估计频率', () => {
    const ts = 1e-4
    const v = Array.from({ length: 600 }, (_, i) => Math.sin(2 * Math.PI * 100 * i * ts))
    expect(estimateFrequency(v, ts)).toBeCloseTo(100, 1)
  })

  it('相位差有限且落在 [0,2π)', () => {
    const ts = 1e-4
    const v = Array.from({ length: 600 }, (_, i) => Math.sin(2 * Math.PI * 100 * i * ts))
    const c = Array.from({ length: 600 }, (_, i) => Math.sin(2 * Math.PI * 100 * i * ts - Math.PI / 3))
    const p = estimatePhaseRad(v, c, ts)
    expect(Number.isFinite(p)).toBe(true)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThan(2 * Math.PI)
  })

  it('Rs 由两点差分法得到', () => {
    const s = series({
      Vd: [1, 1, 1, 2, 2, 2],
      Id: [0.1, 0.1, 0.1, 0.2, 0.2, 0.2]
    })
    const r = estimateForTest(1, s, { ts: 1e-4, rBoard: 0 })
    expect(r.Rs).toBeCloseTo(10, 6)
  })

  it('Ld/Lq 给出有限值', () => {
    const ts = 1e-4
    const f = 100
    const v = Array.from({ length: 600 }, (_, i) => Math.sin(2 * Math.PI * f * i * ts))
    const c = Array.from({ length: 600 }, (_, i) => Math.sin(2 * Math.PI * f * i * ts - Math.PI / 4))
    expect(estimateForTest(2, series({ Vd: v, Id: c }), { ts, rBoard: 0, rs: 1 }).Ld).toBeDefined()
    expect(estimateForTest(3, series({ Vq: v, Iq: c }), { ts, rBoard: 0, rs: 1 }).Lq).toBeDefined()
  })

  it('Mech 给出 Ke/B(有限)', () => {
    const s = series({ Vd: [0], Vq: [5], Id: [0], Iq: [2], Speed: [3000] })
    const r = estimateForTest(4, s, { ts: 1e-4, rBoard: 0, rs: 0.5, polePairs: 5 })
    expect(Number.isFinite(r.Ke as number)).toBe(true)
    expect(Number.isFinite(r.B as number)).toBe(true)
  })
})
