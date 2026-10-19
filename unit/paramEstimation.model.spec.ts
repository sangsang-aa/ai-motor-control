import { describe, it, expect } from 'vitest'
import { estimateLFrom, estimateForTest } from '@/lib/analysis/paramEstimation'
import { ALGO_CHANNELS } from '@/lib/config'
import type { AlgoSeries } from '@/lib/analysis/demux'

// 样例 mcb_pmsm_param_est_f28379d_data.m 的电机参数(作为"样例答案"/真值)
const MOTOR = { p: 5, Rs: 0.12952, Ld: 114.82e-6, Lq: 116.25e-6 }

/** RL 支路正弦稳态:V=V0·sin(ωt), I 滞后 φ=atan(ωL/R) */
function rlSine(V0: number, f: number, R: number, L: number, ts: number, n: number) {
  const w = 2 * Math.PI * f
  const Z = Math.hypot(R, w * L)
  const phi = Math.atan2(w * L, R)
  const V: number[] = []
  const I: number[] = []
  for (let k = 0; k < n; k++) {
    const t = k * ts
    V.push(V0 * Math.sin(w * t))
    I.push((V0 / Z) * Math.sin(w * t - phi))
  }
  return { V, I }
}

const emptySeries = (): AlgoSeries =>
  Object.fromEntries(ALGO_CHANNELS.map((c) => [c.key, [] as number[]])) as AlgoSeries

describe('用样例电机参数做物理模型验证(对比样例答案)', () => {
  const ts = 1 / 20000
  const n = 600

  it('Rs 两点法恢复 Rs ≈ 0.12952', () => {
    const R = MOTOR.Rs
    const V1 = 0.3
    const V2 = 0.9
    const s = emptySeries()
    s.Vd = [V1, V1, V1, V2, V2, V2]
    s.Id = [V1 / R, V1 / R, V1 / R, V2 / R, V2 / R, V2 / R]
    const r = estimateForTest(1, s, { ts, rBoard: 0 })
    expect(Math.abs(((r.Rs as number) - MOTOR.Rs) / MOTOR.Rs)).toBeLessThan(0.01)
  })

  it('Ld 相位法恢复 Ld ≈ 114.82e-6(多频点)', () => {
    for (const f of [200, 500, 1000]) {
      const { V, I } = rlSine(1, f, MOTOR.Rs, MOTOR.Ld, ts, n)
      const L = estimateLFrom(MOTOR.Rs, V, I, ts)
      expect(Math.abs((L - MOTOR.Ld) / MOTOR.Ld)).toBeLessThan(0.03)
    }
  })

  it('Lq 相位法恢复 Lq ≈ 116.25e-6(多频点)', () => {
    for (const f of [200, 500, 1000]) {
      const { V, I } = rlSine(1, f, MOTOR.Rs, MOTOR.Lq, ts, n)
      const L = estimateLFrom(MOTOR.Rs, V, I, ts)
      expect(Math.abs((L - MOTOR.Lq) / MOTOR.Lq)).toBeLessThan(0.03)
    }
  })
})
