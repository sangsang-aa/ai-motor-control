import { describe, it, expect } from 'vitest'
import { demuxAlgoChannels } from '@/lib/analysis/demux'
import { estimateForTest, estimateWithPrior, perChannelTs } from '@/lib/analysis/paramEstimation'
import { ALGO_CHANNELS, FRAME_INTERVAL_S } from '@/lib/config'

// 端到端(轮发 → 解复用 → 辨识)回归:验证 per-channel ts 与通道 skew 补偿
const R = 0.12952
const Ld_true = 114.82e-6
const Lq_true = 116.25e-6
const f = 100
const Nch = 3000

const slotOf = (k: string) => ALGO_CHANNELS.findIndex((c) => c.key === k)
const skewFrames = (iKey: string, vKey: string) => slotOf(iKey) - slotOf(vKey)

function rlSignals(L: number) {
  const w = 2 * Math.PI * f
  const Z = Math.hypot(R, w * L)
  const phi = Math.atan2(w * L, R)
  const tsc = perChannelTs()
  const V: number[] = []
  const I: number[] = []
  for (let k = 0; k < Nch; k++) {
    const t = k * tsc
    V.push(Math.sin(w * t))
    I.push((1 / Z) * Math.sin(w * (t + skewFrames('Id', 'Vd') * FRAME_INTERVAL_S) - phi))
  }
  return { V, I }
}

function interleave(chan: Record<string, number[]>): { a: number; b: number }[] {
  const out: { a: number; b: number }[] = []
  for (let k = 0; k < Nch; k++) {
    for (const c of ALGO_CHANNELS) out.push({ a: chan[c.key][k], b: 0 })
  }
  return out
}

describe('轮发→解复用→辨识(ts 与 skew)', () => {
  it('每通道采样间隔 = 帧间隔 × 通道数', () => {
    expect(perChannelTs()).toBeCloseTo(FRAME_INTERVAL_S * ALGO_CHANNELS.length, 12)
    expect(perChannelTs()).toBeCloseTo(250e-6, 9)
  })

  it('Ld:即使跨通道有 skew,也能还原真值(3% 内)', () => {
    const { V, I } = rlSignals(Ld_true)
    const series = demuxAlgoChannels(
      interleave({ Vd: V, Vq: [], Id: I, Iq: [], Speed: [] })
    )
    const r = estimateForTest(2, series, { rBoard: 0, rs: R })
    expect(Math.abs(((r.Ld as number) - Ld_true) / Ld_true)).toBeLessThan(0.03)
  })

  it('Lq:还原真值(3% 内)', () => {
    const w = 2 * Math.PI * f
    const Z = Math.hypot(R, w * Lq_true)
    const phi = Math.atan2(w * Lq_true, R)
    const tsc = perChannelTs()
    const Vq: number[] = []
    const Iq: number[] = []
    for (let k = 0; k < Nch; k++) {
      const t = k * tsc
      Vq.push(Math.sin(w * t))
      Iq.push((1 / Z) * Math.sin(w * (t + skewFrames('Iq', 'Vq') * FRAME_INTERVAL_S) - phi))
    }
    const series = demuxAlgoChannels(interleave({ Vd: [], Vq, Id: [], Iq, Speed: [] }))
    const r = estimateForTest(3, series, { rBoard: 0, rs: R })
    expect(Math.abs(((r.Lq as number) - Lq_true) / Lq_true)).toBeLessThan(0.03)
  })

  it('Ld 依赖先验 Rs:不传 Rs 时为 0,传 Rs 后还原真值', () => {
    const { V, I } = rlSignals(Ld_true)
    const samples = interleave({ Vd: V, Vq: [], Id: I, Iq: [], Speed: [] })
    expect(estimateWithPrior(2, samples, { rBoard: 0 }).Ld).toBe(0)
    const withRs = estimateWithPrior(2, samples, { rBoard: 0, Rs: R })
    expect(Math.abs(((withRs.Ld as number) - Ld_true) / Ld_true)).toBeLessThan(0.03)
  })
})
